// src/agent/model_manager.js
import fs from 'fs/promises';
import { existsSync } from 'fs';

export class ModelManager {
    constructor(agent) {
        this.agent = agent;
    }

    /**
     * Switch the LLM model at runtime without restarting the bot
     * @param {string} profilePath - Path to the profile JSON file
     * @returns {Promise<{success: boolean, model?: string, error?: string}>}
     */
    async switchLLM(profilePath) {
        try {
            // Load new profile
            const profile = await this.loadProfile(profilePath);

            if (!profile.model) {
                throw new Error('Profile does not contain a model definition');
            }

            // Get model class based on model type
            const ModelClass = await this.getModelClass(profile);

            // Create new model instance
            const newModel = new ModelClass(profile.model, profile.url);

            // Initialize the model if it has an init method
            if (typeof newModel.init === 'function') {
                await newModel.init();
            }

            // Switch model in prompter
            if (this.agent.prompter) {
                const oldModel = this.agent.prompter.model;
                this.agent.prompter.model = newModel;

                // Clean up old model if it has a cleanup method
                if (oldModel && typeof oldModel.cleanup === 'function') {
                    await oldModel.cleanup();
                }

                console.log(`✅ LLM model switched to: ${profile.model}`);
            } else {
                throw new Error('Agent prompter not available');
            }

            return {
                success: true,
                model: profile.model
            };
        } catch (error) {
            console.error('❌ Error switching LLM:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Switch the embedding model at runtime
     * @param {string} embeddingModel - Name of the embedding model
     * @returns {Promise<{success: boolean, embedding?: string, error?: string}>}
     */
    async switchEmbedding(embeddingModel) {
        try {
            // Update embedding model in agent
            if (this.agent.prompter) {
                this.agent.prompter.embedding_model = embeddingModel;
            }

            // Reinitialize memory bank if needed
            if (this.agent.memory_bank) {
                await this.agent.memory_bank.reinitialize(embeddingModel);
                console.log(`✅ Embedding model switched to: ${embeddingModel}`);
            }

            return {
                success: true,
                embedding: embeddingModel
            };
        } catch (error) {
            console.error('❌ Error switching embedding:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Load a profile from file
     * @param {string} profilePath - Path to the profile JSON
     * @returns {Promise<Object>} Profile object
     */
    async loadProfile(profilePath) {
        if (!existsSync(profilePath)) {
            throw new Error(`Profile not found: ${profilePath}`);
        }

        const content = await fs.readFile(profilePath, 'utf8');
        return JSON.parse(content);
    }

    /**
     * Get the model class based on profile configuration
     * @param {Object} profile - Profile object
     * @returns {Promise<Class>} Model class
     */
    async getModelClass(profile) {
        // Determine model type from profile
        const modelType = this.determineModelType(profile);

        switch (modelType) {
            case 'openai':
            case 'gpt':
                return (await import('../models/gpt.js')).GPT;

            case 'anthropic':
            case 'claude':
                return (await import('../models/claude.js')).Claude;

            case 'ollama':
                return (await import('../models/ollama.js')).Ollama;

            case 'lmstudio':
                return (await import('../models/openai_api.js')).OpenAIAPI;

            case 'gemini':
            case 'google':
                return (await import('../models/gemini.js')).Gemini;

            case 'groq':
                return (await import('../models/groq.js')).Groq;

            case 'replicate':
                return (await import('../models/replicate.js')).Replicate;

            case 'huggingface':
                return (await import('../models/huggingface.js')).HuggingFace;

            case 'mistral':
                return (await import('../models/mistral.js')).Mistral;

            case 'deepseek':
                return (await import('../models/openai_api.js')).OpenAIAPI;

            default:
                throw new Error(`Unknown model type: ${modelType}. Please check your profile configuration.`);
        }
    }

    /**
     * Determine model type from profile
     * @param {Object} profile - Profile object
     * @returns {string} Model type
     */
    determineModelType(profile) {
        // First check if there's an explicit model_type field
        if (profile.model_type) {
            return profile.model_type.toLowerCase();
        }

        // Try to infer from URL
        if (profile.url) {
            const url = profile.url.toLowerCase();
            if (url.includes('openai.com')) return 'openai';
            if (url.includes('anthropic.com')) return 'anthropic';
            if (url.includes('localhost') || url.includes('127.0.0.1')) return 'lmstudio';
            if (url.includes('groq.com')) return 'groq';
            if (url.includes('replicate.com')) return 'replicate';
            if (url.includes('huggingface')) return 'huggingface';
            if (url.includes('mistral.ai')) return 'mistral';
            if (url.includes('deepseek.com')) return 'deepseek';
        }

        // Try to infer from model name
        if (profile.model) {
            const model = profile.model.toLowerCase();
            if (model.includes('gpt')) return 'openai';
            if (model.includes('claude')) return 'anthropic';
            if (model.includes('gemini')) return 'gemini';
            if (model.includes('llama') || model.includes('mistral') || model.includes('qwen')) {
                // These could be Ollama models
                if (!profile.url || profile.url.includes('localhost:11434')) {
                    return 'ollama';
                }
            }
            if (model.includes('groq')) return 'groq';
            if (model.includes('deepseek')) return 'deepseek';
        }

        // Default to Ollama for local models
        return 'ollama';
    }

    /**
     * Get list of available profiles
     * @returns {Promise<Array>} List of available profiles
     */
    async getAvailableProfiles() {
        const profiles = [];
        const profilesDir = './profiles';

        try {
            if (existsSync(profilesDir)) {
                const files = await fs.readdir(profilesDir);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        try {
                            const profile = await this.loadProfile(`${profilesDir}/${file}`);
                            profiles.push({
                                name: profile.name || file.replace('.json', ''),
                                file: `${profilesDir}/${file}`,
                                model: profile.model,
                                type: this.determineModelType(profile)
                            });
                        } catch (e) {
                            console.error(`Error loading profile ${file}:`, e.message);
                        }
                    }
                }
            }

            // Also check for Dudu.json in root
            if (existsSync('./Dudu.json')) {
                try {
                    const profile = await this.loadProfile('./Dudu.json');
                    profiles.push({
                        name: profile.name || 'Dudu',
                        file: './Dudu.json',
                        model: profile.model,
                        type: this.determineModelType(profile)
                    });
                } catch (e) {
                    console.error('Error loading Dudu.json:', e.message);
                }
            }
        } catch (error) {
            console.error('Error getting available profiles:', error);
        }

        return profiles;
    }

    /**
     * Reload agent settings without full restart
     * @param {Object} newSettings - New settings to apply
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async reloadSettings(newSettings) {
        try {
            // Update agent settings
            Object.assign(this.agent.settings, newSettings);

            // Reinitialize components that depend on settings
            if (newSettings.minecraft_version && this.agent.bot) {
                console.log('⚠️ Minecraft version changed. Full restart required.');
                return {
                    success: false,
                    error: 'Minecraft version change requires full restart'
                };
            }

            console.log('✅ Settings reloaded successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Error reloading settings:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
