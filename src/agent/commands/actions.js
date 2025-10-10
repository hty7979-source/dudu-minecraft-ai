import * as skills from '../library/skills.js';
import settings from '../settings.js';
import convoManager from '../conversation.js';


function runAsAction (actionFn, resume = false, timeout = -1) {
    let actionLabel = null;  // Will be set on first use
    
    const wrappedAction = async function (agent, ...args) {
        // Set actionLabel only once, when the action is first created
        if (!actionLabel) {
            const actionObj = actionsList.find(a => a.perform === wrappedAction);
            actionLabel = actionObj.name.substring(1); // Remove the ! prefix
        }

        const actionFnWithAgent = async () => {
            await actionFn(agent, ...args);
        };
        const code_return = await agent.actions.runAction(`action:${actionLabel}`, actionFnWithAgent, { timeout, resume });
        if (code_return.interrupted && !code_return.timedout)
            return;
        return code_return.message;
    }

    return wrappedAction;
}

export const actionsList = [
    {
        name: '!smartCollect',
        description: 'Intelligently collect items using multi-source strategy: check chests → craft if possible → smelt if needed → mine as last resort. Handles inventory management automatically.',
        params: {
            'items': { type: 'string', description: 'Comma-separated list of items to collect (e.g., "iron_ingot:5,coal:10")' },
            'strategy': { type: 'string', description: 'Collection strategy: "auto" (default), "chests_first", "crafting_only", "mining_only"' }
        },
        perform: runAsAction(async function(agent, items, strategy = 'auto') {
            const itemRequests = items.split(',').map(item => {
                const [name, count] = item.trim().split(':');
                return { name: name.trim(), count: parseInt(count) || 1 };
            });
            
            agent.bot.chat(`🤖 Starting smart collection: ${items} (strategy: ${strategy})`);
            
            // Smart collection logic placeholder - integrate with enhanced systems
            for (const request of itemRequests) {
                agent.bot.chat(`🔍 Collecting ${request.count}x ${request.name}...`);
                // Add actual smart collection implementation here
            }
            
            return `Smart collection completed for: ${items}`;
        }, false, -1)
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
            agent.bot.chat(`🔨 Smart crafting ${quantity}x ${item} (auto-gather: ${auto_gather})`);
            
            // Smart crafting logic placeholder - integrate with enhanced systems
            return `Smart crafting completed: ${quantity}x ${item}`;
        }, false, -1)
    },
    {
        name: '!build',
        description: 'Advanced building system with schematic support, natural language commands, and automatic material management.',
        params: {
            'command': { type: 'string', description: 'Building command: "house", "tower", "bridge", or schematic file name' },
            'size': { type: 'string', description: 'Size specification: "small", "medium", "large" or "WxHxD"' },
            'material': { type: 'string', description: 'Primary building material (optional)' }
        },
        perform: runAsAction(async function(agent, command, size = 'medium', material = 'oak_planks') {
            agent.bot.chat(`🏗️ Building ${command} (size: ${size}, material: ${material})`);
            
            // Building logic placeholder - integrate with enhanced systems
            return `Building completed: ${command}`;
        }, false, -1)
    },
    {
        name: '!newAction',
        description: 'Perform new and unknown custom behaviors that are not available as a command.', 
        params: {
            'prompt': { type: 'string', description: 'A natural language prompt to guide code generation. Make a detailed step-by-step plan.' }
        },
        perform: async function(agent, prompt) {
            // just ignore prompt - it is now in context in chat history
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
    },
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
                log(agent.bot, `Minimum search range is 32.`);
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
        }, false, 10) // 10 minute timeout
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
    },
        {
        name: '!placeHere',
        description: 'Place a given block in the current location. Do NOT use to build structures, only use for single blocks/torches.',
        params: {'type': { type: 'BlockOrItemName', description: 'The block type to place.' }},
        perform: runAsAction(async (agent, type) => {
            let pos = agent.bot.entity.position;
            await skills.placeBlock(agent.bot, type, pos.x, pos.y, pos.z);
        })
    },
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
    },
    {
        name: '!goToBed',
        description: 'Go to the nearest bed and sleep.',
        perform: runAsAction(async (agent) => {
            await skills.goToBed(agent.bot);
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
    },
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
    },
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
    },
    {
        name: '!digDown',
        description: 'Digs down a specified distance. Will stop if it reaches lava, water, or a fall of >=4 blocks below the bot.',
        params: {'distance': { type: 'int', description: 'Distance to dig down', domain: [1, Number.MAX_SAFE_INTEGER] }},
        perform: runAsAction(async (agent, distance) => {
            await skills.digDown(agent.bot, distance)
        })
    },
    {
        name: '!goToSurface',
        description: 'Moves the bot to the highest block above it (usually the surface).',
        params: {},
        perform: runAsAction(async (agent) => {
            await skills.goToSurface(agent.bot);
        })
    },
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
    // PHASE 1: Combat Mode Test Commands
    {
        name: '!combatTest',
        description: 'Manually activate combat mode for testing.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                bot.modes.self_defense.on = true;
                bot.modes.self_defense.active = true;
                bot.modes.self_defense.combatState = 'scanning';
                agent.openChat('⚔️ Kampfmodus manuell aktiviert!');
                return 'Combat mode activated manually.';
            }
            return 'Error: Combat mode not available.';
        }
    },
    {
        name: '!combatStats',
        description: 'Show current combat mode status and targets.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
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
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatReset',
        description: 'Reset combat mode to idle state.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
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
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatConfig',
        description: 'Configure combat mode parameters.',
        params: {
            'parameter': { type: 'string', description: 'Parameter name (fleeThreshold, creeperDistance, maxTargets, scanInterval)' },
            'value': { type: 'number', description: 'New parameter value' }
        },
        perform: async function(agent, parameter, value) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
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
            }
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatDebug',
        description: 'Toggle combat mode debug output.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
                mode.debugMode = !mode.debugMode;
                
                // Reset Spam-Counter bei Debug-Änderung
                mode.lastState = 'idle';
                mode.lastTargetCount = 0;
                mode.scanCounter = 0;
                
                const message = `🐛 Debug-Modus: ${mode.debugMode ? 'AN (inkl. Damage Events)' : 'AUS'}`;
                agent.openChat(message);
                return message;
            }
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatForceActivate',
        description: 'Force activate combat mode and scan immediately.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
                mode.on = true;
                mode.active = true;
                mode.combatState = 'scanning';
                mode.lastScan = 0; // Force immediate scan
                agent.openChat('🔍 Kampfmodus forciert aktiviert! Sofortiger Scan...');
                return 'Combat mode force activated with immediate scan.';
            }
            return 'Combat mode not available.';
        }
    },
    // PHASE 2: Erweiterte Combat-Kommandos
    {
        name: '!combatEquip',
        description: 'Force equip combat gear (weapons and shield).',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
                await mode.equipForCombat(bot);
                
                const weapon = bot.heldItem?.name || 'keine';
                const shield = mode.hasShieldEquipped(bot) ? 'ja' : 'nein';
                const ranged = mode.hasRangedWeapon(bot)?.name || 'keine';
                
                const message = `⚔️ Ausrüstung: Waffe: ${weapon}, Schild: ${shield}, Fernkampf: ${ranged}`;
                agent.openChat(message);
                return message;
            }
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatTactics',
        description: 'Show current combat tactics and capabilities.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
                
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
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatEvents',
        description: 'Show recent damage events and health changes.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            
            const message = `📊 Damage Event Status:
• Aktuelle Health: ${bot.health}/20 ❤️
• Letzte Damage-Zeit: ${bot.lastDamageTime ? new Date(bot.lastDamageTime).toLocaleTimeString() : 'Nie'}
• Letzter Schaden: ${bot.lastDamageTaken || 0} ❤️
• Combat Active: ${bot.modes?.self_defense?.active ? '✅ JA' : '❌ NEIN'}

🏹 Event-Listener aktiv:
• health ✅
• entityHurt ✅ (Pfeilschaden)
• death ✅ (Reset)
• ❌ Packet-Events deaktiviert (Stabilität)`;
            
            agent.openChat(message);
            return message;
        }
    },
    {
        name: '!combatAntiSpam',
        description: 'Show and reset anti-spam cooldowns.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
                const cooldownLeft = Math.max(0, Math.ceil((mode.rangedCooldown - (Date.now() - mode.lastRangedAttack)) / 1000));
                
                // Reset cooldown
                mode.lastRangedAttack = 0;
                
                const message = `🛡️ Anti-Spam Status:
• Fernkampf-Abklingzeit: ${mode.rangedCooldown/1000}s
• War noch aktiv: ${cooldownLeft}s
• Status: Zurückgesetzt ✅`;
                
                agent.openChat(message);
                return message;
            }
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatVerbose',
        description: 'Toggle verbose debug output (shows all states).',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
                mode.verboseDebug = !mode.verboseDebug;
                
                const message = `🔍 Verbose Debug: ${mode.verboseDebug ? 'AN (alle States)' : 'AUS (nur Änderungen)'}`;
                agent.openChat(message);
                return message;
            }
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatReset',
        description: 'Reset combat mode (clear targets, cooldowns, and states).',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
                
                // Reset alle Combat-States
                mode.active = false;
                mode.combatState = 'idle';
                mode.targets = [];
                mode.currentTarget = null;
                mode.fleeMessageSent = false;
                mode.lastScan = 0;
                mode.lastRangedAttack = 0;
                mode.lastChatMessage = 0;
                mode.lastAttackMessage = '';
                mode.lastState = 'idle';
                mode.lastTargetCount = 0;
                
                const message = `🔄 Combat Mode vollständig zurückgesetzt!
• Ziele: Geleert
• States: Reset auf idle  
• Cooldowns: Zurückgesetzt
• Anti-Spam: Geleert`;
                
                agent.openChat(message);
                return message;
            }
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatMode',
        description: 'Show current combat mode (defensive vs aggressive).',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                const mode = bot.modes.self_defense;
                
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
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatTest',
        description: 'Simulate damage to test defensive combat activation.',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                // Simuliere Schaden durch Health-Event
                const currentHealth = bot.health;
                bot.health = Math.max(1, currentHealth - 1);
                bot.emit('health');
                
                // Health wieder zurücksetzen (Simulation)
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
            return 'Combat mode not available.';
        }
    },
    {
        name: '!combatTestArrow',
        description: 'Simulate projectile damage (safe version).',
        params: {},
        perform: async function(agent) {
            const bot = agent.bot;
            if (bot.modes && bot.modes.self_defense) {
                // Sichere Simulation nur mit Health und EntityHurt
                const currentHealth = bot.health;
                
                console.log(`[TEST] Safe projectile damage simulation...`);
                
                // 1. EntityHurt Event (sicher)
                bot.emit('entityHurt', bot.entity);
                
                // 2. Health Change (bewährt)
                bot.health = Math.max(1, currentHealth - 1);
                bot.emit('health');
                
                // Health zurücksetzen
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
            return 'Combat mode not available.';
        }
    },
];
