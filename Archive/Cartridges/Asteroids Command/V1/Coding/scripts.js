
function createAsteroid() {
    const asteroid = document.createElement('div');

    // Randomly pick one of the six asteroid classes
    const asteroidClasses = [
        "target-asteroid-1",
        "target-asteroid-2",
        "target-asteroid-3",
        "target-asteroid-4",
        "target-asteroid-5",
        "target-asteroid-6"
    ];
    const randomClass = asteroidClasses[Math.floor(Math.random() * asteroidClasses.length)];

    asteroid.className = `target ${randomClass}`;
    asteroid.style.position = "absolute";
    asteroid.style.top = "0px";
    asteroid.style.left = Math.random() * (window.innerWidth - 80) + "px";

    // Attach command box on top (fixed, no rotation)
    const cmdOverlay = document.createElement('div');
    cmdOverlay.className = "command-box";
    cmdOverlay.innerText = "CMD";
    asteroid.appendChild(cmdOverlay);

    gameContainer.appendChild(asteroid);

    // Animate falling
    let position = 0;
    const fallInterval = setInterval(() => {
        position += 2;
        asteroid.style.top = position + "px";
        if (position > window.innerHeight) {
            clearInterval(fallInterval);
            asteroid.remove();
        }
    }, 16);
}
