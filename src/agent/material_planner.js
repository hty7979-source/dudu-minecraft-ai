/**
 * Material Planning System
 *
 * Intelligente Ressourcen-Planung für Tasks:
 * - Analysiert Crafting-Rezepte rekursiv
 * - Berücksichtigt aktuelles Inventar
 * - Erstellt optimierte Sammelliste
 * - Plant Material-Ketten (logs → planks → sticks)
 *
 * @author Dudu AI Team
 */

import * as mc from '../utils/mcdata.js';

// ============================================================================
// MATERIAL PLANNER
// ============================================================================

export class MaterialPlanner {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Erstellt einen vollständigen Materialplan für mehrere Items
     *
     * @param {Array<{item: string, count: number}>} targetItems - Liste von Items die gecraftet werden sollen
     * @returns {Object} Materialplan mit gathering und crafting steps
     *
     * @example
     * const plan = planner.createPlan([
     *   { item: 'wooden_pickaxe', count: 1 },
     *   { item: 'wooden_axe', count: 1 },
     *   { item: 'wooden_sword', count: 1 }
     * ]);
     */
    createPlan(targetItems) {
        const inventory = this.getCurrentInventory();
        const plan = {
            targets: targetItems,
            toGather: {},      // Items die gesammelt werden müssen (Rohstoffe)
            toCraft: targetItems,  // Items die gecraftet werden sollen
            alreadyHave: {},   // Items die bereits im Inventar sind
        };

        // Berechne alle benötigten Rohstoffe
        for (const target of targetItems) {
            const rawMaterials = this.calculateRawMaterials(target.item, target.count);

            // Merge in toGather
            for (const [material, amount] of Object.entries(rawMaterials)) {
                plan.toGather[material] = (plan.toGather[material] || 0) + amount;
            }
        }

        return plan;
    }


    /**
     * Holt das aktuelle Inventar als Object
     * Aggregiert auch spezifische Holz-Typen zu generischen Platzhaltern
     */
    getCurrentInventory() {
        const inventory = {};
        const items = this.bot.inventory.items();

        for (const item of items) {
            inventory[item.name] = (inventory[item.name] || 0) + item.count;

            // Aggregiere alle Log-Typen zu generischem "_log"
            // (oak_log, spruce_log, birch_log, jungle_log, acacia_log, dark_oak_log, mangrove_log, cherry_log)
            if (item.name.endsWith('_log')) {
                inventory['_log'] = (inventory['_log'] || 0) + item.count;
            }

            // Aggregiere alle Planks-Typen zu generischem "_planks"
            // (oak_planks, spruce_planks, birch_planks, etc.)
            if (item.name.endsWith('_planks')) {
                inventory['_planks'] = (inventory['_planks'] || 0) + item.count;
            }
        }

        return inventory;
    }

    /**
     * Prüft ob alle Materialien für einen Plan verfügbar sind
     */
    hasMaterials(plan) {
        const inventory = this.getCurrentInventory();

        for (const [item, needed] of Object.entries(plan.toGather)) {
            const available = inventory[item] || 0;
            if (available < needed) {
                return false;
            }
        }

        return true;
    }

    /**
     * Gibt eine lesbare Zusammenfassung des Plans zurück
     */
    summarizePlan(plan) {
        const lines = [];
        const inventory = this.getCurrentInventory();

        if (Object.keys(plan.toGather).length > 0) {
            lines.push('📦 Raw materials needed:');
            for (const [item, count] of Object.entries(plan.toGather)) {
                const have = inventory[item] || 0;
                const need = Math.max(0, count - have);

                if (need > 0) {
                    lines.push(`  - ${item}: need ${need} more (have ${have}/${count})`);
                } else {
                    lines.push(`  - ${item}: ✓ have ${count} (enough)`);
                }
            }
        } else {
            lines.push('✅ All raw materials already available!');
        }

        if (plan.toCraft && plan.toCraft.length > 0) {
            lines.push('');
            lines.push('🔨 Items to craft:');
            for (const target of plan.toCraft) {
                const have = inventory[target.item] || 0;
                if (have >= target.count) {
                    lines.push(`  - ${target.item} x${target.count} ✓ (already have)`);
                } else {
                    lines.push(`  - ${target.item} x${target.count}`);
                }
            }
        }

        return lines.join('\n');
    }

