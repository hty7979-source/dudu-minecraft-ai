# Material Planner System - Dokumentation

## 📋 Übersicht

Das **Material Planner System** ist ein intelligentes Ressourcen-Planungssystem für den Minecraft-Bot. Es analysiert automatisch welche Materialien für Tasks benötigt werden, berücksichtigt das aktuelle Inventar und erstellt optimierte Sammelpläne.

**Erstellt:** 2025-01-17
**Version:** 1.0.0
**Author:** Dudu AI Team

---

## 🎯 Hauptfunktionen

### 1. **Intelligente Rezept-Analyse**
- Berechnet automatisch benötigte Rohstoffe für Crafting-Rezepte
- Löst Material-Ketten rekursiv auf (z.B. logs → planks → sticks)
- Berücksichtigt Crafting-Multiplikatoren (1 log = 4 planks)

### 2. **Inventar-Berücksichtigung**
- Prüft was bereits im Bot-Inventar vorhanden ist
- Sammelt nur fehlende Materialien
- Verhindert unnötiges Doppel-Sammeln

### 3. **Optimierte Sammel-Pläne**
- Gruppiert ähnliche Items (Holz, Stein, Erze)
- Priorisiert Sammel-Reihenfolge (Holz → Stein → Erze → Rest)
- Zeigt klare Übersichten was gesammelt werden muss

---

## 📦 Dateien

### **Kern-Dateien:**
- `src/agent/material_planner.js` - MaterialPlanner Klasse
- `src/agent/idle_task_generator.js` - Integration in Idle Tasks
- `src/agent/contextual_memory.js` - Tool-Tier-Erkennung

### **Dokumentation:**
- `docs/MATERIAL_PLANNER_GUIDE.md` - Diese Datei
- `docs/NEW_ARCHITECTURE_GUIDE.md` - Gesamtsystem-Architektur
- `docs/TEST_SCENARIOS.md` - Test-Szenarien

---

## 🔧 MaterialPlanner Klasse

### **Location:** `src/agent/material_planner.js`

### **Konstruktor:**
```javascript
const planner = new MaterialPlanner(bot);
```

**Parameter:**
- `bot` - Mineflayer Bot-Instanz

---

## 📚 API-Referenz

### **createPlan(targetItems)**

Erstellt einen vollständigen Materialplan für mehrere Items.

**Parameter:**
```javascript
targetItems: Array<{item: string, count: number}>
```

**Rückgabe:**
```javascript
{
    targets: [...],      // Ziel-Items
    toGather: {...},     // Rohstoffe die gesammelt werden müssen
    toCraft: [...]       // Items die gecraftet werden sollen
}
```

**Beispiel:**
```javascript
const plan = planner.createPlan([
    { item: 'wooden_pickaxe', count: 1 },
    { item: 'wooden_axe', count: 1 },
    { item: 'wooden_sword', count: 1 }
]);

// Output:
// {
//     targets: [...],
//     toGather: { oak_log: 3 },
//     toCraft: [...]
// }
```

---

### **calculateRawMaterials(item, count)**

Berechnet rekursiv alle benötigten Rohstoffe für ein Item.

**Parameter:**
- `item` (string) - Item-Name (z.B. "wooden_pickaxe")
- `count` (number) - Anzahl

**Rückgabe:**
```javascript
{
    'material_name': amount,
    ...
}
```

**Beispiel:**
```javascript
const materials = planner.calculateRawMaterials('wooden_pickaxe', 1);
// { oak_log: 1 }  (berücksichtigt dass 1 log = 4 planks)
```

---

### **createGatheringPlan(materials)**

Erstellt einen optimierten Sammel-Plan aus Rohstoffen.

**Parameter:**
```javascript
materials: { 'item_name': count, ... }
```

**Rückgabe:**
```javascript
[
    {
        item: 'oak_log',
        amount: 3,
        have: 0,
        needed: 3
    },
    ...
]
```

**Kategorisierung:**
1. Holz-Items (logs, planks)
2. Stein-Items (cobblestone, stone)
3. Erz-Items (iron_ore, coal)
4. Sonstige Items

---

### **getCurrentInventory()**

Holt das aktuelle Bot-Inventar als Object.

