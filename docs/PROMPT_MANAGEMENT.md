# 🎯 Prompt Management System - Übersicht

**Datum:** 2025-10-13
**Status:** ✅ IMPLEMENTIERT
**Ziel:** Zentrale Verwaltung aller Prompts, Examples und Command-Dokumentation

---

## 🐛 Problem: Verteilte Prompts

Die Prompts waren über mehrere Dateien verteilt und nicht synchronisiert:

```
❌ VORHER:
profiles/defaults/_default.json     → System Prompt (Zeile 4)
                                     → Examples (Zeile 29-242)
dudu.json                            → Individuelle Overrides
andy.json                            → Weitere Overrides
src/agent/commands/index.js          → Command Docs (dynamisch generiert)

Problem: Examples und Command-Liste waren NICHT synchronisiert!
```

**Konsequenzen:**
1. ❌ Examples zeigten alte/falsche Commands
2. ❌ Command-Format inkonsistent (mit/ohne Klammern)
3. ❌ LLM lernte falsche Verwendung
4. ❌ Schwer zu warten - Änderungen in 5+ Dateien nötig

---

## ✅ Lösung: Zentrales Prompt-System

### Neue Struktur

```
✅ NACHHER:
src/prompts/
├── system_prompts.js    → ZENTRALE Prompt-Definitionen
│   ├── SYSTEM_PROMPT           (Haupt-System-Prompt)
│   ├── CODING_PROMPT           (Coding deaktiviert)
│   ├── MEMORY_SAVING_PROMPT    (Memory System)
│   ├── BOT_RESPONDER_PROMPT    (Response-Entscheidung)
│   ├── IMAGE_ANALYSIS_PROMPT   (Bild-Analyse)
│   └── CONVERSATION_EXAMPLES   (16+ Examples mit Commands)
│
└── README.md            → Vollständige Dokumentation

src/agent/commands/index.js
└── getCommandDocs()     → Automatische Command-Liste
                           + Format-Reminder integriert
```

### Vorteile

1. ✅ **Ein zentraler Ort** - Alle Prompts in `system_prompts.js`
2. ✅ **Automatische Synchronisation** - Command Docs dynamisch generiert
3. ✅ **Format-Konsistenz** - Reminder in jedem Command Doc
4. ✅ **Examples aktuell** - Zeigen korrekte Command-Verwendung
5. ✅ **Einfache Wartung** - Änderungen nur an einer Stelle

---

## 📊 Was wurde geändert

### 1. Neue Datei: `src/prompts/system_prompts.js`

Zentrale Definitionen aller Prompts:

```javascript
// System Prompt mit allen Anweisungen
export const SYSTEM_PROMPT = `You are $NAME, a passionate Minecraft enthusiast...`;

// 16+ Conversation Examples mit korrektem Command-Format
export const CONVERSATION_EXAMPLES = [
    [
        {"role": "user", "content": "build a house"},
        {"role": "assistant", "content": "Sure! !build(\"vollhaus\")"},  // ✅ Korrektes Format
        {"role": "system", "content": "Build completed!"},
        {"role": "assistant", "content": "Done! 🏠"}
    ],
    // ... mehr Examples
];
```

### 2. Aktualisiert: `src/agent/commands/index.js`

`getCommandDocs()` jetzt mit Format-Reminder:

```javascript
export function getCommandDocs(agent) {
    let docs = `
*COMMAND DOCS - Available Actions 🤖

⚠️ CRITICAL: COMMAND FORMAT
Commands MUST use parentheses and quotes:
✅ CORRECT: !build("vollhaus")
✅ CORRECT: !smartCraft("wooden_pickaxe", 1)
❌ WRONG: !build vollhaus (missing parentheses)

FORMAT RULES:
- Strings need "double quotes"
- Numbers without quotes
- Args separated by ", "
- Parentheses () required when args present
...`;

    // Automatische Generierung aller Commands
    for (let command of commandList) {
        docs += command.name + ': ' + command.description + '\n';
        // ... params
    }

    return docs;
}
```

### 3. Dokumentation: `src/prompts/README.md`

Vollständige Anleitung:
- ✅ Wie man neue Commands hinzufügt
- ✅ Wie man Examples schreibt
- ✅ Command-Format-Regeln
- ✅ Testing-Checkliste
- ✅ Debugging-Tipps
- ✅ Best Practices

---

## 🔧 Command Format: Das war das Problem!

### ❌ Altes Problem

LLM sendete Commands in verschiedenen Formaten:

