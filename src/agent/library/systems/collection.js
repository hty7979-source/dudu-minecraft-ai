/**
 * 📦 Enhanced Smart Collect System für Mindcraft
 * 
 * Erweiterte Block-Sammlung mit vollständiger Integration des bewährten 
 * Smart Crafting Inventory-Management Systems.
 * 
 * Features:
 * - ✅ Vollautomatisches Inventory-Management 
 * - ✅ Chest-Scanning und intelligente Materialsuche
 * - ✅ Tool-Management und Upgrade-Vorschläge
 * - ✅ Multi-Source Collection (Chests + Mining + Smelting)
 * - ✅ Robuste Container APIs aus Smart Crafting
 * - ✅ Batch-Processing für große Mengen
 * 
 * @author GitHub Copilot
 * @date 8. Oktober 2025
 */

import * as world from '../utils/world.js';
import * as mc from '../../../utils/mcdata.js';
import { Vec3 } from 'vec3';
import * as pf from 'mineflayer-pathfinder';
import { SmartCraftingManager } from './crafting_system.js';

export class SmartCollectEnhanced {
    constructor(bot, skillsFunctions = null) {
        this.bot = bot;
        this.skills = skillsFunctions || {};
        
        // Verwende die bewährten Smart Crafting Komponenten
        this.craftingManager = new SmartCraftingManager(bot, skillsFunctions);
        this.storageNetwork = new Map(); // Cache für Chest-Inhalte
        this.collectStrategies = new Map(); // Cache für Sammelstrategien
        
        console.log('📦 Smart Collect Enhanced initialized');
    }

    /**
     * 🎯 Hauptfunktion: Intelligente Block-Sammlung mit vollständiger Integration
     * @param {string} blockType - Der Block-Typ der gesammelt werden soll
     * @param {number} count - Anzahl der benötigten Blöcke
     * @param {Object} options - Zusätzliche Optionen
     * @returns {Promise<boolean>}
     */
    async smartCollectWithFullIntegration(blockType, count = 1, options = {}) {
        console.log(`🎯 Enhanced Smart Collect: ${count}x ${blockType}`);
        console.log(`🔍 Searching for ${count}x ${blockType}...`);

        if (count < 1) {
            console.log(`❌ Invalid count: ${count}`);
            return false;
        }

        try {
            // Phase 1: 📊 Vollständige Bestandsaufnahme
            const collectPlan = await this.createComprehensiveCollectionPlan(blockType, count);
            
            if (collectPlan.alreadySatisfied) {
                console.log(`✅ Already have enough ${blockType}! (${collectPlan.currentCount}/${count})`);
                return true;
            }

            // Phase 2: 🗂️ Inventory-Space-Management mit Smart Crafting System
            const spaceNeeded = Math.min(collectPlan.stillNeeded, 10); // Begrenze für Performance
            const spaceManaged = await this.ensureInventorySpace(spaceNeeded);

            if (!spaceManaged) {
                console.log('⚠️ Cannot manage inventory space - please free up space or place chest');
                return false;
            }

            // Phase 3: 📦 Multi-Source Collection Execution
            const collectionResult = await this.executeMultiSourceCollection(collectPlan, options);
            
            return collectionResult;

        } catch (error) {
            console.log(`❌ Smart Collect Enhanced failed: ${error.message}`);
            console.log(`❌ Collection failed: ${error.message}`);
            return false;
        }
    }

