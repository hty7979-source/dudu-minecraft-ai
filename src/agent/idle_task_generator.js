/**
 * Idle Task Generator
 *
 * Generiert autonome Background-Tasks wenn der Bot idle ist.
 * Analysiert Memory-Status und erstellt produktive Aufgaben.
 *
 * Beispiele:
 * - Keine Nahrung → Sammle Food
 * - Keine Werkzeuge → Crafte Steinwerkzeuge
 * - Nachts ohne Bett → Finde/Crafte Bett
 * - Wenig Facke ln → Crafte Fackeln
 *
 * @author Dudu AI Team
 */

import { TaskPriority } from './task_queue_manager.js';
import * as skills from './library/skills.js';
import * as world from './library/utils/world.js';
import { smartCraft } from './library/systems/crafting_system.js';
import { smartObtainFood } from './library/systems/food_system.js';
import { MaterialPlanner } from './material_planner.js';

// ============================================================================
// IDLE TASK GENERATOR
// ============================================================================

export class IdleTaskGenerator {
    constructor(agent) {
        this.agent = agent;
        this.lastCheck = 0;
        this.checkInterval = 10000; // Alle 10 Sekunden prüfen
        this.cooldowns = new Map(); // Task-Name -> letzter Ausführungszeitpunkt
        this.minCooldown = 60000; // Mindestens 1 Minute zwischen gleichen Tasks
        this.materialPlanner = null; // Wird nach Bot-Login initialisiert
    }

    /**
     * Initialisiert den Material Planner nach Bot-Login
     */
    initializePlanner() {
        if (!this.materialPlanner && this.agent.bot) {
            this.materialPlanner = new MaterialPlanner(this.agent.bot);
        }
    }

    /**
     * Hauptmethode - wird regelmäßig aufgerufen wenn Bot idle ist
     */
    async checkAndGenerateTasks() {
        // Throttling - nicht zu oft prüfen
        const now = Date.now();
        if (now - this.lastCheck < this.checkInterval) {
            return;
        }
        this.lastCheck = now;

        // Nur wenn Bot wirklich idle ist (keine Tasks UND keine Actions)
        if (!this.agent.taskQueue || !this.agent.taskQueue.isIdle()) {
            return;
        }

        // Prüfe auch ob eine Action läuft (z.B. smartCollect via !newAction)
        if (this.agent.actionManager && this.agent.actionManager.executing) {
            return;
        }

        // Initialisiere Planner falls noch nicht geschehen
        this.initializePlanner();

        // Memory-Status aktualisieren
        const memory = this.agent.contextual_memory;
        memory.updateEquipmentStatus(this.agent.bot);
        memory.updateInventoryStatus(this.agent.bot);

        console.log('🤖 Idle Task Generator: Checking for tasks...');
        console.log(`📊 Status: ${memory.getBestToolTier()} tools, ${memory.inventory.foodCount} food, ${memory.inventory.torches} torches`);

        // Priorisierte Task-Generierung
        // Reihenfolge ist wichtig - wichtigste zuerst!

        // 1. CRITICAL: Death Recovery (höchste Priorität!)
        if (await this.checkDeathRecovery()) return;

        // 2. NORMAL: Grundbedürfnisse
        if (await this.checkFoodSupply()) return;
        if (await this.checkNighttime()) return;

        // 3. LOW: Verbesserungen
        if (await this.checkWorkbench()) return;  // MUST be before tool upgrades!
        if (await this.checkToolDurability()) return;
        if (await this.checkToolUpgrade()) return;
        if (await this.checkIronArmor()) return;  // Armor AFTER tools (needs more iron)
        if (await this.checkTorches()) return;

        // 4. BACKGROUND: Farming/Sammeln
        if (await this.checkResourceGathering()) return;

        console.log('🤖 Idle Task Generator: No tasks needed');
    }

    /**
     * Prüft ob ein Task wegen Cooldown blockiert ist
     */
    isOnCooldown(taskName) {
        const lastRun = this.cooldowns.get(taskName);
        if (!lastRun) return false;

        const timeSince = Date.now() - lastRun;
        return timeSince < this.minCooldown;
    }

    /**
     * Setzt Cooldown für einen Task
     */
    setCooldown(taskName) {
        this.cooldowns.set(taskName, Date.now());
    }

    // ========================================================================
    // TASK CHECKS - Spezifische Task-Generierung
    // ========================================================================

    /**
     * CRITICAL: Death Recovery - Items einsammeln nach Tod
     */
    async checkDeathRecovery() {
        const memory = this.agent.contextual_memory;

        if (!memory.isDeathRecoveryPending()) {
            return false;
        }

        const deathLoc = memory.getDeathLocation();
        const timeRemaining = memory.getRecoveryTimeRemaining();

        console.log(`💀 Death recovery needed! ${timeRemaining}s remaining`);

        await this.agent.taskQueue.runTask(
            'death_recovery',
            TaskPriority.HIGH, // Hoch, aber nicht CRITICAL (nicht lebensbedrohlich)
            async (agent) => {
                const [x, y, z] = deathLoc;
                console.log(`💀 Going to death location to recover items (${timeRemaining}s left)...`);

                try {
                    // Gehe zum Sterbeort
                    await skills.goToPosition(agent.bot, x, y, z, 2);

                    // Sammle Items ein
                    await skills.pickupNearbyItems(agent.bot);

                    console.log('✅ Item recovery completed!');
                    agent.bot.chat('✅ Ich habe meine Items eingesammelt');
                    memory.completeDeathRecovery();
                } catch (error) {
                    console.log('❌ Death recovery failed:', error.message);
                    memory.completeDeathRecovery(); // Markiere trotzdem als abgeschlossen
                }
            },
            {
                timeout: timeRemaining * 1000, // Timeout basierend auf verbleibender Zeit
                resumable: true,
                metadata: { type: 'death_recovery', location: deathLoc }
            }
        );

        this.setCooldown('death_recovery');
        return true;
    }

