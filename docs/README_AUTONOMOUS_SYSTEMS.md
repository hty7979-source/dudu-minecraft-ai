# Autonome Systeme - Übersicht

## 📋 Dokumentations-Index

Dieses Verzeichnis enthält die vollständige Dokumentation für alle autonomen Systeme des Minecraft-Bots.

**Erstellt:** Januar 2025
**Version:** 2.0.0

---

## 📚 Haupt-Dokumentationen

### **1. [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md)**
**Gesamtsystem-Architektur**

- Task Queue Manager (Priority-based Tasks)
- Contextual Memory System
- Idle Task Generator
- Decision Engine (LLM Integration)
- Modes Task Wrapper (Legacy Compatibility)

**Für:** Entwickler die das Gesamtsystem verstehen wollen

---

### **2. [MATERIAL_PLANNER_GUIDE.md](./MATERIAL_PLANNER_GUIDE.md)**
**Intelligentes Material-Planungssystem**

- Automatische Rezept-Analyse
- Inventar-Berücksichtigung
- Optimierte Sammel-Pläne
- API-Referenz
- Code-Beispiele

**Für:** Features die automatisch Materialien sammeln müssen

---

### **3. [TOOL_DURABILITY_SYSTEM.md](./TOOL_DURABILITY_SYSTEM.md)**
**Automatische Werkzeug-Wartung**

- Durability-Überwachung (< 5%)
- Automatischer Tool-Ersatz
- smartCraft Integration
- Test-Szenarien
- Troubleshooting

**Für:** Wartungs- und Repair-Systeme

---

### **4. [TEST_SCENARIOS.md](./TEST_SCENARIOS.md)**
**Umfassende Test-Szenarien**

- 6 Haupt-Testfälle
- Erwartete Verhaltensweisen
- Debug-Tipps
- Performance-Tests

**Für:** Testen neuer Features

---

### **5. [COMMAND_AUDIT_REPORT.md](./COMMAND_AUDIT_REPORT.md)**
**Command-System Audit**

- Alle 42 Commands dokumentiert
- Kategorisiert nach Funktion
- Parameter-Standardisierung
- Konsistenz-Prüfungen

**Für:** Command-Entwicklung und -Nutzung

---

## 🚀 Quick Start Guide

### **Für Entwickler:**

1. **Lies zuerst:** [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md)
   - Verstehe das Task-System
   - Lerne Priority Levels
   - Siehe Pause/Resume-Logik

2. **Dann:** [MATERIAL_PLANNER_GUIDE.md](./MATERIAL_PLANNER_GUIDE.md)
   - Nutze MaterialPlanner für neue Features
   - Siehe API-Referenz
   - Code-Beispiele anschauen

3. **Zuletzt:** [TEST_SCENARIOS.md](./TEST_SCENARIOS.md)
   - Teste deine Features
   - Nutze vorgefertigte Szenarien

---

### **Für Tester:**

1. **Start:** [TEST_SCENARIOS.md](./TEST_SCENARIOS.md)
   - 6 Haupt-Tests durchführen
   - Erwartete Outputs prüfen

2. **Bei Problemen:** Spezifische Guides:
   - Tool-Probleme → [TOOL_DURABILITY_SYSTEM.md](./TOOL_DURABILITY_SYSTEM.md)
   - Material-Probleme → [MATERIAL_PLANNER_GUIDE.md](./MATERIAL_PLANNER_GUIDE.md)
   - Command-Probleme → [COMMAND_AUDIT_REPORT.md](./COMMAND_AUDIT_REPORT.md)

---

### **Für User:**

1. **Commands lernen:** [COMMAND_AUDIT_REPORT.md](./COMMAND_AUDIT_REPORT.md)
   - Alle verfügbaren Commands
   - Beispiele und Syntax

2. **Wie funktioniert der Bot:** [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md)
   - Section "Für User" lesen
   - Verstehe autonomes Verhalten

---

## 🎯 Feature-Matrix