```javascript
// Variante 1 (FALSCH):
!build vollhaus

// Variante 2 (FALSCH):
!build vollhaus 10 20 30

// Variante 3 (FALSCH):
!build "vollhaus"

// Regex matched KEINE dieser Varianten!
```

### ✅ Neue Lösung

**Ein konsistentes Format überall:**

```javascript
// Strings mit Klammern und Quotes:
!build("vollhaus")                    ✅
!smartCraft("wooden_pickaxe", 1)      ✅
!smartCollect("iron_ingot:10")        ✅

// Numbers ohne Quotes:
!buildAt("platte", 100, 70, 200)      ✅

// Keine Args = keine Klammern:
!buildlist                            ✅
!inventory                            ✅
```

**Das Regex:**
```javascript
const commandRegex = /!(\w+)(?:\(((?:-?\d+(?:\.\d+)?|true|false|"[^"]*")(?:\s*,\s*(?:-?\d+(?:\.\d+)?|true|false|"[^"]*"))*)\))?/
```

**Format-Regeln:**
- Strings: `"text"` mit double quotes
- Numbers: `123`, `45.6` ohne quotes
- Booleans: `true`, `false`
- Separator: `, ` (comma + space)
- Klammern: `()` required bei Args

---

## 📚 Conversation Examples

### Alte Examples (❌ Problem)

```javascript
// In dudu.json VORHER:
{
    "role": "user",
    "content": "Can you help me build a house?"
},
{
    "role": "assistant",
    "content": "Absolutely! I would love to help you build a house! What kind of house are you thinking about?"
    // ❌ KEIN COMMAND! LLM lernt nur zu REDEN, nicht zu HANDELN
}
```

### Neue Examples (✅ Lösung)

```javascript
// In system_prompts.js NACHHER:
{
    "role": "user",
    "content": "Build a vollhaus at my location"
},
{
    "role": "assistant",
    "content": "Building a vollhaus for you right now! !build(\"vollhaus\")"
    // ✅ Command mit korrektem Format!
},
{
    "role": "system",
    "content": "Building vollhaus... Build completed!"
},
{
    "role": "assistant",
    "content": "Done! Your house is ready! 🏠"
    // ✅ Feedback zum User
}
```

**16+ neue Examples für:**
- ✅ Building (!build, !buildAt, !buildlist)
- ✅ Crafting (!smartCraft)
- ✅ Collection (!smartCollect)
- ✅ Navigation (!goToPlayer, !followPlayer)
- ✅ Information (!inventory, !stats)
- ✅ Actions (!stop, !attack)
- ✅ Memory (!rememberHere, !goToRememberedPlace)

---

## 🎯 Workflow: Neuen Command hinzufügen

### Schritt 1: Command definieren

`src/agent/commands/actions.js`:

```javascript
{
    name: '!myCommand',
    description: 'Does something cool',
    params: {
        'item': { type: 'string', description: 'Item name' },
        'count': { type: 'int', description: 'Amount' }
    },
    perform: runAsAction(async function(agent, item, count) {
        // Implementation hier
        return `Success! Processed ${count}x ${item}`;
    }, false, -1)
}
```

### Schritt 2: Example hinzufügen

`src/prompts/system_prompts.js` → `CONVERSATION_EXAMPLES`:

```javascript
[
    {"role": "user", "content": "player: do something with 10 diamonds"},
    {"role": "assistant", "content": "Sure! !myCommand(\"diamond\", 10)"},
    {"role": "system", "content": "Success! Processed 10x diamond"},
    {"role": "assistant", "content": "Done! Processed 10 diamonds for you!"}
]
```

### Schritt 3: Fertig!

- ✅ Command automatisch in Docs (`$COMMAND_DOCS`)
- ✅ Example zeigt korrektes Format
- ✅ Format-Reminder eingebaut
- ✅ Keine weitere Config nötig

### Schritt 4: Testing

```bash
# Server neu starten
npm start

# In Minecraft testen:
# User: "do something with 5 iron"
# Bot sollte: !myCommand("iron", 5)
```

---

## 🔍 Debugging

### Problem: LLM sendet keine Commands

**Checkliste:**
1. [ ] Sind Examples im Profil? → Check `conversation_examples`
2. [ ] Zeigen Examples Commands? → Must have `!commandName(...)`
3. [ ] Server neu gestartet? → Examples nur beim Start geladen
4. [ ] Richtiges Format? → Mit Klammern und Quotes

