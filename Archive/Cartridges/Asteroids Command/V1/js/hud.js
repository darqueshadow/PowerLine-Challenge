/**
 * PLC - Asteroid Command
 * HUD MODULE - Heads-Up Display
 * 
 * Handles updating the on-screen displays:
 * - Score
 * - Accuracy
 * - Shields
 */

/**
 * Update all HUD elements
 */
function updateHUD() {
    // Update score
    document.getElementById('score').textContent = score;

    // Calculate and update accuracy
    const accuracy = totalAttempts === 0 ? 100 : Math.round((correctAttempts / totalAttempts) * 100);
    document.getElementById('accuracy').textContent = accuracy + '%';

    // Update shields
    document.getElementById('shields').textContent = shields + '/' + GAME_CONFIG.MAX_SHIELDS;
}