| Feature | Status | Dokumentation | Location |
|---------|--------|---------------|----------|
| **Task Queue System** | ✅ Aktiv | [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md) | `src/agent/task_queue_manager.js` |
| **Material Planner** | ✅ Aktiv | [MATERIAL_PLANNER_GUIDE.md](./MATERIAL_PLANNER_GUIDE.md) | `src/agent/material_planner.js` |
| **Tool Durability** | ✅ Aktiv | [TOOL_DURABILITY_SYSTEM.md](./TOOL_DURABILITY_SYSTEM.md) | `src/agent/idle_task_generator.js:167` |
| **Idle Task Generator** | ✅ Aktiv | [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md) | `src/agent/idle_task_generator.js` |
| **Contextual Memory** | ✅ Aktiv | [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md) | `src/agent/contextual_memory.js` |
| **Death Recovery** | ✅ Aktiv | [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md) | `src/agent/idle_task_generator.js:117` |
| **Smart Crafting** | ✅ Aktiv | [MATERIAL_PLANNER_GUIDE.md](./MATERIAL_PLANNER_GUIDE.md) | `src/agent/library/systems/crafting_system.js` |
| **Decision Engine** | ⚠️ Beta | [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md) | `src/agent/decision_engine.js` |

---

## 🔧 System-Komponenten

### **Kern-Systeme:**

```
┌─────────────────────────────────────────┐
│         Task Queue Manager               │
│  (Priority-based Task Execution)         │
│  - CRITICAL, HIGH, NORMAL, LOW, BG       │
│  - Pause/Resume statt Interrupts         │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│      Idle Task Generator                 │
│  (Autonome Task-Generierung)             │
│  - Tool Durability Check                 │
│  - Tool Upgrades                         │
│  - Food Gathering                        │
│  - Resource Gathering                    │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│       Material Planner                   │
│  (Intelligente Ressourcen-Planung)       │
│  - Rezept-Analyse                        │
│  - Inventar-Berücksichtigung             │
│  - Optimierte Sammel-Pläne               │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│      Contextual Memory                   │
│  (Erweiterte Memory-Verwaltung)          │
│  - Equipment Status                      │
│  - Inventory Tracking                    │
│  - Death Recovery                        │
│  - Locations (Homepoint, etc.)           │
└─────────────────────────────────────────┘
```

---

## 📊 Autonome Verhaltensweisen

### **Was der Bot AUTOMATISCH macht:**

1. **✅ Tool-Progression**
   - None → Wooden → Stone → Iron
   - Sammelt automatisch Materialien
   - Craftet komplette Tool-Sets

2. **✅ Tool-Wartung**
   - Prüft Durability alle 10 Sekunden
   - Ersetzt Tools unter 5%
   - Entsorgt alte Tools

3. **✅ Death Recovery**
   - Merkt sich Sterbeort
   - Läuft automatisch zurück (5min Timer)
   - Sammelt Items ein

4. **✅ Food Management**
   - Jagt Tiere wenn hungry
   - Sammelt Äpfel
   - Hält Food-Vorrat

5. **✅ Nighttime Handling**
   - Sucht Bett bei Nacht
   - Craftet Bett falls nötig
   - Schläft automatisch

6. **✅ Resource Gathering**
   - Sammelt Holz bei Bedarf
   - Sammelt Steine für Tools
   - Sammelt Coal für Fackeln

---

## 🎮 Prioritäts-System

```
CRITICAL (10)
│  └─ Death Recovery (5min Timer!)
│  └─ Drowning / Burning
│
HIGH (7)
│  └─ Combat (self_defense)
│  └─ Fleeing (cowardice)
│
NORMAL (5)
│  └─ User Commands
│  └─ Food Gathering
│  └─ Nighttime (Bed)
│
LOW (2)
│  └─ Tool Durability Check
│  └─ Tool Upgrades
│  └─ Torches
│  └─ Workbench
│
BACKGROUND (1)
   └─ Resource Gathering
   └─ Idle Activities
```

