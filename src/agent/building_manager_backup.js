import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import prismarineSchematic from 'prismarine-schematic';
import nbt from 'prismarine-nbt';
import { fileURLToPath } from 'url';
import * as skills from './library/skills.js';
import * as mc from '../utils/mcdata.js';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import settings from '../../settings.js';
const { goals } = pathfinder;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BuildingManager {
  constructor(bot, agent) {
    this.bot = bot;
    this.agent = agent;
    this.schematicsPath = path.join(__dirname, '..', '..', 'schematics');
    this.availableSchematics = {};
    this.currentBuild = null;
    this.buildQueue = [];
    this.isBuilding = false;
    this.inventoryBusy = false; // Mutex für Inventar-Operationen
    
    // Lade Schematics beim Start
    this.loadSchematicList();
  }
  
  loadSchematicList() {
    console.log('🏗️ Loading schematics for BuildingManager...');
    const categories = ['houses', 'utility', 'decorative'];
    let loadedCount = 0;
    
    for (const category of categories) {
      const categoryPath = path.join(this.schematicsPath, category);
      if (!fs.existsSync(categoryPath)) {
        console.log(`⚠️ Category directory not found: ${category}`);
        continue;
      }
      
      const files = fs.readdirSync(categoryPath)
        .filter(f => f.endsWith('.schem') || f.endsWith('.schematic'));
      
      for (const file of files) {
        const name = file.replace(/\.(schem|schematic)$/, '');
        const fullPath = path.join(categoryPath, file);
        
        try {
          const stats = fs.statSync(fullPath);
          
          this.availableSchematics[name.toLowerCase()] = {
            name: name,
            displayName: name.replace(/_/g, ' '),
            category: category,
            path: fullPath,
            fileSize: stats.size,
            size: null,
            materials: null,
            loaded: false
          };
          loadedCount++;
          
        } catch (error) {
          console.log(`❌ Error loading schematic metadata for ${file}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ Loaded ${loadedCount} schematics from ${categories.length} categories`);
    
    if (loadedCount > 0) {
      this.logAvailableBuildings();
    }
  }
  
  logAvailableBuildings() {
    const byCategory = this.listSchematicsByCategory();
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
  
  listSchematics() {
    return Object.keys(this.availableSchematics);
  }
  
  listSchematicsByCategory() {
    const byCategory = {};
    for (const [name, info] of Object.entries(this.availableSchematics)) {
      if (!byCategory[info.category]) byCategory[info.category] = [];
      byCategory[info.category].push(info);
    }
    return byCategory;
  }
  
  findSchematic(name) {
    const searchName = name.toLowerCase();
    
    if (this.availableSchematics[searchName]) {
      return this.availableSchematics[searchName];
    }
    
    for (const [schematicName, info] of Object.entries(this.availableSchematics)) {
      if (schematicName.includes(searchName) || searchName.includes(schematicName)) {
        return info;
      }
    }
    
    return null;
  }
  
  async loadSchematicData(schematicInfo) {
    if (schematicInfo.loaded && schematicInfo.schematicData) {
      return schematicInfo.schematicData;
    }

    try {
      console.log(`📖 Loading schematic data for: ${schematicInfo.name}`);
      
      let fileBuffer = fs.readFileSync(schematicInfo.path);
      console.log(`📁 File buffer size: ${fileBuffer.length} bytes`);
      
      // Check if file is gzip compressed (WorldEdit schematics are usually gzipped)
      const isGzipped = fileBuffer.length >= 2 && fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b;
      console.log(`🗜️ File is gzipped: ${isGzipped ? 'YES' : 'NO'}`);
      
      if (isGzipped) {
        console.log(`🔄 Decompressing gzipped WorldEdit schematic...`);
        try {
          fileBuffer = zlib.gunzipSync(fileBuffer);
          console.log(`✅ Decompressed successfully, new size: ${fileBuffer.length} bytes`);
        } catch (gzipError) {
          console.log(`❌ Gzip decompression failed: ${gzipError.message}`);
          throw new Error(`Failed to decompress schematic: ${gzipError.message}`);
        }
      }
      
      const Schematic = prismarineSchematic.Schematic;
      
      let schematicData;
      try {
        // Erste Priorität: prismarine-schematic mit WorldEdit Format
        console.log(`🔄 Trying prismarine-schematic with 'schem' format...`);
        schematicData = await Schematic.read(fileBuffer, 'schem');
        console.log(`✅ prismarine-schematic successful!`);
        
      } catch (prismarineError) {
        console.log(`⚠️ prismarine-schematic failed: ${prismarineError.message}`);
        
        try {
          console.log(`🔄 Trying automatic format detection...`);
          schematicData = await Schematic.read(fileBuffer);
          console.log(`✅ Auto-detection successful!`);
          
        } catch (autoError) {
          console.log(`❌ Auto-detection failed: ${autoError.message}`);
          
          try {
            console.log(`🔄 Trying direct NBT parsing for Sponge schematic...`);
            schematicData = await this.parseWorldEditNBT(fileBuffer, schematicInfo.name);
            console.log(`✅ Direct NBT parsing successful!`);
            
          } catch (nbtError) {
            console.log(`❌ NBT parsing failed: ${nbtError.message}`);
            
            // Final fallback: Enhanced mock data
            console.log(`🚨 Creating enhanced mock data as final fallback`);
            console.log(`   WorldEdit .schem files are not compatible with current libraries`);
            console.log(`   File info: ${fileBuffer.length} bytes, starts with ${fileBuffer.slice(0, 8).toString('hex')}`);
            
            schematicData = this.createEnhancedMockSchematic(schematicInfo);
          }
        }
      }
      
      // Validiere schematicData Struktur
      if (!schematicData) {
        throw new Error('Schematic data is null');
      }
      
      console.log(`✅ Schematic loaded successfully`);
      console.log(`📐 Dimensions: ${schematicData.width}x${schematicData.height}x${schematicData.length}`);
      
      // Zeige Schematic-Informationen
      if (schematicData.palette) {
        const nonAirBlocks = Object.entries(schematicData.palette)
          .filter(([name]) => name !== 'minecraft:air' && name !== 'air');
        console.log(`🎨 Palette: ${Object.keys(schematicData.palette).length} total, ${nonAirBlocks.length} non-air`);
        
        if (nonAirBlocks.length > 0) {
          const topBlocks = nonAirBlocks.slice(0, 3);
          console.log(`📦 Materials: ${topBlocks.map(([name, count]) => `${count}x ${name}`).join(', ')}`);
        }
      }
      
      // Teste Iteration
      if (typeof schematicData.forEach === 'function') {
        let blockCount = 0;
        let airCount = 0;
        
        try {
          schematicData.forEach((pos, block) => {
            if (block && block.name) {
              if (block.name === 'minecraft:air' || block.name === 'air') {
                airCount++;
              } else {
                blockCount++;
              }
            }
          });
          
          console.log(`🔄 Iteration test: ${blockCount} solid, ${airCount} air blocks`);
        } catch (iterError) {
          console.log(`⚠️ Iteration test failed: ${iterError.message}`);
        }
      }
      
      // Speichere Metadaten
      if (schematicData.width && schematicData.height && schematicData.length) {
        schematicInfo.size = {
          x: schematicData.width,
          y: schematicData.height,
          z: schematicData.length
        };
      } else {
        schematicInfo.size = { x: 10, y: 10, z: 10 };
      }
      
      schematicInfo.materials = this.analyzeMaterials(schematicData);
      schematicInfo.schematicData = schematicData;
      schematicInfo.loaded = true;
      
      console.log(`✅ Completed loading: ${schematicInfo.displayName}`);
      
      return schematicData;
      
    } catch (error) {
      console.log(`❌ Failed to load schematic ${schematicInfo.name}: ${error.message}`);
      throw error;
    }
  }
  
  async parseWorldEditNBT(buffer, schematicName) {
    console.log(`🔄 Parsing WorldEdit NBT data for ${schematicName}...`);
    
    try {
      const { parsed } = await nbt.parse(buffer);
      console.log(`✅ NBT parsed successfully`);
      
      // WorldEdit Sponge Schematic Format structure
      // Data is nested under "Schematic" compound tag
      const rootData = parsed.value;
      const schematicData = rootData.Schematic?.value;
      
      if (!schematicData) {
        throw new Error('No "Schematic" compound found in NBT structure');
      }
      
      // Extract basic dimensions
      const width = schematicData.Width?.value || 0;
      const height = schematicData.Height?.value || 0;
      const length = schematicData.Length?.value || 0;
      
      console.log(`📐 WorldEdit dimensions: ${width}x${height}x${length}`);
      
      if (width === 0 || height === 0 || length === 0) {
        throw new Error(`Invalid dimensions: ${width}x${height}x${length}`);
      }
      
      // Extract palette from Blocks.Palette
      const palette = {};
      const blocksData = schematicData.Blocks?.value;
      if (blocksData?.Palette?.value) {
        for (const [blockName, blockId] of Object.entries(blocksData.Palette.value)) {
          palette[blockName] = blockId.value || 0;
        }
        console.log(`🎨 Found WorldEdit palette with ${Object.keys(palette).length} block types`);
      } else {
        throw new Error('No block palette found in NBT structure');
      }
      
      // Extract block data from Blocks.Data
      const blockData = blocksData?.Data?.value;
      if (!blockData || blockData.length === 0) {
        throw new Error('No block data found in NBT structure');
      }
      
      console.log(`📦 WorldEdit block data: ${blockData.length} bytes for ${width * height * length} positions`);
      
      // Create compatible schematic object
      // Nach 90° Rotation: width wird zu length, length wird zu width
      const compatibleSchematic = {
        width: length,  // Rotated: original length becomes new width
        height: height, // Height bleibt gleich
        length: width,  // Rotated: original width becomes new length
        palette: palette,
        blockData: blockData,
        
        // Custom forEach implementation for WorldEdit format
        forEach: function(callback) {
          console.log(`🔄 Starting forEach iteration over ${length}x${height}x${width} schematic (90° rotated)`);
          
          // Reverse palette for ID -> name lookup
          const idToName = {};
          for (const [name, id] of Object.entries(palette)) {
            idToName[id] = name;
          }
          
          let processedBlocks = 0;
          let solidBlocks = 0;
          
          // WorldEdit uses YZX iteration order: Y=layer, Z=depth, X=width
          // Based on analysis: we need to iterate in the correct WorldEdit order
          for (let y = 0; y < height; y++) {
            for (let z = 0; z < length; z++) {
              for (let x = 0; x < width; x++) {
                const index = y * width * length + z * width + x;
                
                if (index < blockData.length) {
                  const blockId = blockData[index];
                  const blockName = idToName[blockId] || 'minecraft:air';
                  
                  // Rotation um 90° gegen den Uhrzeigersinn:
                  // x' = z, z' = width - 1 - x
                  // Aber wir müssen das Offset korrigieren, damit die Schematic an der Spielerposition startet
                  const rotatedPos = { 
                    x: z, 
                    y: y, 
                    z: x  // Vereinfachte Rotation: z' = x (ohne Offset)
                  };
                  
                  const block = { name: blockName, properties: {} };
                  
                  callback(rotatedPos, block);
                  
                  processedBlocks++;
                  if (blockName !== 'minecraft:air' && blockName !== 'air') {
                    solidBlocks++;
                  }
                } else {
                  // Fill missing data with air
                  callback({ x, y, z }, { name: 'minecraft:air', properties: {} });
                  processedBlocks++;
                }
              }
            }
          }
          
          console.log(`✅ forEach completed: ${processedBlocks} total, ${solidBlocks} solid blocks`);
        }
      };
      
      return compatibleSchematic;
      
    } catch (nbtError) {
      console.log(`❌ NBT parsing failed: ${nbtError.message}`);
      throw new Error(`NBT parsing failed: ${nbtError.message}`);
    }
  }
  
  createEnhancedMockSchematic(schematicInfo) {
    console.log(`🎭 Creating enhanced mock for: ${schematicInfo.name}`);
    
    let mockBlocks = [];
    let width = 5, height = 3, length = 5;
    
    if (schematicInfo.name.includes('platte')) {
      // Flache Platte 6x1x6 mit gemischten Materialien
      width = 6; height = 1; length = 6;
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < length; z++) {
          const materials = ['cobblestone', 'stone', 'oak_planks'];
          const material = materials[(x + z) % materials.length];
          mockBlocks.push({ pos: { x, y: 0, z }, block: { name: material, properties: {} } });
        }
      }
    } else if (schematicInfo.name.includes('haus') || schematicInfo.name.includes('misch') || schematicInfo.name.includes('voll')) {
      // Funktionales Haus 7x4x7
      width = 7; height = 4; length = 7;
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          for (let z = 0; z < length; z++) {
            let material = null;
            
            // Boden
            if (y === 0) {
              material = 'oak_planks';
            }
            // Wände
            else if (y === 1 && (x === 0 || x === 6 || z === 0 || z === 6)) {
              if (z === 0 && x === 3) {
                material = null; // Türöffnung
              } else {
                material = 'cobblestone';
              }
            }
            // Fenster
            else if (y === 2 && (x === 0 || x === 6 || z === 6)) {
              if ((x === 0 && z === 2) || (x === 6 && z === 4)) {
                material = 'glass';
              } else if (x === 0 || x === 6 || z === 6) {
                material = 'cobblestone';
              }
            }
            // Dach
            else if (y === 3 && (x === 0 || x === 6 || z === 0 || z === 6)) {
              material = 'oak_planks';
            }
            // Innenausstattung
            else if (y === 1) {
              if (x === 1 && z === 1) material = 'crafting_table';
              else if (x === 2 && z === 1) material = 'furnace';
              else if (x === 4 && z === 1) material = 'chest';
              else if (x === 1 && z === 5) material = 'red_bed';
            }
            
            if (material) {
              mockBlocks.push({ pos: { x, y, z }, block: { name: material, properties: {} } });
            }
          }
        }
      }
    } else if (schematicInfo.name.includes('storage') || schematicInfo.name.includes('tiny')) {
      // Lagerraum 5x3x5
      width = 5; height = 3; length = 5;
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          for (let z = 0; z < length; z++) {
            let material = null;
            
            if (y === 0) material = 'stone_bricks'; // Boden
            else if (y === 1 && (x === 0 || x === 4 || z === 0 || z === 4)) {
              if (z === 0 && x === 2) material = null; // Eingang
              else material = 'stone_bricks';
            }
            else if (y === 2 && (x === 0 || x === 4 || z === 0 || z === 4)) {
              material = 'stone_bricks'; // Dach
            }
            else if (y === 1) {
              if ((x === 1 && (z === 1 || z === 3)) || (x === 3 && (z === 1 || z === 3))) {
                material = 'chest';
              } else if (x === 2 && z === 2) {
                material = 'crafting_table';
              }
            }
            
            if (material) {
              mockBlocks.push({ pos: { x, y, z }, block: { name: material, properties: {} } });
            }
          }
        }
      }
    } else {
      // Standard 5x3x5
      const functionalBlocks = ['cobblestone', 'oak_planks', 'stone_bricks', 'crafting_table', 'furnace', 'chest'];
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          for (let z = 0; z < length; z++) {
            let material;
            if (y === 0) {
              material = 'oak_planks';
            } else if ((x === 0 || x === 4 || z === 0 || z === 4) && y === 1) {
              material = 'cobblestone';
            } else if (y === 1) {
              material = functionalBlocks[(x + z) % functionalBlocks.length];
            } else if (y === 2 && (x === 0 || x === 4 || z === 0 || z === 4)) {
              material = 'oak_planks';
            }
            
            if (material) {
              mockBlocks.push({ pos: { x, y, z }, block: { name: material, properties: {} } });
            }
          }
        }
      }
    }
    
    console.log(`🎭 Created mock with ${mockBlocks.length} blocks, ${width}x${height}x${length} size`);
    
    return {
      width: width,
      height: height,
      length: length,
      start: { x: 0, y: 0, z: 0 },
      end: { x: width-1, y: height-1, z: length-1 },
      forEach: function(callback) {
        for (const item of mockBlocks) {
          callback(item.pos, item.block);
        }
      },
      palette: mockBlocks.reduce((palette, item) => {
        palette[item.block.name] = (palette[item.block.name] || 0) + 1;
        return palette;
      }, {})
    };
  }
  
  parseBlockWithStates(blockName) {
    // Parse Block-Name und States
    const parts = blockName.split('[');
    const baseName = parts[0];
    let states = {};
    
    if (parts.length > 1) {
      // Parse States von [state1=value1,state2=value2]
      const statesString = parts[1].replace(']', '');
      const statePairs = statesString.split(',');
      
      for (const pair of statePairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          states[key.trim()] = value.trim();
        }
      }
    }
    
    return { baseName, states };
  }
  
  rotateBlockStates(blockName, states) {
    // Rotiere Block-States für 90° Rotation gegen Uhrzeigersinn
    const rotatedStates = { ...states };
    
    // Rotiere Richtungen (facing)
    if (states.facing) {
      const facingMap = {
        'north': 'west',    // Nord -> West
        'east': 'north',    // Ost -> Nord
        'south': 'east',    // Süd -> Ost
        'west': 'south'     // West -> Süd
      };
      rotatedStates.facing = facingMap[states.facing] || states.facing;
    }
    
    // Rotiere Achsen für Logs
    if (states.axis) {
      const axisMap = {
        'x': 'z',  // X-Achse -> Z-Achse
        'z': 'x',  // Z-Achse -> X-Achse
        'y': 'y'   // Y-Achse bleibt gleich
      };
      rotatedStates.axis = axisMap[states.axis] || states.axis;
    }
    
    // Rotiere Treppen-Richtungen
    if (states.shape) {
      const shapeMap = {
        'straight': 'straight',
        'inner_left': 'inner_right',
        'inner_right': 'outer_right',
        'outer_left': 'outer_right',
        'outer_right': 'inner_left'
      };
      rotatedStates.shape = shapeMap[states.shape] || states.shape;
    }
    
    return rotatedStates;
  }
  
  normalizeBlockName(blockName) {
    // Parse Block mit States
    const { baseName, states } = this.parseBlockWithStates(blockName);
    
    // Spezielle Block-Mappings für WorldEdit -> Minecraft
    const blockMappings = {
      // Logs behalten ihre Achsen
      'oak_log': 'oak_log',
      'birch_log': 'birch_log',
      'spruce_log': 'spruce_log',
      'jungle_log': 'jungle_log',
      'acacia_log': 'acacia_log',
      'dark_oak_log': 'dark_oak_log',
      'blue_bed': 'blue_bed',
      'green_bed': 'green_bed',
      'yellow_bed': 'yellow_bed',
      'pink_bed': 'pink_bed',
      'gray_bed': 'gray_bed',
      'light_gray_bed': 'light_gray_bed',
      'cyan_bed': 'cyan_bed',
      'purple_bed': 'purple_bed',
      'brown_bed': 'brown_bed',
      'black_bed': 'black_bed',
      'lime_bed': 'lime_bed',
      'magenta_bed': 'magenta_bed',
      'orange_bed': 'orange_bed',
      
      // Truhen -> einfache Truhen  
      'chest': 'chest',
      
      // Türen -> einfache Türen
      'oak_door': 'oak_door',
      'birch_door': 'birch_door',
      'spruce_door': 'spruce_door',
      'jungle_door': 'jungle_door',
      'acacia_door': 'acacia_door',
      'dark_oak_door': 'dark_oak_door',
      'iron_door': 'iron_door',
      
      // Öfen
      'furnace': 'furnace',
      'blast_furnace': 'blast_furnace',
      'smoker': 'smoker',
      
      // Werkbänke
      'crafting_table': 'crafting_table',
      
      // Standard-Blöcke
      'cobblestone': 'cobblestone',
      'stone': 'stone',
      'stone_bricks': 'stone_bricks',
      'oak_planks': 'oak_planks',
      'birch_planks': 'birch_planks',
      'spruce_planks': 'spruce_planks',
      'jungle_planks': 'jungle_planks',
      'acacia_planks': 'acacia_planks',
      'dark_oak_planks': 'dark_oak_planks',
      'glass': 'glass',
      'dirt': 'dirt',
      'grass_block': 'grass_block'
    };
    
    // Verwende Mapping oder den Basis-Namen
    const mappedName = blockMappings[baseName] || baseName;
    
    // Rotiere States für 90° Rotation
    const rotatedStates = this.rotateBlockStates(baseName, states);
    
    // Erstelle finalen Block-String mit rotierten States
    let finalBlock = mappedName;
    if (Object.keys(rotatedStates).length > 0) {
      const stateString = Object.entries(rotatedStates)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      finalBlock = `${mappedName}[${stateString}]`;
    }
    
    console.log(`🔄 Block mapping: "${blockName}" -> "${finalBlock}"`);
    return finalBlock;
  }
  
  analyzeMaterials(schematicData) {
    const materials = {};
    
    try {
      if (typeof schematicData.forEach === 'function') {
        schematicData.forEach((pos, block) => {
          if (block && block.name && block.name !== 'minecraft:air' && block.name !== 'air') {
            const fullBlockName = block.name.replace('minecraft:', '');
            // Verwende nur Basis-Namen für Material-Zählung
            const baseName = fullBlockName.split('[')[0];
            materials[baseName] = (materials[baseName] || 0) + 1;
          }
        });
      } else if (schematicData.palette) {
        for (const [blockName, count] of Object.entries(schematicData.palette)) {
          if (blockName !== 'minecraft:air' && blockName !== 'air' && count > 0) {
            const fullName = blockName.replace('minecraft:', '');
            // Verwende nur Basis-Namen für Material-Zählung
            const baseName = fullName.split('[')[0];
            materials[baseName] = (materials[baseName] || 0) + count;
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not analyze materials: ${error.message}`);
    }
    
    return materials;
  }
  
  calculateBuildPosition(playerPos, playerYaw, size = { x: 10, y: 10, z: 10 }) {
    // Baue direkt vor dem Spieler, nur 2-3 Blöcke entfernt
    const offset = 2; // Viel näher zum Spieler
    const yawRad = playerYaw;
    const dirX = -Math.sin(yawRad);
    const dirZ = Math.cos(yawRad);
    
    // Positioniere das Gebäude so, dass es vor dem Spieler zentriert ist
    const buildPos = {
      x: Math.floor(playerPos.x + (dirX * offset)),
      y: Math.floor(playerPos.y), 
      z: Math.floor(playerPos.z + (dirZ * offset))
    };
    
    console.log(`🎯 Calculated build position: ${buildPos.x}, ${buildPos.y}, ${buildPos.z} (${offset} blocks from player)`);
    return buildPos;
  }
  
  async checkMaterials(schematicInfo) {
    if (!schematicInfo.materials) {
      await this.loadSchematicData(schematicInfo);
    }
    
    const missing = {};
    const available = {};
    
    if (!schematicInfo.materials) {
      return { missing, available };
    }
    
    for (const [material, needed] of Object.entries(schematicInfo.materials)) {
      const availableCount = this.countItemInInventory(material);
      available[material] = availableCount;
      
      if (availableCount < needed) {
        missing[material] = needed - availableCount;
      }
    }
    
    return { missing, available };
  }
  
  countItemInInventory(itemName) {
    if (!this.bot.inventory || !this.bot.inventory.items) return 0;
    
    const cleanName = itemName.replace('minecraft:', '');
    
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === cleanName || item.name === itemName) {
        count += item.count;
      }
    }
    
    return count;
  }
  
  async buildStructure(schematicName, position = null, rotation = 0) {
    if (this.isBuilding) {
      return 'Already building. Use !buildcancel to stop current build.';
    }
    
    const schematicInfo = this.findSchematic(schematicName);
    if (!schematicInfo) {
      const available = this.listSchematics().join(', ');
      return `Unknown structure "${schematicName}". Available: ${available}`;
    }
    
    if (!schematicInfo.size) {
      await this.loadSchematicData(schematicInfo);
    }
    
    const totalVolume = (schematicInfo.size?.x || 0) * (schematicInfo.size?.y || 0) * (schematicInfo.size?.z || 0);
    if (totalVolume > 50000) {
      return `⚠️ Structure extremely large (${totalVolume} blocks). Consider smaller schematics for performance.`;
    }
    
    console.log(`📐 Schematic dimensions: ${schematicInfo.size?.x || '?'}x${schematicInfo.size?.y || '?'}x${schematicInfo.size?.z || '?'} (${totalVolume} blocks)`);
    
    // ✅ SCHRITT 1: FINDE SPIELER UND GEHE ZU IHM
    const playerUsername = await this.findNearestPlayer();
    if (!playerUsername) {
      return '❌ Kein Spieler gefunden. Stelle sicher, dass sich ein Spieler in der Nähe befindet.';
    }
    
    // Prüfe Entfernung zum Spieler
    const player = this.bot.players[playerUsername].entity;
    if (!player) {
      return `❌ Spieler ${playerUsername} Entity nicht gefunden.`;
    }
    
    const distanceToPlayer = this.bot.entity.position.distanceTo(player.position);
    console.log(`📏 [BuildManager] Distance to ${playerUsername}: ${distanceToPlayer.toFixed(1)} blocks`);
    
    if (distanceToPlayer <= 4.0) {
      // Spieler ist nah genug, kein Movement nötig
      this.bot.chat(`✅ Bereits bei ${playerUsername} (${distanceToPlayer.toFixed(1)}m) - starte Build!`);
      console.log(`✅ [BuildManager] Player close enough, skipping movement`);
    } else {
      // Spieler ist zu weit, gehe zu ihm
      this.bot.chat(`🤖 Gehe zu ${playerUsername} (${distanceToPlayer.toFixed(1)}m entfernt)...`);
      console.log(`🤖 [BuildManager] Going to player: ${playerUsername}`);
      
      // Nutze vorhandenen goToPlayer skill
      const success = await skills.goToPlayer(this.bot, playerUsername, 3);
      if (!success) {
        return `❌ Konnte nicht zu Spieler ${playerUsername} gelangen.`;
      }
      
      // Kurz warten um Position zu stabilisieren
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // ✅ SCHRITT 2: SPIELER KOORDINATEN ALS REFERENZPUNKT NEHMEN  
    // player Variable bereits oben deklariert
    const playerPos = player.position;
    
    console.log(`📍 [BuildManager] Player ${playerUsername} position: ${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)}, ${playerPos.z.toFixed(1)}`);
    console.log(`📍 [BuildManager] Bot position after movement: ${this.bot.entity.position.x.toFixed(1)}, ${this.bot.entity.position.y.toFixed(1)}, ${this.bot.entity.position.z.toFixed(1)}`);
    
    // ✅ SCHRITT 3: BERECHNE BUILD-POSITION BASIEREND AUF SPIELER-KOORDINATEN
    if (!position) {
      position = this.calculateBuildPositionFromPlayer(playerPos, player.yaw, schematicInfo.size);
      console.log(`📍 [BuildManager] Calculated build position: ${position.x}, ${position.y}, ${position.z}`);
    }
    
    this.bot.chat(`🏗️ Baue ${schematicName} bei Position ${position.x}, ${position.y}, ${position.z}`);
    this.bot.chat(`📐 Größe: ${schematicInfo.size?.x}x${schematicInfo.size?.y}x${schematicInfo.size?.z} (${totalVolume} Blöcke)`);
    
    if (totalVolume > 10000) {
      console.log(`⚠️ Large build warning: ${totalVolume} blocks may take significant time`);
    }
    
    try {
      const schematicData = await this.loadSchematicData(schematicInfo);
      
      if (!position) {
        // Finde den Spieler der den Build-Befehl gegeben hat
        const nearestPlayer = this.bot.nearestEntity(entity => entity.type === 'player');
        let playerPos = this.bot.entity.position;
        let playerYaw = this.bot.entity.yaw;
        
        if (nearestPlayer && nearestPlayer.position.distanceTo(this.bot.entity.position) < 10) {
          // Verwende Position des nahesten Spielers
          playerPos = nearestPlayer.position;
          playerYaw = nearestPlayer.yaw || 0;
          console.log(`👤 Using player ${nearestPlayer.username || nearestPlayer.displayName || 'Player'} position for building`);
          
          // Bot bewegt sich zum Spieler bevor er die Build-Position berechnet
          if (this.bot.entity.position.distanceTo(playerPos) > 3) {
            console.log(`🚶 Moving bot closer to player for accurate building position...`);
            try {
              await this.bot.pathfinder.goto(new goals.GoalNear(playerPos.x, playerPos.y, playerPos.z, 2));
              console.log(`✅ Bot moved to player position`);
              await new Promise(resolve => setTimeout(resolve, 500)); // Kurze Pause nach Bewegung
            } catch (moveError) {
              console.log(`⚠️ Could not move to player: ${moveError.message}, using current bot position`);
            }
          }
        } else {
          console.log(`🤖 No nearby player found, using bot position`);
        }
        
        // Berechne Build-Position basierend auf Spieler-Blickrichtung
        position = this.calculateBuildPosition(playerPos, playerYaw, schematicInfo.size);
        
        console.log(`🎯 Building at calculated position: ${position.x}, ${position.y}, ${position.z}`);
      }
      
      console.log(`🏗️ Starting build: ${schematicInfo.displayName} at ${position.x}, ${position.y}, ${position.z}`);
      
      return await this.startCreativeBuild(schematicInfo, schematicData, position, rotation);
      
    } catch (error) {
      console.error('Build error:', error);
      return `Build failed: ${error.message}`;
    }
  }
  
  async startCreativeBuild(schematicInfo, schematicData, position, rotation) {
    this.isBuilding = true;
    
    // Verwende die bereits berechnete Position aus buildStructure
    const playerPos = this.bot.entity.position;
    const playerYaw = this.bot.entity.yaw;
    
    console.log(`👤 Player at ${Math.floor(playerPos.x)}, ${Math.floor(playerPos.y)}, ${Math.floor(playerPos.z)} (yaw: ${(playerYaw * 180 / Math.PI).toFixed(1)}°)`);
    console.log(`🎯 Building at ${position.x}, ${position.y}, ${position.z} (relative to player)`);
    
    const buildPos = position;
    
    this.currentBuild = {
      name: schematicInfo.name,
      position: buildPos,
      rotation,
      startTime: Date.now(),
      mode: 'creative',
      blocksPlaced: 0,
      totalBlocks: 0
    };
    
    try {
      console.log(`�️ Building ${schematicInfo.displayName} at ${buildPos.x}, ${buildPos.y}, ${buildPos.z}`);
      
      this.bot.chat(`🏗️ Building ${schematicInfo.displayName} at your position! Reading schematic...`);
      
      let blocksPlaced = 0;
      let errors = 0;
      
      if (typeof schematicData.forEach === 'function') {
        const blocksByLayer = new Map(); // Organisiere Blöcke nach Y-Level (Layer)
        
        // Sammle alle Blöcke aus dem Schematic und organisiere sie nach Layern
        schematicData.forEach((pos, block) => {
          if (block && block.name && block.name !== 'minecraft:air' && block.name !== 'air') {
            let blockName = block.name.replace('minecraft:', '');
            
            // Normalisiere Block-Namen (entferne Block-States)
            blockName = this.normalizeBlockName(blockName);
            
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
              schematicPos: pos // Original-Position im Schematic
            });
          }
        });
        
        // Sortiere Layer von unten nach oben
        const sortedLayers = Array.from(blocksByLayer.keys()).sort((a, b) => a - b);
        const totalBlocks = Array.from(blocksByLayer.values()).reduce((sum, layer) => sum + layer.length, 0);
        
        console.log(`📊 Found ${totalBlocks} blocks in ${sortedLayers.length} layers (Y: ${sortedLayers[0]} to ${sortedLayers[sortedLayers.length-1]})`);
        console.log(`🏗️ Layer distribution:`, sortedLayers.map(y => `Y${y}: ${blocksByLayer.get(y).length} blocks`).join(', '));
        
        // Keine Limitierung - baue alle Blöcke
        const blocksToProcess = totalBlocks;
        
        this.currentBuild.totalBlocks = blocksToProcess;
        
        if (totalBlocks > 1000) {
          console.log(`🏗️ Large build detected: ${totalBlocks} blocks`);
          this.bot.chat(`🏗️ Building large structure: ${totalBlocks} blocks from schematic layer by layer`);
        } else {
          this.bot.chat(`📋 Building ${totalBlocks} blocks from schematic layer by layer`);
        }
        
        // Zeige Materialverteilung über alle Layer
        const materialCounts = {};
        for (const layer of blocksByLayer.values()) {
          layer.forEach(({block}) => {
            materialCounts[block] = (materialCounts[block] || 0) + 1;
          });
        }
        
        const topMaterials = Object.entries(materialCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([name, count]) => `${count}x ${name}`)
          .join(', ');
        console.log(`📦 Materials to place: ${topMaterials}`);
        
        // Vorbereitung: Sammle benötigte Materialien aus allen Layern
        const requiredMaterials = {};
        for (const layer of blocksByLayer.values()) {
          layer.forEach(({block}) => {
            requiredMaterials[block] = (requiredMaterials[block] || 0) + 1;
          });
        }
        
        console.log(`📦 Required materials:`, requiredMaterials);
        
        // Stelle sicher, dass alle benötigten Materialien im Inventar sind
        if (this.bot.game.gameMode === 'creative') {
          console.log(`🎒 Preparing creative inventory...`);
          await this.prepareCreativeInventory(requiredMaterials);
        }
        
        // Baue Layer für Layer von unten nach oben
        let totalProcessed = 0;
        
        for (const layerY of sortedLayers) {
          const layerBlocks = blocksByLayer.get(layerY);
          
          // Optimiere Baureihenfolge innerhalb des Layers für bessere Stützung
          // Sortiere von der Mitte nach außen, damit Stützblöcke zuerst platziert werden
          const centerX = layerBlocks.reduce((sum, block) => sum + block.pos.x, 0) / layerBlocks.length;
          const centerZ = layerBlocks.reduce((sum, block) => sum + block.pos.z, 0) / layerBlocks.length;
          
          layerBlocks.sort((a, b) => {
            const distA = Math.abs(a.pos.x - centerX) + Math.abs(a.pos.z - centerZ);
            const distB = Math.abs(b.pos.x - centerX) + Math.abs(b.pos.z - centerZ);
            return distA - distB; // Von innen (kleine Distanz) nach außen (große Distanz)
          });
          
          console.log(`\n🏗️ Building Layer Y=${layerY} (${layerBlocks.length} blocks) - center-out order`);
          this.bot.chat(`🏗️ Building layer ${layerY} (${layerBlocks.length} blocks)`);
          
          for (let i = 0; i < layerBlocks.length; i++) {
            const { pos: worldPos, block: blockName, schematicPos } = layerBlocks[i];
            totalProcessed++;
            
            console.log(`🎯 [${totalProcessed}/${blocksToProcess}] Layer Y=${layerY}: Placing ${blockName} at ${worldPos.x},${worldPos.y},${worldPos.z} (schematic: ${schematicPos.x},${schematicPos.y},${schematicPos.z})`);
            
            // Bestimme ob es ein Spezialblock ist (Truhe, Bett, etc.)
            const baseName = blockName.split('[')[0];
            const isSpecialBlock = ['chest', 'bed', 'door', 'furnace', 'wall_torch'].some(special => 
              baseName.includes(special)
            );
            
            // Inventar-Check ohne Slot-Operationen (verhindert "Setting slot 36 cancelled")
            const hasItem = this.bot.inventory.items().find(item => item.name === baseName);
            if (!hasItem && baseName !== 'wall_torch') {
              console.log(`❌ Missing ${baseName} for ${blockName} - skipping`);
              errors++;
              continue;
            }
            
            if (baseName === 'wall_torch') {
              console.log(`⚠️ Skipping wall_torch (known issue)`);
              continue;
            }
            
            // Check if position is already occupied and if the block is correct
            const existingBlock = this.bot.blockAt(new Vec3(worldPos.x, worldPos.y, worldPos.z));
            if (existingBlock && existingBlock.name !== 'air') {
              
              // Extract base block name from desired block (remove states)
              const baseBlockName = blockName.includes('[') ? blockName.split('[')[0] : blockName;
              
              // Special handling for beds - both foot and head parts are the same block
              if (baseName.includes('bed') && existingBlock.name.includes('bed')) {
                console.log(`✅ SKIP: ${blockName} already correctly placed (bed detected)`);
                blocksPlaced++;
                console.log(`✅ SUCCESS: ${blockName} already in place in layer ${layerY} (Total: ${blocksPlaced})`);
                
                // Continue to next block without attempting placement
                const baseDelay = settings.block_place_delay || 400;
                const pauseDuration = isSpecialBlock ? baseDelay * 3 : baseDelay; // Special blocks get 3x delay
                console.log(`⏰ Waiting ${pauseDuration}ms before next block...`);
                await new Promise(resolve => setTimeout(resolve, pauseDuration));
                continue;
              }
              
              // Check if existing block matches what we want to place
              if (existingBlock.name === baseBlockName) {
                console.log(`✅ SKIP: ${blockName} already correctly placed at position`);
                blocksPlaced++;
                console.log(`✅ SUCCESS: ${blockName} already in place in layer ${layerY} (Total: ${blocksPlaced})`);
                
                // Continue to next block without attempting placement
                const baseDelay = settings.block_place_delay || 400;
                const pauseDuration = isSpecialBlock ? baseDelay * 3 : baseDelay; // Special blocks get 3x delay
                console.log(`⏰ Waiting ${pauseDuration}ms before next block...`);
                await new Promise(resolve => setTimeout(resolve, pauseDuration));
                continue;
              } else {
                console.log(`⚠️ Position occupied by ${existingBlock.name}, but need ${baseBlockName}, replacing...`);
              }
            }

            try {
              // Prüfe Distanz und bewege Bot näher wenn nötig
              const targetVec = new Vec3(worldPos.x, worldPos.y, worldPos.z);
              const distance = this.bot.entity.position.distanceTo(targetVec);
              if (distance > 5) {
                console.log(`🚶 Target ${distance.toFixed(1)} blocks away, moving closer...`);
                try {
                  // Bewege Bot näher zum Ziel-Block
                  const moveTarget = new Vec3(worldPos.x, this.bot.entity.position.y, worldPos.z);
                  await this.bot.pathfinder.goto(new goals.GoalNear(moveTarget.x, moveTarget.y, moveTarget.z, 3));
                  await new Promise(resolve => setTimeout(resolve, 500)); // Pause nach Bewegung
                } catch (moveError) {
                  console.log(`⚠️ Could not move closer: ${moveError.message}`);
                }
              }
              
              // Längere Pause bei Spezialblöcken vor dem Platzieren
              if (isSpecialBlock) {
                const baseDelay = settings.block_place_delay || 400;
                await new Promise(resolve => setTimeout(resolve, baseDelay));
              }
              
              try {
                console.log(`🔨 Attempting to place ${blockName} at ${worldPos.x},${worldPos.y},${worldPos.z}...`);
                
                // ✅ EINFACHE MINEFLAYER API - BEWÄHRT UND STABIL
                const success = await skills.placeBlock(this.bot, blockName, worldPos.x, worldPos.y, worldPos.z, 'bottom', false);
                
                if (success) {
                  blocksPlaced++;
                  console.log(`✅ SUCCESS: ${blockName} placed in layer ${layerY} (Total: ${blocksPlaced})`);
                } else {
                  errors++;
                  console.log(`❌ FAILED: ${blockName} placement failed in layer ${layerY} (Errors: ${errors})`);
                  
                  // Additional debugging info
                  const currentBlock = this.bot.blockAt(new Vec3(worldPos.x, worldPos.y, worldPos.z));
                  console.log(`🔍 Block at position after failure: ${currentBlock ? currentBlock.name : 'null'}`);
                  console.log(`🤖 Bot position: ${this.bot.entity.position.x.toFixed(1)}, ${this.bot.entity.position.y.toFixed(1)}, ${this.bot.entity.position.z.toFixed(1)}`);
                  const targetVec = new Vec3(worldPos.x, worldPos.y, worldPos.z);
                  console.log(`📏 Distance to target: ${this.bot.entity.position.distanceTo(targetVec).toFixed(1)}`);
                }
              } catch (placeError) {
                errors++;
                console.log(`❌ EXCEPTION during block placement: ${placeError.message}`);
              }
              
              this.currentBuild.blocksPlaced = blocksPlaced;
              
              // Progress alle 5 Blöcke in einem Layer
              if ((i + 1) % 5 === 0) {
                const layerPercent = Math.round(((i + 1) / layerBlocks.length) * 100);
                const totalPercent = Math.round((totalProcessed / blocksToProcess) * 100);
                this.bot.chat(`🔨 Layer Y=${layerY}: ${layerPercent}% | Total: ${totalPercent}% (${blocksPlaced}/${totalProcessed})`);
              }
              
              // Angepasste Pausen zwischen Blöcken (länger für Spezialblöcke)
              const baseDelay = settings.block_place_delay || 400;
              const pauseDuration = isSpecialBlock ? baseDelay * 3 : baseDelay; // Special blocks get 3x delay
              console.log(`⏰ Waiting ${pauseDuration}ms before next block...`);
              await new Promise(resolve => setTimeout(resolve, pauseDuration));
              
              // Stop bei zu vielen Fehlern
              if (errors > 30) {
                console.log(`❌ Too many errors (${errors}), stopping build`);
                this.bot.chat(`❌ Build stopped due to placement failures`);
                break;
              }
              
            } catch (blockError) {
              errors++;
              console.log(`❌ Block error in layer ${layerY}: ${blockError.message}`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          // Längere Pause zwischen Layern
          if (layerY < sortedLayers[sortedLayers.length - 1]) {
            console.log(`✅ Layer Y=${layerY} completed, moving to next layer...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        console.log('⚠️ Schematic forEach not available, using fallback');
        this.bot.chat('⚠️ Building test structure instead');
        
        // Fallback: Einfache Struktur
        for (let i = 0; i < 10; i++) {
          try {
            const testPos = { x: position.x + i, y: position.y, z: position.z };
            const success = await skills.placeBlock(this.bot, 'cobblestone', testPos.x, testPos.y, testPos.z);
            
            if (success) blocksPlaced++;
            else errors++;
            
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            errors++;
          }
        }
      }
      
      const duration = ((Date.now() - this.currentBuild.startTime) / 1000).toFixed(1);
      this.isBuilding = false;
      this.currentBuild = null;
      
      const successRate = (blocksPlaced + errors) > 0 ? Math.round((blocksPlaced / (blocksPlaced + errors)) * 100) : 0;
      
      // Clean up any remaining temporary support blocks
      try {
        await skills.cleanupTemporarySupports(this.bot);
      } catch (cleanupError) {
        console.log(`⚠️ Warning during support cleanup: ${cleanupError.message}`);
      }
      
      this.bot.chat(`✅ Build complete! ${blocksPlaced} blocks placed, ${errors} failed (${successRate}%) in ${duration}s`);
      console.log(`✅ BUILD COMPLETED: ${blocksPlaced} placed, ${errors} errors, ${successRate}% success`);
      
      return `✅ Built ${schematicInfo.displayName}! ${blocksPlaced} blocks placed in ${duration}s`;
      
    } catch (error) {
      this.isBuilding = false;
      this.currentBuild = null;
      console.error('Build error:', error);
      throw error;
    }
  }

  async prepareCreativeInventory(requiredMaterials) {
    console.log(`🎒 Preparing creative inventory (simplified for reliability)...`);
    
    // Extrahiere nur Basis-Namen (ohne Block-States)
    const baseMaterials = {};
    for (const [blockName, quantity] of Object.entries(requiredMaterials)) {
      const baseName = blockName.split('[')[0];
      baseMaterials[baseName] = (baseMaterials[baseName] || 0) + quantity;
    }
    
    console.log(`📦 Base materials needed:`, baseMaterials);
    
    // ✅ VEREINFACHTER ANSATZ - FUNKTIONIERT ZUVERLÄSSIGER
    // Verwende bereits vorhandene Items wenn möglich, füge nur die wichtigsten hinzu
    const materialNames = Object.keys(baseMaterials);
    const maxSlots = Math.min(5, materialNames.length); // Nur 5 wichtigste Materials
    
    console.log(`📦 Adding ${maxSlots} most important materials to creative inventory...`);
    
    for (let i = 0; i < maxSlots; i++) {
      const materialName = materialNames[i];
      try {
        console.log(`📦 Adding ${materialName} to slot ${i}...`);
        
        const mcData = require('minecraft-data')(this.bot.version);
        const itemData = mcData.itemsByName[materialName];
        
        if (!itemData) {
          console.log(`⚠️ Unknown material: ${materialName}, skipping...`);
          continue;
        }
        
        const item = new Item(itemData.id, 64);
        await this.bot.creative.setInventorySlot(i, item);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log(`✅ Added ${materialName} to inventory`);
        
      } catch (error) {
        console.log(`⚠️ Could not add ${materialName}: ${error.message}`);
      }
    }
    
    console.log(`✅ Creative inventory prepared (simplified approach)`);
  }
  
  // Diese Funktion ist nicht mehr nötig, da Inventar-Checks vereinfacht wurden
  async ensureBlockInInventory(blockName) {
    const baseName = blockName.split('[')[0];
    const hasItem = this.bot.inventory.items().find(item => item.name === baseName);
    return !!hasItem;
  }
  
  getBuildStatus() {
    if (!this.isBuilding) {
      return 'No build in progress.';
    }
    
    const elapsed = ((Date.now() - this.currentBuild.startTime) / 1000).toFixed(1);
    const progress = this.currentBuild.totalBlocks > 0 ? 
      `${this.currentBuild.blocksPlaced}/${this.currentBuild.totalBlocks} blocks` : 'calculating...';
    const percent = this.currentBuild.totalBlocks > 0 ? 
      Math.round((this.currentBuild.blocksPlaced / this.currentBuild.totalBlocks) * 100) : 0;
    
    return `🏗️ Building ${this.currentBuild.name}: ${progress} (${percent}%) - ${elapsed}s elapsed`;
  }
  
  cancelBuild() {
    if (!this.isBuilding) {
      return 'No build in progress to cancel.';
    }
    
    this.isBuilding = false;
    const buildName = this.currentBuild ? this.currentBuild.name : 'Unknown';
    this.currentBuild = null;
    
    return `Cancelled build: ${buildName}`;
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
      const materialCount = Object.keys(schematicInfo.materials).length;
      info += `Material types: ${materialCount}\n`;
      
      const topMaterials = Object.entries(schematicInfo.materials)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([item, count]) => `${count}x ${item}`)
        .join(', ');
      info += `Top materials: ${topMaterials}`;
    } else {
      info += 'Material info: Not loaded yet';
    }
    
    return info;
  }

  // ========================================================================================
  // ✅ PLAYER DETECTION UND POSITION CALCULATION
  // ========================================================================================

  /**
   * Findet den nächsten Spieler in Reichweite
   */
  async findNearestPlayer() {
    const players = Object.keys(this.bot.players).filter(name => name !== this.bot.username);
    
    if (players.length === 0) {
      console.log('⚠️ [BuildManager] Keine anderen Spieler gefunden');
      return null;
    }
    
    // Finde nächsten Spieler mit Entity
    let nearestPlayer = null;
    let nearestDistance = Infinity;
    
    for (const playerName of players) {
      const player = this.bot.players[playerName].entity;
      if (player) {
        const distance = this.bot.entity.position.distanceTo(player.position);
        console.log(`👤 [BuildManager] Player ${playerName}: ${distance.toFixed(1)} blocks away`);
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayer = playerName;
        }
      }
    }
    
    if (nearestPlayer) {
      console.log(`✅ [BuildManager] Nearest player: ${nearestPlayer} (${nearestDistance.toFixed(1)} blocks)`);
    } else {
      console.log('❌ [BuildManager] No players with entities found');
    }
    
    return nearestPlayer;
  }

  /**
   * Berechnet Build-Position basierend auf Spieler-Position und Blickrichtung
   */
  calculateBuildPositionFromPlayer(playerPos, playerYaw, schematicSize) {
    // Konvertiere Yaw zu Richtungsvektor (Minecraft Yaw: 0=South, 90=West, 180=North, 270=East)
    const yawRadians = (playerYaw + 90) * (Math.PI / 180); // +90 um von Süd-basiert zu Nord-basiert zu wechseln
    
    // Berechne Richtung (normalisierte Vektoren)
    const directionX = Math.cos(yawRadians);
    const directionZ = Math.sin(yawRadians);
    
    // Bestimme optimalen Abstand basierend auf Schematic-Größe
    const schematicWidth = schematicSize?.x || 10;
    const schematicLength = schematicSize?.z || 10;
    const maxDimension = Math.max(schematicWidth, schematicLength);
    const buildDistance = Math.max(5, Math.ceil(maxDimension / 2) + 2); // Mindestens 5 Blöcke, oder halbe Schematic-Größe + 2
    
    // Berechne Build-Position (vor dem Spieler)
    const buildX = Math.floor(playerPos.x + (directionX * buildDistance));
    const buildY = Math.floor(playerPos.y); // Gleiche Y-Höhe wie Spieler
    const buildZ = Math.floor(playerPos.z + (directionZ * buildDistance));
    
    console.log(`📊 [BuildManager] Player Yaw: ${playerYaw.toFixed(1)}°, Direction: (${directionX.toFixed(2)}, ${directionZ.toFixed(2)})`);
    console.log(`📊 [BuildManager] Build distance: ${buildDistance} blocks (based on schematic size ${schematicWidth}x${schematicLength})`);
    
    return { x: buildX, y: buildY, z: buildZ };
  }

  // ========================================================================================
  // ✅ NEUE VERBESSERTE BLOCK-PLACEMENT LOGIK (Integration aus Builder System)
  // ========================================================================================

  /**
   * Erweiterte Block-Platzierung mit Validierung und Sonderblock-Support
   */
  async placeBlockWithValidation(blockName, position) {
    const pos = new Vec3(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
    
    console.log(`🔨 [Enhanced] Platziere ${blockName} bei ${pos.x}, ${pos.y}, ${pos.z}`);
    
    // ✅ 1. Bereits platzierte Blöcke erkennen (GROSSE VERBESSERUNG!)
    const existingBlock = this.bot.blockAt(pos);
    const baseBlockName = blockName.split('[')[0]; // Entferne Block States für Vergleich
    
    if (existingBlock && existingBlock.name === baseBlockName) {
      console.log(`✅ SKIP: ${blockName} bereits korrekt platziert`);
      return true; // Zählt als Erfolg
    }
    
    // ✅ 2. Spezielle Block-Behandlung
    const blockInfo = this.getSpecialBlockInfo(blockName);
    if (blockInfo) {
      console.log(`🔧 Erkenne Sonderblock: ${blockName} (Typ: ${blockInfo.type})`);
      
      // Support-Validierung für Sonderblöcke
      if (blockInfo.needsSupport) {
        if (!this.hasValidSupport(pos, blockInfo.type)) {
          console.log(`❌ Kein gültiger Support für ${blockName} bei ${pos.x}, ${pos.y}, ${pos.z}`);
          return false;
        }
      }
      
      // Multi-Block Strukturen (Türen, Betten)
      if (blockInfo.parts === 2) {
        const success = await this.placeMultiBlock(blockName, pos, blockInfo);
        return success;
      }
    }
    
    // ✅ 3. Temporäre Stützblöcke für Luftblöcke (WICHTIGE VERBESSERUNG!)
    let supportBlock = null;
    const belowPos = new Vec3(pos.x, pos.y - 1, pos.z);
    const buildOffBlock = this.bot.blockAt(belowPos);
    
    if (!buildOffBlock || buildOffBlock.name === 'air') {
      console.log(`🏗️ Benötige temporären Stützblock für ${blockName}`);
      const supportSuccess = await this.placeTemporarySupport(belowPos);
      if (supportSuccess) {
        supportBlock = belowPos;
      } else {
        console.log(`❌ Kann keinen Stützblock platzieren für ${blockName}`);
        return false;
      }
    }
    
    // ✅ 4. Interactive Block Avoidance (verhindert Chest/Door Interaktionen)
    const interactiveBlocks = ['chest', 'furnace', 'crafting_table', 'door', 'bed', 'lever', 'button'];
    const needsSneaking = buildOffBlock && interactiveBlocks.some(type => buildOffBlock.name.includes(type));
    
    if (needsSneaking) {
      this.bot.setControlState('sneak', true);
      console.log(`🤫 Sneaking aktiviert für Interactive Block: ${buildOffBlock.name}`);
    }
    
    // ✅ 5. Robuste Platzierung mit Retry-Logic
    let success = false;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (!success && retryCount <= maxRetries) {
      try {
        success = await skills.placeBlock(this.bot, blockName, pos.x, pos.y, pos.z, 'bottom', false);
        
        if (!success && retryCount < maxRetries) {
          console.log(`🔄 Retry ${retryCount + 1}/${maxRetries} für ${blockName}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (retryError) {
        if (retryError.message.includes('GoalChanged') || retryError.message.includes('goal was changed')) {
          console.log(`🔄 Goal changed error, retry ${retryCount + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          throw retryError;
        }
      }
      retryCount++;
    }
    
    // ✅ 6. Cleanup
    if (needsSneaking) {
      this.bot.setControlState('sneak', false);
    }
    
    // Entferne temporären Stützblock nach erfolgreichem Bau
    if (success && supportBlock) {
      setTimeout(async () => {
        try {
          await skills.digBlock(this.bot, supportBlock.x, supportBlock.y, supportBlock.z);
          console.log(`🧹 Temporärer Stützblock bei ${supportBlock.x}, ${supportBlock.y}, ${supportBlock.z} entfernt`);
        } catch (error) {
          console.log(`⚠️ Konnte Stützblock nicht entfernen: ${error.message}`);
        }
      }, 2000); // 2 Sekunden warten
    }
    
    return success;
  }

  /**
   * Ermittelt Informationen über Sonderblöcke
   */
  getSpecialBlockInfo(blockName) {
    const specialBlocks = new Map([
      // Betten
      ['white_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['red_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['blue_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['green_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['yellow_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['orange_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['pink_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['purple_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['cyan_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['lime_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['magenta_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['light_blue_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['light_gray_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['gray_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['brown_bed', { type: 'bed', parts: 2, needsSupport: true }],
      ['black_bed', { type: 'bed', parts: 2, needsSupport: true }],
      
      // Türen
      ['oak_door', { type: 'door', parts: 2, needsSupport: true }],
      ['spruce_door', { type: 'door', parts: 2, needsSupport: true }],
      ['birch_door', { type: 'door', parts: 2, needsSupport: true }],
      ['jungle_door', { type: 'door', parts: 2, needsSupport: true }],
      ['acacia_door', { type: 'door', parts: 2, needsSupport: true }],
      ['dark_oak_door', { type: 'door', parts: 2, needsSupport: true }],
      ['iron_door', { type: 'door', parts: 2, needsSupport: true }],
      
      // Zäune und Tore
      ['oak_fence', { type: 'fence', parts: 1, needsSupport: false }],
      ['spruce_fence', { type: 'fence', parts: 1, needsSupport: false }],
      ['birch_fence', { type: 'fence', parts: 1, needsSupport: false }],
      ['jungle_fence', { type: 'fence', parts: 1, needsSupport: false }],
      ['acacia_fence', { type: 'fence', parts: 1, needsSupport: false }],
      ['dark_oak_fence', { type: 'fence', parts: 1, needsSupport: false }],
      ['nether_brick_fence', { type: 'fence', parts: 1, needsSupport: false }],
      
      // Mauern
      ['cobblestone_wall', { type: 'wall', parts: 1, needsSupport: false }],
      ['mossy_cobblestone_wall', { type: 'wall', parts: 1, needsSupport: false }],
      ['stone_brick_wall', { type: 'wall', parts: 1, needsSupport: false }],
      ['mossy_stone_brick_wall', { type: 'wall', parts: 1, needsSupport: false }],
      ['brick_wall', { type: 'wall', parts: 1, needsSupport: false }],
      ['end_stone_brick_wall', { type: 'wall', parts: 1, needsSupport: false }],
      ['nether_brick_wall', { type: 'wall', parts: 1, needsSupport: false }],
      ['red_nether_brick_wall', { type: 'wall', parts: 1, needsSupport: false }],
      
      // Treppen  
      ['oak_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['spruce_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['birch_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['jungle_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['acacia_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['dark_oak_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['stone_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['cobblestone_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['brick_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['stone_brick_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['nether_brick_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['sandstone_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['red_sandstone_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      ['quartz_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
      
      // Redstone
      ['redstone_wire', { type: 'redstone', parts: 1, needsSupport: true, item: 'redstone' }],
      ['repeater', { type: 'redstone', parts: 1, needsSupport: true }],
      ['comparator', { type: 'redstone', parts: 1, needsSupport: true }],
      
      // Schilder
      ['oak_sign', { type: 'sign', parts: 1, needsSupport: true }],
      ['spruce_sign', { type: 'sign', parts: 1, needsSupport: true }],
      ['birch_sign', { type: 'sign', parts: 1, needsSupport: true }],
    ]);
    
    const baseBlockName = blockName.split('[')[0];
    return specialBlocks.get(baseBlockName);
  }

  /**
   * Prüft ob eine Position gültigen Support hat
   */
  hasValidSupport(position, blockType) {
    try {
      switch (blockType) {
        case 'door':
        case 'sign':
        case 'bed':
          // Benötigt festen Block darunter
          const belowPos = new Vec3(position.x, position.y - 1, position.z);
          const blockBelow = this.bot.blockAt(belowPos);
          return blockBelow && this.isSolidBlock(blockBelow.name);
          
        case 'fence':
        case 'wall':
          // Kann auf festen Blöcken oder anderen Zäunen/Mauern stehen
          const belowPos2 = new Vec3(position.x, position.y - 1, position.z);
          const blockBelow2 = this.bot.blockAt(belowPos2);
          return blockBelow2 && (this.isSolidBlock(blockBelow2.name) || 
                 blockBelow2.name.includes('fence') || blockBelow2.name.includes('wall'));
          
        case 'stairs':
          // Treppen sind flexibler
          const belowPos3 = new Vec3(position.x, position.y - 1, position.z);
          const blockBelow3 = this.bot.blockAt(belowPos3);
          return blockBelow3 && blockBelow3.name !== 'air';
          
        case 'redstone':
          // Redstone braucht angrenzenden festen Block
          return this.hasAdjacentSolidBlock(position);
          
        default:
          return true; // Standardblöcke haben meist keinen speziellen Support
      }
    } catch (error) {
      console.log(`⚠️ Support-Prüfung fehlgeschlagen: ${error.message}`);
      return false;
    }
  }

  /**
   * Prüft ob ein Block ein fester/solider Block ist
   */
  isSolidBlock(blockName) {
    const solidBlocks = [
      'stone', 'cobblestone', 'dirt', 'grass_block', 'sand', 'gravel',
      'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 
      'acacia_planks', 'dark_oak_planks', 'stone_bricks', 'bricks',
      'sandstone', 'red_sandstone', 'quartz_block', 'obsidian',
      'bedrock', 'netherrack', 'end_stone'
    ];
    return solidBlocks.includes(blockName);
  }

  /**
   * Prüft ob es einen angrenzenden soliden Block gibt
   */
  hasAdjacentSolidBlock(position) {
    const directions = [
      new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
      new Vec3(0, 0, 1), new Vec3(0, 0, -1),
      new Vec3(0, 1, 0), new Vec3(0, -1, 0)
    ];
    
    for (const direction of directions) {
      const adjacentPos = position.plus(direction);
      const adjacentBlock = this.bot.blockAt(adjacentPos);
      if (adjacentBlock && this.isSolidBlock(adjacentBlock.name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Platziert temporären Stützblock
   */
  async placeTemporarySupport(position) {
    try {
      console.log(`🏗️ Platziere temporären Stützblock bei ${position.x}, ${position.y}, ${position.z}`);
      return await skills.placeBlock(this.bot, 'dirt', position.x, position.y, position.z, 'bottom', false);
    } catch (error) {
      console.log(`❌ Fehler beim Platzieren des Stützblocks: ${error.message}`);
      return false;
    }
  }

  /**
   * Platziert Multi-Block Strukturen (Türen, Betten)
   */
  async placeMultiBlock(blockName, position, blockInfo) {
    try {
      console.log(`🚪 Platziere Multi-Block: ${blockName} (${blockInfo.parts} Teile)`);
      
      // Für Türen und Betten: Platziere unteren Teil zuerst
      const success = await skills.placeBlock(this.bot, blockName, position.x, position.y, position.z, 'bottom', false);
      
      if (success) {
        // Kurz warten dann oberen Teil prüfen
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const upperPos = new Vec3(position.x, position.y + 1, position.z);
        const upperBlock = this.bot.blockAt(upperPos);
        
        if (upperBlock && upperBlock.name === blockName.split('[')[0]) {
          console.log(`✅ Multi-Block ${blockName} vollständig platziert`);
          return true;
        } else {
          console.log(`⚠️ Oberer Teil von ${blockName} fehlt, aber unten erfolgreich`);
          return true; // Zählt trotzdem als Erfolg
        }
      }
      
      return false;
    } catch (error) {
      console.log(`❌ Multi-Block Platzierung fehlgeschlagen: ${error.message}`);
      return false;
    }
  }
}