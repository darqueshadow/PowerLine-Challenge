#!/usr/bin/env node
/**
 * Captures game screenshots for the Technical Manual
 * Requires: the game server running on port 8765
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const GAME_URL = 'http://localhost:8765';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickBtn(page, selector) {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
    }, selector);
}

async function waitForVisible(page, selector, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const visible = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && !el.classList.contains('hidden');
        }, selector);
        if (visible) return true;
        await sleep(300);
    }
    console.warn(`  Warning: ${selector} not visible after ${timeout}ms`);
    return false;
}

async function waitForHidden(page, selector, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const hidden = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return true;
            return el.classList.contains('hidden') || window.getComputedStyle(el).display === 'none';
        }, selector);
        if (hidden) return true;
        await sleep(300);
    }
    console.warn(`  Warning: ${selector} not hidden after ${timeout}ms`);
    return false;
}

async function main() {
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: { width: 1280, height: 800 }
    });
    const page = await browser.newPage();

    console.log('Navigating to game...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(1000);

    // ── 1. Boot Screen ──
    console.log('1. Boot screen');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'boot_screen.png') });

    // Press Enter to start boot loading sequence
    await page.keyboard.press('Enter');
    await sleep(500);

    // ── 2. Boot Loading ──
    // Wait for the boot text to appear, then capture mid-boot
    await sleep(2000);
    console.log('2. Boot loading');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'boot_loading.png') });

    // Wait for boot overlay to disappear (boot sequence complete)
    console.log('   Waiting for boot to complete...');
    await waitForHidden(page, '#boot-overlay', 30000);
    await sleep(1000);

    // ── 3. Title Screen (PRESS ANY KEY) ──
    console.log('3. Title screen');
    // Hide holodeck grid to prevent visual artifacts on menu screens
    await page.evaluate(() => {
        const grid = document.getElementById('holodeck-grid');
        if (grid) grid.style.display = 'none';
    });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'title_screen.png') });

    // Press any key to proceed
    await page.keyboard.press('Space');
    await sleep(1500);

    // Check if we're at CAT login or already at menu
    const catVisible = await page.evaluate(() => {
        const cat = document.getElementById('cat-login-overlay');
        return cat && !cat.classList.contains('hidden');
    });

    if (catVisible) {
        // ── 4. CAT Login Terminal ──
        console.log('4. CAT login');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'cat_login.png') });

        // Enter name
        await page.evaluate(() => {
            const inp = document.getElementById('cat-input');
            inp.value = 'DISPATCHER';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        await sleep(800);

        // Enter OASIS number
        await page.evaluate(() => {
            const inp = document.getElementById('cat-input');
            inp.value = '42';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        await sleep(1500);
    }

    // ── 5. Main Menu ──
    console.log('5. Main menu');
    await waitForVisible(page, '#start-btn', 10000);
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'main_menu.png') });

    // ── 6. Scoring & Progression ──
    console.log('6. Scoring page');
    await clickBtn(page, '#scoring-btn');
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'scoring_page.png') });
    await clickBtn(page, '#back-to-menu-btn');
    await sleep(800);

    // ── 7. Settings ──
    console.log('7. Settings page');
    await clickBtn(page, '#settings-btn');
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'settings_page.png') });
    await clickBtn(page, '#settings-back-btn');
    await sleep(800);

    // ── 8. High Scores ──
    console.log('8. High scores page');
    await clickBtn(page, '#highscores-btn');
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'highscores_page.png') });
    await clickBtn(page, '#highscores-back-btn');
    await sleep(800);

    // ── 9. Start the game ──
    console.log('9. Starting game...');
    // Re-show holodeck grid for gameplay (it's part of the game visuals)
    await page.evaluate(() => {
        const grid = document.getElementById('holodeck-grid');
        if (grid) grid.style.display = '';
    });
    await clickBtn(page, '#start-btn');

    // Wait for start overlay to hide
    await waitForHidden(page, '#start-overlay', 10000);
    await sleep(3000); // Let first asteroids spawn

    // ── 10. HUD Layout (early game, clean view) ──
    console.log('10. HUD layout');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'hud_layout.png') });

    // Wait for more asteroids
    await sleep(6000);

    // ── 11. Combat scene ──
    console.log('11. Combat scene');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'combat_scene.png') });

    // Type a partial command
    await page.evaluate(() => {
        const inp = document.getElementById('command-input');
        if (inp) { inp.focus(); inp.value = 'AP 21'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await sleep(500);

    // ── 12. Typing action ──
    console.log('12. Typing action');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'typing_action.png') });

    // Wait for more action
    await sleep(8000);

    // ── 13. Defense zones view ──
    console.log('13. Defense zones');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'defense_zones.png') });

    // Wait for impacts
    await sleep(12000);

    // ── 14. Late game / damage ──
    console.log('14. Late game');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'late_game.png') });

    // ── 15. Pause screen ──
    console.log('15. Pause screen');
    await page.keyboard.press('Escape');
    await sleep(800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'pause_screen.png') });

    // Resume and let game run for damage
    await clickBtn(page, '#resume-btn');
    await sleep(20000);

    // ── 16. Damage state ──
    console.log('16. Damage state');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'damage_state.png') });

    // Wait more for game over
    await sleep(30000);

    // ── 17. Check for game over ──
    const gameOver = await page.evaluate(() => {
        const go = document.getElementById('game-over-overlay');
        return go && !go.classList.contains('hidden');
    });
    if (gameOver) {
        console.log('17. Game over screen');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'game_over.png') });
    } else {
        console.log('17. Game still running, capturing current state');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'extended_game.png') });
    }

    console.log('All screenshots captured!');
    await browser.close();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
