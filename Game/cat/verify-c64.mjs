/* ===========================================================================
   verify-c64.mjs — is the CAT computer's screen a REAL C64, and do the deck's
   buttons and the keyboard drive it down one path?

   RUN
     1.  python -m http.server 8899        (from the (PCL) repo root)
     2.  node verify-c64.mjs               (from this folder)
   Takes a few minutes: disks and tapes load at the machine's own speed.

   His locked requirements (2026-09-16), each asserted below against the
   machine's own screen:
     §A  booting inside Fang Rock shows the REAL emulator boot screen;
     §C  a disk goes into the RUNNING machine (no reset), crack intro on insert;
     §D  typed LOAD"$",8 / LIST / LOAD"*",8,1 and the deck's buttons give the
         same screen, line for line;
     §B  real typing: arbitrary BASIC runs;
   and his answers the same day: keyboard mode at boot (§A), F10 is the way
   out, so Escape and Shift+Escape reach the C64 as RUN/STOP (§B, §E).
   🔄 2026-09-17, his ruling: people type on the C64's own key positions, as
   the buttons do (§A reads the keymap; §B and §D type on it by hand); the
   side panel's key card says where the moved characters are (§J); and the
   ORDINARY hub's play overlay swaps a two-sided game's sides too (§K, in a
   second window without the shell's preload).
   🆕 2026-09-17 — §L is the BOOK READER: it opens over the machine, drags and
   resizes, turns pages, and — the part his ruling is really about — a listing
   is typed straight off the page into the running C64 with the mouse last on
   the READER, which is where focus goes wrong if it is going to.

   ===========================================================================
   🚨 WHY ELECTRON AND NOT NB's cdp.mjs, WHICH THE OTHER RIGS USE
   Headless Chrome does not run this emulator: measured 2026-09-09 (see
   verify-joyport.mjs), the machine advanced 4 frames in 30s and the canvas
   was black. So this file runs ITSELF under the Fang Rock shell's own Electron
   (32.3.3) with an offscreen window, where the core runs at full speed — and
   with the shell's own preload.js, so the hub sees `window.fangRockShell`
   exactly as it does in the installed app.
   🚫 It never launches the shell (`electron .` in Morbius/shell re-points
   Windows' fangrock:// link in dev mode). It borrows the binary and the
   preload, nothing else. ⚠️ The arcade:// scheme is NOT mirrored; the hub is
   served over http here. Nothing about the machine branches on the scheme.

   🚨 HOW IT READS THE SCREEN. EmulatorJS does not export the core's memory,
   so the rig finds the C64's RAM inside the WebAssembly heap by the boot
   banner's screen codes, once, and reads $0400-$07E7 (40x25 screen codes) as
   text from then on. That is RIG-ONLY: the hub never reads the machine's
   memory, it only types into it. The address does not move for the life of
   the core; reading HEAPU8 afresh each time survives heap growth.

   ⭐ Keys are sent as REAL input events (webContents.sendInputEvent) and the
   deck is clicked with the REAL mouse, because focus is part of what is being
   tested: a key that lands on the wrong element is exactly the bug.
   ⭐ §Z is a control that must FAIL.
   ========================================================================= */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, appendFileSync, readFileSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SHELL_DIR = fileURLToPath(new URL("../../../+Nerva Beacon/The Lantern Room/Morbius/shell/", import.meta.url));
const ELECTRON = join(SHELL_DIR, "node_modules/electron/dist/electron.exe");
const PRELOAD = join(SHELL_DIR, "preload.js");
const URL_HUB = "http://localhost:8899/Game/cat/index.html";

/* A blank, formatted 35-track 1541 disk whose directory header says `name`,
   built byte by byte (§I's two-sided game). Also how a leftover is recognised as
   the rig's own: only a byte-identical file is ever removed. */
function rigBlankD64(name) {
  const spt = (t) => (t <= 17 ? 21 : t <= 24 ? 19 : t <= 30 ? 18 : 17);
  const img = Buffer.alloc(174848);
  let bam = 0;
  for (let t = 1; t < 18; t++) bam += spt(t) * 256;
  img[bam] = 18; img[bam + 1] = 1; img[bam + 2] = 0x41;
  for (let t = 1; t <= 35; t++) {
    let n = spt(t), bits = (1 << n) - 1;
    const o = bam + 4 * t;
    if (t === 18) { bits &= ~3; n -= 2; }
    img[o] = n; img[o + 1] = bits & 255; img[o + 2] = (bits >> 8) & 255; img[o + 3] = (bits >> 16) & 255;
  }
  for (let i = 0x90; i <= 0xAA; i++) img[bam + i] = 0xA0;
  for (let i = 0; i < name.length; i++) img[bam + 0x90 + i] = name.charCodeAt(i);
  img[bam + 0xA2] = 0x43; img[bam + 0xA3] = 0x41; img[bam + 0xA5] = 0x32; img[bam + 0xA6] = 0x41;
  img[bam + 257] = 0xFF;
  return img;
}

/* ---------------------------------------------------------------------------
   UNDER NODE: launch this same file under the shell's Electron and relay what
   it prints. ⚠️ Electron's own stdout does not reach a piped shell on Windows
   (measured), so the run writes to a log file that is echoed as it grows.
   ------------------------------------------------------------------------- */
if (!process.versions.electron) {
  for (const [what, p] of [["the shell's Electron", ELECTRON], ["the shell's preload.js", PRELOAD]]) {
    if (!existsSync(p)) {
      console.error(`\n  Cannot find ${what} at:\n    ${p}\n  That is this rig's only cross-repo dependency.\n`);
      process.exit(2);
    }
  }
  /* 🚨 A KILLED RUN LEAVES §I's TWO RIG DISKS IN Game/disks/ — measured: a run
     stopped by a timeout skipped its own clean-up and left them in Andrew's
     folder. So they are cleared here, before and after every run, from outside
     the Electron child. ⚠️ Only a file byte-identical to what the rig builds is
     removed; anything else of that name is his, and is left alone. */
  const clearRigDisks = () => {
    for (const s of ["A", "B"]) {
      const f = fileURLToPath(new URL(`../disks/zz CAT rig swap - Side ${s}.d64`, import.meta.url));
      try { if (existsSync(f) && readFileSync(f).equals(rigBlankD64("RIG SIDE " + s))) unlinkSync(f); } catch { /* leave it */ }
    }
  };
  clearRigDisks();
  process.on("exit", clearRigDisks);
  const log = join(mkdtempSync(join(tmpdir(), "verify-c64-")), "run.log");
  writeFileSync(log, "");
  const child = spawn(ELECTRON, [fileURLToPath(import.meta.url)], {
    stdio: "ignore", env: { ...process.env, VERIFY_C64_LOG: log },
  });
  let shown = 0;
  const pump = () => {
    const s = readFileSync(log, "utf8");
    if (s.length > shown) { process.stdout.write(s.slice(shown)); shown = s.length; }
  };
  const timer = setInterval(pump, 250);
  child.on("exit", (code) => {
    clearInterval(timer);
    pump();
    process.exit(code === null ? 1 : code);
  });
} else {
  /* 🚨 NOT `await runRig()`. Electron holds back its `ready` event until an ES
     module main has finished evaluating, and the rig awaits `ready` — so a
     top-level await here waits on itself forever, silently (measured: no
     output, no exit). Started, not awaited. */
  runRig().catch((err) => {
    if (process.env.VERIFY_C64_LOG) appendFileSync(process.env.VERIFY_C64_LOG, "  FAIL  the rig itself threw: " + (err && err.stack || err) + "\n");
    process.exit(1);
  });
}

