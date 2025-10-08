// Test-Script für Schematic-Loading
import fs from 'fs';
import path from 'path';
import mineflayerBuilder from 'mineflayer-builder';
import prismarineSchematic from 'prismarine-schematic';
import { fileURLToPath } from 'url';

const { Build } = mineflayerBuilder;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testLoadSchematic() {
  console.log('🔧 Testing Schematic Loading System...');
  console.log('Debug: Function called successfully');
  
  const schematicsPath = path.join(__dirname, '..', '..', 'schematics');
  console.log(`📁 Checking schematics directory: ${schematicsPath}`);
  
  if (!fs.existsSync(schematicsPath)) {
    console.log('❌ Schematics directory not found');
    return;
  }
  
  // Scanne alle Kategorien
  const categories = ['houses', 'utility', 'decorative'];
  let totalSchematics = 0;
  
  for (const category of categories) {
    const categoryPath = path.join(schematicsPath, category);
    if (fs.existsSync(categoryPath)) {
      const files = fs.readdirSync(categoryPath)
        .filter(f => f.endsWith('.schem') || f.endsWith('.schematic'));
      
      console.log(`📋 ${category}: ${files.length} schematics found`);
      totalSchematics += files.length;
      
      for (const file of files) {
        console.log(`  - ${file}`);
        
        // Versuche erste Schematic zu laden (als Test)
        if (files.indexOf(file) === 0 && files.length > 0) {
          try {
            const filePath = path.join(categoryPath, file);
            const fileBuffer = fs.readFileSync(filePath);
            
            // Verwende prismarine-schematic direkt zum laden
            console.log('Debug: prismarineSchematic methods:', Object.keys(prismarineSchematic));
            const Schematic = prismarineSchematic.Schematic || prismarineSchematic.default?.Schematic;
            
            if (!Schematic) {
              throw new Error('Schematic constructor not found');
            }
            
            const schematic = Schematic.parse ? Schematic.parse(fileBuffer) : 'Parse method not available';
            
            console.log(`  ✅ Successfully loaded: ${file}`);
            console.log(`     Size: ${schematic.width}x${schematic.height}x${schematic.length}`);
            console.log(`     Blocks in schematic: ${schematic.blocks ? schematic.blocks.length : 'Unknown'}`);
            
            // Einfachere Material-Analyse falls möglich
            if (schematic.palette) {
              console.log(`     Block types: ${Object.keys(schematic.palette).join(', ')}`);
            }
            
          } catch (error) {
            console.log(`  ❌ Failed to load ${file}: ${error.message}`);
          }
        }
      }
    } else {
      console.log(`📋 ${category}: directory not found`);
    }
  }
  
  console.log(`\n📊 Total schematics found: ${totalSchematics}`);
  
  if (totalSchematics === 0) {
    console.log('\n💡 To test the system, add some .schem files to the schematics folders:');
    console.log('   - schematics/houses/');
    console.log('   - schematics/utility/'); 
    console.log('   - schematics/decorative/');
    console.log('\n🎮 You can create schematics using WorldEdit in Minecraft:');
    console.log('   1. Build a structure in Creative mode');
    console.log('   2. Use //pos1 and //pos2 to mark the area');
    console.log('   3. Use //schem save <name> to save it');
    console.log('   4. Copy the .schem file to the appropriate folder');
  }
}

// Nur ausführen wenn direkt aufgerufen
console.log('Debug: Script starting...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Debug: Condition matched, calling testLoadSchematic');
  testLoadSchematic().catch(console.error);
} else {
  console.log('Debug: Condition not matched, running anyway for testing');
  testLoadSchematic().catch(console.error);
}

export { testLoadSchematic };