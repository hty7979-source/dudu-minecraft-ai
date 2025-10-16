import * as skills from '../library/skills.js';
import settings from '../settings.js';
import convoManager from '../conversation.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Wraps an action function to integrate with the agent's action system
 * @param {Function} actionFn - The action function to wrap
 * @param {boolean} resume - Whether the action can be resumed
 * @param {number} timeout - Timeout in minutes (-1 for no timeout)
 */
function runAsAction(actionFn, resume = false, timeout = -1) {
    let actionLabel = null;

    const wrappedAction = async function (agent, ...args) {
        if (!actionLabel) {
            const actionObj = actionsList.find(a => a.perform === wrappedAction);
            actionLabel = actionObj.name.substring(1);
        }

        let result = null;
        const actionFnWithAgent = async () => {
            result = await actionFn(agent, ...args);
        };
        const code_return = await agent.actions.runAction(`action:${actionLabel}`, actionFnWithAgent, { timeout, resume });
        if (code_return.interrupted && !code_return.timedout)
            return;
        return result || code_return.message;
    }

    return wrappedAction;
}

/**
 * Helper for combat mode commands - reduces boilerplate
 */
function createCombatAction(name, description, fn, params = {}) {
    return {
        name: `!combat${name}`,
        description,
        params,
        perform: async function(agent, ...args) {
            const bot = agent.bot;
            if (!bot.modes?.self_defense) {
                return 'Combat mode not available.';
            }
            return fn(agent, bot.modes.self_defense, ...args);
        }
    };
}

// ============================================================================
// CORE SYSTEM ACTIONS
// ============================================================================

const CORE_ACTIONS = [
    {
        name: '!stop',
        description: 'Force stop all actions and commands that are currently executing.',
        perform: async function (agent) {
            await agent.actions.stop();
            agent.clearBotLogs();
            agent.actions.cancelResume();
            agent.bot.emit('idle');
            let msg = 'Agent stopped.';
            if (agent.self_prompter.isActive())
                msg += ' Self-prompting still active.';
            return msg;
        }
    },
    {
        name: '!stfu',
        description: 'Stop all chatting and self prompting, but continue current action.',
        perform: async function (agent) {
            agent.openChat('Shutting up.');
            agent.shutUp();
            return;
        }
    },
    {
        name: '!restart',
        description: 'Restart the agent process.',
        perform: async function (agent) {
            agent.cleanKill();
        }
    },
    {
        name: '!clearChat',
        description: 'Clear the chat history.',
        perform: async function (agent) {
            agent.history.clear();
            return agent.name + "'s chat history was cleared, starting new conversation from scratch.";
        }
    },
    {
        name: '!newAction',
        description: 'Perform new and unknown custom behaviors that are not available as a command.', 
        params: {
            'prompt': { type: 'string', description: 'A natural language prompt to guide code generation. Make a detailed step-by-step plan.' }
        },
        perform: async function(agent, prompt) {
            if (!settings.allow_insecure_coding) { 
                agent.openChat('newAction is disabled. Enable with allow_insecure_coding=true in settings.js');
                return "newAction not allowed! Code writing is disabled in settings. Notify the user.";
            }
            let result = "";
            const actionFn = async () => {
                try {
                    result = await agent.coder.generateCode(agent.history);
                } catch (e) {
                    result = 'Error generating code: ' + e.toString();
                }
            };
            await agent.actions.runAction('action:newAction', actionFn, {timeout: settings.code_timeout_mins});
            return result;
        }
    }
];

// ============================================================================
// MOVEMENT & NAVIGATION ACTIONS
// ============================================================================

