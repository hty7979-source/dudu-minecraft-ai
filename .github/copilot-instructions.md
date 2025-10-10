# Dudu Minecraft AI Bot - Copilot Instructions

## 🎮 Project Overview
This is a Minecraft AI bot built on **Mineflayer** with a focus on **local AI integration** (Ollama), **smart automation**, and **advanced building systems**. The bot is designed as a gaming companion with sophisticated collection, crafting, and building capabilities.

## 🏗️ Architecture Patterns

### Agent-Based System
- **Agent (`src/agent/agent.js`)**: Main bot entity that orchestrates all components
- **ActionManager**: Handles command execution with timeout/interrupt protection
- **BuildingManager**: Schematic-based construction system with `.schem` file support
- **MemoryBank**: Cross-session persistence for locations and learned behaviors
- **Prompter**: AI model interface with dynamic profile system

### Command System Architecture
- Commands use `!commandName(args)` syntax (e.g., `!smartCraft("wooden_axe", 1)`)
- **Actions** (`src/agent/commands/actions.js`): Executable commands that modify game state  
- **Queries** (`src/agent/commands/queries.js`): Read-only information commands
- Command parsing via regex: `/!(\w+)(?:\(((?:-?\d+(?:\.\d+)?|true|false|"[^"]*")(?:\s*,\s*(?:-?\d+(?:\.\d+)?|true|false|"[^"]*"))*)\))?/`

### Model Integration Pattern
- **Dynamic Model Discovery**: `src/models/_model_map.js` auto-discovers model classes by `static prefix` property
- **Profile System**: JSON profiles in `profiles/` with inheritance from `profiles/defaults/_default.json`
- **Local-First**: Default to Ollama for cost-free operation, with cloud model fallbacks

## 🔧 Development Workflow

### Key Commands
```bash
npm start              # Start with default andy.json profile
npm run dev           # Development mode
npm test              # Run all system tests
npm run test-building # Test building system specifically
```

### Environment Setup
- **Patch-Package Integration**: Custom patches in `patches/` for Mineflayer fixes (water digging, inventory bugs)
- **Docker Support**: Full containerized setup with Java 21, Python deps
- **Multi-Agent**: `settings.profiles` array supports multiple concurrent bots

### Testing Philosophy
- **Mock Testing**: Use mock bot objects for unit testing systems (see `src/agent/test_building_manager.js`)
- **Integration Testing**: Test against actual Minecraft servers for real-world validation
- **System Tests**: Each major component has dedicated test scripts

## 🎯 Critical Patterns

### Smart System Design
All major operations use "smart" prefix indicating multi-step automation:
- `!smartCollect`: Checks inventory → chests → crafting → mining → smelting
- `!smartCraft`: Auto-gathers materials, crafts intermediate items, manages storage
- `!build`: Schematic placement with directional awareness and survival/creative mode adaptation

### Error Handling & Safety
- **Action Loop Protection**: ActionManager prevents infinite loops with timing analysis
- **Interrupt System**: All commands can be safely interrupted via `agent.requestInterrupt()`
- **Resume Functionality**: Long operations can pause/resume (useful for combat interruptions)
- **Tool Preservation**: Smart systems avoid breaking valuable tools

### Memory & Persistence  
- **Cross-Session Memory**: `src/agent/memory_bank.js` preserves learned locations
- **Conversation History**: `src/agent/history.js` with intelligent summarization
- **Profile State**: Bot-specific data in `bots/{name}/` folders

## 🚨 Critical Integration Points

### Mineflayer API Compliance
**CRITICAL**: All code must strictly adhere to the **Mineflayer API** standards:
- **Use official Mineflayer methods** - Never bypass or reimplement core bot functions
- **Respect bot state management** - Always check `bot.entity.position`, `bot.inventory`, etc. via proper API
- **Follow async patterns** - Most Mineflayer operations are Promise-based, use `await` properly
- **Event-driven architecture** - Listen to bot events (`bot.on('spawn')`, `bot.on('chat')`, etc.) rather than polling
- **Pathfinding integration** - Use `mineflayer-pathfinder` for movement, never manually set position
- **Block interaction** - Use `bot.dig()`, `bot.placeBlock()` etc., never direct world manipulation

### Mineflayer Patches
The project applies **essential patches** to fix upstream bugs:
- **Water Digging Bug**: Forces `isInWater = false` for accurate dig times
- **Tool Material Detection**: Handles `incorrect_for_wooden_tool` material type
- Always run `npm install` to apply patches via `postinstall` script

### Schematic System
- **Path Structure**: `schematics/{category}/{name}.schem`
- **Format Support**: Litematica `.schem` files with NBT parsing
- **Smart Placement**: Directional positioning for doors, beds, chests based on block properties

### AI Model Configuration
```javascript
// Profile inheritance pattern
{
  "name": "BotName",
  "model": "ollama/gemma2:9b",  // Local AI (recommended)
  "base_profile": "assistant",   // Inherits from profiles/defaults/assistant.json
}
```

## ⚡ Performance Considerations

### Token Optimization
- **Command System**: Pre-built commands reduce LLM token usage by ~90%
- **Memory Compression**: Aggressive conversation summarization (500 char limit)
- **Smart Defaults**: Most operations have intelligent fallbacks to reduce AI decision burden

### Resource Management
- **Inventory Mutex**: Prevents concurrent inventory operations
- **Build Queuing**: Sequential construction to avoid block conflicts  
- **Tool Durability**: Smart systems monitor and preserve tool condition

## 🔍 Key Files for Understanding
- `src/agent/agent.js`: Main orchestration logic
- `src/agent/building_manager.js`: Advanced schematic building (2000+ lines)
- `src/agent/commands/index.js`: Command parsing and execution
- `profiles/defaults/_default.json`: Base personality and behavior patterns
- `src/models/_model_map.js`: Dynamic AI model integration
- `settings.js`: Global configuration and multi-agent setup

## 💡 Development Tips
- **Always use smart commands** (`!smartCraft`, `!smartCollect`, `!build`) - avoid deprecated basic commands
- **Profile testing**: Use different profiles in `profiles/` for various AI models/personalities  
- **Command development**: Add new commands to appropriate arrays in `actions.js` or `queries.js`
- **Schematic integration**: Place `.schem` files in appropriate category folders for auto-discovery
- **Memory debugging**: Check `bots/{name}/histories/` for conversation persistence issues