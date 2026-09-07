/* ===========================================================================
   verify-cat-library.mjs — the disk library, the crack intro, the emulator
   room and disk swapping.

   A SEPARATE RIG FROM `verify-cat.mjs` on purpose. That one is the hub's own
   rules — command resolution, the disk box, the dev gate. This one is the C64
   side, which needs fixtures on disk that the other must never depend on.

   RUN
     1.  python -m http.server 8899        (from the (PCL) repo root)
     2.  node verify-cat-library.mjs       (from this folder)

   ⭐ IT LAYS ITS OWN FIXTURES AND TAKES THEM AWAY AGAIN. `Game/disks/` is the
   player's folder; a rig that left four files in it would be changing what the
   hub shows the next person to open it. The fixtures are ZERO-BYTE files with
   real names — nothing here boots a disk, so the bytes are never read, and the
   names are the entire input to the thing being tested.

   🚨 TWO TRAPS THAT EACH COST A RUN WHILE THIS WAS BEING WRITTEN:

   1. `open()` TAKES AN OPTIONS OBJECT AND NO URL. `open(URL, {...})` is
      accepted in silence: the string is destructured for `gpu`/`w`/`h`, finds
      none, and you drive `about:blank` with every global undefined and NO
      console error to explain it. Navigate with `c.goto(url)` afterwards.
   2. A FULL LOAD IS ~4.8 SECONDS, not the ~1.9s the load theatre takes. The
      crack intro adds 2600ms + a 260ms fade between "RUN" and the iframe.
      Sampling before that lands mid-intro, and every post-launch assertion
      fails in a way that reads exactly like a broken launcher.
   ========================================================================= */

import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
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

const HUB   = "http://localhost:8899/Game/cat/index.html";
const DISKS = fileURLToPath(new URL("../disks/", import.meta.url));

/* A full load: theatre 1920ms + intro 2600ms + fade 260ms. Rounded up. */
const FULL_LOAD = 5200;

const FIXTURES = [
  "Action Biker.D64",
  "Airborne Ranger - d1.D64",
  "Airborne Ranger - d2.D64",
  "Paradroid.d64"
];

let pass = 0, fail = 0;
const ok  = (c, m) => { c ? pass++ : fail++; console.log((c ? "  ok   " : "  FAIL ") + m); };
const sec = (t) => console.log("\n" + t);
const rest = (ms) => new Promise(r => setTimeout(r, ms));

/* ---- fixtures ----------------------------------------------------------
   🚨 Only ever removes files it created, by name. A blanket wipe of the
   folder would delete the player's own library the first time someone ran
   the rig on a machine that had one. */
function layFixtures() {
  if (!existsSync(DISKS)) mkdirSync(DISKS, { recursive: true });
  const pre = readdirSync(DISKS);
  const clash = FIXTURES.filter(f => pre.includes(f));
  if (clash.length) {
    console.log("  note: reusing files already present: " + clash.join(", "));
  }
  FIXTURES.forEach(f => { if (!pre.includes(f)) writeFileSync(DISKS + f, ""); });
  return FIXTURES.filter(f => !pre.includes(f));
}
function clearFixtures(mine) {
  mine.forEach(f => { try { rmSync(DISKS + f); } catch { /* already gone */ } });
}

