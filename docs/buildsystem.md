# 🏗️ Dudu Build System - Technical Documentation

**Version**: 2.0 (Layer-by-Layer mit Smart Material Management)
**Datum**: 2025-01-14
**Autor**: Claude Code + Cricetus79

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [System-Architektur](#system-architektur)
3. [Komponenten](#komponenten)
4. [Material-Management](#material-management)
5. [Build-Workflow](#build-workflow)
6. [Commands](#commands)
7. [Troubleshooting](#troubleshooting)
8. [Bekannte Issues](#bekannte-issues)

---

## 📖 Übersicht

Das Dudu Build System ermöglicht es dem Bot, komplexe Minecraft-Strukturen aus Schematic-Dateien zu bauen. Es unterstützt:

- ✅ **Creative & Survival Mode**
- ✅ **Layer-by-Layer Building** (Schicht für Schicht)
- ✅ **Automatisches Material-Management**
- ✅ **Smart Crafting & Collection**
- ✅ **Truhen-Integration**
- ✅ **Resume-Funktionalität** (nach Unterbrechungen)
- ✅ **Block-Orientierung** (Treppen, Türen, Betten, etc.)
- ✅ **Line-of-Sight Check** (Bot bewegt sich für freie Sicht)

---

## 🏛️ System-Architektur

### High-Level Übersicht

```
BuildingManager (Main Controller)
    ├── SchematicRegistry (Verwaltet .schem Dateien)
    │   └── SchematicLoader (Lädt NBT/Schematic Dateien)
    │
    ├── PlayerLocator (Findet Spieler & berechnet Build-Position)
    │
    ├── BlockOrientationHandler (Rotiert Bot für Treppen, Türen, etc.)
    │
    ├── BlockPlacer (Platziert einzelne Blöcke)
    │   ├── hasLineOfSight() - Prüft Sichtlinie
    │   ├── findBestPlacementPosition() - Findet optimale Position
    │   └── moveToPlacementPosition() - Bewegt Bot
    │
    ├── BuildExecutor (Creative Mode - schnelles Bauen)
    │
    └── SurvivalBuildCoordinator (Survival Mode - mit Material-Management)
        ├── MaterialClassifier (Kategorisiert Materialien)
        ├── SmartCraftingManager (Intelligentes Crafting/Sammeln)
        └── Build State Tracking (Resume-Support)
```

---

## 🧩 Komponenten

### 1. SchematicRegistry

**Datei**: `building_manager.js:149-255`

**Aufgaben**:
- Lädt alle `.schem` und `.schematic` Dateien aus `schematics/` Ordner
- Organisiert nach Kategorien (`houses`, `utility`, `decorative`)
- Cached geladene Schematics für Performance
- Analysiert benötigte Materialien

**Wichtige Methoden**:
```javascript
loadAll()                        // Lädt alle Schematics beim Start
find(name)                       // Sucht Schematic nach Name
loadSchematicData(schematicInfo) // Lädt NBT-Daten
analyzeMaterials(schematicData)  // Zählt benötigte Blöcke
```

**Unterstützte Formate**:
- ✅ WorldEdit `.schem` (Sponge Schematic v2)
- ✅ WorldEdit `.schematic` (Legacy MCEdit)
- ✅ Gzipped Dateien

---

### 2. BlockOrientationHandler

**Datei**: `building_manager.js:325-409`

**Aufgaben**:
- Rotiert Bot für orientierte Blöcke (Treppen, Türen, Öfen, etc.)
- Konvertiert Minecraft Facing → Bot Yaw (Radians)
- Spezial-Logik für Betten (platzieren gegenüber von Blickrichtung)

**Orientierte Blöcke**:
```javascript
stairs, chest, furnace, blast_furnace, smoker,
door, bed, piston, sticky_piston, dispenser,
dropper, observer, hopper, barrel, lectern,
loom, stonecutter, grindstone, sign, banner,
anvil, bell, campfire, soul_campfire, ladder
```

**Facing Mapping**:
```javascript
'north' → Math.PI        (180° → -Z)
'south' → 0              (0°   → +Z)
'east'  → -Math.PI / 2   (-90° → +X)
'west'  → Math.PI / 2    (90°  → -X)
```

---

### 3. BlockPlacer

**Datei**: `building_manager.js:414-666`

**Aufgaben**:
- Platziert einzelne Blöcke (Creative & Survival)
- **Sichtlinien-Check** (NEU in v2.0)
- **Bot-Bewegung** für optimale Platzierung
- Block-Orientierung
- Placement-Verification

**Workflow**:
```
1. Check: Block bereits platziert? → Skip
2. Check: Sichtlinie frei?
   ├─ Nein → Bot bewegt sich zu besserer Position
   └─ Ja → Weiter
3. Orientierung: Rotiere Bot falls nötig (Treppen, Türen)
4. Platzierung:
   ├─ Creative: /setblock Command mit Properties
   └─ Survival: skills.placeBlock() via Mineflayer
5. Verification: Prüfe ob Block korrekt platziert
```

**Line-of-Sight System** (NEU):
```javascript
hasLineOfSight(targetPos)
├─ Raycast von Bot → Zielblock
├─ Max Distanz: 4.5 Blöcke
└─ Return: true wenn frei

findBestPlacementPosition(targetPos)
├─ Testet 8 Richtungen (N, S, E, W, NE, NW, SE, SW)
├─ Testet Distanzen 2-4 Blöcke
├─ Prüft ob Position frei (air blocks)
└─ Return: Beste Position oder null

moveToPlacementPosition(targetPos)
├─ Findet beste Position
├─ Nutzt Pathfinder für Bewegung
└─ Wartet 300ms für Stabilisierung
```

---

### 4. MaterialClassifier

**Datei**: `building_manager.js:836-901`

**Aufgaben**:
- Kategorisiert Materialien für optimale Sammlung
- Bestimmt beste Strategie (SmartCollect vs Crafting)

**Kategorien**:

| Kategorie | Beispiele | Strategie |
|-----------|-----------|-----------|
| `base` | stone, cobblestone, oak_log, iron_ore, coal | SmartCollect → Mining |
| `simple_craft` | planks, sticks, torches, crafting_table | SmartCollect → Crafting |
| `complex_craft` | doors, stairs, beds, furnaces | Recipe Resolution → Crafting |
| `difficult` | string, slime_ball, ender_pearl, gunpowder | 3 Versuche → Player Help |

**Methoden**:
```javascript
classify(materialName)           // → 'base' | 'simple_craft' | 'complex_craft' | 'difficult'
shouldUseSmartCollect(material)  // → true für base & simple_craft
isDifficult(material)            // → true für mob drops
```

---

### 5. SurvivalBuildCoordinator

**Datei**: `building_manager.js:906-1700`

**Aufgaben**:
- **Material-Management** (Truhen, Sammeln, Crafting)
- **Layer-by-Layer Building**
- **Resume-Funktionalität**
- **Retry-Logic** (3 Versuche pro Material)

**Build State**:
```javascript
{
  schematicName: "vollhaus",
  position: { x, y, z },
  totalBlocks: 500,
  currentLayer: 63,              // Y-Koordinate
  placedBlocks: Set(),           // "x,y,z" Keys
  status: 'building' | 'paused' | 'completed',
  pauseReason: 'waiting_for_help' | 'low_health' | ...,
  startTime: timestamp,
  lastUpdate: timestamp
}
```

**Wichtige Methoden**:

#### `procureMaterialsWithRetry(missing, buildPosition)` (NEU v2.0)
**Datei**: `building_manager.js:1145-1333`

Multi-Stage Material Gathering mit Retry-Logic:

```
Stage 1: Truhen-Scan
├─ Scanne alle Truhen im 32-Block Radius
├─ Extrahiere verfügbare Items
└─ Update: stillMissing

Stage 2: Material-Loop (für jedes fehlende Item)
├─ Strategy 1: SmartCollect (für base & simple_craft)
│   ├─ Versuche automatisch zu sammeln
│   ├─ Success → Reset Retry Counter
│   └─ Fail → Increment Retry Counter
│
├─ Strategy 2: Crafting (für craftable items)
│   ├─ Versuche zu craften
│   ├─ Success → Reset Retry Counter
│   └─ Fail → Increment Retry Counter
│
├─ Strategy 3: Ask Player (nach 3 Versuchen oder difficult)
│   ├─ Chat: "Kannst du mir helfen X zu besorgen?"
│   ├─ Notify LLM via history
│   └─ Return: { success: false, needsHelp: true, attempts: 3 }
│
└─ Strategy 4: Recipe Resolution (Fallback)
    ├─ Löse Rezept auf → Base-Materialien
    ├─ Sammle Base-Materialien
    └─ Versuche erneut zu craften

Stage 3: Return to Build Site
└─ Bot kehrt zu Build-Position zurück
```

**Retry Counter**:
```javascript
this.gatheringRetries = {
  "string": 3,      // Nach 3 Versuchen → Spieler fragen
  "cobblestone": 0, // Erfolgreich gesammelt
  "oak_planks": 1   // 1 Fehlversuch
}
```

---

## 📦 Material-Management

### SmartCrafting Integration

Das Build-System nutzt das **SmartCrafting-System** ([smart_crafting.js](../src/agent/library/smart_crafting.js)):

**Features**:
- ✅ Multi-Source Strategy (Chests → Craft → Smelt → Mine)
- ✅ Recipe Optimization
- ✅ Automatic Inventory Management
- ✅ Storage Network Scanning

**Verwendung im Build-System**:
```javascript
await this.smartCraftingManager.collectIntelligently(
  material,    // z.B. "cobblestone"
  count,       // z.B. 64
  {
    checkChests: false,  // Bereits in procureMaterials gescannt
    strategy: 'auto'     // Automatische Strategie-Wahl
  }
);
```

### Recipe Resolution

**mcdata.js Integration**:
```javascript
const plan = mcdata.getDetailedCraftingPlan(
  material,   // "oak_door"
  count,      // 3
  inventory   // Aktuelles Inventar
);

// Return:
// "You are missing:
// - 6 oak_planks
//
// Crafting plan:
// Craft 6 oak_planks -> 3 oak_door"
```

**Parser**:
- Extrahiert fehlende Base-Items
- Extrahiert Crafting-Steps
- Unterscheidet "base items" vs "craftable"

---

## 🔄 Build-Workflow

### Creative Mode (Schnell)

```
!build vollhaus
    ↓
FindPlayer → MoveToPlayer
    ↓
CalculateBuildPosition (vor Spieler, basierend auf Yaw)
    ↓
LoadSchematic
    ↓
OrganizeByLayer (Y-Koordinate)
    ↓
FOR EACH Layer:
    FOR EACH Block:
        ├─ Check if already placed
        ├─ Rotate bot (if oriented block)
        ├─ /setblock x y z minecraft:block[properties]
        ├─ Wait block_place_delay (800ms)
        └─ Verify placement

Build Complete! ✅
```

### Survival Mode (Material-Management)

```
!build vollhaus
    ↓
FindPlayer → MoveToPlayer
    ↓
CalculateBuildPosition
    ↓
LoadSchematic
    ↓
CreateBuildState (für Resume)
    ↓
OrganizeByLayer
    ↓
FOR EACH Layer:
    │
    ├─ AnalyzeLayerMaterials
    │   └─ { cobblestone: 50, oak_planks: 20, ... }
    │
    ├─ ProcureMaterialsWithRetry
    │   ├─ Clean Inventory (nur Tools behalten)
    │   ├─ Scan & Extract from Chests
    │   ├─ SmartCollect (base materials)
    │   ├─ Craft (craftable items)
    │   ├─ Recipe Resolution (complex items)
    │   └─ Ask Player (nach 3 Versuchen)
    │
    ├─ IF Material Missing → PAUSE
    │   ├─ Save Build State
    │   ├─ Notify Player: "Use !buildresume"
    │   └─ WAIT for !buildresume
    │
    └─ Build Layer (Block-by-Block)
        ├─ Check Line-of-Sight
        ├─ Move if needed
        ├─ Place Block
        ├─ Save State (every 10 blocks)
        └─ Health Check (pause if < 6 HP)

Build Complete! ✅
```

---

## 🎮 Commands

### !build <schematic_name>

**Beschreibung**: Startet Survival-Mode Build mit automatischem Material-Management

**Beispiel**:
```
!build vollhaus
!build Stone-House-lvl
!build platte
```

**Workflow**:
1. Findet & lädt Schematic
2. Bewegt sich zum Spieler
3. Berechnet Build-Position vor Spieler
4. Analysiert Materialien pro Layer
5. Sammelt/Craftet Materialien
6. Baut Layer-by-Layer

**Return**: String mit Status-Message

---

### !buildresume

**Beschreibung**: Setzt pausierten Build fort

**Beispiel**:
```
!buildresume
```

**Workflow** (v2.0 - FIXED):
1. Lädt Build State
2. Organisiert Layers
3. **Findet aktuellen Layer-Index**
4. **Prüft ob Layer komplett** (NEU!)
   - Wenn alle Blöcke platziert → Springe zu nächstem Layer
5. Setzt Material-Gathering fort
6. Baut weiter

**Return**: Detailliertes Feedback mit Progress

**Bug-Fix (v2.0)**:
- ❌ Alt: Sprang zurück zu fertigen Layern
- ✅ Neu: Prüft ob Layer fertig, springt automatisch weiter

---

### !buildstatus

**Beschreibung**: Zeigt aktuellen Build-Status

**Return**:
```
🏗️ Build State:
📦 Schematic: vollhaus
📊 Status: BUILDING
📈 Progress: 150/500 Blöcke (30%)
🗂️ Current Layer: 65
⏱️ Elapsed Time: 120.5s
```

---

### !buildstate

**Beschreibung**: Zeigt detaillierten Build-State (inkl. Pause-Grund)

**Return** (wenn pausiert):
```
⏸️ Build State:
📦 Schematic: Stone-House-lvl
📊 Status: PAUSED
📈 Progress: 60/303 Blöcke (20%)
🗂️ Current Layer: 63
⏱️ Elapsed Time: 45.2s
🆘 Pause Reason: waiting_for_help

💡 Use !buildresume to continue building
```

---

### !buildcancel

**Beschreibung**: Bricht aktuellen Build ab

**Warning**: Build State wird gelöscht! Nicht wieder fortsetzbar.

---

### !buildlist

**Beschreibung**: Listet alle verfügbaren Schematics

**Return**:
```
🏘️ Available Buildings:
📂 Houses (5):
  - vollhaus
  - mischhaus
  - platte
  - Stone-House-lvl
  - oak_cottage
📂 Utility (3):
  - farm_plot
  - storage_shed
  - mineshaft_entrance
```

---

### !buildinfo <name>

**Beschreibung**: Zeigt Details zu einem Schematic

**Beispiel**: `!buildinfo vollhaus`

**Return**:
```
📋 vollhaus
Category: houses
File size: 12.5 KB
Dimensions: 15x8x12
Materials: 250x cobblestone, 80x oak_planks, 50x glass, 20x oak_door, 10x torch
```

---

### !buildmaterials <name>

**Beschreibung**: Analysiert benötigte Materialien (vor Build)

**Beispiel**: `!buildmaterials Stone-House-lvl`

**Return**:
```
📋 Materialien für Stone-House-lvl:

📦 Benötigt:
✅ 200x cobblestone (Inventar: 50, Truhen: 150)
❌ 48x string (Inventar: 0, Truhen: 10, Fehlt: 38)
✅ 30x oak_planks (Inventar: 15, Truhen: 20)

❌ Fehlende Materialien müssen beschafft werden.
```

---

## 🐛 Troubleshooting

### Problem: Bot baut nicht / "Action output: " leer

**Ursache**: `runAsAction()` ignorierte Return-Value

**Fix** (v2.0): `actions.js:15-35`
```javascript
// VORHER (buggy):
const actionFnWithAgent = async () => {
    await actionFn(agent, ...args);  // Return ignored!
};
return code_return.message;

// NACHHER (fixed):
let result = null;
const actionFnWithAgent = async () => {
    result = await actionFn(agent, ...args);  // Capture return!
};
return result || code_return.message;
```

---

### Problem: buildresume Endlosschleife

**Symptome**:
- Bot springt zurück zu Layer 1 (bereits fertig)
- Fragt wieder nach gleichen Materialien
- LLM ruft ständig `!buildresume` auf

**Ursache**: `_continueBuildFromState()` startete bei `currentLayer` ohne zu prüfen ob fertig

**Fix** (v2.0): `building_manager.js:1482-1493`
```javascript
// Find layer index
let startLayerIndex = sortedLayers.findIndex(y => y === state.currentLayer);

// NEU: Check if current layer is complete
const currentLayerBlocks = layers.get(sortedLayers[startLayerIndex]);
const allPlacedInCurrentLayer = currentLayerBlocks.every(blockInfo => {
  const key = `${blockInfo.pos.x},${blockInfo.pos.y},${blockInfo.pos.z}`;
  return state.placedBlocks.has(key);
});

if (allPlacedInCurrentLayer && startLayerIndex < sortedLayers.length - 1) {
  startLayerIndex++; // Move to NEXT layer!
  console.log(`✅ Current layer already complete, moving to next`);
}
```

---

### Problem: Bot kann Blöcke nicht platzieren

**Mögliche Ursachen**:

1. **Keine Sichtlinie**
   - **Fix**: Line-of-Sight Check (v2.0)
   - Bot bewegt sich automatisch zu besserer Position

2. **Zu weit entfernt**
   - **Max Distance**: 4.5 Blöcke
   - Bot bewegt sich näher

3. **Block blockiert**
   - Bot prüft ob Ziel-Position frei ist
   - Überspringt bereits platzierte Blöcke

**Debug**:
```javascript
console.log in placeBlock():
"👁️ No line of sight to ${pos}, moving..."
"⚠️ Could not find position with line of sight"
"✅ Block already placed"
```

---

### Problem: Material nicht sammelbar

**Symptome**:
```
⛏️ Sammle: 48x string
⏸️ Konnte string nicht automatisch beschaffen.
💬 Kannst du mir helfen 48x string zu besorgen?
```

**Ursache**: Material ist `difficult` (Mob Drop) oder nach 3 Versuchen fehlgeschlagen

**Lösungen**:

1. **String spezifisch**:
   - Jage Spiders
   - ODER: Crafte aus Wool (4 string → 1 wool, umgekehrt crafting)
   - Lege in Truhe in der Nähe

2. **Generell für difficult materials**:
   - Material in Truhe legen
   - `!buildresume` aufrufen
   - Bot scannt Truhen erneut

**Material-Klassifizierung ändern**:
```javascript
// building_manager.js:862-867
this.difficultMaterials = new Set([
  'string',  // <-- Entfernen wenn Bot Spiders jagen kann
  'slime_ball',
  ...
]);
```

---

### Problem: Crafting schlägt fehl

**Debug-Steps**:

1. **Check mcdata.js**:
   ```javascript
   const plan = mcdata.getDetailedCraftingPlan('oak_door', 3, inventory);
   console.log(plan);
   ```

2. **Check Inventory**:
   ```javascript
   console.log(this.getInventoryCounts());
   ```

3. **Check SmartCrafting**:
   ```javascript
   const success = await this.smartCraftingManager.craftIntelligently('oak_door', 3);
   ```

4. **Fallback**: Spieler craften lassen
   - Bot fragt nach 3 Versuchen automatisch

---

### Problem: Truhen nicht gefunden

**Symptome**: Bot sammelt statt aus Truhen zu holen

**Check**:
```javascript
const chests = await this.smartCraftingManager.storageManager.scanNearbyChests();
console.log('Found chests:', Object.keys(chests).length);
```

**Fix**:
- Truhen müssen innerhalb **32 Blöcke** sein
- Truhen müssen zugänglich sein (keine Blöcke drüber)
- Bot muss mindestens 1 Truhe finden

---

## 📊 Bekannte Issues

### Issue #1: Komplexe Rezepte mit vielen Steps

**Symptom**: Bot gibt zu früh auf bei komplexen Crafts (z.B. Blast Furnace)

**Workaround**: Material in Truhe legen

**Geplanter Fix**: Multi-Step Recipe Resolver mit Dependency-Graph

---

### Issue #2: Block-Placement in engen Räumen

**Symptom**: Bot findet keine freie Position für Sichtlinie

**Workaround**: Build in offener Fläche starten

**Geplanter Fix**: Erweiterte Position-Finding mit Vertical Movement

---

### Issue #3: Health-Check zu aggressiv

**Symptom**: Bot pausiert bei 6 HP, auch wenn sicher

**Workaround**: Health erhöhen vor Build-Fortsetzung

**Config**: `building_manager.js:1387`
```javascript
if (this.bot.health < 6) {  // <- Wert anpassen
  this.pauseBuild('low_health');
}
```

---

### Issue #4: Retry Counter bleibt nach Success

**Status**: ✅ FIXED (v2.0)

**Fix**: Reset counter on successful gather/craft
```javascript
if (success) {
  this.gatheringRetries[material] = 0;  // Reset!
}
```

---

## 📈 Performance-Tipps

### 1. Block Place Delay

**Config**: `settings.js`
```javascript
block_place_delay: 800  // ms zwischen Blöcken
```

**Empfehlungen**:
- Server (single-player): 500ms
- Server (multiplayer): 800ms
- Server (laggy): 1200ms

### 2. Chunk Loading

**Problem**: Bot platziert in nicht geladenen Chunks

**Lösung**: Warte auf Chunk-Load vor Build
```javascript
await this.bot.waitForChunksToLoad();
```

### 3. Memory Usage

**Large Schematics** (>10.000 Blöcke):
- `placedBlocks` Set kann groß werden
- Consider File-Persistence für sehr große Builds

**Config**: `building_manager.js:1336-1339`
```javascript
// TODO: Optionally save to file
fs.writeFileSync('build_state.json', JSON.stringify(serializable, null, 2));
```

---

## 🔮 Geplante Features (Future)

### v2.1
- [ ] Multi-Bot Building (parallel bauen)
- [ ] Build-Rotation (Drehen des Schematics)
- [ ] Build-Offset (Position manuell anpassen)

### v2.2
- [ ] Build-Preview (Hologram mit Blocks)
- [ ] Undo/Redo Funktionalität
- [ ] Build-Templates (vorgefertigte Positionen)

### v3.0
- [ ] Procedural Generation (algorithmische Strukturen)
- [ ] Build-Marketplace (Community-Schematics)
- [ ] Multi-Schematic Compositions

---

## 📚 Referenzen

### Wichtige Dateien

| Datei | Beschreibung |
|-------|--------------|
| `building_manager.js` | Haupt-System (2200+ LOC) |
| `smart_crafting.js` | Material-Gathering System |
| `mcdata.js` | Recipe-Resolution |
| `skills.js` | Low-Level Mineflayer Actions |
| `actions.js` | Command Definitions |

### Dependencies

```javascript
// NPM Packages
import prismarineSchematic from 'prismarine-schematic';
import nbt from 'prismarine-nbt';
import pathfinder from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';

// Internal
import * as skills from './library/skills.js';
import * as mcdata from '../utils/mcdata.js';
```

---

## 🤝 Contributing

### Bug Reports

Wenn du einen Bug findest:

1. **Check Troubleshooting** (oben)
2. **Collect Logs**:
   - Server Log
   - App Console Log
   - Bot Chat Messages
3. **Create Issue** mit:
   - Schematic Name
   - Build-Command
   - Error Message
   - Steps to Reproduce

### Code Style

```javascript
// ✅ Good
async procureMaterials(missing) {
  this.bot.chat('📦 Sammle Materialien...');

  for (const [material, count] of Object.entries(missing)) {
    // Process...
  }
}

// ❌ Bad
async procureMaterials(missing){
  for(const material in missing){
    // Process...
  }
}
```

---

## 📞 Support

**Fragen?** Öffne ein Issue auf GitHub!

