/**
 * 🏗️ SAUBERER BUILDING MANAGER - NUR BEWÄHRTE MINEFLAYER API
 * Vereinfachte Version ohne Enhanced Block Placement Komplexität
 */

const { Vec3 } = require('vec3');
const { goals, pathfinder } = require('mineflayer-pathfinder');
const skills = require('../utils/skills');
const { Item } = require('prismarine-item');

class BuildingManager {
  constructor(bot, mcData) {
    this.bot = bot;
    this.mcData = mcData;
    this.isBuilding = false;
    this.currentBuild = null;
  }

  // ✅ BEWÄHRTE SPIELER-DETECTION
  findNearestPlayer() {
    const nearbyPlayers = Object.values(this.bot.players)
      .map(player => {
        if (!player.entity || !player.entity.position) return null;
        const distance = this.bot.entity.position.distanceTo(player.entity.position);
        return { player, distance };
      })
      .filter(p => p !== null && p.distance <= 20)
      .sort((a, b) => a.distance - b.distance);

    return nearbyPlayers.length > 0 ? nearbyPlayers[0] : null;
  }

  // ✅ BEWÄHRTE POSITIONSBERECHNUNG
  calculateBuildPositionFromPlayer(playerPos, playerYaw, schematicSize) {
    const distance = Math.max(6, schematicSize.x, schematicSize.z);
    const direction = {
      x: -Math.sin(playerYaw),
      z: Math.cos(playerYaw)
    };

    return {
      x: Math.floor(playerPos.x + direction.x * distance),
      y: Math.floor(playerPos.y),
      z: Math.floor(playerPos.z + direction.z * distance)
    };
  }

  // ✅ VEREINFACHTES CREATIVE INVENTORY
  async prepareSimpleInventory(materials) {
    console.log(`🎒 Setting up creative inventory...`);
    
    const materialList = Object.keys(materials).slice(0, 5); // Nur 5 wichtigste
    
    for (let i = 0; i < materialList.length; i++) {
      const materialName = materialList[i];
      try {
        const itemData = this.mcData.itemsByName[materialName];
        if (!itemData) continue;
        
        const item = new Item(itemData.id, 64);
        await this.bot.creative.setInventorySlot(i, item);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log(`✅ Added ${materialName}`);
      } catch (error) {
        console.log(`⚠️ Could not add ${materialName}`);
      }
    }
  }

