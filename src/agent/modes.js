import * as skills from './library/skills.js';
import * as world from './library/world.js';
import * as mc from '../utils/mcdata.js';
import settings from './settings.js'
import convoManager from './conversation.js';
import pf from 'mineflayer-pathfinder';
import { createCombatMode } from './modes/combat_mode.js';

/**
 * Send a message through the agent's chat system
 * @param {Object} agent - The bot agent
 * @param {string} message - Message to send
 */
async function say(agent, message) {
    agent.bot.modes.behavior_log += message + '\n';
    if (agent.shut_up || !settings.narrate_behavior) return;
    agent.openChat(message);
}

/**
 * MODES SYSTEM OVERVIEW
 * 
 * A mode is a reactive behavior that responds to world state changes every tick.
 * 
 * Mode Properties:
 * - on: whether 'update' is called every tick
 * - active: whether an action has been triggered by the mode and hasn't yet finished
 * - paused: whether the mode is paused by another action that overrides the behavior
 * - update: the function that is called every tick (if on is true)
 * - interrupts: array of actions this mode can interrupt (['all'] for any action)
 * 
 * IMPORTANT: 
 * - The order of this list matters! Earlier modes have higher priority
 * - Update functions should NOT block longer than ~100ms to avoid freezing the update loop
 * - Use the execute() function for longer operations that won't block the loop
 * - When a mode is active, it triggers an action but doesn't wait for completion
 */
