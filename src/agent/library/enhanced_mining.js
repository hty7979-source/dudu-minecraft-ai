/**
 * Enhanced Mining System for Mindcraft
 * Fixes common issues with block targeting and mining duration
 */

import * as world from '../world.js';
import * as skills from './skills.js';
import * as mc from '../../utils/mcdata.js';
import pf from 'mineflayer-pathfinder';

export class EnhancedMiningManager {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Enhanced collectBlock with better targeting and mining duration
     */
    async enhancedCollectBlock(blockType, num = 1, exclude = null) {
        console.log(`🔧 Enhanced mining: ${num}x ${blockType}`);
        
        if (num < 1) {
            this.bot.chat(`Invalid number of blocks to collect: ${num}`);
            return false;
        }

        let blocktypes = [blockType];
        if (blockType === 'coal' || blockType === 'diamond' || blockType === 'emerald' || blockType === 'iron' || blockType === 'gold' || blockType === 'lapis_lazuli' || blockType === 'redstone')
            blocktypes.push(blockType + '_ore');
        if (blockType.endsWith('ore'))
            blocktypes.push('deepslate_' + blockType);
        if (blockType === 'dirt')
            blocktypes.push('grass_block');
        if (blockType === 'cobblestone')
            blocktypes.push('stone');

        const isLiquid = blockType === 'lava' || blockType === 'water';
        let collected = 0;

        for (let i = 0; i < num; i++) {
            try {
                const success = await this.mineNextBlock(blocktypes, exclude, isLiquid);
                if (success) {
                    collected++;
                } else {
                    this.bot.chat(`⚠️ Could not find more ${blockType} blocks to mine`);
                    break;
                }
            } catch (error) {
                console.log(`❌ Mining error: ${error.message}`);
                this.bot.chat(`❌ Mining failed: ${error.message}`);
                break;
            }

            if (this.bot.interrupt_code) {
                break;
            }
        }

        this.bot.chat(`✅ Enhanced mining completed: ${collected}/${num} ${blockType}`);
        return collected > 0;
    }

    /**
     * Mine a single block with enhanced targeting and duration
     */
    async mineNextBlock(blocktypes, exclude, isLiquid) {
        // Find the nearest suitable block
        const blocks = world.getNearestBlocksWhere(this.bot, block => {
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
                return block.metadata === 0; // source blocks only
            }
            return true;
        }, 32, 1);

        if (blocks.length === 0) {
            return false;
        }

        const targetBlock = blocks[0];
        console.log(`🎯 Targeting block ${targetBlock.name} at ${targetBlock.position.x}, ${targetBlock.position.y}, ${targetBlock.position.z}`);

        // Move closer to the block if needed
        const distance = this.bot.entity.position.distanceTo(targetBlock.position);
        if (distance > 4.5) {
            console.log(`🚶 Moving closer to block (distance: ${distance.toFixed(1)})`);
            await this.moveToBlock(targetBlock);
        }

        // Equip the best tool for this block
        await this.equipBestTool(targetBlock);

        // Verify we can harvest this block
        const itemId = this.bot.heldItem ? this.bot.heldItem.type : null;
        if (!targetBlock.canHarvest(itemId)) {
            console.log(`⚠️ Cannot harvest ${targetBlock.name} with current tool`);
            // Try to mine anyway with hand if we don't have the right tool
        }

