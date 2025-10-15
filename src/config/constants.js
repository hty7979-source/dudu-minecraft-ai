/**
 * @fileoverview Central configuration constants for Dudu Minecraft AI
 * Contains all magic numbers and configuration values used throughout the application
 */

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

export const TIMING = {
    // Spawn and initialization timeouts
    SPAWN_TIMEOUT_MS: 30000, // 30 seconds before forcing exit if bot doesn't spawn
    SPAWN_WAIT_MS: 1000,     // Wait time after spawn before initializing stats
    PLAYER_CHECK_DELAY_MS: 10000, // Delay before checking if all required players are present

    // Update intervals
    UPDATE_INTERVAL_MS: 300,  // Main bot update loop interval
    IDLE_RESUME_DELAY_MS: 1000, // Delay before resuming action after idle

    // Code execution
    CODE_TIMEOUT_DEFAULT_MINS: -1, // -1 for no timeout

    // LLM/LMStudio connection
    LLM_STARTUP_WAIT_MS: 3000, // Initial wait before first LLM connection attempt
    LLM_HEALTH_CHECK_TIMEOUT_MS: 2000, // Timeout for health check requests
    LLM_MAX_STARTUP_RETRIES: 5, // Maximum retries when connecting to LLM on startup
    LLM_RETRY_DELAY_MS: 1500, // Base delay between retries (will use exponential backoff)
};

// =============================================================================
// HISTORY & CONTEXT LIMITS
// =============================================================================

export const CONTEXT = {
    MAX_MESSAGES_DEFAULT: 15,        // Default max number of messages in context
    NUM_EXAMPLES_DEFAULT: 2,         // Default number of examples to give to model
    MAX_COMMANDS_DEFAULT: -1,        // -1 for no limit on consecutive commands
    RELEVANT_DOCS_COUNT_DEFAULT: 5,  // Number of relevant docs to select, -1 for all
    MAX_BEHAVIOR_LOG_LENGTH: 500,    // Max length of behavior log in characters
};

// =============================================================================
// BOT BEHAVIOR CONSTANTS
// =============================================================================

export const BOT_BEHAVIOR = {
    // Auto-eat configuration
    AUTO_EAT: {
        PRIORITY: 'foodPoints',
        START_AT: 14, // Start eating when food level drops below this
        BANNED_FOOD: ['rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish', 'chicken'],
    },

    // Block placement
    BLOCK_PLACE_DELAY_MS: 0, // Delay between placing blocks (anti-cheat protection)
};

// =============================================================================
// COMBAT MODE CONSTANTS
// =============================================================================

export const COMBAT = {
    CRITICAL_HEALTH: 5,      // Health level considered critical
    SAFE_HEALTH: 15,         // Health level considered safe
    FLEE_MESSAGE_THRESHOLD: 5, // Health below which flee message is sent
};

// =============================================================================
// CODE GENERATION CONSTANTS
// =============================================================================

export const CODE_GENERATION = {
    MAX_ATTEMPTS: 5,         // Maximum attempts to generate working code
    MAX_NO_CODE_ATTEMPTS: 3, // Maximum attempts when no code is generated
};

// =============================================================================
// SERVER & NETWORKING
// =============================================================================

export const NETWORK = {
    DEFAULT_HOST: '127.0.0.1',
    DEFAULT_PORT: 25565,
    DEFAULT_MINDSERVER_PORT: 8080,
    MINECRAFT_VERSION_AUTO: 'auto',
};

// =============================================================================
// FILE SYSTEM PATHS
// =============================================================================

export const PATHS = {
    BOT_ACTION_CODE_DIR: '/bots/',
    PROFILES_DIR: './profiles/',
    SCHEMATICS_DIR: './schematics/',
};

// =============================================================================
// COMMAND CONFIGURATION
// =============================================================================

export const COMMANDS = {
    // Unblockable commands that cannot be disabled
    UNBLOCKABLE: ['!stop', '!stats', '!inventory', '!goal'],

    // Command syntax display modes
    SYNTAX_DISPLAY: {
        FULL: 'full',
        SHORTENED: 'shortened',
        NONE: 'none',
    },
};

// =============================================================================
// AUTHENTICATION
// =============================================================================

export const AUTH = {
    OFFLINE: 'offline',
    MICROSOFT: 'microsoft',
};

// =============================================================================
// TIME OF DAY VALUES
// =============================================================================

export const TIME_OF_DAY = {
    SUNRISE: 0,
    NOON: 6000,
    SUNSET: 12000,
    MIDNIGHT: 18000,
};

// =============================================================================
// EXIT CODES
// =============================================================================

export const EXIT_CODES = {
    SUCCESS: 0,
    ERROR: 1,
    RESTART: 4,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get a configuration value with fallback
 * @param {*} value - The configuration value to check
 * @param {*} defaultValue - The default value to use if value is undefined
 * @returns {*} The value or default
 */
export function getConfigValue(value, defaultValue) {
    return value !== undefined ? value : defaultValue;
}

/**
 * Validate if a number is within a given range
 * @param {number} value - Value to check
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} True if value is in range
 */
export function isInRange(value, min, max) {
    return value >= min && value <= max;
}