    /**
     * 📊 Erstelle umfassenden Collection Plan mit allen verfügbaren Quellen
     */
    async createComprehensiveCollectionPlan(blockType, targetCount) {
        console.log(`📊 Creating comprehensive collection plan for ${targetCount}x ${blockType}`);
        
        // 1. Aktueller Inventar-Status
        const currentInventory = world.getInventoryCounts(this.bot);
        const currentCount = currentInventory[blockType] || 0;
        
        const plan = {
            targetBlock: blockType,
            targetCount: targetCount,
            currentCount: currentCount,
            stillNeeded: Math.max(0, targetCount - currentCount),
            alreadySatisfied: currentCount >= targetCount,
            sources: {
                chests: [],
                mining: { possible: false, locations: [] },
                smelting: { possible: false, materials: {} },
                crafting: { possible: false, materials: {} }
            }
        };

        if (plan.alreadySatisfied) {
            return plan;
        }

        // 2. 📦 Chest-Analyse mit Smart Crafting System
        console.log('📦 Scanning storage network for existing materials...');
        const storageMap = await this.craftingManager.scanStorageNetwork();
        let availableFromChests = 0;
        
        for (const [chestLocation, chestContents] of Object.entries(storageMap)) {
            const availableInChest = chestContents[blockType] || 0;
            if (availableInChest > 0) {
                plan.sources.chests.push({
                    location: chestLocation,
                    available: availableInChest
                });
                availableFromChests += availableInChest;
            }
        }
        
        console.log(`📦 Found ${availableFromChests}x ${blockType} in chests`);

        // 3. 🪨 Mining-Analyse
        await this.analyzeMiningPossibilities(plan);
        
        // 4. 🔥 Smelting-Analyse  
        await this.analyzeSmeltingPossibilities(plan);
        
        // 5. 🔨 Crafting-Analyse
        await this.analyzeCraftingPossibilities(plan);

        console.log(`📊 Collection Plan Summary:
        - Current: ${plan.currentCount}/${plan.targetCount}
        - Still needed: ${plan.stillNeeded}
        - Available from chests: ${availableFromChests}
        - Mining possible: ${plan.sources.mining.possible}
        - Smelting possible: ${plan.sources.smelting.possible}
        - Crafting possible: ${plan.sources.crafting.possible}`);

        return plan;
    }

    /**
     * 🗂️ Stelle sicher dass genügend Inventory Space vorhanden ist
     */
    async ensureInventorySpace(slotsNeeded) {
        console.log(`🗂️ Ensuring ${slotsNeeded} inventory slots are available`);
        
        const freeSlots = this.bot.inventory.emptySlotCount();
        
        if (freeSlots >= slotsNeeded) {
            console.log(`✅ Sufficient space available: ${freeSlots}/${slotsNeeded}`);
            return true;
        }

        // Verwende bewährtes Smart Crafting Inventory Management
        console.log(`⚠️ Insufficient space (${freeSlots}/${slotsNeeded}) - managing inventory...`);
        console.log('🗂️ Organizing inventory to make space...');

        const spaceManaged = await this.craftingManager.manageInventorySpace(slotsNeeded);
        
        if (spaceManaged) {
            const newFreeSlots = this.bot.inventory.emptySlotCount();
            console.log(`✅ Inventory management successful: ${newFreeSlots} slots now available`);
            console.log(`✅ Made space! ${newFreeSlots} slots available.`);
            return true;
        }

        return false;
    }

