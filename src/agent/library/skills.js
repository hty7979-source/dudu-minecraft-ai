import * as mc from "../../utils/mcdata.js";
import * as world from "./world.js";
import pf from 'mineflayer-pathfinder';
import Vec3 from 'vec3';
import settings from "../../../settings.js";

const blockPlaceDelay = settings.block_place_delay == null ? 0 : settings.block_place_delay;
const useDelay = blockPlaceDelay > 0;

export function log(bot, message) {
    bot.output += message + '\n';
}

async function autoLight(bot) {
    if (world.shouldPlaceTorch(bot)) {
        try {
            const pos = world.getPosition(bot);
            return await placeBlock(bot, 'torch', pos.x, pos.y, pos.z, 'bottom', true);
        } catch (err) {return false;}
    }
    return false;
}

async function equipHighestAttack(bot) {
    let weapons = bot.inventory.items().filter(item => item.name.includes('sword') || (item.name.includes('axe') && !item.name.includes('pickaxe')));
    if (weapons.length === 0)
        weapons = bot.inventory.items().filter(item => item.name.includes('pickaxe') || item.name.includes('shovel'));
    if (weapons.length === 0)
        return;
    weapons.sort((a, b) => a.attackDamage < b.attackDamage);
    let weapon = weapons[0];
    if (weapon)
        await bot.equip(weapon, 'hand');
}

export async function craftRecipe(bot, itemName, num=1) {
    /**
     * Attempt to craft the given item name from a recipe. May craft many items.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemName, the item name to craft.
     * @returns {Promise<boolean>} true if the recipe was crafted, false otherwise.
     * @example
     * await skills.craftRecipe(bot, "stick");
     **/
    let placedTable = false;

    if (mc.getItemCraftingRecipes(itemName).length == 0) {
        log(bot, `${itemName} is either not an item, or it does not have a crafting recipe!`);
        return false;
    }

    // get recipes that don't require a crafting table
    let recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, null); 
    let craftingTable = null;
    const craftingTableRange = 16;
    placeTable: if (!recipes || recipes.length === 0) {
        recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, true);
        if(!recipes || recipes.length === 0) break placeTable; //Don't bother going to the table if we don't have the required resources.

        // Look for crafting table
        craftingTable = world.getNearestBlock(bot, 'crafting_table', craftingTableRange);
        if (craftingTable === null){

            // Try to place crafting table
            let hasTable = world.getInventoryCounts(bot)['crafting_table'] > 0;
            if (hasTable) {
                let pos = world.getNearestFreeSpace(bot, 1, 6);
                await placeBlock(bot, 'crafting_table', pos.x, pos.y, pos.z);
                craftingTable = world.getNearestBlock(bot, 'crafting_table', craftingTableRange);
                if (craftingTable) {
                    recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, craftingTable);
                    placedTable = true;
                }
            }
            else {
                log(bot, `Crafting ${itemName} requires a crafting table.`)
                return false;
            }
        }
        else {
            recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, craftingTable);
        }
    }
    if (!recipes || recipes.length === 0) {
        log(bot, `You do not have the resources to craft a ${itemName}. It requires: ${Object.entries(mc.getItemCraftingRecipes(itemName)[0][0]).map(([key, value]) => `${key}: ${value}`).join(', ')}.`);
        if (placedTable) {
            await collectBlock(bot, 'crafting_table', 1);
        }
        return false;
    }
    
    if (craftingTable && bot.entity.position.distanceTo(craftingTable.position) > 4) {
        await goToNearestBlock(bot, 'crafting_table', 4, craftingTableRange);
    }

    const recipe = recipes[0];
    console.log('crafting...');
    //Check that the agent has sufficient items to use the recipe `num` times.
    const inventory = world.getInventoryCounts(bot); //Items in the agents inventory
    const requiredIngredients = mc.ingredientsFromPrismarineRecipe(recipe); //Items required to use the recipe once.
    const craftLimit = mc.calculateLimitingResource(inventory, requiredIngredients);
    
    // 🔧 Fix: Refresh crafting table reference before crafting
    let activeCraftingTable = craftingTable;
    if (craftingTable) {
        // Find fresh crafting table reference at the same position
        activeCraftingTable = world.getNearestBlock(bot, 'crafting_table', 6);
        if (!activeCraftingTable) {
            console.log('⚠️ Crafting table not found - trying without table reference');
            activeCraftingTable = null;
        } else {
            console.log(`🔧 Using crafting table at ${activeCraftingTable.position.x},${activeCraftingTable.position.y},${activeCraftingTable.position.z}`);
        }
    }
    
    console.log(`🔨 Crafting ${Math.min(craftLimit.num, num)}x ${itemName} with recipe ID ${recipe.id}`);
    await bot.craft(recipe, Math.min(craftLimit.num, num), activeCraftingTable);
    if(craftLimit.num<num) log(bot, `Not enough ${craftLimit.limitingResource} to craft ${num}, crafted ${craftLimit.num}. You now have ${world.getInventoryCounts(bot)[itemName]} ${itemName}.`);
    else log(bot, `Successfully crafted ${itemName}, you now have ${world.getInventoryCounts(bot)[itemName]} ${itemName}.`);
    if (placedTable) {
        await collectBlock(bot, 'crafting_table', 1);
    }

    //Equip any armor the bot may have crafted.
    //There is probablly a more efficient method than checking the entire inventory but this is all mineflayer-armor-manager provides. :P
    bot.armorManager.equipAll(); 

    return true;
}

export async function wait(bot, milliseconds) {
    /**
     * Waits for the given number of milliseconds.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {number} milliseconds, the number of milliseconds to wait.
     * @returns {Promise<boolean>} true if the wait was successful, false otherwise.
     * @example
     * await skills.wait(bot, 1000);
     **/
    // setTimeout is disabled to prevent unawaited code, so this is a safe alternative that enables interrupts
    let timeLeft = milliseconds;
    let startTime = Date.now();
    
    while (timeLeft > 0) {
        if (bot.interrupt_code) return false;
        
        let waitTime = Math.min(2000, timeLeft);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        let elapsed = Date.now() - startTime;
        timeLeft = milliseconds - elapsed;
    }
    return true;
}

export async function smeltItem(bot, itemName, num=1) {
    /**
     * Puts 1 coal in furnace and smelts the given item name, waits until the furnace runs out of fuel or input items.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemName, the item name to smelt. Ores must contain "raw" like raw_iron.
     * @param {number} num, the number of items to smelt. Defaults to 1.
     * @returns {Promise<boolean>} true if the item was smelted, false otherwise. Fail
     * @example
     * await skills.smeltItem(bot, "raw_iron");
     * await skills.smeltItem(bot, "beef");
     **/

    if (!mc.isSmeltable(itemName)) {
        log(bot, `Cannot smelt ${itemName}. Hint: make sure you are smelting the 'raw' item.`);
        return false;
    }

    let placedFurnace = false;
    let furnaceBlock = undefined;
    const furnaceRange = 16;
    furnaceBlock = world.getNearestBlock(bot, 'furnace', furnaceRange);
    if (!furnaceBlock){
        // Try to place furnace
        let hasFurnace = world.getInventoryCounts(bot)['furnace'] > 0;
        if (hasFurnace) {
            let pos = world.getNearestFreeSpace(bot, 1, furnaceRange);
            await placeBlock(bot, 'furnace', pos.x, pos.y, pos.z);
            furnaceBlock = world.getNearestBlock(bot, 'furnace', furnaceRange);
            placedFurnace = true;
        }
    }
    if (!furnaceBlock){
        log(bot, `There is no furnace nearby and you have no furnace.`)
        return false;
    }
    if (bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
        await goToNearestBlock(bot, 'furnace', 4, furnaceRange);
    }
    bot.modes.pause('unstuck');
    await bot.lookAt(furnaceBlock.position);

    console.log('smelting...');
    const furnace = await bot.openFurnace(furnaceBlock);
    // check if the furnace is already smelting something
    let input_item = furnace.inputItem();
    if (input_item && input_item.type !== mc.getItemId(itemName) && input_item.count > 0) {
        // TODO: check if furnace is currently burning fuel. furnace.fuel is always null, I think there is a bug.
        // This only checks if the furnace has an input item, but it may not be smelting it and should be cleared.
        log(bot, `The furnace is currently smelting ${mc.getItemName(input_item.type)}.`);
        if (placedFurnace)
            await collectBlock(bot, 'furnace', 1);
        return false;
    }
    // check if the bot has enough items to smelt
    let inv_counts = world.getInventoryCounts(bot);
    if (!inv_counts[itemName] || inv_counts[itemName] < num) {
        log(bot, `You do not have enough ${itemName} to smelt.`);
        if (placedFurnace)
            await collectBlock(bot, 'furnace', 1);
        return false;
    }

    // fuel the furnace
    if (!furnace.fuelItem()) {
        let fuel = mc.getSmeltingFuel(bot);
        if (!fuel) {
            log(bot, `You have no fuel to smelt ${itemName}, you need coal, charcoal, or wood.`);
            if (placedFurnace)
                await collectBlock(bot, 'furnace', 1);
            return false;
        }
        log(bot, `Using ${fuel.name} as fuel.`);

        const put_fuel = Math.ceil(num / mc.getFuelSmeltOutput(fuel.name));

        if (fuel.count < put_fuel) {
            log(bot, `You don't have enough ${fuel.name} to smelt ${num} ${itemName}; you need ${put_fuel}.`);
            if (placedFurnace)
                await collectBlock(bot, 'furnace', 1);
            return false;
        }
        await furnace.putFuel(fuel.type, null, put_fuel);
        log(bot, `Added ${put_fuel} ${mc.getItemName(fuel.type)} to furnace fuel.`);
        console.log(`Added ${put_fuel} ${mc.getItemName(fuel.type)} to furnace fuel.`)
    }
    // put the items in the furnace
    await furnace.putInput(mc.getItemId(itemName), null, num);
    // wait for the items to smelt
    let total = 0;
    let smelted_item = null;
    await new Promise(resolve => setTimeout(resolve, 200));
    let last_collected = Date.now();
    while (total < num) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (furnace.outputItem()) {
            smelted_item = await furnace.takeOutput();
            if (smelted_item) {
                total += smelted_item.count;
                last_collected = Date.now();
            }
        }
        if (Date.now() - last_collected > 11000) {
            break; // if nothing has been collected in 11 seconds, stop
        }
        if (bot.interrupt_code) {
            break;
        }
    }
    // take all remaining in input/fuel slots
    if (furnace.inputItem()) {
        await furnace.takeInput();
    }
    if (furnace.fuelItem()) {
        await furnace.takeFuel();
    }

    await bot.closeWindow(furnace);

    if (placedFurnace) {
        await collectBlock(bot, 'furnace', 1);
    }
    if (total === 0) {
        log(bot, `Failed to smelt ${itemName}.`);
        return false;
    }
    if (total < num) {
        log(bot, `Only smelted ${total} ${mc.getItemName(smelted_item.type)}.`);
        return false;
    }
    log(bot, `Successfully smelted ${itemName}, got ${total} ${mc.getItemName(smelted_item.type)}.`);
    return true;
}

export async function clearNearestFurnace(bot) {
    /**
     * Clears the nearest furnace of all items.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @returns {Promise<boolean>} true if the furnace was cleared, false otherwise.
     * @example
     * await skills.clearNearestFurnace(bot);
     **/
    let furnaceBlock = world.getNearestBlock(bot, 'furnace', 32);
    if (!furnaceBlock) {
        log(bot, `No furnace nearby to clear.`);
        return false;
    }
    if (bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
        await goToNearestBlock(bot, 'furnace', 4, 32);
    }

    console.log('clearing furnace...');
    const furnace = await bot.openFurnace(furnaceBlock);
    console.log('opened furnace...')
    // take the items out of the furnace
    let smelted_item, intput_item, fuel_item;
    if (furnace.outputItem())
        smelted_item = await furnace.takeOutput();
    if (furnace.inputItem())
        intput_item = await furnace.takeInput();
    if (furnace.fuelItem())
        fuel_item = await furnace.takeFuel();
    console.log(smelted_item, intput_item, fuel_item)
    let smelted_name = smelted_item ? `${smelted_item.count} ${smelted_item.name}` : `0 smelted items`;
    let input_name = intput_item ? `${intput_item.count} ${intput_item.name}` : `0 input items`;
    let fuel_name = fuel_item ? `${fuel_item.count} ${fuel_item.name}` : `0 fuel items`;
    log(bot, `Cleared furnace, received ${smelted_name}, ${input_name}, and ${fuel_name}.`);
    return true;

}


export async function attackNearest(bot, mobType, kill=true) {
    /**
     * Attack mob of the given type.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} mobType, the type of mob to attack.
     * @param {boolean} kill, whether or not to continue attacking until the mob is dead. Defaults to true.
     * @returns {Promise<boolean>} true if the mob was attacked, false if the mob type was not found.
     * @example
     * await skills.attackNearest(bot, "zombie", true);
     **/
    bot.modes.pause('cowardice');
    if (mobType === 'drowned' || mobType === 'cod' || mobType === 'salmon' || mobType === 'tropical_fish' || mobType === 'squid')
        bot.modes.pause('self_preservation'); // so it can go underwater. TODO: have an drowning mode so we don't turn off all self_preservation
    const mob = world.getNearbyEntities(bot, 24).find(entity => entity.name === mobType);
    if (mob) {
        return await attackEntity(bot, mob, kill);
    }
    log(bot, 'Could not find any '+mobType+' to attack.');
    return false;
}

