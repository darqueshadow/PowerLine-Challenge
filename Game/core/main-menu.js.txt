/* ============================================================
   main-menu.js — PowerLine Challenge Main Menu Logic

   Responsibilities:
     1. Wire the cassette tray click zone to trigger submenu.
     2. Trigger CRT flicker transition.
     3. Show submenu after transition completes.

   Architecture:
     - IIFE — nothing leaks to global scope.
     - Exposes goToSubmenu() for external use.
     - Handles transition animation timing.
   ============================================================ */

(function () {

    /* ----------------------------------------------------------
       DOM REFERENCES  (cached once)
       ---------------------------------------------------------- */
    var trayZone       = document.getElementById('tray-click-zone');
    var mainContainer  = document.getElementById('plc-container');
    var crtTransition  = document.getElementById('crt-transition');
    var submenu        = document.getElementById('cartridge-submenu');


    /* ----------------------------------------------------------
       init()
       Single entry point. Wires event listeners.
       ---------------------------------------------------------- */
    function init() {

        // --- Tray: click & keyboard ---
        trayZone.addEventListener('click', goToSubmenu);

        trayZone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goToSubmenu();
            }
        });
    }


    /* ----------------------------------------------------------
       goToSubmenu()
       
       1. Start CRT flicker transition
       2. Hide main menu
       3. After transition, show submenu
       ---------------------------------------------------------- */
    function goToSubmenu() {

        // Trigger CRT flicker
        crtTransition.classList.add('active');
        crtTransition.setAttribute('aria-hidden', 'false');

        // Fade out main menu
        mainContainer.classList.add('hidden');

        // Wait for CRT animation to complete (500ms)
        setTimeout(function () {

            // Remove CRT effect
            crtTransition.classList.remove('active');
            crtTransition.setAttribute('aria-hidden', 'true');

            // Show submenu
            submenu.classList.add('visible');
            submenu.setAttribute('aria-hidden', 'false');

        }, 500);
    }


    /* ----------------------------------------------------------
       backToMainMenu()
       
       Reverse transition: submenu → main menu.
       Exposed globally for submenu.js to use.
       ---------------------------------------------------------- */
    function backToMainMenu() {

        // Trigger CRT flicker
        crtTransition.classList.add('active');
        crtTransition.setAttribute('aria-hidden', 'false');

        // Hide submenu
        submenu.classList.remove('visible');
        submenu.setAttribute('aria-hidden', 'true');

        // Wait for CRT animation to complete
        setTimeout(function () {

            // Remove CRT effect
            crtTransition.classList.remove('active');
            crtTransition.setAttribute('aria-hidden', 'true');

            // Show main menu
            mainContainer.classList.remove('hidden');

        }, 500);
    }


    /* ----------------------------------------------------------
       EXPOSE TO GLOBAL (for submenu.js to call)
       ---------------------------------------------------------- */
    window.PLCMainMenu = {
        backToMainMenu: backToMainMenu
    };


    /* ----------------------------------------------------------
       GO
       ---------------------------------------------------------- */
    init();

})();
