# 🏗️ Neue Architektur - Task-basiertes System

## 📖 Überblick

Die neue Architektur löst das **Interrupt-Chaos** durch ein prioritätsbasiertes Task-Queue-System und erweitert das Bot-Gedächtnis um kontextbezogene Informationen.

### Hauptprobleme der alten Architektur

1. **Interrupt-Chaos**: Modes konnten sich gegenseitig endlos unterbrechen
   - Beispiel: `self_defense` → `cowardice` → `unstuck` → Endlosschleife
   - Resultat: `PathStopped` Fehler, Bot gerät in Panik

2. **Minimales Memory**: Nur `{name: [x,y,z]}` Dictionary
   - Keine Info über Equipment-Status, Goals, Inventory

3. **Keine autonome Produktivität**: Bot tut nichts wenn idle

---

## 🎯 Neue Komponenten

### 1. TaskQueueManager (`task_queue_manager.js`)

**Ersetzt**: Chaotische Mode-Interrupts

**Prioritäten:**
```javascript
CRITICAL (10)   // Überleben (brennen, ertrinken, kritisches Leben)
HIGH (7)        // Kampf/Flucht
NORMAL (5)      // User-Commands, aktive Ziele
LOW (2)         // Idle-Aktivitäten (hunting, collecting)
BACKGROUND (1)  // Reine Animationen
```

**Task-States:**
- `queued` - Wartet auf Ausführung
- `running` - Wird ausgeführt
- `paused` - Pausiert durch höher-prioritären Task
- `completed` - Abgeschlossen
- `failed` - Fehlgeschlagen

**Beispiel-Flow:**
```
Bot sammelt Holz (NORMAL)
  → Creeper erscheint
    → "collectWood" wird PAUSIERT
    → "fleeFromCreeper" (HIGH) startet
    → Nach Flucht: "collectWood" wird FORTGESETZT ✅
```

**Verwendung:**
```javascript
// Einfacher Task
await agent.taskQueue.runTask(
    'gather_food',
    TaskPriority.LOW,
    async (agent) => {
        await skills.collectBlock(agent.bot, 'apple', 5);
    },
    {
        timeout: 120000,  // 2 Minuten
        resumable: true    // Kann pausiert werden
    }
);

// Task mit Resume-Logic
await agent.taskQueue.runTask(
    'mine_diamonds',
    TaskPriority.NORMAL,
    async (agent, task) => {
        // Task.metadata kann für State genutzt werden
        if (!task.metadata.started) {
            task.metadata.started = true;
            task.metadata.mined = 0;
        }

        while (task.metadata.mined < 5) {
            await skills.mineBlock(agent.bot, 'diamond_ore');
            task.metadata.mined++;
        }
    },
    {
        resumable: true,
        onPause: async (task) => {
            console.log(`Paused at ${task.metadata.mined}/5 diamonds`);
        },
        onResume: async (task) => {
            console.log(`Resuming from ${task.metadata.mined}/5 diamonds`);
        }
    }
);
```

---

### 2. ContextualMemory (`contextual_memory.js`)

**Ersetzt**: Simples `memory_bank.js`

**Neue Strukturen:**

#### Locations
```javascript
locations: {
    homepoint: [x, y, z],        // ✅ Spawn/Base
    mainBase: [x, y, z],
    storageArea: [x, y, z],
    workbench: [x, y, z],
    bed: [x, y, z],
    custom: { ... }              // Legacy compatibility
}
```

#### Equipment Status
```javascript
equipment: {
    hasWoodenTools: boolean,
    hasStoneTools: boolean,
    hasIronTools: boolean,
    hasDiamondTools: boolean,
    hasIronArmor: boolean,
    hasShield: boolean,
    lastChecked: timestamp
}
```

#### Inventory Status
```javascript
inventory: {
    foodCount: number,
    torches: number,
    bed: boolean,
    crafting_table: boolean,
    essentials: [{name, count}, ...]
}
```

#### Death Recovery
```javascript
session: {
    deathCount: number,
    lastDeathLocation: [x, y, z],
    lastDeathTime: timestamp,
    deathInProgress: boolean
}
```

