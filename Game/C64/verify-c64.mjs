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
/* 🆕 2026-10-01 — CAT_RIG_BASE points the rig at another server (a git
   worktree's, say) without touching the one on 8899 everyone else uses */
const URL_HUB = (process.env.CAT_RIG_BASE || "http://localhost:8899") + "/Game/C64/index.html";

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

/* 🆕 2026-10-01 — §Q's disks: rigBlankD64 plus real files, each a one-line
   BASIC program `10 PRINT"<text>"` in a sector of its own on track 17, listed
   in the directory at 18/1. Enough for LOAD"<name>",8,1 and RUN to print a
   line the screen reader can find, and nothing a real disk would miss. */
function rigFileD64(header, files) {
  const img = rigBlankD64(header);
  const at = (t, s) => { let o = 0; for (let i = 1; i < t; i++) o += (i <= 17 ? 21 : i <= 24 ? 19 : i <= 30 ? 18 : 17) * 256; return o + s * 256; };
  const dir = at(18, 1);
  files.forEach((f, k) => {
    const txt = Buffer.from(f.text, "latin1");
    const next = 0x0801 + txt.length + 8;
    const prg = Buffer.from([0x01, 0x08, next & 255, next >> 8, 10, 0, 0x99, 0x22, ...txt, 0x22, 0, 0, 0]);
    const sec = at(17, k);
    img[sec] = 0; img[sec + 1] = prg.length + 1;
    prg.copy(img, sec + 2);
    const e = dir + k * 32;
    img[e + 2] = 0x82; img[e + 3] = 17; img[e + 4] = k;
    for (let i = 0; i < 16; i++) img[e + 5 + i] = i < f.name.length ? f.name.charCodeAt(i) : 0xA0;
    img[e + 30] = 1;
  });
  return img;
}
/* the rig's titles, and the manifest file it lays beside his (never in it) */
const RIG_CHOICE = "zz CAT rig choice", RIG_ONE = "zz CAT rig one", RIG_TRIO = "zz CAT rig trio";
/* the unnamed disk §D, §D2 and §F2 fall back on once his manifest names every one-sided .d64 he has */
const RIG_PLAIN = "zz CAT rig plain";
/* 🆕 2026-10-04 — a disk whose manifest entry names a file that is NOT on it: the
   hub's Load types LOAD"RIG GONE",8,1 and gets a quick, real ?FILE NOT FOUND.
   §F2, §Q's blink and §P3 used the empty drive for that; Load on an empty drive
   now types nothing (his ruling, the hang pass). */
const RIG_GONE = "zz CAT rig gone";
const RIG_MANIFEST = "_library.zz-rig.json";
/* 🆕 2026-10-04 — the corner's ONE line under the 1541 (his ruling, Phase 1):
   "Disk 1 of 2" is read here now; the old "Now playing" row is hidden there */
