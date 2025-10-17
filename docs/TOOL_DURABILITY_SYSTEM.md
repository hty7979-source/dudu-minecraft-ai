# Tool Durability System - Dokumentation

## 📋 Übersicht

Das **Tool Durability System** überwacht automatisch die Haltbarkeit aller Werkzeuge im Bot-Inventar und erstellt Tasks zum Ersetzen beschädigter Werkzeuge, bevor sie komplett kaputtgehen.

**Erstellt:** 2025-01-17
**Version:** 1.0.0
**Schwellwert:** 5% Haltbarkeit
**Check-Intervall:** 10 Sekunden

---

## 🎯 Hauptfunktionen

### **1. Automatische Durability-Überwachung**
- Prüft alle 10 Sekunden wenn Bot idle ist
- Scannt Inventar nach Tools (pickaxe, axe, sword, shovel)
- Berechnet Haltbarkeit in Prozent

### **2. Frühwarnsystem**
- Erkennt Tools unter 5% Haltbarkeit
- Verhindert dass Tools komplett kaputtgehen
- Zeigt detaillierte Durability-Informationen

### **3. Automatischer Ersatz**
- Erstellt LOW-Priority-Task zum Ersetzen
- Nutzt smartCraft (sammelt Materialien automatisch)
- Entsorgt alte, kaputte Werkzeuge

### **4. Cooldown-System**
- 1 Minute Cooldown zwischen Repair-Tasks
- Verhindert Task-Spam
- Ermöglicht Zeit für Material-Sammlung

---

## 📦 Dateien

### **Kern-Datei:**
- `src/agent/idle_task_generator.js` (Zeile 163-264)

### **Abhängigkeiten:**
- `src/agent/task_queue_manager.js` - Task-System
- `src/agent/library/systems/crafting_system.js` - smartCraft
- `src/agent/contextual_memory.js` - Memory-System

---

## 🔧 Funktion: checkToolDurability()

### **Location:** `src/agent/idle_task_generator.js:167`

### **Workflow:**

```
┌─────────────────────────────────────┐
│  Bot ist idle (alle 10 Sekunden)   │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  checkToolDurability() aufgerufen   │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Cooldown-Prüfung (1 Minute)        │
│  ✓ OK → Weiter                      │
│  ✗ Noch im Cooldown → return        │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Alle Tools im Inventar scannen     │
│  Filter: pickaxe, axe, sword, shovel│
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Für jedes Tool:                    │
│  - maxDurability abrufen            │
│  - currentDurability berechnen      │
│  - Prozent berechnen                │
│  - Wenn < 5%: zu brokenTools        │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  brokenTools leer?                  │
│  ✓ Ja → return (nichts zu tun)     │
│  ✗ Nein → Weiter                   │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Zeige Liste beschädigter Tools     │
│  "🔧 Low durability tools detected" │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Task 'repair_tools' erstellen      │
│  Priority: LOW (2)                  │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Für jedes broken Tool:             │
│  1. Bestimme Replacement-Item       │
│  2. smartCraft(replacement)         │
│  3. Entsorge altes Tool (toss)      │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Task abgeschlossen                 │
│  Setze Cooldown (1 Minute)          │
└─────────────────────────────────────┘
```

---

## 📊 Durability-Werte

### **Minecraft Tool Durability:**

| Tool Material | Max Durability | 5% Threshold | Uses Left |
|---------------|----------------|--------------|-----------|
| **Wooden** | 59 | < 2.95 | < 3 uses |
| **Stone** | 131 | < 6.55 | < 7 uses |
| **Golden** | 32 | < 1.6 | < 2 uses |
| **Iron** | 250 | < 12.5 | < 13 uses |
| **Diamond** | 1561 | < 78.05 | < 78 uses |
| **Netherite** | 2031 | < 101.55 | < 102 uses |

### **Berechnung:**

