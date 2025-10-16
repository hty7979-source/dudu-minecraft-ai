# 🔧 Refactoring Plan - Phase 4 (Priorität 1)

**Datum:** 2025-10-16
**Status:** 📋 Geplant - Bereit zur Umsetzung
**Geschätzter Aufwand:** 1-2 Stunden
**Ziel:** Unübersichtlichkeiten beheben, Struktur verbessern, Wartbarkeit erhöhen

---

## 🎯 Übersicht

Dieses Dokument beschreibt die **Priorität 1 Refactorings** - schnelle Wins mit großem Effekt.
Alle hier beschriebenen Änderungen sind bereits **vorbereitet** oder haben **minimalen Risiko**.

**Warum Priorität 1?**
- ✅ Event Handlers sind bereits fertig (nur Integration fehlt!)
- ✅ Klare Struktur-Verbesserungen ohne Logik-Änderungen
- ✅ Minimales Risiko - nur Move & Rename Operations
- ✅ Sofortiger Nutzen für Wartbarkeit

---

## 📦 Task 1: Event Handlers Integration

### Problem
- Datei `src/agent/event_handlers.js` wurde erstellt aber **NIE integriert**
- `agent.js` hat immer noch ~200 Zeilen Event-Handler-Code
- Refactoring wurde angefangen aber nicht beendet

### Lösung
**Schritt 1:** Prüfen ob `event_handlers.js` existiert
```bash
# Sollte existieren laut REFACTORING.md
ls src/agent/event_handlers.js
```

**Schritt 2:** In `agent.js` importieren
```javascript
// Am Anfang von agent.js hinzufügen
import { setupEventHandlers, setupAllEvents } from './event_handlers.js';
```

**Schritt 3:** `_setupEventHandlers()` Methode ersetzen
```javascript
// VORHER (Zeile 126):
async _setupEventHandlers(save_data, init_message) {
    // ... 70+ Zeilen Code ...
}

// NACHHER:
async _setupEventHandlers(save_data, init_message) {
    await setupEventHandlers(this, save_data, init_message);
}
```

**Schritt 4:** `startEvents()` Methode vereinfachen
```javascript
// VORHER (Zeile 409):
startEvents() {
    // ... 130+ Zeilen Event-Handler-Code ...
}

// NACHHER:
startEvents() {
    // Set up auto-eat
    this.bot.autoEat.options = {
        priority: BOT_BEHAVIOR.AUTO_EAT.PRIORITY,
        startAt: BOT_BEHAVIOR.AUTO_EAT.START_AT,
        bannedFood: BOT_BEHAVIOR.AUTO_EAT.BANNED_FOOD
    };

    // Setup all event handlers
    setupAllEvents(this);

    // Init NPC controller
    this.npc.init();

    // Main update loop
    let last = Date.now();
    setTimeout(async () => {
        while (true) {
            let start = Date.now();
            await this.update(start - last);
            let remaining = TIMING.UPDATE_INTERVAL_MS - (Date.now() - start);
            if (remaining > 0) {
                await new Promise((resolve) => setTimeout(resolve, remaining));
            }
            last = start;
        }
    }, TIMING.UPDATE_INTERVAL_MS);

    this.bot.emit('idle');
}
```

### Erwartetes Ergebnis
- ✅ `agent.js` reduziert von 576 auf ~380 Zeilen
- ✅ Event-Handler-Logik klar getrennt
- ✅ Einfacher zu testen und zu warten

### Risiko
⚠️ **NIEDRIG** - Code ist bereits fertig, nur Integration fehlt

### Testing
```bash
# Bot starten und prüfen ob Events funktionieren
npm start
# - Chat-Nachrichten empfangen?
# - Health-Events triggern Kampfmodus?
# - Death-Events werden erkannt?
```

---

## 📦 Task 2: Building Manager aufteilen

### Problem
`src/agent/building_manager.js` enthält 3 verschiedene Klassen:
1. **SchematicLoader** (Zeilen 20-144) - Lädt .schem Dateien
2. **SchematicRegistry** (Zeilen 147-252) - Verwaltet Schematic-Liste
3. **BuildingManager** (Rest) - Eigentliche Build-Logik

### Lösung

**Schritt 1:** Neue Ordnerstruktur erstellen
```bash
mkdir -p src/systems/building
```