const MOVEMENT_ACTIONS = [
    {
        name: '!goToPlayer',
        description: 'Go to the given player.',
        params: {
            'player_name': {type: 'string', description: 'The name of the player to go to.'},
            'closeness': {type: 'float', description: 'How close to get to the player.', domain: [0, Infinity]}
        },
        perform: runAsAction(async (agent, player_name, closeness) => {
            await skills.goToPlayer(agent.bot, player_name, closeness);
        })
    },
    {
        name: '!followPlayer',
        description: 'Endlessly follow the given player.',
        params: {
            'player_name': {type: 'string', description: 'name of the player to follow.'},
            'follow_dist': {type: 'float', description: 'The distance to follow from.', domain: [0, Infinity]}
        },
        perform: runAsAction(async (agent, player_name, follow_dist) => {
            await skills.followPlayer(agent.bot, player_name, follow_dist);
        }, true)
    },
    {
        name: '!goToCoordinates',
        description: 'Go to the given x, y, z location.',
        params: {
            'x': {type: 'float', description: 'The x coordinate.', domain: [-Infinity, Infinity]},
            'y': {type: 'float', description: 'The y coordinate.', domain: [-64, 320]},
            'z': {type: 'float', description: 'The z coordinate.', domain: [-Infinity, Infinity]},
            'closeness': {type: 'float', description: 'How close to get to the location.', domain: [0, Infinity]}
        },
        perform: runAsAction(async (agent, x, y, z, closeness) => {
            await skills.goToPosition(agent.bot, x, y, z, closeness);
        })
    },
    {
        name: '!searchForBlock',
        description: 'Find and go to the nearest block of a given type in a given range.',
        params: {
            'type': { type: 'BlockName', description: 'The block type to go to.' },
            'search_range': { type: 'float', description: 'The range to search for the block. Minimum 32.', domain: [10, 512] }
        },
        perform: runAsAction(async (agent, block_type, range) => {
            if (range < 32) {
                skills.log(agent.bot, `Minimum search range is 32.`);
                range = 32;
            }
            await skills.goToNearestBlock(agent.bot, block_type, 4, range);
        })
    },
    {
        name: '!searchForEntity',
        description: 'Find and go to the nearest entity of a given type in a given range.',
        params: {
            'type': { type: 'string', description: 'The type of entity to go to.' },
            'search_range': { type: 'float', description: 'The range to search for the entity.', domain: [32, 512] }
        },
        perform: runAsAction(async (agent, entity_type, range) => {
            await skills.goToNearestEntity(agent.bot, entity_type, 4, range);
        })
    },
    {
        name: '!moveAway',
        description: 'Move away from the current location in any direction by a given distance.',
        params: {'distance': { type: 'float', description: 'The distance to move away.', domain: [0, Infinity] }},
        perform: runAsAction(async (agent, distance) => {
            await skills.moveAway(agent.bot, distance);
        })
    },
    {
        name: '!rememberHere',
        description: 'Save the current location with a given name.',
        params: {'name': { type: 'string', description: 'The name to remember the location as.' }},
        perform: async function (agent, name) {
            const pos = agent.bot.entity.position;
            agent.memory_bank.rememberPlace(name, pos.x, pos.y, pos.z);
            return `Location saved as "${name}".`;
        }
    },
    {
        name: '!goToRememberedPlace',
        description: 'Go to a saved location.',
        params: {'name': { type: 'string', description: 'The name of the location to go to.' }},
        perform: runAsAction(async (agent, name) => {
            const pos = agent.memory_bank.recallPlace(name);
            if (!pos) {
                skills.log(agent.bot, `No location named "${name}" saved.`);
                return;
            }
            await skills.goToPosition(agent.bot, pos[0], pos[1], pos[2], 1);
        })
    },
    {
        name: '!stay',
        description: 'Stay in the current location no matter what. Pauses all modes.',
        params: {'type': { type: 'int', description: 'The number of seconds to stay. -1 for forever.', domain: [-1, Number.MAX_SAFE_INTEGER] }},
        perform: runAsAction(async (agent, seconds) => {
            await skills.stay(agent.bot, seconds);
        })
    },
    {
        name: '!goToBed',
        description: 'Go to the nearest bed and sleep.',
        perform: runAsAction(async (agent) => {
            await skills.goToBed(agent.bot);
        })
    },
    {
        name: '!digDown',
        description: 'Digs down a specified distance. Will stop if it reaches lava, water, or a fall of >=4 blocks below the bot.',
        params: {'distance': { type: 'int', description: 'Distance to dig down', domain: [1, Number.MAX_SAFE_INTEGER] }},
        perform: runAsAction(async (agent, distance) => {
            await skills.digDown(agent.bot, distance);
        })
    },
    {
        name: '!goToSurface',
        description: 'Moves the bot to the highest block above it (usually the surface).',
        params: {},
        perform: runAsAction(async (agent) => {
            await skills.goToSurface(agent.bot);
        })
    }
];

// ============================================================================
// INVENTORY & ITEM MANAGEMENT ACTIONS
// ============================================================================

const INVENTORY_ACTIONS = [
    {
        name: '!givePlayer',
        description: 'Give the specified item to the given player.',
        params: { 
            'player_name': { type: 'string', description: 'The name of the player to give the item to.' }, 
            'item_name': { type: 'ItemName', description: 'The name of the item to give.' },
            'num': { type: 'int', description: 'The number of items to give.', domain: [1, Number.MAX_SAFE_INTEGER] }
        },
        perform: runAsAction(async (agent, player_name, item_name, num) => {
            await skills.giveToPlayer(agent.bot, item_name, player_name, num);
        })
    },
    {
        name: '!consume',
        description: 'Eat/drink the given item.',
        params: {'item_name': { type: 'ItemName', description: 'The name of the item to consume.' }},
        perform: runAsAction(async (agent, item_name) => {
            await skills.consume(agent.bot, item_name);
        })
    },
    {
        name: '!equip',
        description: 'Equip the given item.',
        params: {'item_name': { type: 'ItemName', description: 'The name of the item to equip.' }},
        perform: runAsAction(async (agent, item_name) => {
            await skills.equip(agent.bot, item_name);
        })
    },
    {
        name: '!discard',
        description: 'Discard the given item from the inventory.',
        params: {
            'item_name': { type: 'ItemName', description: 'The name of the item to discard.' },
            'num': { type: 'int', description: 'The number of items to discard.', domain: [1, Number.MAX_SAFE_INTEGER] }
        },
        perform: runAsAction(async (agent, item_name, num) => {
            const start_loc = agent.bot.entity.position;
            await skills.moveAway(agent.bot, 5);
            await skills.discard(agent.bot, item_name, num);
            await skills.goToPosition(agent.bot, start_loc.x, start_loc.y, start_loc.z, 0);
        })
    }
];

