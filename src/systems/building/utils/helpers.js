import * as skills from '../../../agent/library/skills.js';
import { Vec3 } from 'vec3';

/**
 * PlayerLocator - Findet und verfolgt Spieler-Positionen
 */
export class PlayerLocator {
  constructor(bot) {
    this.bot = bot;
  }

  async findNearest() {
    const players = Object.keys(this.bot.players).filter(name => name !== this.bot.username);

    if (players.length === 0) {
      console.log('⚠️ No players found');
      return null;
    }

    let nearestPlayer = null;
    let nearestDistance = Infinity;

    for (const playerName of players) {
      const player = this.bot.players[playerName].entity;
      if (player) {
        const distance = this.bot.entity.position.distanceTo(player.position);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayer = playerName;
        }
      }
    }

    return nearestPlayer;
  }

  async goToPlayer(playerUsername, range = 3) {
    const player = this.bot.players[playerUsername]?.entity;
    if (!player) {
      throw new Error(`Player ${playerUsername} not found`);
    }

    const distance = this.bot.entity.position.distanceTo(player.position);

    if (distance <= range) {
      console.log(`✅ Already close to ${playerUsername}`);
      return true;
    }

    console.log(`🚶 Moving to ${playerUsername}...`);
    return await skills.goToPlayer(this.bot, playerUsername, range);
  }

  calculateBuildPosition(playerPos, playerYaw, schematicSize) {
    const yawRadians = (playerYaw + 90) * (Math.PI / 180);
    const directionX = Math.cos(yawRadians);
    const directionZ = Math.sin(yawRadians);

    const maxDimension = Math.max(schematicSize?.x || 10, schematicSize?.z || 10);
    const buildDistance = Math.max(5, Math.ceil(maxDimension / 2) + 2);

    return {
      x: Math.floor(playerPos.x + (directionX * buildDistance)),
      y: Math.floor(playerPos.y),
      z: Math.floor(playerPos.z + (directionZ * buildDistance))
    };
  }
}

/**
 * BlockOrientationHandler - Handles bot rotation for oriented blocks
 */
export class BlockOrientationHandler {
  constructor(bot) {
    this.bot = bot;

    // Blocks that require specific orientation when placing
    this.orientedBlocks = [
      'stairs', 'chest', 'furnace', 'blast_furnace', 'smoker',
      'door', 'bed', 'piston', 'sticky_piston', 'dispenser',
      'dropper', 'observer', 'hopper', 'barrel', 'lectern',
      'loom', 'stonecutter', 'grindstone', 'sign', 'banner',
      'anvil', 'bell', 'campfire', 'soul_campfire', 'ladder',
      'wall_sign', 'wall_banner', 'wall_torch', 'wall_head'
    ];
  }

  /**
   * Check if a block needs orientation
   */
  needsOrientation(blockName) {
    return this.orientedBlocks.some(type => blockName.includes(type));
  }

  /**
   * Rotate bot to match the block's facing direction
   * Uses Mineflayer API: bot.look(yaw, pitch, force)
   */
  async rotateToFacing(facing) {
    if (!facing) return;

    const targetYaw = this.facingToYaw(facing);
    const currentPitch = this.bot.entity.pitch;

    console.log(`🔄 Rotating bot: facing=${facing}, yaw=${(targetYaw * 180 / Math.PI).toFixed(1)}°`);

    try {
      // Use Mineflayer API: bot.look(yaw, pitch, force)
      await this.bot.look(targetYaw, currentPitch, true);

      // Wait for rotation to complete
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log(`⚠️ Rotation failed: ${error.message}`);
    }
  }

  /**
   * Convert Minecraft facing direction to bot yaw (radians)
   * Minecraft coordinates: North = -Z, South = +Z, East = +X, West = -X
   */
  facingToYaw(facing) {
    const facingMap = {
      'north': Math.PI,           // 180° - Looking towards -Z
      'south': 0,                 // 0°   - Looking towards +Z
      'east': -Math.PI / 2,       // -90° - Looking towards +X (270°)
      'west': Math.PI / 2,        // 90°  - Looking towards -X
    };

    return facingMap[facing.toLowerCase()] || 0;
  }

  /**
   * Get the facing direction that the bot needs to look for proper placement
   * Some blocks (like chests, beds) have special placement mechanics
   */
  getPlacementFacing(blockName, schematicFacing) {
    // For most blocks, use the schematic facing directly
    if (!schematicFacing) return null;

    // Beds place opposite to where the player is looking
    if (blockName.includes('bed')) {
      const opposites = {
        'north': 'south',
        'south': 'north',
        'east': 'west',
        'west': 'east'
      };
      return opposites[schematicFacing] || schematicFacing;
    }

    // For other blocks, use schematic facing
    return schematicFacing;
  }

