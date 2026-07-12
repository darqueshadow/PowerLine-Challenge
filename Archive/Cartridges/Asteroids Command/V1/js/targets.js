/**
 * PLC - Asteroid Command
 * TARGETS MODULE - Asteroid spawning and management
 * 
 * Handles:
 * - Spawning asteroids
 * - Collision detection with the danger zone
 * - Target cleanup
 */

/**
 * Get current fall duration based on difficulty
 * @returns {number} Fall duration in milliseconds
 */
function getFallDuration() {
    return GAME_CONFIG.BASE_FALL_DURATION / currentDifficulty;
}

/**
 * Get current spawn delay based on difficulty
 * @returns {number} Spawn delay in milliseconds
 */
function getSpawnDelay() {
    return Math.max(500, GAME_CONFIG.BASE_SPAWN_DELAY / currentDifficulty);
}

/**
 * Increase difficulty after correct answer
 */
function increaseDifficulty() {
    currentDifficulty += GAME_CONFIG.DIFFICULTY_INCREASE_RATE;
}

/**
 * Spawn a new asteroid target
 */
function spawnTarget() {
    const playArea = document.getElementById('playArea');

    // Limit simultaneous targets
    const maxTargets = GAME_CONFIG.MAX_SIMULTANEOUS_TARGETS + Math.floor(correctAttempts / 10);
    if (activeTargets.length >= maxTargets) {
        return;
    }

    // Get challenge data
    const data = generateChallenge();

    // Check for duplicate challenges
    const isDuplicate = activeTargets.some(t =>
        !t.destroyed && t.data.challenge === data.challenge
    );
    if (isDuplicate) {
        return;
    }

    // Create asteroid element
    const target = document.createElement('div');
    const asteroidVariant = Math.floor(Math.random() * 9);
    target.className = `target asteroid-${asteroidVariant} falling`;

    // Random horizontal position
    const minX = 50;
    const maxX = window.innerWidth - 150;
    const randomX = Math.random() * (maxX - minX) + minX;

    target.style.left = randomX + 'px';
    target.style.animationDuration = getFallDuration() + 'ms';

    // Add challenge label
    const label = document.createElement('div');
    label.className = 'challenge-label';
    label.textContent = data.challenge;
    target.appendChild(label);

    playArea.appendChild(target);

    // Create target object
    const targetObj = {
        element: target,
        data: data,
        destroyed: false,
        spawnTime: Date.now()
    };

    activeTargets.push(targetObj);

    // Check for collision with danger zone
    startCollisionCheck(targetObj, target, playArea);
}

/**
 * Start collision checking for a target
 */
function startCollisionCheck(targetObj, target, playArea) {
    const collisionCheckInterval = setInterval(() => {
        if (targetObj.destroyed || !target.parentElement) {
            clearInterval(collisionCheckInterval);
            return;
        }

        const targetRect = target.getBoundingClientRect();
        const playRect = playArea.getBoundingClientRect();
        const targetBottom = playRect.bottom - targetRect.bottom;

        // Zone is 80px high
        if (targetBottom <= 80) {
            clearInterval(collisionCheckInterval);
            handleTargetReachedZone(targetObj);
        }
    }, 50);

    // Cleanup after max fall time
    setTimeout(() => {
        clearInterval(collisionCheckInterval);
    }, getFallDuration() + 100);
}

/**
 * Handle asteroid reaching the danger zone
 */
function handleTargetReachedZone(targetObj) {
    if (targetObj.destroyed) return;

    shields--;
    targetObj.destroyed = true;
    currentStreak = 0;

    createGroundImpact(targetObj.element);

    if (targetObj.element && targetObj.element.parentElement) {
        targetObj.element.remove();
    }

    if (shields <= 0) {
        gameOver();
    }

    updateHUD();
}

/**
 * Clean up destroyed or removed targets
 */
function cleanup() {
    activeTargets = activeTargets.filter(t => {
        if (!t.element.parentElement) return false;
        if (t.destroyed) return false;
        return true;
    });
}
