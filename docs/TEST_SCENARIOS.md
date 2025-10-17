# 🧪 Test-Szenarien für die neue Architektur

## Vorbereitung

1. **Backup ist gemacht** ✅
2. **Bot starten:**
   ```bash
   node main.js
   ```
3. **Achte auf neue Logs:**
   - `🏠 Homepoint set to [x, y, z]`
   - `🧠 ContextualMemory initialized`
   - `📋 Task created: ...`

---

## Test 1: Interrupt-Chaos ist gelöst ✅

### Ziel
Beweisen dass der Bot nicht mehr in Panik gerät wenn mehrere Bedrohungen gleichzeitig auftreten.

### Durchführung

1. **Starte eine längere Aktion:**
   ```
   !searchForBlock diamond_ore 256
   ```
   oder
   ```
   !collectBlocks dirt 64
   ```

2. **Während der Bot arbeitet:**
   - Spawne Mobs in der Nähe (mit `/summon zombie ~ ~ ~`)
   - ODER: Setze den Bot in Brand (`/effect give <botname> minecraft:fire_resistance 0`)
   - ODER: Teleportiere Creeper neben ihn

3. **Beobachte die Logs:**

   **ALTE ARCHITEKTUR würde zeigen:**
   ```
   action "action:searchForBlock" trying to interrupt current action "mode:self_defense"
   waiting for code to finish executing...
   Mode self_defense completed:
   Unpausing mode: cowardice
   executing code...
   waiting for code to finish executing...
   PathStopped: Path was stopped before it could be completed!
   ❌ CHAOS
   ```

   **NEUE ARCHITEKTUR zeigt:**
   ```
   📋 Task created: Task[1:searchForBlock](priority=5, state=queued)
   ▶️ Starting Task[1:searchForBlock]

   📋 Task created: Task[2:mode:self_defense](priority=7, state=queued)
   ⚠️ Task[2:mode:self_defense] interrupts Task[1:searchForBlock]
   ⏸️ Pausing Task[1:searchForBlock]
   ▶️ Starting Task[2:mode:self_defense]
   ✅ Task[2:mode:self_defense] completed

   ▶️ Resuming Task[1:searchForBlock]
   ✅ Task[1:searchForBlock] completed
   ✅ KEINE PANIK!
   ```

### Erwartetes Ergebnis
- Bot pausiert die Suche
- Bot flieht/kämpft
- Bot setzt die Suche fort
- **Kein PathStopped Error!** ✅

---

## Test 2: Death Recovery 💀

### Ziel
Bot sammelt automatisch seine Items nach dem Tod ein.

### Durchführung

1. **Gib dem Bot wertvolle Items:**
   ```
   /give <botname> diamond 5
   /give <botname> iron_pickaxe 1
   ```

2. **Töte den Bot:**
   ```
   /kill <botname>
   ```

3. **Beobachte die Logs:**
   ```
   💀 Death #1 recorded at [x, y, z]
   ⏰ Items will despawn in 5 minutes (HH:MM:SS)

   🧠 Memory: DEATH RECOVERY: Items at [x, y, z] - 299s remaining!

   📋 Task created: Task[X:death_recovery](priority=7, state=queued)
   💀 Going to death location to recover items (299s left)...
   ```

4. **Bot sollte automatisch:**
   - Zum Sterbeort laufen
   - Items aufsammeln
   - Chat: `✅ Item recovery completed!`

### Erwartetes Ergebnis
- **Automatische Recovery ohne User-Befehl!** ✅
- Bot hat Items wieder im Inventory
- `agent.contextual_memory.isDeathRecoveryPending()` → `false`

### Erweitert: Interrupt während Recovery

5. **Während der Recovery:**
   - Spawne Mobs auf dem Weg zum Sterbeort

6. **Erwartung:**
   - Death Recovery wird **pausiert**
   - Kampf/Flucht läuft
   - Death Recovery wird **fortgesetzt**
   - Items werden gerettet ✅

---

## Test 3: Autonome Produktivität (Idle Tasks) 🤖

### Ziel
Bot macht automatisch produktive Dinge wenn idle.

