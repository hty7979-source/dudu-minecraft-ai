/**
 * Smart Crafting System für Mindcraft Bot
 * Modular refactored for better maintainability
 */

import * as mc from "../../../utils/mcdata.js";
import * as world from "../utils/world.js";
import * as skills from "../skills.js";
import Vec3 from 'vec3';
import pf from 'mineflayer-pathfinder';

// ============================================================================
// ITEM NAME VALIDATOR - Validates and corrects common item name mistakes
// ============================================================================
class ItemNameValidator {
  constructor() {
    // Common naming mistakes and their corrections
    this.corrections = {
      // Singular → Plural
      'plank': 'planks',
      'oak_plank': 'oak_planks',
      'spruce_plank': 'spruce_planks',
      'birch_plank': 'birch_planks',
      'jungle_plank': 'jungle_planks',
      'acacia_plank': 'acacia_planks',
      'dark_oak_plank': 'dark_oak_planks',

      // Common abbreviations
      'wood': 'oak_log',
      'stone': 'cobblestone',
      'sword': 'wooden_sword',
      'pickaxe': 'wooden_pickaxe',
      'axe': 'wooden_axe',
      'shovel': 'wooden_shovel',

      // British vs American English
      'armour': 'armor',
      'colour': 'color',

      // Common typos
      'cobbblestone': 'cobblestone',
      'diamon': 'diamond',
      'woodden': 'wooden',
      'iro': 'iron',
    };
  }

  /**
   * Validate and correct item name
   * Returns corrected name or original if valid
   */
  validate(itemName) {
    if (!itemName || typeof itemName !== 'string') {
      return null;
    }

    const cleaned = itemName.trim().toLowerCase();

    // Check if it's a known correction
    if (this.corrections[cleaned]) {
      const corrected = this.corrections[cleaned];
      console.log(`🔄 Auto-corrected: "${itemName}" → "${corrected}"`);
      return corrected;
    }

    // Try to get item ID from mcdata (validates existence)
    try {
      const itemId = mc.getItemId(cleaned);
      if (itemId !== null && itemId !== undefined) {
        return cleaned; // Valid item name
      }
    } catch (error) {
      // Item doesn't exist, try fuzzy matching
    }

    // Fuzzy matching: Try adding 's' for plurals
    if (!cleaned.endsWith('s')) {
      try {
        const pluralName = cleaned + 's';
        const itemId = mc.getItemId(pluralName);
        if (itemId !== null && itemId !== undefined) {
          console.log(`🔄 Auto-corrected: "${itemName}" → "${pluralName}" (added plural 's')`);
          return pluralName;
        }
      } catch (error) {
        // Still doesn't exist
      }
    }

    // Fuzzy matching: Try removing 's' for singulars
    if (cleaned.endsWith('s') && cleaned.length > 2) {
      try {
        const singularName = cleaned.slice(0, -1);
        const itemId = mc.getItemId(singularName);
        if (itemId !== null && itemId !== undefined) {
          console.log(`🔄 Auto-corrected: "${itemName}" → "${singularName}" (removed plural 's')`);
          return singularName;
        }
      } catch (error) {
        // Still doesn't exist
      }
    }

    // No valid match found
    console.log(`⚠️ Unknown item name: "${itemName}"`);
    return cleaned; // Return as-is, let caller handle the error
  }

  /**
   * Validate and correct item name, throw error if invalid
   */
  validateStrict(itemName) {
    const validated = this.validate(itemName);

    // Verify the validated name exists in mcdata
    try {
      const itemId = mc.getItemId(validated);
      if (itemId === null || itemId === undefined) {
        throw new Error(`Invalid item name: "${itemName}". No such item exists in Minecraft.`);
      }
    } catch (error) {
      throw new Error(`Invalid item name: "${itemName}". ${error.message}`);
    }

    return validated;
  }
}

// Global validator instance
const itemValidator = new ItemNameValidator();

