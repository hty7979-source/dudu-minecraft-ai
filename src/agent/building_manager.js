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
        palette[blockName] = blockId.value || 0;
      }
    }
    
    return palette;
  }

  createSchematicObject(width, height, length, palette, blockData) {
    const idToName = {};
    for (const [name, id] of Object.entries(palette)) {
      idToName[id] = name;
    }

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
              const blockName = idToName[blockId] || 'minecraft:air';
              
              callback({ x, y, z }, { name: blockName, properties: {} });
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
// BLOCK PLACER - Verantwortlich für das Platzieren einzelner Blöcke
// ============================================================================
class BlockPlacer {
  constructor(bot) {
    this.bot = bot;
    this.specialBlocks = this.initializeSpecialBlocks();
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

  async placeBlock(blockName, position) {
    const pos = new Vec3(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
    const baseBlockName = blockName.split('[')[0];
    
    // Prüfe ob Block bereits korrekt platziert ist
    if (this.isBlockAlreadyPlaced(pos, baseBlockName)) {
      console.log(`✅ Block ${blockName} already placed`);
      return true;
    }
    
    // Creative Mode: Verwende /setblock
    if (this.bot.game.gameMode === 'creative') {
      return await this.placeBlockCreative(baseBlockName, pos);
    }
    
    // Survival Mode: Verwende Skills API
    return await skills.placeBlock(this.bot, baseBlockName, pos.x, pos.y, pos.z, 'bottom', false);
  }

  isBlockAlreadyPlaced(pos, blockName) {
    const existingBlock = this.bot.blockAt(pos);
    return existingBlock && existingBlock.name === blockName;
  }

  async placeBlockCreative(blockName, pos) {
    try {
      const cmd = `/setblock ${pos.x} ${pos.y} ${pos.z} minecraft:${blockName}`;
      this.bot.chat(cmd);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const checkBlock = this.bot.blockAt(pos);
      return checkBlock && checkBlock.name === blockName;
    } catch (error) {
      console.log(`❌ Creative placement failed: ${error.message}`);
      return false;
    }
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
      
      this.bot.chat(`🗂️ Building ${this.currentBuild.totalBlocks} blocks in ${sortedLayers.length} layers`);
      
      let blocksPlaced = 0;
      let errors = 0;
      
      for (const layerY of sortedLayers) {
        const layerBlocks = blocksByLayer.get(layerY);
        console.log(`🏗️ Building Layer Y=${layerY} (${layerBlocks.length} blocks)`);
        
        for (const blockInfo of layerBlocks) {
          const success = await this.blockPlacer.placeBlock(blockInfo.block, blockInfo.pos);
          
          if (success) {
            blocksPlaced++;
          } else {
            errors++;
          }
          
          this.currentBuild.blocksPlaced = blocksPlaced;
          
          await new Promise(resolve => setTimeout(resolve, settings.block_place_delay || 800));
          
          if (errors > 30) {
            this.bot.chat('❌ Too many errors, stopping build');
            break;
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
        
        blocksByLayer.get(layer).push({
          pos: worldPos,
          block: blockName,
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
// BUILDING MANAGER - Hauptklasse die alles koordiniert
// ============================================================================
export class BuildingManager {
  constructor(bot, agent) {
    this.bot = bot;
    this.agent = agent;
    
    const schematicsPath = path.join(__dirname, '..', '..', 'schematics');
    
    // Initialisiere Komponenten
    this.registry = new SchematicRegistry(schematicsPath);
    this.playerLocator = new PlayerLocator(bot);
    this.blockPlacer = new BlockPlacer(bot);
    this.executor = new BuildExecutor(bot, this.blockPlacer);
    
    // Lade Schematics
    this.registry.loadAll();
    this.logAvailableBuildings();
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
    return this.executor.cancel();
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
}