const modes_list = [
    {
        name: 'self_preservation',
        description: 'Respond to drowning, burning, and damage at low health. Interrupts all actions.',
        interrupts: ['all'],
        on: true,
        active: false,
        
        // Block types that can fall and cause damage
        fall_blocks: ['sand', 'gravel', 'concrete_powder'],
        
        update: async function (agent) {
            const bot = agent.bot;
            
            // Get current position blocks (with fallback for unloaded chunks)
            let block = bot.blockAt(bot.entity.position) || {name: 'air'};
            let blockAbove = bot.blockAt(bot.entity.position.offset(0, 1, 0)) || {name: 'air'};
            
            // Handle water - simple jump without interrupting other actions
            if (blockAbove.name === 'water') {
                if (!bot.pathfinder.goal) {
                    bot.setControlState('jump', true);
                }
            }
            // Handle falling blocks - move away immediately
            else if (this.fall_blocks.some(name => blockAbove.name.includes(name))) {
                execute(this, agent, async () => {
                    await skills.moveAway(bot, 2);
                });
            }
            // Handle fire/lava - emergency response with water bucket or escape
            else if (this.isInDanger(block, blockAbove)) {
                say(agent, 'I\'m on fire!');
                execute(this, agent, async () => {
                    await this.handleFireEmergency(agent, block);
                });
            }
            // Handle critical health - emergency escape
            else if (this.isCriticalHealth(bot)) {
                say(agent, 'I\'m dying!');
                execute(this, agent, async () => {
                    await skills.moveAway(bot, 20);
                });
            }
            // Clear jump control when idle and safe
            else if (agent.isIdle()) {
                bot.clearControlStates();
            }
        },
        
        /**
         * Check if bot is in fire or lava
         */
        isInDanger: function(block, blockAbove) {
            const dangerBlocks = ['lava', 'fire'];
            return dangerBlocks.includes(block.name) || dangerBlocks.includes(blockAbove.name);
        },
        
        /**
         * Check if bot has critical health and recent damage
         */
        isCriticalHealth: function(bot) {
            const recentDamage = Date.now() - bot.lastDamageTime < 3000;
            const criticalHealth = bot.health < 5 || bot.lastDamageTaken >= bot.health;
            return recentDamage && criticalHealth;
        },
        
        /**
         * Handle fire emergency with water bucket or escape
         */
        handleFireEmergency: async function(agent, block) {
            const bot = agent.bot;
            
            // Try to use water bucket first
            let waterBucket = bot.inventory.items().find(item => item.name === 'water_bucket');
            if (waterBucket) {
                let success = await skills.placeBlock(bot, 'water_bucket', 
                    block.position.x, block.position.y, block.position.z);
                if (success) {
                    say(agent, 'Placed water to extinguish fire!');
                    return;
                }
            }
            
            // Find nearby water source
            let nearestWater = world.getNearestBlock(bot, 'water', 20);
            if (nearestWater) {
                const pos = nearestWater.position;
                let success = await skills.goToPosition(bot, pos.x, pos.y, pos.z, 0.2);
                if (success) {
                    say(agent, 'Found water source - fire extinguished!');
                    return;
                }
            }
            
            // Last resort - move away from fire
            await skills.moveAway(bot, 5);
        }
    },
    {
        name: 'unstuck',
        description: 'Attempt to get unstuck when in the same place for a while. Interrupts some actions.',
        interrupts: ['all'],
        on: true,
        active: false,
        
        // State tracking for stuck detection
        prev_location: null,
        distance: 2,
        stuck_time: 0,
        last_time: Date.now(),
        max_stuck_time: 20,
        prev_dig_block: null,
        
        update: async function (agent) {
            // Don't track stuck state when idle
            if (agent.isIdle()) { 
                this.resetState();
                return;
            }
            
            const bot = agent.bot;
            const cur_dig_block = bot.targetDigBlock;
            
            // Track current digging block
            if (cur_dig_block && !this.prev_dig_block) {
                this.prev_dig_block = cur_dig_block;
            }
            
            // Check if bot hasn't moved significantly
            const currentPos = bot.entity.position;
            const hasntMoved = this.prev_location && 
                this.prev_location.distanceTo(currentPos) < this.distance;
            const sameDig = cur_dig_block == this.prev_dig_block;
            
            if (hasntMoved && sameDig) {
                // Accumulate stuck time
                this.stuck_time += (Date.now() - this.last_time) / 1000;
            } else {
                // Reset tracking - bot has moved or changed activity
                this.prev_location = currentPos.clone();
                this.stuck_time = 0;
                this.prev_dig_block = cur_dig_block;
            }
            
            // Determine timeout (obsidian takes longer to dig)
            const timeout = cur_dig_block?.name === 'obsidian' ? 
                this.max_stuck_time * 2 : this.max_stuck_time;
            
            // Execute unstuck procedure if timeout exceeded
            if (this.stuck_time > timeout) {
                say(agent, 'I\'m stuck! Attempting to break free...');
                this.stuck_time = 0;
                
                execute(this, agent, async () => {
                    // Safety timeout to prevent infinite stuck loops
                    const crashTimeout = setTimeout(() => {
                        agent.cleanKill("Got stuck and couldn't get unstuck")
                    }, 10000);
                    
                    await skills.moveAway(bot, 5);
                    clearTimeout(crashTimeout);
                    say(agent, 'Successfully freed myself!');
                });
            }
            
            this.last_time = Date.now();
        },
        
        /**
         * Reset stuck detection state
         */
        resetState: function() {
            this.prev_location = null;
            this.stuck_time = 0;
            this.prev_dig_block = null;
        },
        
        /**
         * Called when mode is unpaused - reset tracking
         */
        unpause: function () {
            this.resetState();
        }
    },
    {
        name: 'cowardice',
        description: 'Run away from enemies. Interrupts all actions.',
        interrupts: ['all'],
        on: true,
        active: false,
        
        update: async function (agent) {
            const bot = agent.bot;
            
            // Find nearest hostile entity within detection range
            const enemy = world.getNearestEntityWhere(bot, 
                entity => mc.isHostile(entity), 16);
            
            // Only flee if enemy exists and has clear path to bot
            if (enemy && await world.isClearPath(bot, enemy)) {
                const enemyName = enemy.name.replace("_", " ");
                say(agent, `Enemy detected: ${enemyName}! Retreating to safety!`);
                
                execute(this, agent, async () => {
                    await skills.avoidEnemies(bot, 24);
                });
            }
        }
    },
    // Combat mode is now imported from separate module for better organization
    createCombatMode(execute, say),
    {
        name: 'hunting',
        description: 'Hunt nearby animals when idle.',
        interrupts: ['action:followPlayer'],
        on: true,
        active: false,
        
        update: async function (agent) {
            const bot = agent.bot;
            
            // Find nearest huntable animal within range
            const huntable = world.getNearestEntityWhere(bot, 
                entity => mc.isHuntable(entity), 8);
            
            // Only hunt if target exists and path is clear
            if (huntable && await world.isClearPath(bot, huntable)) {
                execute(this, agent, async () => {
                    say(agent, `Hunting ${huntable.name} for food!`);
                    await skills.attackEntity(bot, huntable);
                });
            }
        }
    },
    {
        name: 'item_collecting',
        description: 'Collect nearby items when idle.',
        interrupts: ['action:followPlayer'],
        on: true,
        active: false,
        
        // Wait time to avoid picking up items immediately (prevents spam)
        wait: 2,
        prev_item: null,
        noticed_at: -1,
        
        update: async function (agent) {
            const bot = agent.bot;
            
            // Find nearest dropped item
            let item = world.getNearestEntityWhere(bot, entity => entity.name === 'item', 8);
            let empty_inv_slots = bot.inventory.emptySlotCount();
            
            // Check if item is new, reachable, and we have inventory space
            const shouldCollect = item && 
                item !== this.prev_item && 
                await world.isClearPath(bot, item) && 
                empty_inv_slots > 1;
                
            if (shouldCollect) {
                // Start waiting period for new item
                if (this.noticed_at === -1) {
                    this.noticed_at = Date.now();
                }
                
                // Collect item after wait period
                if (Date.now() - this.noticed_at > this.wait * 1000) {
                    say(agent, 'Collecting nearby items!');
                    this.prev_item = item;
                    
                    execute(this, agent, async () => {
                        await skills.pickupNearbyItems(bot);
                    });
                    
                    this.noticed_at = -1;
                }
            } else {
                // Reset waiting if no valid item
                this.noticed_at = -1;
            }
        }
    },
    {
        name: 'torch_placing',
        description: 'Place torches when idle and there are no torches nearby.',
        interrupts: ['action:followPlayer'],
        on: true,
        active: false,
        
        // Cooldown to prevent torch spam
        cooldown: 5,
        last_place: Date.now(),
        
        update: function (agent) {
            const bot = agent.bot;
            
            // Check if area needs lighting and cooldown has passed
            if (world.shouldPlaceTorch(bot)) {
                if (Date.now() - this.last_place < this.cooldown * 1000) return;
                
                execute(this, agent, async () => {
                    const pos = bot.entity.position;
                    await skills.placeBlock(bot, 'torch', pos.x, pos.y, pos.z, 'bottom', true);
                });
                
                this.last_place = Date.now();
            }
        }
    },
    {
        name: 'elbow_room',
        description: 'Move away from nearby players when idle.',
        interrupts: ['action:followPlayer'],
        on: true,
        active: false,
        
        // Minimum distance to maintain from players
        distance: 0.5,
        
        update: async function (agent) {
            const bot = agent.bot;
            
            // Find nearby player that's too close
            const player = world.getNearestEntityWhere(bot, 
                entity => entity.type === 'player', this.distance);
                
            if (player) {
                execute(this, agent, async () => {
                    // Random delay to prevent synchronized bot movements
                    const wait_time = Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, wait_time));
                    
                    // Double-check distance after delay
                    if (player.position.distanceTo(bot.entity.position) < this.distance) {
                        await skills.moveAwayFromEntity(bot, player, this.distance);
                    }
                });
            }
        }
    },
    {
        name: 'idle_staring',
        description: 'Animation to look around at entities when idle.',
        interrupts: [],
        on: true,
        active: false,
        
        // State for entity tracking and looking behavior
        staring: false,
        last_entity: null,
        next_change: 0,
        
        update: function (agent) {
            const bot = agent.bot;
            const entity = bot.nearestEntity();
            
            // Check if entity is in view range and safe to look at (avoid enderman)
            const entity_in_view = entity && 
                entity.position.distanceTo(bot.entity.position) < 10 && 
                entity.name !== 'enderman';
                
            // Start staring at new entity
            if (entity_in_view && entity !== this.last_entity) {
                this.staring = true;
                this.last_entity = entity;
                this.next_change = Date.now() + Math.random() * 1000 + 4000;
            }
            
            // Look at current entity if staring
            if (entity_in_view && this.staring) {
                // Adjust height for baby mobs
                let isbaby = entity.type !== 'player' && entity.metadata[16];
                let height = isbaby ? entity.height/2 : entity.height;
                bot.lookAt(entity.position.offset(0, height, 0));
            }
            
            // Clear entity reference when out of view
            if (!entity_in_view) {
                this.last_entity = null;
            }
            
            // Change looking behavior periodically
            if (Date.now() > this.next_change) {
                // Randomly decide whether to stare or look around
                this.staring = Math.random() < 0.3;
                
                if (!this.staring) {
                    // Look in random direction
                    const yaw = Math.random() * Math.PI * 2;
                    const pitch = (Math.random() * Math.PI/2) - Math.PI/4;
                    bot.look(yaw, pitch, false);
                }
                
                // Set next change time (2-12 seconds)
                this.next_change = Date.now() + Math.random() * 10000 + 2000;
            }
        }
    },
    {
        name: 'cheat',
        description: 'Use cheats to instantly place blocks and teleport.',
        interrupts: [],
        on: false,
        active: false,
        
        update: function (agent) { 
            // Cheat mode placeholder - no active behavior
            // This mode can be extended with creative mode abilities
        }
    }
];

