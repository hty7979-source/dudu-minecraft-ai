/**
 * Combat Mode - Advanced Combat System for Minecraft AI Bot
 * 
 * This module implements sophisticated combat logic with:
 * - Target prioritization and management
 * - Tactical combat decisions based on enemy type
 * - Ranged and melee weapon handling
 * - Defensive maneuvers and escape tactics
 */

import * as skills from '../library/skills.js';
import * as world from '../library/world.js';
import * as mc from '../../utils/mcdata.js';
import pf from 'mineflayer-pathfinder';

/**
 * Creates and returns the self_defense mode configuration
 * @param {Function} execute - Async execution wrapper from modes.js
 * @param {Function} say - Chat message function from modes.js
 * @returns {Object} Configured self_defense mode object
 */
export function createCombatMode(execute, say) {
    return {
        name: 'self_defense',
        description: 'Advanced combat mode with target management and tactical decisions',
        interrupts: ['cowardice'],
        on: true,
        active: false,
        
        // Combat state management
        targets: [],
        currentTarget: null,
        lastScan: 0,
        scanInterval: 2000,
        combatState: 'idle',
        
        // Combat thresholds and settings
        fleeThreshold: 5,
        creeperDistance: 7,
        maxTargets: 5,
        drawTime: 3000,
        lastRangedAttack: 0,
        rangedCooldown: 5000,
        
        // Anti-spam controls
        fleeMessageSent: false,
        lastChatMessage: 0,
        chatCooldown: 3000,
        lastAttackMessage: '',
        
        // Debug controls
        debugMode: false, // Reduced from excessive debug output
        verboseDebug: false,
        lastState: 'idle',
        lastTargetCount: 0,
        
        /**
         * Reset combat state to initial values
         * Called when mode is deactivated or needs to be cleared
         */
        reset: function() {
            this.targets = [];
            this.currentTarget = null;
            this.combatState = 'idle';
            this.fleeMessageSent = false;
            this.lastAttackMessage = '';
            this.lastScan = 0;
            this.lastRangedAttack = 0;
            this.lastChatMessage = 0;
            this.lastState = 'idle';
            this.lastTargetCount = 0;
        },
        
        update: async function (agent) {
            const bot = agent.bot;
            const now = Date.now();
            
            // Debug output only on state changes to reduce spam
            this.logStateChange();
            
            // 1. Radar scan for targets
            if (now - this.lastScan > this.scanInterval) {
                await this.scanForTargets(agent);
                this.lastScan = now;
            }
            
            // 2. Health check - flee if low health
            if (bot.health < this.fleeThreshold) {
                this.combatState = 'fleeing';
                execute(this, agent, async () => {
                    await this.handleFleeing(agent);
                });
                return;
            }
            
            // 3. Target management - idle if no targets
            if (this.targets.length === 0) {
                if (this.active) {
                    say(agent, "Combat mode deactivated - no enemies detected");
                    this.reset(); // Reset state when deactivating
                    this.active = false;
                }
                this.combatState = 'idle';
                return;
            }
            
            // 4. Creeper special handling
            const nearbyCreeper = this.getNearbyCreeper(bot);
            if (nearbyCreeper) {
                this.combatState = 'fleeing';
                execute(this, agent, async () => {
                    await this.handleCreeperEscape(agent, nearbyCreeper);
                });
                return;
            }
            
            // 5. Equipment check and preparation
            if (!this.hasWeaponEquipped(bot)) {
                this.combatState = 'equipping';
                await this.equipForCombat(bot);
            }
            
            // 6. Combat engagement
            if (this.currentTarget && !this.currentTarget.isRemoved) {
                this.combatState = 'engaging';
                execute(this, agent, async () => {
                    await this.engageTargetAdvanced(agent);
                });
            }
        },
        
        /**
         * Log state changes to reduce debug spam
         */
        logStateChange: function() {
            if (!this.debugMode) return;
            
            const currentState = `${this.combatState}-${this.targets.length}`;
            const lastState = `${this.lastState}-${this.lastTargetCount}`;
            
            if (this.verboseDebug || currentState !== lastState) {
                console.log(`[COMBAT] State: ${this.combatState}(${this.targets.length})`);
                this.lastState = this.combatState;
                this.lastTargetCount = this.targets.length;
            }
        },
        
        /**
         * Scan for hostile entities and update target list
         */
        scanForTargets: async function(agent) {
            const bot = agent.bot;
            const entities = bot.entities;
            const hostiles = [];
            
            // Collect hostile entities within range
            for (const entity of Object.values(entities)) {
                if (!entity || entity === bot.entity) continue;
                
                const distance = entity.position.distanceTo(bot.entity.position);
                if (distance > 12) continue; // Max detection range
                
                if (mc.isHostile(entity)) {
                    hostiles.push({
                        entity: entity,
                        distance: distance,
                        type: entity.name,
                        health: entity.health,
                        priority: this.calculatePriority(entity, distance)
                    });
                }
            }
            
            // Sort by priority and limit to max targets
            this.targets = hostiles
                .sort((a, b) => b.priority - a.priority)
                .slice(0, this.maxTargets);
            
            // Select primary target
            this.currentTarget = this.targets[0]?.entity || null;
            
            // Defensive activation only when very close or recently damaged
            if (this.targets.length > 0 && !this.active) {
                const veryCloseMobs = this.targets.filter(t => t.distance < 4);
                const recentDamage = bot.lastDamageTime && 
                    (Date.now() - bot.lastDamageTime < 10000);
                
                if (veryCloseMobs.length > 0 || recentDamage) {
                    this.sayCombat(agent, 
                        `Defensive activation: ${this.targets.length} enemies detected`);
                    this.active = true;
                }
            }
        },
        
        /**
         * Calculate target priority based on type and distance
         */
        calculatePriority: function(entity, distance) {
            let priority = 100 - distance; // Closer = higher priority
            
            // Adjust by mob type
            switch(entity.name) {
                case 'creeper':
                    priority -= 50; // Lower priority (flee instead)
                    break;
                case 'skeleton':
                case 'witch':
                    priority += 20; // Prioritize ranged enemies
                    break;
                case 'zombie':
                case 'spider':
                    priority += 10; // Standard melee enemies
                    break;
            }
            
            // Bonus for low health (easy kills)
            if (entity.health < 10) priority += 15;
            
            return priority;
        },
        
        /**
         * Get nearby creeper within danger distance
         */
        getNearbyCreeper: function(bot) {
            return world.getNearestEntityWhere(bot, 
                e => e.name === 'creeper', 
                this.creeperDistance
            );
        },
        
        /**
         * Handle creeper escape logic
         */
        handleCreeperEscape: async function(agent, creeper) {
            const bot = agent.bot;
            this.sayCombat(agent, "Creeper detected - executing escape maneuver!");
            
            await skills.avoidEnemies(bot, 12);
            
            // Remove creeper from target list after escape
            this.targets = this.targets.filter(t => t.entity !== creeper);
            if (this.currentTarget === creeper) {
                this.currentTarget = this.targets[0]?.entity || null;
            }
        },
        
        /**
         * Safe chat function with cooldown to prevent spam
         */
        sayCombat: function(agent, message) {
            const now = Date.now();
            
            // Check cooldown
            if (now - this.lastChatMessage < this.chatCooldown) {
                return false;
            }
            
            // Check for duplicate messages
            if (message === this.lastAttackMessage) {
                return false;
            }
            
            say(agent, message);
            this.lastChatMessage = now;
            this.lastAttackMessage = message;
            
            return true;
        },
        
        /**
         * Handle fleeing when health is low
         */
        handleFleeing: async function(agent) {
            const bot = agent.bot;
            
            if (!this.fleeMessageSent) {
                say(agent, "Critical health! Retreating to safety!");
                this.fleeMessageSent = true;
            }
            
            await skills.avoidEnemies(bot, 15);
            
            // Try to eat if possible
            await skills.eat(bot);
        },
        
        /**
         * Check if bot has a weapon equipped
         */
        hasWeaponEquipped: function(bot) {
            const heldItem = bot.heldItem;
            if (!heldItem) return false;
            
            const weaponTypes = ['sword', 'axe', 'trident'];
            return weaponTypes.some(type => heldItem.name.includes(type));
        },
        
        /**
         * Equip combat equipment (weapons and shield)
         */
        equipForCombat: async function(bot) {
            // 1. Equip weapon
            const weapons = bot.inventory.items().filter(item => 
                item.name.includes('sword') || 
                (item.name.includes('axe') && !item.name.includes('pickaxe')) ||
                item.name.includes('trident')
            );
            
            if (weapons.length > 0) {
                weapons.sort((a, b) => (b.attackDamage || 1) - (a.attackDamage || 1));
                await bot.equip(weapons[0], 'hand');
            }
            
            // 2. Equip shield if available
            const shield = bot.inventory.items().find(item => item.name.includes('shield'));
            if (shield && bot.equipment[1] !== shield) {
                await bot.equip(shield, 'off-hand');
            }
        },
        
        /**
         * Check if bot has shield equipped
         */
        hasShieldEquipped: function(bot) {
            const offHandItem = bot.inventory.slots[45];
            return offHandItem && offHandItem.name.includes('shield');
        },
        
        /**
         * Get ranged weapon if available
         */
        hasRangedWeapon: function(bot) {
            const rangedWeapons = bot.inventory.items().filter(item => 
                item.name.includes('bow') || item.name.includes('crossbow')
            );
            return rangedWeapons.length > 0 ? rangedWeapons[0] : null;
        },
        
        /**
         * Advanced combat engagement with tactical decisions
         */
        engageTargetAdvanced: async function(agent) {
            const bot = agent.bot;
            
            if (!this.currentTarget || this.currentTarget.isRemoved) {
                this.currentTarget = null;
                this.targets = this.targets.filter(t => !t.entity.isRemoved);
                this.currentTarget = this.targets[0]?.entity || null;
                return;
            }
            
            const distance = this.currentTarget.position.distanceTo(bot.entity.position);
            const targetType = this.currentTarget.name;
            
            // Tactical decisions based on enemy type
            if (targetType === 'creeper' && distance <= 10) {
                // Try ranged attack on creepers
                const rangedWeapon = this.hasRangedWeapon(bot);
                const now = Date.now();
                
                if (rangedWeapon && distance > 3 && 
                    (now - this.lastRangedAttack) > this.rangedCooldown) {
                    await this.useRangedWeapon(agent, rangedWeapon);
                    this.lastRangedAttack = now;
                    return;
                } else if (distance <= 3) {
                    // Too close - escape!
                    await this.handleCreeperEscape(agent, this.currentTarget);
                    return;
                }
            }
            
            // Ranged enemies - approach with shield if available
            if (['skeleton', 'witch'].includes(targetType) && distance > 3) {
                if (this.hasShieldEquipped(bot)) {
                    this.sayCombat(agent, `Shield tactics against ${targetType}`);
                    await this.approachWithShield(agent);
                    return;
                }
            }
            
            // Standard melee combat
            this.sayCombat(agent, `Engaging ${targetType} in combat`);
            const success = await skills.defendSelf(bot, 8);
            
            // Check if target was eliminated
            if (this.currentTarget.health <= 0 || this.currentTarget.isRemoved) {
                this.sayCombat(agent, "Target eliminated");
                this.targets = this.targets.filter(t => t.entity !== this.currentTarget);
                this.currentTarget = this.targets[0]?.entity || null;
            }
        },
        
        /**
         * Use ranged weapon against target
         */
        useRangedWeapon: async function(agent, weapon) {
            const bot = agent.bot;
            
            // Equip ranged weapon
            await bot.equip(weapon, 'hand');
            
            // Check for ammo
            const ammo = bot.inventory.items().find(item => 
                item.name.includes('arrow') || item.name.includes('bolt')
            );
            
            if (!ammo) {
                return false;
            }
            
            say(agent, `Firing ${weapon.name} at ${this.currentTarget.name}!`);
            
            try {
                await bot.lookAt(this.currentTarget.position.offset(0, 1, 0));
                
                bot.activateItem(); // Start drawing
                
                // Draw for specified time with periodic target tracking
                const drawSteps = Math.floor(this.drawTime / 500);
                for (let i = 0; i < drawSteps; i++) {
                    if (this.currentTarget && !this.currentTarget.isRemoved) {
                        try {
                            await bot.lookAt(this.currentTarget.position.offset(0, 1, 0));
                        } catch (e) {
                            // Ignore targeting errors during draw
                        }
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                bot.deactivateItem(); // Fire
                say(agent, "Shot fired!");
                
                return true;
            } catch (error) {
                console.log(`Failed to use ranged weapon: ${error.message}`);
                return false;
            }
        },
        
        /**
         * Approach target with shield protection
         */
        approachWithShield: async function(agent) {
            const bot = agent.bot;
            
            try {
                // Activate shield
                if (this.hasShieldEquipped(bot)) {
                    bot.activateItem(true); // off-hand activate
                }
                
                // Move to target with protection
                await bot.pathfinder.goto(new pf.goals.GoalFollow(this.currentTarget, 2));
                
                // Engage in melee combat
                await skills.defendSelf(bot, 3);
                
            } catch (error) {
                // Fallback to normal combat
                await skills.defendSelf(bot, 8);
            } finally {
                // Deactivate shield after combat
                bot.deactivateItem(true);
            }
        }
    };
}