**Rückgabe:**
```javascript
{
    'item_name': count,
    ...
}
```

**Beispiel:**
```javascript
const inv = planner.getCurrentInventory();
// { oak_log: 5, cobblestone: 20, stick: 8 }
```

---

### **summarizePlan(plan)**

Gibt eine lesbare Zusammenfassung des Plans zurück.

**Rückgabe:** String (mehrzeilig)

**Beispiel-Output:**
```
📦 Raw materials needed:
  - oak_log: need 3 more (have 0/3)

🔨 Items to craft:
  - wooden_pickaxe x1
  - wooden_axe x1
  - wooden_sword x1
```

---

### **Vorgefertigte Plan-Funktionen:**

```javascript
// Wooden Tools Plan
const plan = planner.createWoodenToolsPlan();
// Erstellt Plan für: wooden_pickaxe, wooden_axe, wooden_sword

// Stone Tools Plan
const plan = planner.createStoneToolsPlan();
// Erstellt Plan für: stone_pickaxe, stone_axe, stone_sword, furnace

// Iron Tools Plan
const plan = planner.createIronToolsPlan();
// Erstellt Plan für: iron_pickaxe, iron_axe, iron_sword
```

---

## 🎮 Verwendung in Idle Task Generator

### **Integration:**

Der MaterialPlanner ist automatisch in die `IdleTaskGenerator` Klasse integriert.

**Initialisierung:**
```javascript
// In IdleTaskGenerator constructor:
this.materialPlanner = null; // Wird nach Bot-Login initialisiert

// In checkAndGenerateTasks():
this.initializePlanner(); // Initialisiert bei erster Nutzung
```

---

### **Beispiel: Stage 1 - Wooden Tools**

```javascript
async craftWoodenTools(agent) {
    console.log('🌳 === STAGE 1: Crafting Wooden Tools ===\n');

    // PHASE 1: Material-Planung
    const plan = this.materialPlanner.createWoodenToolsPlan();
    console.log(this.materialPlanner.summarizePlan(plan));

    // PHASE 2: Sammle Rohstoffe
    const gatheringPlan = this.materialPlanner.createGatheringPlan(plan.toGather);

    if (gatheringPlan.length > 0) {
        console.log('📦 Phase 1: Gathering raw materials...');

        for (const task of gatheringPlan) {
            console.log(`  → Gathering ${task.amount}x ${task.item}...`);

            const success = await skills.collectBlock(agent.bot, task.item, task.amount);
            if (!success) {
                throw new Error(`Failed to gather ${task.item}`);
            }

            console.log(`  ✓ Gathered ${task.item}`);
        }
    }

    // PHASE 3: Craft Tools
    console.log('🔨 Phase 2: Crafting tools...');

    const tools = [
        { name: 'wooden_sword', display: 'Wooden Sword' },
        { name: 'wooden_axe', display: 'Wooden Axe' },
        { name: 'wooden_pickaxe', display: 'Wooden Pickaxe' }
    ];

    for (const tool of tools) {
        const success = await smartCraft(agent.bot, tool.name, 1, skills);
        if (!success) {
            throw new Error(`Failed to craft ${tool.name}`);
        }
        console.log(`  ✓ ${tool.display} crafted`);
    }

    console.log('🎉 STAGE 1 COMPLETE!\n');
}
```

---

## 📖 Rezept-Datenbank

### **Location:** `src/agent/material_planner.js` (Zeile 216-239)

Der MaterialPlanner verwendet Hard-coded Rezepte für die wichtigsten Items:

### **Tools:**
```javascript
'wooden_pickaxe': { oak_planks: 3, stick: 2 }
'wooden_axe': { oak_planks: 3, stick: 2 }
'wooden_sword': { oak_planks: 2, stick: 1 }
'wooden_shovel': { oak_planks: 1, stick: 2 }

'stone_pickaxe': { cobblestone: 3, stick: 2 }
'stone_axe': { cobblestone: 3, stick: 2 }
'stone_sword': { cobblestone: 2, stick: 1 }
'stone_shovel': { cobblestone: 1, stick: 2 }

'iron_pickaxe': { iron_ingot: 3, stick: 2 }
'iron_axe': { iron_ingot: 3, stick: 2 }
'iron_sword': { iron_ingot: 2, stick: 1 }
'iron_shovel': { iron_ingot: 1, stick: 2 }
```

