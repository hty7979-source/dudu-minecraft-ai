# 🏗️ Dudu Minecraft AI - Architecture Documentation

## 📁 Project Structure

```
dudu-minecraft-ai/
├── src/
│   ├── agent/              # Core agent logic and behaviors
│   │   ├── commands/       # Command system (actions & queries)
│   │   ├── library/        # Reusable skill functions
│   │   ├── modes/          # Bot behavior modes (combat, etc.)
│   │   ├── npc/            # NPC controller and goals
│   │   ├── tasks/          # Task management system
│   │   ├── vision/         # Vision and camera systems
│   │   ├── agent.js        # Main agent class
│   │   ├── action_manager.js
│   │   ├── building_manager.js
│   │   ├── coder.js        # Dynamic code generation
│   │   ├── conversation.js # Multi-agent conversation
│   │   ├── history.js      # Message history
│   │   ├── memory_bank.js  # Persistent memory
│   │   └── self_prompter.js
│   │
│   ├── ai/                 # AI models and prompting (renamed from models/)
│   │   ├── _model_map.js   # Model provider mapping
│   │   ├── prompter.js     # Main prompting logic
│   │   ├── gpt.js          # OpenAI GPT models
│   │   ├── claude.js       # Anthropic Claude
│   │   ├── gemini.js       # Google Gemini
│   │   ├── ollama.js       # Local Ollama
│   │   ├── lmstudio.js     # LM Studio
│   │   └── ...             # Other AI providers
│   │
│   ├── config/             # Configuration constants
│   │   └── constants.js    # Centralized constants
│   │
│   ├── mindcraft/          # Server and UI
│   │   ├── mindcraft.js    # Main controller
│   │   ├── mindserver.js   # Web server
│   │   ├── mcserver.js     # Minecraft server bridge
│   │   └── public/         # Web UI assets
│   │
│   ├── process/            # Process management
│   │   ├── agent_process.js
│   │   └── init_agent.js
│   │
│   └── utils/              # Utility functions
│       ├── mcdata.js       # Minecraft data utilities
│       ├── text.js         # Text processing
│       ├── translator.js   # Language translation
│       ├── examples.js     # Example prompts
│       └── ...
│
├── profiles/               # AI agent profiles
│   ├── lmstudio.json       # LM Studio profile (default)
│   ├── gpt.json            # OpenAI GPT
│   └── ...
│
├── schematics/             # Building blueprints
├── bots/                   # Runtime bot data
├── debug/                  # Debug scripts (not in production)
├── main.js                 # Entry point
├── settings.js             # Main configuration
└── dudu.json               # Default Dudu profile
```

## 🎯 Core Components

### Agent System (`src/agent/`)

The heart of Dudu - manages bot behavior, decision-making, and actions.

**Key Classes:**
- **Agent** (`agent.js`) - Main agent orchestrator
  - Manages bot lifecycle (spawn, death, restart)
  - Handles message routing and conversation
  - Coordinates all subsystems

- **ActionManager** (`action_manager.js`) - Executes and manages actions
  - Action queuing and execution
  - Error handling and recovery
  - Action resume logic

- **History** (`history.js`) - Conversation memory
  - Message history management
  - Context window handling
  - Save/load functionality

- **Coder** (`coder.js`) - Dynamic code generation
  - Generates custom code from AI prompts
  - Code linting and validation
  - Sandboxed execution environment

- **BuildingManager** (`building_manager.js`) - Construction system
  - Schematic loading and parsing
  - Block placement logic
  - Material gathering integration

- **MemoryBank** (`memory_bank.js`) - Persistent memory
  - Location memory (chests, furnaces, etc.)
  - Cross-session persistence
  - Semantic search

### Command System (`src/agent/commands/`)

Structured interface between AI and game actions.

**Files:**
- **actions.js** - Action commands (build, collect, craft, etc.)
- **queries.js** - Information queries (inventory, stats, etc.)
- **index.js** - Command parsing and execution

**Command Flow:**
```
User/AI Input → Parse Command → Validate Parameters → Execute → Return Result
```

### AI Layer (`src/ai/`)

Manages AI model interactions and prompting.

**Key Components:**
- **Prompter** (`prompter.js`) - Main prompting interface
  - Context management
  - Model-agnostic interface
  - Skill library integration

- **Model Providers** - Individual AI service integrations
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude)
  - Google (Gemini)
  - Local (Ollama, LM Studio)
  - Many others...

### Configuration (`src/config/`)

Centralized configuration and constants.

**constants.js** exports:
- `TIMING` - Timeouts and intervals
- `CONTEXT` - Message limits and context settings
- `BOT_BEHAVIOR` - Auto-eat, combat, etc.
- `COMBAT` - Combat mode constants
- `NETWORK` - Server and port settings
- `COMMANDS` - Command configuration

## 🔄 Data Flow

### 1. Message Processing Flow

