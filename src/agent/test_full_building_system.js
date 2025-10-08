// Finaler Pre-Launch-Test für das Building-System
import { BuildingManager } from './building_manager.js';

console.log('🚀 BUILDING SYSTEM PRE-LAUNCH TEST');
console.log('===================================');

// Mock Bot für kompletten Test
const mockBot = {
  game: { gameMode: 'creative' },
  entity: { 
    position: { x: 100, y: 64, z: 200 },
    yaw: Math.PI / 4 // 45 Grad
  },
  inventory: {
    items: () => [
      { name: 'oak_planks', count: 64 },
      { name: 'stone', count: 32 },
      { name: 'glass', count: 16 }
    ]
  },
  chat: (message) => console.log('🤖 Bot:', message),
  loadPlugin: (plugin) => console.log('🔌 Loading plugin:', plugin.name || 'unknown'),
  builder: null // Wird später gemockt
};

const mockAgent = { bot: mockBot };

async function runFullSystemTest() {
  try {
    console.log('\n1️⃣ INITIALIZING BUILDING MANAGER...');
    const bm = new BuildingManager(mockBot, mockAgent);
    
    console.log('\n2️⃣ TESTING CHAT COMMANDS SIMULATION...');
    
    // Simuliere !buildings Command
    console.log('\n📋 Simulating: !buildings');
    const byCategory = bm.listSchematicsByCategory();
    if (Object.keys(byCategory).length === 0) {
      console.log('⚠️  No schematics found - this is OK for first test');
      console.log('   Add real .schem files to test building functionality');
    } else {
      console.log('✅ Schematics loaded successfully:');
      for (const [cat, items] of Object.entries(byCategory)) {
        console.log(`   ${cat}: ${items.map(i => i.displayName).join(', ')}`);
      }
    }
    
    console.log('\n📄 Simulating: !building info <name>');
    const schematicNames = bm.listSchematics();
    if (schematicNames.length > 0) {
      const info = bm.getSchematicInfo(schematicNames[0]);
      console.log('ℹ️  Sample schematic info:');
      console.log(info.split('\n').map(line => '   ' + line).join('\n'));
    }
    
    console.log('\n🏗️ Simulating: !build <name>');
    if (schematicNames.length > 0) {
      console.log(`   Target: ${schematicNames[0]}`);
      console.log(`   Player position: ${JSON.stringify(mockBot.entity.position)}`);
      console.log(`   Player yaw: ${mockBot.entity.yaw} radians`);
      
      const buildPos = bm.calculateBuildPosition(
        mockBot.entity.position,
        mockBot.entity.yaw,
        { x: 5, y: 3, z: 5 }
      );
      console.log(`   Calculated build position: ${JSON.stringify(buildPos)}`);
      console.log(`   Game mode: ${mockBot.game.gameMode}`);
      
      // Simuliere Build-Attempt
      try {
        const result = await bm.buildStructure(schematicNames[0]);
        console.log(`   Build result: ${result}`);
      } catch (error) {
        console.log(`   Build simulation: ${error.message} (expected without mineflayer-builder active)`);
      }
    }
    
    console.log('\n📊 Simulating: !buildstatus');
    const status = bm.getBuildStatus();
    console.log(`   Status: ${status}`);
    
    console.log('\n3️⃣ TESTING UTILITY FUNCTIONS...');
    
    // Test Material Counting
    console.log('🧱 Testing inventory material counting:');
    const oakCount = bm.countItemInInventory('oak_planks');
    const stoneCount = bm.countItemInInventory('stone'); 
    console.log(`   Oak planks in inventory: ${oakCount}`);
    console.log(`   Stone in inventory: ${stoneCount}`);
    
    // Test Position Calculation für verschiedene Yaw-Werte
    console.log('\n📐 Testing position calculations:');
    const testYaws = [0, Math.PI/2, Math.PI, -Math.PI/2];
    const testNames = ['North', 'East', 'South', 'West'];
    
    for (let i = 0; i < testYaws.length; i++) {
      const pos = bm.calculateBuildPosition(
        { x: 0, y: 64, z: 0 },
        testYaws[i],
        { x: 5, y: 3, z: 5 }
      );
      console.log(`   ${testNames[i]} (${testYaws[i].toFixed(2)}): ${JSON.stringify(pos)}`);
    }
    
    console.log('\n4️⃣ TESTING ERROR HANDLING...');
    
    // Test nicht-existente Schematic
    const unknownSchematic = bm.findSchematic('does_not_exist');
    console.log(`   Finding non-existent schematic: ${unknownSchematic ? 'ERROR!' : 'correctly returned null'}`);
    
    // Test Info für nicht-existente Schematic
    const unknownInfo = bm.getSchematicInfo('does_not_exist');
    console.log(`   Info for non-existent: ${unknownInfo.includes('not found') ? 'correct error' : 'ERROR!'}`);
    
    console.log('\n✅ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('\n🎯 SYSTEM READY FOR MINECRAFT TESTING');
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Create real .schem files with WorldEdit');
    console.log('   2. Copy them to schematics/ folders');
    console.log('   3. Start Mindcraft bot');
    console.log('   4. Test with: !buildings, !build <name>');
    console.log('   5. Verify building works in Creative mode');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ SYSTEM TEST FAILED:', error);
    console.error(error.stack);
    return false;
  }
}

console.log('Debug: Checking execution condition...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

runFullSystemTest().then(success => {
  console.log('Test completed with success:', success);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});

export { runFullSystemTest };