const mine = layFixtures();
let c;
try {
  c = await open({ gpu: true, w: 1280, h: 860 });
  await c.goto(HUB);
  await rest(1800);

  sec("A. the folder is scanned at runtime — no manifest, no hardcoded count");
  const st = await c.ev(`(() => {
    const d = window.__cat.disks();
    return { lines: window.__cat.lines().join("\\n"), visible: window.__cat.visible(),
             names: d.map(x => x.displayName) };
  })()`);
  ok(/disk library: 3 disks found/i.test(st.lines),
     "4 files became 3 disks (d1+d2 grouped): " + (st.lines.match(/disk library:.*/i) || ["none"])[0]);
  ok(st.visible.includes("lib-paradroid"), "a scanned disk reached the box");
  ok(st.visible.includes("asteroid"), "the PLC cartridges are untouched");

  sec("B. one mixed box, all equal");
  const shown = st.names.filter(n => n !== "Blank Cassette");   /* dev-gated */
  ok(JSON.stringify(shown) === JSON.stringify(
       ["Action Biker", "Airborne Ranger", "Asteroid Command", "Paradroid", "Pitstop", "The Aquanaut"]),
     "cartridges and disks interleave alphabetically: " + JSON.stringify(shown));
  ok(st.visible.indexOf("blank") === -1, "the dev cartridge is still gated out");

  sec("C. multi-disk grouping, and the 16-char filename cap");
  const ar = await c.ev(`(() => {
    const d = window.__cat.disks().find(x => x.id === "lib-airborne-ranger");
    return { sides: d.files.length, fn: d.entries[0].filename };
  })()`);
  ok(ar.sides === 2, "two sides behind one box entry");
  ok(ar.fn.length <= 16, "the typed name fits a 1541 directory: " + ar.fn);

  sec("D. the crack intro — before EVERY disk, per the ruling");
  await c.ev(`window.__cat.select("lib-paradroid"), window.__cat.insert()`);
  await c.ev(`window.__cat.execute('LOAD"*",8,1')`);
  await rest(2200);
  const mid = await c.ev(`(() => {
    const el = document.getElementById("crack");
    return { on: !!el,
             group: el ? (el.querySelector(".crack-title")||{}).ariaLabel : null,
             game:  el ? (el.querySelector(".crack-game")||{}).textContent : null,
             scope: window.CAT_CRACK.appliesTo };
  })()`);
  ok(mid.on, "the splash is up mid-load");
  ok(mid.group === "NOAH COLLECTIVE", "group name: " + mid.group);
  ok(mid.game === "PARADROID", "the disk is named on it: " + mid.game);
  ok(mid.scope === "all", "scope is every disk, not flag-gated");

  /* 🚨🚨 THE ASSERTION THIS RIG EXISTS FOR, AND THE ONE THAT FOUND A REAL
     DEFECT. Testing the scroller's TEXT passes whether or not a human ever
     sees it — and it did: with the original geometry all six mascot names sat
     ~450px off the right edge for the entire hold, in the DOM and never on
     the glass. ⭐ Watched failing 2026-09-07 against padding-left:100% / 13s,
     where the text assertion below stayed green. 🚫 Do not "simplify" this
     back into a text match; that is the version that could not fail. */
  const seen = await c.ev(`(() => {
    const el = document.querySelector(".crack-scroll-text");
    if (!el) return { err: "no scroller" };
    const node = el.firstChild;
    const i = node.textContent.indexOf("BEV");
    if (i < 0) return { err: "BEV missing from the scroll text" };
    const r = document.createRange();
    r.setStart(node, i); r.setEnd(node, i + 3);
    const b = r.getBoundingClientRect();
    return { left: Math.round(b.left), right: Math.round(b.right), vw: window.innerWidth,
             text: node.textContent };
  })()`);
  ok(/PENN\s+DEX\s+FERGIE\s+TRACE\s+RUE\s+BEV/.test(seen.text || ""),
     "all six mascots are in the scroller  [weak — passes off-screen too]");
  ok(!seen.err && seen.left < seen.vw && seen.right > 0,
     `the LAST greetz is ON THE GLASS (x=${seen.left}, viewport 0..${seen.vw})`);
  await c.shot(fileURLToPath(new URL("./verify-cat-crack.png", import.meta.url)));

  sec("E. it reaches the emulator room, carrying the real disk");
  await rest(FULL_LOAD - 2200);
  const after = await c.ev(`(() => ({
    gone: !document.getElementById("crack"),
    playing: window.__cat.playing(), src: window.__cat.playingSrc(),
    swap: window.__cat.swapVisible()
  }))()`);
  ok(after.gone, "the splash removed itself");
  ok(after.playing && /^emulator\/index\.html\?/.test(after.src || ""),
     "routed to the emulator room, not to a cartridge");
  ok(/d=\.\.%2Fdisks%2FParadroid\.d64/.test(after.src || ""), "the disk url was handed over");
  ok(after.swap === false, "a single-disk title grows no swap control");

  sec("F. the room refuses honestly when no core is installed");
  const inner = await c.ev(`(() => {
    const d = document.getElementById("play-frame").contentDocument;
    const s = d && d.getElementById("say");
    return { hidden: s ? s.hidden : null, text: s ? s.textContent.replace(/\\s+/g," ") : null };
  })()`);
  ok(inner.hidden === false, "it says something rather than sitting blank");
  ok(/no emulator core on this machine/i.test(inner.text || ""), "it names the actual cause");
  ok(/EmulatorJS/.test(inner.text || ""), "and hands over the install command");

  sec("G. a multi-disk title grows the swap control");
  await c.ev(`window.__cat.exit()`);
  await c.ev(`window.__cat.select("lib-airborne-ranger"), window.__cat.insert()`);
  await c.ev(`window.__cat.execute('LOAD"*",8,1')`);
  await rest(FULL_LOAD + 1300);
  const multi = await c.ev(`(() => ({
    swap: window.__cat.swapVisible(), sides: window.__cat.sides(),
    buttons: [...document.querySelectorAll("#play-disks .btn")].map(b => b.textContent),
    src: window.__cat.playingSrc()
  }))()`);
  ok(multi.swap === true && multi.sides === 2, "the control is there for 2 sides");
  ok(JSON.stringify(multi.buttons) === '["1","2"]', "one button per side: " + JSON.stringify(multi.buttons));
  ok((multi.src.match(/&d=/g) || []).length === 2, "both sides were handed to the drive");
  await c.shot(fileURLToPath(new URL("./verify-cat-swap.png", import.meta.url)));

  sec("H. exit returns to the hub with the disk still in the drive");
  await c.ev(`window.__cat.exit()`);
  const back = await c.ev(`(() => ({ playing: window.__cat.playing(),
                                     inserted: window.__cat.inserted() }))()`);
  ok(back.playing === false, "the overlay is hidden");
  ok(back.inserted === "lib-airborne-ranger", "the disk stayed in the drive");

  sec("I. CONTROL — this MUST fail, or nothing above means anything");
  ok(await c.ev(`window.__cat.disks().some(x => x.id === "lib-nonexistent-game")`),
     "[control] a game that is in no folder is in the box");

  sec("J. console census");
  /* 📌 One expected 404 PER LAUNCH: emulator/data/loader.js, which is the
     core-detection probe itself. 🚫 Do not filter it out — a census that
     hides the probe cannot tell you when the probe stops running. The
     _favourites.txt 404 that used to sit here is gone: the scanner now reads
     the directory listing it already has instead of asking blindly. */
  /* ⚠️ THE PROBE'S 404 ARRIVES AS A PAIR AND ONLY ONE HALF CARRIES THE URL.
     `Network.responseReceived` names loader.js; the `Log.entryAdded` twin is
     truncated before its url field, so it cannot be matched by path. Matching
     it on "Failed to load resource" alone would swallow EVERY 404 the hub
     ever makes — the filter would be wider than the thing it excuses.
     ⭐ So the twins are reconciled BY COUNT: allow exactly as many bare 404
     log lines as there were loader.js responses. One unrelated 404 pushes the
     count over and the census goes red, which is the whole point. */
  /* ⚠️ `c.errors()` returns an ARRAY, not a promise. Awaiting it works by
     accident; calling .then() on it does not. */
  const errs = (c.errors() || []).map(String);
  const probes = errs.filter(e => /emulator\/data\/loader\.js/.test(e)).length;
  let allow = probes;
  const other = errs.filter(e => {
    if (/emulator\/data\/loader\.js/.test(e)) return false;
    if (/ERR_ABORTED/.test(e)) return false;
    if (/Failed to load resource.*404/.test(e) && allow-- > 0) return false;
    return true;
  });
  ok(probes > 0, `the core probe ran (${probes}x) — a census with none means it stopped probing`);
  ok(other.length === 0, "nothing else in the console" +
     (other.length ? ": " + JSON.stringify(other).slice(0, 220) : ""));

} finally {
  if (c) await c.close();
  clearFixtures(mine);
  console.log("\n  fixtures removed: " + (mine.length ? mine.join(", ") : "(none were mine)"));
}

console.log("\n" + "=".repeat(60));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("  §I is the control and MUST be the only failure.");
console.log("=".repeat(60));
process.exit(fail === 1 ? 0 : 1);
