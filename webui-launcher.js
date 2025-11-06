// webui-launcher.js - WebUI Control Center
import fs from 'fs';
import * as Mindcraft from './src/mindcraft/mindcraft.js';
import settings from './settings.js';
import { ModelDiscoveryService } from './src/services/model-discovery.js';

class WebUILauncher {
    constructor() {
        this.settings = settings;
        this.activeAgents = new Map();
        this.modelDiscovery = new ModelDiscoveryService();
    }

    async start() {
        console.log('🌐 Starting Dudu WebUI Control Center...');

        // Initialize Mindcraft with mindserver only (no agents yet)
        await Mindcraft.init(false, this.settings.mindserver_port || 8080, this.settings.auto_open_ui);

        // Wait a moment for the server to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Setup additional API endpoints for bot control
        await this.setupAPIEndpoints();

        console.log(`✅ WebUI Control Center running at http://localhost:${this.settings.mindserver_port || 8080}`);
        console.log('🎮 Configure and start your bot from the web interface!');
    }

    async setupAPIEndpoints() {
        // Import the mindserver's express app
        const { getExpressApp } = await import('./src/mindcraft/mindserver.js');

        if (!getExpressApp) {
            console.error('⚠️  Express app not exposed from mindserver');
            return;
        }

        // Try multiple times if needed
        let app = null;
        let attempts = 0;

        while (!app && attempts < 10) {
            app = getExpressApp();
            if (!app) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
        }

        if (!app) {
            console.error('❌ Failed to get Express app after 10 attempts');
            return;
        }

        // API Routes
        this.registerRoutes(app);
        console.log('✅ API endpoints registered successfully');
    }

    registerRoutes(app) {
        // Get available models (including dynamic discovery)
        app.get('/api/models', async (req, res) => {
            const llmModels = this.getAvailableLLMs();
            const embeddingModels = await this.getAvailableEmbeddings();
            const currentSettings = this.getCurrentSettings();

            // Discover local models from Ollama and LM Studio
            const localModels = await this.modelDiscovery.getAllLocalModels();

            console.log(`📊 API /api/models called - Found ${llmModels.length} profile models, ${localModels.total} local models, ${embeddingModels.length} embeddings`);

            res.json({
                llm_models: llmModels,
                embedding_models: embeddingModels,
                current_settings: currentSettings,
                local_models: localModels
            });
        });

        // Get service status (Ollama/LM Studio availability)
        app.get('/api/service-status', async (req, res) => {
            const status = await this.modelDiscovery.getServiceStatus();
            res.json(status);
        });

        // Update configuration
        app.post('/api/configure', (req, res) => {
            try {
                this.updateConfiguration(req.body);
                res.json({ success: true, message: 'Configuration updated' });
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });

        // Start bot
        app.post('/api/start-bot', async (req, res) => {
            try {
                const result = await this.startBot(req.body);
                res.json({ success: true, ...result });
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });

        // Stop bot
        app.post('/api/stop-bot', async (req, res) => {
            try {
                const botName = req.body.bot_name;
                await this.stopBot(botName);
                res.json({ success: true, message: `Bot ${botName} stopped` });
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });

        // Get bot status
        app.get('/api/bot-status', (req, res) => {
            const agents = [];
            this.activeAgents.forEach((agent, name) => {
                agents.push({
                    name: name,
                    running: agent.running,
                    settings: agent.settings
                });
            });

            res.json({
                running: agents.length > 0,
                agents: agents,
                count: agents.length
            });
        });

        console.log('✅ API endpoints registered');
    }

    getAvailableLLMs() {
        const models = [];

        // Check profiles directory
        const profilesDir = './profiles';
        if (fs.existsSync(profilesDir)) {
            const files = fs.readdirSync(profilesDir);
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    try {
                        const fullPath = `${profilesDir}/${file}`;
                        const profile = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                        models.push({
                            name: profile.name || file.replace('.json', ''),
                            file: fullPath,
                            model: profile.model || 'unknown',
                            type: profile.model_type || 'unknown',
                            requires_api_key: profile.api_key === 'YOUR_API_KEY'
                        });
                    } catch (e) {
                        console.error(`Error reading profile ${file}:`, e.message);
                    }
                }
            });
        }

        // Check for Dudu.json in root
        if (fs.existsSync('./Dudu.json')) {
            try {
                const profile = JSON.parse(fs.readFileSync('./Dudu.json', 'utf8'));
                models.push({
                    name: profile.name || 'Dudu',
                    file: './Dudu.json',
                    model: profile.model || 'unknown',
                    type: profile.model_type || 'unknown',
                    requires_api_key: profile.api_key === 'YOUR_API_KEY'
                });
            } catch (e) {
                console.error('Error reading Dudu.json:', e.message);
            }
        }

        return models;
    }

    async getAvailableEmbeddings() {
        const baseEmbeddings = [
            { name: 'text-embedding-3-small', provider: 'openai' },
            { name: 'text-embedding-3-large', provider: 'openai' },
            { name: 'text-embedding-ada-002', provider: 'openai' },
            { name: 'all-MiniLM-L6-v2', provider: 'local' }
        ];

        // Get dynamic embeddings from Ollama and LM Studio
        const [ollamaEmbeddings, lmstudioEmbeddings] = await Promise.all([
            this.modelDiscovery.getOllamaEmbeddings(),
            this.modelDiscovery.getLMStudioEmbeddings()
        ]);

        return [
            ...baseEmbeddings,
            ...ollamaEmbeddings,
            ...lmstudioEmbeddings
        ];
    }

