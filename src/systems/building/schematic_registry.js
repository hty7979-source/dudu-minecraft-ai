import fs from 'fs';
import path from 'path';
import { SchematicLoader } from './schematic_loader.js';

/**
 * SchematicRegistry - Verwaltet verfügbare Schematics
 * Lädt Schematic-Metadaten und cached geladene Schematics
 */
export class SchematicRegistry {
  constructor(schematicsPath) {
    this.schematicsPath = schematicsPath;
    this.schematics = {};
    this.loader = new SchematicLoader(schematicsPath);
  }

  loadAll() {
    console.log('🗂️ Loading schematic registry...');
    const categories = ['houses', 'utility', 'decorative'];
    let loadedCount = 0;

    for (const category of categories) {
      const categoryPath = path.join(this.schematicsPath, category);
      if (!fs.existsSync(categoryPath)) continue;

      const files = fs.readdirSync(categoryPath)
        .filter(f => f.endsWith('.schem') || f.endsWith('.schematic'));

      for (const file of files) {
        const name = file.replace(/\.(schem|schematic)$/, '');
        const fullPath = path.join(categoryPath, file);
        const stats = fs.statSync(fullPath);

        this.schematics[name.toLowerCase()] = {
          name: name,
          displayName: name.replace(/_/g, ' '),
          category: category,
          path: fullPath,
          fileSize: stats.size,
          size: null,
          materials: null,
          loaded: false,
          schematicData: null
        };
        loadedCount++;
      }
    }

    console.log(`✅ Loaded ${loadedCount} schematics`);
    return loadedCount;
  }

  find(name) {
    const searchName = name.toLowerCase();

    if (this.schematics[searchName]) {
      return this.schematics[searchName];
    }

    for (const [schematicName, info] of Object.entries(this.schematics)) {
      if (schematicName.includes(searchName) || searchName.includes(schematicName)) {
        return info;
      }
    }

    return null;
  }

  list() {
    return Object.keys(this.schematics);
  }

  listByCategory() {
    const byCategory = {};
    for (const [name, info] of Object.entries(this.schematics)) {
      if (!byCategory[info.category]) byCategory[info.category] = [];
      byCategory[info.category].push(info);
    }
    return byCategory;
  }

  async loadSchematicData(schematicInfo) {
    if (schematicInfo.loaded && schematicInfo.schematicData) {
      return schematicInfo.schematicData;
    }

    const schematicData = await this.loader.loadSchematic(schematicInfo.path);

    schematicInfo.size = {
      x: schematicData.width,
      y: schematicData.height,
      z: schematicData.length
    };

    schematicInfo.materials = this.analyzeMaterials(schematicData);
    schematicInfo.schematicData = schematicData;
    schematicInfo.loaded = true;

    return schematicData;
  }

  analyzeMaterials(schematicData) {
    const materials = {};

    if (typeof schematicData.forEach === 'function') {
      schematicData.forEach((pos, block) => {
        if (block?.name && block.name !== 'minecraft:air' && block.name !== 'air') {
          const baseName = block.name.replace('minecraft:', '').split('[')[0];
          materials[baseName] = (materials[baseName] || 0) + 1;
        }
      });
    }

    return materials;
  }
}
