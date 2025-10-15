import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import prismarineSchematic from 'prismarine-schematic';
import nbt from 'prismarine-nbt';
import { fileURLToPath } from 'url';
import * as skills from './library/skills.js';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import settings from '../../settings.js';
import * as mcdata from '../utils/mcdata.js';

const { goals } = pathfinder;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// SCHEMATIC LOADER - Verantwortlich für das Laden und Parsen von Schematics
// ============================================================================
class SchematicLoader {
  constructor(schematicsPath) {
    this.schematicsPath = schematicsPath;
  }

  async loadSchematic(filePath) {
    console.log(`📖 Loading schematic: ${filePath}`);
    
    let fileBuffer = fs.readFileSync(filePath);
    const isGzipped = fileBuffer.length >= 2 && fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b;
    
    if (isGzipped) {
      fileBuffer = zlib.gunzipSync(fileBuffer);
    }
    
    const Schematic = prismarineSchematic.Schematic;
    
    // Versuche verschiedene Lade-Methoden
    try {
      return await Schematic.read(fileBuffer, 'schem');
    } catch (error) {
      console.log(`⚠️ Standard load failed, trying NBT parse...`);
      return await this.parseWorldEditNBT(fileBuffer);
    }
  }

  async parseWorldEditNBT(buffer) {
    const { parsed } = await nbt.parse(buffer);
    const schematicData = parsed.value.Schematic?.value;
    
    if (!schematicData) {
      throw new Error('Invalid NBT structure');
    }
    
    const width = schematicData.Width?.value || 0;
    const height = schematicData.Height?.value || 0;
    const length = schematicData.Length?.value || 0;
    
    const palette = this.extractPalette(schematicData);
    const blockData = schematicData.Blocks?.value?.Data?.value;
    
    return this.createSchematicObject(width, height, length, palette, blockData);
  }

  extractPalette(schematicData) {
    const palette = {};
    const blocksData = schematicData.Blocks?.value;

    if (blocksData?.Palette?.value) {
      for (const [blockName, blockId] of Object.entries(blocksData.Palette.value)) {
        // Keep full block state string with properties
        palette[blockName] = blockId.value || 0;
      }
    }

    return palette;
  }

  /**
   * Parse block state string to extract name and properties
   * Example: "minecraft:oak_stairs[facing=north,half=bottom]"
   * Returns: { name: "oak_stairs", properties: { facing: "north", half: "bottom" } }
   */
  parseBlockState(blockString) {
    // Remove minecraft: prefix if present
    const cleaned = blockString.replace('minecraft:', '');

    // Match pattern: blockname[prop1=val1,prop2=val2]
    const match = cleaned.match(/^([^\[]+)(?:\[(.+)\])?$/);

    if (!match) {
      return { name: cleaned, properties: {} };
    }

    const name = match[1];
    const properties = {};

    if (match[2]) {
      // Parse properties
      match[2].split(',').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          properties[key.trim()] = value.trim();
        }
      });
    }

    return { name, properties };
  }

  createSchematicObject(width, height, length, palette, blockData) {
    const idToName = {};
    for (const [name, id] of Object.entries(palette)) {
      idToName[id] = name;
    }

    // Store reference to parseBlockState for use in forEach
    const parseBlockState = this.parseBlockState.bind(this);

    return {
      width: length,
      height: height,
      length: width,
      palette: palette,
      blockData: blockData,

      forEach: function(callback) {
        for (let y = 0; y < height; y++) {
          for (let z = 0; z < length; z++) {
            for (let x = 0; x < width; x++) {
              const index = y * width * length + z * width + x;
              const blockId = blockData[index];
              const blockStateString = idToName[blockId] || 'minecraft:air';

              // Parse block state to extract name and properties
              const { name, properties } = parseBlockState(blockStateString);

              callback({ x, y, z }, { name, properties });
            }
          }
        }
      }
    };
  }
}

// ============================================================================
// SCHEMATIC REGISTRY - Verwaltet verfügbare Schematics
// ============================================================================
class SchematicRegistry {
  constructor(schematicsPath) {
    this.schematicsPath = schematicsPath;
    this.schematics = {};
    this.loader = new SchematicLoader(schematicsPath);
  }

