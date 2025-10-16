import fs from 'fs';
import zlib from 'zlib';
import prismarineSchematic from 'prismarine-schematic';
import nbt from 'prismarine-nbt';

/**
 * SchematicLoader - Verantwortlich für das Laden und Parsen von Schematics
 * Unterstützt .schem und .schematic Formate (komprimiert und unkomprimiert)
 */
export class SchematicLoader {
  constructor(schematicsPath) {
    this.schematicsPath = schematicsPath;
  }

  async loadSchematic(filePath) {
    console.log(`📖 Loading schematic: ${filePath}`);

    let fileBuffer = fs.readFileSync(filePath);
    const isGzipped = fileBuffer.length >= 2 && fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b;

    if (isGzipped) {
      fileBuffer = zlib.gunzipSync(fileBuffer);
    }

    const Schematic = prismarineSchematic.Schematic;

    // Versuche verschiedene Lade-Methoden
    try {
      return await Schematic.read(fileBuffer, 'schem');
    } catch (error) {
      console.log(`⚠️ Standard load failed, trying NBT parse...`);
      return await this.parseWorldEditNBT(fileBuffer);
    }
  }

  async parseWorldEditNBT(buffer) {
    const { parsed } = await nbt.parse(buffer);
    const schematicData = parsed.value.Schematic?.value;

    if (!schematicData) {
      throw new Error('Invalid NBT structure');
    }

    const width = schematicData.Width?.value || 0;
    const height = schematicData.Height?.value || 0;
    const length = schematicData.Length?.value || 0;

    const palette = this.extractPalette(schematicData);
    const blockData = schematicData.Blocks?.value?.Data?.value;

    return this.createSchematicObject(width, height, length, palette, blockData);
  }

  extractPalette(schematicData) {
    const palette = {};
    const blocksData = schematicData.Blocks?.value;

    if (blocksData?.Palette?.value) {
      for (const [blockName, blockId] of Object.entries(blocksData.Palette.value)) {
        // Keep full block state string with properties
        palette[blockName] = blockId.value || 0;
      }
    }

    return palette;
  }

  /**
   * Parse block state string to extract name and properties
   * Example: "minecraft:oak_stairs[facing=north,half=bottom]"
   * Returns: { name: "oak_stairs", properties: { facing: "north", half: "bottom" } }
   */
  parseBlockState(blockString) {
    // Remove minecraft: prefix if present
    const cleaned = blockString.replace('minecraft:', '');

    // Match pattern: blockname[prop1=val1,prop2=val2]
    const match = cleaned.match(/^([^\[]+)(?:\[(.+)\])?$/);

    if (!match) {
      return { name: cleaned, properties: {} };
    }

    const name = match[1];
    const properties = {};

    if (match[2]) {
      // Parse properties
      match[2].split(',').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          properties[key.trim()] = value.trim();
        }
      });
    }

    return { name, properties };
  }

  createSchematicObject(width, height, length, palette, blockData) {
    const idToName = {};
    for (const [name, id] of Object.entries(palette)) {
      idToName[id] = name;
    }

    // Store reference to parseBlockState for use in forEach
    const parseBlockState = this.parseBlockState.bind(this);

    return {
      width: length,
      height: height,
      length: width,
      palette: palette,
      blockData: blockData,

      forEach: function(callback) {
        for (let y = 0; y < height; y++) {
          for (let z = 0; z < length; z++) {
            for (let x = 0; x < width; x++) {
              const index = y * width * length + z * width + x;
              const blockId = blockData[index];
              const blockStateString = idToName[blockId] || 'minecraft:air';

              // Parse block state to extract name and properties
              const { name, properties } = parseBlockState(blockStateString);

              callback({ x, y, z }, { name, properties });
            }
          }
        }
      }
    };
  }
}
