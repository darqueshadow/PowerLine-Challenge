/* ============================================================
   main-menu.js — PowerLine Challenge Main Menu Logic

   Responsibilities:
     1. Wire the cassette tray click zone to toggle the
        cartridge selection panel.
     2. Populate #cartridge-list from loadCartridges().
     3. Track which cartridge the player has selected.
     4. Enable/disable and relabel the Start button.
     5. Stub the Start button's launch action.

   Architecture:
     - IIFE — nothing leaks to global scope.
     - loadCartridges() is the only stub.  Replace its return
       value (or swap it for a fetch()) when cartridges exist.
     - renderCartridgeList() already has a slot for the cassette
       image (see the TODO comment); when the blank cassette PNG
       is provided, uncomment that block.
   ============================================================ */

(function () {

    /* ----------------------------------------------------------
       DOM REFERENCES  (cached once)
       ---------------------------------------------------------- */
    var trayZone      = document.getElementById('tray-click-zone');
    var panel         = document.getElementById('cartridge-panel');
    var panelClose    = document.getElementById('panel-close');
    var cartridgeList = document.getElementById('cartridge-list');
    var noCartridges  = document.getElementById('no-cartridges');
    var startBtn      = document.getElementById('start-cartridge');


    /* ----------------------------------------------------------
       STATE
       ---------------------------------------------------------- */
    var selectedCartridge = null;   // cartridge object or null
    var panelOpen         = false;  // is the selection panel visible?


    /* ----------------------------------------------------------
       init()
       Single entry point.  Loads the cartridge list, wires
       every event listener, and sets the initial UI state.
       ---------------------------------------------------------- */
    function init() {

        var cartridges = loadCartridges();

        // Populate the panel (or leave the placeholder visible)
        if (cartridges.length > 0) {
            noCartridges.style.display = 'none';
            renderCartridgeList(cartridges);
        }
        // else: #no-cartridges stays visible (default)

        // --- Tray: click & keyboard ---
        trayZone.addEventListener('click', togglePanel);

        trayZone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePanel();
            }
        });

        // --- Panel close button ---
        panelClose.addEventListener('click', closePanel);

        // --- Click anywhere outside panel + tray → close ---
        document.addEventListener('click', function (e) {
            if (panelOpen &&
                !panel.contains(e.target) &&
                !trayZone.contains(e.target)) {
                closePanel();
            }
        });

        // --- Escape key → close ---
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && panelOpen) {
                closePanel();
            }
        });

        // --- Start / Play button ---
        startBtn.addEventListener('click', handleStart);
    }


    /* ----------------------------------------------------------
       loadCartridges()  —  STUB

       Returns an array of cartridge descriptor objects.
       Currently empty (no cartridges built yet).

       When Asteroid Command is ready, add an entry:

         return [
           {
             id:   "asteroid-command",
             name: "Asteroid Command",
             path: "cartridges/asteroid-command/"
           }
         ];

       For production, replace the whole function body with a
       fetch() to a manifest file:

         fetch("cartridges/manifest.json")
           .then(function (res) { return res.json(); })
           .then(function (list) {
               noCartridges.style.display = 'none';
               renderCartridgeList(list);
           });
         return [];   // initial render stays empty until fetch resolves
       ---------------------------------------------------------- */
    function loadCartridges() {
        return [];
    }


    /* ----------------------------------------------------------
       togglePanel / openPanel / closePanel

       openPanel  — adds .panel-visible to the panel,
                    adds .tray-active to the tray zone (holds
                    its glow), and flips aria attributes.
       closePanel — reverses all of the above.
       togglePanel — calls one or the other based on current state.
       ---------------------------------------------------------- */
    function togglePanel() {
        panelOpen ? closePanel() : openPanel();
    }

    function openPanel() {
        panel.classList.add('panel-visible');
        panel.setAttribute('aria-hidden', 'false');
        trayZone.classList.add('tray-active');
        trayZone.setAttribute('aria-expanded', 'true');
        panelOpen = true;
    }

    function closePanel() {
        panel.classList.remove('panel-visible');
        panel.setAttribute('aria-hidden', 'true');
        trayZone.classList.remove('tray-active');
        trayZone.setAttribute('aria-expanded', 'false');
        panelOpen = false;
    }


    /* ----------------------------------------------------------
       renderCartridgeList(cartridges)

       Clears #cartridge-list and injects one <button> per entry.

       Each button is laid out as a flex row:
         [ cassette image (future) ]  [ label ]

       The cassette image slot is commented out for now.  When
       the blank cassette PNG is provided, uncomment the block
       marked "CASSETTE IMAGE" below and point src at the asset.
       ---------------------------------------------------------- */
    function renderCartridgeList(cartridges) {
        cartridgeList.innerHTML = '';

        cartridges.forEach(function (cartridge) {

            var btn = document.createElement('button');
            btn.className = 'cartridge-btn';
            btn.setAttribute('data-id', cartridge.id);

            // --------------------------------------------------
            // CASSETTE IMAGE  (uncomment when the PNG is ready)
            //
            //   var img = document.createElement('img');
            //   img.className  = 'cassette-img';
            //   img.src        = 'assets/images/cassette-blank.png';
            //   img.alt        = '';
            //   btn.appendChild(img);
            // --------------------------------------------------

            var label = document.createElement('span');
            label.className  = 'cassette-label';
            label.textContent = cartridge.name;
            btn.appendChild(label);

            btn.addEventListener('click', function () {
                selectCartridge(btn, cartridge);
            });

            cartridgeList.appendChild(btn);
        });
    }


    /* ----------------------------------------------------------
       selectCartridge(btn, cartridge)

       1. Strip .selected from every cartridge button.
       2. Add .selected to the clicked button.
       3. Save the cartridge object to state.
       4. Enable the Start button and update its label.
       ---------------------------------------------------------- */
    function selectCartridge(btn, cartridge) {
        // Deselect all
        var allBtns = cartridgeList.querySelectorAll('.cartridge-btn');
        allBtns.forEach(function (b) { b.classList.remove('selected'); });

        // Select this one
        btn.classList.add('selected');
        selectedCartridge = cartridge;

        // Activate play button
        startBtn.disabled    = false;
        startBtn.textContent = '\u25B6  PLAY';   // ▶  PLAY
    }


    /* ----------------------------------------------------------
       handleStart()

       Fires on Start button click.  Currently a stub that
       shows an alert.

       Future: replace the alert with the cartridge loader:
         loadAndLaunchCartridge(selectedCartridge);
       ---------------------------------------------------------- */
    function handleStart() {
        if (!selectedCartridge) return;

        // TODO: replace with actual cartridge launch.
        alert(
            'LAUNCHING: ' + selectedCartridge.name.toUpperCase() + '\n\n' +
            '(Cartridge loading not yet implemented.\n' +
            ' This will start the game in a future build.)'
        );
    }


    /* ----------------------------------------------------------
       GO
       ---------------------------------------------------------- */
    init();

})();
