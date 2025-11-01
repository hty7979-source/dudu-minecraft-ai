/**
 * Advanced Task Manager System für Mindcraft Bot
 * Verwaltet komplexe Multi-Step-Bauprojekte mit intelligenter Planung
 * und Gedächtnisfunktion
 */

import * as mc from "../../../utils/mcdata.js";
import * as world from "../utils/world.js";
import pf from 'mineflayer-pathfinder';

/**
 * Enhanced Tool Manager mit vollständiger Mining-Tier-Unterstützung
 */
class AdvancedToolManager {
    constructor(bot) {
        this.bot = bot;
        
        // Erweiterte Tool-Hierarchie mit Mining-Tiers
        this.toolHierarchy = {
            // Holz-Blöcke - Axt optimal
            wood: {
                best: ['netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe', 'golden_axe'],
                acceptable: ['hand'],
                blocks: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 
                        'mangrove_log', 'cherry_log', 'oak_wood', 'birch_wood', 'spruce_wood', 'jungle_wood',
                        'acacia_wood', 'dark_oak_wood', 'mangrove_wood', 'cherry_wood', 'oak_planks', 
                        'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
                tier: 0 // Kein spezielles Tool erforderlich
            },
            
            // Stein-Blöcke - Spitzhacke erforderlich
            stone: {
                best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe', 'golden_pickaxe'],
                acceptable: [],
                blocks: ['stone', 'cobblestone', 'granite', 'diorite', 'andesite', 'deepslate', 'coal_ore'],
                tier: 0, // Holz-Spitzhacke reicht
                minTool: 'wooden_pickaxe'
            },
            
            // Eisen-Erze - Stein-Spitzhacke minimal erforderlich
            iron_tier: {
                best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe'],
                acceptable: [],
                blocks: ['iron_ore', 'deepslate_iron_ore', 'raw_iron_block'],
                tier: 1, // Stein-Tier erforderlich
                minTool: 'stone_pickaxe'
            },
            
            // Gold/Redstone - Eisen-Spitzhacke minimal erforderlich
            iron_tool_tier: {
                best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe'],
                acceptable: [],
                blocks: ['gold_ore', 'deepslate_gold_ore', 'redstone_ore', 'deepslate_redstone_ore', 
                        'lapis_ore', 'deepslate_lapis_ore', 'emerald_ore', 'deepslate_emerald_ore'],
                tier: 2, // Eisen-Tier erforderlich
                minTool: 'iron_pickaxe'
            },
            
            // Diamant - Eisen-Spitzhacke minimal erforderlich
            diamond_tier: {
                best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe'],
                acceptable: [],
                blocks: ['diamond_ore', 'deepslate_diamond_ore'],
                tier: 2, // Eisen-Tier erforderlich
                minTool: 'iron_pickaxe'
            },
            
            // Obsidian/Ancient Debris - Diamant-Spitzhacke erforderlich
            obsidian_tier: {
                best: ['netherite_pickaxe', 'diamond_pickaxe'],
                acceptable: [],
                blocks: ['obsidian', 'ancient_debris', 'crying_obsidian'],
                tier: 3, // Diamant-Tier erforderlich
                minTool: 'diamond_pickaxe'
            },
            
            // Erde/Sand - Schaufel optimal
            earth: {
                best: ['netherite_shovel', 'diamond_shovel', 'iron_shovel', 'stone_shovel', 'wooden_shovel', 'golden_shovel'],
                acceptable: ['hand'],
                blocks: ['dirt', 'grass_block', 'sand', 'gravel', 'clay', 'soul_sand', 'soul_soil'],
                tier: 0
            },
            
            // Blätter - Schere optimal, aber Hand funktioniert
            leaves: {
                best: ['shears'],
                acceptable: ['hand'],
                blocks: ['oak_leaves', 'birch_leaves', 'spruce_leaves', 'jungle_leaves', 'acacia_leaves', 'dark_oak_leaves'],
                tier: 0
            }
        };
        
        // Tool-Upgrade-Pfade definieren
        this.toolUpgradePaths = {
            pickaxe: ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe'],
            axe: ['wooden_axe', 'stone_axe', 'iron_axe', 'diamond_axe', 'netherite_axe'],
            shovel: ['wooden_shovel', 'stone_shovel', 'iron_shovel', 'diamond_shovel', 'netherite_shovel'],
            sword: ['wooden_sword', 'stone_sword', 'iron_sword', 'diamond_sword', 'netherite_sword']
        };
    }

