/**
 * PLC - Asteroid Command
 * COMMANDS MODULE - Input processing
 * 
 * Handles:
 * - Player input validation
 * - Correct command handling
 * - Incorrect command handling
 * - Scoring and streaks
 */

/**
 * Check the player's command against active targets
 */
function checkCommand() {
    const input = document.getElementById('commandInput');
    const userCommand = input.value.trim().toUpperCase();

    if (!userCommand) return;

    totalAttempts++;

    // Find matching target
    const matchingTarget = activeTargets.find(t =>
        !t.destroyed && t.data.command.toUpperCase() === userCommand
    );

    if (matchingTarget) {
        handleCorrectCommand(matchingTarget);
    } else {
        handleIncorrectCommand();
    }

    input.value = '';
    hadBackspace = false;
    updateHUD();
}

/**
 * Handle a correct command
 * @param {Object} targetObj - The matched target object
 */
function handleCorrectCommand(targetObj) {
    correctAttempts++;
    currentStreak++;
    targetsDestroyed++;
    targetObj.destroyed = true;

    // Base points
    score += GAME_CONFIG.POINTS.CORRECT;

    // Perfect bonus (no backspace)
    if (!hadBackspace) {
        score += GAME_CONFIG.POINTS.PERFECT;
        perfectHits++;
        showBonus('PERFECT', GAME_CONFIG.POINTS.PERFECT);
    }

    // Streak bonuses
    if (currentStreak === 5) {
        score += GAME_CONFIG.POINTS.STREAK_5;
        showBonus('STREAK x5', GAME_CONFIG.POINTS.STREAK_5);
    } else if (currentStreak === 10) {
        score += GAME_CONFIG.POINTS.STREAK_10;
        showBonus('STREAK x10', GAME_CONFIG.POINTS.STREAK_10);
    } else if (currentStreak > 10 && currentStreak % 10 === 0) {
        const bonusPoints = GAME_CONFIG.POINTS.STREAK_10 * (currentStreak / 10);
        score += bonusPoints;
        showBonus(`STREAK x${currentStreak}`, bonusPoints);
    }

    // Fire at target
    fireTowerProjectile(targetObj.element);
    increaseDifficulty();
}

/**
 * Handle an incorrect command
 */
function handleIncorrectCommand() {
    currentStreak = 0;

    // Find oldest target
    const oldestTarget = activeTargets.find(t => !t.destroyed);

    if (oldestTarget) {
        shields--;
        oldestTarget.destroyed = true;
        fireTargetProjectile(oldestTarget.element);

        setTimeout(() => {
            if (oldestTarget.element && oldestTarget.element.parentElement) {
                oldestTarget.element.remove();
            }
        }, 300);

        if (shields <= 0) {
            gameOver();
        }
    }
}
