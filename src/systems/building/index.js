/**
 * Building System - Main Entry Point
 *
 * Exports all building-related classes and utilities.
 * This system handles schematic loading, material management, and automated construction.
 */

// Core schematic handling
export { SchematicLoader } from './schematic_loader.js';
export { SchematicRegistry } from './schematic_registry.js';

// Utility classes
export {
  PlayerLocator,
  BlockOrientationHandler,
  MaterialClassifier
} from './utils/helpers.js';

// Block placement and execution
export { BlockPlacer, BuildExecutor } from './block_placer.js';

// Survival mode coordinator
export { SurvivalBuildCoordinator } from './survival_coordinator.js';

// Main building manager
export { BuildingManager } from './building_manager.js';

/**
 * Module Structure:
 *
 * building/
 * ├── index.js                    ← You are here
 * ├── schematic_loader.js         ← Loads .schem files
 * ├── schematic_registry.js       ← Manages available schematics
 * ├── block_placer.js             ← BlockPlacer + BuildExecutor
 * ├── survival_coordinator.js     ← Material gathering & survival mode
 * ├── building_manager.js         ← Main API/orchestrator
 * └── utils/
 *     └── helpers.js              ← PlayerLocator, BlockOrientation, MaterialClassifier
 */