### **Crafting Basics:**
```javascript
'oak_planks': { oak_log: 0.25 }      // 1 log = 4 planks
'stick': { oak_planks: 0.5 }         // 2 planks = 4 sticks
'crafting_table': { oak_planks: 4 }
'furnace': { cobblestone: 8 }
'torch': { coal: 0.25, stick: 0.25 } // 1 coal + 1 stick = 4 torches
```

### **Neue Rezepte hinzufügen:**

```javascript
// In calculateRawMaterials() Methode:
const recipes = {
    // ... bestehende Rezepte ...

    // Neues Rezept hinzufügen:
    'diamond_pickaxe': { diamond: 3, stick: 2 },
    'enchanting_table': { book: 1, diamond: 4, obsidian: 4 },

    // Rezepte mit Multiplikatoren:
    'iron_ingot': { iron_ore: 1 },  // 1:1 ratio (mit furnace)
    'glass': { sand: 1 }             // 1:1 ratio (mit furnace)
};
```

---

## 🔄 Workflow-Beispiele

### **Beispiel 1: Wooden Tools von Null**

**Szenario:** Bot hat keine Items im Inventar

```
Input: createWoodenToolsPlan()

📦 Analyse:
- wooden_pickaxe needs: 3 planks, 2 sticks
- wooden_axe needs: 3 planks, 2 sticks
- wooden_sword needs: 2 planks, 1 stick
Total: 8 planks, 5 sticks

📦 Rekursive Auflösung:
- 8 planks need: 2 oak_logs (8 * 0.25 = 2)
- 5 sticks need: 3 planks (5 * 0.5 = 2.5 → 3)
- 3 planks need: 1 oak_log (3 * 0.25 = 0.75 → 1)

Total raw materials: 3 oak_logs

Output Plan:
{
    toGather: { oak_log: 3 },
    toCraft: [wooden_pickaxe, wooden_axe, wooden_sword]
}

📦 Gathering Phase:
→ Gathering 3x oak_log...
✓ Gathered oak_log (now have 3)

🔨 Crafting Phase:
→ smartCraft handles planks + sticks automatically
✓ Wooden Sword crafted
✓ Wooden Axe crafted
✓ Wooden Pickaxe crafted
```

---

### **Beispiel 2: Stone Tools mit vorhandenem Material**

**Szenario:** Bot hat bereits 5 cobblestone im Inventar

```
Input: createStoneToolsPlan()

Current Inventory: { cobblestone: 5 }

📦 Analyse:
- stone_pickaxe needs: 3 cobblestone, 2 sticks
- stone_axe needs: 3 cobblestone, 2 sticks
- stone_sword needs: 2 cobblestone, 1 stick
- furnace needs: 8 cobblestone
Total: 16 cobblestone, 5 sticks

📦 Inventar-Berücksichtigung:
- cobblestone: have 5, need 16 → gather 11 more
- sticks: have 0, need 5 → must craft (needs planks → logs)

Output Plan:
{
    toGather: {
        cobblestone: 11,
        oak_log: 2  // für sticks
    },
    toCraft: [stone_pickaxe, stone_axe, stone_sword, furnace]
}

📦 Gathering Phase:
→ Gathering 11x cobblestone...
✓ Gathered cobblestone (now have 16)
→ Gathering 2x oak_log...
✓ Gathered oak_log (now have 2)

🔨 Crafting Phase:
✓ Stone Sword crafted
✓ Stone Axe crafted
✓ Stone Pickaxe crafted
✓ Furnace crafted
```

---

## 🛠️ Tool Durability System

### **Location:** `src/agent/idle_task_generator.js` (Zeile 163-264)

### **Funktion:** `checkToolDurability()`

**Automatische Werkzeug-Wartung:**

1. **Prüfung:** Läuft alle 10 Sekunden wenn Bot idle ist
2. **Erkennung:** Findet Tools mit < 5% Haltbarkeit
3. **Ersetzung:** Craftet automatisch Ersatz
4. **Entsorgung:** Wirft kaputte Tools weg

### **Workflow:**

