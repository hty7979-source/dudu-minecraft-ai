import * as skills from './library/skills.js';
import * as world from './library/world.js';
import * as mc from '../utils/mcdata.js';
import settings from './settings.js'
import convoManager from './conversation.js';
import pf from 'mineflayer-pathfinder';

async function say(agent, message) {
    agent.bot.modes.behavior_log += message + '\n';
    if (agent.shut_up || !settings.narrate_behavior) return;
    agent.openChat(message);
}

// a mode is a function that is called every tick to respond immediately to the world
// it has the following fields:
// on: whether 'update' is called every tick
// active: whether an action has been triggered by the mode and hasn't yet finished
// paused: whether the mode is paused by another action that overrides the behavior (eg followplayer implements its own self defense)
// update: the function that is called every tick (if on is true)
// when a mode is active, it will trigger an action to be performed but won't wait for it to return output

// the order of this list matters! first modes will be prioritized
// while update functions are async, they should *not* be awaited longer than ~100ms as it will block the update loop
// to perform longer actions, use the execute function which won't block the update loop
const modes_list = [
    {
        name: 'self_preservation',
        description: 'Respond to drowning, burning, and damage at low health. Interrupts all actions.',
        interrupts: ['all'],
        on: true,
        active: false,
        fall_blocks: ['sand', 'gravel', 'concrete_powder'], // includes matching substrings like 'sandstone' and 'red_sand'
        update: async function (agent) {
            const bot = agent.bot;
            let block = bot.blockAt(bot.entity.position);
            let blockAbove = bot.blockAt(bot.entity.position.offset(0, 1, 0));
            if (!block) block = {name: 'air'}; // hacky fix when blocks are not loaded
            if (!blockAbove) blockAbove = {name: 'air'};
            if (blockAbove.name === 'water') {
                // does not call execute so does not interrupt other actions
                if (!bot.pathfinder.goal) {
                    bot.setControlState('jump', true);
                }
            }
            else if (this.fall_blocks.some(name => blockAbove.name.includes(name))) {
                execute(this, agent, async () => {
                    await skills.moveAway(bot, 2);
                });
            }
            else if (block.name === 'lava' || block.name === 'fire' ||
                blockAbove.name === 'lava' || blockAbove.name === 'fire') {
                say(agent, 'I\'m on fire!');
                // if you have a water bucket, use it
                let waterBucket = bot.inventory.items().find(item => item.name === 'water_bucket');
                if (waterBucket) {
                    execute(this, agent, async () => {
                        let success = await skills.placeBlock(bot, 'water_bucket', block.position.x, block.position.y, block.position.z);
                        if (success) say(agent, 'Placed some water, ahhhh that\'s better!');
                    });
                }
                else {
                    execute(this, agent, async () => {
                        let waterBucket = bot.inventory.items().find(item => item.name === 'water_bucket');
                        if (waterBucket) {
                            let success = await skills.placeBlock(bot, 'water_bucket', block.position.x, block.position.y, block.position.z);
                            if (success) say(agent, 'Placed some water, ahhhh that\'s better!');
                            return;
                        }
                        let nearestWater = world.getNearestBlock(bot, 'water', 20);
                        if (nearestWater) {
                            const pos = nearestWater.position;
                            let success = await skills.goToPosition(bot, pos.x, pos.y, pos.z, 0.2);
                            if (success) say(agent, 'Found some water, ahhhh that\'s better!');
                            return;
                        }
                        await skills.moveAway(bot, 5);
                    });
                }
            }
            else if (Date.now() - bot.lastDamageTime < 3000 && (bot.health < 5 || bot.lastDamageTaken >= bot.health)) {
                say(agent, 'I\'m dying!');
                execute(this, agent, async () => {
                    await skills.moveAway(bot, 20);
                });
            }
            else if (agent.isIdle()) {
                bot.clearControlStates(); // clear jump if not in danger or doing anything else
            }
        }
    },
    {
        name: 'unstuck',
        description: 'Attempt to get unstuck when in the same place for a while. Interrupts some actions.',
        interrupts: ['all'],
        on: true,
        active: false,
        prev_location: null,
        distance: 2,
        stuck_time: 0,
        last_time: Date.now(),
        max_stuck_time: 120, // Increased from 20 to 120 seconds for mining operations
        prev_dig_block: null,
        update: async function (agent) {
            if (agent.isIdle()) { 
                this.prev_location = null;
                this.stuck_time = 0;
                return; // don't get stuck when idle
            }
            const bot = agent.bot;
            const cur_dig_block = bot.targetDigBlock;
            if (cur_dig_block && !this.prev_dig_block) {
                this.prev_dig_block = cur_dig_block;
            }
            if (this.prev_location && this.prev_location.distanceTo(bot.entity.position) < this.distance && cur_dig_block == this.prev_dig_block) {
                this.stuck_time += (Date.now() - this.last_time) / 1000;
            }
            else {
                this.prev_location = bot.entity.position.clone();
                this.stuck_time = 0;
                this.prev_dig_block = null;
            }
            const max_stuck_time = cur_dig_block?.name === 'obsidian' ? this.max_stuck_time * 2 : this.max_stuck_time;
            if (this.stuck_time > max_stuck_time) {
                say(agent, 'I\'m stuck!');
                this.stuck_time = 0;
                execute(this, agent, async () => {
                    const crashTimeout = setTimeout(() => { agent.cleanKill("Got stuck and couldn't get unstuck") }, 10000);
                    await skills.moveAway(bot, 5);
                    clearTimeout(crashTimeout);
                    say(agent, 'I\'m free.');
                });
            }
            this.last_time = Date.now();
        },
        unpause: function () {
            this.prev_location = null;
            this.stuck_time = 0;
            this.prev_dig_block = null;
        }
    },
    {
        name: 'cowardice',
        description: 'Run away from enemies. Interrupts all actions.',
        interrupts: ['all'],
        on: true,
        active: false,
        update: async function (agent) {
            const enemy = world.getNearestEntityWhere(agent.bot, entity => mc.isHostile(entity), 16);
            if (enemy && await world.isClearPath(agent.bot, enemy)) {
                say(agent, `Aaa! A ${enemy.name.replace("_", " ")}!`);
                execute(this, agent, async () => {
                    await skills.avoidEnemies(agent.bot, 24);
                });
            }
        }
    },
    {
        name: 'self_defense',
        description: 'Advanced combat mode with target management and tactical decisions',
        interrupts: ['cowardice'], // WICHTIG: Blockiert cowardice Modus!
        on: true,
        active: false,
        
        // PHASE 1: Neue Felder für erweiterten Kampfmodus
        targets: [],           // Target-Liste (max 5)
        currentTarget: null,   // Aktuelles Primärziel
        lastScan: 0,          // Timestamp letzter Scan
        scanInterval: 2000,   // Scan alle 2 Sekunden
        combatState: 'idle',  // idle, scanning, engaging, fleeing, equipping
        fleeThreshold: 5,     // HP-Schwelle für Flucht
        creeperDistance: 7,   // Sicherheitsabstand zu Creepern
        maxTargets: 5,        // Maximale Anzahl verfolgter Ziele
        fleeMessageSent: false, // Um Spam zu vermeiden
        debugMode: true,      // Aktiviert Debug-Ausgaben
        drawTime: 3000,       // PHASE 2: Spannzeit für Bogen/Armbrust in ms
        lastRangedAttack: 0,  // ANTI-SPAM: Letzte Fernkampf-Zeit
        rangedCooldown: 5000, // ANTI-SPAM: Abklingzeit zwischen Fernangriffen (ms)
        lastState: 'idle',    // DEBUG: Letzter Zustand für Änderungs-Detection
        lastTargetCount: 0,   // DEBUG: Letzte Zielanzahl für Spam-Reduktion
        verboseDebug: false,  // DEBUG: Zeigt alle States (statt nur Änderungen)
        lastChatMessage: 0,   // ANTI-SPAM: Letzte Chat-Nachricht Zeit
        chatCooldown: 3000,   // ANTI-SPAM: 3 Sekunden zwischen Combat-Chat-Nachrichten
        lastAttackMessage: '', // ANTI-SPAM: Letzte Attack-Nachricht (Duplikat-Schutz)
        
        update: async function (agent) {
            const bot = agent.bot;
            const now = Date.now();
            
            // DEBUG: Nur bei Änderungen ausgeben (Anti-Spam), oder bei verbose mode
            const currentState = `${this.combatState}-${this.targets.length}`;
            const lastState = `${this.lastState}-${this.lastTargetCount}`;
            
            if (this.debugMode && (this.verboseDebug || currentState !== lastState)) {
                if (this.verboseDebug || currentState !== lastState) {
                    console.log(`[COMBAT] ${this.verboseDebug ? 'Status' : 'Status-Änderung'}: ${this.combatState}(${this.targets.length}), Health: ${bot.health}`);
                }
                this.lastState = this.combatState;
                this.lastTargetCount = this.targets.length;
            }
            
            // 1. RADAR SCAN - Hybrid-Modus: Immer scannen, aber defensiv reagieren
            if (now - this.lastScan > this.scanInterval) {
                await this.scanForTargets(agent);
                this.lastScan = now;
            }
            
            // 2. HEALTH CHECK - Flucht bei niedrigem Leben
            if (bot.health < this.fleeThreshold) {
                this.combatState = 'fleeing';
                execute(this, agent, async () => {
                    await this.handleFleeing(agent);
                });
                return;
            }
            
            // 3. TARGET MANAGEMENT - Keine Ziele = Idle
            if (this.targets.length === 0) {
                if (this.active) {
                    say(agent, "🔄 Keine Feinde mehr - Kampfmodus deaktiviert");
                    this.active = false;
                }
                this.combatState = 'idle';
                return;
            }
            
            // 4. CREEPER CHECK - Spezialbehandlung
            const nearbyCreeper = this.getNearbyCreeper(bot);
            if (nearbyCreeper) {
                this.combatState = 'fleeing';
                execute(this, agent, async () => {
                    await this.handleCreeperEscape(agent, nearbyCreeper);
                });
                return;
            }
            
            // 5. EQUIPMENT CHECK - PHASE 2: Erweiterte Ausrüstung
            if (!this.hasWeaponEquipped(bot)) {
                this.combatState = 'equipping';
                await this.equipForCombat(bot);
            }
            
            // 6. COMBAT ENGAGEMENT - Nur wenn wir Ziele haben
            if (this.currentTarget && !this.currentTarget.isRemoved) {
                this.combatState = 'engaging';
                execute(this, agent, async () => {
                    await this.engageTargetAdvanced(agent);
                });
            }
        },
        
        // PHASE 1: Neue Helper-Funktionen
        scanForTargets: async function(agent) {
            const bot = agent.bot;
            const entities = bot.entities;
            const hostiles = [];
            
            const entityCount = Object.keys(entities).length;
            
            // Sammle alle feindlichen Entities im Radius
            for (const entity of Object.values(entities)) {
                if (!entity || entity === bot.entity) continue;
                
                const distance = entity.position.distanceTo(bot.entity.position);
                if (distance > 12) continue; // Max Radar-Reichweite
                
                if (mc.isHostile(entity)) {
                    if (this.debugMode) {
                        console.log(`[COMBAT] Found hostile: ${entity.name} at distance ${distance.toFixed(1)}`);
                    }
                    
                    hostiles.push({
                        entity: entity,
                        distance: distance,
                        type: entity.name,
                        health: entity.health,
                        priority: this.calculatePriority(entity, distance)
                    });
                }
            }
            
            // Sortiere und limitiere auf maxTargets
            this.targets = hostiles
                .sort((a, b) => b.priority - a.priority)
                .slice(0, this.maxTargets);
            
            // Wähle primäres Ziel
            this.currentTarget = this.targets[0]?.entity || null;
            
            // DEBUG: Scan-Ausgabe nur bei Änderungen (oder verbose mode)
            const scanChanged = this.targets.length !== this.lastTargetCount;
            if (this.debugMode && (this.verboseDebug || scanChanged)) {
                if (this.targets.length > 0) {
                    console.log(`[COMBAT] Scan-Ergebnis: ${this.targets.length} Feinde gefunden (Entities: ${entityCount})`);
                } else if (this.lastTargetCount > 0 || this.verboseDebug) {
                    console.log(`[COMBAT] Scan-Ergebnis: Keine Feinde mehr (Entities: ${entityCount})`);
                }
            }
            
            // DEFENSIVE AKTIVIERUNG: Nur bei sehr nahen Feinden oder wenn bereits Schaden erhalten
            if (this.targets.length > 0 && !this.active) {
                const veryCloseMobs = this.targets.filter(t => t.distance < 4); // Nur bei 4-Block-Radius
                const currentTime = Date.now();
                const recentDamage = bot.lastDamageTime && (currentTime - bot.lastDamageTime < 10000); // Letzte 10 Sekunden
                
                if (veryCloseMobs.length > 0 || recentDamage) {
                    const targetNames = this.targets.map(t => t.type).join(', ');
                    this.sayCombat(agent, `🛡️ Defensive Aktivierung: ${this.targets.length} Feinde (${veryCloseMobs.length} sehr nah)`);
                    this.active = true;
                }
            } else if (this.targets.length > 0 && this.active) {
                // Bereits aktiv - normale Target-Updates
                const targetNames = this.targets.map(t => t.type).join(', ');
                this.sayCombat(agent, `🎯 ${this.targets.length} Feinde erkannt: ${targetNames}`);
            }
            
            if (this.debugMode && this.targets.length > 0 && scanChanged) {
                console.log(`[COMBAT] Aktuelles Ziel: ${this.currentTarget?.name}, Gesamt: ${this.targets.length}`);
            }
        },
        
        calculatePriority: function(entity, distance) {
            let priority = 100 - distance; // Nähere Feinde = höhere Priorität
            
            // Anpassungen nach Mob-Typ
            switch(entity.name) {
                case 'creeper':
                    priority -= 50; // Niedrige Priorität (Flucht)
                    break;
                case 'skeleton':
                case 'witch':
                    priority += 20; // Fernkämpfer priorisieren
                    break;
                case 'zombie':
                case 'spider':
                    priority += 10; // Standard-Nahkämpfer
                    break;
            }
            
            // Bonus für niedrige Gesundheit (leichte Kills)
            if (entity.health < 10) priority += 15;
            
            return priority;
        },
        
        getNearbyCreeper: function(bot) {
            return world.getNearestEntityWhere(bot, 
                e => e.name === 'creeper', 
                this.creeperDistance
            );
        },
        
        handleCreeperEscape: async function(agent, creeper) {
            const bot = agent.bot;
            this.sayCombat(agent, `💥 Creeper-Flucht aktiviert!`);
            
            if (this.debugMode) {
                console.log(`[COMBAT] Fleeing from creeper at distance: ${creeper.position.distanceTo(bot.entity.position).toFixed(1)}`);
            }
            
            // Verwende execute für proper action handling
            await skills.avoidEnemies(bot, 12);
            
            // Entferne Creeper aus Zielliste nach Flucht
            this.targets = this.targets.filter(t => t.entity !== creeper);
            if (this.currentTarget === creeper) {
                this.currentTarget = this.targets[0]?.entity || null;
            }
        },
        
        // ANTI-SPAM: Sichere Chat-Funktion mit Cooldown
        sayCombat: function(agent, message) {
            const now = Date.now();
            
            // Prüfe Cooldown (3 Sekunden zwischen Combat-Nachrichten)
            if (now - this.lastChatMessage < this.chatCooldown) {
                return false; // Nachricht blockiert
            }
            
            // Prüfe auf Duplikat-Nachrichten
            if (message === this.lastAttackMessage) {
                return false; // Gleiche Nachricht blockiert
            }
            
            // Sende Nachricht
            say(agent, message);
            this.lastChatMessage = now;
            this.lastAttackMessage = message;
            
            if (this.debugMode) {
                console.log(`[COMBAT] Chat sent: ${message}`);
            }
            
            return true;
        },
        
        handleFleeing: async function(agent) {
            const bot = agent.bot;
            
            if (!this.fleeMessageSent) {
                say(agent, "❤️ Kritische Gesundheit! Ich ziehe mich zurück!");
                this.fleeMessageSent = true;
            }
            
            await skills.avoidEnemies(bot, 15);
            
            // Versuche zu essen wenn möglich
            await skills.consume(bot);
        },
        
        engageTarget: async function(agent) {
            const bot = agent.bot;
            
            if (!this.currentTarget || this.currentTarget.isRemoved) {
                if (this.debugMode) {
                    console.log(`[COMBAT] No valid target, switching to next`);
                }
                this.currentTarget = null;
                // Suche nächstes Ziel
                this.targets = this.targets.filter(t => !t.entity.isRemoved);
                this.currentTarget = this.targets[0]?.entity || null;
                return;
            }
            
            const distance = this.currentTarget.position.distanceTo(bot.entity.position);
            
            if (this.debugMode) {
                console.log(`[COMBAT] Engaging ${this.currentTarget.name} at distance ${distance.toFixed(1)}`);
            }
            
            // Anti-Spam: Sichere Attack-Nachricht
            this.sayCombat(agent, `🎯 Erstes Ziel wird angegriffen: ${this.currentTarget.name}`);
            
            // Nutze die bewährte defendSelf Funktion für Kampf-Logik
            const success = await skills.defendSelf(bot, 8);
            
            if (this.debugMode) {
                console.log(`[COMBAT] DefendSelf returned: ${success}`);
            }
            
            // Prüfe ob Ziel noch existiert
            if (this.currentTarget.health <= 0 || this.currentTarget.isRemoved) {
                this.sayCombat(agent, `✅ Gegner eliminiert`);
                this.targets = this.targets.filter(t => t.entity !== this.currentTarget);
                this.currentTarget = this.targets[0]?.entity || null;
                
                if (this.debugMode) {
                    console.log(`[COMBAT] Target eliminated, remaining targets: ${this.targets.length}`);
                }
            }
        },
        
        hasWeaponEquipped: function(bot) {
            const heldItem = bot.heldItem;
            if (!heldItem) return false;
            
            const weaponTypes = ['sword', 'axe', 'trident'];
            return weaponTypes.some(type => heldItem.name.includes(type));
        },
        
        // PHASE 2: Erweiterte Combat-Funktionen
        equipForCombat: async function(bot) {
            // 1. Waffe ausrüsten
            const weapons = bot.inventory.items().filter(item => 
                item.name.includes('sword') || 
                (item.name.includes('axe') && !item.name.includes('pickaxe')) ||
                item.name.includes('trident')
            );
            
            if (weapons.length > 0) {
                weapons.sort((a, b) => (b.attackDamage || 1) - (a.attackDamage || 1));
                await bot.equip(weapons[0], 'hand');
                if (this.debugMode) {
                    console.log(`[COMBAT] Equipped weapon: ${weapons[0].name}`);
                }
            }
            
            // 2. Schild ausrüsten falls vorhanden
            const shield = bot.inventory.items().find(item => item.name.includes('shield'));
            if (shield && bot.equipment[1] !== shield) { // off-hand slot
                await bot.equip(shield, 'off-hand');
                if (this.debugMode) {
                    console.log(`[COMBAT] Equipped shield: ${shield.name}`);
                }
            }
        },
        
        hasShieldEquipped: function(bot) {
            const offHandItem = bot.inventory.slots[45]; // off-hand slot
            return offHandItem && offHandItem.name.includes('shield');
        },
        
        hasRangedWeapon: function(bot) {
            const rangedWeapons = bot.inventory.items().filter(item => 
                item.name.includes('bow') || item.name.includes('crossbow')
            );
            return rangedWeapons.length > 0 ? rangedWeapons[0] : null;
        },
        
        engageTargetAdvanced: async function(agent) {
            const bot = agent.bot;
            
            if (!this.currentTarget || this.currentTarget.isRemoved) {
                if (this.debugMode) {
                    console.log(`[COMBAT] No valid target, switching to next`);
                }
                this.currentTarget = null;
                this.targets = this.targets.filter(t => !t.entity.isRemoved);
                this.currentTarget = this.targets[0]?.entity || null;
                return;
            }
            
            const distance = this.currentTarget.position.distanceTo(bot.entity.position);
            const targetType = this.currentTarget.name;
            
            if (this.debugMode) {
                console.log(`[COMBAT] Advanced engaging ${targetType} at distance ${distance.toFixed(1)}`);
            }
            
            // PHASE 2: Spezielle Taktiken für verschiedene Feinde
            if (targetType === 'creeper' && distance <= 10) {
                // Creeper mit Fernkampf angreifen falls möglich
                const rangedWeapon = this.hasRangedWeapon(bot);
                const now = Date.now();
                
                // Anti-Spam: Prüfe Abklingzeit
                if (rangedWeapon && distance > 3 && (now - this.lastRangedAttack) > this.rangedCooldown) {
                    await this.useRangedWeapon(agent, rangedWeapon);
                    this.lastRangedAttack = now;
                    return;
                } else if (rangedWeapon && (now - this.lastRangedAttack) <= this.rangedCooldown) {
                    // Abklingzeit noch aktiv - warten
                    const cooldownLeft = Math.ceil((this.rangedCooldown - (now - this.lastRangedAttack)) / 1000);
                    say(agent, `⏳ Fernkampf-Abklingzeit: ${cooldownLeft}s`);
                    return;
                } else {
                    // Zu nah oder keine Fernwaffe - fliehen!
                    await this.handleCreeperEscape(agent, this.currentTarget);
                    return;
                }
            }
            
            // Fernkämpfer (Skeleton, Witch) - Mit Schild nähern
            if (['skeleton', 'witch'].includes(targetType) && distance > 3) {
                if (this.hasShieldEquipped(bot)) {
                    this.sayCombat(agent, `🛡️ Schildtaktik gegen ${targetType}`);
                    await this.approachWithShield(agent);
                    return;
                }
            }
            
            // Standard Nahkampf - Anti-Spam
            this.sayCombat(agent, `⚔️ Greife ${targetType} an`);
            const success = await skills.defendSelf(bot, 8);
            
            if (this.debugMode) {
                console.log(`[COMBAT] DefendSelf returned: ${success}`);
            }
            
            // Target-Status prüfen
            if (this.currentTarget.health <= 0 || this.currentTarget.isRemoved) {
                this.sayCombat(agent, `✅ Ziel eliminiert`);
                this.targets = this.targets.filter(t => t.entity !== this.currentTarget);
                this.currentTarget = this.targets[0]?.entity || null;
                
                if (this.debugMode) {
                    console.log(`[COMBAT] Target eliminated, remaining targets: ${this.targets.length}`);
                }
            }
        },
        
        useRangedWeapon: async function(agent, weapon) {
            const bot = agent.bot;
            
            if (this.debugMode) {
                console.log(`[COMBAT] Using ranged weapon: ${weapon.name}`);
            }
            
            // Fernwaffe ausrüsten
            await bot.equip(weapon, 'hand');
            
            // Pfeile/Bolzen prüfen
            const ammo = bot.inventory.items().find(item => 
                item.name.includes('arrow') || item.name.includes('bolt')
            );
            
            if (!ammo) {
                if (this.debugMode) {
                    console.log(`[COMBAT] No ammo for ${weapon.name}`);
                }
                return false;
            }
            
            say(agent, `🏹 Schieße auf ${this.currentTarget.name}!`);
            
            // Ziel anvisieren und schießen
            try {
                await bot.lookAt(this.currentTarget.position.offset(0, 1, 0));
                
                if (this.debugMode) {
                    console.log(`[COMBAT] Drawing ${weapon.name}... (${this.drawTime/1000} seconds)`);
                }
                
                bot.activateItem(); // Spannen beginnen
                say(agent, `🎯 Spanne ${weapon.name}... ${this.drawTime/1000} Sekunden!`);
                
                // Anti-Spam: Längere Wartezeit statt kontinuierlicher Updates
                const drawSteps = Math.floor(this.drawTime / 500); // Alle 500ms ein Update
                for (let i = 0; i < drawSteps; i++) {
                    // Nur alle 500ms das Ziel neu anvisieren (Anti-Spam)
                    if (this.currentTarget && !this.currentTarget.isRemoved) {
                        try {
                            await bot.lookAt(this.currentTarget.position.offset(0, 1, 0));
                            if (this.debugMode) {
                                console.log(`[COMBAT] Tracking target ${i+1}/${drawSteps}`);
                            }
                        } catch (e) {
                            // Ignoriere Targeting-Fehler während Spannung
                        }
                    }
                    // Anti-Spam: 500ms Pause zwischen Updates
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // Restzeit warten falls nicht exakt teilbar
                const remainingTime = this.drawTime % 500;
                if (remainingTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
                
                bot.deactivateItem(); // Schießen
                say(agent, `🏹 Feuer!`);
                
                if (this.debugMode) {
                    console.log(`[COMBAT] Fired ${weapon.name} at ${this.currentTarget.name} after ${this.drawTime/1000}s draw`);
                }
                
                return true;
            } catch (error) {
                if (this.debugMode) {
                    console.log(`[COMBAT] Failed to use ranged weapon: ${error.message}`);
                }
                return false;
            }
        },
        
        approachWithShield: async function(agent) {
            const bot = agent.bot;
            
            try {
                // Schild aktivieren
                if (this.hasShieldEquipped(bot)) {
                    bot.activateItem(true); // off-hand aktivieren
                    
                    if (this.debugMode) {
                        console.log(`[COMBAT] Shield activated, approaching target`);
                    }
                }
                
                // Zum Ziel bewegen mit erhöhtem Schutz
                await bot.pathfinder.goto(new pf.goals.GoalFollow(this.currentTarget, 2));
                
                // Nach Annäherung normal kämpfen
                await skills.defendSelf(bot, 3);
                
            } catch (error) {
                if (this.debugMode) {
                    console.log(`[COMBAT] Shield approach failed: ${error.message}`);
                }
                // Fallback zu normalem Kampf
                await skills.defendSelf(bot, 8);
            } finally {
                // Schild deaktivieren nach Kampf
                bot.deactivateItem(true);
            }
        }
    },
    {
        name: 'hunting',
        description: 'Hunt nearby animals when idle.',
        interrupts: ['action:followPlayer'],
        on: true,
        active: false,
        update: async function (agent) {
            const huntable = world.getNearestEntityWhere(agent.bot, entity => mc.isHuntable(entity), 8);
            if (huntable && await world.isClearPath(agent.bot, huntable)) {
                execute(this, agent, async () => {
                    say(agent, `Hunting ${huntable.name}!`);
                    await skills.attackEntity(agent.bot, huntable);
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

        wait: 2, // number of seconds to wait after noticing an item to pick it up
        prev_item: null,
        noticed_at: -1,
        update: async function (agent) {
            let item = world.getNearestEntityWhere(agent.bot, entity => entity.name === 'item', 8);
            let empty_inv_slots = agent.bot.inventory.emptySlotCount();
            if (item && item !== this.prev_item && await world.isClearPath(agent.bot, item) && empty_inv_slots > 1) {
                if (this.noticed_at === -1) {
                    this.noticed_at = Date.now();
                }
                if (Date.now() - this.noticed_at > this.wait * 1000) {
                    say(agent, `Picking up item!`);
                    this.prev_item = item;
                    execute(this, agent, async () => {
                        await skills.pickupNearbyItems(agent.bot);
                    });
                    this.noticed_at = -1;
                }
            }
            else {
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
        cooldown: 5,
        last_place: Date.now(),
        update: function (agent) {
            if (world.shouldPlaceTorch(agent.bot)) {
                if (Date.now() - this.last_place < this.cooldown * 1000) return;
                execute(this, agent, async () => {
                    const pos = agent.bot.entity.position;
                    await skills.placeBlock(agent.bot, 'torch', pos.x, pos.y, pos.z, 'bottom', true);
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
        distance: 0.5,
        update: async function (agent) {
            const player = world.getNearestEntityWhere(agent.bot, entity => entity.type === 'player', this.distance);
            if (player) {
                execute(this, agent, async () => {
                    // wait a random amount of time to avoid identical movements with other bots
                    const wait_time = Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, wait_time));
                    if (player.position.distanceTo(agent.bot.entity.position) < this.distance) {
                        await skills.moveAwayFromEntity(agent.bot, player, this.distance);
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

        staring: false,
        last_entity: null,
        next_change: 0,
        update: function (agent) {
            const entity = agent.bot.nearestEntity();
            let entity_in_view = entity && entity.position.distanceTo(agent.bot.entity.position) < 10 && entity.name !== 'enderman';
            if (entity_in_view && entity !== this.last_entity) {
                this.staring = true;
                this.last_entity = entity;
                this.next_change = Date.now() + Math.random() * 1000 + 4000;
            }
            if (entity_in_view && this.staring) {
                let isbaby = entity.type !== 'player' && entity.metadata[16];
                let height = isbaby ? entity.height/2 : entity.height;
                agent.bot.lookAt(entity.position.offset(0, height, 0));
            }
            if (!entity_in_view)
                this.last_entity = null;
            if (Date.now() > this.next_change) {
                // look in random direction
                this.staring = Math.random() < 0.3;
                if (!this.staring) {
                    const yaw = Math.random() * Math.PI * 2;
                    const pitch = (Math.random() * Math.PI/2) - Math.PI/4;
                    agent.bot.look(yaw, pitch, false);
                }
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
        update: function (agent) { /* do nothing */ }
    }
];

async function execute(mode, agent, func, timeout=-1) {
    if (agent.self_prompter.isActive())
        agent.self_prompter.stopLoop();
    let interrupted_action = agent.actions.currentActionLabel;
    mode.active = true;
    let code_return = await agent.actions.runAction(`mode:${mode.name}`, async () => {
        await func();
    }, { timeout });
    mode.active = false;
    console.log(`Mode ${mode.name} finished executing, code_return: ${code_return.message}`);

    let should_reprompt = 
        interrupted_action && // it interrupted a previous action
        !agent.actions.resume_func && // there is no resume function
        !agent.self_prompter.isActive() && // self prompting is not on
        !code_return.interrupted; // this mode action was not interrupted by something else

    if (should_reprompt) {
        // auto prompt to respond to the interruption
        let role = convoManager.inConversation() ? agent.last_sender : 'system';
        let logs = agent.bot.modes.flushBehaviorLog();
        agent.handleMessage(role, `(AUTO MESSAGE)Your previous action '${interrupted_action}' was interrupted by ${mode.name}.
        Your behavior log: ${logs}\nRespond accordingly.`);
    }
}

let _agent = null;
const modes_map = {};
for (let mode of modes_list) {
    modes_map[mode.name] = mode;
}

class ModeController {
    /*
    SECURITY WARNING:
    ModesController must be reference isolated. Do not store references to external objects like `agent`.
    This object is accessible by LLM generated code, so any stored references are also accessible.
    This can be used to expose sensitive information by malicious prompters.
    */
    constructor() {
        this.behavior_log = '';
    }

    exists(mode_name) {
        return modes_map[mode_name] != null;
    }

    setOn(mode_name, on) {
        modes_map[mode_name].on = on;
    }

    isOn(mode_name) {
        return modes_map[mode_name].on;
    }

    pause(mode_name) {
        modes_map[mode_name].paused = true;
    }

    unpause(mode_name) {
        const mode = modes_map[mode_name];
        //if  unpause func is defined and mode is currently paused
        if (mode.unpause && mode.paused) {
            mode.unpause();
        }
        mode.paused = false;
    }

    unPauseAll() {
        for (let mode of modes_list) {
            if (mode.paused) console.log(`Unpausing mode ${mode.name}`);
            this.unpause(mode.name);
        }
    }

    getMiniDocs() { // no descriptions
        let res = 'Agent Modes:';
        for (let mode of modes_list) {
            let on = mode.on ? 'ON' : 'OFF';
            res += `\n- ${mode.name}(${on})`;
        }
        return res;
    }

    getDocs() {
        let res = 'Agent Modes:';
        for (let mode of modes_list) {
            let on = mode.on ? 'ON' : 'OFF';
            res += `\n- ${mode.name}(${on}): ${mode.description}`;
        }
        return res;
    }

    async update() {
        if (_agent.isIdle()) {
            this.unPauseAll();
        }
        for (let mode of modes_list) {
            let interruptible = mode.interrupts.some(i => i === 'all') || mode.interrupts.some(i => i === _agent.actions.currentActionLabel);
            if (mode.on && !mode.paused && !mode.active && (_agent.isIdle() || interruptible)) {
                await mode.update(_agent);
            }
            if (mode.active) break;
        }
    }

    flushBehaviorLog() {
        const log = this.behavior_log;
        this.behavior_log = '';
        return log;
    }

    getJson() {
        let res = {};
        for (let mode of modes_list) {
            res[mode.name] = mode.on;
        }
        return res;
    }

    loadJson(json) {
        for (let mode of modes_list) {
            if (json[mode.name] != undefined) {
                mode.on = json[mode.name];
            }
        }
    }
}

export function initModes(agent) {
    _agent = agent;
    // the mode controller is added to the bot object so it is accessible from anywhere the bot is used
    agent.bot.modes = new ModeController();
    if (agent.task) {
        agent.bot.restrict_to_inventory = agent.task.restrict_to_inventory;
    }
    let modes_json = agent.prompter.getInitModes();
    if (modes_json) {
        agent.bot.modes.loadJson(modes_json);
    }
}
