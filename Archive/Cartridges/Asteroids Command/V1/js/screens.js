/**
 * PLC - Asteroid Command
 * SCREENS MODULE - Screen management
 * 
 * Handles showing/hiding different game screens:
 * - Start screen
 * - Options screen  
 * - Game screen
 * - Pause overlay
 * - Game over screen
 */

/**
 * Show the start screen
 */
function showStartScreen() {
    currentScreen = 'start';
    document.getElementById('startScreen').style.display = 'flex';
    document.getElementById('optionsScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('pauseOverlay').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
}

/**
 * Show the options screen
 */
function showOptionsScreen() {
    currentScreen = 'options';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('optionsScreen').style.display = 'flex';
}

/**
 * Show the game screen and start playing
 */
function showGameScreen() {
    currentScreen = 'game';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('optionsScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('pauseOverlay').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
}

/**
 * Show pause overlay
 */
function showPauseOverlay() {
    isPaused = true;
    document.getElementById('pauseOverlay').style.display = 'flex';
}

/**
 * Hide pause overlay
 */
function hidePauseOverlay() {
    isPaused = false;
    document.getElementById('pauseOverlay').style.display = 'none';
}

/**
 * Show game over screen with final stats
 */
function showGameOverScreen() {
    currentScreen = 'gameOver';

    // Update final stats display
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalTargets').textContent = targetsDestroyed;
    document.getElementById('finalPerfect').textContent = perfectHits;

    const accuracy = totalAttempts === 0 ? 100 : Math.round((correctAttempts / totalAttempts) * 100);
    document.getElementById('finalAccuracy').textContent = accuracy + '%';

    document.getElementById('gameOverScreen').style.display = 'flex';
}

/**
 * Go back to main menu
 */
function goToMainMenu() {
    stopGameLoop();
    resetGame();
    showStartScreen();
}
