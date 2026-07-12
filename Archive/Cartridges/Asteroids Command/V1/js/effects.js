/**
 * PLC - Asteroid Command
 * EFFECTS MODULE - Visual effects
 * 
 * Handles:
 * - Explosions
 * - Ground impacts
 * - Bonus notifications
 * - Screen shake
 */

/**
 * Create an explosion effect at a position
 * @param {number} centerX - X position
 * @param {number} centerY - Y position
 */
function createExplosion(centerX, centerY) {
    const playArea = document.getElementById('playArea');
    const explosion = document.createElement('div');
    explosion.className = 'impact-explosion';
    explosion.style.left = centerX + 'px';
    explosion.style.top = centerY + 'px';

    playArea.appendChild(explosion);

    setTimeout(() => explosion.remove(), 600);
}

/**
 * Create ground impact effect when asteroid hits zone
 * @param {HTMLElement} targetElement - The asteroid that hit
 */
function createGroundImpact(targetElement) {
    const playArea = document.getElementById('playArea');
    const targetRect = targetElement.getBoundingClientRect();
    const playRect = playArea.getBoundingClientRect();

    const impactX = targetRect.left - playRect.left + (targetRect.width / 2);

    // Create impact crater
    const impact = document.createElement('div');
    impact.className = 'impact-ground';
    impact.style.left = impactX + 'px';
    impact.style.bottom = '0px';

    playArea.appendChild(impact);

    // Screen shake
    playArea.classList.add('screen-shake');
    setTimeout(() => {
        playArea.classList.remove('screen-shake');
    }, 600);

    setTimeout(() => impact.remove(), 2000);
}

/**
 * Show a bonus notification
 * @param {string} bonusType - Type of bonus (e.g., "PERFECT", "STREAK x5")
 * @param {number} points - Points awarded
 */
function showBonus(bonusType, points) {
    const playArea = document.getElementById('playArea');
    const bonus = document.createElement('div');
    bonus.className = 'bonus-notification';
    bonus.innerHTML = `
        <div style="font-size: 0.8rem; margin-bottom: 3px;">${bonusType}</div>
        <div style="font-size: 1.2rem; font-weight: bold;">+${points}</div>
    `;

    bonus.style.top = `calc(70px + ${currentBonusOffset}px)`;
    bonus.style.right = '30px';

    currentBonusOffset += 50;

    playArea.appendChild(bonus);

    setTimeout(() => {
        bonus.remove();
        currentBonusOffset = Math.max(0, currentBonusOffset - 50);
    }, 1500);
}
