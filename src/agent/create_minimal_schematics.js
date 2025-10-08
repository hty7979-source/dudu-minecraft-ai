// Erstelle eine minimal valide .schem Datei für Tests
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Erstelle eine einfache NBT-Struktur (vereinfacht)
// Dies ist ein Workaround bis wir echte Schematics haben
function createMinimalSchematic() {
  // Erstelle ein sehr einfaches NBT-Format (vereinfacht)
  // Das ist nur für Tests, echte Schematics sollten mit WorldEdit erstellt werden
  const housePath = path.join(__dirname, '..', '..', 'schematics', 'houses', 'tiny_test.schem');
  
  // Erstelle minimal gültige Daten
  const minimalData = Buffer.from([
    // NBT Header - extrem vereinfacht
    0x0A, 0x00, 0x00, // Compound start
    0x09, 0x00, 0x06, 0x42, 0x6C, 0x6F, 0x63, 0x6B, 0x73, // "Blocks" 
    0x07, 0x00, 0x00, 0x00, 0x08, // List of bytes, length 8
    0x01, 0x01, 0x01, 0x01, // 4 blocks (simple)
    0x01, 0x01, 0x01, 0x01, // 4 more blocks
    0x00 // End compound
  ]);
  
  fs.writeFileSync(housePath, minimalData);
  console.log('📁 Created minimal test schematic at:', housePath);
  
  // Auch für utility
  const utilityPath = path.join(__dirname, '..', '..', 'schematics', 'utility', 'tiny_storage.schem');
  fs.writeFileSync(utilityPath, minimalData);
  console.log('📁 Created minimal utility schematic at:', utilityPath);
  
  return [housePath, utilityPath];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createMinimalSchematic();
}

export { createMinimalSchematic };