**Schritt 2:** Klassen aufteilen

#### Datei 1: `src/systems/building/schematic_loader.js`
```javascript
import fs from 'fs';
import zlib from 'zlib';
import prismarineSchematic from 'prismarine-schematic';
import nbt from 'prismarine-nbt';

/**
 * SchematicLoader - Verantwortlich für das Laden und Parsen von Schematics
 * Unterstützt .schem und .schematic Formate (komprimiert und unkomprimiert)
 */
export class SchematicLoader {
    constructor(schematicsPath) {
        this.schematicsPath = schematicsPath;
    }

    // Komplette Methoden von Zeile 20-144 hierher kopieren
    async loadSchematic(filePath) { ... }
    async parseWorldEditNBT(buffer) { ... }
    extractPalette(schematicData) { ... }
    parseBlockState(blockString) { ... }
    createSchematicObject(width, height, length, palette, blockData) { ... }
}
```

#### Datei 2: `src/systems/building/schematic_registry.js`
```javascript
import fs from 'fs';
import path from 'path';
import { SchematicLoader } from './schematic_loader.js';

/**
 * SchematicRegistry - Verwaltet verfügbare Schematics
 * Lädt Schematic-Metadaten und cached geladene Schematics
 */
export class SchematicRegistry {
    constructor(schematicsPath) {
        this.schematicsPath = schematicsPath;
        this.schematics = {};
        this.loader = new SchematicLoader(schematicsPath);
    }

    // Komplette Methoden von Zeile 147-252 hierher kopieren
    loadAll() { ... }
    find(name) { ... }
    list() { ... }
    listByCategory() { ... }
    async loadSchematicData(schematicInfo) { ... }
    analyzeMaterials(schematicData) { ... }
}
```

#### Datei 3: `src/systems/building/building_manager.js`
```javascript
import path from 'path';
import { fileURLToPath } from 'url';
import * as skills from '../../agent/library/skills.js';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import settings from '../../../settings.js';
import * as mcdata from '../../utils/mcdata.js';
import { SchematicRegistry } from './schematic_registry.js';

const { goals } = pathfinder;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * BuildingManager - Hauptklasse für das Bau-System
 * Koordiniert Schematic-Loading, Material-Gathering und Block-Placement
 */
export class BuildingManager {
    // Rest der aktuellen BuildingManager-Klasse
    constructor(bot, agent) { ... }
    // ... alle anderen Methoden
}
```

#### Datei 4: `src/systems/building/index.js`
```javascript
/**
 * Building System - Exports
 * Zentraler Export-Point für alle Building-Komponenten
 */
export { SchematicLoader } from './schematic_loader.js';
export { SchematicRegistry } from './schematic_registry.js';
export { BuildingManager } from './building_manager.js';
```

**Schritt 3:** Imports aktualisieren

In `src/agent/agent.js` (Zeile 19):
```javascript
// VORHER:
import { BuildingManager } from './building_manager.js';

// NACHHER:
import { BuildingManager } from '../systems/building/index.js';
```

In allen anderen Dateien die BuildingManager verwenden:
```bash
# Finde alle Imports
grep -r "from './building_manager.js'" src/
grep -r "from '../building_manager.js'" src/
```

**Schritt 4:** Alte Datei löschen
```bash
# ERST NACHDEM alles funktioniert!
rm src/agent/building_manager.js
```

### Erwartetes Ergebnis
```
src/systems/building/
├── index.js                 # ~10 Zeilen - Exports
├── schematic_loader.js      # ~130 Zeilen - Laden & Parsen
├── schematic_registry.js    # ~110 Zeilen - Registry-Verwaltung
└── building_manager.js      # ~250 Zeilen - Build-Logik
```

**Vorteile:**
- ✅ Klare Trennung der Verantwortlichkeiten (Single Responsibility)
- ✅ Jede Klasse kann einzeln getestet werden
- ✅ Einfacher zu verstehen und zu warten
- ✅ Bessere Code-Organisation

### Risiko
⚠️ **NIEDRIG** - Nur Code-Moving, keine Logik-Änderung

### Testing
```bash
# Bot starten und Build-Befehl testen
npm start
# Im Chat: !build small_house
# Prüfen ob:
# - Schematic geladen wird
# - Materialien analysiert werden
# - Building startet
```

---