    /**
     * Überprüft, ob das verfügbare Tool für den Block-Typ ausreicht
     */
    canMineBlock(blockType) {
        const toolCategory = this.findToolCategoryForBlock(blockType);
        if (!toolCategory) return true; // Unbekannte Blöcke als abbaubar annehmen
        
        // Wenn kein minimales Tool erforderlich ist
        if (!toolCategory.minTool) return true;
        
        // Prüfe ob wir das minimal erforderliche Tool haben
        const availableTools = this.getAvailableTools();
        const minToolTier = this.getToolTier(toolCategory.minTool);
        
        for (const tool of availableTools) {
            const toolTier = this.getToolTier(tool);
            if (toolTier >= minToolTier && this.isToolTypeCompatible(tool, toolCategory.minTool)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Findet die Tool-Kategorie für einen Block
     */
    findToolCategoryForBlock(blockType) {
        for (const [category, info] of Object.entries(this.toolHierarchy)) {
            if (info.blocks.includes(blockType)) {
                return info;
            }
        }
        return null;
    }

    /**
     * Bestimmt das Tool-Tier (0=Holz, 1=Stein, 2=Eisen, 3=Diamant, 4=Netherite)
     */
    getToolTier(toolName) {
        if (toolName.includes('wooden')) return 0;
        if (toolName.includes('stone')) return 1;
        if (toolName.includes('iron')) return 2;
        if (toolName.includes('diamond')) return 3;
        if (toolName.includes('netherite')) return 4;
        if (toolName.includes('golden')) return 0; // Gold ist wie Holz-Tier
        return 0;
    }

    /**
     * Prüft ob zwei Tools kompatible Typen sind (beide Spitzhacken, etc.)
     */
    isToolTypeCompatible(tool1, tool2) {
        const getType = (tool) => {
            if (tool.includes('pickaxe')) return 'pickaxe';
            if (tool.includes('axe')) return 'axe';
            if (tool.includes('shovel')) return 'shovel';
            if (tool.includes('sword')) return 'sword';
            return 'other';
        };
        return getType(tool1) === getType(tool2);
    }

    /**
     * Holt alle verfügbaren Tools aus dem Inventar
     */
    getAvailableTools() {
        const tools = [];
        for (const item of this.bot.inventory.items()) {
            if (item.name.includes('pickaxe') || item.name.includes('axe') || 
                item.name.includes('shovel') || item.name.includes('sword')) {
                tools.push(item.name);
            }
        }
        return tools;
    }

    /**
     * Schlägt erforderliche Tool-Upgrades vor
     */
    suggestToolUpgrades(targetBlocks) {
        const suggestions = [];
        
        for (const blockType of targetBlocks) {
            if (!this.canMineBlock(blockType)) {
                const toolCategory = this.findToolCategoryForBlock(blockType);
                if (toolCategory && toolCategory.minTool) {
                    suggestions.push({
                        reason: `Cannot mine ${blockType}`,
                        requiredTool: toolCategory.minTool,
                        blockType: blockType
                    });
                }
            }
        }
        
        return suggestions;
    }
}

/**
 * Smelting Manager für Metall-Verarbeitung
 */
class SmeltingManager {
    constructor(bot) {
        this.bot = bot;
        this.smeltingRecipes = {
            // Erz zu Barren
            'iron_ore': 'iron_ingot',
            'deepslate_iron_ore': 'iron_ingot',
            'raw_iron': 'iron_ingot',
            'gold_ore': 'gold_ingot',
            'deepslate_gold_ore': 'gold_ingot',
            'raw_gold': 'gold_ingot',
            'copper_ore': 'copper_ingot',
            'deepslate_copper_ore': 'copper_ingot',
            'raw_copper': 'copper_ingot',
            
            // Andere Smelting-Rezepte
            'cobblestone': 'stone',
            'sand': 'glass',
            'clay_ball': 'brick',
            'netherrack': 'nether_brick',
            'cactus': 'green_dye'
        };
        
        this.fuelSources = [
            'coal', 'charcoal', 'blaze_rod', 'lava_bucket', 
            'oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks',
            'acacia_planks', 'dark_oak_planks', 'oak_log', 'birch_log'
        ];
    }

    /**
     * Prüft ob ein Item geschmolzen werden kann
     */
    canSmelt(itemName) {
        return this.smeltingRecipes.hasOwnProperty(itemName);
    }

    /**
     * Holt das Smelting-Resultat für ein Item
     */
    getSmeltingResult(itemName) {
        return this.smeltingRecipes[itemName];
    }

    /**
     * Findet verfügbaren Brennstoff im Inventar
     */
    getAvailableFuel() {
        const inventory = world.getInventoryCounts(this.bot);
        for (const fuel of this.fuelSources) {
            if ((inventory[fuel] || 0) > 0) {
                return { type: fuel, count: inventory[fuel] };
            }
        }
        return null;
    }

    /**
     * Plant eine Smelting-Operation
     */
    planSmeltingOperation(itemName, quantity) {
        if (!this.canSmelt(itemName)) {
            return null;
        }

        const fuel = this.getAvailableFuel();
        if (!fuel) {
            return {
                success: false,
                reason: 'No fuel available',
                requiredItems: ['coal', 'charcoal', 'any_planks']
            };
        }

        return {
            success: true,
            inputItem: itemName,
            outputItem: this.getSmeltingResult(itemName),
            quantity: quantity,
            fuel: fuel,
            requiredItems: ['furnace']
        };
    }
}

/**
 * Task Manager für komplexe Bauprojekte
 */
export class TaskManager {
    constructor(bot, skillsFunctions = null) {
        this.bot = bot;
        this.skills = skillsFunctions || {};
        this.toolManager = new AdvancedToolManager(bot);
        this.smeltingManager = new SmeltingManager(bot);
        
        // Task-System
        this.activeTasks = [];
        this.completedTasks = [];
        this.taskQueue = [];
        this.currentTask = null;

        // Prioritäts-Konstanten
        this.PRIORITY = {
            CRITICAL: 100,    // LLM-Befehle, Spieler-Befehle
            HIGH: 50,         // Tool-Upgrades, wichtige Tasks
            NORMAL: 25,       // Standard-Tasks
            LOW: 10          // Idle-Tasks, Background-Tasks
        };
        
        // Gedächtnisfunktion
        this.memory = bot.memory || {};
        this.initializeMemory();
        
        // Storage-Management
        this.storageLocations = new Map();
        this.autoChestCreation = true;
    }

    /**
     * Initialisiert die Gedächtnisstrukturen
     */
    initializeMemory() {
        if (!this.memory.taskHistory) {
            this.memory.taskHistory = [];
        }
        if (!this.memory.buildingProjects) {
            this.memory.buildingProjects = {};
        }
        if (!this.memory.knownRecipes) {
            this.memory.knownRecipes = {};
        }
        if (!this.memory.storageLocations) {
            this.memory.storageLocations = {};
        }
        if (!this.memory.toolUpgradeNeeds) {
            this.memory.toolUpgradeNeeds = [];
        }
    }

    /**
     * Erstellt eine neue komplexe Aufgabe
     */
    async createComplexTask(taskName, requirements, description = '', priority = null) {
        console.log(`🎯 Creating complex task: ${taskName}`);

        const task = {
            id: this.generateTaskId(),
            name: taskName,
            description: description,
            requirements: requirements,
            status: 'PLANNED',
            createdAt: new Date(),
            subtasks: [],
            dependencies: {},
            priority: priority !== null ? priority : this.PRIORITY.NORMAL,
            progress: {
                completed: 0,
                total: 0
            }
        };

        // Analysiere Anforderungen und erstelle Subtasks
        await this.analyzeRequirements(task);

        // Füge zur Task-Queue hinzu und sortiere nach Priorität
        this.taskQueue.push(task);
        this.sortTaskQueueByPriority();

        // Speichere in Gedächtnis
        this.memory.taskHistory.push({
            taskId: task.id,
            name: taskName,
            createdAt: task.createdAt,
            status: 'CREATED'
        });

        console.log(`✅ Created task "${taskName}" with ${task.subtasks.length} subtasks (Priority: ${task.priority})`);
        return task;
    }

    /**
     * Fügt einen Task direkt mit höchster Priorität ein (für LLM/Spieler-Befehle)
     */
    async addCriticalTask(taskName, requirements, description = '') {
        console.log(`⚡ Adding CRITICAL task: ${taskName}`);
        return await this.createComplexTask(taskName, requirements, description, this.PRIORITY.CRITICAL);
    }

    /**
     * Fügt einen einfachen Task direkt in die Queue ein
     * Nützlich für direkte Befehle ohne komplexe Anforderungen
     */
    addDirectTask(taskName, executeFunction, priority = null) {
        const task = {
            id: this.generateTaskId(),
            name: taskName,
            description: 'Direct command execution',
            status: 'PLANNED',
            createdAt: new Date(),
            priority: priority !== null ? priority : this.PRIORITY.CRITICAL,
            isDirect: true,
            executeFunction: executeFunction,
            subtasks: [],
            progress: {
                completed: 0,
                total: 1
            }
        };

        this.taskQueue.push(task);
        this.sortTaskQueueByPriority();

        console.log(`⚡ Added direct task: ${taskName} (Priority: ${task.priority})`);
        return task;
    }

    /**
     * Sortiert die Task-Queue nach Priorität (höchste zuerst)
     */
    sortTaskQueueByPriority() {
        this.taskQueue.sort((a, b) => {
            // Höhere Priorität zuerst
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            // Bei gleicher Priorität: ältere Tasks zuerst
            return a.createdAt - b.createdAt;
        });
    }

    /**
     * Analysiert Aufgabenanforderungen und erstellt Subtasks
     */
    async analyzeRequirements(task) {
        const { requirements } = task;
        
        for (const [itemName, quantity] of Object.entries(requirements)) {
            await this.analyzeItemRequirement(task, itemName, quantity);
        }
        
        // Sortiere Subtasks nach Abhängigkeiten
        this.sortSubtasksByDependencies(task);
        
        // Aktualisiere Progress-Zähler
        task.progress.total = task.subtasks.length;
    }

    /**
     * Analysiert ein einzelnes Item-Requirement
     */
    async analyzeItemRequirement(task, itemName, quantity) {
        const currentInventory = world.getInventoryCounts(this.bot);
        const available = currentInventory[itemName] || 0;
        
        if (available >= quantity) {
            // Item bereits verfügbar
            return;
        }
        
        const needed = quantity - available;
        
        // Prüfe ob Item gecraftet werden kann
        const craftingPlan = mc.getDetailedCraftingPlan(itemName, needed, currentInventory);
        
        if (craftingPlan && !craftingPlan.includes('Cannot craft')) {
            // Item kann gecraftet werden
            await this.createCraftingSubtasks(task, itemName, needed, craftingPlan);
        } else {
            // Item muss gesammelt werden
            await this.createGatheringSubtasks(task, itemName, needed);
        }
    }

    /**
     * Erstellt Crafting-Subtasks
     */
    async createCraftingSubtasks(task, itemName, quantity, craftingPlan) {
        // Parse benötigte Materialien
        const missingItems = this.parseMissingItemsFromPlan(craftingPlan);
        
        // Erstelle Subtasks für missing materials
        for (const [materialName, materialQty] of Object.entries(missingItems)) {
            await this.createMaterialSubtask(task, materialName, materialQty);
        }
        
        // Erstelle Crafting-Subtask
        const craftingSubtask = {
            id: this.generateSubtaskId(),
            type: 'CRAFT',
            itemName: itemName,
            quantity: quantity,
            status: 'PENDING',
            dependencies: Object.keys(missingItems),
            priority: this.calculateTaskPriority('CRAFT', itemName),
            estimatedTime: quantity * 5 // 5 Sekunden pro Item
        };
        
        task.subtasks.push(craftingSubtask);
        
        // Prüfe ob Smelting erforderlich ist
        if (this.smeltingManager.canSmelt(itemName)) {
            await this.createSmeltingSubtasks(task, itemName, quantity);
        }
    }

    /**
     * Erstellt Gathering-Subtasks
     */
    async createGatheringSubtasks(task, itemName, quantity) {
        const blockSources = mc.getItemBlockSources(itemName);
        
        if (!blockSources || blockSources.length === 0) {
            console.log(`⚠️ Unknown how to gather ${itemName}`);
            return;
        }
        
        const primarySource = blockSources[0];
        
        // Prüfe Tool-Anforderungen
        const canMine = this.toolManager.canMineBlock(primarySource);
        
        if (!canMine) {
            // Erstelle Tool-Upgrade-Subtask
            await this.createToolUpgradeSubtasks(task, primarySource);
        }
        
        // Erstelle Gathering-Subtask
        const gatheringSubtask = {
            id: this.generateSubtaskId(),
            type: 'GATHER',
            blockType: primarySource,
            itemName: itemName,
            quantity: quantity,
            status: 'PENDING',
            dependencies: canMine ? [] : ['tool_upgrade'],
            priority: this.calculateTaskPriority('GATHER', itemName),
            estimatedTime: quantity * 10 // 10 Sekunden pro Block
        };
        
        task.subtasks.push(gatheringSubtask);
    }

    /**
     * Erstellt Tool-Upgrade-Subtasks
     */
    async createToolUpgradeSubtasks(task, blockType) {
        const suggestions = this.toolManager.suggestToolUpgrades([blockType]);
        
        for (const suggestion of suggestions) {
            const toolSubtask = {
                id: this.generateSubtaskId(),
                type: 'TOOL_UPGRADE',
                toolName: suggestion.requiredTool,
                reason: suggestion.reason,
                status: 'PENDING',
                dependencies: [],
                priority: 10, // Hohe Priorität für Tools
                estimatedTime: 30 // 30 Sekunden für Tool-Upgrade
            };
            
            task.subtasks.push(toolSubtask);
            
            // Merke dir Tool-Upgrade-Bedarf
            this.memory.toolUpgradeNeeds.push({
                tool: suggestion.requiredTool,
                reason: suggestion.reason,
                taskId: task.id
            });
        }
    }

    /**
     * Erstellt Smelting-Subtasks für Erz-Verarbeitung
     */
    async createSmeltingSubtasks(task, itemName, quantity) {
        // Finde Erz-Items die zu diesem Barren gehören
        const oreItems = [];
        for (const [ore, result] of Object.entries(this.smeltingManager.smeltingRecipes)) {
            if (result === itemName) {
                oreItems.push(ore);
            }
        }
        
        if (oreItems.length === 0) return;
        
        // Erstelle Smelting-Subtask
        const smeltingSubtask = {
            id: this.generateSubtaskId(),
            type: 'SMELT',
            inputItems: oreItems,
            outputItem: itemName,
            quantity: quantity,
            status: 'PENDING',
            dependencies: oreItems,
            priority: this.calculateTaskPriority('SMELT', itemName),
            estimatedTime: quantity * 15 // 15 Sekunden pro Smelting-Operation
        };
        
        task.subtasks.push(smeltingSubtask);
        
        // Erstelle Fuel-Gathering falls nötig
        const fuel = this.smeltingManager.getAvailableFuel();
        if (!fuel) {
            await this.createFuelGatheringSubtask(task);
        }
    }

    /**
     * Erstellt Brennstoff-Gathering-Subtask
     */
    async createFuelGatheringSubtask(task) {
        const fuelSubtask = {
            id: this.generateSubtaskId(),
            type: 'GATHER_FUEL',
            targetItems: ['coal', 'charcoal', 'oak_log'],
            quantity: 10, // 10 Brennstoff-Items sammeln
            status: 'PENDING',
            dependencies: [],
            priority: 8, // Hohe Priorität
            estimatedTime: 60 // 1 Minute für Brennstoff
        };
        
        task.subtasks.push(fuelSubtask);
    }

    /**
     * Automatisches Inventory-Management mit Truhen-Bau
     */
    async manageInventorySpace() {
        const inventoryFull = this.bot.inventory.items().length >= 32;
        
        if (!inventoryFull) return;
        
        console.log('📦 Inventory is full, managing space...');
        
        // Finde oder baue Chest
        let storageChest = await this.findOrCreateChest();
        
        if (storageChest) {
            await this.organizeItemsIntoStorage(storageChest);
            this.updateStorageMemory(storageChest);
        }
    }

    /**
     * Findet existierende Chest oder baut neue
     */
    async findOrCreateChest() {
        // Suche existierende Chest
        let chest = this.bot.findBlock({
            matching: (block) => block && block.name === 'chest',
            maxDistance: 16
        });
        
        if (chest) {
            console.log('📦 Found existing chest');
            return chest;
        }
        
        if (!this.autoChestCreation) return null;
        
        // Baue neue Chest
        console.log('🔨 Building new chest for storage...');
        
        const currentInventory = world.getInventoryCounts(this.bot);
        let hasChest = (currentInventory['chest'] || 0) > 0;
        
        if (!hasChest) {
            // Prüfe ob wir Planks für Chest haben
            const planksCount = (currentInventory['oak_planks'] || 0) + 
                              (currentInventory['birch_planks'] || 0) +
                              (currentInventory['spruce_planks'] || 0);
            
            if (planksCount >= 8) {
                // Crafte Chest aus verfügbaren Planks
                const plankType = planksCount >= 8 ? 'oak_planks' : 
                                 (currentInventory['birch_planks'] || 0) >= 8 ? 'birch_planks' : 'spruce_planks';
                
                if (this.skills.craftRecipe) {
                    await this.skills.craftRecipe(this.bot, 'chest', 1);
                    hasChest = true;
                }
            } else {
                // Sammle Holz für Chest
                console.log('🌲 Gathering wood for chest...');
                if (this.skills.smartCollect) {
                    await this.skills.smartCollect(this.bot, 'oak_log', 2);
                    await this.skills.craftRecipe(this.bot, 'oak_planks', 8);
                    await this.skills.craftRecipe(this.bot, 'chest', 1);
                    hasChest = true;
                }
            }
        }
        
        if (hasChest) {
            // Platziere Chest
            const targetPosition = this.findGoodChestLocation();
            if (targetPosition && this.skills.placeBlock) {
                await this.skills.placeBlock(this.bot, 'chest', targetPosition.x, targetPosition.y, targetPosition.z);
                
                // Finde die gerade platzierte Chest
                chest = this.bot.findBlock({
                    matching: (block) => block && block.name === 'chest',
                    maxDistance: 5
                });
                
                if (chest) {
                    console.log('✅ Successfully built storage chest');
                    return chest;
                }
            }
        }
        
        console.log('⚠️ Could not create storage chest');
        return null;
    }

    /**
     * Findet gute Position für Chest-Platzierung
     */
    findGoodChestLocation() {
        const botPos = this.bot.entity.position;
        
        // Suche flache Position in der Nähe
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                const x = Math.floor(botPos.x) + dx;
                const y = Math.floor(botPos.y);
                const z = Math.floor(botPos.z) + dz;
                
                const groundBlock = this.bot.blockAt({x, y: y-1, z});
                const targetBlock = this.bot.blockAt({x, y, z});
                const aboveBlock = this.bot.blockAt({x, y: y+1, z});
                
                if (groundBlock && groundBlock.type !== 0 && // Solider Boden
                    targetBlock && targetBlock.type === 0 && // Freier Platz
                    aboveBlock && aboveBlock.type === 0) { // Freier Platz darüber
                    return {x, y, z};
                }
            }
        }
        
        return null;
    }

    /**
     * Aktualisiert Storage-Gedächtnis
     */
    updateStorageMemory(chest) {
        const posKey = `${chest.position.x},${chest.position.y},${chest.position.z}`;
        this.memory.storageLocations[posKey] = {
            type: 'chest',
            lastAccessed: new Date(),
            capacity: 27,
            items: {} // Wird bei nächstem Scan aktualisiert
        };
    }

    /**
     * Führt die nächste Aufgabe aus der Queue aus
     */
    async executeNextTask() {
        if (this.taskQueue.length === 0) {
            console.log('📋 No tasks in queue');
            return false;
        }

        // Queue ist automatisch nach Priorität sortiert
        const task = this.taskQueue.shift();
        this.currentTask = task;
        task.status = 'IN_PROGRESS';
        task.startedAt = new Date();

        const priorityLabel = task.priority >= this.PRIORITY.CRITICAL ? '⚡ CRITICAL' :
                             task.priority >= this.PRIORITY.HIGH ? '🔥 HIGH' :
                             task.priority >= this.PRIORITY.NORMAL ? '📋 NORMAL' : '💤 LOW';

        console.log(`🚀 Starting task [${priorityLabel}]: ${task.name}`);

        try {
            // Für direkte Tasks: führe die übergebene Funktion aus
            if (task.isDirect && task.executeFunction) {
                await task.executeFunction();
                task.progress.completed = 1;
            } else {
                // Für normale Tasks: führe Subtasks aus
                await this.executeTaskSubtasks(task);
            }

            task.status = 'COMPLETED';
            task.completedAt = new Date();
            this.completedTasks.push(task);

            console.log(`✅ Completed task: ${task.name}`);

            // Aktualisiere Gedächtnis
            this.memory.taskHistory.push({
                taskId: task.id,
                name: task.name,
                status: 'COMPLETED',
                completedAt: task.completedAt,
                duration: task.completedAt - task.startedAt
            });

            return true;

        } catch (error) {
            console.log(`❌ Task failed: ${task.name} - ${error.message}`);
            task.status = 'FAILED';
            task.error = error.message;
            return false;
        } finally {
            this.currentTask = null;
        }
    }

    /**
     * Führt Subtasks einer Aufgabe aus
     */
    async executeTaskSubtasks(task) {
        for (const subtask of task.subtasks) {
            if (subtask.status === 'COMPLETED') continue;
            
            // Prüfe Abhängigkeiten
            if (!this.areSubtaskDependenciesMet(task, subtask)) {
                console.log(`⏳ Waiting for dependencies: ${subtask.id}`);
                continue;
            }
            
            // Inventory-Management vor jedem Subtask
            await this.manageInventorySpace();
            
            subtask.status = 'IN_PROGRESS';
            console.log(`🔄 Executing subtask: ${subtask.type} - ${subtask.itemName || subtask.blockType || subtask.toolName}`);
            
            const success = await this.executeSubtask(subtask);
            
            if (success) {
                subtask.status = 'COMPLETED';
                task.progress.completed++;
                console.log(`✅ Subtask completed: ${subtask.id}`);
            } else {
                subtask.status = 'FAILED';
                console.log(`❌ Subtask failed: ${subtask.id}`);
            }
        }
    }

    /**
     * Führt einen einzelnen Subtask aus
     */
    async executeSubtask(subtask) {
        try {
            switch (subtask.type) {
                case 'CRAFT':
                    return await this.executeCraftSubtask(subtask);
                
                case 'GATHER':
                    return await this.executeGatherSubtask(subtask);
                
                case 'TOOL_UPGRADE':
                    return await this.executeToolUpgradeSubtask(subtask);
                
                case 'SMELT':
                    return await this.executeSmeltSubtask(subtask);
                
                case 'GATHER_FUEL':
                    return await this.executeGatherFuelSubtask(subtask);
                
                default:
                    console.log(`⚠️ Unknown subtask type: ${subtask.type}`);
                    return false;
            }
        } catch (error) {
            console.log(`❌ Subtask execution error: ${error.message}`);
            return false;
        }
    }

    /**
     * Führt Craft-Subtask aus
     */
    async executeCraftSubtask(subtask) {
        if (this.skills.craftRecipe) {
            return await this.skills.craftRecipe(this.bot, subtask.itemName, subtask.quantity);
        } else if (this.skills.smartCraft) {
            return await this.skills.smartCraft(this.bot, subtask.itemName, subtask.quantity);
        }
        return false;
    }

    /**
     * Führt Gather-Subtask aus
     */
    async executeGatherSubtask(subtask) {
        if (this.skills.smartCollect) {
            return await this.skills.smartCollect(this.bot, subtask.blockType, subtask.quantity);
        } else if (this.skills.collectBlock) {
            return await this.skills.collectBlock(this.bot, subtask.blockType, subtask.quantity);
        }
        return false;
    }

    /**
     * Führt Tool-Upgrade-Subtask aus
     */
    async executeToolUpgradeSubtask(subtask) {
        if (this.skills.smartCraft) {
            return await this.skills.smartCraft(this.bot, subtask.toolName, 1);
        }
        return false;
    }

    /**
     * Führt Smelt-Subtask aus
     */
    async executeSmeltSubtask(subtask) {
        // Implementierung für Smelting
        console.log(`🔥 Starting smelting operation: ${subtask.inputItems} -> ${subtask.outputItem}`);
        
        // Finde oder baue Furnace
        let furnace = this.bot.findBlock({
            matching: (block) => block && (block.name === 'furnace' || block.name === 'blast_furnace'),
            maxDistance: 16
        });
        
        if (!furnace) {
            // Baue Furnace falls nötig
            if (this.skills.smartCraft) {
                await this.skills.smartCraft(this.bot, 'furnace', 1);
            }
        }
        
        // Implementiere Smelting-Logik hier
        // Dies würde eine detailliertere Smelting-Funktion in skills.js erfordern
        
        return true; // Placeholder
    }

    /**
     * Führt Fuel-Gathering-Subtask aus
     */
    async executeGatherFuelSubtask(subtask) {
        // Versuche verschiedene Brennstoff-Quellen
        for (const fuelType of subtask.targetItems) {
            if (fuelType.includes('log')) {
                if (this.skills.smartCollect) {
                    const success = await this.skills.smartCollect(this.bot, fuelType, 5);
                    if (success) return true;
                }
            } else if (fuelType === 'coal') {
                if (this.skills.smartCollect) {
                    const success = await this.skills.smartCollect(this.bot, 'coal_ore', 3);
                    if (success) return true;
                }
            }
        }
        return false;
    }

    // Hilfsfunktionen
    generateTaskId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    }

