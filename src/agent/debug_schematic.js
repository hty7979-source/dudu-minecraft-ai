// Debug script to examine real schematic structure
import fs from 'fs';
import path from 'path';
import prismarineSchematic from 'prismarine-schematic';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugSchematic() {
  try {
    console.log('🔍 Debugging real schematic structure...');
    
    const schematicPath = path.join(__dirname, '..', '..', 'schematics', 'houses', 'platte.schem');
    const fileBuffer = fs.readFileSync(schematicPath);
    
    console.log('📁 File size:', fileBuffer.length, 'bytes');
    
    const Schematic = prismarineSchematic.Schematic;
    console.log('📋 Schematic class:', Schematic);
    
    const schematicData = Schematic.read(fileBuffer);
    console.log('📊 Loaded schematic object:');
    console.log('Type:', typeof schematicData);
    console.log('Constructor:', schematicData.constructor.name);
    console.log('Available properties:', Object.keys(schematicData));
    
    // Überprüfe verschiedene mögliche Properties
    console.log('\n🔍 Checking various properties:');
    console.log('width:', schematicData.width);
    console.log('height:', schematicData.height);  
    console.log('length:', schematicData.length);
    console.log('size:', schematicData.size);
    console.log('start:', schematicData.start);
    console.log('end:', schematicData.end);
    
    if (schematicData.start && schematicData.end) {
      const size = {
        x: schematicData.end.x - schematicData.start.x + 1,
        y: schematicData.end.y - schematicData.start.y + 1,
        z: schematicData.end.z - schematicData.start.z + 1
      };
      console.log('Calculated size from start/end:', size);
    }
    
    // Check for blocks
    console.log('\n🧱 Checking for blocks:');
    console.log('Has blocks property:', 'blocks' in schematicData);
    console.log('Has palette property:', 'palette' in schematicData);
    
    // Try to iterate through blocks
    try {
      let blockCount = 0;
      const materials = {};
      
      schematicData.forEach((pos, block) => {
        blockCount++;
        if (block && block.name) {
          materials[block.name] = (materials[block.name] || 0) + 1;
        }
        if (blockCount < 10) { // Only log first few blocks
          console.log(`Block at ${pos.x},${pos.y},${pos.z}:`, block);
        }
      });
      
      console.log('Total blocks found:', blockCount);
      console.log('Materials found:', materials);
      
    } catch (error) {
      console.log('Error iterating blocks:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  debugSchematic();
}

export { debugSchematic };