// ============================================================================
// CHEST & STORAGE ACTIONS
// ============================================================================

const STORAGE_ACTIONS = [
    {
        name: '!putInChest',
        description: 'Put the given item in the nearest chest.',
        params: {
            'item_name': { type: 'ItemName', description: 'The name of the item to put in the chest.' },
            'num': { type: 'int', description: 'The number of items to put in the chest.', domain: [1, Number.MAX_SAFE_INTEGER] }
        },
        perform: runAsAction(async (agent, item_name, num) => {
            await skills.putInChest(agent.bot, item_name, num);
        })
    },
    {
        name: '!takeFromChest',
        description: 'Take the given items from the nearest chest.',
        params: {
            'item_name': { type: 'ItemName', description: 'The name of the item to take.' },
            'num': { type: 'int', description: 'The number of items to take.', domain: [1, Number.MAX_SAFE_INTEGER] }
        },
        perform: runAsAction(async (agent, item_name, num) => {
            await skills.takeFromChest(agent.bot, item_name, num);
        })
    },
    {
        name: '!viewChest',
        description: 'View the items/counts of the nearest chest.',
        params: { },
        perform: runAsAction(async (agent) => {
            await skills.viewChest(agent.bot);
        })
    }
];

// ============================================================================
// RESOURCE GATHERING & CRAFTING ACTIONS
// ============================================================================

const GATHERING_ACTIONS = [
    {
        name: '!smartCollect',
        description: 'Intelligently collect items using multi-source strategy: check chests → craft if possible → smelt if needed → mine as last resort. Handles inventory management automatically.',
        params: {
            'items': { type: 'string', description: 'Comma-separated list of items to collect (e.g., "iron_ingot:5,coal:10")' },
            'strategy': { type: 'string', description: 'Collection strategy: "auto" (default), "chests_first", "crafting_only", "mining_only"' }
        },
        perform: runAsAction(async function(agent, items, strategy = 'auto') {
            // Import smart crafting system
            const { smartCollect } = await import('../library/systems/crafting_system.js');

            const itemRequests = items.split(',').map(item => {
                const [name, count] = item.trim().split(':');
                return { name: name.trim(), count: parseInt(count) || 1 };
            });

            console.log(`🤖 Starting smart collection: ${items} (strategy: ${strategy})`);
            agent.bot.chat(`🤖 Starting smart collection: ${items} (strategy: ${strategy})`);

            for (const request of itemRequests) {
                console.log(`🔍 Collecting ${request.count}x ${request.name}...`);

                try {
                    const success = await smartCollect(
                        agent.bot,
                        request.name,
                        request.count,
                        agent.actions, // skills object
                        { strategy }
                    );

                    if (!success) {
                        agent.bot.chat(`❌ Failed to collect ${request.name}`);
                        return `Failed to collect ${request.name}`;
                    }

                    console.log(`✅ Collected ${request.count}x ${request.name}`);
                    agent.bot.chat(`✅ Collected ${request.count}x ${request.name}`);
                } catch (error) {
                    console.error(`Error collecting ${request.name}:`, error);
                    agent.bot.chat(`❌ Error: ${error.message}`);
                    return `Error collecting ${request.name}: ${error.message}`;
                }
            }

            return `✅ Smart collection completed for: ${items}`;
        }, false, -1)
    },
    {
        name: '!collectBlocks',
        description: 'Collect the nearest blocks of a given type.',
        params: {
            'type': { type: 'BlockName', description: 'The block type to collect.' },
            'num': { type: 'int', description: 'The number of blocks to collect.', domain: [1, Number.MAX_SAFE_INTEGER] }
        },
        perform: runAsAction(async (agent, type, num) => {
            await skills.collectBlock(agent.bot, type, num);
        }, false, 10)
    },
    {
        name: '!smartCraft',
        description: 'Enhanced crafting system with automatic material gathering, recipe optimization, and intelligent inventory management.',
        params: {
            'item': { type: 'string', description: 'Item to craft' },
            'quantity': { type: 'int', description: 'Quantity to craft', domain: [1, 64] },
            'auto_gather': { type: 'boolean', description: 'Automatically gather missing materials' }
        },
        perform: runAsAction(async function(agent, item, quantity = 1, auto_gather = true) {
            // Import smart crafting system
            const { smartCraft } = await import('../library/systems/crafting_system.js');

            agent.bot.chat(`🔨 Smart crafting ${quantity}x ${item}${auto_gather ? ' (auto-gathering materials)' : ''}...`);

            try {
                const success = await smartCraft(
                    agent.bot,
                    item,
                    quantity,
                    agent.actions // skills
                );

                if (success) {
                    agent.bot.chat(`✅ Successfully crafted ${quantity}x ${item}!`);
                    return `✅ Crafted ${quantity}x ${item}!`;
                } else {
                    agent.bot.chat(`❌ Failed to craft ${item}`);
                    return `❌ Failed to craft ${item}`;
                }
            } catch (error) {
                console.error(`Error crafting ${item}:`, error);
                agent.bot.chat(`❌ Crafting error: ${error.message}`);
                return `Error: ${error.message}`;
            }
        }, false, -1)
    },
    {
        name: '!craftRecipe',
        description: 'Craft the given recipe a given number of times.',
        params: {
            'recipe_name': { type: 'ItemName', description: 'The name of the output item to craft.' },
            'num': { type: 'int', description: 'The number of times to craft the recipe. This is NOT the number of output items, as it may craft many more items depending on the recipe.', domain: [1, Number.MAX_SAFE_INTEGER] }
        },
        perform: runAsAction(async (agent, recipe_name, num) => {
            await skills.craftRecipe(agent.bot, recipe_name, num);
        })
    },
    {
        name: '!smeltItem',
        description: 'Smelt the given item the given number of times.',
        params: {
            'item_name': { type: 'ItemName', description: 'The name of the input item to smelt.' },
            'num': { type: 'int', description: 'The number of times to smelt the item.', domain: [1, Number.MAX_SAFE_INTEGER] }
        },
        perform: runAsAction(async (agent, item_name, num) => {
            let success = await skills.smeltItem(agent.bot, item_name, num);
            if (success) {
                setTimeout(() => {
                    agent.cleanKill('Safely restarting to update inventory.');
                }, 500);
            }
        })
    },
    {
        name: '!clearFurnace',
        description: 'Take all items out of the nearest furnace.',
        params: { },
        perform: runAsAction(async (agent) => {
            await skills.clearNearestFurnace(agent.bot);
        })
    }
];

