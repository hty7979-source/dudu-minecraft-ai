/**
 * Smart Food System für Mindcraft Bot
 *
 * Intelligentes System für:
 * - Nahrungssuche und -herstellung
 * - Kochen (Furnace, Smoker, Campfire)
 * - Komplexe Rezepte (Kuchen, Suppen, etc.)
 * - Ressourcenplanung für Food-Crafting
 *
 * Basierend auf: https://minecraft.fandom.com/wiki/Food
 * @author Dudu AI Team
 */

import * as mc from "../../../utils/mcdata.js";
import * as world from "../utils/world.js";
import * as skills from "../skills.js";

// ============================================================================
// FOOD RECIPES DATABASE
// ============================================================================

export const FOOD_RECIPES = {
    // ===== RAW FOODS (sammeln oder jagen) =====
    raw: {
        apple: {
            source: 'harvest',
            method: 'break_leaves',
            blocks: ['oak_leaves', 'dark_oak_leaves'],
            nutrition: 4
        },
        sweet_berries: {
            source: 'harvest',
            method: 'collect',
            blocks: ['sweet_berry_bush'],
            nutrition: 2
        },
        glow_berries: {
            source: 'harvest',
            method: 'collect',
            blocks: ['cave_vines'],
            nutrition: 2
        },
        carrot: {
            source: 'harvest',
            method: 'farm',
            blocks: ['carrots'],
            nutrition: 3
        },
        potato: {
            source: 'harvest',
            method: 'farm',
            blocks: ['potatoes'],
            nutrition: 1
        },
        beetroot: {
            source: 'harvest',
            method: 'farm',
            blocks: ['beetroots'],
            nutrition: 1
        },
        melon_slice: {
            source: 'harvest',
            method: 'break',
            blocks: ['melon'],
            nutrition: 2
        },

        // Tiere jagen
        beef: { source: 'hunt', animal: 'cow', nutrition: 3 },
        porkchop: { source: 'hunt', animal: 'pig', nutrition: 3 },
        chicken: { source: 'hunt', animal: 'chicken', nutrition: 2 },
        mutton: { source: 'hunt', animal: 'sheep', nutrition: 2 },
        rabbit: { source: 'hunt', animal: 'rabbit', nutrition: 3 },
        cod: { source: 'fish', nutrition: 2 },
        salmon: { source: 'fish', nutrition: 2 },
    },

    // ===== COOKED FOODS (Furnace/Smoker/Campfire) =====
    cooked: {
        baked_potato: {
            raw: 'potato',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10, // seconds
            nutrition: 5,
            priority: 8 // Hoch - gut für Survival
        },
        cooked_beef: {
            raw: 'beef',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10,
            nutrition: 8,
            priority: 9 // Sehr gut!
        },
        cooked_porkchop: {
            raw: 'porkchop',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10,
            nutrition: 8,
            priority: 9
        },
        cooked_chicken: {
            raw: 'chicken',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10,
            nutrition: 6,
            priority: 7
        },
        cooked_mutton: {
            raw: 'mutton',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10,
            nutrition: 6,
            priority: 7
        },
        cooked_rabbit: {
            raw: 'rabbit',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10,
            nutrition: 5,
            priority: 6
        },
        cooked_cod: {
            raw: 'cod',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10,
            nutrition: 5,
            priority: 6
        },
        cooked_salmon: {
            raw: 'salmon',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10,
            nutrition: 6,
            priority: 7
        },
        dried_kelp: {
            raw: 'kelp',
            method: ['furnace', 'smoker', 'campfire'],
            cookTime: 10,
            nutrition: 1,
            priority: 2 // Niedrig
        }
    },

    // ===== CRAFTED FOODS (Crafting Table) =====
    crafted: {
        bread: {
            ingredients: { wheat: 3 },
            nutrition: 5,
            priority: 8,
            requiresCraftingTable: false // 2x2 grid ausreichend
        },
        cookie: {
            ingredients: { wheat: 2, cocoa_beans: 1 },
            output: 8, // Gibt 8 Cookies
            nutrition: 2,
            priority: 5,
            requiresCraftingTable: false
        },
        cake: {
            ingredients: {
                wheat: 3,
                sugar: 2,
                egg: 1,
                milk_bucket: 3
            },
            nutrition: 14, // Gesamt (7 Scheiben à 2)
            priority: 6,
            requiresCraftingTable: true,
            placement: true // Muss platziert werden
        },
        pumpkin_pie: {
            ingredients: {
                pumpkin: 1,
                sugar: 1,
                egg: 1
            },
            nutrition: 8,
            priority: 7,
            requiresCraftingTable: true
        },
        golden_carrot: {
            ingredients: {
                carrot: 1,
                gold_nugget: 8
            },
            nutrition: 6,
            priority: 4, // Niedrig - zu teuer
            requiresCraftingTable: true
        },
        golden_apple: {
            ingredients: {
                apple: 1,
                gold_ingot: 8
            },
            nutrition: 4,
            priority: 3, // Niedrig - zu teuer
            requiresCraftingTable: true
        },

        // ===== SOUPS & STEWS =====
        mushroom_stew: {
            ingredients: {
                bowl: 1,
                red_mushroom: 1,
                brown_mushroom: 1
            },
            nutrition: 6,
            priority: 7,
            requiresCraftingTable: false,
            returnsContainer: 'bowl' // Bowl zurückbekommen
        },
        beetroot_soup: {
            ingredients: {
                bowl: 1,
                beetroot: 6
            },
            nutrition: 6,
            priority: 6,
            requiresCraftingTable: true,
            returnsContainer: 'bowl'
        },
        rabbit_stew: {
            ingredients: {
                bowl: 1,
                cooked_rabbit: 1,
                carrot: 1,
                baked_potato: 1,
                brown_mushroom: 1 // oder red_mushroom
            },
            nutrition: 10,
            priority: 9, // Sehr gut!
            requiresCraftingTable: true,
            returnsContainer: 'bowl'
        },
        suspicious_stew: {
            ingredients: {
                bowl: 1,
                red_mushroom: 1,
                brown_mushroom: 1,
                // + 1 Blume (verschiedene Effekte)
            },
            nutrition: 6,
            priority: 4, // Niedrig - Effekte unvorhersehbar
            requiresCraftingTable: false,
            returnsContainer: 'bowl',
            requiresFlower: true
        }
    }
};