### Durchführung

1. **Lass den Bot komplett idle:**
   - Keine Commands geben
   - Warte 10-15 Sekunden

2. **Bot sollte prüfen:**
   ```
   🤖 Idle Task Generator: Checking for tasks...
   ```

3. **Szenarien:**

   **A) Wenig Nahrung:**
   ```
   🍖 Low food supply detected
   📋 Task created: Task[X:gather_food](priority=2, state=queued)
   🍖 Gathering food...
   → Bot jagt Tiere
   ✅ Food gathering completed
   ```

   **B) Keine Werkzeuge:**
   ```
   🔧 Tool upgrade available: none → stone
   🔧 Upgrading to stone tools...
   → Bot sammelt Cobblestone
   → Bot craftet Steinwerkzeuge
   ✅ Upgraded to stone tools!
   ```

   **C) Nachts ohne Bett:**
   - Warte bis Nacht
   - Entferne Bot's Bett (`/clear <botname> minecraft:white_bed`)
   ```
   🌙 Nighttime without bed detected
   🌙 Need a bed for the night...
   → Bot craftet oder sucht Bett
   ```

### Setup für Test 3:

**Test A - Wenig Food:**
```
/clear <botname>
/give <botname> stone_pickaxe 1
/give <botname> cooked_beef 2
```
→ Bot hat Werkzeuge aber wenig Essen

**Test B - Keine Werkzeuge:**
```
/clear <botname>
/give <botname> cooked_beef 20
```
→ Bot hat Essen aber keine Werkzeuge

**Test C - Nachts ohne Bett:**
```
/time set night
/clear <botname> minecraft:white_bed
```

### Erwartetes Ergebnis
- Bot erkennt Mängel automatisch
- Generiert passende Tasks
- Führt sie autonom aus ✅

---

## Test 4: Task Priority System 🎯

### Ziel
Beweisen dass Prioritäten korrekt funktionieren.

### Durchführung

1. **Starte LOW-priority Task:**
   ```
   !collectBlocks dirt 64
   ```

2. **Während läuft, spawne Bedrohung:**
   ```
   /summon zombie ~ ~1 ~2
   ```

3. **Beobachte:**
   ```
   📋 Task[1:collectBlocks](priority=5) läuft
   📋 Task[2:self_defense](priority=7) created
   ⚠️ Task[2] interrupts Task[1]
   ⏸️ Pausing Task[1]
   ▶️ Starting Task[2] (Kampf)
   ✅ Task[2] completed
   ▶️ Resuming Task[1] (sammelt weiter)
   ```

### Erwartetes Ergebnis
- HIGH priority (7) unterbricht LOW (2)
- LOW wird pausiert, nicht abgebrochen
- Nach HIGH: LOW wird fortgesetzt ✅

---

## Test 5: Memory Context 🧠

### Ziel
Prüfen ob Memory korrekt gespeichert wird.

### Durchführung

1. **Während Bot läuft, öffne Node REPL:**
   ```bash
   # In einem anderen Terminal
   node
   ```

2. **Oder füge temporär in agent.js ein (nach Spawn):**
   ```javascript
   // Nach Zeile 117 (nach checkAllPlayersPresent)
   setInterval(() => {
       console.log('\n=== MEMORY STATUS ===');
       console.log(this.contextual_memory.generateContextString());
       console.log('====================\n');
   }, 30000); // Alle 30s
   ```

3. **Beobachte Output:**
   ```
   === MEMORY STATUS ===
   Equipment: stone tools, no armor
   Inventory: 15 food, 23 torches, bed: yes
   Homepoint: [100, 64, 200]
   Current goals:
   ====================
   ```

4. **Teste Updates:**
   ```
   /give <botname> iron_pickaxe 1
   → Warte 10s
   → Equipment sollte "iron tools" zeigen
   ```

### Erwartetes Ergebnis
- Memory wird korrekt aktualisiert
- Equipment-Status akkurat
- Homepoint gesetzt ✅

---

## Test 6: Kombinations-Stress-Test 💥

### Ziel
**HARDCORE** - Alles gleichzeitig!

### Durchführung

