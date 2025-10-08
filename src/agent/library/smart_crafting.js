/**
 * Smart Crafting System für Mindcraft Bot
 * Erweitert die bestehenden Crafting-Funktionen um intelligente Storage-Management
 * und optimale Resource-Planung
 */

import * as mc from "../../utils/mcdata.js";
import * as world from "./world.js";
import Vec3 from 'vec3';

// Import pathfinder für sichere Navigation
import pf from 'mineflayer-pathfinder';

/**
 * Intelligente Tool-Auswahl für optimales Block-Abbauen
 */
class SmartToolManager {
    constructor(bot) {
        this.bot = bot;
        this.toolHierarchy = {
            // Holz-Blöcke - Axt ist am besten, Hand funktioniert auch
            wood: {
                best: ['netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe', 'golden_axe'],
                acceptable: ['hand'],
                blocks: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log',
                        'oak_wood', 'birch_wood', 'spruce_wood', 'jungle_wood', 'acacia_wood', 'dark_oak_wood', 'mangrove_wood', 'cherry_wood',
                        'oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks'],
                minTool: null
            },
            // Stein-Blöcke - Spitzhacke erforderlich (Holz-Tier reicht)
            stone: {
                best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe', 'golden_pickaxe'],
                acceptable: [],
                blocks: ['stone', 'cobblestone', 'granite', 'diorite', 'andesite', 'deepslate', 'coal_ore'],
                minTool: 'wooden_pickaxe'
            },
            // Eisen-Erze - Stein-Spitzhacke minimal erforderlich
            iron_tier: {
                best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe'],
                acceptable: [],
                blocks: ['iron_ore', 'deepslate_iron_ore', 'raw_iron_block'],
                minTool: 'stone_pickaxe'
            },
            // Gold/Redstone/Lapis/Emerald - Eisen-Spitzhacke minimal erforderlich
            iron_tool_tier: {
                best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe'],
                acceptable: [],
                blocks: ['gold_ore', 'deepslate_gold_ore', 'redstone_ore', 'deepslate_redstone_ore', 
                        'lapis_ore', 'deepslate_lapis_ore', 'emerald_ore', 'deepslate_emerald_ore'],
                minTool: 'iron_pickaxe'
            },
            // Diamant - Eisen-Spitzhacke minimal erforderlich
            diamond_tier: {
                best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe'],
                acceptable: [],
                blocks: ['diamond_ore', 'deepslate_diamond_ore'],
                minTool: 'iron_pickaxe'
            },
            // Obsidian/Ancient Debris - Diamant-Spitzhacke erforderlich
            obsidian_tier: {
                best: ['netherite_pickaxe', 'diamond_pickaxe'],
                acceptable: [],
                blocks: ['obsidian', 'ancient_debris', 'crying_obsidian'],
                minTool: 'diamond_pickaxe'
            },
            // Erde/Sand - Schaufel am besten, Hand funktioniert auch
            earth: {
                best: ['netherite_shovel', 'diamond_shovel', 'iron_shovel', 'stone_shovel', 'wooden_shovel', 'golden_shovel'],
                acceptable: ['hand'],
                blocks: ['dirt', 'grass_block', 'sand', 'gravel', 'clay', 'soul_sand', 'soul_soil'],
                minTool: null
            },
            // Blätter - Schere am besten, Hand funktioniert
            leaves: {
                best: ['shears'],
                acceptable: ['hand'],
                blocks: ['oak_leaves', 'birch_leaves', 'spruce_leaves', 'jungle_leaves', 'acacia_leaves', 'dark_oak_leaves'],
                minTool: null
            }
        };
    }

    /**
     * Findet das beste verfügbare Werkzeug für einen Block-Typ
     */
    getBestToolForBlock(blockType) {
        // Finde die passende Tool-Kategorie
        let toolCategory = null;
        for (const [category, info] of Object.entries(this.toolHierarchy)) {
            if (info.blocks.includes(blockType)) {
                toolCategory = info;
                break;
            }
        }

        if (!toolCategory) {
            // Fallback: Verwende Hand für unbekannte Blöcke
            return 'hand';
        }

        // Suche nach dem besten verfügbaren Tool im Inventar
        for (const tool of toolCategory.best) {
            if (this.bot.inventory.findInventoryItem(mc.getItemId(tool))) {
                return tool;
            }
        }

        // Falls kein optimales Tool verfügbar, verwende akzeptables Tool
        for (const tool of toolCategory.acceptable) {
            if (tool === 'hand' || this.bot.inventory.findInventoryItem(mc.getItemId(tool))) {
                return tool;
            }
        }

        // Letzter Fallback: Hand
        return 'hand';
    }

    /**
     * Rüstet automatisch das beste Werkzeug für einen Block aus
     */
    async equipBestToolForBlock(blockType) {
        const bestTool = this.getBestToolForBlock(blockType);
        
        if (bestTool === 'hand') {
            // Unequip current item (hand)
            await this.bot.unequip('hand');
            return true;
        }

        try {
            const toolItem = this.bot.inventory.findInventoryItem(mc.getItemId(bestTool));
            if (toolItem) {
                await this.bot.equip(toolItem, 'hand');
                this.bot.chat(`🔧 Equipped ${bestTool} for mining ${blockType}`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ Failed to equip ${bestTool}: ${error.message}`);
        }

        // Fallback: Verwende Hand
        await this.bot.unequip('hand');
        return false;
    }

    /**
     * Überprüft, ob ein Tool für einen Block-Typ geeignet ist
     */
    isToolSuitableForBlock(toolName, blockType) {
        for (const [category, info] of Object.entries(this.toolHierarchy)) {
            if (info.blocks.includes(blockType)) {
                return info.best.includes(toolName) || info.acceptable.includes(toolName);
            }
        }
        return toolName === 'hand'; // Hand funktioniert immer als Fallback
    }

    /**
     * Überprüft, ob der Block mit verfügbaren Tools abgebaut werden kann
     */
    canMineBlockWithAvailableTools(blockType) {
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
        if (toolName.includes('golden')) return 0; // Gold ist wie Holz-Tier aber schneller
        return 0;
    }

    /**
     * Prüft ob zwei Tools kompatible Typen sind (beide Spitzhacken, etc.)
     */
    isToolTypeCompatible(tool1, tool2) {
        const getType = (tool) => {
            if (tool.includes('pickaxe')) return 'pickaxe';
            if (tool.includes('axe') && !tool.includes('pickaxe')) return 'axe';
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
            if (!this.canMineBlockWithAvailableTools(blockType)) {
                const toolCategory = this.findToolCategoryForBlock(blockType);
                if (toolCategory && toolCategory.minTool) {
                    suggestions.push({
                        reason: `Cannot mine ${blockType}`,
                        requiredTool: toolCategory.minTool,
                        blockType: blockType,
                        currentTier: this.getCurrentToolTier(toolCategory.minTool),
                        requiredTier: this.getToolTier(toolCategory.minTool)
                    });
                }
            }
        }
        
        return suggestions;
    }

    /**
     * Bestimmt das aktuelle Tool-Tier für einen Tool-Typ
     */
    getCurrentToolTier(targetTool) {
        const toolType = this.getToolType(targetTool);
        const availableTools = this.getAvailableTools().filter(tool => 
            this.getToolType(tool) === toolType
        );
        
        let maxTier = -1;
        for (const tool of availableTools) {
            maxTier = Math.max(maxTier, this.getToolTier(tool));
        }
        
        return maxTier;
    }

    /**
     * Extrahiert Tool-Typ aus Tool-Name
     */
    getToolType(toolName) {
        if (toolName.includes('pickaxe')) return 'pickaxe';
        if (toolName.includes('axe') && !toolName.includes('pickaxe')) return 'axe';
        if (toolName.includes('shovel')) return 'shovel';
        if (toolName.includes('sword')) return 'sword';
        return 'other';
    }
}

export class SmartCraftingManager {
    constructor(bot, skillsFunctions = null) {
        this.bot = bot;
        this.skills = skillsFunctions || {}; // Store skills functions with fallback
        this.state = 'IDLE';
        this.currentGoal = null;
        this.memory = bot.memory || {};
        this.storageNetwork = new Map(); // Cache für Chest-Inhalte
        this.logger = new CraftingLogger(bot);
        this.toolManager = new SmartToolManager(bot); // Intelligente Tool-Verwaltung
        
        // 📋 Memory System für wichtige Strukturen
        this.structureMemory = this.initializeStructureMemory();
    }

    /**
     * 📋 Initialisiert das Struktur-Memory-System
     */
    initializeStructureMemory() {
        if (!this.bot.memory.structures) {
            this.bot.memory.structures = {
                chests: new Map(),           // Bekannte Truhen-Positionen
                craftingTables: new Map(),   // Bekannte Werkbank-Positionen  
                furnaces: new Map(),         // Bekannte Ofen-Positionen
                lastUpdate: Date.now()
            };
        }
        return this.bot.memory.structures;
    }

    /**
     * 📝 Merkt sich wichtige Strukturen für zukünftige Nutzung
     */
    async rememberImportantStructures() {
        console.log('📝 Scanning and remembering important structures...');
        
        try {
            const currentPos = this.bot.entity.position;
            const scanRadius = 64;
            
            // Suche nach Truhen
            const chests = this.bot.findBlocks({
                matching: (block) => block && block.name === 'chest',
                maxDistance: scanRadius,
                count: 20
            });
            
            // Suche nach Werkbänken
            const craftingTables = this.bot.findBlocks({
                matching: (block) => block && block.name === 'crafting_table',
                maxDistance: scanRadius,
                count: 10
            });
            
            // Suche nach Öfen
            const furnaces = this.bot.findBlocks({
                matching: (block) => block && (block.name === 'furnace' || block.name === 'blast_furnace'),
                maxDistance: scanRadius,
                count: 10
            });
            
            // Speichere gefundene Strukturen
            let newChests = 0, newCraftingTables = 0, newFurnaces = 0;
            
            // Truhen merken
            for (const chestPos of chests) {
                const posKey = `${chestPos.x},${chestPos.y},${chestPos.z}`;
                if (!this.structureMemory.chests.has(posKey)) {
                    this.structureMemory.chests.set(posKey, {
                        position: chestPos,
                        discoveredAt: Date.now(),
                        lastVerified: Date.now(),
                        distance: currentPos.distanceTo(chestPos)
                    });
                    newChests++;
                }
            }
            
            // Werkbänke merken
            for (const tablePos of craftingTables) {
                const posKey = `${tablePos.x},${tablePos.y},${tablePos.z}`;
                if (!this.structureMemory.craftingTables.has(posKey)) {
                    this.structureMemory.craftingTables.set(posKey, {
                        position: tablePos,
                        discoveredAt: Date.now(),
                        lastVerified: Date.now(),
                        distance: currentPos.distanceTo(tablePos)
                    });
                    newCraftingTables++;
                }
            }
            
            // Öfen merken
            for (const furnacePos of furnaces) {
                const posKey = `${furnacePos.x},${furnacePos.y},${furnacePos.z}`;
                if (!this.structureMemory.furnaces.has(posKey)) {
                    this.structureMemory.furnaces.set(posKey, {
                        position: furnacePos,
                        discoveredAt: Date.now(),
                        lastVerified: Date.now(),
                        distance: currentPos.distanceTo(furnacePos)
                    });
                    newFurnaces++;
                }
            }
            
            this.structureMemory.lastUpdate = Date.now();
            
            if (newChests > 0 || newCraftingTables > 0 || newFurnaces > 0) {
                console.log(`📝 Remembered: ${newChests} chests, ${newCraftingTables} crafting tables, ${newFurnaces} furnaces`);
                this.bot.chat(`📝 Discovered and remembered: ${newChests} chests, ${newCraftingTables} crafting tables, ${newFurnaces} furnaces!`);
            }
            
            // Speichere Memory persistent
            this.saveStructureMemory();
            
        } catch (error) {
            console.log(`⚠️ Error remembering structures: ${error.message}`);
        }
    }

    /**
     * 🔍 Findet die nächste bekannte Truhe aus dem Memory
     */
    async findNearestRememberedChest() {
        await this.verifyRememberedStructures('chests');
        
        const currentPos = this.bot.entity.position;
        let nearestChest = null;
        let minDistance = Infinity;
        
        for (const [posKey, chestInfo] of this.structureMemory.chests.entries()) {
            const distance = currentPos.distanceTo(chestInfo.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestChest = chestInfo;
            }
        }
        
        if (nearestChest) {
            console.log(`📦 Found nearest remembered chest at distance ${minDistance.toFixed(1)}`);
            return nearestChest.position;
        }
        
        return null;
    }

    /**
     * 🔧 Findet die nächste bekannte Werkbank aus dem Memory
     */
    async findNearestRememberedCraftingTable() {
        await this.verifyRememberedStructures('craftingTables');
        
        const currentPos = this.bot.entity.position;
        let nearestTable = null;
        let minDistance = Infinity;
        
        for (const [posKey, tableInfo] of this.structureMemory.craftingTables.entries()) {
            const distance = currentPos.distanceTo(tableInfo.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestTable = tableInfo;
            }
        }
        
        if (nearestTable) {
            console.log(`🔧 Found nearest remembered crafting table at distance ${minDistance.toFixed(1)}`);
            return nearestTable.position;
        }
        
        return null;
    }

    /**
     * ✅ Verifiziert dass gespeicherte Strukturen noch existieren
     */
    async verifyRememberedStructures(structureType = 'all') {
        const currentTime = Date.now();
        const verifyInterval = 5 * 60 * 1000; // 5 Minuten
        
        if (currentTime - this.structureMemory.lastUpdate < verifyInterval) {
            return; // Noch nicht Zeit für Verification
        }
        
        const typesToVerify = structureType === 'all' ? ['chests', 'craftingTables', 'furnaces'] : [structureType];
        
        for (const type of typesToVerify) {
            const structures = this.structureMemory[type];
            if (!structures) continue;
            
            const toRemove = [];
            
            for (const [posKey, structureInfo] of structures.entries()) {
                const block = this.bot.blockAt(structureInfo.position);
                const expectedBlockName = type === 'chests' ? 'chest' : 
                                         type === 'craftingTables' ? 'crafting_table' : 'furnace';
                
                if (!block || block.name !== expectedBlockName) {
                    console.log(`❌ Structure ${type} at ${posKey} no longer exists - removing from memory`);
                    toRemove.push(posKey);
                } else {
                    structureInfo.lastVerified = currentTime;
                }
            }
            
            // Entferne nicht mehr existierende Strukturen
            for (const posKey of toRemove) {
                structures.delete(posKey);
            }
            
            if (toRemove.length > 0) {
                console.log(`🧹 Cleaned up ${toRemove.length} non-existent ${type} from memory`);
            }
        }
        
        this.structureMemory.lastUpdate = currentTime;
        this.saveStructureMemory();
    }

    /**
     * 💾 Speichert Structure Memory persistent
     */
    saveStructureMemory() {
        try {
            // Konvertiere Maps zu Objects für JSON serialization
            const serializable = {
                chests: Object.fromEntries(this.structureMemory.chests || new Map()),
                craftingTables: Object.fromEntries(this.structureMemory.craftingTables || new Map()),
                furnaces: Object.fromEntries(this.structureMemory.furnaces || new Map()),
                lastUpdate: this.structureMemory.lastUpdate
            };
            
            this.bot.memory.structures = serializable;
        } catch (error) {
            console.log(`⚠️ Error saving structure memory: ${error.message}`);
        }
    }

    /**
     * Hauptfunktion: Intelligentes Crafting mit Storage-Management
     * @param {string} itemName - Name des zu craftenden Items
     * @param {number} count - Anzahl der zu craftenden Items
     * @returns {Promise<boolean>} - True wenn erfolgreich
     */
    async craftItemIntelligently(itemName, count = 1) {
        // Store for fallback use und Zielverfolgung
        this.currentCraftingItem = itemName;
        this.originalCraftingTarget = count; // Speichere das ursprüngliche Ziel
        
        const sessionId = this.logger.logCraftingStart(itemName, count);
        console.log(`🎯 Starting intelligent crafting: ${count}x ${itemName}`);
        
        // 📦 Pre-Check: Haben wir bereits genug vom Ziel-Item?
        const currentInventory = world.getInventoryCounts(this.bot);
        const alreadyHave = currentInventory[itemName] || 0;
        
        if (alreadyHave >= count) {
            console.log(`✅ Already have ${alreadyHave}x ${itemName} (need ${count})`);
            this.bot.chat(`✅ Already have enough ${itemName}!`);
            return true;
        }
        
        const stillNeed = count - alreadyHave;
        this.currentCraftingCount = stillNeed; // Update to actual needed amount
        if (alreadyHave > 0) {
            console.log(`📦 Already have ${alreadyHave}x ${itemName}, need ${stillNeed} more`);
        }
        
        try {
            // Phase 1: Vollständige Analyse
            this.logger.logCraftingPhase(sessionId, 'ANALYSIS_START');
            const analysis = await this.analyzeCurrentSituation(itemName, count);
            this.logger.logCraftingPhase(sessionId, 'ANALYSIS_COMPLETE', { 
                missingItems: Object.keys(analysis.missingItems).length,
                storageChests: Object.keys(analysis.storageItems).length
            });
            
            // Phase 2: Erstelle optimalen Plan
            this.logger.logCraftingPhase(sessionId, 'PLANNING_START');
            const plan = await this.createOptimalPlan(analysis);
            this.logger.logCraftingPhase(sessionId, 'PLANNING_COMPLETE', {
                totalPhases: plan.phases.length,
                estimatedTime: plan.totalEstimatedTime
            });
            
            // Phase 3: Führe Plan aus
            this.logger.logCraftingPhase(sessionId, 'EXECUTION_START');
            const result = await this.executePlan(plan);
            this.logger.logCraftingPhase(sessionId, 'EXECUTION_COMPLETE');
            
            this.logger.logCraftingComplete(sessionId, result.success, result);
            return result.success;
            
        } catch (error) {
            console.log(`❌ Crafting failed: ${error.message}`);
            this.logger.logCraftingComplete(sessionId, false, { error: error.message });
            return false;
        }
    }

    /**
     * Intelligente Material-Substitution für Holzarten
     */
    substituteWoodMaterials(craftingPlan, currentInventory) {
        // Liste aller Holzarten in Prioritätsreihenfolge
        const woodTypes = [
            'oak', 'spruce', 'birch', 'jungle', 
            'acacia', 'dark_oak', 'mangrove', 'cherry'
        ];
        
        // Prüfe welche Holzarten verfügbar sind (Logs oder Planks)
        const availableWoodTypes = [];
        for (const woodType of woodTypes) {
            const logCount = currentInventory[`${woodType}_log`] || 0;
            const plankCount = currentInventory[`${woodType}_planks`] || 0;
            if (logCount > 0 || plankCount > 0) {
                availableWoodTypes.push(woodType);
            }
        }
        
        console.log(`🌲 Available wood types: ${availableWoodTypes.join(', ')}`);
        
        // Wenn oak_log/oak_planks in Plan, aber nicht verfügbar, ersetze durch verfügbare Holzart
        if (craftingPlan.missingItems) {
            for (const missingItem of Object.keys(craftingPlan.missingItems)) {
                if (missingItem.includes('oak_') && availableWoodTypes.length > 0) {
                    const preferredWood = availableWoodTypes[0]; // Nehme ersten verfügbaren
                    const substitution = missingItem.replace('oak_', `${preferredWood}_`);
                    
                    console.log(`🔄 Wood substitution: ${missingItem} → ${substitution}`);
                    
                    // Ersetze in Plan
                    if (!craftingPlan.missingItems[substitution]) {
                        craftingPlan.missingItems[substitution] = craftingPlan.missingItems[missingItem];
                    }
                    delete craftingPlan.missingItems[missingItem];
                }
            }
        }
        
        return craftingPlan;
    }

    /**
     * Phase 1: Analysiere aktuelle Situation mit Mindcraft's Funktionen
     */
    async analyzeCurrentSituation(itemName, count) {
        console.log('📊 Analyzing current situation...');
        
        // Nutze Mindcraft's Inventory-System
        const currentInventory = world.getInventoryCounts(this.bot);
        
        // 📦 Inventar-Debug-Info
        const relevantItems = Object.keys(currentInventory).filter(item => 
            item.includes('log') || item.includes('plank') || item.includes('stick') || item === itemName
        );
        if (relevantItems.length > 0) {
            console.log('📦 Current relevant inventory:');
            for (const item of relevantItems) {
                console.log(`   ${item}: ${currentInventory[item]}`);
            }
        }
        
        // Nutze Mindcraft's Crafting-Plan-System  
        // Berechne die tatsächlich benötigte Anzahl (falls bereits Items vorhanden)
        const alreadyHave = currentInventory[itemName] || 0;
        const actuallyNeed = Math.max(0, count - alreadyHave);
        
        console.log(`🎯 Crafting analysis: need ${actuallyNeed}x ${itemName} (have ${alreadyHave}, want ${count})`);
        
        // 🏗️ Erweiterte Umgebungsanalyse VOR Crafting Plan - wichtig für Optimierung
        console.log('🔍 Starting environment analysis...');
        const environmentAnalysis = await this.analyzeEnvironment();
        console.log('🔍 Environment analysis completed:', environmentAnalysis);
        
        // 🔧 Erweitere Inventar um "virtuelle" Items basierend auf Umgebung
        let enhancedInventory = { ...currentInventory };
        if (environmentAnalysis.craftingTables && environmentAnalysis.craftingTables.length > 0) {
            enhancedInventory.crafting_table = 1; // "Fake" crafting table im Inventar für bessere Pläne
            console.log('� Added virtual crafting_table to inventory for planning');
        }
        
        let craftingPlan = mc.getDetailedCraftingPlan(itemName, actuallyNeed, enhancedInventory);
        
        // 🌲 Intelligente Holz-Substitution
        craftingPlan = this.substituteWoodMaterials(craftingPlan, currentInventory);
        
        // Erweitere um Storage-Analyse (mit Fallback bei Fehlern)
        let storageAnalysis = {};
        try {
            storageAnalysis = await this.scanStorageNetwork();
            console.log(`📦 Found ${Object.keys(storageAnalysis).length} accessible chests`);
        } catch (error) {
            console.log(`⚠️ Storage scan failed, continuing without storage: ${error.message}`);
            storageAnalysis = {}; // Leeres Ergebnis = kein Storage verfügbar
        }
        
        // Parse fehlende Items aus dem Plan
        let missingItems = this.parseMissingItemsFromPlan(craftingPlan);
        console.log('📦 Initial missing items:', Object.keys(missingItems));
        
        // 🔧 Intelligente Optimierung basierend auf Umgebung
        missingItems = this.optimizeBasedOnEnvironment(missingItems, environmentAnalysis, currentInventory);
        console.log('✅ Optimized missing items:', Object.keys(missingItems));
        
        return {
            currentInventory: currentInventory,
            craftingPlan: craftingPlan,
            missingItems: missingItems,
            storageItems: storageAnalysis,
            environment: environmentAnalysis,
            inventorySpace: 36 - this.bot.inventory.items().length,
            needsStorageManagement: this.bot.inventory.items().length > 30
        };
    }

    /**
     * Storage-Network-Analyse - erweitert Mindcraft's Block-Finding
     */
    async scanStorageNetwork(radius = 32) {
        console.log('🗃️ Scanning storage network...');
        
        // Nutze Mindcraft's Block-Finding
        const nearbyChests = this.bot.findBlocks({
            matching: (block) => block && block.name === 'chest',
            maxDistance: radius,
            count: 100
        });
        
        const storageMap = {};
        
        for (const chestPos of nearbyChests) {
            const chestKey = `${chestPos.x},${chestPos.y},${chestPos.z}`;
            
            // Cache-Check für Performance
            if (this.storageNetwork.has(chestKey)) {
                const cached = this.storageNetwork.get(chestKey);
                if (Date.now() - cached.lastScanned < 60000) { // 1 Minute Cache
                    storageMap[chestKey] = cached.contents;
                    continue;
                }
            }
            
            try {
                // Navigiere zur Chest mit Pathfinder
                const chestBlock = this.bot.blockAt(chestPos);
                
                // Prüfe Distanz - nur navigieren wenn nötig
                const distanceToChest = this.bot.entity.position.distanceTo(chestPos);
                if (distanceToChest > 4) {
                    console.log(`🚶 Walking to chest at ${chestKey} (distance: ${distanceToChest.toFixed(1)})`);
                    
                    // Nutze Pathfinder-Navigation für sichere Bewegung
                    const goal = new pf.goals.GoalNear(chestPos.x, chestPos.y, chestPos.z, 1);
                    await this.bot.pathfinder.goto(goal);
                    
                    console.log(`✅ Reached chest at ${chestKey}`);
                }
                
                // Verwende robuste openContainer API wie in skills.js
                const chestContainer = await this.bot.openContainer(chestBlock);
                
                const contents = {};
                const containerItems = chestContainer.containerItems();
                for (const item of containerItems) {
                    if (item) {
                        contents[item.name] = (contents[item.name] || 0) + item.count;
                    }
                }
                
                // Sicheres Schließen mit robuster API
                await chestContainer.close();
                
                // Cache Update nur bei Erfolg
                this.storageNetwork.set(chestKey, {
                    contents: contents,
                    lastScanned: Date.now(),
                    position: chestPos
                });
                
                storageMap[chestKey] = contents;
                
            } catch (error) {
                console.log(`⚠️ Could not access chest at ${chestKey}: ${error.message}`);
                // WICHTIG: Nicht abbrechen! Einfach diese Chest überspringen und weitermachen
                // Das System sollte auch ohne Storage-Zugriff funktionieren
                continue;
            }
        }
        
        return storageMap;
    }

    /**
     * 🏗️ Analysiere Umgebung nach bereits vorhandenen Crafting-Strukturen
     */
    async analyzeEnvironment(radius = 32) {
        console.log('🏗️ Analyzing crafting environment...');
        
        const environment = {
            craftingTables: [],
            furnaces: [],
            anvils: [],
            workbenches: []
        };
        
        try {
            // Suche nach Crafting Tables
            const craftingTables = this.bot.findBlocks({
                matching: (block) => block && block.name === 'crafting_table',
                maxDistance: radius,
                count: 10
            });
            
            if (craftingTables.length > 0) {
                console.log(`🔧 Found ${craftingTables.length} crafting table(s) nearby`);
                environment.craftingTables = craftingTables;
                this.bot.chat(`✅ Found ${craftingTables.length} crafting table(s) nearby!`);
            }
            
            // Suche nach Furnaces
            const furnaces = this.bot.findBlocks({
                matching: (block) => block && block.name === 'furnace',
                maxDistance: radius,
                count: 10
            });
            
            if (furnaces.length > 0) {
                console.log(`🔥 Found ${furnaces.length} furnace(s) nearby`);
                environment.furnaces = furnaces;
            }
            
            // Suche nach Anvils
            const anvils = this.bot.findBlocks({
                matching: (block) => block && block.name === 'anvil',
                maxDistance: radius,
                count: 10
            });
            
            if (anvils.length > 0) {
                console.log(`⚒️ Found ${anvils.length} anvil(s) nearby`);
                environment.anvils = anvils;
            }
            
        } catch (error) {
            console.log(`⚠️ Environment analysis failed: ${error.message}`);
        }
        
        return environment;
    }
    
    /**
     * � Navigiere zur nächsten Crafting Table wenn vorhanden
     */
    async navigateToCraftingTable(environment) {
        if (!environment.craftingTables || environment.craftingTables.length === 0) {
            return false;
        }
        
        const nearestTable = environment.craftingTables[0];
        const distance = this.bot.entity.position.distanceTo(nearestTable);
        
        console.log(`🚶 Navigating to crafting table at distance ${distance.toFixed(1)} blocks`);
        
        // Nur navigieren wenn wir weiter als 3 Blöcke entfernt sind
        if (distance > 3) {
            try {
                this.bot.chat(`🚶 Walking to crafting table...`);
                
                // Nutze Pathfinder für sichere Navigation
                const goal = new pf.goals.GoalNear(nearestTable.x, nearestTable.y, nearestTable.z, 1);
                await this.bot.pathfinder.goto(goal);
                
                const newDistance = this.bot.entity.position.distanceTo(nearestTable);
                console.log(`✅ Reached crafting table! Distance now: ${newDistance.toFixed(1)} blocks`);
                this.bot.chat(`✅ Ready to craft at crafting table!`);
                
                return true;
            } catch (error) {
                console.log(`⚠️ Could not navigate to crafting table: ${error.message}`);
                this.bot.chat(`⚠️ Could not reach crafting table, will craft one instead`);
                return false;
            }
        } else {
            console.log(`✅ Already near crafting table (${distance.toFixed(1)} blocks)`);
            return true;
        }
    }
    
    /**
     * �🔧 Optimiere Material-Bedarf basierend auf Umgebung und Inventar
     */
    optimizeBasedOnEnvironment(missingItems, environment, currentInventory) {
        console.log('🔧 Optimizing crafting plan based on environment...');
        
        const optimized = { ...missingItems };
        
        // 🔧 Problem 1: Crafting Table bereits vorhanden?
        if (environment.craftingTables && environment.craftingTables.length > 0 && optimized.crafting_table) {
            const nearestTable = environment.craftingTables[0];
            const distance = this.bot.entity.position.distanceTo(nearestTable);
            console.log(`✅ Crafting table found ${distance.toFixed(1)} blocks away - removing from requirements`);
            this.bot.chat(`✅ Using existing crafting table (${distance.toFixed(1)}m away)!`);
            delete optimized.crafting_table;
        } else if (optimized.crafting_table) {
            console.log(`🔧 No nearby crafting table found - will craft one`);
        }
        
        // 🌲 Problem 2: Sticks aus vorhandenem Holz craften statt mehr Holz sammeln
        if (optimized.stick && this.canCraftSticksFromInventory(currentInventory, optimized.stick)) {
            const sticksNeeded = optimized.stick;
            const logTypes = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
            const plankTypes = ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'];
            
            console.log(`🌲 Checking if ${sticksNeeded} sticks can be crafted from existing wood...`);
            
            // Prüfe Logs zuerst
            for (const logType of logTypes) {
                if (currentInventory[logType] && currentInventory[logType] > 0) {
                    const availableLogs = currentInventory[logType];
                    const sticksFromLogs = availableLogs * 8; // 1 log = 4 planks = 8 sticks
                    
                    console.log(`📦 Have ${availableLogs} ${logType} = ${sticksFromLogs} potential sticks`);
                    
                    if (sticksFromLogs >= sticksNeeded) {
                        console.log(`✅ Can craft ${sticksNeeded} sticks from ${availableLogs} ${logType} - no gathering needed`);
                        this.bot.chat(`✅ Making ${sticksNeeded} sticks from existing ${logType}!`);
                        delete optimized.stick;
                        
                        // Reduziere eventuell auch andere Holz-Anforderungen
                        const correspondingPlanks = logType.replace('_log', '_planks');
                        if (optimized[correspondingPlanks]) {
                            const availablePlanksFromLogs = availableLogs * 4;
                            if (availablePlanksFromLogs >= optimized[correspondingPlanks]) {
                                console.log(`✅ Can also satisfy ${correspondingPlanks} requirement from existing logs`);
                                delete optimized[correspondingPlanks];
                            }
                        }
                        break;
                    }
                }
            }
            
            // Prüfe auch bereits vorhandene Planks
            if (optimized.stick) {
                for (const plankType of plankTypes) {
                    if (currentInventory[plankType] && currentInventory[plankType] > 0) {
                        const availablePlanks = currentInventory[plankType];
                        const sticksFromPlanks = Math.floor(availablePlanks / 2) * 4; // 2 planks = 4 sticks
                        
                        if (sticksFromPlanks >= sticksNeeded) {
                            console.log(`✅ Can craft ${sticksNeeded} sticks from ${availablePlanks} ${plankType} - no gathering needed`);
                            this.bot.chat(`✅ Making sticks from existing ${plankType}!`);
                            delete optimized.stick;
                            break;
                        }
                    }
                }
            }
        }
        
        // Log optimizations
        const removedItems = Object.keys(missingItems).filter(item => !(item in optimized));
        if (removedItems.length > 0) {
            console.log(`🎯 Optimization removed requirements: ${removedItems.join(', ')}`);
        }
        
        return optimized;
    }
    
    /**
     * 🌲 Prüfe ob genug Holz für Sticks vorhanden ist
     */
    canCraftSticksFromInventory(inventory, sticksNeeded) {
        const logTypes = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
        const plankTypes = ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'];
        
        let totalPossibleSticks = 0;
        
        // Berechne Sticks aus Logs
        for (const logType of logTypes) {
            if (inventory[logType]) {
                totalPossibleSticks += inventory[logType] * 8; // 1 log = 4 planks = 8 sticks
            }
        }
        
        // Berechne Sticks aus bereits vorhandenen Planks
        for (const plankType of plankTypes) {
            if (inventory[plankType]) {
                totalPossibleSticks += Math.floor(inventory[plankType] / 2) * 4; // 2 planks = 4 sticks
            }
        }
        
        return totalPossibleSticks >= sticksNeeded;
    }

    /**
     * Phase 2: Erstelle optimalen Ausführungsplan
     */
    async createOptimalPlan(analysis) {
        console.log('🧠 Creating optimal execution plan...');
        
        const plan = {
            phases: [],
            totalEstimatedTime: 0,
            requiredActions: []
        };

        // 🚶 Navigation zur Crafting Table (IMMER wenn eine vorhanden ist)
        if (analysis.environment.craftingTables && analysis.environment.craftingTables.length > 0) {
            const nearestTable = analysis.environment.craftingTables[0];
            const distance = this.bot.entity.position.distanceTo(nearestTable);
            
            // Nur navigieren wenn wir weiter als 3 Blöcke entfernt sind
            if (distance > 3) {
                plan.phases.push({
                    name: 'NAVIGATION_TO_CRAFTING_TABLE', 
                    actions: [{
                        type: 'navigate_to_crafting_table',
                        environment: analysis.environment,
                        description: `Navigate to crafting table (${distance.toFixed(1)}m away)`,
                        estimatedTime: 5
                    }]
                });
                console.log(`🚶 Added navigation phase for crafting table ${distance.toFixed(1)}m away`);
            } else {
                console.log(`✅ Already near crafting table (${distance.toFixed(1)}m) - no navigation needed`);
            }
        }

        // Inventory-Management (falls nötig)
        if (analysis.needsStorageManagement) {
            plan.phases.push({
                name: 'INVENTORY_CLEANUP',
                actions: [{
                    type: 'storage_management',
                    description: 'Clean up inventory space',
                    estimatedTime: 15
                }]
            });
        }

        // Storage-Extraction-Phase
        const extractionActions = this.planStorageExtraction(analysis.missingItems, analysis.storageItems);
        if (extractionActions.length > 0) {
            plan.phases.push({
                name: 'STORAGE_EXTRACTION',
                actions: extractionActions
            });
        }

        // Gathering-Phase für noch fehlende Items
        const stillMissing = this.calculateStillMissing(analysis.missingItems, extractionActions);
        if (Object.keys(stillMissing).length > 0) {
            plan.phases.push({
                name: 'RESOURCE_GATHERING',
                actions: this.planResourceGathering(stillMissing)
            });
        }

        // 🔄 Recursive Dependency-Resolution für Sub-Items
        const dependencyCraftingPhases = await this.createDependencyCraftingPhases(analysis.missingItems, stillMissing);
        if (dependencyCraftingPhases.length > 0) {
            console.log(`🔗 Adding ${dependencyCraftingPhases.length} dependency crafting phases`);
            dependencyCraftingPhases.forEach(phase => {
                plan.phases.push(phase);
            });
        }

        // Crafting-Phase für das Haupt-Item
        const craftingSteps = this.parseCraftingStepsFromPlan(analysis.craftingPlan);
        console.log(`🔨 Parsed ${craftingSteps.length} crafting steps from plan`);
        
        if (craftingSteps.length > 0) {
            craftingSteps.forEach((step, index) => {
                console.log(`   Step ${index + 1}: ${step.description}`);
            });
            
            plan.phases.push({
                name: 'CRAFTING_EXECUTION',
                actions: craftingSteps
            });
        } else {
            console.log(`⚠️ No crafting steps found in plan! Adding direct craft action as fallback.`);
            // Fallback: Direkte Crafting-Action wenn Plan-Parser versagt
            plan.phases.push({
                name: 'CRAFTING_EXECUTION',
                actions: [{
                    type: 'craft_recipe',
                    itemName: this.currentCraftingItem,
                    quantity: this.currentCraftingCount,
                    description: `Direct craft ${this.currentCraftingCount}x ${this.currentCraftingItem} (fallback)`
                }]
            });
        }

        return plan;
    }

    /**
     * 🔗 Erstelle Crafting-Phasen für Sub-Dependencies
     * @param {Object} allMissingItems - Alle fehlenden Items
     * @param {Object} stillMissingAfterExtraction - Items die nach Storage-Extraction noch fehlen
     * @returns {Array} Array von Crafting-Phasen für Dependencies
     */
    async createDependencyCraftingPhases(allMissingItems, stillMissingAfterExtraction) {
        console.log('🔍 Analyzing dependencies for sub-crafting...');
        const phases = [];
        const craftableItems = {};

        // Analysiere welche missing items selbst gecraftet werden können
        for (const [itemName, quantity] of Object.entries(stillMissingAfterExtraction)) {
            const recipes = mc.getItemCraftingRecipes(itemName);
            if (recipes && recipes.length > 0) {
                craftableItems[itemName] = {
                    quantity: quantity,
                    recipe: recipes[0][0], // Erste Rezept nehmen
                    craftedCount: recipes[0][1].craftedCount || 1
                };
                console.log(`✅ ${itemName} can be crafted (need ${quantity})`);
            } else {
                console.log(`❌ ${itemName} cannot be crafted - must be gathered`);
            }
        }

        // Erstelle Crafting-Phasen in Dependency-Order
        const craftingOrder = this.resolveCraftingDependencies(craftableItems);
        
        for (const itemName of craftingOrder) {
            const itemInfo = craftableItems[itemName];
            if (!itemInfo) continue;

            const requiredBatches = Math.ceil(itemInfo.quantity / itemInfo.craftedCount);
            
            phases.push({
                name: `DEPENDENCY_CRAFTING_${itemName.toUpperCase()}`,
                actions: [{
                    type: 'craft_recipe',
                    itemName: itemName,
                    quantity: requiredBatches, // Anzahl der Crafting-Operationen
                    targetAmount: itemInfo.quantity, // Gewünschte Menge
                    description: `Craft ${itemInfo.quantity}x ${itemName} (${requiredBatches} batches)`,
                    estimatedTime: requiredBatches * 3
                }]
            });
            
            console.log(`📋 Added dependency crafting phase: ${itemInfo.quantity}x ${itemName}`);
        }

        return phases;
    }

    /**
     * 🧩 Löse Crafting-Dependencies auf (z.B. sticks vor tools)
     * @param {Object} craftableItems - Items die gecraftet werden können
     * @returns {Array} Sortierte Liste von Items in Crafting-Reihenfolge
     */
    resolveCraftingDependencies(craftableItems) {
        console.log('🧩 Resolving crafting dependencies...');
        
        // Einfache Dependency-Resolution: Items mit weniger Zutaten zuerst
        const itemComplexity = {};
        
        for (const [itemName, itemInfo] of Object.entries(craftableItems)) {
            const ingredientCount = Object.keys(itemInfo.recipe).length;
            itemComplexity[itemName] = ingredientCount;
            console.log(`   ${itemName}: ${ingredientCount} ingredients`);
        }

        // Sortiere nach Komplexität (einfache Items zuerst)
        const sortedItems = Object.keys(itemComplexity).sort((a, b) => {
            return itemComplexity[a] - itemComplexity[b];
        });

        console.log(`📊 Crafting order: ${sortedItems.join(' → ')}`);
        return sortedItems;
    }

    /**
     * Phase 3: Plan-Ausführung mit Mindcraft's Skills
     */
    async executePlan(plan) {
        console.log('⚡ Executing crafting plan...');
        
        const results = {
            success: false,
            completedPhases: [],
            failedPhase: null,
            totalTime: 0
        };

        const startTime = Date.now();

        for (const phase of plan.phases) {
            console.log(`🔄 Starting phase: ${phase.name}`);
            
            try {
                const phaseStartTime = Date.now();
                
                for (const action of phase.actions) {
                    await this.executeAction(action);
                }
                
                const phaseDuration = Date.now() - phaseStartTime;
                results.completedPhases.push({
                    name: phase.name,
                    duration: phaseDuration
                });
                
                console.log(`✅ Completed phase: ${phase.name} (${phaseDuration}ms)`);
                
            } catch (error) {
                console.log(`❌ Failed at phase: ${phase.name} - ${error.message}`);
                
                // 🧠 Intelligente Fehlerbehandlung: Prüfe Fortschritt vor Abbruch
                const currentInventory = world.getInventoryCounts(this.bot);
                const currentCount = currentInventory[this.currentCraftingItem] || 0;
                const originalTarget = this.originalCraftingTarget || this.currentCraftingCount;
                
                console.log(`🔍 Progress check: have ${currentCount}/${originalTarget} ${this.currentCraftingItem}`);
                
                if (currentCount >= originalTarget) {
                    console.log(`✅ Original target reached despite error - continuing as successful!`);
                    results.success = true;
                    results.totalTime = Date.now() - startTime;
                    return results;
                } else if (currentCount > 0) {
                    console.log(`📊 Partial progress: ${currentCount}/${originalTarget} - attempting recovery...`);
                    
                    // Versuche nochmals mit dem Rest
                    try {
                        const remaining = originalTarget - currentCount;
                        console.log(`🔄 Recovery attempt: crafting remaining ${remaining}x ${this.currentCraftingItem}`);
                        
                        const recoverySuccess = await this.intelligentCraftRecipe(this.currentCraftingItem, remaining);
                        if (recoverySuccess) {
                            console.log(`✅ Recovery successful!`);
                            results.success = true;
                            results.totalTime = Date.now() - startTime;
                            return results;
                        }
                    } catch (recoveryError) {
                        console.log(`⚠️ Recovery failed: ${recoveryError.message}`);
                    }
                }
                
                results.failedPhase = phase.name;
                results.error = error.message;
                return results;
            }
        }

        results.success = true;
        results.totalTime = Date.now() - startTime;
        
        console.log(`🎉 Crafting plan completed successfully in ${results.totalTime}ms`);
        return results;
    }

    /**
     * Einzelne Action ausführen - nutzt Mindcraft's Skills
     */
    async executeAction(action) {
        switch (action.type) {
            case 'extract_from_chest':
                return await this.extractFromChest(action.chestPosition, action.itemName, action.quantity);
                
            case 'gather_resource':
                return await this.smartCollectBlocks(action.blockType, action.quantity);
                
            case 'craft_recipe':
                // Intelligentes Batch-Crafting mit dynamischer Anpassung
                // Verwende targetAmount wenn verfügbar, sonst quantity
                const craftAmount = action.targetAmount || action.quantity;
                return await this.intelligentCraftRecipe(action.itemName, craftAmount);
                
            case 'storage_management':
                return await this.manageInventorySpace();
                
            case 'navigate_to_crafting_table':
                return await this.navigateToCraftingTable(action.environment);
                
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Intelligentes Batch-Crafting mit dynamischer Anpassung und Fortschritt-Überprüfung
     */
    async intelligentCraftRecipe(itemName, targetQuantity) {
        console.log(`🔨 Intelligent crafting: ${targetQuantity}x ${itemName}`);
        
        // 🎯 PRE-CHECK: Genug Platz für das komplette Endergebnis?
        const currentItemCount = (world.getInventoryCounts(this.bot)[itemName] || 0);
        const maxStackSize = 64; // Standard Minecraft stack size
        const additionalSlotsNeeded = Math.ceil(targetQuantity / maxStackSize);
        const freeSlots = this.bot.inventory.emptySlotCount();
        
        console.log(`📊 Output space check:`);
        console.log(`   Target: ${targetQuantity}x ${itemName}`);
        console.log(`   Current in inventory: ${currentItemCount}x ${itemName}`);
        console.log(`   Additional slots needed: ${additionalSlotsNeeded}`);
        console.log(`   Available free slots: ${freeSlots}`);
        
        if (freeSlots < additionalSlotsNeeded) {
            console.log(`⚠️ Insufficient inventory space for complete crafting output!`);
            this.bot.chat(`⚠️ Need ${additionalSlotsNeeded} slots for ${targetQuantity}x ${itemName}, only have ${freeSlots} free!`);
            
            // 🗂️ Strategie 1: Versuche Inventory-Management
            const inventoryManaged = await this.manageInventorySpace(additionalSlotsNeeded + 2); // +2 Buffer
            const newFreeSlots = this.bot.inventory.emptySlotCount();
            
            if (newFreeSlots >= additionalSlotsNeeded) {
                console.log(`✅ Inventory management successful: ${newFreeSlots} slots available`);
                this.bot.chat(`✅ Organized inventory to make space for ${targetQuantity}x ${itemName}!`);
            } else {
                // 🗂️ Strategie 2: Prüfe ob Chest-Storage möglich ist
                console.log(`⚠️ Still insufficient inventory space after management: ${newFreeSlots}/${additionalSlotsNeeded}`);
                const chestSpaceAvailable = await this.checkNearbyChestSpace(targetQuantity, itemName);
                
                if (chestSpaceAvailable) {
                    console.log(`✅ Found chest space for output - will store excess in chest during crafting`);
                    this.bot.chat(`📦 Will store crafted items in nearby chest due to limited inventory space`);
                    this.useChestForOutput = true; // Flag für spätere Verwendung
                } else {
                    console.log(`❌ No sufficient space in inventory or nearby chests`);
                    this.bot.chat(`❌ Can't craft ${targetQuantity}x ${itemName} - need more space or place a chest nearby!`);
                    return false;
                }
            }
        }
        
        const beforeInventory = world.getInventoryCounts(this.bot);
        const beforeCount = beforeInventory[itemName] || 0;
        
        let totalCrafted = 0;
        let attempts = 0;
        const maxAttempts = 5; // Verhindere endlose Schleifen
        
        while (totalCrafted < targetQuantity && attempts < maxAttempts) {
            attempts++;
            const remaining = targetQuantity - totalCrafted;
            
            // Batch-Größe dynamisch anpassen (conservative: 1 pro Versuch für bessere Stabilität)
            const batchSize = Math.min(remaining, 1);
            
            console.log(`🔄 Crafting batch ${attempts}: ${batchSize}x ${itemName} (${totalCrafted}/${targetQuantity} done)`);
            
            // Prüfe vor jedem Batch ob genug Materialien da sind
            const currentInventory = world.getInventoryCounts(this.bot);
            const hasEnoughForBatch = this.checkMaterialsForCrafting(itemName, batchSize, currentInventory);
            
            if (!hasEnoughForBatch.success) {
                console.log(`⚠️ Not enough materials for batch. Missing: ${JSON.stringify(hasEnoughForBatch.missing)}`);
                
                // Versuche Materials aus Chests zu holen
                const extractedMaterials = await this.tryExtractMissingMaterials(hasEnoughForBatch.missing);
                if (!extractedMaterials) {
                    console.log(`❌ Could not obtain missing materials - stopping at ${totalCrafted}/${targetQuantity}`);
                    break;
                }
                
                // 🔄 RE-CHECK nach Extraction: Prüfe Inventory nochmals
                const updatedInventory = world.getInventoryCounts(this.bot);
                const recheckResult = this.checkMaterialsForCrafting(itemName, batchSize, updatedInventory);
                
                console.log(`🔍 Post-extraction inventory check:`);
                Object.entries(recheckResult.recipe).forEach(([ingredient, needed]) => {
                    const available = updatedInventory[ingredient] || 0;
                    const required = needed * batchSize;
                    console.log(`   ${ingredient}: have ${available}, need ${required} ${available >= required ? '✅' : '❌'}`);
                });
                
                if (!recheckResult.success) {
                    console.log(`❌ Still missing materials after extraction: ${JSON.stringify(recheckResult.missing)}`);
                    console.log(`❌ Stopping crafting - unable to gather required materials`);
                    break;
                }
                
                console.log(`✅ All materials available after extraction - proceeding with crafting`);
                
                // 🕐 Kurze Pause nach Extraction für Inventory-Synchronisation
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 🔍 Debug: Prüfe was Mineflayer sieht
            console.log(`🔍 Debug: Checking Mineflayer recipes for ${batchSize}x ${itemName}...`);
            
            // Prüfe direkt mit Mineflayer's recipesFor
            const itemId = mc.getItemId(itemName);
            const availableRecipes = this.bot.recipesFor(itemId, null, 1, true);
            console.log(`🔍 Mineflayer found ${availableRecipes.length} available recipes`);
            
            if (availableRecipes.length === 0) {
                console.log(`❌ Mineflayer says no recipes available - checking inventory manually:`);
                const debugInventory = world.getInventoryCounts(this.bot);
                console.log(`   Current inventory:`, debugInventory);
                
                // Prüfe die spezifischen Materialien für stone_pickaxe
                if (itemName === 'stone_pickaxe') {
                    console.log(`   For stone_pickaxe need: 3 cobblestone + 2 stick`);
                    console.log(`   Available cobblestone: ${debugInventory.cobblestone || 0}`);
                    console.log(`   Available stick: ${debugInventory.stick || 0}`);
                }
            }
            
            // 🗂️ Pre-Crafting Inventory Check - berücksichtige Endprodukt-Platz
            const freeSlots = this.bot.inventory.emptySlotCount();
            const slotsNeededForOutput = Math.min(batchSize, 16); // Maximal ein Stack pro Slot
            const minimumSlotsNeeded = Math.max(slotsNeededForOutput + 2, 5); // Endprodukt + 2 Buffer, mindestens 5
            
            if (freeSlots < minimumSlotsNeeded) {
                console.log(`⚠️ Insufficient inventory space for crafting output!`);
                console.log(`   Current free slots: ${freeSlots}`);
                console.log(`   Needed for ${batchSize}x ${itemName}: ${slotsNeededForOutput} slots`);
                console.log(`   Minimum required (with buffer): ${minimumSlotsNeeded} slots`);
                
                const inventoryManaged = await this.manageInventorySpace(minimumSlotsNeeded);
                if (!inventoryManaged) {
                    console.log('⚠️ Could not create sufficient inventory space - continuing anyway...');
                }
                
                // Re-check nach Management
                const newFreeSlots = this.bot.inventory.emptySlotCount();
                if (newFreeSlots < slotsNeededForOutput) {
                    console.log(`❌ Still insufficient space after management: ${newFreeSlots}/${slotsNeededForOutput} needed`);
                    console.log(`⚠️ Crafting may fail due to inventory space - consider reducing batch size`);
                }
            }

            // Versuche zu craften
            let craftingError = null;
            try {
                const success = await this.skills.craftRecipe(this.bot, itemName, batchSize);
            } catch (error) {
                craftingError = error;
                console.log(`⚠️ Crafting error: ${error.message}`);
            }
            
            // Prüfe Fortschritt nach dem Crafting (auch bei Fehlern!)
            const newInventory = world.getInventoryCounts(this.bot);
            const newCount = newInventory[itemName] || 0;
            const actualCrafted = newCount - beforeCount - totalCrafted;
            
            console.log(`📊 Batch result: requested ${batchSize}x, got ${actualCrafted}x ${itemName} ${craftingError ? '(with error)' : ''}`);
            totalCrafted += actualCrafted;
            
            // Wenn wir Fortschritt gemacht haben, obwohl es einen Fehler gab, weitermachen!
            if (actualCrafted > 0 && craftingError) {
                console.log(`✅ Made progress despite error - continuing...`);
                craftingError = null; // Reset error da wir Fortschritt hatten
            }
            
            if (actualCrafted === 0) {
                console.log(`⚠️ No progress in batch ${attempts} - investigating...`);
                // Kurze Pause für Analyse
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        const finalInventory = world.getInventoryCounts(this.bot);
        const finalCount = finalInventory[itemName] || 0;
        const actualTotal = finalCount - beforeCount;
        
        console.log(`🏁 Intelligent crafting complete: ${actualTotal}/${targetQuantity} ${itemName} (${attempts} attempts)`);
        
        // 📦 Post-Crafting: Lagere Items in Chest ein wenn Flag gesetzt ist
        if (this.useChestForOutput && actualTotal > 0) {
            console.log(`📦 Attempting to store crafted ${itemName} in nearby chest...`);
            try {
                const storedSuccessfully = await this.storeCraftedItemsInChest(itemName, actualTotal);
                if (storedSuccessfully) {
                    this.bot.chat(`📦 Successfully stored ${actualTotal}x ${itemName} in nearby chest!`);
                } else {
                    console.log(`⚠️ Could not store all crafted items - keeping in inventory`);
                }
            } catch (error) {
                console.log(`⚠️ Failed to store crafted items in chest: ${error.message}`);
            }
            // Reset Flag für nächste Verwendung
            this.useChestForOutput = false;
        }
        
        return actualTotal > 0; // Success wenn wir wenigstens etwas gecraftet haben
    }

    /**
     * Prüft ob genug Materialien für ein Crafting vorhanden sind
     */
    checkMaterialsForCrafting(itemName, quantity, currentInventory) {
        const recipes = mc.getItemCraftingRecipes(itemName);
        if (!recipes || recipes.length === 0) {
            return { success: false, missing: {}, reason: 'No recipe found' };
        }
        
        const recipe = recipes[0][0]; // Erste Rezept nehmen
        const missing = {};
        let success = true;
        
        for (const [ingredient, needed] of Object.entries(recipe)) {
            const totalNeeded = needed * quantity;
            const available = currentInventory[ingredient] || 0;
            
            if (available < totalNeeded) {
                missing[ingredient] = totalNeeded - available;
                success = false;
            }
        }
        
        return { success, missing, recipe };
    }

    /**
     * 🗂️ Intelligentes Inventory-Management: Schafft Platz wenn Inventar voll ist
     * @param {number} slotsNeeded - Spezifische Anzahl benötigter Slots (optional)
     * @returns {boolean} True wenn erfolgreich Platz geschaffen wurde
     */
    async manageInventorySpace(slotsNeeded = 5) {
        console.log('🗂️ Managing inventory space...');
        
        const inventory = this.bot.inventory;
        const totalSlots = 36; // Standard Minecraft inventory: 27 main + 9 hotbar = 36 total
        const usedSlots = inventory.items().length;
        const freeSlots = inventory.emptySlotCount(); // Mineflayer's built-in method is more accurate
        
        console.log(`📦 Inventory status: ${usedSlots}/${totalSlots} slots used (${freeSlots} free)`);
        
        if (freeSlots >= slotsNeeded) {
            console.log(`✅ Sufficient inventory space available (${freeSlots} >= ${slotsNeeded})`);
            return true; // Genug Platz vorhanden
        }
        
        console.log('⚠️ Inventory space low - looking for nearby chest to store items...');
        
        // 🚨 KRITISCH: Bei komplett vollem Inventar aggressive Strategie
        const isInventoryFull = freeSlots === 0;
        if (isInventoryFull) {
            console.log('🚨 Inventory completely full - using emergency cleanup strategy');
        }
        
        // 📝 Versuche zuerst remembered chests zu verwenden
        let nearestChest = await this.findNearestRememberedChest();
        
        if (!nearestChest) {
            console.log('📦 No remembered chests found, scanning for new ones...');
            
            // Suche nach neuen Chests und merke sie dir
            await this.rememberImportantStructures();
            nearestChest = await this.findNearestRememberedChest();
        }
        
        // Falls immer noch keine Chest gefunden, verwende alte Methode als Fallback
        if (!nearestChest) {
            const nearbyChests = this.bot.findBlocks({
                matching: (block) => block && (block.name === 'chest' || block.name === 'barrel'),
                maxDistance: 32,
                count: 10
            });
            
            if (nearbyChests.length === 0) {
                console.log('❌ No storage containers found nearby - trying to continue with current space');
                this.bot.chat('❌ No storage chests found! Please place a chest nearby for inventory management.');
                return false;
            }
            
            nearestChest = nearbyChests[0];
        }
        console.log(`📦 Found storage chest at ${nearestChest.x},${nearestChest.y},${nearestChest.z}`);
        
        try {
            // Navigiere zur Chest
            const distanceToChest = this.bot.entity.position.distanceTo(nearestChest);
            if (distanceToChest > 4) {
                console.log(`🚶 Walking to chest (${distanceToChest.toFixed(1)}m away)`);
                const goal = new pf.goals.GoalNear(nearestChest.x, nearestChest.y, nearestChest.z, 1);
                await this.bot.pathfinder.goto(goal);
            }
            
            // Öffne Chest
            const chestBlock = this.bot.blockAt(nearestChest);
            const chest = await this.bot.openContainer(chestBlock);
            console.log('📦 Opened storage chest for inventory management');
            
            // Identifiziere Items zum Einlagern oder verwende aggressive Strategie bei vollem Inventar
            let itemsToStore;
            if (isInventoryFull) {
                // Bei vollem Inventar: Verwende alle Items außer essentials
                itemsToStore = this.getItemsForEmergencyStorage();
            } else {
                // Normaler Cleanup: Verwende auch intelligente Strategie aber weniger aggressiv
                itemsToStore = this.getItemsForIntelligentStorage();
            }
            
            let storedItems = 0;
            
            for (const item of itemsToStore) {
                if (storedItems >= Math.max(10, slotsNeeded + 3)) break; // Lagere etwas mehr ein für Sicherheit
                
                // Robuste Item-Validierung
                if (!item || typeof item !== 'object') {
                    console.log(`⚠️ Skipping invalid item (not object):`, item);
                    continue;
                }
                
                if (!item.type || !item.name || typeof item.count !== 'number' || item.count <= 0) {
                    console.log(`⚠️ Skipping invalid item properties:`, {
                        name: item.name || 'undefined',
                        type: item.type || 'undefined',
                        count: item.count || 'undefined'
                    });
                    continue;
                }
                
                try {
                    await chest.deposit(item.type, null, item.count);
                    console.log(`📤 Stored ${item.count}x ${item.name}`);
                    storedItems++;
                } catch (error) {
                    console.log(`⚠️ Could not store ${item.name}: ${error.message}`);
                    // Continue mit nächstem Item statt abzubrechen
                    continue;
                }
            }
            
            chest.close();
            
            // Warte kurz damit Inventory sich aktualisiert
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const newFreeSlots = this.bot.inventory.emptySlotCount();
            const totalSlots = 36;
            const usedSlots = this.bot.inventory.items().length;
            console.log(`✅ Inventory management complete: ${newFreeSlots} free slots after storing ${storedItems} item stacks`);
            console.log(`📊 Inventory details: ${usedSlots}/${totalSlots} used, ${newFreeSlots} empty`);
            
            if (storedItems > 0) {
                this.bot.chat(`📦 Stored ${storedItems} item stacks in nearby chest to free up inventory space!`);
            }
            
            return newFreeSlots >= slotsNeeded; // Success wenn wir die benötigten Slots haben
            
        } catch (error) {
            console.log(`❌ Inventory management failed: ${error.message}`);
            return false;
        }
    }
    
    /**
     * � Notfall-Inventory-Cleanup für komplett volle Inventare
     * @returns {Array} Items für Emergency Storage (sehr aggressive Auswahl)
     */
    getItemsForEmergencyStorage() {
        const inventory = this.bot.inventory.items();
        const itemsForStorage = [];
        
        // Analysiere verfügbare Tools und behalte nur die besten
        const bestTools = this.findBestToolsInInventory(inventory);
        const foodItems = this.findFoodItems(inventory);
        const essentialCraftingItems = this.findEssentialCraftingItems(inventory);
        
        console.log(`🔧 Best tools to keep:`, bestTools.map(t => t.name));
        console.log(`🍞 Food items to keep:`, foodItems.map(f => f.name));
        console.log(`🔨 Essential crafting items:`, essentialCraftingItems.map(f => f.name));
        
        // Erstelle Set der Items die BEHALTEN werden sollen
        const keepItemIds = new Set();
        [...bestTools, ...foodItems, ...essentialCraftingItems].forEach(item => {
            if (item && item.slot !== undefined) {
                keepItemIds.add(item.slot);
            }
        });
        
        // Alle anderen Items können eingelagert werden
        for (const item of inventory) {
            if (!item || !item.name || item.slot === undefined) continue;
            
            if (!keepItemIds.has(item.slot)) {
                itemsForStorage.push(item);
            }
        }
        
        const keepCount = keepItemIds.size;
        const storeCount = itemsForStorage.length;
        console.log(`🚨 Emergency storage: keeping ${keepCount} essential items, storing ${storeCount} items`);
        this.bot.chat(`🗂️ Emergency cleanup: keeping ${keepCount} essential items (best tools + food), storing ${storeCount} others`);
        
        return itemsForStorage;
    }

    /**
     * 🔧 Findet die besten Tools jeder Kategorie im Inventar
     */
    findBestToolsInInventory(inventory) {
        const toolCategories = {
            pickaxe: [],
            axe: [],
            sword: [],
            shovel: [],
            hoe: [],
            bow: []
        };
        
        // Sortiere Tools nach Kategorie
        for (const item of inventory) {
            if (!item || !item.name) continue;
            
            const itemName = item.name.toLowerCase();
            
            // Kategorisiere Tools
            if (itemName.includes('pickaxe')) toolCategories.pickaxe.push(item);
            else if (itemName.includes('axe') && !itemName.includes('pickaxe')) toolCategories.axe.push(item);
            else if (itemName.includes('sword')) toolCategories.sword.push(item);
            else if (itemName.includes('shovel')) toolCategories.shovel.push(item);
            else if (itemName.includes('hoe')) toolCategories.hoe.push(item);
            else if (itemName.includes('bow')) toolCategories.bow.push(item);
        }
        
        const bestTools = [];
        
        // Finde das beste Tool jeder Kategorie
        for (const [category, tools] of Object.entries(toolCategories)) {
            if (tools.length === 0) continue;
            
            // Sortiere nach Material-Qualität
            const sortedTools = tools.sort((a, b) => {
                return this.getToolQuality(b.name) - this.getToolQuality(a.name);
            });
            
            // Behalte das beste Tool dieser Kategorie
            bestTools.push(sortedTools[0]);
            console.log(`🔧 Best ${category}: ${sortedTools[0].name}`);
        }
        
        return bestTools;
    }

    /**
     * 🍞 Findet alle Food Items im Inventar
     */
    findFoodItems(inventory) {
        const foodItems = [];
        const foodKeywords = [
            'bread', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_salmon',
            'baked_potato', 'apple', 'golden_apple', 'carrot', 'steak', 'cooked_mutton',
            'pumpkin_pie', 'cake', 'cookie', 'cooked_cod'
        ];
        
        for (const item of inventory) {
            if (!item || !item.name) continue;
            
            const itemName = item.name.toLowerCase();
            if (foodKeywords.some(food => itemName.includes(food))) {
                foodItems.push(item);
            }
        }
        
        return foodItems;
    }

    /**
     * 🔨 Findet essentielle Crafting Items die behalten werden sollten
     */
    findEssentialCraftingItems(inventory) {
        const essentialItems = [];
        const essentialKeywords = [
            'stick', 'oak_planks', 'planks', 'cobblestone', 'coal', 'iron_ingot', 
            'crafting_table', 'furnace', 'chest'
        ];
        
        for (const item of inventory) {
            if (!item || !item.name) continue;
            
            const itemName = item.name.toLowerCase();
            if (essentialKeywords.some(essential => itemName.includes(essential))) {
                // Behalte nur kleine Mengen von crafting materials (max 16 pro Stack)
                if (item.count <= 16 || itemName.includes('table') || itemName.includes('furnace') || itemName.includes('chest')) {
                    essentialItems.push(item);
                }
            }
        }
        
        return essentialItems;
    }

    /**
     * 🏆 Bewertet die Qualität eines Tools (höhere Zahl = besser)
     */
    getToolQuality(toolName) {
        const name = toolName.toLowerCase();
        if (name.includes('netherite')) return 10;
        if (name.includes('diamond')) return 9;
        if (name.includes('iron')) return 7;
        if (name.includes('stone')) return 5;
        if (name.includes('wood') || name.includes('golden')) return 3;
        return 1; // Default/unknown
    }

    /**
     * 🔧 Intelligente Storage-Auswahl für normales Inventory-Management
     * @returns {Array} Items für intelligente Storage (weniger aggressiv als Emergency)
     */
    getItemsForIntelligentStorage() {
        const inventory = this.bot.inventory.items();
        const itemsForStorage = [];
        
        // Analysiere verfügbare Tools und behalte nur die besten
        const bestTools = this.findBestToolsInInventory(inventory);
        const foodItems = this.findFoodItems(inventory);
        const essentialCraftingItems = this.findEssentialCraftingItems(inventory);
        
        // Bei normalem Cleanup: Behalte auch zusätzliche nützliche Items
        const additionalKeepKeywords = [
            'torch', 'ladder', 'bucket', 'compass', 'map', 'clock',
            'bed', 'boat', 'saddle', 'lead', 'name_tag', 'arrow'
        ];
        
        const additionalKeepItems = [];
        for (const item of inventory) {
            if (!item || !item.name) continue;
            
            const itemName = item.name.toLowerCase();
            if (additionalKeepKeywords.some(keyword => itemName.includes(keyword))) {
                additionalKeepItems.push(item);
            }
        }
        
        console.log(`🔧 Intelligent cleanup - keeping:`, [
            ...bestTools.map(t => t.name),
            ...foodItems.map(f => f.name), 
            ...essentialCraftingItems.map(c => c.name).slice(0, 3), // Nur erste 3 anzeigen
            ...additionalKeepItems.map(a => a.name).slice(0, 3)
        ]);
        
        // Erstelle Set der Items die BEHALTEN werden sollen
        const keepItemIds = new Set();
        [...bestTools, ...foodItems, ...essentialCraftingItems, ...additionalKeepItems].forEach(item => {
            if (item && item.slot !== undefined) {
                keepItemIds.add(item.slot);
            }
        });
        
        // Items einlagern: Alle außer den behaltenen
        for (const item of inventory) {
            if (!item || !item.name || item.slot === undefined) continue;
            
            if (!keepItemIds.has(item.slot)) {
                // Bei normalem Cleanup: Lagere nicht alles ein, sondern nur größere Mengen
                if (item.count > 16 || this.isBulkItem(item.name)) {
                    itemsForStorage.push(item);
                }
            }
        }
        
        const keepCount = keepItemIds.size;
        const storeCount = itemsForStorage.length;
        console.log(`🔧 Intelligent storage: keeping ${keepCount} essential items, storing ${storeCount} bulk items`);
        
        return itemsForStorage;
    }

    /**
     * 📦 Prüft ob ein Item als "Bulk Item" betrachtet werden kann
     */
    isBulkItem(itemName) {
        const bulkKeywords = [
            'dirt', 'cobblestone', 'stone', 'gravel', 'sand',
            'granite', 'diorite', 'andesite', 'deepslate',
            'rotten_flesh', 'bone', 'string', 'gunpowder',
            'raw_iron', 'raw_copper', 'raw_gold'
        ];
        
        const itemLower = itemName.toLowerCase();
        return bulkKeywords.some(bulk => itemLower.includes(bulk));
    }

    /**
     * �📋 Identifiziert Items die sicher eingelagert werden können
     * @returns {Array} Liste von Items die eingelagert werden können
     */
    identifyItemsToStore() {
        const inventory = this.bot.inventory;
        const itemsToStore = [];
        
        // Keep-Liste: Items die NICHT eingelagert werden sollen
        const keepItems = new Set([
            // Crafting essentials
            'crafting_table', 'furnace', 'chest',
            // Tools (keep best of each type)
            'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe',
            'diamond_axe', 'iron_axe', 'stone_axe', 
            'diamond_shovel', 'iron_shovel', 'stone_shovel',
            'diamond_sword', 'iron_sword', 'stone_sword',
            // Current crafting materials
            this.currentCraftingItem,
            'stick', 'oak_planks', 'cobblestone', 'coal'
        ]);
        
        // Definiere "bulk items" die gerne eingelagert werden können
        const bulkItems = new Set([
            'dirt', 'cobbled_deepslate', 'granite', 'diorite', 'andesite',
            'gravel', 'sand', 'oak_log', 'birch_log', 'spruce_log',
            'rotten_flesh', 'bone', 'string', 'gunpowder'
        ]);
        
        for (const item of inventory.items()) {
            // Prüfe ob Item valide ist
            if (!item || !item.name || !item.type || typeof item.count !== 'number') {
                console.log(`⚠️ Skipping invalid item in identification:`, item);
                continue;
            }
            
            const itemName = item.name;
            
            // Skip wenn Item auf Keep-Liste steht
            if (keepItems.has(itemName)) {
                continue;
            }
            
            // Bevorzuge bulk items zum Einlagern
            if (bulkItems.has(itemName) && item.count > 16) {
                itemsToStore.push({
                    type: item.type,
                    name: itemName,
                    count: Math.floor(item.count / 2) // Nur die Hälfte einlagern
                });
                continue;
            }
            
            // Lagere überschüssige Items ein (mehr als 32 von einem Item)
            if (item.count > 32) {
                const excessCount = item.count - 16; // Behalte 16, lagere Rest ein
                itemsToStore.push({
                    type: item.type,
                    name: itemName,
                    count: excessCount
                });
            }
        }
        
        console.log(`📋 Identified ${itemsToStore.length} item types for storage`);
        return itemsToStore;
    }

    /**
     * 📦 Prüft ob nahegelegene Chests Platz für Endprodukt haben
     * @param {number} quantity - Menge des zu speichernden Items
     * @param {string} itemName - Name des Items
     * @returns {boolean} True wenn genug Chest-Platz verfügbar
     */
    async checkNearbyChestSpace(quantity, itemName) {
        console.log(`📦 Checking nearby chest space for ${quantity}x ${itemName}...`);
        
        // Suche nach Chests in der Nähe
        const nearbyChests = this.bot.findBlocks({
            matching: (block) => block && (block.name === 'chest' || block.name === 'barrel'),
            maxDistance: 32,
            count: 10
        });
        
        if (nearbyChests.length === 0) {
            console.log('❌ No storage containers found nearby');
            return false;
        }
        
        let totalFreeSlots = 0;
        const maxStackSize = 64;
        const slotsNeeded = Math.ceil(quantity / maxStackSize);
        
        for (const chestPos of nearbyChests.slice(0, 3)) { // Prüfe max 3 Chests
            try {
                const distanceToChest = this.bot.entity.position.distanceTo(chestPos);
                if (distanceToChest > 6) {
                    console.log(`🚶 Walking to chest at ${chestPos.x},${chestPos.y},${chestPos.z} (${distanceToChest.toFixed(1)}m)`);
                    const goal = new pf.goals.GoalNear(chestPos.x, chestPos.y, chestPos.z, 1);
                    await this.bot.pathfinder.goto(goal);
                }
                
                const chestBlock = this.bot.blockAt(chestPos);
                const chest = await this.bot.openContainer(chestBlock);
                
                // Zähle freie Slots in der Chest
                let chestFreeSlots = 0;
                const chestSlots = chest.slots;
                
                for (let i = 0; i < chestSlots.length; i++) {
                    const slot = chestSlots[i];
                    if (!slot || slot.count === 0) {
                        chestFreeSlots++;
                    } else if (slot.name === itemName && slot.count < maxStackSize) {
                        // Teilweise gefüllter Stack des gleichen Items
                        const spaceInStack = maxStackSize - slot.count;
                        chestFreeSlots += spaceInStack / maxStackSize; // Anteiliger freier Platz
                    }
                }
                
                totalFreeSlots += chestFreeSlots;
                console.log(`📦 Chest at ${chestPos.x},${chestPos.y},${chestPos.z}: ${chestFreeSlots} free slots`);
                
                chest.close();
                
                if (totalFreeSlots >= slotsNeeded) {
                    console.log(`✅ Sufficient chest space found: ${totalFreeSlots} slots available, need ${slotsNeeded}`);
                    return true;
                }
                
                // Kurze Pause zwischen Chest-Checks
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.log(`⚠️ Could not check chest at ${chestPos.x},${chestPos.y},${chestPos.z}: ${error.message}`);
            }
        }
        
        console.log(`❌ Insufficient chest space: ${totalFreeSlots} available, need ${slotsNeeded}`);
        return false;
    }

    /**
     * 📦 Lagert gecraftete Items in nahegelegene Chest ein
     * @param {string} itemName - Name des Items
     * @param {number} quantity - Anzahl der Items
     * @returns {boolean} True wenn erfolgreich eingelagert
     */
    async storeCraftedItemsInChest(itemName, quantity) {
        console.log(`📤 Storing ${quantity}x ${itemName} in nearby chest...`);
        
        // Finde nahegelegene Chests
        const nearbyChests = this.bot.findBlocks({
            matching: (block) => block && (block.name === 'chest' || block.name === 'barrel'),
            maxDistance: 32,
            count: 5
        });
        
        if (nearbyChests.length === 0) {
            console.log('❌ No storage containers found for output storage');
            return false;
        }
        
        // Finde Items im Inventar die dem gewünschten Item entsprechen
        const inventoryItems = this.bot.inventory.items().filter(item => item.name === itemName);
        if (inventoryItems.length === 0) {
            console.log(`❌ No ${itemName} found in inventory to store`);
            return false;
        }
        
        let itemsStored = 0;
        let targetQuantityRemaining = quantity;
        
        for (const chestPos of nearbyChests) {
            if (targetQuantityRemaining <= 0) break;
            
            try {
                // Navigiere zur Chest
                const distanceToChest = this.bot.entity.position.distanceTo(chestPos);
                if (distanceToChest > 6) {
                    console.log(`🚶 Walking to storage chest at ${chestPos.x},${chestPos.y},${chestPos.z}`);
                    const goal = new pf.goals.GoalNear(chestPos.x, chestPos.y, chestPos.z, 1);
                    await this.bot.pathfinder.goto(goal);
                }
                
                const chestBlock = this.bot.blockAt(chestPos);
                const chest = await this.bot.openContainer(chestBlock);
                
                // Versuche Items einzulagern
                for (const item of inventoryItems) {
                    if (targetQuantityRemaining <= 0) break;
                    
                    const quantityToStore = Math.min(item.count, targetQuantityRemaining);
                    
                    try {
                        await chest.deposit(item.type, null, quantityToStore);
                        console.log(`📤 Stored ${quantityToStore}x ${itemName} in chest`);
                        itemsStored += quantityToStore;
                        targetQuantityRemaining -= quantityToStore;
                    } catch (depositError) {
                        console.log(`⚠️ Could not deposit ${itemName}: ${depositError.message}`);
                        // Chest könnte voll sein - versuche nächste
                        break;
                    }
                }
                
                chest.close();
                
                // Kurze Pause zwischen Chests
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.log(`⚠️ Error accessing chest at ${chestPos.x},${chestPos.y},${chestPos.z}: ${error.message}`);
            }
        }
        
        console.log(`📦 Storage complete: ${itemsStored}/${quantity} ${itemName} stored in chests`);
        return itemsStored > 0;
    }

    /**
     * 📦 Versucht ein spezifisches Material aus Storage zu extrahieren
     * @param {string} itemName - Name des Items
     * @param {number} neededQuantity - Benötigte Anzahl
     * @returns {Promise<number>} Tatsächlich extrahierte Anzahl
     */
    async tryExtractMaterialsFromStorage(itemName, neededQuantity) {
        console.log(`📦 Searching storage for ${neededQuantity}x ${itemName}...`);
        
        try {
            const storageMap = await this.scanStorageNetwork();
            let totalExtracted = 0;
            
            for (const [chestLocation, chestContents] of Object.entries(storageMap)) {
                const availableInChest = chestContents[itemName] || 0;
                
                if (availableInChest > 0) {
                    const toExtract = Math.min(neededQuantity - totalExtracted, availableInChest);
                    
                    console.log(`📤 Extracting ${toExtract}x ${itemName} from chest at ${chestLocation}`);
                    
                    try {
                        const actualExtracted = await this.extractFromChest(chestLocation, itemName, toExtract);
                        totalExtracted += actualExtracted;
                        
                        console.log(`✅ Extracted ${actualExtracted}x ${itemName} from storage`);
                        
                        if (totalExtracted >= neededQuantity) break;
                        
                    } catch (error) {
                        console.log(`⚠️ Failed to extract from chest: ${error.message}`);
                        continue; // Try next chest
                    }
                }
            }
            
            if (totalExtracted > 0) {
                this.bot.chat(`📦 Found ${totalExtracted}x ${itemName} in storage!`);
            } else {
                console.log(`📦 No ${itemName} found in storage network`);
            }
            
            return totalExtracted;
            
        } catch (error) {
            console.log(`⚠️ Storage extraction failed: ${error.message}`);
            return 0;
        }
    }

    /**
     * Versucht fehlende Materialien aus Chests zu extrahieren
     */
    async tryExtractMissingMaterials(missingMaterials) {
        console.log(`🗂️ Trying to extract missing materials from chests...`);
        
        // Scanne Chests nach fehlenden Materialien
        const storageMap = await this.scanStorageNetwork();
        let extractedAny = false;
        
        for (const [itemName, neededQuantity] of Object.entries(missingMaterials)) {
            let extracted = 0;
            
            for (const [chestLocation, chestContents] of Object.entries(storageMap)) {
                const availableInChest = chestContents[itemName] || 0;
                if (availableInChest > 0) {
                    const toExtract = Math.min(neededQuantity - extracted, availableInChest);
                    
                    console.log(`📦 Extracting ${toExtract}x ${itemName} from chest at ${chestLocation}`);
                    
                    try {
                        const actualExtracted = await this.extractFromChest(chestLocation, itemName, toExtract);
                        extracted += actualExtracted;
                        extractedAny = true;
                        
                        // Update Cache um doppelte Extraktion zu verhindern
                        if (this.storageNetwork.has(chestLocation)) {
                            const cached = this.storageNetwork.get(chestLocation);
                            cached.contents[itemName] = Math.max(0, (cached.contents[itemName] || 0) - actualExtracted);
                        }
                        
                        if (extracted >= neededQuantity) break;
                    } catch (error) {
                        console.log(`⚠️ Failed to extract from chest: ${error.message}`);
                    }
                }
            }
            
            if (extracted > 0) {
                console.log(`✅ Extracted ${extracted}/${neededQuantity} ${itemName}`);
            }
        }
        
        return extractedAny;
    }

    /**
     * Intelligentes Sammeln von Blöcken mit automatischer Tool-Auswahl
     * Verbesserte Version von skills.collectBlock mit Smart-Tool-Management
     */
    /**
     * Vereinfachte Block-Substitution für Holzarten 
     */
    findAvailableWoodBlock(targetBlockType) {
        // Für Nicht-Holz-Blöcke keine Substitution
        if (!targetBlockType.includes('_log') && !targetBlockType.includes('_planks')) {
            return targetBlockType;
        }
        
        // Verwende Mindcraft's getNearestBlocks für bessere Performance
        const logTypes = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
        const nearbyBlocks = world.getNearestBlocks(this.bot, logTypes, 32, 1);
        
        if (nearbyBlocks.length > 0) {
            const foundBlockType = nearbyBlocks[0].name;
            if (foundBlockType !== targetBlockType) {
                console.log(`🌲 Found ${foundBlockType} as substitute for ${targetBlockType}`);
            }
            return foundBlockType;
        }
        
        return targetBlockType; // Fallback zum Original
    }

    async smartCollectBlocks(blockType, num = 1, options = {}) {
        console.log(`🎯 Smart collecting ${num}x ${blockType} with optimal tool selection and chest integration`);
        
        if (num < 1) {
            this.bot.chat(`Invalid number of blocks to collect: ${num}`);
            return false;
        }

        // 🌲 Intelligente Holz-Block-Substitution
        const actualBlockType = this.findAvailableWoodBlock(blockType);
        if (actualBlockType !== blockType) {
            console.log(`🔄 Block substitution: ${blockType} → ${actualBlockType}`);
            this.bot.chat(`🌲 Using ${actualBlockType} instead of ${blockType}`);
        }

        // ✅ PRE-CHECK: Bereits genug Material im Inventar?
        const currentInventory = world.getInventoryCounts(this.bot);
        let currentCount = currentInventory[actualBlockType] || 0;
        
        if (currentCount >= num) {
            console.log(`✅ Already have enough ${actualBlockType}: ${currentCount}/${num} - no collection needed`);
            this.bot.chat(`✅ Already have ${currentCount}x ${actualBlockType} (need ${num})`);
            return true;
        }

        // 📦 CHEST-CHECK: Suche in Storage bevor Mining (aktivierbar über Options)
        if (options.checkChests !== false) { // Default: true, kann durch options.checkChests = false deaktiviert werden
            console.log('📦 Checking storage chests for existing materials...');
            
            const stillNeeded = num - currentCount;
            const extracted = await this.tryExtractMaterialsFromStorage(actualBlockType, stillNeeded);
            
            if (extracted > 0) {
                currentCount += extracted;
                console.log(`✅ Extracted ${extracted}x ${actualBlockType} from storage, now have ${currentCount}/${num}`);
                
                if (currentCount >= num) {
                    this.bot.chat(`✅ Collection complete! Found all ${num}x ${actualBlockType} in storage.`);
                    return true;
                }
            }
        }

        const stillNeeded = num - currentCount;
        console.log(`📊 Inventory check: have ${currentCount}x ${actualBlockType}, still need ${stillNeeded}x`);

        // �️ Inventory Space Check vor dem Sammeln
        const freeSlots = this.bot.inventory.emptySlotCount();
        if (freeSlots < Math.min(stillNeeded, 5)) {
            console.log(`⚠️ Insufficient inventory space for collection (${freeSlots} free, need ~${stillNeeded}) - managing inventory...`);
            const inventoryManaged = await this.manageInventorySpace(Math.min(stillNeeded, 10));
            if (!inventoryManaged) {
                console.log('⚠️ Could not create sufficient inventory space for collection');
                this.bot.chat('⚠️ Inventory full - please free up some space or place a chest nearby');
                return false;
            }
        }

        // �🔧 Mining-Tier-Überprüfung
        if (!this.toolManager.canMineBlockWithAvailableTools(actualBlockType)) {
            const suggestions = this.toolManager.suggestToolUpgrades([actualBlockType]);
            if (suggestions.length > 0) {
                const suggestion = suggestions[0];
                this.bot.chat(`❌ Cannot mine ${actualBlockType}! Need at least ${suggestion.requiredTool}.`);
                console.log(`🔧 Tool upgrade needed: ${suggestion.reason}`);
                console.log(`   Current tier: ${suggestion.currentTier}, Required tier: ${suggestion.requiredTier}`);
                
                // Versuche das erforderliche Tool zu craften
                if (this.skills.smartCraft) {
                    console.log(`🔨 Attempting to craft ${suggestion.requiredTool}...`);
                    const craftSuccess = await this.skills.smartCraft(this.bot, suggestion.requiredTool, 1);
                    if (!craftSuccess) {
                        this.bot.chat(`❌ Could not craft ${suggestion.requiredTool}. Missing materials.`);
                        return false;
                    }
                    this.bot.chat(`✅ Crafted ${suggestion.requiredTool}! Now attempting to mine...`);
                } else {
                    return false;
                }
            }
        }

        // Rüste das beste verfügbare Werkzeug aus
        await this.toolManager.equipBestToolForBlock(actualBlockType);
        
        const maxAttempts = 3;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                // Prüfe vor jedem Versuch, ob wir bereits genug haben
                const currentCount = this.bot.inventory.count(mc.getItemId(actualBlockType));
                
                if (currentCount >= num) {
                    console.log(`✅ Collection complete: have ${currentCount}/${num} ${actualBlockType}`);
                    this.bot.chat(`✅ Collection complete: ${currentCount}x ${actualBlockType}`);
                    return true;
                }
                
                const stillNeeded = num - currentCount;
                console.log(`🎯 Attempt ${attempt + 1}: Need ${stillNeeded} more ${actualBlockType} (have ${currentCount})`);
                
                // 🛡️ MEMORY LEAK FIX: Begrenze Collection auf kleinere Chunks
                const chunkSize = Math.min(stillNeeded, 5); // Max 5 Blöcke pro Versuch
                
                // Versuche standard collectBlock mit besserer Tool-Auswahl
                const result = await this.skills.collectBlock(this.bot, actualBlockType, chunkSize);
                
                if (result) {
                    // Prüfe tatsächlich gesammelte Items (mit korrektem actualBlockType)
                    const postCount = this.bot.inventory.count(mc.getItemId(actualBlockType));
                    const actuallyCollected = postCount - currentCount;
                    
                    console.log(`📦 Collected ${actuallyCollected} ${actualBlockType} (total: ${postCount}/${num})`);
                    
                    // 📦 Automatische Chest-Lagerung wenn Inventar voll wird (bei großen Collections)
                    if (options.autoStore !== false && num > 32 && this.bot.inventory.emptySlotCount() < 3) {
                        console.log('📤 Inventory getting full during large collection - storing excess in chest...');
                        const stored = await this.storeCraftedItemsInChest(actualBlockType, Math.floor(actuallyCollected / 2));
                        if (stored) {
                            this.bot.chat(`📤 Stored excess ${actualBlockType} in chest to free inventory space`);
                        }
                    }
                    
                    if (postCount >= num) {
                        console.log(`🎉 Collection successful: ${postCount}/${num} ${actualBlockType}`);
                        this.bot.chat(`✅ Successfully collected ${postCount}x ${actualBlockType}!`);
                        
                        // 📦 Optional: Store überschüssige Items wenn sehr viele gesammelt wurden
                        if (options.autoStore !== false && postCount > num * 1.5) {
                            const excess = postCount - num;
                            console.log(`📤 Storing ${excess} excess ${actualBlockType} in chest...`);
                            await this.storeCraftedItemsInChest(actualBlockType, excess);
                        }
                        
                        return true;
                    }
                    
                    // If we made progress, don't count as failed attempt
                    if (actuallyCollected > 0) {
                        continue; // Successful progress, try again without penalty
                    }
                }
                
                // Falls nicht erfolgreich, versuche andere Tools
                if (attempt < maxAttempts - 1) {
                    console.log(`⚠️ Attempt ${attempt + 1} failed, trying different approach...`);
                    
                    // Versuche mit Hand als Fallback
                    if (this.toolManager.getBestToolForBlock(actualBlockType) !== 'hand') {
                        await this.bot.unequip('hand');
                        this.bot.chat(`🖐️ Trying with bare hands for ${actualBlockType}`);
                    }
                    
                    // Kurze Pause zwischen Versuchen
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.log(`⚠️ Error during smart collect attempt ${attempt + 1}: ${error.message}`);
                
                if (attempt === maxAttempts - 1) {
                    this.bot.chat(`❌ Failed to collect ${actualBlockType} after ${maxAttempts} attempts`);
                    return false;
                }
            }
        }
        
        // Final check mit vereinfachter Inventar-Abfrage
        const finalInventory = world.getInventoryCounts(this.bot);
        const finalCount = finalInventory[actualBlockType] || 0;
        
        if (finalCount >= num) {
            this.bot.chat(`✅ Successfully collected ${finalCount}x ${actualBlockType}!`);
            return true;
        } else if (finalCount > 0) {
            this.bot.chat(`⚠️ Partially successful: collected ${finalCount}/${num} ${actualBlockType}${actualBlockType !== blockType ? ` (substitute for ${blockType})` : ''}`);
            return finalCount > 0; // Return true if we got at least something
        }
        
        this.bot.chat(`❌ Could not collect any ${actualBlockType}${actualBlockType !== blockType ? ` (no ${blockType} available either)` : ''}`);
        return false;
    }

    /**
     * Hilfsfunktionen für Plan-Erstellung
     */
    parseMissingItemsFromPlan(craftingPlan) {
        const missingMatch = craftingPlan.match(/You are missing the following items:\n((?:- \d+ \w+\n?)*)/);
        const missing = {};
        
        if (missingMatch) {
            const lines = missingMatch[1].trim().split('\n');
            for (const line of lines) {
                const match = line.match(/- (\d+) (.+)/);
                if (match) {
                    missing[match[2]] = parseInt(match[1]);
                }
            }
        }
        
        return missing;
    }

    parseCraftingStepsFromPlan(craftingPlan) {
        console.log(`🔍 Parsing crafting plan: ${craftingPlan.substring(0, 200)}...`);
        
        const stepsMatch = craftingPlan.match(/Here's your crafting plan:\n\n((?:Craft .+\n?)*)/);
        const steps = [];
        
        if (stepsMatch) {
            console.log(`✅ Found crafting steps section: ${stepsMatch[1]}`);
            const lines = stepsMatch[1].trim().split('\n');
            for (const line of lines) {
                const match = line.match(/Craft .+ -> (\d+) (.+)/);
                if (match) {
                    const outputPerBatch = parseInt(match[1]); // Wie viele pro Crafting-Operation
                    const itemName = match[2];
                    
                    // 🔧 CRITICAL FIX: Use actual needed quantity, not plan output
                    // If this is the main item we're crafting, use the full amount we still need
                    let actualQuantityNeeded = outputPerBatch;
                    if (itemName === this.currentCraftingItem) {
                        // Use the amount we actually need to craft
                        actualQuantityNeeded = this.currentCraftingCount;
                        console.log(`🎯 Main item ${itemName}: adjusting from plan quantity ${outputPerBatch} to needed quantity ${actualQuantityNeeded}`);
                    }
                    
                    let quantity = actualQuantityNeeded;
                    
                    // 🧠 Intelligente Batch-Aufteilung für große Mengen
                    if (quantity > 4) {
                        console.log(`🔧 Breaking large batch ${quantity}x ${itemName} into smaller batches`);
                        
                        // Teile in 4er-Batches auf
                        while (quantity > 0) {
                            const batchSize = Math.min(quantity, 4);
                            const step = {
                                type: 'craft_recipe',
                                itemName: itemName,
                                quantity: batchSize,
                                description: `Craft batch: ${batchSize}x ${itemName}`
                            };
                            steps.push(step);
                            console.log(`📝 Parsed batch: ${step.quantity}x ${step.itemName}`);
                            quantity -= batchSize;
                        }
                    } else {
                        // Normale kleine Menge
                        const step = {
                            type: 'craft_recipe',
                            itemName: itemName,
                            quantity: quantity,
                            description: line
                        };
                        steps.push(step);
                        console.log(`📝 Parsed step: ${step.quantity}x ${step.itemName}`);
                    }
                } else {
                    console.log(`⚠️ Could not parse line: ${line}`);
                }
            }
        } else {
            console.log(`❌ No crafting plan section found in: ${craftingPlan}`);
        }
        
        return steps;
    }

    planStorageExtraction(missingItems, storageItems) {
        const extractionActions = [];
        
        for (const [itemName, neededQuantity] of Object.entries(missingItems)) {
            let remainingNeeded = neededQuantity;
            
            for (const [chestLocation, chestContents] of Object.entries(storageItems)) {
                if (remainingNeeded <= 0) break;
                
                const availableInChest = chestContents[itemName] || 0;
                if (availableInChest > 0) {
                    const extractQuantity = Math.min(remainingNeeded, availableInChest);
                    
                    extractionActions.push({
                        type: 'extract_from_chest',
                        chestPosition: chestLocation,
                        itemName: itemName,
                        quantity: extractQuantity,
                        description: `Extract ${extractQuantity}x ${itemName} from chest at ${chestLocation}`
                    });
                    
                    remainingNeeded -= extractQuantity;
                }
            }
        }
        
        return extractionActions;
    }

    calculateStillMissing(originalMissing, extractionActions) {
        const stillMissing = { ...originalMissing };
        
        for (const action of extractionActions) {
            if (action.type === 'extract_from_chest') {
                stillMissing[action.itemName] -= action.quantity;
                if (stillMissing[action.itemName] <= 0) {
                    delete stillMissing[action.itemName];
                }
            }
        }
        
        return stillMissing;
    }

    planResourceGathering(missingItems) {
        const gatheringActions = [];
        
        for (const [itemName, quantity] of Object.entries(missingItems)) {
            // Bestimme den besten Weg, das Item zu bekommen
            const blockSources = mc.getItemBlockSources(itemName);
            
            if (blockSources && blockSources.length > 0) {
                // Es gibt Block-Quellen für dieses Item
                const primarySource = blockSources[0]; // Nimm die erste/beste Quelle
                
                gatheringActions.push({
                    type: 'gather_resource',
                    blockType: primarySource,
                    itemName: itemName,
                    quantity: quantity,
                    description: `Gather ${quantity}x ${itemName} by collecting ${primarySource}`
                });
            } else {
                console.log(`⚠️ Don't know how to gather ${itemName}, may need manual intervention`);
            }
        }
        
        return gatheringActions;
    }

    /**
     * Storage-Management Funktionen
     */
    async extractFromChest(chestPositionStr, itemName, quantity) {
        console.log(`📦 Extracting ${quantity}x ${itemName} from chest at ${chestPositionStr}`);
        
        const [x, y, z] = chestPositionStr.split(',').map(Number);
        const chestPos = new Vec3(x, y, z); // Vec3-Objekt für distanceTo()
        
        try {
            // Navigiere zuerst zur Chest mit Pathfinder
            const distanceToChest = this.bot.entity.position.distanceTo(chestPos);
            if (distanceToChest > 4) {
                console.log(`🚶 Walking to chest for extraction (distance: ${distanceToChest.toFixed(1)})`);
                
                const goal = new pf.goals.GoalNear(chestPos.x, chestPos.y, chestPos.z, 1);
                await this.bot.pathfinder.goto(goal);
                
                console.log(`✅ Reached chest for extraction`);
            }
            
            const chestBlock = this.bot.blockAt(chestPos);
            const chestContainer = await this.bot.openContainer(chestBlock);
            
            // Verwende robuste Container-APIs wie in skills.js
            const matchingItems = chestContainer.containerItems().filter(item => item.name === itemName);
            if (matchingItems.length === 0) {
                console.log(`❌ No ${itemName} found in chest`);
                await chestContainer.close();
                return 0;
            }
            
            let remaining = quantity;
            let extractedCount = 0;
            
            // Nehme Items aus jedem Slot bis genug genommen wurde
            for (const item of matchingItems) {
                if (remaining <= 0) break;
                
                const toTakeFromSlot = Math.min(remaining, item.count);
                await chestContainer.withdraw(item.type, null, toTakeFromSlot);
                
                extractedCount += toTakeFromSlot;
                remaining -= toTakeFromSlot;
            }
            
            await chestContainer.close();
            
            if (extractedCount > 0) {
                console.log(`✅ Successfully extracted ${extractedCount}x ${itemName}`);
                
                // Update Cache
                const chestKey = chestPositionStr;
                if (this.storageNetwork.has(chestKey)) {
                    const cached = this.storageNetwork.get(chestKey);
                    cached.contents[itemName] = Math.max(0, (cached.contents[itemName] || 0) - extractedCount);
                }
            }
            
            return extractedCount;
            
        } catch (error) {
            console.log(`❌ Failed to extract from chest: ${error.message}`);
            throw error;
        }
    }

    async manageInventorySpace() {
        console.log('📦 Managing inventory space...');
        
        // Finde existierende Chests in der Nähe (erweiterte Suche)
        const nearbyChests = this.bot.findBlocks({
            matching: (block) => block && block.name === 'chest',
            maxDistance: 32,
            count: 10
        });
        
        let storageChest = null;
        
        if (nearbyChests.length > 0) {
            console.log(`✅ Found ${nearbyChests.length} existing chest(s) nearby`);
            this.bot.chat(`✅ Using existing chest instead of building new one!`);
            
            // Finde die nächste erreichbare Chest
            for (const chestPos of nearbyChests) {
                const chestBlock = this.bot.blockAt(chestPos);
                if (chestBlock && chestBlock.name === 'chest') {
                    storageChest = chestBlock;
                    console.log(`📦 Selected chest at ${chestPos.x}, ${chestPos.y}, ${chestPos.z}`);
                    break;
                }
            }
        }
        
        if (!storageChest) {
            console.log(`🔧 No accessible chest found, will build one`);
        
            // Nur wenn wirklich keine Chest gefunden wurde
            // Erstelle neue Chest wenn nötig
            const currentInventory = world.getInventoryCounts(this.bot);
            const hasChestItem = (currentInventory['chest'] || 0) > 0;
            
            if (!hasChestItem && (currentInventory['oak_planks'] || 0) >= 8) {
                // Crafte Chest aus Planks
                await this.skills.craftRecipe(this.bot, 'chest', 1);
            }
            
            if ((currentInventory['chest'] || 0) > 0) {
                // Platziere Chest
                const freeSpace = world.getNearestFreeSpace(this.bot, 1, 8);
                if (freeSpace) {
                    await this.skills.placeBlock(this.bot, 'chest', freeSpace.x, freeSpace.y, freeSpace.z);
                    storageChest = this.bot.findBlock({
                        matching: (block) => block && block.name === 'chest',
                        maxDistance: 4
                    });
                }
            }
        }

        if (storageChest) {
            // Navigiere zur Storage-Chest mit Pathfinder
            const distanceToChest = this.bot.entity.position.distanceTo(storageChest.position);
            if (distanceToChest > 4) {
                console.log(`🚶 Walking to storage chest (distance: ${distanceToChest.toFixed(1)})`);
                
                const goal = new pf.goals.GoalNear(storageChest.position.x, storageChest.position.y, storageChest.position.z, 1);
                await this.bot.pathfinder.goto(goal);
                
                console.log(`✅ Reached storage chest`);
            }
            
            // Sortiere Items in Storage
            await this.organizeItemsIntoStorage(storageChest);
        } else {
            console.log('⚠️ Could not create or find storage chest, inventory may remain full');
        }
    }

    async organizeItemsIntoStorage(storageChest) {
        console.log('🗂️ Organizing items into storage...');
        
        try {
            // Handle both Vec3 position and Block objects
            let chestBlock;
            if (storageChest.position) {
                // storageChest ist ein Block-Objekt
                chestBlock = storageChest;
            } else {
                // storageChest ist ein Vec3-Objekt
                chestBlock = this.bot.blockAt(storageChest);
            }
            
            if (!chestBlock || chestBlock.name !== 'chest') {
                console.log('❌ Invalid chest block for organization');
                return false;
            }
            
            const chest = await this.bot.openContainer(chestBlock);
            
            const inventory = this.bot.inventory.items();
            const currentGoal = this.currentGoal;
            
            let itemsStored = 0;
            
            // Bestimme welche Items behalten werden sollen
            for (const item of inventory) {
                // Robuste Item-Validierung
                if (!item || typeof item !== 'object') {
                    console.log(`⚠️ Skipping invalid item (not object):`, item);
                    continue;
                }
                
                if (!item.type || !item.name || typeof item.count !== 'number' || item.count <= 0) {
                    console.log(`⚠️ Skipping invalid item properties:`, {
                        name: item.name,
                        type: item.type, 
                        count: item.count
                    });
                    continue;
                }
                
                if (this.shouldStoreItemSafely(item, currentGoal)) {
                    try {
                        // Versuche Item in Chest zu legen mit der modernen API
                        await chest.deposit(item.type, null, item.count);
                        console.log(`📤 Stored ${item.count}x ${item.name} in chest`);
                        itemsStored++;
                    } catch (depositError) {
                        console.log(`⚠️ Could not store ${item.name}: ${depositError.message}`);
                        // Continue with next item instead of failing completely
                        continue;
                    }
                }
            }
            
            chest.close();
            console.log('✅ Inventory organization complete');
            
        } catch (error) {
            console.log(`❌ Failed to organize inventory: ${error.message}`);
        }
    }

    shouldStoreItemSafely(item, craftingGoal) {
        try {
            // Robuste Validierung des Item-Objekts
            if (!item || typeof item !== 'object' || !item.name) {
                return false;
            }
            
            const itemName = String(item.name).toLowerCase();
            
            // Einfache Heuristik: Store items die nicht für current crafting goal benötigt werden
            const essentialTools = ['pickaxe', 'axe', 'sword', 'shovel', 'hoe'];
            const isEssentialTool = essentialTools.some(tool => itemName.includes(tool));
            
            // Behalte Tools, Food, und wichtige Items
            if (isEssentialTool || 
                itemName.includes('bread') || 
                itemName.includes('cooked') ||
                itemName.includes('planks') ||
                itemName.includes('log') ||
                itemName.includes('stick')) {
                return false;
            }
            
            // Store Items wenn Inventar voll ist (>30 Items)
            const currentInventorySize = this.bot.inventory.items().length;
            return currentInventorySize > 30;
            
        } catch (error) {
            console.log(`⚠️ Error in shouldStoreItemSafely: ${error.message}`);
            return false; // Default: Don't store if unsure
        }
    }

    shouldStoreItem(item, craftingGoal) {
        // Legacy function - redirect to safe version
        return this.shouldStoreItemSafely(item, craftingGoal);
    }
}

/**
 * Einfaches Logging-System für Debugging
 */
class CraftingLogger {
    constructor(bot) {
        this.bot = bot;
        this.sessions = new Map();
    }

    logCraftingStart(itemName, count) {
        const sessionId = `craft_${Date.now()}`;
        const session = {
            id: sessionId,
            item: itemName,
            count: count,
            startTime: Date.now(),
            phases: []
        };
        
        this.sessions.set(sessionId, session);
        console.log(`🎯 [${sessionId}] Starting crafting: ${count}x ${itemName}`);
        
        return sessionId;
    }

    logCraftingPhase(sessionId, phaseName, data = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        const phase = {
            name: phaseName,
            timestamp: Date.now(),
            data: data
        };
        
        session.phases.push(phase);
        console.log(`⚡ [${sessionId}] Phase: ${phaseName}`, data);
    }

    logCraftingComplete(sessionId, success, result) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        session.success = success;
        session.result = result;
        session.endTime = Date.now();
        session.totalTime = session.endTime - session.startTime;
        
        const status = success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`🏁 [${sessionId}] ${status} in ${session.totalTime}ms`);
        
        if (!success && result.error) {
            console.log(`💥 Error: ${result.error}`);
        }
    }
}

