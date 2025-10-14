# Prompt System Architecture

Visual overview of the prompt management system.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST                             │
│           "Dudu, bau ein vollhaus"                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   AGENT.JS                                  │
│  - Receives message                                         │
│  - Checks for commands in response                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 PROMPTER.JS                                 │
│  - Loads profile (dudu.json)                                │
│  - Replaces placeholders:                                   │
│    • $NAME → "Dudu"                                         │
│    • $COMMAND_DOCS → getCommandDocs()                       │
│    • $EXAMPLES → Select relevant examples                   │
│    • $STATS, $INVENTORY, etc.                               │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌─────────────────┐     ┌─────────────────────────┐
│ SYSTEM PROMPTS  │     │   COMMAND DOCS          │
│ (Optional)      │     │   (Auto-generated)      │
│                 │     │                         │
│ system_prompts.js    │   commands/index.js     │
│ - SYSTEM_PROMPT │     │   - getCommandDocs()    │
│ - EXAMPLES      │     │   + Format Reminder     │
└─────────────────┘     └─────────────────────────┘
        │                         │
        └────────────┬────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 FINAL PROMPT                                │
│                                                             │
│  System: You are Dudu... [personality]                      │
│          $COMMAND_DOCS [all commands with format rules]     │
│          $EXAMPLES [relevant conversation examples]         │
│                                                             │
│  User: Cricetus79: dudu baue ein vollhaus                  │
│                                                             │
│  History: [recent conversation]                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     LLM (Qwen3-8B)                          │
│  - Sees: System prompt with commands                        │
│  - Sees: Examples showing !build("vollhaus")                │
│  - Sees: Format rules                                       │
│  - Generates: "Gerne! !build(\"vollhaus\")"                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                COMMAND PARSER                               │
│  commands/index.js → parseCommandMessage()                  │
│                                                             │
│  Input: "Gerne! !build(\"vollhaus\")"                      │
│  Regex: /!(\w+)(?:\(((?:-?\d+|"[^"]*")(?:\s*,\s*)?)*)\))?/│
│  Match: !build("vollhaus")                                  │
│  Parse: { commandName: '!build', args: ['vollhaus'] }      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              COMMAND EXECUTION                              │
│  commands/index.js → executeCommand()                       │
│                                                             │
│  1. Validate args: 1 arg provided, 1 required ✅            │
│  2. Get command: commandMap['!build']                       │
│  3. Execute: command.perform(agent, "vollhaus")             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               BUILDING MANAGER                              │
│  agent/building_manager.js                                  │
│                                                             │
│  1. Load schematic: vollhaus.schem                          │
│  2. Calculate position: near player                         │
│  3. Build layer by layer                                    │
│  4. Return: "Build completed! 144 blocks placed"            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 RESPONSE TO USER                            │
│  "Fertig! Dein Vollhaus steht! 🏠"                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow: Command Documentation

```
┌──────────────────────────────────────────────────────────┐
│            COMMAND DEFINITIONS                           │
│                                                          │
│  src/agent/commands/                                     │
│  ├── actions.js                                          │
│  │   └── BUILDING_ACTIONS = [                           │
│  │       { name: '!build',                              │
│  │         description: 'Build structure...',           │
│  │         params: { 'name': {...} },                   │
│  │         perform: async (agent, name) => {...}        │
│  │       }                                               │
│  │   ]                                                   │
│  │                                                       │
│  └── queries.js                                          │
│      └── QUERY_ACTIONS = [...]                          │
│                                                          │
│  Combined into:                                          │
│  commandList = queries + actions                         │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│        COMMAND DOCS GENERATOR                            │
│                                                          │
│  src/agent/commands/index.js                             │
│  export function getCommandDocs(agent) {                 │
│                                                          │
│    1. Add format reminder header                        │
│    2. Loop through commandList:                          │
│       for (let command of commandList) {                 │
│         docs += command.name + ': '                      │
│         docs += command.description + '\n'               │
│         for (let param in command.params) {              │
│           docs += `  ${param}: (${type}) ${desc}\n`     │
│         }                                                │
│       }                                                   │
│    3. Return complete docs string                        │
│  }                                                        │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│          PLACEHOLDER REPLACEMENT                         │
│                                                          │
│  src/ai/prompter.js → replaceStrings()                   │
│                                                          │
│  if (prompt.includes('$COMMAND_DOCS'))                   │
│      prompt = prompt.replaceAll(                         │
│          '$COMMAND_DOCS',                                │
│          getCommandDocs(this.agent)  ← CALL HERE         │
│      );                                                  │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│              FINAL PROMPT TO LLM                         │
│                                                          │
│  *COMMAND DOCS - Available Actions 🤖                    │
│                                                          │
│  ⚠️ CRITICAL: COMMAND FORMAT                            │
│  Commands MUST use parentheses and quotes:               │
│  ✅ CORRECT: !build("vollhaus")                         │
│  ❌ WRONG: !build vollhaus                              │
│                                                          │
│  📋 AVAILABLE COMMANDS:                                  │
│                                                          │
│  !build: Build structure from schematic...               │
│  Params:                                                 │
│    name: (string) Schematic name                        │
│                                                          │
│  !buildAt: Build at specific coordinates...              │
│  Params:                                                 │
│    name: (string) Schematic name                        │
│    x: (number) X coordinate                             │
│    y: (number) Y coordinate                             │
│    z: (number) Z coordinate                             │
│                                                          │
│  !smartCraft: Crafts items with auto-gathering...       │
│  Params:                                                 │
│    item: (string) Item name                             │
│    count: (number) Amount                               │
│                                                          │
│  ... [all other commands]                               │
│  *                                                       │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 Example Selection Flow

```
┌──────────────────────────────────────────────────────────┐
│              CONVERSATION EXAMPLES                       │
│                                                          │
│  Option 1: Central Definition (NEW)                     │
│  src/prompts/system_prompts.js                           │
│  export const CONVERSATION_EXAMPLES = [...]              │
│                                                          │
│  Option 2: Profile Override (Current)                   │
│  dudu.json → "conversation_examples": [...]              │
│  profiles/defaults/_default.json → same                 │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│             EXAMPLES LOADER                              │
│                                                          │
│  src/ai/prompter.js → initExamples()                     │
│                                                          │
│  this.convo_examples = new Examples(...)                 │
│  await this.convo_examples.load(                         │
│      this.profile.conversation_examples                  │
│  )                                                        │
│                                                          │
│  Stores: All examples with embeddings                    │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│           EXAMPLE SELECTION                              │
│                                                          │
│  src/utils/examples.js                                   │
│                                                          │
│  1. User message: "build a house"                        │
│  2. Create embedding of message                          │
│  3. Find most similar examples (cosine similarity)       │
│  4. Return top N examples (default: 2)                   │
│                                                          │
│  Selected:                                               │
│  - Example: "can you build me a house?"                  │
│  - Example: "build me something cool"                    │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│          INJECT INTO PROMPT                              │
│                                                          │
│  src/ai/prompter.js → replaceStrings()                   │
│                                                          │
│  if (prompt.includes('$EXAMPLES'))                       │
│      prompt = prompt.replaceAll(                         │
│          '$EXAMPLES',                                    │
│          await examples.createExampleMessage(messages)   │
│      );                                                  │
│                                                          │
│  Result in prompt:                                       │
│  "Example: alice: can you build me a house?              │
│   Response: Absolutely! !build(\"mischhaus\")           │
│   ..."                                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Profile Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│              PROFILE LOADING ORDER                       │
│                                                          │
│  Priority: Individual > Base > Default                   │
└──────────────────────────────────────────────────────────┘

Step 1: Load Defaults
┌──────────────────────────────────────────────────────────┐
│  profiles/defaults/_default.json                         │
│  {                                                       │
│    "cooldown": 3000,                                     │
│    "conversing": "You are $NAME...",                     │
│    "conversation_examples": [...],                       │
│    "modes": {...}                                        │
│  }                                                       │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
Step 2: Load Base Profile (depends on settings.base_profile)
┌──────────────────────────────────────────────────────────┐
│  profiles/defaults/survival.json                         │
│  OR creative.json                                        │
│  OR assistant.json                                       │
│  OR god_mode.json                                        │
│                                                          │
│  { "modes": { "cheat": true, ... } }                     │
│                                                          │
│  → Overrides defaults where specified                    │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
Step 3: Load Individual Profile
┌──────────────────────────────────────────────────────────┐
│  dudu.json                                               │
│  {                                                       │
│    "name": "Dudu",                                       │
│    "model": "lmstudio/qwen/qwen3-8b",                    │
│    "conversation_examples": [...]  ← Can override        │
│  }                                                       │
│                                                          │
│  → Overrides base and defaults                           │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│              FINAL MERGED PROFILE                        │
│                                                          │
│  Used by Prompter.js to generate prompts                 │
└──────────────────────────────────────────────────────────┘

Code in prompter.js:
─────────────────────
// Fill missing values from base to individual
for (let key in base_profile) {
    if (this.profile[key] === undefined)
        this.profile[key] = base_profile[key];
}
// Individual overrides base, base overrides default
```

---

## 🔧 Command Parsing Regex

```
Pattern:
/!(\w+)(?:\(((?:-?\d+(?:\.\d+)?|true|false|"[^"]*")(?:\s*,\s*(?:-?\d+(?:\.\d+)?|true|false|"[^"]*"))*)\))?/

Breakdown:
─────────

!(\w+)           → Command name (capture group 1)
  !              → Literal exclamation mark
  (\w+)          → One or more word characters (a-z, A-Z, 0-9, _)
                   Examples: build, smartCraft, goToPlayer

(?:...)?         → Optional group for arguments

\(               → Literal opening parenthesis

(?:...)*         → Argument pattern (repeating)

-?\d+(?:\.\d+)?  → Number (int or float)
  -?             → Optional minus sign
  \d+            → One or more digits
  (?:\.\d+)?     → Optional decimal part

true|false       → Boolean literals

"[^"]*"          → String in double quotes
  "              → Opening quote
  [^"]*          → Any characters except quote
  "              → Closing quote

\s*,\s*          → Comma separator with optional whitespace

\)               → Literal closing parenthesis


Examples:
─────────

✅ !build("vollhaus")
   → Group 1: "build"
   → Group 2: "\"vollhaus\""
   → Args: ["vollhaus"]

✅ !buildAt("platte", 100, 70, 200)
   → Group 1: "buildAt"
   → Group 2: "\"platte\", 100, 70, 200"
   → Args: ["platte", 100, 70, 200]

✅ !smartCraft("wooden_pickaxe", 1)
   → Group 1: "smartCraft"
   → Group 2: "\"wooden_pickaxe\", 1"
   → Args: ["wooden_pickaxe", 1]

✅ !buildlist
   → Group 1: "buildlist"
   → Group 2: undefined (no args)
   → Args: []

❌ !build vollhaus
   → NO MATCH (no parentheses)

❌ !build vollhaus 10 20 30
   → NO MATCH (space-separated, no quotes)
```

---

## 📚 Key Files Reference

```
src/
├── ai/
│   └── prompter.js              # Prompt generation & LLM calls
│                                # - replaceStrings()
│                                # - promptConvo()
│                                # - initExamples()
│
├── agent/
│   ├── agent.js                 # Main agent logic
│   │                            # - Message handling
│   │                            # - Command execution
│   │
│   ├── commands/
│   │   ├── index.js            # Command system core
│   │   │                        # - parseCommandMessage()
│   │   │                        # - executeCommand()
│   │   │                        # - getCommandDocs()
│   │   │
│   │   ├── actions.js          # All action commands
│   │   │                        # - !build, !smartCraft, etc.
│   │   │
│   │   └── queries.js          # All query commands
│   │                            # - !inventory, !stats, etc.
│   │
│   └── building_manager.js      # Building system
│                                # - buildStructure()
│                                # - placeBlock()
│
├── prompts/                     # NEW: Central prompt management
│   ├── system_prompts.js       # All prompt definitions
│   │                            # - SYSTEM_PROMPT
│   │                            # - CONVERSATION_EXAMPLES
│   │
│   ├── README.md               # Prompt management guide
│   │
│   └── ARCHITECTURE.md         # This file
│
└── utils/
    └── examples.js              # Example selection
                                 # - Similarity search
                                 # - Embedding generation

profiles/
├── defaults/
│   ├── _default.json           # Base configuration
│   ├── survival.json           # Survival mode
│   ├── creative.json           # Creative mode
│   └── assistant.json          # Assistant mode
│
└── dudu.json                    # Individual bot profile
```

---

**Created:** 2025-10-13
**Author:** Claude Code
**Version:** 1.0
