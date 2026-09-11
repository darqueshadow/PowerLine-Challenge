/* ===========================================================================
   verify-cat.mjs — does the CAT hub actually do what the core spec says?

   RUN
     1.  python -m http.server 8899        (from the (PCL) repo root)
     2.  node verify-cat.mjs               (from this folder)

   🚫 file:// is blocked for the driver, so it must be served. The hub itself
   runs fine from file:// inside the Fang Rock shell — that is a constraint of
   the RIG, not of the thing being tested.

   ⚠️ THIS IMPORTS NB'S DRIVER ACROSS REPOS, ON PURPOSE. `cdp.mjs` is a
   dependency-free headless-Chrome harness that already carries ~90 measured
   traps, and the standing rule where it lives is "use this, do not rebuild
   it". The path below is the only coupling between the two repos; if it
   breaks, the rig says so in one line rather than silently testing nothing.

   ⭐ §J is a CONTROL that must fail. An assertion nobody has watched go red is
   not an assertion, and a rig that cannot say no is worth nothing when it
   says yes.
   ========================================================================= */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DRIVER = new URL(
  "../../../+Nerva Beacon/Nerva Beacon Main/tools/cdp.mjs",
  import.meta.url
);
if (!existsSync(fileURLToPath(DRIVER))) {
  console.error("\n  Cannot find NB's cdp.mjs at:\n    " + fileURLToPath(DRIVER));
  console.error("  That is the only cross-repo dependency this rig has.");
  console.error("  Fix the path above, or run the rig from a checkout that has both.\n");
  process.exit(2);
}
const { open } = await import(DRIVER);

const URL_HUB = "http://localhost:8899/Game/cat/index.html";

/* cdp.mjs's key() is key(type, key, code, keyCode, modifiers) and the last one
   is CDP's own bitmask, not an options object: Alt 1, Ctrl 2, Meta 4, Shift 8.
   ⚠️ The browser derives e.ctrlKey/e.shiftKey from THIS, never from the case of
   the character - so a plain dispatch of "B" reaches a Ctrl+Shift handler as a
   bare keypress and the gate silently never fires. */
const CTRL_SHIFT = 2 | 8;

