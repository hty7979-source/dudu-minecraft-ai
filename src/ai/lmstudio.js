import { strictFormat } from '../utils/text.js';
import { TIMING } from '../config/constants.js';

/**
 * Parse template tags from weak LLMs and convert to valid commands
 * Handles patterns like: <|start|>assistant<|channel|>commentary to=functions.smartCraft <|constrain|>json<|message|>{"item":"..."}
 * @param {string} text - Raw LLM response
 * @returns {string} Cleaned response with converted commands
 */
function parseTemplateTags(text) {
    if (!text) return text;

    // Pattern 1: commentary to=repo.command.value json{"name":"FUNCTION","arguments":[...]}
    // This is the NEW format that gpt-oss-20b generates (with or without space after "json")
    // Need to match nested JSON structures properly
    const repoCommandPattern = /commentary\s+to=repo\.command\.value\s+json\s*(\{(?:[^{}]|\{[^{}]*\})*\})/gi;
    text = text.replace(repoCommandPattern, (match, jsonStr) => {
        try {
            const data = JSON.parse(jsonStr);
            if (data.name && data.arguments) {
                // Convert arguments array to object
                const functionName = data.name;
                const args = data.arguments;

                // Map common command argument patterns
                let commandData = {};
                if (functionName === 'smartCollect' && args[0]) {
                    // Format: ["cobblestone:10"] or ["cobblestone", 10]
                    const arg = args[0];
                    if (typeof arg === 'string' && arg.includes(':')) {
                        const [block, count] = arg.split(':');
                        commandData = { block_type: block, count: parseInt(count) };
                    } else {
                        commandData = { block_type: arg, count: args[1] || 10 };
                    }
                } else if (functionName === 'smartCraft' && args[0]) {
                    commandData = {
                        item: args[0],
                        quantity: args[1] || 1,
                        auto_gather: args[2] !== undefined ? args[2] : true
                    };
                } else if (functionName === 'attack' && args[0]) {
                    commandData = { type: args[0] };
                } else if (functionName === 'followPlayer' && args[0]) {
                    commandData = { player_name: args[0], follow_dist: args[1] || 3 };
                } else if (functionName === 'givePlayer' && args[0]) {
                    commandData = { player_name: args[0], item_name: args[1] || '', quantity: args[2] || 1 };
                } else if (functionName === 'build' && args[0]) {
                    commandData = { name: args[0] };
                } else if (functionName === 'goToPlayer' && args[0]) {
                    commandData = { player_name: args[0], closeness: args[1] || 3 };
                } else if (functionName === 'inventory') {
                    commandData = {};
                } else if (functionName === 'buildlist') {
                    commandData = {};
                } else {
                    // Generic fallback - try to map arguments
                    commandData = { arguments: args };
                }

                const command = convertJsonToCommand(functionName, commandData);
                console.log(`🔄 Converted repo.command template to: ${command}`);
                return command;
            }
        } catch (e) {
            console.warn('Failed to parse repo.command JSON:', jsonStr, e.message);
        }
        return ''; // Remove failed patterns
    });

    // Pattern 2: <|...channel|>commentary to=functions.FUNCTION <|constrain|>json<|message|>{...}
    const channelJsonPattern = /<\|[^>]*channel[^>]*\>\s*commentary\s+to=functions\.(\w+)\s*<\|constrain\|>json<\|message\|>(\{[^}]*\})/gi;
    text = text.replace(channelJsonPattern, (match, functionName, jsonStr) => {
        try {
            const data = JSON.parse(jsonStr);
            const command = convertJsonToCommand(functionName, data);
            console.log(`🔄 Converted template tag to command: ${command}`);
            return command;
        } catch (e) {
            console.warn('Failed to parse JSON from template tag:', jsonStr);
            return match;
        }
    });

    // Pattern 3: Simple JSON blocks for common functions
    const simpleJsonPattern = /<\|[^>]*\>\s*(\{[^}]*\})/g;
    text = text.replace(simpleJsonPattern, (match, jsonStr) => {
        try {
            const data = JSON.parse(jsonStr);
            let command = null;

            // Try to infer command from JSON structure
            if (data.item || data.item_name) {
                command = convertJsonToCommand('smartCraft', data);
            } else if (data.type) {
                command = convertJsonToCommand('attack', data);
            } else if (data.player_name) {
                if (data.follow_dist !== undefined) {
                    command = convertJsonToCommand('followPlayer', data);
                } else if (data.item_name) {
                    command = convertJsonToCommand('givePlayer', data);
                }
            }

            if (command) {
                console.log(`🔄 Converted JSON to command: ${command}`);
                return command;
            }
        } catch (e) {
            // Not valid JSON, leave as is
        }
        return match;
    });

    // Pattern 4: Catch remaining <|constrain|>:// patterns (malformed commands)
    text = text.replace(/<\|constrain\|>:\/\/(\w+)\([^)]*\)/g, (match, funcName) => {
        console.log(`⚠️ Removed malformed template: ${match}`);
        return ''; // Remove malformed patterns
    });

    // Pattern 5: Remove any remaining template tags
    const removedTags = text.match(/<\|[^>]*\>/g);
    if (removedTags && removedTags.length > 0) {
        console.log(`🧹 Cleaning template tags: ${removedTags.join(', ')}`);
    }
    text = text.replace(/<\|[^>]*\>/g, '');

    return text.trim();
}

