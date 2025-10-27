import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import * as skills from '../../agent/library/skills.js';
import settings from '../../../settings.js';
import * as mcdata from '../../utils/mcdata.js';
import { MaterialClassifier } from './utils/helpers.js';

const { goals } = pathfinder;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SurvivalBuildCoordinator - Manages material gathering and build state for Survival mode
 * This is the most complex class - handles inventory, crafting, storage, and material collection
 */
export class SurvivalBuildCoordinator {
  constructor(bot, registry, orientationHandler, blockPlacer, agent = null) {
    this.bot = bot;
    this.registry = registry;
    this.orientationHandler = orientationHandler;
    this.blockPlacer = blockPlacer;
    this.agent = agent;
    this.buildState = null;
    this.smartCraftingManager = null;
    this.materialClassifier = new MaterialClassifier();
    this.gatheringRetries = {}; // Track retry attempts per material
  }

  /**
   * Initialize smart crafting system
   */
  async initializeSmartCrafting() {
    if (!this.smartCraftingManager) {
      const { SmartCraftingManager } = await import('../../agent/library/smart_crafting.js');
      this.smartCraftingManager = new SmartCraftingManager(this.bot);
      console.log('✅ Smart Crafting Manager initialized');
    }
  }

  /**
   * Analyze required materials from schematic
   */
  async analyzeMaterials(schematicData) {
    console.log('📊 Analyzing schematic materials...');

    const materials = {};

    schematicData.forEach((pos, block) => {
      if (block?.name && block.name !== 'minecraft:air' && block.name !== 'air') {
        const baseName = block.name.replace('minecraft:', '').split('[')[0];
        materials[baseName] = (materials[baseName] || 0) + 1;
      }
    });

    // Get inventory counts
    const inventory = this.getInventoryCounts();

    // Scan nearby chests
    await this.initializeSmartCrafting();
    const chests = await this.smartCraftingManager.storageManager.scanNearbyChests();

    const analysis = {
      required: materials,
      available: {},
      inChests: {},
      missing: {}
    };

    for (const [item, needed] of Object.entries(materials)) {
      const inInventory = inventory[item] || 0;
      const inStorage = this.countInChests(chests, item);

      analysis.available[item] = inInventory;
      analysis.inChests[item] = inStorage;

      const total = inInventory + inStorage;
      if (total < needed) {
        analysis.missing[item] = needed - total;
      }
    }

    return analysis;
  }

  /**
   * Get current inventory counts
   */
  getInventoryCounts() {
    const counts = {};
    const items = this.bot.inventory.items();

    for (const item of items) {
      if (item && item.name) {
        counts[item.name] = (counts[item.name] || 0) + item.count;
      }
    }

    return counts;
  }

  /**
   * Count items in chest storage
   */
  countInChests(storageMap, itemName) {
    let total = 0;

    for (const contents of Object.values(storageMap)) {
      total += contents[itemName] || 0;
    }

    return total;
  }

  /**
   * Get suggestions for gathering difficult materials
   */
  getSuggestionsForGathering(material) {
    const suggestions = {
      'string': 'Hunt spiders OR craft from wool',
      'wool': 'Shear sheep (with shears) OR craft from 4x string',
      'white_wool': 'Shear sheep OR craft from string',
      'leather': 'Hunt cows/horses',
      'feather': 'Hunt chickens',
      'bone': 'Hunt skeletons',
      'gunpowder': 'Hunt creepers',
      'slime_ball': 'Hunt slimes in swamp',
      'ender_pearl': 'Hunt endermen',
      'blaze_rod': 'Hunt blazes in Nether'
    };

    return suggestions[material] || 'I need help gathering this';
  }

