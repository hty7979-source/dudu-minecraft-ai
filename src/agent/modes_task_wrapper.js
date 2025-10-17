/**
 * Modes Task Wrapper
 *
 * Wrapper-Funktionen um die bestehenden Modes mit dem neuen Task-Queue-System zu verbinden.
 * Ermöglicht Rückwärtskompatibilität während wir schrittweise migrieren.
 *
 * Die `execute()` Funktion wird so angepasst, dass sie Tasks in die Queue einreiht
 * statt direkt über ActionManager zu laufen.
 *
 * @author Dudu AI Team
 */

import { TaskPriority } from './task_queue_manager.js';
import convoManager from './conversation.js';

/**
 * Ersatz für die alte execute() Funktion in modes.js
 * Erstellt Tasks in der TaskQueue statt direkt Actions auszuführen
 */
export async function executeAsTask(mode, agent, func, timeout = -1) {
    // Stop self-prompting if active
    if (agent.self_prompter.isActive()) {
        agent.self_prompter.stopLoop();
    }

    // Bestimme Priorität basierend auf Mode-Name
    const priority = getModePriority(mode.name);

    // Track what action was interrupted
    let interrupted_action = agent.actions.currentActionLabel;

    // Erstelle Task und füge zur Queue hinzu
    await agent.taskQueue.runTask(
        `mode:${mode.name}`,
        priority,
        async (agent, task) => {
            // Mark mode as active
            mode.active = true;

            try {
                await func();
            } finally {
                mode.active = false;
            }
        },
        {
            timeout: timeout > 0 ? timeout : -1,
            resumable: mode.name !== 'self_preservation', // self_preservation nicht resumable
            interruptible: priority < TaskPriority.CRITICAL,
            metadata: {
                type: 'mode',
                modeName: mode.name
            },
            onPause: async (task) => {
                console.log(`⏸️ Mode ${mode.name} paused`);
            },
            onResume: async (task) => {
                console.log(`▶️ Mode ${mode.name} resumed`);
            }
        }
    );

    // Auto-prompt logic (optional - kann später entfernt werden)
    let should_reprompt =
        interrupted_action && // An action was interrupted
        !agent.actions.resume_func && // No resume function available
        !agent.self_prompter.isActive(); // Self prompting not active

    if (should_reprompt) {
        // Auto-prompt to respond to the interruption
        let role = convoManager.inConversation() ? agent.last_sender : 'system';
        let logs = agent.bot.modes.flushBehaviorLog();

        agent.handleMessage(role,
            `(AUTO MESSAGE) Your previous action '${interrupted_action}' was interrupted by ${mode.name}. ` +
            `Behavior log: ${logs}\nRespond accordingly.`);
    }
}

/**
 * Bestimmt die Priorität eines Modes basierend auf seinem Namen
 */
function getModePriority(modeName) {
    const priorityMap = {
        // CRITICAL - Überleben
        'self_preservation': TaskPriority.CRITICAL,

        // HIGH - Kampf/Flucht
        'cowardice': TaskPriority.HIGH,
        'self_defense': TaskPriority.HIGH,
        'unstuck': TaskPriority.HIGH,

        // LOW - Idle-Aktivitäten
        'hunting': TaskPriority.LOW,
        'item_collecting': TaskPriority.LOW,
        'torch_placing': TaskPriority.LOW,
        'elbow_room': TaskPriority.LOW,

        // BACKGROUND - Reine Animationen
        'idle_staring': TaskPriority.BACKGROUND,
        'cheat': TaskPriority.BACKGROUND
    };

    return priorityMap[modeName] || TaskPriority.NORMAL;
}

/**
 * Prüft ob ein Mode einen aktuellen Task unterbrechen kann
 * Wird von Modes aufgerufen bevor sie execute() nutzen
 */
export function canModeInterrupt(mode, agent) {
    const modePriority = getModePriority(mode.name);
    const currentTask = agent.taskQueue.currentTask;

    if (!currentTask) {
        return true; // Kein Task läuft - immer erlaubt
    }

    // Prüfe ob Mode-Priorität hoch genug ist
    return modePriority > currentTask.priority;
}