  loadAll() {
    console.log('🗂️ Loading schematic registry...');
    const categories = ['houses', 'utility', 'decorative'];
    let loadedCount = 0;
    
    for (const category of categories) {
      const categoryPath = path.join(this.schematicsPath, category);
      if (!fs.existsSync(categoryPath)) continue;
      
      const files = fs.readdirSync(categoryPath)
        .filter(f => f.endsWith('.schem') || f.endsWith('.schematic'));
      
      for (const file of files) {
        const name = file.replace(/\.(schem|schematic)$/, '');
        const fullPath = path.join(categoryPath, file);
        const stats = fs.statSync(fullPath);
        
        this.schematics[name.toLowerCase()] = {
          name: name,
          displayName: name.replace(/_/g, ' '),
          category: category,
          path: fullPath,
          fileSize: stats.size,
          size: null,
          materials: null,
          loaded: false,
          schematicData: null
        };
        loadedCount++;
      }
    }
    
    console.log(`✅ Loaded ${loadedCount} schematics`);
    return loadedCount;
  }

  find(name) {
    const searchName = name.toLowerCase();
    
    if (this.schematics[searchName]) {
      return this.schematics[searchName];
    }
    
    for (const [schematicName, info] of Object.entries(this.schematics)) {
      if (schematicName.includes(searchName) || searchName.includes(schematicName)) {
        return info;
      }
    }
    
    return null;
  }

  list() {
    return Object.keys(this.schematics);
  }

  listByCategory() {
    const byCategory = {};
    for (const [name, info] of Object.entries(this.schematics)) {
      if (!byCategory[info.category]) byCategory[info.category] = [];
      byCategory[info.category].push(info);
    }
    return byCategory;
  }

  async loadSchematicData(schematicInfo) {
    if (schematicInfo.loaded && schematicInfo.schematicData) {
      return schematicInfo.schematicData;
    }

    const schematicData = await this.loader.loadSchematic(schematicInfo.path);
    
    schematicInfo.size = {
      x: schematicData.width,
      y: schematicData.height,
      z: schematicData.length
    };
    
    schematicInfo.materials = this.analyzeMaterials(schematicData);
    schematicInfo.schematicData = schematicData;
    schematicInfo.loaded = true;
    
    return schematicData;
  }

  analyzeMaterials(schematicData) {
    const materials = {};
    
    if (typeof schematicData.forEach === 'function') {
      schematicData.forEach((pos, block) => {
        if (block?.name && block.name !== 'minecraft:air' && block.name !== 'air') {
          const baseName = block.name.replace('minecraft:', '').split('[')[0];
          materials[baseName] = (materials[baseName] || 0) + 1;
        }
      });
    }
    
    return materials;
  }
}

// ============================================================================
// PLAYER LOCATOR - Findet und verfolgt Spieler-Positionen
// ============================================================================
class PlayerLocator {
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

// ============================================================================
// BLOCK ORIENTATION HANDLER - Handles bot rotation for oriented blocks
// ============================================================================
class BlockOrientationHandler {
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
}

// ============================================================================
// BLOCK PLACER - Verantwortlich für das Platzieren einzelner Blöcke
// ============================================================================
class BlockPlacer {
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