## 📦 Task 3: Library-Ordner aufräumen

### Problem
`src/agent/library/` hat inkonsistente Struktur:
```
library/
├── skills.js              # Basis-Skills (~1000+ Zeilen!)
├── skill_library.js       # Was ist der Unterschied zu skills.js?
├── smart_collect_enhanced.js  # Warum "enhanced"?
├── enhanced_mining.js         # Warum "enhanced"?
├── smart_crafting.js          # Warum "smart"?
├── full_state.js              # Unklar was das ist
├── world.js                   # World-Queries
├── task_manager.js            # Task-System
└── index.js
```

**Probleme:**
- ❌ `skills.js` ist MASSIV (1000+ Zeilen)
- ❌ Keine klare Namenskonvention ("enhanced" vs "smart")
- ❌ Unklar was `skill_library.js` vs `skills.js` ist
- ❌ Alles in einem flachen Ordner

### Lösung

**Schritt 1:** Struktur analysieren
```bash
# Zeilenzahlen prüfen
wc -l src/agent/library/*.js

# Exports prüfen
grep "^export" src/agent/library/skills.js | head -20
grep "^export" src/agent/library/skill_library.js | head -20
```

**Schritt 2:** Neue Struktur erstellen
```
src/agent/library/
├── core/                      # Basis-Funktionen
│   ├── movement.js           # Bewegungs-Skills aus skills.js
│   ├── combat.js             # Kampf-Skills aus skills.js
│   ├── inventory.js          # Inventar-Skills aus skills.js
│   ├── crafting.js           # Crafting-Skills aus skills.js
│   └── building.js           # Building-Skills aus skills.js
│
├── systems/                   # Komplexe Systeme
│   ├── collection.js         # smart_collect_enhanced.js (umbenennen)
│   ├── mining.js             # enhanced_mining.js (umbenennen)
│   ├── crafting_system.js    # smart_crafting.js (umbenennen)
│   └── task_manager.js       # Bleibt wie es ist
│
├── utils/                     # Utilities
│   ├── world.js              # Bleibt wie es ist
│   └── state.js              # full_state.js (umbenennen)
│
├── skills.js                  # LEGACY - Re-exportiert alles für Kompatibilität
├── skill_library.js           # Prüfen ob noch gebraucht, sonst löschen
└── index.js                   # Haupt-Export
```

**Schritt 3:** Migration in Phasen

#### Phase A: Skills.js aufteilen (Optional - kann später gemacht werden)
```javascript
// src/agent/library/core/movement.js
export async function goToPosition(bot, x, y, z, min_distance=2) { ... }
export async function goToPlayer(bot, username, distance=3) { ... }
export async function followPlayer(bot, username, follow_dist=4) { ... }
// ... alle Movement-Funktionen

// src/agent/library/core/combat.js
export async function attackEntity(bot, entity_name, kill=true) { ... }
export async function defendSelf(bot, range=16) { ... }
// ... alle Combat-Funktionen

// src/agent/library/core/inventory.js
export async function giveToPlayer(bot, username, item_name, num=null) { ... }
export async function consume(bot, item_name) { ... }
// ... alle Inventar-Funktionen
```

#### Phase B: Umbenennen der "enhanced" und "smart" Dateien
```bash
# Einfaches Rename
mv src/agent/library/smart_collect_enhanced.js src/agent/library/systems/collection.js
mv src/agent/library/enhanced_mining.js src/agent/library/systems/mining.js
mv src/agent/library/smart_crafting.js src/agent/library/systems/crafting_system.js
mv src/agent/library/full_state.js src/agent/library/utils/state.js
```

#### Phase C: Haupt-Exports aktualisieren
```javascript
// src/agent/library/index.js
export * from './core/movement.js';
export * from './core/combat.js';
export * from './core/inventory.js';
export * from './core/crafting.js';
export * from './core/building.js';
export * from './systems/collection.js';
export * from './systems/mining.js';
export * from './systems/crafting_system.js';
export * from './systems/task_manager.js';
export * from './utils/world.js';
export * from './utils/state.js';

// src/agent/library/skills.js (Legacy-Kompatibilität)
// Re-exportiert alles aus index.js
export * from './index.js';
console.warn('DEPRECATED: Import from library/index.js instead of library/skills.js');
```

