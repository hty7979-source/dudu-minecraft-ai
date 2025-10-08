import { Vec3 } from 'vec3';
import * as skills from '../library/skills.js';
import { Builder } from '../builder.js';

/**
 * Platziert ein Bett an der angegebenen Position
 * @param {Object} agent - Der Agent mit bot und builder
 * @param {string} color - Bettfarbe (z.B. 'red', 'white', 'blue')
 * @param {number} x - X-Koordinate
 * @param {number} y - Y-Koordinate  
 * @param {number} z - Z-Koordinate
 * @param {string} direction - Ausrichtung ('north', 'south', 'east', 'west')
 * @returns {Promise<boolean>} Erfolg der Platzierung
 */
export async function placeBed(agent, color = 'red', x, y, z, direction = null) {
    console.log(`[BuildingActions] Platziere ${color} Bett bei ${x}, ${y}, ${z}`);
    
    const bedName = `${color}_bed`;
    const position = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
    
    // Initialisiere Builder falls nicht vorhanden
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        // Prüfe ob Bot das Bett im Inventar hat
        const bedItem = agent.bot.inventory.items().find(item => 
            item.name === bedName || item.name.includes(color + '_bed')
        );
        
        if (!bedItem) {
            agent.bot.chat(`❌ Ich habe kein ${color} Bett im Inventar!`);
            console.log(`[BuildingActions] ${bedName} nicht im Inventar gefunden`);
            
            // Versuche das Bett zu craften oder zu sammeln
            const crafted = await skills.craftRecipe(agent.bot, bedName, 1);
            if (!crafted) {
                return false;
            }
        }
        
        // Berechne Richtung falls nicht angegeben
        if (!direction) {
            direction = agent.builder.getDirectionFromBot();
        }
        
        // Platziere das Bett
        const success = await agent.builder.placeBlock(bedName, position, { direction });
        
        if (success) {
            agent.bot.chat(`✅ ${color.charAt(0).toUpperCase() + color.slice(1)} Bett erfolgreich platziert!`);
            return true;
        } else {
            agent.bot.chat(`❌ Konnte ${color} Bett nicht platzieren - nicht genug Platz?`);
            return false;
        }
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Platzieren des Bettes: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Platzieren des Bettes: ${error.message}`);
        return false;
    }
}

/**
 * Baut ein einfaches 5x5 Haus mit Bett, Tür und Fenstern
 * @param {Object} agent - Der Agent
 * @param {number} x - Startposition X
 * @param {number} y - Startposition Y
 * @param {number} z - Startposition Z
 * @returns {Promise<boolean>} Erfolg des Baus
 */
export async function buildSimpleHouse(agent, x, y, z) {
    console.log(`[BuildingActions] Baue einfaches Haus bei ${x}, ${y}, ${z}`);
    agent.bot.chat(`🏗️ Baue ein einfaches Haus bei ${x}, ${y}, ${z}...`);
    
    // Initialisiere Builder
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        const startPos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
        const size = 5; // 5x5 Haus
        const height = 3;
        
        // 1. Boden legen
        agent.bot.chat('🔨 Lege Boden...');
        for (let dx = 0; dx < size; dx++) {
            for (let dz = 0; dz < size; dz++) {
                await skills.placeBlock(agent.bot, 'oak_planks', 
                    startPos.x + dx, startPos.y - 1, startPos.z + dz);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // 2. Wände bauen (mit Platz für Tür und Fenster)
        agent.bot.chat('🧱 Baue Wände...');
        
        // Vordere Wand (mit Tür in der Mitte)
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < height; dy++) {
                // Tür in der Mitte der vorderen Wand (2 Blöcke hoch)
                if (dx === Math.floor(size/2) && dy < 2) {
                    continue; // Platz für Tür freilassen
                }
                await skills.placeBlock(agent.bot, 'stone_bricks', 
                    startPos.x + dx, startPos.y + dy, startPos.z);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // Hintere Wand
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < height; dy++) {
                await skills.placeBlock(agent.bot, 'stone_bricks', 
                    startPos.x + dx, startPos.y + dy, startPos.z + size - 1);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // Linke und rechte Wand (mit Fenstern)
        for (let dz = 1; dz < size - 1; dz++) {
            for (let dy = 0; dy < height; dy++) {
                // Fenster auf Höhe 1 in der Mitte der Seitenwände
                const isWindow = dy === 1 && dz === Math.floor(size/2);
                
                // Linke Wand
                await skills.placeBlock(agent.bot, isWindow ? 'glass' : 'stone_bricks', 
                    startPos.x, startPos.y + dy, startPos.z + dz);
                
                // Rechte Wand
                await skills.placeBlock(agent.bot, isWindow ? 'glass' : 'stone_bricks', 
                    startPos.x + size - 1, startPos.y + dy, startPos.z + dz);
                
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // 3. Dach bauen
        agent.bot.chat('🏠 Baue Dach...');
        for (let dx = 0; dx < size; dx++) {
            for (let dz = 0; dz < size; dz++) {
                await skills.placeBlock(agent.bot, 'oak_planks', 
                    startPos.x + dx, startPos.y + height, startPos.z + dz);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // 4. Tür platzieren
        agent.bot.chat('🚪 Platziere Tür...');
        const doorPos = new Vec3(startPos.x + Math.floor(size/2), startPos.y, startPos.z);
        await agent.builder.placeBlock('oak_door', doorPos, { direction: 'north' });
        
        // 5. Bett im Haus platzieren
        agent.bot.chat('🛏️ Platziere Bett...');
        const bedPos = new Vec3(startPos.x + 1, startPos.y, startPos.z + size - 2);
        await agent.builder.placeBlock('red_bed', bedPos, { direction: 'east' });
        
        // 6. Fackel für Licht
        agent.bot.chat('💡 Platziere Beleuchtung...');
        await skills.placeBlock(agent.bot, 'torch', 
            startPos.x + Math.floor(size/2), startPos.y + 1, startPos.z + Math.floor(size/2), 'side');
        
        agent.bot.chat('✅ Haus fertiggestellt! Viel Spaß in deinem neuen Zuhause! 🏡');
        return true;
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Hausbau: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Hausbau: ${error.message}`);
        return false;
    }
}