    /**
     * Erstellt einen spezialisierten Plan für Wooden Tools
     */
    createWoodenToolsPlan() {
        return this.createPlan([
            { item: 'wooden_pickaxe', count: 1 },
            { item: 'wooden_axe', count: 1 },
            { item: 'wooden_sword', count: 1 }
        ]);
    }

    /**
     * Erstellt einen spezialisierten Plan für Stone Tools + Furnace
     */
    createStoneToolsPlan() {
        return this.createPlan([
            { item: 'stone_pickaxe', count: 1 },
            { item: 'stone_axe', count: 1 },
            { item: 'stone_sword', count: 1 },
            { item: 'furnace', count: 1 }
        ]);
    }

    /**
     * Erstellt einen spezialisierten Plan für Iron Tools + Shield
     * Materialbedarf: 8 Iron Ingots + Sticks + Planks
     */
    createIronToolsPlan() {
        return this.createPlan([
            { item: 'iron_pickaxe', count: 1 },
            { item: 'iron_axe', count: 1 },
            { item: 'iron_sword', count: 1 },
            { item: 'iron_shovel', count: 1 },
            { item: 'shield', count: 1 }
        ]);
    }

    /**
     * Erstellt einen spezialisierten Plan für Iron Armor (nur Rüstung)
     * Materialbedarf: 24 Iron Ingots
     */
    createIronArmorPlan() {
        return this.createPlan([
            { item: 'iron_helmet', count: 1 },
            { item: 'iron_chestplate', count: 1 },
            { item: 'iron_leggings', count: 1 },
            { item: 'iron_boots', count: 1 }
        ]);
    }

    /**
     * Erstellt einen kombinierten Plan für Iron Tools + Armor + Shield
     */
    createFullIronSetPlan() {
        return this.createPlan([
            // Tools
            { item: 'iron_pickaxe', count: 1 },
            { item: 'iron_axe', count: 1 },
            { item: 'iron_sword', count: 1 },
            { item: 'iron_shovel', count: 1 },
            // Armor
            { item: 'iron_helmet', count: 1 },
            { item: 'iron_chestplate', count: 1 },
            { item: 'iron_leggings', count: 1 },
            { item: 'iron_boots', count: 1 },
            // Shield
            { item: 'shield', count: 1 }
        ]);
    }

