/**
 * PLC - Asteroid Command
 * DATA MODULE - Challenge/Command data
 * 
 * This contains the powerline commands that players must type.
 * Add more commands here to expand the game!
 */

// PowerLine Commands Dataset
// Format: { challenge: "What player sees", command: "What player types" }
const COMMANDS_DATA = [
    // Basic Commands
    { challenge: "I", command: "1" },
    { challenge: "II", command: "2" },
    { challenge: "III", command: "3" },
    { challenge: "IV", command: "4" },
    { challenge: "V", command: "5" },
    { challenge: "VI", command: "6" },
    { challenge: "VII", command: "7" },
    { challenge: "VIII", command: "8" },
    { challenge: "IX", command: "9" },
    { challenge: "X", command: "10" },

    // Extended Commands (add more as needed)
    { challenge: "XI", command: "11" },
    { challenge: "XII", command: "12" },
    { challenge: "XIII", command: "13" },
    { challenge: "XIV", command: "14" },
    { challenge: "XV", command: "15" },
    { challenge: "XVI", command: "16" },
    { challenge: "XVII", command: "17" },
    { challenge: "XVIII", command: "18" },
    { challenge: "XIX", command: "19" },
    { challenge: "XX", command: "20" }
];

/**
 * Get a random challenge from the dataset
 * @returns {Object} { challenge, command }
 */
function generateChallenge() {
    const index = Math.floor(Math.random() * COMMANDS_DATA.length);
    return { ...COMMANDS_DATA[index] };
}

/**
 * Load an external dataset (for future use)
 * @param {string} url - URL to JSON dataset
 */
async function loadExternalDataset(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        // Merge with existing data or replace
        console.log('External dataset loaded:', data.length, 'commands');
        return data;
    } catch (error) {
        console.error('Failed to load dataset:', error);
        return null;
    }
}