```javascript
const maxDurability = tool.maxDurability;           // z.B. 131 (stone)
const durabilityUsed = tool.durabilityUsed;         // z.B. 125
const currentDurability = maxDurability - durabilityUsed; // 131 - 125 = 6
const durabilityPercent = (currentDurability / maxDurability) * 100; // 4.58%

// Prüfung:
if (durabilityPercent < 5 && durabilityPercent > 0) {
    // Tool muss ersetzt werden!
}
```

---

## 🎮 Code-Referenz

### **Vollständige Funktion:**

```javascript
async checkToolDurability() {
    const bot = this.agent.bot;
    const memory = this.agent.contextual_memory;

    // 1. Cooldown-Prüfung
    if (this.isOnCooldown('repair_tools')) return false;

    // 2. Alle Werkzeuge im Inventar finden
    const tools = bot.inventory.items().filter(item =>
        (item.name.includes('pickaxe') ||
         item.name.includes('axe') ||
         item.name.includes('sword') ||
         item.name.includes('shovel')) &&
        item.durabilityUsed !== undefined
    );

    // 3. Beschädigte Tools identifizieren
    const brokenTools = [];

    for (const tool of tools) {
        const maxDurability = tool.maxDurability || 100;
        const currentDurability = maxDurability - (tool.durabilityUsed || 0);
        const durabilityPercent = (currentDurability / maxDurability) * 100;

        // Prüfe ob unter 5% Haltbarkeit
        if (durabilityPercent < 5 && durabilityPercent > 0) {
            brokenTools.push({
                name: tool.name,
                durability: Math.floor(durabilityPercent),
                remaining: currentDurability,
                max: maxDurability
            });
        }
    }

    // 4. Wenn keine beschädigten Tools → return
    if (brokenTools.length === 0) return false;

    // 5. Zeige Liste beschädigter Tools
    console.log('🔧 Low durability tools detected:');
    for (const tool of brokenTools) {
        console.log(`  - ${tool.name}: ${tool.durability}% (${tool.remaining}/${tool.max})`);
    }

    // 6. Erstelle Repair-Task
    await this.agent.taskQueue.runTask(
        'repair_tools',
        TaskPriority.LOW,
        async (agent) => {
            console.log('🔨 Replacing worn tools...');

            for (const tool of brokenTools) {
                // Bestimme Replacement basierend auf Tier
                let replacement = tool.name;

                console.log(`  → Crafting replacement ${replacement}...`);
                const success = await smartCraft(agent.bot, replacement, 1, skills);

                if (success) {
                    console.log(`  ✓ ${replacement} crafted`);

                    // Entsorge das alte, kaputte Werkzeug
                    const oldTool = agent.bot.inventory.items().find(i =>
                        i.name === tool.name &&
                        i.durabilityUsed !== undefined &&
                        (i.maxDurability - i.durabilityUsed) === tool.remaining
                    );

                    if (oldTool) {
                        await agent.bot.toss(oldTool.type, null, 1);
                        console.log(`  🗑️ Discarded broken ${tool.name}`);
                    }
                } else {
                    console.log(`  ⚠️ Could not craft ${replacement} - missing materials`);
                }
            }

            console.log('✅ Tool maintenance completed');
        },
        {
            timeout: 120000, // 2 Minuten
            resumable: true,
            metadata: { type: 'tool_maintenance', tools: brokenTools }
        }
    );

    // 7. Setze Cooldown
    this.setCooldown('repair_tools');
    return true;
}
```

---

## 📋 Beispiel-Outputs

### **Beispiel 1: Stone Tools niedrige Durability**