**Schritt 4:** Imports schrittweise aktualisieren
```javascript
// VORHER:
import * as skills from './library/skills.js';

// NACHHER (Option 1 - Alles auf einmal):
import * as skills from './library/index.js';

// NACHHER (Option 2 - Spezifisch):
import { goToPosition, followPlayer } from './library/core/movement.js';
import { attackEntity } from './library/core/combat.js';
```

### Vereinfachter Ansatz (für Start)

**Minimale Änderungen - Nur Umbenennen:**
```bash
# Erstelle Ordner
mkdir -p src/agent/library/systems
mkdir -p src/agent/library/utils

# Verschiebe Dateien
mv src/agent/library/smart_collect_enhanced.js src/agent/library/systems/collection.js
mv src/agent/library/enhanced_mining.js src/agent/library/systems/mining.js
mv src/agent/library/smart_crafting.js src/agent/library/systems/crafting_system.js
mv src/agent/library/full_state.js src/agent/library/utils/state.js

# Aktualisiere Imports in allen Dateien
# (Git kann das automatisch tracken wenn man git mv nutzt)
git mv src/agent/library/smart_collect_enhanced.js src/agent/library/systems/collection.js
# etc.
```

### Erwartetes Ergebnis
- ✅ Klare Namenskonvention (keine "enhanced", "smart" Präfixe)
- ✅ Gruppierung nach Funktion (core, systems, utils)
- ✅ Einfacher zu finden was man sucht
- ✅ Vorbereitung für späteres Aufteilen von skills.js

### Risiko
⚠️ **NIEDRIG-MITTEL**
- Nur Dateien verschieben/umbenennen
- Import-Pfade müssen aktualisiert werden (viele Dateien!)
- Git-History bleibt erhalten wenn man `git mv` nutzt

### Testing
```bash
# Prüfe ob alle Imports noch funktionieren
npm start

# Oder mit ESLint prüfen (falls vorhanden)
npm run lint
```

---

## 📦 Task 4: Skill_library.js vs Skills.js klären

### Problem
Es gibt zwei Dateien:
- `src/agent/library/skills.js`
- `src/agent/library/skill_library.js`

**Was ist der Unterschied?**

### Lösung

**Schritt 1:** Dateien vergleichen
```bash
# Exports vergleichen
echo "=== skills.js exports ==="
grep "^export" src/agent/library/skills.js

echo "=== skill_library.js exports ==="
grep "^export" src/agent/library/skill_library.js

# Größe vergleichen
wc -l src/agent/library/skills.js src/agent/library/skill_library.js

# Wer importiert was?
echo "=== Who imports skills.js? ==="
grep -r "from.*skills.js" src/ --include="*.js" | grep -v node_modules

echo "=== Who imports skill_library.js? ==="
grep -r "from.*skill_library.js" src/ --include="*.js" | grep -v node_modules
```

**Schritt 2:** Entscheidung basierend auf Analyse

**Option A:** `skill_library.js` ist Wrapper/Registry
- Dann umbenennen zu `skill_registry.js` für Klarheit
- Oder in `systems/` verschieben

**Option B:** `skill_library.js` ist veraltet/duplicate
- Prüfen ob noch genutzt wird
- Wenn nein: Löschen
- Wenn ja: Zusammenführen mit `skills.js`

**Option C:** Beide haben unterschiedliche Zwecke
- Bessere Namen geben die den Zweck klarmachen
- Z.B. `basic_skills.js` vs `advanced_skills.js`

### Erwartetes Ergebnis
- ✅ Klare Trennung oder Konsolidierung
- ✅ Keine Duplikation mehr
- ✅ Namen beschreiben den Zweck

### Risiko
⚠️ **MITTEL** - Hängt davon ab was die Dateien tun

---

## 🎯 Zusammenfassung der Priorität 1 Tasks

| Task | Aufwand | Risiko | Impact | Dateien betroffen |
|------|---------|--------|--------|-------------------|
| **1. Event Handlers Integration** | 15 Min | Niedrig | Hoch | 1 Datei (agent.js) |
| **2. Building Manager aufteilen** | 45 Min | Niedrig | Hoch | 5 Dateien (neu + alte) |
| **3. Library aufräumen** | 30 Min | Mittel | Mittel | 10+ Dateien (Imports) |
| **4. Skills.js vs Skill_library.js** | 20 Min | Mittel | Mittel | 2-5 Dateien |
| **GESAMT** | **~2h** | - | - | **~20 Dateien** |

