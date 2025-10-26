# Auto-Eat Update: v3.3.6 → v5.0.3

**Update-Datum:** 26. Oktober 2025
**Status:** ✅ Abgeschlossen

---

## Zusammenfassung

Erfolgreiches Update von `mineflayer-auto-eat` von Version 3.3.6 auf 5.0.3 (2 Major-Versionen).

---

## Änderungen

### 1. Import-Statement ([src/utils/mcdata.js](../src/utils/mcdata.js#L8))

```diff
- import { plugin as autoEat } from 'mineflayer-auto-eat';
+ import { loader as autoEat } from 'mineflayer-auto-eat';
```

**Grund:** v5.0.3 exportiert `loader` statt `plugin`

---

### 2. Konfiguration ([src/agent/agent.js](../src/agent/agent.js#L144-L175))

#### ALT (v3.3.6):
```javascript
this.bot.autoEat.options = {
    priority: 'foodPoints',
    startAt: 14,
    bannedFood: ['rotten_flesh', ...]
};
```

#### NEU (v5.0.3):
```javascript
this.bot.autoEat.setOpts({
    priority: 'foodPoints',
    minHunger: 15,              // Renamed from startAt
    minHealth: 14,              // New option
    bannedFood: [...],
    returnToLastItem: true,     // New option
    offhand: false,             // New option
    eatingTimeout: 3000,        // New option
    strictErrors: false         // New option
});

this.bot.autoEat.enableAuto(); // Must explicitly enable
```

**Wichtige Änderungen:**
- `startAt` → `minHunger`
- Konfiguration erfolgt über `setOpts()` statt direktem `options` Objekt
- Auto-Eat muss explizit mit `enableAuto()` aktiviert werden
- Neue Optionen für feinere Kontrolle

---

### 3. Event-Namen ([src/agent/agent.js](../src/agent/agent.js#L160-L171))

#### ALT (v3.3.6):
```javascript
bot.on('autoeat_started', (item) => {...});
bot.on('autoeat_stopped', () => {...});
```

#### NEU (v5.0.3):
```javascript
bot.autoEat.on('eatStart', (opts) => {
    console.log(`Started eating ${opts.food.name}`);
});

bot.autoEat.on('eatFinish', (opts) => {
    console.log(`Finished eating ${opts.food.name}`);
});

bot.autoEat.on('eatFail', (error) => {
    console.error('Eating failed:', error);
});
```

**Wichtige Änderungen:**
- Events sind jetzt auf `bot.autoEat` statt `bot`
- `autoeat_started` → `eatStart`
- `autoeat_stopped` → `eatFinish`
- Neues Event: `eatFail`
- Events liefern mehr Informationen (`opts` Objekt statt nur Item)

---

### 4. Constants Update ([src/config/constants.js](../src/config/constants.js#L46-L61))

Neue Konstanten hinzugefügt für alle v5.0.3 Optionen:

```javascript
export const BOT_BEHAVIOR = {
    AUTO_EAT: {
        PRIORITY: 'foodPoints',
        START_AT: 15,                   // minHunger
        MIN_HEALTH: 14,                 // NEW
        BANNED_FOOD: [...],
        RETURN_TO_LAST_ITEM: true,      // NEW
        USE_OFFHAND: false,             // NEW
        EATING_TIMEOUT: 3000,           // NEW
        STRICT_ERRORS: false,           // NEW
    },
    ...
};
```

---

## Neue Features in v5.0.3

### 1. Prioritäts-Modi
```javascript
priority: 'foodPoints'         // Maximiere Hunger-Wiederherstellung
priority: 'saturation'         // Maximiere Saturation
priority: 'effectiveQuality'   // Beste Balance
priority: 'saturationRatio'    // Saturation pro Food-Point
```

### 2. Offhand-Support
```javascript
offhand: true  // Bot kann nun auch mit Offhand essen
```

### 3. Item-Rückgabe
```javascript
returnToLastItem: true  // Re-equipt vorheriges Item nach dem Essen
```

### 4. Gesundheits-basierte Priorisierung
```javascript
minHealth: 14  // Bei niedriger Gesundheit priorisiert Bot Essen mit hoher Saturation
```

### 5. Timeout-Schutz
```javascript
eatingTimeout: 3000  // Verhindert Hängenbleiben beim Essen
```

### 6. Fehlerbehandlung
```javascript
strictErrors: false  // Loggt Fehler statt sie zu werfen
```

