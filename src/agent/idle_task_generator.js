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

        // Nur wenn Bot wirklich idle ist
        if (!this.agent.taskQueue || !this.agent.taskQueue.isIdle()) {
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
        if (await this.checkToolDurability()) return;  // NEU: Werkzeug-Durability prüfen
        if (await this.checkToolUpgrade()) return;
        if (await this.checkTorches()) return;
        if (await this.checkWorkbench()) return;

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
                    memory.completeDeathRecovery();
                } catch (error) {
                    console.error('Death recovery failed:', error);
                    console.log('❌ Could not recover all items');
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
        const memory = this.agent.contextual_memory;

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
                    // Bestimme Tool-Tier
                    let replacement = null;
                    const toolTier = memory.getBestToolTier();

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
     * NORMAL: Nahrung sammeln
     * Erweiterte Strategie: Jage Tiere, sammle Äpfel, Pilze, Karotten, Kartoffeln
     */
    async checkFoodSupply() {
        const memory = this.agent.contextual_memory;

        if (this.isOnCooldown('gather_food')) return false;
        if (memory.hasEnoughFood(3)) return false; // Mindestens 3 Food

        console.log('🍖 Low food supply detected');

        await this.agent.taskQueue.runTask(
            'gather_food',
            TaskPriority.LOW,
            async (agent) => {
                console.log('🍖 Gathering food...');

                // Strategie 1: Umgebungsscan für essbare Items
                const edibleBlocks = [
                    'brown_mushroom', 'red_mushroom',  // Pilze
                    'carrots', 'potatoes', 'beetroots', 'wheat',  // Farmitems
                    'sweet_berry_bush',  // Beeren
                    'oak_leaves', 'dark_oak_leaves'  // Äpfel von Bäumen
                ];

                let foodCollected = 0;

                // Versuche essbare Items in der Umgebung zu sammeln
                for (const blockType of edibleBlocks) {
                    try {
                        const block = agent.bot.findBlock({
                            matching: (b) => b && b.name === blockType,
                            maxDistance: 32,
                            count: 1
                        });

                        if (block) {
                            console.log(`🍄 Found ${blockType} nearby! Collecting...`);

                            // Sammle 2-5 Blöcke dieses Typs
                            const amount = Math.min(5, 2 + Math.floor(Math.random() * 3));
                            const success = await skills.collectBlock(agent.bot, blockType, amount);

                            if (success) {
                                console.log(`  ✓ Collected ${amount}x ${blockType}`);
                                foodCollected++;
                            }
                        }
                    } catch (error) {
                        // Ignoriere Fehler und versuche nächsten Block-Typ
                    }

                    // Wenn genug Nahrung gesammelt wurde, beende
                    if (foodCollected >= 2) break;
                }

                // Strategie 2: Jage Tiere wenn keine essbaren Pflanzen gefunden wurden
                if (foodCollected === 0) {
                    const animals = ['cow', 'pig', 'chicken', 'sheep', 'rabbit'];

                    for (let i = 0; i < 3; i++) { // Jage 3 Tiere
                        const animal = agent.bot.nearestEntity(entity =>
                            animals.includes(entity.name) &&
                            entity.position.distanceTo(agent.bot.entity.position) < 32
                        );

                        if (animal) {
                            console.log(`🎯 Hunting ${animal.name}...`);
                            await skills.attackEntity(agent.bot, animal);
                        }
                    }
                }

                console.log('✅ Food gathering completed');
            },
            {
                timeout: 120000, // 2 Minuten
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
            TaskPriority.NORMAL,
            async (agent) => {
                console.log('🌙 Need a bed for the night...');

                try {
                    // Versuche zuerst zu craften
                    const hasWool = agent.bot.inventory.items().filter(i => i.name.includes('wool')).length >= 3;
                    const hasPlanks = agent.bot.inventory.items().some(i => i.name.includes('planks'));

                    if (hasWool && hasPlanks) {
                        await smartCraft(agent.bot, 'white_bed', 1, skills);
                        console.log('✅ Crafted a bed!');
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
        let needsIronTools = false;

        if (toolTier === 'stone') {
            // Prüfe ob genug Eisen vorhanden
            const ironCount = bot.inventory.items()
                .filter(i => i.name === 'iron_ingot')
                .reduce((sum, i) => sum + i.count, 0);
            needsIronTools = (ironCount >= 9); // 3 für pickaxe, 3 für axe, 3 für sword
        }

        if (!needsWoodenTools && !needsStoneTools && !needsIronTools) {
            return false;
        }

        // Zeige an was gebraucht wird
        if (needsWoodenTools) console.log('🔧 Tool upgrade available: none → wooden');
        if (needsStoneTools) console.log('🔧 Tool upgrade available: wooden → stone');
        if (needsIronTools) console.log('🔧 Tool upgrade available: stone → iron');

        await this.agent.taskQueue.runTask(
            'upgrade_tools',
            TaskPriority.LOW,
            async (agent) => {
                try {
                    if (needsWoodenTools) {
                        await this.craftWoodenTools(agent);
                    } else if (needsStoneTools) {
                        await this.craftStoneTools(agent);
                    } else if (needsIronTools) {
                        await this.craftIronTools(agent);
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

        if ((inventory['oak_planks'] || 0) < planksNeeded) {
            console.log('  → Crafting oak_planks...');
            await skills.craftRecipe(agent.bot, 'oak_planks', Math.ceil(planksNeeded / 4)); // 4 planks per log
        }

        if ((inventory['stick'] || 0) < sticksNeeded) {
            console.log('  → Crafting sticks...');
            await skills.craftRecipe(agent.bot, 'stick', Math.ceil(sticksNeeded / 4)); // 4 sticks per 2 planks
        }

        // PHASE 4: Craft Tools
        console.log('🔨 Phase 3: Crafting tools...');

        const tools = [
            { name: 'wooden_sword', display: 'Wooden Sword' },
            { name: 'wooden_axe', display: 'Wooden Axe' },
            { name: 'wooden_pickaxe', display: 'Wooden Pickaxe' }
        ];

        for (const tool of tools) {
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

        // PHASE 4: Craft Tools + Furnace
        console.log('🔨 Phase 3: Crafting tools & utilities...');

        const items = [
            { name: 'stone_sword', display: 'Stone Sword' },
            { name: 'stone_axe', display: 'Stone Axe' },
            { name: 'stone_pickaxe', display: 'Stone Pickaxe' },
            { name: 'furnace', display: 'Furnace' }
        ];

        for (const item of items) {
            console.log(`  → Crafting ${item.display}...`);
            await skills.craftRecipe(agent.bot, item.name, 1);
            console.log(`  ✓ ${item.display} crafted`);
        }

        console.log('✅ Phase 2: All items crafted!');
        console.log('💡 Now you can hunt animals and cook meat for food!');
        console.log('🎉 STAGE 2 COMPLETE!\n');
    }

    /**
     * STUFE 3: Eisenwerkzeuge craften
     * Voraussetzung: Eisen bereits vorhanden (iron_ingot)
     */
    async craftIronTools(agent) {
        console.log('🔥 === STAGE 3: Crafting Iron Tools ===\n');

        // PHASE 1: Material-Planung
        const plan = this.materialPlanner.createIronToolsPlan();
        console.log(this.materialPlanner.summarizePlan(plan));
        console.log('');

        // PHASE 2: Sammle Rohstoffe (iron_ingot + sticks)
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

        // PHASE 4: Craft Iron Tools
        console.log('🔨 Phase 3: Crafting iron tools...');

        const tools = [
            { name: 'iron_sword', display: 'Iron Sword' },
            { name: 'iron_axe', display: 'Iron Axe' },
            { name: 'iron_pickaxe', display: 'Iron Pickaxe' }
        ];

        for (const tool of tools) {
            console.log(`  → Crafting ${tool.display}...`);
            await skills.craftRecipe(agent.bot, tool.name, 1);
            console.log(`  ✓ ${tool.display} crafted`);
        }

        console.log('✅ Phase 2: All tools crafted!');
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
        const memory = this.agent.contextual_memory;

        if (this.isOnCooldown('get_workbench')) return false;
        if (memory.inventory.crafting_table) return false;

        // Prüfe ob Holz vorhanden
        const hasLogs = this.agent.bot.inventory.items().some(i => i.name.includes('log'));

        if (!hasLogs) return false;

        console.log('🔨 No crafting table detected');

        await this.agent.taskQueue.runTask(
            'get_workbench',
            TaskPriority.LOW,
            async (agent) => {
                console.log('🔨 Crafting workbench...');

                try {
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