/**
 * Hauptfunktion für Integration in bestehende Mindcraft-Struktur
 */
export async function smartCraft(bot, itemName, count = 1, skillsFunctions = null) {
    /**
     * Erweiterte Crafting-Funktion mit intelligenter Storage-Nutzung
     * @param {MinecraftBot} bot 
     * @param {string} itemName 
     * @param {number} count 
     * @param {Object} skillsFunctions - Optional skills functions object
     * @returns {Promise<boolean>}
     */
    const craftingManager = new SmartCraftingManager(bot, skillsFunctions);
    return await craftingManager.craftItemIntelligently(itemName, count);
}

/**
 * Intelligente Block-Sammlung mit automatischer Tool-Auswahl und Chest-Integration
 */
export async function smartCollect(bot, blockType, count = 1, skillsFunctions = null, options = {}) {
    /**
     * Erweiterte Block-Sammlung mit intelligenter Tool-Auswahl und Storage-Integration
     * @param {MinecraftBot} bot 
     * @param {string} blockType 
     * @param {number} count 
     * @param {Object} skillsFunctions - Optional skills functions object
     * @param {Object} options - Collection options:
     *   - checkChests: boolean (default: true) - Prüfe Chests vor Mining
     *   - autoStore: boolean (default: true) - Automatische Lagerung bei großen Mengen
     * @returns {Promise<boolean>}
     */
    const craftingManager = new SmartCraftingManager(bot, skillsFunctions);
    
    // Default Options für bessere Integration
    const defaultOptions = {
        checkChests: true,    // Standardmäßig Chests zuerst prüfen
        autoStore: true       // Automatische Lagerung bei großen Collections
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    return await craftingManager.smartCollectBlocks(blockType, count, finalOptions);
}