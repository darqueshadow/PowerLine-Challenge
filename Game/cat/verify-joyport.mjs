/* ===========================================================================
   verify-joyport.mjs — does F9 (and the hub's Port button) actually move the
   C64's joystick port, or does it only move a label?

   RUN
     1.  python -m http.server 8899        (from the (PCL) repo root)
     2.  node verify-joyport.mjs           (from this folder)

   ⚠️ Imports NB's cdp.mjs across repos, exactly as verify-cat.mjs does and for
   the same reason. That is the only coupling between the two repos.

   ===========================================================================
   🚨 WHAT THIS DOES **NOT** PROVE, STATED FIRST SO NOBODY READS IT AS MORE.

   It does not prove a GAME responds to the stick. The emulator does not render
   under this headless harness — measured 2026-09-09: after 30s the machine had
   advanced **4 frames** and the WebGL canvas held **zero non-black pixels**, on
   a run where `EJS_emulator.started` was true and the disk had been fetched.
   ⭐⭐ So a screenshot rig here would photograph a black rectangle and could be
   made to "pass" any claim at all. The last mile — put a disk in, press F9,
   see the stick come alive — is a human at the machine, and the F9 key exists
   precisely so that takes one second.

   WHAT IT DOES PROVE is the whole chain that used to be assumption:
     · `vice_joyport` is a REAL option on this core, read from the core itself;
     · F9 moves it, in capture phase, in BOTH input modes;
     · the CORE is told (gameManager.setVariable), not merely the settings store
       the label is painted from — those two disagreeing is the failure mode
       this rig exists for, because it looks exactly like success;
     · the hub's own message does the same thing as the key.

   ⭐ §CONTROL is an assertion that must FAIL. F8 is pressed the same way and
   must NOT move the port. Without it "the port changed" is consistent with
   "any keypress changes the port", which would be a rig that cannot say no.
   ========================================================================= */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DRIVER = new URL(
  "../../../+Nerva Beacon/Nerva Beacon Main/tools/cdp.mjs",
  import.meta.url
);
if (!existsSync(fileURLToPath(DRIVER))) {
  console.error("\n  Cannot find NB's cdp.mjs at:\n    " + fileURLToPath(DRIVER));
  console.error("  That is the only cross-repo dependency this rig has.\n");
  process.exit(2);
}
const { open } = await import(DRIVER);

/* Any joystick title will do — nothing here depends on the game, only on the
   core being up. Beach-Head is a plain single-side .d64 already in the repo. */
const DISK = encodeURIComponent("http://localhost:8899/Game/disks/Beach-Head.D64");
const URL_EMU = `http://localhost:8899/Game/cat/emulator/index.html?title=BEACHHEAD&d=${DISK}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const ok = (n, cond, d) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
  if (!cond) bad++;
};

const c = await open({ gpu: true, port: 9497, w: 1100, h: 800 });
try {
  await c.goto(URL_EMU);
  /* the core is a WASM build and the 1541 is emulated at speed — poll, and give
     it a real budget rather than a sleep that is right on one machine. */
  let up = false;
  for (let i = 0; i < 90 && !up; i++) {
    await wait(1000);
    up = await c.ev(`!!(window.EJS_emulator && EJS_emulator.gameManager && EJS_emulator.started)`);
  }
  if (!up) { console.log("\n  the core never started — every result below would be void\n"); process.exit(2); }
  await wait(8000);

  /* 🚨 Record what the CORE is told, not what the page says it told it. The
     whole point of setPort() going through changeSettingOption is that the
     settings store and the core cannot drift apart; this is what checks it. */
  await c.ev(`(() => {
    const gm = EJS_emulator.gameManager;
    window.__vars = [];
    if (!gm.__wv) {
      const o = gm.setVariable.bind(gm);
      gm.setVariable = (k, v) => { window.__vars.push([k, v]); return o(k, v); };
      gm.__wv = 1;
    }
    return 1;
  })()`);

  const port = () => c.ev(`EJS_emulator.allSettings.vice_joyport`);
  const tapF9 = async () => {
    await c.key("keyDown", "F9", "F9", 120); await wait(120);
    await c.key("keyUp",   "F9", "F9", 120); await wait(500);
  };

  console.log("\n  § the option is real\n");
  ok("the core starts on its own default, Port 2", (await port()) === "2", `got ${await port()}`);
  /* 🚨 getCoreOptions() traps with "memory access out of bounds" intermittently
     once the game is running, so it is retried. A single throw is NOT evidence
     that the core has no options — concluding that once nearly retired a
     working option. And read the WHOLE list: vice_joyport sorts after 25 other
     joy-ish names, so a capped filter shows everything except the one you want. */
  ok("vice_joyport is a real option on this core",
     await c.ev(`(() => {
       let raw = null;
       for (let i = 0; i < 8 && !raw; i++) { try { raw = EJS_emulator.gameManager.getCoreOptions(); } catch (e) { raw = null; } }
       return !!raw && String(raw).split('\\n').some(l => l.indexOf('vice_joyport|') === 0);
     })()`),
     "read from the core, retried past its intermittent trap");

  console.log("\n  § F9 moves it, and moves the CORE\n");
  await tapF9();
  ok("F9 moves the port 2 -> 1", (await port()) === "1", `got ${await port()}`);
  ok("and the CORE was told, not just the settings store",
     await c.ev(`window.__vars.some(v => v[0] === 'vice_joyport' && v[1] === '1')`),
     JSON.stringify(await c.ev(`window.__vars.filter(v => v[0] === 'vice_joyport')`)));
  await tapF9();
  ok("F9 again moves it back 1 -> 2", (await port()) === "2", `got ${await port()}`);

  console.log("\n  § the hub's button takes the same path\n");
  await c.ev(`window.postMessage({ type: 'cat:port' }, '*')`);
  await wait(600);
  ok('the hub message "cat:port" flips it too', (await port()) === "1", `got ${await port()}`);

  console.log("\n  § and it works in the mode you actually need it in\n");
  /* 🚨 THIS IS THE ONE THAT JUSTIFIES THE CAPTURE PHASE. You reach for the port
     switch because the stick is dead — and in keyboard mode every keystroke is
     being handed to the C64, so a bubble-phase handler would be racing the
     machine for its own key and losing it strands you. */
  await c.ev(`window.postMessage({ type: 'cat:input' }, '*')`);
  await wait(600);
  const kbd = await c.ev(`EJS_emulator.getSettingValue('keyboardInput')`);
  await tapF9();
  ok("F9 still switches while the C64 owns the keyboard",
     (await port()) === "2", `keyboardInput=${kbd}, port=${await port()}`);

  console.log("\n  § CONTROL — this one must be able to fail\n");
  const before = await port();
  await c.key("keyDown", "F8", "F8", 119); await wait(120);
  await c.key("keyUp",   "F8", "F8", 119); await wait(500);
  ok("[control] F8 does NOT switch ports — F9 is doing this, not any keypress",
     (await port()) === before, `${before} -> ${await port()}`);
} finally { c.close(); }

console.log(`\n  ${bad} failed\n`);
process.exit(bad ? 1 : 0);