export async function attackEntity(bot, entity, kill=true) {
    /**
     * Attack mob of the given type.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {Entity} entity, the entity to attack.
     * @returns {Promise<boolean>} true if the entity was attacked, false if interrupted
     * @example
     * await skills.attackEntity(bot, entity);
     **/

    let pos = entity.position;
    await equipHighestAttack(bot)

    if (!kill) {
        if (bot.entity.position.distanceTo(pos) > 5) {
            console.log('moving to mob...')
            await goToPosition(bot, pos.x, pos.y, pos.z);
        }
        console.log('attacking mob...')
        await bot.attack(entity);
    }
    else {
        bot.pvp.attack(entity);
        while (world.getNearbyEntities(bot, 24).includes(entity)) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (bot.interrupt_code) {
                bot.pvp.stop();
                return false;
            }
        }
        log(bot, `Successfully killed ${entity.name}.`);
        await pickupNearbyItems(bot);
        return true;
    }
}

export async function defendSelf(bot, range=9) {
    /**
     * Defend yourself from all nearby hostile mobs until there are no more.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {number} range, the range to look for mobs. Defaults to 8.
     * @returns {Promise<boolean>} true if the bot found any enemies and has killed them, false if no entities were found.
     * @example
     * await skills.defendSelf(bot);
     * **/
    bot.modes.pause('self_defense');
    bot.modes.pause('cowardice');
    let attacked = false;
    let enemy = world.getNearestEntityWhere(bot, entity => mc.isHostile(entity), range);
    while (enemy) {
        await equipHighestAttack(bot);
        if (bot.entity.position.distanceTo(enemy.position) >= 4 && enemy.name !== 'creeper' && enemy.name !== 'phantom') {
            try {
                bot.pathfinder.setMovements(new pf.Movements(bot));
                await bot.pathfinder.goto(new pf.goals.GoalFollow(enemy, 3.5), true);
            } catch (err) {/* might error if entity dies, ignore */}
        }
        if (bot.entity.position.distanceTo(enemy.position) <= 2) {
            try {
                bot.pathfinder.setMovements(new pf.Movements(bot));
                let inverted_goal = new pf.goals.GoalInvert(new pf.goals.GoalFollow(enemy, 2));
                await bot.pathfinder.goto(inverted_goal, true);
            } catch (err) {/* might error if entity dies, ignore */}
        }
        bot.pvp.attack(enemy);
        attacked = true;
        await new Promise(resolve => setTimeout(resolve, 500));
        enemy = world.getNearestEntityWhere(bot, entity => mc.isHostile(entity), range);
        if (bot.interrupt_code) {
            bot.pvp.stop();
            return false;
        }
    }
    bot.pvp.stop();
    if (attacked)
        log(bot, `Successfully defended self.`);
    else
        log(bot, `No enemies nearby to defend self from.`);
    return attacked;
}



export async function collectBlock(bot, blockType, num=1, exclude=null) {
    /**
     * Collect one of the given block type.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} blockType, the type of block to collect.
     * @param {number} num, the number of blocks to collect. Defaults to 1.
     * @param {list} exclude, a list of positions to exclude from the search. Defaults to null.
     * @returns {Promise<boolean>} true if the block was collected, false if the block type was not found.
     * @example
     * await skills.collectBlock(bot, "oak_log");
     **/
    if (num < 1) {
        log(bot, `Invalid number of blocks to collect: ${num}.`);
        return false;
    }
    let blocktypes = [blockType];
    if (blockType === 'coal' || blockType === 'diamond' || blockType === 'emerald' || blockType === 'iron' || blockType === 'gold' || blockType === 'lapis_lazuli' || blockType === 'redstone')
        blocktypes.push(blockType+'_ore');
    if (blockType.endsWith('ore'))
        blocktypes.push('deepslate_'+blockType);
    if (blockType === 'dirt')
        blocktypes.push('grass_block');
    if (blockType === 'cobblestone')
        blocktypes.push('stone');
    const isLiquid = blockType === 'lava' || blockType === 'water';

    let collected = 0;

    const movements = new pf.Movements(bot);
    movements.dontMineUnderFallingBlock = false;
    movements.dontCreateFlow = true;

    // Blocks to ignore safety for, usually next to lava/water
    const unsafeBlocks = ['obsidian'];

    for (let i=0; i<num; i++) {
        let blocks = world.getNearestBlocksWhere(bot, block => {
            if (!blocktypes.includes(block.name)) {
                return false;
            }
            if (exclude) {
                for (let position of exclude) {
                    if (block.position.x === position.x && block.position.y === position.y && block.position.z === position.z) {
                        return false;
                    }
                }
            }
            if (isLiquid) {
                // collect only source blocks
                return block.metadata === 0;
            }
            
            return movements.safeToBreak(block) || unsafeBlocks.includes(block.name);
        }, 64, 1);

        if (blocks.length === 0) {
            if (collected === 0)
                log(bot, `No ${blockType} nearby to collect.`);
            else
                log(bot, `No more ${blockType} nearby to collect.`);
            break;
        }
        const block = blocks[0];
        await bot.tool.equipForBlock(block);
        if (isLiquid) {
            const bucket = bot.inventory.items().find(item => item.name === 'bucket');
            if (!bucket) {
                log(bot, `Don't have bucket to harvest ${blockType}.`);
                return false;
            }
            await bot.equip(bucket, 'hand');
        }
        const itemId = bot.heldItem ? bot.heldItem.type : null
        if (!block.canHarvest(itemId)) {
            log(bot, `Don't have right tools to harvest ${blockType}.`);
            return false;
        }
        try {
            let success = false;
            if (isLiquid) {
                success = await useToolOnBlock(bot, 'bucket', block);
            }
            else if (mc.mustCollectManually(blockType)) {
                await goToPosition(bot, block.position.x, block.position.y, block.position.z, 2);
                await bot.dig(block);
                await pickupNearbyItems(bot);
                success = true;
            }
            else {
                // Enhanced Mining System with dual approach and event monitoring
                console.log(`🔧 Enhanced Mining: ${block.name} at ${block.position.x}, ${block.position.y}, ${block.position.z}`);
                
                // Try mineflayer-collectblock first (it works outside spawn protection)
                if (bot.collectBlock && bot.collectBlock.collect) {
                    try {
                        console.log(`🎯 Trying mineflayer-collectblock for ${block.name}...`);
                        await bot.collectBlock.collect(block);
                        success = true;
                        console.log(`✅ Successfully collected ${block.name} via mineflayer-collectblock`);
                    } catch (collectError) {
                        console.log(`⚠️ mineflayer-collectblock failed: ${collectError.message}`);
                        console.log(`🔧 Falling back to Enhanced Mining System...`);
                        success = await manualDigWithEvents(bot, block);
                    }
                } else {
                    console.log(`🔧 Using Enhanced Mining System (no collectblock plugin)...`);
                    success = await manualDigWithEvents(bot, block);
                }
            }
            if (success)
                collected++;
            await autoLight(bot);
        }
        catch (err) {
            if (err.name === 'NoChests') {
                log(bot, `Failed to collect ${blockType}: Inventory full, no place to deposit.`);
                break;
            }
            else {
                log(bot, `Failed to collect ${blockType}: ${err}.`);
                continue;
            }
        }
        
        if (bot.interrupt_code)
            break;  
    }
    log(bot, `Collected ${collected} ${blockType}.`);
    return collected > 0;
}

export async function pickupNearbyItems(bot) {
    /**
     * Pick up all nearby items.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @returns {Promise<boolean>} true if the items were picked up, false otherwise.
     * @example
     * await skills.pickupNearbyItems(bot);
     **/
    const distance = 8;
    const getNearestItem = bot => bot.nearestEntity(entity => entity.name === 'item' && bot.entity.position.distanceTo(entity.position) < distance);
    let nearestItem = getNearestItem(bot);
    let pickedUp = 0;
    while (nearestItem) {
        let movements = new pf.Movements(bot);
        movements.canDig = false;
        bot.pathfinder.setMovements(movements);
        await goToGoal(bot, new pf.goals.GoalFollow(nearestItem, 1));
        await new Promise(resolve => setTimeout(resolve, 200));
        let prev = nearestItem;
        nearestItem = getNearestItem(bot);
        if (prev === nearestItem) {
            break;
        }
        pickedUp++;
    }
    log(bot, `Picked up ${pickedUp} items.`);
    return true;
}


export async function breakBlockAt(bot, x, y, z) {
    /**
     * Break the block at the given position. Will use the bot's equipped item.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {number} x, the x coordinate of the block to break.
     * @param {number} y, the y coordinate of the block to break.
     * @param {number} z, the z coordinate of the block to break.
     * @returns {Promise<boolean>} true if the block was broken, false otherwise.
     * @example
     * let position = world.getPosition(bot);
     * await skills.breakBlockAt(bot, position.x, position.y - 1, position.x);
     **/
    if (x == null || y == null || z == null) throw new Error('Invalid position to break block at.');
    let block = bot.blockAt(Vec3(x, y, z));
    if (block.name !== 'air' && block.name !== 'water' && block.name !== 'lava') {
        if (bot.modes.isOn('cheat')) {
            if (useDelay) { await new Promise(resolve => setTimeout(resolve, blockPlaceDelay)); }
            let msg = '/setblock ' + Math.floor(x) + ' ' + Math.floor(y) + ' ' + Math.floor(z) + ' air';
            bot.chat(msg);
            log(bot, `Used /setblock to break block at ${x}, ${y}, ${z}.`);
            return true;
        }

        if (bot.entity.position.distanceTo(block.position) > 5.0) {
            let pos = block.position;
            let movements = new pf.Movements(bot);
            movements.canPlaceOn = false;
            movements.allow1by1towers = false;
            bot.pathfinder.setMovements(movements);
            await goToGoal(bot, new pf.goals.GoalNear(pos.x, pos.y, pos.z, 4));
        }
        if (bot.game.gameMode !== 'creative') {
            await bot.tool.equipForBlock(block);
            const itemId = bot.heldItem ? bot.heldItem.type : null
            if (!block.canHarvest(itemId)) {
                log(bot, `Don't have right tools to break ${block.name}.`);
                return false;
            }
        }
        await bot.dig(block, true);
        log(bot, `Broke ${block.name} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`);
    }
    else {
        log(bot, `Skipping block at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)} because it is ${block.name}.`);
        return false;
    }
    return true;
}

// Simplified block state application - only for critical blocks
function applyBlockStates(blockType, placeOn, botPosition, targetPos) {
    // Skip if block already has states (from schematic)
    if (blockType.includes('[')) {
        return blockType;
    }
    
    // Extract base block name
    const baseName = blockType.split('[')[0];

    // Only handle the most important blocks to avoid issues
    try {
        // Furnaces (most common)
        if (baseName === 'furnace' || baseName === 'blast_furnace' || baseName === 'smoker') {
            return blockType + '[facing=north]';
        }
        
        // Chests (most common)
        if (baseName === 'chest' || baseName === 'trapped_chest') {
            return blockType + '[facing=north,type=single]';
        }
        
        // Logs (most common axis blocks)
        if (baseName.includes('_log') || baseName === 'oak_log' || baseName === 'birch_log') {
            if (placeOn === 'north' || placeOn === 'south') {
                return blockType + '[axis=z]';
            } else if (placeOn === 'east' || placeOn === 'west') {
                return blockType + '[axis=x]';
            } else {
                return blockType + '[axis=y]';
            }
        }
        
        // Stairs (most common)
        if (baseName.includes('_stairs')) {
            const half = (placeOn === 'top') ? 'top' : 'bottom';
            return blockType + `[facing=north,half=${half},shape=straight]`;
        }
        
        // Slabs (most common)
        if (baseName.includes('_slab')) {
            const type = (placeOn === 'top') ? 'top' : 'bottom';
            return blockType + `[type=${type}]`;
        }
        
        // Betten - intelligente Ausrichtung basierend auf Bot-Position
        if (baseName.includes('_bed')) {
            // Berechne Richtung vom Bot zum Zielblock
            const dx = targetPos.x - botPosition.x;
            const dz = targetPos.z - botPosition.z;
            
            let facing = 'south'; // Standard
            if (Math.abs(dx) > Math.abs(dz)) {
                facing = dx > 0 ? 'east' : 'west';
            } else {
                facing = dz > 0 ? 'south' : 'north';
            }
            
            return blockType + `[part=foot,facing=${facing}]`;
        }
        
        // Türen - intelligente Ausrichtung
        if (baseName.includes('_door')) {
            // Ähnliche Logik wie bei Betten
            const dx = targetPos.x - botPosition.x;
            const dz = targetPos.z - botPosition.z;
            
            let facing = 'south';
            if (Math.abs(dx) > Math.abs(dz)) {
                facing = dx > 0 ? 'east' : 'west';
            } else {
                facing = dz > 0 ? 'south' : 'north';
            }
            
            return blockType + `[half=lower,facing=${facing}]`;
        }
        
        // Hohe Pflanzen
        if (['sunflower', 'lilac', 'rose_bush', 'peony', 'tall_grass', 'large_fern'].includes(baseName)) {
            return blockType + '[half=lower]';
        }
        
    } catch (error) {
        // If anything goes wrong, return original block type
        console.log(`Block state error for ${blockType}: ${error.message}`);
        return blockType;
    }

    // Return unchanged for all other blocks
    return blockType;
}

// Complex helper functions removed - using simplified approach in applyBlockStates

