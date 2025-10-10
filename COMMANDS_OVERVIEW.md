# 📋 **Dudu Commands Übersicht - Alle verfügbaren !commands**

## ℹ️ **Query Commands (Informationen abrufen)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!stats` | Bot Status (Position, Health, Hunger, Zeit) | - |
| `!inventory` | Inventar anzeigen | - |
| `!nearbyBlocks` | Blöcke in der Nähe anzeigen | - |
| `!craftable` | Craftbare Items mit aktuellem Inventar | - |
| `!entities` | Spieler und Entities in der Nähe | - |
| `!modes` | Verfügbare Modi und Status | - |
| `!savedPlaces` | Gespeicherte Orte auflisten | - |
| `!searchWiki(query)` | Minecraft Wiki durchsuchen | query (string) |
| `!help` | Alle Commands auflisten | - |

## 🚀 **DUDU ENHANCED COMMANDS (Neue Smart-Systeme)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!smartCollect(items, strategy)` | 🧠 Multi-source Sammlung: Truhen→Crafting→Schmelzen→Mining | items, strategy |
| `!smartCraft(item, quantity, auto_gather)` | 🔨 Erweiterte Crafting mit Auto-Material-Sammlung | item, quantity, auto_gather |
| `!build(command, size, material)` | 🏗️ Fortgeschrittenes Bau-System mit Schematic-Support | command, size, material |

## 🏗️ **Building Commands (Bau-System) - ❌ BLOCKIERT**

| Command | Beschreibung | Status |
|---------|-------------|--------|
| `!checkBlueprint` | ❌ Alte Blueprint Commands | **ERSETZT durch !build** |
| `!checkBlueprintLevel` | ❌ Alte Blueprint Commands | **ERSETZT durch !build** |
| `!getBlueprint` | ❌ Alte Blueprint Commands | **ERSETZT durch !build** |
| `!getBlueprintLevel` | ❌ Alte Blueprint Commands | **ERSETZT durch !build** |

## 🎯 **Action Commands (Aktionen)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!newAction(prompt)` | Neue custom Aktion ausführen | prompt (string) |
| `!stop` | Alle Aktionen stoppen | - |
| `!stfu` | Stoppe Chatten, aber setze Aktion fort | - |
| `!restart` | Agent neu starten | - |
| `!clearChat` | Chat-Verlauf löschen | - |

## 🚶 **Movement Commands (Bewegung)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!goToPlayer(name, closeness)` | Zu Spieler gehen | player_name (string), closeness (float) |
| `!followPlayer(name, distance)` | Spieler endlos folgen | player_name (string), follow_dist (float) |
| `!goToCoordinates(x,y,z,closeness)` | Zu Koordinaten gehen | x,y,z (float), closeness (float) |
| `!searchForBlock(type, range)` | Nach Block suchen und hingehen | type (BlockName), search_range (float) |
| `!searchForEntity(type, range)` | Nach Entity suchen und hingehen | type (string), search_range (float) |
| `!moveAway(distance)` | Wegbewegen von aktueller Position | distance (float) |
| `!digDown` | Nach unten graben | - |
| `!goToSurface` | Zur Oberfläche gehen | - |

## 📍 **Location Commands (Orte)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!rememberHere(name)` | Aktuelle Position speichern | name (string) |
| `!goToRememberedPlace(name)` | Zu gespeichertem Ort gehen | name (string) |

## 📦 **Inventory Commands (Inventar)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!givePlayer(player, item, num)` | Item an Spieler geben | player_name, item_name, num |
| `!consume(item)` | Item essen/trinken | item_name (ItemName) |
| `!equip(item)` | Item ausrüsten | item_name (ItemName) |
| `!discard(item, num)` | Items wegwerfen | item_name, num |

## 📋 **Chest Commands (Truhen)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!viewChest` | Truheninhalt anzeigen | - |
| `!putInChest(item, num)` | Items in Truhe legen | item_name, num |
| `!takeFromChest(item, num)` | Items aus Truhe nehmen | item_name, num |

## 🔨 **Crafting Commands (Handwerk)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!getCraftingPlan(item, quantity)` | Detaillierten Crafting-Plan erstellen | item (string), quantity (int) |
| `!collectBlocks(blocks, num)` | Blöcke sammeln | blocks, num |
| `!craftRecipe(item, num)` | Recipe craften | item_name, num |
| `!smeltItem(item, num)` | Items schmelzen | item_name, num |
| `!clearFurnace` | Ofen leeren | - |