```
Minecraft Chat
    ↓
Agent.handleMessage()
    ↓
History.add() ← Context Window
    ↓
Prompter.promptConvo() ← AI Model
    ↓
Command Detection
    ↓
Command Execution ← Actions/Queries
    ↓
Result → History → AI Response
```

### 2. Action Execution Flow

```
Command Parsed
    ↓
ActionManager.execute()
    ↓
Bot Actions (via Mineflayer)
    ↓
Event Handlers (success/failure)
    ↓
Result Summary
```

### 3. Building Flow

```
User: "build a house"
    ↓
AI interprets → !build command
    ↓
BuildingManager loads schematic
    ↓
Material check & gathering
    ↓
Block-by-block placement
    ↓
Completion report
```

## 🧩 Key Design Patterns

### 1. **Event-Driven Architecture**
- Mineflayer events trigger agent responses
- Custom events for sunrise, noon, sunset, midnight
- Health/damage events for combat activation

### 2. **Command Pattern**
- All actions are encapsulated commands
- Uniform interface for execution
- Easy to add new commands

### 3. **Dependency Injection**
- Agent receives bot instance
- Components receive agent reference
- Loose coupling, high testability

### 4. **Singleton Managers**
- ConversationManager (multi-agent chat)
- ServerProxy (web UI communication)
- Memory systems

## 🔧 Extension Points

### Adding New Commands

1. Create command in `src/agent/commands/actions.js` or `queries.js`
2. Define parameters with types and validation
3. Implement `perform(agent, ...args)` function
4. Command automatically available to AI

Example:
```javascript
{
    name: '!myCommand',
    description: 'Does something cool',
    params: {
        'target': {
            type: 'string',
            description: 'The target to act on'
        },
        'amount': {
            type: 'int',
            domain: [1, 100, '[]'],
            description: 'How many times'
        }
    },
    perform: async function(agent, target, amount) {
        // Your logic here
        return `Success message`;
    }
}
```

### Adding New AI Providers

1. Create file in `src/ai/your_provider.js`
2. Implement the model interface:
   ```javascript
   export class YourProviderModel {
       constructor(model_name, url) { ... }
       async sendRequest(turns) { ... }
       async embed(text) { ... } // optional
   }
   ```
3. Add to `src/ai/_model_map.js`
4. Create profile in `profiles/your_provider.json`

### Adding New Modes

1. Create mode in `src/agent/modes/your_mode.js`
2. Implement mode interface with `update()` method
3. Register in `src/agent/modes.js`
4. Mode automatically ticks every 300ms

## 🎮 Runtime Behavior

### Bot Lifecycle

1. **Initialization** (main.js)
   - Load settings
   - Parse command-line args
   - Start MindServer (web UI)

2. **Agent Creation** (Mindcraft.createAgent)
   - Create Agent instance
   - Initialize all subsystems
   - Connect to Minecraft server

3. **Spawn** (Agent.start)
   - Wait for bot spawn (30s timeout)
   - Initialize vision, modes, NPC controller
   - Load saved memory if enabled
   - Send init message

4. **Main Loop**
   - 300ms update interval
   - Mode updates (combat, self-preservation, etc.)
   - Self-prompter updates
   - Task completion checks

5. **Event Handling**
   - Chat messages → handleMessage
   - Health changes → combat activation
   - Death → respawn and memory save
   - Idle → resume actions

6. **Shutdown**
   - Save history and memory
   - Clean disconnect
   - Exit with appropriate code

## 🔐 Security & Sandboxing

### Code Execution Safety

The `Coder` class uses SES (Secure ECMAScript) for sandboxing:
- Generated code runs in isolated compartment
- Limited access to skills and world libraries
- No file system or network access
- Interrupt mechanism for long-running code

**Configurable in settings:**
```javascript
allow_insecure_coding: false  // Disable !newAction entirely
code_timeout_mins: -1         // -1 = no timeout
```

## 📊 Performance Considerations

### Token Optimization
- Commands designed for minimal token usage
- Smart collection/crafting reduces AI calls
- Context window management (default 15 messages)
- Behavior log truncation (500 chars)

### Rate Limiting
- Local models (Ollama, LM Studio) have no limits
- Cloud providers handled by individual model classes
- Async request handling

### Memory Management
- Message history pruning
- Selective memory persistence
- Efficient skill library lookup

## 🧪 Testing Strategy

Currently minimal - opportunities for improvement:

1. **Unit Tests** - Individual components
2. **Integration Tests** - Command execution
3. **E2E Tests** - Full agent scenarios
4. **Mock Minecraft** - Test without server

## 📚 Further Reading

- [README.md](README.md) - Getting started guide
- [TODO.md](TODO.md) - Current development tasks
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [COMMANDS_OVERVIEW.md](COMMANDS_OVERVIEW.md) - Command reference

---

**Last Updated:** 2025-10-13
**Version:** 1.0.0-beta
