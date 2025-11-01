# Task Priority System

## Übersicht

Das System verwendet **zwei unabhängige Task-Manager** mit unterschiedlichen Prioritätssystemen:

1. **TaskQueueManager** - Für Bot-Operationen und Commands (agent.js)
2. **TaskManager** - Für komplexe Bauprojekte und Material-Management (task_manager.js)

## TaskQueueManager Prioritäten (Commands & Bot-Operations)

```javascript
TaskPriority = {
    CRITICAL: 10,     // Spieler-Commands (!build, !craft, etc.)
    LLM_CMD: 9,       // LLM-generierte Commands (höchste KI-Priorität)
    HIGH: 7,          // Kampf/Flucht, wichtige Reaktionen
    NORMAL: 5,        // Standard Bot-Operationen
    LOW: 2,           // Idle-Aktivitäten
    BACKGROUND: 1     // Autonome Hintergrundaufgaben
}
```

### Command-Ausführung über TaskQueue

**Alle `!command` Befehle laufen jetzt über den TaskQueueManager:**

- **Spieler-Commands** (`!build`, `!craft`, etc.) → Priorität **10 (CRITICAL)**
  - Unterbrechen ALLE laufenden Tasks
  - Können selbst nicht unterbrochen werden
  - Werden in Warteschlange eingereiht (mehrere Commands nacheinander möglich)

- **LLM-Commands** (von der AI generiert) → Priorität **9 (LLM_CMD)**
  - Unterbrechen normale Tasks (Priorität < 9)
  - Werden von Spieler-Commands unterbrochen
  - Können ebenfalls in Warteschlange stehen

### Vorteile der TaskQueue-Integration

✅ **Keine Unterbrechungen mehr** - Commands laufen vollständig durch
✅ **Warteschlange** - Mehrere Commands werden nacheinander abgearbeitet
✅ **Intelligente Priorisierung** - Wichtige Commands unterbrechen unwichtige Tasks
✅ **Task-Tracking** - Alle Commands sind nachverfolgbar

## TaskManager Prioritäten (Building & Crafting)

```javascript
PRIORITY = {
    CRITICAL: 100,    // Dringende Material-Beschaffung
    HIGH: 50,         // Tool-Upgrades, wichtige Subtasks
    NORMAL: 25,       // Standard-Tasks
    LOW: 10          // Idle-Tasks, Background-Tasks
}
```

## Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    Player/LLM Input                      │
│                  (!build, !craft, etc.)                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   agent.js            │
         │   handleMessage()     │
         └───────────┬───────────┘
                     │
         ┌───────────▼──────────────────────┐
         │  executeCommandWithPriority()    │
         │  Priority: Player=10, LLM=9      │
         └───────────┬──────────────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │  TaskQueueManager      │
         │  - Warteschlange       │
         │  - Unterbrechung       │
         │  - Priorisierung       │
         └────────────────────────┘
```

## Verwendung

### 1. Commands werden automatisch priorisiert

**Keine Code-Änderungen erforderlich!** Alle `!command` Befehle werden automatisch mit der richtigen Priorität ausgeführt:

```javascript
// Spieler schreibt im Chat:
// !build("house")
// → Wird automatisch mit Priorität 10 (CRITICAL) ausgeführt

// LLM generiert Command:
// "Let me build a house. !build("house")"
// → Wird automatisch mit Priorität 9 (LLM_CMD) ausgeführt
```

### 2. Beispiel: Command-Warteschlange

```javascript
// Spieler gibt mehrere Commands hintereinander:
!craft("wooden_pickaxe", 1)  // → Queue Position 1 (Prio 10)
!collect("cobblestone", 64)   // → Queue Position 2 (Prio 10)
!build("house")               // → Queue Position 3 (Prio 10)

// LLM generiert parallel einen Command:
!goToPosition(100, 70, 200)   // → Queue Position 4 (Prio 9)

// Ausführungsreihenfolge:
// 1. craft wooden_pickaxe (Spieler - Prio 10)
// 2. collect cobblestone (Spieler - Prio 10)
// 3. build house (Spieler - Prio 10)
// 4. goToPosition (LLM - Prio 9)
```

### 3. TaskManager für komplexe Projekte (optional)

Für komplexe Bauprojekte mit Material-Management:

```javascript
import { addCriticalTask } from './systems/task_manager.js';

// Automatisch mit CRITICAL Priorität (100)
await addCriticalTask(bot, 'Build Complex Structure', {
    'oak_planks': 64,
    'stone': 32,
    'iron_ingot': 10
}, skills);
```

## Verhalten und Features

### Task-Unterbrechung

```javascript
// Szenario: Bot sammelt gerade Holz (Idle-Task, Priorität LOW=2)
// Spieler gibt Command:
!build("house")  // Priorität CRITICAL=10

// Ergebnis:
// 1. Idle-Task wird pausiert
// 2. build-Command wird sofort ausgeführt
// 3. Nach Fertigstellung wird Idle-Task fortgesetzt (falls resumable)
```

### Warteschlangen-Management

Alle Commands mit gleicher Priorität werden **FIFO** (First-In-First-Out) abgearbeitet:

```javascript
// Zeitpunkt T=0: Spieler gibt 3 Commands
!craft("pickaxe", 1)   // T=0, Prio 10
!mine("iron_ore", 10)  // T=1, Prio 10
!craft("sword", 1)     // T=2, Prio 10