// ============================================================================
// CHAT RATE LIMITER - Prevents spam on Vanilla servers
// ============================================================================
class ChatRateLimiter {
  constructor(maxMessages = 3, timeWindowMs = 5000) {
    this.maxMessages = maxMessages;
    this.timeWindowMs = timeWindowMs;
    this.messageTimestamps = [];
    this.messageQueue = [];
    this.isProcessing = false;
  }

  /**
   * Check if we can send a message now (within rate limit)
   */
  canSendNow() {
    const now = Date.now();
    // Remove timestamps older than time window
    this.messageTimestamps = this.messageTimestamps.filter(
      timestamp => now - timestamp < this.timeWindowMs
    );
    return this.messageTimestamps.length < this.maxMessages;
  }

  /**
   * Send message with rate limiting
   * @param {Object} bot - Mineflayer bot instance
   * @param {string} message - Message to send
   * @param {string} priority - 'high', 'normal', 'low'
   */
  async sendMessage(bot, message, priority = 'normal') {
    if (!bot || !message || message.trim().length === 0) {
      return false;
    }

    const now = Date.now();

    if (this.canSendNow()) {
      // Can send immediately
      bot.chat(message);
      this.messageTimestamps.push(now);
      return true;
    }

    // Queue the message if priority is high
    if (priority === 'high') {
      this.messageQueue.push({ message, priority, timestamp: now });
      this.processQueue(bot);
      return false; // Queued, not sent yet
    }

    // Drop low-priority messages when rate limit is reached
    console.log(`⚠️ Rate limit reached, dropping message: "${message.substring(0, 50)}..."`);
    return false;
  }

  /**
   * Process message queue with delays
   */
  async processQueue(bot) {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      // Wait until we can send
      while (!this.canSendNow()) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const { message } = this.messageQueue.shift();
      bot.chat(message);
      this.messageTimestamps.push(Date.now());
    }

    this.isProcessing = false;
  }

  /**
   * Smart chat wrapper - consolidates multiple messages
   * @param {Object} bot - Mineflayer bot instance
   * @param {string} message - Message to send
   * @param {string} priority - Message priority
   */
  smartChat(bot, message, priority = 'normal') {
    // Don't send debug messages to chat
    if (message.includes('DEBUG') || message.includes('🗃️') || message.includes('📦 Extracting')) {
      console.log(message); // Log locally only
      return false;
    }

    // Consolidate repeated similar messages
    const lastMessage = this.messageQueue[this.messageQueue.length - 1];
    if (lastMessage && this.isSimilar(lastMessage.message, message)) {
      console.log(`⚠️ Skipping duplicate message: "${message.substring(0, 50)}..."`);
      return false;
    }

    return this.sendMessage(bot, message, priority);
  }

  /**
   * Check if two messages are similar (to avoid spam)
   */
  isSimilar(msg1, msg2) {
    const normalize = (str) => str.toLowerCase().replace(/[0-9]/g, 'X').trim();
    return normalize(msg1) === normalize(msg2);
  }

  /**
   * Clear all queued messages and reset
   */
  clear() {
    this.messageQueue = [];
    this.messageTimestamps = [];
  }
}