// Simple creative item helper - no global locks to avoid deadlocks
async function ensureCreativeItem(bot, itemName) {
    // Check if item already exists
    let item = bot.inventory.items().find(item => item.name === itemName);
    if (item) {
        return item;
    }
    
    try {
        // Simple approach: find next available slot in hotbar/inventory (avoid armor slots 36-39)
        let targetSlot = -1;
        for (let slot = 0; slot <= 35; slot++) {
            const item = bot.inventory.slots[slot];
            if (!item || item.name === itemName) {
                targetSlot = slot;
                break;
            }
        }
        
        if (targetSlot === -1) {
            targetSlot = 8; // Default to last hotbar slot if inventory is full
        }
        
        await bot.creative.setInventorySlot(targetSlot, mc.makeItem(itemName, 1));
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Find the item
        const newItem = bot.inventory.items().find(item => item.name === itemName);
        if (newItem) {
            return newItem;
        }
        
        log(bot, `Could not find ${itemName} after creative placement`);
        return null;
    } catch (error) {
        log(bot, `Creative inventory error for ${itemName}: ${error.message}`);
        return null;
    }
}

export async function placeBlock(bot, blockType, x, y, z, placeOn='bottom', dontCheat=false) {
    /**
     * Place the given block type at the given position. It will build off from any adjacent blocks. Will fail if there is a block in the way or nothing to build off of.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} blockType, the type of block to place, which can be a block or item name.
     * @param {number} x, the x coordinate of the block to place.
     * @param {number} y, the y coordinate of the block to place.
     * @param {number} z, the z coordinate of the block to place.
     * @param {string} placeOn, the preferred side of the block to place on. Can be 'top', 'bottom', 'north', 'south', 'east', 'west', or 'side'. Defaults to bottom. Will place on first available side if not possible.
     * @param {boolean} dontCheat, overrides cheat mode to place the block normally. Defaults to false.
     * @returns {Promise<boolean>} true if the block was placed, false otherwise.
     * @example
     * let p = world.getPosition(bot);
     * await skills.placeBlock(bot, "oak_log", p.x + 2, p.y, p.x);
     * await skills.placeBlock(bot, "torch", p.x + 1, p.y, p.x, 'side');
     **/
    const target_dest = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));

    if (blockType === 'air') {
        log(bot, `Placing air (removing block) at ${target_dest}.`);
        return await breakBlockAt(bot, x, y, z);
    }

    if (bot.modes.isOn('cheat') && !dontCheat) {
        if (bot.restrict_to_inventory) {
            let block = bot.inventory.items().find(item => item.name === blockType);
            if (!block) {
                log(bot, `Cannot place ${blockType}, you are restricted to your current inventory.`);
                return false;
            }
        }

        // Enhanced block state support (simplified implementation)
        if (!blockType.includes('[')) {
            blockType = applyBlockStates(blockType, placeOn, bot.entity.position, { x, y, z });
        }
        
        // Legacy support (kept for compatibility)
        let face = placeOn === 'north' ? 'south' : placeOn === 'south' ? 'north' : placeOn === 'east' ? 'west' : 'east';
        if (blockType.includes('torch') && placeOn !== 'bottom') {
            // insert wall_ before torch
            blockType = blockType.replace('torch', 'wall_torch');
            if (placeOn !== 'side' && placeOn !== 'top') {
                blockType += `[facing=${face}]`;
            }
        }
        if (blockType.includes('button') || blockType === 'lever') {
            if (placeOn === 'top') {
                blockType += `[face=ceiling]`;
            }
            else if (placeOn === 'bottom') {
                blockType += `[face=floor]`;
            }
            else {
                blockType += `[facing=${face}]`;
            }
        }
        if (blockType === 'ladder' || blockType === 'repeater' || blockType === 'comparator') {
            blockType += `[facing=${face}]`;
        }
        if (blockType.includes('stairs')) {
            blockType += `[facing=${face}]`;
        }
        if (useDelay) { await new Promise(resolve => setTimeout(resolve, blockPlaceDelay)); }
        let msg = '/setblock ' + Math.floor(x) + ' ' + Math.floor(y) + ' ' + Math.floor(z) + ' ' + blockType;
        bot.chat(msg);
        // Handle complex blocks with special placement rules
        if (blockType.includes('door') && blockType.includes('half=lower')) {
            // For doors, only place upper half if this is the lower half
            if (useDelay) { await new Promise(resolve => setTimeout(resolve, blockPlaceDelay)); }
            // Replace lower with upper in the block state
            let upperDoor = blockType.replace('half=lower', 'half=upper');
            bot.chat('/setblock ' + Math.floor(x) + ' ' + Math.floor(y+1) + ' ' + Math.floor(z) + ' ' + upperDoor);
        }
        
        if (blockType.includes('bed') && blockType.includes('part=foot')) {
            // For beds, only place head part if this is the foot part
            if (useDelay) { await new Promise(resolve => setTimeout(resolve, blockPlaceDelay)); }
            // Calculate head position based on facing direction
            let headX = x, headZ = z;
            if (blockType.includes('facing=north')) headZ--;
            else if (blockType.includes('facing=south')) headZ++;
            else if (blockType.includes('facing=east')) headX++;
            else if (blockType.includes('facing=west')) headX--;
            
            // Replace foot with head in the block state
            let headBed = blockType.replace('part=foot', 'part=head');
            bot.chat('/setblock ' + Math.floor(headX) + ' ' + Math.floor(y) + ' ' + Math.floor(headZ) + ' ' + headBed);
        }
        log(bot, `Used /setblock to place ${blockType} at ${target_dest}.`);
        return true;
    }

    // Extract base item name from block type (remove states)
    let item_name = blockType.split('[')[0]; // Remove block states for item lookup
    
    if (item_name == "redstone_wire")
        item_name = "redstone";
    else if (item_name === 'water') {
        item_name = 'water_bucket';
    }
    else if (item_name === 'lava') {
        item_name = 'lava_bucket';
    }
    
    let block_item = bot.inventory.items().find(item => item.name === item_name);
    if (!block_item && bot.game.gameMode === 'creative' && !bot.restrict_to_inventory) {
        // Improved creative mode inventory handling with mutex-like behavior
        block_item = await ensureCreativeItem(bot, item_name);
    }
    if (!block_item) {
        log(bot, `Don't have any ${item_name} to place.`);
        return false;
    }

    const targetBlock = bot.blockAt(target_dest);
    const baseBlockType = blockType.split('[')[0]; // Get base block name without states
    if (targetBlock.name === baseBlockType || targetBlock.name === blockType || (targetBlock.name === 'grass_block' && baseBlockType === 'dirt')) {
        log(bot, `${baseBlockType} already at ${targetBlock.position}.`);
        return false;
    }
    const empty_blocks = ['air', 'water', 'lava', 'grass', 'short_grass', 'tall_grass', 'snow', 'dead_bush', 'fern'];
    if (!empty_blocks.includes(targetBlock.name)) {
        log(bot, `${targetBlock.name} in the way at ${targetBlock.position}.`);
        const removed = await breakBlockAt(bot, x, y, z);
        if (!removed) {
            log(bot, `Cannot place ${blockType} at ${targetBlock.position}: block in the way.`);
            return false;
        }
        await new Promise(resolve => setTimeout(resolve, 200)); // wait for block to break
    }
    // get the buildoffblock and facevec based on whichever adjacent block is not empty
    let buildOffBlock = null;
    let faceVec = null;
    const dir_map = {
        'top': Vec3(0, 1, 0),
        'bottom': Vec3(0, -1, 0),
        'north': Vec3(0, 0, -1),
        'south': Vec3(0, 0, 1),
        'east': Vec3(1, 0, 0),
        'west': Vec3(-1, 0, 0),
    }
    let dirs = [];
    if (placeOn === 'side') {
        dirs.push(dir_map['north'], dir_map['south'], dir_map['east'], dir_map['west']);
    }
    else if (dir_map[placeOn] !== undefined) {
        dirs.push(dir_map[placeOn]);
    }
    else {
        dirs.push(dir_map['bottom']);
        log(bot, `Unknown placeOn value "${placeOn}". Defaulting to bottom.`);
    }
    dirs.push(...Object.values(dir_map).filter(d => !dirs.includes(d)));

    // Blocks to avoid building off of (interactive blocks)
    const interactive_blocks = [
        'chest', 'trapped_chest', 'ender_chest', 
        'oak_door', 'birch_door', 'spruce_door', 'jungle_door', 'acacia_door', 'dark_oak_door', 'iron_door',
        'furnace', 'blast_furnace', 'smoker', 
        'crafting_table', 'enchanting_table', 'anvil', 'grindstone', 'stonecutter',
        'brewing_stand', 'cauldron', 'composter', 'barrel',
        'hopper', 'dispenser', 'dropper', 'observer',
        'lectern', 'cartography_table', 'fletching_table', 'smithing_table',
        'loom', 'note_block', 'jukebox', 'beacon'
    ];

    // First try: solid, non-interactive blocks
    for (let d of dirs) {
        const block = bot.blockAt(target_dest.plus(d));
        if (!empty_blocks.includes(block.name) && !interactive_blocks.includes(block.name)) {
            buildOffBlock = block;
            faceVec = new Vec3(-d.x, -d.y, -d.z); // invert
            break;
        }
    }
    
    // Second try: any solid block (including interactive ones)
    if (!buildOffBlock) {
        for (let d of dirs) {
            const block = bot.blockAt(target_dest.plus(d));
            if (!empty_blocks.includes(block.name)) {
                buildOffBlock = block;
                faceVec = new Vec3(-d.x, -d.y, -d.z); // invert
                break;
            }
        }
    }
    
    // Third try: aerial placement using /setblock (no reference block needed)
    if (!buildOffBlock) {
        log(bot, `No solid blocks around ${blockType}, using aerial placement mode...`);
        
        // For aerial placement, we need to use /setblock command
        if (!bot.modes.isOn('cheat')) {
            log(bot, `Cannot place ${blockType} at ${targetBlock.position}: no reference blocks and cheat mode not enabled.`);
            return false;
        }
        
        // Enhanced block state support for aerial placement (simplified implementation)
        if (!blockType.includes('[')) {
            blockType = applyBlockStates(blockType, placeOn, bot.entity.position, { x, y, z });
        }
        
        // Legacy support (kept for compatibility)
        let face = placeOn === 'north' ? 'south' : placeOn === 'south' ? 'north' : placeOn === 'east' ? 'west' : 'east';
        if (blockType.includes('torch') && placeOn !== 'bottom') {
            // insert wall_ before torch
            blockType = blockType.replace('torch', 'wall_torch');
            if (placeOn !== 'side' && placeOn !== 'top') {
                blockType += `[facing=${face}]`;
            }
        }
        if (blockType.includes('button') || blockType === 'lever') {
            if (placeOn === 'top') {
                blockType += `[face=ceiling]`;
            }
            else if (placeOn === 'bottom') {
                blockType += `[face=floor]`;
            }
            else {
                blockType += `[facing=${face}]`;
            }
        }
        if (blockType === 'ladder' || blockType === 'repeater' || blockType === 'comparator') {
            blockType += `[facing=${face}]`;
        }
        if (blockType.includes('stairs')) {
            blockType += `[facing=${face}]`;
        }
        if (useDelay) { await new Promise(resolve => setTimeout(resolve, blockPlaceDelay)); }
        let msg = '/setblock ' + Math.floor(x) + ' ' + Math.floor(y) + ' ' + Math.floor(z) + ' ' + blockType;
        bot.chat(msg);
        // Handle complex blocks with special placement rules
        if (blockType.includes('door') && blockType.includes('half=lower')) {
            // For doors, only place upper half if this is the lower half
            if (useDelay) { await new Promise(resolve => setTimeout(resolve, blockPlaceDelay)); }
            // Replace lower with upper in the block state
            let upperDoor = blockType.replace('half=lower', 'half=upper');
            bot.chat('/setblock ' + Math.floor(x) + ' ' + Math.floor(y+1) + ' ' + Math.floor(z) + ' ' + upperDoor);
        }
        
        if (blockType.includes('bed') && blockType.includes('part=foot')) {
            // For beds, only place head part if this is the foot part
            if (useDelay) { await new Promise(resolve => setTimeout(resolve, blockPlaceDelay)); }
            // Calculate head position based on facing direction
            let headX = x, headZ = z;
            if (blockType.includes('facing=north')) headZ--;
            else if (blockType.includes('facing=south')) headZ++;
            else if (blockType.includes('facing=east')) headX++;
            else if (blockType.includes('facing=west')) headX--;
            
            // Replace foot with head in the block state
            let headBed = blockType.replace('part=foot', 'part=head');
            bot.chat('/setblock ' + Math.floor(headX) + ' ' + Math.floor(y) + ' ' + Math.floor(headZ) + ' ' + headBed);
        }
        log(bot, `Used /setblock for aerial placement of ${blockType} at ${target_dest}.`);
        return true;
    }

    const pos = bot.entity.position;
    const pos_above = pos.plus(Vec3(0,1,0));
    const dont_move_for = ['torch', 'redstone_torch', 'redstone', 'lever', 'button', 'rail', 'detector_rail', 
        'powered_rail', 'activator_rail', 'tripwire_hook', 'tripwire', 'water_bucket', 'string'];
    // Movement handling with better error handling
    try {
        if (!dont_move_for.includes(item_name) && (pos.distanceTo(targetBlock.position) < 1.1 || pos_above.distanceTo(targetBlock.position) < 1.1)) {
            // too close - move away
            let goal = new pf.goals.GoalNear(targetBlock.position.x, targetBlock.position.y, targetBlock.position.z, 2);
            let inverted_goal = new pf.goals.GoalInvert(goal);
            bot.pathfinder.setMovements(new pf.Movements(bot));
            
            // Stop any existing pathfinder goals before setting new one
            if (bot.pathfinder.isMoving()) {
                bot.pathfinder.setGoal(null);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            await bot.pathfinder.goto(inverted_goal);
        }
        
        if (bot.entity.position.distanceTo(targetBlock.position) > 5.0) {
            // too far - move closer (5 block range for optimal building)
            let pos = targetBlock.position;
            let movements = new pf.Movements(bot);
            bot.pathfinder.setMovements(movements);
            
            // Stop any existing pathfinder goals before setting new one
            if (bot.pathfinder.isMoving()) {
                bot.pathfinder.setGoal(null);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            await goToGoal(bot, new pf.goals.GoalNear(pos.x, pos.y, pos.z, 4));
        }
    } catch (pathError) {
        // Log pathfinder errors but continue with block placement
        log(bot, `Movement warning for ${blockType} placement: ${pathError.message}`);
        // Don't return false here - try to place block anyway if we're reasonably close
        if (bot.entity.position.distanceTo(targetBlock.position) > 8) {
            log(bot, `Too far from target (${bot.entity.position.distanceTo(targetBlock.position).toFixed(1)} blocks), cannot place ${blockType}`);
            return false;
        }
    }

    // will throw error if an entity is in the way, and sometimes even if the block was placed
    try {
        if (item_name.includes('bucket')) {
            await useToolOnBlock(bot, item_name, buildOffBlock);
        }
        else {
            await bot.equip(block_item, 'hand');
            
            // Handle bot orientation ONLY for problematic blocks that really need it
            const problematicBlocks = ['bed']; // Only beds have critical orientation issues
            const baseBlockName = item_name.split('[')[0];
            const isOrientedBlock = problematicBlocks.some(oriented => baseBlockName.includes(oriented));
            
            if (isOrientedBlock && blockType.includes('[facing=')) {
                // Extract desired facing from block state
                const facingMatch = blockType.match(/facing=([^,\]]+)/);
                if (facingMatch) {
                    const desiredFacing = facingMatch[1];
                    
                    // Set bot yaw to ensure correct block orientation
                    const facingToYaw = {
                        'north': 0,      // 0 degrees
                        'east': -Math.PI/2,  // -90 degrees  
                        'south': Math.PI,    // 180 degrees
                        'west': Math.PI/2    // 90 degrees
                    };
                    
                    if (facingToYaw[desiredFacing] !== undefined) {
                        const targetYaw = facingToYaw[desiredFacing];
                        
                        // Smooth rotation to target yaw
                        log(bot, `Setting bot orientation for ${baseBlockName} facing ${desiredFacing} (yaw: ${(targetYaw * 180/Math.PI).toFixed(0)}°)`);
                        await bot.look(targetYaw, 0, true); // yaw, pitch, force
                        await new Promise(resolve => setTimeout(resolve, 200)); // Wait for orientation
                    }
                }
            }
            
            await bot.lookAt(buildOffBlock.position.offset(0.5, 0.5, 0.5));
            
            // Special handling for interactive blocks to avoid unwanted interactions
            const interactive_blocks = [
                'chest', 'trapped_chest', 'ender_chest', 
                'oak_door', 'birch_door', 'spruce_door', 'jungle_door', 'acacia_door', 'dark_oak_door', 'iron_door',
                'furnace', 'blast_furnace', 'smoker', 
                'crafting_table', 'enchanting_table', 'anvil', 'grindstone', 'stonecutter',
                'brewing_stand', 'cauldron', 'composter', 'barrel',
                'hopper', 'dispenser', 'dropper', 'observer',
                'lectern', 'cartography_table', 'fletching_table', 'smithing_table',
                'loom', 'note_block', 'jukebox', 'beacon'
            ];
            
            if (interactive_blocks.includes(buildOffBlock.name)) {
                // For interactive blocks, use sneaking to avoid opening interfaces
                bot.setControlState('sneak', true);
                await new Promise(resolve => setTimeout(resolve, 50));
                
                try {
                    await bot.placeBlock(buildOffBlock, faceVec);
                    log(bot, `Placed ${blockType} at ${target_dest} (sneaking to avoid interaction with ${buildOffBlock.name}).`);
                } finally {
                    // Always stop sneaking
                    bot.setControlState('sneak', false);
                }
            } else {
                await bot.placeBlock(buildOffBlock, faceVec);
                log(bot, `Placed ${blockType} at ${target_dest}.`);
            }
            
            // No cleanup needed - using existing blocks or air references
            
            await new Promise(resolve => setTimeout(resolve, 200));
            return true;
        }
    } catch (err) {
        log(bot, `Failed to place ${blockType} at ${target_dest}.`);
        return false;
    }
}