```javascript
// 1. Alle Tools im Inventar prüfen
const tools = bot.inventory.items().filter(item =>
    item.name.includes('pickaxe') ||
    item.name.includes('axe') ||
    item.name.includes('sword') ||
    item.name.includes('shovel')
);

// 2. Durability berechnen
for (const tool of tools) {
    const maxDurability = tool.maxDurability;
    const currentDurability = maxDurability - tool.durabilityUsed;
    const durabilityPercent = (currentDurability / maxDurability) * 100;

    // 3. Tools unter 5% markieren
    if (durabilityPercent < 5) {
        brokenTools.push(tool);
    }
}

// 4. Ersetzungs-Task erstellen
await taskQueue.runTask('repair_tools', TaskPriority.LOW, async (agent) => {
    for (const tool of brokenTools) {
        // Crafts neues Tool (smartCraft sammelt Materialien automatisch)
        await smartCraft(agent.bot, tool.name, 1, skills);

        // Entsorgt altes Tool
        await agent.bot.toss(oldTool.type, null, 1);
    }
});
```

### **Beispiel-Output:**

```
🔧 Low durability tools detected:
  - stone_pickaxe: 3% (3/131)
  - stone_axe: 4% (5/131)

🔨 Replacing worn tools...
  → Crafting replacement stone_pickaxe...
  📦 Raw materials needed:
    - cobblestone: need 3 more (have 20/3)
    - oak_log: need 1 more (have 0/1)
  ✓ stone_pickaxe crafted
  🗑️ Discarded broken stone_pickaxe

  → Crafting replacement stone_axe...
  ✓ stone_axe crafted
  🗑️ Discarded broken stone_axe

✅ Tool maintenance completed
```

### **Durability-Werte:**

| Tool Type | Max Durability |
|-----------|---------------|
| Wooden | 59 |
| Stone | 131 |
| Iron | 250 |
| Diamond | 1561 |
| Netherite | 2031 |

**5% Schwellwerte:**
- Wooden: < 3 uses left
- Stone: < 7 uses left
- Iron: < 13 uses left
- Diamond: < 78 uses left

---

## 🎯 Tool-Tier-System

### **Location:** `src/agent/contextual_memory.js` (Zeile 193-213)

### **Tool-Tier-Erkennung:**

Der Bot erkennt welches Tool-Tier er hat basierend auf **Pickaxe + Axe** (nicht nur irgenein Tool):

```javascript
// Wooden Tools = wooden_pickaxe UND wooden_axe vorhanden
const hasWoodenPickaxe = items.some(i => i.name === 'wooden_pickaxe');
const hasWoodenAxe = items.some(i => i.name === 'wooden_axe');
this.equipment.hasWoodenTools = hasWoodenPickaxe && hasWoodenAxe;

// Stone Tools = stone_pickaxe UND stone_axe vorhanden
const hasStonePickaxe = items.some(i => i.name === 'stone_pickaxe');
const hasStoneAxe = items.some(i => i.name === 'stone_axe');
this.equipment.hasStoneTools = hasStonePickaxe && hasStoneAxe;

// ... gleiches Muster für Iron, Diamond, Netherite
```

### **Tool-Tier-Progression:**

```
None → Wooden → Stone → Iron → Diamond → Netherite
```

**Upgrade-Logik:**
```javascript
if (toolTier === 'none') {
    // Start Stage 1: Craft Wooden Tools
}
else if (toolTier === 'wooden') {
    // Start Stage 2: Craft Stone Tools
}
else if (toolTier === 'stone' && ironCount >= 9) {
    // Start Stage 3: Craft Iron Tools
}
```

---

## 📊 Task-Prioritäten

Das Material-Planning-System integriert sich in das Task-Priority-System:

```javascript
TaskPriority.CRITICAL (10)   // Überlebenskritisch
TaskPriority.HIGH (7)        // Kampf/Flucht
TaskPriority.NORMAL (5)      // User Commands
TaskPriority.LOW (2)         // Tool Upgrades, Tool Repairs
TaskPriority.BACKGROUND (1)  // Resource Gathering
```

### **Idle Task Reihenfolge:**

1. **CRITICAL:** Death Recovery
2. **NORMAL:** Food Supply, Nighttime (Bed)
3. **LOW:** Tool Durability, Tool Upgrade, Torches, Workbench
4. **BACKGROUND:** Resource Gathering

