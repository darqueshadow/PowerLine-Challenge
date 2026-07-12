/**
 * PLC - Asteroid Command
 * CONFIG MODULE - Game configuration and constants
 * 
 * This file contains all game settings in one place.
 * Change values here to adjust difficulty, scoring, etc.
 */

const GAME_CONFIG = {
    // Scoring
    POINTS: {
        CORRECT: 100,
        PERFECT: 50,      // No backspace bonus
        STREAK_5: 250,
        STREAK_10: 500
    },
    
    // Difficulty
    MAX_SHIELDS: 5,
    MAX_SIMULTANEOUS_TARGETS: 5,
    BASE_SPAWN_DELAY: 1800,       // ms between asteroid spawns
    BASE_FALL_DURATION: 10000,    // ms for asteroid to fall
    DIFFICULTY_INCREASE_RATE: 0.03
};

// Export for use in other modules (if using modules)
// For simple script loading, this is available globally
