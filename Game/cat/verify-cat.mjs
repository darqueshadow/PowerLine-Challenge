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

import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
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

/* ---- disk-art fixtures (§B2) ---------------------------------------------
   🆕 2026-09-12. The art folder is hand-filled and gitignored like disks/, so a
   fresh clone has none — the rig lays two files BEFORE the page boots (the hub
   reads the folder once, at boot) and takes them away again.
     "The Aquanaut.png"   a real 1x1 PNG  -> the art path must show it
     "Blank Cassette.png" ZERO BYTES      -> a file that will not decode must
                                             fall back to the placeholder, not
                                             leave a dark frame
   🚨 Only ever removes files it created, by name. If Andrew has already dropped
   real art under either name, it is left alone and reused, and the assertion
   that needs the fixture's exact content is reported as skipped. */
const ART_DIR = fileURLToPath(new URL("./assets/disk-art/", import.meta.url));
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const ART_FIXTURES = [["The Aquanaut.png", PNG_1x1], ["Blank Cassette.png", Buffer.alloc(0)]];
if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true });
const artMine = ART_FIXTURES.filter(([name]) => !existsSync(ART_DIR + name)).map(([name]) => name);
ART_FIXTURES.forEach(([name, bytes]) => { if (artMine.includes(name)) writeFileSync(ART_DIR + name, bytes); });

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

  /* 🆕 2026-09-13 — with no `?cart=` the hub boots exactly as it did (§K and
     §L have the links). The link is followed synchronously at boot, so by the
     time this page has loaded, any link would already have acted. */
  eq(await c.ev("__cat.link ? __cat.link() : 'missing'"), "none", "no ?cart= : no link");
  const plain = JSON.parse(await c.ev(`JSON.stringify({
    inserted: __cat.inserted(), lines: __cat.lines(),
    curtain: document.documentElement.classList.contains("cat-link"),
    menu: getComputedStyle(document.getElementById("cat")).visibility,
    cad: !!document.getElementById("crate-plc"),
    power: document.getElementById("btn-power").hidden })`));
  ok(plain.power, "outside Fang Rock there is no Power Off (a browser tab cannot close itself)");
  ok(plain.inserted === null && !plain.lines.some((l) => /^> LOAD|^cartridge link|^cracked disks only/.test(l)),
     "no ?cart= : the drive stays empty and nothing loads");
  ok(!plain.curtain && plain.menu === "visible" && plain.cad,
     `no ?cart= : the full menu, both crates   [curtain=${plain.curtain}, menu ${plain.menu}, CAD crate ${plain.cad}]`);
  /* 🆕 2026-09-16 — the real C64 is cracked mode's screen, and ONLY cracked
     mode's: this hub still has its resolver, because a PLC cartridge is a web
     page no C64 can load. (verify-c64.mjs tests the machine itself.) */
  const noMachine = JSON.parse(await c.ev(`JSON.stringify({ m: __cat.machine(),
    frameHidden: document.getElementById("machine-frame").hidden,
    out: getComputedStyle(document.getElementById("out")).display,
    extra: ["btn-listing", "btn-run", "btn-reset"].filter(function (id) { return !document.getElementById(id).hidden; }) })`));
  ok(!noMachine.m.on && !noMachine.m.started && noMachine.frameHidden && noMachine.out !== "none" && noMachine.extra.length === 0,
     `no ?cart= : the screen is the terminal, with no C64 behind it and no machine-only buttons   [${noMachine.extra.join(",") || "none shown"}]`);

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
  const CARTRIDGES = ["asteroid", "aquanaut", "pitstop", "eggtimer"];   // eggtimer: live 2026-09-17
  const missing = CARTRIDGES.filter((id) => !seen.includes(id));
  ok(missing.length === 0,
     `all ${CARTRIDGES.length} player cartridges are in the box   [missing: ${missing.join(", ") || "none"}]`);
  ok(!seen.includes("blank"), "Blank Cassette is NOT in the player-facing box");

  /* the DOM and the model must agree — that is the check a literal was
     standing in for, and unlike a literal it holds at any library size. */
  const nDisk = Number(await c.ev("document.querySelectorAll('.disk').length"));
  /* ⚠️ `.disk .sleeve`, not `.sleeve`: since 2026-09-12 the preview frame's
     blank-sleeve placeholder is a `.sleeve` too, and is not a disk. */
  const nSleeve = Number(await c.ev("document.querySelectorAll('.disk .sleeve').length"));
  eq(nDisk, seen.length, "every visible disk is rendered as an object");
  eq(nSleeve, nDisk, "each disk has a sleeve (not a list row)");
  console.log(`        (box holds ${seen.length}: ${CARTRIDGES.length} cartridges + ${seen.length - CARTRIDGES.length} found)`);

  /* 🚨 THE BUG THIS EXISTS TO PROVE FIXED. The Aquanaut is built but was
     never registered, so it could not be launched from the hub at all. */
  ok(String(visible).includes("aquanaut"), "The Aquanaut is reachable (was unregistered)");

  /* 🔄 2026-09-11 — THE BASELINE PAIR BECOMES A PITCH CHECK, AND IT IS THE SAME
     ASSERTION WEARING NEW CLOTHES.

     It was born by LOOKING at a screenshot, not from a failing test: every check
     was green while Pitstop sat 8px higher than its neighbours, because it
     carries a TEST badge, a <button> centres its content, and the flex row
     stretched all disks to the tallest. So it asserted that all `.sleeve` tops
     share one baseline.
     🚨 In a crate they deliberately do NOT — records are staggered by `--pitch`,
     which is the whole point of a pile. A baseline check here would fail on
     correct output, and the obvious repair (delete it) would drop the only guard
     against a badge moving its neighbours.
     ⭐ So the invariant moves rather than goes: the GAP between consecutive
     records must be constant. A badge, a longer name or a stray margin still
     shows up immediately — as an uneven pitch instead of a broken baseline. */
  const tops = (await c.ev(
    "JSON.stringify(Array.prototype.map.call(" +
    "document.querySelectorAll('#crate-lib .crate__pile .disk')," +
    "function(d){return Math.round(d.getBoundingClientRect().top);}))"));
  const gaps = [...new Set(JSON.parse(tops).slice(0, 12).map((t, k, a) => k ? t - a[k - 1] : null).slice(1))];
  ok(gaps.length === 1, `records are stacked at ONE constant pitch   [gaps: ${gaps.join(",")}]`);

  /* the two crates are fed from the SAME roster, split by runner. 🚨 This is
     what stops a crate growing its own array and quietly re-opening the dev
     gate that `visibleDisks()` enforces. */
  const nPlc = Number(await c.ev("document.querySelectorAll('#crate-plc .disk').length"));
  const nLib = Number(await c.ev("document.querySelectorAll('#crate-lib .disk').length"));
  eq(nPlc + nLib, seen.length, "the two crates together hold exactly the visible roster");
  ok(nPlc === CARTRIDGES.length,
     `the CAD crate holds the cartridges and nothing else   [got ${nPlc}]`);

  /* 🚨 A CRATE WITH NO HEIGHT RENDERS AS A BARE LABEL, and every count above
     stays green while it does — measured 2026-09-11, the CAD crate came out
     68px for a pile needing 121. Counting elements cannot see it; measuring
     the box can.
     🔄 2026-09-12 — this asserted "tall enough to OPEN a record in" (> 90px).
     A selected record no longer opens (§B4), so the room reserved for that is
     gone, and the invariant that is left is the one that mattered: every
     record in the crate is inside the crate. */
  const plcFit = JSON.parse(await c.ev(
    "JSON.stringify((function(){var s=document.querySelector('#crate-plc .crate__stack').getBoundingClientRect();" +
    "var b=Array.prototype.map.call(document.querySelectorAll('#crate-plc .disk'),function(d){return d.getBoundingClientRect().bottom;});" +
    "return {stack:Math.round(s.bottom),last:Math.round(Math.max.apply(null,b))};})())"));
  ok(plcFit.last <= plcFit.stack + 1,
     `the CAD crate shows every record it holds   [last record ends ${plcFit.last}, crate ${plcFit.stack}]`);

  /* the A-Z dividers: only letters that HAVE a disk, and clicking one lands. */
  const tabs = String(await c.ev(
    "Array.prototype.map.call(document.querySelectorAll('#crate-lib .crate__tab'),function(t){return t.textContent;}).join('')"));
  ok(tabs.length > 0 && /^[#A-Z]+$/.test(tabs), `the Cracked crate has A-Z dividers   [${tabs}]`);
  await c.ev("[...document.querySelectorAll('#crate-lib .crate__tab')].find(function(t){return t.textContent==='S';}).click()");
  await wait(400);
  const jumped = String(await c.ev("document.getElementById('detail-title').textContent"));
  ok(/^S/i.test(jumped), `clicking a divider jumps AND selects   [landed on ${jumped}]`);

  /* --- B1. selection is a highlight, not a pull -------------------------- */
  section("B1. selecting a record highlights it IN PLACE — nothing covered, nothing moved");
  /* 🆕 2026-09-12 — his locked call: the "pulled out" record covered the ones
     around it. Selection is now a highlight on the spine itself.
     ⭐ MEASURED IN PILE COORDINATES, not viewport ones: select() re-renders the
     crate, and a scroller that briefly empties can jump — a viewport comparison
     would read that jump as the record moving.
     🚨 THE SLEEVE, NOT JUST THE BUTTON. The old lift was a transform on the
     `.sleeve` inside an unmoved button, so a button-only check stays green while
     the picture overlaps. And the ring is checked separately: an outer box-shadow
     paints over a neighbour without changing anybody's rect. */
  const GEOM = (idx) => `JSON.stringify((function () {
    var pile = document.querySelector("#crate-lib .crate__pile");
    var recs = pile.querySelectorAll(".disk");
    var top0 = pile.getBoundingClientRect().top;
    function box(el) { var r = el.getBoundingClientRect();
      return { top: Math.round(r.top - top0), bottom: Math.round(r.bottom - top0), h: Math.round(r.height) }; }
    var pick = [recs[${idx} - 1], recs[${idx}], recs[${idx} + 1]];
    return {
      ids: pick.map(function (d) { return d.dataset.id; }),
      rec: pick.map(box),
      sleeve: pick.map(function (d) { return box(d.querySelector(".sleeve")); }),
      pressed: pick.map(function (d) { return d.getAttribute("aria-pressed"); }),
      shadow: getComputedStyle(pick[1].querySelector(".sleeve")).boxShadow,
      bg: pick.map(function (d) { return getComputedStyle(d.querySelector(".sleeve")).backgroundImage; })
    };
  })())`;
  await c.ev("__cat.select('')");
  await wait(200);
  const g0 = JSON.parse(await c.ev(GEOM(5)));
  await c.ev(`__cat.select(${JSON.stringify(g0.ids[1])})`);
  await wait(350);
  const g1 = JSON.parse(await c.ev(GEOM(5)));
  eq(g1.pressed[1], "true", `the record is selected   [${g1.ids[1]}]`);
  ok(g1.rec[1].h === g0.rec[1].h,
     `it keeps its height rather than opening   [${g0.rec[1].h}px -> ${g1.rec[1].h}px]`);
  ok(g1.sleeve[0].top === g0.sleeve[0].top && g1.sleeve[2].top === g0.sleeve[2].top &&
     g1.sleeve[1].top === g0.sleeve[1].top,
     `nothing moved — above, selected, below   [${g0.sleeve.map(s => s.top)} -> ${g1.sleeve.map(s => s.top)}]`);
  ok(g1.sleeve[1].top >= g1.sleeve[0].bottom && g1.sleeve[1].bottom <= g1.sleeve[2].top,
     `it covers neither neighbour   [above ends ${g1.sleeve[0].bottom}, it spans ${g1.sleeve[1].top}-${g1.sleeve[1].bottom}, below starts ${g1.sleeve[2].top}]`);
  const layers = g1.shadow === "none" ? [] : g1.shadow.split(/,(?![^(]*\))/);
  ok(layers.every((l) => /\binset\b/.test(l)),
     `its ring is drawn INSIDE its own edges, so it paints on no neighbour   [${g1.shadow}]`);
  ok(g1.bg[1] !== g1.bg[0] && g1.bg[1] !== g1.bg[2], "and it visibly differs from the records around it");

  /* the hover lift was the same defect in a smaller dose.
     ⚠️ WATCHED PASSING FOR THE WRONG REASON on the first cut: the record had been
     scrolled out of the crate's window by the re-render, the mouse landed on
     something else, and "offset 0px" was true of a record nobody was hovering.
     So it is scrolled into view first, and `:hover` itself is asserted.
     ⚠️ And the selection is cleared first: on the old build the OPENED record
     covered this one, so the mouse hit the wrong record — the very defect §B1
     is about, but it would have hidden the hover lift behind it. */
  await c.ev("__cat.select('')");
  await wait(200);
  const hov = JSON.parse(await c.ev(`JSON.stringify((function () {
    var d = document.querySelectorAll("#crate-lib .crate__pile .disk")[7];
    d.scrollIntoView({ block: "center" });
    var r = d.getBoundingClientRect(); return { x: Math.round(r.left + 30), y: Math.round(r.top + r.height / 2) };
  })())`));
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: hov.x, y: hov.y });
  await wait(250);
  const lift = JSON.parse(await c.ev(`JSON.stringify((function () {
    var d = document.querySelectorAll("#crate-lib .crate__pile .disk")[7];
    return { hovered: d.matches(":hover"),
             offset: Math.round(d.querySelector(".sleeve").getBoundingClientRect().top - d.getBoundingClientRect().top) };
  })())`));
  ok(lift.hovered && lift.offset === 0,
     `hovering a record does not lift it over the one above   [hovered=${lift.hovered}, sleeve offset ${lift.offset}px]`);
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 900, y: 400 });

  /* --- B2. the detail panel -------------------------------------------- */
  section("B2. the detail panel — and its honest empty state");
  await c.ev("__cat.select('asteroid')");
  await wait(250);
  eq(await c.ev("document.getElementById('detail-title').textContent"), "Asteroid Command",
     "the panel names the selected disk");
  ok(!(await c.ev("document.getElementById('detail-shot').className")).includes("is-empty"),
     "Asteroid Command has a real screenshot");
  ok(String(await c.ev("document.getElementById('detail-synopsis').textContent")).indexOf("Niagara") >= 0,
     "and its real synopsis, not a generated one");

  /* ⭐⭐ An empty frame reads as a picture that failed to load; the words are
     the whole point. And nothing must be invented for a disk with no entry.
     🆕 2026-09-15 — THE DISK IS PICKED FROM THE FOLDER, NOT NAMED HERE. This
     used to be 'lib-beach-head', until Andrew filled the art folder on
     2026-09-14 and Beach-Head got a cover: two checks went red on a hub that
     was right. The oracle is the filesystem (the hub reads the same folder over
     HTTP): a Cracked disk whose name and side files match no image, by the
     hub's rule — name minus extension, case-insensitive. */
  const artKeys = new Set(readdirSync(ART_DIR)
    .map((f) => f.match(/^(.*)\.(png|webp|jpe?g|gif)$/i)).filter(Boolean)
    .map((m) => m[1].trim().toLowerCase()));
  const bare = JSON.parse(await c.ev(`JSON.stringify(__cat.disks().map(function (d) {
    return { id: d.id, name: d.displayName, files: (d.files || []).map(function (f) { return f.name; }) };
  }))`)).find((d) => /^lib-/.test(d.id) &&
    ![d.name, ...d.files.map((f) => f.replace(/\.[^.]+$/, ""))].some((n) => artKeys.has(n.trim().toLowerCase())));
  if (bare) {
    await c.ev(`__cat.select(${JSON.stringify(bare.id)})`);
    await wait(250);
    ok((await c.ev("document.getElementById('detail-shot').className")).includes("is-empty"),
       `a disk with no art says so rather than showing an empty frame   [${bare.name}]`);
    const syn = String(await c.ev("document.getElementById('detail-synopsis').textContent"));
    ok(/no synopsis/i.test(syn), `and says no synopsis is written   [${syn.slice(0, 40)}]`);
    const word = (bare.name.match(/[a-z]{4,}/i) || [bare.name])[0];
    ok(syn.toLowerCase().indexOf(word.toLowerCase()) < 0,
       `🚫 and does NOT generate one from the filename   [looked for "${word}"]`);
  } else {
    console.log("  skip  no-art state — every Cracked disk has art in the folder");
  }

  /* 🆕 2026-09-12 — THE ARTWORK. One image per disk in Game/cat/assets/disk-art/,
     named after the disk; the frame shows it, falls back to games.js's
     screenshot, and otherwise shows a BLANK SLEEVE — never a broken-image icon,
     never an empty frame. */
  const SHOT = `JSON.stringify((function () {
    var f = document.getElementById("detail-shot");
    var s = f.querySelector(".sleeve");
    var r = s ? s.getBoundingClientRect() : null;
    return { cls: f.className, bg: f.style.backgroundImage,
             sleeve: !!r && r.width > 20 && r.height > 20,
             label: s ? s.textContent.replace(/\\s+/g, " ").trim() : "" };
  })())`;
  if (bare) {
    const noArt = JSON.parse(await c.ev(SHOT));
    ok(noArt.sleeve && /no art yet/i.test(noArt.label) && !noArt.bg,
       `a disk with no art shows the blank-sleeve placeholder   [${noArt.cls}, "${noArt.label}"]`);
  }

  await c.ev("__cat.select('aquanaut')");
  const tArt = await until(async () => JSON.parse(await c.ev(SHOT)).cls.includes("is-art"), 3000, 100);
  const withArt = JSON.parse(await c.ev(SHOT));
  ok(tArt >= 0 && /disk-art\/The%20Aquanaut\.png/.test(withArt.bg),
     `a disk WITH art shows it, found by its name alone   [${withArt.bg || withArt.cls}]`);
  ok(tArt >= 0 && !withArt.sleeve, "and the placeholder steps aside for it");

  if (artMine.includes("Blank Cassette.png")) {
    await c.ev("__cat.select('blank')");
    const tBad = await until(async () => {
      const s = JSON.parse(await c.ev(SHOT));
      return s.cls.includes("is-empty") && s.sleeve;
    }, 3000, 100);
    ok(tBad >= 0, "an art file that will not decode falls back to the placeholder, not a dark frame");
  } else {
    console.log("  skip  broken-art fallback — a real 'Blank Cassette.png' is in the folder");
  }

  await c.ev("__cat.select('asteroid')");
  await wait(250);
  ok(/title_screen\.png/.test(JSON.parse(await c.ev(SHOT)).bg),
     "a disk with no art but a games.js screenshot still shows the screenshot");

  /* --- B3. the Cracked crate where the disk list cannot be read -------- */
  section("B3. where the disk list fails, the Cracked crate says so instead of looking broken");
  /* 🆕 2026-09-12 — his ruling: Cracked disks are Fang Rock-only, permanently.
     Everywhere the scan FAILS, the crate stays on screen, visibly switched off,
     and says "Available in Fang Rock only". Before this it sat there empty with
     one dim terminal line, and nothing pinned that state at all — `grep
     unlistable verify-*.mjs` found nothing — so changing it could break nothing
     and nothing would have noticed either.
     ⭐ Watched RED first, against f4289f5: file:// and the failed listing both
     came back with no notice and no switched-off crate.

     THREE ORIGINS, because "every non-Fang Rock context, uniformly" is the ruling
     and one origin cannot show uniformity:
       1. this page — a listing origin. The crate must NOT be switched off.
       2. file:// — the hub opened directly. `fetch` refuses outright.
       3. http with the listing answered 404 — which is exactly what Pages does,
          since `Game/disks/` is gitignored and never published.
     🚫 NOT COVERED HERE: the `arcade:` fault branch. A browser cannot be put on
     the shell's private scheme, so this rig cannot reach it; it was measured
     under the shell's own Electron build instead (see the commit). */
  const CRATE = `JSON.stringify((() => {
    const crate = document.getElementById("crate-lib");
    const note = document.getElementById("crate-lib-notice");
    const r = note && !note.hidden ? note.getBoundingClientRect() : null;
    return {
      records: crate.querySelectorAll(".disk").length,
      off: crate.classList.contains("is-unavailable"),
      fault: crate.classList.contains("is-fault"),
      shown: !!r && r.width > 40 && r.height > 20 && r.bottom <= innerHeight,
      text: note ? note.textContent.replace(/\\s+/g, " ").trim() : "",
      lines: __cat.lines().join("\\n")
    };
  })())`;

  const here = JSON.parse(await c.ev(CRATE));
  ok(here.records > 0 && !here.off && !here.shown,
     `a listing origin keeps its records and no notice   [${here.records} records, off=${here.off}]`);

  /* answer the ONE directory request with the 404 Pages gives, and nothing
     else — every other request is not matched by the pattern. Returns the pump,
     which the caller clears. (Shared with §K, which needs the same Pages.) */
  async function failDiskListing(b) {
    await b.send("Fetch.enable", { patterns: [{ urlPattern: "*/Game/disks/" }] });
    const done = new Set();
    return setInterval(() => {
      for (const m of b.events()) {
        if (m.method !== "Fetch.requestPaused" || done.has(m.params.requestId)) continue;
        done.add(m.params.requestId);
        b.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 404,
          body: Buffer.from("not found").toString("base64") }).catch(() => {});
      }
    }, 25);
  }

  /* a fresh browser per origin, so neither can inherit the other's scan */
  async function crateOn(url, failListing) {
    const b = await open({ gpu: true, w: 1280, h: 860 });
    let pump = null;
    try {
      if (failListing) pump = await failDiskListing(b);
      await b.goto(url);
      const t = await until(async () => /disk library/i.test(String(await b.ev("__cat.text()"))), 10000);
      const s = JSON.parse(await b.ev(CRATE));
      s.t = t;
      return s;
    } finally {
      if (pump) clearInterval(pump);
      b.close();
    }
  }

  const FILE_HUB = new URL("./index.html", import.meta.url).href;
  for (const [name, url, failListing] of [
    ["file://", FILE_HUB, false],
    ["http, listing 404 (as Pages)", URL_HUB, true],
  ]) {
    const s = await crateOn(url, failListing);
    ok(s.t >= 0, `${name}: the scan finished   [${s.t < 0 ? "TIMED OUT" : s.t + "ms"}]`);
    ok(s.records === 0 && s.off, `${name}: the Cracked crate is switched off, not just empty`);
    ok(s.shown, `${name}: its notice is on the glass`);
    ok(/available in fang rock only/i.test(s.text), `${name}: and says where the disks are   [${s.text}]`);
    /* 🚨 the fault wording belongs to the shell alone. Here it would tell a
       browser user something is broken when nothing is. */
    ok(!s.fault && !/fault/i.test(s.text), `${name}: and does NOT call it a fault`);
    ok(/disk library: not readable from this origin/i.test(s.lines),
       `${name}: the terminal line stays, as flavour`);
  }

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

  /* --- K. a cabinet goes straight into its own game --------------------- */
  section("K. ?cart=<id> — a corridor cabinet goes straight into its game, no hub menu");
  /* 🆕 2026-09-13 — his locked design: a cabinet click skips the hub menu
     entirely and launches that game, and the crack intro STILL plays first.
     🔄 2026-09-14: Exit Game goes back to the Arcade room inside Fang Rock (§M);
     here, in a browser, there is no Arcade room and it comes back to the hub.
     ⭐ WHAT IS BEING PROVEN IS WHAT THE PLAYER SEES, NOT JUST THE DESTINATION.
     "Pitstop is running" passes for a build that flashed the whole menu for
     five seconds first — which is exactly what the first cut of this did. So
     the menu is sampled every 50ms from the moment the page loads until the
     game is up, and any sample with the menu uncovered on the glass is a fail.
     🚨 THE REFUSALS MATTER AS MUCH AS THE LAUNCH. An unknown id that opened
     some other game would look like it worked, and a link must never reach the
     Developer-Mode disk the Ctrl+Shift+B gate hides (Laws 0.15/0.16).
     ⚠️ A fresh browser per case, never a second goto: cdp.mjs's goto() waits for
     a load event in a sink that ACCUMULATES, so a second navigation in the same
     browser returns before its page has loaded. */
  const LINK = `JSON.stringify({
    state: __cat.link ? __cat.link() : "missing",
    lines: __cat.lines(), inserted: __cat.inserted(), playing: __cat.playing(),
    src: __cat.playingSrc(), dev: __cat.devUnlocked(),
    curtain: document.documentElement.classList.contains("cat-link"),
    menuShown: getComputedStyle(document.getElementById("cat")).visibility !== "hidden",
    intro: !!document.getElementById("crack"),
    /* a crack intro that is fading OUT (class "out") no longer covers anything */
    covered: !document.getElementById("play").hidden || !!document.querySelector("#crack:not(.out)"),
    exitLabel: document.getElementById("btn-exit").textContent,
    tags: document.querySelectorAll("#out *:not(div)").length
  })`;
  async function linkOn(url, failListing, after) {
    const b = await open({ gpu: true, w: 1280, h: 860 });
    let pump = null;
    try {
      if (failListing) pump = await failDiskListing(b);
      await b.goto(url);
      const first = JSON.parse(await b.ev(LINK));
      let introSeen = first.intro, onGlass = 0, samples = 0, tPlay = -1;
      if (first.state === "launched") {
        tPlay = await until(async () => {
          const s = JSON.parse(await b.ev(LINK));
          samples++;
          if (s.intro) introSeen = true;
          if (s.menuShown && !s.covered) onGlass++;
          return s.playing;
        }, 20000, 50);
      }
      const s = { ...JSON.parse(await b.ev(LINK)), first, introSeen, onGlass, samples, tPlay };
      if (after) s.after = await after(b);
      return s;
    } finally {
      if (pump) clearInterval(pump);
      b.close();
    }
  }

  /* one cabinet per origin: all three ids get exercised, and the origin that
     matters most for the corridor's browser fallback (Pages) is one of them */
  const LINK_HUB = (q) => URL_HUB + q;
  const LINK_FILE = (q) => new URL("./index.html" + q, import.meta.url).href;
  const exitAndLook = async (b) => { await b.ev("__cat.exit()"); return JSON.parse(await b.ev(LINK)); };
  for (const [origin, url, failListing, id, file, entry] of [
    ["http listing",                LINK_HUB("?cart=pitstop"),   false, "pitstop",  "PITSTOP",          /Pitstop\/files\/index\.html$/],
    ["http, listing 404 (as Pages)", LINK_HUB("?cart=asteroid"), true,  "asteroid", "ASTEROID COMMAND", /Asteroid%20Command\/files\/index\.html$/],
    ["file://",                     LINK_FILE("?cart=aquanaut"), false, "aquanaut", "THE AQUANAUT",     /The%20Aquanaut\.html$/],
    /* 2026-09-17: Egg Timer went live, and its cabinet is fangrock://arcade/eggtimer */
    ["http listing (Egg Timer)",    LINK_HUB("?cart=eggtimer"),  false, "eggtimer", "EGG TIMER",        /Egg%20Timer\/files\/index\.html$/],
  ]) {
    const s = await linkOn(url, failListing, exitAndLook);
    eq(s.first.state, "launched", `${origin}: ?cart=${id} launches`);
    ok(s.first.curtain && !s.first.menuShown, `${origin}: the menu is hidden from the first look`);
    ok(s.introSeen, `${origin}: the crack intro plays first (his call)`);
    ok(s.tPlay >= 0 && s.playing, `${origin}: then the game is running   [${took(s.tPlay)}]`);
    ok(entry.test(String(s.src)), `${origin}: and it is ${file}'s own entry point   [${s.src}]`);
    ok(s.samples > 5 && s.onGlass === 0,
       `${origin}: the hub menu was never on the glass   [${s.onGlass} of ${s.samples} samples]`);
    ok(!s.lines.some((l) => /^> LOAD|^searching for/.test(l)), `${origin}: no load theatre in front of it`);
    eq(s.inserted, id, `${origin}: and the disk is in the drive`);
    eq(s.exitLabel, "Exit Game", `${origin}: the play bar's way out says Exit Game`);
    const a = s.after;
    ok(!a.playing && !a.curtain && a.menuShown && a.inserted === id,
       `${origin}: outside Fang Rock, Exit Game comes back to the hub, disk still in the drive   [menu ${a.menuShown}, drive ${a.inserted}]`);
  }

  /* 🚨 "HIDDEN FROM THE FIRST LOOK" ABOVE IS READ AFTER THE LOAD EVENT — by
     which time cat.js has run, so it cannot tell a curtain raised in <head>
     from one raised by cat.js after the menu had already painted. So cat.js is
     HELD at the network and the menu is read while the page is parsed right up
     to it. ⭐ The no-token page is the control: the same read must say visible,
     or this check cannot see a menu at all. */
  /* 🆕 2026-09-14 — FANG ROCK, AS FAR AS A BROWSER CAN BE IT (§M). The shell's
     preload.js exposes `window.fangRockShell = true` before any page script;
     this sets the same thing at the same moment. `window.close` is RECORDED, not
     done: a real close would end the rig's page, and whether it closes an
     Electron room window at all was measured separately, under the shell's own
     Electron 32.3.3 (see cat.js, leaveArcade). */
  const SHELL_PRELOAD =
    "window.fangRockShell = true; window.__closes = 0; window.close = function () { window.__closes++; };";

  async function menuWhileHubScriptHeld(q, preload) {
    const b = await open({ gpu: true, w: 1280, h: 860 });
    try {
      if (preload) await b.send("Page.addScriptToEvaluateOnNewDocument", { source: preload });
      await b.send("Fetch.enable", { patterns: [{ urlPattern: "*/Game/cat/cat.js" }] });
      await b.send("Page.navigate", { url: LINK_HUB(q) });
      let held = null;
      await until(async () => (held = b.events().find((m) => m.method === "Fetch.requestPaused")), 10000, 50);
      /* the preload scanner can ask for cat.js early; wait for the parser to
         reach it — crackintro.js is the script right before */
      await until(async () => { try { return await b.ev("!!window.CAT_CRACK"); } catch { return false; } }, 10000, 50);
      const v = held ? String(await b.ev("typeof __cat + '|' + getComputedStyle(document.getElementById('cat')).visibility")) : "never held";
      if (held) await b.send("Fetch.continueRequest", { requestId: held.params.requestId });
      return v;
    } finally {
      b.close();
    }
  }
  eq(await menuWhileHubScriptHeld(""), "undefined|visible", "[control] with cat.js held and no token, the menu reads visible");
  eq(await menuWhileHubScriptHeld("?cart=pitstop"), "undefined|hidden",
     "with cat.js held, a cabinet link has ALREADY hidden the menu (it is never painted)");
  eq(await menuWhileHubScriptHeld("", SHELL_PRELOAD), "undefined|hidden",
     "with cat.js held, inside Fang Rock with no token the menu is ALREADY hidden (its CAD crate is never painted)");

  /* the refusals. The link is followed synchronously at boot, so "nothing
     loaded" is read at a moment when a launch WOULD already have started. */
  for (const [what, q, echo] of [
    ["an unknown id",                      "?cart=frogger",               "cartridge link: frogger"],
    ["the Developer-Mode disk",            "?cart=blank",                 "cartridge link: blank"],
    ["a near miss in the wrong case",      "?cart=Pitstop",               "cartridge link: no readable name"],
    ["a hyphenated name",                  "?cart=asteroid-command",      "cartridge link: no readable name"],
    ["markup",                             "?cart=%3Cimg%20src%3Dx%3E",   "cartridge link: no readable name"],
  ]) {
    const s = await linkOn(LINK_HUB(q), false);
    eq(s.first.state, "not found", `${what} (${q}): refused`);
    ok(!s.first.curtain && s.first.menuShown, `${what}: on the ordinary hub, menu showing`);
    const at = s.lines.indexOf(echo);
    ok(at >= 0 && s.lines[at + 1] === "?file not found  error",
       `${what}: the terminal says so   [${s.lines.slice(-3).join(" | ")}]`);
    ok(s.inserted === null && !s.playing && !s.first.intro && !s.lines.some((l) => /^> LOAD/.test(l)),
       `${what}: the drive stays empty and NO other game is substituted`);
    if (q === "?cart=blank") ok(!s.dev, "and the link does not open the Ctrl+Shift+B gate");
    if (/%3C/.test(q)) ok(s.tags === 0 && !s.lines.some((l) => l.includes("<")),
       `and the link's text is neither rendered nor echoed   [${s.tags} tags]`);
  }

  /* --- L. the corner C64: cracked disks only ---------------------------- */
  section("L. ?cart=cracked — the corner C64: cracked disks only, cartridges not in the page at all");
  /* 🆕 2026-09-13 — his locked design: regular cartridges HIDDEN ENTIRELY, not
     greyed out and not present in the DOM — and not reachable by any other path
     either. So every path is tried, not just the render: the roster the tooling
     reads, selection by id, the Ctrl+Shift+B gate, and a typed LOAD. */
  const CRACKED = `JSON.stringify({
    state: __cat.link ? __cat.link() : "missing",
    curtain: document.documentElement.classList.contains("cat-link"),
    menuShown: getComputedStyle(document.getElementById("cat")).visibility !== "hidden",
    cadCrate: !!document.getElementById("crate-plc"),
    cartsInDom: document.querySelectorAll('.disk[data-id="asteroid"],.disk[data-id="aquanaut"],.disk[data-id="pitstop"],.disk[data-id="eggtimer"],.disk[data-id="blank"]').length,
    roster: __cat.disks().filter(function (d) { return d.runner !== "emulator"; }).map(function (d) { return d.id; }),
    records: document.querySelectorAll("#crate-lib .disk").length,
    firstCrate: document.getElementById("crates").firstElementChild.id,
    notice: (function (n) { return n && !n.hidden ? n.textContent.replace(/\\s+/g, " ").trim() : ""; })(document.getElementById("crate-lib-notice")),
    lines: __cat.lines()
  })`;
  {
    const b = await open({ gpu: true, w: 1280, h: 860 });
    try {
      await b.goto(LINK_HUB("?cart=cracked"));
      const tScan = await until(async () => /disk library/i.test(String(await b.ev("__cat.text()"))), 10000);
      const s = JSON.parse(await b.ev(CRACKED));
      eq(s.state, "cracked", `?cart=cracked enters cracked-only mode   [scan ${tScan < 0 ? "TIMED OUT" : tScan + "ms"}]`);
      ok(!s.curtain && s.menuShown, "the hub itself shows (this is a menu, not a launch)");
      ok(s.lines.includes("cracked disks only."), "and the terminal says which mode it is in");
      ok(!s.cadCrate, "the CAD crate is not in the page at all");
      eq(s.cartsInDom, 0, "no cartridge record anywhere in the DOM");
      ok(s.roster.length === 0, `and not in the roster either — nothing in memory to reach   [${s.roster.join(",")}]`);
      ok(s.records > 0 && s.firstCrate === "crate-lib",
         `the Cracked crate has its disks and now heads the column   [${s.records} records, first: ${s.firstCrate}]`);

      eq(await b.ev("__cat.select('pitstop') || __cat.select('asteroid') || __cat.select('aquanaut') || __cat.select('blank')"),
         "false", "no cartridge can be selected by id, the Blank Cassette included");
      /* 🔄 2026-09-16 — the real C64 owns the keyboard in this mode, and selecting
         hands focus to it, so a Ctrl+Shift+B pressed there is the machine's key.
         The hub answers it when focus is on the hub's side, which is where this
         puts it (measured: without this, the key went to the C64 and the check
         read the hub's silence as a missing message). */
      await b.ev("document.activeElement && document.activeElement.blur(); document.body.focus(); 1");
      await b.key("keyDown", "B", "KeyB", 66, CTRL_SHIFT);
      await wait(160);
      const gate = JSON.parse(await b.ev(CRACKED));
      ok(!(await b.ev("__cat.devUnlocked()")) && gate.cartsInDom === 0 && gate.roster.length === 0,
         "Ctrl+Shift+B does not bring the Blank Cassette back");
      ok(/developer mode is not available/.test(gate.lines.slice(-2).join(" ")),
         `and says why, rather than doing nothing   [${gate.lines.slice(-2).join(" | ")}]`);

      /* 🔄 2026-09-16 — CRACKED MODE IS THE REAL C64 NOW. This used to type
         LOAD"PITSTOP",8 into the hub's resolver and read ?FILE NOT FOUND off its
         transcript. There is no resolver in this mode any more: the command is
         typed INTO THE MACHINE, and it is the machine that answers — which is
         verify-c64.mjs's to judge, under Electron, because the emulator does not
         run in this headless browser. What is left to check HERE is the hub's
         side: the machine is the screen, and a command does not reach the
         resolver or the play overlay by some other road. */
      const mach = JSON.parse(await b.ev(`JSON.stringify({ m: __cat.machine(),
        frame: document.getElementById("machine-frame").getBoundingClientRect().width,
        out: getComputedStyle(document.getElementById("out")).display,
        buttons: ["btn-listing", "btn-run", "btn-reset"].filter(function (id) { return !document.getElementById(id).hidden; }),
        note: __cat.note() })`));
      ok(mach.m.on && mach.m.started && /emulator\/index\.html\?machine=1/.test(mach.m.src),
         `the screen is the real C64 (the machine page), not the terminal   [${mach.m.src}]`);
      ok(mach.out === "none" && mach.frame > 300, `the terminal is off the glass and the machine fills it   [out ${mach.out}, ${Math.round(mach.frame)}px]`);
      eq(mach.buttons.join(","), "btn-listing,btn-run,btn-reset", "the deck grows List, Run and Reset");
      ok(typeof mach.note === "string" && mach.note.length > 0, `the hub speaks on the deck's note line   [${mach.note}]`);
      const before = Number(await b.ev("__cat.lines().length"));
      await b.ev(`__cat.execute('LOAD"PITSTOP",8')`);
      await wait(300);
      const afterLines = await b.ev(`__cat.lines().slice(${before})`);
      ok(!afterLines.some((l) => /^> LOAD|file not found/i.test(l)) && String(await b.ev("__cat.playing()")) === "false",
         `a command goes to the machine, not the resolver: no hub echo, nothing launched   [${afterLines.join(" | ") || "no new lines"}]`);

      /* 🆕 his addendum: the power rocker. Outside Fang Rock a tab cannot close
         itself, so it switches the C64 off (dark screen, empty drive) and on
         (a fresh boot). Clicked mid-command on purpose: a power switch is never
         blocked by something in flight. */
      await b.ev("document.getElementById('c64-power').click()");
      const off = JSON.parse(await b.ev(`JSON.stringify({ pressed: document.getElementById("c64-power").getAttribute("aria-pressed"),
        src: document.getElementById("machine-frame").getAttribute("src"), inserted: __cat.inserted(), note: __cat.note() })`));
      ok(off.pressed === "false" && off.src === "about:blank" && off.inserted === null && /power off/.test(off.note),
         `the rocker switches the C64 off: dark screen, empty drive, light out   [${JSON.stringify(off)}]`);
      await b.ev("document.getElementById('c64-power').click()");
      const on = JSON.parse(await b.ev(`JSON.stringify({ pressed: document.getElementById("c64-power").getAttribute("aria-pressed"),
        src: document.getElementById("machine-frame").getAttribute("src") })`));
      ok(on.pressed === "true" && /machine=1/.test(on.src), `and on again: a fresh boot   [${JSON.stringify(on)}]`);
      await b.shot(fileURLToPath(new URL("./verify-cat-cracked.png", import.meta.url)));
    } finally {
      b.close();
    }
  }
  /* and where the disk list cannot be read (Pages): the mode still holds, and
     the crate's own "Fang Rock only" notice is what the player sees */
  {
    const b = await open({ gpu: true, w: 1280, h: 860 });
    let pump = null;
    try {
      pump = await failDiskListing(b);
      await b.goto(LINK_HUB("?cart=cracked"));
      await until(async () => /disk library/i.test(String(await b.ev("__cat.text()"))), 10000);
      const s = JSON.parse(await b.ev(CRACKED));
      ok(s.state === "cracked" && !s.cadCrate && s.roster.length === 0 && s.records === 0,
         "listing 404 (as Pages): still cracked-only, still no cartridges");
      ok(/available in fang rock only/i.test(s.notice), `listing 404 (as Pages): the crate says where the disks are   [${s.notice}]`);
    } finally {
      if (pump) clearInterval(pump);
      b.close();
    }
  }

  /* --- M. inside Fang Rock ---------------------------------------------- */
  section("M. inside Fang Rock — no PLC games on the C64 screen, Exit Game and Power Off leave, Reset stays");
  /* 🆕 2026-09-14 — his asks, having played it in the installed app:
       1. a PLC game's way out is "Exit Game", and goes back to the Arcade room
          (closes Fang Rock's Arcade window); a cracked disk's is "Reset" (his
          pick for what used to say "Exit to CAT"), back to the disk screen.
       2. "that C64 main screen in FR, remove the PLC games" — with ANY token or
          none, the hub inside Fang Rock is cracked disks only.
       3. a way off the C64 screen back to the Arcade room: "Power Off" (his pick).
     ⚠️ SHELL_PRELOAD records window.close rather than doing it, so after each
     "close" the hub's own did-not-close fallback is ALSO exercised: here the
     window really does stay, and the hub must say so rather than sit there. */
  async function shellOn(q, fn) {
    const b = await open({ gpu: true, w: 1280, h: 860 });
    try {
      await b.send("Page.addScriptToEvaluateOnNewDocument", { source: SHELL_PRELOAD });
      await b.goto(LINK_HUB(q));
      return await fn(b);
    } finally {
      b.close();
    }
  }
  const SHELL = `JSON.stringify({
    state: __cat.link ? __cat.link() : "missing", shell: window.fangRockShell === true,
    closes: window.__closes, playing: __cat.playing(), inserted: __cat.inserted(),
    menuShown: getComputedStyle(document.getElementById("cat")).visibility !== "hidden",
    cadCrate: !!document.getElementById("crate-plc"),
    cartsInDom: document.querySelectorAll('.disk[data-id="asteroid"],.disk[data-id="aquanaut"],.disk[data-id="pitstop"],.disk[data-id="eggtimer"],.disk[data-id="blank"]').length,
    roster: __cat.disks().filter(function (d) { return d.runner !== "emulator"; }).map(function (d) { return d.id; }),
    /* 🔄 2026-09-16: on the C64 screen Power Off is the side panel's rocker (his addendum);
       the old button is still the one a no-machine hub would show, and it never does here */
    power: (function (p) { var r = p.getBoundingClientRect(); return !p.closest("[hidden]") && r.width > 20 && r.bottom <= innerHeight; })(document.getElementById("c64-power")),
    exitLabel: document.getElementById("btn-exit").textContent,
    lines: __cat.lines()
  })`;

  /* the C64 screen: no token */
  await shellOn("", async (b) => {
    await until(async () => /disk library/i.test(String(await b.ev("__cat.text()"))), 10000);
    let s = JSON.parse(await b.ev(SHELL));
    ok(s.shell && s.state === "none", `[control] the page believes it is inside Fang Rock   [shell=${s.shell}, link ${s.state}]`);
    ok(s.menuShown && !s.cadCrate && s.cartsInDom === 0 && s.roster.length === 0,
       `no token: the C64 screen has NO PLC games — no CAD crate, none in the DOM or the roster   [${s.roster.join(",")}]`);
    ok(s.lines.includes("cracked disks only."), "no token: and says it is cracked disks only");
    ok(s.power, "no token: the power rocker is on the side panel, on screen");

    /* 🔄 2026-09-16 — a cracked disk no longer opens the play overlay: it goes
       into the real C64 on the screen, and runs there. So its "Reset" is the
       deck's Reset (and F10), which resets the machine and closes nothing. What
       that does to the machine is verify-c64.mjs's to judge. */
    const m = JSON.parse(await b.ev(`JSON.stringify({ m: __cat.machine(),
      reset: (function (r) { return !r.hidden ? r.title : null; })(document.getElementById("btn-reset")) })`));
    ok(m.m.on && m.m.started, "no token: the screen is the real C64");
    ok(/F10/.test(String(m.reset)), `no token: the deck's Reset is there and names its key   [${m.reset}]`);
    const lib = String(await b.ev("__cat.visible()[0]"));
    await b.ev(`__cat.select(${JSON.stringify(lib)}), __cat.insert()`);
    /* 🔄 his addendum: here the drive animation replaces the crack intro */
    const tIntro = await until(async () => !!(await b.ev("!!document.getElementById('drive-insert')")), 2000, 50);
    ok(tIntro >= 0 && !(await b.ev("!!document.getElementById('crack')")),
       `Insert Disk plays the disk-into-drive animation, not the crack intro   [${took(tIntro)}]`);
    await wait(3500);
    s = JSON.parse(await b.ev(SHELL));
    ok(!s.playing, "a cracked disk does NOT open the play overlay: it goes into the machine on the screen");
    await b.ev("document.getElementById('btn-reset').click()");
    await wait(300);
    s = JSON.parse(await b.ev(SHELL));
    ok(s.closes === 0 && s.menuShown && !s.playing, `Reset closes nothing and leaves the C64 screen up   [closes ${s.closes}]`);

    /* Power Off — the rocker goes down and the light goes out, then the window closes */
    await b.ev("document.getElementById('c64-power').click()");
    ok((await b.ev("document.getElementById('c64-power').getAttribute('aria-pressed')")) === "false",
       "the rocker goes to off and its light goes out");
    const tClose = await until(async () => Number(await b.ev("window.__closes")) === 1, 2000, 50);
    ok(tClose >= 0, `and the Arcade window closes   [${took(tClose)}]`);
    const tStay = await until(async () => (await b.ev("__cat.lines()")).includes("the arcade window did not close."), 4000, 100);
    ok(tStay >= 0 && (await b.ev("document.getElementById('c64-power').getAttribute('aria-pressed')")) === "true",
       "and if the window stays, the deck says so and the rocker goes back on (the machine never went off)");
  });

  /* a cabinet, inside Fang Rock */
  await shellOn("?cart=pitstop", async (b) => {
    const tCab = await until(async () => String(await b.ev("__cat.playing()")) === "true");
    let s = JSON.parse(await b.ev(SHELL));
    ok(tCab >= 0 && s.state === "launched" && s.inserted === "pitstop",
       `?cart=pitstop still launches its cartridge inside Fang Rock   [${took(tCab)}]`);
    ok(!s.cadCrate && s.cartsInDom === 0 && s.roster.length === 0,
       "while the menu underneath it still holds no PLC games (the cabinet's disk was resolved before the cut)");
    /* 🆕 2026-09-16 — and no C64 boots unseen behind the cabinet's game */
    const behind = await b.ev("__cat.machine()");
    ok(behind.on && !behind.started && (await b.ev("document.getElementById('machine-frame').getAttribute('src')")) === "about:blank",
       "no C64 is started behind a cabinet's game");
    eq(s.exitLabel, "Exit Game", "a PLC game's way out says Exit Game");
    await b.ev("document.getElementById('btn-exit').click()");
    eq(await b.ev("window.__closes"), 1, "Exit Game closes the Arcade window, back to the Arcade room");
    const tFall = await until(async () => (await b.ev("__cat.lines()")).includes("the arcade window did not close."), 4000, 100);
    s = JSON.parse(await b.ev(SHELL));
    ok(tFall >= 0 && !s.playing && s.cartsInDom === 0,
       "and if the window stays, the game stops, the terminal says so, and still no PLC game is listed");
    ok((await b.ev("__cat.machine()")).started, "and the C64 comes on, now that the hub is on the glass");
  });

  /* an unknown token inside Fang Rock lands on the same C64 screen */
  await shellOn("?cart=frogger", async (b) => {
    const s = JSON.parse(await b.ev(SHELL));
    ok(s.state === "not found" && s.menuShown && !s.cadCrate && s.roster.length === 0 && !s.playing,
       "an unknown token inside Fang Rock: the C64 screen, refused, still no PLC games");
  });

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
  artMine.forEach((name) => { try { rmSync(ART_DIR + name); } catch { /* already gone */ } });
}

console.log(`\n${"-".repeat(66)}`);
console.log(`  CAT hub: ${pass} passed, ${fail} failed`);
if (fail) { console.log("\n  failures:"); fails.forEach((f) => console.log("    - " + f)); }
console.log(`${"-".repeat(66)}\n`);
process.exit(fail ? 1 : 0);
