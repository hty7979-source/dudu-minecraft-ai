/**
 * Smart Crafting System für Mindcraft Bot
 * Modular refactored for better maintainability
 */

import * as mc from "../../utils/mcdata.js";
import * as world from "./world.js";
import Vec3 from 'vec3';
import pf from 'mineflayer-pathfinder';

// ============================================================================
// TOOL MANAGER - Intelligente Werkzeug-Verwaltung
// ============================================================================
class ToolManager {
  constructor(bot) {
    this.bot = bot;
    this.toolHierarchy = this.initializeToolHierarchy();
  }

  initializeToolHierarchy() {
    return {
      wood: {
        best: ['netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe', 'golden_axe'],
        acceptable: ['hand'],
        blocks: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
                 'oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks'],
        minTool: null
      },
      stone: {
        best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'],
        acceptable: [],
        blocks: ['stone', 'cobblestone', 'granite', 'diorite', 'andesite', 'coal_ore'],
        minTool: 'wooden_pickaxe'
      },
      iron_tier: {
        best: ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe'],
        acceptable: [],
        blocks: ['iron_ore', 'deepslate_iron_ore'],
        minTool: 'stone_pickaxe'
      },
      earth: {
        best: ['netherite_shovel', 'diamond_shovel', 'iron_shovel', 'stone_shovel', 'wooden_shovel'],
        acceptable: ['hand'],
        blocks: ['dirt', 'grass_block', 'sand', 'gravel', 'clay'],
        minTool: null
      }
    };
  }

  getBestToolForBlock(blockType) {
    for (const [category, info] of Object.entries(this.toolHierarchy)) {
      if (info.blocks.includes(blockType)) {
        for (const tool of info.best) {
          if (this.bot.inventory.findInventoryItem(mc.getItemId(tool))) {
            return tool;
          }
        }
        return info.acceptable[0] || 'hand';
      }
    }
    return 'hand';
  }

  async equipBestTool(blockType) {
    const bestTool = this.getBestToolForBlock(blockType);
    
    if (bestTool === 'hand') {
      await this.bot.unequip('hand');
      return true;
    }

    try {
      const toolItem = this.bot.inventory.findInventoryItem(mc.getItemId(bestTool));
      if (toolItem) {
        await this.bot.equip(toolItem, 'hand');
        console.log(`🔧 Equipped ${bestTool} for ${blockType}`);
        return true;
      }
    } catch (error) {
      console.log(`⚠️ Failed to equip ${bestTool}: ${error.message}`);
    }

    await this.bot.unequip('hand');
    return false;
  }

  canMineBlock(blockType) {
    const category = this.findToolCategory(blockType);
    if (!category || !category.minTool) return true;
    
    const availableTools = this.getAvailableTools();
    const minToolTier = this.getToolTier(category.minTool);
    
    for (const tool of availableTools) {
      const toolTier = this.getToolTier(tool);
      if (toolTier >= minToolTier) {
        return true;
      }
    }
    
    return false;
  }

  findToolCategory(blockType) {
    for (const info of Object.values(this.toolHierarchy)) {
      if (info.blocks.includes(blockType)) {
        return info;
      }
    }
    return null;
  }

  getToolTier(toolName) {
    if (toolName.includes('netherite')) return 4;
    if (toolName.includes('diamond')) return 3;
    if (toolName.includes('iron')) return 2;
    if (toolName.includes('stone')) return 1;
    return 0;
  }

  getAvailableTools() {
    return this.bot.inventory.items()
      .filter(item => item.name.includes('pickaxe') || item.name.includes('axe') || 
                     item.name.includes('shovel'))
      .map(item => item.name);
  }
}

// ============================================================================
// STORAGE MANAGER - Verwaltet Truhen und Inventar
// ============================================================================
class StorageManager {
  constructor(bot) {
    this.bot = bot;
    this.storageCache = new Map();
  }