export async function equip(bot, itemName) {
    /**
     * Equip the given item to the proper body part, like tools or armor.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemName, the item or block name to equip.
     * @returns {Promise<boolean>} true if the item was equipped, false otherwise.
     * @example
     * await skills.equip(bot, "iron_pickaxe");
     **/
    if (itemName === 'hand') {
        await bot.unequip('hand');
        log(bot, `Unequipped hand.`);
        return true;
    }
    let item = bot.inventory.slots.find(slot => slot && slot.name === itemName);
    if (!item) {
        if (bot.game.gameMode === "creative") {
            // Find safe slot for equipment (avoid armor slots 36-39)
            let targetSlot = -1;
            for (let slot = 0; slot <= 35; slot++) {
                const slotItem = bot.inventory.slots[slot];
                if (!slotItem || slotItem.name === itemName) {
                    targetSlot = slot;
                    break;
                }
            }
            
            if (targetSlot === -1) {
                targetSlot = 8; // Default to last hotbar slot
            }
            
            await bot.creative.setInventorySlot(targetSlot, mc.makeItem(itemName, 1));
            item = bot.inventory.items().find(item => item.name === itemName);
        }
        else {
            log(bot, `You do not have any ${itemName} to equip.`);
            return false;
        }
    }
    if (itemName.includes('leggings')) {
        await bot.equip(item, 'legs');
    }
    else if (itemName.includes('boots')) {
        await bot.equip(item, 'feet');
    }
    else if (itemName.includes('helmet')) {
        await bot.equip(item, 'head');
    }
    else if (itemName.includes('chestplate') || itemName.includes('elytra')) {
        await bot.equip(item, 'torso');
    }
    else if (itemName.includes('shield')) {
        await bot.equip(item, 'off-hand');
    }
    else {
        await bot.equip(item, 'hand');
    }
    log(bot, `Equipped ${itemName}.`);
    return true;
}

export async function discard(bot, itemName, num=-1) {
    /**
     * Discard the given item.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemName, the item or block name to discard.
     * @param {number} num, the number of items to discard. Defaults to -1, which discards all items.
     * @returns {Promise<boolean>} true if the item was discarded, false otherwise.
     * @example
     * await skills.discard(bot, "oak_log");
     **/
    let discarded = 0;
    while (true) {
        let item = bot.inventory.items().find(item => item.name === itemName);
        if (!item) {
            break;
        }
        let to_discard = num === -1 ? item.count : Math.min(num - discarded, item.count);
        await bot.toss(item.type, null, to_discard);
        discarded += to_discard;
        if (num !== -1 && discarded >= num) {
            break;
        }
    }
    if (discarded === 0) {
        log(bot, `You do not have any ${itemName} to discard.`);
        return false;
    }
    log(bot, `Discarded ${discarded} ${itemName}.`);
    return true;
}

export async function putInChest(bot, itemName, num=-1) {
    /**
     * Put the given item in the nearest chest.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemName, the item or block name to put in the chest.
     * @param {number} num, the number of items to put in the chest. Defaults to -1, which puts all items.
     * @returns {Promise<boolean>} true if the item was put in the chest, false otherwise.
     * @example
     * await skills.putInChest(bot, "oak_log");
     **/
    let chest = world.getNearestBlock(bot, 'chest', 32);
    if (!chest) {
        log(bot, `Could not find a chest nearby.`);
        return false;
    }
    let item = bot.inventory.items().find(item => item.name === itemName);
    if (!item) {
        log(bot, `You do not have any ${itemName} to put in the chest.`);
        return false;
    }
    let to_put = num === -1 ? item.count : Math.min(num, item.count);
    await goToPosition(bot, chest.position.x, chest.position.y, chest.position.z, 2);
    const chestContainer = await bot.openContainer(chest);
    await chestContainer.deposit(item.type, null, to_put);
    await chestContainer.close();
    log(bot, `Successfully put ${to_put} ${itemName} in the chest.`);
    return true;
}

export async function takeFromChest(bot, itemName, num=-1) {
    /**
     * Take the given item from the nearest chest, potentially from multiple slots.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemName, the item or block name to take from the chest.
     * @param {number} num, the number of items to take from the chest. Defaults to -1, which takes all items.
     * @returns {Promise<boolean>} true if the item was taken from the chest, false otherwise.
     * @example
     * await skills.takeFromChest(bot, "oak_log");
     * **/
    let chest = world.getNearestBlock(bot, 'chest', 32);
    if (!chest) {
        log(bot, `Could not find a chest nearby.`);
        return false;
    }
    await goToPosition(bot, chest.position.x, chest.position.y, chest.position.z, 2);
    const chestContainer = await bot.openContainer(chest);
    
    // Find all matching items in the chest
    let matchingItems = chestContainer.containerItems().filter(item => item.name === itemName);
    if (matchingItems.length === 0) {
        log(bot, `Could not find any ${itemName} in the chest.`);
        await chestContainer.close();
        return false;
    }
    
    let totalAvailable = matchingItems.reduce((sum, item) => sum + item.count, 0);
    let remaining = num === -1 ? totalAvailable : Math.min(num, totalAvailable);
    let totalTaken = 0;
    
    // Take items from each slot until we've taken enough or run out
    for (const item of matchingItems) {
        if (remaining <= 0) break;
        
        let toTakeFromSlot = Math.min(remaining, item.count);
        await chestContainer.withdraw(item.type, null, toTakeFromSlot);
        
        totalTaken += toTakeFromSlot;
        remaining -= toTakeFromSlot;
    }
    
    await chestContainer.close();
    log(bot, `Successfully took ${totalTaken} ${itemName} from the chest.`);
    return totalTaken > 0;
}

export async function viewChest(bot) {
    /**
     * View the contents of the nearest chest.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @returns {Promise<boolean>} true if the chest was viewed, false otherwise.
     * @example
     * await skills.viewChest(bot);
     * **/
    let chest = world.getNearestBlock(bot, 'chest', 32);
    if (!chest) {
        log(bot, `Could not find a chest nearby.`);
        return false;
    }
    await goToPosition(bot, chest.position.x, chest.position.y, chest.position.z, 2);
    const chestContainer = await bot.openContainer(chest);
    let items = chestContainer.containerItems();
    if (items.length === 0) {
        log(bot, `The chest is empty.`);
    }
    else {
        log(bot, `The chest contains:`);
        for (let item of items) {
            log(bot, `${item.count} ${item.name}`);
        }
    }
    await chestContainer.close();
    return true;
}

export async function consume(bot, itemName="") {
    /**
     * Eat/drink the given item.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemName, the item to eat/drink.
     * @returns {Promise<boolean>} true if the item was eaten, false otherwise.
     * @example
     * await skills.eat(bot, "apple");
     **/
    let item, name;
    if (itemName) {
        item = bot.inventory.items().find(item => item.name === itemName);
        name = itemName;
    }
    if (!item) {
        log(bot, `You do not have any ${name} to eat.`);
        return false;
    }
    await bot.equip(item, 'hand');
    await bot.consume();
    log(bot, `Consumed ${item.name}.`);
    return true;
}


export async function giveToPlayer(bot, itemType, username, num=1) {
    /**
     * Give one of the specified item to the specified player
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemType, the name of the item to give.
     * @param {string} username, the username of the player to give the item to.
     * @param {number} num, the number of items to give. Defaults to 1.
     * @returns {Promise<boolean>} true if the item was given, false otherwise.
     * @example
     * await skills.giveToPlayer(bot, "oak_log", "player1");
     **/
    if (bot.username === username) {
        log(bot, `You cannot give items to yourself.`);
        return false;
    }
    let player = bot.players[username].entity
    if (!player) {
        log(bot, `Could not find ${username}.`);
        return false;
    }
    await goToPlayer(bot, username, 3);
    // if we are 2 below the player
    log(bot, bot.entity.position.y, player.position.y);
    if (bot.entity.position.y < player.position.y - 1) {
        await goToPlayer(bot, username, 1);
    }
    // if we are too close, make some distance
    if (bot.entity.position.distanceTo(player.position) < 2) {
        let too_close = true;
        let start_moving_away = Date.now();
        await moveAwayFromEntity(bot, player, 2);
        while (too_close && !bot.interrupt_code) {
            await new Promise(resolve => setTimeout(resolve, 500));
            too_close = bot.entity.position.distanceTo(player.position) < 5;
            if (too_close) {
                await moveAwayFromEntity(bot, player, 5);
            }
            if (Date.now() - start_moving_away > 3000) {
                break;
            }
        }
        if (too_close) {
            log(bot, `Failed to give ${itemType} to ${username}, too close.`);
            return false;
        }
    }

    await bot.lookAt(player.position);
    if (await discard(bot, itemType, num)) {
        let given = false;
        bot.once('playerCollect', (collector, collected) => {
            console.log(collected.name);
            if (collector.username === username) {
                log(bot, `${username} received ${itemType}.`);
                given = true;
            }
        });
        let start = Date.now();
        while (!given && !bot.interrupt_code) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (given) {
                return true;
            }
            if (Date.now() - start > 3000) {
                break;
            }
        }
    }
    log(bot, `Failed to give ${itemType} to ${username}, it was never received.`);
    return false;
}