    getCurrentSettings() {
        return {
            profiles: this.settings.profiles || [],
            minecraft_server: this.settings.host,
            minecraft_port: this.settings.port,
            minecraft_version: this.settings.minecraft_version,
            auth: this.settings.auth
        };
    }

    updateConfiguration(config) {
        if (config.llm_model) {
            this.settings.profiles = [config.llm_model];
        }
        if (config.minecraft_server) {
            this.settings.host = config.minecraft_server;
        }
        if (config.minecraft_port) {
            this.settings.port = parseInt(config.minecraft_port);
        }
        if (config.minecraft_version) {
            this.settings.minecraft_version = config.minecraft_version;
        }
        if (config.auth) {
            this.settings.auth = config.auth;
        }

        this.saveSettings();
    }

    async startBot(config) {
        const botName = config.bot_name || 'Dudu';

        if (this.activeAgents.has(botName)) {
            throw new Error(`Bot '${botName}' is already running`);
        }

        // Prepare bot settings
        const botSettings = { ...this.settings };

        // Update with config
        if (config.minecraft_server) {
            botSettings.host = config.minecraft_server;
        }
        if (config.minecraft_port) {
            botSettings.port = parseInt(config.minecraft_port);
        }
        if (config.minecraft_version) {
            botSettings.minecraft_version = config.minecraft_version;
        }
        if (config.auth) {
            botSettings.auth = config.auth;
        }

        // Handle different model types
        let profile;

        // ALWAYS load Dudu.json as base profile
        const duduProfilePath = './Dudu.json';
        try {
            profile = JSON.parse(fs.readFileSync(duduProfilePath, 'utf8'));
        } catch (error) {
            console.warn(`⚠️  Could not load Dudu.json as base profile: ${error.message}`);
            profile = {}; // Fallback to empty profile
        }

        if (config.model_type === 'ollama' || config.model_type === 'lmstudio') {
            // Use Dudu profile as base, but override model and API settings for local models
            console.log(`📝 Using Dudu.json as base profile, overriding model to: ${config.llm_model}`);

            // Override model settings for Ollama/LM Studio
            profile.model = config.llm_model;
            profile.api = config.model_type;

            if (config.model_type === 'ollama') {
                profile.url = 'http://localhost:11434';
                profile.model_type = 'ollama';
            } else if (config.model_type === 'lmstudio') {
                profile.url = 'http://localhost:1234';
                profile.model_type = 'lmstudio';
            }

            // Override embedding if provided
            if (config.embedding_model) {
                profile.embedding = config.embedding_model;
            }

            profile.name = botName;
        } else {
            // Load profile from file (non-local models)
            const profilePath = config.llm_model || botSettings.profiles[0] || './Dudu.json';
            try {
                profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
                botSettings.profiles = [profilePath];

                // Ensure profile has a name
                if (!profile.name) {
                    profile.name = botName;
                }
            } catch (error) {
                throw new Error(`Failed to load profile from ${profilePath}: ${error.message}`);
            }
        }

        botSettings.profile = profile;

        // Apply bot advanced settings from UI if provided
        if (config.bot_settings) {
            console.log('📝 Applying advanced bot settings from UI...');
            Object.keys(config.bot_settings).forEach(key => {
                botSettings[key] = config.bot_settings[key];
                console.log(`  - ${key}: ${JSON.stringify(config.bot_settings[key])}`);
            });
        }

        // Create agent using Mindcraft
        const modelInfo = config.model_type === 'profile' ? `profile ${config.llm_model}` : `${config.model_type} model ${config.llm_model}`;
        console.log(`🚀 Starting bot '${botName}' with ${modelInfo}...`);
        const result = await Mindcraft.createAgent(botSettings);

        if (result.success) {
            this.activeAgents.set(botName, {
                running: true,
                settings: botSettings,
                model_type: config.model_type,
                model: config.llm_model
            });

            console.log(`✅ Bot '${botName}' started successfully!`);
            return {
                message: 'Bot started successfully',
                bot_name: botName,
                model_type: config.model_type,
                model: config.llm_model
            };
        } else {
            throw new Error(result.error || 'Failed to start bot');
        }
    }

    async stopBot(botName) {
        if (!this.activeAgents.has(botName)) {
            throw new Error(`No bot named '${botName}' is currently running`);
        }

        console.log(`🛑 Stopping bot '${botName}'...`);
        await Mindcraft.stopAgent(botName);

        this.activeAgents.delete(botName);
        console.log(`✅ Bot '${botName}' stopped`);
    }

    saveSettings() {
        const settingsContent = `const settings = ${JSON.stringify(this.settings, null, 4)}

export default settings;
`;
        try {
            fs.writeFileSync('./settings.js', settingsContent);
            console.log('💾 Settings saved');
        } catch (e) {
            console.error('❌ Error saving settings:', e.message);
        }
    }
}

// Start the launcher
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  🤖 DUDU WebUI Control Center');
console.log('═══════════════════════════════════════════════════════');
console.log('');

const launcher = new WebUILauncher();
launcher.start().catch(err => {
    console.error('❌ Failed to start WebUI:', err);
    process.exit(1);
});