  // ✅ EINFACHE MINEFLAYER BLOCK PLACEMENT
  async placeBlock(blockName, position) {
    const baseName = blockName.split('[')[0];
    
    // Prüfe ob Block bereits existiert
    const existingBlock = this.bot.blockAt(new Vec3(position.x, position.y, position.z));
    if (existingBlock && existingBlock.name === baseName) {
      return true; // Bereits platziert
    }
    
    // Prüfe Inventar
    const hasItem = this.bot.inventory.items().find(item => item.name === baseName);
    if (!hasItem) {
      console.log(`❌ Missing ${baseName} - skipping`);
      return false;
    }
    
    // Bewege Bot näher wenn nötig
    const distance = this.bot.entity.position.distanceTo(new Vec3(position.x, position.y, position.z));
    if (distance > 5) {
      try {
        console.log(`🚶 Moving closer to block position...`);
        await this.bot.pathfinder.goto(new goals.GoalNear(position.x, position.y, position.z, 3));
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.log(`⚠️ Could not move closer: ${error.message}`);
      }
    }
    
    // Platziere Block mit bewährter API
    try {
      console.log(`🔨 Placing ${baseName} at ${position.x},${position.y},${position.z}...`);
      const success = await skills.placeBlock(this.bot, baseName, position.x, position.y, position.z, 'bottom', false);
      
      if (success) {
        console.log(`✅ ${baseName} placed successfully`);
        return true;
      } else {
        console.log(`❌ Failed to place ${baseName}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Error placing ${baseName}: ${error.message}`);
      return false;
    }
  }

  // ✅ HAUPT-BUILD FUNKTION
  async buildStructure(schematicName, position = null) {
    console.log(`🏗️ Starting build: ${schematicName}`);
    
    this.isBuilding = true;
    this.currentBuild = {
      name: schematicName,
      startTime: Date.now(),
      blocksPlaced: 0,
      totalBlocks: 0
    };

    try {
      // ✅ SCHRITT 1: LADE SCHEMATIC INFO
      const schematicInfo = this.getSchematicInfo(schematicName);
      if (!schematicInfo) {
        throw new Error(`Unknown schematic: ${schematicName}`);
      }

      console.log(`📐 Schematic dimensions: ${schematicInfo.size.x}x${schematicInfo.size.y}x${schematicInfo.size.z}`);

      // ✅ SCHRITT 2: FINDE SPIELER UND BEWEGE BOT
      const nearestPlayerInfo = this.findNearestPlayer();
      let playerPos = this.bot.entity.position;
      let playerYaw = 0;

      if (nearestPlayerInfo) {
        const { player, distance } = nearestPlayerInfo;
        playerPos = player.entity.position;
        playerYaw = player.entity.yaw || 0;
        
        console.log(`👤 [BuildManager] Player ${player.username}: ${distance.toFixed(1)} blocks away`);
        
        // Bewege nur wenn weit weg
        if (distance > 4.0) {
          console.log(`🚶 [BuildManager] Moving to player...`);
          try {
            await skills.goToPlayer(this.bot, player.username, 3);
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`✅ [BuildManager] Reached player`);
          } catch (error) {
            console.log(`⚠️ [BuildManager] Could not reach player: ${error.message}`);
          }
        } else {
          console.log(`✅ [BuildManager] Player close enough, skipping movement`);
        }
      }

      // ✅ SCHRITT 3: BERECHNE BUILD POSITION
      if (!position) {
        position = this.calculateBuildPositionFromPlayer(playerPos, playerYaw, schematicInfo.size);
        console.log(`📍 [BuildManager] Calculated build position: ${position.x}, ${position.y}, ${position.z}`);
      }

      // ✅ SCHRITT 4: LADE SCHEMATIC DATEN
      const schematicData = await this.loadSchematicData(schematicInfo);
      
      // ✅ SCHRITT 5: SAMMLE MATERIALIEN
      const materialCounts = {};
      for (const block of schematicData.blocks) {
        if (block.block && block.block.name !== 'air') {
          const blockName = block.block.name;
          materialCounts[blockName] = (materialCounts[blockName] || 0) + 1;
        }
      }
      
      this.currentBuild.totalBlocks = Object.values(materialCounts).reduce((sum, count) => sum + count, 0);
      console.log(`📦 Required materials: ${JSON.stringify(materialCounts)}`);

      // ✅ SCHRITT 6: BEREITE INVENTAR VOR
      await this.prepareSimpleInventory(materialCounts);

      // ✅ SCHRITT 7: BAUE STRUKTUR
      console.log(`🏗️ Building ${schematicName} at ${position.x}, ${position.y}, ${position.z}`);
      
      let blocksPlaced = 0;
      let errors = 0;
      const maxErrors = 20; // Weniger Fehler tolerieren
      
      // Sortiere Blöcke nach Y-Koordinate (von unten nach oben)
      const sortedBlocks = schematicData.blocks
        .filter(block => block.block && block.block.name !== 'air')
        .sort((a, b) => a.pos.y - b.pos.y);

      for (let i = 0; i < sortedBlocks.length && errors < maxErrors; i++) {
        const block = sortedBlocks[i];
        const worldPos = {
          x: position.x + block.pos.x,
          y: position.y + block.pos.y,
          z: position.z + block.pos.z
        };

        console.log(`🎯 [${i+1}/${sortedBlocks.length}] Placing ${block.block.name} at ${worldPos.x},${worldPos.y},${worldPos.z}`);

        const success = await this.placeBlock(block.block.name, worldPos);
        
        if (success) {
          blocksPlaced++;
          this.currentBuild.blocksPlaced = blocksPlaced;
          console.log(`✅ SUCCESS (${blocksPlaced}/${sortedBlocks.length})`);
        } else {
          errors++;
          console.log(`❌ FAILED (Errors: ${errors})`);
        }

        // Kurze Pause zwischen Blöcken
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const success = errors < maxErrors;
      const successRate = sortedBlocks.length > 0 ? Math.round((blocksPlaced / sortedBlocks.length) * 100) : 0;
      
      console.log(`🏁 BUILD COMPLETED: ${blocksPlaced} placed, ${errors} errors, ${successRate}% success`);
      
      if (success) {
        this.bot.chat(`✅ ${schematicName} completed! Placed ${blocksPlaced}/${sortedBlocks.length} blocks (${successRate}% success)`);
      } else {
        this.bot.chat(`⚠️ ${schematicName} partially completed: ${blocksPlaced}/${sortedBlocks.length} blocks (${errors} errors)`);
      }

    } catch (error) {
      console.log(`❌ Build failed: ${error.message}`);
      this.bot.chat(`❌ Build failed: ${error.message}`);
    } finally {
      this.isBuilding = false;
      this.currentBuild = null;
    }
  }

  // ✅ SCHEMATIC INFO (vereinfacht)
  getSchematicInfo(name) {
    const schematics = {
      'mischhaus': {
        name: 'mischhaus',
        size: { x: 6, y: 6, z: 7 },
        description: 'Mixed material house'
      },
      'basichouse': {
        name: 'basichouse', 
        size: { x: 7, y: 4, z: 7 },
        description: 'Basic wooden house'
      },
      'storage': {
        name: 'storage',
        size: { x: 5, y: 3, z: 5 },
        description: 'Storage building'
      }
    };

    return schematics[name.toLowerCase()] || null;
  }

  // ✅ MOCK SCHEMATIC LOADER (vereinfacht)
  async loadSchematicData(schematicInfo) {
    console.log(`📂 Loading schematic: ${schematicInfo.name}`);
    
    const blocks = [];
    const { size } = schematicInfo;
    
    // Einfacher Hausaufbau für mischhaus
    if (schematicInfo.name === 'mischhaus') {
      // Fundament
      for (let x = 0; x < size.x; x++) {
        for (let z = 0; z < size.z; z++) {
          blocks.push({ 
            pos: { x, y: 0, z }, 
            block: { name: 'cobblestone' } 
          });
        }
      }
      
      // Wände
      for (let y = 1; y < 3; y++) {
        for (let x = 0; x < size.x; x++) {
          for (let z = 0; z < size.z; z++) {
            if (x === 0 || x === size.x-1 || z === 0 || z === size.z-1) {
              if (!(z === 0 && x === 2 && y === 1)) { // Tür
                blocks.push({ 
                  pos: { x, y, z }, 
                  block: { name: 'oak_planks' } 
                });
              }
            }
          }
        }
      }
      
      // Dach
      for (let x = 0; x < size.x; x++) {
        for (let z = 0; z < size.z; z++) {
          blocks.push({ 
            pos: { x, y: 3, z }, 
            block: { name: 'oak_planks' } 
          });
        }
      }
    }
    
    return { blocks };
  }

  // ✅ STATUS FUNKTIONEN
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

  listSchematics() {
    return ['mischhaus', 'basichouse', 'storage'];
  }
}

module.exports = BuildingManager;