/**
 * Convert JSON data to command string
 * @param {string} functionName - Name of the function
 * @param {Object} data - JSON data with parameters
 * @returns {string} Command string like !smartCraft("item", 1, true)
 */
function convertJsonToCommand(functionName, data) {
    const fn = functionName.toLowerCase();

    // ============== CRAFTING & GATHERING ==============
    if (fn === 'smartcraft') {
        const item = data.item || data.item_name || '';
        const quantity = data.quantity || data.count || 1;
        const autoGather = data.auto_gather !== undefined ? data.auto_gather : true;
        return `!smartCraft("${item}", ${quantity}, ${autoGather})`;
    }

    if (fn === 'smartcollect') {
        const block = data.block || data.block_type || data.item || '';
        const count = data.count || data.quantity || 1;
        const mode = data.mode || data.strategy || 'auto';
        return `!smartCollect("${block}:${count}", "${mode}")`;
    }

    if (fn === 'collectblocks') {
        const type = data.type || data.block_type || '';
        const quantity = data.quantity || data.num || data.count || 1;
        return `!collectBlocks("${type}", ${quantity})`;
    }

    if (fn === 'craftrecipe') {
        const recipeName = data.recipe_name || data.item || '';
        const quantity = data.quantity || data.num || data.count || 1;
        return `!craftRecipe("${recipeName}", ${quantity})`;
    }

    if (fn === 'smeltitem') {
        const itemName = data.item_name || data.item || '';
        const quantity = data.quantity || data.num || data.count || 1;
        return `!smeltItem("${itemName}", ${quantity})`;
    }

    // ============== INVENTORY & ITEMS ==============
    if (fn === 'inventory') {
        return `!inventory`;
    }

    if (fn === 'giveplayer') {
        const player = data.player_name || '';
        const itemName = data.item_name || data.item || '';
        const quantity = data.quantity || data.num || data.count || 1;
        return `!givePlayer("${player}", "${itemName}", ${quantity})`;
    }

    if (fn === 'consume') {
        const itemName = data.item_name || data.item || '';
        return `!consume("${itemName}")`;
    }

    if (fn === 'equip') {
        const itemName = data.item_name || data.item || '';
        return `!equip("${itemName}")`;
    }

    if (fn === 'discard') {
        const itemName = data.item_name || data.item || '';
        const quantity = data.quantity || data.num || data.count || 1;
        return `!discard("${itemName}", ${quantity})`;
    }

    // ============== MOVEMENT ==============
    if (fn === 'gotoplayer') {
        const targetPlayer = data.player_name || '';
        const closeness = data.closeness || data.distance || 3;
        return `!goToPlayer("${targetPlayer}", ${closeness})`;
    }

    if (fn === 'followplayer') {
        const playerName = data.player_name || '';
        const followDist = data.follow_dist || data.distance || 3;
        return `!followPlayer("${playerName}", ${followDist})`;
    }

    if (fn === 'gotocoordinates') {
        const x = data.x || 0;
        const y = data.y || 0;
        const z = data.z || 0;
        const closeness = data.closeness || data.distance || 1;
        return `!goToCoordinates(${x}, ${y}, ${z}, ${closeness})`;
    }

    if (fn === 'searchforblock') {
        const type = data.type || data.block_type || '';
        const searchRange = data.search_range || data.range || 64;
        return `!searchForBlock("${type}", ${searchRange})`;
    }

    if (fn === 'searchforentity') {
        const type = data.type || data.entity_type || '';
        const searchRange = data.search_range || data.range || 64;
        return `!searchForEntity("${type}", ${searchRange})`;
    }

    if (fn === 'moveaway') {
        const distance = data.distance || 5;
        return `!moveAway(${distance})`;
    }

    if (fn === 'rememberhere') {
        const name = data.name || 'location';
        return `!rememberHere("${name}")`;
    }

    if (fn === 'gotorememberedplace') {
        const name = data.name || '';
        return `!goToRememberedPlace("${name}")`;
    }

    if (fn === 'stay') {
        const time = data.time || data.seconds || -1;
        return `!stay(${time})`;
    }

    if (fn === 'gotobed') {
        return `!goToBed`;
    }

    if (fn === 'gotosurface') {
        return `!goToSurface`;
    }

    // ============== BUILDING ==============
    if (fn === 'build') {
        const structureName = data.name || data.structure || '';
        return `!build("${structureName}")`;
    }

    if (fn === 'buildat') {
        const name = data.name || '';
        const x = data.x || 0;
        const y = data.y || 0;
        const z = data.z || 0;
        return `!buildAt("${name}", ${x}, ${y}, ${z})`;
    }

    if (fn === 'buildlist' || fn === 'buildings') {
        return `!buildlist`;
    }

    if (fn === 'buildstatus') {
        return `!buildstatus`;
    }

    if (fn === 'buildcancel') {
        return `!buildcancel`;
    }

    if (fn === 'buildresume') {
        return `!buildresume`;
    }

    if (fn === 'placehere') {
        const type = data.type || data.block_type || '';
        return `!placeHere("${type}")`;
    }

    // ============== COMBAT ==============
    if (fn === 'attack') {
        const target = data.type || data.target || data.mob_type || '';
        return `!attack("${target}")`;
    }

    if (fn === 'attackplayer') {
        const playerName = data.player_name || '';
        return `!attackPlayer("${playerName}")`;
    }

    // ============== STORAGE ==============
    if (fn === 'putinchest') {
        const itemName = data.item_name || data.item || '';
        const quantity = data.quantity || data.num || data.count || 1;
        return `!putInChest("${itemName}", ${quantity})`;
    }

    if (fn === 'takefromchest') {
        const itemName = data.item_name || data.item || '';
        const quantity = data.quantity || data.num || data.count || 1;
        return `!takeFromChest("${itemName}", ${quantity})`;
    }

    if (fn === 'viewchest') {
        return `!viewChest`;
    }

    // ============== QUERIES ==============
    if (fn === 'stats') {
        return `!stats`;
    }

    if (fn === 'nearbyblocks') {
        return `!nearbyBlocks`;
    }

    if (fn === 'craftable') {
        return `!craftable`;
    }

    if (fn === 'entities') {
        return `!entities`;
    }

    if (fn === 'modes') {
        return `!modes`;
    }

    if (fn === 'savedplaces') {
        return `!savedPlaces`;
    }

    // ============== MODES ==============
    if (fn === 'setmode') {
        const modeName = data.mode_name || data.mode || '';
        const on = data.on !== undefined ? data.on : true;
        return `!setMode("${modeName}", ${on})`;
    }

    if (fn === 'goal') {
        const prompt = data.prompt || data.goal || '';
        return `!goal("${prompt}")`;
    }

    if (fn === 'endgoal') {
        return `!endGoal`;
    }

    // ============== UTILITY ==============
    if (fn === 'useon') {
        const toolName = data.tool_name || data.tool || 'hand';
        const target = data.target || 'nothing';
        return `!useOn("${toolName}", "${target}")`;
    }

    if (fn === 'lookatplayer') {
        const playerName = data.player_name || '';
        const direction = data.direction || 'at';
        return `!lookAtPlayer("${playerName}", "${direction}")`;
    }

    if (fn === 'lookatposition') {
        const x = data.x || 0;
        const y = data.y || 0;
        const z = data.z || 0;
        return `!lookAtPosition(${x}, ${y}, ${z})`;
    }

    // ============== TRADING ==============
    if (fn === 'showvillagertrades') {
        const id = data.id || 0;
        return `!showVillagerTrades(${id})`;
    }

    if (fn === 'tradewithvillager') {
        const id = data.id || 0;
        const index = data.index || 1;
        const count = data.count || 1;
        return `!tradeWithVillager(${id}, ${index}, ${count})`;
    }

    // ============== CONVERSATION ==============
    if (fn === 'startconversation') {
        const playerName = data.player_name || '';
        const message = data.message || '';
        return `!startConversation("${playerName}", "${message}")`;
    }

    if (fn === 'endconversation') {
        const playerName = data.player_name || '';
        return `!endConversation("${playerName}")`;
    }

    // ============== CORE SYSTEM ==============
    if (fn === 'stop') {
        return `!stop`;
    }

    if (fn === 'help') {
        return `!help`;
    }

    // ============== DEFAULT ==============
    console.warn(`🔄 Unknown function in template conversion: ${functionName}, attempting generic conversion`);
    return `!${functionName}(${JSON.stringify(data)})`;
}