// ============================================================================
// SMART FOOD MANAGER
// ============================================================================

export class SmartFoodManager {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Hauptmethode: Intelligente Nahrungsbeschaffung
     * Findet den besten Weg um Nahrung zu bekommen
     */
    async obtainFood(targetAmount = 5) {
        console.log('🍖 Smart Food System: Searching for best food source...');

        // 1. Prüfe verfügbare Ressourcen
        const inventory = world.getInventoryCounts(this.bot);
        const options = this.evaluateFoodOptions(inventory);

        if (options.length === 0) {
            console.log('❌ No viable food options found');
            return { success: false, foodObtained: 0 };
        }

        // 2. Sortiere nach Priorität
        options.sort((a, b) => b.priority - a.priority);

        console.log(`📊 Found ${options.length} food options, trying best option: ${options[0].name}`);

        // 3. Versuche die beste Option
        let totalObtained = 0;

        for (const option of options.slice(0, 3)) { // Probiere top 3 Optionen
            const result = await this.acquireFood(option, targetAmount - totalObtained);

            if (result.success) {
                totalObtained += result.amount;

                if (totalObtained >= targetAmount) {
                    this.bot.chat(`✅ Ich habe ${totalObtained}x ${result.foodName} hergestellt`);
                    return { success: true, foodObtained: totalObtained, foodType: result.foodName };
                }
            }
        }

        if (totalObtained > 0) {
            this.bot.chat(`✅ Ich habe ${totalObtained} Nahrung hergestellt`);
            return { success: true, foodObtained: totalObtained };
        }

        return { success: false, foodObtained: 0 };
    }

    /**
     * Evaluiert welche Food-Optionen verfügbar sind
     */
    evaluateFoodOptions(inventory) {
        const options = [];

        // GEKOCHTES ESSEN (wenn rohes Fleisch vorhanden)
        for (const [foodName, recipe] of Object.entries(FOOD_RECIPES.cooked)) {
            const rawItem = recipe.raw;
            const rawCount = inventory[rawItem] || 0;

            if (rawCount > 0) {
                options.push({
                    name: foodName,
                    type: 'cooked',
                    recipe: recipe,
                    priority: recipe.priority,
                    available: rawCount,
                    difficulty: 2 // Benötigt Furnace/Smoker
                });
            }
        }

        // GECRAFTETES ESSEN
        for (const [foodName, recipe] of Object.entries(FOOD_RECIPES.crafted)) {
            const missing = this.getMissingIngredients(recipe.ingredients, inventory);
            const missingCount = Object.keys(missing).length;

            if (missingCount === 0) {
                // Alle Zutaten vorhanden!
                options.push({
                    name: foodName,
                    type: 'crafted',
                    recipe: recipe,
                    priority: recipe.priority,
                    available: this.calculateMaxCrafts(recipe.ingredients, inventory),
                    difficulty: recipe.requiresCraftingTable ? 2 : 1
                });
            } else if (missingCount <= 2) {
                // Nur 1-2 Zutaten fehlen - könnte beschaffbar sein
                options.push({
                    name: foodName,
                    type: 'crafted',
                    recipe: recipe,
                    priority: Math.max(1, recipe.priority - missingCount * 2), // Reduzierte Priorität
                    available: 0,
                    difficulty: 3 + missingCount,
                    missing: missing
                });
            }
        }

        // ROHES ESSEN (Tiere jagen)
        const nearbyAnimals = this.scanNearbyAnimals();
        for (const [foodName, recipe] of Object.entries(FOOD_RECIPES.raw)) {
            if (recipe.source === 'hunt' && nearbyAnimals[recipe.animal] > 0) {
                options.push({
                    name: foodName,
                    type: 'hunt',
                    recipe: recipe,
                    priority: 5, // Mittel - rohes Fleisch ist ok aber nicht optimal
                    available: nearbyAnimals[recipe.animal],
                    difficulty: 3 // Jagen kann schwierig sein
                });
            }
        }

        // FARM ESSEN (Pflanzen sammeln)
        for (const [foodName, recipe] of Object.entries(FOOD_RECIPES.raw)) {
            if (recipe.source === 'harvest') {
                const nearby = this.findNearbyBlocks(recipe.blocks, 32);
                if (nearby.length > 0) {
                    options.push({
                        name: foodName,
                        type: 'harvest',
                        recipe: recipe,
                        priority: 6, // Mittel-hoch - einfach zu beschaffen
                        available: nearby.length,
                        difficulty: 1 // Einfach!
                    });
                }
            }
        }

        return options;
    }