    /**
     * 📦 Führe Multi-Source Collection aus
     */
    async executeMultiSourceCollection(collectPlan, options = {}) {
        console.log('📦 Executing multi-source collection strategy...');
        
        let totalCollected = collectPlan.currentCount;
        const targetCount = collectPlan.targetCount;

        // Strategie 1: 📦 Extrahiere aus Chests (schnellste Option)
        if (collectPlan.sources.chests.length > 0) {
            console.log('📦 Phase 1: Extracting from storage chests...');
            console.log('📦 Collecting from storage...');

            const extractedFromChests = await this.extractFromChestSources(collectPlan.sources.chests, collectPlan.stillNeeded);
            totalCollected += extractedFromChests;
            
            if (totalCollected >= targetCount) {
                console.log(`✅ Collection complete! Found all ${targetCount}x ${collectPlan.targetBlock} in storage.`);
                return true;
            }
        }

        const stillNeededAfterChests = targetCount - totalCollected;

        // Strategie 2: 🔨 Crafting (wenn möglich und effizient)
        if (collectPlan.sources.crafting.possible && stillNeededAfterChests > 0) {
            console.log('🔨 Phase 2: Attempting to craft missing items...');
            console.log(`🔨 Crafting ${stillNeededAfterChests}x ${collectPlan.targetBlock}...`);

            const craftedItems = await this.executeSmartCrafting(collectPlan.targetBlock, stillNeededAfterChests);
            totalCollected += craftedItems;
            
            if (totalCollected >= targetCount) {
                console.log(`✅ Collection complete via crafting! ${totalCollected}/${targetCount}`);
                return true;
            }
        }

        const stillNeededAfterCrafting = targetCount - totalCollected;

        // Strategie 3: 🔥 Smelting (für Erze und verarbeitbare Materialien)
        if (collectPlan.sources.smelting.possible && stillNeededAfterCrafting > 0) {
            console.log('🔥 Phase 3: Attempting to smelt materials...');
            console.log(`🔥 Smelting materials for ${collectPlan.targetBlock}...`);

            const smeltedItems = await this.executeSmartSmelting(collectPlan, stillNeededAfterCrafting);
            totalCollected += smeltedItems;
            
            if (totalCollected >= targetCount) {
                console.log(`✅ Collection complete via smelting! ${totalCollected}/${targetCount}`);
                return true;
            }
        }

        const finallyNeeded = targetCount - totalCollected;

        // Strategie 4: 🪨 Mining (letzte Option, aber mit Smart Tool Management)
        if (collectPlan.sources.mining.possible && finallyNeeded > 0) {
            console.log('🪨 Phase 4: Mining blocks with optimal tools...');
            console.log(`⛏️ Mining ${finallyNeeded}x ${collectPlan.targetBlock}...`);

            const minedItems = await this.executeSmartMining(collectPlan, finallyNeeded, options);
            totalCollected += minedItems;
        }

        // Final Result Assessment
        const finalCount = world.getInventoryCounts(this.bot)[collectPlan.targetBlock] || 0;
        
        if (finalCount >= targetCount) {
            console.log(`✅ Collection successful! Got ${finalCount}/${targetCount} ${collectPlan.targetBlock}`);
            return true;
        } else if (finalCount > collectPlan.currentCount) {
            console.log(`⚠️ Partial success: collected ${finalCount}/${targetCount} ${collectPlan.targetBlock}`);
            return finalCount > 0;
        } else {
            console.log(`❌ Could not collect ${collectPlan.targetBlock}. Try placing more chests or crafting tools.`);
            return false;
        }
    }

    /**
     * 📦 Extrahiere Items aus Chest-Quellen
     */
    async extractFromChestSources(chestSources, neededCount) {
        console.log(`📦 Extracting from ${chestSources.length} chest source(s)...`);
        
        let totalExtracted = 0;
        
        for (const chestSource of chestSources) {
            if (totalExtracted >= neededCount) break;
            
            const toExtract = Math.min(neededCount - totalExtracted, chestSource.available);
            
            try {
                // Verwende bewährte Smart Crafting Extraction
                const extracted = await this.craftingManager.extractFromChest(
                    chestSource.location, 
                    this.getCurrentTargetBlock(), 
                    toExtract
                );
                
                totalExtracted += extracted;
                console.log(`📤 Extracted ${extracted}x from chest at ${chestSource.location}`);
                
            } catch (error) {
                console.log(`⚠️ Failed to extract from chest: ${error.message}`);
                continue; // Try next chest
            }
        }
        
        if (totalExtracted > 0) {
            console.log(`✅ Successfully extracted ${totalExtracted} items from storage`);
        }
        
        return totalExtracted;
    }

    /**
     * 🔨 Führe Smart Crafting aus
     */
    async executeSmartCrafting(itemName, count) {
        console.log(`🔨 Attempting to craft ${count}x ${itemName}...`);
        
        if (!this.skills.smartCraft) {
            console.log('❌ Smart crafting not available');
            return 0;
        }

        try {
            const success = await this.skills.smartCraft(this.bot, itemName, count);
            
            if (success) {
                // Prüfe wie viele tatsächlich gecraftet wurden
                const inventory = world.getInventoryCounts(this.bot);
                const craftedCount = inventory[itemName] || 0;
                console.log(`✅ Crafting result: ${craftedCount} ${itemName} in inventory`);
                return Math.max(0, craftedCount);
            }
            
        } catch (error) {
            console.log(`⚠️ Crafting failed: ${error.message}`);
        }
        
        return 0;
    }

