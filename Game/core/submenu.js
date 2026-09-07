/* ============================================================
   submenu.js — PowerLine Challenge Submenu Controller

   Responsibilities:
     1. Load and render cartridges in the cassette row.
     2. Handle cassette selection (mouse + keyboard).
     3. Update screenshot and info panels dynamically.
     4. Enable/disable Start button based on status.
     5. Wire Back button to return to main menu.

   Architecture:
     - IIFE — nothing leaks to global scope.
     - Uses cartridges[] data structure.
     - Keyboard navigation: Arrow keys, A/D, Enter, Escape.
     
   UPDATED: Added Asteroid Command cartridge
   ============================================================ */

(function () {

    /* ----------------------------------------------------------
       DOM REFERENCES  (cached once)
       ---------------------------------------------------------- */
    var cassetteRow    = document.getElementById('cassette-row');
    var screenshot     = document.getElementById('game-screenshot');
    var gameTitle      = document.getElementById('game-title');
    var gameSynopsis   = document.getElementById('game-synopsis');
    var gameStatus     = document.getElementById('game-status');
    var startBtn       = document.getElementById('start-cartridge');
    var backBtn        = document.getElementById('back-to-main');


    /* ----------------------------------------------------------
       STATE
       ---------------------------------------------------------- */
    /* ALL_CARTRIDGES is the full roster; `cartridges` is what the player can
       actually see and what selectedIndex indexes into. They are two arrays on
       purpose: filtering in place would make every index in this file mean
       something different depending on whether Developer Mode happened to be
       on, which is the kind of bug that only shows up for one person. */
    var ALL_CARTRIDGES = [];
    var cartridges = [];
    var selectedIndex = 0;

    /* Laws 0.15/0.16: the Empty Cartridge is Developer Mode content behind
       Ctrl+Shift+B. No such gate existed anywhere in this hub until now. */
    var devUnlocked = false;


    /* ----------------------------------------------------------
       init()
       Single entry point. Loads cartridges and wires events.
       ---------------------------------------------------------- */
    function init() {

        // Load cartridge data
        ALL_CARTRIDGES = loadCartridges();
        cartridges = visibleCartridges();

        // Render cassettes
        renderCassettes();

        // Select first cartridge by default
        if (cartridges.length > 0) {
            selectCartridge(0);
        }

        // Wire buttons
        startBtn.addEventListener('click', handleStart);
        backBtn.addEventListener('click', handleBack);

        // Wire keyboard navigation
        document.addEventListener('keydown', handleKeyboard);
    }


    /* ----------------------------------------------------------
       loadCartridges()
       
       Returns array of cartridge descriptor objects.
       
       To add more cartridges, add them to this array:
       
         {
           id: "your-game-id",
           displayName: "Your Game Name",
           status: "available" or "coming-soon",
           screenshot: "path/to/screenshot.png",
           synopsis: "Description of your game...",
           cassetteImage: "assets/cassettes/your-cassette.png"
         }
       ---------------------------------------------------------- */
    function loadCartridges() {
        return [
            {
                id: "blank-cassette",

                /* 🚨 DEVELOPER-MODE ONLY, AND THIS FLAG IS NOW THE ONLY THING
                   ENFORCING THAT. It used to sit in the ordinary player-facing
                   row, fully playable. ⚠️ It ALSO looked unreachable because
                   the launch path below pointed at a file that does not exist
                   — that was a coincidence, never a safeguard, and fixing the
                   path without adding this flag would have quietly handed every
                   player a Developer-Mode cartridge. Both changed together. */
                dev: true,
                /* CORRECTED. Was "cartridges/blank/index.html", which has not
                   existed since the folder moved up a level. */
                launch: "blank/index.html",
                displayName: "Blank Cassette",
                status: "test",
                screenshot: "assets/images/coming-soon-placeholder.svg",
                synopsis: "Blank cassette used to test core game mechanics with the Empty/Blank dataset.",
                cassetteImage: "assets/images/Cassette_BLANK.png"
            },
            {
                id: "asteroid-command",
                launch: "cartridges/Asteroid Command/files/index.html",
                displayName: "Asteroid Command",
                status: "available",
                screenshot: "cartridges/Asteroid Command/files/assets/Menus/title_screen.png",
                synopsis: "Defend Niagara's three paramedic sectors from asteroid strikes. Master PowerLine commands under pressure as you protect North, South, and East zones using the Command Tower. Incorrect commands and sector losses damage the tower. If the tower falls early, you'll watch the remaining sectors get destroyed one by one.",
                cassetteImage: "assets/images/asteroid-command.png"
            },
            {
                id: "pitstop",
                launch: "cartridges/Pitstop/files/index.html",
                displayName: "Pitstop",
                status: "test",
                screenshot: "assets/images/coming-soon-placeholder.svg",
                synopsis: "Top-down Niagara Region race: post your unit base-to-base with real PowerLine commands — AP → ENP → BSE. Fast, accurate typing is your throttle. Race the laps, work the pit lane, finish first. (Early test build.)",
                cassetteImage: "assets/images/Cassette_BLANK.png"
            },
            {
                /* 🚨 PRE-EXISTING BUG, FIXED HERE. The Aquanaut is fully built
                   — its own 11k-line script.js and design docs — but was never
                   registered, so it could not be launched from this hub at all.
                   Nothing was wrong with the game; it simply was not on the
                   list that the list is built from. */
                id: "aquanaut",
                launch: "cartridges/The Aquanaut/files/index.html",
                displayName: "The Aquanaut",
                status: "available",
                screenshot: "assets/images/coming-soon-placeholder.svg",
                synopsis: "Below the black. Work the dive, read the water, and keep your air honest \u2014 a slower cartridge that punishes rushing.",
                cassetteImage: "assets/images/Cassette_BLANK.png"
            }
        ];
    }


    /* ----------------------------------------------------------
       visibleCartridges()

       What the player may see. Developer-Mode entries are held back
       here, before render \u2014 so they can never be selected, never be
       started, and never be reached by the keyboard, rather than being
       hidden with CSS and still sitting in the array.
       ---------------------------------------------------------- */
    function visibleCartridges() {
        return ALL_CARTRIDGES.filter(function (c) {
            return !c.dev || devUnlocked;
        });
    }


    /* ----------------------------------------------------------
       toggleDeveloperMode()

       The Ctrl+Shift+B gate (Laws 0.15/0.16). Rebuilds the visible
       roster and re-renders, then re-selects from the start so
       selectedIndex can never point past the end of a list that
       just got shorter.
       ---------------------------------------------------------- */
    function toggleDeveloperMode() {
        devUnlocked = !devUnlocked;
        cartridges = visibleCartridges();
        renderCassettes();
        selectCartridge(0);
    }


    /* ----------------------------------------------------------
       renderCassettes()
       
       Populates the cassette row with buttons.
       Each cassette is a clickable div with an image.
       ---------------------------------------------------------- */
    function renderCassettes() {
        cassetteRow.innerHTML = '';

        cartridges.forEach(function (cartridge, index) {

            var item = document.createElement('div');
            item.className = 'cassette-item';
            item.setAttribute('data-index', index);
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');

            var img = document.createElement('img');
            img.src = cartridge.cassetteImage;
            img.alt = cartridge.displayName;
            item.appendChild(img);

            var label = document.createElement('div');
            label.className = 'cassette-label';
            label.textContent = cartridge.displayName;
            item.appendChild(label);

            // Click handler
            item.addEventListener('click', function () {
                selectCartridge(index);
            });

            // Keyboard handler for individual cassette
            item.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectCartridge(index);
                }
            });

            cassetteRow.appendChild(item);
        });
    }


    /* ----------------------------------------------------------
       selectCartridge(index)
       
       1. Remove .selected from all cassettes.
       2. Add .selected to the chosen cassette.
       3. Update screenshot, title, synopsis, status.
       4. Enable/disable Start button.
       5. Scroll cassette into view.
       ---------------------------------------------------------- */
    function selectCartridge(index) {

        // Bounds check
        if (index < 0 || index >= cartridges.length) return;

        selectedIndex = index;
        var cartridge = cartridges[index];

        // Update visual selection
        var allItems = cassetteRow.querySelectorAll('.cassette-item');
        allItems.forEach(function (item) {
            item.classList.remove('selected');
        });
        allItems[index].classList.add('selected');

        // Scroll into view
        allItems[index].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });

        // Update screenshot
        screenshot.src = cartridge.screenshot;
        screenshot.alt = cartridge.displayName + ' screenshot';

        // Update info panel
        gameTitle.textContent = cartridge.displayName;
        gameSynopsis.textContent = cartridge.synopsis;

        // Update status badge
        gameStatus.className = '';
        gameStatus.classList.add(cartridge.status);
        
        if (cartridge.status === 'available') {
            gameStatus.textContent = 'Ready to Play';
        } else if (cartridge.status === 'test') {
            gameStatus.textContent = 'Test Cassette';
        } else if (cartridge.status === 'coming-soon') {
            gameStatus.textContent = 'Coming Soon';
        }

        // Update Start button
        if (cartridge.status === 'available' || cartridge.status === 'test') {
            startBtn.disabled = false;
            startBtn.textContent = '▶  PLAY';
        } else {
            startBtn.disabled = true;
            startBtn.textContent = 'Not Available';
        }
    }


    /* ----------------------------------------------------------
       handleKeyboard(e)
       
       Global keyboard navigation:
         - Left Arrow / A: Previous cassette
         - Right Arrow / D: Next cassette
         - Enter / Space: Start game (if available)
         - Escape: Back to main menu
       ---------------------------------------------------------- */
    function handleKeyboard(e) {

        // Only handle when submenu is visible
        var submenu = document.getElementById('cartridge-submenu');
        if (!submenu.classList.contains('visible')) return;

        /* Ctrl+Shift+B \u2014 Developer Mode (Laws 0.15/0.16). Checked before the
           switch below, because that switch matches on e.key alone and would
           otherwise swallow the B as ordinary navigation input. */
        if (e.ctrlKey && e.shiftKey && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            toggleDeveloperMode();
            return;
        }

        switch (e.key) {

            case 'ArrowLeft':
            case 'a':
            case 'A':
                e.preventDefault();
                selectCartridge(selectedIndex - 1);
                break;

            case 'ArrowRight':
            case 'd':
            case 'D':
                e.preventDefault();
                selectCartridge(selectedIndex + 1);
                break;

            case 'Enter':
            case ' ':
                // Only if not focused on a button
                if (e.target.tagName !== 'BUTTON') {
                    e.preventDefault();
                    handleStart();
                }
                break;

            case 'Escape':
                e.preventDefault();
                handleBack();
                break;
        }
    }


    /* ----------------------------------------------------------
       handleStart()
       
       Fires when Start button is clicked.
       Shows cassette load screen, then navigates after 5 seconds.
       ---------------------------------------------------------- */
    function handleStart() {

        var cartridge = cartridges[selectedIndex];
        
        if (!cartridge || (cartridge.status !== 'available' && cartridge.status !== 'test')) {
            return;
        }

        // Show cassette load screen overlay
        var loadScreen = document.getElementById('cassette-load-screen');
        var loadLine1 = document.getElementById('cassette-load-line-1');
        var loadLine2 = document.getElementById('cassette-load-line-2');
        var loadLine3 = document.getElementById('cassette-load-line-3');
        
        if (loadScreen && loadLine2) {
            // Update load text with cassette name
            var cassetteName = cartridge.displayName.toUpperCase();
            loadLine1.textContent = 'READY.';
            loadLine2.textContent = 'LOAD "' + cassetteName + '",8,1';
            loadLine3.textContent = 'RUN';
            
            // Show overlay
            loadScreen.classList.add('active');
            loadScreen.setAttribute('aria-hidden', 'false');
        }

        // After 5 seconds, navigate to the cassette
        setTimeout(function() {
            /* 🚨 ONE SOURCE OF TRUTH. This used to be an if/else chain of
               hardcoded paths beside the registry, which is how Blank Cassette
               ended up pointing at a file that no longer existed while the
               registry looked perfectly fine, and how The Aquanaut could be
               "added" without becoming launchable. A cartridge now carries its
               own entry point and this reads it. 🚫 Do not put a path back in
               here \u2014 a new cartridge is a registry change, not a code change. */
            if (cartridge.launch) {
                window.location.href = cartridge.launch;
            }
            else {
                // Fallback for unimplemented cassettes
                alert(
                    'LAUNCHING: ' + cartridge.displayName.toUpperCase() + '\n\n' +
                    '(Cassette loading not yet implemented.\n' +
                    ' This will start the game in a future build.)'
                );
            }
        }, 5000);
    }


    /* ----------------------------------------------------------
       handleBack()
       
       Returns to main menu via the exposed function.
       ---------------------------------------------------------- */
    function handleBack() {
        if (window.PLCMainMenu && window.PLCMainMenu.backToMainMenu) {
            window.PLCMainMenu.backToMainMenu();
        }
    }


    /* ----------------------------------------------------------
       GO
       ---------------------------------------------------------- */
    init();

})();