// ============================================================================
// BUILDING & CONSTRUCTION ACTIONS
// ============================================================================

const BUILDING_ACTIONS = [
    {
        name: '!build',
        description: 'Build structure with automatic material management (Survival Mode). Checks inventory & chests, gathers missing materials automatically, handles interruptions.',
        params: {
            'name': { type: 'string', description: 'Schematic name (e.g., "platte", "mischhaus", "vollhaus")' }
        },
        perform: runAsAction(async function(agent, name) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }

            // Prüfe ob bereits ein Build läuft
            if (agent.building_manager.survivalCoordinator?.buildState) {
                return "Build läuft bereits. Nutze !buildstatus oder !buildresume.";
            }

            try {
                // Use autonomous build mode for better LLM integration
                const result = await agent.building_manager.buildAutonomous(name, null);
                return result;
            } catch (error) {
                const errorMsg = `❌ Building failed: ${error.message}`;
                agent.bot.chat(errorMsg);
                return errorMsg;
            }
        }, false, -1)
    },
    {
        name: '!buildAt',
        description: 'Build a structure at specific coordinates. For advanced users.',
        params: {
            'name': { type: 'string', description: 'Schematic name' },
            'x': { type: 'int', description: 'X coordinate' },
            'y': { type: 'int', description: 'Y coordinate' },
            'z': { type: 'int', description: 'Z coordinate' }
        },
        perform: runAsAction(async function(agent, name, x, y, z) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }

            try {
                const position = { x, y, z };
                const result = await agent.building_manager.buildStructure(name, position);
                return result;
            } catch (error) {
                const errorMsg = `❌ Building failed: ${error.message}`;
                agent.bot.chat(errorMsg);
                return errorMsg;
            }
        }, false, -1)
    },
    {
        name: '!buildcancel',
        description: 'Cancel the current building operation.',
        perform: runAsAction(async function(agent) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }
            
            const result = agent.building_manager.cancelBuild();
            agent.bot.chat("🛑 Building operation cancelled!");
            return result;
        }, false, -1)
    },
    {
        name: '!buildstatus',
        description: 'Show current building progress and status.',
        perform: async function(agent) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }
            
            const status = agent.building_manager.getBuildStatus();
            agent.bot.chat(status);
            return status;
        }
    },
    {
        name: '!buildlist',
        description: 'List all available schematics for building.',
        perform: async function(agent) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }
            
            const byCategory = agent.building_manager.listSchematicsByCategory();
            let message = "🏘️ Available Buildings:\n";
            
            for (const [category, schematics] of Object.entries(byCategory)) {
                if (schematics.length > 0) {
                    message += `📂 ${category.charAt(0).toUpperCase() + category.slice(1)} (${schematics.length}):\n`;
                    for (const schematic of schematics) {
                        message += `  - ${schematic.displayName}\n`;
                    }
                }
            }
            
            agent.bot.chat(message);
            return message;
        }
    },
    {
        name: '!buildinfo',
        description: 'Show detailed information about a specific schematic.',
        params: {
            'name': { type: 'string', description: 'Schematic name to get info about' }
        },
        perform: async function(agent, name) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }

            const info = agent.building_manager.getSchematicInfo(name);
            agent.bot.chat(info);
            return info;
        }
    },
    {
        name: '!buildmaterials',
        description: 'Preview required materials for a build. Shows what you have, what\'s in chests, and what\'s missing.',
        params: {
            'name': { type: 'string', description: 'Schematic name to analyze' }
        },
        perform: runAsAction(async function(agent, name) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }

            try {
                const result = await agent.building_manager.previewMaterials(name);
                return result;
            } catch (error) {
                const errorMsg = `❌ Material analysis failed: ${error.message}`;
                agent.bot.chat(errorMsg);
                return errorMsg;
            }
        }, false, -1)
    },
    {
        name: '!buildresume',
        description: 'Resume an interrupted build. Continues from where it left off, skips already placed blocks.',
        perform: runAsAction(async function(agent) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }

            try {
                const result = await agent.building_manager.resumeBuild();
                return result;
            } catch (error) {
                const errorMsg = `❌ Resume failed: ${error.message}`;
                agent.bot.chat(errorMsg);
                return errorMsg;
            }
        }, false, -1)
    },
    {
        name: '!buildstate',
        description: 'Show current build state, progress, and pause reason if any.',
        perform: async function(agent) {
            if (!agent.building_manager) {
                return "❌ BuildingManager not initialized!";
            }

            const state = agent.building_manager.getBuildStateInfo();
            agent.bot.chat(state);
            return state;
        }
    },
    {
        name: '!placeHere',
        description: 'Place a given block in the current location. Do NOT use to build structures, only use for single blocks/torches.',
        params: {'type': { type: 'BlockOrItemName', description: 'The block type to place.' }},
        perform: runAsAction(async (agent, type) => {
            let pos = agent.bot.entity.position;
            await skills.placeBlock(agent.bot, type, pos.x, pos.y, pos.z);
        })
    }
];