  async scanNearbyChests(radius = 32) {
    console.log('🗃️ Scanning storage network...');
    
    const chestPositions = this.bot.findBlocks({
      matching: (block) => block && block.name === 'chest',
      maxDistance: radius,
      count: 100
    });
    
    const storageMap = {};
    
    for (const pos of chestPositions) {
      const key = `${pos.x},${pos.y},${pos.z}`;
      
      if (this.storageCache.has(key)) {
        const cached = this.storageCache.get(key);
        if (Date.now() - cached.lastScanned < 60000) {
          storageMap[key] = cached.contents;
          continue;
        }
      }
      
      try {
        const contents = await this.readChestContents(pos);
        storageMap[key] = contents;
        
        this.storageCache.set(key, {
          contents: contents,
          lastScanned: Date.now(),
          position: pos
        });
      } catch (error) {
        console.log(`⚠️ Could not access chest at ${key}: ${error.message}`);
      }
    }
    
    return storageMap;
  }

  async readChestContents(position) {
    const distance = this.bot.entity.position.distanceTo(position);
    
    if (distance > 4) {
      const goal = new pf.goals.GoalNear(position.x, position.y, position.z, 1);
      await this.bot.pathfinder.goto(goal);
    }
    
    const chestBlock = this.bot.blockAt(position);
    const chest = await this.bot.openContainer(chestBlock);
    
    const contents = {};
    for (const item of chest.containerItems()) {
      if (item) {
        contents[item.name] = (contents[item.name] || 0) + item.count;
      }
    }
    
    await chest.close();
    return contents;
  }

  async extractFromChest(position, itemName, quantity) {
    console.log(`📦 Extracting ${quantity}x ${itemName} from chest`);
    
    const distance = this.bot.entity.position.distanceTo(position);
    if (distance > 4) {
      const goal = new pf.goals.GoalNear(position.x, position.y, position.z, 1);
      await this.bot.pathfinder.goto(goal);
    }
    
    const chestBlock = this.bot.blockAt(position);
    const chest = await this.bot.openContainer(chestBlock);
    
    const matchingItems = chest.containerItems().filter(item => item.name === itemName);
    let extracted = 0;
    let remaining = quantity;
    
    for (const item of matchingItems) {
      if (remaining <= 0) break;
      
      const toTake = Math.min(remaining, item.count);
      await chest.withdraw(item.type, null, toTake);
      
      extracted += toTake;
      remaining -= toTake;
    }
    
    await chest.close();
    console.log(`✅ Extracted ${extracted}x ${itemName}`);
    
    return extracted;
  }

  async storeInChest(itemName, quantity) {
    const nearbyChests = this.bot.findBlocks({
      matching: (block) => block && block.name === 'chest',
      maxDistance: 32,
      count: 5
    });
    
    if (nearbyChests.length === 0) {
      return false;
    }
    
    const inventoryItems = this.bot.inventory.items().filter(item => item.name === itemName);
    let stored = 0;
    let remaining = quantity;
    
    for (const chestPos of nearbyChests) {
      if (remaining <= 0) break;
      
      try {
        const distance = this.bot.entity.position.distanceTo(chestPos);
        if (distance > 4) {
          const goal = new pf.goals.GoalNear(chestPos.x, chestPos.y, chestPos.z, 1);
          await this.bot.pathfinder.goto(goal);
        }
        
        const chestBlock = this.bot.blockAt(chestPos);
        const chest = await this.bot.openContainer(chestBlock);
        
        for (const item of inventoryItems) {
          if (remaining <= 0) break;
          
          const toStore = Math.min(item.count, remaining);
          await chest.deposit(item.type, null, toStore);
          
          stored += toStore;
          remaining -= toStore;
        }
        
        await chest.close();
      } catch (error) {
        console.log(`⚠️ Could not store in chest: ${error.message}`);
      }
    }
    
    return stored > 0;
  }
}

// ============================================================================
// INVENTORY MANAGER - Intelligente Inventar-Verwaltung
// ============================================================================
class InventoryManager {
  constructor(bot, storageManager) {
    this.bot = bot;
    this.storageManager = storageManager;
  }

  getFreeSlots() {
    return this.bot.inventory.emptySlotCount();
  }