export async function goToGoal(bot, goal) {
    /**
     * Navigate to the given goal. Use doors and attempt minimally destructive movements.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {pf.goals.Goal} goal, the goal to navigate to.
     **/

    const nonDestructiveMovements = new pf.Movements(bot);
    const dontBreakBlocks = ['glass', 'glass_pane'];
    for (let block of dontBreakBlocks) {
        nonDestructiveMovements.blocksCantBreak.add(mc.getBlockId(block));
    }
    nonDestructiveMovements.placeCost = 2;
    nonDestructiveMovements.digCost = 10;

    const destructiveMovements = new pf.Movements(bot);

    let final_movements = destructiveMovements;

    const pathfind_timeout = 1000;
    if (await bot.pathfinder.getPathTo(nonDestructiveMovements, goal, pathfind_timeout).status === 'success') {
        final_movements = nonDestructiveMovements;
        log(bot, `Found non-destructive path.`);
    }
    else if (await bot.pathfinder.getPathTo(destructiveMovements, goal, pathfind_timeout).status === 'success') {
        log(bot, `Found destructive path.`);
    }
    else {
        log(bot, `Path not found, but attempting to navigate anyway using destructive movements.`);
    }

    const doorCheckInterval = startDoorInterval(bot);

    bot.pathfinder.setMovements(final_movements);
    try {
        await bot.pathfinder.goto(goal);
        clearInterval(doorCheckInterval);
        return true;
    } catch (err) {
        clearInterval(doorCheckInterval);
        // we need to catch so we can clean up the door check interval, then rethrow the error
        throw err;
    }
}

let _doorInterval = null;
function startDoorInterval(bot) {
    /**
     * Start helper interval that opens nearby doors if the bot is stuck.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @returns {number} the interval id.
     **/
    if (_doorInterval) {
        clearInterval(_doorInterval);
    }
    let prev_pos = bot.entity.position.clone();
    let prev_check = Date.now();
    let stuck_time = 0;


    const doorCheckInterval = setInterval(() => {
        const now = Date.now();
        if (bot.entity.position.distanceTo(prev_pos) >= 0.1) {
            stuck_time = 0;
        } else {
            stuck_time += now - prev_check;
        }
        
        if (stuck_time > 1200) {
            // shuffle positions so we're not always opening the same door
            const positions = [
                bot.entity.position.clone(),
                bot.entity.position.offset(0, 0, 1),
                bot.entity.position.offset(0, 0, -1), 
                bot.entity.position.offset(1, 0, 0),
                bot.entity.position.offset(-1, 0, 0),
            ]
            let elevated_positions = positions.map(position => position.offset(0, 1, 0));
            positions.push(...elevated_positions);
            positions.push(bot.entity.position.offset(0, 2, 0)); // above head
            positions.push(bot.entity.position.offset(0, -1, 0)); // below feet
            
            let currentIndex = positions.length;
            while (currentIndex != 0) {
                let randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [positions[currentIndex], positions[randomIndex]] = [
                positions[randomIndex], positions[currentIndex]];
            }
            
            for (let position of positions) {
                let block = bot.blockAt(position);
                if (block && block.name &&
                    !block.name.includes('iron') &&
                    (block.name.includes('door') ||
                     block.name.includes('fence_gate') ||
                     block.name.includes('trapdoor'))) 
                {
                    bot.activateBlock(block);
                    break;
                }
            }
            stuck_time = 0;
        }
        prev_pos = bot.entity.position.clone();
        prev_check = now;
    }, 200);
    _doorInterval = doorCheckInterval;
    return doorCheckInterval;
}

export async function goToPosition(bot, x, y, z, min_distance=2) {
    /**
     * Navigate to the given position.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {number} x, the x coordinate to navigate to. If null, the bot's current x coordinate will be used.
     * @param {number} y, the y coordinate to navigate to. If null, the bot's current y coordinate will be used.
     * @param {number} z, the z coordinate to navigate to. If null, the bot's current z coordinate will be used.
     * @param {number} distance, the distance to keep from the position. Defaults to 2.
     * @returns {Promise<boolean>} true if the position was reached, false otherwise.
     * @example
     * let position = world.world.getNearestBlock(bot, "oak_log", 64).position;
     * await skills.goToPosition(bot, position.x, position.y, position.x + 20);
     **/
    if (x == null || y == null || z == null) {
        log(bot, `Missing coordinates, given x:${x} y:${y} z:${z}`);
        return false;
    }
    if (bot.modes.isOn('cheat')) {
        bot.chat('/tp @s ' + x + ' ' + y + ' ' + z);
        log(bot, `Teleported to ${x}, ${y}, ${z}.`);
        return true;
    }
    
    const checkDigProgress = () => {
        if (bot.targetDigBlock) {
            const targetBlock = bot.targetDigBlock;
            const itemId = bot.heldItem ? bot.heldItem.type : null;
            if (!targetBlock.canHarvest(itemId)) {
                log(bot, `Pathfinding stopped: Cannot break ${targetBlock.name} with current tools.`);
                bot.pathfinder.stop();
                bot.stopDigging();
            }
        }
    };
    
    const progressInterval = setInterval(checkDigProgress, 1000);
    
    try {
        await goToGoal(bot, new pf.goals.GoalNear(x, y, z, min_distance));
        clearInterval(progressInterval);
        const distance = bot.entity.position.distanceTo(new Vec3(x, y, z));
        if (distance <= min_distance+1) {
            log(bot, `You have reached at ${x}, ${y}, ${z}.`);
            return true;
        }
        else {
            log(bot, `Unable to reach ${x}, ${y}, ${z}, you are ${Math.round(distance)} blocks away.`);
            return false;
        }
    } catch (err) {
        log(bot, `Pathfinding stopped: ${err.message}.`);
        clearInterval(progressInterval);
        return false;
    }
}

export async function goToNearestBlock(bot, blockType,  min_distance=2, range=64) {
    /**
     * Navigate to the nearest block of the given type.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} blockType, the type of block to navigate to.
     * @param {number} min_distance, the distance to keep from the block. Defaults to 2.
     * @param {number} range, the range to look for the block. Defaults to 64.
     * @returns {Promise<boolean>} true if the block was reached, false otherwise.
     * @example
     * await skills.goToNearestBlock(bot, "oak_log", 64, 2);
     * **/
    const MAX_RANGE = 512;
    if (range > MAX_RANGE) {
        log(bot, `Maximum search range capped at ${MAX_RANGE}. `);
        range = MAX_RANGE;
    }
    let block = null;
    if (blockType === 'water' || blockType === 'lava') {
        let blocks = world.getNearestBlocksWhere(bot, block => block.name === blockType && block.metadata === 0, range, 1);
        if (blocks.length === 0) {
            log(bot, `Could not find any source ${blockType} in ${range} blocks, looking for uncollectable flowing instead...`);
            blocks = world.getNearestBlocksWhere(bot, block => block.name === blockType, range, 1);
        }
        block = blocks[0];
    }
    else {
        block = world.getNearestBlock(bot, blockType, range);
    }
    if (!block) {
        log(bot, `Could not find any ${blockType} in ${range} blocks.`);
        return false;
    }
    log(bot, `Found ${blockType} at ${block.position}. Navigating...`);
    await goToPosition(bot, block.position.x, block.position.y, block.position.z, min_distance);
    return true;
}

export async function goToNearestEntity(bot, entityType, min_distance=2, range=64) {
    /**
     * Navigate to the nearest entity of the given type.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} entityType, the type of entity to navigate to.
     * @param {number} min_distance, the distance to keep from the entity. Defaults to 2.
     * @param {number} range, the range to look for the entity. Defaults to 64.
     * @returns {Promise<boolean>} true if the entity was reached, false otherwise.
     **/
    let entity = world.getNearestEntityWhere(bot, entity => entity.name === entityType, range);
    if (!entity) {
        log(bot, `Could not find any ${entityType} in ${range} blocks.`);
        return false;
    }
    let distance = bot.entity.position.distanceTo(entity.position);
    log(bot, `Found ${entityType} ${distance} blocks away.`);
    await goToPosition(bot, entity.position.x, entity.position.y, entity.position.z, min_distance);
    return true;
}

export async function goToPlayer(bot, username, distance=3) {
    /**
     * Navigate to the given player.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} username, the username of the player to navigate to.
     * @param {number} distance, the goal distance to the player.
     * @returns {Promise<boolean>} true if the player was found, false otherwise.
     * @example
     * await skills.goToPlayer(bot, "player");
     **/
    if (bot.username === username) {
        log(bot, `You are already at ${username}.`);
        return true;
    }
    if (bot.modes.isOn('cheat')) {
        bot.chat('/tp @s ' + username);
        log(bot, `Teleported to ${username}.`);
        return true;
    }

    bot.modes.pause('self_defense');
    bot.modes.pause('cowardice');
    let player = bot.players[username].entity
    if (!player) {
        log(bot, `Could not find ${username}.`);
        return false;
    }

    distance = Math.max(distance, 0.5);
    const goal = new pf.goals.GoalFollow(player, distance);

    await goToGoal(bot, goal, true);

    log(bot, `You have reached ${username}.`);
}


export async function followPlayer(bot, username, distance=4) {
    /**
     * Follow the given player endlessly. Will not return until the code is manually stopped.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} username, the username of the player to follow.
     * @returns {Promise<boolean>} true if the player was found, false otherwise.
     * @example
     * await skills.followPlayer(bot, "player");
     **/
    let player = bot.players[username].entity
    if (!player)
        return false;

    const move = new pf.Movements(bot);
    move.digCost = 10;
    bot.pathfinder.setMovements(move);
    let doorCheckInterval = startDoorInterval(bot);

    bot.pathfinder.setGoal(new pf.goals.GoalFollow(player, distance), true);
    log(bot, `You are now actively following player ${username}.`);


    while (!bot.interrupt_code) {
        await new Promise(resolve => setTimeout(resolve, 500));
        // in cheat mode, if the distance is too far, teleport to the player
        const distance_from_player = bot.entity.position.distanceTo(player.position);

        const teleport_distance = 100;
        const ignore_modes_distance = 30; 
        const nearby_distance = distance + 2;

        if (distance_from_player > teleport_distance && bot.modes.isOn('cheat')) {
            // teleport with cheat mode
            await goToPlayer(bot, username);
        }
        else if (distance_from_player > ignore_modes_distance) {
            // these modes slow down the bot, and we want to catch up
            bot.modes.pause('item_collecting');
            bot.modes.pause('hunting');
            bot.modes.pause('torch_placing');
        }
        else if (distance_from_player <= ignore_modes_distance) {
            bot.modes.unpause('item_collecting');
            bot.modes.unpause('hunting');
            bot.modes.unpause('torch_placing');
        }

        if (distance_from_player <= nearby_distance) {
            clearInterval(doorCheckInterval);
            doorCheckInterval = null;
            bot.modes.pause('unstuck');
            bot.modes.pause('elbow_room');
        }
        else {
            if (!doorCheckInterval) {
                doorCheckInterval = startDoorInterval(bot);
            }
            bot.modes.unpause('unstuck');
            bot.modes.unpause('elbow_room');
        }
    }
    clearInterval(doorCheckInterval);
    return true;
}


export async function moveAway(bot, distance) {
    /**
     * Move away from current position in any direction.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {number} distance, the distance to move away.
     * @returns {Promise<boolean>} true if the bot moved away, false otherwise.
     * @example
     * await skills.moveAway(bot, 8);
     **/
    const pos = bot.entity.position;
    let goal = new pf.goals.GoalNear(pos.x, pos.y, pos.z, distance);
    let inverted_goal = new pf.goals.GoalInvert(goal);
    bot.pathfinder.setMovements(new pf.Movements(bot));

    if (bot.modes.isOn('cheat')) {
        const move = new pf.Movements(bot);
        const path = await bot.pathfinder.getPathTo(move, inverted_goal, 10000);
        let last_move = path.path[path.path.length-1];
        if (last_move) {
            let x = Math.floor(last_move.x);
            let y = Math.floor(last_move.y);
            let z = Math.floor(last_move.z);
            bot.chat('/tp @s ' + x + ' ' + y + ' ' + z);
            return true;
        }
    }

    await goToGoal(bot, inverted_goal);
    let new_pos = bot.entity.position;
    log(bot, `Moved away from ${pos.floored()} to ${new_pos.floored()}.`);
    return true;
}

export async function moveAwayFromEntity(bot, entity, distance=16) {
    /**
     * Move away from the given entity.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {Entity} entity, the entity to move away from.
     * @param {number} distance, the distance to move away.
     * @returns {Promise<boolean>} true if the bot moved away, false otherwise.
     **/
    let goal = new pf.goals.GoalFollow(entity, distance);
    let inverted_goal = new pf.goals.GoalInvert(goal);
    bot.pathfinder.setMovements(new pf.Movements(bot));
    await bot.pathfinder.goto(inverted_goal);
    return true;
}