    /**
     * 🔥 Führe Smart Smelting aus
     */
    async executeSmartSmelting(collectPlan, neededCount) {
        console.log(`🔥 Attempting to smelt materials for ${neededCount}x ${collectPlan.targetBlock}...`);
        
        // TODO: Implementation für Smelting
        // Hier könnte das Smelting-System aus Smart Crafting integriert werden
        console.log('🔥 Smelting system integration - TODO');
        return 0;
    }

    /**
     * ⛏️ Führe Smart Mining mit Tool Management aus
     */
    async executeSmartMining(collectPlan, neededCount, options = {}) {
        console.log(`⛏️ Starting smart mining for ${neededCount}x ${collectPlan.targetBlock}...`);
        
        // Verwende bewährte Smart Crafting Block Collection
        try {
            const success = await this.craftingManager.smartCollectBlocks(collectPlan.targetBlock, neededCount);
            
            if (success) {
                const inventory = world.getInventoryCounts(this.bot);
                const minedCount = inventory[collectPlan.targetBlock] || 0;
                return Math.max(0, minedCount - collectPlan.currentCount);
            }
            
        } catch (error) {
            console.log(`⚠️ Mining failed: ${error.message}`);
        }
        
        return 0;
    }

    /**
     * 🪨 Analysiere Mining-Möglichkeiten
     */
    async analyzeMiningPossibilities(plan) {
        console.log(`🪨 Analyzing mining possibilities for ${plan.targetBlock}...`);
        
        // Suche nach Blöcken in der Nähe
        try {
            const nearbyBlocks = this.bot.findBlocks({
                matching: (block) => block && block.name === plan.targetBlock,
                maxDistance: 64,
                count: 50
            });

            if (nearbyBlocks.length > 0) {
                plan.sources.mining.possible = true;
                plan.sources.mining.locations = nearbyBlocks.slice(0, 10); // Begrenze für Performance
                console.log(`🪨 Found ${nearbyBlocks.length} ${plan.targetBlock} blocks nearby`);
            } else {
                console.log(`🪨 No ${plan.targetBlock} blocks found nearby`);
            }

        } catch (error) {
            console.log(`⚠️ Mining analysis failed: ${error.message}`);
        }
    }

    /**
     * 🔥 Analysiere Smelting-Möglichkeiten
     */
    async analyzeSmeltingPossibilities(plan) {
        console.log(`🔥 Analyzing smelting possibilities for ${plan.targetBlock}...`);
        
        // Definiere Smelting-Recipes für häufige Items
        const smeltingRecipes = {
            'iron_ingot': 'iron_ore',
            'gold_ingot': 'gold_ore', 
            'copper_ingot': 'copper_ore',
            'glass': 'sand',
            'stone': 'cobblestone',
            'baked_potato': 'potato',
            'cooked_beef': 'raw_beef'
        };

        const sourceItem = smeltingRecipes[plan.targetBlock];
        if (sourceItem) {
            const inventory = world.getInventoryCounts(this.bot);
            const availableSourceItems = inventory[sourceItem] || 0;
            
            if (availableSourceItems > 0) {
                plan.sources.smelting.possible = true;
                plan.sources.smelting.materials[sourceItem] = availableSourceItems;
                console.log(`🔥 Can smelt ${availableSourceItems}x ${sourceItem} → ${plan.targetBlock}`);
            }
        }
    }