  async ensureSpace(slotsNeeded = 5) {
    const freeSlots = this.getFreeSlots();
    
    if (freeSlots >= slotsNeeded) {
      return true;
    }
    
    console.log(`🗂️ Managing inventory space (need ${slotsNeeded}, have ${freeSlots})`);
    
    const nearbyChests = this.bot.findBlocks({
      matching: (block) => block && block.name === 'chest',
      maxDistance: 32,
      count: 10
    });
    
    if (nearbyChests.length === 0) {
      console.log('❌ No storage chests found');
      return false;
    }
    
    const nearestChest = nearbyChests[0];
    const distance = this.bot.entity.position.distanceTo(nearestChest);
    
    if (distance > 4) {
      const goal = new pf.goals.GoalNear(nearestChest.x, nearestChest.y, nearestChest.z, 1);
      await this.bot.pathfinder.goto(goal);
    }
    
    const chestBlock = this.bot.blockAt(nearestChest);
    const chest = await this.bot.openContainer(chestBlock);
    
    const itemsToStore = this.selectItemsToStore(slotsNeeded);
    let stored = 0;
    
    for (const item of itemsToStore) {
      if (stored >= slotsNeeded) break;
      
      try {
        await chest.deposit(item.type, null, item.count);
        console.log(`📤 Stored ${item.count}x ${item.name}`);
        stored++;
      } catch (error) {
        console.log(`⚠️ Could not store ${item.name}: ${error.message}`);
      }
    }
    
    await chest.close();
    
    const newFreeSlots = this.getFreeSlots();
    console.log(`✅ Inventory management complete: ${newFreeSlots} free slots`);
    
    return newFreeSlots >= slotsNeeded;
  }

  selectItemsToStore(count) {
    const inventory = this.bot.inventory.items();
    const bestTools = this.findBestTools(inventory);
    const essentialItems = this.findEssentialItems(inventory);
    
    const keepIds = new Set();
    [...bestTools, ...essentialItems].forEach(item => {
      if (item && item.slot !== undefined) {
        keepIds.add(item.slot);
      }
    });
    
    const itemsToStore = [];
    for (const item of inventory) {
      if (!item || !keepIds.has(item.slot)) {
        itemsToStore.push(item);
        if (itemsToStore.length >= count + 5) break;
      }
    }
    
    return itemsToStore;
  }

  findBestTools(inventory) {
    const toolCategories = {
      pickaxe: [],
      axe: [],
      sword: [],
      shovel: []
    };
    
    for (const item of inventory) {
      if (!item || !item.name) continue;
      
      const name = item.name.toLowerCase();
      if (name.includes('pickaxe')) toolCategories.pickaxe.push(item);
      else if (name.includes('axe')) toolCategories.axe.push(item);
      else if (name.includes('sword')) toolCategories.sword.push(item);
      else if (name.includes('shovel')) toolCategories.shovel.push(item);
    }
    
    const bestTools = [];
    for (const tools of Object.values(toolCategories)) {
      if (tools.length > 0) {
        const sorted = tools.sort((a, b) => this.getToolQuality(b.name) - this.getToolQuality(a.name));
        bestTools.push(sorted[0]);
      }
    }
    
    return bestTools;
  }

  findEssentialItems(inventory) {
    const essentialKeywords = ['stick', 'planks', 'cobblestone', 'coal', 'crafting_table', 'furnace'];
    
    return inventory.filter(item => {
      if (!item || !item.name) return false;
      const name = item.name.toLowerCase();
      return essentialKeywords.some(keyword => name.includes(keyword)) && item.count <= 16;
    });
  }

  getToolQuality(toolName) {
    const name = toolName.toLowerCase();
    if (name.includes('netherite')) return 10;
    if (name.includes('diamond')) return 9;
    if (name.includes('iron')) return 7;
    if (name.includes('stone')) return 5;
    return 3;
  }
}

// ============================================================================
// MATERIAL ANALYZER - Analysiert Materialien und Rezepte
// ============================================================================
class MaterialAnalyzer {
  constructor(bot) {
    this.bot = bot;
  }