1. **Setup:**
   ```bash
   /clear <botname>
   /give <botname> stone_pickaxe 1
   /give <botname> cooked_beef 3
   ```

2. **Starte Task:**
   ```
   !collectBlocks oak_log 32
   ```

3. **Während läuft:**
   - Töte den Bot: `/kill <botname>`
   - Spawne Mobs am Respawn: `/summon zombie ~ ~ ~`
   - Setze auf Nacht: `/time set night`

4. **Erwartete Sequenz:**
   ```
   📋 collectBlocks läuft (NORMAL)
   💀 Bot stirbt → Death Recovery (HIGH)
   ▶️ Death Recovery startet
   🧟 Zombie erscheint → self_defense (HIGH)
   ⏸️ Death Recovery pausiert
   ⚔️ Kampf
   ✅ Kampf beendet
   ▶️ Death Recovery resumed
   💰 Items eingesammelt
   🌙 Nacht → Bed-Task (NORMAL)
   🛏️ Bett crafted/gefunden
   ```

### Erwartetes Ergebnis
- **Keine Panik**
- Alle Tasks werden korrekt priorisiert
- Pausierung und Resume funktionieren
- Bot überlebt und ist produktiv ✅

---

## Debug-Commands während Tests

### Task Queue Status anzeigen
Füge temporär in `agent.js` nach Zeile 400 ein:
```javascript
// In update() Methode
if (delta > 0 && Date.now() % 10000 < 1000) { // Alle ~10s
    this.taskQueue.printStatus();
}
```

### Memory manuell prüfen
```javascript
// In Bot-Chat oder Console
agent.contextual_memory.generateContextString()
agent.contextual_memory.getBestToolTier()
agent.contextual_memory.hasEnoughFood(10)
```

### Force Idle Task Check
```javascript
await agent.idleTaskGenerator.checkAndGenerateTasks();
```

---

## Checkliste ✅

Nach jedem Test abhaken:

- [ ] **Test 1**: Interrupt-Chaos gelöst
- [ ] **Test 2**: Death Recovery funktioniert
- [ ] **Test 3**: Idle Tasks werden generiert
- [ ] **Test 4**: Prioritäten funktionieren
- [ ] **Test 5**: Memory wird aktualisiert
- [ ] **Test 6**: Stress-Test bestanden

---

## Bekannte Issues & Workarounds

### Issue 1: Tasks werden nicht generiert
**Symptom:** Keine Idle Tasks trotz Idle-Zeit

**Debug:**
```javascript
console.log('Is idle?', agent.taskQueue.isIdle());
console.log('Last check:', agent.idleTaskGenerator.lastCheck);
```

**Fix:** Check Interval erhöhen in `idle_task_generator.js`:
```javascript
this.checkInterval = 5000; // Statt 10000
```

### Issue 2: Death Recovery nicht automatisch
**Symptom:** Bot geht nicht zu Items

**Debug:**
```javascript
console.log('Death pending?', agent.contextual_memory.isDeathRecoveryPending());
console.log('Can recover?', agent.contextual_memory.canRecoverItems());
console.log('Time left:', agent.contextual_memory.getRecoveryTimeRemaining());
```

**Fix:** Stelle sicher dass `checkDeathRecovery()` in `idle_task_generator.js` als erstes geprüft wird (Zeile 44).

### Issue 3: Modes interrupten sich immer noch
**Symptom:** Alte Interrupt-Meldungen

**Grund:** Modes nutzen noch altes `execute()`

**Fix:** In `modes.js` importiere:
```javascript
import { executeAsTask } from './modes_task_wrapper.js';
```
Und ersetze `execute` mit `executeAsTask`.

---

## Report Format

Bitte melde nach Tests:

```
✅ Test 1: PASS - Keine PathStopped Errors mehr
✅ Test 2: PASS - Death Recovery automatisch
❌ Test 3: FAIL - Idle Tasks nicht generiert (Grund: ...)
⚠️ Test 4: PARTIAL - Priorities funktionieren, aber ...
```

---

**Viel Erfolg beim Testen! 🚀**

Bei Fragen oder Issues einfach melden!