    /**
     * Beschafft eine spezifische Food-Option
     */
    async acquireFood(option, amount) {
        console.log(`🎯 Attempting to acquire ${amount}x ${option.name} (${option.type})`);

        try {
            switch (option.type) {
                case 'cooked':
                    return await this.cookFood(option, amount);

                case 'crafted':
                    return await this.craftFood(option, amount);

                case 'hunt':
                    return await this.huntForFood(option, amount);

                case 'harvest':
                    return await this.harvestFood(option, amount);

                default:
                    return { success: false, amount: 0 };
            }
        } catch (error) {
            console.log(`❌ Failed to acquire ${option.name}: ${error.message}`);
            return { success: false, amount: 0 };
        }
    }

    /**
     * Kocht rohes Essen (Furnace/Smoker/Campfire)
     */
    async cookFood(option, amount) {
        const rawItem = option.recipe.raw;
        const inventory = world.getInventoryCounts(this.bot);
        const available = Math.min(amount, inventory[rawItem] || 0);

        if (available === 0) {
            return { success: false, amount: 0 };
        }

        console.log(`🔥 Cooking ${available}x ${rawItem} → ${option.name}`);

        // Finde Smoker (am schnellsten) oder Furnace
        const smoker = this.bot.findBlock({
            matching: (block) => block && block.name === 'smoker',
            maxDistance: 32
        });

        const furnace = this.bot.findBlock({
            matching: (block) => block && block.name === 'furnace',
            maxDistance: 32
        });

        const cookingDevice = smoker || furnace;

        if (!cookingDevice) {
            console.log('⚠️ No furnace or smoker found nearby');
            return { success: false, amount: 0 };
        }

        // Gehe zum Cooking Device
        await skills.goToPosition(
            this.bot,
            cookingDevice.position.x,
            cookingDevice.position.y,
            cookingDevice.position.z,
            2
        );

        // Verwende das Cooking Device
        try {
            await skills.smeltItem(this.bot, rawItem, available, cookingDevice.name);

            console.log(`✅ Cooked ${available}x ${option.name}`);

            return {
                success: true,
                amount: available,
                foodName: option.name
            };
        } catch (error) {
            console.log(`⚠️ Cooking failed: ${error.message}`);
            return { success: false, amount: 0 };
        }
    }

    /**
     * Craftet Essen (Crafting Table)
     */
    async craftFood(option, amount) {
        const recipe = option.recipe;

        console.log(`🔨 Crafting ${amount}x ${option.name}`);

        // Prüfe ob alle Zutaten vorhanden sind
        const inventory = world.getInventoryCounts(this.bot);
        const missing = this.getMissingIngredients(recipe.ingredients, inventory);

        if (Object.keys(missing).length > 0) {
            console.log(`⚠️ Missing ingredients: ${Object.keys(missing).join(', ')}`);

            // Versuche fehlende Zutaten zu beschaffen
            for (const [ingredient, needed] of Object.entries(missing)) {
                const gathered = await this.gatherIngredient(ingredient, needed);
                if (!gathered) {
                    return { success: false, amount: 0 };
                }
            }
        }

        // Craft das Essen
        try {
            await skills.craftRecipe(this.bot, option.name, amount);

            console.log(`✅ Crafted ${amount}x ${option.name}`);

            return {
                success: true,
                amount: amount * (recipe.output || 1),
                foodName: option.name
            };
        } catch (error) {
            console.log(`⚠️ Crafting failed: ${error.message}`);
            return { success: false, amount: 0 };
        }
    }