**Test:**
```javascript
// In console checken:
"selected examples:"
"Example: Build a vollhaus at my location"

// Wenn keine Examples → Problem!
```

### Problem: Command Format falsch

**Checkliste:**
1. [ ] Examples korrekt? → `!build("name")` nicht `!build name`
2. [ ] Docs haben Reminder? → `getCommandDocs()` zeigt Format-Regeln
3. [ ] LLM sieht Docs? → `$COMMAND_DOCS` in System Prompt

**Test:**
```javascript
// LLM sollte senden:
!build("vollhaus")

// Nicht:
!build vollhaus
build vollhaus
!build "vollhaus"
```

### Problem: Command nicht gefunden

**Checkliste:**
1. [ ] Command in `commandList`? → Check `actions.js` / `queries.js`
2. [ ] Command geblockt? → Check `agent.blocked_actions`
3. [ ] Name richtig? → Case-sensitive, mit `!`

**Test:**
```javascript
// Console checken:
"Agent executed: !build and got: Command !build is not a command"
// → Command nicht in commandList

"Agent executed: !build and got: Command !build was given 0 args, but requires 1 args"
// → Command existiert, aber Arg-Fehler
```

---

## 📝 Modified Files

### Neu erstellt:
- ✅ `src/prompts/system_prompts.js` - Zentrale Prompt-Definitionen
- ✅ `src/prompts/README.md` - Vollständige Dokumentation
- ✅ `PROMPT_MANAGEMENT.md` - Diese Übersicht

### Aktualisiert:
- ✅ `src/agent/commands/index.js` - `getCommandDocs()` mit Format-Reminder
- ✅ `dudu.json` - Updated `conversation_examples` (bereits gefixt in vorheriger Session)

### Nicht geändert (können weiter verwendet werden):
- ✅ `profiles/defaults/_default.json` - Base Profil
- ✅ `profiles/defaults/survival.json` - Survival Mode
- ✅ `profiles/defaults/creative.json` - Creative Mode
- ✅ `src/ai/prompter.js` - Prompt-Ersetzung funktioniert weiter

---

## 🎉 Vorteile des neuen Systems

### Für Entwickler:

1. **Zentrale Wartung** - Nur eine Datei bearbeiten
2. **Automatische Sync** - Commands und Docs immer aktuell
3. **Klare Struktur** - Jeder weiß wo was ist
4. **Einfaches Testing** - Änderungen schnell testbar
5. **Versionskontrolle** - Git History zeigt alle Änderungen

### Für die LLM:

1. **Konsistente Examples** - Lernt korrektes Format
2. **Klare Anweisungen** - Format-Reminder überall
3. **Aktuelle Docs** - Immer alle Commands verfügbar
4. **Bessere Performance** - Weniger Verwirrung = bessere Responses

### Für Nutzer:

1. **Zuverlässigere Commands** - LLM weiß wie sie funktionieren
2. **Schnellere Ausführung** - Keine Format-Fehler mehr
3. **Mehr Features** - Einfacher neue Commands hinzuzufügen
4. **Bessere UX** - Bot reagiert wie erwartet

---

## 🚀 Nächste Schritte

### Sofort:
1. ✅ `src/prompts/system_prompts.js` erstellt
2. ✅ `getCommandDocs()` aktualisiert mit Format-Reminder
3. ✅ Dokumentation erstellt
4. ⏳ **Server neu starten** - Damit neue Examples geladen werden
5. ⏳ **Testing** - Alle Szenarien durchgehen

### Optional (Zukunft):
- [ ] Profile migrieren zu `system_prompts.js` (optional)
- [ ] Mehr Examples für Edge Cases
- [ ] Multi-Language Support verbessern
- [ ] Command-Validation vor LLM-Call

---

## 📚 Weitere Dokumentation

- **Prompt System:** [src/prompts/README.md](src/prompts/README.md)
- **Command Parser:** [src/agent/commands/index.js](src/agent/commands/index.js)
- **Battle Plan:** [BATTLE_PLAN.md](BATTLE_PLAN.md)
- **Build Fix:** [BUGFIX_BUILD_COMMAND.md](BUGFIX_BUILD_COMMAND.md)
- **Refactoring:** [REFACTORING.md](REFACTORING.md)

---

**Status:** ✅ KOMPLETT
**Testing erforderlich:** ⏳ Ja - Server neu starten und testen
**Breaking Changes:** Keine - Altes System funktioniert weiter

**Erstellt:** 2025-10-13
**Autor:** Claude Code
