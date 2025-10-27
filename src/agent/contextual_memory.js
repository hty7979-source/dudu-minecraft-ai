/**
 * Contextual Memory System
 *
 * Erweitert das einfache Memory-System um strukturierte, kontextbezogene Informationen.
 * Speichert nicht nur Orte, sondern auch Equipment-Status, Inventory, Ziele und Wissen.
 *
 * @author Dudu AI Team
 */

// ============================================================================
// CONTEXTUAL MEMORY CLASS
// ============================================================================

export class ContextualMemory {
    constructor() {
        // Orte und Locations
        this.locations = {
            homepoint: null,        // Spawn/Base position [x, y, z]
            mainBase: null,         // Hauptbasis
            storageArea: null,      // Lagerbereich
            workbench: null,        // Crafting-Bereich
            furnace: null,          // Öfen
            farm: null,             // Farm-Bereich
            mine: null,             // Mine-Eingang
            bed: null,              // Bett-Position
            enchantingTable: null,  // Verzauberungstisch
            portal: null,           // Nether-Portal
            custom: {}              // Benutzerdefinierte Orte (legacy compatibility)
        };

        // Equipment-Status
        this.equipment = {
            hasWoodenTools: false,
            hasStoneTools: false,
            hasIronTools: false,
            hasDiamondTools: false,
            hasNetheriteTools: false,
            hasIronArmor: false,
            hasDiamondArmor: false,
            hasNetheriteArmor: false,
            hasShield: false,
            hasElytra: false,
            lastChecked: null
        };

        // Inventory-Status (wichtige Items)
        this.inventory = {
            foodCount: 0,
            torches: 0,
            bed: false,
            crafting_table: false,
            furnace: false,
            essentials: [],  // Liste kritischer Items
            lastChecked: null
        };

        // Weltwissen
        this.worldKnowledge = {
            nearestVillage: null,
            nearestOceanMonument: null,
            nearestStronghold: null,
            resourceLocations: {
                iron: [],
                coal: [],
                diamonds: [],
                wood: []
            },
            exploredChunks: new Set() // Set von Chunk-Koordinaten
        };

        // Ziele und Tasks
        this.goals = {
            shortTerm: [],   // Kurzfristige Ziele (z.B. "get food")
            longTerm: [],    // Langfristige Ziele (z.B. "build enchanting table")
            completed: [],   // Abgeschlossene Ziele
            failed: []       // Fehlgeschlagene Ziele
        };

        // Session-Daten & Death handling
        this.session = {
            deathCount: 0,
            lastDeathLocation: null,
            lastDeathTime: null,
            deathInProgress: false,  // Flag ob gerade Death-Recovery läuft
            totalPlaytime: 0,
            sessionsCount: 0
        };

        // Metadata
        this.metadata = {
            createdAt: Date.now(),
            lastSaved: null,
            version: '2.0.0'
        };
    }

    // ========================================================================
    // LOCATIONS - Erweiterte Orts-Verwaltung
    // ========================================================================

    /**
     * Speichert einen Ort
     */
    rememberPlace(name, x, y, z, category = 'custom') {
        const position = [x, y, z];

        // Vordefinierte Kategorien
        if (this.locations.hasOwnProperty(name)) {
            this.locations[name] = position;
        } else {
            // Custom location
            this.locations.custom[name] = position;
        }

        console.log(`🧠 Memory: Remembered location "${name}" at [${x}, ${y}, ${z}]`);
    }

    /**
     * Ruft einen Ort ab
     */
    recallPlace(name) {
        // Prüfe vordefinierte Locations
        if (this.locations.hasOwnProperty(name) && this.locations[name]) {
            return this.locations[name];
        }

        // Prüfe custom locations
        if (this.locations.custom[name]) {
            return this.locations.custom[name];
        }

        return null;
    }

    /**
     * Setzt den Homepoint (Spawn/Base)
     */
    setHomepoint(x, y, z) {
        this.locations.homepoint = [x, y, z];
        console.log(`🏠 Homepoint set to [${x}, ${y}, ${z}]`);
    }

    /**
     * Gibt den Homepoint zurück
     */
    getHomepoint() {
        return this.locations.homepoint;
    }

    /**
     * Löscht einen Ort
     */
    forgetPlace(name) {
        if (this.locations.hasOwnProperty(name)) {
            this.locations[name] = null;
        } else {
            delete this.locations.custom[name];
        }
        console.log(`🧠 Memory: Forgot location "${name}"`);
    }

