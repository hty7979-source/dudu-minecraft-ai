import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import * as skills from '../../agent/library/skills.js';
import settings from '../../../settings.js';

/**
 * BlockPlacer - Verantwortlich für das Platzieren einzelner Blöcke
 */
export class BlockPlacer {
  constructor(bot, orientationHandler) {
    this.bot = bot;
    this.orientationHandler = orientationHandler;
    this.specialBlocks = this.initializeSpecialBlocks();
    this.maxPlacementDistance = 4.5; // Maximum reach distance for block placement
  }

  initializeSpecialBlocks() {
    return new Map([
      ['bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['door', { type: 'door', parts: 2, needsSupport: true }],
      ['chest', { type: 'chest', parts: 1, needsSupport: false }],
      ['furnace', { type: 'furnace', parts: 1, needsSupport: false }],
      ['stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['fence', { type: 'fence', parts: 1, needsSupport: false }],
      ['wall', { type: 'wall', parts: 1, needsSupport: false }],
    ]);
  }

  /**
   * Place a block with orientation support
   * @param {string} blockName - Block name (without properties)
   * @param {Object} position - World position {x, y, z}
   * @param {Object} properties - Block properties from schematic (e.g., {facing: 'north', half: 'bottom'})
   */
  async placeBlock(blockName, position, properties = {}) {
    const pos = new Vec3(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
    const baseBlockName = blockName.split('[')[0];

    // Prüfe ob Block bereits korrekt platziert ist
    if (this.isBlockAlreadyPlaced(pos, baseBlockName)) {
      console.log(`✅ Block ${blockName} already placed`);
      return true;
    }

    // Handle block orientation BEFORE placement (both Creative and Survival)
    // Move bot to correct position AND rotate to face the right direction
    if (properties.facing && this.orientationHandler.needsOrientation(baseBlockName)) {
      const placementFacing = this.orientationHandler.getPlacementFacing(baseBlockName, properties.facing);
      await this.orientationHandler.moveAndRotateForPlacement(pos, placementFacing);
    }

    // Creative Mode: Verwende /setblock (server command) with properties
    if (this.bot.game.gameMode === 'creative') {
      return await this.placeBlockCreative(baseBlockName, pos, properties);
    }

    // Survival Mode: Optimierte Platzierung mit Line-of-Sight
    try {
      // Versuche erstmal direkt zu platzieren ohne Line-of-Sight Check
      const result = await skills.placeBlock(this.bot, baseBlockName, pos.x, pos.y, pos.z, 'bottom', false);

      if (result) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.isBlockAlreadyPlaced(pos, baseBlockName);
      }

      // Nur bei Fehlschlag Line-of-Sight prüfen und bewegen
      if (!this.hasLineOfSight(pos)) {
        console.log(`👁️ No line of sight, attempting repositioning...`);
        const moved = await this.moveToPlacementPosition(pos);

        // Zweiter Versuch nach Bewegung
        if (moved) {
          const retryResult = await skills.placeBlock(this.bot, baseBlockName, pos.x, pos.y, pos.z, 'bottom', false);
          if (retryResult) {
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.isBlockAlreadyPlaced(pos, baseBlockName);
          }
        }
      }

      return false; // Fehlschlag

    } catch (error) {
      console.log(`⚠️ PlaceBlock error for ${baseBlockName}: ${error.message}`);
      // Nicht als kompletten Fehler zählen, nur als Warning
      return false;
    }
  }

  isBlockAlreadyPlaced(pos, blockName) {
    const existingBlock = this.bot.blockAt(pos);
    return existingBlock && existingBlock.name === blockName;
  }

  async placeBlockCreative(blockName, pos, properties = {}) {
    try {
      // Build block state string with properties
      const stateString = this.buildStateString(blockName, properties);
      const cmd = `/setblock ${pos.x} ${pos.y} ${pos.z} minecraft:${stateString}`;

      console.log(`🎨 Creative: ${cmd}`);
      this.bot.chat(cmd);

      // Wait for server to process command and update chunks
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mehrfache Verification für Creative Mode (server-side delays)
      for (let i = 0; i < 3; i++) {
        const checkBlock = this.bot.blockAt(pos);
        if (checkBlock && checkBlock.name === blockName) {
          return true;
        }
        // Wait a bit longer on subsequent checks
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`⚠️ Creative placement verification failed for ${blockName}`);
      return false;

    } catch (error) {
      console.log(`❌ Creative placement error: ${error.message}`);
      return false;
    }
  }

  /**
   * Build block state string with properties for /setblock command
   * Example: "oak_stairs[facing=north,half=bottom]"
   */
  buildStateString(blockName, properties) {
    if (!properties || Object.keys(properties).length === 0) {
      return blockName;
    }

    const propsStr = Object.entries(properties)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    return `${blockName}[${propsStr}]`;
  }

  getSpecialBlockInfo(blockName) {
    const baseName = blockName.split('[')[0];
    for (const [key, info] of this.specialBlocks.entries()) {
      if (baseName.includes(key)) {
        return info;
      }
    }
    return null;
  }

  /**
   * Check if bot has line of sight to target position
   * @param {Vec3} targetPos - Target block position
   * @returns {boolean} True if clear line of sight exists
   */
  hasLineOfSight(targetPos) {
    const start = this.bot.entity.position.offset(0, this.bot.entity.height * 0.5, 0); // Eye level
    const end = new Vec3(targetPos.x + 0.5, targetPos.y + 0.5, targetPos.z + 0.5); // Center of target block

    // Check distance first
    const distance = start.distanceTo(end);
    if (distance > this.maxPlacementDistance) {
      return false;
    }

    // Raycast from bot to target
    const direction = end.minus(start).normalize();
    const raycastResult = this.bot.world.raycast(start, direction, distance);

    // If raycast hits something before target, no line of sight
    if (raycastResult) {
      const hitPos = raycastResult.position;
      // Check if we hit the target block (allow small margin for floating point errors)
      if (hitPos.distanceTo(targetPos) < 0.5) {
        return true; // Hit the target block itself
      }
      return false; // Hit something else
    }

    return true; // Nothing blocking
  }

  /**
   * Find best position for bot to place a block
   * @param {Vec3} targetPos - Target block position
   * @returns {Vec3|null} Best position to place from, or null if none found
   */
  findBestPlacementPosition(targetPos) {
    const positions = [];

    // Try 8 cardinal and diagonal directions around the target
    const directions = [
      { x: 0, z: 2 },   // North
      { x: 0, z: -2 },  // South
      { x: 2, z: 0 },   // East
      { x: -2, z: 0 },  // West
      { x: 2, z: 2 },   // NE
      { x: -2, z: 2 },  // NW
      { x: 2, z: -2 },  // SE
      { x: -2, z: -2 }  // SW
    ];

    for (const dir of directions) {
      // Try different distances (2-4 blocks away)
      for (let dist = 2; dist <= 4; dist++) {
        const testPos = new Vec3(
          Math.floor(targetPos.x + dir.x * (dist / 2)),
          Math.floor(targetPos.y), // Same Y level first
          Math.floor(targetPos.z + dir.z * (dist / 2))
        );

        // Check if position is valid (not inside blocks, not too far, etc.)
        const blockAtPos = this.bot.blockAt(testPos);
        const blockAbove = this.bot.blockAt(testPos.offset(0, 1, 0));

        if (blockAtPos && blockAbove &&
            blockAtPos.name === 'air' &&
            blockAbove.name === 'air') {

          // Check if we can reach target from this position
          const distance = testPos.distanceTo(targetPos);
          if (distance <= this.maxPlacementDistance) {
            positions.push({
              pos: testPos,
              distance: distance,
              priority: dist // Prefer closer positions
            });
          }
        }
      }
    }

    // Sort by priority (distance from target)
    positions.sort((a, b) => a.priority - b.priority);

    // Return best position or null
    return positions.length > 0 ? positions[0].pos : null;
  }

  /**
   * Move bot to a better position for placing a block
   * @param {Vec3} targetPos - Target block position
   * @returns {Promise<boolean>} True if successfully moved to good position
   */
  async moveToPlacementPosition(targetPos) {
    const bestPos = this.findBestPlacementPosition(targetPos);

    if (!bestPos) {
      console.log(`⚠️ Could not find placement position for ${targetPos}`);
      return false;
    }

    const currentDistance = this.bot.entity.position.distanceTo(bestPos);

    // If already close enough, don't move
    if (currentDistance < 1.5) {
      return true;
    }

    console.log(`🚶 Moving to placement position: ${bestPos.x}, ${bestPos.y}, ${bestPos.z}`);

    try {
      const goal = new pathfinder.goals.GoalNear(bestPos.x, bestPos.y, bestPos.z, 1);
      await this.bot.pathfinder.goto(goal);

      // Wait for bot to stabilize
      await new Promise(resolve => setTimeout(resolve, 300));

      return true;
    } catch (error) {
      console.log(`⚠️ Could not move to placement position: ${error.message}`);
      return false;
    }
  }
}

/**
 * BuildExecutor - Führt den eigentlichen Build-Prozess aus
 */
export class BuildExecutor {
  constructor(bot, blockPlacer) {
    this.bot = bot;
    this.blockPlacer = blockPlacer;
    this.currentBuild = null;
    this.isBuilding = false;
  }

  async executeBuild(schematicInfo, schematicData, buildPosition) {
    this.isBuilding = true;
    this.currentBuild = {
      name: schematicInfo.name,
      position: buildPosition,
      startTime: Date.now(),
      blocksPlaced: 0,
      totalBlocks: 0
    };

    try {
      const blocksByLayer = this.organizeBlocksByLayer(schematicData, buildPosition);
      const sortedLayers = Array.from(blocksByLayer.keys()).sort((a, b) => a - b);

      this.currentBuild.totalBlocks = Array.from(blocksByLayer.values())
        .reduce((sum, layer) => sum + layer.length, 0);

      console.log(`🗂️ Building ${this.currentBuild.totalBlocks} blocks in ${sortedLayers.length} layers`);

      let blocksPlaced = 0;
      let errors = 0;
      const initialBlocksPlaced = this.currentBuild.blocksPlaced;

      for (const layerY of sortedLayers) {
        const layerBlocks = blocksByLayer.get(layerY);
        console.log(`🏗️ Building Layer Y=${layerY} (${layerBlocks.length} blocks)`);

        for (const blockInfo of layerBlocks) {
          // Pass properties to blockPlacer
          const success = await this.blockPlacer.placeBlock(
            blockInfo.block,
            blockInfo.pos,
            blockInfo.properties || {}
          );

          if (success) {
            blocksPlaced++;
          } else {
            errors++;
          }

          this.currentBuild.blocksPlaced = blocksPlaced;

          await new Promise(resolve => setTimeout(resolve, settings.block_place_delay || 800));

          // Enhanced error handling with recovery
          if (errors > 50) {
            console.log(`⚠️ Many errors (${errors}), attempting recovery...`);

            // Kurze Pause für Bot-Stabilisierung
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Reset error counter nach erfolgreichen Platzierungen
            if (blocksPlaced > initialBlocksPlaced + 5) {
              errors = Math.floor(errors / 2); // Halbiere Fehler nach Fortschritt
              console.log(`✅ Progress detected, reducing error count to ${errors}`);
            }

            // Nur pausieren, nicht abbrechen
            if (errors > 75) {
              this.bot.chat('⏸️ Pausiere für Fehlerkorrektur. Build kann später fortgesetzt werden.');
              return { success: false, reason: 'Error recovery needed', canResume: true, blocksPlaced, errors };
            }
          }
        }

        if (layerY < sortedLayers[sortedLayers.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const duration = ((Date.now() - this.currentBuild.startTime) / 1000).toFixed(1);
      const successRate = Math.round((blocksPlaced / (blocksPlaced + errors)) * 100);

      this.bot.chat(`✅ Build complete! ${blocksPlaced} blocks in ${duration}s (${successRate}%)`);

      return { blocksPlaced, errors, duration };

    } finally {
      this.isBuilding = false;
      this.currentBuild = null;
    }
  }

  organizeBlocksByLayer(schematicData, buildPos) {
    const blocksByLayer = new Map();

    schematicData.forEach((pos, block) => {
      if (block?.name && block.name !== 'minecraft:air' && block.name !== 'air') {
        const blockName = this.normalizeBlockName(block.name);
        const worldPos = {
          x: buildPos.x + pos.x,
          y: buildPos.y + pos.y,
          z: buildPos.z + pos.z
        };

        const layer = worldPos.y;
        if (!blocksByLayer.has(layer)) {
          blocksByLayer.set(layer, []);
        }

        // Include properties from schematic
        blocksByLayer.get(layer).push({
          pos: worldPos,
          block: blockName,
          properties: block.properties || {},
          schematicPos: pos
        });
      }
    });

    return blocksByLayer;
  }

  normalizeBlockName(blockName) {
    const cleanName = blockName.replace('minecraft:', '');
    const baseName = cleanName.split('[')[0];

    const problemBlocks = {
      'wall_torch': 'torch'
    };

    return problemBlocks[baseName] || baseName;
  }

  getStatus() {
    if (!this.isBuilding) {
      return 'No build in progress.';
    }

    const elapsed = ((Date.now() - this.currentBuild.startTime) / 1000).toFixed(1);
    const progress = `${this.currentBuild.blocksPlaced}/${this.currentBuild.totalBlocks}`;
    const percent = Math.round((this.currentBuild.blocksPlaced / this.currentBuild.totalBlocks) * 100);

    return `🗂️ Building ${this.currentBuild.name}: ${progress} (${percent}%) - ${elapsed}s`;
  }

  cancel() {
    if (!this.isBuilding) {
      return 'No build in progress to cancel.';
    }

    const buildName = this.currentBuild?.name || 'Unknown';
    this.isBuilding = false;
    this.currentBuild = null;

    return `Cancelled build: ${buildName}`;
  }
}