/**
 * Baut eine Reihe von Betten
 * @param {Object} agent - Der Agent
 * @param {number} x - Startposition X
 * @param {number} y - Startposition Y
 * @param {number} z - Startposition Z
 * @param {number} count - Anzahl der Betten
 * @param {number} spacing - Abstand zwischen Betten
 * @param {string} color - Bettfarbe
 * @returns {Promise<boolean>} Erfolg des Baus
 */
export async function buildBedRow(agent, x, y, z, count = 5, spacing = 3, color = 'white') {
    console.log(`[BuildingActions] Baue ${count} ${color} Betten in einer Reihe`);
    agent.bot.chat(`🛏️ Baue ${count} ${color} Betten mit ${spacing} Blöcken Abstand...`);
    
    // Initialisiere Builder
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        let successCount = 0;
        
        for (let i = 0; i < count; i++) {
            const bedX = x + (i * spacing);
            const bedPos = new Vec3(bedX, y, z);
            
            // Prüfe und platziere Bodenblock falls nötig
            const floorPos = new Vec3(bedX, y - 1, z);
            const floorBlock = agent.bot.blockAt(floorPos);
            if (!floorBlock || floorBlock.name === 'air') {
                await skills.placeBlock(agent.bot, 'stone', floorPos.x, floorPos.y, floorPos.z);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Platziere Bett
            const success = await placeBed(agent, color, bedX, y, z, 'north');
            if (success) {
                successCount++;
                agent.bot.chat(`✅ Bett ${i + 1}/${count} platziert`);
            } else {
                agent.bot.chat(`❌ Bett ${i + 1}/${count} fehlgeschlagen`);
            }
            
            // Pause zwischen Betten
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (successCount === count) {
            agent.bot.chat(`✅ Alle ${count} ${color} Betten erfolgreich platziert! 🎉`);
            return true;
        } else {
            agent.bot.chat(`⚠️ ${successCount}/${count} Betten platziert`);
            return false;
        }
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Bauen der Bettreihe: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Bauen der Bettreihe: ${error.message}`);
        return false;
    }
}

/**
 * Platziert eine Tür an der angegebenen Position
 * @param {Object} agent - Der Agent
 * @param {string} doorType - Türtyp (z.B. 'oak_door', 'iron_door')
 * @param {number} x - X-Koordinate
 * @param {number} y - Y-Koordinate
 * @param {number} z - Z-Koordinate
 * @param {string} direction - Ausrichtung
 * @returns {Promise<boolean>} Erfolg der Platzierung
 */
export async function placeDoor(agent, doorType = 'oak_door', x, y, z, direction = null) {
    console.log(`[BuildingActions] Platziere ${doorType} bei ${x}, ${y}, ${z}`);
    
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        const position = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
        
        if (!direction) {
            direction = agent.builder.getDirectionFromBot();
        }
        
        const success = await agent.builder.placeBlock(doorType, position, { direction });
        
        if (success) {
            agent.bot.chat(`✅ ${doorType} erfolgreich platziert!`);
            return true;
        } else {
            agent.bot.chat(`❌ Konnte ${doorType} nicht platzieren`);
            return false;
        }
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Platzieren der Tür: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Platzieren der Tür: ${error.message}`);
        return false;
    }
}

