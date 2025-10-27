/**
 * @fileoverview Event handlers for the Minecraft bot
 * Separated from main Agent class for better maintainability
 */

import { handleEnglishTranslation } from '../utils/translator.js';
import { COMBAT, TIME_OF_DAY, TIMING } from '../config/constants.js';
import convoManager from './conversation.js';
import { serverProxy } from './mindserver_proxy.js';
import settings from './settings.js';

/**
 * Sets up all event handlers for the bot
 * @param {Agent} agent - The agent instance
 * @param {Object} save_data - Optional saved data to restore state
 * @param {string} init_message - Optional initialization message
 */
export async function setupEventHandlers(agent, save_data, init_message) {
    const ignore_messages = [
        "Set own game mode to",
        "Set the time to",
        "Set the difficulty to",
        "Teleported ",
        "Set the weather to",
        "Gamerule "
    ];

    const respondFunc = async (username, message) => {
        if (message === "") return;
        if (username === agent.name) return;
        if (settings.only_chat_with.length > 0 && !settings.only_chat_with.includes(username)) return;
        try {
            if (ignore_messages.some((m) => message.startsWith(m))) return;

            agent.shut_up = false;

            console.log(agent.name, 'received message from', username, ':', message);

            if (convoManager.isOtherAgent(username)) {
                console.warn('received whisper from other bot??')
            }
            else {
                let translation = await handleEnglishTranslation(message);
                agent.handleMessage(username, translation);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    agent.respondFunc = respondFunc;

    agent.bot.on('whisper', respondFunc);

    agent.bot.on('chat', (username, message) => {
        if (serverProxy.getNumOtherAgents() > 0) return;
        // Only respond to open chat messages when there are no other agents
        respondFunc(username, message);
    });

    // Handle saved state
    if (save_data?.self_prompt) {
        if (init_message) {
            agent.history.add('system', init_message);
        }
        await agent.self_prompter.handleLoad(save_data.self_prompt, save_data.self_prompting_state);
    }
    if (save_data?.last_sender) {
        agent.last_sender = save_data.last_sender;
        if (convoManager.otherAgentInGame(agent.last_sender)) {
            const msg_package = {
                message: `You have restarted and this message is auto-generated. Continue the conversation with me.`,
                start: true
            };
            convoManager.receiveFromBot(agent.last_sender, msg_package);
        }
    }
    else if (init_message) {
        await agent.handleMessage('system', init_message, 2);
    }
    else {
        agent.openChat("Hello world! I am " + agent.name);
    }
}

/**
 * Sets up time-based custom events
 * @param {Object} bot - The Mineflayer bot instance
 */
export function setupTimeEvents(bot) {
    bot.on('time', () => {
        if (bot.time.timeOfDay == TIME_OF_DAY.SUNRISE)
            bot.emit('sunrise');
        else if (bot.time.timeOfDay == TIME_OF_DAY.NOON)
            bot.emit('noon');
        else if (bot.time.timeOfDay == TIME_OF_DAY.SUNSET)
            bot.emit('sunset');
        else if (bot.time.timeOfDay == TIME_OF_DAY.MIDNIGHT)
            bot.emit('midnight');
    });
}

/**
 * Sets up health and combat-related events
 * @param {Agent} agent - The agent instance
 */
export function setupHealthEvents(agent) {
    let prev_health = agent.bot.health;
    agent.bot.lastDamageTime = 0;
    agent.bot.lastDamageTaken = 0;

    /**
     * Activates combat mode when damage is taken
     * @param {number} damageAmount - Amount of damage taken
     * @param {string} damageSource - Source of damage
     */
    const activateCombatOnDamage = (damageAmount, damageSource = 'unknown') => {
        if (agent.bot.modes && agent.bot.modes.self_defense) {
            if (!agent.bot.modes.self_defense.active) {
                console.log(`[COMBAT] ${damageSource} damage received (${damageAmount}) - Combat mode activated!`);
                console.log(`🛡️ Under attack! Combat mode activated (${damageAmount} damage, ${damageSource})`);
                agent.bot.modes.self_defense.on = true;
                agent.bot.modes.self_defense.active = true;
                // Immediate scan after activation
                agent.bot.modes.self_defense.lastScan = 0;
            }
        }
    };

    agent.bot.on('health', () => {
        if (agent.bot.health < prev_health) {
            agent.bot.lastDamageTime = Date.now();
            agent.bot.lastDamageTaken = prev_health - agent.bot.health;

            // Automatic combat mode activation on health change
            activateCombatOnDamage(agent.bot.lastDamageTaken, 'Health');
        }

        // Health monitoring for combat mode
        if (agent.bot.modes && agent.bot.modes.self_defense) {
            if (agent.bot.health < COMBAT.CRITICAL_HEALTH && agent.bot.modes.self_defense.active) {
                // Critical state is already handled in the mode itself
            }

            if (agent.bot.health > COMBAT.SAFE_HEALTH && agent.bot.modes.self_defense.fleeMessageSent) {
                agent.bot.modes.self_defense.fleeMessageSent = false;
            }
        }

        prev_health = agent.bot.health;
    });

    // Projectile damage detection
    agent.bot.on('entityHurt', (entity) => {
        if (entity === agent.bot.entity) {
            if (agent.bot.modes && agent.bot.modes.self_defense && agent.bot.modes.self_defense.debugMode) {
                console.log(`[COMBAT] EntityHurt event detected for bot`);
            }
            activateCombatOnDamage(1, 'Projectile');
        }
    });

    // Death events (for reset)
    agent.bot.on('death', () => {
        console.log(`[COMBAT] Death event - resetting combat mode`);
        if (agent.bot.modes && agent.bot.modes.self_defense) {
            agent.bot.modes.self_defense.active = false; // Reset on death
        }
    });
}

/**
 * Sets up error and disconnect event handlers
 * @param {Agent} agent - The agent instance
 */
export function setupErrorHandlers(agent) {
    agent.bot.on('error', (err) => {
        console.error('Error event!', err);
    });

    agent.bot.on('end', (reason) => {
        console.warn('Bot disconnected! Killing agent process.', reason)
        agent.cleanKill('Bot disconnected! Killing agent process.');
    });

    agent.bot.on('death', () => {
        agent.actions.cancelResume();
        agent.actions.stop();
    });

    agent.bot.on('kicked', (reason) => {
        console.warn('Bot kicked!', reason);
        agent.cleanKill('Bot kicked! Killing agent process.');
    });
}

/**
 * Sets up death message handler
 * @param {Agent} agent - The agent instance
 */
export function setupDeathMessageHandler(agent) {
    agent.bot.on('messagestr', async (message, _, jsonMsg) => {
        if (jsonMsg.translate && jsonMsg.translate.startsWith('death') && message.startsWith(agent.name)) {
            console.log('Agent died: ', message);
            let death_pos = agent.bot.entity.position;

            // Legacy memory
            agent.memory_bank.rememberPlace('last_death_position', death_pos.x, death_pos.y, death_pos.z);

            // New contextual memory - registriert Tod und startet Recovery
            agent.contextual_memory.recordDeath(
                Math.floor(death_pos.x),
                Math.floor(death_pos.y),
                Math.floor(death_pos.z)
            );

            let death_pos_text = null;
            if (death_pos) {
                death_pos_text = `x: ${death_pos.x.toFixed(2)}, y: ${death_pos.y.toFixed(2)}, z: ${death_pos.z.toFixed(2)}`;
            }
            let dimention = agent.bot.game.dimension;

            const timeRemaining = agent.contextual_memory.getRecoveryTimeRemaining();
            agent.handleMessage('system', `You died at position ${death_pos_text || "unknown"} in the ${dimention} dimension with the final message: '${message}'. Your items will despawn in ${timeRemaining} seconds! Death recovery will be automatically prioritized. Previous actions were stopped and you have respawned.`);
        }
    });
}

/**
 * Sets up idle event handler
 * @param {Agent} agent - The agent instance
 */
export function setupIdleHandler(agent) {
    agent.bot.on('idle', () => {
        agent.bot.clearControlStates();
        agent.bot.pathfinder.stop(); // Clear any lingering pathfinder
        agent.bot.modes.unPauseAll();
        setTimeout(() => {
            if (agent.isIdle()) {
                agent.actions.resumeAction();
            }
        }, TIMING.IDLE_RESUME_DELAY_MS);
    });
}

/**
 * Sets up all bot events - convenience function
 * @param {Agent} agent - The agent instance
 */
export function setupAllEvents(agent) {
    setupTimeEvents(agent.bot);
    setupHealthEvents(agent);
    setupErrorHandlers(agent);
    setupDeathMessageHandler(agent);
    setupIdleHandler(agent);
}
