// src/services/model-discovery.js
// Service to discover available models from Ollama and LM Studio

export class ModelDiscoveryService {
    constructor() {
        this.ollamaUrl = 'http://localhost:11434';
        this.lmstudioUrl = 'http://localhost:1234';
    }

    /**
     * Get all available models from Ollama
     * @returns {Promise<Array>} List of Ollama models
     */
    async getOllamaModels() {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/tags`);
            if (!response.ok) {
                console.log('Ollama not available or no models found');
                return [];
            }

            const data = await response.json();

            if (!data.models || data.models.length === 0) {
                return [];
            }

            return data.models.map(model => ({
                name: model.name,
                size: this.formatSize(model.size),
                modified: model.modified_at,
                provider: 'ollama',
                type: 'ollama',
                family: model.details?.family || 'unknown',
                parameter_size: model.details?.parameter_size || 'unknown'
            }));
        } catch (error) {
            console.log('Ollama API error:', error.message);
            return [];
        }
    }

    /**
     * Get all available models from LM Studio
     * @returns {Promise<Array>} List of LM Studio models
     */
    async getLMStudioModels() {
        try {
            const response = await fetch(`${this.lmstudioUrl}/v1/models`);
            if (!response.ok) {
                console.log('LM Studio not available or no models found');
                return [];
            }

            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                return [];
            }

            // Filter out embedding models (they start with 'text-embedding-' or 'embedding')
            return data.data
                .filter(model => {
                    const id = model.id.toLowerCase();
                    return !id.includes('embedding');
                })
                .map(model => ({
                    name: model.id,
                    provider: 'lmstudio',
                    type: 'lmstudio',
                    created: model.created,
                    owned_by: model.owned_by || 'local'
                }));
        } catch (error) {
            console.log('LM Studio API error:', error.message);
            return [];
        }
    }

    /**
     * Get embedding models from LM Studio
     * @returns {Promise<Array>} List of LM Studio embedding models
     */
    async getLMStudioEmbeddings() {
        try {
            const response = await fetch(`${this.lmstudioUrl}/v1/models`);
            if (!response.ok) {
                return [];
            }

            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                return [];
            }

            // Filter for embedding models only
            return data.data
                .filter(model => {
                    const id = model.id.toLowerCase();
                    return id.includes('embedding');
                })
                .map(model => ({
                    name: model.id,
                    provider: 'lmstudio',
                    type: 'embedding'
                }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Get embedding models from Ollama
     * @returns {Promise<Array>} List of Ollama embedding models
     */
    async getOllamaEmbeddings() {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/tags`);
            if (!response.ok) {
                return [];
            }

            const data = await response.json();

            if (!data.models || data.models.length === 0) {
                return [];
            }

            // Filter for common embedding models
            return data.models
                .filter(model => {
                    const name = model.name.toLowerCase();
                    return name.includes('embed') || name.includes('nomic');
                })
                .map(model => ({
                    name: model.name,
                    provider: 'ollama',
                    type: 'embedding',
                    size: this.formatSize(model.size)
                }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Get all available models from both Ollama and LM Studio
     * @returns {Promise<Object>} Object with ollama and lmstudio model arrays
     */
    async getAllLocalModels() {
        const [ollamaModels, lmstudioModels] = await Promise.all([
            this.getOllamaModels(),
            this.getLMStudioModels()
        ]);

        return {
            ollama: ollamaModels,
            lmstudio: lmstudioModels,
            total: ollamaModels.length + lmstudioModels.length
        };
    }

    /**
     * Check if Ollama is running
     * @returns {Promise<boolean>}
     */
    async isOllamaAvailable() {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if LM Studio is running
     * @returns {Promise<boolean>}
     */
    async isLMStudioAvailable() {
        try {
            const response = await fetch(`${this.lmstudioUrl}/v1/models`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get service status
     * @returns {Promise<Object>}
     */
    async getServiceStatus() {
        const [ollamaAvailable, lmstudioAvailable] = await Promise.all([
            this.isOllamaAvailable(),
            this.isLMStudioAvailable()
        ]);

        return {
            ollama: {
                available: ollamaAvailable,
                url: this.ollamaUrl
            },
            lmstudio: {
                available: lmstudioAvailable,
                url: this.lmstudioUrl
            }
        };
    }

    /**
     * Format size in bytes to human readable
     * @param {number} bytes
     * @returns {string}
     */
    formatSize(bytes) {
        if (!bytes) return 'Unknown';

        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Create a profile object for a discovered model
     * @param {Object} model - Model info
     * @returns {Object} Profile configuration
     */
    createProfileFromModel(model) {
        const profile = {
            name: model.name,
            model: model.name,
            api: model.provider
        };

        if (model.provider === 'ollama') {
            profile.url = this.ollamaUrl;
            profile.model_type = 'ollama';
        } else if (model.provider === 'lmstudio') {
            profile.url = this.lmstudioUrl;
            profile.model_type = 'lmstudio';
        }

        return profile;
    }
}