**Verwendung:**
```javascript
// Homepoint setzen
agent.contextual_memory.setHomepoint(x, y, z);

// Equipment-Status aktualisieren
agent.contextual_memory.updateEquipmentStatus(agent.bot);
const tier = agent.contextual_memory.getBestToolTier();
// Returns: 'none', 'wooden', 'stone', 'iron', 'diamond', 'netherite'

// Death-Recovery prüfen
if (agent.contextual_memory.isDeathRecoveryPending()) {
    const loc = agent.contextual_memory.getDeathLocation();
    const timeLeft = agent.contextual_memory.getRecoveryTimeRemaining();
    console.log(`Items at [${loc}] - ${timeLeft}s remaining!`);
}

// LLM-Kontext generieren
const context = agent.contextual_memory.generateContextString();
// Returns:
// "Equipment: stone tools, no armor
//  Inventory: 3 food, 12 torches, bed: yes
//  Homepoint: [100, 64, 200]
//  ⚠️ DEATH RECOVERY: Items at [50, 70, 150] - 245s remaining!"
```

---

### 3. IdleTaskGenerator (`idle_task_generator.js`)

**Funktion**: Autonome Produktivität when idle

**Generiert Tasks für:**
1. **CRITICAL**: Death Recovery (Items einsammeln)
2. **NORMAL**: Nahrung sammeln, Bett für Nacht
3. **LOW**: Tool-Upgrades, Fackeln craften, Workbench
4. **BACKGROUND**: Holz/Ressourcen sammeln

**Intelligente Checks:**
```javascript
// Food check
if (!memory.hasEnoughFood(10)) {
    → Task: Hunt animals
}

// Nighttime check
if (isNight && !memory.inventory.bed) {
    → Task: Craft or find bed
}

// Tool upgrade check
if (toolTier === 'wooden' && hasCobblestone) {
    → Task: Craft stone tools
}
```

**Cooldowns:**
- Verhindert Spam (min. 1 Minute zwischen gleichen Tasks)
- Konfigurierbar per Task

**Verwendung:**
```javascript
// Wird automatisch im agent.update() aufgerufen
// Manueller Trigger:
await agent.idleTaskGenerator.checkAndGenerateTasks();

// Cooldowns zurücksetzen (für Testing):
agent.idleTaskGenerator.resetCooldowns();
```

---

### 4. DecisionEngine (`decision_engine.js`)

**Funktion**: LLM-basierte strategische Entscheidungen

**Szenarien:**
```javascript
// Was tun wenn idle?
const decision = await agent.decisionEngine.decideIdleAction();

// Komplexes Goal erreichen
const decision = await agent.decisionEngine.decideGoalStrategy(
    "build enchanting table"
);

// Stuck-Situation lösen
const decision = await agent.decisionEngine.decideUnstuckStrategy(
    "need diamonds but only have stone tools"
);
```

**Decision Format:**
```javascript
{
    summary: "Gather iron first, then mine diamonds",
    reasoning: "Stone tools can't mine diamonds. Need iron pickaxe.",
    steps: [
        "Collect 3 iron ore",
        "Smelt iron ore in furnace",
        "Craft iron pickaxe",
        "Mine diamonds with iron pickaxe"
    ]
}
```

**Execution:**
```javascript
const decision = await agent.decisionEngine.decideGoalStrategy("get diamonds");
await agent.decisionEngine.executeDecision(decision, TaskPriority.NORMAL);
// → Erstellt 4 Tasks in der Queue
```

**Auto-Planning:**
```javascript
// Aktiviert automatische Entscheidungen
agent.decisionEngine.enableAutoPlanning();
// → Bei Tod: Automatische Recovery-Planung
// → Bei 3min Idle: LLM fragt "Was soll ich tun?"
```

---

## 🔄 Migration Guide

### Option 1: Reine Nutzung (keine Mode-Änderungen)

Modes laufen weiter wie bisher, aber du kannst das neue System nutzen:

```javascript
// In deinem Code:
await agent.taskQueue.runTask('my_task', TaskPriority.NORMAL, async (agent) => {
    // ... your code
});

// Memory nutzen:
agent.contextual_memory.setHomepoint(x, y, z);
const homepoint = agent.contextual_memory.getHomepoint();
```

