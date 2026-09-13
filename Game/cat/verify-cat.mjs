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

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
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

  /* ⭐⭐ THE STATE THAT MATTERS MOST, because it is the one 55 of 59 disks are
     in. 🚫 An empty frame reads as a picture that failed to load; the words are
     the whole point. And nothing must be invented for a disk with no entry. */
  await c.ev("__cat.select('lib-beach-head')");
  await wait(250);
  ok((await c.ev("document.getElementById('detail-shot').className")).includes("is-empty"),
     "a disk with no art says so rather than showing an empty frame");
  const syn = String(await c.ev("document.getElementById('detail-synopsis').textContent"));
  ok(/no synopsis/i.test(syn), `and says no synopsis is written   [${syn.slice(0, 40)}]`);
  ok(!/beach/i.test(syn),
     "🚫 and does NOT generate one from the filename");

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
  const noArt = JSON.parse(await c.ev(SHOT));
  ok(noArt.sleeve && /no art yet/i.test(noArt.label) && !noArt.bg,
     `a disk with no art shows the blank-sleeve placeholder   [${noArt.cls}, "${noArt.label}"]`);

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

  /* a fresh browser per origin, so neither can inherit the other's scan */
  async function crateOn(url, failListing) {
    const b = await open({ gpu: true, w: 1280, h: 860 });
    let pump = null;
    try {
      if (failListing) {
        /* answer the ONE directory request with the 404 Pages gives, and
           nothing else — every other request is not matched by the pattern */
        await b.send("Fetch.enable", { patterns: [{ urlPattern: "*/Game/disks/" }] });
        const done = new Set();
        pump = setInterval(() => {
          for (const m of b.events()) {
            if (m.method !== "Fetch.requestPaused" || done.has(m.params.requestId)) continue;
            done.add(m.params.requestId);
            b.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 404,
              body: Buffer.from("not found").toString("base64") }).catch(() => {});
          }
        }, 25);
      }
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