// Ausführung: Genau in dieser Reihenfolge!
```

### Command-Eigenschaften

Alle über `executeCommandWithPriority` ausgeführten Commands haben:

- ✅ **interruptible: false** - Können nicht unterbrochen werden
- ✅ **resumable: false** - Können nicht pausiert werden
- ✅ **timeout: -1** - Kein Timeout

### 4. TaskManager: Task mit spezifischer Priorität

```javascript
import { createComplexTask } from './systems/task_manager.js';

// Task mit HIGH Priorität
await createComplexTask(
    bot,
    'Craft Iron Tools',
    { 'iron_pickaxe': 1, 'iron_axe': 1 },
    skills,
    50  // HIGH Priority
);

// Task mit LOW Priorität (Background-Task)
await createComplexTask(
    bot,
    'Collect Wood (Idle)',
    { 'oak_log': 32 },
    skills,
    10  // LOW Priority
);
```

### 4. TaskManager-Instanz verwenden

```javascript
const taskManager = new TaskManager(bot, skills);

// Kritischer Task
await taskManager.addCriticalTask('Emergency: Find Shelter', {
    'cobblestone': 20
});

// Direkter Task
taskManager.addDirectTask('Say Hello', async () => {
    bot.chat('Hello!');
});

// Task mit Custom-Priorität
await taskManager.createComplexTask(
    'Mine Resources',
    { 'iron_ore': 10 },
    'Mining iron for tools',
    taskManager.PRIORITY.HIGH
);
```

## Verhalten

### Sortierung der Task-Queue

Die Task-Queue wird automatisch nach Priorität sortiert:
1. **Höchste Priorität zuerst** - Tasks mit höherer Priorität werden immer zuerst ausgeführt
2. **Bei gleicher Priorität**: Ältere Tasks zuerst (FIFO)

### Beispiel

```javascript
// Diese Tasks werden in dieser Reihenfolge ausgeführt:
await createComplexTask(bot, 'Task A', {}, skills, 10);   // LOW - wird als 4. ausgeführt
await addCriticalTask(bot, 'Task B', {}, skills);          // CRITICAL - wird als 1. ausgeführt
await createComplexTask(bot, 'Task C', {}, skills, 50);   // HIGH - wird als 2. ausgeführt
await createComplexTask(bot, 'Task D', {}, skills, 25);   // NORMAL - wird als 3. ausgeführt
```

### Task-Ausführung Logs

Tasks zeigen ihre Priorität in den Logs:

```
🚀 Starting task [⚡ CRITICAL]: Player Command: Build House
🚀 Starting task [🔥 HIGH]: Craft Iron Tools
🚀 Starting task [📋 NORMAL]: Mine Resources
🚀 Starting task [💤 LOW]: Collect Wood (Idle)
```

## Integration mit Idle-System

Idle-Tasks sollten immer mit `PRIORITY.LOW` erstellt werden:

```javascript
// Im Idle-System
if (bot.modes.isIdle()) {
    await createComplexTask(
        bot,
        'Idle: Collect Resources',
        { 'oak_log': 16 },
        skills,
        taskManager.PRIORITY.LOW  // Niedrige Priorität für Idle-Tasks
    );
}
```

## Debug & Monitoring

### Task-Status abfragen

```javascript
// Im Code:
const status = agent.taskQueue.getStatus();
console.log(status);

// Output:
{
    currentTask: {
        id: 5,
        name: "Player: !build",
        priority: 10,
        state: "running",
        runtime: 2341
    },
    queueSize: 2,
    queue: [
        { id: 6, name: "LLM: !craft", priority: 9, state: "queued" },
        { id: 7, name: "Idle: Collect Wood", priority: 2, state: "queued" }
    ],
    stats: {
        totalTasksCreated: 15,
        totalTasksCompleted: 12,
        totalTasksFailed: 1,
        totalTasksCancelled: 0,
        totalInterruptions: 3
    }
}
```

### Console-Ausgabe

```javascript
agent.taskQueue.printStatus();
```

### Logs

Das System gibt automatisch detaillierte Logs aus:

```
📋 Task created: Task[5:Player: !build](priority=10, state=queued)
📥 Task enqueued: Task[5:Player: !build] (queue size: 1)
▶️ Starting Task[5:Player: !build]
🎮 Executing command: !build("house")
✅ Command completed: Player: !build
✅ Task[5:Player: !build] completed (runtime: 2341ms)
```

## Best Practices

### Für Bot-Entwickler

1. **Commands**: Verwende immer das normale `!command` Format - Priorisierung erfolgt automatisch
2. **Idle-Tasks**: Erstelle mit `TaskPriority.LOW` (2) oder `BACKGROUND` (1)
3. **Überlebens-Tasks**: Verwende `TaskPriority.CRITICAL` (10) für lebensbedrohliche Situationen
4. **Kampf/Flucht**: `TaskPriority.HIGH` (7)

### Für TaskManager (Komplexe Projekte)

1. **Dringende Material-Beschaffung**: `PRIORITY.CRITICAL` (100)
2. **Tool-Upgrades**: `PRIORITY.HIGH` (50)
3. **Normale Crafting/Mining**: `PRIORITY.NORMAL` (25) - Default
4. **Idle/Background-Tasks**: `PRIORITY.LOW` (10)

## Kompatibilität

- ✅ **Vollständig rückwärtskompatibel**
- ✅ **Bestehende Commands funktionieren ohne Änderung**
- ✅ **TaskManager-Tasks ohne Priorität erhalten automatisch `PRIORITY.NORMAL`**
- ✅ **Keine Breaking Changes**