  analyzeRecipe(itemName, quantity) {
    const recipes = mc.getItemCraftingRecipes(itemName);
    if (!recipes || recipes.length === 0) {
      return { success: false, reason: 'No recipe found' };
    }
    
    const recipe = recipes[0][0];
    const currentInventory = world.getInventoryCounts(this.bot);
    const missing = {};
    
    for (const [ingredient, needed] of Object.entries(recipe)) {
      const totalNeeded = needed * quantity;
      const available = currentInventory[ingredient] || 0;
      
      if (available < totalNeeded) {
        missing[ingredient] = totalNeeded - available;
      }
    }
    
    return {
      success: Object.keys(missing).length === 0,
      recipe: recipe,
      missing: missing
    };
  }

  calculateMaterialTree(itemName, quantity) {
    const tree = {
      item: itemName,
      quantity: quantity,
      dependencies: []
    };
    
    const recipes = mc.getItemCraftingRecipes(itemName);
    if (recipes && recipes.length > 0) {
      const recipe = recipes[0][0];
      
      for (const [ingredient, needed] of Object.entries(recipe)) {
        tree.dependencies.push(
          this.calculateMaterialTree(ingredient, needed * quantity)
        );
      }
    }
    
    return tree;
  }

  substituteWoodMaterials(materials, inventory) {
    const woodTypes = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'];
    const availableWood = woodTypes.find(wood => 
      (inventory[`${wood}_log`] || 0) > 0 || (inventory[`${wood}_planks`] || 0) > 0
    );
    
    if (!availableWood) return materials;
    
    const substituted = { ...materials };
    for (const [item, count] of Object.entries(materials)) {
      if (item.includes('oak_')) {
        const newItem = item.replace('oak_', `${availableWood}_`);
        substituted[newItem] = count;
        delete substituted[item];
        console.log(`🔄 Substituted ${item} → ${newItem}`);
      }
    }
    
    return substituted;
  }
}

// ============================================================================
// RESOURCE GATHERER - Sammelt Ressourcen intelligent
// ============================================================================
class ResourceGatherer {
  constructor(bot, toolManager, storageManager) {
    this.bot = bot;
    this.toolManager = toolManager;
    this.storageManager = storageManager;
  }

  async gather(blockType, quantity, options = {}) {
    console.log(`🎯 Gathering ${quantity}x ${blockType}`);
    
    const inventory = world.getInventoryCounts(this.bot);
    let currentCount = inventory[blockType] || 0;
    
    if (currentCount >= quantity) {
      console.log(`✅ Already have enough ${blockType}`);
      return true;
    }
    
    // Check storage first
    if (options.checkChests !== false) {
      const extracted = await this.tryExtractFromStorage(blockType, quantity - currentCount);
      currentCount += extracted;
      
      if (currentCount >= quantity) {
        console.log(`✅ Found all materials in storage`);
        return true;
      }
    }
    
    // Mine remaining
    const stillNeeded = quantity - currentCount;
    return await this.mineBlocks(blockType, stillNeeded);
  }

  async tryExtractFromStorage(itemName, quantity) {
    const storageMap = await this.storageManager.scanNearbyChests();
    let extracted = 0;
    
    for (const [location, contents] of Object.entries(storageMap)) {
      const available = contents[itemName] || 0;
      if (available > 0) {
        const toExtract = Math.min(quantity - extracted, available);
        const pos = location.split(',').map(Number);
        const actualExtracted = await this.storageManager.extractFromChest(
          new Vec3(pos[0], pos[1], pos[2]), 
          itemName, 
          toExtract
        );
        extracted += actualExtracted;
        
        if (extracted >= quantity) break;
      }
    }
    
    return extracted;
  }

  async mineBlocks(blockType, quantity) {
    if (!this.toolManager.canMineBlock(blockType)) {
      console.log(`❌ Cannot mine ${blockType} with available tools`);
      return false;
    }
    
    await this.toolManager.equipBestTool(blockType);
    
    const startCount = this.bot.inventory.count(mc.getItemId(blockType));
    
    // Use existing skills system
    const success = await this.bot.collectBlock(blockType, quantity);
    
    const endCount = this.bot.inventory.count(mc.getItemId(blockType));
    const collected = endCount - startCount;
    
    console.log(`📦 Collected ${collected}/${quantity} ${blockType}`);
    return collected >= quantity;
  }
}

// ============================================================================
// CRAFTING EXECUTOR - Führt Crafting-Operationen aus
// ============================================================================
class CraftingExecutor {
  constructor(bot, materialAnalyzer, inventoryManager) {
    this.bot = bot;
    this.materialAnalyzer = materialAnalyzer;
    this.inventoryManager = inventoryManager;
  }