    /**
     * Jagt Tiere für Food
     */
    async huntForFood(option, amount) {
        const animal = option.recipe.animal;

        console.log(`🎯 Hunting ${amount}x ${animal}`);

        let hunted = 0;

        for (let i = 0; i < amount && i < 5; i++) { // Max 5 Tiere
            const entity = this.bot.nearestEntity(e =>
                e.name === animal &&
                e.position.distanceTo(this.bot.entity.position) < 32
            );

            if (!entity) {
                break;
            }

            try {
                await skills.attackEntity(this.bot, entity);
                hunted++;
            } catch (error) {
                console.log(`⚠️ Failed to hunt ${animal}: ${error.message}`);
                break;
            }
        }

        if (hunted > 0) {
            console.log(`✅ Hunted ${hunted}x ${animal}`);

            // Sammle Drops ein
            await skills.pickupNearbyItems(this.bot);

            return {
                success: true,
                amount: hunted,
                foodName: option.name
            };
        }

        return { success: false, amount: 0 };
    }

    /**
     * Erntet Food-Pflanzen
     */
    async harvestFood(option, amount) {
        const blocks = option.recipe.blocks;

        console.log(`🌾 Harvesting ${amount}x ${option.name}`);

        let harvested = 0;

        for (const blockType of blocks) {
            try {
                const success = await skills.collectBlock(this.bot, blockType, amount - harvested);

                if (success) {
                    const inventory = world.getInventoryCounts(this.bot);
                    const nowHave = inventory[option.name] || 0;
                    harvested = nowHave;

                    if (harvested >= amount) {
                        break;
                    }
                }
            } catch (error) {
                // Versuche nächsten Block-Typ
                continue;
            }
        }

        if (harvested > 0) {
            console.log(`✅ Harvested ${harvested}x ${option.name}`);

            return {
                success: true,
                amount: harvested,
                foodName: option.name
            };
        }

        return { success: false, amount: 0 };
    }

    /**
     * Beschafft eine fehlende Zutat
     */
    async gatherIngredient(ingredient, amount) {
        console.log(`📦 Gathering ${amount}x ${ingredient}`);

        // Prüfe ob es ein Raw Food ist
        if (FOOD_RECIPES.raw[ingredient]) {
            const recipe = FOOD_RECIPES.raw[ingredient];

            if (recipe.source === 'harvest') {
                try {
                    await skills.collectBlock(this.bot, recipe.blocks[0], amount);
                    return true;
                } catch (error) {
                    return false;
                }
            }
        }

        // Versuche zu craften (z.B. bowl, sugar)
        try {
            await skills.craftRecipe(this.bot, ingredient, amount);
            return true;
        } catch (error) {
            // Kann nicht gecraftet werden
        }

        // Versuche zu sammeln
        try {
            await skills.collectBlock(this.bot, ingredient, amount);
            return true;
        } catch (error) {
            console.log(`⚠️ Cannot gather ${ingredient}`);
            return false;
        }
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    getMissingIngredients(required, inventory) {
        const missing = {};

        for (const [item, needed] of Object.entries(required)) {
            const have = inventory[item] || 0;
            if (have < needed) {
                missing[item] = needed - have;
            }
        }

        return missing;
    }

    calculateMaxCrafts(ingredients, inventory) {
        let maxCrafts = Infinity;

        for (const [item, needed] of Object.entries(ingredients)) {
            const have = inventory[item] || 0;
            const possible = Math.floor(have / needed);
            maxCrafts = Math.min(maxCrafts, possible);
        }

        return maxCrafts === Infinity ? 0 : maxCrafts;
    }

    scanNearbyAnimals() {
        const animals = {};
        const entities = Object.values(this.bot.entities);

        for (const entity of entities) {
            if (!entity.position) continue;

            const distance = entity.position.distanceTo(this.bot.entity.position);
            if (distance > 32) continue;

            const name = entity.name;
            if (['cow', 'pig', 'chicken', 'sheep', 'rabbit'].includes(name)) {
                animals[name] = (animals[name] || 0) + 1;
            }
        }

        return animals;
    }

    findNearbyBlocks(blockTypes, maxDistance) {
        const found = [];

        for (const blockType of blockTypes) {
            try {
                const blocks = this.bot.findBlocks({
                    matching: (block) => block && block.name === blockType,
                    maxDistance: maxDistance,
                    count: 10
                });

                found.push(...blocks);
            } catch (error) {
                // Block-Typ existiert nicht
            }
        }

        return found;
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function smartObtainFood(bot, amount = 5) {
    const manager = new SmartFoodManager(bot);
    return await manager.obtainFood(amount);
}