    /**
     * Gibt alle gespeicherten Orte zurück
     */
    getAllPlaces() {
        const places = {};

        // Vordefinierte Locations
        for (const [key, value] of Object.entries(this.locations)) {
            if (key !== 'custom' && value !== null) {
                places[key] = value;
            }
        }

        // Custom locations
        for (const [key, value] of Object.entries(this.locations.custom)) {
            places[key] = value;
        }

        return places;
    }

    // ========================================================================
    // EQUIPMENT - Equipment-Status verwalten
    // ========================================================================

    /**
     * Aktualisiert Equipment-Status basierend auf Bot-Inventory
     */
    updateEquipmentStatus(bot) {
        const items = bot.inventory.items();

        // Tools - Check for PICKAXE specifically (needed for progression!)
        // Having just one tool is enough to indicate we have this tier
        // (Bot might have stored other tools or lost them)
        const hasWoodenPickaxe = items.some(i => i.name === 'wooden_pickaxe');
        const hasWoodenAxe = items.some(i => i.name === 'wooden_axe');
        const hasWoodenSword = items.some(i => i.name === 'wooden_sword');
        this.equipment.hasWoodenTools = hasWoodenPickaxe || hasWoodenAxe || hasWoodenSword;

        const hasStonePickaxe = items.some(i => i.name === 'stone_pickaxe');
        const hasStoneAxe = items.some(i => i.name === 'stone_axe');
        const hasStoneSword = items.some(i => i.name === 'stone_sword');
        this.equipment.hasStoneTools = hasStonePickaxe || hasStoneAxe || hasStoneSword;

        const hasIronPickaxe = items.some(i => i.name === 'iron_pickaxe');
        const hasIronAxe = items.some(i => i.name === 'iron_axe');
        const hasIronSword = items.some(i => i.name === 'iron_sword');
        this.equipment.hasIronTools = hasIronPickaxe || hasIronAxe || hasIronSword;

        const hasDiamondPickaxe = items.some(i => i.name === 'diamond_pickaxe');
        const hasDiamondAxe = items.some(i => i.name === 'diamond_axe');
        const hasDiamondSword = items.some(i => i.name === 'diamond_sword');
        this.equipment.hasDiamondTools = hasDiamondPickaxe || hasDiamondAxe || hasDiamondSword;

        const hasNetheritePickaxe = items.some(i => i.name === 'netherite_pickaxe');
        const hasNetheriteAxe = items.some(i => i.name === 'netherite_axe');
        const hasNetheriteSword = items.some(i => i.name === 'netherite_sword');
        this.equipment.hasNetheriteTools = hasNetheritePickaxe || hasNetheriteAxe || hasNetheriteSword;

        // Armor
        this.equipment.hasIronArmor = items.some(i => i.name.includes('iron_') &&
            (i.name.includes('helmet') || i.name.includes('chestplate') ||
             i.name.includes('leggings') || i.name.includes('boots')));
        this.equipment.hasDiamondArmor = items.some(i => i.name.includes('diamond_') &&
            (i.name.includes('helmet') || i.name.includes('chestplate') ||
             i.name.includes('leggings') || i.name.includes('boots')));
        this.equipment.hasNetheriteArmor = items.some(i => i.name.includes('netherite_') &&
            (i.name.includes('helmet') || i.name.includes('chestplate') ||
             i.name.includes('leggings') || i.name.includes('boots')));

        // Special items
        this.equipment.hasShield = items.some(i => i.name === 'shield');
        this.equipment.hasElytra = items.some(i => i.name === 'elytra');

        this.equipment.lastChecked = Date.now();
    }

    /**
     * Gibt bestes verfügbares Tool-Tier zurück
     */
    getBestToolTier() {
        if (this.equipment.hasNetheriteTools) return 'netherite';
        if (this.equipment.hasDiamondTools) return 'diamond';
        if (this.equipment.hasIronTools) return 'iron';
        if (this.equipment.hasStoneTools) return 'stone';
        if (this.equipment.hasWoodenTools) return 'wooden';
        return 'none';
    }

    /**
     * Gibt beste verfügbare Rüstung zurück
     */
    getBestArmorTier() {
        if (this.equipment.hasNetheriteArmor) return 'netherite';
        if (this.equipment.hasDiamondArmor) return 'diamond';
        if (this.equipment.hasIronArmor) return 'iron';
        return 'none';
    }

    // ========================================================================
    // INVENTORY - Inventory-Status verwalten
    // ========================================================================

