/**
 * Task Queue Manager - Priority-based Task Execution System
 *
 * Solves the interrupt chaos by introducing clear priority levels and task states.
 * Tasks can be paused and resumed instead of being abruptly interrupted.
 *
 * Priority Levels:
 * - CRITICAL (10): Survival (drowning, burning, critical health)
 * - HIGH (7): Combat/Fleeing (enemy encounters)
 * - NORMAL (5): User commands and active goals
 * - LOW (2): Idle activities (hunting, item collecting)
 * - BACKGROUND (1): Autonomous maintenance tasks
 *
 * @author Dudu AI Team
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const TaskPriority = {
    CRITICAL: 10,    // Überleben - stoppt alles
    HIGH: 7,         // Kampf/Flucht - pausiert normale Tasks
    NORMAL: 5,       // User Commands, aktive Ziele
    LOW: 2,          // Idle-Aktivitäten
    BACKGROUND: 1    // Autonome Hintergrundaufgaben
};

export const TaskState = {
    QUEUED: 'queued',       // Wartet auf Ausführung
    RUNNING: 'running',     // Wird gerade ausgeführt
    PAUSED: 'paused',       // Pausiert durch höher-prioritären Task
    COMPLETED: 'completed', // Erfolgreich abgeschlossen
    FAILED: 'failed',       // Fehlgeschlagen
    CANCELLED: 'cancelled'  // Manuell abgebrochen
};

// ============================================================================
// TASK CLASS
// ============================================================================

class Task {
    constructor(id, name, priority, executeFn, options = {}) {
        this.id = id;
        this.name = name;
        this.priority = priority;
        this.executeFn = executeFn;
        this.state = TaskState.QUEUED;

        // Options
        this.timeout = options.timeout || -1; // -1 = kein timeout
        this.resumable = options.resumable !== false; // default: true
        this.interruptible = options.interruptible !== false; // default: true
        this.onPause = options.onPause || null; // Callback beim Pausieren
        this.onResume = options.onResume || null; // Callback beim Fortsetzen
        this.metadata = options.metadata || {}; // Zusätzliche Daten

        // State tracking
        this.createdAt = Date.now();
        this.startedAt = null;
        this.pausedAt = null;
        this.completedAt = null;
        this.pausedDuration = 0; // Gesamte pausierte Zeit
        this.result = null;
        this.error = null;
    }

    /**
     * Prüft ob dieser Task einen anderen Task unterbrechen kann
     */
    canInterrupt(otherTask) {
        if (!otherTask.interruptible) return false;
        return this.priority > otherTask.priority;
    }

    /**
     * Pausiert den Task
     */
    async pause() {
        if (this.state !== TaskState.RUNNING) return;

        this.state = TaskState.PAUSED;
        this.pausedAt = Date.now();

        if (this.onPause) {
            await this.onPause(this);
        }
    }

    /**
     * Setzt den Task fort
     */
    async resume() {
        if (this.state !== TaskState.PAUSED) return;

        this.state = TaskState.RUNNING;

        if (this.pausedAt) {
            this.pausedDuration += Date.now() - this.pausedAt;
            this.pausedAt = null;
        }

        if (this.onResume) {
            await this.onResume(this);
        }
    }

    /**
     * Markiert Task als gestartet
     */
    markStarted() {
        this.state = TaskState.RUNNING;
        this.startedAt = Date.now();
    }

    /**
     * Markiert Task als abgeschlossen
     */
    markCompleted(result = null) {
        this.state = TaskState.COMPLETED;
        this.completedAt = Date.now();
        this.result = result;
    }

    /**
     * Markiert Task als fehlgeschlagen
     */
    markFailed(error) {
        this.state = TaskState.FAILED;
        this.completedAt = Date.now();
        this.error = error;
    }

    /**
     * Gibt die Laufzeit zurück (ohne Pausen)
     */
    getRuntime() {
        if (!this.startedAt) return 0;
        const endTime = this.completedAt || Date.now();
        return (endTime - this.startedAt) - this.pausedDuration;
    }

    /**
     * String-Repräsentation für Debugging
     */
    toString() {
        return `Task[${this.id}:${this.name}](priority=${this.priority}, state=${this.state})`;
    }
}

