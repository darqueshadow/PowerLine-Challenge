/**
 * PLC - Asteroid Command
 * PROJECTILES MODULE - Projectile firing system
 * 
 * Handles:
 * - Tower firing at asteroids
 * - Asteroids firing at tower (on wrong answer)
 */

/**
 * Fire a projectile from tower to target
 * @param {HTMLElement} targetElement - The target asteroid element
 */
function fireTowerProjectile(targetElement) {
    const playArea = document.getElementById('playArea');
    const tower = document.querySelector('.tower');

    if (!targetElement || !tower) return;

    const towerRect = tower.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const playRect = playArea.getBoundingClientRect();

    // Calculate positions
    const startX = towerRect.left - playRect.left + (towerRect.width / 2);
    const startY = towerRect.top - playRect.top + (towerRect.height / 4);
    const targetX = targetRect.left - playRect.left + (targetRect.width / 2);
    const targetY = targetRect.top - playRect.top + (targetRect.height / 2);

    // Calculate angle
    const dx = targetX - startX;
    const dy = targetY - startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Create projectile
    const projectile = document.createElement('div');
    projectile.className = 'projectile-tower';
    projectile.style.left = startX + 'px';
    projectile.style.top = startY + 'px';
    projectile.style.transform = `rotate(${angle + 90}deg)`;

    playArea.appendChild(projectile);

    // Animate projectile
    const distance = Math.sqrt(dx * dx + dy * dy);
    const travelTime = Math.min(300, distance / 3);

    requestAnimationFrame(() => {
        projectile.style.transition = `transform ${travelTime}ms linear`;
        projectile.style.transform = `translate(${dx}px, ${dy}px) rotate(${angle + 90}deg)`;
    });

    // Cleanup and explosion
    setTimeout(() => {
        projectile.remove();

        if (targetElement && targetElement.parentElement) {
            targetElement.remove();
        }

        createExplosion(targetX, targetY);
        activeTargets = activeTargets.filter(t => t.element !== targetElement);

    }, travelTime);
}

/**
 * Fire a projectile from target to tower (wrong answer)
 * @param {HTMLElement} targetElement - The attacking asteroid
 */
function fireTargetProjectile(targetElement) {
    const playArea = document.getElementById('playArea');
    const tower = document.querySelector('.tower');

    if (!targetElement || !tower) return;

    const targetRect = targetElement.getBoundingClientRect();
    const towerRect = tower.getBoundingClientRect();
    const playRect = playArea.getBoundingClientRect();

    // Calculate positions
    const startX = targetRect.left - playRect.left + (targetRect.width / 2);
    const startY = targetRect.top - playRect.top + (targetRect.height / 2);
    const targetX = towerRect.left - playRect.left + (towerRect.width / 2);
    const targetY = towerRect.top - playRect.top + (towerRect.height / 4);

    // Calculate angle
    const dx = targetX - startX;
    const dy = targetY - startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Create projectile
    const projectile = document.createElement('div');
    projectile.className = 'projectile-target';
    projectile.style.left = startX + 'px';
    projectile.style.top = startY + 'px';
    projectile.style.transform = `rotate(${angle + 90}deg)`;

    playArea.appendChild(projectile);

    // Animate
    const distance = Math.sqrt(dx * dx + dy * dy);
    const travelTime = Math.min(200, distance / 2.5);

    requestAnimationFrame(() => {
        projectile.style.transition = `transform ${travelTime}ms linear`;
        projectile.style.transform = `translate(${dx}px, ${dy}px) rotate(${angle + 90}deg)`;
    });

    setTimeout(() => {
        projectile.remove();
    }, travelTime);
}