/**
 * Execute a mode's action asynchronously without blocking the update loop
 * @param {Object} mode - The mode object
 * @param {Object} agent - The bot agent  
 * @param {Function} func - The async function to execute
 * @param {number} timeout - Optional timeout in milliseconds
 */
async function execute(mode, agent, func, timeout=-1) {
    // Stop self-prompting if active
    if (agent.self_prompter.isActive()) {
        agent.self_prompter.stopLoop();
    }
    
    // Track what action was interrupted
    let interrupted_action = agent.actions.currentActionLabel;
    
    // Mark mode as active and run the action
    mode.active = true;
    let code_return = await agent.actions.runAction(`mode:${mode.name}`, async () => {
        await func();
    }, { timeout });
    mode.active = false;
    
    // Log completion (reduced verbosity)
    console.log(`Mode ${mode.name} completed: ${code_return.message}`);

    // Determine if we should auto-prompt after interruption
    let should_reprompt = 
        interrupted_action && // An action was interrupted
        !agent.actions.resume_func && // No resume function available
        !agent.self_prompter.isActive() && // Self prompting not active
        !code_return.interrupted; // This mode wasn't interrupted by something else

    if (should_reprompt) {
        // Auto-prompt to respond to the interruption
        let role = convoManager.inConversation() ? agent.last_sender : 'system';
        let logs = agent.bot.modes.flushBehaviorLog();
        
        agent.handleMessage(role, 
            `(AUTO MESSAGE) Your previous action '${interrupted_action}' was interrupted by ${mode.name}. ` +
            `Behavior log: ${logs}\nRespond accordingly.`);
    }
}

