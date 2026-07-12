╔══════════════════════════════════════════════════════════════╗
║         POWERLINE CHALLENGE - SUBMENU SYSTEM v1.0            ║
║                    Complete Build Package                     ║
╚══════════════════════════════════════════════════════════════╝

WHAT'S INCLUDED
═══════════════
✓ Complete HTML structure with main menu and submenu
✓ Comprehensive CSS with CRT transition effects
✓ JavaScript controllers for both screens
✓ CRT flicker transition animation (500ms)
✓ Cassette-based game selection interface
✓ Keyboard and mouse navigation
✓ Dynamic screenshot and info panels
✓ Placeholder assets ready to use


FILES IN THIS PACKAGE
═════════════════════
Core Files:
  • index.html                   - Main structure
  • main-menu.css                - All styles
  • main-menu.js                 - Main menu controller
  • submenu.js                   - Submenu controller
  • SETUP_INSTRUCTIONS.txt       - Detailed setup guide
  • README.txt                   - This file

Assets:
  • Cassette_BLANK.png       - Blank cassette
  • Cassette_Deck.png        - Cassette deck
  • assets/screenshots/coming-soon-placeholder.svg    - Screenshot placeholder

Note: You'll need to add your Main_Menu.png file (the computer illustration)


QUICK START
═══════════
1. Extract all files maintaining the folder structure
2. Add your Main_Menu.png to the root directory
3. Open index.html in a browser
4. Click the cassette tray zone (or press Enter)
5. See the CRT transition and submenu appear


FOLDER STRUCTURE
════════════════
PowerLineChallenge/
├── index.html
├── main-menu.css
├── main-menu.js
├── submenu.js
├── Main_Menu.png                                    ← YOU NEED TO ADD THIS
├── Cassette_BLANK.png
├── Cassette_Deck.png
└── assets/
    └── screenshots/
        └── coming-soon-placeholder.svg


HOW IT WORKS
════════════
Main Menu:
  • Shows your computer illustration
  • Cassette tray zone pulses with green glow
  • Click or press Enter to browse games

CRT Transition:
  • Animated static/flicker effect (500ms)
  • Authentic retro screen switching
  • Used for both directions (main ↔ sub)

Submenu:
  • Horizontal scrolling cassette row
  • Screenshot panel (left)
  • Game info panel (right)
  • Cassette deck at bottom
  • Start and Back buttons


NAVIGATION CONTROLS
═══════════════════
Main Menu:
  • Click tray zone → Go to submenu
  • Enter key → Go to submenu

Submenu:
  • Left Arrow / A → Previous cassette
  • Right Arrow / D → Next cassette
  • Enter / Space → Start game (if available)
  • Escape → Back to main menu
  • Click cassettes → Select them
  • Click Back button → Return to main menu


CURRENT STATE
═════════════
✓ One blank cartridge visible
✓ Status: "Coming Soon" (Start button disabled)
✓ Fully functional navigation
✓ CRT transitions working
✓ Green phosphor CRT aesthetic (#39ff14)
✓ Ready to add more cartridges


ADDING A NEW CARTRIDGE
══════════════════════
To add "Asteroid Command" or any game:

1. Open submenu.js
2. Find the loadCartridges() function
3. Add a new object to the array:

   {
     id: "asteroid-command",
     displayName: "Asteroid Command",
     status: "available",    // Change this to enable Start button
     screenshot: "assets/screenshots/asteroid-command.png",
     synopsis: "Space-themed PLC training mission with falling asteroids.",
     cassetteImage: "assets/cassettes/asteroid-cassette.png"
   }

4. Create your assets:
   • Custom cassette PNG (or use blank temporarily)
   • Screenshot PNG


CUSTOMIZATION
═════════════
Colors:
  • Primary green: #39ff14
  • Secondary green: #33ff33
  • Dim green: #2a7a2a
  • Background: #000
  • Change in main-menu.css

Transition Speed:
  • Current: 500ms
  • Adjust in main-menu.js (setTimeout values)
  • Adjust in main-menu.css (@keyframes crt-flicker)

Cassette Size:
  • Current: 200px width
  • Change .cassette-item img width in main-menu.css


INTEGRATION WITH LAWS & OVERVIEW
═════════════════════════════════
✓ Follows modular development approach
✓ Separate files (no embedded code)
✓ Does not modify core game logic
✓ Plugs cleanly into existing system
✓ Uses consistent naming conventions
✓ Ready for Arcade Hub integration


NEXT STEPS
══════════
1. Test the interface in your browser
2. Verify all transitions work smoothly
3. Add your Main_Menu.png file
4. When ready, build your first game cartridge
5. Update cartridge status to "available"
6. Create custom cassette art for each game


TROUBLESHOOTING
═══════════════
Issue: Main menu image not showing
Fix: Add Main_Menu.png to root directory

Issue: Blank cassette not showing
Fix: Verify Cassette_BLANK.png is in root

Issue: Cassette deck not showing
Fix: Verify Cassette_Deck.png is in root

Issue: Screenshot placeholder not showing
Fix: Verify assets/screenshots/ folder structure exists

Issue: CRT transition not working
Fix: Check browser console for JavaScript errors


TECHNICAL NOTES
═══════════════
• Pure vanilla JavaScript (no libraries)
• IIFE pattern prevents global pollution
• Semantic HTML with ARIA attributes
• CSS Grid and Flexbox layout
• Smooth scroll behavior for cassette row
• Window.PLCMainMenu exposed for inter-module communication
• Keyboard navigation follows accessibility standards


COMPATIBILITY
═════════════
✓ Modern browsers (Chrome, Firefox, Safari, Edge)
✓ Responsive to different screen sizes
✓ Works without internet connection
✓ No external dependencies
✓ Local file system compatible


VERSION HISTORY
═══════════════
v1.0 - Initial submenu system
  • CRT flicker transition
  • Cassette-based selection
  • Screenshot and info panels
  • Keyboard and mouse navigation
  • Blank cartridge placeholder
  • Integration with main menu


CREDITS
═══════
Designed for: PowerLine Challenge Training System
Architecture: Modular cartridge system
Aesthetic: Retro green phosphor CRT
Built by: Claude (Anthropic)
For: Andrew (Ambulance Dispatcher, Niagara Falls, ON)


═══════════════════════════════════════════════════════════════
Ready to test! Open index.html and click the cassette tray.
═══════════════════════════════════════════════════════════════