// Global rate limiter instance
const chatLimiter = new ChatRateLimiter(3, 5000); // 3 messages per 5 seconds (Vanilla-safe)

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

      if (!toolItem) {
        console.log(`⚠️ Tool ${bestTool} not in inventory`);
        await this.bot.unequip('hand');
        return false;
      }

      // Only equip if toolItem exists (null-check for Mineflayer API compliance)
      await this.bot.equip(toolItem, 'hand');
      console.log(`🔧 Equipped ${bestTool} for ${blockType}`);
      return true;
    } catch (error) {
      console.log(`⚠️ Failed to equip ${bestTool}: ${error.message}`);
      await this.bot.unequip('hand');
      return false;
    }
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
    if (!chestBlock || chestBlock.name !== 'chest') {
      throw new Error('Not a chest block');
    }

    // Use openChest for chest blocks (Mineflayer API)
    const chest = await this.bot.openChest(chestBlock);

    const contents = {};
    const items = chest.containerItems();

    for (const item of items) {
      if (item) {
        // Use item.name from Mineflayer Item object
        const itemName = item.name;
        contents[itemName] = (contents[itemName] || 0) + item.count;
      }
    }

    chest.close();
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
    if (!chestBlock || chestBlock.name !== 'chest') {
      throw new Error('Not a chest block');
    }

    // Use openChest for chest blocks (Mineflayer API)
    const chest = await this.bot.openChest(chestBlock);

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

    chest.close();
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
        if (!chestBlock || chestBlock.name !== 'chest') {
          continue; // Skip if not a valid chest
        }

        // Use openChest for chest blocks (Mineflayer API)
        const chest = await this.bot.openChest(chestBlock);

        for (const item of inventoryItems) {
          if (remaining <= 0) break;

          const toStore = Math.min(item.count, remaining);
          await chest.deposit(item.type, null, toStore);

          stored += toStore;
          remaining -= toStore;
        }

        chest.close();
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
    if (!chestBlock || chestBlock.name !== 'chest') {
      console.log('❌ No valid chest found');
      return false;
    }

    // Use openChest for chest blocks (Mineflayer API)
    const chest = await this.bot.openChest(chestBlock);

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

    chest.close();
    
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

    const currentInventory = this.getAggregatedInventory();

    // Try all available recipes and pick the best one (least missing materials)
    let bestRecipe = null;
    let bestMissing = null;
    let fewestMissingCount = Infinity;

    for (const recipeData of recipes) {
      const recipe = recipeData[0]; // Get ingredients from recipe
      const missing = {};

      for (const [ingredient, needed] of Object.entries(recipe)) {
        const totalNeeded = needed * quantity;
        let available = currentInventory[ingredient] || 0;

        // WOOD FLEXIBILITY: If recipe wants specific wood type (e.g. oak_planks)
        // but we have ANY other wood type, accept it!
        if (available < totalNeeded) {
          // Check if this is a wood-type specific ingredient
          if (ingredient.endsWith('_planks')) {
            // Use aggregated _planks count (all wood types combined)
            available = currentInventory['_planks'] || 0;
          } else if (ingredient.endsWith('_log')) {
            // Use aggregated _log count (all wood types combined)
            available = currentInventory['_log'] || 0;
          }
        }

        if (available < totalNeeded) {
          missing[ingredient] = totalNeeded - available;
        }
      }

      const missingCount = Object.keys(missing).length;

      // If we can craft with this recipe (no missing items), use it immediately
      if (missingCount === 0) {
        return {
          success: true,
          recipe: recipe,
          missing: {}
        };
      }

      // Track the recipe with fewest missing items
      if (missingCount < fewestMissingCount) {
        fewestMissingCount = missingCount;
        bestRecipe = recipe;
        bestMissing = missing;
      }
    }

    // Return the best recipe we found (even if missing items)
    return {
      success: fewestMissingCount === 0,
      recipe: bestRecipe,
      missing: bestMissing
    };
  }

  /**
   * Get inventory with aggregated wood types
   * Counts both specific items (oak_planks) and generic types (_planks)
   */
  getAggregatedInventory() {
    const inventory = {};
    const items = this.bot.inventory.items();

    for (const item of items) {
      inventory[item.name] = (inventory[item.name] || 0) + item.count;

      // Aggregate all log types to their specific wood type AND generic "_log"
      if (item.name.endsWith('_log')) {
        inventory['_log'] = (inventory['_log'] || 0) + item.count;
      }

      // Aggregate all planks types to their specific wood type AND generic "_planks"
      if (item.name.endsWith('_planks')) {
        inventory['_planks'] = (inventory['_planks'] || 0) + item.count;
      }
    }

    return inventory;
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
    const woodTypes = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];
    const availableWood = woodTypes.find(wood =>
      (inventory[`${wood}_log`] || 0) > 0 || (inventory[`${wood}_planks`] || 0) > 0
    );

    if (!availableWood) return materials;

    const substituted = { ...materials };
    for (const [item, count] of Object.entries(materials)) {
      // Replace generic "_log" placeholder with available wood type
      if (item === '_log') {
        const newItem = `${availableWood}_log`;
        substituted[newItem] = count;
        delete substituted[item];
        console.log(`🔄 Substituted ${item} → ${newItem}`);
      }
      // Replace generic "_planks" placeholder with available wood type
      else if (item === '_planks') {
        const newItem = `${availableWood}_planks`;
        substituted[newItem] = count;
        delete substituted[item];
        console.log(`🔄 Substituted ${item} → ${newItem}`);
      }
      // Replace oak-specific items with available wood type
      else if (item.includes('oak_')) {
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

    // Use skills.collectBlock (Mineflayer API compliant)
    try {
      await skills.collectBlock(this.bot, blockType, quantity);
    } catch (error) {
      console.log(`❌ Mining failed: ${error.message}`);
      return false;
    }

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

    // Use skills.craftRecipe (Mineflayer API compliant)
    // This handles both Creative and Survival modes correctly
    try {
      await skills.craftRecipe(this.bot, itemName, quantity);
      console.log(`✅ Crafted ${quantity}x ${itemName}`);
      return true;
    } catch (error) {
      console.log(`⚠️ Crafting error: ${error.message}`);
      return false;
    }
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
    // Validate and correct item name
    const validatedName = itemValidator.validate(itemName);
    if (!validatedName) {
      console.log(`❌ Invalid item name: "${itemName}"`);
      return false;
    }

    console.log(`🎯 Smart crafting: ${quantity}x ${validatedName}`);

    const inventory = world.getInventoryCounts(this.bot);
    const alreadyHave = inventory[validatedName] || 0;

    if (alreadyHave >= quantity) {
      console.log(`✅ Already have ${alreadyHave}x ${validatedName}`);
      return true;
    }

    const stillNeed = quantity - alreadyHave;

    try {
      // Phase 1: Analyze materials
      const analysis = this.materialAnalyzer.analyzeRecipe(validatedName, stillNeed);

      if (!analysis.success) {
        console.log(`❌ Cannot craft ${validatedName}: ${analysis.reason}`);
        return false;
      }

      // Phase 2: Gather missing materials
      let materials = analysis.missing;
      materials = this.materialAnalyzer.substituteWoodMaterials(materials, inventory);

      for (const [material, needed] of Object.entries(materials)) {
        // Validate material names as well
        const validatedMaterial = itemValidator.validate(material);
        if (!validatedMaterial) {
          console.log(`⚠️ Skipping invalid material: "${material}"`);
          continue;
        }
        const success = await this.resourceGatherer.gather(validatedMaterial, needed, { checkChests: true });
        if (!success) {
          console.log(`❌ Missing material: ${validatedMaterial}`);
          return false;
        }
      }

      // Phase 3: Execute crafting
      const success = await this.craftingExecutor.craft(validatedName, stillNeed);

      if (success) {
        console.log(`✅ Crafted ${quantity}x ${validatedName}!`);
      }

      return success;

    } catch (error) {
      console.log(`❌ Crafting failed: ${error.message}`);
      return false;
    }
  }

  async collectIntelligently(blockType, quantity = 1, options = {}) {
    // Validate and correct block/item name
    const validatedName = itemValidator.validate(blockType);
    if (!validatedName) {
      console.log(`❌ Invalid block/item name: "${blockType}"`);
      return false;
    }

    return await this.resourceGatherer.gather(validatedName, quantity, options);
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