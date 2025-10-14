# 📋 Dudu Minecraft AI - TODO List

## 🔥 High Priority

### Smelting System
- **Location:** `src/agent/library/smart_collect_enhanced.js:332`
- **Description:** Implementation for smelting system integration
- **Impact:** Medium - needed for complete resource gathering automation

### Multi-Bot Support
- **Location:** `src/agent/tasks/tasks.js:486`, `src/agent/tasks/tasks.js:561`
- **Description:** Wait for other bots to join functionality
- **Impact:** Medium - required for multi-agent coordination

### Light Level Detection
- **Location:** `src/agent/library/world.js:420`, `src/agent/commands/queries.js:37`
- **Description:** Light properties are currently bugged, need accurate light level checking
- **Impact:** Low - workaround using nearby torches exists

## 🛠️ Medium Priority

### Code Structure
- **Location:** `src/agent/commands/index.js:90`
- **Description:** Handle arrays in command parameters
- **Impact:** Low - nice-to-have feature

### Furnace State Detection
- **Location:** `src/agent/library/skills.js:188`
- **Description:** Check if furnace is currently burning fuel (furnace.fuel is always null)
- **Impact:** Low - potential mineflayer bug

### Self-Preservation Mode
- **Location:** `src/agent/library/skills.js:325`
- **Description:** Implement drowning mode instead of disabling all self_preservation
- **Impact:** Low - safety improvement

### Construction Materials
- **Location:** `src/agent/tasks/construction_tasks.js:350`
- **Description:** Make set materials dynamic/parametrized
- **Impact:** Low - flexibility improvement

## 🐛 Known Bugs

### Construction Task Scoring
- **Location:** `src/agent/tasks/construction_tasks.js:636`
- **Description:** Still a little buggy
- **Impact:** Medium - affects task completion detection

### Output Suppression
- **Location:** `src/mindcraft/mcserver.js:82`
- **Description:** Need better way to suppress output without hiding useful information
- **Impact:** Low - logging quality of life

## 🧪 Testing & Validation

### Validator Code Improvement
- **Location:** `src/agent/tasks/tasks.js:62-63`
- **Description:** Modify validator code to return object with valid and score, improve logging
- **Impact:** Low - better debugging

### VLLM Model Parameters
- **Location:** `src/models/vllm.js:43`
- **Description:** Set max_tokens, temperature, top_p, etc. in pack
- **Impact:** Low - model configuration

## 📝 Notes

- This list was extracted during code refactoring on 2025-10-13
- TODOs are organized by priority and impact
- Cross-reference line numbers may change after refactoring