// ============================================================================
// TASK QUEUE MANAGER
// ============================================================================

export class TaskQueueManager {
    constructor(agent) {
        this.agent = agent;
        this.tasks = new Map(); // task.id -> Task
        this.queue = []; // Sortierte Queue nach Priorität
        this.currentTask = null;
        this.isProcessing = false; // Flag um Race Conditions zu verhindern
        this.taskIdCounter = 0;
        this.history = []; // Abgeschlossene Tasks (max 50)
        this.maxHistorySize = 50;

        // Statistiken
        this.stats = {
            totalTasksCreated: 0,
            totalTasksCompleted: 0,
            totalTasksFailed: 0,
            totalTasksCancelled: 0,
            totalInterruptions: 0
        };
    }

    /**
     * Erstellt einen neuen Task
     */
    createTask(name, priority, executeFn, options = {}) {
        const id = this.taskIdCounter++;
        const task = new Task(id, name, priority, executeFn, options);

        this.tasks.set(id, task);
        this.stats.totalTasksCreated++;

        console.log(`📋 Task created: ${task}`);

        return task;
    }

    /**
     * Fügt einen Task zur Queue hinzu
     */
    async enqueueTask(task) {
        // Füge zur Queue hinzu (sortiert nach Priorität)
        this.queue.push(task);
        this.queue.sort((a, b) => b.priority - a.priority);

        console.log(`📥 Task enqueued: ${task} (queue size: ${this.queue.length})`);

        // Prüfe ob Task den aktuellen Task unterbrechen kann
        if (this.currentTask && task.canInterrupt(this.currentTask)) {
            console.log(`⚠️ ${task} interrupts ${this.currentTask}`);
            this.stats.totalInterruptions++;

            // Pausiere aktuellen Task
            await this.pauseCurrentTask();

            // Starte Queue-Verarbeitung neu (der neue Task hat höchste Priorität)
            if (!this.isProcessing) {
                await this.processQueue();
            }
        }
        // Starte Ausführung wenn kein Task läuft und Queue nicht bereits verarbeitet wird
        else if (!this.currentTask && !this.isProcessing) {
            await this.processQueue();
        }
    }

    /**
     * Pausiert den aktuellen Task
     */
    async pauseCurrentTask() {
        // Prüfe ob überhaupt ein Task läuft
        if (!this.currentTask) {
            console.log(`⚠️ No current task to pause (already finished?)`);
            return;
        }

        // Task kann nicht pausiert werden - abbrechen
        if (!this.currentTask.resumable) {
            console.log(`⚠️ Current task is not resumable, cancelling it`);
            await this.cancelTask(this.currentTask.id);
            return;
        }

        console.log(`⏸️ Pausing ${this.currentTask}`);

        // Stoppe bot actions
        try {
            await this.agent.actions.stop();
        } catch (error) {
            console.warn(`Warning: Could not stop actions:`, error.message);
        }

        // Pausiere Task
        await this.currentTask.pause();

        // Zurück in Queue
        this.queue.unshift(this.currentTask);
        this.queue.sort((a, b) => b.priority - a.priority);

        this.currentTask = null;
    }

