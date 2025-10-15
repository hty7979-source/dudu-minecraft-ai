# Build State Persistence

## Übersicht

Das Build-System unterstützt jetzt **automatisches Speichern und Laden** des Build-States. Dies ermöglicht:

- ✅ **Pausieren und Fortsetzen** von Builds
- ✅ **Überstehen von Server-Restarts** - Builds werden nach Neustart automatisch geladen
- ✅ **Fehlerbehandlung** - Bei Problemen wird der Fortschritt nicht verloren
- ✅ **Material-Management** - Der Bot merkt sich, welche Materialien bereits beschafft wurden

## Implementierung

### Speicherort

Build-States werden gespeichert in:
```
./bots/{botname}/build_state.json
```

Beispiel für Bot "Dudu":
```
./bots/Dudu/build_state.json
```

### JSON-Schema

```json
{
  "schematicName": "simple-home",
  "position": {
    "x": 100,
    "y": 64,
    "z": 200
  },
  "totalBlocks": 450,
  "currentLayer": 67,
  "placedBlocks": [
    "100,64,200",
    "101,64,200",
    "102,64,200"
  ],
  "status": "paused",
  "startTime": 1697472000000,
  "lastUpdate": 1697472300000,
  "pauseReason": "waiting_for_help"
}
```

### Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `schematicName` | String | Name des Schematics (z.B. "simple-home") |
| `position` | Object | Welt-Position der Build-Basis `{x, y, z}` |
| `totalBlocks` | Number | Gesamtanzahl der zu bauenden Blöcke |
| `currentLayer` | Number | Y-Koordinate der aktuellen Schicht |
| `placedBlocks` | Array | Liste bereits platzierter Blöcke als "x,y,z" Strings |
| `status` | String | Status: `"building"`, `"paused"`, `"completed"` |
| `startTime` | Number | Unix-Timestamp des Build-Starts (ms) |
| `lastUpdate` | Number | Unix-Timestamp der letzten Speicherung (ms) |
| `pauseReason` | String | Grund für Pause (optional) |

### Pause-Gründe

| Grund | Beschreibung |
|-------|--------------|
| `waiting_for_help` | Bot benötigt Hilfe beim Materialbeschaffen |
| `low_health` | Bot hat niedrige Gesundheit (<6 HP) |
| `material_gathering_failed` | Materialien konnten nicht beschafft werden |
| `too_many_errors` | Zu viele Fehler beim Platzieren (>30) |
| `combat` | Bot wurde angegriffen |
| `death` | Bot ist gestorben |
| `error` | Allgemeiner Fehler |

## API-Funktionen

### SurvivalBuildCoordinator

#### `saveBuildState()`
Speichert den aktuellen Build-State in eine JSON-Datei.

```javascript
this.survivalCoordinator.saveBuildState();
```

- Wird **automatisch** alle 10 Blöcke aufgerufen
- Wird bei **Pausierung** aufgerufen
- Konvertiert `Set<string>` zu `Array<string>` für JSON

#### `loadBuildState()`
Lädt den Build-State aus der JSON-Datei.

```javascript
const success = this.survivalCoordinator.loadBuildState();
```

- Wird **automatisch** beim Bot-Start aufgerufen
- Konvertiert `Array<string>` zurück zu `Set<string>`
- Gibt `true` zurück bei Erfolg, `false` bei Fehler

#### `deleteBuildState()`
Löscht die Build-State-Datei und setzt `buildState = null`.

```javascript
this.survivalCoordinator.deleteBuildState();
```

- Wird **automatisch** bei erfolgreichem Build-Abschluss aufgerufen
- Wird bei `!buildcancel` aufgerufen

#### `pauseBuild(reason)`
Pausiert den Build und speichert den State.

```javascript
this.survivalCoordinator.pauseBuild('low_health');
```

#### `resumeBuild()`
Setzt den Build fort (setzt Status auf `"building"`).

```javascript
this.survivalCoordinator.resumeBuild();
```

## Verwendung

### Automatisches Laden beim Start

Beim Initialisieren des `BuildingManager` wird automatisch versucht, einen gespeicherten Build-State zu laden:

```javascript
initializeComponents() {
  // ... andere Initialisierungen ...

  // Try to load saved build state from previous session
  this.survivalCoordinator.loadBuildState();
}
```

### Automatisches Speichern während des Baus

Der Build-State wird automatisch gespeichert:
- **Alle 10 Blöcke** während des Bauens
- **Bei Pausierung** (z.B. bei niedrigem Health)
- **Bei Fehlern** (z.B. zu viele Platzierungsfehler)

### Build Fortsetzen nach Pause/Restart

Der Spieler kann mit `!buildresume` den Build fortsetzen:

