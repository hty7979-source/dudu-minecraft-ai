# Prompt Management System

Zentrale Verwaltung aller System-Prompts, Examples und Command-Dokumentation.

## 📁 Struktur

```
src/prompts/
├── system_prompts.js    # Zentrale Prompt-Definitionen
└── README.md            # Diese Datei

src/agent/commands/
└── index.js             # getCommandDocs() - Automatische Command-Liste
```

## 🎯 Problem das gelöst wird

**VORHER:** Prompts waren verteilt über mehrere Dateien:
- ❌ System Prompt in `profiles/defaults/_default.json`
- ❌ Examples auch dort
- ❌ Command Docs in `src/agent/commands/index.js`
- ❌ Individuelle Overrides in `dudu.json`, `andy.json`, etc.
- ❌ **Keine Synchronisation** zwischen Examples und verfügbaren Commands

**NACHHER:** Alles zentral in `system_prompts.js`:
- ✅ Ein zentraler Ort für alle Prompts
- ✅ Examples zeigen korrekte Command-Verwendung
- ✅ Command Docs sind automatisch synchronisiert
- ✅ Format-Reminder überall konsistent

## 📝 Verwendung

### 1. System Prompts bearbeiten

Alle Prompts sind in `system_prompts.js` definiert:

```javascript
import {
    SYSTEM_PROMPT,           // Haupt-System-Prompt
    CODING_PROMPT,           // Coding-Prompt (deaktiviert)
    MEMORY_SAVING_PROMPT,    // Memory-Speicher-Prompt
    BOT_RESPONDER_PROMPT,    // Bot-Response-Entscheidung
    IMAGE_ANALYSIS_PROMPT,   // Bild-Analyse
    CONVERSATION_EXAMPLES    // Conversation Examples
} from './prompts/system_prompts.js';
```

### 2. Examples hinzufügen

Neue Examples in `CONVERSATION_EXAMPLES` Array:

```javascript
// Beispiel für neuen Command
[
    {"role": "user", "content": "player: mach X"},
    {"role": "assistant", "content": "Klar! !commandName(\"arg1\", 123)"},
    {"role": "system", "content": "Command result..."},
    {"role": "assistant", "content": "Fertig! Das hat geklappt!"}
]
```

**Wichtig:** Examples müssen **exakt** das richtige Command-Format zeigen:
- ✅ `!build("vollhaus")` - mit Klammern und Quotes
- ❌ `!build vollhaus` - FALSCH, LLM lernt falsches Format

### 3. Command Format

Commands müssen dieses Format haben:

```javascript
// Strings mit double quotes
!build("vollhaus")
!smartCraft("wooden_pickaxe", 1)

// Numbers ohne quotes
!buildAt("platte", 100, 70, 200)
!smartCollect("iron_ingot:10")

// Booleans
!setMode("hunting", true)

// Keine Args = keine Klammern
!buildlist
!inventory
```

### 4. Neue Commands zur Dokumentation hinzufügen

Commands werden **automatisch** zur Dokumentation hinzugefügt, wenn sie in `src/agent/commands/actions.js` oder `queries.js` definiert sind.

Die Funktion `getCommandDocs()` in `src/agent/commands/index.js` generiert automatisch:
1. Command-Name
2. Description
3. Parameter mit Types

**Kein manuelles Pflegen nötig!** ✅

## 🔄 Workflow: Neuen Command hinzufügen

### Schritt 1: Command definieren

In `src/agent/commands/actions.js`:

```javascript
{
    name: '!myNewCommand',
    description: 'Does something awesome',
    params: {
        'item': { type: 'string', description: 'Item name' },
        'count': { type: 'int', description: 'How many' }
    },
    perform: runAsAction(async function(agent, item, count) {
        // Implementation
    }, false, -1)
}
```

### Schritt 2: Example hinzufügen

In `src/prompts/system_prompts.js` → `CONVERSATION_EXAMPLES`:

```javascript
[
    {"role": "user", "content": "player: do the new thing with 10 diamonds"},
    {"role": "assistant", "content": "Sure! !myNewCommand(\"diamond\", 10)"},
    {"role": "system", "content": "Success!"},
    {"role": "assistant", "content": "Done! That worked perfectly!"}
]
```

### Schritt 3: Fertig!

- ✅ Command ist automatisch in `$COMMAND_DOCS` verfügbar
- ✅ Example zeigt LLM wie es verwendet wird
- ✅ Format-Reminder ist eingebaut
- ✅ Keine weitere Konfiguration nötig

## 🎨 Profile System

Profile können Prompts überschreiben:

```
profiles/
├── defaults/
│   ├── _default.json      # Base für alle Profiles
│   ├── survival.json      # Survival-Mode Overrides
│   ├── creative.json      # Creative-Mode Overrides
│   └── assistant.json     # Assistant-Mode Overrides
├── dudu.json              # Individuelles Bot-Profil
└── andy.json              # Anderes Bot-Profil
```