```
🤖 Idle Task Generator: Checking for tasks...
📊 Status: stone tools, 5 food, 0 torches

🔧 Low durability tools detected:
  - stone_pickaxe: 3% (4/131)
  - stone_axe: 4% (5/131)

📋 Task created: Task[5:repair_tools](priority=2, state=queued)
📥 Task enqueued: Task[5:repair_tools](priority=2, state=queued) (queue size: 1)
▶️ Starting Task[5:repair_tools](priority=2, state=queued)

🔨 Replacing worn tools...

  → Crafting replacement stone_pickaxe...
  🎯 Smart crafting: 1x stone_pickaxe
  📦 Gathering materials...
    → Need 3 cobblestone (have 20)
    → Need 2 sticks (have 8)
  ✓ Materials available
  ✓ stone_pickaxe crafted
  🗑️ Discarded broken stone_pickaxe

  → Crafting replacement stone_axe...
  🎯 Smart crafting: 1x stone_axe
  ✓ stone_axe crafted
  🗑️ Discarded broken stone_axe

✅ Tool maintenance completed
✅ Task[5:repair_tools](priority=2, state=completed) completed (runtime: 5432ms)
```

---

### **Beispiel 2: Fehlende Materialien**

```
🔧 Low durability tools detected:
  - iron_pickaxe: 2% (5/250)

🔨 Replacing worn tools...

  → Crafting replacement iron_pickaxe...
  🎯 Smart crafting: 1x iron_pickaxe
  📦 Gathering materials...
    → Need 3 iron_ingots (have 0)
    ❌ Not enough iron_ingot
  ⚠️ Could not craft iron_pickaxe - missing materials

✅ Tool maintenance completed
```

**Hinweis:** Bot sammelt keine Erze automatisch. User muss Eisen bereitstellen oder manuell farmen lassen.

---

### **Beispiel 3: Mehrere Tools gleichzeitig**

```
🔧 Low durability tools detected:
  - stone_pickaxe: 3% (4/131)
  - stone_axe: 4% (5/131)
  - stone_sword: 2% (3/131)
  - stone_shovel: 4% (5/131)

🔨 Replacing worn tools...
  ✓ stone_pickaxe crafted
  ✓ stone_axe crafted
  ✓ stone_sword crafted
  ✓ stone_shovel crafted
  🗑️ Discarded 4 broken tools

✅ Tool maintenance completed
```

---

## 🛠️ Task-Integration

### **Task-Properties:**

```javascript
{
    name: 'repair_tools',
    priority: TaskPriority.LOW (2),
    timeout: 120000, // 2 Minuten
    resumable: true,  // Kann pausiert werden (z.B. für Kampf)
    metadata: {
        type: 'tool_maintenance',
        tools: [
            { name: 'stone_pickaxe', durability: 3, remaining: 4, max: 131 },
            ...
        ]
    }
}
```

### **Task-Queue-Position:**

```
CRITICAL (10) - Death Recovery
HIGH (7)      - Combat/Fleeing
NORMAL (5)    - User Commands, Food, Bed
LOW (2)       - Tool Durability ← HIER
              - Tool Upgrades
              - Torches
BACKGROUND (1)- Resource Gathering
```

**Bedeutung:**
- Repair läuft nach wichtigeren Tasks (Food, Bed)
- Kann pausiert werden für Combat
- Läuft vor Resource Gathering

---

## 🔄 Integration mit anderen Systemen

### **1. MaterialPlanner Integration:**

```javascript
// smartCraft nutzt automatisch MaterialPlanner
await smartCraft(agent.bot, 'stone_pickaxe', 1, skills);

// Intern:
// 1. Analysiert Rezept: 3 cobblestone + 2 sticks
// 2. Prüft Inventar
// 3. Sammelt fehlende Materialien
// 4. Craftet Item
```

---

### **2. Task-Queue-Manager Integration:**

```javascript
// Task wird in Queue eingefügt
await this.agent.taskQueue.runTask('repair_tools', TaskPriority.LOW, ...);

// Kann pausiert werden wenn höher-prioritärer Task kommt:
if (enemy_nearby) {
    // repair_tools wird pausiert
    await this.agent.taskQueue.runTask('self_defense', TaskPriority.HIGH, ...);
    // Nach Kampf wird repair_tools fortgesetzt
}
```