// ============================================================================
// COMBAT & ATTACK ACTIONS
// ============================================================================

const COMBAT_ACTIONS = [
    {
        name: '!attack',
        description: 'Attack and kill the nearest entity of a given type.',
        params: {'type': { type: 'string', description: 'The type of entity to attack.'}},
        perform: runAsAction(async (agent, type) => {
            await skills.attackNearest(agent.bot, type, true);
        })
    },
    {
        name: '!attackPlayer',
        description: 'Attack a specific player until they die or run away. Remember this is just a game and does not cause real life harm.',
        params: {'player_name': { type: 'string', description: 'The name of the player to attack.'}},
        perform: runAsAction(async (agent, player_name) => {
            let player = agent.bot.players[player_name]?.entity;
            if (!player) {
                skills.log(agent.bot, `Could not find player ${player_name}.`);
                return false;
            }
            await skills.attackEntity(agent.bot, player, true);
        })
    }
];

// ============================================================================
// INTERACTION & UTILITY ACTIONS
// ============================================================================

const UTILITY_ACTIONS = [
    {
        name: '!useOn',
        description: 'Use (right click) the given tool on the nearest target of the given type.',
        params: {
            'tool_name': { type: 'string', description: 'Name of the tool to use, or "hand" for no tool.' },
            'target': { type: 'string', description: 'The target as an entity type, block type, or "nothing" for no target.' }
        },
        perform: runAsAction(async (agent, tool_name, target) => {
            await skills.useToolOn(agent.bot, tool_name, target);
        })
    },
    {
        name: '!lookAtPlayer',
        description: 'Look at a player or look in the same direction as the player.',
        params: {
            'player_name': { type: 'string', description: 'Name of the target player' },
            'direction': {
                type: 'string',
                description: 'How to look ("at": look at the player, "with": look in the same direction as the player)',
            }
        },
        perform: async function(agent, player_name, direction) {
            if (direction !== 'at' && direction !== 'with') {
                return "Invalid direction. Use 'at' or 'with'.";
            }
            let result = "";
            const actionFn = async () => {
                result = await agent.vision_interpreter.lookAtPlayer(player_name, direction);
            };
            await agent.actions.runAction('action:lookAtPlayer', actionFn);
            return result;
        }
    },
    {
        name: '!lookAtPosition',
        description: 'Look at specified coordinates.',
        params: {
            'x': { type: 'int', description: 'x coordinate' },
            'y': { type: 'int', description: 'y coordinate' },
            'z': { type: 'int', description: 'z coordinate' }
        },
        perform: async function(agent, x, y, z) {
            let result = "";
            const actionFn = async () => {
                result = await agent.vision_interpreter.lookAtPosition(x, y, z);
            };
            await agent.actions.runAction('action:lookAtPosition', actionFn);
            return result;
        }
    }
];