    /**
     * Berechnet EXAKT wie viele Rohstoffe benötigt werden
     * Verwendet Hard-coded Rezepte für die wichtigsten Items
     *
     * WICHTIG: Verwendet generisches "_log" und "_planks" für Holz-Flexibilität
     * collectBlock() wird dann den passenden Holz-Typ finden
     *
     * @param {string} item - Item das gecraftet werden soll
     * @param {number} count - Anzahl
     * @returns {Object} Rohstoff-Anforderungen mit aktueller Inventar-Berücksichtigung
     */
    calculateRawMaterials(item, count) {
        const inventory = this.getCurrentInventory();
        const have = inventory[item] || 0;
        const stillNeed = Math.max(0, count - have);

        if (stillNeed === 0) {
            return {}; // Haben schon genug
        }

        // Hard-coded Rezepte für wichtige Items
        // WICHTIG: Wooden Tools nutzen generisches "_planks" (nicht oak_planks)
        // Dies erlaubt JEDE Holzart (oak, spruce, birch, jungle, acacia, dark_oak, mangrove, cherry)
        const recipes = {
            // Tools - Using generic _planks for ANY wood type
            'wooden_pickaxe': { '_planks': 3, stick: 2 },
            'wooden_axe': { '_planks': 3, stick: 2 },
            'wooden_sword': { '_planks': 2, stick: 1 },
            'wooden_shovel': { '_planks': 1, stick: 2 },

            'stone_pickaxe': { cobblestone: 3, stick: 2 },
            'stone_axe': { cobblestone: 3, stick: 2 },
            'stone_sword': { cobblestone: 2, stick: 1 },
            'stone_shovel': { cobblestone: 1, stick: 2 },

            'iron_pickaxe': { iron_ingot: 3, stick: 2 },
            'iron_axe': { iron_ingot: 3, stick: 2 },
            'iron_sword': { iron_ingot: 2, stick: 1 },
            'iron_shovel': { iron_ingot: 1, stick: 2 },

            // Iron Armor
            'iron_helmet': { iron_ingot: 5 },
            'iron_chestplate': { iron_ingot: 8 },
            'iron_leggings': { iron_ingot: 7 },
            'iron_boots': { iron_ingot: 4 },

            // Shield
            'shield': { iron_ingot: 1, '_planks': 6 },

            // Crafting basics - Using generic _log and _planks for flexibility
            '_planks': { '_log': 0.25 },          // 1 log = 4 planks (ANY wood type)
            'stick': { '_planks': 0.5 },          // 2 planks = 4 sticks (ANY wood type)
            'crafting_table': { '_planks': 4 },   // ANY wood type
            'furnace': { cobblestone: 8 },
            'torch': { coal: 0.25, stick: 0.25 }  // 1 coal + 1 stick = 4 torches

            // Legacy oak-specific entries (kept for backwards compatibility)
            // These will be used if specifically requested
            ,'oak_planks': { 'oak_log': 0.25 },
            'spruce_planks': { 'spruce_log': 0.25 },
            'birch_planks': { 'birch_log': 0.25 },
            'jungle_planks': { 'jungle_log': 0.25 },
            'acacia_planks': { 'acacia_log': 0.25 },
            'dark_oak_planks': { 'dark_oak_log': 0.25 },
            'mangrove_planks': { 'mangrove_log': 0.25 },
            'cherry_planks': { 'cherry_log': 0.25 }
        };

        const recipe = recipes[item];
        if (!recipe) {
            // Basis-Item (muss gesammelt werden)
            return { [item]: stillNeed };
        }

        // Rekursiv Zutaten berechnen
        const rawMaterials = {};
        for (const [ingredient, neededPerCraft] of Object.entries(recipe)) {
            const totalNeeded = Math.ceil(stillNeed * neededPerCraft);

            // Rekursiv auflösen
            const subMaterials = this.calculateRawMaterials(ingredient, totalNeeded);

            // Merge
            for (const [subItem, subCount] of Object.entries(subMaterials)) {
                rawMaterials[subItem] = (rawMaterials[subItem] || 0) + subCount;
            }
        }

        return rawMaterials;
    }

    /**
     * Erstellt einen optimierten Sammel-Plan
     * Gruppiert ähnliche Items und priorisiert
     *
     * @param {Object} materials - { item_name: count }
     * @returns {Array} Sortierte Liste von Sammel-Aufgaben
     */
    createGatheringPlan(materials) {
        const tasks = [];
        const inventory = this.getCurrentInventory();

        // Kategorisiere Items
        const woodItems = [];
        const stoneItems = [];
        const oreItems = [];
        const otherItems = [];

        for (const [item, needed] of Object.entries(materials)) {
            const have = inventory[item] || 0;
            const toGather = Math.max(0, needed - have);

            if (toGather === 0) continue;

            const task = { item, amount: toGather, have, needed };

            if (item.includes('log') || item.includes('planks')) {
                woodItems.push(task);
            } else if (item === 'cobblestone' || item === 'stone') {
                stoneItems.push(task);
            } else if (item.includes('ore') || item === 'coal') {
                oreItems.push(task);
            } else {
                otherItems.push(task);
            }
        }

        // Priorisierung: Holz → Stein → Erze → Rest
        return [...woodItems, ...stoneItems, ...oreItems, ...otherItems];
    }
}