---

### **3. Cooldown-System:**

```javascript
// Nach Task-Ausführung:
this.setCooldown('repair_tools');
// cooldowns.set('repair_tools', Date.now())

// Bei nächstem Check:
if (this.isOnCooldown('repair_tools')) return false;
// if (Date.now() - lastRun < 60000) return false
```

---

## 🧪 Test-Szenarien

### **Test 1: Tool bis 5% nutzen**

**Setup:**
1. Gib Bot einen stone_pickaxe
2. Lasse Bot minen bis < 5% Durability

**Kommandos:**
```javascript
!givePlayer Dudu stone_pickaxe 1
!collectBlocks stone 100  // Nutzt pickaxe ab
```

**Erwartetes Verhalten:**
1. Durability sinkt während Mining
2. Bei < 5%: "🔧 Low durability tools detected"
3. Task 'repair_tools' wird erstellt
4. Neuer stone_pickaxe wird gecraftet
5. Alter pickaxe wird weggeworfen

---

### **Test 2: Mehrere Tools gleichzeitig**

**Setup:**
1. Gib Bot stone_pickaxe, stone_axe, stone_sword (alle < 5%)

**Erwartetes Verhalten:**
1. Alle 3 Tools werden erkannt
2. Liste zeigt alle 3 Tools
3. Alle 3 werden nacheinander ersetzt
4. Alle 3 alte Tools werden weggeworfen

---

### **Test 3: Fehlende Materialien**

**Setup:**
1. Iron_pickaxe < 5% Durability
2. Kein iron_ingot im Inventar

**Erwartetes Verhalten:**
1. Tool wird erkannt
2. smartCraft versucht zu craften
3. Fehlermeldung: "Could not craft - missing materials"
4. Altes Tool bleibt erhalten (nicht weggeworfen)

---

### **Test 4: Cooldown-System**

**Setup:**
1. Trigger repair_tools Task
2. Sofort danach noch ein Tool beschädigen

**Erwartetes Verhalten:**
1. Erster Task läuft
2. Zweiter Check findet beschädigtes Tool
3. Aber: isOnCooldown('repair_tools') = true
4. return false (kein Task erstellt)
5. Nach 1 Minute: Cooldown abgelaufen
6. Nächster Check erstellt Task

---

## ⚙️ Konfiguration

### **Schwellwert ändern:**

```javascript
// In checkToolDurability(), Zeile 190:
if (durabilityPercent < 5 && durabilityPercent > 0) {
    // Ändere 5 zu gewünschtem Wert (z.B. 10 für 10%)
}
```

**Empfohlene Werte:**
- **5%** (Standard) - Gut für die meisten Fälle
- **10%** - Sicherer, ersetzt früher
- **2%** - Riskanter, spart Materialien

---

### **Check-Intervall ändern:**

```javascript
// In IdleTaskGenerator constructor, Zeile 29:
this.checkInterval = 10000; // 10 Sekunden
// Ändere zu gewünschtem Wert in Millisekunden
```

**Empfohlene Werte:**
- **10000** (10s, Standard) - Häufige Checks
- **30000** (30s) - Weniger CPU-Last
- **5000** (5s) - Sehr reaktiv

---

### **Cooldown ändern:**

```javascript
// In IdleTaskGenerator constructor, Zeile 31:
this.minCooldown = 60000; // 1 Minute
// Ändere zu gewünschtem Wert in Millisekunden
```

**Empfohlene Werte:**
- **60000** (1min, Standard) - Verhindert Spam
- **120000** (2min) - Längere Pause
- **30000** (30s) - Kürzere Pause

---

## 🐛 Troubleshooting

### **Problem: Tools werden nicht erkannt**

**Symptom:** Keine "Low durability" Meldung obwohl Tool fast kaputt