// Global agent reference and mode mapping
let _agent = null;
const modes_map = {};

// Build mode mapping for quick lookup
for (let mode of modes_list) {
    modes_map[mode.name] = mode;
}

/**
 * ModeController - Manages bot behavioral modes
 * 
 * SECURITY WARNING:
 * This controller must be reference isolated. Do not store references to external objects like `agent`.
 * This object is accessible by LLM generated code, so any stored references are also accessible.
 * This can be used to expose sensitive information by malicious prompters.
 */
class ModeController {
    constructor() {
        this.behavior_log = '';
    }

    /**
     * Check if a mode exists
     * @param {string} mode_name - Name of the mode
     * @returns {boolean} True if mode exists
     */
    exists(mode_name) {
        return modes_map[mode_name] != null;
    }

    /**
     * Enable or disable a mode
     * @param {string} mode_name - Name of the mode
     * @param {boolean} on - Whether to enable the mode
     */
    setOn(mode_name, on) {
        if (this.exists(mode_name)) {
            modes_map[mode_name].on = on;
        }
    }

    /**
     * Check if a mode is enabled
     * @param {string} mode_name - Name of the mode
     * @returns {boolean} True if mode is enabled
     */
    isOn(mode_name) {
        return this.exists(mode_name) ? modes_map[mode_name].on : false;
    }