export async function avoidEnemies(bot, distance=16) {
    /**
     * Move a given distance away from all nearby enemy mobs.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {number} distance, the distance to move away.
     * @returns {Promise<boolean>} true if the bot moved away, false otherwise.
     * @example
     * await skills.avoidEnemies(bot, 8);
     **/
    bot.modes.pause('self_preservation'); // prevents damage-on-low-health from interrupting the bot
    let enemy = world.getNearestEntityWhere(bot, entity => mc.isHostile(entity), distance);
    while (enemy) {
        const follow = new pf.goals.GoalFollow(enemy, distance+1); // move a little further away
        const inverted_goal = new pf.goals.GoalInvert(follow);
        bot.pathfinder.setMovements(new pf.Movements(bot));
        bot.pathfinder.setGoal(inverted_goal, true);
        await new Promise(resolve => setTimeout(resolve, 500));
        enemy = world.getNearestEntityWhere(bot, entity => mc.isHostile(entity), distance);
        if (bot.interrupt_code) {
            break;
        }
        if (enemy && bot.entity.position.distanceTo(enemy.position) < 3) {
            await attackEntity(bot, enemy, false);
        }
    }
    bot.pathfinder.stop();
    log(bot, `Moved ${distance} away from enemies.`);
    return true;
}

export async function stay(bot, seconds=30) {
    /**
     * Stay in the current position until interrupted. Disables all modes.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {number} seconds, the number of seconds to stay. Defaults to 30. -1 for indefinite.
     * @returns {Promise<boolean>} true if the bot stayed, false otherwise.
     * @example
     * await skills.stay(bot);
     **/
    bot.modes.pause('self_preservation');
    bot.modes.pause('unstuck');
    bot.modes.pause('cowardice');
    bot.modes.pause('self_defense');
    bot.modes.pause('hunting');
    bot.modes.pause('torch_placing');
    bot.modes.pause('item_collecting');
    let start = Date.now();
    while (!bot.interrupt_code && (seconds === -1 || Date.now() - start < seconds*1000)) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    log(bot, `Stayed for ${(Date.now() - start)/1000} seconds.`);
    return true;
}