**Mögliche Ursachen:**
1. Tool ist nicht im Bot-Inventar (liegt am Boden, in Chest, etc.)
2. Tool hat keine durabilityUsed Property
3. Bot ist nicht idle (anderer Task läuft)

**Lösung:**
```javascript
// Debug-Log hinzufügen:
console.log('All tools:', bot.inventory.items().filter(i =>
    i.name.includes('pickaxe') || i.name.includes('axe')
));
```

---

### **Problem: "Could not craft replacement"**

**Symptom:** Fehlermeldung bei Replacement-Versuch

**Mögliche Ursachen:**
1. Fehlende Materialien (cobblestone, sticks, iron_ingot)
2. Keine Crafting-Table in Reichweite
3. Falscher Item-Name

**Lösung:**
```javascript
// Prüfe Inventar:
!inventory

// Prüfe ob Crafting-Table vorhanden:
// Bot sollte crafting_table im Inventar haben oder in Reichweite
```

---

### **Problem: Alte Tools werden nicht weggeworfen**

**Symptom:** Bot hat altes UND neues Tool

**Ursache:** `oldTool.find()` findet das Tool nicht

**Lösung:**
```javascript
// Debug: Zeige alle Tools mit Durability
console.log(bot.inventory.items().map(i => ({
    name: i.name,
    durabilityUsed: i.durabilityUsed,
    remaining: i.maxDurability - i.durabilityUsed
})));
```

---

### **Problem: Cooldown wird nicht respektiert**

**Symptom:** Tasks werden trotz Cooldown erstellt

**Ursache:** Cooldown wird nicht gesetzt oder Map wurde geleert

**Lösung:**
```javascript
// Debug: Zeige aktive Cooldowns
console.log('Active cooldowns:', this.cooldowns);

// Prüfe ob setCooldown aufgerufen wird:
console.log('Setting cooldown for repair_tools');
this.setCooldown('repair_tools');
```

---

## 📝 Erweiterungsmöglichkeiten

### **1. Armor Durability hinzufügen:**

```javascript
// In checkToolDurability():
const armor = bot.inventory.items().filter(item =>
    item.name.includes('helmet') ||
    item.name.includes('chestplate') ||
    item.name.includes('leggings') ||
    item.name.includes('boots')
);

// Gleiche Logik wie für Tools anwenden
```

---

### **2. Repair statt Replace:**

```javascript
// Für Tools mit Mending Enchantment:
if (tool.nbt && tool.nbt.Enchantments) {
    const hasMending = tool.nbt.Enchantments.some(e => e.id === 'mending');

    if (hasMending) {
        // XP sammeln statt neues Tool craften
        await collectXP(bot);
        return;
    }
}

// Sonst normal ersetzen
```

---

### **3. Tier-Upgrade bei Replacement:**

```javascript
// Statt gleiches Tier, upgrade wenn möglich:
let replacement = null;

if (tool.name.includes('stone_') && hasIronIngots >= 3) {
    replacement = tool.name.replace('stone_', 'iron_');
} else {
    replacement = tool.name; // Gleiches Tier
}
```

---

### **4. Warnung vor kritischer Durability:**

```javascript
// Bei 10% Warnung ausgeben:
if (durabilityPercent < 10 && durabilityPercent >= 5) {
    console.log(`⚠️ Warning: ${tool.name} at ${durabilityPercent}%`);
}
```

---

## 📚 Weiterführende Dokumentation

- **[MATERIAL_PLANNER_GUIDE.md](./MATERIAL_PLANNER_GUIDE.md)** - Material-Planungssystem
- **[NEW_ARCHITECTURE_GUIDE.md](./NEW_ARCHITECTURE_GUIDE.md)** - Gesamtsystem
- **[TEST_SCENARIOS.md](./TEST_SCENARIOS.md)** - Test-Szenarien

---

## 🙏 Credits

**Entwickelt von:** Dudu AI Team
**Datum:** Januar 2025
**Version:** 1.0.0

---

**Ende der Dokumentation**
