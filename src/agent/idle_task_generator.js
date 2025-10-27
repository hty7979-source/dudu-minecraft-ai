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

                        const animal = agent.bot.nearestEntity(entity =>
                            entity.name === animalType &&
                            entity.position.distanceTo(agent.bot.entity.position) < searchRadius
                        );

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
                                await skills.craftRecipe(agent.bot, 'bowl', 1);
                                hasBowl = true;
                                break;
                            }
                        }

                        if (hasBowl) {
                            await skills.craftRecipe(agent.bot, 'mushroom_stew', 1);
                            console.log('✅ Crafted mushroom stew from wild mushrooms');
                            console.log('✅ Food task completed');
                            return;
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
                        await smartCraft(agent.bot, 'white_bed', 1, skills);
                        console.log('✅ Crafted a bed!');
                        agent.bot.chat('✅ Ich habe ein Bett hergestellt');
                    } else {
                        // Versuche Bett zu finden
                        try {
                            await skills.goToNearestBlock(agent.bot, 'bed', 2, 64);
                            console.log('✅ Found a bed!');
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

        // Für Iron Tools: Prüfe ob wir bereits komplettes Iron Set haben
        if (needsIronTools) {
            const inv = bot.inventory.items();
            const hasIronPickaxe = inv.some(i => i.name === 'iron_pickaxe');
            const hasIronHelmet = inv.some(i => i.name === 'iron_helmet');
            const hasShield = inv.some(i => i.name === 'shield');

            // Wenn wir bereits alles haben, kein Upgrade nötig
            if (hasIronPickaxe && hasIronHelmet && hasShield) {
                needsIronTools = false;
            }
        }

        if (!needsWoodenTools && !needsStoneTools && !needsIronTools) {
            return false;
        }

        // Zeige an was gebraucht wird
        if (needsWoodenTools) console.log('🔧 Tool upgrade available: none → wooden');
        if (needsStoneTools) console.log('🔧 Tool upgrade available: wooden → stone');
        if (needsIronTools) console.log('🔧 Tool upgrade available: stone → iron (full set)');

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
                        await this.craftIronTools(agent);
                        agent.bot.chat('✅ Ich habe Eisenwerkzeuge, Rüstung und Schild hergestellt');
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
                await skills.craftRecipe(agent.bot, `${logType}_planks`, Math.ceil((planksNeeded - totalPlanks) / 4));
            } else {
                console.log('  ⚠️ No logs available to craft planks');
            }
        }

        if ((inventory['stick'] || 0) < sticksNeeded) {
            console.log('  → Crafting sticks...');
            await skills.craftRecipe(agent.bot, 'stick', Math.ceil(sticksNeeded / 4)); // 4 sticks per 2 planks
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
            await skills.craftRecipe(agent.bot, tool.name, 1);
            console.log(`  ✓ ${tool.display} crafted`);
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
            // First ensure we have planks
            if ((inventory['oak_planks'] || 0) < 2) {
                await skills.craftRecipe(agent.bot, 'oak_planks', 1);
            }
            await skills.craftRecipe(agent.bot, 'stick', Math.ceil(sticksNeeded / 4)); // 4 sticks per 2 planks
        }

        // PHASE 4: Craft Tools + Furnace (only if we don't already have them!)
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
            await skills.craftRecipe(agent.bot, item.name, 1);
            console.log(`  ✓ ${item.display} crafted`);
        }

        console.log('✅ Phase 2: All items crafted!');
        console.log('💡 Now you can hunt animals and cook meat for food!');
        console.log('🎉 STAGE 2 COMPLETE!\n');
    }

    /**
     * STUFE 3: Eisenwerkzeuge + Rüstung + Schild craften
     * Workflow: Iron Ore sammeln → Kohle sammeln → Erz schmelzen → Alles craften
     */
    async craftIronTools(agent) {
        console.log('🔥 === STAGE 3: Crafting Iron Tools + Armor + Shield ===\n');

        // PHASE 1: Material-Planung
        const plan = this.materialPlanner.createFullIronSetPlan();
        console.log(this.materialPlanner.summarizePlan(plan));
        console.log('');

        const inventory = this.materialPlanner.getCurrentInventory();

        // Berechne wie viel iron_ingot wir brauchen
        const ironNeeded = plan.toGather['iron_ingot'] || 0;
        const ironHave = inventory['iron_ingot'] || 0;
        const ironToSmelt = Math.max(0, ironNeeded - ironHave);

        console.log(`📊 Iron Status: Have ${ironHave}, Need ${ironNeeded}, Must smelt ${ironToSmelt}`);

        // PHASE 2: Sammle Iron Ore (wenn nötig)
        if (ironToSmelt > 0) {
            console.log(`\n⛏️ Phase 1: Mining ${ironToSmelt}x iron ore...`);

            const oreSuccess = await skills.collectBlock(agent.bot, 'iron_ore', ironToSmelt);
            if (!oreSuccess) {
                throw new Error('Failed to gather iron_ore - not found nearby');
            }

            const oreHave = this.materialPlanner.getCurrentInventory()['iron_ore'] || 0;
            console.log(`  ✓ Mined iron ore (now have ${oreHave})`);

            // PHASE 3: Sammle Coal für Smelting (1 coal = 8 items, aber nehmen wir etwas mehr)
            const coalNeeded = Math.ceil(ironToSmelt / 8) + 2; // +2 als Buffer
            console.log(`\n🪨 Phase 2: Gathering ${coalNeeded}x coal for fuel...`);

            const coalSuccess = await skills.collectBlock(agent.bot, 'coal', coalNeeded);
            if (!coalSuccess) {
                throw new Error('Failed to gather coal - not found nearby');
            }

            const coalHave = this.materialPlanner.getCurrentInventory()['coal'] || 0;
            console.log(`  ✓ Gathered coal (now have ${coalHave})`);

            // PHASE 4: Schmelze Iron Ore → Iron Ingots
            console.log(`\n🔥 Phase 3: Smelting ${ironToSmelt}x iron ore → iron ingots...`);

            const smeltSuccess = await skills.smeltItem(agent.bot, 'iron_ore', ironToSmelt);
            if (!smeltSuccess) {
                throw new Error('Failed to smelt iron ore');
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
                        await skills.craftRecipe(agent.bot, planksName, 1);
                        planksType = planksName;
                        break;
                    }
                }
            }

            if (planksType) {
                await skills.craftRecipe(agent.bot, 'stick', Math.ceil((sticksNeeded - sticksHave) / 4));
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
                    await skills.craftRecipe(agent.bot, planksName, 2);
                    break;
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
            await skills.craftRecipe(agent.bot, tool.name, 1);
            console.log(`  ✓ ${tool.display} crafted`);
        }

        // PHASE 7: Craft Armor
        console.log('\n🛡️ Phase 6: Crafting iron armor...');

        const armor = [
            { name: 'iron_helmet', display: 'Iron Helmet' },
            { name: 'iron_chestplate', display: 'Iron Chestplate' },
            { name: 'iron_leggings', display: 'Iron Leggings' },
            { name: 'iron_boots', display: 'Iron Boots' }
        ];

        for (const piece of armor) {
            console.log(`  → Crafting ${piece.display}...`);
            await skills.craftRecipe(agent.bot, piece.name, 1);
            console.log(`  ✓ ${piece.display} crafted`);
        }

        // PHASE 8: Craft Shield
        console.log('\n🛡️ Phase 7: Crafting shield...');
        console.log('  → Crafting Shield...');
        await skills.craftRecipe(agent.bot, 'shield', 1);
        console.log('  ✓ Shield crafted');

        console.log('\n✅ All items crafted!');
        console.log('💪 Bot is now fully equipped with iron gear!');
        console.log('🎉 STAGE 3 COMPLETE!\n');
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
                    await smartCraft(agent.bot, 'torch', amount, skills);

                    console.log(`✅ Crafted ${amount * 4} torches`);
                } catch (error) {
                    console.error('Torch crafting failed:', error);
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
                    await smartCraft(agent.bot, 'crafting_table', 1, skills);
                    console.log('✅ Crafted crafting table');
                } catch (error) {
                    console.error('Workbench crafting failed:', error);
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