    /**
     * Pause a mode (temporary disable)
     * @param {string} mode_name - Name of the mode
     */
    pause(mode_name) {
        if (this.exists(mode_name)) {
            modes_map[mode_name].paused = true;
        }
    }

    /**
     * Unpause a mode
     * @param {string} mode_name - Name of the mode
     */
    unpause(mode_name) {
        const mode = modes_map[mode_name];
        if (!mode) return;
        
        // Call custom unpause function if defined and mode is currently paused
        if (mode.unpause && mode.paused) {
            mode.unpause();
        }
        mode.paused = false;
    }

    /**
     * Unpause all modes (called when bot becomes idle)
     */
    unPauseAll() {
        for (let mode of modes_list) {
            if (mode.paused) {
                console.log(`Unpausing mode: ${mode.name}`);
                this.unpause(mode.name);
            }
        }
    }

    /**
     * Get simple mode status (no descriptions)
     * @returns {string} Mode status list
     */
    getMiniDocs() {
        let res = 'Agent Modes:';
        for (let mode of modes_list) {
            let status = mode.on ? 'ON' : 'OFF';
            res += `\n- ${mode.name} (${status})`;
        }
        return res;
    }

    /**
     * Get detailed mode documentation
     * @returns {string} Mode documentation
     */
    getDocs() {
        let res = 'Agent Modes:';
        for (let mode of modes_list) {
            let status = mode.on ? 'ON' : 'OFF';
            res += `\n- ${mode.name} (${status}): ${mode.description}`;
        }
        return res;
    }

    /**
     * Update all modes - main update loop called every tick
     */
    async update() {
        // Unpause all modes when bot is idle
        if (_agent.isIdle()) {
            this.unPauseAll();
        }
        
        // Process each mode in priority order
        for (let mode of modes_list) {
            // Check if mode can interrupt current action
            const canInterrupt = mode.interrupts.some(i => i === 'all') || 
                mode.interrupts.some(i => i === _agent.actions.currentActionLabel);
            
            // Run mode if it's enabled, not paused, not active, and either idle or can interrupt
            const shouldRun = mode.on && 
                !mode.paused && 
                !mode.active && 
                (_agent.isIdle() || canInterrupt);
                
            if (shouldRun) {
                await mode.update(_agent);
            }
            
            // Stop processing if any mode becomes active (priority system)
            if (mode.active) break;
        }
    }

    /**
     * Get and clear behavior log
     * @returns {string} Current behavior log
     */
    flushBehaviorLog() {
        const log = this.behavior_log;
        this.behavior_log = '';
        return log;
    }

    /**
     * Export mode settings to JSON
     * @returns {Object} Mode settings
     */
    getJson() {
        let res = {};
        for (let mode of modes_list) {
            res[mode.name] = mode.on;
        }
        return res;
    }

    /**
     * Load mode settings from JSON
     * @param {Object} json - Mode settings to load
     */
    loadJson(json) {
        for (let mode of modes_list) {
            if (json[mode.name] !== undefined) {
                mode.on = json[mode.name];
            }
        }
    }
}

/**
 * Initialize the modes system for an agent
 * @param {Object} agent - The bot agent to initialize modes for
 */
export function initModes(agent) {
    // Set global agent reference for mode system
    _agent = agent;
    
    // Create and attach mode controller to bot object
    // This makes modes accessible from anywhere the bot is used
    agent.bot.modes = new ModeController();
    
    // Set inventory restrictions if task specifies them
    if (agent.task) {
        agent.bot.restrict_to_inventory = agent.task.restrict_to_inventory;
    }
    
    // Load initial mode configuration from profile
    let modes_json = agent.prompter.getInitModes();
    if (modes_json) {
        agent.bot.modes.loadJson(modes_json);
        console.log('Loaded mode configuration from profile');
    }
    
    console.log(`Initialized ${modes_list.length} behavioral modes for ${agent.name}`);
}
