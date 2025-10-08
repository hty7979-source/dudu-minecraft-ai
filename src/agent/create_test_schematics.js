// Script zum Erstellen einer Test-Schematic für das Building-System
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prismarineSchematic from 'prismarine-schematic';
import { Vec3 } from 'vec3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTestSchematic() {
  console.log('🔨 Creating test schematic...');
  
  try {
    const Schematic = prismarineSchematic.Schematic;
    
    // Erstelle eine 5x3x5 Test-Struktur
    const width = 5;
    const height = 3; 
    const length = 5;
    
    // Schematic mit Minecraft-Version erstellen
    const schematic = new Schematic('1.20.1', width, height, length);
    
    console.log('📐 Schematic size:', width, 'x', height, 'x', length);
    
    // Fülle die Schematic mit einfachen Blöcken
    // Boden (Y=0): Holzplanken
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        schematic.setBlock(new Vec3(x, 0, z), {
          name: 'oak_planks',
          properties: {}
        });
      }
    }
    
    // Wände (Y=1): Nur Außenkanten, Holzplanken
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        // Nur Außenkanten
        if (x === 0 || x === width-1 || z === 0 || z === length-1) {
          // Aber nicht alle - lasse Platz für eine Tür
          if (!(x === 2 && z === 0)) { // Tür in der Mitte der Vorderseite
            schematic.setBlock({x, y: 1, z}, {
              name: 'oak_planks',
              properties: {}
            });
          }
        }
      }
    }
    
    // Dach (Y=2): Holzplanken
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        schematic.setBlock({x, y: 2, z}, {
          name: 'oak_planks',
          properties: {}
        });
      }
    }
    
    // Ein Fenster (ersetze eine Wand durch Glas)
    schematic.setBlock({x: 1, y: 1, z: 4}, {
      name: 'glass',
      properties: {}
    });
    
    console.log('🔨 Building blocks placed');
    
    // Speichere Schematic
    const outputPath = path.join(__dirname, '..', '..', 'schematics', 'houses', 'test_house.schem');
    
    // Write methode verwenden
    const buffer = schematic.write();
    fs.writeFileSync(outputPath, buffer);
    
    console.log('✅ Test schematic saved to:', outputPath);
    console.log('📊 File size:', (buffer.length / 1024).toFixed(1), 'KB');
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Error creating test schematic:', error);
    throw error;
  }
}

// Erstelle auch eine Utility-Struktur
async function createUtilitySchematic() {
  console.log('🔧 Creating utility test schematic...');
  
  try {
    const Schematic = prismarineSchematic.Schematic;
    
    // 3x2x3 Lagerschuppen
    const width = 3;
    const height = 2;
    const length = 3;
    
    const schematic = new Schematic('1.20.1', width, height, length);
    
    // Boden: Steinplatten
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        schematic.setBlock({x, y: 0, z}, {
          name: 'stone_slab',
          properties: {}
        });
      }
    }
    
    // Wände: Cobblestone
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < length; z++) {
          // Nur Außenkanten
          if (x === 0 || x === width-1 || z === 0 || z === length-1) {
            if (y > 0) { // Nicht den Boden überschreiben
              schematic.setBlock({x, y, z}, {
                name: 'cobblestone',
                properties: {}
              });
            }
          }
        }
      }
    }
    
    // Tür vorne mittig
    schematic.setBlock({x: 1, y: 1, z: 0}, {
      name: 'air',
      properties: {}
    });
    
    // Truhe innen
    schematic.setBlock({x: 1, y: 1, z: 1}, {
      name: 'chest',
      properties: {}
    });
    
    const outputPath = path.join(__dirname, '..', '..', 'schematics', 'utility', 'small_storage.schem');
    const buffer = schematic.write();
    fs.writeFileSync(outputPath, buffer);
    
    console.log('✅ Utility schematic saved to:', outputPath);
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Error creating utility schematic:', error);
    throw error;
  }
}

// Führe aus wenn direkt aufgerufen
if (import.meta.url === `file://${process.argv[1]}` || process.argv[2] === 'force') {
  console.log('🏗️ Creating test schematics for building system...');
  
  Promise.all([
    createTestSchematic(),
    createUtilitySchematic()
  ])
  .then((paths) => {
    console.log('\n🎉 All test schematics created successfully!');
    console.log('📁 Created files:');
    paths.forEach(p => console.log('   -', p));
    console.log('\n💡 Now you can test the building system with:');
    console.log('   !buildings           - List all buildings');
    console.log('   !building info test_house  - Get details');
    console.log('   !build test_house    - Build the house');
  })
  .catch(console.error);
} else {
  console.log('Use: node create_test_schematics.js force');
}

export { createTestSchematic, createUtilitySchematic };