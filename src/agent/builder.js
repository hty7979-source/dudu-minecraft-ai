import { Vec3 } from 'vec3';
import * as skills from './library/skills.js';
import settings from '../../settings.js';

const blockPlaceDelay = settings.block_place_delay == null ? 400 : settings.block_place_delay;

export class Builder {
    constructor(agent) {
        this.agent = agent;
        this.bot = agent.bot;
        
        // Erweiterte Sonderblöcke mit ihren Eigenschaften
        this.specialBlocks = new Map([
            // Betten (alle 16 Farben)
            ['white_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['orange_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['magenta_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['light_blue_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['yellow_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['lime_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['pink_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['gray_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['light_gray_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['cyan_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['purple_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['blue_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['brown_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['green_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['red_bed', { type: 'bed', parts: 2, needsSupport: true }],
            ['black_bed', { type: 'bed', parts: 2, needsSupport: true }],
            
            // Türen
            ['oak_door', { type: 'door', parts: 2, needsSupport: true }],
            ['spruce_door', { type: 'door', parts: 2, needsSupport: true }],
            ['birch_door', { type: 'door', parts: 2, needsSupport: true }],
            ['jungle_door', { type: 'door', parts: 2, needsSupport: true }],
            ['acacia_door', { type: 'door', parts: 2, needsSupport: true }],
            ['dark_oak_door', { type: 'door', parts: 2, needsSupport: true }],
            ['iron_door', { type: 'door', parts: 2, needsSupport: true }],
            ['warped_door', { type: 'door', parts: 2, needsSupport: true }],
            ['crimson_door', { type: 'door', parts: 2, needsSupport: true }],
            
            // Hohe Pflanzen
            ['sunflower', { type: 'tall_plant', parts: 2, needsSupport: true }],
            ['lilac', { type: 'tall_plant', parts: 2, needsSupport: true }],
            ['rose_bush', { type: 'tall_plant', parts: 2, needsSupport: true }],
            ['peony', { type: 'tall_plant', parts: 2, needsSupport: true }],
            ['tall_grass', { type: 'tall_plant', parts: 2, needsSupport: true }],
            ['large_fern', { type: 'tall_plant', parts: 2, needsSupport: true }],
            
            // Zäune
            ['oak_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            ['spruce_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            ['birch_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            ['jungle_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            ['acacia_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            ['dark_oak_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            ['nether_brick_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            ['warped_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            ['crimson_fence', { type: 'fence', parts: 1, needsSupport: true, connects: true }],
            
            // Zaun-Tore
            ['oak_fence_gate', { type: 'fence_gate', parts: 1, needsSupport: true }],
            ['spruce_fence_gate', { type: 'fence_gate', parts: 1, needsSupport: true }],
            ['birch_fence_gate', { type: 'fence_gate', parts: 1, needsSupport: true }],
            ['jungle_fence_gate', { type: 'fence_gate', parts: 1, needsSupport: true }],
            ['acacia_fence_gate', { type: 'fence_gate', parts: 1, needsSupport: true }],
            ['dark_oak_fence_gate', { type: 'fence_gate', parts: 1, needsSupport: true }],
            ['warped_fence_gate', { type: 'fence_gate', parts: 1, needsSupport: true }],
            ['crimson_fence_gate', { type: 'fence_gate', parts: 1, needsSupport: true }],
            
            // Mauern
            ['cobblestone_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['mossy_cobblestone_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['stone_brick_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['mossy_stone_brick_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['brick_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['prismarine_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['red_sandstone_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['sandstone_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['granite_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['diorite_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['andesite_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['blackstone_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['polished_blackstone_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            ['polished_blackstone_brick_wall', { type: 'wall', parts: 1, needsSupport: true, connects: true }],
            
            // Treppen
            ['oak_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['spruce_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['birch_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['jungle_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['acacia_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['dark_oak_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['stone_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['cobblestone_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['brick_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['stone_brick_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['nether_brick_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['sandstone_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['red_sandstone_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            ['quartz_stairs', { type: 'stairs', parts: 1, needsSupport: true }],
            
            // Stufen/Slabs
            ['oak_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['spruce_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['birch_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['jungle_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['acacia_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['dark_oak_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['stone_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['cobblestone_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['brick_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['stone_brick_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['nether_brick_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['sandstone_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['red_sandstone_slab', { type: 'slab', parts: 1, needsSupport: false }],
            ['quartz_slab', { type: 'slab', parts: 1, needsSupport: false }],
            
            // Redstone-Komponenten
            ['redstone_wire', { type: 'redstone', parts: 1, needsSupport: true, item: 'redstone' }],
            ['repeater', { type: 'redstone', parts: 1, needsSupport: true }],
            ['comparator', { type: 'redstone', parts: 1, needsSupport: true }],
            ['lever', { type: 'redstone', parts: 1, needsSupport: true }],
            ['stone_button', { type: 'redstone', parts: 1, needsSupport: true }],
            ['oak_button', { type: 'redstone', parts: 1, needsSupport: true }],
            ['tripwire_hook', { type: 'redstone', parts: 1, needsSupport: true }],
            
            // Schilder
            ['oak_sign', { type: 'sign', parts: 1, needsSupport: true }],
            ['spruce_sign', { type: 'sign', parts: 1, needsSupport: true }],
            ['birch_sign', { type: 'sign', parts: 1, needsSupport: true }],
            ['jungle_sign', { type: 'sign', parts: 1, needsSupport: true }],
            ['acacia_sign', { type: 'sign', parts: 1, needsSupport: true }],
            ['dark_oak_sign', { type: 'sign', parts: 1, needsSupport: true }],
            ['oak_wall_sign', { type: 'wall_sign', parts: 1, needsSupport: true }],
            ['spruce_wall_sign', { type: 'wall_sign', parts: 1, needsSupport: true }],
            ['birch_wall_sign', { type: 'wall_sign', parts: 1, needsSupport: true }],
            ['jungle_wall_sign', { type: 'wall_sign', parts: 1, needsSupport: true }],
            ['acacia_wall_sign', { type: 'wall_sign', parts: 1, needsSupport: true }],
            ['dark_oak_wall_sign', { type: 'wall_sign', parts: 1, needsSupport: true }],
        ]);

        console.log(`[Builder] Initialisiert mit ${this.specialBlocks.size} unterstützten Sonderblöcken`);
    }

    /**
     * Hauptfunktion zum Platzieren von Blöcken - nutzt korrekte Mineflayer API
     */
    async placeBlock(blockName, position, options = {}) {
        const pos = new Vec3(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
        
        console.log(`[Builder] Platziere ${blockName} bei ${pos.x}, ${pos.y}, ${pos.z}`);
        
        // Prüfe ob Block im Inventar verfügbar ist
        const itemName = this.getItemNameForBlock(blockName);
        const item = this.bot.inventory.items().find(item => item.name === itemName);
        
        if (!item && !this.bot.modes.isOn('cheat')) {
            console.log(`[Builder] ❌ ${itemName} nicht im Inventar`);
            return false;
        }
        
        // Für Sonderblöcke: Erweiterte Prüfungen
        if (this.specialBlocks.has(blockName)) {
            const blockInfo = this.specialBlocks.get(blockName);
            console.log(`[Builder] Erkenne Sonderblock: ${blockName} (Typ: ${blockInfo.type})`);
            
            // Prüfe Support für Blöcke die ihn brauchen
            if (blockInfo.needsSupport) {
                if (!this.hasValidSupport(pos, blockInfo.type)) {
                    console.log(`[Builder] ❌ Kein gültiger Support für ${blockName} bei ${pos.x}, ${pos.y}, ${pos.z}`);
                    return false;
                }
            }
            
            // Prüfe zweite Position für mehrteilige Blöcke
            if (blockInfo.parts === 2) {
                const secondPos = this.getSecondBlockPos(pos, blockInfo.type, options.direction);
                if (!this.isPositionFree(secondPos)) {
                    console.log(`[Builder] ❌ Zweite Position ${secondPos.x}, ${secondPos.y}, ${secondPos.z} ist nicht frei`);
                    return false;
                }
                if (blockInfo.needsSupport && !this.hasValidSupport(secondPos, blockInfo.type)) {
                    console.log(`[Builder] ❌ Kein gültiger Support für zweite Position bei ${secondPos.x}, ${secondPos.y}, ${secondPos.z}`);
                    return false;
                }
            }
        }
        
        // Verwende die vorhandene skills.placeBlock Funktion (nutzt korrekte Mineflayer API)
        const success = await skills.placeBlock(this.bot, blockName, pos.x, pos.y, pos.z, options.placeOn || 'bottom');
        
        if (success) {
            console.log(`[Builder] ✅ ${blockName} erfolgreich platziert`);
        } else {
            console.log(`[Builder] ❌ Fehler beim Platzieren von ${blockName}`);
        }
        
        return success;
    }
    
    /**
     * Ermittelt den korrekten Item-Namen für einen Block
     */
    getItemNameForBlock(blockName) {
        const blockInfo = this.specialBlocks.get(blockName);
        if (blockInfo && blockInfo.item) {
            return blockInfo.item;
        }
        
        // Standard: Block-Name ist gleich Item-Name
        return blockName;
    }
    
    /**
     * Prüft ob ein Block gültigen Support hat
     */
    hasValidSupport(position, blockType) {
        try {
            switch (blockType) {
                case 'door':
                case 'fence_gate':
                case 'sign':
                case 'bed':
                case 'tall_plant':
                    // Benötigt festen Block darunter
                    const belowPos = new Vec3(position.x, position.y - 1, position.z);
                    const blockBelow = this.bot.blockAt(belowPos);
                    return blockBelow && this.isSolidBlock(blockBelow.name);
                    
                case 'fence':
                case 'wall':
                    // Kann auf festen Blöcken oder anderen Zäunen/Mauern stehen
                    const belowPos2 = new Vec3(position.x, position.y - 1, position.z);
                    const blockBelow2 = this.bot.blockAt(belowPos2);
                    return blockBelow2 && (this.isSolidBlock(blockBelow2.name) || 
                           blockBelow2.name.includes('fence') || blockBelow2.name.includes('wall'));
                    
                case 'stairs':
                case 'slab':
                    // Treppen und Stufen sind flexibler
                    const belowPos3 = new Vec3(position.x, position.y - 1, position.z);
                    const blockBelow3 = this.bot.blockAt(belowPos3);
                    return blockBelow3 && blockBelow3.name !== 'air';
                    
                case 'redstone':
                case 'wall_sign':
                    // Redstone und Wandschilder brauchen angrenzenden festen Block
                    return this.hasAdjacentSolidBlock(position);
                    
                default:
                    return true; // Andere Blöcke haben keine speziellen Support-Anforderungen
            }
        } catch (error) {
            console.log(`[Builder] Fehler beim Prüfen des Supports: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Prüft ob ein Block fest/solide ist
     */
    isSolidBlock(blockName) {
        const solidBlocks = [
            'stone', 'dirt', 'grass_block', 'cobblestone', 'oak_planks', 'spruce_planks', 
            'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks',
            'stone_bricks', 'bricks', 'sandstone', 'red_sandstone', 'quartz_block',
            'iron_block', 'gold_block', 'diamond_block', 'emerald_block',
            'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
            'bedrock', 'obsidian', 'netherrack', 'nether_bricks', 'end_stone'
        ];
        
        return solidBlocks.includes(blockName) || 
               blockName.includes('_block') || 
               blockName.includes('_ore') ||
               blockName.includes('_planks') ||
               blockName.includes('_log') ||
               blockName.includes('_wood');
    }
    
    /**
     * Prüft ob ein angrenzender fester Block existiert
     */
    hasAdjacentSolidBlock(position) {
        const adjacentOffsets = [
            new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
            new Vec3(0, 1, 0), new Vec3(0, -1, 0),
            new Vec3(0, 0, 1), new Vec3(0, 0, -1)
        ];
        
        for (const offset of adjacentOffsets) {
            const checkPos = position.plus(offset);
            try {
                const block = this.bot.blockAt(checkPos);
                if (block && this.isSolidBlock(block.name)) {
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
    }

    /**
     * Ermittelt die Richtung basierend auf der Bot-Ausrichtung
     */
    getDirectionFromBot() {
        const yaw = this.bot.entity.yaw;
        const normalizedYaw = ((yaw % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const degrees = normalizedYaw * (180 / Math.PI);
        
        if (degrees >= 315 || degrees < 45) return 'south';
        if (degrees >= 45 && degrees < 135) return 'west';
        if (degrees >= 135 && degrees < 225) return 'north';
        return 'east';
    }

    /**
     * Berechnet die Position des zweiten Blocks basierend auf Typ und Richtung
     */
    getSecondBlockPos(basePos, blockType, direction) {
        if (blockType === 'bed') {
            // Betten: zweiter Block in Blickrichtung
            switch (direction) {
                case 'north': return new Vec3(basePos.x, basePos.y, basePos.z - 1);
                case 'south': return new Vec3(basePos.x, basePos.y, basePos.z + 1);
                case 'east': return new Vec3(basePos.x + 1, basePos.y, basePos.z);
                case 'west': return new Vec3(basePos.x - 1, basePos.y, basePos.z);
                default: return new Vec3(basePos.x, basePos.y, basePos.z + 1);
            }
        } else if (blockType === 'door' || blockType === 'tall_plant') {
            // Türen und hohe Pflanzen: zweiter Block direkt darüber
            return new Vec3(basePos.x, basePos.y + 1, basePos.z);
        }
        
        return basePos;
    }

    /**
     * Prüft ob eine Position frei ist
     */
    isPositionFree(position) {
        try {
            const block = this.bot.blockAt(position);
            return block && (block.name === 'air' || block.name === 'water' || block.name === 'lava');
        } catch (error) {
            console.log(`[Builder] Fehler beim Prüfen der Position ${position.x}, ${position.y}, ${position.z}: ${error.message}`);
            return false;
        }
    }

    /**
     * Platziert mehrere Blöcke in einem Batch
     */
    async placeBatch(blocks) {
        const results = [];
        
        for (const blockData of blocks) {
            const result = await this.placeBlock(blockData.name, blockData.position, blockData.options || {});
            results.push({
                block: blockData.name,
                position: blockData.position,
                success: result
            });
            
            // Kurze Pause zwischen Blöcken
            await this.sleep(blockPlaceDelay);
        }
        
        return results;
    }

    /**
     * Baut eine Zaun-Linie zwischen zwei Punkten
     */
    async buildFenceLine(start, end, fenceType = 'oak_fence') {
        const results = [];
        const startVec = new Vec3(start.x, start.y, start.z);
        const endVec = new Vec3(end.x, end.y, end.z);
        
        // Berechne Richtung und Schritte
        const direction = endVec.minus(startVec).normalize();
        const distance = Math.ceil(startVec.distanceTo(endVec));
        
        for (let i = 0; i <= distance; i++) {
            const pos = startVec.plus(direction.scaled(i)).floor();
            const success = await this.placeBlock(fenceType, pos);
            results.push({ position: pos, success });
            
            if (blockPlaceDelay > 0) {
                await this.sleep(blockPlaceDelay);
            }
        }
        
        return results;
    }
    
    /**
     * Baut eine Mauer-Linie zwischen zwei Punkten
     */
    async buildWallLine(start, end, wallType = 'cobblestone_wall') {
        return await this.buildFenceLine(start, end, wallType);
    }
    
    /**
     * Baut Treppen (automatische Ausrichtung)
     */
    async buildStairs(positions, stairType = 'oak_stairs', direction = null) {
        const results = [];
        
        for (const pos of positions) {
            // Bestimme Richtung falls nicht angegeben
            const stairDirection = direction || this.getDirectionFromBot();
            
            // Verwende skills.placeBlock mit korrekter Ausrichtung
            const success = await skills.placeBlock(this.bot, stairType, pos.x, pos.y, pos.z, 'bottom');
            results.push({ position: pos, success });
            
            if (blockPlaceDelay > 0) {
                await this.sleep(blockPlaceDelay);
            }
        }
        
        return results;
    }
    
    /**
     * Baut eine Redstone-Schaltung
     */
    async buildRedstoneCircuit(pattern, startPos) {
        const results = [];
        
        for (const step of pattern) {
            const pos = new Vec3(
                startPos.x + step.offset.x,
                startPos.y + step.offset.y,
                startPos.z + step.offset.z
            );
            
            const success = await this.placeBlock(step.block, pos, step.options || {});
            results.push({ 
                block: step.block, 
                position: pos, 
                success 
            });
            
            if (blockPlaceDelay > 0) {
                await this.sleep(blockPlaceDelay);
            }
        }
        
        return results;
    }
    
    /**
     * Baut einen umschlossenen Bereich (Zaun/Mauer)
     */
    async buildEnclosure(corner1, corner2, material = 'oak_fence', includeGate = true, gatePosition = null) {
        const results = [];
        
        const minX = Math.min(corner1.x, corner2.x);
        const maxX = Math.max(corner1.x, corner2.x);
        const minZ = Math.min(corner1.z, corner2.z);
        const maxZ = Math.max(corner1.z, corner2.z);
        const y = corner1.y;
        
        // Bestimme Gate-Position falls nicht angegeben
        if (includeGate && !gatePosition) {
            gatePosition = new Vec3(Math.floor((minX + maxX) / 2), y, minZ);
        }
        
        const gateType = material.replace('_fence', '_fence_gate').replace('_wall', '_fence_gate');
        
        // Baue die vier Seiten
        const sides = [
            // Vorderseite (Z = minZ)
            { start: new Vec3(minX, y, minZ), end: new Vec3(maxX, y, minZ) },
            // Rückseite (Z = maxZ)  
            { start: new Vec3(minX, y, maxZ), end: new Vec3(maxX, y, maxZ) },
            // Linke Seite (X = minX)
            { start: new Vec3(minX, y, minZ), end: new Vec3(minX, y, maxZ) },
            // Rechte Seite (X = maxX)
            { start: new Vec3(maxX, y, minZ), end: new Vec3(maxX, y, maxZ) }
        ];
        
        for (const side of sides) {
            const sideResults = await this.buildFenceLine(side.start, side.end, material);
            results.push(...sideResults);
        }
        
        // Platziere Gate falls gewünscht
        if (includeGate && gatePosition) {
            const gateSuccess = await this.placeBlock(gateType, gatePosition);
            results.push({ position: gatePosition, success: gateSuccess, isGate: true });
        }
        
        return results;
    }
    
    /**
     * Hilfsfunktion für Pausen
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Gibt Debug-Informationen aus
     */
    getDebugInfo() {
        const botPos = this.bot.entity.position;
        const yaw = this.bot.entity.yaw;
        const direction = this.getDirectionFromBot();
        
        return {
            botPosition: { x: botPos.x.toFixed(1), y: botPos.y.toFixed(1), z: botPos.z.toFixed(1) },
            yaw: (yaw * (180 / Math.PI)).toFixed(1) + '°',
            direction: direction,
            supportedBlocks: this.specialBlocks.size,
            inventoryItems: this.bot.inventory.items().length,
            specialBlockTypes: {
                beds: Array.from(this.specialBlocks.keys()).filter(k => k.includes('bed')).length,
                doors: Array.from(this.specialBlocks.keys()).filter(k => k.includes('door')).length,
                fences: Array.from(this.specialBlocks.keys()).filter(k => k.includes('fence')).length,
                walls: Array.from(this.specialBlocks.keys()).filter(k => k.includes('wall')).length,
                stairs: Array.from(this.specialBlocks.keys()).filter(k => k.includes('stairs')).length,
                slabs: Array.from(this.specialBlocks.keys()).filter(k => k.includes('slab')).length,
                redstone: Array.from(this.specialBlocks.keys()).filter(k => this.specialBlocks.get(k).type === 'redstone').length
            }
        };
    }
}