    // Handle block orientation BEFORE placement
    if (properties.facing && this.orientationHandler.needsOrientation(baseBlockName)) {
      const placementFacing = this.orientationHandler.getPlacementFacing(baseBlockName, properties.facing);
      await this.orientationHandler.rotateToFacing(placementFacing);
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

// ============================================================================
// BUILD EXECUTOR - Führt den eigentlichen Build-Prozess aus
// ============================================================================
class BuildExecutor {
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

// ============================================================================
// MATERIAL CLASSIFIER - Intelligently categorizes materials for gathering
// ============================================================================
class MaterialClassifier {
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

// ============================================================================
// SURVIVAL BUILD COORDINATOR - Manages material gathering and build state
// ============================================================================
class SurvivalBuildCoordinator {
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
      const { SmartCraftingManager } = await import('./library/smart_crafting.js');
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
          this.bot.chat(`⚠️ Überspringe optionales Material: ${material}`);
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
        this.bot.chat(`⏸️ Konnte ${material} nach ${this.gatheringRetries[material]} Versuchen nicht beschaffen.`);
        this.bot.chat(`💬 Kannst du mir helfen ${count}x ${material} zu besorgen?`);
        this.bot.chat(`📝 Ideen: ${this.getSuggestionsForGathering(material)}`);

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
          this.bot.chat(`⏸️ Konnte ${material} nicht automatisch beschaffen.`);
          this.bot.chat(`💬 Kannst du mir helfen ${count}x ${material} zu besorgen?`);
          this.bot.chat(`📝 Ideen: ${this.getSuggestionsForGathering(material)}`);

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
      this.bot.chat('🔨 Crafte Items...');

      for (const [material, count] of Object.entries(stillMissing)) {
        const currentInventory = this.getInventoryCounts();
        const inInventory = currentInventory[material] || 0;

        if (inInventory >= count) {
          continue; // Already have enough
        }

        const needToCraft = count - inInventory;

        this.bot.chat(`🔨 Crafte: ${needToCraft}x ${material}`);

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

      this.bot.chat(`🔄 Fortsetzen ab Schicht ${startLayerIndex + 1}/${sortedLayers.length}`);

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
              this.bot.chat(`⏸️ Build pausiert. Waiting for help with ${procureResult.failed}.`);
              this.bot.chat(`Use !buildresume when materials are ready.`);
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
          this.bot.chat('⚠️ Niedrige Gesundheit! Bau pausiert. Nutze !buildresume zum Fortsetzen.');
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
            this.bot.chat('❌ Zu viele Fehler, Bau pausiert.');
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
      this.bot.chat(`❌ Baufehler: ${error.message}`);

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

      this.bot.chat(`🏗️ Starte Bau: ${sortedLayers.length} Schichten, ${this.buildState.totalBlocks} Blöcke gesamt`);

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
              this.bot.chat(`⏸️ Build paused. Waiting for help with ${procureResult.failed}.`);
              this.bot.chat(`Use !buildresume when materials are ready.`);
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
          this.bot.chat('⚠️ Niedrige Gesundheit! Bau pausiert. Nutze !buildresume zum Fortsetzen.');
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
            this.bot.chat('❌ Zu viele Fehler, Bau pausiert.');
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

      this.bot.chat(`✅ Bau abgeschlossen! ${blocksPlaced} Blöcke in ${duration}s (${successRate}%)`);

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
      this.bot.chat(`❌ Baufehler: ${error.message}`);

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
export class BuildingManager {
  constructor(bot, agent) {
    this.bot = bot;
    this.agent = agent;
    this.autonomousMode = false; // NEU: Autonomer Build-Modus

    const schematicsPath = path.join(__dirname, '..', '..', 'schematics');

    // Initialisiere Komponenten (werden später mit bot gesetzt wenn verfügbar)
    this.registry = new SchematicRegistry(schematicsPath);

    // Only initialize bot-dependent components if bot is available
    if (this.bot) {
      this.initializeComponents();
    }

    // Lade Schematics
    this.registry.loadAll();
    this.logAvailableBuildings();
  }

  initializeComponents() {
    // Initialize all bot-dependent components
    this.playerLocator = new PlayerLocator(this.bot);
    this.orientationHandler = new BlockOrientationHandler(this.bot);
    this.blockPlacer = new BlockPlacer(this.bot, this.orientationHandler);
    this.executor = new BuildExecutor(this.bot, this.blockPlacer);
    this.survivalCoordinator = new SurvivalBuildCoordinator(
      this.bot,
      this.registry,
      this.orientationHandler,
      this.blockPlacer,
      this.agent
    );

    // Setup interrupt handlers
    this.setupInterruptHandlers();

    // Try to load saved build state from previous session
    this.survivalCoordinator.loadBuildState();
  }

  setupInterruptHandlers() {
    // Health-based interruption
    this.bot.on('health', () => {
      if (this.survivalCoordinator.buildState && this.bot.health < 6) {
        console.log('⚠️ Low health detected during build');
        this.survivalCoordinator.pauseBuild('low_health');
      }
    });

    // Death interruption
    this.bot.on('death', () => {
      if (this.survivalCoordinator.buildState) {
        console.log('💀 Death detected, saving build state');
        this.survivalCoordinator.pauseBuild('death');
        this.survivalCoordinator.saveBuildState();
      }
    });

    // Entity hurt (combat)
    this.bot.on('entityHurt', (entity) => {
      if (entity === this.bot.entity && this.survivalCoordinator.buildState) {
        if (this.bot.health < 10) {
          console.log('⚔️ Taking damage during build');
          this.survivalCoordinator.pauseBuild('combat');
        }
      }
    });

    console.log('✅ Build interrupt handlers initialized');
  }

  logAvailableBuildings() {
    const byCategory = this.registry.listByCategory();
    console.log('\n🏘️ Available Buildings:');
    
    for (const [category, schematics] of Object.entries(byCategory)) {
      if (schematics.length > 0) {
        console.log(`📂 ${category} (${schematics.length}):`);
        for (const schematic of schematics) {
          console.log(`  - ${schematic.displayName}`);
        }
      }
    }
    console.log('');
  }

  // Public API
  listSchematics() {
    return this.registry.list();
  }

  listSchematicsByCategory() {
    return this.registry.listByCategory();
  }

  findSchematic(name) {
    return this.registry.find(name);
  }

  async buildStructure(schematicName, position = null) {
    if (this.executor.isBuilding) {
      return 'Already building. Use !buildcancel to stop.';
    }
    
    const schematicInfo = this.findSchematic(schematicName);
    if (!schematicInfo) {
      return `Unknown structure "${schematicName}". Use !buildlist to see available.`;
    }
    
    // Finde Spieler und bewege dich zu ihm
    const playerUsername = await this.playerLocator.findNearest();
    if (!playerUsername) {
      return '❌ No player found nearby';
    }
    
    const player = this.bot.players[playerUsername].entity;
    const distanceToPlayer = this.bot.entity.position.distanceTo(player.position);
    
    if (distanceToPlayer > 4.0) {
      this.bot.chat(`🤖 Moving to ${playerUsername}...`);
      const success = await this.playerLocator.goToPlayer(playerUsername, 3);
      if (!success) {
        return `❌ Could not reach player ${playerUsername}`;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Berechne Build-Position
    if (!position) {
      if (!schematicInfo.size) {
        await this.registry.loadSchematicData(schematicInfo);
      }
      position = this.playerLocator.calculateBuildPosition(
        player.position, 
        player.yaw, 
        schematicInfo.size
      );
    }
    
    this.bot.chat(`🗂️ Building ${schematicName} at ${position.x}, ${position.y}, ${position.z}`);
    
    // Lade Schematic-Daten
    const schematicData = await this.registry.loadSchematicData(schematicInfo);
    
    // Führe Build aus
    const result = await this.executor.executeBuild(schematicInfo, schematicData, position);
    return `✅ Built ${schematicInfo.displayName}! ${result.blocksPlaced} blocks in ${result.duration}s`;
  }

  getBuildStatus() {
    return this.executor.getStatus();
  }

  cancelBuild() {
    // Cancel executor build if running
    const executorResult = this.executor.cancel();

    // Also cancel and delete survival coordinator build state if exists
    if (this.survivalCoordinator.buildState) {
      const buildName = this.survivalCoordinator.buildState.schematicName;
      this.survivalCoordinator.deleteBuildState();
      this.bot.chat(`❌ Survival build cancelled: ${buildName}`);
      return `Cancelled builds: ${executorResult} and survival build ${buildName}`;
    }

    return executorResult;
  }

  getSchematicInfo(name) {
    const schematicInfo = this.findSchematic(name);
    if (!schematicInfo) {
      return `Schematic "${name}" not found.`;
    }

    let info = `📋 ${schematicInfo.displayName}\n`;
    info += `Category: ${schematicInfo.category}\n`;
    info += `File size: ${(schematicInfo.fileSize / 1024).toFixed(1)} KB\n`;

    if (schematicInfo.size) {
      info += `Dimensions: ${schematicInfo.size.x}x${schematicInfo.size.y}x${schematicInfo.size.z}\n`;
    }

    if (schematicInfo.materials) {
      const topMaterials = Object.entries(schematicInfo.materials)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([item, count]) => `${count}x ${item}`)
        .join(', ');
      info += `Materials: ${topMaterials}`;
    }

    return info;
  }

  // ============================================================================
  // SURVIVAL MODE BUILD METHODS
  // ============================================================================

  /**
   * Build with automatic material management (Survival Mode)
   */
  async buildWithSurvivalMode(schematicName, position = null) {
    if (this.survivalCoordinator.buildState) {
      return 'Build already in progress. Use !buildresume or !buildcancel.';
    }

    const schematicInfo = this.findSchematic(schematicName);
    if (!schematicInfo) {
      return `Unknown structure "${schematicName}". Use !buildlist to see available.`;
    }

    // Find player and move to them
    const playerUsername = await this.playerLocator.findNearest();
    if (!playerUsername) {
      return '❌ No player found nearby';
    }

    const player = this.bot.players[playerUsername].entity;
    const distanceToPlayer = this.bot.entity.position.distanceTo(player.position);

    if (distanceToPlayer > 4.0) {
      this.bot.chat(`🤖 Moving to ${playerUsername}...`);
      const success = await this.playerLocator.goToPlayer(playerUsername, 3);
      if (!success) {
        return `❌ Could not reach player ${playerUsername}`;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate build position
    if (!position) {
      if (!schematicInfo.size) {
        await this.registry.loadSchematicData(schematicInfo);
      }
      position = this.playerLocator.calculateBuildPosition(
        player.position,
        player.yaw,
        schematicInfo.size
      );
    }

    this.bot.chat(`🏗️ Starte Survival-Bau: ${schematicName}`);

    // Load schematic data
    const schematicData = await this.registry.loadSchematicData(schematicInfo);

    // Execute build with survival mode
    const result = await this.survivalCoordinator.buildWithSurvivalMode(
      schematicInfo,
      schematicData,
      position
    );

    if (result.success) {
      return `✅ ${schematicInfo.displayName} gebaut! ${result.blocksPlaced} Blöcke in ${result.duration}s`;
    } else {
      return `❌ Bau fehlgeschlagen: ${result.reason}`;
    }
  }

  /**
   * Build autonomously without LLM interference
   * @param {string} schematicName - Name of the schematic to build
   * @param {Object} position - Optional build position
   */
  async buildAutonomous(schematicName, position = null) {
    this.autonomousMode = true;

    // Informiere LLM, dass autonomer Modus aktiv ist
    if (this.agent && this.agent.history) {
      await this.agent.history.add('system',
        `AUTONOMOUS BUILD MODE ACTIVE: Building ${schematicName}. ` +
        `Bot will handle everything automatically. ` +
        `DO NOT send build commands. Only provide status updates when asked. ` +
        `The build will complete or pause automatically.`
      );
    }

    try {
      // Verwende buildWithSurvivalMode für autonomes Bauen
      const result = await this.buildWithSurvivalMode(schematicName, position);

      // Nur finale Statusmeldung an LLM
      if (this.agent && this.agent.history) {
        await this.agent.history.add('system',
          `BUILD COMPLETED: ${result}`
        );
      }

      return result;
    } catch (error) {
      console.error('❌ Autonomous build error:', error);

      if (this.agent && this.agent.history) {
        await this.agent.history.add('system',
          `BUILD ERROR: ${error.message}. Build may be paused and can be resumed.`
        );
      }

      throw error;
    } finally {
      this.autonomousMode = false;
    }
  }

  /**
   * Preview materials required for a build
   */
  async previewMaterials(schematicName) {
    const schematicInfo = this.findSchematic(schematicName);
    if (!schematicInfo) {
      return `Schematic "${schematicName}" not found.`;
    }

    this.bot.chat('📊 Analysiere Materialien...');

    // Load schematic data
    const schematicData = await this.registry.loadSchematicData(schematicInfo);

    // Analyze materials
    const analysis = await this.survivalCoordinator.analyzeMaterials(schematicData);

    // Build message
    let message = `📋 Materialien für ${schematicInfo.displayName}:\n\n`;

    message += '📦 Benötigt:\n';
    for (const [item, count] of Object.entries(analysis.required)) {
      const available = analysis.available[item] || 0;
      const inChests = analysis.inChests[item] || 0;
      const missing = analysis.missing[item] || 0;

      const status = missing > 0 ? '❌' : '✅';
      message += `${status} ${count}x ${item} (Inventar: ${available}, Truhen: ${inChests}`;

      if (missing > 0) {
        message += `, Fehlt: ${missing}`;
      }

      message += ')\n';
    }

    if (Object.keys(analysis.missing).length === 0) {
      message += '\n✅ Alle Materialien vorhanden!';
    } else {
      message += '\n❌ Fehlende Materialien müssen beschafft werden.';
    }

    this.bot.chat(message);
    return message;
  }

  /**
   * Resume interrupted build
   */
  async resumeBuild() {
    // Try to load build state if not already in memory
    if (!this.survivalCoordinator.buildState) {
      this.survivalCoordinator.loadBuildState();
    }

    if (!this.survivalCoordinator.buildState) {
      const msg = '❌ Kein gespeicherter Build-State gefunden. Nutze !build um neu zu starten.';
      this.bot.chat(msg);
      return msg;
    }

    const state = this.survivalCoordinator.buildState;

    if (state.status !== 'paused') {
      const msg = `❌ Build ist nicht pausiert (Status: ${state.status}).`;
      this.bot.chat(msg);
      return msg;
    }

    const progress = `${state.placedBlocks.size}/${state.totalBlocks}`;
    const percent = Math.round((state.placedBlocks.size / state.totalBlocks) * 100);

    this.bot.chat(`▶️ Setze Bau fort: ${state.schematicName}`);
    this.bot.chat(`📊 Fortschritt: ${progress} Blöcke (${percent}%) | Layer ${state.currentLayer}`);

    if (state.pauseReason) {
      this.bot.chat(`💡 Pausiert wegen: ${state.pauseReason}`);
    }

    // Resume build state (sets status back to 'building')
    this.survivalCoordinator.resumeBuild();

    // Load schematic data
    const schematicInfo = this.registry.find(state.schematicName);
    if (!schematicInfo) {
      const msg = `❌ Schematic "${state.schematicName}" nicht mehr gefunden!`;
      this.bot.chat(msg);
      return msg;
    }

    const schematicData = await this.registry.loadSchematicData(schematicInfo);

    // Continue building from saved state (placedBlocks Set prevents re-placement)
    const result = await this.survivalCoordinator._continueBuildFromState(
      schematicInfo,
      schematicData
    );

    if (result.success) {
      const msg = `✅ Bau abgeschlossen! ${result.blocksPlaced} Blöcke in ${result.duration}s (${result.successRate}%)`;
      this.bot.chat(msg);
      return msg;
    } else if (result.canResume) {
      const msg = `⏸️ Bau erneut pausiert: ${result.reason}. Nutze !buildresume zum Fortsetzen.`;
      this.bot.chat(msg);
      return msg;
    } else {
      const msg = `❌ Bau fehlgeschlagen: ${result.reason}`;
      this.bot.chat(msg);
      return msg;
    }
  }

  /**
   * Get current build state
   */
  getBuildStateInfo() {
    const state = this.survivalCoordinator.buildState;

    if (!state) {
      const msg = '❌ Kein aktiver Build-State. Nutze !build um einen Build zu starten.';
      this.bot.chat(msg);
      return msg;
    }

    const progress = `${state.placedBlocks.size}/${state.totalBlocks}`;
    const percent = Math.round((state.placedBlocks.size / state.totalBlocks) * 100);
    const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);

    // Status emoji
    const statusEmoji = {
      'building': '🏗️',
      'paused': '⏸️',
      'completed': '✅',
      'error': '❌'
    }[state.status] || '❓';

    let message = `${statusEmoji} Build State:\n`;
    message += `📦 Schematic: ${state.schematicName}\n`;
    message += `📊 Status: ${state.status.toUpperCase()}\n`;
    message += `📈 Progress: ${progress} Blöcke (${percent}%)\n`;
    message += `🗂️ Current Layer: ${state.currentLayer}\n`;
    message += `⏱️ Elapsed Time: ${elapsed}s\n`;

    if (state.pauseReason) {
      const reasonEmoji = {
        'waiting_for_help': '🆘',
        'low_health': '❤️',
        'material_gathering_failed': '📦',
        'too_many_errors': '⚠️',
        'combat': '⚔️',
        'death': '💀',
        'error': '❌'
      }[state.pauseReason] || '⏸️';

      message += `${reasonEmoji} Pause Reason: ${state.pauseReason}\n`;
    }

    if (state.status === 'paused') {
      message += `\n💡 Use !buildresume to continue building`;
    }

    this.bot.chat(message);
    return message;
  }
}