  /**
   * Resolve materials to base ingredients using crafting recipes
   * Returns { baseItems: {...}, craftingSteps: [...] }
   */
  resolveCraftingRecipes(missing) {
    const inventory = this.getInventoryCounts();
    const resolved = {
      baseItems: {},      // Items that need to be gathered
      craftingSteps: []   // Crafting steps to execute
    };

    for (const [material, count] of Object.entries(missing)) {
      // Check if we already have it in inventory
      const inInventory = inventory[material] || 0;
      if (inInventory >= count) {
        continue; // Skip - we already have enough
      }

      const stillNeeded = count - inInventory;

      // Try to get crafting plan from mcdata
      try {
        const plan = mcdata.getDetailedCraftingPlan(material, stillNeeded, inventory);

        if (typeof plan === 'string' && plan.includes('base item')) {
          // This is a base item - needs to be gathered
          resolved.baseItems[material] = stillNeeded;
        } else if (typeof plan === 'string' && plan.includes('You are missing')) {
          // Parse the plan to extract base materials and crafting steps
          const lines = plan.split('\n');
          let inMissingSection = false;
          let inCraftingSection = false;

          for (const line of lines) {
            if (line.includes('You are missing')) {
              inMissingSection = true;
              continue;
            }
            if (line.includes('crafting plan:')) {
              inMissingSection = false;
              inCraftingSection = true;
              continue;
            }

            if (inMissingSection && line.startsWith('- ')) {
              // Extract: "- 16 oak_log"
              const match = line.match(/- (\d+) (\w+)/);
              if (match) {
                const [, qty, item] = match;
                resolved.baseItems[item] = (resolved.baseItems[item] || 0) + parseInt(qty);
              }
            }

            if (inCraftingSection && line.startsWith('Craft ')) {
              resolved.craftingSteps.push(line);
            }
          }
        } else if (typeof plan === 'string' && plan.includes('You have all')) {
          // We have all items needed to craft - just add crafting steps
          const lines = plan.split('\n');
          for (const line of lines) {
            if (line.startsWith('Craft ')) {
              resolved.craftingSteps.push(line);
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not resolve recipe for ${material}: ${error.message}`);
        // Fallback: treat as base item
        resolved.baseItems[material] = stillNeeded;
      }
    }

    return resolved;
  }

  /**
   * Clean inventory - keep only tools, food, and weapons
   */
  async cleanInventory() {
    const keepTypes = ['sword', 'axe', 'pickaxe', 'shovel', 'hoe', 'shears', 'food', 'arrow', 'bow', 'shield'];

    const toStore = [];
    for (const item of this.bot.inventory.items()) {
      const shouldKeep = keepTypes.some(type =>
        item.name.includes(type) ||
        item.name === 'cooked' ||
        item.name === 'bread' ||
        item.name === 'steak'
      );

      if (!shouldKeep) {
        toStore.push(item);
      }
    }

    if (toStore.length > 0) {
      console.log(`🧹 Räume Inventar auf (${toStore.length} Items)...`);

      // Find nearest chest
      const chestPositions = this.bot.findBlocks({
        matching: (block) => block && block.name === 'chest',
        maxDistance: 32,
        count: 1
      });

      if (chestPositions.length > 0) {
        await this.smartCraftingManager.storageManager.storeInChest(toStore);
        console.log('✅ Inventar aufgeräumt!');
      }
    }
  }

  /**
   * Procure missing materials with retry logic and smart collection (NEW IMPROVED VERSION)
   * Features:
   * - Withdraws from chests FIRST
   * - Uses smartCollect for base materials (stone, wood, iron, etc.)
   * - Retry logic: 3 attempts per material before asking player
   * - Intelligent fallback strategies
   */
  async procureMaterialsWithRetry(missing, buildPosition = null) {
    console.log('🔍 Beschaffe fehlende Materialien...');

    // Step 0: Clean inventory first
    await this.initializeSmartCrafting();
    await this.cleanInventory();

    // Save build position for return later
    const savedBuildPos = buildPosition || (this.buildState ? this.buildState.position : null);

    // Step 1: Withdraw from chests what's available
    const storageMap = await this.smartCraftingManager.storageManager.scanNearbyChests();

    for (const [material, count] of Object.entries(missing)) {
      const inventory = this.getInventoryCounts();
      const inInventory = inventory[material] || 0;

      if (inInventory >= count) {
        continue; // Already have enough
      }

      const stillNeeded = count - inInventory;

      // Check if available in chests
      let inChests = 0;
      for (const contents of Object.values(storageMap)) {
        inChests += contents[material] || 0;
      }

      if (inChests > 0) {
        const toWithdraw = Math.min(stillNeeded, inChests);
        console.log(`📦 Hole ${toWithdraw}x ${material} aus Truhen...`);

        // Extract from each chest that has this material
        let withdrawn = 0;
        for (const [location, contents] of Object.entries(storageMap)) {
          const available = contents[material] || 0;
          if (available > 0 && withdrawn < toWithdraw) {
            const toExtract = Math.min(toWithdraw - withdrawn, available);
            const pos = location.split(',').map(Number);

            try {
              const actualExtracted = await this.smartCraftingManager.storageManager.extractFromChest(
                new Vec3(pos[0], pos[1], pos[2]),
                material,
                toExtract
              );
              withdrawn += actualExtracted;
            } catch (error) {
              console.log(`⚠️ Could not extract from chest at ${location}: ${error.message}`);
            }

            if (withdrawn >= toWithdraw) break;
          }
        }

        if (withdrawn > 0) {
          console.log(`✅ ${withdrawn}x ${material} aus Truhen geholt!`);
        }
      }
    }

    // Step 2: Check what's still missing after chest withdrawal
    const inventory = this.getInventoryCounts();
    const stillMissing = {};

    for (const [material, count] of Object.entries(missing)) {
      const inInventory = inventory[material] || 0;
      if (inInventory < count) {
        stillMissing[material] = count - inInventory;
      }
    }

    if (Object.keys(stillMissing).length === 0) {
      console.log('✅ Alle Materialien vorhanden!');
      return { success: true };
    }

    // Step 2.5: Check for material substitutions
    const materialSubstitutions = {
      'white_bed': ['bed', 'red_bed', 'blue_bed', 'black_bed', 'brown_bed', 'green_bed'],
      'chest': ['barrel'],
      'glass': ['glass_pane'],
      'cobblestone_stairs': ['stone_stairs', 'stone_brick_stairs']
    };

    for (const [material, count] of Object.entries(stillMissing)) {
      // Check für Substitutionen
      const substitutes = materialSubstitutions[material];
      if (substitutes) {
        for (const substitute of substitutes) {
          const subInventory = this.getInventoryCounts();
          if (subInventory[substitute] >= count) {
            console.log(`✅ Using ${substitute} as substitute for ${material}`);
            delete stillMissing[material];
            break;
          }
        }
      }

      // Wenn Material nicht kritisch ist, überspringe es
      const nonCriticalMaterials = ['glass', 'chest', 'bed', 'door', 'painting', 'item_frame'];
      if (nonCriticalMaterials.some(ncm => material.includes(ncm))) {
        if (stillMissing[material]) {
          console.log(`⚠️ Skipping non-critical material: ${material}`);
          console.log(`⚠️ Überspringe optionales Material: ${material}`);
          delete stillMissing[material];
          continue;
        }
      }
    }

    if (Object.keys(stillMissing).length === 0) {
      console.log('✅ Alle kritischen Materialien vorhanden oder substituiert!');
      return { success: true };
    }

    // Step 3: Gather materials with retry logic and intelligent strategies
    for (const [material, count] of Object.entries(stillMissing)) {
      // Initialize retry counter if not exists
      if (!this.gatheringRetries[material]) {
        this.gatheringRetries[material] = 0;
      }

      const category = this.materialClassifier.classify(material);
      console.log(`🔍 Material: ${material} (Kategorie: ${category})`);

      // Strategy 1: Use smartCollect for base materials
      if (this.materialClassifier.shouldUseSmartCollect(material)) {
        console.log(`⛏️ Sammle ${count}x ${material} (Base-Material)...`);

        const success = await this.smartCraftingManager.collectIntelligently(
          material,
          count,
          { checkChests: false, strategy: 'auto' }
        );

        if (success) {
          console.log(`✅ ${material} gesammelt!`);
          this.gatheringRetries[material] = 0; // Reset on success
          continue;
        }

        // Failed - increment retry counter
        this.gatheringRetries[material]++;
      }

      // Strategy 2: Try crafting for craftable items
      if (category === 'simple_craft' || category === 'complex_craft') {
        console.log(`🔨 Versuche ${count}x ${material} zu craften...`);

        const craftSuccess = await this.smartCraftingManager.craftIntelligently(
          material,
          count
        );

        if (craftSuccess) {
          console.log(`✅ ${material} gecraftet!`);
          this.gatheringRetries[material] = 0; // Reset on success
          continue;
        }

        // Failed - increment retry counter
        this.gatheringRetries[material]++;
      }

      // Strategy 3: If difficult material or failed multiple times, ask for help
      if (category === 'difficult' || this.gatheringRetries[material] >= 3) {
        console.log(`⏸️ Konnte ${material} nach ${this.gatheringRetries[material]} Versuchen nicht beschaffen.`);
        console.log(`💬 Kannst du mir helfen ${count}x ${material} zu besorgen?`);
        console.log(`📝 Ideen: ${this.getSuggestionsForGathering(material)}`);

        // Notify LLM
        if (this.agent && this.agent.history) {
          await this.agent.history.add('system',
            `Build paused after ${this.gatheringRetries[material]} attempts: Cannot gather ${count}x ${material}. ` +
            `Need help from player. Suggestions: ${this.getSuggestionsForGathering(material)}. ` +
            `Respond to player and ask them for help getting this material. ` +
            `They can use !buildresume when materials are ready.`
          );
        }

        // Don't reset retry counter - keep it for next time
        return { success: false, failed: material, needsHelp: true, attempts: this.gatheringRetries[material] };
      }

      // Strategy 4: Final fallback - try recipe resolution
      const resolved = this.resolveCraftingRecipes({ [material]: count });

      if (Object.keys(resolved.baseItems).length > 0) {
        console.log(`📦 Sammle Basis-Materialien für ${material}...`);

        for (const [baseMaterial, baseCount] of Object.entries(resolved.baseItems)) {
          const baseSuccess = await this.smartCraftingManager.collectIntelligently(
            baseMaterial,
            baseCount,
            { checkChests: false, strategy: 'auto' }
          );

          if (!baseSuccess) {
            this.gatheringRetries[material]++;
            break;
          }
        }

        // Try crafting again after gathering base materials
        const craftSuccess = await this.smartCraftingManager.craftIntelligently(material, count);
        if (craftSuccess) {
          console.log(`✅ ${material} gecraftet!`);
          this.gatheringRetries[material] = 0;
          continue;
        }
      }

      // If we reach here, increment retry and try again next time
      this.gatheringRetries[material]++;
      console.log(`⚠️ Versuch ${this.gatheringRetries[material]}/3 für ${material} fehlgeschlagen`);
    }

    // Return to build position after gathering
    if (savedBuildPos) {
      console.log('🏗️ Kehre zum Bauplatz zurück...');
      await this.returnToBuildSite(savedBuildPos);
    }

    console.log('✅ Alle Materialien beschafft!');
    return { success: true };
  }

  /**
   * OLD VERSION - Kept for backward compatibility
   * Procure missing materials using smart crafting with recipe resolution
   * Withdraws from chests FIRST, then gathers/crafts what's still missing
   */
  async procureMaterials(missing, buildPosition = null) {
    console.log('🔍 Beschaffe fehlende Materialien...');

    // Step 0: Clean inventory first
    await this.initializeSmartCrafting();
    await this.cleanInventory();

    // Save build position for return later
    const savedBuildPos = buildPosition || (this.buildState ? this.buildState.position : null);

    // Step 1: Withdraw from chests what's available
    await this.initializeSmartCrafting();
    const storageMap = await this.smartCraftingManager.storageManager.scanNearbyChests();

    for (const [material, count] of Object.entries(missing)) {
      const inventory = this.getInventoryCounts();
      const inInventory = inventory[material] || 0;

      if (inInventory >= count) {
        continue; // Already have enough
      }

      const stillNeeded = count - inInventory;

      // Check if available in chests
      let inChests = 0;
      for (const contents of Object.values(storageMap)) {
        inChests += contents[material] || 0;
      }

      if (inChests > 0) {
        const toWithdraw = Math.min(stillNeeded, inChests);
        console.log(`📦 Hole ${toWithdraw}x ${material} aus Truhen...`);

        // Extract from each chest that has this material
        let withdrawn = 0;
        for (const [location, contents] of Object.entries(storageMap)) {
          const available = contents[material] || 0;
          if (available > 0 && withdrawn < toWithdraw) {
            const toExtract = Math.min(toWithdraw - withdrawn, available);
            const pos = location.split(',').map(Number);

            try {
              const actualExtracted = await this.smartCraftingManager.storageManager.extractFromChest(
                new Vec3(pos[0], pos[1], pos[2]),
                material,
                toExtract
              );
              withdrawn += actualExtracted;
            } catch (error) {
              console.log(`⚠️ Could not extract from chest at ${location}: ${error.message}`);
            }

            if (withdrawn >= toWithdraw) break;
          }
        }

        if (withdrawn > 0) {
          console.log(`✅ ${withdrawn}x ${material} aus Truhen geholt!`);
        }
      }
    }

    // Step 2: Resolve crafting recipes for what's still missing
    const inventory = this.getInventoryCounts();
    const stillMissing = {};

    for (const [material, count] of Object.entries(missing)) {
      const inInventory = inventory[material] || 0;
      if (inInventory < count) {
        stillMissing[material] = count - inInventory;
      }
    }

    if (Object.keys(stillMissing).length === 0) {
      console.log('✅ Alle Materialien vorhanden!');
      return { success: true };
    }

    const resolved = this.resolveCraftingRecipes(stillMissing);
    console.log('📋 Resolved materials:', resolved);

    // Step 3: Gather base items (will go out into the world)
    if (Object.keys(resolved.baseItems).length > 0) {
      console.log('📦 Sammle Basis-Materialien...');

      for (const [material, count] of Object.entries(resolved.baseItems)) {
        console.log(`⛏️ Sammle: ${count}x ${material}`);

        const success = await this.smartCraftingManager.collectIntelligently(
          material,
          count,
          { checkChests: false, strategy: 'auto' } // Don't check chests again
        );

        if (!success) {
          // Pause and ask for help instead of failing immediately
          console.log(`⏸️ Konnte ${material} nicht automatisch beschaffen.`);
          console.log(`💬 Kannst du mir helfen ${count}x ${material} zu besorgen?`);
          console.log(`📝 Ideen: ${this.getSuggestionsForGathering(material)}`);

          // Notify LLM via history so it can respond
          if (this.agent && this.agent.history) {
            await this.agent.history.add('system',
              `Build paused: Cannot gather ${count}x ${material} automatically. ` +
              `Need help from player. Suggestions: ${this.getSuggestionsForGathering(material)}. ` +
              `Respond to player and ask them for help getting this material. ` +
              `They can use !buildresume when materials are ready.`
            );
          }

          // Return with pause instead of failure
          return { success: false, failed: material, needsHelp: true };
        }

        console.log(`✅ ${material} gesammelt!`);
      }

      // Return to build position after gathering
      if (savedBuildPos) {
        console.log('🏗️ Kehre zum Bauplatz zurück...');
        await this.returnToBuildSite(savedBuildPos);
      }
    }

    // Step 4: Execute crafting steps
    if (resolved.craftingSteps.length > 0) {
      console.log('🔨 Crafte Items...');

      for (const [material, count] of Object.entries(stillMissing)) {
        const currentInventory = this.getInventoryCounts();
        const inInventory = currentInventory[material] || 0;

        if (inInventory >= count) {
          continue; // Already have enough
        }

        const needToCraft = count - inInventory;

        console.log(`🔨 Crafte: ${needToCraft}x ${material}`);

        const craftSuccess = await this.smartCraftingManager.craftIntelligently(
          material,
          needToCraft
        );

        if (!craftSuccess) {
          console.log(`❌ Konnte ${material} nicht craften!`);
          return { success: false, failed: material };
        }

        console.log(`✅ ${material} gecraftet!`);
      }
    }

    // Step 5: Final fallback - try direct collection/crafting
    for (const [material, count] of Object.entries(stillMissing)) {
      const currentInventory = this.getInventoryCounts();
      const inInventory = currentInventory[material] || 0;

      if (inInventory >= count) {
        continue; // Already have enough
      }

      const remaining = count - inInventory;

      const success = await this.smartCraftingManager.collectIntelligently(
        material,
        remaining,
        { checkChests: false, strategy: 'auto' }
      );

      if (!success) {
        const craftSuccess = await this.smartCraftingManager.craftIntelligently(
          material,
          remaining
        );

        if (!craftSuccess) {
          console.log(`❌ Konnte ${material} nicht beschaffen!`);
          return { success: false, failed: material };
        }
      }
    }

    console.log('✅ Alle Materialien beschafft!');
    return { success: true };
  }

  /**
   * Return to build site after gathering materials
   */
  async returnToBuildSite(buildPosition) {
    const distance = this.bot.entity.position.distanceTo(buildPosition);

    if (distance < 5) {
      console.log('✅ Already at build site');
      return true;
    }

    console.log(`🚶 Returning to build site (${distance.toFixed(1)}m away)...`);

    try {
      const goal = new pathfinder.goals.GoalNear(
        buildPosition.x,
        buildPosition.y,
        buildPosition.z,
        3
      );

      await this.bot.pathfinder.goto(goal);
      console.log('✅ Returned to build site');
      return true;
    } catch (error) {
      console.log(`⚠️ Could not return to build site: ${error.message}`);
      return false;
    }
  }

  /**
   * Create build state for tracking progress
   */
  createBuildState(schematicName, position, schematicData) {
    const totalBlocks = this.countTotalBlocks(schematicData);

    return {
      schematicName,
      position,
      totalBlocks,
      currentLayer: 0,
      placedBlocks: new Set(),
      status: 'building',
      startTime: Date.now(),
      lastUpdate: Date.now(),
      pauseReason: null
    };
  }

  /**
   * Count total blocks in schematic
   */
  countTotalBlocks(schematicData) {
    let count = 0;

    schematicData.forEach((pos, block) => {
      if (block?.name && block.name !== 'minecraft:air' && block.name !== 'air') {
        count++;
      }
    });

    return count;
  }

  /**
   * Get the file path for saving build state
   */
  getBuildStateFilePath() {
    const botName = this.bot.username;
    const botsDir = path.join(__dirname, '..', '..', 'bots', botName);

    // Ensure bots directory exists
    if (!fs.existsSync(botsDir)) {
      fs.mkdirSync(botsDir, { recursive: true });
    }

    return path.join(botsDir, 'build_state.json');
  }

  /**
   * Save build state (in-memory and to file)
   */
  saveBuildState() {
    if (!this.buildState) return;

    this.buildState.lastUpdate = Date.now();

    // Speichere auch temporäre Fehler für Recovery
    const serializable = {
      ...this.buildState,
      placedBlocks: Array.from(this.buildState.placedBlocks),
      errorRecovery: {
        consecutiveErrors: this.consecutiveErrors || 0,
        lastErrorPosition: this.lastErrorPosition || null,
        retriedPositions: this.retriedPositions || []
      }
    };

    console.log(`💾 Build state saved: ${this.buildState.placedBlocks.size}/${this.buildState.totalBlocks} blocks placed`);

    // Save to file for persistence across restarts
    try {
      const filePath = this.getBuildStateFilePath();
      fs.writeFileSync(filePath, JSON.stringify(serializable, null, 2));
      console.log(`✅ Build state saved to ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to save build state: ${error.message}`);
    }
  }

  /**
   * Load build state from file
   */
  loadBuildState() {
    // Check if already loaded in memory
    if (this.buildState && this.buildState.placedBlocks) {
      // Convert Array back to Set if needed
      if (Array.isArray(this.buildState.placedBlocks)) {
        this.buildState.placedBlocks = new Set(this.buildState.placedBlocks);
      }
      return true;
    }

    // Try to load from file
    try {
      const filePath = this.getBuildStateFilePath();

      if (!fs.existsSync(filePath)) {
        console.log('📁 No saved build state found');
        return false;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      const loaded = JSON.parse(data);

      // Convert Array back to Set
      if (loaded.placedBlocks && Array.isArray(loaded.placedBlocks)) {
        loaded.placedBlocks = new Set(loaded.placedBlocks);
      }

      // Restore error recovery data
      if (loaded.errorRecovery) {
        this.consecutiveErrors = loaded.errorRecovery.consecutiveErrors || 0;
        this.lastErrorPosition = loaded.errorRecovery.lastErrorPosition || null;
        this.retriedPositions = loaded.errorRecovery.retriedPositions || [];
        console.log(`✅ Error recovery data loaded: ${this.consecutiveErrors} errors tracked`);
      }

      this.buildState = loaded;

      const progress = `${this.buildState.placedBlocks.size}/${this.buildState.totalBlocks}`;
      const percent = Math.round((this.buildState.placedBlocks.size / this.buildState.totalBlocks) * 100);

      console.log(`✅ Build state loaded: ${progress} blocks (${percent}%) - Layer ${this.buildState.currentLayer}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to load build state: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete build state file (when build is completed or cancelled)
   */
  deleteBuildState() {
    try {
      const filePath = this.getBuildStateFilePath();

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Build state file deleted: ${filePath}`);
      }

      this.buildState = null;
    } catch (error) {
      console.error(`❌ Failed to delete build state: ${error.message}`);
    }
  }

  /**
   * Pause build with reason
   */
  pauseBuild(reason) {
    if (this.buildState) {
      this.buildState.status = 'paused';
      this.buildState.pauseReason = reason;
      this.saveBuildState();
      console.log(`⏸️ Build paused: ${reason}`);
    }
  }

  /**
   * Resume build
   */
  resumeBuild() {
    if (this.buildState) {
      this.buildState.status = 'building';
      this.buildState.pauseReason = null;
      console.log(`▶️ Build resumed from layer ${this.buildState.currentLayer}`);
    }
  }

  /**
   * Organize schematic blocks by layer with properties
   */
  organizeByLayer(schematicData, buildPos) {
    const layers = new Map();

    schematicData.forEach((pos, block) => {
      if (block?.name && block.name !== 'minecraft:air' && block.name !== 'air') {
        const baseName = block.name.replace('minecraft:', '').split('[')[0];

        const worldPos = {
          x: buildPos.x + pos.x,
          y: buildPos.y + pos.y,
          z: buildPos.z + pos.z
        };

        const layer = worldPos.y;

        if (!layers.has(layer)) {
          layers.set(layer, []);
        }

        layers.get(layer).push({
          pos: worldPos,
          block: baseName,
          properties: block.properties || {},
          schematicPos: pos
        });
      }
    });

    return layers;
  }

  /**
   * Analyze materials needed for a specific layer
   */
  analyzeLayerMaterials(layerBlocks) {
    const materials = {};

    for (const blockInfo of layerBlocks) {
      const baseName = blockInfo.block;
      if (baseName && baseName !== 'air') {
        materials[baseName] = (materials[baseName] || 0) + 1;
      }
    }

    return materials;
  }

  /**
   * Check if we have materials for a layer (inventory + chests)
   */
  async checkLayerMaterials(layerMaterials) {
    const inventory = this.getInventoryCounts();
    await this.initializeSmartCrafting();
    const chests = await this.smartCraftingManager.storageManager.scanNearbyChests();

    const analysis = {
      required: layerMaterials,
      available: {},
      inChests: {},
      missing: {}
    };

    for (const [item, needed] of Object.entries(layerMaterials)) {
      const inInventory = inventory[item] || 0;
      const inStorage = this.countInChests(chests, item);

      analysis.available[item] = inInventory;
      analysis.inChests[item] = inStorage;

      const total = inInventory + inStorage;
      if (total < needed) {
        analysis.missing[item] = needed - total;
      }
    }

    return analysis;
  }

  /**
   * Continue build from saved state (for resume functionality)
   */
  async _continueBuildFromState(schematicInfo, schematicData) {
    if (!this.buildState) {
      return { success: false, reason: 'No build state to continue from' };
    }

    const state = this.buildState;
    state.status = 'building'; // Resume building

    try {
      // Phase 2: Organize by layers
      const layers = this.organizeByLayer(schematicData, state.position);
      const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);

      // Find which layer index we're on
      let startLayerIndex = sortedLayers.findIndex(y => y === state.currentLayer);
      if (startLayerIndex === -1) {
        startLayerIndex = 0; // Fallback to start
      }

      // IMPORTANT: Check if current layer is already complete
      // If all blocks in this layer are placed, move to NEXT layer
      const currentLayerBlocks = layers.get(sortedLayers[startLayerIndex]);
      const allPlacedInCurrentLayer = currentLayerBlocks.every(blockInfo => {
        const key = `${blockInfo.pos.x},${blockInfo.pos.y},${blockInfo.pos.z}`;
        return state.placedBlocks.has(key);
      });

      if (allPlacedInCurrentLayer && startLayerIndex < sortedLayers.length - 1) {
        startLayerIndex++; // Move to next layer
        console.log(`✅ Current layer ${state.currentLayer} already complete, moving to next layer`);
      }

      console.log(`🔄 Fortsetzen ab Schicht ${startLayerIndex + 1}/${sortedLayers.length}`);

      let blocksPlaced = 0;
      let errors = 0;

      // Phase 3: Continue building from saved layer
      for (let layerIndex = startLayerIndex; layerIndex < sortedLayers.length; layerIndex++) {
        const layerY = sortedLayers[layerIndex];
        const blocks = layers.get(layerY);

        console.log(`📐 Schicht ${layerIndex + 1}/${sortedLayers.length} (Y=${layerY}, ${blocks.length} Blöcke)`);

        // Step 1: Analyze materials needed for this layer
        const layerMaterials = this.analyzeLayerMaterials(blocks);
        const currentInventory = this.getInventoryCounts();
        const actuallyMissing = {};

        for (const [item, needed] of Object.entries(layerMaterials)) {
          const inInventory = currentInventory[item] || 0;
          if (inInventory < needed) {
            actuallyMissing[item] = needed - inInventory;
          }
        }

        // Step 2: Gather missing materials if needed
        if (Object.keys(actuallyMissing).length > 0) {
          console.log(`📦 Sammle Materialien für Schicht ${layerIndex + 1}...`);

          const procureResult = await this.procureMaterialsWithRetry(actuallyMissing, state.position);

          if (!procureResult.success) {
            if (procureResult.needsHelp) {
              // Pause and wait for help
              this.pauseBuild('waiting_for_help');
              console.log(`⏸️ Build pausiert. Waiting for help with ${procureResult.failed}.`);
              console.log(`Use !buildresume when materials are ready.`);
              return { success: false, reason: `Waiting for help: ${procureResult.failed}`, canResume: true, needsHelp: true };
            } else {
              console.log(`❌ Konnte ${procureResult.failed} nicht beschaffen!`);
              this.pauseBuild('material_gathering_failed');
              return { success: false, reason: `Material gathering failed: ${procureResult.failed}`, canResume: true };
            }
          }

          console.log(`✅ Materialien für Schicht ${layerIndex + 1} vollständig!`);
        }

        // Step 3: Build this layer
        console.log(`🏗️ Building Layer Y=${layerY} (${blocks.length} blocks)`);

        // Health check
        if (this.bot.health < 6) {
          this.pauseBuild('low_health');
          console.log('⚠️ Niedrige Gesundheit! Bau pausiert. Nutze !buildresume zum Fortsetzen.');
          return { success: false, reason: 'Paused due to low health', canResume: true };
        }

        for (const blockInfo of blocks) {
          // Check if already placed (for resume support)
          const key = `${blockInfo.pos.x},${blockInfo.pos.y},${blockInfo.pos.z}`;

          if (state.placedBlocks.has(key)) {
            continue; // Skip already placed blocks
          }

          // Place block with orientation
          const success = await this.blockPlacer.placeBlock(
            blockInfo.block,
            blockInfo.pos,
            blockInfo.properties
          );

          if (success) {
            blocksPlaced++;
            state.placedBlocks.add(key);
          } else {
            errors++;
          }

          // Save state every 10 blocks
          if (blocksPlaced % 10 === 0) {
            this.saveBuildState();
          }

          await new Promise(r => setTimeout(r, settings.block_place_delay || 800));

          if (errors > 30) {
            console.log('❌ Zu viele Fehler, Bau pausiert.');
            this.pauseBuild('too_many_errors');
            return { success: false, reason: 'Too many errors', canResume: true };
          }
        }

        state.currentLayer = layerY;
        this.saveBuildState();

        // Progress report
        const progress = Math.round((state.placedBlocks.size / state.totalBlocks) * 100);
        console.log(`✅ Schicht ${layerIndex + 1}/${sortedLayers.length} fertig (${progress}% gesamt)`);

        // Brief pause between layers
        if (layerY < sortedLayers[sortedLayers.length - 1]) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // Phase 4: Complete
      const duration = ((Date.now() - state.startTime) / 1000).toFixed(1);
      const successRate = Math.round((blocksPlaced / (blocksPlaced + errors)) * 100);

      // Clear build state and delete file
      this.deleteBuildState();

      return {
        success: true,
        blocksPlaced,
        errors,
        duration,
        successRate
      };

    } catch (error) {
      console.error('❌ Build error:', error);
      console.log(`❌ Baufehler: ${error.message}`);

      if (this.buildState) {
        this.pauseBuild('error');
        this.saveBuildState();
      }

      return { success: false, reason: error.message, canResume: true };
    }
  }

  /**
   * Main build function with survival mode support (Layer-by-Layer)
   */
  async buildWithSurvivalMode(schematicInfo, schematicData, position) {
    try {
      // Phase 1: Initialize Build State
      this.buildState = this.createBuildState(schematicInfo.name, position, schematicData);

      // Phase 2: Organize by layers
      const layers = this.organizeByLayer(schematicData, position);
      const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);

      console.log(`🏗️ Starte Bau: ${sortedLayers.length} Schichten, ${this.buildState.totalBlocks} Blöcke gesamt`);

      // Phase 3: Build layer-by-layer with per-layer material gathering
      let blocksPlaced = 0;
      let errors = 0;

      for (let layerIndex = 0; layerIndex < sortedLayers.length; layerIndex++) {
        const layerY = sortedLayers[layerIndex];
        const blocks = layers.get(layerY);

        console.log(`📐 Schicht ${layerIndex + 1}/${sortedLayers.length} (Y=${layerY}, ${blocks.length} Blöcke)`);

        // Step 1: Analyze materials needed for this layer
        const layerMaterials = this.analyzeLayerMaterials(blocks);
        const materialAnalysis = await this.checkLayerMaterials(layerMaterials);

        // Step 2: Gather missing materials for this layer
        // Check what's actually in inventory vs what's needed
        const currentInventory = this.getInventoryCounts();
        const actuallyMissing = {};

        for (const [item, needed] of Object.entries(layerMaterials)) {
          const inInventory = currentInventory[item] || 0;
          if (inInventory < needed) {
            actuallyMissing[item] = needed - inInventory;
          }
        }

        if (Object.keys(actuallyMissing).length > 0) {
          console.log(`📦 Sammle Materialien für Schicht ${layerIndex + 1}...`);

          const procureResult = await this.procureMaterialsWithRetry(actuallyMissing, position);

          if (!procureResult.success) {
            if (procureResult.needsHelp) {
              // Pause and wait for help - LLM will handle this
              this.pauseBuild('waiting_for_help');
              console.log(`⏸️ Build paused. Waiting for help with ${procureResult.failed}.`);
              console.log(`Use !buildresume when materials are ready.`);
              return { success: false, reason: `Waiting for help: ${procureResult.failed}`, canResume: true, needsHelp: true };
            } else {
              console.log(`❌ Konnte ${procureResult.failed} nicht beschaffen!`);
              this.pauseBuild('material_gathering_failed');
              return { success: false, reason: `Material gathering failed: ${procureResult.failed}`, canResume: true };
            }
          }

          console.log(`✅ Materialien für Schicht ${layerIndex + 1} vollständig!`);
        }

        // Step 3: Build this layer
        console.log(`🏗️ Building Layer Y=${layerY} (${blocks.length} blocks)`);

        // Check if we should pause (health check)
        if (this.bot.health < 6) {
          this.pauseBuild('low_health');
          console.log('⚠️ Niedrige Gesundheit! Bau pausiert. Nutze !buildresume zum Fortsetzen.');
          return { success: false, reason: 'Paused due to low health', canResume: true };
        }

        for (const blockInfo of blocks) {
          // Check if already placed (for resume support)
          const key = `${blockInfo.pos.x},${blockInfo.pos.y},${blockInfo.pos.z}`;

          if (this.buildState.placedBlocks.has(key)) {
            continue; // Skip already placed blocks
          }

          // Place block with orientation
          const success = await this.blockPlacer.placeBlock(
            blockInfo.block,
            blockInfo.pos,
            blockInfo.properties
          );

          if (success) {
            blocksPlaced++;
            this.buildState.placedBlocks.add(key);
          } else {
            errors++;
          }

          // Save state every 10 blocks
          if (blocksPlaced % 10 === 0) {
            this.saveBuildState();
          }

          await new Promise(r => setTimeout(r, settings.block_place_delay || 800));

          if (errors > 30) {
            console.log('❌ Zu viele Fehler, Bau pausiert.');
            this.pauseBuild('too_many_errors');
            return { success: false, reason: 'Too many errors', canResume: true };
          }
        }

        this.buildState.currentLayer = layerY;
        this.saveBuildState();

        // Progress report
        const progress = Math.round((blocksPlaced / this.buildState.totalBlocks) * 100);
        console.log(`✅ Schicht ${layerIndex + 1}/${sortedLayers.length} fertig (${progress}% gesamt)`);

        // Brief pause between layers
        if (layerY < sortedLayers[sortedLayers.length - 1]) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // Phase 5: Complete
      const duration = ((Date.now() - this.buildState.startTime) / 1000).toFixed(1);
      const successRate = Math.round((blocksPlaced / (blocksPlaced + errors)) * 100);

      console.log(`✅ Bau abgeschlossen! ${blocksPlaced} Blöcke in ${duration}s (${successRate}%)`);

      // Clear build state and delete file
      this.deleteBuildState();

      return {
        success: true,
        blocksPlaced,
        errors,
        duration,
        successRate
      };

    } catch (error) {
      console.error('❌ Build error:', error);
      console.log(`❌ Baufehler: ${error.message}`);

      if (this.buildState) {
        this.pauseBuild('error');
        this.saveBuildState();
      }

      return { success: false, reason: error.message, canResume: true };
    }
  }
}

// ============================================================================
// BUILDING MANAGER - Hauptklasse die alles koordiniert
// ============================================================================