    /**
     * LOW: Werkzeug-Durability prüfen und ersetzen
     * Prüft ob Werkzeuge unter 5% Haltbarkeit sind und ersetzt sie
     */
    async checkToolDurability() {
        const bot = this.agent.bot;

        if (this.isOnCooldown('repair_tools')) return false;

        // Hole alle Werkzeuge im Inventar
        const tools = bot.inventory.items().filter(item =>
            (item.name.includes('pickaxe') ||
             item.name.includes('axe') ||
             item.name.includes('sword') ||
             item.name.includes('shovel')) &&
            item.durabilityUsed !== undefined
        );

        const brokenTools = [];

        for (const tool of tools) {
            const maxDurability = tool.maxDurability || 100;
            const currentDurability = maxDurability - (tool.durabilityUsed || 0);
            const durabilityPercent = (currentDurability / maxDurability) * 100;

            // Prüfe ob unter 5% Haltbarkeit
            if (durabilityPercent < 5 && durabilityPercent > 0) {
                brokenTools.push({
                    name: tool.name,
                    durability: Math.floor(durabilityPercent),
                    remaining: currentDurability,
                    max: maxDurability
                });
            }
        }

        if (brokenTools.length === 0) return false;

        console.log('🔧 Low durability tools detected:');
        for (const tool of brokenTools) {
            console.log(`  - ${tool.name}: ${tool.durability}% (${tool.remaining}/${tool.max})`);
        }

        await this.agent.taskQueue.runTask(
            'repair_tools',
            TaskPriority.LOW,
            async (agent) => {
                console.log('🔨 Replacing worn tools...');

                for (const tool of brokenTools) {
                    // Bestimme Replacement Tool
                    let replacement = null;

                    // Mappe Tool-Namen zu Tier
                    if (tool.name.includes('wooden_')) {
                        replacement = tool.name; // Ersetze mit gleichem Tier
                    } else if (tool.name.includes('stone_')) {
                        replacement = tool.name;
                    } else if (tool.name.includes('iron_')) {
                        replacement = tool.name;
                    } else if (tool.name.includes('diamond_')) {
                        replacement = tool.name;
                    }

                    if (replacement) {
                        console.log(`  → Crafting replacement ${replacement}...`);
                        const success = await smartCraft(agent.bot, replacement, 1, skills);

                        if (success) {
                            console.log(`  ✓ ${replacement} crafted`);

                            // Entsorge das alte, kaputte Werkzeug
                            const oldTool = agent.bot.inventory.items().find(i =>
                                i.name === tool.name &&
                                i.durabilityUsed !== undefined &&
                                (i.maxDurability - i.durabilityUsed) === tool.remaining
                            );

                            if (oldTool) {
                                await agent.bot.toss(oldTool.type, null, 1);
                                console.log(`  🗑️ Discarded broken ${tool.name}`);
                            }
                        } else {
                            console.log(`  ⚠️ Could not craft ${replacement} - missing materials`);
                        }
                    }
                }

                console.log('✅ Tool maintenance completed');
                agent.bot.chat('✅ Ich habe meine Werkzeuge erneuert');
            },
            {
                timeout: 120000, // 2 Minuten
                resumable: true,
                metadata: { type: 'tool_maintenance', tools: brokenTools }
            }
        );

        this.setCooldown('repair_tools');
        return true;
    }