export async function useDoor(bot, door_pos=null) {
    /**
     * Use the door at the given position.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {Vec3} door_pos, the position of the door to use. If null, the nearest door will be used.
     * @returns {Promise<boolean>} true if the door was used, false otherwise.
     * @example
     * let door = world.getNearestBlock(bot, "oak_door", 16).position;
     * await skills.useDoor(bot, door);
     **/
    if (!door_pos) {
        for (let door_type of ['oak_door', 'spruce_door', 'birch_door', 'jungle_door', 'acacia_door', 'dark_oak_door',
                               'mangrove_door', 'cherry_door', 'bamboo_door', 'crimson_door', 'warped_door']) {
            door_pos = world.getNearestBlock(bot, door_type, 16).position;
            if (door_pos) break;
        }
    } else {
        door_pos = Vec3(door_pos.x, door_pos.y, door_pos.z);
    }
    if (!door_pos) {
        log(bot, `Could not find a door to use.`);
        return false;
    }

    bot.pathfinder.setGoal(new pf.goals.GoalNear(door_pos.x, door_pos.y, door_pos.z, 1));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    while (bot.pathfinder.isMoving()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    let door_block = bot.blockAt(door_pos);
    await bot.lookAt(door_pos);
    if (!door_block._properties.open)
        await bot.activateBlock(door_block);
    
    bot.setControlState("forward", true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    bot.setControlState("forward", false);
    await bot.activateBlock(door_block);

    log(bot, `Used door at ${door_pos}.`);
    return true;
}

export async function goToBed(bot) {
    /**
     * Sleep in the nearest bed.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @returns {Promise<boolean>} true if the bed was found, false otherwise.
     * @example
     * await skills.goToBed(bot);
     **/
    const beds = bot.findBlocks({
        matching: (block) => {
            return block.name.includes('bed');
        },
        maxDistance: 32,
        count: 1
    });
    if (beds.length === 0) {
        log(bot, `Could not find a bed to sleep in.`);
        return false;
    }
    let loc = beds[0];
    await goToPosition(bot, loc.x, loc.y, loc.z);
    const bed = bot.blockAt(loc);
    await bot.sleep(bed);
    log(bot, `You are in bed.`);
    bot.modes.pause('unstuck');
    while (bot.isSleeping) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    log(bot, `You have woken up.`);
    return true;
}

export async function tillAndSow(bot, x, y, z, seedType=null) {
    /**
     * Till the ground at the given position and plant the given seed type.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {number} x, the x coordinate to till.
     * @param {number} y, the y coordinate to till.
     * @param {number} z, the z coordinate to till.
     * @param {string} plantType, the type of plant to plant. Defaults to none, which will only till the ground.
     * @returns {Promise<boolean>} true if the ground was tilled, false otherwise.
     * @example
     * let position = world.getPosition(bot);
     * await skills.tillAndSow(bot, position.x, position.y - 1, position.x, "wheat");
     **/
    let pos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
    let block = bot.blockAt(pos);
    log(bot, `Planting ${seedType} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`);

    if (bot.modes.isOn('cheat')) {
        let to_remove = ['_seed', '_seeds'];
        for (let remove of to_remove) {
            if (seedType.endsWith(remove)) {
                seedType = seedType.replace(remove, '');
            }
        }
        placeBlock(bot, 'farmland', x, y, z);
        placeBlock(bot, seedType, x, y+1, z);
        return true;
    }

    if (block.name !== 'grass_block' && block.name !== 'dirt' && block.name !== 'farmland') {
        log(bot, `Cannot till ${block.name}, must be grass_block or dirt.`);
        return false;
    }
    let above = bot.blockAt(new Vec3(x, y+1, z));
    if (above.name !== 'air') {
        if (block.name === 'farmland') {
            log(bot, `Land is already farmed with ${above.name}.`);
            return true;
        }
        let broken = await breakBlockAt(bot, x, y+1, z);
        if (!broken) {
            log(bot, `Cannot cannot break above block to till.`);
            return false;
        }
    }
    // if distance is too far, move to the block
    if (bot.entity.position.distanceTo(block.position) > 5.0) {
        let pos = block.position;
        bot.pathfinder.setMovements(new pf.Movements(bot));
        await goToGoal(bot, new pf.goals.GoalNear(pos.x, pos.y, pos.z, 4));
    }
    if (block.name !== 'farmland') {
        let hoe = bot.inventory.items().find(item => item.name.includes('hoe'));
        let to_equip = hoe?.name || 'diamond_hoe';
        if (!await equip(bot, to_equip)) {
            log(bot, `Cannot till, no hoes.`);
            return false;
        }
        await bot.activateBlock(block);
        log(bot, `Tilled block x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`);
    }
    
    if (seedType) {
        if (seedType.endsWith('seed') && !seedType.endsWith('seeds'))
            seedType += 's'; // fixes common mistake
        let equipped_seeds = await equip(bot, seedType);
        if (!equipped_seeds) {
            log(bot, `No ${seedType} to plant.`);
            return false;
        }

        await bot.activateBlock(block);
        log(bot, `Planted ${seedType} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`);
    }
    return true;
}

export async function activateNearestBlock(bot, type) {
    /**
     * Activate the nearest block of the given type.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} type, the type of block to activate.
     * @returns {Promise<boolean>} true if the block was activated, false otherwise.
     * @example
     * await skills.activateNearestBlock(bot, "lever");
     * **/
    let block = world.getNearestBlock(bot, type, 16);
    if (!block) {
        log(bot, `Could not find any ${type} to activate.`);
        return false;
    }
    if (bot.entity.position.distanceTo(block.position) > 5.0) {
        let pos = block.position;
        bot.pathfinder.setMovements(new pf.Movements(bot));
        await goToGoal(bot, new pf.goals.GoalNear(pos.x, pos.y, pos.z, 4));
    }
    await bot.activateBlock(block);
    log(bot, `Activated ${type} at x:${block.position.x.toFixed(1)}, y:${block.position.y.toFixed(1)}, z:${block.position.z.toFixed(1)}.`);
    return true;
}

/**
 * Helper function to find and navigate to a villager for trading
 * @param {MinecraftBot} bot - reference to the minecraft bot
 * @param {number} id - the entity id of the villager
 * @returns {Promise<Object|null>} the villager entity if found and reachable, null otherwise
 */
async function findAndGoToVillager(bot, id) {
    id = id+"";
    const entity = bot.entities[id];
    
    if (!entity) {
        log(bot, `Cannot find villager with id ${id}`);
        let entities = world.getNearbyEntities(bot, 16);
        let villager_list = "Available villagers:\n";
        for (let entity of entities) {
            if (entity.name === 'villager') {
                if (entity.metadata && entity.metadata[16] === 1) {
                    villager_list += `${entity.id}: baby villager\n`;
                } else {
                    const profession = world.getVillagerProfession(entity);
                    villager_list += `${entity.id}: ${profession}\n`;
                }
            }
        }
        if (villager_list === "Available villagers:\n") {
            log(bot, "No villagers found nearby.");
            return null;
        }
        log(bot, villager_list);
        return null;
    }
    
    if (entity.entityType !== bot.registry.entitiesByName.villager.id) {
        log(bot, 'Entity is not a villager');
        return null;
    }
    
    if (entity.metadata && entity.metadata[16] === 1) {
        log(bot, 'This is either a baby villager or a villager with no job - neither can trade');
        return null;
    }
    
    const distance = bot.entity.position.distanceTo(entity.position);
    if (distance > 4) {
        log(bot, `Villager is ${distance.toFixed(1)} blocks away, moving closer...`);
        try {
            bot.modes.pause('unstuck');
            const goal = new pf.goals.GoalFollow(entity, 2);
            await goToGoal(bot, goal);
            
            
            log(bot, 'Successfully reached villager');
        } catch (err) {
            log(bot, 'Failed to reach villager - pathfinding error or villager moved');
            console.log(err);
            return null;
        } finally {
            bot.modes.unpause('unstuck');
        }
    }
    
    return entity;
}

/**
 * Show available trades for a specified villager
 * @param {MinecraftBot} bot - reference to the minecraft bot
 * @param {number} id - the entity id of the villager to show trades for
 * @returns {Promise<boolean>} true if trades were shown successfully, false otherwise
 * @example
 * await skills.showVillagerTrades(bot, "123");
 */
export async function showVillagerTrades(bot, id) {
    const villagerEntity = await findAndGoToVillager(bot, id);
    if (!villagerEntity) {
        return false;
    }
    
    try {
        const villager = await bot.openVillager(villagerEntity);
        
        if (!villager.trades || villager.trades.length === 0) {
            log(bot, 'This villager has no trades available - might be sleeping, a baby, or jobless');
            villager.close();
            return false;
        }
        
        log(bot, `Villager has ${villager.trades.length} available trades:`);
        stringifyTrades(bot, villager.trades).forEach((trade, i) => {
            const tradeInfo = `${i + 1}: ${trade}`;
            console.log(tradeInfo);
            log(bot, tradeInfo);
        });
        
        villager.close();
        return true;
    } catch (err) {
        log(bot, 'Failed to open villager trading interface - they might be sleeping, a baby, or jobless');
        console.log('Villager trading error:', err.message);
        return false;
    }
}

/**
 * Trade with a specified villager
 * @param {MinecraftBot} bot - reference to the minecraft bot
 * @param {number} id - the entity id of the villager to trade with
 * @param {number} index - the index (1-based) of the trade to execute
 * @param {number} count - how many times to execute the trade (optional)
 * @returns {Promise<boolean>} true if trade was successful, false otherwise
 * @example
 * await skills.tradeWithVillager(bot, "123", "1", "2");
 */
export async function tradeWithVillager(bot, id, index, count) {
    const villagerEntity = await findAndGoToVillager(bot, id);
    if (!villagerEntity) {
        return false;
    }
    
    try {
        const villager = await bot.openVillager(villagerEntity);
        
        if (!villager.trades || villager.trades.length === 0) {
            log(bot, 'This villager has no trades available - might be sleeping, a baby, or jobless');
            villager.close();
            return false;
        }
        
        const tradeIndex = parseInt(index) - 1; // Convert to 0-based index
        const trade = villager.trades[tradeIndex];
        
        if (!trade) {
            log(bot, `Trade ${index} not found. This villager has ${villager.trades.length} trades available.`);
            villager.close();
            return false;
        }
        
        if (trade.disabled) {
            log(bot, `Trade ${index} is currently disabled`);
            villager.close();
            return false;
        }

        const item_2 = trade.inputItem2 ? stringifyItem(bot, trade.inputItem2)+' ' : '';
        log(bot, `Trading ${stringifyItem(bot, trade.inputItem1)} ${item_2}for ${stringifyItem(bot, trade.outputItem)}...`);
        
        const maxPossibleTrades = trade.maximumNbTradeUses - trade.nbTradeUses;
        const requestedCount = count;
        const actualCount = Math.min(requestedCount, maxPossibleTrades);
        
        if (actualCount <= 0) {
            log(bot, `Trade ${index} has been used to its maximum limit`);
            villager.close();
            return false;
        }
        
        if (!hasResources(villager.slots, trade, actualCount)) {
            log(bot, `Don't have enough resources to execute trade ${index} ${actualCount} time(s)`);
            villager.close();
            return false;
        }
        
        log(bot, `Executing trade ${index} ${actualCount} time(s)...`);
        
        try {
            await bot.trade(villager, tradeIndex, actualCount);
            log(bot, `Successfully traded ${actualCount} time(s)`);
            villager.close();
            return true;
        } catch (tradeErr) {
            log(bot, 'An error occurred while trying to execute the trade');
            console.log('Trade execution error:', tradeErr.message);
            villager.close();
            return false;
        }
    } catch (err) {
        log(bot, 'Failed to open villager trading interface');
        console.log('Villager interface error:', err.message);
        return false;
    }
}

function hasResources(window, trade, count) {
    const first = enough(trade.inputItem1, count);
    const second = !trade.inputItem2 || enough(trade.inputItem2, count);
    return first && second;

    function enough(item, count) {
        let c = 0;
        window.forEach((element) => {
            if (element && element.type === item.type && element.metadata === item.metadata) {
                c += element.count;
            }
        });
        return c >= item.count * count;
    }
}

function stringifyTrades(bot, trades) {
    return trades.map((trade) => {
        let text = stringifyItem(bot, trade.inputItem1);
        if (trade.inputItem2) text += ` & ${stringifyItem(bot, trade.inputItem2)}`;
        if (trade.disabled) text += ' x '; else text += ' » ';
        text += stringifyItem(bot, trade.outputItem);
        return `(${trade.nbTradeUses}/${trade.maximumNbTradeUses}) ${text}`;
    });
}

function stringifyItem(bot, item) {
    if (!item) return 'nothing';
    let text = `${item.count} ${item.displayName}`;
    if (item.nbt && item.nbt.value) {
        const ench = item.nbt.value.ench;
        const StoredEnchantments = item.nbt.value.StoredEnchantments;
        const Potion = item.nbt.value.Potion;
        const display = item.nbt.value.display;

        if (Potion) text += ` of ${Potion.value.replace(/_/g, ' ').split(':')[1] || 'unknown type'}`;
        if (display) text += ` named ${display.value.Name.value}`;
        if (ench || StoredEnchantments) {
            text += ` enchanted with ${(ench || StoredEnchantments).value.value.map((e) => {
                const lvl = e.lvl.value;
                const id = e.id.value;
                return bot.registry.enchantments[id].displayName + ' ' + lvl;
            }).join(' ')}`;
        }
    }
    return text;
}

export async function digDown(bot, distance = 10) {
    /**
     * Digs down a specified distance. Will stop if it reaches lava, water, or a fall of >=4 blocks below the bot.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {int} distance, distance to dig down.
     * @returns {Promise<boolean>} true if successfully dug all the way down.
     * @example
     * await skills.digDown(bot, 10);
     **/

    let start_block_pos = bot.blockAt(bot.entity.position).position;
    for (let i = 1; i <= distance; i++) {
        const targetBlock = bot.blockAt(start_block_pos.offset(0, -i, 0));
        let belowBlock = bot.blockAt(start_block_pos.offset(0, -i-1, 0));

        if (!targetBlock || !belowBlock) {
            log(bot, `Dug down ${i-1} blocks, but reached the end of the world.`);
            return true;
        }

        // Check for lava, water
        if (targetBlock.name === 'lava' || targetBlock.name === 'water' || 
            belowBlock.name === 'lava' || belowBlock.name === 'water') {
            log(bot, `Dug down ${i-1} blocks, but reached ${belowBlock ? belowBlock.name : '(lava/water)'}`)
            return false;
        }

        const MAX_FALL_BLOCKS = 2;
        let num_fall_blocks = 0;
        for (let j = 0; j <= MAX_FALL_BLOCKS; j++) {
            if (!belowBlock || (belowBlock.name !== 'air' && belowBlock.name !== 'cave_air')) {
                break;
            }
            num_fall_blocks++;
            belowBlock = bot.blockAt(belowBlock.position.offset(0, -1, 0));
        }
        if (num_fall_blocks > MAX_FALL_BLOCKS) {
            log(bot, `Dug down ${i-1} blocks, but reached a drop below the next block.`);
            return false;
        }

        if (targetBlock.name === 'air' || targetBlock.name === 'cave_air') {
            log(bot, 'Skipping air block');
            console.log(targetBlock.position);
            continue;
        }

        let dug = await breakBlockAt(bot, targetBlock.position.x, targetBlock.position.y, targetBlock.position.z);
        if (!dug) {
            log(bot, 'Failed to dig block at position:' + targetBlock.position);
            return false;
        }
    }
    log(bot, `Dug down ${distance} blocks.`);
    return true;
}

export async function goToSurface(bot) {
    /**
     * Navigate to the surface (highest non-air block at current x,z).
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @returns {Promise<boolean>} true if the surface was reached, false otherwise.
     **/
    const pos = bot.entity.position;
    for (let y = 360; y > -64; y--) { // probably not the best way to find the surface but it works
        const block = bot.blockAt(new Vec3(pos.x, y, pos.z));
        if (!block || block.name === 'air' || block.name === 'cave_air') {
            continue;
        }
        await goToPosition(bot, block.position.x, block.position.y + 1, block.position.z, 0); // this will probably work most of the time but a custom mining and towering up implementation could be added if needed
        log(bot, `Going to the surface at y=${y+1}.`);``
        return true;
    }
    return false;
}

export async function useToolOn(bot, toolName, targetName) {
    /**
     * Equip a tool and use it on the nearest target.
     * @param {MinecraftBot} bot
     * @param {string} toolName - item name of the tool to equip, or "hand" for no tool.
     * @param {string} targetName - entity type, block type, or "nothing" for no target
     * @returns {Promise<boolean>} true if action succeeded
     */
    if (!bot.inventory.slots.find(slot => slot && slot.name === toolName) && !bot.game.gameMode === 'creative') {
        log(bot, `You do not have any ${toolName} to use.`);
        return false;
    }

    targetName = targetName.toLowerCase();
    if (targetName === 'nothing') {
        const equipped = await equip(bot, toolName);
        if (!equipped) {
            return false;
        }
        await bot.activateItem();
        log(bot, `Used ${toolName}.`);
    } else if (world.isEntityType(targetName)) {
        const entity = world.getNearestEntityWhere(bot, e => e.name === targetName, 64);
        if (!entity) {
            log(bot, `Could not find any ${targetName}.`);
            return false;
        }
        await goToPosition(bot, entity.position.x, entity.position.y, entity.position.z);
        if (toolName === 'hand') {
            await bot.unequip('hand');
        }
        else {
            const equipped = await equip(bot, toolName);
            if (!equipped) return false;
        }
        await bot.useOn(entity);
        log(bot, `Used ${toolName} on ${targetName}.`);
    } else {
        let block = null;
        if (targetName === 'water' || targetName === 'lava') {
            // we want to get liquid source blocks, not flowing blocks
            // so search for blocks with metadata 0 (not flowing)
            let blocks = world.getNearestBlocksWhere(bot, block => block.name === targetName && block.metadata === 0, 64, 1);
            if (blocks.length === 0) {
                log(bot, `Could not find any source ${targetName}.`);
                return false;
            }
            block = blocks[0];
        }
        else {
            block = world.getNearestBlock(bot, targetName, 64);
        }
        if (!block) {
            log(bot, `Could not find any ${targetName}.`);
            return false;
        }
        return await useToolOnBlock(bot, toolName, block);
    }

    return true;
 }

 export async function useToolOnBlock(bot, toolName, block) {
    /**
     * Use a tool on a specific block.
     * @param {MinecraftBot} bot
     * @param {string} toolName - item name of the tool to equip, or "hand" for no tool.
     * @param {Block} block - the block reference to use the tool on.
     * @returns {Promise<boolean>} true if action succeeded
     */

    const distance = toolName === 'water_bucket' && block.name !== 'lava' ? 1.5 : 2;
    await goToPosition(bot, block.position.x, block.position.y, block.position.z, distance);
    await bot.lookAt(block.position.offset(0.5, 0.5, 0.5));

    // if block in view is closer than the target block, it is in our way. try to move closer
    const viewBlocked = () => {
        const blockInView = bot.blockAtCursor(5);
        const headPos = bot.entity.position.offset(0, bot.entity.height, 0);
        return blockInView && 
            !blockInView.position.equals(block.position) && 
            blockInView.position.distanceTo(headPos) < block.position.distanceTo(headPos);
    }
    const blockInView = bot.blockAtCursor(5);
    if (viewBlocked()) {
        log(bot, `Block ${blockInView.name} is in the way, moving closer...`);
        // choose random block next to target block, go to it
        const nearbyPos = block.position.offset(Math.random() * 2 - 1, 0, Math.random() * 2 - 1);
        await goToPosition(bot, nearbyPos.x, nearbyPos.y, nearbyPos.z, 1);
        await bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
        if (viewBlocked()) {
            const blockInView = bot.blockAtCursor(5);
            log(bot, `Block ${blockInView.name} is in the way, not using ${toolName}.`);
            return false;
        }
    }

    const equipped = await equip(bot, toolName);

    if (!equipped) {
        log(bot, `Could not equip ${toolName}.`);
        return false;
    }
    if (toolName.includes('bucket')) {
        await bot.activateItem();
    }
    else {
        await bot.activateBlock(block);
    }
    log(bot, `Used ${toolName} on ${block.name}.`);
    return true;
 }

/**
 * Verify if a block at specific position is broken/changed
 */
function isBlockBroken(bot, originalBlock) {
    try {
        // Validate original block position
        if (!originalBlock.position || 
            (originalBlock.position.x === 0 && originalBlock.position.y === 0 && originalBlock.position.z === 0)) {
            return { broken: false, reason: 'invalid_original_position', error: 'Original block has invalid position' };
        }
        
        const currentBlock = bot.blockAt(originalBlock.position);
        
        // Block doesn't exist anymore (air)
        if (!currentBlock || currentBlock.type === 0) {
            return { broken: true, reason: 'block_is_air', newType: 0, position: originalBlock.position };
        }
        
        // Block type changed from original
        if (currentBlock.type !== originalBlock.type) {
            return { broken: true, reason: 'block_type_changed', newType: currentBlock.type, position: originalBlock.position };
        }
        
        // Block metadata changed (for blocks that change state when broken)
        if (currentBlock.metadata !== originalBlock.metadata) {
            return { broken: true, reason: 'block_metadata_changed', newType: currentBlock.type, position: originalBlock.position };
        }
        
        // Block still exists and unchanged
        return { broken: false, reason: 'block_unchanged', newType: currentBlock.type, position: originalBlock.position };
        
    } catch (error) {
        // If we can't check the block, assume it might be broken
        return { broken: true, reason: 'check_error', error: error.message };
    }
}

/**
 * Manual digging with event monitoring for completion verification
 */
async function manualDigWithEvents(bot, block) {
    return new Promise(async (resolve) => {
        // Validate block and position before starting
        if (!block) {
            console.log(`❌ No block provided to manualDigWithEvents`);
            resolve(false);
            return;
        }
        
        if (!block.position) {
            console.log(`❌ Block has no position: ${JSON.stringify(block)}`);
            resolve(false);
            return;
        }
        
        // Check for invalid (0,0,0) position which causes server mismatch
        if (block.position.x === 0 && block.position.y === 0 && block.position.z === 0) {
            console.log(`❌ Invalid block position (0,0,0) - this causes server mismatch errors`);
            resolve(false);
            return;
        }
        
        console.log(`🎯 Starting manualDigWithEvents for ${block.name} at ${block.position.x}, ${block.position.y}, ${block.position.z}`);
        
        let digCompleted = false;
        const maxDigTime = 30000; // 30 seconds timeout
        const startTime = Date.now();
        
        // Monitor blockUpdate event for completion
        const onBlockUpdate = async (oldBlock, newBlock) => {
            if (oldBlock && oldBlock.position.equals(block.position)) {
                const breakCheck = isBlockBroken(bot, block);
                console.log(`🔍 BlockUpdate event: ${breakCheck.reason} (type: ${block.type} → ${breakCheck.newType})`);
                
                if (breakCheck.broken) {
                    console.log(`✅ Block mining confirmed via blockUpdate: ${block.name}`);
                    digCompleted = true;
                    
                    // Collect dropped items
                    try {
                        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for items to drop
                        await pickupNearbyItems(bot);
                        console.log(`📦 Items collected from ${block.name}`);
                    } catch (itemError) {
                        console.log(`⚠️ Could not collect items: ${itemError.message}`);
                    }
                    
                    bot.removeListener('blockUpdate', onBlockUpdate);
                    bot.removeListener('diggingCompleted', onDigComplete);
                    bot.removeListener('diggingAborted', onDigAbort);
                    resolve(true);
                }
            }
        };
        
        const onDigComplete = async (completedBlock) => {
            if (completedBlock && completedBlock.position.equals(block.position)) {
                // Double-verify with our block check
                const breakCheck = isBlockBroken(bot, block);
                console.log(`✅ Dig completed event: ${completedBlock.name} (verified: ${breakCheck.broken})`);
                
                if (breakCheck.broken) {
                    digCompleted = true;
                    
                    // Collect dropped items
                    try {
                        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for items to drop
                        await pickupNearbyItems(bot);
                        console.log(`📦 Items collected from ${completedBlock.name}`);
                    } catch (itemError) {
                        console.log(`⚠️ Could not collect items: ${itemError.message}`);
                    }
                    
                    bot.removeListener('blockUpdate', onBlockUpdate);
                    bot.removeListener('diggingCompleted', onDigComplete);
                    bot.removeListener('diggingAborted', onDigAbort);
                    resolve(true);
                } else {
                    console.log(`⚠️ Dig event fired but block still exists: ${breakCheck.reason}`);
                }
            }
        };
        
        const onDigAbort = (abortedBlock) => {
            if (abortedBlock && abortedBlock.position.equals(block.position)) {
                console.log(`⚠️ Dig aborted: ${abortedBlock.name}`);
                bot.removeListener('blockUpdate', onBlockUpdate);
                bot.removeListener('diggingCompleted', onDigComplete);
                bot.removeListener('diggingAborted', onDigAbort);
                resolve(false);
            }
        };
        
        // Set up event listeners
        bot.on('blockUpdate', onBlockUpdate);
        bot.on('diggingCompleted', onDigComplete);
        bot.on('diggingAborted', onDigAbort);
        
        // Timeout fallback
        const timeoutId = setTimeout(() => {
            if (!digCompleted) {
                console.log(`⏰ Dig timeout for ${block.name} after ${Date.now() - startTime}ms`);
                bot.removeListener('blockUpdate', onBlockUpdate);
                bot.removeListener('diggingCompleted', onDigComplete);
                bot.removeListener('diggingAborted', onDigAbort);
                resolve(false);
            }
        }, maxDigTime);
        
        try {
            // Navigate to block using pathfinder
            const distance = bot.entity.position.distanceTo(block.position);
            if (distance > 5.0) {
                console.log(`🚶 Navigating to ${block.name} at distance ${distance.toFixed(1)}`);
                bot.pathfinder.setMovements(new pf.Movements(bot));
                await bot.pathfinder.goto(new pf.goals.GoalNear(block.position.x, block.position.y, block.position.z, 4));
            }
            
            // Equip best tool for this block type
            console.log(`🔧 Equipping tool for ${block.name}...`);
            await bot.tool.equipForBlock(block);
            
            // Look at the block
            await bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
            
            // Final distance check before mining
            const finalDistance = bot.entity.position.distanceTo(block.position);
            if (finalDistance > 5.5) {
                console.log(`❌ Still too far from ${block.name}: ${finalDistance.toFixed(1)} blocks`);
                resolve(false);
                return;
            }
            
            // Verify we can harvest this block
            const heldItem = bot.heldItem;
            const toolName = heldItem ? heldItem.name : 'hand';
            console.log(`⛏️ Enhanced Mining: ${block.name} with ${toolName} (distance: ${finalDistance.toFixed(1)})`);
            
            if (!block.canHarvest(heldItem ? heldItem.type : null)) {
                console.log(`❌ Cannot harvest ${block.name} with ${toolName}`);
                resolve(false);
                return;
            }
            
            // Ensure block position is valid and synchronized
            if (!block.position || block.position.x === 0 && block.position.y === 0 && block.position.z === 0) {
                console.log(`❌ Invalid block position: ${JSON.stringify(block.position)}`);
                resolve(false);
                return;
            }
            
            // Re-fetch block to ensure we have current state
            const freshBlock = bot.blockAt(block.position);
            if (!freshBlock || freshBlock.type === 0) {
                console.log(`❌ Block no longer exists at ${block.position.x}, ${block.position.y}, ${block.position.z}`);
                resolve(false);
                return;
            }
            
            console.log(`🔨 Starting dig animation for ${freshBlock.name} at ${freshBlock.position.x}, ${freshBlock.position.y}, ${freshBlock.position.z}`);
            
            // Use fresh block reference to avoid position mismatch
            await bot.dig(freshBlock, true);
            
            // Advanced block verification - check multiple ways
            await new Promise(resolve => setTimeout(resolve, 200)); // Small delay for server sync
            
            // Method 1: Direct block check at position
            const currentBlock = bot.blockAt(block.position);
            const blockStillExists = currentBlock && currentBlock.type !== 0;
            
            // Method 2: Check if block changed from original
            const blockChanged = !currentBlock || currentBlock.type !== block.type;
            
            // Method 3: Check world state for block update
            const originalBlockId = block.type;
            const newBlockId = currentBlock ? currentBlock.type : 0;
            
            console.log(`🔍 Block verification: original=${originalBlockId}, current=${newBlockId}, exists=${!blockStillExists}, changed=${blockChanged}`);
            
            if (!blockStillExists || blockChanged) {
                console.log(`✅ Block confirmed broken: ${block.name} (was ${originalBlockId}, now ${newBlockId})`);
                
                // Collect dropped items
                try {
                    await pickupNearbyItems(bot);
                    console.log(`📦 Collected items from ${block.name}`);
                } catch (itemError) {
                    console.log(`⚠️ Could not collect items: ${itemError.message}`);
                }
                
                clearTimeout(timeoutId);
                bot.removeListener('blockUpdate', onBlockUpdate);
                bot.removeListener('diggingCompleted', onDigComplete);
                bot.removeListener('diggingAborted', onDigAbort);
                resolve(true);
            } else if (!digCompleted) {
                // Block still there, mining might have failed
                console.log(`❌ Block still exists: ${block.name} (type ${currentBlock.type})`);
                console.log(`⏳ Waiting for mining events or timeout...`);
            }
            
        } catch (error) {
            console.log(`❌ Manual dig error: ${error.message}`);
            clearTimeout(timeoutId);
            bot.removeListener('blockUpdate', onBlockUpdate);
            bot.removeListener('diggingCompleted', onDigComplete);
            bot.removeListener('diggingAborted', onDigAbort);
            resolve(false);
        }
    });
}

// Import Smart Crafting System
import { smartCraft as _smartCraft, smartCollect as _smartCollect, SmartCraftingManager } from "./smart_crafting.js";

// Import Enhanced Smart Collect System
import { 
    enhancedSmartCollect, 
    batchCollectItems as _batchCollectItems,
    getComprehensiveInventory as _getComprehensiveInventory,
    SmartCollectEnhanced 
} from "./smart_collect_enhanced.js";

// Import Task Manager System
import { 
    TaskManager, 
    createComplexTask as _createComplexTask,
    executeTask as _executeTask,
    createBuildingProject as _createBuildingProject 
} from "./task_manager.js";

// Wrapper functions that pass required skills functions
export async function smartCraft(bot, itemName, count = 1) {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect
    };
    return await _smartCraft(bot, itemName, count, skillsFunctions);
}

export async function smartCollect(bot, blockType, count = 1) {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect
    };
    return await _smartCollect(bot, blockType, count, skillsFunctions);
}