    /**
     * Aktualisiert Inventory-Status
     */
    updateInventoryStatus(bot) {
        const items = bot.inventory.items();

        // Food count - erweitert um alle essbaren Items inkl. Pilze
        this.inventory.foodCount = items.filter(i =>
            // Gekochtes Essen
            i.name.includes('bread') || i.name.includes('cooked') ||
            i.name.includes('baked') || i.name === 'steak' ||
            // Rohes Fleisch
            i.name.includes('beef') || i.name.includes('porkchop') ||
            i.name.includes('chicken') || i.name.includes('mutton') ||
            i.name.includes('rabbit') ||
            // Fisch
            i.name.includes('fish') || i.name.includes('cod') || i.name.includes('salmon') ||
            // Obst & Gemüse
            i.name.includes('apple') || i.name.includes('carrot') ||
            i.name.includes('potato') || i.name.includes('beetroot') ||
            i.name.includes('melon') || i.name.includes('berry') ||
            // Pilze & Suppen (wichtig für Pilzsteak!)
            i.name.includes('mushroom') || i.name.includes('stew') ||
            i.name.includes('soup') ||
            // Sonstiges
            i.name.includes('golden_apple') || i.name.includes('honey') ||
            i.name === 'cookie' || i.name === 'pumpkin_pie'
        ).reduce((sum, item) => sum + item.count, 0);

        // Torches
        const torches = items.find(i => i.name === 'torch');
        this.inventory.torches = torches ? torches.count : 0;

        // Essentials
        this.inventory.bed = items.some(i => i.name.includes('_bed'));
        this.inventory.crafting_table = items.some(i => i.name === 'crafting_table');
        this.inventory.furnace = items.some(i => i.name === 'furnace');

        // Essential items list
        this.inventory.essentials = items
            .filter(i => this.isEssentialItem(i.name))
            .map(i => ({ name: i.name, count: i.count }));

        this.inventory.lastChecked = Date.now();
    }

    /**
     * Prüft ob ein Item essentiell ist
     */
    isEssentialItem(itemName) {
        const essentials = [
            'crafting_table', 'furnace', 'bed', 'torch',
            'pickaxe', 'axe', 'shovel', 'sword',
            'water_bucket', 'lava_bucket', 'compass'
        ];
        return essentials.some(essential => itemName.includes(essential));
    }

    /**
     * Prüft ob genug Nahrung vorhanden ist
     */
    hasEnoughFood(threshold = 5) {
        return this.inventory.foodCount >= threshold;
    }

    // ========================================================================
    // WORLD KNOWLEDGE - Weltwissen verwalten
    // ========================================================================

    /**
     * Speichert eine Resource-Location
     */
    rememberResourceLocation(resourceType, x, y, z) {
        if (!this.worldKnowledge.resourceLocations[resourceType]) {
            this.worldKnowledge.resourceLocations[resourceType] = [];
        }

        this.worldKnowledge.resourceLocations[resourceType].push([x, y, z]);
        console.log(`🧠 Memory: Found ${resourceType} at [${x}, ${y}, ${z}]`);
    }

    // ========================================================================
    // GOALS - Ziele verwalten
    // ========================================================================

    /**
     * Fügt ein kurzfristiges Ziel hinzu
     */
    addShortTermGoal(goal) {
        if (!this.goals.shortTerm.includes(goal)) {
            this.goals.shortTerm.push(goal);
            console.log(`🎯 Short-term goal added: ${goal}`);
        }
    }

    /**
     * Fügt ein langfristiges Ziel hinzu
     */
    addLongTermGoal(goal) {
        if (!this.goals.longTerm.includes(goal)) {
            this.goals.longTerm.push(goal);
            console.log(`🎯 Long-term goal added: ${goal}`);
        }
    }

    /**
     * Markiert ein Ziel als abgeschlossen
     */
    completeGoal(goal) {
        this.goals.shortTerm = this.goals.shortTerm.filter(g => g !== goal);
        this.goals.longTerm = this.goals.longTerm.filter(g => g !== goal);

        if (!this.goals.completed.includes(goal)) {
            this.goals.completed.push(goal);
            console.log(`✅ Goal completed: ${goal}`);
        }
    }

    /**
     * Gibt aktive Ziele zurück
     */
    getActiveGoals() {
        return [...this.goals.shortTerm, ...this.goals.longTerm];
    }

    // ========================================================================
    // DEATH HANDLING - Tod und Item-Recovery
    // ========================================================================

    /**
     * Registriert einen Tod und startet Recovery-Prozess
     */
    recordDeath(x, y, z) {
        this.session.deathCount++;
        this.session.lastDeathLocation = [x, y, z];
        this.session.lastDeathTime = Date.now();
        this.session.deathInProgress = true;

        console.log(`💀 Death #${this.session.deathCount} recorded at [${x}, ${y}, ${z}]`);
        console.log(`⏰ Items will despawn in 5 minutes (${new Date(this.session.lastDeathTime + 300000).toLocaleTimeString()})`);
    }