---

## API-Referenz v5.0.3

### Properties
```javascript
bot.autoEat.enabled      // Boolean: Ist Auto-Eat aktiviert?
bot.autoEat.isEating     // Boolean: Isst der Bot gerade?
bot.autoEat.opts         // Object: Aktuelle Konfiguration
bot.autoEat.foods        // Registry: Alle verfügbaren Foods
bot.autoEat.foodsArray   // Array: Foods als Array
bot.autoEat.foodsByName  // Object: Foods nach Name
```

### Methods
```javascript
bot.autoEat.setOpts(opts)       // Konfiguration setzen
bot.autoEat.enableAuto()        // Auto-Eat aktivieren
bot.autoEat.disableAuto()       // Auto-Eat deaktivieren
bot.autoEat.eat(opts)           // Manuell essen (Promise)
bot.autoEat.cancelEat()         // Aktuellen Eat-Vorgang abbrechen
```

### Events
```javascript
bot.autoEat.on('eatStart', (opts) => {})   // Start des Essens
bot.autoEat.on('eatFinish', (opts) => {})  // Ende des Essens
bot.autoEat.on('eatFail', (error) => {})   // Fehler beim Essen
```

---

## Integration mit Food-System

Das Smart Food System ([src/agent/library/systems/food_system.js](../src/agent/library/systems/food_system.js)) läuft **unabhängig** von Auto-Eat:

**Auto-Eat:**
- Automatisches Essen wenn Hunger < 15
- Schnelle Reaktion
- Basiert auf verfügbaren Items im Inventar

**Smart Food System:**
- Komplexe Food-Beschaffung (Hunt, Harvest, Craft, Cook)
- Multi-Source Food-Acquisition
- Langfristige Planung

**Beide Systeme koexistieren:**
- Kein direkter Konflikt
- Auto-Eat als Fallback wenn Food-System nicht aktiv
- Komplementäre Funktionalität

---

## Testing-Status

### ✅ Code-Änderungen
- [x] Import-Statement aktualisiert
- [x] Konfiguration auf neue API umgestellt
- [x] Event-Listener aktualisiert
- [x] Constants erweitert
- [x] Kompatibilität mit Food-System geprüft

### ⏳ Funktionale Tests (TBD)
- [ ] Bot startet ohne Errors
- [ ] Auto-Eat aktiviert sich bei Hunger < 15
- [ ] Event-Logs erscheinen korrekt
- [ ] Food-System Integration funktioniert
- [ ] Keine Memory-Leaks (1h Test)
- [ ] Performance vergleichbar mit v3.3.6

---

## Geänderte Dateien

```
src/utils/mcdata.js           - Import-Statement
src/agent/agent.js            - Konfiguration & Event-Listener
src/config/constants.js       - Neue Konstanten
package.json                  - Version 5.0.3
package-lock.json             - Lockfile aktualisiert
docs/AUTO_EAT_UPDATE.md       - Diese Datei
```

---

## Rollback-Anleitung

Falls Probleme auftreten:

```bash
# Zurück zum Tag
git checkout pre-update-auto-eat

# Oder alte Version installieren
npm install mineflayer-auto-eat@3.3.6

# Dann alte Code-Änderungen restaurieren
git checkout main -- src/utils/mcdata.js src/agent/agent.js src/config/constants.js
```

---

## Nächste Schritte

1. **Testing:**
   - Bot auf Test-Server starten
   - Hunger-Mechanik testen
   - Event-Logs prüfen
   - Performance messen

2. **Bei Erfolg:**
   - Branch in `main` mergen
   - Bot 1-2 Tage in Production überwachen
   - Update-Log aktualisieren

3. **Später (optional):**
   - Andere Auto-Eat Features nutzen (Offhand, verschiedene Priorities)
   - Integration mit Food-System optimieren
   - Custom Food-Auswahl Logik

---

## Referenzen

- **NPM:** https://www.npmjs.com/package/mineflayer-auto-eat
- **GitHub:** https://github.com/linkle69/mineflayer-auto-eat
- **Update-Plan:** [docs/MINEFLAYER_UPDATE_PLAN.md](./MINEFLAYER_UPDATE_PLAN.md)

---

**Update durchgeführt von:** Claude Code
**Branch:** `update/auto-eat-5.0.3`
**Commit:** TBD (nach Testing)
