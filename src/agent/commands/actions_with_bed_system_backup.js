import * as skills from '../library/skills.js';
import settings from '../settings.js';
import convoManager from '../conversation.js';
import * as buildingActions from './building_actions.js';


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
                agent.bot.chat(`Minimum search range is 32.`);
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
        description: 'Collect the nearest blocks of a given type. PREFER !smartCollect for better tool selection and wood type substitution.',
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
        description: 'DEPRECATED: Use !smartCraft instead. This command automatically redirects to smartCraft for backward compatibility.',
        params: {
            'recipe_name': { type: 'ItemName', description: 'The name of the output item to craft.' },
            'num': { type: 'int', description: 'The number of times to craft the recipe.', domain: [1, Number.MAX_SAFE_INTEGER] }
        },
        perform: runAsAction(async (agent, recipe_name, num) => {
            // Automatically redirect to smartCraft for backward compatibility
            agent.openChat(`🔄 Redirecting !craftRecipe to !smartCraft for better results...`);
            const success = await skills.smartCraft(agent.bot, recipe_name, num);
            if (success) {
                return `Successfully crafted ${num}x ${recipe_name} using smart crafting system!`;
            } else {
                return `Failed to craft ${num}x ${recipe_name}. Check if materials are available.`;
            }
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
    {
        name: '!smartCraft',
        description: 'Intelligently craft items using storage management and optimal resource planning. Automatically checks chests for materials, extracts what is needed, gathers missing items, and manages inventory space.',
        params: {
            'item_name': { type: 'ItemName', description: 'The name of the item to craft.' },
            'num': { type: 'int', description: 'The number of items to craft.', domain: [1, 64] }
        },
        perform: runAsAction(async (agent, item_name, num = 1) => {
            const success = await skills.smartCraft(agent.bot, item_name, num);
            if (success) {
                return `Successfully crafted ${num}x ${item_name} using smart crafting system!`;
            } else {
                return `Failed to craft ${num}x ${item_name}. Check if materials are available or storage is accessible.`;
            }
        })
    },
    {
        name: '!smartCollect',
        description: 'Intelligently collect blocks with automatic tool selection. Automatically equips the best available tool for each block type and uses optimal mining strategies.',
        params: {
            'type': { type: 'BlockName', description: 'The type of block to collect.' },
            'num': { type: 'int', description: 'The number of blocks to collect.', domain: [1, 64] }
        },
        perform: runAsAction(async (agent, type, num = 1) => {
            const success = await skills.smartCollect(agent.bot, type, num);
            if (success) {
                return `Successfully collected ${num}x ${type} using smart tool management!`;
            } else {
                return `Failed to collect ${num}x ${type}. Check if blocks are available nearby.`;
            }
        })
    },
    {
        name: '!enhancedMine',
        description: 'Enhanced mining with improved targeting and completion detection. Use this if normal collectBlocks has issues with block targeting or mining duration.',
        params: {
            'block_type': { type: 'BlockName', description: 'The type of block to mine.' },
            'count': { type: 'int', description: 'The number of blocks to mine.', domain: [1, 64] }
        },
        perform: runAsAction(async (agent, block_type, count = 1) => {
            try {
                const { createEnhancedMining } = await import('../library/enhanced_mining.js');
                const enhancedMiner = createEnhancedMining(agent.bot);
                const success = await enhancedMiner.enhancedCollectBlock(block_type, count);
                if (success) {
                    return `Successfully enhanced mined ${count}x ${block_type} with improved targeting!`;
                } else {
                    return `Enhanced mining failed for ${block_type}. No suitable blocks found.`;
                }
            } catch (error) {
                return `Enhanced mining error: ${error.message}`;
            }
        }, false, 10) // 10 minute timeout
    },
    {
        name: '!createTask',
        description: 'Create a complex multi-step task with automatic dependency resolution. Perfect for large building projects that require multiple materials and tools.',
        params: {
            'task_name': { type: 'string', description: 'Name for the task (e.g., "build_house", "craft_diamond_tools")' },
            'requirements': { type: 'string', description: 'JSON string of required items and quantities, e.g., \'{"stone_bricks": 64, "oak_doors": 2, "glass": 16}\'' }
        },
        perform: runAsAction(async (agent, task_name, requirements) => {
            try {
                const reqObj = JSON.parse(requirements);
                const task = await skills.createComplexTask(agent.bot, task_name, reqObj);
                
                const subtaskCount = task.subtasks.length;
                const estimatedTime = Math.ceil(task.subtasks.reduce((sum, st) => sum + (st.estimatedTime || 30), 0) / 60);
                
                return `Created complex task "${task_name}" with ${subtaskCount} subtasks. Estimated time: ${estimatedTime} minutes. Use !executeTask to start.`;
            } catch (error) {
                return `Failed to create task: ${error.message}. Make sure requirements is valid JSON format.`;
            }
        })
    },
    {
        name: '!executeTask',
        description: 'Execute the next task from the task queue. Automatically handles inventory management, tool upgrades, and resource gathering.',
        params: {},
        perform: runAsAction(async (agent) => {
            try {
                const success = await skills.executeTask(agent.bot);
                if (success) {
                    return 'Task executed successfully! Check inventory for results.';
                } else {
                    return 'No tasks in queue or task execution failed.';
                }
            } catch (error) {
                return `Task execution failed: ${error.message}`;
            }
        }, false, 30) // 30 minute timeout for complex tasks
    },
    {
        name: '!buildProject',
        description: 'Create and start a complete building project. Automatically plans all required materials, tools, and steps.',
        params: {
            'project_name': { type: 'string', description: 'Name of the building project' },
            'requirements': { type: 'string', description: 'JSON string of required building materials and quantities' }
        },
        perform: runAsAction(async (agent, project_name, requirements) => {
            try {
                const reqObj = JSON.parse(requirements);
                const project = await skills.createBuildingProject(agent.bot, project_name, reqObj);
                
                return `Created building project "${project_name}". Starting automatic execution...`;
            } catch (error) {
                return `Failed to create building project: ${error.message}`;
            }
        }, false, 60) // 60 minute timeout for building projects
    },
    {
        name: '!taskStatus',
        description: 'Show status of current tasks and memory overview. Displays task queue, completed tasks, and learned information.',
        params: {},
        perform: runAsAction(async (agent) => {
            try {
                const taskManager = await skills.getTaskManager(agent.bot);
                const memoryOverview = taskManager.getMemoryOverview();
                
                let status = '📋 **Task Status Overview:**\n\n';
                
                if (taskManager.taskQueue.length > 0) {
                    status += `🎯 **Queued Tasks:** ${taskManager.taskQueue.length}\n`;
                    for (const task of taskManager.taskQueue.slice(0, 3)) {
                        status += `  - ${task.name} (${task.subtasks.length} subtasks)\n`;
                    }
                }
                
                if (taskManager.currentTask) {
                    status += `🚀 **Current Task:** ${taskManager.currentTask.name}\n`;
                    status += `   Progress: ${taskManager.currentTask.progress.completed}/${taskManager.currentTask.progress.total}\n`;
                }
                
                status += `✅ **Completed Tasks:** ${memoryOverview.taskHistory.length}\n`;
                status += `🏗️ **Building Projects:** ${memoryOverview.buildingProjects.length}\n`;
                status += `🔧 **Tool Needs:** ${memoryOverview.toolUpgradeNeeds.length}\n`;
                status += `📦 **Storage Locations:** ${memoryOverview.storageLocations.length}\n`;
                
                return status;
            } catch (error) {
                return `Error getting task status: ${error.message}`;
            }
        })
    },
    {
        name: '!smelt',
        description: 'Smelt items in a furnace. Automatically manages fuel and furnace placement.',
        params: {
            'input_item': { type: 'ItemName', description: 'The item to smelt (e.g., "iron_ore", "raw_iron")' },
            'quantity': { type: 'int', description: 'Number of items to smelt', domain: [1, 64] },
            'fuel': { type: 'ItemName', description: 'Fuel type to use (optional, defaults to "coal")', optional: true }
        },
        perform: runAsAction(async (agent, input_item, quantity, fuel = 'coal') => {
            const success = await skills.smeltItems(agent.bot, input_item, quantity, fuel);
            if (success) {
                return `Successfully smelted ${quantity}x ${input_item}!`;
            } else {
                return `Failed to smelt ${input_item}. Check if furnace and fuel are available.`;
            }
        }, false, 15) // 15 minute timeout
    },
    {
        name: '!placeBed',
        description: 'Place a bed at the specified coordinates with optional color and direction.',
        params: {
            'color': { type: 'string', description: 'Bed color (white, red, blue, green, etc.)', optional: true },
            'x': { type: 'int', description: 'X coordinate' },
            'y': { type: 'int', description: 'Y coordinate' },
            'z': { type: 'int', description: 'Z coordinate' },
            'direction': { type: 'string', description: 'Direction to face (north, south, east, west)', optional: true }
        },
        perform: runAsAction(async (agent, color = 'red', x, y, z, direction = null) => {
            const success = await buildingActions.placeBed(agent, color, x, y, z, direction);
            if (success) {
                return `Successfully placed ${color} bed at ${x}, ${y}, ${z}!`;
            } else {
                return `Failed to place ${color} bed. Check inventory and space availability.`;
            }
        })
    },
    {
        name: '!buildHouse',
        description: 'Build a simple 5x5 house with bed, door, windows and lighting.',
        params: {
            'x': { type: 'int', description: 'X coordinate for house foundation' },
            'y': { type: 'int', description: 'Y coordinate for house foundation' },
            'z': { type: 'int', description: 'Z coordinate for house foundation' }
        },
        perform: runAsAction(async (agent, x, y, z) => {
            const success = await buildingActions.buildSimpleHouse(agent, x, y, z);
            if (success) {
                return `Successfully built house at ${x}, ${y}, ${z}!`;
            } else {
                return `Failed to build house. Check materials availability.`;
            }
        }, false, 10) // 10 minute timeout
    },
    {
        name: '!buildBedRow',
        description: 'Build a row of beds with specified spacing and color.',
        params: {
            'x': { type: 'int', description: 'Starting X coordinate' },
            'y': { type: 'int', description: 'Y coordinate' },
            'z': { type: 'int', description: 'Z coordinate' },
            'count': { type: 'int', description: 'Number of beds to place', domain: [1, 20], optional: true },
            'spacing': { type: 'int', description: 'Space between beds in blocks', domain: [2, 10], optional: true },
            'color': { type: 'string', description: 'Bed color', optional: true }
        },
        perform: runAsAction(async (agent, x, y, z, count = 5, spacing = 3, color = 'white') => {
            const success = await buildingActions.buildBedRow(agent, x, y, z, count, spacing, color);
            if (success) {
                return `Successfully built ${count} ${color} beds in a row!`;
            } else {
                return `Failed to build bed row. Check materials and space.`;
            }
        }, false, 5) // 5 minute timeout
    },
    {
        name: '!placeDoor',
        description: 'Place a door at the specified coordinates.',
        params: {
            'doorType': { type: 'string', description: 'Door type (oak_door, iron_door, etc.)', optional: true },
            'x': { type: 'int', description: 'X coordinate' },
            'y': { type: 'int', description: 'Y coordinate' },
            'z': { type: 'int', description: 'Z coordinate' },
            'direction': { type: 'string', description: 'Direction to face (north, south, east, west)', optional: true }
        },
        perform: runAsAction(async (agent, doorType = 'oak_door', x, y, z, direction = null) => {
            const success = await buildingActions.placeDoor(agent, doorType, x, y, z, direction);
            if (success) {
                return `Successfully placed ${doorType} at ${x}, ${y}, ${z}!`;
            } else {
                return `Failed to place ${doorType}. Check inventory and space.`;
            }
        })
    },
    {
        name: '!buildBedroom',
        description: 'Build a bedroom with walls, roof, door, and multiple beds.',
        params: {
            'x': { type: 'int', description: 'Starting X coordinate' },
            'y': { type: 'int', description: 'Y coordinate' },
            'z': { type: 'int', description: 'Z coordinate' },
            'width': { type: 'int', description: 'Width of the bedroom', domain: [5, 15], optional: true },
            'depth': { type: 'int', description: 'Depth of the bedroom', domain: [5, 15], optional: true },
            'bedColor': { type: 'string', description: 'Color of beds to place', optional: true }
        },
        perform: runAsAction(async (agent, x, y, z, width = 7, depth = 5, bedColor = 'blue') => {
            const success = await buildingActions.buildBedroom(agent, x, y, z, width, depth, bedColor);
            if (success) {
                return `Successfully built ${width}x${depth} bedroom with ${bedColor} beds!`;
            } else {
                return `Failed to build bedroom. Check materials availability.`;
            }
        }, false, 15) // 15 minute timeout
    },
];