    /**
     * NORMAL: Nahrung beschaffen mit Smart Food System
     * Intelligentes System: Kochen, Craften, Jagen, Sammeln
     */
    async checkFoodSupply() {
        const memory = this.agent.contextual_memory;

        if (this.isOnCooldown('gather_food')) return false;
        if (memory.hasEnoughFood(3)) return false; // Mindestens 3 Food

        console.log('🍖 Low food supply detected - starting Smart Food System');

        await this.agent.taskQueue.runTask(
            'gather_food',
            TaskPriority.LOW,
            async (agent) => {
                console.log('🍖 Smart Food System: Finding best food source...');

                // Smart Food System - findet automatisch die beste Food-Option
                const result = await smartObtainFood(agent.bot, 5);

                if (result.success) {
                    console.log(`✅ Food obtained: ${result.foodObtained}x ${result.foodType || 'food'}`);
                    console.log('✅ Food task completed');
                    return; // Erfolg
                }

                console.log('⚠️ Could not obtain food through smart system, trying fallback...');

                // Fallback 1: Jagen mit Exploration (priorisiert verschiedene Tierarten)
                const animalPriority = ['cow', 'pig', 'sheep', 'chicken', 'horse', 'rabbit']; // Reihenfolge: beste → schlechteste
                let hunted = 0;
                const targetHunts = 3;
                const maxSearchAttempts = 3;
                const travelDistance = 40; // Blocks to travel between attempts
                const searchRadius = 64;
                const huntedAnimals = new Set(); // Track welche Tiere bereits gejagt wurden

                for (let attempt = 1; attempt <= maxSearchAttempts && hunted < targetHunts; attempt++) {
                    console.log(`🔍 Animal search attempt ${attempt}/${maxSearchAttempts}...`);

                    // Versuche jede Tierart nacheinander (priorisiert)
                    for (const animalType of animalPriority) {
                        if (hunted >= targetHunts) break;

                        let animal = null;
                        try {
                            // Sicherer Entity-Lookup mit Fehlerbehandlung für PartialReadError
                            animal = agent.bot.nearestEntity(entity => {
                                try {
                                    return entity &&
                                           entity.name === animalType &&
                                           entity.position &&
                                           entity.type === 'mob' &&
                                           agent.bot.entity &&
                                           agent.bot.entity.position &&
                                           entity.position.distanceTo(agent.bot.entity.position) < searchRadius;
                                } catch (error) {
                                    // Entity hat fehlerhafte Metadaten - überspringen
                                    return false;
                                }
                            });
                        } catch (error) {
                            console.log(`  ⚠️ Error finding ${animalType}: ${error.message}`);
                            continue;
                        }

                        if (animal) {
                            console.log(`🎯 Fallback: Hunting ${animal.name}...`);
                            try {
                                await skills.attackEntity(agent.bot, animal);
                                hunted++;
                                huntedAnimals.add(animalType);
                                console.log(`  ✓ Hunted ${animalType} (${hunted}/${targetHunts})`);
                            } catch (error) {
                                console.log(`  ⚠️ Hunt failed: ${error.message}`);
                            }
                        }
                    }

                    // If we got enough, we're done
                    if (hunted >= targetHunts) break;

                    // If not last attempt and didn't find enough, travel and try again
                    if (attempt < maxSearchAttempts) {
                        console.log(`Found ${hunted}/${targetHunts} animals. Traveling ${travelDistance} blocks...`);
                        const currentPos = agent.bot.entity.position;
                        const targetX = currentPos.x + (Math.random() * travelDistance * 2 - travelDistance);
                        const targetZ = currentPos.z + (Math.random() * travelDistance * 2 - travelDistance);

                        try {
                            await skills.goToPosition(agent.bot, targetX, currentPos.y, targetZ, 2);
                        } catch (error) {
                            console.log(`⚠️ Travel failed: ${error.message}`);
                        }
                    }
                }

                if (hunted > 0) {
                    console.log(`✅ Fallback successful: Hunted ${hunted} animals`);
                    console.log('✅ Food task completed');
                    return;
                }

                // Fallback 2: Pilze sammeln (mushroom stew)
                console.log('🍄 Fallback 2: Searching for mushrooms...');
                try {
                    const brownMushrooms = await skills.collectBlock(agent.bot, 'brown_mushroom', 1);
                    const redMushrooms = await skills.collectBlock(agent.bot, 'red_mushroom', 1);

                    if (brownMushrooms && redMushrooms) {
                        // Try to craft bowl from planks
                        const planksTypes = ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'];
                        let hasBowl = false;

                        for (const planks of planksTypes) {
                            const inv = world.getInventoryCounts(agent.bot);
                            if (inv[planks] >= 3) {
                                const bowlSuccess = await skills.craftRecipe(agent.bot, 'bowl', 1);
                                if (bowlSuccess) {
                                    hasBowl = true;
                                    break;
                                }
                            }
                        }

                        if (hasBowl) {
                            const stewSuccess = await skills.craftRecipe(agent.bot, 'mushroom_stew', 1);
                            if (stewSuccess) {
                                console.log('✅ Crafted mushroom stew from wild mushrooms');
                                console.log('✅ Food task completed');
                                return;
                            } else {
                                console.log('❌ Failed to craft mushroom stew');
                            }
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Mushroom gathering failed: ${error.message}`);
                }

                // Nothing worked
                throw new Error('Failed to obtain food: No food sources available (no ingredients to craft, no animals to hunt, no mushrooms found)');
            },
            {
                timeout: 180000, // 3 Minuten
                resumable: true,
                metadata: { type: 'resource_gathering', resource: 'food' }
            }
        );

        this.setCooldown('gather_food');
        return true;
    }

    /**
     * NORMAL: Bett für die Nacht
     */
    async checkNighttime() {
        const memory = this.agent.contextual_memory;
        const bot = this.agent.bot;

        if (this.isOnCooldown('get_bed')) return false;
        if (memory.inventory.bed) return false; // Hat schon ein Bett

        // Prüfe ob es Nacht ist oder bald Nacht wird
        const timeOfDay = bot.time.timeOfDay;
        const isNight = timeOfDay > 13000 || timeOfDay < 1000;

        if (!isNight) return false;

        console.log('🌙 Nighttime without bed detected');

        await this.agent.taskQueue.runTask(
            'get_bed',
            TaskPriority.BACKGROUND, // Niedrige Priorität - nicht wichtig während Ressourcensammlung
            async (agent) => {
                console.log('🌙 Need a bed for the night...');

                try {
                    // Versuche zuerst zu craften
                    const hasWool = agent.bot.inventory.items().filter(i => i.name.includes('wool')).length >= 3;
                    const hasPlanks = agent.bot.inventory.items().some(i => i.name.includes('planks'));

                    if (hasWool && hasPlanks) {
                        const bedSuccess = await smartCraft(agent.bot, 'white_bed', 1, skills);
                        if (bedSuccess) {
                            console.log('✅ Crafted a bed!');
                            agent.bot.chat('✅ Ich habe ein Bett hergestellt');
                            return; // Exit early on success
                        } else {
                            console.log('❌ Failed to craft bed, trying to find one instead');
                        }
                    }

                    // Try to find a bed if crafting failed or not possible
                    if (true) {
                        // Versuche Bett zu finden
                        try {
                            await skills.goToNearestBlock(agent.bot, 'bed', 2, 64);
                            console.log('✅ Found a bed!');

                            // Actually sleep in the bed!
                            const bed = agent.bot.findBlock({
                                matching: (block) => block && block.name.includes('bed'),
                                maxDistance: 4
                            });

                            if (bed) {
                                try {
                                    await agent.bot.sleep(bed);
                                    console.log('😴 Sleeping in bed...');
                                    await agent.bot.waitForTicks(100); // Wait a bit to ensure we're sleeping
                                } catch (sleepError) {
                                    console.log(`⚠️ Could not sleep: ${sleepError.message}`);
                                }
                            }
                        } catch (error) {
                            console.log('❌ Could not find or craft bed');
                        }
                    }
                } catch (error) {
                    console.error('Bed acquisition failed:', error);
                }
            },
            {
                timeout: 60000,
                resumable: true,
                metadata: { type: 'survival', item: 'bed' }
            }
        );

        this.setCooldown('get_bed');
        return true;
    }

    /**
     * LOW: Werkzeug-Upgrade (stufenweise)
     *
     * Progression:
     * 1. Holzwerkzeuge: 10 logs → planks → sticks → wooden tools
     * 2. Steinwerkzeuge: 20 cobblestone → stone tools
     * 3. Eisenwerkzeuge: Eisen schmelzen → iron tools
     */
    async checkToolUpgrade() {
        const memory = this.agent.contextual_memory;
        const toolTier = memory.getBestToolTier();
        const bot = this.agent.bot;

        if (this.isOnCooldown('upgrade_tools')) return false;

        // Prüfe welches Upgrade als nächstes ansteht
        let needsWoodenTools = (toolTier === 'none');
        let needsStoneTools = (toolTier === 'wooden');
        let needsIronTools = (toolTier === 'stone');

        // Für Iron Tools: Prüfe nur ob wir Tools + Shield haben (nicht Armor!)
        if (needsIronTools) {
            const inv = bot.inventory.items();
            const hasIronPickaxe = inv.some(i => i.name === 'iron_pickaxe');
            const hasIronSword = inv.some(i => i.name === 'iron_sword');
            const hasIronAxe = inv.some(i => i.name === 'iron_axe');
            const hasShield = inv.some(i => i.name === 'shield');

            // Wenn wir bereits Tools + Shield haben, kein Tool-Upgrade mehr nötig
            if (hasIronPickaxe && hasIronSword && hasIronAxe && hasShield) {
                needsIronTools = false;
            }
        }

        if (!needsWoodenTools && !needsStoneTools && !needsIronTools) {
            return false;
        }

        // Zeige an was gebraucht wird
        if (needsWoodenTools) console.log('🔧 Tool upgrade available: none → wooden');
        if (needsStoneTools) console.log('🔧 Tool upgrade available: wooden → stone');
        if (needsIronTools) console.log('🔧 Tool upgrade available: stone → iron (tools + shield)');

        await this.agent.taskQueue.runTask(
            'upgrade_tools',
            TaskPriority.LOW,
            async (agent) => {
                try {
                    if (needsWoodenTools) {
                        await this.craftWoodenTools(agent);
                        agent.bot.chat('✅ Ich habe Holzwerkzeuge hergestellt');
                    } else if (needsStoneTools) {
                        await this.craftStoneTools(agent);
                        agent.bot.chat('✅ Ich habe Steinwerkzeuge hergestellt');
                    } else if (needsIronTools) {
                        await this.craftIronToolsAndShield(agent);
                        agent.bot.chat('✅ Ich habe Eisenwerkzeuge und Schild hergestellt');
                    }

                    console.log('✅ Tool upgrade completed!');
                } catch (error) {
                    console.error('Tool upgrade failed:', error);
                    console.log('❌ Tool upgrade failed:', error.message);
                }
            },
            {
                timeout: 300000, // 5 Minuten
                resumable: true,
                metadata: {
                    type: 'equipment_upgrade',
                    from: toolTier,
                    to: needsWoodenTools ? 'wooden' : needsStoneTools ? 'stone' : 'iron'
                }
            }
        );

        this.setCooldown('upgrade_tools');
        return true;
    }

    /**
     * LOW: Iron Armor craften (24 iron ingots)
     * Wird NACH Iron Tools gecraftet (separate Task für kleineren Materialbedarf)
     */
    async checkIronArmor() {
        const memory = this.agent.contextual_memory;
        const toolTier = memory.getBestToolTier();
        const bot = this.agent.bot;

        if (this.isOnCooldown('craft_armor')) return false;

        // Nur wenn wir bereits Iron Tools haben!
        if (toolTier !== 'iron') return false;

        // Prüfe ob wir bereits Iron Armor haben
        const inv = bot.inventory.items();
        const hasHelmet = inv.some(i => i.name === 'iron_helmet');
        const hasChestplate = inv.some(i => i.name === 'iron_chestplate');
        const hasLeggings = inv.some(i => i.name === 'iron_leggings');
        const hasBoots = inv.some(i => i.name === 'iron_boots');

        // Wenn wir bereits vollständige Armor haben, nichts zu tun
        if (hasHelmet && hasChestplate && hasLeggings && hasBoots) {
            return false;
        }

        console.log('🛡️ Iron armor upgrade available');

        await this.agent.taskQueue.runTask(
            'craft_armor',
            TaskPriority.LOW,
            async (agent) => {
                try {
                    await this.craftIronArmor(agent);
                    agent.bot.chat('✅ Ich habe Eisenrüstung hergestellt');

                    console.log('✅ Iron armor completed!');
                } catch (error) {
                    console.error('Iron armor crafting failed:', error);
                    throw error;
                }
            },
            {
                timeout: 300000, // 5 Minuten
                resumable: true,
                metadata: {
                    type: 'armor_upgrade',
                    tier: 'iron'
                }
            }
        );

        this.setCooldown('craft_armor');
        return true;
    }

    /**
     * STUFE 1: Holzwerkzeuge craften
     * Verwendet MaterialPlanner für intelligente Ressourcen-Planung
     */
    async craftWoodenTools(agent) {
        console.log('🌳 === STAGE 1: Crafting Wooden Tools ===\n');

        // PHASE 1: Material-Planung
        const plan = this.materialPlanner.createWoodenToolsPlan();
        console.log(this.materialPlanner.summarizePlan(plan));
        console.log('');

        // PHASE 2: Sammle Rohstoffe
        const gatheringPlan = this.materialPlanner.createGatheringPlan(plan.toGather);

        if (gatheringPlan.length > 0) {
            console.log('📦 Phase 1: Gathering raw materials...');

            for (const task of gatheringPlan) {
                console.log(`  → Gathering ${task.amount}x ${task.item}...`);

                const success = await skills.collectBlock(agent.bot, task.item, task.amount);
                if (!success) {
                    throw new Error(`Failed to gather ${task.item} - not found nearby`);
                }

                // Verify
                const inventory = this.materialPlanner.getCurrentInventory();
                const nowHave = inventory[task.item] || 0;
                if (nowHave < task.needed) {
                    throw new Error(`Still missing ${task.item}: have ${nowHave}, need ${task.needed}`);
                }

                console.log(`  ✓ Gathered ${task.item} (now have ${nowHave})`);
            }
            console.log('✅ Phase 1: All raw materials gathered!\n');
        } else {
            console.log('✅ Phase 1: All materials already available!\n');
        }

        // PHASE 3: Craft intermediate materials first
        console.log('🔨 Phase 2: Crafting intermediate materials...');

        // Craft planks from logs if needed
        const inventory = this.materialPlanner.getCurrentInventory();
        const planksNeeded = 8; // 2+3+3 for sword, axe, pickaxe
        const sticksNeeded = 5; // 1+2+2 for sword, axe, pickaxe

        // Count ANY type of planks (oak, spruce, birch, etc.)
        const allWoodTypes = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];
        let totalPlanks = 0;
        let availableWoodType = null;

        for (const wood of allWoodTypes) {
            const planksType = `${wood}_planks`;
            const count = inventory[planksType] || 0;
            totalPlanks += count;
            if (count > 0 && !availableWoodType) {
                availableWoodType = wood;
            }
        }

        // If we don't have enough planks, craft from ANY available log type
        if (totalPlanks < planksNeeded) {
            // Find which log type we have
            let logType = null;
            for (const wood of allWoodTypes) {
                if (inventory[`${wood}_log`] > 0) {
                    logType = wood;
                    break;
                }
            }

            if (logType) {
                console.log(`  → Crafting ${logType}_planks...`);
                const success = await skills.craftRecipe(agent.bot, `${logType}_planks`, Math.ceil((planksNeeded - totalPlanks) / 4));
                if (!success) {
                    throw new Error(`Failed to craft ${logType}_planks`);
                }
            } else {
                console.log('  ⚠️ No logs available to craft planks');
                throw new Error('No logs available for planks');
            }
        }

        if ((inventory['stick'] || 0) < sticksNeeded) {
            console.log('  → Crafting sticks...');
            const success = await skills.craftRecipe(agent.bot, 'stick', Math.ceil(sticksNeeded / 4)); // 4 sticks per 2 planks
            if (!success) {
                throw new Error('Failed to craft sticks');
            }
        }

        // PHASE 4: Craft Tools (only if we don't already have them!)
        console.log('🔨 Phase 3: Crafting tools...');

        const tools = [
            { name: 'wooden_sword', display: 'Wooden Sword' },
            { name: 'wooden_axe', display: 'Wooden Axe' },
            { name: 'wooden_pickaxe', display: 'Wooden Pickaxe' }
        ];

        for (const tool of tools) {
            // Check if we already have this tool
            const alreadyHave = agent.bot.inventory.items().some(i => i.name === tool.name);
            if (alreadyHave) {
                console.log(`  ✓ ${tool.display} already in inventory (skipping)`);
                continue;
            }

            console.log(`  → Crafting ${tool.display}...`);
            const success = await skills.craftRecipe(agent.bot, tool.name, 1);
            if (success) {
                console.log(`  ✓ ${tool.display} crafted`);
            } else {
                console.log(`  ✗ ${tool.display} crafting failed`);
                throw new Error(`Failed to craft ${tool.display}`);
            }
        }

        console.log('✅ Phase 2: All tools crafted!');
        console.log('🎉 STAGE 1 COMPLETE!\n');
    }

    /**
     * STUFE 2: Steinwerkzeuge + Survival Setup craften
     * Ablauf: cobblestone + coal farmen → stone tools + furnace craften
     *
     * Mit Ofen können wir:
     * - Tiere jagen und Fleisch verkochen → Nahrung herstellen
     * - Eisenerz schmelzen für spätere Upgrades
     */
    async craftStoneTools(agent) {
        console.log('⛏️ === STAGE 2: Crafting Stone Tools & Survival Setup ===\n');

        // PHASE 1: Material-Planung
        const plan = this.materialPlanner.createStoneToolsPlan();
        console.log(this.materialPlanner.summarizePlan(plan));
        console.log('');

        // PHASE 2: Sammle Rohstoffe (cobblestone + coal)
        const gatheringPlan = this.materialPlanner.createGatheringPlan(plan.toGather);

        if (gatheringPlan.length > 0) {
            console.log('📦 Phase 1: Gathering raw materials...');

            for (const task of gatheringPlan) {
                console.log(`  → Gathering ${task.amount}x ${task.item}...`);

                const success = await skills.collectBlock(agent.bot, task.item, task.amount);
                if (!success) {
                    throw new Error(`Failed to gather ${task.item} - not found nearby`);
                }

                // Verify
                const inventory = this.materialPlanner.getCurrentInventory();
                const nowHave = inventory[task.item] || 0;
                if (nowHave < task.needed) {
                    throw new Error(`Still missing ${task.item}: have ${nowHave}, need ${task.needed}`);
                }

                console.log(`  ✓ Gathered ${task.item} (now have ${nowHave})`);
            }
            console.log('✅ Phase 1: All raw materials gathered!\n');
        } else {
            console.log('✅ Phase 1: All materials already available!\n');
        }

        // PHASE 3: Craft intermediate materials first
        console.log('🔨 Phase 2: Crafting intermediate materials...');

        const inventory = this.materialPlanner.getCurrentInventory();
        const sticksNeeded = 5; // 1+2+2 for sword, axe, pickaxe

        // Craft sticks from planks/logs if needed
        if ((inventory['stick'] || 0) < sticksNeeded) {
            console.log('  → Crafting sticks...');

            // Count ANY type of planks we have
            const allWoodTypes = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];
            let totalPlanks = 0;

            for (const wood of allWoodTypes) {
                totalPlanks += inventory[`${wood}_planks`] || 0;
            }

            // Calculate how many MORE sticks we need
            const currentSticks = inventory['stick'] || 0;
            const sticksToMake = Math.max(0, sticksNeeded - currentSticks);

            // Calculate how many times we need to craft (each craft = 4 sticks from 2 planks)
            const craftCount = Math.ceil(sticksToMake / 4);
            const planksNeededForSticks = craftCount * 2; // 2 planks per craft

            // First ensure we have enough planks
            if (totalPlanks < planksNeededForSticks) {
                // Find which log type we have
                let logType = null;
                for (const wood of allWoodTypes) {
                    if (inventory[`${wood}_log`] > 0) {
                        logType = wood;
                        break;
                    }
                }

                if (!logType) {
                    throw new Error('No logs available to craft planks for sticks');
                }

                // Craft enough planks (1 log = 4 planks)
                const planksToMake = planksNeededForSticks - totalPlanks;
                const logsNeeded = Math.ceil(planksToMake / 4);
                console.log(`  → Crafting ${logsNeeded}x ${logType}_planks from logs (need ${planksToMake} planks)...`);
                const planksSuccess = await skills.craftRecipe(agent.bot, `${logType}_planks`, logsNeeded);
                if (!planksSuccess) {
                    throw new Error(`Failed to craft ${logType}_planks for sticks`);
                }
            }

            console.log(`  → Crafting sticks (need ${sticksToMake} more, will craft ${craftCount}x recipe = ${craftCount * 4} sticks)...`);
            const sticksSuccess = await skills.craftRecipe(agent.bot, 'stick', craftCount);
            if (!sticksSuccess) {
                throw new Error('Failed to craft sticks');
            }
        }

        // PHASE 4: Ensure we have a crafting table (REQUIRED for stone tools!)
        const hasCraftingTable = agent.bot.inventory.items().some(i => i.name === 'crafting_table');
        const nearbyCraftingTable = world.getNearestBlock(agent.bot, 'crafting_table', 16);

        if (!hasCraftingTable && !nearbyCraftingTable) {
            console.log('🔨 Phase 3a: Crafting table required for stone tools...');
            console.log('  → Crafting crafting_table...');

            // Use smartCraft which now has recursive crafting!
            const tableSuccess = await smartCraft(agent.bot, 'crafting_table', 1, skills);
            if (!tableSuccess) {
                throw new Error('Failed to craft crafting_table (required for stone tools)');
            }
            console.log('  ✓ Crafting table created!\n');
        } else if (hasCraftingTable) {
            console.log('✅ Crafting table already in inventory\n');
        } else {
            console.log('✅ Crafting table found nearby\n');
        }

        // PHASE 5: Craft Tools + Furnace (only if we don't already have them!)
        console.log('🔨 Phase 3: Crafting tools & utilities...');

        const items = [
            { name: 'stone_sword', display: 'Stone Sword' },
            { name: 'stone_axe', display: 'Stone Axe' },
            { name: 'stone_pickaxe', display: 'Stone Pickaxe' },
            { name: 'furnace', display: 'Furnace' }
        ];

        for (const item of items) {
            // Check if we already have this item
            const alreadyHave = agent.bot.inventory.items().some(i => i.name === item.name);
            if (alreadyHave) {
                console.log(`  ✓ ${item.display} already in inventory (skipping)`);
                continue;
            }

            console.log(`  → Crafting ${item.display}...`);
            const success = await skills.craftRecipe(agent.bot, item.name, 1);
            if (success) {
                console.log(`  ✓ ${item.display} crafted`);
            } else {
                console.log(`  ✗ ${item.display} crafting failed`);
                throw new Error(`Failed to craft ${item.display}`);
            }
        }

        console.log('✅ Phase 2: All items crafted!');
        console.log('💡 Now you can hunt animals and cook meat for food!');
        console.log('🎉 STAGE 2 COMPLETE!\n');
    }

    /**
     * STUFE 3a: Eisenwerkzeuge + Schild craften (8 Eisen + Sticks + Planks)
     * Workflow: Iron Ore sammeln → Kohle sammeln → Erz schmelzen → Tools + Shield craften
     */
    async craftIronToolsAndShield(agent) {
        console.log('🔥 === STAGE 3a: Crafting Iron Tools + Shield ===\n');

        // PHASE 1: Material-Planung (nur Tools + Shield, KEINE Armor!)
        const plan = this.materialPlanner.createIronToolsPlan();
        console.log(this.materialPlanner.summarizePlan(plan));
        console.log('');

        const inventory = this.materialPlanner.getCurrentInventory();

        // Berechne TOTAL benötigtes Eisen (unabhängig vom Inventar)
        // Iron Sword: 2, Iron Axe: 3, Iron Pickaxe: 3, Iron Shovel: 1, Shield: 1 = 10 total
        const totalIronNeeded = 10;
        const ironHave = inventory['iron_ingot'] || 0;
        const ironToSmelt = Math.max(0, totalIronNeeded - ironHave);

        console.log(`📊 Iron Status: Have ${ironHave}, Need ${totalIronNeeded}, Must smelt ${ironToSmelt}`);

        // PHASE 2: Sammle Raw Iron (wenn nötig)
        if (ironToSmelt > 0) {
            // Prüfe zuerst ob wir schon raw_iron haben
            const rawIronHave = inventory['raw_iron'] || 0;
            const rawIronToMine = Math.max(0, ironToSmelt - rawIronHave);

            console.log(`📊 Raw Iron Status: Have ${rawIronHave}, Need ${ironToSmelt}, Must mine ${rawIronToMine}`);

            if (rawIronToMine > 0) {
                console.log(`\n⛏️ Phase 1: Mining ${rawIronToMine}x iron ore (for raw iron)...`);

                const oreSuccess = await skills.collectBlock(agent.bot, 'iron_ore', rawIronToMine);
                if (!oreSuccess) {
                    throw new Error('Failed to gather iron_ore - not found nearby');
                }

                const rawIronNow = this.materialPlanner.getCurrentInventory()['raw_iron'] || 0;
                console.log(`  ✓ Mined iron ore (now have ${rawIronNow}x raw_iron)`);
            } else {
                console.log(`✅ Phase 1: Already have ${rawIronHave}x raw_iron!\n`);
            }

            // PHASE 3: Sammle Coal für Smelting (1 coal = 8 items, aber nehmen wir etwas mehr)
            const coalHave = inventory['coal'] || 0;
            const coalNeeded = Math.ceil(ironToSmelt / 8) + 2; // +2 als Buffer
            const coalToGather = Math.max(0, coalNeeded - coalHave);

            if (coalToGather > 0) {
                console.log(`\n🪨 Phase 2: Gathering ${coalToGather}x coal for fuel...`);

                const coalSuccess = await skills.collectBlock(agent.bot, 'coal', coalToGather);
                if (!coalSuccess) {
                    throw new Error('Failed to gather coal - not found nearby');
                }

                const coalNow = this.materialPlanner.getCurrentInventory()['coal'] || 0;
                console.log(`  ✓ Gathered coal (now have ${coalNow})`);
            } else {
                console.log(`✅ Phase 2: Already have ${coalHave}x coal!\n`);
            }

            // PHASE 4: Schmelze Raw Iron → Iron Ingots
            console.log(`\n🔥 Phase 3: Smelting ${ironToSmelt}x raw_iron → iron ingots...`);

            const smeltSuccess = await skills.smeltItem(agent.bot, 'raw_iron', ironToSmelt);
            if (!smeltSuccess) {
                throw new Error('Failed to smelt raw_iron');
            }

            const ingotsHave = this.materialPlanner.getCurrentInventory()['iron_ingot'] || 0;
            console.log(`  ✓ Smelted iron (now have ${ingotsHave} ingots)`);
        } else {
            console.log('✅ Phase 1-3: Already have enough iron ingots!\n');
        }

        // PHASE 5: Craft sticks (wenn nötig)
        console.log('🔨 Phase 4: Preparing intermediate materials...');

        const currentInv = this.materialPlanner.getCurrentInventory();
        const sticksNeeded = 7; // 2+2+2+1 for pickaxe, axe, sword, shovel
        const sticksHave = currentInv['stick'] || 0;

        if (sticksHave < sticksNeeded) {
            console.log(`  → Crafting sticks (have ${sticksHave}, need ${sticksNeeded})...`);

            // Find any available planks
            const planksTypes = ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'];
            let planksType = null;

            for (const type of planksTypes) {
                if (currentInv[type] >= 2) {
                    planksType = type;
                    break;
                }
            }

            if (!planksType) {
                // Craft planks from any available log
                const logTypes = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
                for (const logType of logTypes) {
                    if (currentInv[logType] >= 1) {
                        const planksName = logType.replace('_log', '_planks');
                        const success = await skills.craftRecipe(agent.bot, planksName, 1);
                        if (success) {
                            planksType = planksName;
                            break;
                        }
                    }
                }
            }

            if (planksType) {
                const success = await skills.craftRecipe(agent.bot, 'stick', Math.ceil((sticksNeeded - sticksHave) / 4));
                if (!success) {
                    throw new Error('Failed to craft sticks for iron tools');
                }
            }
        }

        // Craft planks for shield (6 needed)
        const planksNeeded = 6;
        const planksHave = currentInv['_planks'] || 0; // Aggregated count

        if (planksHave < planksNeeded) {
            console.log(`  → Crafting planks for shield (have ${planksHave}, need ${planksNeeded})...`);
            // Find any available log and craft planks
            const logTypes = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
            for (const logType of logTypes) {
                if (currentInv[logType] >= 2) {
                    const planksName = logType.replace('_log', '_planks');
                    const success = await skills.craftRecipe(agent.bot, planksName, 2);
                    if (success) break;
                }
            }
        }

        // PHASE 6: Craft Tools
        console.log('\n🔨 Phase 5: Crafting iron tools...');

        const tools = [
            { name: 'iron_sword', display: 'Iron Sword' },
            { name: 'iron_axe', display: 'Iron Axe' },
            { name: 'iron_pickaxe', display: 'Iron Pickaxe' },
            { name: 'iron_shovel', display: 'Iron Shovel' }
        ];

        for (const tool of tools) {
            console.log(`  → Crafting ${tool.display}...`);
            const success = await skills.craftRecipe(agent.bot, tool.name, 1);
            if (success) {
                console.log(`  ✓ ${tool.display} crafted`);
            } else {
                console.log(`  ✗ ${tool.display} crafting failed`);
                throw new Error(`Failed to craft ${tool.display}`);
            }
        }

        // PHASE 7: Craft Shield
        console.log('\n🛡️ Phase 6: Crafting shield...');
        console.log('  → Crafting Shield...');
        const shieldSuccess = await skills.craftRecipe(agent.bot, 'shield', 1);
        if (shieldSuccess) {
            console.log('  ✓ Shield crafted');
        } else {
            console.log('  ✗ Shield crafting failed');
            throw new Error('Failed to craft shield');
        }

        console.log('\n✅ Iron tools and shield crafted!');
        console.log('⚔️ Bot is now equipped with iron tools and shield!');
        console.log('🎉 STAGE 3a COMPLETE!\n');
    }

    /**
     * STUFE 3b: Eisenrüstung craften (24 Eisen)
     * Workflow: Iron Ore sammeln → Kohle sammeln → Erz schmelzen → Armor craften
     */
    async craftIronArmor(agent) {
        console.log('🛡️ === STAGE 3b: Crafting Iron Armor ===\n');

        // PHASE 1: Material-Planung (nur Armor!)
        const plan = this.materialPlanner.createIronArmorPlan();
        console.log(this.materialPlanner.summarizePlan(plan));
        console.log('');

        const inventory = this.materialPlanner.getCurrentInventory();

        // Berechne TOTAL benötigtes Eisen (unabhängig vom Inventar)
        // Iron Helmet: 5, Iron Chestplate: 8, Iron Leggings: 7, Iron Boots: 4 = 24 total
        const totalIronNeeded = 24;
        const ironHave = inventory['iron_ingot'] || 0;
        const ironToSmelt = Math.max(0, totalIronNeeded - ironHave);

        console.log(`📊 Iron Status: Have ${ironHave}, Need ${totalIronNeeded}, Must smelt ${ironToSmelt}`);

        // PHASE 2: Sammle Raw Iron (wenn nötig)
        if (ironToSmelt > 0) {
            // Prüfe zuerst ob wir schon raw_iron haben
            const rawIronHave = inventory['raw_iron'] || 0;
            const rawIronToMine = Math.max(0, ironToSmelt - rawIronHave);

            console.log(`📊 Raw Iron Status: Have ${rawIronHave}, Need ${ironToSmelt}, Must mine ${rawIronToMine}`);

            if (rawIronToMine > 0) {
                console.log(`\n⛏️ Phase 1: Mining ${rawIronToMine}x iron ore (for raw iron)...`);

                const oreSuccess = await skills.collectBlock(agent.bot, 'iron_ore', rawIronToMine);
                if (!oreSuccess) {
                    throw new Error('Failed to gather iron_ore - not found nearby');
                }

                const rawIronNow = this.materialPlanner.getCurrentInventory()['raw_iron'] || 0;
                console.log(`  ✓ Mined iron ore (now have ${rawIronNow}x raw_iron)`);
            } else {
                console.log(`✅ Phase 1: Already have ${rawIronHave}x raw_iron!\n`);
            }

            // PHASE 3: Sammle Coal für Smelting
            const coalHave = inventory['coal'] || 0;
            const coalNeeded = Math.ceil(ironToSmelt / 8) + 2; // +2 als Buffer
            const coalToGather = Math.max(0, coalNeeded - coalHave);

            if (coalToGather > 0) {
                console.log(`\n🪨 Phase 2: Gathering ${coalToGather}x coal for fuel...`);

                const coalSuccess = await skills.collectBlock(agent.bot, 'coal', coalToGather);
                if (!coalSuccess) {
                    throw new Error('Failed to gather coal - not found nearby');
                }

                const coalNow = this.materialPlanner.getCurrentInventory()['coal'] || 0;
                console.log(`  ✓ Gathered coal (now have ${coalNow})`);
            } else {
                console.log(`✅ Phase 2: Already have ${coalHave}x coal!\n`);
            }

            // PHASE 4: Schmelze Raw Iron → Iron Ingots
            console.log(`\n🔥 Phase 3: Smelting ${ironToSmelt}x raw_iron → iron ingots...`);

            const smeltSuccess = await skills.smeltItem(agent.bot, 'raw_iron', ironToSmelt);
            if (!smeltSuccess) {
                throw new Error('Failed to smelt raw_iron');
            }

            const ingotsHave = this.materialPlanner.getCurrentInventory()['iron_ingot'] || 0;
            console.log(`  ✓ Smelted iron (now have ${ingotsHave} ingots)`);
        } else {
            console.log('✅ Phase 1-3: Already have enough iron ingots!\n');
        }

        // PHASE 5: Craft Armor
        console.log('\n🛡️ Phase 4: Crafting iron armor...');

        const armor = [
            { name: 'iron_helmet', display: 'Iron Helmet' },
            { name: 'iron_chestplate', display: 'Iron Chestplate' },
            { name: 'iron_leggings', display: 'Iron Leggings' },
            { name: 'iron_boots', display: 'Iron Boots' }
        ];

        for (const piece of armor) {
            console.log(`  → Crafting ${piece.display}...`);
            const success = await skills.craftRecipe(agent.bot, piece.name, 1);
            if (success) {
                console.log(`  ✓ ${piece.display} crafted`);
            } else {
                console.log(`  ✗ ${piece.display} crafting failed`);
                throw new Error(`Failed to craft ${piece.display}`);
            }
        }

        console.log('\n✅ Iron armor crafted!');
        console.log('💪 Bot is now fully protected with iron armor!');
        console.log('🎉 STAGE 3b COMPLETE!\n');
    }

    /**
     * LOW: Fackeln craften
     */
    async checkTorches() {
        const memory = this.agent.contextual_memory;

        if (this.isOnCooldown('craft_torches')) return false;
        if (memory.inventory.torches >= 10) return false; // Mindestens 10 Fackeln

        // Prüfe ob Materialien vorhanden
        const hasCoal = this.agent.bot.inventory.items().some(i => i.name === 'coal');
        const hasSticks = this.agent.bot.inventory.items().some(i => i.name === 'stick');

        if (!hasCoal || !hasSticks) return false;

        console.log('🔦 Low torch supply detected');

        await this.agent.taskQueue.runTask(
            'craft_torches',
            TaskPriority.BACKGROUND,
            async (agent) => {
                console.log('🔦 Crafting torches...');

                try {
                    const coalCount = agent.bot.inventory.items()
                        .filter(i => i.name === 'coal')
                        .reduce((sum, i) => sum + i.count, 0);

                    const amount = Math.min(coalCount, 16); // Max 16 Fackeln (64 Stück output)
                    const success = await smartCraft(agent.bot, 'torch', amount, skills);

                    if (success) {
                        console.log(`✅ Crafted ${amount * 4} torches`);
                    } else {
                        console.log('❌ Failed to craft torches');
                        throw new Error('Torch crafting failed');
                    }
                } catch (error) {
                    console.error('❌ Torch crafting failed:', error.message);
                    throw error;
                }
            },
            {
                timeout: 30000,
                resumable: true,
                metadata: { type: 'crafting', item: 'torch' }
            }
        );

        this.setCooldown('craft_torches');
        return true;
    }

    /**
     * LOW: Workbench sicherstellen
     */
    async checkWorkbench() {
        const bot = this.agent.bot;

        if (this.isOnCooldown('get_workbench')) return false;

        // Check 1: Do we have a crafting table in inventory?
        const hasCraftingTable = bot.inventory.items().some(i => i.name === 'crafting_table');
        if (hasCraftingTable) return false;

        // Check 2: Is there a crafting table nearby (within 16 blocks)?
        const nearbyTable = bot.findBlock({
            matching: (block) => block && block.name === 'crafting_table',
            maxDistance: 16
        });
        if (nearbyTable) return false; // Found one nearby, no need to craft

        // Prüfe ob Holz vorhanden
        const hasLogs = bot.inventory.items().some(i => i.name.includes('log'));
        if (!hasLogs) return false;

        console.log('🔨 No crafting table detected (not in inventory or nearby)');

        await this.agent.taskQueue.runTask(
            'get_workbench',
            TaskPriority.LOW,
            async (agent) => {
                console.log('🔨 Crafting workbench...');

                try {
                    // Check again before crafting
                    const alreadyHave = agent.bot.inventory.items().some(i => i.name === 'crafting_table');
                    if (alreadyHave) {
                        console.log('✅ Crafting table already in inventory (skipping)');
                        return;
                    }

                    // Use smartCraft - now supports any wood type!
                    const success = await smartCraft(agent.bot, 'crafting_table', 1, skills);
                    if (success) {
                        console.log('✅ Crafted crafting table');
                    } else {
                        console.log('❌ Failed to craft crafting table');
                        throw new Error('Crafting table creation failed');
                    }
                } catch (error) {
                    console.error('❌ Workbench crafting failed:', error.message);
                    throw error; // Re-throw to mark task as failed
                }
            },
            {
                timeout: 30000,
                resumable: false,
                metadata: { type: 'crafting', item: 'crafting_table' }
            }
        );

        this.setCooldown('get_workbench');
        return true;
    }

    /**
     * BACKGROUND: Ressourcen sammeln (sehr niedrige Priorität)
     */
    async checkResourceGathering() {
        if (this.isOnCooldown('gather_resources')) return false;

        // Sammle Holz wenn wenig vorhanden
        const logCount = this.agent.bot.inventory.items()
            .filter(i => i.name.includes('log'))
            .reduce((sum, i) => sum + i.count, 0);

        if (logCount < 16) {
            console.log('🌳 Low wood supply detected');

            await this.agent.taskQueue.runTask(
                'gather_wood',
                TaskPriority.BACKGROUND,
                async (agent) => {
                    console.log('🌳 Gathering wood...');

                    try {
                        await skills.collectBlock(agent.bot, 'oak_log', 16);
                        console.log('✅ Wood gathering completed');
                    } catch (error) {
                        console.error('Wood gathering failed:', error);
                    }
                },
                {
                    timeout: 120000,
                    resumable: true,
                    metadata: { type: 'resource_gathering', resource: 'wood' }
                }
            );

            this.setCooldown('gather_resources');
            return true;
        }

        return false;
    }

    /**
     * Setzt alle Cooldowns zurück (für Testing)
     */
    resetCooldowns() {
        this.cooldowns.clear();
        console.log('🔄 Idle task cooldowns reset');
    }
}