/**
 * Baut einen Zaun um einen Bereich
 * @param {Object} agent - Der Agent
 * @param {number} x1 - Erste Ecke X
 * @param {number} y - Y-Koordinate
 * @param {number} z1 - Erste Ecke Z
 * @param {number} x2 - Zweite Ecke X
 * @param {number} z2 - Zweite Ecke Z
 * @param {string} fenceType - Zaun-Typ
 * @returns {Promise<boolean>} Erfolg des Baus
 */
export async function buildFence(agent, x1, y, z1, x2, z2, fenceType = 'oak_fence') {
    console.log(`[BuildingActions] Baue Zaun von ${x1},${y},${z1} bis ${x2},${y},${z2}`);
    agent.bot.chat(`🔨 Baue Zaun aus ${fenceType}...`);
    
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        const corner1 = new Vec3(Math.floor(x1), Math.floor(y), Math.floor(z1));
        const corner2 = new Vec3(Math.floor(x2), Math.floor(y), Math.floor(z2));
        
        const results = await agent.builder.buildEnclosure(corner1, corner2, fenceType, true);
        
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        if (successCount === totalCount) {
            agent.bot.chat(`✅ Zaun komplett gebaut! ${successCount} Blöcke platziert.`);
            return true;
        } else {
            agent.bot.chat(`⚠️ Zaun teilweise gebaut: ${successCount}/${totalCount} Blöcke`);
            return false;
        }
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Zaun-Bau: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Zaun-Bau: ${error.message}`);
        return false;
    }
}

/**
 * Baut eine Mauer um einen Bereich
 * @param {Object} agent - Der Agent
 * @param {number} x1 - Erste Ecke X
 * @param {number} y - Y-Koordinate
 * @param {number} z1 - Erste Ecke Z
 * @param {number} x2 - Zweite Ecke X
 * @param {number} z2 - Zweite Ecke Z
 * @param {string} wallType - Mauer-Typ
 * @returns {Promise<boolean>} Erfolg des Baus
 */
export async function buildWall(agent, x1, y, z1, x2, z2, wallType = 'cobblestone_wall') {
    console.log(`[BuildingActions] Baue Mauer von ${x1},${y},${z1} bis ${x2},${y},${z2}`);
    agent.bot.chat(`🧱 Baue Mauer aus ${wallType}...`);
    
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        const corner1 = new Vec3(Math.floor(x1), Math.floor(y), Math.floor(z1));
        const corner2 = new Vec3(Math.floor(x2), Math.floor(y), Math.floor(z2));
        
        const results = await agent.builder.buildEnclosure(corner1, corner2, wallType, false);
        
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        if (successCount === totalCount) {
            agent.bot.chat(`✅ Mauer komplett gebaut! ${successCount} Blöcke platziert.`);
            return true;
        } else {
            agent.bot.chat(`⚠️ Mauer teilweise gebaut: ${successCount}/${totalCount} Blöcke`);
            return false;
        }
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Mauer-Bau: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Mauer-Bau: ${error.message}`);
        return false;
    }
}

/**
 * Baut eine Treppe zwischen zwei Punkten
 * @param {Object} agent - Der Agent
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} z1 - Start Z
 * @param {number} x2 - Ende X
 * @param {number} y2 - Ende Y
 * @param {number} z2 - Ende Z
 * @param {string} stairType - Treppen-Typ
 * @returns {Promise<boolean>} Erfolg des Baus
 */