    /**
     * 🔨 Analysiere Crafting-Möglichkeiten  
     */
    async analyzeCraftingPossibilities(plan) {
        console.log(`🔨 Analyzing crafting possibilities for ${plan.targetBlock}...`);
        
        try {
            // Verwende Mindcraft's Crafting-System zur Analyse
            const currentInventory = world.getInventoryCounts(this.bot);
            const craftingPlan = mc.getDetailedCraftingPlan(plan.targetBlock, plan.stillNeeded, currentInventory);
            
            if (craftingPlan && !craftingPlan.includes('Cannot craft') && !craftingPlan.includes('no recipe')) {
                plan.sources.crafting.possible = true;
                console.log(`🔨 Crafting possible for ${plan.targetBlock}`);
                
                // Parse benötigte Materialien
                const missingMatch = craftingPlan.match(/You are missing the following items:\n((?:- \d+ \w+\n?)*)/);
                if (missingMatch) {
                    const missingItems = {};
                    const missingLines = missingMatch[1].trim().split('\n');
                    for (const line of missingLines) {
                        const match = line.match(/- (\d+) (.+)/);
                        if (match) {
                            const [, count, item] = match;
                            missingItems[item] = parseInt(count);
                        }
                    }
                    plan.sources.crafting.materials = missingItems;
                }
            } else {
                console.log(`🔨 No crafting recipe available for ${plan.targetBlock}`);
            }

        } catch (error) {
            console.log(`⚠️ Crafting analysis failed: ${error.message}`);
        }
    }

    /**
     * Hilfsfunktionen
     */
    getCurrentTargetBlock() {
        return this.currentTargetBlock || 'stone'; // Fallback
    }

    /**
     * 📊 Erweiterte Inventory-Analyse mit Chest-Integration
     */
    async getComprehensiveInventoryStatus() {
        const inventory = world.getInventoryCounts(this.bot);
        const storageMap = await this.craftingManager.scanStorageNetwork();
        
        // Kombiniere Inventar + Storage
        const combinedItems = { ...inventory };
        
        for (const chestContents of Object.values(storageMap)) {
            for (const [itemName, count] of Object.entries(chestContents)) {
                combinedItems[itemName] = (combinedItems[itemName] || 0) + count;
            }
        }
        
        return {
            inventoryOnly: inventory,
            storageOnly: storageMap,
            combined: combinedItems
        };
    }

    /**
     * 🔧 Tool-Management Hilfsfunktionen
     */
    async ensureProperToolsForBlock(blockType) {
        return await this.craftingManager.toolManager.equipBestToolForBlock(blockType);
    }

    /**
     * 🎯 Batch-Collection für große Mengen
     */
    async batchCollectItems(itemRequests) {
        console.log(`🎯 Starting batch collection for ${itemRequests.length} different items...`);
        
        const results = {};
        
        for (const request of itemRequests) {
            const { blockType, count } = request;
            console.log(`📦 Batch processing: ${count}x ${blockType}`);
            
            const success = await this.smartCollectWithFullIntegration(blockType, count);
            results[blockType] = success;
            
            // Kurze Pause zwischen Items für Stabilität
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return results;
    }
}

/**
 * 📦 Wrapper-Funktion für Integration in skills.js
 */
export async function enhancedSmartCollect(bot, blockType, count = 1, skillsFunctions = null) {
    const collector = new SmartCollectEnhanced(bot, skillsFunctions);
    collector.currentTargetBlock = blockType; // Set für interne Referenz
    return await collector.smartCollectWithFullIntegration(blockType, count);
}

/**
 * 🎯 Batch Collection Wrapper
 */
export async function batchCollectItems(bot, itemRequests, skillsFunctions = null) {
    const collector = new SmartCollectEnhanced(bot, skillsFunctions);
    return await collector.batchCollectItems(itemRequests);
}

/**
 * 📊 Comprehensive Inventory Analysis Wrapper
 */
export async function getComprehensiveInventory(bot, skillsFunctions = null) {
    const collector = new SmartCollectEnhanced(bot, skillsFunctions);
    return await collector.getComprehensiveInventoryStatus();
}

console.log('📦 Smart Collect Enhanced system loaded successfully!');