let pass = 0, fail = 0;
const fails = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function ok(cond, label) {
  cond ? pass++ : (fail++, fails.push(label));
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`);
  return cond;
}
function eq(got, want, label) {
  return ok(String(got) === String(want), `${label}   [got ${got}]`);
}
const section = (s) => console.log(`\n${s}`);

/* 🚨🚨 POLL, DO NOT SLEEP — and this is not tidiness, it is four of the eight
   failures this rig carried into 2026-09-11.

   The launch assertions used `await wait(2400)`, under a comment reading "the
   load theatre is ~1.9s". Measured 2026-09-11 by polling instead: the same
   launch completes at **4800ms**. Nothing about the hub broke — the disk
   library grew to 55 and the scan it runs on boot now competes with the load
   theatre — but every launch assertion went red, and each cascaded into the two
   after it ("it launched Asteroid Command [null]", "and launched its real entry
   point").
   ⭐⭐ A FIXED SLEEP ENCODES TODAY'S TIMING AS AN ASSERTION ABOUT CORRECTNESS,
   so the rig fails when the machine gets slower rather than when the behaviour
   gets wrong. That is the opposite of what it is for.

   🚫 The fix is NOT 2400 -> 6000; that buys time until the library grows again.
   `until()` returns the moment the condition holds, so on a fast machine it is
   also quicker than the sleep it replaces.
   ⚠️ It still fails LOUDLY on timeout — a condition that never comes true has
   to be a red line, never a silent pass. It returns -1, and every caller tests
   for it. */
/* prints as a duration when it succeeded and as the word TIMED OUT when it did
   not — `[started in -1ms]` reads like a measurement, which is the last thing a
   failure line should do. */
const took = (t) => (t < 0 ? "TIMED OUT" : `started in ${t}ms`);
async function until(fn, ms = 20000, every = 200) {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return Date.now() - t0;
    if (Date.now() - t0 > ms) return -1;
    await wait(every);
  }
}

const c = await open({ gpu: true, w: 1280, h: 860 });
try {
  await c.goto(URL_HUB);
  await wait(1100);                       // boot banner + warm-up

  /* --- control: is this page actually alive? --------------------------- */
  section("[control] the page is rendering");
  ok((await c.ev("document.visibilityState")) === "visible", "[control] page is visible");
  ok(!!(await c.ev("typeof window.__cat")) && (await c.ev("typeof window.__cat")) === "object",
     "[control] the hub's tooling surface exists");

  /* --- A. boot --------------------------------------------------------- */
  section("A. boot screen");
  const boot = String(await c.ev("__cat.text()"));
  ok(/tommodore cat/i.test(boot), "banner names the TOMMODORE CAT");
  ok(/ready\./i.test(boot), "the machine reaches ready.");
  /* 🚫 Trademark check. The tribute is the look; the words are not reproduced. */
  ok(!/commodore\s*64/i.test(boot) && !/\bbasic v2\b/i.test(boot),
     "no literal Commodore / BASIC V2 banner text");

  /* --- B. the disk box ------------------------------------------------- */
  section("B. the disk box, and what it deliberately does not show");
  /* 🚨🚨 BY KEY AND BY RECONCILIATION, NEVER BY INDEX OR BY A LITERAL COUNT.
     This block read `eq(visible, "asteroid+aquanaut+pitstop")` and
     `eq(.disk.length, 3)` until 2026-09-11, which was true on the day it was
     written and false the moment `library.js` started discovering disks: the
     box holds **58** now (3 cartridges + 55 found), and all three assertions
     went red together while nothing at all was wrong.
     ⭐⭐ A count cannot tell "55 disks were added on purpose" from "the
     cartridges vanished" — it fails identically for both, so the repair always
     LOOKS like bumping the number, which is how a rig stops asserting anything.
     ⭐ So: name the cartridges that must be there, name the one that must not,
     and make the DOM reconcile against the MODEL rather than against a
     constant. The cartridge roster is a fact about `disks.js`; the total is a
     fact about a folder the user fills. Only the first belongs in a literal. */
  const visible = String(await c.ev("__cat.visible().join('+')"));
  const seen = visible.split("+");
  const CARTRIDGES = ["asteroid", "aquanaut", "pitstop"];
  const missing = CARTRIDGES.filter((id) => !seen.includes(id));
  ok(missing.length === 0,
     `all ${CARTRIDGES.length} player cartridges are in the box   [missing: ${missing.join(", ") || "none"}]`);
  ok(!seen.includes("blank"), "Blank Cassette is NOT in the player-facing box");

  /* the DOM and the model must agree — that is the check a literal was
     standing in for, and unlike a literal it holds at any library size. */
  const nDisk = Number(await c.ev("document.querySelectorAll('.disk').length"));
  const nSleeve = Number(await c.ev("document.querySelectorAll('.sleeve').length"));
  eq(nDisk, seen.length, "every visible disk is rendered as an object");
  eq(nSleeve, nDisk, "each disk has a sleeve (not a list row)");
  console.log(`        (box holds ${seen.length}: ${CARTRIDGES.length} cartridges + ${seen.length - CARTRIDGES.length} found)`);

  /* 🚨 THE BUG THIS EXISTS TO PROVE FIXED. The Aquanaut is built but was
     never registered, so it could not be launched from the hub at all. */
  ok(String(visible).includes("aquanaut"), "The Aquanaut is reachable (was unregistered)");

  /* ⭐ ADDED AFTER LOOKING AT A SCREENSHOT, not after a failing assertion.
     Every check above was green while Pitstop sat 8px higher than the other
     two, because it carries a TEST badge: a <button> centres its content, the
     flex row stretches all disks to the tallest, and the shorter two got
     pushed down. Nothing in a count could see it. Baselines, so a badge on one
     disk can never move another again. */
  const tops = String(await c.ev(
    "Array.prototype.map.call(document.querySelectorAll('.sleeve'), function(s){" +
    "return Math.round(s.getBoundingClientRect().top);}).join('+')"));
  ok(new Set(tops.split("+")).size === 1, `all disks share a top baseline   [${tops}]`);
  const names = String(await c.ev(
    "Array.prototype.map.call(document.querySelectorAll('.disk .name'), function(s){" +
    "return Math.round(s.getBoundingClientRect().top);}).join('+')"));
  ok(new Set(names.split("+")).size === 1, `all disk names share a baseline   [${names}]`);

  /* --- C. the Developer Mode gate -------------------------------------- */
  section("C. Ctrl+Shift+B — the Laws 0.15/0.16 gate");
  eq(await c.ev("__cat.devUnlocked()"), "false", "developer mode starts off");
  await c.key("keyDown", "B", "KeyB", 66, CTRL_SHIFT);
  await wait(160);
  eq(await c.ev("__cat.devUnlocked()"), "true", "Ctrl+Shift+B unlocks");
  ok(String(await c.ev("__cat.visible().join('+')")).includes("blank"),
     "Blank Cassette appears only once unlocked");
  await c.key("keyDown", "B", "KeyB", 66, CTRL_SHIFT);
  await wait(160);
  ok(!String(await c.ev("__cat.visible().join('+')")).includes("blank"),
     "and hides again when locked");

  /* --- D. Command Resolution, rule by rule ----------------------------- */
  section("D. Command Resolution");

  /* Rule 1 — a load form with an empty drive. */
  eq(await c.ev("__cat.inserted()"), "null", "drive starts empty");
  await c.ev("__cat.execute('LOAD\"*\",8')");
  await wait(120);
  ok(/device not present/i.test(String(await c.ev("__cat.text()"))),
     "rule 1: no disk + LOAD -> ?DEVICE NOT PRESENT ERROR");

  /* Rule 6 — unparseable input. Checked while the drive is still empty, to
     prove it answers SYNTAX and not DEVICE NOT PRESENT: a string that never
     parsed as a load never reached the drive. */
  await c.ev("__cat.execute('BANANA')");
  await wait(120);
  ok(/syntax/i.test(String(await c.ev("__cat.lines().slice(-2).join(' ')"))),
     "rule 6: garbage -> ?SYNTAX ERROR (not a drive error)");

  /* Rule 5 — a bare RUN is a no-op, and must not error even with no disk. */
  await c.ev("__cat.execute('RUN')");
  await wait(120);
  const afterRun = String(await c.ev("__cat.lines().slice(-2).join(' ')"));
  ok(!/error/i.test(afterRun), "rule 5: bare RUN is a no-op, never an error");

  /* Insert a disk. */
  ok(await c.ev("__cat.select('asteroid')"), "select Asteroid Command");
  await c.ev("__cat.insert()");
  await wait(140);
  eq(await c.ev("__cat.inserted()"), "asteroid", "disk is in the drive");

  /* Rule 2 — the directory listing. */
  await c.ev("__cat.execute('LOAD\"$\",8')");
  await wait(160);
  const dir = String(await c.ev("__cat.text()"));
  ok(/asteroid command/i.test(dir), "rule 2: LOAD\"$\",8 lists the disk's entries");

  /* Rule 4, no match — a real filename, but on a different disk. */
  await c.ev("__cat.execute('LOAD\"THE AQUANAUT\",8')");
  await wait(180);
  const miss = String(await c.ev("__cat.lines().slice(-3).join(' ')"));
  ok(/searching for/i.test(miss) && /file not found/i.test(miss),
     "rule 4: a name that is not on THIS disk -> SEARCHING, then ?FILE NOT FOUND");

  /* --- E. single execution path ---------------------------------------- */
  section("E. single execution path — a button IS its typed equivalent");
  const btnCmd = await c.ev("document.getElementById('btn-load').dataset.cmd");
  eq(btnCmd, 'LOAD"*",8,1', "the Load button carries a command string, not behaviour");
  const listCmd = await c.ev("document.getElementById('btn-list').dataset.cmd");
  eq(listCmd, 'LOAD"$",8', "the List button likewise");

  /* --- E2. the HUB's own console, measured before any cartridge exists --
     🚨 SCOPE MATTERS HERE. Once a cartridge is running, every request it
     makes is on this page too, and Asteroid Command's own art has a missing
     file that 404s intermittently. Censusing after a launch would mean the
     hub can never be green until three other games are clean - and worse, it
     would tempt a filter, which can only ever hide a NEW error later. So the
     strict census happens here, with nothing loaded but the hub itself. What
     the cartridges bring with them is counted separately at the end and named
     as theirs. */
  section("E2. the hub's own console (nothing launched yet)");
  const hubErrs = (await c.errors()) || [];
  ok(hubErrs.length === 0, `the hub itself is clean   [${hubErrs.length}]`);
  hubErrs.slice(0, 5).forEach((e) => console.log("      " + String(e).slice(0, 160)));

  /* --- F. loading a cartridge, and getting back out -------------------- */
  section("F. rule 3 — LOAD\"*\",8 loads the game, and exit returns to the hub");
  eq(await c.ev("__cat.playing()"), "false", "nothing is running yet");
  await c.ev("__cat.execute('LOAD\"*\",8')");
  const tLoad = await until(async () => String(await c.ev("__cat.playing()")) === "true");
  ok(tLoad >= 0, `rule 3: the cartridge is running   [${took(tLoad)}]`);
  const src = String(await c.ev("__cat.playingSrc()"));
  ok(/Asteroid%20Command/i.test(src) || /Asteroid Command/i.test(src),
     `it launched Asteroid Command   [${src}]`);
  ok(/files\/index\.html$/.test(src), "and launched its real entry point");

  await c.ev("__cat.exit()");
  await wait(200);
  eq(await c.ev("__cat.playing()"), "false", "exit returns to the hub");
  eq(await c.ev("__cat.playingSrc()"), "null", "the cartridge is really stopped, not hidden");
  /* ⭐ The hub must NOT have reloaded — the disk is still in the drive. That is
     the difference between an overlay and a navigation, and it is the whole
     reason exit is instant. */
  eq(await c.ev("__cat.inserted()"), "asteroid", "the disk is still in the drive (no reload)");

  /* --- G. The Aquanaut, end to end ------------------------------------- */
  section("G. The Aquanaut launches — the registration bug, proven fixed");
  await c.ev("__cat.eject()");
  await c.ev("__cat.select('aquanaut')");
  await c.ev("__cat.insert()");
  await wait(140);
  await c.ev("__cat.execute('LOAD\"THE AQUANAUT\",8,1')");
  const tAq = await until(async () => String(await c.ev("__cat.playing()")) === "true");
  ok(tAq >= 0, `The Aquanaut runs from its own filename   [${took(tAq)}]`);
  const aq = String(await c.ev("__cat.playingSrc()"));
  ok(/Aquanaut/i.test(aq), `and it is Aquanaut's own entry point   [${aq}]`);
  await c.ev("__cat.exit()");
  await wait(200);

  /* --- H. the trailing ,1 is optional ---------------------------------- */
  section("H. a trailing ,1 changes nothing");
  await c.ev("__cat.execute('LOAD\"*\",8,1')");
  const tTrail = await until(async () => String(await c.ev("__cat.playing()")) === "true");
  ok(tTrail >= 0, `LOAD"*",8,1 behaves exactly as LOAD"*",8   [${took(tTrail)}]`);
  await c.ev("__cat.exit()");
  await wait(200);

  /* --- I. what the CARTRIDGES bring with them --------------------------- */
  /* 📌 Reported, deliberately NOT asserted. These requests come from inside
     the cartridge iframe - Asteroid Command has a missing image under its own
     files/assets/ - and they are that cartridge's defect, pre-existing and
     unrelated to the hub or to routing. 🚫 Do not convert this into a filter
     on the census above: a filter for a request that is expected today is
     exactly what hides an unexpected one tomorrow. Fix them in the cartridge
     and this number goes down on its own. */
  section("I. console after the cartridges ran (reported, not asserted)");
  const allErrs = (await c.errors()) || [];
  const fromCarts = allErrs.length - hubErrs.length;
  console.log(`  note  ${fromCarts} console entr${fromCarts === 1 ? "y" : "ies"} arrived once cartridges ran.`);
  console.log("        These belong to the cartridges' own assets, not to the hub.");
  console.log("        The hub's own census is E2 above, and it is strict.");

  /* --- J. the control that must fail ------------------------------------ */
  section("J. [control] the rig can say NO");
  const bogus = String(await c.ev("__cat.visible().join('+')")) === "nothing-like-this";
  if (bogus) {
    fail++; fails.push("[control] a deliberately-false assertion passed");
    console.log("  FAIL  [control] deliberately-false assertion PASSED — harness is broken");
  } else {
    pass++;
    console.log("  ok    [control] deliberately-false assertion correctly failed");
  }

  await c.shot(fileURLToPath(new URL("./verify-cat-hub.png", import.meta.url)));
  console.log("\n  shot: Game/cat/verify-cat-hub.png");
} finally {
  c.close();
}

console.log(`\n${"-".repeat(66)}`);
console.log(`  CAT hub: ${pass} passed, ${fail} failed`);
if (fail) { console.log("\n  failures:"); fails.forEach((f) => console.log("    - " + f)); }
console.log(`${"-".repeat(66)}\n`);
process.exit(fail ? 1 : 0);
