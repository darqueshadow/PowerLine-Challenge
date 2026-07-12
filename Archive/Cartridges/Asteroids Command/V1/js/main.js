/**
 * PLC - Asteroid Command
 * MAIN MODULE - Game loop and initialization
 * 
 * This is the "glue" that ties all modules together.
 * Handles:
 * - Game initialization
 * - Game loop
 * - Starting/stopping/pausing the game
 * - Event listeners
 */

// ================================================
// GAME CONTROL FUNCTIONS
// ================================================

/**
 * Start a new game
 */
function startGame() {
    showGameScreen();
    resetGame();
    startGameLoop();
    document.getElementById('commandInput').focus();
}

/**
 * Start the Asteroid module (from options)
 */
function startAsteroidModule() {
    startGame();
}

/**
 * Start the game loop
 */
function startGameLoop() {
    isPaused = false;

    // Spawn first asteroid
    spawnTarget();

    // Set up spawning interval
    spawnInterval = setInterval(() => {
        if (!isPaused) {
            spawnTarget();
        }
    }, getSpawnDelay());

    // Game loop for cleanup and updates
    gameLoopInterval = setInterval(() => {
        if (!isPaused) {
            cleanup();
        }
    }, 100);
}

/**
 * Stop the game loop
 */
function stopGameLoop() {
    if (spawnInterval) clearInterval(spawnInterval);
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    spawnInterval = null;
    gameLoopInterval = null;
}

/**
 * Pause the game
 */
function pauseGame() {
    if (currentScreen !== 'game') return;
    showPauseOverlay();
}

/**
 * Resume the game
 */
function resumeGame() {
    hidePauseOverlay();
    document.getElementById('commandInput').focus();
}

/**
 * Reset game state
 */
function resetGame() {
    resetGameState();

    // Clear play area
    const playArea = document.getElementById('playArea');
    playArea.querySelectorAll('.target, .challenge-label, .projectile-tower, .projectile-target, .impact-explosion, .impact-ground, .bonus-notification').forEach(el => el.remove());

    // Clear input
    document.getElementById('commandInput').value = '';

    updateHUD();
}

/**
 * End the game
 */
function gameOver() {
    stopGameLoop();
    showGameOverScreen();
}

/**
 * Play again after game over
 */
function playAgain() {
    startGame();
}

// ================================================
// EVENT LISTENERS
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('commandInput');

    // Track backspace for perfect bonus
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            hadBackspace = true;
        }
    });

    // Submit command on Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkCommand();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        // Start screen
        if (currentScreen === 'start') {
            if (e.key === '1') {
                e.preventDefault();
                startGame();
            } else if (e.key === '2') {
                e.preventDefault();
                showOptionsScreen();
            }
        }

        // Options screen
        if (currentScreen === 'options') {
            if (e.key === '1') {
                e.preventDefault();
                startAsteroidModule();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                goToMainMenu();
            }
        }

        // Game screen
        if (currentScreen === 'game' && e.key === 'Escape') {
            e.preventDefault();
            pauseGame();
        }

        // Paused
        if (isPaused && e.key === ' ') {
            e.preventDefault();
            resumeGame();
        }

        // Game over screen
        if (currentScreen === 'gameOver') {
            if (e.key === '1') {
                e.preventDefault();
                playAgain();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                goToMainMenu();
            }
        }
    });

    // Focus input when clicking play area
    document.getElementById('playArea').addEventListener('click', () => {
        if (currentScreen === 'game') {
            input.focus();
        }
    });
});