/**
 * 📦 Enhanced Smart Collect mit vollständiger Chest- und Inventory-Integration
 * Verwendet das bewährte Smart Crafting System für:
 * - Automatisches Inventory-Management
 * - Chest-Scanning und Material-Extraktion  
 * - Multi-Source Collection (Chests + Mining + Crafting + Smelting)
 * - Robuste Container APIs und Tool-Management
 */
export async function enhancedCollect(bot, blockType, count = 1) {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect,
        putInChest,
        takeFromChest,
        viewChest
    };
    return await enhancedSmartCollect(bot, blockType, count, skillsFunctions);
}

/**
 * 🎯 Batch Collection - Sammle mehrere Items gleichzeitig
 * @param {Bot} bot - Der Mineflayer Bot
 * @param {Array} itemRequests - Array von {blockType, count} Objekten
 * @returns {Promise<Object>} Ergebnisse für jedes Item
 */
export async function batchCollectItems(bot, itemRequests) {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect,
        putInChest,
        takeFromChest,
        viewChest
    };
    return await _batchCollectItems(bot, itemRequests, skillsFunctions);
}

/**
 * 📊 Umfassende Inventar-Analyse inkl. Chest-Inhalte
 * @param {Bot} bot - Der Mineflayer Bot
 * @returns {Promise<Object>} Detaillierte Inventar- und Storage-Daten
 */
export async function getComprehensiveInventory(bot) {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect,
        putInChest,
        takeFromChest,
        viewChest
    };
    return await _getComprehensiveInventory(bot, skillsFunctions);
}

/**
 * 📝 Merkt sich wichtige Strukturen (Truhen, Werkbänke, Öfen) für zukünftige Nutzung
 * @param {Bot} bot - Der Mineflayer Bot
 * @returns {Promise<boolean>} True wenn erfolgreich
 */
export async function rememberStructures(bot) {
    try {
        const craftingManager = new SmartCraftingManager(bot);
        await craftingManager.rememberImportantStructures();
        return true;
    } catch (error) {
        console.log(`❌ rememberStructures failed: ${error.message}`);
        return false;
    }
}

/**
 * 🔍 Findet die nächste bekannte Truhe aus dem Memory
 * @param {Bot} bot - Der Mineflayer Bot
 * @returns {Promise<Vec3|null>} Position der nächsten Truhe oder null
 */
export async function findNearestKnownChest(bot) {
    try {
        const craftingManager = new SmartCraftingManager(bot);
        return await craftingManager.findNearestRememberedChest();
    } catch (error) {
        console.log(`❌ findNearestKnownChest failed: ${error.message}`);
        return null;
    }
}

/**
 * 🔧 Findet die nächste bekannte Werkbank aus dem Memory
 * @param {Bot} bot - Der Mineflayer Bot  
 * @returns {Promise<Vec3|null>} Position der nächsten Werkbank oder null
 */
export async function findNearestKnownCraftingTable(bot) {
    try {
        const craftingManager = new SmartCraftingManager(bot);
        return await craftingManager.findNearestRememberedCraftingTable();
    } catch (error) {
        console.log(`❌ findNearestKnownCraftingTable failed: ${error.message}`);
        return null;
    }
}

export async function organizeInventory(bot) {
    /**
     * Organisiert das Inventar durch intelligente Einlagerung in nahegelegene Chests
     * @param {Bot} bot - Der Mineflayer Bot
     * @returns {Promise<boolean>} True wenn erfolgreich organisiert
     */
    try {
        const craftingManager = new SmartCraftingManager(bot);
        const success = await craftingManager.manageInventorySpace();
        return success;
    } catch (error) {
        console.log(`❌ organizeInventory failed: ${error.message}`);
        return false;
    }
}

/**
 * Task Manager Functions - Komplexe Bauprojekte verwalten
 */

export async function createComplexTask(bot, taskName, requirements, description = '') {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect,
        goToPosition,
        digDown,
        goToSurface
    };
    return await _createComplexTask(bot, taskName, requirements, skillsFunctions);
}

export async function executeTask(bot, taskId) {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect,
        goToPosition,
        digDown,
        goToSurface
    };
    return await _executeTask(bot, taskId, skillsFunctions);
}

export async function createBuildingProject(bot, projectName, requirements, description = '') {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect,
        goToPosition,
        digDown,
        goToSurface
    };
    return await _createBuildingProject(bot, projectName, requirements, description);
}

/**
 * Clean up all temporary support blocks used during building
 * @param {MinecraftBot} bot - reference to the minecraft bot
 * @returns {Promise<boolean>} true if cleanup was successful
 */
export async function cleanupTemporarySupports(bot) {
    if (!bot.temporarySupportBlocks || bot.temporarySupportBlocks.length === 0) {
        return true;
    }
    
    log(bot, `Cleaning up ${bot.temporarySupportBlocks.length} temporary support blocks...`);
    
    for (const supportPos of bot.temporarySupportBlocks) {
        try {
            await breakBlockAt(bot, supportPos.x, supportPos.y, supportPos.z);
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            log(bot, `Warning: Could not remove support at ${supportPos}: ${error.message}`);
        }
    }
    
    bot.temporarySupportBlocks = [];
    log(bot, `Temporary support cleanup completed.`);
    return true;
}

/**
 * Task Manager Instance für erweiterte Funktionen
 */
export async function getTaskManager(bot) {
    const skillsFunctions = {
        craftRecipe,
        collectBlock,
        placeBlock,
        smartCraft: smartCraft,
        smartCollect: smartCollect,
        goToPosition,
        digDown,
        goToSurface
    };
    return new TaskManager(bot, skillsFunctions);
}

/**
 * Erweiterte Smelting-Funktion
 */
export async function smeltItems(bot, inputItem, quantity, fuelType = 'coal') {
    try {
        // Finde Furnace
        let furnace = bot.findBlock({
            matching: (block) => block && (block.name === 'furnace' || block.name === 'blast_furnace'),
            maxDistance: 16
        });
        
        if (!furnace) {
            console.log('🔥 No furnace found, crafting one...');
            await smartCraft(bot, 'furnace', 1);
            
            // Platziere Furnace
            const pos = bot.entity.position;
            await placeBlock(bot, 'furnace', pos.x + 1, pos.y, pos.z);
            
            furnace = bot.findBlock({
                matching: (block) => block && block.name === 'furnace',
                maxDistance: 5
            });
        }
        
        if (!furnace) {
            throw new Error('Could not find or create furnace');
        }
        
        // Navigate to furnace
        await goToPosition(bot, furnace.position.x, furnace.position.y, furnace.position.z, 2);
        
        // Open furnace
        const furnaceWindow = await bot.openBlock(furnace);
        
        // Put input items
        const inputItems = bot.inventory.items().filter(item => item.name === inputItem);
        const inputSlot = furnaceWindow.containerSlots[0];
        const fuelSlot = furnaceWindow.containerSlots[1];
        
        if (inputItems.length > 0) {
            await furnaceWindow.deposit(inputItems[0].type, null, Math.min(quantity, inputItems[0].count), inputSlot);
        }
        
        // Put fuel
        const fuelItems = bot.inventory.items().filter(item => item.name === fuelType);
        if (fuelItems.length > 0) {
            await furnaceWindow.deposit(fuelItems[0].type, null, Math.min(8, fuelItems[0].count), fuelSlot);
        }
        
        // Wait for smelting (simplified)
        await new Promise(resolve => setTimeout(resolve, quantity * 10000)); // 10 sec per item
        
        // Retrieve result
        const resultSlot = furnaceWindow.containerSlots[2];
        if (resultSlot && resultSlot.count > 0) {
            await furnaceWindow.withdraw(resultSlot.type, null, resultSlot.count);
            console.log(`🔥 Smelted ${quantity}x ${inputItem}`);
            furnaceWindow.close();
            return true;
        }
        
        furnaceWindow.close();
        return false;
        
    } catch (error) {
        console.log(`❌ Smelting failed: ${error.message}`);
        return false;
    }
}