export async function buildStairway(agent, x1, y1, z1, x2, y2, z2, stairType = 'oak_stairs') {
    console.log(`[BuildingActions] Baue Treppe von ${x1},${y1},${z1} bis ${x2},${y2},${z2}`);
    agent.bot.chat(`🪜 Baue Treppe aus ${stairType}...`);
    
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        const start = new Vec3(x1, y1, z1);
        const end = new Vec3(x2, y2, z2);
        const heightDiff = Math.abs(y2 - y1);
        const horizontalDist = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
        
        if (heightDiff === 0) {
            agent.bot.chat(`❌ Keine Höhenunterschiede - keine Treppe nötig`);
            return false;
        }
        
        // Generiere Treppenstufen
        const positions = [];
        const stepsNeeded = Math.max(heightDiff, horizontalDist);
        
        for (let i = 0; i <= stepsNeeded; i++) {
            const progress = i / stepsNeeded;
            const stepPos = new Vec3(
                Math.floor(x1 + (x2 - x1) * progress),
                Math.floor(y1 + (y2 - y1) * progress),
                Math.floor(z1 + (z2 - z1) * progress)
            );
            positions.push(stepPos);
        }
        
        const results = await agent.builder.buildStairs(positions, stairType);
        
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        if (successCount === totalCount) {
            agent.bot.chat(`✅ Treppe komplett gebaut! ${successCount} Stufen.`);
            return true;
        } else {
            agent.bot.chat(`⚠️ Treppe teilweise gebaut: ${successCount}/${totalCount} Stufen`);
            return false;
        }
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Treppen-Bau: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Treppen-Bau: ${error.message}`);
        return false;
    }
}

/**
 * Baut eine einfache Redstone-Schaltung
 * @param {Object} agent - Der Agent
 * @param {number} x - Start X
 * @param {number} y - Start Y
 * @param {number} z - Start Z
 * @param {string} circuitType - Typ der Schaltung ('simple_clock', 'repeater_line', 'comparator_circuit')
 * @returns {Promise<boolean>} Erfolg des Baus
 */
export async function buildRedstoneCircuit(agent, x, y, z, circuitType = 'simple_clock') {
    console.log(`[BuildingActions] Baue Redstone-Schaltung ${circuitType} bei ${x},${y},${z}`);
    agent.bot.chat(`⚡ Baue ${circuitType} Redstone-Schaltung...`);
    
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        const startPos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
        let pattern = [];
        
        switch (circuitType) {
            case 'simple_clock':
                pattern = [
                    { block: 'redstone_wire', offset: { x: 0, y: 0, z: 0 } },
                    { block: 'repeater', offset: { x: 1, y: 0, z: 0 } },
                    { block: 'redstone_wire', offset: { x: 2, y: 0, z: 0 } },
                    { block: 'redstone_wire', offset: { x: 3, y: 0, z: 0 } },
                    { block: 'repeater', offset: { x: 3, y: 0, z: 1 } },
                    { block: 'redstone_wire', offset: { x: 2, y: 0, z: 1 } },
                    { block: 'redstone_wire', offset: { x: 1, y: 0, z: 1 } },
                    { block: 'redstone_wire', offset: { x: 0, y: 0, z: 1 } }
                ];
                break;
                
            case 'repeater_line':
                for (let i = 0; i < 8; i++) {
                    if (i % 2 === 0) {
                        pattern.push({ block: 'redstone_wire', offset: { x: i, y: 0, z: 0 } });
                    } else {
                        pattern.push({ block: 'repeater', offset: { x: i, y: 0, z: 0 } });
                    }
                }
                break;
                
            case 'comparator_circuit':
                pattern = [
                    { block: 'redstone_wire', offset: { x: 0, y: 0, z: 0 } },
                    { block: 'comparator', offset: { x: 1, y: 0, z: 0 } },
                    { block: 'redstone_wire', offset: { x: 2, y: 0, z: 0 } },
                    { block: 'lever', offset: { x: 0, y: 1, z: 0 } }
                ];
                break;
                
            default:
                agent.bot.chat(`❌ Unbekannter Schaltungstyp: ${circuitType}`);
                return false;
        }
        
        const results = await agent.builder.buildRedstoneCircuit(pattern, startPos);
        
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        if (successCount === totalCount) {
            agent.bot.chat(`✅ Redstone-Schaltung komplett! ${successCount} Komponenten.`);
            return true;
        } else {
            agent.bot.chat(`⚠️ Schaltung teilweise gebaut: ${successCount}/${totalCount} Komponenten`);
            return false;
        }
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Redstone-Bau: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Redstone-Bau: ${error.message}`);
        return false;
    }
}