---

## 🧪 Test-Szenarien

### **Test 1: Wooden Tools von Null**

**Setup:**
- Leeres Inventar
- Keine Tools

**Erwartetes Verhalten:**
1. Erkennt `toolTier = 'none'`
2. Startet `craftWoodenTools()`
3. Sammelt 3 oak_logs
4. Craftet wooden_pickaxe, wooden_axe, wooden_sword
5. `toolTier = 'wooden'`

**Kommando:**
```javascript
// Bot startet automatisch
// Oder manuell triggern:
!inventory
// Warte 10 Sekunden, Idle Task Generator prüft automatisch
```

---

### **Test 2: Stone Tools mit vorhandenen Wooden Tools**

**Setup:**
- Inventar: wooden_pickaxe, wooden_axe
- `toolTier = 'wooden'`

**Erwartetes Verhalten:**
1. Erkennt Upgrade-Möglichkeit
2. Startet `craftStoneTools()`
3. Sammelt 11 cobblestone (für tools + furnace)
4. Sammelt coal (falls vorhanden)
5. Craftet stone tools + furnace

---

### **Test 3: Tool Durability mit beschädigtem Tool**

**Setup:**
- stone_pickaxe mit 4% Haltbarkeit (5/131)

**Erwartetes Verhalten:**
1. Erkennt low durability
2. Startet `repair_tools` Task
3. Sammelt fehlende Materialien (cobblestone + sticks)
4. Craftet neuen stone_pickaxe
5. Wirft alten stone_pickaxe weg

**Manuell triggern:**
```javascript
// Tool beschädigen durch Mining
// Warte 10 Sekunden
// Idle Task Generator prüft automatisch
```

---

## 🚀 Erweiterungen

### **Neue Items zum MaterialPlanner hinzufügen:**

1. **Rezept in recipes-Object eintragen:**
```javascript
// In calculateRawMaterials() Methode:
const recipes = {
    // ... bestehende ...
    'new_item': { ingredient1: 2, ingredient2: 1 }
};
```

2. **Vorgefertigte Plan-Funktion erstellen (optional):**
```javascript
createMyCustomPlan() {
    return this.createPlan([
        { item: 'new_item', count: 1 },
        { item: 'other_item', count: 2 }
    ]);
}
```

3. **In Idle Task Generator integrieren:**
```javascript
async checkMyCustomTask() {
    const plan = this.materialPlanner.createMyCustomPlan();
    const gatheringPlan = this.materialPlanner.createGatheringPlan(plan.toGather);

    // ... gathering phase ...
    // ... crafting phase ...
}
```

---

### **Neue Tool-Tiers hinzufügen:**

1. **Rezepte in MaterialPlanner eintragen:**
```javascript
'netherite_pickaxe': { netherite_ingot: 1, diamond_pickaxe: 1 }
```

2. **Tool-Tier-Erkennung in ContextualMemory:**
```javascript
const hasNetheritePickaxe = items.some(i => i.name === 'netherite_pickaxe');
const hasNetheriteAxe = items.some(i => i.name === 'netherite_axe');
this.equipment.hasNetheriteTools = hasNetheritePickaxe && hasNetheriteAxe;
```

3. **Upgrade-Logik in IdleTaskGenerator:**
```javascript
else if (toolTier === 'diamond' && netheriteCount >= 4) {
    targetTier = 'netherite';
}
```

---

## ⚠️ Bekannte Limitierungen

### **1. Hard-coded Rezepte:**
- Nur die wichtigsten Items sind im System
- Neue Items müssen manuell hinzugefügt werden
- Keine dynamische Rezept-Erkennung aus Minecraft-Data

**Workaround:** Rezepte nach Bedarf in `calculateRawMaterials()` ergänzen

---

### **2. Keine Furnace/Crafting-Table-Prüfung:**
- System geht davon aus dass smartCraft Zugang zu Workbench/Furnace hat
- Bei fehlender Workbench könnte Crafting fehlschlagen

**Workaround:** `checkWorkbench()` läuft vor Tool-Upgrades

---

### **3. Keine komplexen Crafting-Chains:**
- Enchantment-Table, Brewing Stand etc. nicht supported
- Items mit mehreren Crafting-Optionen nutzen nur erste Option