    /**
     * Verarbeitet die Task-Queue
     */
    async processQueue() {
        // Verhindere parallele Ausführung
        if (this.isProcessing) {
            console.log(`⚠️ Already processing queue, skipping duplicate call`);
            return;
        }

        this.isProcessing = true;

        try {
            while (this.queue.length > 0) {
                // Nächsten Task holen (höchste Priorität)
                const nextTask = this.queue.shift();
                this.currentTask = nextTask;

                // Fortsetzen oder starten
                if (nextTask.state === TaskState.PAUSED) {
                    console.log(`▶️ Resuming ${nextTask}`);
                    await nextTask.resume();
                } else {
                    console.log(`▶️ Starting ${nextTask}`);
                    nextTask.markStarted();
                }

                // Task ausführen
                try {
                    const result = await this.executeTask(nextTask);
                    nextTask.markCompleted(result);
                    this.stats.totalTasksCompleted++;
                    console.log(`✅ ${nextTask} completed (runtime: ${nextTask.getRuntime()}ms)`);
                } catch (error) {
                    nextTask.markFailed(error);
                    this.stats.totalTasksFailed++;
                    console.error(`❌ ${nextTask} failed:`, error);
                }

                // Task in History verschieben
                this.moveToHistory(nextTask);
                this.currentTask = null;
            }

            // Keine Tasks mehr
            console.log(`✅ Task queue empty - bot is now idle`);
            this.agent.bot.emit('idle');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Führt einen Task aus
     */
    async executeTask(task) {
        // Timeout-Handling
        let timeoutHandle = null;
        if (task.timeout > 0) {
            timeoutHandle = setTimeout(() => {
                console.warn(`⏱️ ${task} timed out after ${task.timeout}ms`);
                this.agent.actions.stop();
            }, task.timeout);
        }

        try {
            // Führe Task-Funktion aus über ActionManager
            const result = await this.agent.actions.runAction(
                `task:${task.name}`,
                async () => await task.executeFn(this.agent, task),
                { timeout: task.timeout > 0 ? task.timeout / 60000 : -1 }
            );

            if (timeoutHandle) clearTimeout(timeoutHandle);
            return result;
        } catch (error) {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            throw error;
        }
    }

    /**
     * Bricht einen Task ab
     */
    async cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        // Wenn Task gerade läuft, stoppe ihn
        if (this.currentTask?.id === taskId) {
            await this.agent.actions.stop();
            this.currentTask = null;
        }

        // Aus Queue entfernen
        this.queue = this.queue.filter(t => t.id !== taskId);

        // Als cancelled markieren
        task.state = TaskState.CANCELLED;
        task.completedAt = Date.now();
        this.stats.totalTasksCancelled++;

        console.log(`🚫 ${task} cancelled`);

        this.moveToHistory(task);
        return true;
    }

    /**
     * Verschiebt Task in History
     */
    moveToHistory(task) {
        this.tasks.delete(task.id);
        this.history.unshift(task);

        // Begrenze History-Größe
        if (this.history.length > this.maxHistorySize) {
            this.history.pop();
        }
    }

    /**
     * Gibt aktuellen Status zurück
     */
    getStatus() {
        return {
            currentTask: this.currentTask ? {
                id: this.currentTask.id,
                name: this.currentTask.name,
                priority: this.currentTask.priority,
                state: this.currentTask.state,
                runtime: this.currentTask.getRuntime()
            } : null,
            queueSize: this.queue.length,
            queue: this.queue.map(t => ({
                id: t.id,
                name: t.name,
                priority: t.priority,
                state: t.state
            })),
            stats: this.stats
        };
    }

    /**
     * Debug-Ausgabe
     */
    printStatus() {
        console.log('\n=== TASK QUEUE STATUS ===');
        console.log(`Current Task: ${this.currentTask || 'none'}`);
        console.log(`Queue Size: ${this.queue.length}`);
        if (this.queue.length > 0) {
            console.log('Queue:');
            this.queue.forEach((t, i) => {
                console.log(`  ${i + 1}. ${t}`);
            });
        }
        console.log(`Stats:`, this.stats);
        console.log('========================\n');
    }

    /**
     * Prüft ob Bot aktuell idle ist
     */
    isIdle() {
        return this.currentTask === null && this.queue.length === 0;
    }

    /**
     * Gibt die höchste Priorität in der Queue zurück
     */
    getHighestQueuedPriority() {
        if (this.queue.length === 0) return 0;
        return Math.max(...this.queue.map(t => t.priority));
    }

    /**
     * Erstellt und führt einen Task direkt aus (Convenience-Methode)
     */
    async runTask(name, priority, executeFn, options = {}) {
        const task = this.createTask(name, priority, executeFn, options);
        await this.enqueueTask(task);
        return task;
    }
}