async function runRig() {
  const require = createRequire(import.meta.url);
  const { app, BrowserWindow } = require("electron");
  const LOG = process.env.VERIFY_C64_LOG;
  const say = (s) => { if (LOG) appendFileSync(LOG, s + "\n"); else console.log(s); };

  let pass = 0, fail = 0;
  const fails = [];
  const ok = (cond, label) => {
    cond ? pass++ : (fail++, fails.push(label));
    say(`  ${cond ? "ok  " : "FAIL"}  ${label}`);
    return cond;
  };
  const section = (s) => say(`\n${s}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
  app.setPath("userData", mkdtempSync(join(tmpdir(), "verify-c64-profile-")));
  await app.whenReady();

  const win = new BrowserWindow({
    width: 1280, height: 860, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, preload: PRELOAD },
  });
  /* `let`: §K moves the rig to a second window, and every helper below reads these at call time */
  let wc = win.webContents;
  wc.setFrameRate(60);

  const ev = (code) => wc.executeJavaScript(code, true);
  let FRAME = "document.getElementById('machine-frame').contentWindow";
  const inMachine = (expr) => ev(`(() => { try { return ${FRAME}.${expr}; } catch (e) { return null; } })()`);
  async function until(code, ms = 20000, every = 150) {
    const t0 = Date.now();
    for (;;) {
      try { if (await ev(code)) return Date.now() - t0; } catch { /* not there yet */ }
      if (Date.now() - t0 > ms) return -1;
      await wait(every);
    }
  }
  const took = (t) => (t < 0 ? "TIMED OUT" : `${t}ms`);

  /* ---- the machine's clock: wait in emulated frames, like emu.js does ---- */
  const frameNow = async () => Number(await inMachine("EJS_emulator.gameManager.getFrameNum()")) || 0;
  async function frames(n) {
    const until = (await frameNow()) + n, deadline = Date.now() + 500 + n * 100;
    while ((await frameNow()) < until && Date.now() < deadline) await wait(10);
  }

  /* ---- the screen, read out of the machine's own RAM (rig only) ---------- */
  let RAM = -1;
  /* the banner "**** COMMODORE 64" as screen codes, at row 1, column 4 */
  async function locateRam() {
    return Number(await ev(`(function () { try {
      var H = ${FRAME}.EJS_emulator.gameManager.Module.HEAPU8;
      var pat = [42,42,42,42,32,3,15,13,13,15,4,15,18,5,32,54,52];
      var hit = -1, hits = 0;
      outer: for (var i = 0; i < H.length - pat.length; i++) {
        if (H[i] !== 42) continue;
        for (var j = 1; j < pat.length; j++) if (H[i + j] !== pat[j]) continue outer;
        hits++; hit = i - (0x400 + 40 + 4);
      }
      return hits === 1 ? hit : -hits - 2;
    } catch (e) { return -1; } })()`));
  }
  async function screen() {
    const rows = await ev(`(() => { try {
      var H = ${FRAME}.EJS_emulator.gameManager.Module.HEAPU8, rows = [];
      for (var r = 0; r < 25; r++) { var s = "";
        for (var c = 0; c < 40; c++) { var v = H[${RAM} + 0x400 + r * 40 + c] & 127;
          s += v === 32 ? " " : v === 0 ? "@" : v < 27 ? String.fromCharCode(v + 64) : v < 64 ? String.fromCharCode(v) : "#"; }
        rows.push(s.trimEnd()); }
      return rows; } catch (e) { return []; } })()`);
    return rows || [];
  }
  const text = (rows) => rows.join("\n");
  async function untilScreen(test, ms = 30000) {
    const t0 = Date.now();
    for (;;) {
      const rows = await screen();
      if (test(rows)) return Date.now() - t0;
      if (Date.now() - t0 > ms) return -1;
      await wait(200);
    }
  }
  /* the rows the machine printed after the LAST row matching `re` */
  const after = (rows, re) => {
    let at = -1;
    rows.forEach((r, i) => { if (re.test(r)) at = i; });
    return at < 0 ? [] : rows.slice(at + 1);
  };
  /* up to and including the first READY. */
  const toReady = (rows) => {
    const i = rows.findIndex((r) => r === "READY.");
    return i < 0 ? rows : rows.slice(0, i + 1);
  };

  /* ---- real input -------------------------------------------------------- */
  async function click(selector) {
    const r = JSON.parse(await ev(`JSON.stringify((function (el) { if (!el) return null;
      var b = el.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })(document.querySelector(${JSON.stringify(selector)})))`));
    if (!r) throw new Error("nothing to click at " + selector);
    wc.sendInputEvent({ type: "mouseDown", x: r.x, y: r.y, button: "left", clickCount: 1 });
    await wait(40);
    wc.sendInputEvent({ type: "mouseUp", x: r.x, y: r.y, button: "left", clickCount: 1 });
    await wait(120);
  }
  /* what the rig types by hand, on the C64's OWN KEY POSITIONS — the positional
     keymap, which people type with since his ruling of 2026-09-17 (emu.js, THE
     MACHINE'S SETTINGS). The same places as emu.js's KEYS table: `"` is Shift+2,
     `*` is `]`, `-` is `=`.
     🔄 The first cut typed PC labels (Shift+' for a quote) on the symbolic
     keymap, and §D's hand-typed `*` could fail on a correct hub about 1 time in
     40. That race is gone with the keymap, so a wrong `*` now is a real fault.
     📌 THIS TABLE IS ALSO THE PROOF OF THE KEYMAP: on the symbolic keymap Shift+2
     types `@` and `]` types `]`, so §B's quote and §D's `*` pass only on
     positional. */
  /* 🔄 2026-09-17, LATER THE SAME DAY — THE TWO TABLES ARE GONE, AND THAT IS THE
     POINT OF THE CHANGE RATHER THAN A TIDY-UP OF IT.

     🚨 THE RIG TYPES WHAT IS PRINTED ON THE PC KEY, exactly as a player does.
     His ruling of 2026-09-17 ("us humans need that visual reference") put a
     translator in the page: emu.js's relayKey() takes the CHARACTER the PC key
     bears and presses the C64 POSITION that produces it. A rig that goes on
     pressing positions is asking to be translated a second time — press `]` for
     a star and the page reads `]`, looks it up, and dutifully types `]`.
     📌 MEASURED 2026-09-17: with the translator half-built, §B read `PRINT 45-3`
     back as `PRINT 453` and §J typed 5 of its 17 rows. Once relayKey was
     frame-paced, those same presses would have given `PRINT 45=3` — wrong in a
     new way. The rig was reading its own double translation as a hub fault.
     ⭐ SO THE PAGE IS NOT THE THING THAT MOVES. Electron is handed the character
     itself and works the key and the modifier out of the layout, which is the
     truest imitation available of a person at the keyboard — and it means this
     file no longer carries a second copy of a key map that can drift from the
     one in emu.js. That drift is the very hazard the old table warned about.
     🚫 Do not reintroduce a position table here to make a section pass. */
  const TYPEABLE = /^[ -~]$/;   /* printable ASCII: what a US PC keyboard bears */
  async function press(keyCode, shift = false) {
    const modifiers = shift ? ["shift"] : [];
    if (shift) { wc.sendInputEvent({ type: "keyDown", keyCode: "Shift", modifiers }); await frames(3); }
    wc.sendInputEvent({ type: "keyDown", keyCode, modifiers });
    await frames(3);
    wc.sendInputEvent({ type: "keyUp", keyCode, modifiers });
    await frames(3);
    if (shift) { wc.sendInputEvent({ type: "keyUp", keyCode: "Shift", modifiers: [] }); await frames(4); }
  }
  async function type(s) {
    for (const ch of s) {
      if (ch === "\n") { await press("Enter"); continue; }
      if (ch === " ") { await press("Space"); continue; }
      /* a C64 character with no PC key at all — `←` `£` `↑`. Nobody can type one
         by hand, and §L reports a listing that needs one rather than faking it. */
      if (!TYPEABLE.test(ch)) throw new Error("the rig does not type " + JSON.stringify(ch) + " by hand (see §B)");
      await press(/[A-Z0-9]/i.test(ch) ? ch.toUpperCase() : ch);
    }
    /* ⭐ WAIT FOR THE PAGE TO FINISH TYPING; DO NOT GUESS AT IT. Since his ruling
       of 2026-09-17 a keystroke may be translated (emu.js, relayKey), which costs
       real emulated frames and queues behind whatever was struck before it. The
       count is asked of the machine's own page, so this holds on a loaded machine
       as well as a quiet one — unlike a guessed frame count, which is the kind of
       assertion that has already cost this rig whole runs. */
    await until(`(function () { try { return (${FRAME}.CAT_EMU.typing() || 0) === 0; } catch (e) { return true; } })()`, 20000, 60);
    await frames(3);
  }

  const idle = () => until("!__cat.machine().busy", 60000, 100);
  /* 🆕 2026-09-17 — the Load button now waits for the LOAD to finish before it
     decides whether to type RUN, so the hub can legitimately stay busy for far
     longer than 60s on a slow disk. Using idle() there made the rig walk on
     while the machine was still working, and everything after it read a screen
     that was still moving. */
  const idleLoad = () => until("!__cat.machine().busy", 200000, 200);
  /* the side panel, as the player sees it: each part lit, grey, or neither */
  const SIDE = `(function () {
    var st = function (id) { var e = document.getElementById(id); return e.classList.contains("is-lit") ? "lit" : e.classList.contains("is-grey") ? "grey" : "plain"; };
    var p = document.getElementById("c64-side");
    return { shown: !p.hidden && p.getBoundingClientRect().height > 20, mode: p.dataset.mode, port: p.dataset.port,
             keys: st("c64-keys"), p1: st("c64-port1"), p2: st("c64-port2"),
             power: document.getElementById("c64-power").getAttribute("aria-pressed"),
             oldButtons: ["btn-input", "btn-port", "btn-power"].filter(function (id) { var b = document.getElementById(id); return !b.hidden && b.getBoundingClientRect().width > 0; }).length };
  })()`;

  /* ---- §I's two-sided game ------------------------------------------------
     Game/disks/ is Andrew's hand-picked, gitignored folder and today holds no
     two-sided title, so the rig lays its own pair there BEFORE the hub scans it,
     and takes away only the files it made. 🚫 Nothing is sourced: each is a
     blank, formatted 1541 disk written here, told apart only by the name in its
     directory header. ⚠️ If files of these names already exist they are left
     alone and not removed. */
  const SWAP_TITLE = "zz CAT rig swap";
  const DISK_DIR = fileURLToPath(new URL("../disks/", import.meta.url));
  const SWAP_FIXTURES = [];
  if (existsSync(DISK_DIR)) {
    for (const s of ["A", "B"]) {
      const f = join(DISK_DIR, `${SWAP_TITLE} - Side ${s}.d64`);
      if (!existsSync(f)) { writeFileSync(f, rigBlankD64("RIG SIDE " + s)); SWAP_FIXTURES.push(f); }
    }
  }

  let DISK = null, TAPE = null;
  try {
    await wc.loadURL(URL_HUB);
    wc.focus();

    /* --- [control] ------------------------------------------------------- */
    section("[control] Fang Rock, the real C64, and a clock that moves");
    ok((await until("window.__cat && window.fangRockShell === true", 20000)) >= 0,
       "the hub believes it is inside Fang Rock (the shell's own preload)");
    const hubM = await ev("__cat.machine()");
    ok(hubM.on && /machine=1/.test(String(hubM.src)),
       `the screen is the machine page, not the terminal   [${hubM.src}]`);
    const tStart = await until(`(() => { try { return ${FRAME}.CAT_EMU.machine().started; } catch (e) { return false; } })()`, 90000);
    ok(tStart >= 0, `the C64 core started   [${took(tStart)}]`);
    const f0 = await frameNow(); await wait(1000); const f1 = await frameNow();
    ok(f1 - f0 > 20, `[control] the machine is running, not frozen   [${f1 - f0} frames in 1s]`);
    const tRam = await (async () => { const t0 = Date.now();
      /* 🔄 2026-09-25 — 20s -> 60s (his approval). The hunt takes 12-17s on this
         machine and failed 3 runs in 6 while other sessions were busy, the
         committed code the same as new. Only the WAIT grew: it still has to be
         found exactly once, and the time is still printed. */
      while (Date.now() - t0 < 60000) { RAM = await locateRam(); if (RAM >= 0) return Date.now() - t0; await wait(300); } return -1; })();
    ok(tRam >= 0, `[control] the C64's screen memory was found, exactly once   [${took(tRam)}, ${RAM}]`);
    if (RAM < 0) {
      /* 🆕 2026-09-25 — say WHAT was on the glass when the hunt failed, rather than
         leave the next person to guess between "slow machine" and "broken boot".
         The shot goes to the OS temp folder, never under Game/ (a public root). */
      const f = join(tmpdir(), "verify-c64-noram.png");
      await wc.capturePage().then((img) => writeFileSync(f, img.toPNG())).catch(() => {});
      say(`        (shot of the glass when the hunt failed: ${f}; ${await frameNow()} frames run)`);
      throw new Error("no screen to read; nothing below can be judged");
    }

    /* --- A. boot ----------------------------------------------------------- */
    section("A. booting inside Fang Rock shows the REAL C64 boot screen");
    const tReady = await untilScreen((r) => r[5] === "READY.", 15000);
    let rows = await screen();
    ok(rows[1].trim() === "**** COMMODORE 64 BASIC V2 ****" && /38911 BASIC BYTES FREE/.test(rows[3]),
       `the ROM's own banner, not the hub's   [${rows[1].trim()} / ${rows[3].trim()}]`);
    ok(tReady >= 0, `READY. on the machine's own screen   [${took(tReady)}]`);
    await wait(4000);
    rows = await screen();
    ok(rows.slice(6).every((r) => r === ""),
       `nothing typed itself: no autostart LOAD after READY.   [${rows.slice(6).filter(Boolean).join(" | ") || "blank"}]`);
    const deck = JSON.parse(await ev(`JSON.stringify({
      out: getComputedStyle(document.getElementById("out")).display,
      frame: document.getElementById("machine-frame").getBoundingClientRect().width,
      list: !document.getElementById("btn-listing").hidden, run: !document.getElementById("btn-run").hidden,
      reset: !document.getElementById("btn-reset").hidden,
      load: document.getElementById("btn-load").dataset.cmd, slot: document.getElementById("drive-slot").textContent })`));
    ok(deck.out === "none" && deck.frame > 300, `the hub's terminal is off the glass and the machine fills it   [out ${deck.out}, frame ${deck.frame}px]`);
    const tSide = await until("document.getElementById('c64-side').dataset.mode === 'keyboard'", 10000);
    const sideNow = await ev(SIDE);
    ok(tSide >= 0 && sideNow.keys === "lit" && sideNow.p1 === "grey" && sideNow.p2 === "grey" && (await inMachine("CAT_EMU.machine().keyboard")) === true,
       `it opens in KEYBOARD mode: the side panel lights the keyboard and greys both ports, from the machine's report   [${JSON.stringify(sideNow)}]`);
    ok(sideNow.shown && sideNow.power === "true" && sideNow.oldButtons === 0,
       "the side panel replaces the Input / Port / Power Off buttons, and its power light is on");
    ok(deck.list && deck.run && deck.reset, "the deck has List, Run and Reset");
    ok(await ev("document.getElementById('btn-insert').parentNode.id === 'crates' && document.getElementById('btn-insert').classList.contains('btn--insert')"),
       "Insert Disk sits where the disks are, styled as the primary action (his addendum)");
    /* his F-key addendum: each hint names the key that emu.js and cat.js actually catch */
    const hints = await ev(`[document.getElementById("c64-keys-hint").textContent, document.getElementById("c64-port-hint").textContent,
      document.getElementById("btn-reset-hint").textContent]`);
    ok(hints.join(" ") === "F2 F9 F12", `the side panel and Reset carry their keys: [F2] keyboard, [F9] ports, [F12] reset   [${hints.join(" ")}]`);
    ok(deck.load === 'LOAD"*",8,1' && /empty/i.test(deck.slot), `Load types LOAD"*",8,1; the drive is empty   [${deck.load} / ${deck.slot}]`);
    /* his ruling, 2026-09-17: people type on the C64's key positions, as the buttons do */
    const keymap = await inMachine("EJS_emulator.allSettings.vice_keyboard_keymap || EJS_emulator.getSettingValue('vice_keyboard_keymap') || null");
    ok(keymap === "positional", `it boots on the POSITIONAL keymap: a key types what sits in that place on a C64   [${keymap}]`);

    /* --- B. real typing ---------------------------------------------------- */
    section("B. real typing — arbitrary BASIC, through the real keyboard path");
    await click("#machine-frame");
    await type('NEW\n10 PRINT "ANDREW"\n20 GOTO 10\nLIST\n');
    const tList = await untilScreen((r) => { const a = toReady(after(r, /^LIST$/)); return a.includes('10 PRINT "ANDREW"') && a.includes("20 GOTO 10"); }, 10000);
    ok(tList >= 0, `a typed two-line program is STORED: LIST prints it back   [${after(await screen(), /^LIST$/).filter(Boolean).join(" | ")}]`);
    await type("RUN\n");
    const tRun = await untilScreen((r) => r.filter((x) => x === "ANDREW").length >= 12, 10000);
    ok(tRun >= 0, `RUN runs it: the screen fills with ANDREW   [${took(tRun)}]`);
    await press("Escape");
    const tBreak = await untilScreen((r) => r.some((x) => /^BREAK IN (10|20)$/.test(x)), 5000);
    ok(tBreak >= 0, `Escape is RUN/STOP: the program breaks   [${took(tBreak)}]`);
    ok(await ev("__cat.machine().on && document.getElementById('play').hidden"), "and nothing exited");
    /* ⚠️ Not straight after BREAK: the machine is still printing READY. for a
       few frames, and a key sent in that moment can be lost on a real C64 too.
       A person is never that fast; the rig was, once, and failed here. */
    await untilScreen((r) => after(r, /^BREAK IN (10|20)$/)[0] === "READY.", 3000);
    await frames(15);
    /* `-` sits on the PC's `=` key on a C64: the answer is 42 only on positional */
    await type("PRINT 45-3\n");
    const t42 = await untilScreen((r) => toReady(after(r, /^PRINT 45-3$/))[0] === " 42", 5000);
    ok(t42 >= 0, `PRINT 45-3 answers 42   [${(await screen()).filter(Boolean).slice(-3).join(" | ")}]`);

    /* --- C. insert --------------------------------------------------------- */
    section("C. Insert Disk: a disk slides into the drive, then goes into the RUNNING machine");
    const disks = await ev("__cat.disks().map(function (d) { return { id: d.id, name: d.displayName, files: (d.files || []).map(function (f) { return f.name; }) }; })");
    /* 🚫 Picked by what the library holds today, never by a hard-coded name:
       Game/disks/ is Andrew's, gitignored, and changes. */
    DISK = disks.find((d) => d.files.length === 1 && /\.d64$/i.test(d.files[0]));
    TAPE = disks.find((d) => d.files.length === 1 && /\.t64$/i.test(d.files[0]));
    ok(!!DISK && !!TAPE, `the library has a one-sided disk and a tape to test with   [${DISK && DISK.name} / ${TAPE && TAPE.name}]`);
    if (!DISK || !TAPE) throw new Error("no disk or tape to test with");

    await ev(`__cat.select(${JSON.stringify(DISK.id)})`);
    await click("#btn-insert");
    /* 🔄 his addendum, 2026-09-16: on this corner the drive animation REPLACES
       the crack intro (which still plays for a cabinet's launch) */
    const tAnim = await until("!!document.querySelector('#screen-shell > #drive-insert.drive-insert--disk')", 2000, 50);
    const sawCrack = await ev("!!document.getElementById('crack')");
    ok(tAnim >= 0 && !sawCrack, `a disk slides into the drive over the screen, and the crack intro does not play   [${took(tAnim)}, crack ${sawCrack}]`);
    const tIn = await until(`__cat.inserted() === ${JSON.stringify(DISK.id)}`, 60000);
    await idle();
    const slot = await ev("document.getElementById('drive-slot').textContent");
    ok(tIn >= 0 && slot === DISK.name.toUpperCase(), `${DISK.name} is in the drive   [${took(tIn)}, slot ${slot}]`);
    ok(/disk inserted/i.test(String(await ev("__cat.note()"))), `the deck says so   [${await ev("__cat.note()")}]`);
    /* 📌 the KERNAL traps a tape needs stay OFF for a disk: always on, they made
       disk loads twice as slow and one in a few runs hung at LOADING */
    const trapsDisk = await inMachine("EJS_emulator.allSettings.vice_virtual_device_traps");
    ok(trapsDisk === "disabled", `with a disk in, the tape traps are off   [${trapsDisk}]`);
    await type("PRINT 11-9\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT 11-9$/))[0] === " 2", 6000)) >= 0,
       "the keyboard is back in the machine after inserting, with no click");
    await type("LIST\n");
    ok((await untilScreen((r) => toReady(after(r, /^LIST$/)).includes('10 PRINT "ANDREW"'), 6000)) >= 0,
       "the machine was NOT reset by the insert: the program typed before it is still there");

    /* --- D. load parity ---------------------------------------------------- */
    section("D. one path: the deck's buttons and typed commands give the SAME screen");
    /* 🚨 EACH HALF STARTS ON A CLEAR SCREEN (Shift+CLR/HOME). Measured failure:
       with the button half's `LOAD"$",8 … READY.` still on screen, the typed
       half's wait matched THAT and returned at once — LIST was typed while the
       real load was still searching, and the directories came out 5 vs 6 lines
       on a correct hub. A cleared screen has nothing old to match. */
    const clearScreen = async () => {
      await press("Home", true);
      await untilScreen((r) => r.every((x) => x === ""), 5000);
    };
    const directory = async () => {
      await untilScreen((r) => toReady(after(r, /^LIST$/)).slice(-1)[0] === "READY.", 20000);
      return toReady(after(await screen(), /^LIST$/)).filter(Boolean);
    };
    await clearScreen();
    await click("#btn-list");               // LOAD "$",8
    await idle();
    /* 🚨 measured failure: a clicked Load button kept focus, and the next Space
       typed by hand pressed it again */
    ok(await ev("document.activeElement === document.getElementById('machine-frame')"),
       `clicking a deck button leaves the keyboard in the machine   [focus: ${await ev("document.activeElement.id || document.activeElement.tagName")}]`);
    const tDirB = await untilScreen((r) => toReady(after(r, /^LOAD"\$",8$/)).slice(-1)[0] === "READY.", 60000);
    await click("#btn-listing");            // LIST
    await idle();
    const dirButton = await directory();
    ok(tDirB >= 0 && /^0 "/.test(dirButton[0] || ""), `buttons: LOAD "$",8 then List print the disk's directory   [${dirButton[0]} … ${dirButton.length} lines${dirButton.length ? "" :
       "; screen: " + (await screen()).filter(Boolean).slice(-6).join(" / ") + "; note: " + (await ev("__cat.note()")) + "; busy " + (await ev("__cat.machine().busy"))}]`);
    await clearScreen();
    await type('LOAD"$",8\n');
    await untilScreen((r) => toReady(after(r, /^LOAD"\$",8$/)).slice(-1)[0] === "READY.", 60000);
    await type("LIST\n");
    const dirTyped = await directory();
    ok(dirTyped.length > 1 && dirTyped.join("|") === dirButton.join("|"),
       `typed: the same directory, line for line   [${dirTyped.length} vs ${dirButton.length} lines${dirTyped.join("|") === dirButton.join("|") ? "" : "; typed " + dirTyped.join(" / ") + " ≠ button " + dirButton.join(" / ")}]`);

    const loadRows = async () => {
      await untilScreen((r) => toReady(after(r, /^LOAD"\*",8,1$/)).slice(-1)[0] === "READY.", 120000);
      return toReady(after(await screen(), /^LOAD"\*",8,1$/)).filter(Boolean);
    };
    /* 🚨 2026-09-17 — THE ONE CARVE-OUT IN THIS SECTION'S LAW, and it is his.
       Every other button here IS its typed equivalent. The Load button now types
       LOAD"*",8,1 and then, if the machine comes back to a BASIC prompt, types
       RUN as well — so it is still only typing things a player could type, but it
       is no longer line-for-line identical to the hand-typed form, which is what
       :482 below compares. The carve-out is LOAD ONLY.
       📌 So the button's own load lines are captured BEFORE the RUN can land, and
       what the auto-RUN did is asserted separately, in §D2. Reading the screen
       after the RUN would be a race against the game clearing it. */
    await click("#btn-load");
    const loadButton = await loadRows();
    ok(loadButton.join("|") === "SEARCHING FOR *|LOADING|READY.",
       `button: Load "*",8,1 loads the first file   [${loadButton.join(" | ")}${loadButton.length ? "" :
       "; screen: " + (await screen()).filter(Boolean).slice(-4).join(" / ") + "; note: " + (await ev("__cat.note()"))}]`);
    /* 🚨 LET THE AUTO-RUN FINISH BEFORE ANYTHING ELSE TOUCHES THE MACHINE. F10
       is refused while the hub is busy, so walking on here made the next
       assertion fail on a reset that was never allowed to happen. */
    await idleLoad();
    await press("F12");
    const tReset = await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await idle();
    ok(tReset >= 0 && (await ev("__cat.inserted()")) === DISK.id,
       `F12 resets to the boot screen, and the disk stays in   [${took(tReset)}, drive ${await ev("__cat.inserted()")}]`);
    await type('LOAD"*",8,1\n');
    const loadTyped = await loadRows();
    /* The one hand-typed `*` in this rig, on `]`. A `*` that came out as SHIFT+*
       (screen code >= 64, read as "#") is the symbolic keymap's race, so the
       line names it: it would mean the machine is no longer on positional. */
    const typedTail = loadTyped.length ? "" : (await screen()).filter(Boolean).slice(-4).join(" / ");
    ok(loadTyped.join("|") === loadButton.join("|"), `typed: LOAD"*",8,1 gives the same lines   [${loadTyped.join(" | ")}${typedTail
       ? (/LOAD"#",8,1/.test(typedTail) ? "; * arrived as SHIFT+*, the SYMBOLIC keymap's race — is the machine still on positional?" : "") + "; screen: " + typedTail : ""}]`);
    await click("#btn-run");
    await idle();
    /* ⚠️ A GAME CAN CLEAR THE SCREEN BEFORE THIS LOOKS — measured: BadLands'
       trainer menu was up before a check for the RUN line ran, and the check
       failed on a Run button that had worked. So: either RUN is on the screen,
       or BASIC's screen (the LOAD it answered) is gone because something ran. */
    const tRunB = await untilScreen((r) => r.includes("RUN") || !r.includes('LOAD"*",8,1'), 20000);
    ok(tRunB >= 0, `the Run button types RUN, and the machine runs what it loaded   [${took(tRunB)}]`);

    /* --- D2. the Load button runs what it loaded ------------------------------
       🆕 2026-09-17, his ask. The naive version of this — type RUN after a fixed
       wait — is wrong on a large part of this library, because many cracked
       releases START THEMSELVES the moment the load ends; three keystrokes then
       land inside a running game. So the hub asks the machine whether it is
       genuinely back at a BASIC prompt and types RUN only if it is.
       ⭐ BOTH ANSWERS ARE CORRECT, which is why this asserts the OUTCOME (the
       machine is no longer sitting at a bare post-LOAD prompt) rather than
       demanding the letters R-U-N: on a self-starting disk, doing nothing IS the
       right behaviour, and a rig that insisted on RUN would force the bug. */
    section("D2. the Load button runs what it loaded, unless it started itself");
    await press("F12");
    await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await idle();
    await clearScreen();
    await click("#btn-load");
    /* 🚨 WAIT FOR THE LINE TO APPEAR BEFORE WAITING FOR THE OUTCOME. The first
       cut asked only "is the LOAD line gone, or is RUN on screen?" — which is
       TRIVIALLY TRUE on a screen that was just cleared, so it passed in 1ms and
       measured nothing. A cleared screen satisfies "not-includes" for free.
       That is the exact shape of a vacuous assertion: green, and empty. */
    const tLine = await untilScreen((r) => r.includes('LOAD"*",8,1'), 20000);
    ok(tLine >= 0, `[control] the Load button really typed its line   [${took(tLine)}]`);
    const tAuto = await untilScreen((r) => r.includes("RUN") || !r.includes('LOAD"*",8,1'), 200000);
    const settled = await idleLoad();
    const autoRows = (await screen()).filter(Boolean);
    ok(tAuto >= 0, `after the load the machine is running, not parked at READY.   [${took(tAuto)}; ${autoRows.slice(-2).join(" / ")}]`);
    ok(settled >= 0, `and the hub let go of the machine afterwards   [${took(settled)}]`);
    await wait(8000);
    await wc.capturePage().then((img) => writeFileSync(fileURLToPath(new URL("./verify-c64-run.png", import.meta.url)), img.toPNG()));
    say(`        (shot: Game/cat/verify-c64-run.png — ${DISK.name} after RUN, for a human eye)`);

    /* --- E. tapes ---------------------------------------------------------- */
    section("E. a tape: Load types LOAD, and Shift+Escape is Shift+RUN/STOP");
    await click("#btn-reset");
    await idle();
    await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await ev(`__cat.select(${JSON.stringify(TAPE.id)})`);
    ok((await ev("document.getElementById('btn-insert').textContent")) === "Insert Tape", "for a tape the button says Insert Tape");
    await click("#btn-insert");
    ok((await until("!!document.querySelector('#drive-insert.drive-insert--tape')", 2000, 50)) >= 0,
       "and a cassette drops into a datasette, not a floppy into a disk drive");
    const tTape = await until(`__cat.inserted() === ${JSON.stringify(TAPE.id)}`, 60000);
    await idle();
    const tapeDeck = JSON.parse(await ev(`JSON.stringify({ label: document.getElementById("drive-label").textContent,
      cmd: document.getElementById("btn-load").dataset.cmd, text: document.getElementById("btn-load").textContent, medium: __cat.machine().medium })`));
    ok(tTape >= 0 && tapeDeck.medium === "tape" && tapeDeck.label === "Tape",
       `${TAPE.name} goes in as a tape   [${took(tTape)}, ${tapeDeck.label}]`);
    ok(tapeDeck.cmd === "LOAD" && tapeDeck.text === "Load", `the Load button now types LOAD, and says so   [${tapeDeck.text}]`);
    const trapsTape = await inMachine("EJS_emulator.allSettings.vice_virtual_device_traps");
    ok(trapsTape === "enabled", `with a tape in, the traps a .T64 needs are on   [${trapsTape}]`);
    await click("#btn-load");
    /* 🔄 2026-09-17 — WATCH THE LOAD, THEN WAIT FOR THE HUB, not the other way
       round. idle() used to come back while the tape was still going, so the two
       sweeps below saw the whole sequence unfold. Now that the hub correctly holds
       itself busy until the drive stops (emu.js, BUSY_WORDS) and then types RUN,
       idling first means looking at a screen the GAME has already painted over —
       the LOAD line and everything under it gone, and both sweeps timing out on a
       machine that did exactly the right thing. */
    const tFound = await untilScreen((r) => after(r, /^LOAD$/).some((x) => /^FOUND /.test(x)), 30000);
    const tTapeReady = await untilScreen((r) => toReady(after(r, /^LOAD$/)).slice(-1)[0] === "READY.", 90000);
    await idle();
    ok(tFound >= 0 && tTapeReady >= 0, `button: the tape is searched, FOUND and loaded   [${after(await screen(), /^LOAD$/).filter(Boolean).join(" | ")}]`);
    await press("F12");
    await idle();
    await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await press("Escape", true);
    /* the reset just cleared the screen, so a FOUND can only come from this */
    const tShiftStop = await untilScreen((r) => r.some((x) => /^FOUND /.test(x)), 30000);
    ok(tShiftStop >= 0 && (await ev("document.getElementById('play').hidden && __cat.inserted()")) === TAPE.id,
       `Shift+Escape is Shift+RUN/STOP: the machine loads from tape itself, and nothing exited   [${took(tShiftStop)}]`);

    /* --- F. eject ---------------------------------------------------------- */
    section("F. Eject empties the drive, as far as the machine is concerned too");
    await press("F12");
    await idle();
    await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await click("#btn-eject");
    await idle();
    const ej = JSON.parse(await ev(`JSON.stringify({ inserted: __cat.inserted(), slot: document.getElementById("drive-slot").textContent,
      label: document.getElementById("drive-label").textContent, cmd: document.getElementById("btn-load").dataset.cmd })`));
    ok(ej.inserted === null && /empty/i.test(ej.slot) && /^Drive/.test(ej.label) && ej.cmd === 'LOAD"*",8,1',
       `the deck shows an empty drive again   [${ej.slot}, ${ej.label}, ${ej.cmd}]`);
    await type('LOAD"$",8\n');
    ok((await untilScreen((r) => toReady(after(r, /^LOAD"\$",8$/)).includes("?FILE NOT FOUND  ERROR"), 30000)) >= 0,
       "and the machine agrees: LOAD\"$\",8 finds nothing");

    /* --- F2. the button, again and again ------------------------------------
       🚨 WHY THIS EXISTS. Typed with the symbolic keymap, `*` came out as a
       SHIFT+* graphic about one press in ten — every other check here passed on
       the run that showed it, because one press is usually fine. emu.js now
       types a button on the C64's own key positions; this is what keeps it
       that way (a 1-in-10 fault misses twelve presses in a row only ~28% of
       the time). The drive is empty, so each LOAD ends fast. */
    section("F2. the Load button types LOAD\"*\",8,1 exactly, twelve presses in a row");
    const typedLines = [];
    for (let i = 0; i < 12; i++) {
      await untilScreen((r) => r.filter(Boolean).slice(-1)[0] === "READY.", 30000);
      await click("#btn-load");
      await until("__cat.machine().busy", 3000, 20);
      await idle();
      await untilScreen((r) => r.filter(Boolean).slice(-1)[0] === "READY.", 30000);
      const rows = (await screen()).filter(Boolean);
      const answer = rows.lastIndexOf("READY.");
      typedLines.push(rows.slice(0, answer).reverse().find((x) => /^LOAD|,8|"\*"/.test(x) && !/^\?/.test(x) && !/^SEARCHING/.test(x)) || "(nothing)");
    }
    const wrong = typedLines.filter((x) => x !== 'LOAD"*",8,1');
    ok(wrong.length === 0, `every press typed exactly LOAD"*",8,1   [${12 - wrong.length}/12${wrong.length ? "; got " + wrong.join(" | ") : ""}]`);
    /* 🆕 2026-09-17 — AND NOT ONE STRAY RUN AMONG THEM. These twelve presses are
       on an EMPTY drive: every one of them FAILS. A failed LOAD still leaves a
       READY. prompt on screen, so a naive "type RUN once it is back at READY."
       would have typed twelve RUNs nobody asked for — which the assertion above
       would not have noticed, because its finder skips any line that is not a
       LOAD. That is precisely the kind of quiet wrongness this rig exists to
       catch, so it is asserted rather than assumed. */
    const strayRuns = (await screen()).filter((r) => r === "RUN").length;
    ok(strayRuns === 0, `and no RUN was typed after any of the twelve failed loads   [${strayRuns} on screen]`);

    /* --- G. keys that reach the hub first ---------------------------------- */
    section("G. with focus on the hub's side, keys still reach the machine");
    await click("#detail");
    ok(!(await ev("document.activeElement === document.getElementById('machine-frame')")), "[control] focus really is on the hub now");
    await type("PRINT 3\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT 3$/))[0] === " 3", 6000)) >= 0,
       "typing with the hub focused lands in the machine, first key included");
    await click("#detail");
    /* 🔄 2026-09-17 — F9, NOT F2, AND THE RIG WAS THE STALE ONE HERE. His call
       the same day made F2 SELECT the keyboard instead of toggling, precisely so
       that someone reaching for the keyboard could never be taken the other way;
       F9 is the key that puts you on the stick. §J2 below already asserts both
       halves of that ruling and passes. This section was still pressing F2 and
       waiting for a flip that the page is right not to make.
       ⭐ What §G is actually for is unchanged: a key struck while the HUB has
       focus must still reach the machine. F9 proves that as well as F2 did. */
    /* ⭐ THE SAME KEY, THE SAME ANSWER, WHICHEVER SIDE HAS FOCUS — which is the
       whole point of this assertion and was not true until 2026-09-18.
       🔄 §G proves two things at once: that a key struck while the HUB has focus
       still reaches the machine, and that it does there what it does on the glass.
       His ruling of 2026-09-17 is that F9 PUTS YOU ON THE STICK. It had been
       written into emu.js's key handler only; the hub's F9 arrives by message and
       went on doing a bare port flip, so the same key behaved two ways depending
       on where the caret was. Both routes go through portKey() now.
       🚫 Do not weaken this back to "the port changed". A port flip is exactly
       the pre-ruling behaviour, so that assertion would go green on the bug. */
    const portWas = String(await ev("document.getElementById('c64-side').dataset.port"));
    await press("F9");
    const tStick = await until("document.getElementById('c64-side').dataset.mode === 'joystick'", 5000);
    const portNow = String(await ev("document.getElementById('c64-side').dataset.port"));
    ok(tStick >= 0 && portNow === portWas,
       `F9 on the hub's side reaches the machine and puts it on the STICK, without swapping an unused port   [port ${portWas} -> ${portNow}]`);
    await click("#btn-listing");
    await idle();
    const tKbd = await until("document.getElementById('c64-side').dataset.mode === 'keyboard'", 5000);
    /* LIST can print a long program and scroll its own line up, so look for it
       anywhere after the PRINT 3 that came before it */
    const tTyped = await untilScreen((r) => after(r, /^PRINT 3$/).includes("LIST"), 8000);
    ok(tKbd >= 0 && tTyped >= 0,
       `a command button in joystick mode switches back to keyboard and still types   [label ${took(tKbd)}, LIST ${took(tTyped)}; ${(await screen()).filter(Boolean).slice(-4).join(" | ")}]`);

    /* --- H. the side panel's ports move the REAL stick ---------------------
       His addendum: click a port (or F9) and that port lights, the other port and
       the keyboard grey out — and "don't ship a toggle that doesn't functionally
       do anything". So the machine itself is asked: a BASIC loop prints both
       joystick registers, PEEK(56320) = control port 2 and PEEK(56321) = port 1
       (idle 127 and 255; the stick pushed UP clears bit 0). */
    section("H. the side panel: a clicked port lights, and the stick really is in that port");
    const typeCmd = async (cmd) => {
      await ev(`__cat.execute(${JSON.stringify(cmd)})`);
      await until("__cat.machine().busy", 3000, 20);
      await idle();
    };
    await typeCmd("NEW");
    await typeCmd("10 PRINT PEEK(56320),PEEK(56321)");
    await typeCmd("20 GOTO 10");
    await typeCmd("RUN");
    const registers = async () => {
      const rows = (await screen()).filter((r) => /^\s*\d+\s+\d+$/.test(r));
      return rows.length ? rows[rows.length - 1].trim().split(/\s+/).map(Number) : null;
    };
    ok((await untilScreen((r) => r.filter((x) => /^\s*127\s+255$/.test(x)).length >= 3, 8000)) >= 0,
       `[control] the loop is running and the stick is idle   [${JSON.stringify(await registers())}]`);
    const holdUp = async () => {
      wc.sendInputEvent({ type: "keyDown", keyCode: "Up" });
      await frames(40);
      const held = await registers();
      wc.sendInputEvent({ type: "keyUp", keyCode: "Up" });
      await frames(25);
      return held;
    };
    await click("#c64-port1");
    const tP1 = await until("document.getElementById('c64-side').dataset.mode === 'joystick' && document.getElementById('c64-side').dataset.port === '1'", 5000);
    let sp = await ev(SIDE);
    ok(tP1 >= 0 && sp.p1 === "lit" && sp.p2 === "grey" && sp.keys === "grey",
       `clicking Port 1 lights it and greys Port 2 and the keyboard   [${JSON.stringify(sp)}]`);
    const up1 = await holdUp();
    ok(up1 && up1[0] === 127 && up1[1] === 254, `and the stick pushed up reads on port 1's register, not port 2's   [${JSON.stringify(up1)}]`);
    await press("F9");
    const tP2 = await until("document.getElementById('c64-side').dataset.port === '2'", 5000);
    sp = await ev(SIDE);
    ok(tP2 >= 0 && sp.p2 === "lit" && sp.p1 === "grey" && sp.keys === "grey", `F9 swaps to Port 2, and the panel follows   [${JSON.stringify(sp)}]`);
    const up2 = await holdUp();
    ok(up2 && up2[0] === 126 && up2[1] === 255, `and now the same stick reads on port 2's register   [${JSON.stringify(up2)}]`);
    await click("#c64-keys");
    const tK = await until("document.getElementById('c64-side').dataset.mode === 'keyboard'", 5000);
    sp = await ev(SIDE);
    ok(tK >= 0 && sp.keys === "lit" && sp.p1 === "grey" && sp.p2 === "grey", `clicking the keyboard lights it and greys both ports   [${JSON.stringify(sp)}]`);
    const upK = await holdUp();
    ok(upK && upK[0] === 127 && upK[1] === 255, `and in keyboard mode the arrow is not a joystick   [${JSON.stringify(upK)}]`);
    /* 🚨 STOP THE LOOP, AND KNOW IT STOPPED. Measured: one RUN/STOP was not
       always enough to break this loop, and a loop left running swallowed
       everything §I typed after it, which read as four swap failures. */
    let tStop = -1;
    for (let attempt = 0; attempt < 4 && tStop < 0; attempt++) {
      await press("Escape");
      tStop = await untilScreen((r) => r.some((x) => /^BREAK IN (10|20)$/.test(x)), 3000);
    }
    ok(tStop >= 0, "RUN/STOP breaks the joystick loop, so nothing is left running");

    /* --- I. a two-sided game: one click, drive 8, and always the side -------
       His multi-disk addendum. The library has no two-sided game today, so this
       uses the rig's own pair (SWAP_FIXTURES, above): two blank disks whose
       directory headers say RIG SIDE A and RIG SIDE B, built byte by byte. */
    section("I. a two-sided game: Side A in, one click to Side B, on drive 8, in the running machine");
    const PAIR = (await ev("__cat.disks().map(function (d) { return { id: d.id, name: d.displayName, n: (d.files || []).length }; })"))
      .find((d) => d.name === SWAP_TITLE);
    ok(!!PAIR && PAIR.n === 2, `the library pairs the two files as ONE game with two sides   [${PAIR ? PAIR.id + ", " + PAIR.n + " sides" : "not found"}]`);
    if (PAIR) {
      const sides = () => ev(`JSON.stringify({ buttons: Array.prototype.map.call(document.querySelectorAll("#side-swap button"), function (b) { return b.textContent; }),
        shown: !document.getElementById("side-swap").hidden, now: document.getElementById("drive-side").hidden ? "" : document.getElementById("drive-side").textContent })`).then(JSON.parse);
      const header = async () => {
        await clearScreen();
        await type('LOAD"$",8\n');
        await untilScreen((r) => toReady(after(r, /^LOAD"\$",8$/)).slice(-1)[0] === "READY.", 60000);
        await type("LIST\n");
        await untilScreen((r) => toReady(after(r, /^LIST$/)).slice(-1)[0] === "READY.", 20000);
        /* ⚠️ .filter(Boolean): a C64 prints a BLANK line after LIST before the
           listing, so the first row after it is always empty (measured: this read
           "" three times on a machine that had listed both sides correctly) */
        return (toReady(after(await screen(), /^LIST$/)).filter(Boolean)[0] || "").replace(/\s+/g, " ");
      };
      let s0 = await sides();
      ok(!s0.shown && s0.now === "", "[control] no swap control while no two-sided game is in");
      await ev(`__cat.select(${JSON.stringify(PAIR.id)})`);
      await click("#btn-insert");
      await until(`__cat.inserted() === ${JSON.stringify(PAIR.id)}`, 60000);
      await idle();
      s0 = await sides();
      ok(s0.shown && s0.buttons.join("|") === "Swap to Side B" && s0.now === "Now playing: Side A",
         `it goes in on Side A: ONE button, "Swap to Side B", and the drive says which side   [${s0.buttons.join("|")} / ${s0.now}]`);
      const hA = await header();
      /* on a miss, say what the machine and the page were doing (it has missed
         intermittently; the screen and focus are the evidence) */
      const why = async () => `; focus ${await ev("document.activeElement.id || document.activeElement.tagName")}; machine ${JSON.stringify(await inMachine("CAT_EMU.machine()"))
        }; frames/s ${await (async () => { const a = await frameNow(); await wait(1000); return (await frameNow()) - a; })()}; screen: ${(await screen()).filter(Boolean).slice(-6).join(" / ")}`;
      ok(/^0 "RIG SIDE A/.test(hA), `the machine reads Side A on drive 8   [${hA}${/^0 "RIG SIDE A/.test(hA) ? "" : await why()}]`);
      await click("#side-swap button");
      const tSwap = await until("document.getElementById('drive-side').textContent === 'Now playing: Side B'", 30000);
      await idle();
      const s1 = await sides();
      ok(tSwap >= 0 && s1.buttons.join("|") === "Swap to Side A", `one click: Side B is in, and the button now offers Side A   [${took(tSwap)}, ${s1.buttons.join("|")}]`);
      ok((await screen()).some((r) => /^0 "RIG SIDE A/.test(r)),
         "the machine was NOT reset by the swap: Side A's listing is still on its screen");
      const hB = await header();
      ok(/^0 "RIG SIDE B/.test(hB), `and the same drive 8 now reads Side B   [${hB}]`);
      await click("#side-swap button");
      await until("document.getElementById('drive-side').textContent === 'Now playing: Side A'", 30000);
      await idle();
      const hA2 = await header();
      ok(/^0 "RIG SIDE A/.test(hA2), `and back: one click, Side A again   [${hA2}]`);
      await click("#btn-eject");
      await idle();
      const s2 = await sides();
      ok(!s2.shown && s2.now === "", "Eject takes the swap control and the side label away with the disk");
    }

    /* --- J. the positional keymap, row by row ---------------------------------
       His ruling, 2026-09-17: the machine types on a real C64's KEY POSITIONS.
       🔄 2026-09-17, later the same day: the rig presses the CHARACTER a player
       would press and reads what the machine stored back out of screen memory,
       so the row, the translator and the keymap are all proved at once,
       player's hands.

       🔄 2026-09-17, later the same day — THE CARD THAT SHOWED THESE IS GONE, on
       his word, and this section deliberately did NOT go with it. The card was
       markup; these rows are MEASUREMENTS, and they are still the only row-by-row
       proof the positional keymap is right (§A only reads a setting, §B tests one
       character, §D tests one). So the table is read from the TOOLING SURFACE now
       instead of off the DOM, and the press loop is untouched.
       🚨 The two assertions that measured the card's PIXELS — where it sat in the
       panel, and that it dimmed in joystick mode — are deleted rather than
       adapted: there is nothing left to measure. They would not have failed
       cleanly either. getElementById returns null for a deleted card, and
       .getBoundingClientRect() on null THROWS, which unwinds to this file's one
       catch and silently takes §L, §K and §Z down with it — a whole run lost to
       one deleted element, reported as a single failure. */
    section("J. the positional keymap: every measured key types its character");
    const card = JSON.parse(await ev(`JSON.stringify(__cat.keycard())`));
    ok(card.length >= 17 && ['"', "*", ":", "@"].every((c) => card.some((r) => r.c64 === c)),
       `the hub still carries the measured key map, including the ones his ruling names: " * : @   [${card.length} rows]`);
    ok((await ev(`!document.getElementById("c64-keycard")`)) === true,
       "and the card itself is off the panel, as he asked");
    /* the screen code a typed character leaves at $0400 */
    const SCREEN_CODE = { "@": 0, "[": 27, "£": 28, "]": 29, "↑": 30, "←": 31 };
    const codeOf = (ch) => (ch in SCREEN_CODE ? SCREEN_CODE[ch] : ch.charCodeAt(0));
    const misses = [];
    await click("#machine-frame");
    for (const row of card) {
      await clearScreen();
      /* ⭐ THE ROW IS A C64 KEY POSITION, AND A PLAYER NEVER PRESSES ONE. Since
         his ruling of 2026-09-17 the page translates the character printed on
         the PC key into that position (emu.js, relayKey), so the rig presses the
         CHARACTER — and this section now proves the whole chain end to end: the
         card's row, the KEYS table it feeds, and the positional keymap under it.
         A wrong row still goes red here, which is what it is for.
         📌 `←` `£` `↑` are on no PC keyboard at all, so for those three the raw
         position is pressed instead. The page leaves them alone: their key names
         are longer than one character, and nothing translates those. */
      if (TYPEABLE.test(row.c64)) await type(row.c64);
      else {
        const shift = /^Shift\+./.test(row.key);
        await press(shift ? row.key.slice(6) : row.key, shift);
      }
      await frames(8);
      const got = Number(await ev(`${FRAME}.EJS_emulator.gameManager.Module.HEAPU8[${RAM} + 0x400]`));
      if (got !== codeOf(row.c64)) misses.push(`${row.c64} (pressed as itself; the card puts it on ${row.key}) came out as screen code ${got}`);
      /* 🚨 RETURN before the next clear: after a `"` the C64 is in quote mode, and
         Shift+CLR/HOME then PRINTS a symbol instead of clearing (measured) */
      await press("Enter");
      await frames(20);
    }
    ok(card.length > 0 && misses.length === 0,
       `pressed where the map says, every row types its character   [${card.length - misses.length}/${card.length}${misses.length ? "; " + misses.join("; ") : ""}]`);

    /* --- J2. the corner's hardware --------------------------------------------
       🆕 2026-09-17 — his ten changes to the C64 corner. Everything here was a
       GAP before today: nothing in either rig asserted where Eject lived, that a
       cable follows the live port, that the drive lamps mean anything, or that
       the monitor bezel stays out of the ordinary hub. A change nobody checks is
       a change that quietly comes undone. */
    section("J2. the corner: the ports, the cable, the drive's lamps and the bezel");
    const corner = JSON.parse(await ev("JSON.stringify(__cat.corner())"));
    ok(corner.insertBy === "crates" && corner.ejectBy === "crates",
       `Eject sits with Insert, where the disks are   [insert ${corner.insertBy}, eject ${corner.ejectBy}]`);
    ok(corner.cartPort && corner.drivePort, "the panel has a cartridge port and a drive port");
    ok(corner.cartridge === null, `no .CRT game is in the port, as it must be with none in the library   [${corner.cartridge}]`);
    /* 🆕 2026-09-17 — the fast loader IS a cartridge, so "off" means standing
       out of the slot and "on" means seated in it. The position is the state. */
    ok(corner.fastLoad === false && corner.fastSeated === false,
       "the fast-load cartridge starts out of the port, so the corner runs at the real machine's speed");
    ok(corner.monitor === true, "the screen wears the monitor bezel");
    ok(corner.lamps.power === true && corner.lamps.loading === false && corner.lamps.failed === false,
       `the drive's green light is on and steady, and the red one is dark when idle   [${JSON.stringify(corner.lamps)}]`);
    /* his ruling froze the port labels black, so the CABLE is the only thing left
       that says which port the stick is in — and it must follow the machine's
       report, not the click */
    ok(corner.cable === false, "[control] no joystick shown while the keyboard is the input");
    await press("F9");   /* F9 selects the stick; F2 only ever selects the keyboard */
    await until("document.getElementById('c64-side').dataset.mode === 'joystick'", 5000);
    await wait(300);
    const onPort = JSON.parse(await ev("JSON.stringify(__cat.corner())"));
    const litPort = String(await ev("document.getElementById('c64-side').dataset.port"));
    ok(onPort.cable === true && onPort.cablePort === litPort,
       `a joystick shows on the port the stick is really in   [port ${litPort}, stick on ${onPort.cablePort}]`);
    await press("F9");
    await until("document.getElementById('c64-side').dataset.port === " + JSON.stringify(litPort === "1" ? "2" : "1"), 5000);
    await wait(300);
    const swapped = JSON.parse(await ev("JSON.stringify(__cat.corner())"));
    ok(swapped.cablePort === (litPort === "1" ? "2" : "1"),
       `and it moves when the port changes   [now on ${swapped.cablePort}]`);
    /* 🚨 the joystick sits inside the port button: it must never eat a click
       meant for the port itself (pointer-events:none). The rig clicks a port at
       its CENTRE, so this is exactly the failure mode. */
    const hit = String(await ev(`(function () {
      var r = document.getElementById("c64-port" + ${JSON.stringify(litPort)}).getBoundingClientRect();
      var e = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return e ? (e.closest(".c64-port") ? "port" : (e.id || e.tagName)) : "none"; })()`));
    ok(hit === "port", `and it cannot swallow a click meant for the port   [hit ${hit}]`);
    await press("F2");
    await until("document.getElementById('c64-side').dataset.mode === 'keyboard'", 5000);
    await wait(300);
    ok(JSON.parse(await ev("JSON.stringify(__cat.corner())")).cable === false,
       "and it goes away again when the keyboard is chosen");

    /* 🆕 2026-09-17 — F2 SELECTS the keyboard, it does not toggle. Pressing it
       when the keyboard is already live must be a NO-OP: a toggle there would
       throw the player onto the joystick, which is the opposite of what someone
       reaching for the keyboard wants. */
    await press("F2");
    await wait(500);
    ok(String(await ev("document.getElementById('c64-side').dataset.mode")) === "keyboard",
       "F2 pressed again keeps the keyboard, it does not toggle away from it");
    /* and F9 from the keyboard puts you ON the stick, rather than silently
       swapping a port you are not using */
    await press("F9");
    await until("document.getElementById('c64-side').dataset.mode === 'joystick'", 5000);
    ok(String(await ev("document.getElementById('c64-side').dataset.mode")) === "joystick",
       "F9 from the keyboard selects the joystick, instead of swapping an unused port");
    await press("F2");
    await until("document.getElementById('c64-side').dataset.mode === 'keyboard'", 5000);
    /* the F-key hints: his ask was weight and colour, which no assertion can
       judge — but the TEXT must stay bare, because §A asserts exactly "F2 F9 F12" */
    const caps = JSON.parse(await ev(`JSON.stringify(["c64-keys-hint", "c64-port-hint", "btn-reset-hint"].map(function (id) {
      var e = document.getElementById(id), s = getComputedStyle(e);
      return { t: e.textContent, w: s.fontWeight, cap: s.backgroundImage.indexOf("gradient") >= 0 }; }))`));
    ok(caps.every((c) => c.w === "700" && c.cap) && caps.map((c) => c.t).join(" ") === "F2 F9 F12",
       `the F-key hints are bold keycaps and their text is still bare   [${caps.map((c) => c.t).join(" ")}]`);

    /* --- P. Pause and Full Screen (2026-09-25) ---------------------------------
       Chat's handoff, his rulings the same day. Pause is MEASURED here on the
       running core before anything relies on it: the frame counter must stop,
       nothing typed while paused may reach the machine (the C64's own keyboard
       buffer at $C6 must stay empty), F2/F9/F12 and the port clicks must do
       nothing, and the machine must come back exactly where it was, with the
       keyboard in BASIC and no click needed.
       ⭐ THE HELD-KEY CHECK READS THE C64's OWN KEY SCAN. $CB is the matrix code
       of the key down right now (64 = none; Space = 60). A key held when Pause
       was clicked and let go while paused must read 64 after resume — if the
       release were swallowed with the presses, it would read 60 forever.
       📌 Sits before §L for the same reason §L does: §K throws this window away. */
    section("P. Pause: the machine freezes, takes no key, and comes back exactly where it was");
    const peek = async (a) => Number(await ev(`(() => { try { return ${FRAME}.EJS_emulator.gameManager.Module.HEAPU8[${RAM} + ${a}]; } catch (e) { return -1; } })()`));
    const PAUSE_LOOK = `JSON.stringify((function () {
      var b = document.getElementById("c64-pause"), s = document.getElementById("screen-paused");
      var f = document.getElementById("machine-frame").getBoundingClientRect();
      var hit = document.elementFromPoint(Math.round(f.left + f.width / 2), Math.round(f.top + f.height / 2));
      return { lit: b.classList.contains("is-lit"), pressed: b.getAttribute("aria-pressed"), disabled: b.disabled,
               sign: !s.hidden && getComputedStyle(s).display !== "none", text: s.textContent.trim(),
               glass: hit ? hit.id : null, paused: __cat.machine().paused }; })())`;
    await click("#machine-frame");
    await press("Home", true);
    await type("X=7\n");
    await untilScreen((r) => toReady(after(r, /^X=7$/))[0] === "READY.", 5000);
    const pm0 = await ev("__cat.machine()");
    ok(pm0.pauseAvailable && !pm0.paused, `[control] Pause is available on an idle machine, and it is running   [available ${pm0.pauseAvailable}, paused ${pm0.paused}]`);
    await click("#c64-pause");
    const tPause = await until("__cat.machine().paused === true", 5000);
    const fA = await frameNow(); await wait(1500); const fB = await frameNow();
    ok(tPause >= 0 && fB === fA, `the clock stops: no frames pass while paused   [${took(tPause)}, ${fB - fA} frames in 1.5s]`);
    ok((await inMachine("CAT_EMU.machine().paused")) === true && (await inMachine("EJS_emulator.paused")) === true,
       "the machine page and the core both say paused (painted from the machine's answer)");
    const pl = JSON.parse(await ev(PAUSE_LOOK));
    ok(pl.lit && pl.pressed === "true" && pl.sign && pl.text === "PAUSED",
       `the button is lit and PAUSED shows over the frozen screen   [${JSON.stringify(pl)}]`);
    ok(pl.glass === "machine-frame", `the PAUSED sign cannot take a click meant for the glass   [hit ${pl.glass}]`);
    const screenBefore = text(await screen());
    const sideBefore = await ev(SIDE);
    await press("Z");
    await type("P1\n");
    await press("F9");
    await press("F2");
    await press("F12");
    await click("#c64-port1");
    await click("#c64-keys");
    await click("#btn-list");
    await wait(800);
    ok(text(await screen()) === screenBefore && (await peek(198)) === 0,
       `keys typed while paused reach nothing: the screen is unchanged and the C64's key buffer is empty   [$C6 ${await peek(198)}]`);
    const sideDuring = await ev(SIDE);
    ok(sideDuring.mode === sideBefore.mode && sideDuring.port === sideBefore.port,
       `F9, F2 and clicks on the ports and keyboard change nothing while paused   [${sideBefore.mode}/${sideBefore.port} -> ${sideDuring.mode}/${sideDuring.port}]`);
    ok(!(await ev("__cat.machine().busy")) && (await frameNow()) === fB,
       "Load does not start, and F12 does not reset: the clock never moved");
    /* resume with the MOUSE, then type straight away — no click on the glass first */
    await click("#c64-pause");
    const tRes = await until("__cat.machine().paused === false", 5000);
    await frames(5);
    const fC = await frameNow();
    ok(tRes >= 0 && fC > fB, `Pause again resumes it: the clock runs on from where it stopped   [${took(tRes)}, ${fB} -> ${fC}]`);
    ok(!JSON.parse(await ev(PAUSE_LOOK)).sign, "and the PAUSED sign is gone");
    await type("PRINT X*6\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT X\*6$/))[0] === " 42", 6000)) >= 0,
       `the very next keys go into BASIC, and X is still 7: nothing was lost and nothing reset   [${(await screen()).filter(Boolean).slice(-2).join(" | ")}]`);
    /* the held key */
    wc.sendInputEvent({ type: "keyDown", keyCode: "Space" });
    await frames(10);
    const held0 = await peek(203);
    await click("#c64-pause");
    await until("__cat.machine().paused === true", 5000);
    wc.sendInputEvent({ type: "keyUp", keyCode: "Space" });
    await wait(300);
    await click("#c64-pause");
    await until("__cat.machine().paused === false", 5000);
    await frames(20);
    const held1 = await peek(203);
    ok(held0 === 60 && held1 === 64,
       `a key held when Pause was clicked, and let go while paused, is not stuck down on resume   [$CB ${held0} -> ${held1}]`);
    await press("Enter");
    /* refused while the machine is busy */
    await ev(`__cat.execute('PRINT "PAUSE WAITS FOR THE TYPING"')`);
    await until("__cat.machine().busy", 3000, 20);
    const busyLook = await ev("__cat.machine()");
    await click("#c64-pause");
    await wait(150);
    const busyAfter = await ev("__cat.machine()");
    ok(busyLook.pauseHeld && !busyLook.pauseAvailable && !busyAfter.paused,
       `while a typed command is going in, Pause shows unavailable and a click does not pause   [held ${busyLook.pauseHeld}, paused ${busyAfter.paused}]`);
    await idle();
    ok((await untilScreen((r) => r.includes("PAUSE WAITS FOR THE TYPING"), 5000)) >= 0 && (await ev("__cat.machine()")).pauseAvailable,
       "the command went in whole, and Pause is available again once it has");

    section("P2. Full Screen: the monitor fills the window, the strip sits under it, and the same parts work there");
    await ev(`__cat.select(${JSON.stringify(DISK.id)})`);
    await click("#btn-insert");
    await until(`__cat.inserted() === ${JSON.stringify(DISK.id)}`, 60000);
    await idle();
    /* shots for a human eye — in the OS temp folder, NEVER under Game/ (a public
       Pages root) */
    const shot = async (name) => { const f = join(tmpdir(), name); await wc.capturePage().then((img) => writeFileSync(f, img.toPNG())); say(`        (shot: ${f})`); };
    await shot("verify-c64-corner.png");
    /* 🆕 2026-09-25 — the fast loader standing OUT must not sit on the note line */
    const over = JSON.parse(await ev(`JSON.stringify((function () {
      var f = document.getElementById("btn-fastload").getBoundingClientRect(), n = document.getElementById("deck-note").getBoundingClientRect();
      return { fast: [Math.round(f.top), Math.round(f.bottom)], note: [Math.round(n.top), Math.round(n.bottom)],
               seated: document.getElementById("btn-fastload").classList.contains("is-seated") }; })())`));
    ok(!over.seated && over.fast[1] <= over.note[0],
       `the fast-load cartridge, standing out, clears the deck's note line   [cart ${over.fast.join("-")}, note ${over.note.join("-")}]`);
    await click("#c64-full");
    await until("__cat.machine().full === true", 3000);
    await wait(400);
    await shot("verify-c64-full.png");
    const FULL_LOOK = `JSON.stringify((function () {
      var r = function (id) { var b = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
      var d = function (id) { return getComputedStyle(document.getElementById(id)).display; };
      return { win: { w: innerWidth, h: innerHeight }, frame: r("machine-frame"), side: r("c64-side"), crates: r("crates"),
               ejectIn: document.getElementById("btn-eject").parentNode.id, swapIn: document.getElementById("side-swap").parentNode.id,
               insertIn: document.getElementById("btn-insert").parentNode.id,
               cart: d("c64-cart"), iec: d("c64-iec"), deckTop: d("deck-top"),
               label: document.getElementById("c64-full-label").textContent,
               ids: ["c64-power", "c64-port1", "c64-port2", "c64-keys", "c64-pause", "c64-full", "btn-eject", "side-swap"]
                 .map(function (id) { return document.querySelectorAll("#" + id).length; }).join("") }; })())`;
    const L = JSON.parse(await ev(FULL_LOOK));
    ok(L.crates.w === 0 && L.frame.w >= L.win.w - 2 && L.frame.h >= L.win.h * 0.8,
       `the screen fills the window and the disks step aside   [frame ${L.frame.w}x${L.frame.h} of ${L.win.w}x${L.win.h}, crates ${L.crates.w}px]`);
    ok(L.side.t >= L.frame.b - 1 && L.side.b <= L.win.h + 1,
       `the strip sits UNDER the screen, not over it   [screen ends ${L.frame.b}, strip ${L.side.t}-${L.side.b}]`);
    ok(L.ejectIn === "c64-side" && L.swapIn === "c64-side" && L.ids === "11111111",
       `Eject and the side swap MOVED into the strip, and nothing was copied   [eject ${L.ejectIn}, swap ${L.swapIn}, ids ${L.ids}]`);
    ok(L.cart === "none" && L.iec === "none" && L.deckTop === "none",
       `the cartridge port, the drive port, Load and Reset stay out of the strip   [${L.cart}/${L.iec}/${L.deckTop}]`);
    ok(L.label === "Exit Full Screen", `the Full Screen part reads Exit Full Screen   [${L.label}]`);
    /* 🆕 2026-09-25 — his change: errors must not be invisible in full screen */
    const noteFull = JSON.parse(await ev(`JSON.stringify((function () {
      var n = document.getElementById("deck-note"), b = n.getBoundingClientRect(), f = document.getElementById("machine-frame").getBoundingClientRect();
      return { shown: !n.hidden && getComputedStyle(n).display !== "none" && b.height > 0, t: Math.round(b.top), b: Math.round(b.bottom),
               screenEnds: Math.round(f.bottom), H: innerHeight, text: n.textContent, api: __cat.note() }; })())`));
    ok(noteFull.shown && noteFull.t >= noteFull.screenEnds && noteFull.b <= noteFull.H && noteFull.text !== "" && noteFull.text === noteFull.api,
       `the hub's message line is in the strip, under the screen, and says what the hub last said   [${noteFull.t}-${noteFull.b}, "${noteFull.text}"]`);
    /* ⚠️ The frame's OWN document and window: an unqualified `document` in an
       ev() is the hub's, which has no canvas (the first run said "no canvas"). */
    const pic = JSON.parse(await ev(`(function () { try { var w = ${FRAME}, c = w.document.querySelector("canvas"); if (!c) return "null";
      var b = c.getBoundingClientRect(); return JSON.stringify({ w: b.width, h: b.height, W: w.innerWidth, H: w.innerHeight }); } catch (e) { return "null"; } })()`));
    ok(pic && Math.max(pic.w / pic.W, pic.h / pic.H) > 0.95,
       `the C64's picture scales up to fit the space above the strip   [${pic ? Math.round(pic.w) + "x" + Math.round(pic.h) + " in " + pic.W + "x" + pic.H : "no canvas"}]`);
    await click("#c64-port1");
    await until("document.getElementById('c64-side').dataset.mode === 'joystick' && document.getElementById('c64-side').dataset.port === '1'", 5000);
    let fs = await ev(SIDE);
    ok(fs.p1 === "lit" && fs.p2 === "grey" && fs.keys === "grey", `in the strip, clicking Port 1 lights it and greys the rest   [${JSON.stringify(fs)}]`);
    await press("F9");
    await until("document.getElementById('c64-side').dataset.port === '2'", 5000);
    fs = await ev(SIDE);
    ok(fs.p2 === "lit" && fs.p1 === "grey" && fs.keys === "grey", `F9 swaps to Port 2 in the strip   [${JSON.stringify(fs)}]`);
    await click("#c64-keys");
    await until("document.getElementById('c64-side').dataset.mode === 'keyboard'", 5000);
    fs = await ev(SIDE);
    ok(fs.keys === "lit" && fs.p1 === "grey" && fs.p2 === "grey", `and the keyboard lights, greying both ports   [${JSON.stringify(fs)}]`);
    await type("PRINT X\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT X$/))[0] === " 7", 6000)) >= 0,
       "the machine carried on through the change of view: X is still 7");
    /* Eject, paused, in full screen: his ruling is that Eject works WITHOUT
       unpausing, and in full screen it also leaves full screen */
    await click("#c64-pause");
    await until("__cat.machine().paused === true", 5000);
    await wait(300);
    await shot("verify-c64-full-paused.png");
    await click("#btn-eject");
    const tEj = await until("__cat.inserted() === null && __cat.machine().full === false", 20000);
    const E = JSON.parse(await ev(FULL_LOOK));
    ok(tEj >= 0 && E.crates.w > 100 && E.ejectIn === "crates" && E.swapIn === "crates" && E.insertIn === "crates",
       `Eject in full screen ejects AND leaves full screen: the disks are back, Eject and the swap are home   [${took(tEj)}, crates ${E.crates.w}px, eject ${E.ejectIn}]`);
    ok((await ev("__cat.machine().paused")) === true && (await inMachine("CAT_EMU.machine().medium")) === null,
       "and it worked without unpausing: still paused, and the machine's drive is empty");
    ok(E.label === "Full Screen", `the part reads Full Screen again   [${E.label}]`);
    await click("#c64-pause");
    await until("__cat.machine().paused === false", 5000);
    /* Exit Full Screen leaves full screen only */
    await click("#c64-full");
    await until("__cat.machine().full === true", 3000);
    const fD = await frameNow();
    await click("#c64-full");
    const tOut = await until("__cat.machine().full === false", 3000);
    await frames(10);
    ok(tOut >= 0 && (await frameNow()) > fD && !(await ev("__cat.machine().paused")),
       "Exit Full Screen goes back to the whole corner, and the machine keeps running");
    await type("PRINT X+1\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT X\+1$/))[0] === " 8", 6000)) >= 0,
       "with the keyboard straight back in BASIC, and nothing lost: X is still 7");

    /* --- L. the book reader ---------------------------------------------------
       His ruling, 2026-09-16/17: the shelf in the room opens a reader, and the
       reader draws HERE, over the machine, so a page can be read and typed in
       while the C64 stays live. His four asks are checked below — on top,
       reshape-able, page turns, a close control — but the one that matters is
       the last block: AFTER clicking the reader's own controls with the real
       mouse, the rig types a listing straight off the page and the machine
       receives every character. That is the use case, and focus is the way it
       breaks: a control that takes the keyboard sends the player's next line
       into a page turn instead of into BASIC.

       📌 IT SITS BEFORE §K ON PURPOSE. §K destroys this window and re-points
       every helper at a second, preload-less one, so anything needing the
       corner's machine has to come first. The letters are the order these were
       built, not the order they run — as §A/§C/§D/§B already are. */
    section("L. the book reader: it opens over the machine, and a listing types off it");

    const bookIds = JSON.parse(await ev("JSON.stringify(__cat.books())"));
    ok(bookIds.length === 6, `the shelf holds the six books   [${bookIds.join(", ")}]`);

    /* 🚨 EVERY LISTING IN books.js, AGAINST THE KEYS THIS MACHINE HAS. Not a
       run — the rig types one listing below, and the rest are still unrun — but
       a listing containing a character the corner cannot produce is a page that
       can never be followed, and that is worth catching for all eighteen at
       once rather than one at a time. The test is the rig's own `type()`.
    const allCode = JSON.parse(await ev(`JSON.stringify((window.CAT_BOOKS || []).map(function (b) {
      return { id: b.id, lines: b.pages.reduce(function (a, p) {
        (p.blocks || []).forEach(function (k) { if (k.code) a = a.concat(k.code); }); return a; }, []) }; }))`));
    const untypeable = [];
    let lineCount = 0;
    allCode.forEach((b) => b.lines.forEach((l) => {
      lineCount++;
      for (const ch of l) {
        if (TYPEABLE.test(ch)) continue;
        untypeable.push(`${b.id}: ${JSON.stringify(ch)} in ${JSON.stringify(l)}`);
      }
    }));
    ok(untypeable.length === 0,
       `every line of every listing can be typed on this keyboard   [${lineCount} lines${untypeable.length ? "; " + untypeable.slice(0, 3).join("; ") : ""}]`);

    /* the shelf, then a spine, both with the real mouse */
    await ev("__cat.openBook(null)");
    await until("__cat.book() && __cat.book().shelf === true", 5000);
    const spines = JSON.parse(await ev("JSON.stringify(__cat.book().spines)"));
    ok(spines.length === 6, `the shelf shows six spines to click   [${spines.join(", ")}]`);
    await click('#reader-spines [data-book="nightshift"]');
    const opened = JSON.parse(await ev("JSON.stringify(__cat.book())"));
    ok(opened && opened.id === "nightshift" && opened.page === 0,
       `clicking a spine opens that book at page 1   [${opened && opened.title}]`);

    /* his point 1: on top of the machine, not behind it */
    const onTop = JSON.parse(await ev(`JSON.stringify((function () {
      var r = document.getElementById("reader").getBoundingClientRect();
      var f = document.getElementById("machine-frame").getBoundingClientRect();
      var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
      var hit = document.elementFromPoint(x, y);
      return { over: x > f.left && x < f.right && y > f.top && y < f.bottom,
               inReader: !!(hit && hit.closest && hit.closest("#reader")),
               hit: hit ? (hit.id || hit.className || hit.tagName) : null }; })())`));
    ok(onTop.over && onTop.inReader,
       `it lies ON the machine's screen, and the machine is not in front of it   [hit ${onTop.hit}]`);

    /* ⭐⭐ THE USE CASE. No click on the machine first, deliberately: the last
       thing the mouse touched was the reader, and the keys must still arrive. */
    const focusNow = async () => String(await ev(`(function () { var e = document.activeElement; return e ? (e.id || e.tagName) : "none"; })()`));
    const clearL = async () => { await press("Home", true); return await untilScreen((r) => r.every((x) => x === ""), 5000); };

    /* 🚨 TWO CONTROLS BEFORE THE LONG LISTING, so a red line names its own
       cause. If the screen will not clear, or one short line will not reach
       BASIC, then nothing below is about the listing and everything below it is
       noise — it is the keyboard, and the label says where focus actually was. */
    const cleared = await clearL();
    ok(cleared >= 0, `[control] with the reader open, the screen still clears   [focus ${await focusNow()}${cleared < 0 ? "; Shift+CLR/HOME did nothing" : ", " + cleared + "ms"}]`);
    await type("PRINT 1+1\n");
    const alive = await untilScreen((r) => r.some((x) => x === " 2"), 10000);
    ok(alive >= 0, `[control] and a line typed with the mouse last on the READER reaches BASIC   [focus ${await focusNow()}, ${alive < 0 ? "NEVER" : alive + "ms"}]`);

    await clearL();
    await type("NEW\n");
    await frames(20);
    const listing = JSON.parse(await ev("JSON.stringify(__cat.listings())"))[0] || [];
    const program = listing.filter((l) => /^\d/.test(l));   /* the lines, not RUN */
    ok(program.length >= 2, `the page hands the rig a listing to type   [${program.length} numbered lines]`);
    for (const l of program) { await type(l + "\n"); await frames(14); }
    await clearL();
    await type("LIST\n");
    const listed = await untilScreen((r) => toReady(after(r, /^LIST$/)).slice(-1)[0] === "READY.", 20000);
    const rowsBack = await screen();
    const back = toReady(after(rowsBack, /^LIST$/)).filter(Boolean);
    /* 🚨 SPACES ARE NOT THE POINT. Whether LIST puts one space after the line
       number or repeats the one that was typed is BASIC's business; what is
       being asserted is that every CHARACTER arrived. Runs of spaces collapse. */
    const flat = (a) => a.map((s) => s.replace(/\s+/g, " ").trim()).join("|");
    ok(listed >= 0 && flat(back) === flat(program.concat(["READY."])),
       `typed straight off the page with the mouse last on the READER, the machine stored every character   [${
         back.length ? back.join(" / ") : "screen: " + JSON.stringify(rowsBack.filter(Boolean).slice(-4))}]`);

    /* his point 3, and the focus trap again: a page turn is a mouse click on a
       control, and the very next keystroke must still be BASIC's */
    await click("#reader-next");
    const turned = JSON.parse(await ev("JSON.stringify(__cat.book())"));
    ok(turned.page === 1, `Next turns the page   [page ${turned.page + 1} of ${turned.pages}]`);
    await clearL();
    await type("PRINT 7*6\n");
    const sum = await untilScreen((r) => r.some((x) => x === " 42"), 8000);
    ok(sum >= 0, `and the keyboard is still the machine's after the click   [PRINT 7*6 -> 42, ${sum}ms]`);
    await click("#reader-prev");
    ok(JSON.parse(await ev("JSON.stringify(__cat.book())")).page === 0, "Back turns it again");
    await click("#reader-shelf");
    ok(JSON.parse(await ev("JSON.stringify(__cat.book())")).shelf === true, "and Shelf goes back to the six");

    /* his point 2: reshape-able, and never off the edge of the window */
    await ev("__cat.openBook('peekpoke')");
    const before = JSON.parse(await ev("JSON.stringify(__cat.book().rect)"));
    const drag = async (sel, dx, dy) => {
      const r = JSON.parse(await ev(`JSON.stringify((function (el) { var b = el.getBoundingClientRect();
        return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })(document.querySelector(${JSON.stringify(sel)})))`));
      wc.sendInputEvent({ type: "mouseDown", x: r.x, y: r.y, button: "left", clickCount: 1 });
      await wait(60);
      for (let i = 1; i <= 4; i++) {
        wc.sendInputEvent({ type: "mouseMove", x: r.x + (dx * i) / 4, y: r.y + (dy * i) / 4, button: "left" });
        await wait(40);
      }
      wc.sendInputEvent({ type: "mouseUp", x: r.x + dx, y: r.y + dy, button: "left", clickCount: 1 });
      await wait(120);
    };
    await drag("#reader-bar", -120, 60);
    const moved = JSON.parse(await ev("JSON.stringify(__cat.book().rect)"));
    ok(Math.abs(moved.left - before.left) > 40 && Math.abs(moved.top - before.top) > 20,
       `the title bar drags it   [${before.left},${before.top} -> ${moved.left},${moved.top}]`);
    await drag("#reader-resize", 90, 70);
    const sized = JSON.parse(await ev("JSON.stringify(__cat.book().rect)"));
    ok(sized.width > moved.width + 30 && sized.height > moved.height + 20,
       `the corner resizes it   [${moved.width}x${moved.height} -> ${sized.width}x${sized.height}]`);
    /* dragged hard at the edge, it stays whole and reachable */
    await drag("#reader-bar", -4000, -4000);
    const pinned = JSON.parse(await ev("JSON.stringify(__cat.book().rect)"));
    ok(pinned.left >= 0 && pinned.top >= 0,
       `and it cannot be dragged off the window and lost   [${pinned.left},${pinned.top}]`);

    /* his point 4 */
    await click("#reader-close");
    ok((await ev("JSON.stringify(__cat.book())")) === "null", "Close puts the book away");
    await clearL();
    await type("PRINT 1+1\n");
    ok((await untilScreen((r) => r.some((x) => x === " 2"), 8000)) >= 0,
       "and the machine still has the keyboard once it is gone");

    /* --- K. outside Fang Rock: the play overlay swaps sides too ---------------
       His ruling, 2026-09-17: fix the ORDINARY hub's swap, in line with the
       machine's. It never worked (method names EmulatorJS 4.2.3 does not have,
       and only side 1 handed to the core). Outside Fang Rock a library disk runs
       in the play overlay, not the machine, so this needs a window WITHOUT the
       shell's preload. The machine's window closes first, so two cores are not
       running at once, and from here on the helpers read the overlay's frame. */
    section("K. outside Fang Rock: a two-sided game in the play overlay swaps sides, without a reset");
    if (PAIR) {
      const plain = new BrowserWindow({ width: 1280, height: 860, show: false,
        webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
      win.destroy();
      wc = plain.webContents;
      wc.setFrameRate(60);
      FRAME = "document.getElementById('play-frame').contentWindow";
      RAM = -1;
      await wc.loadURL(URL_HUB);
      ok((await until("window.__cat && window.fangRockShell !== true && __cat.machine().on === false", 20000)) >= 0,
         "[control] a plain window: the ordinary hub, with no machine on its screen");
      await until(`__cat.disks().some(function (d) { return d.id === ${JSON.stringify(PAIR.id)}; })`, 30000);
      await ev(`__cat.select(${JSON.stringify(PAIR.id)})`);
      await ev("__cat.insert()");
      await until(`__cat.inserted() === ${JSON.stringify(PAIR.id)}`, 10000);
      await ev(`__cat.execute('LOAD"*",8,1')`);
      const tPlay = await until(`__cat.playing() && __cat.running() === ${JSON.stringify(PAIR.id)}`, 60000);
      const sidesNamed = ((await ev("__cat.playingSrc()")) || "").split(/[?&]d=/).length - 1;
      ok(tPlay >= 0 && sidesNamed === 2, `the ordinary hub runs it in the play overlay, both sides named   [${took(tPlay)}, ${sidesNamed} sides]`);
      const tCore = await until(`(() => { try { return ${FRAME}.EJS_emulator.gameManager.getFrameNum() > 60; } catch (e) { return false; } })()`, 90000);
      /* the core's own count: 1 when it was handed side 1 alone (the old bug) */
      const count = await inMachine("EJS_emulator.gameManager.getDiskCount()");
      ok(tCore >= 0 && count === 2, `the core started holding BOTH sides, not side 1 alone   [${took(tCore)}, ${count} disks]`);
      const tRam2 = await (async () => { const t0 = Date.now();
        while (Date.now() - t0 < 30000) { RAM = await locateRam(); if (RAM >= 0) return Date.now() - t0; await wait(300); } return -1; })();
      ok(tRam2 >= 0, `[control] the overlay's C64 screen memory was found   [${took(tRam2)}, ${RAM}]`);
      if (RAM < 0) throw new Error("no overlay screen to read");
      await untilScreen((r) => r.filter(Boolean).slice(-1)[0] === "READY.", 60000);
      await wait(2000);
      say(`        (the overlay after boot: ${(await screen()).filter(Boolean).slice(1).join(" | ")})`);
      await click("#play-frame");
      const kbdLabel = "document.querySelector('#btn-input .btn__label').textContent";
      if (!/Keyboard/.test(String(await ev(kbdLabel)))) await press("F2");
      ok((await until(`/Keyboard/.test(${kbdLabel})`, 5000)) >= 0, "F2 puts the overlay's C64 in keyboard mode, to type at it");
      /* 🚨 FAILS LOUDLY IF THE KEYS DID NOT LAND. Measured on the first run: after
         a disk button the keys went nowhere, the screen kept the LAST listing, and
         reading it "passed" the swap back to Side A. A cleared screen is the proof
         that typing reached the game before anything on it is believed. */
      const header2 = async () => {
        await press("Home", true);
        if ((await untilScreen((r) => r.every((x) => x === ""), 5000)) < 0) return "(the screen did not clear: keys are not reaching the game)";
        await type('LOAD"$",8\n');
        await untilScreen((r) => toReady(after(r, /^LOAD"\$",8$/)).slice(-1)[0] === "READY.", 60000);
        await type("LIST\n");
        await untilScreen((r) => toReady(after(r, /^LIST$/)).slice(-1)[0] === "READY.", 20000);
        return (toReady(after(await screen(), /^LIST$/)).filter(Boolean)[0] || "").replace(/\s+/g, " ");
      };
      const kA = await header2();
      ok(/^0 "RIG SIDE A/.test(kA), `it boots with Side A in the drive   [${kA || (await screen()).filter(Boolean).slice(-4).join(" / ")}]`);
      const disk = (n) => `#play-disks button:nth-of-type(${n})`;
      await click(disk(2));
      const tK = await until("__cat.side() === 1", 10000);
      const said = await ev("__cat.lines().slice(-3).join(' / ')");
      ok(tK >= 0 && !/cannot swap/i.test(said), `one click on disk 2: the overlay confirms the swap, no refusal   [${took(tK)}; ${said}]`);
      /* not just the iframe: the core's own element, or the keys land on its body */
      const inCore = "document.activeElement === document.getElementById('play-frame') && " +
        `(function (d, p) { return !!p && (d.activeElement === p || p.contains(d.activeElement)); })(${FRAME}.document, ${FRAME}.EJS_emulator.elements.parent)`;
      ok((await until(inCore, 3000)) >= 0,
         `and the keyboard is back IN the game's core, with no click   [focus: ${await ev("document.activeElement.id || document.activeElement.tagName")} > ${await inMachine("document.activeElement.className || document.activeElement.tagName")}]`);
      ok((await screen()).some((r) => /^0 "RIG SIDE A/.test(r)), "the game was NOT reset by the swap: Side A's listing is still on its screen");
      const kB = await header2();
      ok(/^0 "RIG SIDE B/.test(kB), `and the same drive now reads Side B   [${kB}]`);
      await click(disk(1));
      await until("__cat.side() === 0", 10000);
      const kA2 = await header2();
      ok(/^0 "RIG SIDE A/.test(kA2), `and back on disk 1: Side A again   [${kA2}]`);
    }

    /* --- Z. the control that must fail -------------------------------------- */
    section("Z. [control] the rig can say NO");
    const bogus = text(await screen()).includes("THIS TEXT IS ON NO C64 SCREEN");
    if (bogus) { fail++; fails.push("[control] a deliberately-false screen assertion passed"); say("  FAIL  [control] deliberately-false assertion PASSED — the screen reader is broken"); }
    else { pass++; say("  ok    [control] deliberately-false screen assertion correctly failed"); }
  } catch (err) {
    fail++;
    fails.push("the run stopped: " + err.message);
    say("  FAIL  the run stopped: " + (err && err.stack || err));
  } finally {
    SWAP_FIXTURES.forEach((f) => { try { unlinkSync(f); } catch { /* already gone */ } });
  }

  say(`\n${"-".repeat(66)}`);
  say(`  real C64: ${pass} passed, ${fail} failed`);
  if (fail) { say("\n  failures:"); fails.forEach((f) => say("    - " + f)); }
  say(`${"-".repeat(66)}\n`);
  app.exit(fail ? 1 : 0);
}