  /**
   * Calculate where the bot should stand to place a block with given facing
   * @param {Vec3} blockPosition - Position where the block will be placed
   * @param {string} facing - Direction the block should face (north, south, east, west)
   * @returns {Vec3} Position where bot should stand
   */
  calculateStandingPosition(blockPosition, facing) {
    if (!facing) return null;

    // Bot should stand OPPOSITE to the facing direction
    // If block faces north, bot should be south of it (looking north)
    const offsetMap = {
      'north': { x: 0, z: 1 },   // Bot stands south (+Z), looks north
      'south': { x: 0, z: -1 },  // Bot stands north (-Z), looks south
      'east': { x: -1, z: 0 },   // Bot stands west (-X), looks east
      'west': { x: 1, z: 0 }     // Bot stands east (+X), looks west
    };

    const offset = offsetMap[facing.toLowerCase()];
    if (!offset) return null;

    return new Vec3(
      blockPosition.x + offset.x,
      blockPosition.y,  // Same Y level as block
      blockPosition.z + offset.z
    );
  }

  /**
   * Move bot to optimal position AND rotate to face correct direction
   * This ensures the bot is physically positioned correctly, not just looking right
   * @param {Vec3} blockPosition - Position where block will be placed
   * @param {string} facing - Direction the block should face
   * @returns {Promise<boolean>} True if successfully positioned
   */
  async moveAndRotateForPlacement(blockPosition, facing) {
    if (!facing) return true;

    const standingPos = this.calculateStandingPosition(blockPosition, facing);
    if (!standingPos) return true;

    // Check if bot is already close enough
    const currentDistance = this.bot.entity.position.distanceTo(standingPos);
    if (currentDistance < 1.5) {
      console.log(`✓ Bot already in position (${currentDistance.toFixed(1)}m away)`);
      await this.rotateToFacing(facing);
      return true;
    }

    console.log(`🚶 Moving to placement position: ${standingPos.toString()} (facing: ${facing})`);

    try {
      // Use skills.goToPosition to move to the calculated position
      const moved = await skills.goToPosition(
        this.bot,
        standingPos.x,
        standingPos.y,
        standingPos.z,
        1  // min_distance = 1 block
      );

      if (moved) {
        console.log(`✓ Reached placement position`);
        // Now rotate to face the correct direction
        await this.rotateToFacing(facing);
        return true;
      } else {
        console.log(`⚠️ Could not reach exact position, trying placement anyway`);
        // Still try to rotate even if movement failed
        await this.rotateToFacing(facing);
        return false;
      }
    } catch (error) {
      console.log(`⚠️ Movement failed: ${error.message}, attempting placement anyway`);
      await this.rotateToFacing(facing);
      return false;
    }
  }
}

/**
 * MaterialClassifier - Klassifiziert Materialien nach Verfügbarkeit
 */
export class MaterialClassifier {
  constructor() {
    // Materials that can be mined/collected directly from the world
    this.baseMaterials = new Set([
      'stone', 'cobblestone', 'granite', 'diorite', 'andesite',
      'dirt', 'grass_block', 'sand', 'gravel', 'clay',
      'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
      'oak_leaves', 'spruce_leaves', 'birch_leaves',
      'iron_ore', 'coal_ore', 'gold_ore', 'diamond_ore', 'emerald_ore',
      'redstone_ore', 'lapis_ore', 'copper_ore',
      'iron_ingot', 'gold_ingot', 'diamond', 'emerald', 'coal', 'redstone', 'lapis_lazuli',
      'glass', 'obsidian', 'netherrack', 'soul_sand', 'glowstone',
      'wool', 'white_wool', 'red_wool', 'blue_wool', // Can be obtained from sheep
      'leather', 'feather', 'bone', // Mob drops (but collectible)
    ]);

    // Materials that require crafting but are easy (no special tools needed)
    this.simpleCrafts = new Set([
      'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks',
      'stick', 'torch', 'crafting_table',
      'chest', 'barrel', 'ladder',
      'wooden_pickaxe', 'wooden_axe', 'wooden_shovel',
      'stone_pickaxe', 'stone_axe', 'stone_shovel',
    ]);

    // Materials that are difficult to obtain automatically (mob drops, rare items)
    this.difficultMaterials = new Set([
      'string', 'slime_ball', 'ender_pearl', 'blaze_rod', 'ghast_tear',
      'gunpowder', 'spider_eye', 'rotten_flesh',
      'dragon_egg', 'elytra', 'shulker_shell',
      'nether_star', 'heart_of_the_sea',
    ]);
  }

  /**
   * Classify a material into a category
   * @returns {'base'|'simple_craft'|'complex_craft'|'difficult'}
   */
  classify(materialName) {
    if (this.baseMaterials.has(materialName)) {
      return 'base';
    }
    if (this.simpleCrafts.has(materialName)) {
      return 'simple_craft';
    }
    if (this.difficultMaterials.has(materialName)) {
      return 'difficult';
    }
    return 'complex_craft'; // Default: needs crafting
  }

  /**
   * Check if material should use smartCollect instead of basic collect
   */
  shouldUseSmartCollect(materialName) {
    const category = this.classify(materialName);
    return category === 'base' || category === 'simple_craft';
  }

  /**
   * Check if material is likely a mob drop or rare item
   */
  isDifficult(materialName) {
    return this.classify(materialName) === 'difficult';
  }
}