    /**
     * Gibt Death-Location zurück
     */
    getDeathLocation() {
        return this.session.lastDeathLocation;
    }

    /**
     * Prüft ob noch Zeit für Item-Recovery ist (Items despawnen nach 5 Minuten)
     */
    canRecoverItems() {
        if (!this.session.lastDeathTime || !this.session.deathInProgress) {
            return false;
        }

        const timeSinceDeath = Date.now() - this.session.lastDeathTime;
        const FIVE_MINUTES = 5 * 60 * 1000;

        return timeSinceDeath < FIVE_MINUTES;
    }

    /**
     * Gibt verbleibende Zeit für Item-Recovery zurück (in Sekunden)
     */
    getRecoveryTimeRemaining() {
        if (!this.session.lastDeathTime) return 0;

        const timeSinceDeath = Date.now() - this.session.lastDeathTime;
        const FIVE_MINUTES = 5 * 60 * 1000;
        const remaining = Math.max(0, FIVE_MINUTES - timeSinceDeath);

        return Math.floor(remaining / 1000);
    }

    /**
     * Markiert Death-Recovery als abgeschlossen
     */
    completeDeathRecovery() {
        this.session.deathInProgress = false;
        console.log(`✅ Death recovery completed`);
    }

    /**
     * Prüft ob gerade ein Death-Recovery läuft
     */
    isDeathRecoveryPending() {
        return this.session.deathInProgress && this.canRecoverItems();
    }

    // ========================================================================
    // SESSION DATA - Session-Daten verwalten
    // ========================================================================

    /**
     * Startet eine neue Session
     */
    startNewSession() {
        this.session.sessionsCount++;
        console.log(`🎮 New session started (#${this.session.sessionsCount})`);
    }

    // ========================================================================
    // SERIALIZATION - Speichern und Laden
    // ========================================================================

    /**
     * Gibt alle Daten als JSON zurück
     */
    getJson() {
        return {
            locations: this.locations,
            equipment: this.equipment,
            inventory: this.inventory,
            worldKnowledge: {
                ...this.worldKnowledge,
                exploredChunks: Array.from(this.worldKnowledge.exploredChunks)
            },
            goals: this.goals,
            session: this.session,
            metadata: {
                ...this.metadata,
                lastSaved: Date.now()
            }
        };
    }

    /**
     * Lädt Daten aus JSON
     */
    loadJson(json) {
        if (!json) return;

        // Deep merge
        if (json.locations) {
            this.locations = { ...this.locations, ...json.locations };
        }
        if (json.equipment) {
            this.equipment = { ...this.equipment, ...json.equipment };
        }
        if (json.inventory) {
            this.inventory = { ...this.inventory, ...json.inventory };
        }
        if (json.worldKnowledge) {
            this.worldKnowledge = {
                ...this.worldKnowledge,
                ...json.worldKnowledge,
                exploredChunks: new Set(json.worldKnowledge.exploredChunks || [])
            };
        }
        if (json.goals) {
            this.goals = { ...this.goals, ...json.goals };
        }
        if (json.session) {
            this.session = { ...this.session, ...json.session };
        }

        console.log(`🧠 Memory loaded (version: ${json.metadata?.version || 'unknown'})`);
    }

    /**
     * Legacy compatibility - getKeys()
     */
    getKeys() {
        const places = this.getAllPlaces();
        return Object.keys(places).join(', ');
    }

    // ========================================================================
    // CONTEXT GENERATION - Für LLM Prompts
    // ========================================================================

    /**
     * Generiert einen Kontext-String für LLM-Prompts
     */
    generateContextString() {
        const lines = [];

        // Equipment
        const toolTier = this.getBestToolTier();
        const armorTier = this.getBestArmorTier();
        lines.push(`Equipment: ${toolTier} tools, ${armorTier !== 'none' ? armorTier + ' armor' : 'no armor'}`);

        // Inventory
        lines.push(`Inventory: ${this.inventory.foodCount} food, ${this.inventory.torches} torches, ` +
                   `bed: ${this.inventory.bed ? 'yes' : 'no'}`);

        // Locations
        if (this.locations.homepoint) {
            lines.push(`Homepoint: [${this.locations.homepoint.join(', ')}]`);
        }

        // Death Recovery
        if (this.isDeathRecoveryPending()) {
            const timeRemaining = this.getRecoveryTimeRemaining();
            lines.push(`⚠️ DEATH RECOVERY: Items at [${this.session.lastDeathLocation.join(', ')}] - ${timeRemaining}s remaining!`);
        }

        // Goals
        if (this.goals.shortTerm.length > 0) {
            lines.push(`Current goals: ${this.goals.shortTerm.join(', ')}`);
        }

        return lines.join('\n');
    }
}
