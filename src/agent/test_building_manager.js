// Test BuildingManager ohne vollständigen Bot
import { BuildingManager } from './building_manager.js';

// Mock Bot-Objekt für Tests
const mockBot = {
  game: { gameMode: 'creative' },
  entity: { 
    position: { x: 0, y: 64, z: 0 },
    yaw: 0 
  },
  inventory: {
    items: () => []
  },
  chat: (message) => console.log('🤖 Bot says:', message)
};

// Mock Agent-Objekt
const mockAgent = {
  bot: mockBot
};

async function testBuildingManager() {
  console.log('🧪 Testing BuildingManager...');
  console.log('Debug: Function started');
  
  try {
    const buildingManager = new BuildingManager(mockBot, mockAgent);
    
    // Test 1: Liste Schematics
    console.log('\n📋 Test 1: List Schematics');
    const schematics = buildingManager.listSchematics();
    console.log('Available schematics:', schematics);
    
    // Test 2: Kategorien
    console.log('\n📂 Test 2: List by Category');
    const byCategory = buildingManager.listSchematicsByCategory();
    console.log('By category:', byCategory);
    
    // Test 3: Finde Schematic
    console.log('\n🔍 Test 3: Find Schematic');
    const foundHouse = buildingManager.findSchematic('platte');
    console.log('Found platte:', foundHouse ? foundHouse.name : 'not found');
    
    const foundStorage = buildingManager.findSchematic('tiny_storage');
    console.log('Found tiny_storage:', foundStorage ? foundStorage.name : 'not found');
    
    // Test 4: Schematic Info
    console.log('\n📄 Test 4: Schematic Info');
    if (foundHouse) {
      const info = buildingManager.getSchematicInfo('platte');
      console.log('Info for platte:');
      console.log(info);
    }
    
    // Test 5: Build Position berechnen
    console.log('\n📐 Test 5: Calculate Build Position');
    const buildPos = buildingManager.calculateBuildPosition(
      mockBot.entity.position,
      mockBot.entity.yaw,
      { x: 5, y: 3, z: 5 }
    );
    console.log('Build position:', buildPos);
    
    // Test 6: Material Check
    console.log('\n🧱 Test 6: Material Check');
    if (foundHouse) {
      try {
        const materialCheck = await buildingManager.checkMaterials(foundHouse);
        console.log('Material check result:', materialCheck);
      } catch (error) {
        console.log('Material check failed (expected for test files):', error.message);
      }
    }
    
    // Test 7: Simuliere Build Command
    console.log('\n🏗️ Test 7: Test Real Schematic Loading');
    if (foundHouse) {
      try {
        console.log('Attempting to load real schematic:', foundHouse.name);
        const materialCheck = await buildingManager.checkMaterials(foundHouse);
        console.log('✅ Real schematic loaded successfully!');
        console.log('Materials analysis:', materialCheck);
        console.log('Schematic size:', foundHouse.size);
      } catch (error) {
        console.log('❌ Real schematic loading failed:', error.message);
      }
    }
    
    console.log('\n✅ BuildingManager test completed successfully!');
    
  } catch (error) {
    console.error('❌ BuildingManager test failed:', error);
  }
}

console.log('Debug: Script starting...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Debug: Condition matched, calling testBuildingManager');
  testBuildingManager();
} else {
  console.log('Debug: Condition not matched, running anyway for testing');
  testBuildingManager().catch(console.error);
}

export { testBuildingManager };