# Mineflayer Update-Plan für Dudu Minecraft AI

**Erstellt am:** 26. Oktober 2025
**Projekt:** dudu-minecraft-ai
**Aktuelle Mineflayer Version:** 4.33.0 (neueste verfügbar)

---

## Inhaltsverzeichnis

1. [Executive Summary](#executive-summary)
2. [Aktuelle Abhängigkeiten & Verfügbare Versionen](#aktuelle-abhängigkeiten--verfügbare-versionen)
3. [Priorität 1: Kleine Updates (GEPLANT)](#priorität-1-kleine-updates-geplant)
4. [Priorität 2: Große Updates (SPÄTER)](#priorität-2-große-updates-später)
5. [Custom Patches Analyse](#custom-patches-analyse)
6. [Detaillierte Integration-Analyse](#detaillierte-integration-analyse)
7. [Update-Durchführung: Schritt-für-Schritt](#update-durchführung-schritt-für-schritt)
8. [Risikobewertung & Testing](#risikobewertung--testing)
9. [Bekannte Breaking Changes](#bekannte-breaking-changes)
10. [Rollback-Plan](#rollback-plan)

---

## Executive Summary

### Aktueller Status
Das Projekt nutzt **mineflayer 4.33.0** (neueste Version) mit 5 offiziellen Plugins und tiefgreifender Integration in Crafting-, Mining-, Collection- und Combat-Systeme.

### Identifizierte Updates

#### ✅ SOFORT VERFÜGBAR (Kleine Updates)
| Plugin | Aktuell | Verfügbar | Typ | Priorität |
|--------|---------|-----------|-----|-----------|
| **mineflayer-auto-eat** | 3.3.6 | **5.0.3** | ⚠️ MAJOR | HOCH |
| mineflayer-pathfinder | 2.4.5 | 2.4.5 | - | - |
| mineflayer-pvp | 1.3.2 | 1.3.2 | - | - |
| mineflayer-armor-manager | 2.0.1 | 2.0.1 | - | - |

#### ⏸️ SPÄTER (Große Updates)
| Komponente | Aktuell | Status | Risiko |
|------------|---------|--------|--------|
| mineflayer-collectblock | 1.6.0 | Prüfen | MITTEL |
| mineflayer-builder | 1.0.1 | Prüfen | NIEDRIG |
| minecraft-data | 3.98.0 | Prüfen | MITTEL |
| prismarine-* | Diverse | Prüfen | MITTEL |

### Gesamtaufwand-Schätzung

**Kleine Updates (Priorität 1):**
- **Auto-Eat Update**: 3-5 Stunden (MAJOR Breaking Change!)
- **Patches Re-Apply**: 1-2 Stunden
- **Testing**: 2-3 Stunden
- **Gesamt**: **6-10 Stunden**

**Alle Updates (Priorität 1+2):**
- **15-30 Stunden** (happenweise durchführbar)

---

## Aktuelle Abhängigkeiten & Verfügbare Versionen

### Core Mineflayer
```json
"mineflayer": "^4.33.0"  // ✅ NEUESTE VERSION (keine Änderung nötig)
```
- **Minecraft-Unterstützung**: 1.8 - 1.21.x
- **Status**: Stabil, keine dringenden Updates
- **Letzte Veröffentlichung**: vor ~1 Monat

### Plugins (Priorität 1)

#### 1. mineflayer-auto-eat ⚠️ MAJOR UPDATE
```json
// AKTUELL
"mineflayer-auto-eat": "^3.3.6"

// VERFÜGBAR
"mineflayer-auto-eat": "^5.0.3"  // ⚠️ v3 → v5 MAJOR BREAKING!
```

**Releases:**
- **5.0.3**: 1. August 2025 (aktuellste)
- **5.0.2**: 3. Juli 2025
- **5.0.1**: 31. März 2025
- **3.3.6**: Deine aktuelle Version

**Wichtige Änderung:**
- ⚠️ **ESM Only** - Package ist jetzt **nur ESM**, kein CommonJS mehr!
- Dein Projekt nutzt bereits `"type": "module"` in [package.json](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\package.json#L6) ✅
- API-Änderungen möglich (müssen getestet werden)

**Verwendung im Projekt:**
- [src/utils/mcdata.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\utils\mcdata.js): Bot-Initialisierung
- [src/agent/library/systems/food_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\food_system.js): Smart Food System Integration

**Risiko**: ⚠️ **MITTEL-HOCH**

---

#### 2. mineflayer-pathfinder ✅ AKTUELL
```json
"mineflayer-pathfinder": "^2.4.5"  // ✅ NEUESTE VERSION
```

**Status:**
- Letzte Veröffentlichung: vor ~2 Jahren (2023)
- Keine neueren Versionen verfügbar
- **Stabil, kein Update nötig**

**Custom Patches:**
- ✅ **Aktive Patches vorhanden**: [patches/mineflayer-pathfinder+2.4.5.patch](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\patches\mineflayer-pathfinder+2.4.5.patch)
- Patches werden via `patch-package` angewendet

**Verwendung im Projekt:**
- Navigation zu Blöcken
- Automatisches Pathfinding
- Bewegungs-AI
- Tür/Trapdoor-Handling
- Lava-Vermeidung (mit Custom-Logik)

**Risiko**: ✅ **KEINE ÄNDERUNG**

---

#### 3. mineflayer-pvp ✅ AKTUELL
```json
"mineflayer-pvp": "^1.3.2"  // ✅ NEUESTE VERSION (offiziell)
```

**Status:**
- Letzte Veröffentlichung: vor ~3 Jahren
- Keine neueren offiziellen Versionen
- **Stabil, kein Update nötig**

**Alternative (Info only):**
- `@nxg-org/mineflayer-custom-pvp` v1.7.6 (März 2025)
- Erweiterte Features (nicht relevant für dein Projekt)

**Custom Patches:**
- ✅ **Aktive Patches vorhanden**: [patches/mineflayer-pvp+1.3.2.patch](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\patches\mineflayer-pvp+1.3.2.patch)
- Fix: `physicTick` → `physicsTick` (Typo-Korrektur)

**Verwendung im Projekt:**
- Combat-Modi (combat_mode.js)
- Mob-Hunting für Food System
- Automatisches Angreifen

**Risiko**: ✅ **KEINE ÄNDERUNG**

---

#### 4. mineflayer-armor-manager ✅ AKTUELL
```json
"mineflayer-armor-manager": "^2.0.1"  // ✅ NEUESTE VERSION
```

**Status:**
- Letzte Veröffentlichung: vor ~2 Jahren (2023)
- Keine neueren Versionen verfügbar
- **Stabil, kein Update nötig**

**Verwendung im Projekt:**
- Automatisches Rüstung-Equipping
- Integration in Crafting-System
- Minimale Konfiguration

**Risiko**: ✅ **KEINE ÄNDERUNG**

---

### Plugins (Priorität 2 - SPÄTER)

#### 5. mineflayer-collectblock
```json
"mineflayer-collectblock": "^1.6.0"  // Status: Prüfen
```

**Verwendung:**
- [src/agent/library/systems/collection.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\collection.js#L541): SmartCollectEnhanced
- [src/agent/library/skills.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\skills.js): `collectBlock()` Funktion
- Kernkomponente für Resource-Gathering

**Risiko**: ⚠️ **MITTEL** (tief integriert)

---

#### 6. mineflayer-builder
```json
"mineflayer-builder": "^1.0.1"  // Status: Prüfen
```

**Verwendung:**
- Building-System (weniger kritisch)

**Risiko**: ✅ **NIEDRIG**

---

#### 7. Supporting Libraries
```json
"minecraft-data": "^3.98.0"
"prismarine-item": "^1.17.0"
"prismarine-nbt": "^2.7.0"
"prismarine-schematic": "^1.2.3"
"prismarine-viewer": "^1.33.0"
"vec3": "^0.1.10"
```

**Status:** Später prüfen bei Bedarf
**Risiko:** ⚠️ **MITTEL** (minecraft-data hat eigenen Patch)

---

## Priorität 1: Kleine Updates (GEPLANT)

### Update-Übersicht

#### ✅ Was wird NICHT geändert (bereits aktuell):
- mineflayer-pathfinder (2.4.5)
- mineflayer-pvp (1.3.2)
- mineflayer-armor-manager (2.0.1)

#### ⚠️ Was wird geändert:
- **mineflayer-auto-eat**: 3.3.6 → 5.0.3 (MAJOR)

### Warum nur Auto-Eat?

Die anderen drei Plugins (pathfinder, pvp, armor-manager) sind bereits auf der **neuesten verfügbaren Version**. Es gibt keine Updates zu installieren.

**Auto-Eat hingegen hat 2 Major-Versionen übersprungen** (v3 → v5), was bedeutet:
- Breaking Changes wahrscheinlich
- API-Änderungen möglich
- ESM-Only Enforcement (bereits kompatibel ✅)

---

### mineflayer-auto-eat: 3.3.6 → 5.0.3

#### Breaking Changes (erwartet)

**1. ESM-Only Requirement**
```javascript
// Dein Projekt nutzt bereits ESM ✅
// package.json hat "type": "module"
```

**2. Mögliche API-Änderungen**

Aktuelle Verwendung in deinem Code:
```javascript
// src/utils/mcdata.js - Plugin-Load
import autoEat from 'mineflayer-auto-eat';
bot.loadPlugin(autoEat);

// Mögliche Konfiguration
bot.autoEat.options = {
  priority: 'foodPoints',
  startAt: 14,
  bannedFood: []
};
```

**Zu prüfen nach Update:**
- Ist `bot.loadPlugin(autoEat)` noch gültig?
- Gibt es neue Konfigurations-Optionen?
- Wurden alte Optionen deprecated?
- Funktioniert die Food-System Integration noch?

**3. Integration mit Smart Food System**

Deine [src/agent/library/systems/food_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\food_system.js) nutzt Auto-Eat als Fallback:

```javascript
// Möglicher Konflikt bei v5.0.3?
// Food-System überschreibt Auto-Eat teilweise
```

**Test-Szenarien:**
1. Bot hat Hunger → Auto-Eat aktiviert sich
2. Smart Food System findet besseres Essen → Überschreibt Auto-Eat
3. Kein Essen verfügbar → Graceful degradation

---

#### Update-Prozess

**Phase 1: Vorbereitung (30 Min)**
```bash
# 1. Aktuellen Stand sichern
git add .
git commit -m "Pre-update checkpoint: mineflayer-auto-eat 3.3.6"

# 2. Branch erstellen
git checkout -b update/auto-eat-5.0.3
```

**Phase 2: Update Installation (15 Min)**
```bash
# 3. Update durchführen
npm install mineflayer-auto-eat@5.0.3

# 4. Dependencies prüfen
npm list mineflayer-auto-eat
```

**Phase 3: Code-Anpassungen (1-2 Std)**

Dateien zu überprüfen:
1. [src/utils/mcdata.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\utils\mcdata.js) - Plugin-Initialisierung
2. [src/agent/library/systems/food_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\food_system.js) - Food-System Integration

**Prüf-Checkliste:**
- [ ] Import-Statement funktioniert (`import autoEat from 'mineflayer-auto-eat'`)
- [ ] Plugin lädt ohne Fehler (`bot.loadPlugin(autoEat)`)
- [ ] Bot-Property existiert (`bot.autoEat`)
- [ ] Konfiguration funktioniert (`bot.autoEat.options`)
- [ ] Auto-Eat aktiviert sich bei Hunger
- [ ] Food-System überschreibt korrekt
- [ ] Keine Konflikte zwischen beiden Systemen

**Phase 4: Testing (2-3 Std)**

**Test 1: Basic Functionality**
```javascript
// Test-Szenario: Bot hungert, hat Essen im Inventar
// Erwartung: Auto-Eat isst automatisch
```

**Test 2: Food System Integration**
```javascript
// Test-Szenario: Food-System findet besseres Essen
// Erwartung: Kein Konflikt, smooth Transition
```

**Test 3: Edge Cases**
```javascript
// - Kein Essen verfügbar
// - Essen nicht essbar (z.B. roher Fisch vs gekochter)
// - Hunger-Schwellwerte
```

**Phase 5: Commit (15 Min)**
```bash
# Wenn alle Tests erfolgreich
git add package.json package-lock.json
git add src/utils/mcdata.js  # falls geändert
git add src/agent/library/systems/food_system.js  # falls geändert
git commit -m "Update mineflayer-auto-eat: 3.3.6 → 5.0.3

- ESM-only package (already compatible)
- Tested with food_system.js integration
- All auto-eat functionality verified"
```

---

#### Geschätzte Zeiten

| Phase | Dauer | Kumulative Zeit |
|-------|-------|-----------------|
| Vorbereitung | 30 Min | 0:30 |
| Installation | 15 Min | 0:45 |
| Code-Anpassungen | 1-2 Std | 2:45 (max) |
| Testing | 2-3 Std | 5:45 (max) |
| Commit & Cleanup | 15 Min | **6:00 (max)** |

**Worst-Case mit Problemen:** 8 Stunden

---

#### Rollback-Plan für Auto-Eat

**Falls das Update fehlschlägt:**

```bash
# Zurück zum vorherigen Branch
git checkout main

# Oder spezifische Version wiederherstellen
npm install mineflayer-auto-eat@3.3.6

# Oder Branch verwerfen
git branch -D update/auto-eat-5.0.3
```

**Indikatoren für Rollback:**
- [ ] Auto-Eat lädt nicht
- [ ] Kritische API-Änderungen nicht dokumentiert
- [ ] Food-System Integration defekt
- [ ] Performance-Probleme
- [ ] Bot-Crashes

---

## Priorität 2: Große Updates (SPÄTER)

### Übersicht

Diese Updates sollten **nach** den Priorität-1-Updates durchgeführt werden, jeweils einzeln und mit ausgiebigem Testing.

---

### 1. mineflayer-collectblock Update

**Aktuelle Integration:**
- [src/agent/library/systems/collection.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\collection.js) (541 Zeilen)
- [src/agent/library/systems/mining.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\mining.js) (321 Zeilen)
- [src/agent/library/skills.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\skills.js): `collectBlock()`

**Verwendete APIs:**
```javascript
bot.collectBlock.collect(block)  // Hauptfunktion
bot.tool.equipForBlock(block)    // Tool-Auswahl
```

**Risiko:** ⚠️ **MITTEL**
- Tief integriert in Resource-Gathering
- SmartCollectEnhanced baut darauf auf
- Crafting-System nutzt Collection

**Aufwand:** 3-5 Stunden

---

### 2. Crafting-System Updates

**Betroffene Komponenten:**
- [src/agent/library/systems/crafting_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\crafting_system.js) (999 Zeilen!)
- `bot.recipesFor()` API
- `bot.craft()` API
- Inventory-Management

**Mögliche Breaking Changes:**
```javascript
// ALT (aktuell)
const recipes = bot.recipesFor(itemId, metadata, requireTable);

// NEU (potentiell in Zukunft)
const recipes = bot.recipesAll(itemId, {
  requireTable: false,
  metadata: null
});
```

**Risiko:** ⚠️ **MITTEL-HOCH**
- SmartCraftingManager ist sehr komplex (999 Zeilen)
- 8 Sub-Komponenten betroffen
- Kritisch für Bot-Funktionalität

**Aufwand:** 4-6 Stunden

---

### 3. Container/Furnace-System Updates

**Betroffene Komponenten:**
- [src/agent/library/skills.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\skills.js): `smeltItem()`
- [src/agent/library/systems/crafting_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\crafting_system.js): StorageManager

**Bekannte Breaking Changes (aus Mineflayer v4.x):**
> "Simplify windows API: Removed Chest, EnchantmentTable, Furnace, Dispenser and Villager classes (they all are Windows now)"

**Aktuell verwendete APIs:**
```javascript
// Chests
const chest = await bot.openChest(chestBlock);
await chest.withdraw(item, null, count);
await chest.deposit(item, null, count);
bot.closeWindow(chest);

// Furnaces
const furnace = await bot.openFurnace(furnaceBlock);
furnace.putInput(itemType, metadata, count);
furnace.putFuel(itemType, metadata, count);
furnace.takeOutput();
furnace.takeFuel();
furnace.takeInput();
```

**Risiko:** ⚠️ **HOCH**
- Window-API hatte bereits Breaking Changes
- Furnace-Logik ist komplex (Fuel-Management)
- Storage-System scannt viele Chests

**Aufwand:** 4-6 Stunden

---

### 4. minecraft-data & prismarine-* Updates

**Betroffene Pakete:**
```json
"minecraft-data": "^3.98.0"        // Hat eigenen Patch!
"prismarine-item": "^1.17.0"
"prismarine-nbt": "^2.7.0"
"prismarine-schematic": "^1.2.3"
"prismarine-viewer": "^1.33.0"
```

**Custom Patches:**
- [patches/minecraft-data+3.97.0.patch](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\patches\minecraft-data+3.97.0.patch) (Version-Mismatch!)
- [patches/prismarine-viewer+1.33.0.patch](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\patches\prismarine-viewer+1.33.0.patch)

**Hinweis:** minecraft-data ist auf 3.98.0, aber Patch ist für 3.97.0! 🤔

**Risiko:** ⚠️ **MITTEL**
- Patches müssen neu erstellt werden
- Minecraft-Data Updates könnten neue Block-Typen/Rezepte hinzufügen
- Viewer-Patches betreffen UI

**Aufwand:** 3-5 Stunden

---

### Update-Reihenfolge (Empfohlen)

```
1. ✅ mineflayer-auto-eat (Priorität 1 - GEPLANT)
   ↓ Testing & Stabilisierung (1 Woche)

2. ⚠️ mineflayer-collectblock
   ↓ Testing & Stabilisierung (1 Woche)

3. ⚠️ minecraft-data & prismarine-*
   ↓ Testing & Stabilisierung (1 Woche)

4. ⚠️ Crafting-System (bot.recipesFor / bot.craft)
   ↓ Testing & Stabilisierung (1 Woche)

5. ⚠️ Container/Furnace-System
   ↓ Final Testing (1 Woche)
```

**Gesamtzeit (happenweise):** 5-10 Wochen bei 1 Update/Woche

---

## Custom Patches Analyse

Dein Projekt nutzt `patch-package` für Custom-Patches. Diese Patches müssen bei jedem Update neu angewendet oder angepasst werden.

### Patch-Übersicht

```bash
patches/
├── minecraft-data+3.97.0.patch        # ⚠️ Version-Mismatch (aktuell 3.98.0!)
├── mineflayer+4.33.0.patch            # ✅ Aktuell
├── mineflayer-pathfinder+2.4.5.patch  # ✅ Aktuell (KEINE ÄNDERUNG)
├── mineflayer-pvp+1.3.2.patch         # ✅ Aktuell (KEINE ÄNDERUNG)
├── prismarine-viewer+1.33.0.patch     # ✅ Aktuell
└── protodef+1.19.0.patch              # ✅ Aktuell
```

---

### Patch 1: mineflayer-pathfinder+2.4.5.patch

**Status:** ✅ **KEINE ÄNDERUNG NÖTIG** (Plugin wird nicht upgedated)

**Enthaltene Änderungen:**

#### 1.1 Lava-Handling
```javascript
// node_modules/mineflayer-pathfinder/index.js

// Lava Type hinzugefügt
+ const lavaType = bot.registry.blocksByName.lava.id

// Lava-Avoidance dynamisch updaten
+ if (movements.updateLavaAvoidance) {
+   movements.updateLavaAvoidance()
+ }

// Lava-Schwimmen wie Wasser-Schwimmen
+ } else if (bot.entity.isInLava) {
+   bot.setControlState('jump', true)
+   bot.setControlState('sprint', false)
```

**Zweck:** Bot kann aus Lava entkommen (Pathfinding durch Lava wenn drin)

---

#### 1.2 Tür-Handling
```javascript
// Offene Türen haben kleine Collision-Box
+ if(i === 0 && b?.name.includes('door')) {
+   curPoint.x = Math.floor(curPoint.x) + 0.5
+   curPoint.y = Math.floor(curPoint.y)
+   curPoint.z = Math.floor(curPoint.z) + 0.5
+   continue
+ }
```

**Zweck:** Bot bleibt nicht an offenen Türen hängen

---

#### 1.3 Erweiterte Climbables
```javascript
// lib/movements.js

// Mehr Kletter-Blöcke (Nether-Vines, Cave-Vines)
+ if (registry.blocksByName.vine) this.climbables.add(registry.blocksByName.vine.id)
+ if (registry.blocksByName.weeping_vines) this.climbables.add(...)
+ if (registry.blocksByName.twisting_vines) this.climbables.add(...)
+ if (registry.blocksByName.cave_vines) this.climbables.add(...)
```

**Zweck:** Unterstützung für 1.16+ Nether-Vines

---

#### 1.4 Trapdoor-Logik
```javascript
// Offene Trapdoors sind safe, geschlossene sind physical
+ const isOpenTrapdoor = this.openable.has(b.type) && b.name.includes('trapdoor') && b._properties?.open === true
+ const isClosedTrapdoor = this.openable.has(b.type) && b.name.includes('trapdoor') && b._properties?.open !== true

+ b.safe = (b.boundingBox === 'empty' || b.climbable || this.carpets.has(b.type) || isOpenTrapdoor) && !this.blocksToAvoid.has(b.type)
+ b.physical = (b.boundingBox === 'block' && !this.fences.has(b.type)) || isClosedTrapdoor
```

**Zweck:** Bot kann durch offene Trapdoors gehen

---

#### 1.5 Door-Opening
```javascript
// canOpenDoors aktiviert
- this.canOpenDoors = false // Causes issues. Probably due to none paper servers.
+ this.canOpenDoors = true
```

**Zweck:** Bot kann Türen, Tore und Trapdoors öffnen

---

#### 1.6 Neue Movement-Typen
```javascript
+ getMoveClimbUpThroughTrapdoor (node, neighbors) { ... }
+ getMoveClimbTop (node, neighbors) { ... }
```

**Zweck:** Bot kann durch Trapdoors über Leitern klettern

---

**WICHTIG:** Dieser Patch ist **KRITISCH** für die Navigation-Features!
**Bei Update:** Patch muss möglicherweise neu angewendet werden.

---

### Patch 2: mineflayer-pvp+1.3.2.patch

**Status:** ✅ **KEINE ÄNDERUNG NÖTIG** (Plugin wird nicht upgedated)

**Enthaltene Änderung:**

```javascript
// lib/PVP.js

// Typo-Fix im Event-Namen
- this.bot.on('physicTick', () => this.update());
+ this.bot.on('physicsTick', () => this.update());
//             ^^^^ S fehlt
```

**Zweck:** Korrektur eines Typos im mineflayer-pvp Plugin
**Kritisch:** Ohne diesen Fix funktioniert PVP nicht!

**WICHTIG:** Dieser Patch ist **KRITISCH** für Combat-Funktionalität!

---

### Patch 3: minecraft-data+3.97.0.patch

**Status:** ⚠️ **VERSION MISMATCH!**

**Problem:**
- Patch ist für Version **3.97.0**
- Installiert ist Version **3.98.0**

**Mögliche Ursachen:**
1. Patch wurde nach Update nicht neu erstellt
2. Patch funktioniert auch mit 3.98.0 (Zufall)
3. Package-Lock hat 3.98.0, aber Patch wurde vergessen

**TODO:** Patch inspizieren und neu erstellen falls nötig

---

### Patch 4-6: Weitere Patches

**Diese Patches sind nicht Teil der Priorität-1-Updates:**
- `mineflayer+4.33.0.patch` - Core Mineflayer (bereits aktuell)
- `prismarine-viewer+1.33.0.patch` - Viewer (nicht kritisch)
- `protodef+1.19.0.patch` - Protocol Definition

---

### Patch-Management bei Updates

**Nach jedem Update:**

1. **Patch-Package prüfen:**
   ```bash
   npm install  # Wendet Patches automatisch an
   ```

2. **Falls Patch fehlschlägt:**
   ```bash
   # Fehler wird angezeigt
   # Patch manuell anpassen oder neu erstellen
   ```

3. **Neuen Patch erstellen:**
   ```bash
   # Änderungen in node_modules machen
   npx patch-package mineflayer-auto-eat

   # Neuer Patch wird in patches/ erstellt
   git add patches/mineflayer-auto-eat+5.0.3.patch
   ```

4. **Alter Patch entfernen:**
   ```bash
   rm patches/mineflayer-auto-eat+3.3.6.patch
   git rm patches/mineflayer-auto-eat+3.3.6.patch
   ```

---

## Detaillierte Integration-Analyse

### 1. Crafting-System (999 Zeilen)

**Datei:** [src/agent/library/systems/crafting_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\crafting_system.js)

**Komponenten:**
```
SmartCraftingManager
├── ItemNameValidator      - Item-Namen Fuzzy-Matching
├── ChatRateLimiter        - Anti-Spam (3 msgs/5 sec)
├── ToolManager            - Tool-Hierarchie (netherite > diamond > ...)
├── StorageManager         - Chest-Scanning mit Caching
├── InventoryManager       - Intelligentes Inventory-Management
├── MaterialAnalyzer       - Rezept-Analyse & Dependency-Trees
├── ResourceGatherer       - Multi-Source Resource Collection
└── CraftingExecutor       - Crafting-Recipe Execution
```

**Verwendete Mineflayer APIs:**
```javascript
// Recipes
bot.recipesFor(itemId, metadata, requireTable)  // ⚠️ Könnte sich ändern
bot.recipes                                      // Alle Rezepte

// Crafting
bot.craft(recipe, count, craftingTable)         // ⚠️ Könnte sich ändern

// Inventory
bot.inventory.slots                              // 36 Slots
bot.inventory.items()                            // Alle Items
bot.inventory.count(itemType)                    // Item-Anzahl

// Equipment
bot.equip(item, destination)                     // Tool ausrüsten
bot.unequip(destination)                         // Tool ablegen
bot.heldItem                                     // Aktuell gehaltenes Item

// Containers
bot.openChest(chestBlock)                       // ⚠️ Window-API
chest.withdraw(itemType, metadata, count)
chest.deposit(itemType, metadata, count)
bot.closeWindow(chest)

// Blocks
bot.blockAt(position)                            // Block an Position
bot.findBlock(options)                           // Block finden

// Armor
bot.armorManager.equipAll()                      // Via Plugin
```

**Risiko-Assessment:**
- `bot.recipesFor()`: ⚠️ **MITTEL** - API könnte sich ändern
- `bot.craft()`: ⚠️ **MITTEL** - API könnte sich ändern
- Chest-API: ⚠️ **HOCH** - Hatte bereits Breaking Changes in v4.x
- Rest: ✅ **NIEDRIG** - Stabile APIs

---

### 2. Collection/Mining-System (862 Zeilen)

**Dateien:**
- [src/agent/library/systems/collection.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\collection.js) (541 Zeilen)
- [src/agent/library/systems/mining.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\mining.js) (321 Zeilen)

**SmartCollectEnhanced Features:**
- Multi-Source Collection (Chests → Crafting → Smelting → Mining)
- Inventory-Space Auto-Management
- Batch-Collection
- Storage-Network Scanning

**Verwendete Mineflayer APIs:**
```javascript
// Block Finding
bot.findBlocks({                                 // ✅ Stabil
  matching: (block) => block.name === 'iron_ore',
  maxDistance: 128,
  count: 10
})

// Mining
bot.dig(block, forceLook)                        // ✅ Stabil
bot.canDigBlock(block)                           // ✅ Stabil

// Tool Management
bot.tool.equipForBlock(block)                    // ⚠️ MITTEL (Plugin-abhängig)
bot.pathfinder.goto(goal)                        // ✅ Stabil (Custom-Patch)

// Collection Plugin
bot.collectBlock.collect(block)                  // ⚠️ HOCH (bei collectblock-Update)

// Item Pickup
bot.nearestEntity(match)                         // ✅ Stabil
```

**Risiko-Assessment:**
- `bot.collectBlock.*`: ⚠️ **HOCH** - Bei collectblock-Update betroffen
- `bot.dig()`: ✅ **NIEDRIG** - Sehr stabile API
- `bot.findBlocks()`: ✅ **NIEDRIG** - Stabile API

---

### 3. Food-System (722 Zeilen)

**Datei:** [src/agent/library/systems/food_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\food_system.js)

**Features:**
- Multi-Method Food Acquisition (hunt, harvest, craft, cook)
- Priority-Based Food-Option Evaluation
- Smoker/Furnace/Campfire Support
- Complex Recipes (Soups, Stews, Cakes)

**Auto-Eat Integration:**
```javascript
// Auto-Eat als Fallback
bot.autoEat.options = {
  priority: 'foodPoints',
  startAt: 14,
  bannedFood: []
};

// Möglicher Konflikt mit Smart Food System?
// → Muss bei Auto-Eat-Update getestet werden!
```

**Risiko-Assessment:**
- Auto-Eat Plugin: ⚠️ **HOCH** - v3 → v5 MAJOR Update!
- Food-System Logik: ⚠️ **MITTEL** - Könnte Konflikte haben

---

### 4. Combat-System

**Dateien:**
- [src/agent/modes/combat_mode.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\modes\combat_mode.js)

**Verwendete PVP-Plugin APIs:**
```javascript
bot.pvp.attack(entity)                           // ✅ Stabil
bot.pvp.stop()                                   // ✅ Stabil

// Modes (Mineflayer Core)
bot.modes.pauseAll()
bot.modes.unpauseAll()
```

**Risiko-Assessment:**
- PVP-Plugin: ✅ **NIEDRIG** - Keine Änderung geplant
- Combat-Logik: ✅ **NIEDRIG** - Sehr stabil

---

### 5. Pathfinding (Projekt-weit)

**Integration:**
- Überall wo Navigation benötigt wird
- Mining, Collection, Building, Combat

**Custom-Patch Features:**
- Lava-Handling
- Door/Trapdoor-Opening
- Erweiterte Climbables (Nether-Vines)
- Ladder-Top Climbing

**Risiko-Assessment:**
- Pathfinder-Plugin: ✅ **NIEDRIG** - Keine Änderung geplant
- Custom-Patch: ✅ **SICHER** - Wird nicht geändert

---

### 6. Armor-Management

**Integration:**
- [src/agent/library/systems/crafting_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\crafting_system.js): Auto-Equip nach Crafting

**Verwendung:**
```javascript
bot.armorManager.equipAll()                      // ✅ Sehr simpel
```

**Risiko-Assessment:**
- Armor-Plugin: ✅ **NIEDRIG** - Keine Änderung geplant
- Integration: ✅ **SEHR NIEDRIG** - Minimale Nutzung

---

## Update-Durchführung: Schritt-für-Schritt

### Phase 1: Vorbereitung (Einmalig)

#### 1.1 Backup & Branch

```bash
# In Projekt-Root
cd c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai

# Aktuellen Stand committen
git add .
git status  # Prüfen was committed wird
git commit -m "Pre-update checkpoint: Before mineflayer plugin updates"

# Neuen Branch für Updates
git checkout -b update/mineflayer-plugins-phase1

# Tag setzen für einfachen Rollback
git tag pre-update-phase1
```

---

#### 1.2 Test-Environment vorbereiten

**Minecraft Test-Server:**
- Lokaler Server empfohlen (schnelleres Testing)
- Version: 1.20.x oder höher
- Vanilla oder Paper

**Test-Profile erstellen:**
```json
// profiles/test-profile.json
{
  "name": "TestBot",
  "model": "gemma2:9b",
  "load_memory": false,
  "load_to_chat": false,
  "modes": {
    "self_preservation": true,
    "cowardice": false
  }
}
```

---

#### 1.3 Dependencies dokumentieren

```bash
# Aktuelle Versionen festhalten
npm list --depth=0 > docs/dependencies-before-update.txt

# Package-Lock sichern
cp package-lock.json package-lock.json.backup
```

---

### Phase 2: Auto-Eat Update (3-6 Stunden)

#### 2.1 Update Installation

```bash
# Auto-Eat updaten
npm install mineflayer-auto-eat@5.0.3

# Prüfen ob erfolgreich
npm list mineflayer-auto-eat
# Sollte zeigen: mineflayer-auto-eat@5.0.3
```

**Erwartete Ausgabe:**
```
dudu-minecraft-ai@1.0.0-beta
└── mineflayer-auto-eat@5.0.3
```

---

#### 2.2 Patch-Check

```bash
# Patches anwenden (automatisch bei npm install)
# Falls Fehler, werden sie hier angezeigt

# Prüfen ob neue Patches nötig
# (Auto-Eat hatte wahrscheinlich keine Patches)
```

---

#### 2.3 Code-Anpassungen

**Datei 1: [src/utils/mcdata.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\utils\mcdata.js)**

Aktueller Code prüfen:
```javascript
import autoEat from 'mineflayer-auto-eat';

// Plugin laden
bot.loadPlugin(autoEat);
```

**Mögliche Änderungen (je nach v5.0.3 API):**

Option A: Keine Änderung nötig (Best Case)
```javascript
// Funktioniert weiterhin
import autoEat from 'mineflayer-auto-eat';
bot.loadPlugin(autoEat);
```

Option B: Neue Konfiguration (falls API geändert)
```javascript
import autoEat from 'mineflayer-auto-eat';
bot.loadPlugin(autoEat);

// Neue Config-Optionen?
bot.autoEat.options = {
  priority: 'foodPoints',
  startAt: 14,
  bannedFood: [],
  // Mögliche neue Optionen in v5?
  // checkInterval: 1000,
  // eatWhileMoving: true,
};
```

**Check-Methode:**
1. Datei öffnen
2. Import prüfen (sollte funktionieren)
3. Plugin-Load prüfen (sollte funktionieren)
4. Bot starten und testen

---

**Datei 2: [src/agent/library/systems/food_system.js](c:\Users\dlanz\Documents\GitHub\dudu-minecraft-ai\src\agent\library\systems\food_system.js)**

Prüfen auf Konflikte:
```javascript
// Nutzt das Food-System bot.autoEat direkt?
// Suchen nach: bot.autoEat

// Falls Konflikt: Food-System hat Priorität
// Auto-Eat nur als Fallback
```

**Test-Szenarien:**
1. Food-System deaktiviert → Auto-Eat übernimmt ✅
2. Food-System findet Essen → Auto-Eat pausiert ✅
3. Beide aktiv → Kein Konflikt ✅

---

#### 2.4 Testing

**Test 1: Basic Auto-Eat (15 Min)**

```bash
# Bot starten
npm start

# In Minecraft:
# 1. Bot joinen lassen
# 2. Inventar leeren
# 3. 10 Steaks geben
# 4. /effect @p minecraft:hunger 30 10
#    (Bot bekommt Hunger)

# ERWARTUNG:
# - Bot isst automatisch wenn Hunger < 14
# - Console-Log: "Auto-eating: steak"
```

**Erfolgskriterien:**
- [ ] Bot isst automatisch
- [ ] Keine Errors in Console
- [ ] Hunger wird aufgefüllt
- [ ] Bot bewegt sich normal weiter

---

**Test 2: Food-System Integration (30 Min)**

```bash
# Bot starten
npm start

# In Minecraft:
# 1. Bot hat gemischtes Essen (Steak, Brot, Karotten)
# 2. Smart Food System aktiviert
# 3. Bot bekommt Hunger

# ERWARTUNG:
# - Food-System wählt bestes Essen (Steak)
# - Auto-Eat interferiert nicht
# - Smooth Transition
```

**Erfolgskriterien:**
- [ ] Food-System hat Priorität
- [ ] Auto-Eat greift ein wenn Food-System versagt
- [ ] Kein Konflikt (beide essen gleichzeitig)
- [ ] Keine Errors

---

**Test 3: Edge Cases (30 Min)**

**Test 3.1: Kein Essen**
```
Bot hat Hunger, aber kein Essen
→ ERWARTUNG: Keine Errors, Bot sucht Essen (Food-System)
```

**Test 3.2: Nicht-essbares im Inventar**
```
Bot hat nur Raw Chicken (schlechtes Essen)
→ ERWARTUNG: Bot isst trotzdem (bei Notfall)
```

**Test 3.3: Hunger-Schwellwert**
```
Bot-Hunger = 15 (über Threshold 14)
→ ERWARTUNG: Bot isst NICHT
```

---

**Test 4: Performance & Stability (1 Std)**

```bash
# Long-Running Test
# Bot laufen lassen für 1 Stunde
# Verschiedene Aktivitäten:
# - Mining
# - Building
# - Combat
# - Pathfinding

# ÜBERWACHEN:
# - Memory-Leaks
# - CPU-Usage
# - Crash/Errors
# - Auto-Eat funktioniert weiterhin
```

**Monitoring:**
```bash
# In separatem Terminal
watch -n 5 "ps aux | grep node"

# CPU/Memory überwachen
```

---

#### 2.5 Commit

**Bei erfolgreichen Tests:**

```bash
# Änderungen prüfen
git status
git diff package.json
git diff package-lock.json

# Committen
git add package.json package-lock.json
# Falls Code geändert wurde:
git add src/utils/mcdata.js
git add src/agent/library/systems/food_system.js

git commit -m "Update mineflayer-auto-eat: 3.3.6 → 5.0.3

Breaking Changes:
- ESM-only package (project already compatible)
- API unchanged, no code modifications needed

Testing:
✅ Basic auto-eat functionality verified
✅ Food-system integration tested (no conflicts)
✅ Edge cases handled correctly
✅ 1-hour stability test passed

Performance:
- No memory leaks detected
- CPU usage normal
- No crashes or errors

Files changed:
- package.json: Updated version
- package-lock.json: Updated lockfile"
```

---

### Phase 3: Verification & Cleanup (30 Min)

#### 3.1 Final Checks

```bash
# Dependencies prüfen
npm list --depth=0

# Sicherstellen dass alles installiert ist
npm install

# Patches angewendet?
ls -la patches/

# Build/Test (falls vorhanden)
npm test  # Deine Tests
```

---

#### 3.2 Dokumentation

**Update-Log erstellen:**
```bash
# In docs/UPDATE_LOG.md
echo "## $(date +%Y-%m-%d) - Auto-Eat Update" >> docs/UPDATE_LOG.md
echo "" >> docs/UPDATE_LOG.md
echo "- mineflayer-auto-eat: 3.3.6 → 5.0.3" >> docs/UPDATE_LOG.md
echo "- Status: ✅ Successful" >> docs/UPDATE_LOG.md
echo "- Breaking Changes: ESM-only (already compatible)" >> docs/UPDATE_LOG.md
echo "- Code Changes: None required" >> docs/UPDATE_LOG.md
```

---

#### 3.3 Merge to Main

**Option A: Direct Merge (bei kleinem Update)**
```bash
git checkout main
git merge update/mineflayer-plugins-phase1
git push origin main

# Branch löschen (optional)
git branch -D update/mineflayer-plugins-phase1
```

**Option B: Pull Request (empfohlen)**
```bash
git push origin update/mineflayer-plugins-phase1

# Dann auf GitHub:
# - Pull Request erstellen
# - Review durchführen
# - Mergen
```

---

## Risikobewertung & Testing

### Risiko-Matrix

| Komponente | Update | Risiko | Impact | Priorität | Aufwand |
|------------|--------|--------|--------|-----------|---------|
| **mineflayer-auto-eat** | 3.3.6 → 5.0.3 | ⚠️ HOCH | MITTEL | 1 | 3-6h |
| mineflayer-pathfinder | Keine | ✅ NIEDRIG | - | - | 0h |
| mineflayer-pvp | Keine | ✅ NIEDRIG | - | - | 0h |
| mineflayer-armor-manager | Keine | ✅ NIEDRIG | - | - | 0h |
| mineflayer-collectblock | Später | ⚠️ MITTEL | HOCH | 2 | 3-5h |
| Crafting-System | Später | ⚠️ MITTEL | HOCH | 3 | 4-6h |
| Container-System | Später | ⚠️ HOCH | HOCH | 4 | 4-6h |
| minecraft-data | Später | ⚠️ MITTEL | MITTEL | 5 | 3-5h |

**Legende:**
- **Risiko**: Wahrscheinlichkeit von Breaking Changes
- **Impact**: Auswirkung auf Bot-Funktionalität
- **Priorität**: 1 = Sofort, 5 = Später
- **Aufwand**: Geschätzte Zeit für Update + Testing

---

### Test-Plan Template

Für jedes Update:

#### Pre-Update Tests
```
[ ] Bot startet ohne Errors
[ ] Basic Movement funktioniert
[ ] Mining funktioniert
[ ] Crafting funktioniert
[ ] Combat funktioniert
[ ] Food-System funktioniert
[ ] Pathfinding funktioniert
```

#### Post-Update Tests
```
[ ] Bot startet ohne Errors (neue Version)
[ ] Basic Movement funktioniert
[ ] Mining funktioniert
[ ] Crafting funktioniert
[ ] Combat funktioniert
[ ] Food-System funktioniert (speziell bei auto-eat)
[ ] Pathfinding funktioniert
[ ] Keine Memory-Leaks (1h Test)
[ ] Keine Performance-Degradation
```

#### Integration Tests
```
[ ] Crafting + Collection Integration
[ ] Food System + Auto-Eat Integration
[ ] Combat + Pathfinding Integration
[ ] Building + Pathfinding Integration
```

---

### Performance-Benchmarks

**Vor dem Update messen:**

```bash
# Memory Usage
node --expose-gc main.js
# Notiere: Heap Used, External Memory

# CPU Usage
top -p $(pgrep -f "node main.js")
# Notiere: %CPU über 5 Minuten
```

**Nach dem Update vergleichen:**
- Memory Usage: +/- 10% akzeptabel
- CPU Usage: +/- 5% akzeptabel
- Response Time: Keine merkbare Verzögerung

---

## Bekannte Breaking Changes

### Mineflayer Core (Historisch - bereits implementiert)

**v4.x Breaking Changes:**

#### 1. Prismarine Classes nicht mehr in mineflayer.*
```javascript
// ALT (v3.x)
const Item = mineflayer.Item;
const Block = mineflayer.Block;

// NEU (v4.x) - Du nutzt bereits die neue Methode ✅
import prismarineItem from 'prismarine-item';
const Item = prismarineItem(bot.version);
```

#### 2. Windows API Simplification
```javascript
// ALT (v3.x)
const chest = new mineflayer.Chest();
const furnace = new mineflayer.Furnace();

// NEU (v4.x) - Du nutzt bereits die neue Methode ✅
const chest = await bot.openChest(block);  // Returniert Window
const furnace = await bot.openFurnace(block);  // Returniert Window
```

#### 3. minecraft-data nicht mehr mineflayer.blocks
```javascript
// ALT (v3.x)
mineflayer.blocks
mineflayer.items

// NEU (v4.x) - Du nutzt bereits die neue Methode ✅
import minecraftData from 'minecraft-data';
const mcData = minecraftData(bot.version);
```

**Status:** ✅ Alle bereits implementiert in deinem Code

---

### mineflayer-auto-eat (v3 → v5)

**Erwartete Breaking Changes:**

#### 1. ESM-Only
```javascript
// v3.x - CommonJS möglich
const autoEat = require('mineflayer-auto-eat');

// v5.x - NUR ESM
import autoEat from 'mineflayer-auto-eat';  // ✅ Du nutzt bereits ESM
```

**Status:** ✅ Bereits kompatibel (package.json hat "type": "module")

---

#### 2. Mögliche API-Änderungen (zu verifizieren)

**Aktuell (v3.3.6):**
```javascript
bot.loadPlugin(autoEat);

bot.autoEat.options = {
  priority: 'foodPoints',  // oder 'saturation'
  startAt: 14,             // Hunger-Schwellwert
  bannedFood: []           // Blacklist
};

// Events
bot.on('autoeat_started', (item) => {});
bot.on('autoeat_stopped', () => {});
```

**Potentiell neu in v5.0.3 (unbestätigt):**
```javascript
// Könnte neue Optionen haben:
bot.autoEat.options = {
  priority: 'foodPoints',
  startAt: 14,
  bannedFood: [],
  // Neue Features?
  checkInterval: 1000,      // Check-Intervall in ms
  eatWhileMoving: true,     // Essen während Bewegung
  equipFood: true,          // Auto-equip von Essen
  equipOldItem: true        // Vorheriges Item wieder equippen
};
```

**Action:** Nach Update API-Docs prüfen und testen

---

#### 3. Event-Namen (zu verifizeren)

Mögliche Änderungen:
```javascript
// ALT (v3.x)
bot.on('autoeat_started', ...)
bot.on('autoeat_stopped', ...)

// NEU (v5.x) - möglich
bot.on('auto_eat_start', ...)  // Naming-Änderung?
bot.on('auto_eat_stop', ...)
```

**Action:** Event-Listeners prüfen (falls du welche nutzt)

---

### mineflayer-pathfinder (Keine Änderung)

**Keine Breaking Changes** - Version bleibt 2.4.5

**Aber:** Custom-Patches müssen bei zukünftigen Updates angepasst werden!

---

### mineflayer-collectblock (Future Update)

**Potentielle Breaking Changes (unbekannt):**
- API-Änderungen bei `bot.collectBlock.collect()`
- Neue Konfigurationsoptionen
- Performance-Optimierungen könnten Verhalten ändern

**Action:** Bei zukünftigem Update Changelog prüfen

---

## Rollback-Plan

### Sofortiger Rollback (Bei kritischen Fehlern)

```bash
# Methode 1: Branch wechseln
git checkout main
npm install  # Alte Versionen wiederherstellen

# Methode 2: Tag nutzen
git checkout pre-update-phase1
npm install

# Methode 3: Spezifische Version downgraden
npm install mineflayer-auto-eat@3.3.6
```

---

### Indikatoren für Rollback

**SOFORT rollback bei:**
- [ ] Bot startet nicht mehr
- [ ] Kritische Errors im Console-Log
- [ ] Bot crashed wiederholt
- [ ] Mineflayer-Plugin lädt nicht

**ÜBERLEGEN rollback bei:**
- [ ] Performance-Degradation > 20%
- [ ] Memory-Leaks erkennbar
- [ ] Neue Bugs in Core-Funktionalität
- [ ] Inkompatibilität mit Server

**KEIN rollback bei:**
- [ ] Minor Bugs (können gefixt werden)
- [ ] Warnings (aber keine Errors)
- [ ] Kleine Performance-Unterschiede (< 10%)

---

### Rollback-Prozess

#### Schritt 1: Stop Bot
```bash
# Bot stoppen (Ctrl+C)
# Oder in anderem Terminal:
pkill -f "node main.js"
```

#### Schritt 2: Revert Changes
```bash
# Option A: Branch löschen
git checkout main
git branch -D update/mineflayer-plugins-phase1

# Option B: Specific file revert
git checkout main -- package.json package-lock.json
```

#### Schritt 3: Reinstall
```bash
# Dependencies wiederherstellen
npm install

# Prüfen
npm list mineflayer-auto-eat
# Sollte alte Version zeigen: 3.3.6
```

#### Schritt 4: Verify
```bash
# Bot starten
npm start

# Basic Tests durchführen
# - Bot joined
# - Movement funktioniert
# - Auto-Eat funktioniert (alte Version)
```

#### Schritt 5: Document
```bash
# Rollback dokumentieren
echo "## $(date +%Y-%m-%d) - ROLLBACK: Auto-Eat Update" >> docs/UPDATE_LOG.md
echo "Reason: [Grund eintragen]" >> docs/UPDATE_LOG.md
echo "Reverted to: 3.3.6" >> docs/UPDATE_LOG.md
```

---

### Partial Rollback (Einzelne Komponenten)

Falls nur Auto-Eat Probleme macht:

```bash
# Nur Auto-Eat zurücksetzen
npm install mineflayer-auto-eat@3.3.6

# Andere Updates behalten
# (falls du später mehrere Updates machst)
```

---

## Anhang

### Nützliche Kommandos

```bash
# Dependencies prüfen
npm list --depth=0
npm outdated

# Spezifische Version prüfen
npm view mineflayer-auto-eat versions
npm view mineflayer-auto-eat version  # Neueste

# Patches prüfen
ls -la patches/
cat patches/mineflayer-auto-eat*.patch

# Git-Status
git status
git log --oneline -10
git diff

# Bot-Prozess überwachen
ps aux | grep node
top -p $(pgrep -f "node main.js")

# Logs
tail -f logs/latest.log  # Falls du Logging hast
```

---

### Ressourcen

**Offizielle Dokumentation:**
- Mineflayer: https://github.com/PrismarineJS/mineflayer
- Auto-Eat: https://github.com/link-discord/mineflayer-auto-eat
- Pathfinder: https://github.com/PrismarineJS/mineflayer-pathfinder
- PVP: https://github.com/PrismarineJS/mineflayer-pvp
- Armor-Manager: https://github.com/PrismarineJS/MineflayerArmorManager

**NPM Packages:**
- mineflayer: https://www.npmjs.com/package/mineflayer
- mineflayer-auto-eat: https://www.npmjs.com/package/mineflayer-auto-eat
- mineflayer-pathfinder: https://www.npmjs.com/package/mineflayer-pathfinder
- mineflayer-pvp: https://www.npmjs.com/package/mineflayer-pvp
- mineflayer-armor-manager: https://www.npmjs.com/package/mineflayer-armor-manager

**Changelogs:**
- Mineflayer History: https://github.com/PrismarineJS/mineflayer/blob/master/docs/history.md
- Auto-Eat Releases: https://github.com/link-discord/mineflayer-auto-eat/releases

---

### Checkliste für jedes Update

```
PRE-UPDATE:
[ ] Git-Branch erstellt
[ ] Aktueller Stand committed
[ ] Tag gesetzt (für Rollback)
[ ] Dependencies dokumentiert
[ ] Backup erstellt (package-lock.json)

UPDATE:
[ ] npm install <package>@<version>
[ ] Patches geprüft/angewendet
[ ] Code-Anpassungen (falls nötig)
[ ] Dependencies verifiziert

TESTING:
[ ] Bot startet ohne Errors
[ ] Basic Funktionalität getestet
[ ] Integration-Tests durchgeführt
[ ] Edge-Cases getestet
[ ] Performance-Test (1h Laufzeit)
[ ] Memory-Leak Check

POST-UPDATE:
[ ] Alle Tests erfolgreich
[ ] Commit mit detaillierter Message
[ ] Dokumentation aktualisiert
[ ] Update-Log gepflegt
[ ] Team informiert (falls Team-Projekt)

ROLLBACK (falls nötig):
[ ] Grund dokumentiert
[ ] Branch gelöscht/reverted
[ ] Dependencies wiederhergestellt
[ ] Verify: Alter Stand funktioniert
```

---

### Kontakt & Support

**Bei Problemen:**
1. Check Mineflayer GitHub Issues
2. Check Plugin-spezifische Issues
3. Discord-Community (falls vorhanden)
4. Stack Overflow (Tag: mineflayer)

**Eigene Issue erstellen:**
- Mineflayer-Version angeben
- Plugin-Versionen angeben
- Minecraft-Version angeben
- Error-Logs beifügen
- Minimal reproducible example

---

## Zusammenfassung

### TL;DR für Priorität 1 (GEPLANT)

**Was wird geupdated:**
- ✅ mineflayer-auto-eat: 3.3.6 → 5.0.3 (MAJOR)

**Was bleibt gleich:**
- ✅ mineflayer-pathfinder: 2.4.5 (neueste)
- ✅ mineflayer-pvp: 1.3.2 (neueste)
- ✅ mineflayer-armor-manager: 2.0.1 (neueste)

**Geschätzte Zeit:**
- Best Case: 3-4 Stunden
- Worst Case: 6-8 Stunden
- Mit Problemen: 10 Stunden

**Risiko:**
- ⚠️ MITTEL (nur ein Package, aber MAJOR Update)

**Empfehlung:**
- ✅ Durchführen (Auto-Eat ist 2 Major-Versionen hinterher)
- ⏸️ Andere Updates später (sind bereits aktuell)

---

### Next Steps

1. **Jetzt:** Dieses Dokument reviewen
2. **Dann:** Branch erstellen & Auto-Eat updaten
3. **Testing:** Ausgiebig testen (Food-System!)
4. **Deploy:** Mergen wenn erfolgreich
5. **Monitor:** Bot 1-2 Tage überwachen
6. **Later:** Priorität-2-Updates happenweise

**Viel Erfolg beim Update! 🚀**

---

*Dokument erstellt am: 26. Oktober 2025*
*Letzte Aktualisierung: 26. Oktober 2025*
*Version: 1.0*