**Lösung:** Erweitere `recipes` Object bei Bedarf

---

## 🐛 Troubleshooting

### **Problem: "Failed to gather oak_log - not found nearby"**

**Ursache:** Keine Bäume in Reichweite

**Lösung:**
- Bot muss sich in Wald-Biom bewegen
- Oder manuell Logs geben: `!givePlayer Dudu oak_log 10`

---

### **Problem: "Still missing cobblestone: have 5, need 11"**

**Ursache:** `collectBlock()` fand nur 5 cobblestone

**Lösung:**
- Bot braucht Zugang zu Stein
- Oder wooden_pickaxe fehlt (kann kein Stein abbauen)
- Prüfe: `!inventory` ob wooden_pickaxe vorhanden

---

### **Problem: Tool Durability Check läuft nicht**

**Ursache:** Cooldown aktiv oder Bot nicht idle

**Lösung:**
- Warte 1 Minute (Cooldown)
- Prüfe ob Task-Queue leer: sollte "bot is now idle" zeigen
- Prüfe ob `initializePlanner()` aufgerufen wurde

---

### **Problem: "Cannot read property 'createWoodenToolsPlan' of null"**

**Ursache:** MaterialPlanner nicht initialisiert

**Lösung:**
- Bot muss eingeloggt sein
- `checkAndGenerateTasks()` ruft automatisch `initializePlanner()` auf
- Prüfe: Bot-Login erfolgreich?

---

## 📝 Code-Beispiele

### **Beispiel: Eigenen Material-Plan erstellen**

```javascript
// In deinem eigenen Code:
import { MaterialPlanner } from './agent/material_planner.js';

const bot = // ... dein bot
const planner = new MaterialPlanner(bot);

// Plan für Custom Items erstellen
const plan = planner.createPlan([
    { item: 'diamond_pickaxe', count: 1 },
    { item: 'enchanting_table', count: 1 }
]);

// Zusammenfassung anzeigen
console.log(planner.summarizePlan(plan));

// Sammel-Plan erstellen
const gatheringPlan = planner.createGatheringPlan(plan.toGather);

// Durchführen
for (const task of gatheringPlan) {
    await skills.collectBlock(bot, task.item, task.amount);
}
```

---

### **Beispiel: Nur Rohstoffe berechnen**

```javascript
const planner = new MaterialPlanner(bot);

// Berechne was für 5 stone_pickaxes benötigt wird
const materials = planner.calculateRawMaterials('stone_pickaxe', 5);

console.log(materials);
// { cobblestone: 15, oak_log: 3 }
```

---

### **Beispiel: Prüfen ob Materialien vorhanden**

```javascript
const plan = planner.createWoodenToolsPlan();

if (planner.hasMaterials(plan)) {
    console.log('All materials available! Ready to craft.');
} else {
    console.log('Missing materials:');
    const gathering = planner.createGatheringPlan(plan.toGather);
    for (const task of gathering) {
        console.log(`  - Need ${task.amount}x ${task.item}`);
    }
}
```

---

## 📚 Weiterführende Dokumentation

- **[NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md)** - Gesamtsystem-Architektur
- **[TEST_SCENARIOS.md](./TEST_SCENARIOS.md)** - Vollständige Test-Szenarien
- **[COMMAND_AUDIT_REPORT.md](./COMMAND_AUDIT_REPORT.md)** - Command-Dokumentation

---

## 🙏 Credits

**Entwickelt von:** Dudu AI Team
**Datum:** Januar 2025
**Version:** 1.0.0

**Basiert auf:**
- Mineflayer Bot Framework
- Smart Crafting System
- Task Queue Manager
- Contextual Memory System

---

## 📄 Changelog

### Version 1.0.0 (2025-01-17)
- ✅ Initial Release
- ✅ MaterialPlanner Klasse implementiert
- ✅ Integration in IdleTaskGenerator
- ✅ Tool Durability System hinzugefügt
- ✅ Tool-Tier-Erkennung verbessert
- ✅ Rezept-Datenbank für Wooden/Stone/Iron Tools
- ✅ Vollständige Dokumentation erstellt

---

**Ende der Dokumentation**