## 🏠 **Building Actions (Bauen)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!placeHere(block)` | Block hier platzieren | block_name |
| `!useOn(item, block)` | Item auf Block verwenden | item_name, block_name |

## ⚔️ **Combat Commands (Kampf)**

### Basis Combat
| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!attack(entity)` | Entity angreifen | entity_name |
| `!attackPlayer(player)` | Spieler angreifen | player_name |

### **🔥 NEUE Combat Commands (Erweitert)**
| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!combatTest` | ⚡ Combat System testen | - |
| `!combatStats` | 📊 Combat Statistiken anzeigen | - |
| `!combatReset` | 🔄 Combat System zurücksetzen | - |
| `!combatConfig(setting, value)` | ⚙️ Combat Einstellungen | setting, value |
| `!combatDebug` | 🐛 Debug Combat System | - |
| `!combatForceActivate` | 🚨 Combat Mode zwangsaktivieren | - |
| `!combatEquip(weapon)` | ⚔️ Combat Ausrüstung | weapon_name |
| `!combatTactics` | 🎯 Verfügbare Taktiken anzeigen | - |
| `!combatEvents` | 📋 Combat Events anzeigen | - |
| `!combatAntiSpam(enabled)` | 🔇 Anti-Spam aktivieren/deaktivieren | enabled (bool) |
| `!combatVerbose(enabled)` | 💬 Verbose Logging | enabled (bool) |
| `!combatMode(mode)` | 🛡️ Combat Modus setzen | mode (string) |
| `!combatTestArrow` | 🏹 Pfeil-Combat testen | - |

## 🛏️ **Utility Commands (Nützliches)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!goToBed` | Ins Bett gehen | - |
| `!stay` | An aktueller Position bleiben | - |
| `!setMode(mode, enabled)` | Modus aktivieren/deaktivieren | mode_name, enabled |

## 🎯 **Goal Commands (Ziele)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!goal(prompt)` | Neues Ziel setzen | goal_prompt |
| `!endGoal` | Aktuelles Ziel beenden | - |

## 🏪 **Trading Commands (Handel)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!showVillagerTrades` | Villager-Trades anzeigen | - |
| `!tradeWithVillager(index, count)` | Mit Villager handeln | trade_index, count |

## 💬 **Conversation Commands (Gespräche)**

| Command | Beschreibung | Parameter |
|---------|-------------|-----------|
| `!startConversation` | Gespräch beginnen | - |
| `!endConversation` | Gespräch beenden | - |
| `!lookAtPlayer(player)` | Spieler anschauen | player_name |
| `!lookAtPosition(x,y,z)` | Position anschauen | x,y,z |

---

## 🔍 **Mögliche Duplikate/Konflikte:**

### ❌ **DOPPELTE COMMANDS GEFUNDEN:**
1. **`!combatReset`** - **2x definiert** (Zeile 541 und 744)
2. **`!combatTest`** - **2x definiert** (Zeile 504 und 803)

### 🔧 **Blockierte Commands (aus settings.js):**
```
"blocked_actions": ["!newAction", "!collectBlocks", "!craftRecipe", "!checkBlueprint", "!checkBlueprintLevel", "!getBlueprint", "!getBlueprintLevel"]
```

### ✨ **Grund für Blockierung:**
- **!newAction** → ❌ Sicherheitsrisiko (Code-Ausführung)
- **!collectBlocks, !craftRecipe** → ❌ Veraltet, ersetzt durch **!smartCollect, !smartCraft**
- **Blueprint Commands** → ❌ Veraltet, ersetzt durch **!build**

---

## 📊 **Zusammenfassung:**
- **� DUDU Enhanced:** 3 (**NEU!**)
- **�📝 Query Commands:** 9
- **🏗️ Building Commands:** 4 (**BLOCKIERT** - ersetzt durch !build)
- **🎯 Action Commands:** 5  
- **🚶 Movement Commands:** 8
- **📍 Location Commands:** 2
- **📦 Inventory Commands:** 4
- **📋 Chest Commands:** 3
- **🔨 Crafting Commands:** 5
- **🏠 Building Actions:** 2
- **⚔️ Combat Commands:** 15 (massiv erweitert!)
- **🛏️ Utility Commands:** 3
- **🎯 Goal Commands:** 2
- **🏪 Trading Commands:** 2
- **💬 Conversation Commands:** 4

**🎯 Total: 69+ Commands (66 + 3 neue Smart Commands)**
**🚨 2 Duplikate: !combatReset, !combatTest (müssen repariert werden)**

**🌟 DUDU UPGRADE: Alte unsichere Commands blockiert, neue Smart-Systeme aktiviert! 🤖⚡**