**Hierarchie:**
1. `_default.json` - Base values
2. `survival.json` / `creative.json` / etc. - Mode-spezifisch
3. `dudu.json` - Individuell (hat höchste Priorität)

## 📊 Placeholder-System

Prompts können Platzhalter verwenden, die automatisch ersetzt werden:

```javascript
$NAME              → Bot name (e.g., "Dudu")
$MEMORY            → Summarized conversation memory
$STATS             → Current bot stats (health, position, etc.)
$INVENTORY         → Current inventory contents
$COMMAND_DOCS      → Auto-generated command documentation
$EXAMPLES          → Relevant conversation examples
$ACTION            → Current action being performed
$CONVO             → Recent conversation history
$TO_SUMMARIZE      → Messages to summarize for memory
$SELF_PROMPT       → Current self-prompt goal
$LAST_GOALS        → Recently completed/failed goals
$BLUEPRINTS        → Available construction blueprints
```

Siehe `src/ai/prompter.js` → `replaceStrings()` für vollständige Liste.

## ⚠️ Häufige Fehler vermeiden

### ❌ FALSCH: Command Format inkonsistent

```javascript
// In Example:
"!build vollhaus"  // ❌ Keine Klammern/Quotes

// LLM lernt:
"!build vollhaus"  // ❌ Funktioniert nicht!
```

### ✅ RICHTIG: Konsistentes Format

```javascript
// In Example:
"!build(\"vollhaus\")"  // ✅ Korrekt

// LLM lernt:
"!build(\"vollhaus\")"  // ✅ Funktioniert!
```

### ❌ FALSCH: Example ohne System-Response

```javascript
[
    {"role": "user", "content": "build a house"},
    {"role": "assistant", "content": "!build(\"vollhaus\")"}
    // ❌ Kein System-Feedback!
]
```

### ✅ RICHTIG: Vollständiger Dialog

```javascript
[
    {"role": "user", "content": "build a house"},
    {"role": "assistant", "content": "Sure! !build(\"vollhaus\")"},
    {"role": "system", "content": "Build completed!"},
    {"role": "assistant", "content": "Done! Your house is ready! 🏠"}
]
```

## 🧪 Testing

Nach Änderungen an Prompts oder Examples:

1. **Server neu starten** - Prompts werden beim Start geladen
2. **Test-Szenarien durchgehen:**
   - Einfacher Build: "bau ein vollhaus"
   - Mit Coords: "bau bei 100 70 200"
   - Crafting: "craft mir 10 sticks"
   - Collection: "sammle 20 cobblestone"
3. **Console checken:**
   - Werden Commands erkannt? → `Agent executed: !build`
   - Richtiges Format? → `parsed command: { commandName: '!build', args: ['vollhaus'] }`
   - Fehler? → `Command !build was given X args, but requires Y args`

## 📚 Weitere Ressourcen

- **Command Parser:** `src/agent/commands/index.js` - Regex und Parsing-Logik
- **Prompter:** `src/ai/prompter.js` - Prompt-Ersetzung und LLM-Calls
- **Actions:** `src/agent/commands/actions.js` - Alle Action-Commands
- **Queries:** `src/agent/commands/queries.js` - Alle Query-Commands

## 🔧 Debugging

### Problem: LLM sendet keine Commands

**Check:**
1. Sind Examples im Profil? → `conversation_examples` in JSON
2. Zeigen Examples Commands? → Must have `!commandName(...)`
3. Server neu gestartet? → Examples werden beim Start geladen

### Problem: Command Format falsch

**Check:**
1. Examples zeigen korrektes Format? → Mit Klammern und Quotes
2. Format-Reminder in Docs? → `getCommandDocs()` hat Reminder
3. LLM sieht die Docs? → `$COMMAND_DOCS` im System Prompt

### Problem: Command nicht gefunden

**Check:**
1. Command in `actions.js` oder `queries.js`? → Muss in `commandList` sein
2. Command geblockt? → `agent.blocked_actions` checken
3. Name richtig? → Case-sensitive, muss mit `!` starten

## 📝 Best Practices

1. **Examples immer aktuell halten** - Neue Commands → neue Examples
2. **Format konsistent** - Immer mit Klammern und Quotes
3. **System-Responses zeigen** - LLM lernt von vollständigen Dialogen
4. **Mehrsprachig** - Examples auf Deutsch und Englisch
5. **Edge Cases abdecken** - Fehler-Szenarien in Examples zeigen
6. **Kurz und prägnant** - LLM hat begrenzten Context
7. **Testing nach Änderungen** - Immer testen bevor deployen

## 🎯 Checkliste: Neuer Command

- [ ] Command in `actions.js` oder `queries.js` definiert
- [ ] Description klar und präzise
- [ ] Params korrekt typisiert
- [ ] Implementation funktioniert
- [ ] Example in `system_prompts.js` hinzugefügt
- [ ] Example zeigt korrektes Format
- [ ] System-Response im Example
- [ ] Testing durchgeführt
- [ ] Dokumentation aktualisiert

---

**Maintainer:** Claude Code
**Letzte Änderung:** 2025-10-13
**Version:** 1.0
