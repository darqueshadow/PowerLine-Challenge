/**
 * PLC - Asteroid Command
 * STATE MODULE - Game state variables
 * 
 * All game state is stored here.
 * This makes it easy to reset the game and track what's happening.
 */

// Game state
let currentScreen = 'start';  // 'start', 'options', 'game', 'gameOver'
let isPaused = false;

// Score & stats
let score = 0;
let shields = GAME_CONFIG.MAX_SHIELDS;
let correctAttempts = 0;
let totalAttempts = 0;
let currentStreak = 0;
let perfectHits = 0;
let targetsDestroyed = 0;

// Difficulty
let currentDifficulty = 1.0;

// Active game objects
let activeTargets = [];

// Intervals
let spawnInterval = null;
let gameLoopInterval = null;

// UI helpers
let currentBonusOffset = 0;
let hadBackspace = false;

/**
 * Reset all game state to initial values
 */
function resetGameState() {
    score = 0;
    shields = GAME_CONFIG.MAX_SHIELDS;
    correctAttempts = 0;
    totalAttempts = 0;
    currentStreak = 0;
    perfectHits = 0;
    targetsDestroyed = 0;
    currentDifficulty = 1.0;
    currentBonusOffset = 0;
    hadBackspace = false;
    activeTargets = [];
}