**Wichtig:**
- Höhere Priority kann niedrigere PAUSIEREN (nicht abbrechen!)
- Nach Kampf werden pausierte Tasks fortgesetzt
- Timeouts zählen nur AKTIVE Zeit (Pausen nicht mitgezählt)

---

## 🔄 Typischer Workflow

### **Bot startet von Null:**

```
1. Spawn → Homepoint gesetzt
2. Idle Task Generator startet
3. checkToolUpgrade() → toolTier = 'none'
4. Erstellt Task: upgrade_tools (LOW priority)
5. craftWoodenTools():
   a. MaterialPlanner analysiert: brauche 3 oak_logs
   b. Sammelt 3 oak_logs
   c. smartCraft handled Planks + Sticks + Tools
   d. Fertig: wooden_pickaxe, wooden_axe, wooden_sword
6. toolTier = 'wooden'
7. Nach 1min Cooldown:
8. checkToolUpgrade() → toolTier = 'wooden'
9. Erstellt Task: upgrade_tools
10. craftStoneTools():
    a. MaterialPlanner: brauche 11 cobblestone, coal
    b. Sammelt cobblestone (mit wooden_pickaxe!)
    c. Sammelt coal
    d. Craftet stone_pickaxe, stone_axe, stone_sword, furnace
11. toolTier = 'stone'
12. Bot hat jetzt komplettes Early-Game-Setup!

Während dem ganzen Prozess:
- Bei Kampf → pausiert, verteidigt, resümiert
- Bei Hunger → pausiert, isst, resümiert
- Bei Nacht → pausiert, schläft, resümiert
- Tools werden automatisch ersetzt wenn kaputt
```

---

## 🐛 Troubleshooting-Guide

### **Bot macht nichts:**
- Prüfe: Ist Bot idle? (Task-Queue leer?)
- Prüfe: Cooldowns aktiv?
- Siehe: [NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md) Section "Troubleshooting"

### **Tools werden nicht gecraftet:**
- Prüfe: Materialien vorhanden?
- Siehe: [MATERIAL_PLANNER_GUIDE.md](./MATERIAL_PLANNER_GUIDE.md) Section "Troubleshooting"

### **Tools werden nicht ersetzt:**
- Prüfe: Durability unter 5%?
- Siehe: [TOOL_DURABILITY_SYSTEM.md](./TOOL_DURABILITY_SYSTEM.md) Section "Troubleshooting"

### **Commands funktionieren nicht:**
- Prüfe: Richtige Syntax?
- Siehe: [COMMAND_AUDIT_REPORT.md](./COMMAND_AUDIT_REPORT.md)

---

## 📝 Changelog

### Version 2.0.0 (2025-01-17)
- ✅ Material Planner System implementiert
- ✅ Tool Durability System hinzugefügt
- ✅ Tool-Tier-Erkennung verbessert (Pickaxe + Axe required)
- ✅ Stage 1, 2, 3 mit MaterialPlanner integriert
- ✅ Vollständige Dokumentation erstellt
- ✅ Error-Handling verbessert (keine falschen Erfolgs-Meldungen)
- ✅ Inventar-Validierung nach jedem Schritt

### Version 1.0.0 (2025-01-15)
- ✅ Task Queue Manager
- ✅ Contextual Memory
- ✅ Idle Task Generator
- ✅ Death Recovery
- ✅ Basic Tool Upgrades

---

## 🙏 Credits

**Entwickelt von:** Dudu AI Team
**Zeitraum:** Januar 2025
**Status:** Production Ready

**Basiert auf:**
- Mineflayer Bot Framework
- Minecraft Protocol
- Node.js

---

## 📧 Support

**Für Fragen oder Probleme:**
1. Prüfe relevante Dokumentation
2. Schaue in Troubleshooting-Sections
3. Prüfe Code-Kommentare in Source-Files

**Source-Code Locations:**
- `src/agent/` - Alle Agent-Systeme
- `src/agent/library/` - Skills und Utilities
- `src/agent/commands/` - Command-System
- `docs/` - Alle Dokumentationen

---

**Ende der Übersicht**

Happy Coding! 🎮⚡