    generateSubtaskId() {
        return 'subtask_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    }

    calculateTaskPriority(type, itemName) {
        const priorities = {
            'TOOL_UPGRADE': 10,
            'GATHER_FUEL': 8,
            'SMELT': 6,
            'CRAFT': 5,
            'GATHER': 3
        };
        return priorities[type] || 1;
    }

    areSubtaskDependenciesMet(task, subtask) {
        for (const depId of subtask.dependencies) {
            const depSubtask = task.subtasks.find(st => st.id === depId || st.itemName === depId);
            if (!depSubtask || depSubtask.status !== 'COMPLETED') {
                return false;
            }
        }
        return true;
    }

    parseMissingItemsFromPlan(craftingPlan) {
        const missing = {};
        const lines = craftingPlan.split('\n');
        
        for (const line of lines) {
            const match = line.match(/Missing (\d+) (.+)/);
            if (match) {
                missing[match[2]] = parseInt(match[1]);
            }
        }
        
        return missing;
    }

    sortSubtasksByDependencies(task) {
        // Einfache topologische Sortierung
        task.subtasks.sort((a, b) => {
            if (a.dependencies.includes(b.id)) return 1;
            if (b.dependencies.includes(a.id)) return -1;
            return a.priority - b.priority;
        });
    }

    async organizeItemsIntoStorage(storageChest) {
        // Storage-Organisation implementieren
        console.log('🗂️ Organizing items into storage...');
        // Implementierung ähnlich der bestehenden organizeItemsIntoStorage Funktion
    }

    /**
     * Erstellt Material-Subtask (rekursiv für komplexe Abhängigkeiten)
     */
    async createMaterialSubtask(task, materialName, quantity) {
        // Prüfe ob Material bereits als Subtask existiert
        const existingSubtask = task.subtasks.find(st => 
            st.itemName === materialName && st.type === 'GATHER'
        );
        
        if (existingSubtask) {
            // Erhöhe Quantity falls nötig
            existingSubtask.quantity = Math.max(existingSubtask.quantity, quantity);
            return;
        }
        
        // Rekursive Analyse für das Material
        await this.analyzeItemRequirement(task, materialName, quantity);
    }

    /**
     * API: Erstelle ein Standard-Bauprojekt
     */
    async createBuildingProject(projectName, itemRequirements, description = '') {
        console.log(`🏗️ Creating building project: ${projectName}`);
        
        const task = await this.createComplexTask(
            projectName,
            itemRequirements,
            description
        );
        
        // Speichere Projekt-Information im Gedächtnis
        this.memory.buildingProjects[projectName] = {
            taskId: task.id,
            requirements: itemRequirements,
            createdAt: new Date(),
            status: 'PLANNED'
        };
        
        return task;
    }

    /**
     * API: Hole Task-Status
     */
    getTaskStatus(taskId) {
        const task = this.activeTasks.find(t => t.id === taskId) ||
                   this.completedTasks.find(t => t.id === taskId) ||
                   this.taskQueue.find(t => t.id === taskId);
        
        if (!task) return null;
        
        return {
            id: task.id,
            name: task.name,
            status: task.status,
            progress: task.progress,
            subtasks: task.subtasks.map(st => ({
                id: st.id,
                type: st.type,
                status: st.status,
                itemName: st.itemName,
                blockType: st.blockType
            }))
        };
    }

    /**
     * API: Zeige Gedächtnis-Übersicht
     */
    getMemoryOverview() {
        return {
            taskHistory: this.memory.taskHistory.slice(-10), // Letzte 10 Tasks
            buildingProjects: Object.keys(this.memory.buildingProjects),
            toolUpgradeNeeds: this.memory.toolUpgradeNeeds,
            storageLocations: Object.keys(this.memory.storageLocations)
        };
    }
}

/**
 * Hauptfunktionen für Integration in Mindcraft
 */
export async function createComplexTask(bot, taskName, requirements, skillsFunctions = null, priority = null) {
    const taskManager = new TaskManager(bot, skillsFunctions);
    return await taskManager.createComplexTask(taskName, requirements, '', priority);
}

/**
 * Fügt einen Task mit höchster Priorität hinzu (für LLM/Spieler-Befehle)
 */
export async function addCriticalTask(bot, taskName, requirements, skillsFunctions = null) {
    const taskManager = new TaskManager(bot, skillsFunctions);
    return await taskManager.addCriticalTask(taskName, requirements);
}

/**
 * Fügt einen direkten Task mit Ausführungsfunktion hinzu
 */
export function addDirectTask(bot, taskName, executeFunction, priority = null, skillsFunctions = null) {
    const taskManager = new TaskManager(bot, skillsFunctions);
    return taskManager.addDirectTask(taskName, executeFunction, priority);
}

export async function executeTask(bot, skillsFunctions = null) {
    const taskManager = new TaskManager(bot, skillsFunctions);
    return await taskManager.executeNextTask();
}

export async function createBuildingProject(bot, projectName, requirements, skillsFunctions = null) {
    const taskManager = new TaskManager(bot, skillsFunctions);
    return await taskManager.createBuildingProject(projectName, requirements);
}