  async craft(itemName, quantity) {
    console.log(`🔨 Crafting ${quantity}x ${itemName}`);
    
    const analysis = this.materialAnalyzer.analyzeRecipe(itemName, quantity);
    
    if (!analysis.success) {
      console.log(`❌ Missing materials:`, analysis.missing);
      return false;
    }
    
    // Ensure inventory space
    const slotsNeeded = Math.ceil(quantity / 64);
    const hasSpace = await this.inventoryManager.ensureSpace(slotsNeeded + 2);
    
    if (!hasSpace) {
      console.log(`❌ Insufficient inventory space`);
      return false;
    }
    
    // Execute crafting in batches
    let crafted = 0;
    const batchSize = Math.min(quantity, 4);
    
    while (crafted < quantity) {
      const toCraft = Math.min(batchSize, quantity - crafted);
      
      try {
        await this.bot.craftRecipe(itemName, toCraft);
        crafted += toCraft;
        console.log(`✅ Crafted ${crafted}/${quantity} ${itemName}`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`⚠️ Crafting error: ${error.message}`);
        break;
      }
    }
    
    return crafted >= quantity;
  }
}

// ============================================================================
// SMART CRAFTING MANAGER - Koordiniert alle Komponenten
// ============================================================================
export class SmartCraftingManager {
  constructor(bot, skills = null) {
    this.bot = bot;
    this.skills = skills || {};
    
    // Initialize components
    this.toolManager = new ToolManager(bot);
    this.storageManager = new StorageManager(bot);
    this.inventoryManager = new InventoryManager(bot, this.storageManager);
    this.materialAnalyzer = new MaterialAnalyzer(bot);
    this.resourceGatherer = new ResourceGatherer(bot, this.toolManager, this.storageManager);
    this.craftingExecutor = new CraftingExecutor(bot, this.materialAnalyzer, this.inventoryManager);
  }

  async craftIntelligently(itemName, quantity = 1) {
    console.log(`🎯 Smart crafting: ${quantity}x ${itemName}`);
    
    const inventory = world.getInventoryCounts(this.bot);
    const alreadyHave = inventory[itemName] || 0;
    
    if (alreadyHave >= quantity) {
      console.log(`✅ Already have ${alreadyHave}x ${itemName}`);
      this.bot.chat(`✅ Already have enough ${itemName}!`);
      return true;
    }
    
    const stillNeed = quantity - alreadyHave;
    
    try {
      // Phase 1: Analyze materials
      const analysis = this.materialAnalyzer.analyzeRecipe(itemName, stillNeed);
      
      if (!analysis.success) {
        console.log(`❌ Cannot craft ${itemName}: ${analysis.reason}`);
        return false;
      }
      
      // Phase 2: Gather missing materials
      let materials = analysis.missing;
      materials = this.materialAnalyzer.substituteWoodMaterials(materials, inventory);
      
      for (const [material, needed] of Object.entries(materials)) {
        const success = await this.resourceGatherer.gather(material, needed, { checkChests: true });
        if (!success) {
          this.bot.chat(`❌ Could not gather ${material}`);
          return false;
        }
      }
      
      // Phase 3: Execute crafting
      const success = await this.craftingExecutor.craft(itemName, stillNeed);
      
      if (success) {
        this.bot.chat(`✅ Successfully crafted ${quantity}x ${itemName}!`);
      }
      
      return success;
      
    } catch (error) {
      console.log(`❌ Crafting failed: ${error.message}`);
      return false;
    }
  }

  async collectIntelligently(blockType, quantity = 1, options = {}) {
    return await this.resourceGatherer.gather(blockType, quantity, options);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================
export async function smartCraft(bot, itemName, count = 1, skills = null) {
  const manager = new SmartCraftingManager(bot, skills);
  return await manager.craftIntelligently(itemName, count);
}

export async function smartCollect(bot, blockType, count = 1, skills = null, options = {}) {
  const manager = new SmartCraftingManager(bot, skills);
  return await manager.collectIntelligently(blockType, count, options);
}