---

## 📋 Checkliste für Umsetzung

### Vor dem Start
- [ ] Git-Branch erstellen: `git checkout -b refactoring-phase4`
- [ ] Backup erstellen (optional): `git tag pre-refactoring-phase4`
- [ ] Alle Änderungen committen: `git status` sollte sauber sein

### Task 1: Event Handlers
- [ ] Prüfen ob `event_handlers.js` existiert
- [ ] Import in `agent.js` hinzufügen
- [ ] `_setupEventHandlers()` Methode aktualisieren
- [ ] `startEvents()` Methode vereinfachen
- [ ] Testen: Bot starten, Events prüfen
- [ ] Commit: `git commit -m "Integrate event_handlers.js into agent.js"`

### Task 2: Building Manager
- [ ] Ordner erstellen: `src/systems/building/`
- [ ] `schematic_loader.js` erstellen und Code kopieren
- [ ] `schematic_registry.js` erstellen und Code kopieren
- [ ] `building_manager.js` erstellen und Code kopieren
- [ ] `index.js` für Exports erstellen
- [ ] Imports in `agent.js` aktualisieren
- [ ] Alle anderen Imports finden und aktualisieren
- [ ] Testen: Building-Funktion prüfen
- [ ] Alte Datei löschen: `rm src/agent/building_manager.js`
- [ ] Commit: `git commit -m "Split building_manager into separate modules"`

### Task 3: Library aufräumen
- [ ] Ordner erstellen: `library/systems/` und `library/utils/`
- [ ] Dateien mit `git mv` verschieben
- [ ] Imports in allen betroffenen Dateien aktualisieren
- [ ] Testen: Bot starten, Funktionen prüfen
- [ ] Commit: `git commit -m "Reorganize library folder structure"`

### Task 4: Skills klären
- [ ] Dateien analysieren (Exports, Verwendung)
- [ ] Entscheidung treffen (siehe Optionen oben)
- [ ] Änderungen umsetzen
- [ ] Testen
- [ ] Commit: `git commit -m "Clarify skills.js vs skill_library.js"`

### Nach allen Tasks
- [ ] Kompletter Test-Durchlauf
- [ ] `docs/REFACTORING.md` aktualisieren
- [ ] Dieses Dokument als "Completed" markieren
- [ ] Merge in main: `git checkout main && git merge refactoring-phase4`

---

## 🐛 Troubleshooting

### Problem: Bot startet nicht mehr
**Lösung:**
```bash
# Zurück zum vorherigen Stand
git checkout main
# Oder einzelne Datei zurücksetzen
git checkout main -- src/agent/agent.js
```

### Problem: Import-Fehler "Cannot find module"
**Lösung:**
```bash
# Finde alle Imports der verschobenen Datei
grep -r "from.*OLD_PATH" src/ --include="*.js"
# Ersetze mit neuem Pfad
# (Oder nutze IDE Search & Replace)
```

### Problem: Tests schlagen fehl
**Lösung:**
- Logge Fehler: `npm start 2>&1 | tee debug.log`
- Prüfe Stack-Trace
- Vergleiche mit Git-Diff: `git diff agent.js`

---

## 📚 Referenzen

- [REFACTORING.md](REFACTORING.md) - Phase 1-3 Dokumentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - Projekt-Struktur
- [TODO.md](TODO.md) - Bekannte TODOs

---

## ✅ Nach Abschluss

Wenn alle Priorität 1 Tasks fertig sind:

1. **Update REFACTORING.md:**
   ```markdown
   ## ✅ Completed Refactorings

   ### Phase 4: Structural Cleanup (2025-10-16)
   - Event Handlers Integration
   - Building Manager Split
   - Library Reorganization
   - Skills.js Consolidation
   ```

2. **Nächste Schritte:**
   - Phase 5: Modes weiter modularisieren (Prio 2)
   - Phase 6: Command Parser als Klasse (Prio 2)
   - Phase 7: Error Handling vereinheitlichen (Prio 2)

---

**Viel Erfolg bei der Umsetzung! 🚀**

Bei Fragen oder Problemen: Siehe Troubleshooting-Sektion oder frage nach Hilfe.