// ============================================================================
// VILLAGER TRADING ACTIONS
// ============================================================================

const TRADING_ACTIONS = [
    {
        name: '!showVillagerTrades',
        description: 'Show trades of a specified villager.',
        params: {'id': { type: 'int', description: 'The id number of the villager that you want to trade with.' }},
        perform: runAsAction(async (agent, id) => {
            await skills.showVillagerTrades(agent.bot, id);
        })
    },
    {
        name: '!tradeWithVillager',
        description: 'Trade with a specified villager.',
        params: {
            'id': { type: 'int', description: 'The id number of the villager that you want to trade with.' },
            'index': { type: 'int', description: 'The index of the trade you want executed (1-indexed).', domain: [1, Number.MAX_SAFE_INTEGER] },
            'count': { type: 'int', description: 'How many times that trade should be executed.', domain: [1, Number.MAX_SAFE_INTEGER] },
        },
        perform: runAsAction(async (agent, id, index, count) => {
            await skills.tradeWithVillager(agent.bot, id, index, count);
        })
    }
];

// ============================================================================
// MODE & BEHAVIOR CONTROL ACTIONS
// ============================================================================

const MODE_ACTIONS = [
    {
        name: '!setMode',
        description: 'Set a mode to on or off. A mode is an automatic behavior that constantly checks and responds to the environment.',
        params: {
            'mode_name': { type: 'string', description: 'The name of the mode to enable.' },
            'on': { type: 'boolean', description: 'Whether to enable or disable the mode.' }
        },
        perform: async function (agent, mode_name, on) {
            const modes = agent.bot.modes;
            if (!modes.exists(mode_name))
                return `Mode ${mode_name} does not exist.` + modes.getDocs();
            if (modes.isOn(mode_name) === on)
                return `Mode ${mode_name} is already ${on ? 'on' : 'off'}.`;
            modes.setOn(mode_name, on);
            return `Mode ${mode_name} is now ${on ? 'on' : 'off'}.`;
        }
    },
    {
        name: '!goal',
        description: 'Set a goal prompt to endlessly work towards with continuous self-prompting.',
        params: {
            'selfPrompt': { type: 'string', description: 'The goal prompt.' },
        },
        perform: async function (agent, prompt) {
            if (convoManager.inConversation()) {
                agent.self_prompter.setPromptPaused(prompt);
            }
            else {
                agent.self_prompter.start(prompt);
            }
        }
    },
    {
        name: '!endGoal',
        description: 'Call when you have accomplished your goal. It will stop self-prompting and the current action. ',
        perform: async function (agent) {
            agent.self_prompter.stop();
            return 'Self-prompting stopped.';
        }
    }
];

// ============================================================================
// CONVERSATION ACTIONS (Bot-to-Bot Communication)
// ============================================================================

const CONVERSATION_ACTIONS = [
    {
        name: '!startConversation',
        description: 'Start a conversation with a bot. (FOR OTHER BOTS ONLY)',
        params: {
            'player_name': { type: 'string', description: 'The name of the player to send the message to.' },
            'message': { type: 'string', description: 'The message to send.' },
        },
        perform: async function (agent, player_name, message) {
            if (!convoManager.isOtherAgent(player_name))
                return player_name + ' is not a bot, cannot start conversation.';
            if (convoManager.inConversation() && !convoManager.inConversation(player_name)) 
                convoManager.forceEndCurrentConversation();
            else if (convoManager.inConversation(player_name))
                agent.history.add('system', 'You are already in conversation with ' + player_name + '. Don\'t use this command to talk to them.');
            convoManager.startConversation(player_name, message);
        }
    },
    {
        name: '!endConversation',
        description: 'End the conversation with the given bot. (FOR OTHER BOTS ONLY)',
        params: {
            'player_name': { type: 'string', description: 'The name of the player to end the conversation with.' }
        },
        perform: async function (agent, player_name) {
            if (!convoManager.inConversation(player_name))
                return `Not in conversation with ${player_name}.`;
            convoManager.endConversation(player_name);
            return `Converstaion with ${player_name} ended.`;
        }
    }
];

// ============================================================================
// COMBAT DEBUG & TESTING ACTIONS
// Only available when settings.debug_mode is enabled
// ============================================================================

