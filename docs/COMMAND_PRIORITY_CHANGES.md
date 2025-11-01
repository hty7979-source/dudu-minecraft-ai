# Command Priority System - Änderungen

## Problem

Das Tasksystem hat Commands immer wieder unterbrochen, was zu abgebrochenen Operationen und inkonsistentem Verhalten führte.

## Lösung

Alle `!command` Befehle laufen jetzt über den **TaskQueueManager** mit intelligenter Priorisierung:

### Prioritätshierarchie

```
10 → Spieler-Commands    (!build, !craft, etc.)
 9 → LLM-Commands        (AI-generierte Befehle)
 7 → HIGH Priority       (Kampf, Flucht)
 5 → NORMAL              (Standard Bot-Operationen)
 2 → LOW                 (Idle-Aktivitäten)
 1 → BACKGROUND          (Autonome Hintergrundaufgaben)
```

## Implementierung

### 1. agent.js - Änderungen

**Import TaskPriority:**
```javascript
import { TaskQueueManager, TaskPriority } from './task_queue_manager.js';
```

**Neue Funktion: `executeCommandWithPriority()`**
- Führt Commands über TaskQueue aus
- Setzt korrekte Priorität
- Erstellt nicht-unterbrechbare Tasks
- Verwaltet Warteschlange

**Spieler-Commands:**
```javascript
// Zeile 242-243
await this.executeCommandWithPriority(message, TaskPriority.CRITICAL, source, `Player: ${user_command_name}`);
```

**LLM-Commands:**
```javascript
// Zeile 318-319
const LLM_COMMAND_PRIORITY = 9;
await this.executeCommandWithPriority(res, LLM_COMMAND_PRIORITY, source, `LLM: ${command_name}`);
```

### 2. task_manager.js - Erweitert

**Neue Prioritätskonstanten:**
```javascript
this.PRIORITY = {
    CRITICAL: 100,
    HIGH: 50,
    NORMAL: 25,
    LOW: 10
};
```

**Neue Funktionen:**
- `addCriticalTask()` - Für dringende Tasks
- `addDirectTask()` - Für einfache Task-Ausführung
- `sortTaskQueueByPriority()` - Automatische Queue-Sortierung

### 3. Dokumentation

- **TASK_PRIORITY_SYSTEM.md** - Vollständige Dokumentation
- **COMMAND_PRIORITY_CHANGES.md** - Diese Datei

## Vorteile

✅ **Keine Unterbrechungen mehr**
- Commands laufen vollständig durch
- Keine abgebrochenen Build-Operationen
- Konsistentes Verhalten

✅ **Intelligente Priorisierung**
- Spieler-Commands haben höchste Priorität
- LLM-Commands knapp darunter
- Idle-Tasks werden automatisch pausiert

✅ **Warteschlangen-Management**
- Mehrere Commands können gleichzeitig eingereicht werden
- FIFO-Verarbeitung bei gleicher Priorität
- Volle Kontrolle über Task-Ausführung

✅ **Volle Rückwärtskompatibilität**
- Keine Breaking Changes
- Bestehende Commands funktionieren ohne Änderung
- Alte Task-Systeme bleiben kompatibel

## Beispiel-Szenario

### Vorher (Problem)
```
1. Bot sammelt Holz (Idle)
2. Spieler: !build("house")
3. Build startet
4. Idle-Task unterbricht Build → Build abbricht ❌
5. Inkonsistenter Zustand
```

### Nachher (Gelöst)
```
1. Bot sammelt Holz (Idle, Prio 2)
2. Spieler: !build("house") → Prio 10
3. Holz-Sammeln wird pausiert ⏸️
4. Build läuft komplett durch ✅
5. Build fertig
6. Holz-Sammeln wird fortgesetzt ▶️
```

## Testing

### Test 1: Spieler-Command-Priorität
```javascript
// Während Bot idle ist:
!build("house")
→ Sollte sofort ausgeführt werden
→ Log: "▶️ Starting Task[X:Player: !build](priority=10, state=running)"
```

### Test 2: LLM-Command-Priorität
```javascript
// LLM generiert:
!craft("pickaxe", 1)
→ Sollte mit Priorität 9 ausgeführt werden
→ Log: "▶️ Starting Task[X:LLM: !craft](priority=9, state=running)"
```

### Test 3: Warteschlange
```javascript
// Schnell hintereinander:
!craft("pickaxe", 1)
!mine("stone", 64)
!build("house")
→ Alle 3 sollten in dieser Reihenfolge ausgeführt werden
→ Keine Unterbrechungen zwischen Commands
```

### Test 4: Unterbrechung von Idle
```javascript
// Bot ist idle (sammelt Items)
// Spieler gibt Command:
!goToPosition(100, 70, 200)
→ Idle-Task wird pausiert
→ Command wird ausgeführt
→ Idle-Task wird fortgesetzt
```

## Code-Locations

### Geänderte Dateien
- [src/agent/agent.js](../src/agent/agent.js#L12) - Import TaskPriority
- [src/agent/agent.js](../src/agent/agent.js#L242-243) - Spieler-Commands
- [src/agent/agent.js](../src/agent/agent.js#L318-319) - LLM-Commands
- [src/agent/agent.js](../src/agent/agent.js#L335-379) - executeCommandWithPriority()
- [src/agent/library/systems/task_manager.js](../src/agent/library/systems/task_manager.js#L307-313) - PRIORITY Konstanten
- [src/agent/library/systems/task_manager.js](../src/agent/library/systems/task_manager.js#L381-426) - Neue Funktionen

### Neue Dateien
- [docs/TASK_PRIORITY_SYSTEM.md](TASK_PRIORITY_SYSTEM.md) - Vollständige Dokumentation
- [docs/COMMAND_PRIORITY_CHANGES.md](COMMAND_PRIORITY_CHANGES.md) - Diese Datei

## Migration

**Keine Migration erforderlich!** Das System ist vollständig rückwärtskompatibel.

Optionale Anpassungen:
- Idle-Tasks sollten mit `TaskPriority.LOW` erstellt werden
- Überlebens-relevante Tasks mit `TaskPriority.CRITICAL`

## Monitoring

```javascript
// Task-Status anzeigen
agent.taskQueue.printStatus();

// Programmatischer Zugriff
const status = agent.taskQueue.getStatus();
console.log(`Current task: ${status.currentTask?.name}`);
console.log(`Queue size: ${status.queueSize}`);
console.log(`Total interruptions: ${status.stats.totalInterruptions}`);
```

## Zukünftige Erweiterungen

Mögliche weitere Verbesserungen:

1. **Task-Gruppen** - Mehrere verwandte Tasks als Gruppe
2. **Abhängigkeiten** - Task A wartet auf Task B
3. **Zeitbasierte Priorität** - Ältere Tasks erhalten höhere Priorität
4. **Dynamische Priorisierung** - Priorität ändert sich basierend auf Kontext
5. **Task-Vorschau** - Zeige geplante Tasks im Chat

## Support

Bei Problemen oder Fragen:
1. Prüfe die Logs auf Fehler
2. Verwende `agent.taskQueue.printStatus()` für Debugging
3. Siehe [TASK_PRIORITY_SYSTEM.md](TASK_PRIORITY_SYSTEM.md) für Details