        // Mine the block with enhanced method
        if (isLiquid) {
            return await this.harvestLiquid(targetBlock);
        } else if (mc.mustCollectManually(targetBlock.name)) {
            return await this.manuallyCollectBlock(targetBlock);
        } else {
            return await this.enhancedDigBlock(targetBlock);
        }
    }

    /**
     * Enhanced block digging with proper targeting and completion verification
     */
    async enhancedDigBlock(targetBlock) {
        console.log(`⛏️ Enhanced digging ${targetBlock.name}`);

        try {
            // Look at the block before mining
            await this.bot.lookAt(targetBlock.position.offset(0.5, 0.5, 0.5));
            await this.sleep(100); // Small delay for targeting

            // Start digging with timeout
            const startTime = Date.now();
            const maxDigTime = 30000; // 30 seconds max

            // Use enhanced dig method with completion checking
            await Promise.race([
                this.digWithCompletion(targetBlock),
                this.timeout(maxDigTime, 'Mining timeout')
            ]);

            // Pick up dropped items
            await this.pickupNearbyItems();

            console.log(`✅ Successfully mined ${targetBlock.name} in ${Date.now() - startTime}ms`);
            return true;

        } catch (error) {
            console.log(`❌ Enhanced digging failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Dig with completion verification
     */
    async digWithCompletion(targetBlock) {
        return new Promise(async (resolve, reject) => {
            try {
                // Listen for block break event
                const onBlockUpdate = (oldBlock, newBlock) => {
                    if (oldBlock && 
                        oldBlock.position.equals(targetBlock.position) && 
                        (!newBlock || newBlock.type === 0)) { // Block was broken
                        this.bot.removeListener('blockUpdate', onBlockUpdate);
                        resolve(true);
                    }
                };

                this.bot.on('blockUpdate', onBlockUpdate);

                // Start digging
                await this.bot.dig(targetBlock, true); // Force swing

                // If we reach here, digging completed normally
                this.bot.removeListener('blockUpdate', onBlockUpdate);
                resolve(true);

            } catch (error) {
                this.bot.removeListener('blockUpdate', onBlockUpdate);
                reject(error);
            }
        });
    }

    /**
     * Manual collection for special blocks
     */
    async manuallyCollectBlock(targetBlock) {
        console.log(`👋 Manually collecting ${targetBlock.name}`);
        
        try {
            // Move very close for manual collection
            await this.moveToBlock(targetBlock, 2);
            
            // Look at the block
            await this.bot.lookAt(targetBlock.position.offset(0.5, 0.5, 0.5));
            
            // Dig manually with monitoring
            await this.bot.dig(targetBlock);
            
            // Pick up items
            await this.pickupNearbyItems();
            
            return true;
        } catch (error) {
            console.log(`❌ Manual collection failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Harvest liquid blocks
     */
    async harvestLiquid(targetBlock) {
        const bucket = this.bot.inventory.items().find(item => item.name === 'bucket');
        if (!bucket) {
            this.bot.chat(`Need bucket to collect ${targetBlock.name}`);
            return false;
        }

        await this.bot.equip(bucket, 'hand');
        await this.bot.lookAt(targetBlock.position.offset(0.5, 0.5, 0.5));
        
        try {
            await this.bot.activateBlock(targetBlock);
            return true;
        } catch (error) {
            console.log(`❌ Liquid harvest failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Move to optimal mining position
     */
    async moveToBlock(targetBlock, maxDistance = 4) {
        const movements = new pf.Movements(this.bot);
        movements.dontMineUnderFallingBlock = false;
        movements.dontCreateFlow = true;
        
        this.bot.pathfinder.setMovements(movements);
        
        const goal = new pf.goals.GoalNear(targetBlock.position.x, targetBlock.position.y, targetBlock.position.z, maxDistance);
        
        try {
            await this.bot.pathfinder.goto(goal);
        } catch (error) {
            console.log(`⚠️ Movement failed, trying direct approach: ${error.message}`);
            // Try to get as close as possible anyway
        }
    }

    /**
     * Equip best tool for block type
     */
    async equipBestTool(targetBlock) {
        try {
            await this.bot.tool.equipForBlock(targetBlock);
        } catch (error) {
            console.log(`⚠️ Tool equip failed: ${error.message}`);
            // Continue with current tool
        }
    }

    /**
     * Enhanced item pickup with better range
     */
    async pickupNearbyItems() {
        const distance = 16; // Increased pickup range
        const maxPickupTime = 3000; // 3 seconds max for pickup
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxPickupTime) {
            const nearbyItems = this.bot.nearestEntity(entity => 
                entity.name === 'item' && 
                this.bot.entity.position.distanceTo(entity.position) < distance
            );
            
            if (!nearbyItems) {
                break; // No more items
            }

            try {
                // Move towards the item
                const movements = new pf.Movements(this.bot);
                movements.canDig = false;
                this.bot.pathfinder.setMovements(movements);
                
                await Promise.race([
                    this.bot.pathfinder.goto(new pf.goals.GoalFollow(nearbyItems, 1)),
                    this.timeout(2000, 'Pickup movement timeout')
                ]);
                
                await this.sleep(200); // Wait for item to be picked up
                
            } catch (error) {
                console.log(`⚠️ Item pickup failed: ${error.message}`);
                break;
            }
        }
    }

    /**
     * Utility methods
     */
    timeout(ms, message) {
        return new Promise((_, reject) => 
            setTimeout(() => reject(new Error(message)), ms)
        );
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance creator
export function createEnhancedMining(bot) {
    return new EnhancedMiningManager(bot);
}