const DISK_LINE = "(document.querySelector('#detail-title .detail-disk') || { textContent: '' }).textContent";
function rigFixtures() {
  return [
    [`${RIG_CHOICE}.d64`, rigFileD64("RIG CHOICE", [{ name: "RIG PLAY", text: "RIG PLAY RAN" }, { name: "RIG HELP", text: "RIG HELP RAN" }, { name: "RIG PART", text: "RIG PART RAN" }])],
    [`${RIG_PLAIN}.d64`, rigFileD64("RIG PLAIN", [{ name: "RIG PLAIN", text: "RIG PLAIN RAN" }])],
    [`${RIG_ONE}.d64`, rigFileD64("RIG ONE", [{ name: "RIG PART", text: "RIG PART RAN" }, { name: "RIG ONE", text: "RIG ONE RAN" }])],
    /* 🔄 2026-10-04 — d1 holds one program, so §Q can leave the button on Run
       and see a Swap put it back to Load (Phase 2). d2 and d3 stay empty. */
    [`${RIG_TRIO} - d1.d64`, rigFileD64("RIG TRIO 1", [{ name: "RIG TRIO", text: "RIG TRIO RAN" }])],
    [`${RIG_TRIO} - d2.d64`, rigFileD64("RIG TRIO 2", [])],
    [`${RIG_TRIO} - d3.d64`, rigFileD64("RIG TRIO 3", [])],
    [`${RIG_GONE}.d64`, rigFileD64("RIG GONE DISK", [{ name: "RIG HERE", text: "RIG HERE RAN" }])],
    [RIG_MANIFEST, Buffer.from(JSON.stringify({
      [RIG_CHOICE]: { port: 1, entries: [{ label: "Play", file: "RIG PLAY" }, { label: "Instructions", file: "RIG HELP" },
                                          { label: "Notes", text: "RIG NOTES: SHOWN, NEVER TYPED" }] },
      [RIG_ONE]: { entries: [{ label: "Play", file: "RIG ONE" }] },
      [RIG_GONE]: { entries: [{ label: "Play", file: "RIG GONE" }] }
    }, null, 1))]
  ];
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
  /* 🚨 A KILLED RUN LEAVES §I's TWO RIG DISKS IN Game/C64/roms/ — measured: a run
     stopped by a timeout skipped its own clean-up and left them in Andrew's
     folder. So they are cleared here, before and after every run, from outside
     the Electron child. ⚠️ Only a file byte-identical to what the rig builds is
     removed; anything else of that name is his, and is left alone. */
  const clearRigDisks = () => {
    for (const s of ["A", "B"]) {
      const f = fileURLToPath(new URL(`./roms/zz CAT rig swap - Side ${s}.d64`, import.meta.url));
      try { if (existsSync(f) && readFileSync(f).equals(rigBlankD64("RIG SIDE " + s))) unlinkSync(f); } catch { /* leave it */ }
    }
  };
  /* §Q's disks and manifest, by the same byte-identical rule */
  const clearRigQ = () => {
    for (const [name, bytes] of rigFixtures()) {
      const f = fileURLToPath(new URL("./roms/" + name, import.meta.url));
      try { if (existsSync(f) && readFileSync(f).equals(bytes)) unlinkSync(f); } catch { /* leave it */ }
    }
  };
  clearRigDisks();
  clearRigQ();
  process.on("exit", () => { clearRigDisks(); clearRigQ(); });
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
  /* 🆕 2026-10-04 — THE HARD WATCHDOG (Andrew's ruling): one hang must never
     freeze the rig for more than a few minutes. 📌 A run stuck on the empty-drive
     LOAD hang sat at §F2 for over an hour, because every wait after it timed out
     one by one. The log is the heartbeat: silent for SILENT_MS, or the whole run
     past RUN_MS (a clean run takes about 7 min), and the Electron child is killed,
     with its own process tree and nothing else (`taskkill /T` on its PID). The
     longest quiet stretch in a healthy run is one slow load (idleLoad, 200 s). */
  const SILENT_MS = 4 * 60000, RUN_MS = 30 * 60000, started = Date.now();
  let heard = Date.now(), heardLen = 0, killed = false;
  const dog = setInterval(() => {
    const len = shown;
    if (len !== heardLen) { heardLen = len; heard = Date.now(); }
    const why = Date.now() - heard > SILENT_MS ? `no output for ${SILENT_MS / 60000} min`
      : Date.now() - started > RUN_MS ? `the run passed ${RUN_MS / 60000} min` : null;
    if (!why || killed) return;
    killed = true;
    pump();
    const last = readFileSync(log, "utf8").split("\n").filter((l) => /^([A-Z][0-9]?\. |\[control\])/.test(l)).pop() || "(no section yet)";
    process.stdout.write(`\n  FAIL  WATCHDOG: ${why}; the rig was killed. Last section: ${last}\n`);
    if (process.platform === "win32") spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGKILL");
  }, 5000);
  child.on("exit", (code) => {
    clearInterval(timer);
    clearInterval(dog);
    pump();
    process.exit(killed ? 1 : code === null ? 1 : code);
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
  /* 🆕 2026-10-05 — THE SEQUENCE RECORDER (Phase 4b): the disk's sprite, the
     1541's latch and the Datasette, sampled IN THE PAGE every 15 ms, so the order
     of an insert, an eject or a swap is read without the rig's own polling
     slowing it down. recStart() before the click, recStop() after. */
  const recStart = () => ev(`(function () { clearInterval(window.__recId); window.__rec = [];
    window.__recId = setInterval(function () { var c = __cat.corner(), d = c.disk || {};
      window.__rec.push({ t: Date.now(), s: !!d.shown, p: d.phase, tr: (d.trace || []).join(","), turn: d.turn, n: d.name, sd: d.side, f: d.face,
        l: c.latch.down, tl: c.tape.lid, tt: c.tape.tape }); }, 15); })()`);
  const recStop = () => ev("clearInterval(window.__recId), JSON.stringify(window.__rec)").then(JSON.parse);
  /* 🆕 2026-10-05 — THE EJECT BUTTON as it is drawn (Phase 4b items 1-3): which
     icon shows, the latch's and the key's computed transforms, and its two label
     lines (each unclipped, one under the other, centred on each other) */
  const EJ = `(function () { var e = document.getElementById("btn-eject"), vis = function (s) { var x = e.querySelector(s); return !!x && x.getBoundingClientRect().width > 0; };
    var m = function (s) { var t = getComputedStyle(e.querySelector(s)).transform; if (t === "none") return [1, 0, 0, 1, 0, 0]; return t.slice(7, -1).split(",").map(Number); };
    var ls = [].map.call(e.querySelectorAll(".eject-word > span"), function (x) { var r = x.getBoundingClientRect(); return { t: x.textContent, top: r.top, mid: (r.left + r.right) / 2, cut: x.scrollWidth > x.clientWidth + 1, w: Number(getComputedStyle(x).fontWeight) }; });
    var b = e.getBoundingClientRect();
    return JSON.stringify({ where: e.parentNode.id, latchIcon: vis(".eject-icon--latch"), keyIcon: vis(".eject-icon--key"), lever: vis(".eject-lever"),
      latch: m(".eject-icon__latch"), key: m(".eject-icon__key"), lines: ls, text: e.querySelector(".eject-word").textContent,
      inside: ls.length === 2 && [].every.call(e.querySelectorAll(".eject-word > span"), function (x) { var r = x.getBoundingClientRect(); return r.left >= b.left && r.right <= b.right && r.top >= b.top && r.bottom <= b.bottom; }) }); })()`;
  const ejNow = () => ev(EJ).then(JSON.parse);
  /* 🔄 2026-10-05 — "Eject" BOLD over "End Game" REGULAR, no brackets (his correction) */
  const twoLines = (j) => j.lines.length === 2 && j.lines[0].t === "Eject" && j.lines[1].t === "End Game" && j.lines[1].top > j.lines[0].top + 4
    && j.lines[0].w >= 700 && j.lines[1].w <= 400
    && Math.abs(j.lines[0].mid - j.lines[1].mid) <= 2 && !j.lines[0].cut && !j.lines[1].cut && j.inside;
  /* 🆕 2026-09-17 — the Load button now waits for the LOAD to finish before it
     decides whether to type RUN, so the hub can legitimately stay busy for far
     longer than 60s on a slow disk. Using idle() there made the rig walk on
     while the machine was still working, and everything after it read a screen
     that was still moving. */
  const idleLoad = () => until("!__cat.machine().busy", 200000, 200);
  /* the side panel, as the player sees it: each part lit, grey, or neither.
     🔄 2026-10-02 — no Keyboard part and no input mode any more (his rulings,
     "keyboard and joystick live together"): the Arrows switch's two halves and
     the two ports, and `grey` counts any greyed part (there should be none). */
  const SIDE = `(function () {
    var st = function (id) { var e = document.getElementById(id); return e.classList.contains("is-lit") ? "lit" : e.classList.contains("is-grey") ? "grey" : "plain"; };
    var p = document.getElementById("c64-side");
    return { shown: !p.hidden && p.getBoundingClientRect().height > 20, arrows: p.dataset.arrows, port: p.dataset.port,
             stick: st("c64-arrows-stick"), cursor: st("c64-arrows-cursor"), p1: st("c64-port1"), p2: st("c64-port2"),
             grey: p.querySelectorAll(".is-grey").length,
             power: document.getElementById("c64-power").getAttribute("aria-pressed"),
             oldButtons: ["btn-input", "btn-port", "btn-power"].filter(function (id) { var b = document.getElementById(id); return !b.hidden && b.getBoundingClientRect().width > 0; }).length };
  })()`;

  /* ---- §I's two-sided game ------------------------------------------------
     Game/C64/roms/ is Andrew's hand-picked, gitignored folder and today holds no
     two-sided title, so the rig lays its own pair there BEFORE the hub scans it,
     and takes away only the files it made. 🚫 Nothing is sourced: each is a
     blank, formatted 1541 disk written here, told apart only by the name in its
     directory header. ⚠️ If files of these names already exist they are left
     alone and not removed. */
  const SWAP_TITLE = "zz CAT rig swap";
  const DISK_DIR = fileURLToPath(new URL("./roms/", import.meta.url));
  const SWAP_FIXTURES = [];
  if (existsSync(DISK_DIR)) {
    for (const s of ["A", "B"]) {
      const f = join(DISK_DIR, `${SWAP_TITLE} - Side ${s}.d64`);
      if (!existsSync(f)) { writeFileSync(f, rigBlankD64("RIG SIDE " + s)); SWAP_FIXTURES.push(f); }
    }
    for (const [name, bytes] of rigFixtures()) {
      const f = join(DISK_DIR, name);
      if (!existsSync(f)) { writeFileSync(f, bytes); SWAP_FIXTURES.push(f); }
    }
  }

  let DISK = null, TAPE = null, GONE = null;   /* GONE: the rig's gone disk's id, found in §F2 */
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
      /* 🔄 2026-09-25 — AND IT LOOKS EVERY 2 s, NOT EVERY 0.3 s (his ruling). Each
         look is a full heap walk ON THE MACHINE'S OWN THREAD (~0.7 s measured), so a
         rig looking three times a second was slowing the very boot it was waiting
         for — to ~12 frames a second in a probe — and pushing the banner past the
         page's own hunt. */
      while (Date.now() - t0 < 60000) { RAM = await locateRam(); if (RAM >= 0) return Date.now() - t0; await wait(2000); } return -1; })();
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
    /* 🆕 2026-09-25 — THE CORNER MUST HAVE FOUND ITS OWN SCREEN TOO, at the same
       place. Everything the hub decides after a Load (auto-RUN above all) reads the
       screen through the page's own hunt, not the rig's. 📌 On main after the
       2026-09-25 merge, a slow boot let the rig find the screen while the page had
       already given up, and the run died much later in §D2 with a misleading
       "not running" — so this stops the run HERE, with the real reason. */
    const tOwn = await until(`(() => { try { return ${FRAME}.CAT_EMU.machine().screen === ${RAM + 0x400}; } catch (e) { return false; } })()`, 60000, 500);
    const own = await inMachine("CAT_EMU.machine()");
    ok(tOwn >= 0, `[control] the corner found its own screen, where the rig did   [${took(tOwn)}; page ${own && own.screen}, rig ${RAM + 0x400}; hunt ${JSON.stringify(own && own.hunt)}]`);
    if (tOwn < 0) throw new Error("the corner's own screen search has not found the C64's screen, so auto-RUN cannot see READY. — stopping here rather than failing later for the wrong reason");

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
      load: document.getElementById("btn-load").dataset.cmd, slot: __cat.inserted() === null ? "empty" : __cat.inserted() })`));
    ok(deck.out === "none" && deck.frame > 300, `the hub's terminal is off the glass and the machine fills it   [out ${deck.out}, frame ${deck.frame}px]`);
    /* 🔄 2026-10-02 — there is no keyboard mode to open in: the keyboard is
       always live AND the stick is in port 2, with the arrows on the stick */
    const tSide = await until("document.getElementById('c64-side').dataset.arrows === 'stick' && document.getElementById('c64-side').dataset.port === '2'", 10000);
    const sideNow = await ev(SIDE);
    ok(tSide >= 0 && sideNow.stick === "lit" && sideNow.cursor === "plain" && sideNow.p2 === "lit" && sideNow.p1 === "plain" && sideNow.grey === 0 &&
       (await inMachine("CAT_EMU.machine().keyboard")) === true && (await inMachine("CAT_EMU.machine().arrows")) === "stick",
       `it opens with the keyboard live AND the stick in port 2, arrows on the stick, nothing greyed, from the machine's report   [${JSON.stringify(sideNow)}]`);
    ok(!(await ev("!!document.getElementById('c64-keys')")), "the Keyboard part is gone: there is no keyboard to select");
    ok(sideNow.shown && sideNow.power === "true" && sideNow.oldButtons === 0,
       "the side panel replaces the Input / Port / Power Off buttons, and its power light is on");
    /* 🔄 2026-10-04 — Phase 2 (his rulings): ONE Directory button, ONE Load button
       that becomes Run when there is something to run, and Eject says it ends the game */
    const dirText = String(await ev("document.getElementById('btn-list').textContent")).replace(/\u00a0/g, " ");
    const ejText = await ev("document.getElementById('btn-eject').querySelector('.eject-word').textContent");
    const moreShown = await ev("!document.getElementById('btn-reset-more').hidden && document.getElementById('btn-reset-more').parentNode === document.getElementById('btn-reset').parentNode");
    ok(!deck.list && !deck.run && deck.reset && dirText === 'Load "$",8' && ejText === "Eject End Game" && moreShown,
       `the deck has one Directory button, no separate List or Run, and Reset with its arrow beside it; Eject says it ends the game   [${dirText} / ${ejText}]`);
    ok(await ev("document.getElementById('btn-insert').parentNode.id === 'crates' && document.getElementById('btn-insert').classList.contains('btn--insert')"),
       "Insert Disk sits where the disks are, styled as the primary action (his addendum)");
    /* his F-key addendum: each hint names the key that emu.js and cat.js actually catch */
    const hints = await ev(`[document.getElementById("c64-arrows-hint").textContent, document.getElementById("c64-port-hint").textContent,
      document.getElementById("btn-reset-hint").textContent]`);
    ok(hints.join(" ") === "F2 F9 F12", `the side panel and Reset carry their keys: [F2] arrows, [F9] ports, [F12] reset   [${hints.join(" ")}]`);
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
    const disks = await ev("__cat.disks().map(function (d) { return { id: d.id, name: d.displayName, ch: (d.choices || []).length, files: (d.files || []).map(function (f) { return f.name; }) }; })");
    /* 🚫 Picked by what the library holds today, never by a hard-coded name:
       Game/C64/roms/ is Andrew's, gitignored, and changes. */
    /* 🔄 2026-10-01 — and one the library manifest does not name: §D, §D2 and
       §F2 measure LOAD"*",8,1, which is what an unnamed title still types */
    /* 🔄 2026-10-01 — a real unnamed disk when he has one; the rig's own plain
       disk once his manifest names them all (measured: it did, the same day) */
    DISK = disks.find((d) => !d.ch && d.files.length === 1 && /\.d64$/i.test(d.files[0]) && !/^zz CAT rig /.test(d.name))
        || disks.find((d) => d.name === RIG_PLAIN);
    TAPE = disks.find((d) => !d.ch && d.files.length === 1 && /\.t64$/i.test(d.files[0]));
    ok(!!DISK && !!TAPE, `the library has a one-sided disk and a tape to test with   [${DISK && DISK.name} / ${TAPE && TAPE.name}]`);
    if (!DISK || !TAPE) throw new Error("no disk or tape to test with");

    await ev(`__cat.select(${JSON.stringify(DISK.id)})`);
    /* 🆕 2026-10-05 — PHASE 4b, HIS REDESIGN: NO DISK RESTS ON THE PAGE. The
       crate's list has its height back (nothing between the hint and the 1541),
       and the disk is drawn only while Insert or Eject moves it. Its art is true
       alpha; its label is printed in code and never clips. */
    const lay = JSON.parse(await ev(`JSON.stringify((function () { var r = function (s) { var e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      var sw = document.getElementById("side-swap"), above = !sw.hidden && sw.getBoundingClientRect().height ? r("#side-swap") : r("#btn-insert");
      var gone = function (id) { return getComputedStyle(document.getElementById(id)).display === "none"; };
      return { floppy: !!document.getElementById("floppy"), above: above.bottom, drive: r("#drive-1541").top, w: r("#drive-1541").width,
               driveB: r("#drive-1541").bottom, dsB: r("#datasette").bottom, titleGone: gone("detail-title"), hintGone: gone("crates-hint"),
               rows: getComputedStyle(document.getElementById("crates")).gridTemplateAreas, shown: __cat.corner().disk.shown }; })())`));
    ok(!lay.floppy && !/disk/.test(lay.rows) && lay.drive - lay.above <= 20 && lay.w >= 315,
       `no disk sits above the 1541: the list has its height back, and the 1541 is its own size   [buttons to 1541 ${Math.round(lay.drive - lay.above)} px; 1541 ${Math.round(lay.w)} px]`);
    /* 🆕 2026-10-05 (Phase 5b, his rulings) */
    ok(lay.titleGone && lay.hintGone && !/line|hint/.test(lay.rows),
       `5b: under the 1541 the game's name and "Click a disk, then Insert." are gone   [${lay.rows}]`);
    ok(Math.abs(lay.driveB - lay.dsB) <= 2,
       `5b: the 1541's base lines up with the Datasette's base   [1541 ends ${Math.round(lay.driveB)}, Datasette ${Math.round(lay.dsB)}]`);
    ok(lay.shown === false, "and before Insert no disk is drawn anywhere");
    const ej0 = await ejNow();
    ok(ej0.latchIcon && !ej0.keyIcon && !ej0.lever && ej0.latch[5] === 0,
       `an empty drive: Eject shows the 1541's latch, UP (no turning lever any more)   [latch ${ej0.latch.join(",")}]`);
    const flAlpha = await ev(`new Promise(function (res) { var im = new Image(); im.onload = function () {
        var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        var g = c.getContext("2d"); g.drawImage(im, 0, 0);
        var a = function (fx, fy) { return g.getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data[3]; };
        res({ hub: a(0.49995, 0.49986), corner: a(0.995, 0.995), jacket: a(0.15, 0.6), label: a(0.6, 0.15) }); };
      im.onerror = function () { res(null); }; im.src = "disk/disk.png"; })`);
    ok(flAlpha && flAlpha.hub === 0 && flAlpha.corner === 0 && flAlpha.jacket === 255 && flAlpha.label === 255,
       `the disk's art is true alpha: hub hole and the corner outside clear, jacket and label solid   [${JSON.stringify(flAlpha)}]`);
    /* 🆕 2026-10-05 — SIDE B's face (his rulings): the same art, the label painted
       out in jacket. Same cut (hub hole and corner clear), and where the label was
       is solid, dark jacket now, not cream */
    const flBack = await ev(`new Promise(function (res) { var im = new Image(); im.onload = function () {
        var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        var g = c.getContext("2d"); g.drawImage(im, 0, 0);
        var px = function (fx, fy) { return Array.prototype.slice.call(g.getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data); };
        var lab = [[0.4, 0.08], [0.6, 0.15], [0.9, 0.27]].map(function (p) { var d = px(p[0], p[1]); return Math.round((d[0] + d[1] + d[2]) / 3) + "/" + d[3]; });
        res({ w: c.width, h: c.height, hub: px(0.49995, 0.49986)[3], corner: px(0.995, 0.995)[3], label: lab }); };
      im.onerror = function () { res(null); }; im.src = "disk/disk-back.png"; })`);
    ok(flBack && flBack.w === 480 && flBack.h === 509 && flBack.hub === 0 && flBack.corner === 0
       && flBack.label.every((v) => Number(v.split("/")[0]) < 60 && v.split("/")[1] === "255"),
       `Side B's face is the same art with the label painted out in jacket: same cut, no cream left   [${JSON.stringify(flBack)}]`);
    /* the library's longest name today (42 characters), as a set: readable */
    const flLong = JSON.parse(await ev(`JSON.stringify(CAT_DRIVE.disk.rigLabel("Beach-Head II - The Dictator Strikes Back!", "Disk 1, Side A"))`));
    ok(!flLong.clipped && flLong.px >= 5, `the library's longest name with a side line wraps on the label at a readable size, unclipped   [${flLong.px}px]`);
    /* twice that: smaller, but still never clipped */
    const flHuge = JSON.parse(await ev(`JSON.stringify(CAT_DRIVE.disk.rigLabel("The Very Long Name Of A Game That Goes On - Part Two: The Return Of The Long Name", "Disk 1, Side A"))`));
    ok(!flHuge.clipped && flHuge.shown === true && !(await ev("__cat.corner().disk.shown")),
       `a name twice as long shrinks further and still never clips (and the measuring leaves no disk drawn)   [${flHuge.px}px]`);
    say(`        (the room below the slot: ${flLong.room.below} px for a ${flLong.room.disk} px disk, ${flLong.room.short} px short of showing it whole)`);
    await recStart();
    await click("#btn-insert");
    /* 🔄 2026-10-05 — THE 1541 PLAYS IT (his redesign): no scene over the screen,
       and still no crack intro */
    const tAnim = await until("__cat.corner().disk.shown", 3000, 20);
    const sawCrack = await ev("!!document.getElementById('crack') || !!document.querySelector('#drive-insert')");
    ok(tAnim >= 0 && !sawCrack, `Insert Disk plays the disk into the real 1541; no scene over the screen, no crack intro   [${took(tAnim)}]`);
    const tIn = await until(`__cat.inserted() === ${JSON.stringify(DISK.id)}`, 60000);
    await idle();
    /* 🔄 2026-10-04 — the corner names it in the ONE line under the 1541 (his ruling, Phase 1) */
    const slot = await ev("document.getElementById('detail-title').firstChild.textContent");
    ok(tIn >= 0 && slot === DISK.name, `${DISK.name} is in the drive, named under the 1541   [${took(tIn)}, line ${slot}]`);
    const recIn = await recStop();
    const seen = recIn.filter((x) => x.s);
    const firstSeen = recIn.findIndex((x) => x.s), lastSeen = recIn.length - 1 - [...recIn].reverse().findIndex((x) => x.s);
    const dropAt = recIn.findIndex((x, i) => i > firstSeen && x.l);
    ok(seen.length > 0 && seen[0].p === "ready" && seen.some((x) => x.tr === "rise,in") && !recIn[firstSeen].l && dropAt > lastSeen,
       `the insert plays in order: latch up, the disk rises from below, slides into the slot, THEN the latch drops   [${[...new Set(recIn.map((x) => (x.s ? x.p : "-") + (x.l ? "/L" : "")))].join(" > ")}]`);
    ok(seen.length > 0 && seen.every((x) => x.turn === "180deg" && x.n === DISK.name),
       `all the way in, the sprite is turned 180°, the label's name with it   [${seen.length} samples; ${seen[0] && seen[0].turn}; "${seen[0] && seen[0].n}"]`);
    const dkIn = JSON.parse(await ev("JSON.stringify(__cat.corner().disk)"));
    ok(!dkIn.shown && dkIn.phase === "gone" && !(await ev("document.getElementById('drive-diskwin').getBoundingClientRect().height > 0")),
       `once it is in, the disk is not drawn: only the line under the 1541 names it   [${dkIn.phase}]`);
    /* 🆕 2026-10-05 — Eject's icon: the latch DOWN, slid straight down (a pure
       translation: no rotation, no tilt), in the left column and in full screen;
       and its label two centred, unclipped lines in both */
    const ejD = await ejNow();
    await ev("__cat.full(true)");
    await until("__cat.machine().full", 3000);
    await wait(200);
    const ejDF = await ejNow();
    await ev("__cat.full(false)");
    await until("!__cat.machine().full", 3000);
    const straight = (m) => m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] > 2;
    ok(ejD.where === "crates" && ejD.latchIcon && !ejD.keyIcon && straight(ejD.latch) && ejDF.where === "c64-side" && ejDF.latchIcon && straight(ejDF.latch),
       `a disk in: Eject's latch is DOWN, slid straight down with the drive's, in the column and in full screen   [${ejD.latch.join(",")} / ${ejDF.latch.join(",")}]`);
    ok(twoLines(ejD) && twoLines(ejDF) && ejD.text === "Eject End Game",
       `Eject's label is two centred lines, "Eject" in bold over "End Game" in regular, unclipped in the column and in full screen   [${ejD.lines.map((l) => l.t + " " + l.w).join(" / ")}]`);
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
    await click("#btn-list");               // 🔄 5a: LOAD "$",8 ...
    await idle();
    const dirNext = JSON.parse(await ev(`JSON.stringify({ t: document.getElementById("btn-list").textContent, next: document.getElementById("btn-list").classList.contains("is-next"),
      cmd: document.getElementById("btn-list").dataset.cmd, mode: __cat.corner().dirMode })`));
    const noListYet = !after(await screen(), /^LOAD"\$",8$/).includes("LIST");
    ok(dirNext.t === "List" && dirNext.next && dirNext.cmd === "LIST" && dirNext.mode === "list" && noListYet,
       `5a: the Directory button types LOAD "$",8 and then BECOMES List (lit), typing nothing more by itself   [${dirNext.t}, lit ${dirNext.next}]`);
    await click("#btn-list");               // ... then LIST
    await idle();
    /* 🚨 measured failure: a clicked Load button kept focus, and the next Space
       typed by hand pressed it again */
    ok(await ev("document.activeElement === document.getElementById('machine-frame')"),
       `clicking a deck button leaves the keyboard in the machine   [focus: ${await ev("document.activeElement.id || document.activeElement.tagName")}]`);
    const tDirB = await untilScreen((r) => after(r, /^LOAD"\$",8$/).includes("LIST"), 60000);
    const dirButton = await directory();
    const dirBack = String(await ev("document.getElementById('btn-list').textContent")).replace(/\u00a0/g, " ");
    ok(dirBack === 'Load "$",8' && !(await ev("document.getElementById('btn-list').classList.contains('is-next')")),
       `and List types LIST, and the button goes back to Load "$",8   [${dirBack}]`);
    ok(tDirB >= 0 && /^0 "/.test(dirButton[0] || ""), `the two presses give the disk's directory   [${dirButton[0]} … ${dirButton.length} lines${dirButton.length ? "" :
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
    /* 🔄 2026-10-04 — no separate Run button now (Phase 2): the hub did not load
       this one, so RUN is typed by hand, as a player would. The Load button's own
       Run is §Q's. */
    await type("RUN\n");
    /* ⚠️ A GAME CAN CLEAR THE SCREEN BEFORE THIS LOOKS — measured: BadLands'
       trainer menu was up before a check for the RUN line ran, and the check
       failed on a Run button that had worked. So: either RUN is on the screen,
       or BASIC's screen (the LOAD it answered) is gone because something ran. */
    const tRunB = await untilScreen((r) => r.includes("RUN") || !r.includes('LOAD"*",8,1'), 20000);
    ok(tRunB >= 0, `RUN typed by hand runs what it loaded   [${took(tRunB)}]`);

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
    say(`        (shot: Game/C64/verify-c64-run.png — ${DISK.name} after RUN, for a human eye)`);

    /* --- E. tapes ---------------------------------------------------------- */
    section("E. a tape: Load types LOAD, and Shift+Escape is Shift+RUN/STOP");
    await click("#btn-reset");
    await idle();
    await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await ev(`__cat.select(${JSON.stringify(TAPE.id)})`);
    ok((await ev("document.getElementById('btn-insert').textContent")) === "Insert Tape", "for a tape the button says Insert Tape");
    await recStart();
    await click("#btn-insert");
    /* 🔄 2026-10-04 — PHASE 4 STEP 2: the REAL Datasette in the bay plays the
       insert (his ruling), not a scene over the screen: the EJECT key goes down,
       the lid opens, the cassette drops in, the lid closes, the key comes up */
    const tOpen = await until("__cat.corner().tape.lid === 'open' && __cat.corner().tape.key === true && !document.querySelector('#drive-insert')", 3000, 30);
    /* 🆕 2026-10-04 (his correction) — the open lid tilts TOWARD the viewer: in its
       computed 3D matrix the lid's downward axis gains a POSITIVE z (out of the screen) */
    const LIDZ = `(function () { var m = getComputedStyle(document.getElementById("datasette-lid")).transform;
      return m.indexOf("matrix3d(") === 0 ? Number(m.slice(9, -1).split(",")[6]) : 0; })()`;
    const tTilt = await until(`${LIDZ} > 0.5`, 2000, 20);
    const lidZ = Number(await ev(LIDZ));
    const tTape = await until(`__cat.inserted() === ${JSON.stringify(TAPE.id)}`, 60000);
    await idle();
    /* 🆕 2026-10-05 — A TAPE OVER A DISK (his redesign): the disk's eject plays
       first (latch up, out downward, gone), THEN the Datasette opens */
    const recDT = await recStop();
    const dtSeen = recDT.filter((x) => x.s);
    const dtLastDisk = recDT.length - 1 - [...recDT].reverse().findIndex((x) => x.s);
    const dtLid = recDT.findIndex((x) => x.tl === "open");
    ok(dtSeen.length > 0 && dtSeen.every((x) => !x.l && x.n === DISK.name) && dtSeen.some((x) => x.tr === "out,down") && dtLid > dtLastDisk,
       `a tape over a disk: the disk comes out of the 1541 first (latch up, out downward), THEN the Datasette opens   [${dtSeen.length} disk samples; lid opens at ${dtLid}, disk gone by ${dtLastDisk + 1}]`);
    const seqIn = JSON.parse(await ev("JSON.stringify(__cat.corner().tape)"));
    const ejT = await ejNow();
    await ev("__cat.full(true)");
    await until("__cat.machine().full", 3000);
    await wait(200);
    const ejTF = await ejNow();
    await ev("__cat.full(false)");
    await until("!__cat.machine().full", 3000);
    ok(ejT.keyIcon && !ejT.latchIcon && ejT.key[5] > 0.5 && ejTF.keyIcon && ejTF.key[5] > 0.5 && twoLines(ejT) && twoLines(ejTF),
       `a tape in: Eject shows the Datasette's EJECT key instead, pressed down, in the column and in full screen   [key ${ejT.key[5].toFixed(2)} px / ${ejTF.key[5].toFixed(2)} px]`);
    ok(tOpen >= 0 && seqIn.trace.join(",") === "key,open,in,close,keyup" && seqIn.lid === "closed" && !seqIn.key && seqIn.tape
       && !(await ev("!!document.querySelector('#drive-insert')")),
       `Insert Tape plays the Datasette: EJECT down, lid open, cassette in, lid shut, key up; no scene over the screen   [${seqIn.trace.join(" > ")}; lid ${seqIn.lid}]`);
    ok(tTilt >= 0 && lidZ > 0.5, `the lid lifts TOWARD the viewer, bottom edge forward and up, about 45°   [z of its downward axis ${lidZ.toFixed(3)}; sin 45° = 0.707]`);
    /* and the cassette comes in from BELOW the bay (measured in its start position) */
    const below = JSON.parse(await ev(`JSON.stringify((function () { var d = document.getElementById("datasette"), t = document.getElementById("datasette-tape");
      d.classList.add("is-snap"); t.classList.add("is-below"); var r = t.getBoundingClientRect(), b = d.getBoundingClientRect();
      var o = { top: Math.round(r.top), boxBottom: Math.round(b.bottom), h: Math.round(r.height) };
      t.classList.remove("is-below"); void t.offsetWidth; d.classList.remove("is-snap"); return o; })())`));
    ok(below.top >= below.boxBottom, `the cassette's start position is below the bay: it rises in from under the box   [its top ${below.top}, box bottom ${below.boxBottom}]`);
    const tapeDeck = JSON.parse(await ev(`JSON.stringify({
      cmd: document.getElementById("btn-load").dataset.cmd, text: document.getElementById("btn-load").textContent, medium: __cat.machine().medium })`));
    ok(tTape >= 0 && tapeDeck.medium === "tape",
       `${TAPE.name} goes in as a tape   [${took(tTape)}, ${tapeDeck.medium}]`);
    ok(tapeDeck.cmd === "LOAD" && tapeDeck.text === "Load", `the Load button now types LOAD, and says so   [${tapeDeck.text}]`);
    /* 🆕 2026-10-04 — PHASE 4: the cassette is in the Datasette, with the game's
       name printed on its label (his ruling), fitted, never clipped */
    const lbl = JSON.parse(await ev(`JSON.stringify((function () { var t = document.getElementById("datasette-tape"), l = document.getElementById("datasette-label"),
      c = t.getBoundingClientRect(); return { shown: !t.hidden && c.width > 0, text: l.textContent, px: parseFloat(l.style.fontSize) || 0,
      fits: l.scrollWidth <= l.clientWidth + 1 && l.scrollHeight <= l.clientHeight + 1, w: Math.round(c.width) }; })())`));
    ok(lbl.shown && lbl.text === TAPE.name && lbl.fits && lbl.px >= 5,
       `the cassette shows in the Datasette with "${TAPE.name}" on its label, fitted   [${lbl.text} at ${lbl.px}px, fits ${lbl.fits}, cassette ${lbl.w}px wide]`);
    const trapsTape = await inMachine("EJS_emulator.allSettings.vice_virtual_device_traps");
    ok(trapsTape === "enabled", `with a tape in, the traps a .T64 needs are on   [${trapsTape}]`);
    const count0 = await ev("__cat.corner().tape.count");
    const playBefore = await ev("__cat.corner().tape.play");
    /* 🆕 5a: a tape has no directory, and the 1541's lever is not the tape's */
    const tapeParts = JSON.parse(await ev(`JSON.stringify({ dir: document.getElementById("btn-list").disabled, lever: __cat.corner().lever.enabled,
      play: !document.getElementById("datasette-play").disabled, ej: !document.getElementById("datasette-eject").disabled })`));
    ok(tapeParts.dir && !tapeParts.lever && tapeParts.play && tapeParts.ej,
       `5a: with a tape in, Directory is off (a tape has none), the 1541's lever does nothing, the Datasette's PLAY and EJECT take clicks   [${JSON.stringify(tapeParts)}]`);
    /* 🆕 5a: the Datasette's PLAY does what Load does; and the 1541's red light stays DARK for a tape */
    await ev(`(function () { clearInterval(window.__redId); window.__red = 0; window.__redId = setInterval(function () {
      if (__cat.corner().lamps.loading || __cat.corner().lamps.failed) window.__red++; }, 30); })()`);
    await click("#datasette-play");
    /* 🆕 2026-10-04 — PLAY goes down when the load starts, BEFORE anything turns */
    const tPlay = await until("__cat.corner().tape.play", 20000, 20);
    const playFirst = JSON.parse(await ev("JSON.stringify(__cat.corner().tape)"));
    /* 🆕 2026-10-04 — while the tape LOAD runs, the hubs turn and the counter counts */
    const tSpin = await until("__cat.corner().tape.spinning", 20000, 50);
    const spinNow = JSON.parse(await ev(`JSON.stringify({ hub: getComputedStyle(document.querySelector(".datasette__hub")).animationPlayState,
      spindle: getComputedStyle(document.querySelector(".datasette__spindle")).animationPlayState })`));
    ok(tSpin >= 0 && spinNow.hub === "running" && spinNow.spindle === "running",
       `while the tape loads, the white hubs and the black spindles turn   [${took(tSpin)}; ${JSON.stringify(spinNow)}]`);
    const playDuring = await ev("__cat.corner().tape.play");
    ok(playBefore === false && tPlay >= 0 && playFirst.play && !playFirst.spinning && playDuring === true,
       `the PLAY key is up before the load, goes down as it starts (before the hubs turn), and stays down   [before ${playBefore}; at press spinning ${playFirst.spinning}; during ${playDuring}]`);
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
    const cEnd = JSON.parse(await ev("JSON.stringify(__cat.corner().tape)"));
    await wait(1200);
    const cLater = JSON.parse(await ev("JSON.stringify(__cat.corner().tape)"));
    ok(!cEnd.play && !cLater.play, `and the PLAY key comes back up when the load ends   [${cEnd.play}]`);
    const redSeen = await ev("clearInterval(window.__redId), window.__red");
    ok(tPlay >= 0 && redSeen === 0, `5a: the Datasette's PLAY key started that load (as Load does), and the 1541's red light never lit for the tape   [red samples ${redSeen}]`);
    ok(!cEnd.spinning && cEnd.count > count0 && cLater.count === cEnd.count && cLater.shown === String(cEnd.count).padStart(3, "0"),
       `the counter counted up during the load, stopped at its end, and keeps its value   [${count0} -> ${cEnd.count}, then ${cLater.shown}]`);
    /* and 999 wraps to 000 (the rig sets it near the top, then runs the motor) */
    await ev("CAT_DRIVE.tape.rigCount(999.4); CAT_DRIVE.tape.motor(true)");
    await wait(900);
    await ev("CAT_DRIVE.tape.motor(false)");
    const cWrap = JSON.parse(await ev("JSON.stringify(__cat.corner().tape)"));
    ok(cWrap.count <= 3 && cWrap.shown === String(cWrap.count).padStart(3, "0"), `the counter wraps 999 to 000   [999 -> ${cWrap.shown}]`);
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
    /* 🆕 2026-10-04 — something on the screen first, so a reset can be seen */
    await type("PRINT 4321\n");
    await untilScreen((r) => r.includes(" 4321"), 6000);
    /* the motor is set running by hand here (as a load would), to see Eject pop PLAY up */
    await ev("CAT_DRIVE.tape.motor(true)");
    const playPreEject = (await until("__cat.corner().tape.play", 2000, 20)) >= 0;
    await wait(400);
    await ev("CAT_DRIVE.tape.rigCount(25)");   /* a known, non-zero value to carry through the eject */
    const cPreEject = await ev("__cat.corner().tape.count");
    await click("#datasette-eject");        /* 🆕 5a: the Datasette's own EJECT key */
    const tLidOut = await until("__cat.corner().tape.lid === 'open'", 3000, 30);
    await idle();
    await until("!__cat.corner().tape.busy", 5000, 50);
    const tFresh = await untilScreen((r) => r[1].trim() === "**** COMMODORE 64 BASIC V2 ****" && r[5] === "READY." && !r.includes(" 4321"), 20000);
    const ejLamps = JSON.parse(await ev("JSON.stringify(__cat.corner())"));
    ok(tFresh >= 0 && !ejLamps.latch.down && ejLamps.lamps.power === true && !(await ev("__cat.machine().gameOn")),
       `the Datasette's EJECT key is Eject, a full stop: the boot screen's READY., latch up, green on   [${took(tFresh)}; ${(await screen()).filter(Boolean).slice(0, 3).join(" / ")}]`);
    const ej = JSON.parse(await ev(`JSON.stringify({ inserted: __cat.inserted(), latch: __cat.corner().latch.down,
      cmd: document.getElementById("btn-load").dataset.cmd })`));
    ok(ej.inserted === null && ej.cmd === 'LOAD"*",8,1',
       `the drive is empty again, and Load is back to LOAD"*",8,1   [${ej.inserted}, ${ej.cmd}]`);
    /* 🆕 2026-10-04 — PHASE 4 STEP 2: the tape leaves the Datasette, and the
       counter keeps its value until its own small button */
    const seqOut = JSON.parse(await ev("JSON.stringify(__cat.corner().tape)"));
    ok(tLidOut >= 0 && seqOut.trace.join(",") === "open,out,close" && seqOut.lid === "closed" && !seqOut.tape && !seqOut.spinning,
       `Eject plays the Datasette: lid open, the tape leaves (downward), lid shut   [${seqOut.trace.join(" > ")}]`);
    ok(seqOut.count === cPreEject && cPreEject > 0, `and the counter keeps its value through the eject   [${cPreEject} -> ${seqOut.count}]`);
    ok(playPreEject && !seqOut.play, `and Eject pops the PLAY key up as it lifts the lid   [down before: ${playPreEject}; after: ${seqOut.play}]`);
    await click("#datasette-reset");
    const cReset = JSON.parse(await ev("JSON.stringify(__cat.corner().tape)"));
    ok(cReset.count === 0 && cReset.shown === "000" && (await ev("document.activeElement !== document.getElementById('datasette-reset')")),
       `its small button sets the counter back to 000, and takes no focus   [${cReset.shown}]`);
    const lblOut = JSON.parse(await ev(`JSON.stringify((function () { var t = document.getElementById("datasette-tape"), l = document.getElementById("datasette-label"),
      c = t.getBoundingClientRect(); return { shown: !t.hidden && c.width > 0, text: l.textContent, px: parseFloat(l.style.fontSize) || 0,
      fits: l.scrollWidth <= l.clientWidth + 1 && l.scrollHeight <= l.clientHeight + 1, w: Math.round(c.width) }; })())`));
    ok(!lblOut.shown && lblOut.text === "", `and the cassette has left the Datasette   [shown ${lblOut.shown}]`);
    await type('LOAD"$",8\n');
    ok((await untilScreen((r) => toReady(after(r, /^LOAD"\$",8$/)).includes("?FILE NOT FOUND  ERROR"), 30000)) >= 0,
       "and the machine agrees: LOAD\"$\",8 finds nothing");
    /* 🆕 2026-10-04 (his ruling) — a disk inserted over a tape: the tape leaves the
       Datasette first, downward, then the disk goes in */
    await ev(`__cat.select(${JSON.stringify(TAPE.id)})`);
    await click("#btn-insert");
    await until(`__cat.inserted() === ${JSON.stringify(TAPE.id)}`, 60000);
    await idle();
    await until("!__cat.corner().tape.busy", 5000, 50);
    const swapId = await ev(`(__cat.disks().find(function (d) { return d.displayName === ${JSON.stringify(RIG_GONE)}; }) || {}).id`);
    await ev(`__cat.select(${JSON.stringify(swapId)})`);
    await recStart();
    await click("#btn-insert");
    const tSwapLid = await until("__cat.corner().tape.lid === 'open'", 3000, 30);
    await until(`__cat.inserted() === ${JSON.stringify(swapId)}`, 60000);
    await idle();
    const recTD = await recStop();
    const sw = JSON.parse(await ev("JSON.stringify(__cat.corner().tape)"));
    ok(tSwapLid >= 0 && sw.trace.join(",") === "open,out,close" && !sw.tape && (await ev("__cat.machine().medium")) === "disk",
       `a disk inserted over a tape: the tape leaves the Datasette first, then the disk goes in   [${sw.trace.join(" > ")}; ${await ev("__cat.machine().medium")}]`);
    /* 🆕 2026-10-05 — and the disk is not drawn until the cassette has gone */
    const tdFirst = recTD.findIndex((x) => x.s);
    ok(tdFirst > 0 && recTD.slice(0, tdFirst).some((x) => x.tt) && !recTD[tdFirst].tt && recTD.some((x) => x.tr === "rise,in"),
       `the disk rises into the 1541 only once the cassette is out   [disk first drawn at sample ${tdFirst}]`);
    /* 🆕 2026-10-05 — EJECT (his redesign): latch up, the disk slides out downward, gone */
    await recStart();
    await click("#btn-eject");
    await idle();
    await until("!__cat.corner().disk.busy", 5000, 30);
    const recOut = await recStop();
    const outSeen = recOut.filter((x) => x.s);
    const outFirst = recOut.findIndex((x) => x.s);
    ok(outSeen.length > 0 && outFirst > 0 && !recOut[outFirst].l && recOut.slice(0, outFirst).some((x) => x.l)
       && outSeen.some((x) => x.tr === "out,down") && outSeen.every((x) => x.turn === "180deg" && x.n === RIG_GONE)
       && !(await ev("__cat.corner().disk.shown")),
       `Eject plays the reverse: the latch lifts, then the disk (turned, its label on) slides out downward and is gone   [${[...new Set(recOut.map((x) => (x.s ? x.p : "-") + (x.l ? "/L" : "")))].join(" > ")}]`);

    /* --- F2. no disk, the stuck drive, and F12 mid-load ------------------------
       🔄 2026-10-04 — REPLACES twelve Load presses on an empty drive (Andrew's
       ruling, the hang pass). Those presses were where the core's stuck-drive
       fault (about 1 load in 40 that ends in "file not found" never comes back)
       spoiled about one run in four. Now: Load with no disk types nothing; a
       stuck drive is reset by itself with the disk still in; F12 works while the
       hub waits on a load.
       ⚠️ THE REAL FAULT CANNOT BE MADE ON DEMAND, so the recovery check shortens
       the 20 s wait (CAT_EMU.rigStuckAfter): a real not-found search then counts
       as stuck, and the notice → reset → disk-still-in path runs for real.
       ⭐ EVERY PRESS KEEPS THE 60 s CHECK: still busy after 60 s is the real
       fault NOT being recovered, and it stops the run here, named. */
    section("F2. no disk: Load types nothing; a stuck drive resets with the disk still in; F12 works mid-load");
    const pressDone = async (what) => {
      await until("__cat.machine().busy", 3000, 20);
      if ((await idle()) < 0) {
        const stuck = (await screen()).filter(Boolean).slice(-2).join(" | ");
        throw new Error(`the drive hang (known, OPEN 2026-10-02), NOT recovered, at ${what}: still busy after 60 s   [${stuck}]`);
      }
    };
    const BANNER = (r) => r[1].trim() === "**** COMMODORE 64 BASIC V2 ****" && r[5] === "READY.";
    await untilScreen((r) => r.filter(Boolean).slice(-1)[0] === "READY.", 30000);
    const beforeNoDisk = text(await screen());
    await click("#btn-load");
    await frames(60);
    const noDisk = { note: String(await ev("__cat.note()")), busy: await ev("__cat.machine().busy"), same: text(await screen()) === beforeNoDisk };
    ok(/no disk in the drive/i.test(noDisk.note) && !noDisk.busy && noDisk.same,
       `Load with no disk says "no disk in the drive" and types nothing   [${noDisk.note}; screen unchanged: ${noDisk.same}]`);

    GONE = await ev(`(__cat.disks().find(function (d) { return d.displayName === ${JSON.stringify(RIG_GONE)}; }) || {}).id || null`);
    ok(!!GONE, `the rig's gone disk is in the library   [${GONE}]`);
    if (!GONE) throw new Error("no gone disk to test with");
    await ev(`__cat.select(${JSON.stringify(GONE)})`);
    await click("#btn-insert");
    await until(`__cat.inserted() === ${JSON.stringify(GONE)}`, 60000);
    await idle();
    const goneCmd = await ev("document.getElementById('btn-load').dataset.cmd");

    /* at the REAL wait: a normal not-found answers, and nothing resets */
    await clearScreen();
    await type("PRINT 777\n");
    await click("#btn-load");
    await pressDone("the first Load on the gone disk");
    const nf = { rows: (await screen()).filter(Boolean), note: String(await ev("__cat.note()")), after: await inMachine("CAT_EMU.machine().stuckAfter") };
    if (/the drive stopped answering/.test(nf.note)) {
      /* the REAL fault happened here (about 1 in 40) and was recovered: that is a pass */
      ok(BANNER(await screen()) && (await ev("__cat.inserted()")) === GONE,
         `the real stuck drive happened on this press, and was reset with the disk still in   [${nf.note}]`);
    } else {
      ok(nf.after === 1000 && nf.rows.some((l) => /FILE NOT FOUND/.test(l)) && nf.rows.includes(" 777") && !nf.rows.includes("RUN"),
         `at the real 20 s wait, a normal not-found answers and nothing resets   [${goneCmd} → ${nf.rows.slice(-2).join(" | ")}; wait ${nf.after} frames]`);
      ok(/the load failed, so run was not typed/i.test(nf.note), `and the message line says the load failed, so RUN was not typed   [${nf.note}]`);
    }

    /* the STUCK DRIVE, with the wait shortened so a real search counts as stuck */
    await inMachine("CAT_EMU.rigStuckAfter(10)");
    await clearScreen();
    await type("PRINT 778\n");
    await click("#btn-load");
    await pressDone("the stuck-drive recovery");
    const tRec = await untilScreen(BANNER, 15000);
    const rec = JSON.parse(await ev(`JSON.stringify({ note: __cat.note(), inserted: __cat.inserted(), gameOn: __cat.machine().gameOn,
      latch: __cat.corner().latch.down, name: document.getElementById("detail-title").firstChild.textContent })`));
    const recRows = (await screen()).filter(Boolean);
    await inMachine("CAT_EMU.rigStuckAfter()");
    ok(tRec >= 0 && /^the drive stopped answering, so the c64 was reset\. ZZ CAT RIG GONE is still in the drive\.$/.test(rec.note)
       && !recRows.includes(" 778") && !recRows.includes("RUN"),
       `a stuck drive resets the C64 by itself, and the message line says why in plain words   [${took(tRec)}; ${rec.note}]`);
    ok(rec.inserted === GONE && rec.latch === true && rec.name === RIG_GONE && !rec.gameOn,
       `and the disk is still in: still named under the 1541, latch down   [${rec.inserted}, latch ${rec.latch}, "${rec.name}"]`);
    await type('LOAD"$",8\n');
    await untilScreen((r) => toReady(after(r, /^LOAD"\$",8$/)).slice(-1)[0] === "READY.", 30000);
    await type("LIST\n");
    await untilScreen((r) => toReady(after(r, /^LIST$/)).slice(-1)[0] === "READY.", 20000);
    const recDir = toReady(after(await screen(), /^LIST$/)).filter(Boolean);
    ok(/^0 "RIG GONE DISK/.test(recDir[0] || "") && recDir.some((l) => /"RIG HERE"/.test(l)),
       `and the machine agrees: the directory after the reset is the gone disk's   [${recDir.slice(0, 2).join(" | ")}]`);
    ok((await inMachine("CAT_EMU.machine().stuckAfter")) === 1000, "[control] the rig put the 20 s wait back");

    /* F12 WHILE THE HUB WAITS ON A LOAD */
    await clearScreen();
    await type("PRINT 779\n");
    await click("#btn-load");
    await until("__cat.machine().busy", 3000, 20);
    await frames(20);
    const busyAtF12 = await ev("__cat.machine().busy");
    await press("F12");
    const tF12 = await untilScreen((r) => BANNER(r) && !r.includes(" 779"), 15000);
    await idle();
    const f12 = JSON.parse(await ev(`JSON.stringify({ busy: __cat.machine().busy, note: __cat.note(), inserted: __cat.inserted() })`));
    await frames(60);
    const f12Rows = (await screen()).filter(Boolean);
    ok(busyAtF12 && tF12 >= 0 && !f12.busy && /^reset\. ZZ CAT RIG GONE is still in\.$/.test(f12.note) && f12.inserted === GONE && !f12Rows.includes("RUN"),
       `F12 works while the hub waits on a load: the boot screen, the disk still in, no RUN typed   [busy at F12: ${busyAtF12}; ${took(tF12)}; ${f12.note}]`);
    await click("#btn-eject");
    await idle();
    ok((await ev("__cat.inserted()")) === null, "and Eject empties the drive again for what follows");

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
    /* 🔄 2026-10-02 — F9 ONLY SWAPS THE PORT now (his rulings, "keyboard and
       joystick live together"): there is no keyboard mode for it to take you
       out of, so every press is a swap, from either side. The 2026-09-17/18
       version of this check (first press = "onto the stick", port unchanged)
       described a machine that no longer has modes. */
    const portWas = String(await ev("document.getElementById('c64-side').dataset.port"));
    const portWant = portWas === "1" ? "2" : "1";
    await press("F9");
    const tSwapG = await until(`document.getElementById('c64-side').dataset.port === '${portWant}'`, 5000);
    ok(tSwapG >= 0, `F9 on the hub's side reaches the machine and swaps the port   [port ${portWas} -> ${await ev("document.getElementById('c64-side').dataset.port")}]`);
    /* 🔄 2026-10-04 — List is not shown in the corner now (Phase 2); the Directory
       button types LOAD"$",8 (the drive is empty here, so it stops at the error) */
    await click("#btn-list");
    await idle();
    const tTyped = await untilScreen((r) => after(r, /^PRINT 3$/).includes('LOAD"$",8'), 8000);
    const portAfterG = String(await ev("document.getElementById('c64-side').dataset.port"));
    ok(tTyped >= 0 && portAfterG === portWant,
       `a command button types with the stick live, and nothing switches   [LOAD"$",8 ${took(tTyped)}, port still ${portAfterG}; ${(await screen()).filter(Boolean).slice(-4).join(" | ")}]`);
    await press("F9");
    await until(`document.getElementById('c64-side').dataset.port === '${portWas}'`, 5000);

    /* --- H. the side panel's ports move the REAL stick ---------------------
       His addendum: click a port (or F9) and that port lights, the other port and
       the keyboard grey out — and "don't ship a toggle that doesn't functionally
       do anything". So the machine itself is asked: a BASIC loop prints both
       joystick registers, PEEK(56320) = control port 2 and PEEK(56321) = port 1
       (idle 127 and 255; the stick pushed UP clears bit 0). */
    section("H. keyboard and joystick live together: every key, as the C64 itself reads it");
    const typeCmd = async (cmd) => {
      await ev(`__cat.execute(${JSON.stringify(cmd)})`);
      await until("__cat.machine().busy", 3000, 20);
      await idle();
    };
    await typeCmd("NEW");
    /* 🔄 2026-10-02 — FOUR registers now: the two joystick ports, and the C64's
       own keyboard scan — PEEK(197), the matrix code of the key down (64 = none),
       and PEEK(653), the shift flags (1 Shift, 2 C=, 4 CTRL). So one loop says
       both what the STICK did and what the KEYBOARD did for the same press. */
    await typeCmd("10 PRINT PEEK(56320),PEEK(56321),PEEK(197),PEEK(653)");
    await typeCmd("20 GOTO 10");
    await typeCmd("RUN");
    const registers = async () => {
      const rows = (await screen()).filter((r) => /^\s*\d+\s+\d+\s+\d+\s+\d+$/.test(r));
      return rows.length ? rows[rows.length - 1].trim().split(/\s+/).map(Number) : null;
    };
    ok((await untilScreen((r) => r.filter((x) => /^\s*127\s+255\s+64\s+0$/.test(x)).length >= 3, 8000)) >= 0,
       `[control] the loop is running, the stick is idle and no key is down   [${JSON.stringify(await registers())}]`);
    const holdKey = async (keyCode, modifiers = []) => {
      wc.sendInputEvent({ type: "keyDown", keyCode, modifiers });
      await frames(40);
      const held = await registers();
      wc.sendInputEvent({ type: "keyUp", keyCode, modifiers });
      await frames(25);
      return held;
    };
    const holdUp = () => holdKey("Up");
    /* a key Electron cannot name by side (Right Ctrl), sent as the browser would */
    const holdSynth = async (code, key, keyCode, location) => {
      const mk = (t) => `${FRAME}.EJS_emulator.elements.parent.dispatchEvent(new KeyboardEvent("${t}", { code: "${code}", key: "${key}", keyCode: ${keyCode}, which: ${keyCode}, location: ${location}, ctrlKey: ${t === "keydown"}, bubbles: true, cancelable: true }))`;
      await ev(mk("keydown")); await frames(40);
      const held = await registers();
      await ev(mk("keyup")); await frames(25);
      return held;
    };
    await click("#c64-port1");
    const tP1 = await until("document.getElementById('c64-side').dataset.port === '1'", 5000);
    let sp = await ev(SIDE);
    ok(tP1 >= 0 && sp.p1 === "lit" && sp.p2 === "plain" && sp.grey === 0 && sp.stick === "lit",
       `clicking Port 1 lights it, Port 2 goes plain, and nothing greys: the keyboard stays live   [${JSON.stringify(sp)}]`);
    const up1 = await holdUp();
    ok(up1 && up1[0] === 127 && up1[1] === 254, `the arrow pushed up reads on port 1's register, not port 2's   [${JSON.stringify(up1)}]`);
    await press("F9");
    const tP2 = await until("document.getElementById('c64-side').dataset.port === '2'", 5000);
    sp = await ev(SIDE);
    ok(tP2 >= 0 && sp.p2 === "lit" && sp.p1 === "plain" && sp.grey === 0, `F9 swaps to Port 2, and the panel follows   [${JSON.stringify(sp)}]`);
    const up2 = await holdUp();
    ok(up2 && up2[0] === 126 && up2[1] === 255 && up2[2] === 64,
       `the same arrow reads on port 2, and is the STICK ONLY: no cursor key reached the C64   [${JSON.stringify(up2)}]`);
    const fire = await holdKey("Control");
    ok(fire && fire[0] === 111 && fire[3] === 0, `Ctrl is FIRE on the stick's port, and is not passed to the C64 (no C= flag)   [${JSON.stringify(fire)}]`);
    const fireR = await holdSynth("ControlRight", "Control", 17, 2);
    const portR = String(await ev("document.getElementById('c64-side').dataset.port"));
    const upR = await holdUp();
    ok(fireR && fireR[0] === 111 && portR === "2" && upR && upR[0] === 126,
       `Right Ctrl is fire too, and it no longer swaps the port behind the label's back   [${JSON.stringify(fireR)}; port ${portR}; up ${JSON.stringify(upR)}]`);
    const cbm = await holdKey("Alt");
    ok(cbm && cbm[0] === 127 && cbm[3] === 2, `Left Alt is the C64's C= key (the flag Left Ctrl used to set), and does not fire   [${JSON.stringify(cbm)}]`);
    const ctl = await holdKey("Tab");
    ok(ctl && ctl[3] === 4, `Tab is the C64's CTRL key   [${JSON.stringify(ctl)}]`);
    const fk1 = await holdKey("F1"), fk4 = await holdKey("F4");
    ok(fk1 && fk1[2] === 4 && fk1[3] === 0 && fk4 && fk4[2] === 5 && fk4[3] === 1,
       `F1 is the C64's f1, and F4 is its f4 (Shift + f3), as the Help sheet says   [${JSON.stringify(fk1)} ${JSON.stringify(fk4)}]`);
    await press("F2");
    const tCur = await until("document.getElementById('c64-side').dataset.arrows === 'cursor'", 5000);
    sp = await ev(SIDE);
    ok(tCur >= 0 && sp.cursor === "lit" && sp.stick === "plain" && sp.p2 === "lit",
       `F2 flips the arrows to the C64's cursor keys; the port stays lit   [${JSON.stringify(sp)}]`);
    const upC = await holdUp();
    ok(upC && upC[0] === 127 && upC[2] === 7 && upC[3] === 1,
       `and now the arrow is the CURSOR key only (Shift + CRSR, as on a real C64), the stick untouched   [${JSON.stringify(upC)}]`);
    await click("#c64-arrows-stick");
    const tStk = await until("document.getElementById('c64-side').dataset.arrows === 'stick'", 5000);
    const upS = await holdUp();
    ok(tStk >= 0 && upS && upS[0] === 126 && upS[2] === 64, `clicking Stick puts the arrows back on the joystick   [${JSON.stringify(upS)}]`);
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
    /* 🔄 2026-10-05 — DOUBLE-SIDED DISKS (his rulings): "Side A / Side B" is
       Disk 1, Side A / B, ONE disk: the swap turns it over (out to the slot, a
       flip on the vertical axis, back in), never out and down. */
    section("I. a double-sided disk: Side A in, one click turns it over to Side B, on drive 8, in the running machine");
    const PAIR = (await ev("__cat.disks().map(function (d) { return { id: d.id, name: d.displayName, n: (d.files || []).length }; })"))
      .find((d) => d.name === SWAP_TITLE);
    ok(!!PAIR && PAIR.n === 2, `the library pairs the two files as ONE game with two sides   [${PAIR ? PAIR.id + ", " + PAIR.n + " sides" : "not found"}]`);
    if (PAIR) {
      const sides = () => ev(`JSON.stringify({ buttons: Array.prototype.map.call(document.querySelectorAll("#side-swap button"), function (b) { return b.textContent; }),
        shown: !document.getElementById("side-swap").hidden, now: (document.querySelector("#detail-title .detail-disk") || { textContent: "" }).textContent })`).then(JSON.parse);
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
      ok(s0.shown && s0.buttons.join("|") === "Swap to Disk 1, Side B" && s0.now === "Disk 1, Side A",
         `it goes in on Side A: ONE button, "Swap to Disk 1, Side B", and the drive says which side   [${s0.buttons.join("|")} / ${s0.now}]`);
      const hA = await header();
      /* on a miss, say what the machine and the page were doing (it has missed
         intermittently; the screen and focus are the evidence) */
      const why = async () => `; focus ${await ev("document.activeElement.id || document.activeElement.tagName")}; machine ${JSON.stringify(await inMachine("CAT_EMU.machine()"))
        }; frames/s ${await (async () => { const a = await frameNow(); await wait(1000); return (await frameNow()) - a; })()}; screen: ${(await screen()).filter(Boolean).slice(-6).join(" / ")}`;
      ok(/^0 "RIG SIDE A/.test(hA), `the machine reads Side A on drive 8   [${hA}${/^0 "RIG SIDE A/.test(hA) ? "" : await why()}]`);
      await recStart();
      await click("#side-swap button");
      const tSwap = await until(`${DISK_LINE} === 'Disk 1, Side B'`, 30000);
      await idle();
      await until("!__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
      /* 🔄 2026-10-05 — THE SAME DISK TURNED OVER (his rulings): latch up, OUT to
         the slot (never down and away), FLIPPED there with the label face going
         and the plain face coming, back IN, the latch drops. The machine's swap is
         sent at the slot, when the drive is empty: after the pull, BEFORE the flip. */
      const recSw = await recStop();
      const sentAt = await ev("__cat.corner().swapSentAt");
      const shownSw = recSw.filter((x) => x.s);
      const swA = shownSw.filter((x) => x.f === "A"), swB = shownSw.filter((x) => x.f === "B");
      const swLast = recSw.length - 1 - [...recSw].reverse().findIndex((x) => x.s);
      const swDrop = recSw.findIndex((x, i) => i > swLast && x.l);
      ok(swA.length > 0 && swB.length > 0 && shownSw.every((x) => !x.l && x.p !== "below") && shownSw.some((x) => x.tr === "out,flip,in")
         && recSw.indexOf(swA[swA.length - 1]) < recSw.indexOf(swB[0]) && shownSw.every((x) => x.turn === "180deg") && swDrop > swLast,
         `a turn-over plays OUT to the slot, FLIP, back IN, never down and away; then the latch drops   [${[...new Set(recSw.map((x) => (x.s ? x.f + ":" + x.p + ":" + x.tr : "-") + (x.l ? "/L" : "")))].join(" > ")}]`);
      ok(swA.length > 0 && swB.length > 0 && sentAt >= swA[0].t + 150 && sentAt <= swB[0].t + 20,
         `and the machine swaps at the slot, the drive empty: after the pull, before the flip   [${swA.length && sentAt - swA[0].t} ms after the pull began; the flip ${swB.length && swB[0].t - sentAt} ms after the swap]`);
      const dkB = JSON.parse(await ev("JSON.stringify(__cat.corner().disk)"));
      ok(dkB.face === "B" && dkB.side === "Disk 1, Side B", `it went back in plain side up, Side B   [${dkB.face}, "${dkB.side}"]`);
      const s1 = await sides();
      ok(tSwap >= 0 && s1.buttons.join("|") === "Swap to Disk 1, Side A", `one click: Side B is in, and the button now offers Side A   [${took(tSwap)}, ${s1.buttons.join("|")}]`);
      ok((await screen()).some((r) => /^0 "RIG SIDE A/.test(r)),
         "the machine was NOT reset by the swap: Side A's listing is still on its screen");
      const hB = await header();
      ok(/^0 "RIG SIDE B/.test(hB), `and the same drive 8 now reads Side B   [${hB}]`);
      await click("#side-swap button");
      await recStart();
      await until(`${DISK_LINE} === 'Disk 1, Side A'`, 30000);
      await idle();
      await until("!__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
      const recBack = (await recStop()).filter((x) => x.s);
      ok(recBack.length > 0 && recBack.some((x) => x.tr === "out,flip,in") && recBack[0].f === "B" && recBack[recBack.length - 1].f === "A" && recBack.every((x) => x.p !== "below"),
         `and back: turned over again, the label face up   [${[...new Set(recBack.map((x) => x.f + ":" + x.p))].join(" > ")}]`);
      const hA2 = await header();
      ok(/^0 "RIG SIDE A/.test(hA2), `and back: one click, Side A again   [${hA2}]`);
      await click("#btn-eject");
      await idle();
      const s2 = await sides();
      /* 🔄 2026-10-04 — the corner's ONE line (his ruling, Phase 1) still names a
         picked set after Eject: "Side A" is what Insert would put in, and the
         only place left that says this game is a set. The control does go. */
      ok(!s2.shown && s2.now === "Disk 1, Side A", `Eject takes the swap control away with the disk, and the line says what Insert puts in   [${s2.now}]`);
    }

    /* --- Q. the Load choice, the disk picker, and the input a title starts on --
       🆕 2026-10-01 — Chat's handoff and Andrew's rulings the same day. The rig
       lays its OWN disks and its OWN manifest file (`_library.zz-rig.json`,
       beside his `_library.json`, which is never opened here) — so every case
       is tested against fixtures whose every file is known:
         RIG ONE     one entry; its first file is a DIFFERENT program, so a
                     LOAD"*" would print the wrong line
         RIG CHOICE  three entries (two files, one text) and a third file the
                     manifest does not name; marked port 1
         RIG TRIO    three images, d1..d3
       The two-image set is §I's pair; the unmatched title is §D's DISK. */
    section("Q. Load asks only what the manifest lists; three disks get a picker; the title's input is remembered");
    const rigIds = await ev(`JSON.stringify(__cat.disks().filter(function (d) { return /^zz CAT rig (choice|one|trio)$/.test(d.displayName); })
      .map(function (d) { return { id: d.id, name: d.displayName, n: (d.files || []).length, ch: (d.choices || []).length, port: d.port || 2 }; }))`).then(JSON.parse);
    const rid = (n) => (rigIds.find((d) => d.name === n) || {}).id;
    ok(rigIds.length === 3 && rigIds.find((d) => d.name === RIG_CHOICE).ch === 3 && rigIds.find((d) => d.name === RIG_ONE).ch === 1
       && rigIds.find((d) => d.name === RIG_TRIO).n === 3 && rigIds.find((d) => d.name === RIG_CHOICE).port === 1,
       `the rig's manifest is read beside his: 3 choices, 1 choice, a set of 3, port 1   [${JSON.stringify(rigIds)}]`);
    ok(DISK && (await ev(`(__cat.choices(${JSON.stringify(DISK.id)}) || []).length`)) === 0,
       `[control] §D's disk is one the manifest does not name, so Load "*" there is the unmatched case   [${DISK && DISK.name}]`);
    const pick = () => ev("JSON.stringify(__cat.pick())").then(JSON.parse);
    const loadText = () => ev("document.getElementById('btn-load').textContent");
    const insertRig = async (id) => {
      if (await ev("__cat.inserted() !== null")) { await click("#btn-eject"); await idle(); }
      await ev(`__cat.select(${JSON.stringify(id)})`);
      await click("#btn-insert");
      await until(`__cat.inserted() === ${JSON.stringify(id)}`, 60000);
      await idle();
    };
    const ran = (line) => untilScreen((r) => r.includes(line), 120000);

    /* one entry: no prompt, and it types the file by NAME */
    await insertRig(rid(RIG_ONE));
    const oneLabel = String(await loadText()).replace(/ /g, " ");
    ok(oneLabel === 'Load "RIG ONE",8,1', `one entry: the Load button says the file it will type   [${oneLabel}]`);
    await clearScreen();
    await click("#btn-load");
    ok((await pick()) === null, "and loads straight away: no prompt");
    const tOne = await ran("RIG ONE RAN");
    await idleLoad();
    ok(tOne >= 0 && !(await screen()).includes("RIG PART RAN"),
       `it typed LOAD"RIG ONE",8,1 and RUN: the named program ran, not the disk's first file   [${took(tOne)}; ${(await screen()).filter(Boolean).slice(-3).join(" / ")}]`);
    const sideQ = () => ev(SIDE);
    let spQ = await sideQ();
    ok(spQ.arrows === "stick" && spQ.port === "2", `after RUN the hub hands over to the title's input: arrows on the stick, port 2 by default   [${spQ.arrows} ${spQ.port}]`);

    /* the same, from the full-screen strip */
    await ev("__cat.full(true)");
    await until("__cat.machine().full", 3000);
    await clearScreen();
    await click("#btn-load");
    ok((await pick()) === null, "in full screen too, one entry loads straight away: no prompt");
    const tOneFull = await ran("RIG ONE RAN");
    await idleLoad();
    ok(tOneFull >= 0, `and it ran, from the strip   [${took(tOneFull)}]`);
    await ev("__cat.full(false)");
    await until("!__cat.machine().full", 3000);

    /* 🆕 2026-10-04 — PHASE 2 (his rulings).
       ONE LOAD BUTTON: it turns into Run ONLY when a load came back to READY. with
       RUN not typed (never on "started"). The hub types RUN itself whenever it can,
       so the rig switches that off (__cat.autoRun, rig-only) to reach the state a
       failed RUN leaves. Reset, Eject and Swap (below, on the trio) put Load back. */
    const loadCmd = () => ev("document.getElementById('btn-load').dataset.cmd");
    const toRun = async () => {
      await clearScreen();
      await click("#btn-load");
      await untilScreen((r) => r.includes('LOAD"RIG ONE",8,1'), 10000);
      await idleLoad();
    };
    ok((await ev("__cat.machine().gameOn")) === true, "[control] after Load ran it, the hub knows a game is going");
    await ev("__cat.autoRun(false)");
    await toRun();
    ok((await loadText()) === "Run" && (await loadCmd()) === "RUN" && !(await screen()).includes("RIG ONE RAN"),
       `a load that ends at READY. with RUN not typed: the button says Run, and nothing ran   [${await loadText()} / ${await loadCmd()}]`);
    await click("#btn-load");
    const tRunQ = await ran("RIG ONE RAN");
    await idle();
    ok(tRunQ >= 0 && String(await loadText()).replace(/\u00a0/g, " ") === 'Load "RIG ONE",8,1' && (await ev("__cat.machine().gameOn")) === true,
       `Run types RUN: it ran, and the button is back to Load   [${took(tRunQ)}, ${await loadText()}]`);
    await toRun();
    await press("F12");
    await untilScreen((r) => r[5] === "READY." && r.slice(6).every((x) => x === ""), 20000);
    await idle();
    ok(String(await loadText()).replace(/\u00a0/g, " ") === 'Load "RIG ONE",8,1' && !(await ev("__cat.machine().gameOn")),
       `Reset (F12) puts Run back to Load   [${await loadText()}]`);
    await toRun();
    await click("#btn-eject");
    await idle();
    ok((await loadCmd()) === 'LOAD"*",8,1' && (await ev("__cat.machine().loadMode")) === "load",
       `Eject puts Run back to Load   [${await loadText()}]`);
    await ev("__cat.autoRun(true)");

    /* INSERT WHILE A GAME IS RUNNING RESETS FIRST; at a bare READY. it does not */
    await insertRig(rid(RIG_ONE));
    await clearScreen();
    await click("#btn-load");
    await ran("RIG ONE RAN");
    await idleLoad();
    await type("PRINT 6543\n");
    await untilScreen((r) => r.includes(" 6543"), 6000);
    ok((await ev("__cat.machine().gameOn")) === true, "[control] a game the hub ran is going");
    /* ⚠️ rid() knows only the choice, one and trio disks: the trio it is */
    await ev(`__cat.select(${JSON.stringify(rid(RIG_TRIO))})`);
    const preIns = JSON.stringify(await ev("JSON.stringify({ game: __cat.machine().gameOn, busy: __cat.machine().busy, dis: document.getElementById('btn-insert').disabled })"));
    await click("#btn-insert");
    await until(`__cat.inserted() === ${JSON.stringify(rid(RIG_TRIO))}`, 60000);
    await idle();
    const tIns = await untilScreen((r) => r[1].trim() === "**** COMMODORE 64 BASIC V2 ****" && r[5] === "READY." && !r.includes(" 6543"), 10000);
    const insRows = await screen();
    ok(tIns >= 0 && !(await ev("__cat.machine().gameOn")),
       `Insert while a game is running resets first: the boot screen, the old game gone   [${took(tIns)}; ${insRows.filter(Boolean).slice(0, 3).join(" / ")}${tIns >= 0 ? "" :
         "; before " + preIns + "; hub said " + JSON.stringify(await ev("__cat.lines().slice(-4)")) + "; machine " + JSON.stringify(await inMachine("CAT_EMU.machine()")) + "; rows " + insRows.filter(Boolean).join(" / ")}]`);
    await type("PRINT 7654\n");
    await untilScreen((r) => r.includes(" 7654"), 6000);
    await ev(`__cat.select(${JSON.stringify(rid(RIG_ONE))})`);
    await click("#btn-insert");
    await until(`__cat.inserted() === ${JSON.stringify(rid(RIG_ONE))}`, 60000);
    await idle();
    ok((await screen()).includes(" 7654"), "[control] Insert at a bare READY. goes in without a reset: the screen is untouched");

    /* several entries: the prompt, with ONLY those entries */
    await insertRig(rid(RIG_CHOICE));
    ok((await loadText()) === "Load…", `several entries: the Load button says it will ask   [${await loadText()}]`);
    await click("#btn-load");
    let pk = await pick();
    ok(!!pk && pk.options.map((o) => o.label).join("|") === "Play|Instructions|Notes" && pk.anchor === "btn-load",
       `Load opens the prompt with exactly the manifest's entries   [${pk ? pk.options.map((o) => o.label).join("|") : "none"}]`);
    ok(!!pk && !pk.options.some((o) => /PART/.test(o.label)), "and nothing else off the disk (RIG PART is on it, and is not offered)");
    const loadRect = await ev("JSON.stringify(document.getElementById('btn-load').getBoundingClientRect())").then(JSON.parse);
    ok(!!pk && (pk.rect.bottom <= loadRect.top + 1 || pk.rect.top >= loadRect.bottom - 1), `it sits beside the Load button, not over it   [prompt ${pk && pk.rect.top}-${pk && pk.rect.bottom}, load ${Math.round(loadRect.top)}-${Math.round(loadRect.bottom)}]`);
    await click("#screen-shell");
    ok((await pick()) === null, "a click outside closes it");
    await click("#btn-load");
    await click("#c64-pick .c64-pick__cancel");
    ok((await pick()) === null && (await until("document.activeElement === document.getElementById('machine-frame')", 3000)) >= 0,
       "Cancel closes it and the keyboard goes back into the machine");
    /* the text entry: shown, never typed */
    await click("#btn-load");
    await click("#c64-pick .c64-pick__opt:nth-of-type(3)");
    pk = await pick();
    ok(!!pk && pk.text === "RIG NOTES: SHOWN, NEVER TYPED" && pk.title === "Notes", `a text entry is shown in the prompt   [${pk && pk.text}]`);
    ok(!(await screen()).some((r) => /NOTES/.test(r)), "and nothing was typed into the machine for it");
    await click("#c64-pick .c64-pick__cancel");
    /* Instructions: its file, by name */
    await clearScreen();
    await click("#btn-load");
    await click("#c64-pick .c64-pick__opt:nth-of-type(2)");
    const tHelp = await ran("RIG HELP RAN");
    await idleLoad();
    ok(tHelp >= 0, `Instructions types LOAD"RIG HELP",8,1 and RUN: its own program ran   [${took(tHelp)}]`);
    ok((await until("document.activeElement === document.getElementById('machine-frame')", 3000)) >= 0, "and the keyboard is back in the machine");
    spQ = await sideQ();
    ok(spQ.arrows === "stick" && spQ.port === "1", `a title the manifest marks port 1 starts on port 1   [${spQ.arrows} ${spQ.port}]`);

    /* learning: the player's switch is remembered for that title */
    await click("#c64-port2");
    await until(`document.getElementById("c64-side").dataset.port === "2"`, 5000);
    await wait(300);
    let mem = await ev("__cat.inputs()");
    const memOf = (id) => mem[rid(id)] || {};
    ok(memOf(RIG_CHOICE).port === "2" && memOf(RIG_CHOICE).arrows === "stick",
       `the player moves the stick to port 2 during the game, and it is remembered as {port, arrows}   [${JSON.stringify(mem)}]`);
    await clearScreen();
    await click("#btn-load");
    await click("#c64-pick .c64-pick__opt:nth-of-type(1)");
    const tPlayQ = await ran("RIG PLAY RAN");
    await idleLoad();
    await until(`document.getElementById("c64-side").dataset.port === "2"`, 5000);
    spQ = await sideQ();
    ok(tPlayQ >= 0 && spQ.arrows === "stick" && spQ.port === "2", `next load: Play runs, and the remembered port 2 beats the manifest's port 1   [${took(tPlayQ)}; ${spQ.arrows} ${spQ.port}]`);
    await click("#c64-arrows-cursor");
    await until(`document.getElementById("c64-side").dataset.arrows === "cursor"`, 5000);
    await wait(300);
    mem = await ev("__cat.inputs()");
    ok(memOf(RIG_CHOICE).arrows === "cursor" && memOf(RIG_CHOICE).port === "2",
       `switching the arrows to cursor keys is remembered too, with the port   [${JSON.stringify(mem[rid(RIG_CHOICE)])}]`);
    await clearScreen();
    await click("#btn-load");
    await click("#c64-pick .c64-pick__opt:nth-of-type(1)");
    await ran("RIG PLAY RAN");
    await idleLoad();
    await wait(800);
    spQ = await sideQ();
    ok(spQ.arrows === "cursor" && spQ.port === "2", `a cursor-keys title starts on the cursor keys after RUN, on its remembered port   [${spQ.arrows} ${spQ.port}]`);
    mem = await ev("__cat.inputs()");
    ok(mem[rid(RIG_ONE)] === undefined, `[control] nothing was learned for a title the player did not change   [${JSON.stringify(mem)}]`);

    /* 🆕 2026-10-02 — A VALUE STORED BEFORE {port, arrows} (his ruling): one
       string, read as "1"/"2" = that port, and "keyboard" = arrows on the cursor
       keys with the manifest's port. Planted by hand, as an old browser holds it. */
    const plant = (v) => ev(`(function () { var all = JSON.parse(localStorage.getItem("plc.c64.input") || "{}");
      all[${JSON.stringify(rid(RIG_ONE))}] = ${JSON.stringify(v)}; localStorage.setItem("plc.c64.input", JSON.stringify(all)); return true; })()`);
    for (const [old, wantPort, wantArrows] of [["keyboard", "2", "cursor"], ["1", "1", "stick"]]) {
      await plant(old);
      await insertRig(rid(RIG_ONE));
      await clearScreen();
      await click("#btn-load");
      await ran("RIG ONE RAN");
      await idleLoad();
      await until(`document.getElementById("c64-side").dataset.port === "${wantPort}" && document.getElementById("c64-side").dataset.arrows === "${wantArrows}"`, 5000);
      spQ = await sideQ();
      ok(spQ.port === wantPort && spQ.arrows === wantArrows,
         `an old stored "${old}" migrates: port ${wantPort}, arrows on the ${wantArrows === "cursor" ? "cursor keys" : "stick"}   [${spQ.port} ${spQ.arrows}]`);
    }
    mem = await ev("__cat.inputs()");
    ok(mem[rid(RIG_ONE)] === "1", `[control] an old value is only rewritten when the player changes something   [${JSON.stringify(mem[rid(RIG_ONE)])}]`);
    await insertRig(rid(RIG_CHOICE));

    /* full screen (his ruling, 2026-10-01): Load is in the strip, and its
       prompt opens above the strip, as the disk picker's does */
    await ev("__cat.full(true)");
    await until("__cat.machine().full", 3000);
    /* 🔄 2026-10-05 (5b) — the whole deck is the strip: Load stays in its START group on the top row */
    ok((await ev("document.getElementById('deck-start').parentNode.id")) === "deck-top" && (await ev("document.getElementById('btn-load').parentNode.id")) === "deck-start"
       && (await ev("document.getElementById('deck-top').getBoundingClientRect().height > 0")),
       "in full screen, Load is in the strip, inside its Start group on the strip's top row");
    await click("#btn-load");
    pk = await pick();
    const stripQ = await ev("JSON.stringify(document.getElementById('c64-side').getBoundingClientRect())").then(JSON.parse);
    ok(!!pk && pk.options.length === 3 && pk.rect.bottom <= stripQ.top + 1,
       `in full screen, Load's prompt opens above the strip   [prompt bottom ${pk && pk.rect.bottom}, strip top ${Math.round(stripQ.top)}]`);
    await clearScreen();
    await click("#c64-pick .c64-pick__opt:nth-of-type(1)");
    const tFullPlay = await ran("RIG PLAY RAN");
    await idleLoad();
    ok(tFullPlay >= 0 && (await ev("__cat.machine().full")),
       `and Play from there loads and runs, still in full screen   [${took(tFullPlay)}; note "${await ev("__cat.note()")}"]`);
    await ev("__cat.full(false)");
    await until("!__cat.machine().full", 3000);
    ok((await ev("document.getElementById('deck-start').parentNode.id")) === "deck-top", "leaving full screen puts the Start group, Load in it, back on the deck");
    /* paused: no prompt */
    await ev("__cat.pause()");
    await until("__cat.machine().paused", 5000);
    await click("#btn-load");
    ok((await pick()) === null, "while paused, Load opens no prompt");
    await ev("__cat.pause()");
    await until("!__cat.machine().paused", 5000);

    /* three images: one button, and a picker */
    const sidesQ = () => ev(`JSON.stringify({ buttons: Array.prototype.map.call(document.querySelectorAll("#side-swap button"), function (b) { return b.textContent; }),
      now: (document.querySelector("#detail-title .detail-disk") || { textContent: "" }).textContent })`).then(JSON.parse);
    /* 🆕 2026-10-03 — THE 1541's LATCH (his table): down once a disk is in,
       still down after a swap (it went up and came down), up after Eject */
    const latchQ = () => ev("JSON.stringify(__cat.corner().latch)").then(JSON.parse);
    const latchSettled = (down) => until(`!__cat.corner().latch.moving && __cat.corner().latch.down === ${down}`, 5000);
    await insertRig(rid(RIG_TRIO));
    ok((await latchSettled(true)) >= 0, `the latch drops once the disk is in   [${JSON.stringify(await latchQ())}]`);
    /* 🆕 2026-10-04 — Phase 2: leave the button on Run, so the swap below can put it back */
    await ev("__cat.autoRun(false)");
    await clearScreen();
    await click("#btn-load");
    await untilScreen((r) => r.includes('LOAD"*",8,1'), 10000);
    await idleLoad();
    await ev("__cat.autoRun(true)");
    ok((await loadText()) === "Run", `[control] Disk 1's program loaded, and the button says Run   [${await loadText()}]`);

    let sq = await sidesQ();
    ok(sq.buttons.join("|") === "Swap disk…" && sq.now === "Disk 1, Side A", `three files (d1-d3 = Disk 1 A/B, Disk 2 A): ONE button, and the drive says which is in   [${sq.buttons.join("|")} / ${sq.now}]`);
    await click("#side-swap button");
    pk = await pick();
    ok(!!pk && pk.options.map((o) => o.label + (o.lit ? "*" : "")).join("|") === "Disk 1, Side A*|Disk 1, Side B|Disk 2, Side A",
       `it opens a picker with only that set, plainly labelled, the one in the drive lit   [${pk ? pk.options.map((o) => o.label + (o.lit ? "*" : "")).join("|") : "none"}]`);
    await recStart();
    await click("#c64-pick .c64-pick__opt:nth-of-type(3)");
    const tPick = await until(`${DISK_LINE} === 'Disk 2, Side A'`, 30000);
    await idle();
    await until("!__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
    /* 🆕 2026-10-05 — a DIFFERENT disk is never turned over (his ruling): out and
       down, the next one up and in, label face up (it is a Side A) */
    const recD2 = (await recStop()).filter((x) => x.s);
    ok(recD2.some((x) => x.tr === "out,down") && recD2.some((x) => x.tr === "rise,in") && !recD2.some((x) => /flip/.test(x.tr)) && recD2.every((x) => x.f === "A"),
       `a different disk is not flipped: out and down, then Disk 2 up and in, label up   [${[...new Set(recD2.map((x) => x.f + ":" + x.tr))].join(" > ")}]`);
    ok(tPick >= 0 && (await until("document.activeElement === document.getElementById('machine-frame')", 3000)) >= 0,
       `picking Disk 3 puts it in, and the keyboard goes back to the machine   [${took(tPick)}]`);
    ok((await ev("document.getElementById('btn-load').dataset.cmd")) === 'LOAD"*",8,1',
       `and the Swap put Run back to Load   [${await loadText()}]`);
    await clearScreen();
    await type('LOAD"$",8\n');
    await untilScreen((r) => toReady(after(r, /^LOAD"\$",8$/)).slice(-1)[0] === "READY.", 60000);
    await type("LIST\n");
    await untilScreen((r) => toReady(after(r, /^LIST$/)).slice(-1)[0] === "READY.", 20000);
    const hT = (toReady(after(await screen(), /^LIST$/)).filter(Boolean)[0] || "").replace(/\s+/g, " ");
    ok(/^0 "RIG TRIO 3/.test(hT), `drive 8 now reads d3 (Disk 2, Side A)   [${hT}]`);
    ok((await latchSettled(true)) >= 0, `and after the swap the latch is down again   [${JSON.stringify(await latchQ())}]`);
    /* 🆕 2026-10-05 — a DIRECT PICK OF A SIDE B (his ruling): a different disk, so
       no flip, and it goes in plain side up, no label */
    await click("#side-swap button");
    pk = await pick();
    await recStart();
    await click("#c64-pick .c64-pick__opt:nth-of-type(2)");
    const tPickB = await until(`${DISK_LINE} === 'Disk 1, Side B'`, 30000);
    await idle();
    await until("!__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
    const recPB = (await recStop()).filter((x) => x.s);
    const inPB = recPB.filter((x) => x.tr === "rise,in" || x.tr === "rise");
    ok(tPickB >= 0 && !recPB.some((x) => /flip/.test(x.tr)) && inPB.length > 0 && inPB.every((x) => x.f === "B")
       && recPB.filter((x) => /^out/.test(x.tr)).every((x) => x.f === "A"),
       `picking Disk 1, Side B straight from Disk 2: no flip, and it goes in plain side up   [${[...new Set(recPB.map((x) => x.f + ":" + x.tr))].join(" > ")}]`);

    /* full screen: the picker opens above the strip */
    await ev("__cat.full(true)");
    await until("__cat.machine().full", 3000);
    await click("#side-swap button");
    pk = await pick();
    const strip = await ev("JSON.stringify(document.getElementById('c64-side').getBoundingClientRect())").then(JSON.parse);
    ok(!!pk && pk.rect.bottom <= strip.top + 1, `in full screen the picker opens above the strip   [prompt bottom ${pk && pk.rect.bottom}, strip top ${Math.round(strip.top)}]`);
    await click("#c64-pick .c64-pick__opt:nth-of-type(1)");
    const tFull = await until(`${DISK_LINE} === 'Disk 1, Side A'`, 30000);
    await idle();
    ok(tFull >= 0 && (await ev("__cat.note()")) === "disk 1, side a is in the drive.", `and a pick there works, said on the strip's message line   [${await ev("__cat.note()")}]`);
    const lampsSw = JSON.parse(await ev("JSON.stringify(__cat.corner().lamps)"));
    ok(lampsSw.failed === false && lampsSw.loading === false, `after a swap the red is dark   [${JSON.stringify(lampsSw)}]`);
    await ev("__cat.full(false)");
    await click("#btn-eject");
    await idle();
    ok((await latchSettled(false)) >= 0, `Eject lifts the latch   [${JSON.stringify(await latchQ())}]`);

    /* 🆕 2026-10-03 — THE DOS ERROR BLINK (his ruling): a Load that ends in
       ?FILE NOT FOUND leaves the red lamp blinking, until the next Load, Insert
       or Swap.
       🔄 2026-10-04 — measured twice: Load "*" on the trio's EMPTY disks never
       answers ?FILE NOT FOUND; the drive sits on LOADING for good (fresh disk or
       after LOAD"$" alike) and every typing check after it cascaded red. So the
       error comes from the EMPTY DRIVE instead, the one §F2 fails twelve times
       fast, and the reset below keeps one hang from becoming twenty fails.
       🔄 2026-10-04 — and now from the rig's GONE disk (Load on an empty drive
       types nothing since the hang pass): its manifest names a file it lacks. */
    await insertRig(GONE);
    await clearScreen();
    await click("#btn-load");
    await until("__cat.machine().busy", 3000, 20);
    const tNF = await untilScreen((r) => r.some((l) => /FILE NOT FOUND/.test(l)), 60000);
    ok(tNF >= 0, `Load on the gone disk answers ?FILE NOT FOUND   [${(await screen()).filter(Boolean).slice(-3).join(" | ")}]`);
    await idleLoad();
    if (tNF < 0) { await ev("__cat.reset()"); await idle(); }
    const lampsNF = JSON.parse(await ev("JSON.stringify(__cat.corner().lamps)"));
    ok(lampsNF.failed === true && lampsNF.loading === false, `?FILE NOT FOUND leaves the red lamp blinking   [${JSON.stringify(lampsNF)}]`);
    await wait(1500);
    ok((await ev("__cat.corner().lamps.failed")) === true, "and it keeps blinking, with nothing else done");
    await insertRig(rid(RIG_ONE));
    const lampsIn = JSON.parse(await ev("JSON.stringify(__cat.corner().lamps)"));
    ok(lampsIn.failed === false && lampsIn.loading === false, `the next Insert clears the blink, and the red is dark again   [${JSON.stringify(lampsIn)}]`);
    await click("#btn-eject");
    await idle();

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

    /* --- T. 🆕 2026-10-05 — PHASE 5a: the lever, Change Disk, Remove, Hard Reset ----
       His rulings (behaviour only). The lever opens: the disk pops out ~half an
       inch, the machine pauses; shut, it goes back and resumes. The popped disk's
       menu: Remove (the game ends), and for a set, Change Disk, which is the swap
       button's own machineSwap (no reset: what is on the screen stays). */
    section("T. 5a: the 1541's lever pops the disk (and pauses a running game); its menu removes or changes the disk; Hard Reset");
    const tClickAt = async (x, y) => {
      wc.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: 1 });
      await wait(40);
      wc.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: 1 });
      await wait(120);
    };
    /* the popped disk shows only below the slot: click its visible strip */
    const tClickPopped = async () => {
      const r = JSON.parse(await ev(`JSON.stringify((function () { var w = document.getElementById("drive-diskwin").getBoundingClientRect(),
        d = document.getElementById("drive-disk").getBoundingClientRect(); return { x: Math.round(d.left + d.width / 2), y: Math.round(Math.min(d.bottom, w.bottom) - 4), top: w.top }; })())`));
      await tClickAt(r.x, r.y);
      return r;
    };
    const lv = () => ev("JSON.stringify({ lever: __cat.corner().lever, paused: __cat.machine().paused, disk: __cat.corner().disk, latch: __cat.corner().latch })").then(JSON.parse);
    const tPair = (await ev("__cat.disks().map(function (d) { return { id: d.id, name: d.displayName, n: (d.files || []).length }; })")).find((d) => d.name === SWAP_TITLE);
    await insertRig(tPair.id);
    await clearScreen();
    await type("PRINT 5150\n");
    await untilScreen((r) => r.includes(" 5150"), 6000);
    /* 🔄 2026-10-05 (his ruling) — AT READY the lever pauses NOTHING: the disk pops, the clock runs */
    await click("#drive-lever");
    await until("__cat.corner().disk.phase === 'popped' && !__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
    const tL1 = await lv();
    const tfA = await frameNow(); await wait(600); const tfB = await frameNow();
    ok(tL1.lever.open && !tL1.lever.paused && !tL1.paused && tL1.disk.shown && tL1.disk.phase === "popped" && !tL1.latch.down && tfB > tfA,
       `at READY the lever opens: latch up, the disk pops out and stays drawn, and NOTHING pauses (no game is running)   [${tL1.disk.phase}; frames ${tfA} -> ${tfB}]`);
    await tClickPopped();
    let tPk = await pick();
    ok(!!tPk && tPk.options.map((o) => o.label).join("|") === "Remove|Change Disk…",
       `a click on the popped-out disk offers Remove and Change Disk (a set)   [${tPk ? tPk.options.map((o) => o.label).join("|") : "none"}]`);
    await click("#c64-pick .c64-pick__opt:nth-of-type(2)");
    tPk = await pick();
    ok(!!tPk && tPk.options.map((o) => o.label + (o.lit ? "*" : "")).join("|") === "Disk 1, Side A*|Disk 1, Side B",
       `Change Disk lists the set's disks and sides, the one in lit   [${tPk ? tPk.options.map((o) => o.label + (o.lit ? "*" : "")).join("|") : "none"}]`);
    await recStart();
    await click("#c64-pick .c64-pick__opt:nth-of-type(2)");
    const tChg = await until(`${DISK_LINE} === 'Disk 1, Side B'`, 30000);
    await idle();
    await until("!__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
    const tRecCh = (await recStop()).filter((x) => x.s);
    const tL2 = await lv();
    ok(tChg >= 0 && tRecCh.some((x) => /flip/.test(x.tr)) && tRecCh[0].p !== "below" && !tL2.lever.open && !tL2.paused && tL2.latch.down && !tL2.disk.shown,
       `picking Disk 1, Side B: the swap button's own path (turned over, from where it stuck out), lever shut, latch down   [${took(tChg)}; ${[...new Set(tRecCh.map((x) => x.p + ":" + x.tr))].join(" > ")}]`);
    ok((await screen()).some((r) => r === " 5150") && (await frameNow()) > tfB,
       "and nothing was reset: what was on the screen is still there, and the machine runs (progress kept)");
    /* shut with the disk still in: back in, latch down */
    await click("#drive-lever");
    await until("__cat.corner().disk.phase === 'popped' && !__cat.corner().disk.busy", 5000, 30);
    await click("#drive-lever");
    await until("!__cat.corner().disk.shown && __cat.corner().latch.down && !__cat.corner().latch.moving", 5000, 30);
    const tL3 = await lv();
    ok(!tL3.lever.open && !tL3.paused && tL3.latch.down && !tL3.disk.shown && (await ev("__cat.inserted()")) === tPair.id,
       `shutting the lever with the disk still in: it goes back in and the latch drops   [${JSON.stringify(tL3.lever)}]`);
    /* A RUNNING GAME: the trio's Disk 1 program, loaded and run by the hub. The
       lever pauses it; Change Disk (a different disk, so no flip) resumes it */
    await insertRig(rid(RIG_TRIO));
    await clearScreen();
    await click("#btn-load");
    await ran("RIG TRIO RAN");
    await idleLoad();
    ok(await ev("__cat.machine().gameOn"), "[control] the trio's program was loaded and run by the hub: a game is running");
    await click("#drive-lever");
    await until("__cat.machine().paused && __cat.corner().disk.phase === 'popped' && !__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
    const tG1 = await lv();
    const tgA = await frameNow(); await wait(600); const tgB = await frameNow();
    ok(tG1.lever.open && tG1.lever.paused && tG1.paused && tgB === tgA,
       `with a game running, opening the lever PAUSES it (the clock stops)   [frames ${tgA} -> ${tgB}]`);
    await tClickPopped();
    await click("#c64-pick .c64-pick__opt:nth-of-type(2)");
    await recStart();
    await click("#c64-pick .c64-pick__opt:nth-of-type(3)");
    const tChg2 = await until(`${DISK_LINE} === 'Disk 2, Side A'`, 30000);
    await idle();
    await until("!__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
    const tRecG = (await recStop()).filter((x) => x.s);
    const tG2 = await lv();
    ok(tChg2 >= 0 && !tRecG.some((x) => /flip/.test(x.tr)) && tRecG.some((x) => /down/.test(x.tr)) && !tG2.paused && !tG2.lever.open && tG2.latch.down
       && (await ev("__cat.machine().gameOn")) && (await screen()).some((r) => r === "RIG TRIO RAN"),
       `Change Disk to Disk 2, Side A in a running game: resumed, no flip (another disk), the game not reset   [${took(tChg2)}; ${[...new Set(tRecG.map((x) => x.p + ":" + x.tr))].join(" > ")}]`);
    await click("#drive-lever");
    await until("__cat.machine().paused && __cat.corner().disk.phase === 'popped' && !__cat.corner().disk.busy", 5000, 30);
    await click("#drive-lever");
    await until("!__cat.machine().paused && !__cat.corner().disk.shown && __cat.corner().latch.down && !__cat.corner().latch.moving", 5000, 30);
    const tgC = await frameNow(); await wait(500);
    ok(!(await ev("__cat.machine().paused")) && (await frameNow()) > tgC,
       "shutting the lever on a running game, the disk still in: it goes back in and the game RESUMES");
    /* Remove: the game ends, back to READY */
    await click("#drive-lever");
    await until("__cat.corner().disk.phase === 'popped' && !__cat.corner().disk.busy", 5000, 30);
    await tClickPopped();
    await click("#c64-pick .c64-pick__opt:nth-of-type(1)");
    await idle();
    await until("!__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
    const tRemove = await untilScreen((r) => r[5] === "READY." && !r.includes(" 5150"), 20000);
    const tL4 = await lv();
    ok(tRemove >= 0 && (await ev("__cat.inserted()")) === null && !tL4.paused && !tL4.lever.open && !tL4.latch.down && !tL4.disk.shown,
       `Remove takes the disk out and ends the game: the boot screen's READY., not paused, latch up   [${took(tRemove)}]`);
    /* a single disk, single-sided: Remove only */
    await insertRig(DISK.id);
    await click("#drive-lever");
    await until("__cat.corner().disk.phase === 'popped' && !__cat.corner().disk.busy", 5000, 30);
    await tClickPopped();
    tPk = await pick();
    ok(!!tPk && tPk.options.map((o) => o.label).join("|") === "Remove", `a single disk offers Remove only   [${tPk ? tPk.options.map((o) => o.label).join("|") : "none"}]`);
    await click("#c64-pick .c64-pick__cancel");
    await click("#drive-lever");
    await until("!__cat.corner().disk.shown && __cat.corner().latch.down && !__cat.corner().latch.moving", 5000, 30);
    /* Reset is soft (the disk stays); its arrow's Hard Reset takes it out */
    await click("#btn-reset");
    await idle();
    ok((await ev("__cat.inserted()")) === DISK.id && (await ev("__cat.corner().latch.down")),
       "Reset is soft: back to READY with the disk still in, latch down");
    await clearScreen();
    await type("PRINT 6502\n");
    await untilScreen((r) => r.includes(" 6502"), 6000);
    await click("#btn-reset-more");
    tPk = await pick();
    ok(!!tPk && tPk.options.map((o) => o.label).join("|") === "Hard Reset", `Reset's arrow offers Hard Reset   [${tPk ? tPk.title + " " + tPk.options.map((o) => o.label).join("|") : "none"}]`);
    await click("#c64-pick .c64-pick__opt:nth-of-type(1)");
    await idle();
    await until("!__cat.corner().disk.busy && !__cat.corner().latch.moving", 5000, 30);
    const tHardR = await untilScreen((r) => r[1].trim() === "**** COMMODORE 64 BASIC V2 ****" && r[5] === "READY." && !r.includes(" 6502"), 20000);
    ok(tHardR >= 0 && (await ev("__cat.inserted()")) === null && !(await ev("__cat.corner().latch.down")),
       `Hard Reset takes the disk out and restarts the machine: the boot screen, latch up, drive empty   [${took(tHardR)}]`);
    ok((await ev("document.activeElement === document.getElementById('machine-frame')")),
       `and none of these took the keyboard from the machine   [focus: ${await ev("document.activeElement.id || document.activeElement.tagName")}]`);

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
    /* 🆕 2026-10-05 — PHASE 5b (his rulings, layout only) */
    const ROW = JSON.parse(await ev(`JSON.stringify((function () {
      var ids = ["deck-start", "deck-dir", "reset-split", "c64-pause", "c64-full", "c64-help"];
      var c = ids.map(function (id) { var e = document.getElementById(id), b = e.getBoundingClientRect(); return { id: id, p: e.parentNode.id, y: b.top + b.height / 2, l: b.left, r: b.right }; });
      return { c: c, label: document.getElementById("c64-pause-label").textContent.replace(/\u00a0/g, " ") }; })())`));
    const ys = ROW.c.map((x) => x.y);
    ok(ROW.c.every((x) => x.p === "deck-top") && Math.max(...ys) - Math.min(...ys) <= 14 && ROW.c.every((x, i) => i === 0 || x.l >= ROW.c[i - 1].r - 1),
       `5b: ONE control row: Start, Directory, Reset ▾, Pause Game, Full Screen, Help, left to right   [centres ${ys.map(Math.round).join(",")}]`);
    ok(ROW.label === "Pause Game", `5b: Pause is labelled Pause Game   [${ROW.label}]`);
    const PORTS = () => ev(`JSON.stringify((function () {
      var one = function (id) { var e = document.getElementById(id), cs = getComputedStyle(e), lab = getComputedStyle(e.querySelector(".c64-part__label"));
        return { lit: e.classList.contains("is-lit"), op: Number(cs.opacity), shadow: cs.boxShadow, plug: getComputedStyle(e.querySelector(".c64-port__plug")).display,
                 color: lab.color, stick: getComputedStyle(e.querySelector(".c64-port__stick")).opacity, r: e.getBoundingClientRect() }; };
      var h = document.getElementById("c64-port-hint").getBoundingClientRect(), ln = document.getElementById("c64-port-line"), lb = ln.getBoundingClientRect();
      var labOf = function (id) { return document.getElementById(id).querySelector(".c64-part__label").getBoundingClientRect(); };
      return { p1: one("c64-port1"), p2: one("c64-port2"), hint: h, line: { shown: !ln.hidden && lb.width > 0, l: lb.left, r: lb.right, y: lb.top + lb.height / 2, port: ln.dataset.port },
               l1: labOf("c64-port1"), l2: labOf("c64-port2"), port: __cat.machine().port || document.getElementById("c64-side").dataset.port }; })())`).then(JSON.parse);
    const portsOk = (P) => {
      const sel = P.port === "1" ? P.p1 : P.p2, oth = P.port === "1" ? P.p2 : P.p1, lab = P.port === "1" ? P.l1 : P.l2;
      const joins = P.port === "1" ? Math.abs(P.line.l - lab.right) <= 4 && Math.abs(P.line.r - P.hint.left) <= 4
                                   : Math.abs(P.line.l - P.hint.right) <= 4 && Math.abs(P.line.r - lab.left) <= 4;
      return sel.lit && !oth.lit && P.p1.plug === "none" && P.p2.plug === "none" && sel.shadow === "none" && sel.op === 1 && oth.op < 0.6
        && sel.color === "rgb(255, 210, 58)" && Number(sel.stick) === 1 && P.p1.r.right <= P.hint.left && P.hint.right <= P.p2.r.left
        && P.line.shown && P.line.port === P.port && joins && P.line.y >= lab.top && P.line.y <= lab.bottom;
    };
    let PT = await PORTS();
    ok(portsOk(PT), `5b: both ports are the empty socket; the selected one bright with a yellow header and the stick under it, the other grey, no square; F9 between them, a line to the selected header   [port ${PT.port}; line ${Math.round(PT.line.l)}-${Math.round(PT.line.r)}]`);
    await press("F9");
    await until(`(document.getElementById("c64-side").dataset.port || "") !== ${JSON.stringify(PT.port)}`, 5000);
    await wait(300);
    const PT2 = await PORTS();
    ok(portsOk(PT2) && PT2.port !== PT.port, `and the line follows the selection to port ${PT2.port}   [line ${Math.round(PT2.line.l)}-${Math.round(PT2.line.r)}]`);
    await press("F9");
    await until(`document.getElementById("c64-side").dataset.port === ${JSON.stringify(PT.port)}`, 5000);
    const corner = JSON.parse(await ev("JSON.stringify(__cat.corner())"));
    ok(corner.insertBy === "crates" && corner.ejectBy === "crates",
       `Eject sits with Insert, where the disks are   [insert ${corner.insertBy}, eject ${corner.ejectBy}]`);
    /* 🔄 2026-10-04 — the empty cartridge port and the serial socket are GONE
       (his ruling, Phase 1), and Fast Load is a plain toggle that says Off / On */
    ok(!corner.cartPort && !corner.drivePort, "the empty cartridge port and the drive socket are gone from the panel");
    const fastPill = () => ev('document.getElementById("btn-fastload-state").textContent');
    ok(corner.fastLoad === false && corner.fastOn === false && (await fastPill()) === "Off" && !corner.fastBlocked,
       `Fast Load starts off, so the corner runs at the real machine's speed   [${await fastPill()}]`);
    await click("#btn-fastload");
    const tFastOn = await until("__cat.corner().fastLoad === true", 8000);
    const fOn = JSON.parse(await ev("JSON.stringify(__cat.corner())"));
    ok(tFastOn >= 0 && fOn.fastOn && (await fastPill()) === "On",
       `one click: the machine confirms it, and the switch says On   [${took(tFastOn)}, ${await fastPill()}]`);
    await click("#btn-fastload");
    const tFastOff = await until("__cat.corner().fastLoad === false", 8000);
    ok(tFastOff >= 0 && !(await ev("__cat.corner().fastOn")) && (await fastPill()) === "Off",
       `and again: Off   [${took(tFastOff)}, ${await fastPill()}]`);
    /* 🆕 2026-10-04 — Phase 3 shifted the deck right for the Datasette's room:
       measured at THIS window, Help once ran off the deck's edge */
    const fit = JSON.parse(await ev(`JSON.stringify((function () { var d = document.getElementById("deck").getBoundingClientRect(),
      s = document.getElementById("c64-side").getBoundingClientRect(), h = document.getElementById("c64-help").getBoundingClientRect(),
      b = document.getElementById("datasette-bay").getBoundingClientRect();
      return { deck: Math.round(d.right), side: Math.round(s.right), help: Math.round(h.right), room: Math.round(b.width),
               spread: (function () { var p = document.getElementById("c64-side").getBoundingClientRect(), c = [];
        Array.prototype.forEach.call(document.getElementById("c64-side").children, function (k) { var b = k.getBoundingClientRect();
          if (b.width && b.height && getComputedStyle(k).position !== "absolute") c.push(b.top + b.height / 2); });
        return Math.round(Math.max.apply(null, c) - Math.min.apply(null, c)); })() }; })())`));
    /* 🔄 2026-10-04 — the deck tightened for the room (his ruling): ~280 px here, one row */
    ok(fit.spread <= 30, /* a wrapped row sits ~50 px lower; one row measures ~15 */ `the tightened side panel is still one row   [centres spread ${fit.spread}px]`);
    ok(fit.side <= fit.deck + 1 && fit.help <= fit.deck && fit.room >= 280,
       `the deck, shifted right for the Datasette's room, still holds its whole panel   [panel to ${fit.side}, Help to ${fit.help}, deck to ${fit.deck}; room ${fit.room}px]`);
    ok(corner.monitor === true, "the screen wears the monitor bezel");
    ok(corner.lamps.power === true && corner.lamps.loading === false && corner.lamps.failed === false,
       `the drive's green light is on and steady, and the red one is dark when idle   [${JSON.stringify(corner.lamps)}]`);
    /* his ruling froze the port labels black, so the CABLE is the only thing left
       that says which port the stick is in — and it must follow the machine's
       report, not the click */
    /* 🔄 2026-10-02 — THE STICK IS ALWAYS IN A PORT now (there is no keyboard
       mode), so it shows from the start, on the port the machine reported */
    const litPort = String(await ev("document.getElementById('c64-side').dataset.port"));
    ok(corner.cable === true && corner.cablePort === litPort,
       `a joystick shows on the port the stick is really in, with nothing selected first   [port ${litPort}, stick on ${corner.cablePort}]`);
    await press("F9");
    await until("document.getElementById('c64-side').dataset.port === " + JSON.stringify(litPort === "1" ? "2" : "1"), 5000);
    await wait(300);
    const swapped = JSON.parse(await ev("JSON.stringify(__cat.corner())"));
    ok(swapped.cablePort === (litPort === "1" ? "2" : "1"),
       `and it moves when the port changes   [now on ${swapped.cablePort}]`);
    /* 🚨 the joystick sits inside the port button: it must never eat a click
       meant for the port itself (pointer-events:none). The rig clicks a port at
       its CENTRE, so this is exactly the failure mode. */
    const hitPort = swapped.cablePort;
    const hit = String(await ev(`(function () {
      var r = document.getElementById("c64-port" + ${JSON.stringify(hitPort)}).getBoundingClientRect();
      var e = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return e ? (e.closest(".c64-port") ? "port" : (e.id || e.tagName)) : "none"; })()`));
    ok(hit === "port", `and it cannot swallow a click meant for the port   [hit ${hit}]`);
    await press("F9");
    await until("document.getElementById('c64-side').dataset.port === " + JSON.stringify(litPort), 5000);
    /* F2 flips the arrows and flips them back, and never moves the stick */
    const arrowsWas = String(await ev("document.getElementById('c64-side').dataset.arrows"));
    await press("F2");
    const tFlip = await until(`document.getElementById('c64-side').dataset.arrows !== ${JSON.stringify(arrowsWas)}`, 5000);
    await press("F2");
    const tBack = await until(`document.getElementById('c64-side').dataset.arrows === ${JSON.stringify(arrowsWas)}`, 5000);
    const afterF2 = JSON.parse(await ev("JSON.stringify(__cat.corner())"));
    ok(tFlip >= 0 && tBack >= 0 && afterF2.cablePort === litPort,
       `F2 toggles the arrows (stick / cursor) and back, and the stick stays in its port   [${arrowsWas}; stick on ${afterF2.cablePort}]`);
    /* the F-key hints    /* the F-key hints: his ask was weight and colour, which no assertion can
       judge — but the TEXT must stay bare, because §A asserts exactly "F2 F9 F12" */
    const caps = JSON.parse(await ev(`JSON.stringify(["c64-arrows-hint", "c64-port-hint", "btn-reset-hint"].map(function (id) {
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
    await click("#c64-arrows-cursor");
    await click("#btn-list");
    await wait(800);
    ok(text(await screen()) === screenBefore && (await peek(198)) === 0,
       `keys typed while paused reach nothing: the screen is unchanged and the C64's key buffer is empty   [$C6 ${await peek(198)}]`);
    const sideDuring = await ev(SIDE);
    ok(sideDuring.arrows === sideBefore.arrows && sideDuring.port === sideBefore.port,
       `F9, F2 and clicks on the ports and the Arrows switch change nothing while paused   [${sideBefore.arrows}/${sideBefore.port} -> ${sideDuring.arrows}/${sideDuring.port}]`);
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
    /* the held key. 🔄 2026-10-02 — the keyboard is always live now, so there is
       no keyboard to take first (this used to press F2) */
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
    /* 🆕 2026-09-25 — the fast loader must not sit on the note line
       🔄 2026-10-04 — it is a toggle inside the panel now (Phase 1); same check */
    const over = JSON.parse(await ev(`JSON.stringify((function () {
      var f = document.getElementById("btn-fastload").getBoundingClientRect(), n = document.getElementById("deck-note").getBoundingClientRect();
      return { fast: [Math.round(f.top), Math.round(f.bottom)], note: [Math.round(n.top), Math.round(n.bottom)],
               on: document.getElementById("btn-fastload").classList.contains("is-on") }; })())`));
    ok(!over.on && over.fast[1] <= over.note[0],
       `Fast Load clears the deck's note line   [switch ${over.fast.join("-")}, note ${over.note.join("-")}]`);
    await click("#c64-full");
    await until("__cat.machine().full === true", 3000);
    await wait(400);
    await shot("verify-c64-full.png");
    const FULL_LOOK = `JSON.stringify((function () {
      var r = function (id) { var b = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
      var d = function (id) { return getComputedStyle(document.getElementById(id)).display; };
      return { win: { w: innerWidth, h: innerHeight }, frame: r("machine-frame"), side: r("c64-side"), crates: r("crates"),
               ejectIn: document.getElementById("btn-eject").parentNode.id, swapIn: document.getElementById("side-swap").parentNode.id,
               loadIn: document.getElementById("btn-load").parentNode.id,
               startIn: document.getElementById("deck-start").parentNode.id,
               runIn: document.getElementById("btn-run").parentNode.id,
               insertIn: document.getElementById("btn-insert").parentNode.id,
               gone: !document.getElementById("c64-cart") && !document.getElementById("c64-iec"),
               fast: d("btn-fastload"), deckTop: d("deck-top"),
               label: document.getElementById("c64-full-label").textContent,
               ids: ["c64-power", "c64-port1", "c64-port2", "c64-arrows", "c64-pause", "c64-full", "c64-help", "btn-eject", "side-swap", "deck-start", "btn-load", "btn-run"]
                 .map(function (id) { return document.querySelectorAll("#" + id).length; }).join("") }; })())`;
    const L = JSON.parse(await ev(FULL_LOOK));
    ok(L.crates.w === 0 && L.frame.w >= L.win.w - 2 && L.frame.h >= L.win.h * 0.8,
       `the screen fills the window and the disks step aside   [frame ${L.frame.w}x${L.frame.h} of ${L.win.w}x${L.win.h}, crates ${L.crates.w}px]`);
    ok(L.side.t >= L.frame.b - 1 && L.side.b <= L.win.h + 1,
       `the strip sits UNDER the screen, not over it   [screen ends ${L.frame.b}, strip ${L.side.t}-${L.side.b}]`);
    /* 🔄 2026-10-01 — Load joins them (his ruling, amending 2026-09-25's) */
    /* 🔄 2026-10-02 — Load comes as its START group, so Run comes too */
    /* 🔄 2026-10-05 (Phase 5b, "full screen matches regular") — the deck itself is the
       strip, so the Start group stays on its top row; Eject and the swap MOVE in */
    ok(L.ejectIn === "c64-side" && L.swapIn === "c64-side" && L.startIn === "deck-top" && L.loadIn === "deck-start" && L.runIn === "deck-start" && L.ids === "111111111111",
       `Eject and the side swap MOVED into the strip's second row, the Start group is on its top row, and nothing was copied   [start ${L.startIn}, eject ${L.ejectIn}, swap ${L.swapIn}, ids ${L.ids}]`);
    /* 🔄 2026-10-04 — the two ports are gone (Phase 1); Fast Load stays out of the strip as before */
    /* 🔄 2026-10-05 (5b) — EVERY regular control is in the strip, in the same rows and order */
    const PAR = JSON.parse(await ev(`JSON.stringify((function () {
      var row = function (id) { return Array.prototype.filter.call(document.getElementById(id).children, function (k) { var b = k.getBoundingClientRect(); return b.width > 1 && b.height > 1 && !k.classList.contains("sr-only"); })
        .map(function (k) { return k.id || k.className.split(" ")[0]; }).join(","); };
      return { top: row("deck-top"), side: row("c64-side") }; })())`));
    ok(L.gone && L.fast !== "none" && L.deckTop !== "none"
       && PAR.top === "deck-start,deck-dir,reset-split,c64-pause,c64-full,c64-help"
       && /^c64-power,btn-fastload,c64-port1,c64-port-hint,c64-port-line,c64-port2,c64-arrows,btn-eject(,side-swap)?$/.test(PAR.side),
       `5b: full screen matches regular: both rows in the strip, in the same order, Fast Load and Reset included   [${PAR.top} / ${PAR.side}]`);
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
    await until("document.getElementById('c64-side').dataset.port === '1'", 5000);
    let fs = await ev(SIDE);
    ok(fs.p1 === "lit" && fs.p2 === "plain" && fs.grey === 0, `in the strip, clicking Port 1 lights it   [${JSON.stringify(fs)}]`);
    await press("F9");
    await until("document.getElementById('c64-side').dataset.port === '2'", 5000);
    fs = await ev(SIDE);
    ok(fs.p2 === "lit" && fs.p1 === "plain", `F9 swaps to Port 2 in the strip   [${JSON.stringify(fs)}]`);
    await click("#c64-arrows-cursor");
    await until("document.getElementById('c64-side').dataset.arrows === 'cursor'", 5000);
    fs = await ev(SIDE);
    ok(fs.cursor === "lit" && fs.stick === "plain" && fs.p2 === "lit", `and the Arrows switch works from the strip   [${JSON.stringify(fs)}]`);
    await click("#c64-arrows-stick");
    await until("document.getElementById('c64-side').dataset.arrows === 'stick'", 5000);
    await type("PRINT X\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT X$/))[0] === " 7", 6000)) >= 0,
       "the machine carried on through the change of view: X is still 7");
    /* Eject, paused, in full screen. 🔄 2026-10-04 — Eject is a full stop now
       (Phase 2): it resumes the machine, empties the drive and resets to READY.;
       in full screen it also leaves full screen, as before */
    await click("#c64-pause");
    await until("__cat.machine().paused === true", 5000);
    await wait(300);
    await shot("verify-c64-full-paused.png");
    await click("#btn-eject");
    const tEj = await until("__cat.inserted() === null && __cat.machine().full === false", 20000);
    const E = JSON.parse(await ev(FULL_LOOK));
    ok(tEj >= 0 && E.crates.w > 100 && E.ejectIn === "crates" && E.swapIn === "crates" && E.insertIn === "crates",
       `Eject in full screen ejects AND leaves full screen: the disks are back, Eject and the swap are home   [${took(tEj)}, crates ${E.crates.w}px, eject ${E.ejectIn}]`);
    await idle();
    const tEjP = await untilScreen((r) => r[1].trim() === "**** COMMODORE 64 BASIC V2 ****" && r[5] === "READY.", 20000);
    ok(tEjP >= 0 && (await ev("__cat.machine().paused")) === false && (await inMachine("CAT_EMU.machine().medium")) === null,
       `and paused, Eject ends the game anyway: running again, the drive empty, the boot screen's READY.   [${took(tEjP)}]`);
    ok(E.label === "Full Screen", `the part reads Full Screen again   [${E.label}]`);
    /* the reset cleared X: set it again for the checks that follow */
    await type("X=7\n");
    await untilScreen((r) => toReady(after(r, /^X=7$/)).slice(-1)[0] === "READY.", 6000);
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

    /* --- R. Help (2026-10-02, Chat's item 7) ----------------------------------
       A label on the side panel (so in the strip too). Opening it pauses the
       machine; closing it resumes ONLY IF HELP DID THE PAUSING. The keys list is
       written from the hub's own hotkey constants. */
    section("R. Help: one sheet, it pauses the machine, and closing it hands the machine back");
    const helpOf = () => ev("JSON.stringify(__cat.corner().help)").then(JSON.parse);
    await click("#c64-help");
    const tHelpOpen = await until("__cat.corner().help && __cat.machine().paused === true", 5000);
    const fH0 = await frameNow(); await wait(800); const fH1 = await frameNow();
    let hp = await helpOf();
    ok(tHelpOpen >= 0 && hp && hp.paused === true && fH1 === fH0, `Help opens and pauses the machine: the clock stops   [${took(tHelpOpen)}, ${fH1 - fH0} frames]`);
    const keysNamed = await ev("JSON.stringify(__cat.corner().keys)").then(JSON.parse);
    ok(!!hp && [keysNamed.arrows, keysNamed.port, keysNamed.reset, "Ctrl", "Left Alt", "Tab", "Esc", "Insert Disk", "Load", "Eject", "Pause", "Full Screen", "Power"].every((w) => hp.text.includes(w)),
       `the sheet covers how to use it and every special key, named from the hub's own constants   [${keysNamed.arrows}/${keysNamed.port}/${keysNamed.reset}]`);
    const hpBox = JSON.parse(await ev(`JSON.stringify((function () { var b = document.getElementById("c64-help-panel").getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, W: innerWidth, H: innerHeight }; })())`));
    ok(hpBox.t >= 0 && hpBox.l >= 0 && hpBox.b <= hpBox.H && hpBox.r <= hpBox.W, `it fits on one screen   [${Math.round(hpBox.r - hpBox.l)}x${Math.round(hpBox.b - hpBox.t)} in ${hpBox.W}x${hpBox.H}]`);
    await click("#c64-help-close");
    const tHC = await until("!__cat.corner().help && __cat.machine().paused === false", 5000);
    await frames(5);
    ok(tHC >= 0 && (await frameNow()) > fH1, `closing it resumes the machine Help paused   [${took(tHC)}]`);
    await type("PRINT 6*7\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT 6\*7$/))[0] === " 42", 6000)) >= 0, "and the keyboard is straight back in BASIC, no click needed");
    /* a machine the PLAYER paused stays paused */
    await click("#c64-pause");
    await until("__cat.machine().paused === true", 5000);
    await click("#c64-help");
    await until("!!__cat.corner().help", 3000);
    hp = await helpOf();
    await click("#c64-help-close");
    await wait(600);
    ok(hp && hp.paused === false && (await ev("__cat.machine().paused")) === true,
       "[control] opened on a machine the player had paused, Help does not resume it on close");
    await click("#c64-pause");
    await until("__cat.machine().paused === false", 5000);
    /* and from the full-screen strip */
    await ev("__cat.full(true)");
    await until("__cat.machine().full", 3000);
    const helpInStrip = await ev("document.getElementById('deck').contains(document.getElementById('c64-help')) && document.getElementById('c64-help').getBoundingClientRect().width > 0");
    await click("#c64-help");
    const tHF = await until("__cat.corner().help && __cat.machine().paused === true", 5000);
    await click("#c64-help-close");
    const tHF2 = await until("!__cat.corner().help && __cat.machine().paused === false", 5000);
    ok(helpInStrip && tHF >= 0 && tHF2 >= 0, `Help is in the full-screen strip too, and pauses and resumes the same way   [${took(tHF)} / ${took(tHF2)}]`);
    await ev("__cat.full(false)");
    await until("!__cat.machine().full", 3000);

    /* --- S. the deck's groups (2026-10-02, Chat's item 8) ---------------------- */
    section("S. the deck's buttons in etched groups: Start, and Directory");
    const groups = await ev("JSON.stringify(__cat.corner().groups)").then(JSON.parse);
    const gOf = (id) => groups.find((g) => g.id === id) || { buttons: [] };
    /* 🔄 2026-10-04 — Phase 2: one button in each */
    ok(gOf("deck-start").label === "Start" && gOf("deck-start").buttons.join(",") === "btn-load",
       `START holds the one Load / Run button   [${JSON.stringify(gOf("deck-start"))}]`);
    ok(gOf("deck-dir").label === "Directory" && gOf("deck-dir").buttons.join(",") === "btn-list",
       `DIRECTORY holds the one Load "$",8 / List button   [${JSON.stringify(gOf("deck-dir"))}]`);
    const etch = JSON.parse(await ev(`JSON.stringify(["deck-start", "deck-dir"].map(function (id) {
      var g = document.getElementById(id), s = getComputedStyle(g), l = getComputedStyle(g.querySelector(".deck-group__label"));
      return { border: s.borderTopStyle, w: s.borderTopWidth, label: l.display, shown: g.getBoundingClientRect().width > 0 }; }))`));
    ok(etch.every((e) => e.border === "solid" && parseFloat(e.w) > 0 && parseFloat(e.w) <= 1 && e.label !== "none" && e.shown),
       `each group is drawn as an etched outline with its label   [${JSON.stringify(etch)}]`);

    /* --- P3. the corner's own screen hunt (2026-09-25) ---------------------------
       His rulings: the hunt keeps going until it finds the screen, WITHOUT slowing
       the C64 noticeably; and auto-RUN never fails in silence. The rig-only hooks
       CAT_EMU.rehunt()/holdHunt() make the page forget the screen, on a screen
       whose banner is long gone — the case the old banner-only hunt could never
       recover from. */
    section("P3. the corner's screen hunt: it finds the screen with the banner gone, cheaply, and auto-RUN says when it cannot");
    /* 🔄 2026-10-04 — the gone disk in first: Load on an empty drive types nothing now */
    await ev(`__cat.select(${JSON.stringify(GONE)})`);
    await click("#btn-insert");
    await until(`__cat.inserted() === ${JSON.stringify(GONE)}`, 60000);
    await idle();
    await click("#machine-frame");
    await press("Home", true);
    await frames(10);
    ok(!text(await screen()).includes("**** COMMODORE 64"), "[control] the boot banner is gone from the screen");
    const fps = async (ms) => { const a = await frameNow(); await wait(ms); return ((await frameNow()) - a) * 1000 / ms; };
    const base = await fps(3000);
    await inMachine("CAT_EMU.holdHunt(true)");
    await inMachine("CAT_EMU.rehunt()");
    ok((await inMachine("CAT_EMU.machine().screen")) === null, "[control] the page has forgotten its screen");
    /* auto-RUN, blind: the Load button on the gone disk, with the hunt held
       (the screen was just cleared, so there is no READY. to wait for first) */
    await click("#btn-load");
    await until("__cat.machine().busy", 3000, 20);
    await idleLoad();
    const blindNote = String(await ev("__cat.note()"));
    ok(/could not read the c64's screen, so run was not typed/i.test(blindNote),
       `when auto-RUN cannot see the screen, the message line says so   [${blindNote}]`);
    await untilScreen((r) => r.filter(Boolean).slice(-1)[0] === "READY.", 30000);
    await frames(10);
    /* now let it hunt, and watch what that costs the machine */
    await inMachine("CAT_EMU.holdHunt(false)");
    const during = await fps(3000);
    const tRefound = await until(`(() => { try { return ${FRAME}.CAT_EMU.machine().screen !== null; } catch (e) { return false; } })()`, 60000, 250);
    const h = await inMachine("CAT_EMU.machine()");
    ok(tRefound >= 0 && h.screen === RAM + 0x400,
       `the hunt finds the screen again with no banner to go on, at the right place   [${took(tRefound)}; page ${h.screen}, rig ${RAM + 0x400}; ${h.hunt.passes} pass(es), ${h.hunt.slices} slices]`);
    ok(during >= base * 0.85 && h.hunt.worstMs < 25,
       `and the C64 keeps its speed while it looks   [${base.toFixed(1)} fps before, ${during.toFixed(1)} while hunting; worst slice ${h.hunt.worstMs} ms]`);
    await type("PRINT 3*3\n");
    ok((await untilScreen((r) => toReady(after(r, /^PRINT 3\*3$/))[0] === " 9", 6000)) >= 0, "and the machine carried on as normal");
    await click("#btn-eject");
    await idle();

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