/**
 * Erstellt eine Schlafkammer mit mehreren Betten
 * @param {Object} agent - Der Agent
 * @param {number} x - Startposition X
 * @param {number} y - Startposition Y
 * @param {number} z - Startposition Z
 * @param {number} width - Breite der Kammer
 * @param {number} depth - Tiefe der Kammer
 * @param {string} bedColor - Farbe der Betten
 * @returns {Promise<boolean>} Erfolg des Baus
 */
export async function buildBedroom(agent, x, y, z, width = 7, depth = 5, bedColor = 'blue') {
    console.log(`[BuildingActions] Baue Schlafkammer ${width}x${depth} mit ${bedColor} Betten`);
    agent.bot.chat(`🏠 Baue Schlafkammer ${width}x${depth}...`);
    
    if (!agent.builder) {
        agent.builder = new Builder(agent);
    }
    
    try {
        const startPos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
        const height = 3;
        
        // 1. Boden
        agent.bot.chat('🔨 Lege Boden...');
        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                await skills.placeBlock(agent.bot, 'oak_planks', 
                    startPos.x + dx, startPos.y - 1, startPos.z + dz);
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        
        // 2. Wände
        agent.bot.chat('🧱 Baue Wände...');
        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                // Vorne und hinten
                await skills.placeBlock(agent.bot, 'stone_bricks', 
                    startPos.x + dx, startPos.y + dy, startPos.z);
                await skills.placeBlock(agent.bot, 'stone_bricks', 
                    startPos.x + dx, startPos.y + dy, startPos.z + depth - 1);
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        
        for (let dz = 1; dz < depth - 1; dz++) {
            for (let dy = 0; dy < height; dy++) {
                // Links und rechts
                await skills.placeBlock(agent.bot, 'stone_bricks', 
                    startPos.x, startPos.y + dy, startPos.z + dz);
                await skills.placeBlock(agent.bot, 'stone_bricks', 
                    startPos.x + width - 1, startPos.y + dy, startPos.z + dz);
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        
        // 3. Dach
        agent.bot.chat('🏠 Baue Dach...');
        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                await skills.placeBlock(agent.bot, 'oak_planks', 
                    startPos.x + dx, startPos.y + height, startPos.z + dz);
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        
        // 4. Tür
        agent.bot.chat('🚪 Platziere Tür...');
        const doorPos = new Vec3(startPos.x + Math.floor(width/2), startPos.y, startPos.z);
        await agent.builder.placeBlock('oak_door', doorPos, { direction: 'north' });
        
        // 5. Betten platzieren (2 Reihen)
        agent.bot.chat('🛏️ Platziere Betten...');
        const bedSpacing = 2;
        let bedCount = 0;
        
        for (let row = 0; row < 2; row++) {
            const bedZ = startPos.z + 1 + (row * 2);
            for (let col = 1; col < width - 1; col += 3) {
                if (col + 1 < width - 1) { // Genug Platz für Bett (2 Blöcke)
                    const bedPos = new Vec3(startPos.x + col, startPos.y, bedZ);
                    const success = await agent.builder.placeBlock(`${bedColor}_bed`, bedPos, { direction: 'east' });
                    if (success) bedCount++;
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        }
        
        // 6. Beleuchtung
        agent.bot.chat('💡 Füge Beleuchtung hinzu...');
        await skills.placeBlock(agent.bot, 'torch', 
            startPos.x + Math.floor(width/2), startPos.y + 2, startPos.z + Math.floor(depth/2), 'side');
        
        agent.bot.chat(`✅ Schlafkammer fertiggestellt mit ${bedCount} ${bedColor} Betten! 😴`);
        return true;
        
    } catch (error) {
        console.log(`[BuildingActions] Fehler beim Bau der Schlafkammer: ${error.message}`);
        agent.bot.chat(`❌ Fehler beim Bau der Schlafkammer: ${error.message}`);
        return false;
    }
}