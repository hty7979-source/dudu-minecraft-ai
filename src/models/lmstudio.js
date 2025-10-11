import { strictFormat } from '../utils/text.js';

export class LMStudio {
    static prefix = 'lmstudio';
    constructor(model_name, url, params) {
        this.model_name = model_name;
        this.params = params;
        this.url = url || 'http://127.0.0.1:1234';
        this.chat_endpoint = '/v1/chat/completions';
        this.embedding_endpoint = '/v1/embeddings';
        this.models_endpoint = '/v1/models';
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