### Option 2: Modes migrieren (empfohlen)

Ersetze in `modes.js`:
```javascript
// Alt:
import { execute } from './modes.js';

// Neu:
import { executeAsTask } from './modes_task_wrapper.js';

// In deinem Mode:
update: async function(agent) {
    if (someCondition) {
        executeAsTask(this, agent, async () => {
            // ... dein code
        });
    }
}
```

**Fertig!** Der Wrapper kümmert sich um:
- Automatische Prioritäts-Zuweisung
- Task-Queue Integration
- Pause/Resume Logic

---

## 📊 Status & Debugging

### Task Queue Status
```javascript
// Console-Output
agent.taskQueue.printStatus();
```

```
=== TASK QUEUE STATUS ===
Current Task: Task[5:mine_iron](priority=5, state=running)
Queue Size: 2
Queue:
  1. Task[6:flee_from_creeper](priority=7, state=queued)
  2. Task[4:collect_wood](priority=5, state=paused)
Stats: { totalTasksCreated: 7, totalTasksCompleted: 3, ... }
========================
```

### Memory Status
```javascript
console.log(agent.contextual_memory.generateContextString());
```

```
Equipment: iron tools, iron armor
Inventory: 15 food, 23 torches, bed: yes
Homepoint: [100, 64, 200]
Current goals: build enchanting table, find diamonds
```

---

## 🎮 Verwendungsbeispiele

### Beispiel 1: Death Recovery

**Automatisch:**
```
Bot stirbt → ContextualMemory.recordDeath()
  → IdleTaskGenerator.checkDeathRecovery()
    → Task: "death_recovery" (HIGH priority)
      → Bot geht zum Sterbeort
      → Sammelt Items ein (5min Timer)
```

**Manuell:**
```javascript
if (agent.contextual_memory.isDeathRecoveryPending()) {
    const loc = agent.contextual_memory.getDeathLocation();
    await agent.taskQueue.runTask('recover', TaskPriority.HIGH, async (agent) => {
        await skills.goToPosition(agent.bot, ...loc);
        await skills.pickupNearbyItems(agent.bot);
        agent.contextual_memory.completeDeathRecovery();
    });
}
```

### Beispiel 2: Komplexe Aufgabe mit Sub-Tasks

```javascript
// User: "Get me diamonds"

// 1. LLM-Entscheidung
const decision = await agent.decisionEngine.decideGoalStrategy("get diamonds");
// Decision: "Need iron tools first"

// 2. Automatische Task-Chain
await agent.decisionEngine.executeDecision(decision);
// Erstellt:
//   - Task 1: Mine iron ore
//   - Task 2: Smelt iron
//   - Task 3: Craft iron pickaxe
//   - Task 4: Mine diamonds

// 3. Während Task 2 läuft:
//   Creeper erscheint → Task 2 wird PAUSIERT
//   Flee-Task (HIGH) läuft
//   Nach Flucht: Task 2 wird FORTGESETZT ✅
```

### Beispiel 3: Idle Produktivität

```
Bot spawnt frisch auf Server
  → Kein Equipment, kein Essen
  → IdleTaskGenerator prüft alle 10s

Check 1: "No wooden tools"
  → Task: Collect wood + craft tools (LOW)

Check 2: "No food"
  → Task pausiert, Hunt animals (NORMAL) startet
  → Nach Jagd: Tool-Task resumes

Check 3: "Night approaches, no bed"
  → Task pausiert, Find bed (NORMAL) startet

Ergebnis: Bot baut autonom Grundausrüstung auf! 🎉
```

---

## ⚙️ Konfiguration

### Task Priorities anpassen
```javascript
// In modes_task_wrapper.js:
const priorityMap = {
    'my_custom_mode': TaskPriority.HIGH,
    // ...
};
```

### Idle Generator Cooldowns
```javascript
// In idle_task_generator.js:
this.checkInterval = 10000;      // Alle 10s prüfen
this.minCooldown = 60000;        // 1min zwischen gleichen Tasks
```

### Decision Engine Cooldown
```javascript
// In decision_engine.js:
this.decisionCooldown = 30000;   // 30s zwischen LLM-Anfragen
```