export class LMStudio {
    static prefix = 'lmstudio';
    constructor(model_name, url, params) {
        this.model_name = model_name;
        this.params = params;
        this.url = url || 'http://127.0.0.1:1234';
        this.chat_endpoint = '/v1/chat/completions';
        this.embedding_endpoint = '/v1/embeddings';
        this.models_endpoint = '/v1/models';
        this.isHealthy = false; // Track if server is responsive
    }

    /**
     * Check if LMStudio server is available and responsive
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<boolean>} True if server is healthy
     */
    async healthCheck(timeout = TIMING.LLM_HEALTH_CHECK_TIMEOUT_MS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const url = new URL(this.models_endpoint, this.url);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' }
            });

            clearTimeout(timeoutId);
            this.isHealthy = response.ok;
            return response.ok;
        } catch (err) {
            this.isHealthy = false;
            return false;
        }
    }

    /**
     * Wait for LMStudio server to become available with exponential backoff
     * @param {number} maxRetries - Maximum number of retries
     * @returns {Promise<boolean>} True if server became available
     */
    async waitForServer(maxRetries = TIMING.LLM_MAX_STARTUP_RETRIES) {
        console.log(`⏳ Waiting for LMStudio server at ${this.url}...`);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const isHealthy = await this.healthCheck();

            if (isHealthy) {
                console.log(`✅ LMStudio server is ready!`);
                return true;
            }

            if (attempt < maxRetries) {
                // Exponential backoff: delay * 2^(attempt-1)
                const delay = TIMING.LLM_RETRY_DELAY_MS * Math.pow(1.5, attempt - 1);
                console.log(`⏳ LMStudio not ready yet, retrying in ${Math.round(delay)}ms... (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.warn(`⚠️ LMStudio server did not respond after ${maxRetries} attempts. Continuing anyway...`);
        return false;
    }

    async getAvailableModels() {
        try {
            let response = await this.send(this.models_endpoint, null, 'GET');
            return response?.data || [];
        } catch (err) {
            console.warn('Could not fetch available models from LMStudio');
            return [];
        }
    }

    async autoSelectModel() {
        const models = await this.getAvailableModels();
        if (models.length > 0) {
            console.log(`LMStudio: Auto-selecting model: ${models[0].id}`);
            return models[0].id;
        }
        return this.model_name || 'qwen/qwen3-8b';
    }

    async sendRequest(turns, systemMessage) {
        // Use specific model or fallback to qwen3-8b
        let model = this.model_name || 'qwen/qwen3-8b';
        let messages = strictFormat(turns);
        messages.unshift({ role: 'system', content: systemMessage });
        const maxAttempts = 5;
        let attempt = 0;
        let finalRes = null;

        while (attempt < maxAttempts) {
            attempt++;
            console.log(`Awaiting LMStudio response... (model: ${model}, attempt: ${attempt})`);
            let res = null;
            try {
                let apiResponse = await this.send(this.chat_endpoint, {
                    model: model,
                    messages: messages,
                    stream: false,
                    ...(this.params || {})
                });
                if (apiResponse && apiResponse.choices && apiResponse.choices[0]) {
                    res = apiResponse.choices[0].message.content;
                } else {
                    res = 'No response data.';
                }
            } catch (err) {
                if (err.message.toLowerCase().includes('context length') && turns.length > 1) {
                    console.log('Context length exceeded, trying again with shorter context.');
                    return await this.sendRequest(turns.slice(1), systemMessage);
                } else {
                    console.log(err);
                    res = 'My brain disconnected, try again.';
                }
            }

            const hasOpenTag = res.includes("<think>");
            const hasCloseTag = res.includes("</think>");

            if ((hasOpenTag && !hasCloseTag)) {
                console.warn("Partial <think> block detected. Re-generating...");
                if (attempt < maxAttempts) continue;
            }
            if (hasCloseTag && !hasOpenTag) {
                res = '<think>' + res;
            }
            if (hasOpenTag && hasCloseTag) {
                res = res.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            }

            // Parse template tags and convert to commands (for weak LLMs)
            res = parseTemplateTags(res);

            finalRes = res;
            break;
        }

        if (finalRes == null) {
            console.warn("Could not get a valid response after max attempts.");
            finalRes = 'I thought too hard, sorry, try again.';
        }
        return finalRes;
    }

    async embed(text) {
        let model = 'embeddinggemma-300m';
        let body = { 
            model: model, 
            input: text 
        };
        try {
            let res = await this.send(this.embedding_endpoint, body);
            return res.data && res.data[0] ? res.data[0].embedding : null;
        } catch (err) {
            console.warn('LMStudio embedding failed, using fallback:', err.message);
            return null;
        }
    }

    async send(endpoint, body, method = 'POST') {
        const url = new URL(endpoint, this.url);
        let headers = new Headers({
            'Content-Type': 'application/json'
        });
        
        const requestOptions = { method, headers };
        if (body && method === 'POST') {
            requestOptions.body = JSON.stringify(body);
        }
        
        const request = new Request(url, requestOptions);
        let data = null;
        try {
            const res = await fetch(request);
            if (res.ok) {
                data = await res.json();
            } else {
                throw new Error(`LMStudio Status: ${res.status}`);
            }
        } catch (err) {
            console.error('Failed to send LMStudio request.');
            console.error(err);
        }
        return data;
    }

    async sendVisionRequest(messages, systemMessage, imageBuffer) {
        const imageMessages = [...messages];
        imageMessages.push({
            role: "user",
            content: [
                { type: "text", text: systemMessage },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
                    }
                }
            ]
        });
        
        return this.sendRequest(imageMessages, systemMessage);
    }
}