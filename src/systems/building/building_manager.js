import path from 'path';
import { fileURLToPath } from 'url';
import { Vec3 } from 'vec3';
import * as skills from '../../agent/library/skills.js';
import settings from '../../../settings.js';
import { SchematicRegistry } from './schematic_registry.js';
import { PlayerLocator, BlockOrientationHandler } from './utils/helpers.js';
import { BlockPlacer, BuildExecutor } from './block_placer.js';
import { SurvivalBuildCoordinator } from './survival_coordinator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BuildingManager {
  constructor(bot, agent) {
    this.bot = bot;
    this.agent = agent;
    this.autonomousMode = false; // NEU: Autonomer Build-Modus

    const schematicsPath = path.join(__dirname, '..', '..', '..', 'schematics');

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

        // Inform agent to get food urgently
        if (this.agent && this.agent.history) {
          const foodItems = this.bot.inventory.items().filter(item =>
            item.name.includes('bread') || item.name.includes('apple') ||
            item.name.includes('meat') || item.name.includes('steak') ||
            item.name.includes('porkchop') || item.name.includes('chicken') ||
            item.name.includes('fish') || item.name.includes('salmon') ||
            item.name.includes('carrot') || item.name.includes('potato')
          );

          if (foodItems.length === 0) {
            this.agent.history.add('system',
              '🚨 URGENT: Health is very low (below 3 hearts) and NO food in inventory! ' +
              'Build has been paused. You MUST immediately collect or craft food before continuing. ' +
              'Use !smartcollect for food items (bread, apples, meat, carrots, potatoes). ' +
              'After eating, use !buildresume to continue the build.'
            );
          } else {
            this.agent.history.add('system',
              `⚠️ Health is low (${(this.bot.health/2).toFixed(1)} hearts). ` +
              `Build paused. You have ${foodItems.length} food items. Eat immediately, then use !buildresume.`
            );
          }
        }
      }
    });

    // Death interruption
    this.bot.on('death', () => {
      if (this.survivalCoordinator.buildState) {
        console.log('💀 Death detected, saving build state');
        this.survivalCoordinator.pauseBuild('death');
        this.survivalCoordinator.saveBuildState();

        // Inform agent about death
        if (this.agent && this.agent.history) {
          this.agent.history.add('system',
            '💀 You died during the build! Build state has been saved. ' +
            'After respawning, make sure to: 1) Get food and tools, 2) Return to build location, ' +
            '3) Use !buildresume to continue where you left off.'
          );
        }
      }
    });

    // Entity hurt (combat)
    this.bot.on('entityHurt', (entity) => {
      if (entity === this.bot.entity && this.survivalCoordinator.buildState) {
        if (this.bot.health < 10) {
          console.log('⚔️ Taking damage during build');
          this.survivalCoordinator.pauseBuild('combat');

          // Inform agent about combat
          if (this.agent && this.agent.history) {
            this.agent.history.add('system',
              '⚔️ Under attack! Build has been paused for safety. ' +
              'Defend yourself or flee to a safe location. ' +
              'Once safe and healed, use !buildresume to continue building.'
            );
          }
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
      console.log(`🤖 Moving to ${playerUsername}...`);
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

    console.log(`🗂️ Building ${schematicName} at ${position.x}, ${position.y}, ${position.z}`);
    
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
      console.log(`❌ Survival build cancelled: ${buildName}`);
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

    console.log(`🏗️ Starte Survival-Bau: ${schematicName}`);

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

    console.log('📊 Analysiere Materialien...');

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

    console.log(`▶️ Setze Bau fort: ${state.schematicName}`);
    console.log(`📊 Fortschritt: ${progress} Blöcke (${percent}%) | Layer ${state.currentLayer}`);

    if (state.pauseReason) {
      console.log(`💡 Pausiert wegen: ${state.pauseReason}`);
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