---

## 🐛 Troubleshooting

### Problem: Tasks werden nicht ausgeführt

**Check 1**: Ist TaskQueue initialisiert?
```javascript
console.log(agent.taskQueue);  // sollte nicht undefined sein
```

**Check 2**: Läuft bereits ein Task?
```javascript
agent.taskQueue.printStatus();
```

**Check 3**: Ist Bot wirklich idle?
```javascript
console.log(agent.isIdle());
console.log(agent.taskQueue.isIdle());
```

### Problem: Modes interrupten sich immer noch

**Lösung**: Modes müssen `executeAsTask` verwenden, nicht das alte `execute`

```javascript
// Prüfe in modes.js:
import { executeAsTask } from './modes_task_wrapper.js';
// Ersetze alle execute() calls mit executeAsTask()
```

### Problem: Death Recovery läuft nicht

**Check**: Ist contextual_memory initialisiert?
```javascript
console.log(agent.contextual_memory.isDeathRecoveryPending());
console.log(agent.contextual_memory.getDeathLocation());
```

---

## 📝 Best Practices

### 1. Task-Granularität

**Gut:**
```javascript
await agent.taskQueue.runTask('mine_iron_ore', priority, async () => {
    await skills.mineOreVein(bot, 'iron_ore', 5);
});
```

**Schlecht:**
```javascript
await agent.taskQueue.runTask('get_full_diamond_gear', priority, async () => {
    // 50 Zeilen Code...
    // → Zu komplex, schwer zu unterbrechen
});
```

### 2. Resumable Tasks

Nutze `resumable: true` + Metadata für lange Tasks:
```javascript
await agent.taskQueue.runTask('build_house', priority, async (agent, task) => {
    if (!task.metadata.placedBlocks) task.metadata.placedBlocks = 0;

    while (task.metadata.placedBlocks < 100) {
        await skills.placeBlock(...);
        task.metadata.placedBlocks++;
    }
}, { resumable: true });
```

### 3. Prioritäten

- **CRITICAL**: Nur für lebensbedrohliche Situationen
- **HIGH**: Kampf, Flucht, wichtige Schutzmaßnahmen
- **NORMAL**: User-Commands, aktive Ziele
- **LOW**: Idle-Optimierungen
- **BACKGROUND**: Reine Animationen

### 4. Memory Updates

Aktualisiere Memory regelmäßig:
```javascript
// Im Main-Loop oder nach wichtigen Actions:
agent.contextual_memory.updateEquipmentStatus(agent.bot);
agent.contextual_memory.updateInventoryStatus(agent.bot);
```

---

## 🚀 Nächste Schritte

1. **Testen**: Starte den Bot und beobachte die Task-Queue
2. **Modes migrieren**: Ersetze `execute` mit `executeAsTask` Schritt für Schritt
3. **Erweitern**: Füge eigene Idle-Tasks hinzu
4. **Auto-Planning**: Aktiviere `agent.decisionEngine.enableAutoPlanning()`

---

## 📚 API Reference

### TaskQueueManager

```javascript
runTask(name, priority, executeFn, options)
createTask(name, priority, executeFn, options)
enqueueTask(task)
cancelTask(taskId)
isIdle()
getStatus()
printStatus()
```

### ContextualMemory

```javascript
// Locations
setHomepoint(x, y, z)
getHomepoint()
rememberPlace(name, x, y, z)
recallPlace(name)

// Status
updateEquipmentStatus(bot)
updateInventoryStatus(bot)
getBestToolTier()
hasEnoughFood(threshold)

// Death
recordDeath(x, y, z)
getDeathLocation()
isDeathRecoveryPending()
getRecoveryTimeRemaining()
completeDeathRecovery()

// Context
generateContextString()
```

### IdleTaskGenerator

```javascript
checkAndGenerateTasks()
resetCooldowns()
```

### DecisionEngine

```javascript
makeDecision(context, question)
decideIdleAction()
decideGoalStrategy(goal)
decideUnstuckStrategy(problem)
executeDecision(decision, priority)
enableAutoPlanning()
```

---

**Version**: 2.0.0
**Author**: Dudu AI Team
**Date**: 2025-01-16