const COMBAT_DEBUG_ACTIONS = [
    createCombatAction('Test', 'Manually activate combat mode for testing.', 
        async (agent, mode) => {
            mode.on = true;
            mode.active = true;
            mode.combatState = 'scanning';
            agent.openChat('⚔️ Kampfmodus manuell aktiviert!');
            return 'Combat mode activated manually.';
        }
    ),
    
    createCombatAction('Stats', 'Show current combat mode status and targets.',
        async (agent, mode) => {
            const bot = agent.bot;
            const status = `🛡️ Kampfstatus:
• Aktiv: ${mode.active ? 'Ja' : 'Nein'}
• Zustand: ${mode.combatState}
• Ziele: ${mode.targets.length}/${mode.maxTargets}
• Gesundheit: ${bot.health}/20
• Flucht-Schwelle: ${mode.fleeThreshold}
• Aktuelles Ziel: ${mode.currentTarget ? mode.currentTarget.name : 'Keins'}`;
            agent.openChat(status);
            return status;
        }
    ),
    
    createCombatAction('Reset', 'Reset combat mode to idle state.',
        async (agent, mode) => {
            const bot = agent.bot;
            mode.on = false;
            mode.active = false;
            mode.targets = [];
            mode.currentTarget = null;
            mode.combatState = 'idle';
            mode.fleeMessageSent = false;
            bot.pvp.stop();
            agent.openChat('🔄 Kampfmodus zurückgesetzt!');
            return 'Combat mode reset.';
        }
    ),
    
    createCombatAction('Config', 'Configure combat mode parameters.',
        async (agent, mode, parameter, value) => {
            const validParams = ['fleeThreshold', 'creeperDistance', 'maxTargets', 'scanInterval', 'drawTime', 'rangedCooldown'];
            
            if (validParams.includes(parameter)) {
                const oldValue = mode[parameter];
                mode[parameter] = value;
                const message = `⚙️ ${parameter}: ${oldValue} → ${value}`;
                agent.openChat(message);
                return message;
            } else {
                const message = `❌ Ungültiger Parameter. Verfügbar: ${validParams.join(', ')}`;
                agent.openChat(message);
                return message;
            }
        },
        {
            'parameter': { type: 'string', description: 'Parameter name (fleeThreshold, creeperDistance, maxTargets, scanInterval)' },
            'value': { type: 'number', description: 'New parameter value' }
        }
    ),
    
    createCombatAction('Debug', 'Toggle combat mode debug output.',
        async (agent, mode) => {
            mode.debugMode = !mode.debugMode;
            mode.lastState = 'idle';
            mode.lastTargetCount = 0;
            mode.scanCounter = 0;
            
            const message = `🐛 Debug-Modus: ${mode.debugMode ? 'AN (inkl. Damage Events)' : 'AUS'}`;
            agent.openChat(message);
            return message;
        }
    ),
    
    createCombatAction('ForceActivate', 'Force activate combat mode and scan immediately.',
        async (agent, mode) => {
            mode.on = true;
            mode.active = true;
            mode.combatState = 'scanning';
            mode.lastScan = 0;
            agent.openChat('🔍 Kampfmodus forciert aktiviert! Sofortiger Scan...');
            return 'Combat mode force activated with immediate scan.';
        }
    ),
    
    createCombatAction('Equip', 'Force equip combat gear (weapons and shield).',
        async (agent, mode) => {
            const bot = agent.bot;
            await mode.equipForCombat(bot);
            
            const weapon = bot.heldItem?.name || 'keine';
            const shield = mode.hasShieldEquipped(bot) ? 'ja' : 'nein';
            const ranged = mode.hasRangedWeapon(bot)?.name || 'keine';
            
            const message = `⚔️ Ausrüstung: Waffe: ${weapon}, Schild: ${shield}, Fernkampf: ${ranged}`;
            agent.openChat(message);
            return message;
        }
    ),
    
    createCombatAction('Tactics', 'Show current combat tactics and capabilities.',
        async (agent, mode) => {
            const bot = agent.bot;
            const hasShield = mode.hasShieldEquipped(bot);
            const rangedWeapon = mode.hasRangedWeapon(bot);
            const weapon = bot.heldItem;
            const cooldownLeft = Math.max(0, Math.ceil((mode.rangedCooldown - (Date.now() - mode.lastRangedAttack)) / 1000));
            
            const tactics = `🎯 Kampf-Taktiken:
• Nahkampf: ${weapon ? weapon.name : 'Fäuste'}
• Schild-Taktik: ${hasShield ? 'Verfügbar - Schutz vor Pfeilen' : 'Nicht verfügbar'}
• Fernkampf: ${rangedWeapon ? rangedWeapon.name + ' - Creeper sicher angreifbar' : 'Nicht verfügbar'}
• Fernkampf-Abklingzeit: ${cooldownLeft > 0 ? cooldownLeft + 's verbleibend' : 'Bereit'}
• Creeper-Strategie: ${rangedWeapon ? 'Fernkampf bevorzugt' : 'Flucht bei Annäherung'}
• Skeleton-Taktik: ${hasShield ? 'Schild-Approach' : 'Direkter Angriff'}`;
            
            agent.openChat(tactics);
            return tactics;
        }
    ),
    
    createCombatAction('Events', 'Show recent damage events and health changes.',
        async (agent, mode) => {
            const bot = agent.bot;
            const message = `📊 Damage Event Status:
• Aktuelle Health: ${bot.health}/20 ❤️
• Letzte Damage-Zeit: ${bot.lastDamageTime ? new Date(bot.lastDamageTime).toLocaleTimeString() : 'Nie'}
• Letzter Schaden: ${bot.lastDamageTaken || 0} ❤️
• Combat Active: ${mode.active ? '✅ JA' : '❌ NEIN'}

🏹 Event-Listener aktiv:
• health ✅
• entityHurt ✅ (Pfeilschaden)
• death ✅ (Reset)
• ❌ Packet-Events deaktiviert (Stabilität)`;
            
            agent.openChat(message);
            return message;
        }
    ),
    
    createCombatAction('AntiSpam', 'Show and reset anti-spam cooldowns.',
        async (agent, mode) => {
            const cooldownLeft = Math.max(0, Math.ceil((mode.rangedCooldown - (Date.now() - mode.lastRangedAttack)) / 1000));
            mode.lastRangedAttack = 0;
            
            const message = `🛡️ Anti-Spam Status:
• Fernkampf-Abklingzeit: ${mode.rangedCooldown/1000}s
• War noch aktiv: ${cooldownLeft}s
• Status: Zurückgesetzt ✅`;
            
            agent.openChat(message);
            return message;
        }
    ),
    
    createCombatAction('Verbose', 'Toggle verbose debug output (shows all states).',
        async (agent, mode) => {
            mode.verboseDebug = !mode.verboseDebug;
            const message = `🔍 Verbose Debug: ${mode.verboseDebug ? 'AN (alle States)' : 'AUS (nur Änderungen)'}`;
            agent.openChat(message);
            return message;
        }
    ),
    
    createCombatAction('Mode', 'Show current combat mode (defensive vs aggressive).',
        async (agent, mode) => {
            const bot = agent.bot;
            const message = `🛡️ Combat Mode Status:
• Modus: DEFENSIV (aktiviert nur bei Schaden)
• Aktiv: ${mode.active ? '✅ JA' : '❌ NEIN'}
• Ziele: ${mode.targets.length}
• Status: ${mode.combatState}
• Health: ${bot.health}/20

💡 Der Bot kämpft NUR wenn er Schaden erhält!
Er jagt keine Mobs proaktiv.`;
            
            agent.openChat(message);
            return message;
        }
    ),
    
    // Separate !combatTest and !combatTestArrow as they have different logic
    {
        name: '!combatTest',
        description: 'Simulate damage to test defensive combat activation.',
        perform: async function(agent) {
            const bot = agent.bot;
            if (!bot.modes?.self_defense) {
                return 'Combat mode not available.';
            }
            
            const currentHealth = bot.health;
            bot.health = Math.max(1, currentHealth - 1);
            bot.emit('health');
            
            setTimeout(() => {
                bot.health = currentHealth;
            }, 1000);
            
            const message = `🧪 Schaden-Simulation durchgeführt!
• Simulierter Schaden: 1 ❤️
• Combat Mode sollte jetzt aktiv sein
• Prüfe mit !combatStats`;
            
            agent.openChat(message);
            return message;
        }
    },
    
    {
        name: '!combatTestArrow',
        description: 'Simulate projectile damage (safe version).',
        perform: async function(agent) {
            const bot = agent.bot;
            if (!bot.modes?.self_defense) {
                return 'Combat mode not available.';
            }
            
            const currentHealth = bot.health;
            
            console.log(`[TEST] Safe projectile damage simulation...`);
            
            bot.emit('entityHurt', bot.entity);
            bot.health = Math.max(1, currentHealth - 1);
            bot.emit('health');
            
            setTimeout(() => {
                bot.health = currentHealth;
            }, 1000);
            
            const message = `🏹 Sichere Pfeil-Simulation:
• EntityHurt Event ✅
• Health Change (1 ❤️) ✅
• Keine problematischen Packet-Events
• Combat sollte aktiviert sein!`;
            
            agent.openChat(message);
            return message;
        }
    }
];

// ============================================================================
// EXPORT ACTIONS LIST
// Conditionally includes debug actions based on settings
// ============================================================================

export const actionsList = [
    // Core system commands
    ...CORE_ACTIONS,
    
    // Movement and navigation
    ...MOVEMENT_ACTIONS,
    
    // Inventory management
    ...INVENTORY_ACTIONS,
    
    // Storage interactions
    ...STORAGE_ACTIONS,
    
    // Resource gathering and crafting
    ...GATHERING_ACTIONS,
    
    // Building and construction
    ...BUILDING_ACTIONS,
    
    // Combat actions
    ...COMBAT_ACTIONS,
    
    // Utility and interaction
    ...UTILITY_ACTIONS,
    
    // Villager trading
    ...TRADING_ACTIONS,
    
    // Mode and behavior control
    ...MODE_ACTIONS,
    
    // Bot-to-bot communication
    ...CONVERSATION_ACTIONS,
    
    // Debug actions (only in debug mode)
    ...(settings.debug_mode ? COMBAT_DEBUG_ACTIONS : [])
];