```javascript
async resumeBuild() {
  // Try to load build state if not already in memory
  if (!this.survivalCoordinator.buildState) {
    this.survivalCoordinator.loadBuildState();
  }

  // ... continue building from saved state ...
}
```

### Build Abbrechen

Mit `!buildcancel` wird der Build abgebrochen und die State-Datei gelöscht:

```javascript
cancelBuild() {
  if (this.survivalCoordinator.buildState) {
    this.survivalCoordinator.deleteBuildState();
  }
}
```

## Beispiel-Workflow

### 1. Build Starten
```
Spieler: !build simple-home
Bot: 🏗️ Starte Survival-Bau: simple-home
Bot: 📐 Schicht 1/5 (Y=64, 90 Blöcke)
Bot: [Bot platziert Blöcke...]
```

**State wird automatisch alle 10 Blöcke gespeichert:**
```
💾 Build state saved: 10/450 blocks placed
✅ Build state saved to ./bots/Dudu/build_state.json
```

### 2. Build wird pausiert (z.B. niedriges Health)
```
Bot: ⚠️ Niedrige Gesundheit! Bau pausiert. Nutze !buildresume zum Fortsetzen.
⏸️ Build paused: low_health
💾 Build state saved: 30/450 blocks placed
```

**build_state.json:**
```json
{
  "status": "paused",
  "pauseReason": "low_health",
  "placedBlocks": [...30 blocks...],
  "currentLayer": 64
}
```

### 3. Server Restart

Bot startet neu und lädt automatisch:
```
✅ Build state loaded: 30/450 blocks (7%) - Layer 64
```

### 4. Build Fortsetzen
```
Spieler: !buildresume
Bot: ▶️ Setze Bau fort: simple-home
Bot: 📊 Fortschritt: 30/450 Blöcke (7%) | Layer 64
Bot: 🔄 Fortsetzen ab Schicht 1/5
```

### 5. Build Abschluss
```
Bot: ✅ Bau abgeschlossen! 450 Blöcke in 120.5s (98%)
🗑️ Build state file deleted: ./bots/Dudu/build_state.json
```

## Vorteile

### ✅ Robustheit
- **Kein Fortschrittsverlust** bei Crashes oder Restarts
- **Fortsetzung möglich** nach Unterbrechungen
- **Fehlerresistenz** durch regelmäßiges Speichern

### ✅ Effizienz
- **Duplicate-Prevention** - Bereits platzierte Blöcke werden nicht erneut gebaut
- **Material-Tracking** - Bot merkt sich bereits beschaffte Materialien
- **Layer-Tracking** - Bot weiß genau, welche Schicht als nächstes kommt

### ✅ Benutzerfreundlichkeit
- **Automatisches Laden** beim Start
- **Einfache Resume-Funktion** (`!buildresume`)
- **Klare Status-Informationen** (`!buildstatus`)

## Technische Details

### Set vs. Array für placedBlocks

**Im Speicher (Runtime):**
```javascript
buildState.placedBlocks = new Set(['100,64,200', '101,64,200']);
// Schnelles Lookup: O(1)
```

**Auf Disk (JSON):**
```json
"placedBlocks": ["100,64,200", "101,64,200"]
// Serialisierbar
```

**Konvertierung:**
```javascript
// Save: Set → Array
const serializable = {
  ...this.buildState,
  placedBlocks: Array.from(this.buildState.placedBlocks)
};

// Load: Array → Set
loaded.placedBlocks = new Set(loaded.placedBlocks);
```

### Platzierungs-Check

Beim Fortsetzen wird jeder Block vor dem Platzieren geprüft:

```javascript
const key = `${blockInfo.pos.x},${blockInfo.pos.y},${blockInfo.pos.z}`;

if (state.placedBlocks.has(key)) {
  continue; // Skip already placed blocks
}
```

## Bekannte Limitationen

- ⚠️ **Nur ein Build** pro Bot gleichzeitig
- ⚠️ **Keine Backup-History** - nur der aktuelle State wird gespeichert
- ⚠️ **Keine Versionierung** - Schema-Updates könnten alte States unlesbar machen

## Zukünftige Erweiterungen

### Mögliche Verbesserungen:
- 📦 **Backup-System** - Mehrere States speichern
- 📊 **Build-Historie** - Vergangene Builds tracken
- 🔄 **Schema-Migration** - Automatische Konvertierung alter States
- 📈 **Statistiken** - Build-Performance-Tracking
- 🔐 **Verschlüsselung** - Sensitive Daten schützen

## Zusammenfassung

Die Build-State-Persistenz ist vollständig implementiert und funktioniert automatisch:

✅ Speichert alle 10 Blöcke
✅ Lädt automatisch beim Start
✅ Unterstützt Pause/Resume
✅ Löscht State nach Abschluss
✅ Robust gegen Crashes/Restarts

**Die Implementierung ist produktionsbereit!** 🎉
