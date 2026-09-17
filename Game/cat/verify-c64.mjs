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
  const wc = win.webContents;
  wc.setFrameRate(60);

  const ev = (code) => wc.executeJavaScript(code, true);
  const FRAME = "document.getElementById('machine-frame').contentWindow";
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
  /* what the rig types by hand, on PC key labels (the symbolic keymap people use).
     ⚠️ `*` is here for ONE line only — §D's typed LOAD"*",8,1, which is his
     requirement word for word and has to be typed the way a person types it.
     It carries VICE's symbolic race (about 1 `*` in 40 arrives as SHIFT+*), so
     that one check can fail on a correct hub until the keymap for hand typing
     is settled. Nothing else the rig types by hand uses `*`, `+` or `:`. */
  const SHIFTED = { '"': "'", "$": "4", "(": "9", ")": "0", "*": "8" };
  const PLAIN = { "-": "-", ",": ",", ".": ".", "/": "/", "=": "=" };
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
      if (ch === "\n") await press("Enter");
      else if (ch === " ") await press("Space");
      else if (SHIFTED[ch]) await press(SHIFTED[ch], true);
      else if (PLAIN[ch] || /[A-Z0-9]/i.test(ch)) await press(PLAIN[ch] || ch.toUpperCase());
      else throw new Error("the rig does not type " + JSON.stringify(ch) + " by hand (see §B)");
    }
  }
  const idle = () => until("!__cat.machine().busy", 60000, 100);
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
      while (Date.now() - t0 < 20000) { RAM = await locateRam(); if (RAM >= 0) return Date.now() - t0; await wait(300); } return -1; })();
    ok(tRam >= 0, `[control] the C64's screen memory was found, exactly once   [${took(tRam)}, ${RAM}]`);
    if (RAM < 0) throw new Error("no screen to read; nothing below can be judged");

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
    ok(hints.join(" ") === "F2 F9 F10", `the side panel and Reset carry their keys: [F2] keyboard, [F9] ports, [F10] reset   [${hints.join(" ")}]`);
    ok(deck.load === 'LOAD"*",8,1' && /empty/i.test(deck.slot), `Load types LOAD"*",8,1; the drive is empty   [${deck.load} / ${deck.slot}]`);

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
    /* ⚠️ No `*`, `+` or `:` in anything the RIG types by hand: those are the
       characters VICE's symbolic keymap races on (see emu.js, KEYS), and a rig
       that trips over that is testing the quirk, not the hub. */
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
    await click("#btn-load");
    await idle();
    const loadButton = await loadRows();
    ok(loadButton.join("|") === "SEARCHING FOR *|LOADING|READY.",
       `button: Load "*",8,1 loads the first file   [${loadButton.join(" | ")}${loadButton.length ? "" :
       "; screen: " + (await screen()).filter(Boolean).slice(-4).join(" / ") + "; note: " + (await ev("__cat.note()"))}]`);
    await press("F10");
    const tReset = await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await idle();
    ok(tReset >= 0 && (await ev("__cat.inserted()")) === DISK.id,
       `F10 resets to the boot screen, and the disk stays in   [${took(tReset)}, drive ${await ev("__cat.inserted()")}]`);
    await type('LOAD"*",8,1\n');
    const loadTyped = await loadRows();
    /* ⚠️ The one hand-typed `*` in this rig. When it fails because the symbolic
       keymap turned `*` into SHIFT+* (screen code >= 64, read as "#"), the line
       says so: that is the open keymap question, not a hub fault. */
    const typedTail = loadTyped.length ? "" : (await screen()).filter(Boolean).slice(-4).join(" / ");
    ok(loadTyped.join("|") === loadButton.join("|"), `typed: LOAD"*",8,1 gives the same lines   [${loadTyped.join(" | ")}${typedTail
       ? (/LOAD"#",8,1/.test(typedTail) ? "; the SYMBOLIC KEYMAP RACE turned * into SHIFT+* — see emu.js KEYS" : "") + "; screen: " + typedTail : ""}]`);
    await click("#btn-run");
    await idle();
    /* ⚠️ A GAME CAN CLEAR THE SCREEN BEFORE THIS LOOKS — measured: BadLands'
       trainer menu was up before a check for the RUN line ran, and the check
       failed on a Run button that had worked. So: either RUN is on the screen,
       or BASIC's screen (the LOAD it answered) is gone because something ran. */
    const tRunB = await untilScreen((r) => r.includes("RUN") || !r.includes('LOAD"*",8,1'), 20000);
    ok(tRunB >= 0, `the Run button types RUN, and the machine runs what it loaded   [${took(tRunB)}]`);
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
    await idle();
    const tFound = await untilScreen((r) => after(r, /^LOAD$/).some((x) => /^FOUND /.test(x)), 30000);
    const tTapeReady = await untilScreen((r) => toReady(after(r, /^LOAD$/)).slice(-1)[0] === "READY.", 90000);
    ok(tFound >= 0 && tTapeReady >= 0, `button: the tape is searched, FOUND and loaded   [${after(await screen(), /^LOAD$/).filter(Boolean).join(" | ")}]`);
    await press("F10");
    await idle();
    await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await press("Escape", true);
    /* the reset just cleared the screen, so a FOUND can only come from this */
    const tShiftStop = await untilScreen((r) => r.some((x) => /^FOUND /.test(x)), 30000);
    ok(tShiftStop >= 0 && (await ev("document.getElementById('play').hidden && __cat.inserted()")) === TAPE.id,
       `Shift+Escape is Shift+RUN/STOP: the machine loads from tape itself, and nothing exited   [${took(tShiftStop)}]`);

    /* --- F. eject ---------------------------------------------------------- */
    section("F. Eject empties the drive, as far as the machine is concerned too");
    await press("F10");
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

    /* --- G. keys that reach the hub first ---------------------------------- */
    section("G. with focus on the hub's side, keys still reach the machine");
    await click("#detail");
    ok(!(await ev("document.activeElement === document.getElementById('machine-frame')")), "[control] focus really is on the hub now");
    await type("PRINT 3\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT 3$/))[0] === " 3", 6000)) >= 0,
       "typing with the hub focused lands in the machine, first key included");
    await click("#detail");
    await press("F2");
    ok((await until("document.getElementById('c64-side').dataset.mode === 'joystick'", 3000)) >= 0,
       "F2 pressed on the hub's side flips the machine to joystick");
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
