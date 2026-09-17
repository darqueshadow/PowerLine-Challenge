/* ===========================================================================
   verify-egg-timer.mjs — does the page do what the packet says, in a browser?

   RUN
     1.  python -m http.server 8898            (from the (PCL) repo root)
     2.  node verify-egg-timer.mjs [shotsDir]  (from this folder)

   Uses Nerva Beacon's dependency-free headless-Chrome driver (cdp.mjs), the
   same one the CAT hub rig uses. Keys go through CDP as real key events; the
   game clock is driven with __et.advance() so a 60-second CAV doesn't take 60
   seconds. Screenshots, if a folder is given, go there (never under Game/).

   ⚠️ Wiping is exercised with synthetic PointerEvents dispatched in the page
   (the driver has no mouse helper). That proves the wipe logic and hit-testing,
   not that a physical mouse reaches it.
   ========================================================================= */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DRIVER = new URL("../../../../+Nerva Beacon/Nerva Beacon Main/tools/cdp.mjs", import.meta.url);
if (!existsSync(fileURLToPath(DRIVER))) {
  console.error("\n  Cannot find NB's cdp.mjs at:\n    " + fileURLToPath(DRIVER) + "\n");
  process.exit(2);
}
const { open } = await import(DRIVER);

const SHOTS = process.argv[2] || null;
const URL_GAME = "http://localhost:8898/Game/cartridges/Egg%20Timer/files/index.html?seed=42&cb=" + process.pid;

let pass = 0, fail = 0;
const fails = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function ok(cond, label) {
  cond ? pass++ : (fail++, fails.push(label));
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`);
  return cond;
}
const eq = (got, want, label) => ok(JSON.stringify(got) === JSON.stringify(want), `${label}   [got ${JSON.stringify(got)}]`);
const section = (s) => console.log(`\n${s}`);

const KEYS = {
  Enter: ["Enter", 13], Tab: ["Tab", 9], Escape: ["Escape", 27], F12: ["F12", 123],
  ArrowRight: ["ArrowRight", 39], ArrowLeft: ["ArrowLeft", 37], ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40]
};
const SHIFT = 8, CTRL = 2;

const c = await open({ gpu: true, w: 1440, h: 900 });
async function press(name, mods = 0) {
  const [code, kc] = KEYS[name] || [name, name.toUpperCase().charCodeAt(0)];
  await c.key("rawKeyDown", name, code, kc, mods);
  await c.key("keyUp", name, code, kc, mods);
  await wait(30);
}
const ev = (s) => c.ev(s);
const snap = () => ev("__et.snapshot()");
async function shot(name) { if (SHOTS) await c.shot(`${SHOTS}\\${name}.png`); }

/* Advance until a nest matches, or give up. */
async function until(fn, maxSeconds = 120, step = 0.25) {
  for (let t = 0; t < maxSeconds; t += step) {
    const s = await snap();
    const hit = fn(s);
    if (hit) return { s, hit };
    await ev(`__et.advance(${step})`);
  }
  return { s: await snap(), hit: null };
}
async function typeAndEnter(text) {
  await ev("document.querySelector('.box.active input').focus()");
  await c.insert(text);
  await press("Enter");
}

try {
  await c.goto(URL_GAME);
  for (let i = 0; i < 60 && !(await ev("!!(window.__et && __et.ready())")); i++) await wait(100);

  /* ------------------------------------------------------------- A. boot */
  section("A. boot and data");
  ok(await ev("__et.ready()"), "the page loads its data over http://");
  eq(await ev("__et.data().types.map(t => t.code).join(',')"), "VS,STR,SS,EOS,MB,AD,VF", "the CAV type table loads");
  eq(await ev("__et.data().units.length"), 59, "59 transport units load from the shared Data Sheet");
  eq(await ev("JSON.stringify(__et.data().blankTypes) === JSON.stringify(__et.data().types) && __et.data().blankTypes.map(t => t.code).join(',')"), "VS,STR,SS,EOS,MB,AD,VF", "D1: the Blank Dataset Module loads the seven real types, every value the same");
  eq(await ev("__et.screen()"), "title", "it opens on the title screen");
  eq(await ev("[...document.querySelectorAll('.logo .et')].map(e => e.textContent).join('')"), "ET", "the styled letters in the title spell ET");
  await shot("01-title");

  /* ------------------------------------------------------------ B. setup */
  section("B. setup: mode buttons and box count on one screen");
  await press("Enter");
  eq(await ev("__et.screen()"), "setup", "Enter goes to setup");
  eq(await ev("document.querySelector('[data-mode].selected').dataset.mode + '/' + document.querySelector('[data-boxes].selected').dataset.boxes"), "clear/1", "defaults: Clear CAVs Only, 1 box");
  await press("ArrowRight");
  await press("ArrowUp"); await press("ArrowUp"); await press("ArrowUp"); await press("ArrowUp");
  eq(await ev("document.querySelector('[data-mode].selected').dataset.mode + '/' + document.querySelector('[data-boxes].selected').dataset.boxes"), "progression/4", "arrows change mode, and boxes stop at 4");
  await c.key("keyDown", "2", "Digit2", 50, 0); await c.key("keyUp", "2", "Digit2", 50, 0); await wait(30);
  eq(await ev("document.querySelector('[data-boxes].selected').dataset.boxes"), "2", "a digit picks the box count");
  await shot("02-setup");
  await press("Enter");
  eq(await ev("__et.screen() + '/' + __et.snapshot().mode + '/' + __et.boxes().count"), "play/progression/2", "Enter starts Follow Progression with 2 boxes");

  /* ------------------------------------------------------- C. one CAV */
  section("C. one CAV: grow, bold, clear (Clear CAVs Only)");
  await ev("__et.start('clear', 1)");
  await ev("__et.advance(0.1)");
  eq(await ev("[...document.querySelectorAll('.nest:not([hidden])')].map(n => n.dataset.id).sort().join(',')"), "1,2,5,6,9", "wave 1 shows 5 nests");
  let s = await snap();
  let n = s.nests.find((x) => x.state === "active");
  ok(!!n, `a CAV is running   [${n && n.unit} ${n && n.code}]`);
  const q = (sel) => `document.querySelector('.nest[data-id="${n.id}"] ${sel}')`;
  eq(await ev(`${q(".unit")}.textContent + ' ' + ${q(".code")}.textContent`), `${n.unit} ${n.code}`, "the readout shows the unit and the literal type code");
  eq(await ev(`getComputedStyle(${q(".egg")}).display`), "inline", "the egg is showing from the start");
  eq(await ev(`getComputedStyle(${q(".readout")}).fontWeight`), "400", "the readout is regular weight before the trigger");

  await typeAndEnter(`RCAV ${n.unit}`);
  eq((await snap()).nests.find((x) => x.id === n.id).state, "active", "RCAV before the trigger does nothing");
  eq(await ev("__et.boxes().values[0]"), `RCAV ${n.unit}`, "D6: the rejected text stays in the box");
  await press("F12");
  eq(await ev("__et.boxes().values[0]"), "", "F12 clears the box, no penalty");

  const r = await until((x) => x.nests.find((y) => y.id === n.id && y.state === "overtime"), 80, 0.25);
  ok(!!r.hit, "the nest reaches its trigger");
  eq(await ev(`getComputedStyle(${q(".readout")}).fontWeight`), "900", "at the trigger the readout goes bold");
  const expect = { VS: "00:20", STR: "00:20", SS: "00:30", EOS: "01:00", MB: "01:00" }[n.code];
  // the rig samples every 0.25 game-s, and the clock shows whole game seconds, so at the trigger it reads the duration exactly
  if (expect) eq(await ev(`${q(".clock")}.textContent`), expect, `D5: the timer shows game seconds, ${n.code} going bold at ${expect}`);
  ok(Number(await ev(`${q(".crack")}.style.strokeDashoffset`)) <= 1, "the egg starts cracking");
  await shot("03-bold");

  const before = await ev("__et.snapshot().score");
  await typeAndEnter(`RCAV ${n.unit}`);
  s = await snap();
  eq(s.nests.find((x) => x.id === n.id).state, "splat", "the same RCAV after the trigger smooshes the egg");
  ok(s.score > before, `points awarded   [+${s.score - before}]`);
  eq(await ev("__et.boxes().values[0]"), "", "an accepted command clears the box");
  ok(await ev(`${q(".splat")}.childElementCount > 0`), "a cooked-egg splat is drawn");

  const cov = await ev(`__et.mess(${n.id})`);
  ok(cov > 0.02, `the smooshed nest gets mess   [${(cov * 100).toFixed(1)}%]`);
  const nb = { 1: [2, 5], 2: [1, 6], 5: [1, 6, 9], 6: [2, 5], 9: [5] }[n.id];
  const nbCov = await ev(`[${nb}].map(i => __et.mess(i))`);
  ok(nbCov.every((x) => x > 0), `its direct neighbours get mess too   [${nb.join(",")}]`);
  const far = [1, 2, 5, 6, 9].filter((i) => i !== n.id && !nb.includes(i));
  if (far.length) eq(await ev(`[${far}].map(i => __et.mess(i))`), far.map(() => 0), `non-neighbours stay clean   [${far.join(",")}]`);
  await shot("04-splat");

  /* ------------------------------------------------------------- D. wipe */
  section("D. click-and-drag wiping");
  const wipeCov = await ev(`(() => {
    const cv = document.querySelector('.nest[data-id="${n.id}"] .mess');
    const r = cv.getBoundingClientRect();
    const field = document.querySelector('#field');
    const fire = (type, x, y) => field.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, buttons: 1 }));
    fire('pointerdown', r.left + 4, r.top + 4);
    for (let y = r.top + 4; y < r.bottom; y += 10) {
      fire('pointermove', r.left + 4, y);
      fire('pointermove', r.right - 4, y + 5);
    }
    fire('pointerup', r.right - 4, r.bottom - 4);
    return __et.mess(${n.id});
  })()`);
  ok(wipeCov < cov * 0.25, `a drag across the nest wipes most of it away   [${(cov * 100).toFixed(1)}% → ${(wipeCov * 100).toFixed(1)}%]`);
  ok(await ev("__et.boxes().focused"), "the command box gets the keyboard back after wiping");

  /* ------------------------------------------------------ E. hatch, pool */
  section("E. a hatch drains the pool");
  await ev("__et.start('clear', 1)");                       // fresh: nothing has hatched yet
  const h = await until((x) => x.stats.hatched >= 1, 120, 0.1);
  ok(!!h.hit, "leaving a CAV alone lets it hatch");
  eq(await ev("document.querySelector('#hud-pool').textContent"), "●●○", "the pool shows 2 of 3");
  eq(await ev("document.querySelector('#hud-pool-label').textContent"), "POOL", "the pool is shown by its placeholder key only");
  ok(await ev("!!document.querySelector('.nest.scurry, .nest.lunge')"), "the creature does an escape flourish (scurry or lunge)");
  await shot("05-escape");

  /* ------------------------------------------------------ F. command boxes */
  section("F. Command Boxes and the switcher");
  await ev("__et.start('clear', 3)");
  let b = await ev("__et.boxes()");
  eq([b.count, b.active, b.focused], [3, 0, true], "3 boxes, box 1 active and focused");
  await ev("document.querySelector('.box.active input').focus()");
  await c.insert("RCAV 2041");
  await press("Tab");
  b = await ev("__et.boxes()");
  eq([b.open, b.highlight], [true, 1], "Tab opens the switcher on the next box");
  eq(await ev("document.querySelector('#switcher li .preview').textContent"), "RCAV 2041", "staged text shows as a preview");
  const t0 = (await snap()).time;
  await wait(500);
  ok((await snap()).time > t0 + 0.2, "the game keeps running while the switcher is open");
  await shot("06-switcher");
  await press("Tab"); await press("Tab", SHIFT);
  eq((await ev("__et.boxes()")).highlight, 1, "Tab and Shift+Tab move the highlight");
  await press("ArrowDown");
  eq((await ev("__et.boxes()")).highlight, 2, "arrows move it too");
  await c.insert("X");
  eq((await ev("__et.boxes()")).values, ["RCAV 2041", "", ""], "typing is ignored while the switcher is open");
  await press("Escape");
  b = await ev("__et.boxes()");
  eq([b.open, b.active, b.focused, (await ev("__et.paused()"))], [false, 0, true, false], "Esc closes the switcher without switching (and doesn't pause)");
  await press("Tab"); await press("Enter");
  b = await ev("__et.boxes()");
  eq([b.open, b.active, b.focused, b.values[0]], [false, 1, true, "RCAV 2041"], "Enter switches to the highlighted box; box 1 keeps its text");
  await c.insert("CAV 2042 MB");
  await press("F12");
  eq((await ev("__et.boxes()")).values, ["RCAV 2041", "", ""], "F12 clears only the active box");

  let reached = false;
  for (let t = 0; t < 400 && !reached; t += 0.5) {
    const x = await snap();
    if (x.wave === 2) { reached = true; break; }
    for (const y of x.nests.filter((z) => z.state === "overtime")) await ev(`__et.submit('RCAV ${y.unit}')`);   // straight to the game, not through a box
    await ev("__et.advance(0.5)");
  }
  ok(reached, "play reaches wave 2 (with the staged text still waiting)");
  eq((await ev("__et.boxes()")).values[0], "", "a new wave clears the text staged in an inactive box");

  await ev("__et.start('clear', 1)");
  await press("Tab");
  eq((await ev("__et.boxes()")).open, false, "with 1 box, Tab does nothing");

  /* ------------------------------------------------------------- G. pause */
  section("G. pause");
  await press("Escape");
  ok(await ev("__et.paused() && !document.querySelector('#pause').hidden"), "Esc pauses");
  const p0 = (await snap()).time;
  await wait(500);
  eq((await snap()).time, p0, "no game time passes while paused");
  await shot("07-paused");
  await press("Escape");
  ok(await ev("!__et.paused() && __et.boxes().focused"), "Esc resumes, keyboard back in the box");

  /* ------------------------------------------------ H. placement and VF */
  section("H. placement (Both) and VF");
  await ev("__et.start('both', 1)");
  await ev("__et.advance(0.1)");
  s = await snap();
  const trig = s.nests.find((x) => x.state === "trigger");
  ok(!!trig, `a placement trigger appears   [${trig && trig.unit} ${trig && trig.code}]`);
  const wrong = trig.code === "MB" ? "VS" : "MB";
  await typeAndEnter(`CAV ${trig.unit} ${wrong}`);
  eq((await snap()).nests.find((x) => x.id === trig.id).state, "trigger", "the wrong (real) code is rejected");
  await press("F12");
  const sc = (await snap()).score;
  await typeAndEnter(`CAV ${trig.unit} ${trig.code}, on scene late`);
  s = await snap();
  eq([s.nests.find((x) => x.id === trig.id).state, s.score - sc], ["active", 10], "the right code (with a comment) places it for 10 points");

  let vf = null;
  for (let i = 0; i < 400 && !vf; i++) {
    s = await snap();
    for (const x of s.nests.filter((y) => y.state === "trigger")) await ev(`__et.submit('CAV ${x.unit} ${x.code}')`);
    for (const x of s.nests.filter((y) => y.state === "overtime" && y.code !== "VF")) await ev(`__et.submit('RCAV ${x.unit}')`);
    vf = (await snap()).nests.find((y) => y.code === "VF" && y.state === "active") || null;
    if (!vf) await ev("__et.advance(0.5)");
  }
  ok(!!vf, "a VF gets placed");
  if (vf) {
    const vq = (sel) => `document.querySelector('.nest[data-id="${vf.id}"]${sel}')`;
    await ev("__et.advance(0.01)");   // draw a frame first: a check on the undrawn DOM passes or fails by timing alone
    eq(await ev(`${vq("")}.dataset.state`), "active", "the VF nest is drawn in its running state");
    eq(await ev(`getComputedStyle(${vq(" .egg")}).display`), "none", "a running VF shows no egg");
    const vis = (part) => ev(`getComputedStyle(${vq(" ." + part)}).visibility`);
    eq([await vis("unit"), await vis("code"), await vis("clock")], ["visible", "visible", "hidden"], "C15(b): …its unit and \"VF\" still show, and only its timer is hidden");
    eq(await ev(`${vq(" .unit")}.textContent + ' ' + ${vq(" .code")}.textContent`), `${vf.unit} VF`, "…and they read the fuelling unit and VF");
    await shot("08-vf-hidden");
    await until((x) => x.nests.find((y) => y.id === vf.id && y.state === "overtime"), 80, 0.25);
    eq([await ev(`getComputedStyle(${vq(" .egg")}).display`), await vis("clock"), await ev(`getComputedStyle(${vq(" .readout")}).fontWeight`)], ["inline", "visible", "900"], "at \"Clear Fuel\" (the trigger) the egg and the timer appear, bold");
  }

  /* ------------------------------------------------------ I. developer mode */
  section("I. Developer Mode gate");
  await c.key("rawKeyDown", "B", "KeyB", 66, CTRL | SHIFT); await c.key("keyUp", "B", "KeyB", 66, CTRL | SHIFT); await wait(50);
  ok(await ev("!document.querySelector('#dev-prompt').hidden"), "Ctrl+Shift+B opens the timed password prompt");
  ok(await ev("__et.snapshot() && document.activeElement === document.querySelector('#dev-prompt input')"), "the prompt takes the keyboard");
  const dt0 = (await snap()).time; await wait(300);
  eq((await snap()).time, dt0, "the game holds while the prompt is open");
  await c.insert("not the phrase");
  await press("Enter");
  eq(await ev("document.querySelector('#dev-prompt .msg').textContent"), "ACCESS DENIED", "⏳ D3: with no phrase set, every entry is denied");
  ok(await ev("document.querySelector('#dev-badge').hidden"), "Developer Mode stays off");
  await press("Escape");
  ok(await ev("document.querySelector('#dev-prompt').hidden && __et.boxes().focused"), "Esc closes the prompt, keyboard back in the box");
  await c.key("rawKeyDown", "b", "KeyB", 66, CTRL | SHIFT); await c.key("keyUp", "b", "KeyB", 66, CTRL | SHIFT); await wait(50);
  ok(await ev("!document.querySelector('#dev-prompt').hidden"), "lowercase b works too");
  await press("Escape");

  /* ---------------------------------------------------------- J. game over */
  section("J. game over");
  await ev("__et.start('clear', 1)");
  const o = await until((x) => x.phase === "over", 400, 1);
  ok(!!o.hit, "an empty pool ends the game");
  for (let i = 0; i < 40 && (await ev("__et.screen()")) !== "over"; i++) await wait(100);
  eq(await ev("__et.screen()"), "over", "the end screen follows the last escape");
  eq(await ev("document.querySelector('#over-score').textContent"), String(o.s.score), "it shows the final score");
  await shot("09-over");
  await press("Enter");
  eq(await ev("__et.screen()"), "setup", "Enter goes back to setup");

  /* ------------------------------------------------------ L. full-board layout */
  section("L. layout with all 12 nests showing");
  await ev("__et.start('clear', 4)");
  await ev("__et.advance(0.1)");
  for (const [w, h] of [[1440, 900], [1024, 640]]) {
    await ev(`(() => { document.querySelectorAll('.nest').forEach(n => { n.hidden = false; n.classList.remove('unlock'); }); return 1; })()`);
    await wait(100);   // measure settled boxes, not nests mid pop-in (the unlock animation scales them)
    const lay = await ev(`(() => {
      const f = document.querySelector('#field').getBoundingClientRect();
      const nests = [...document.querySelectorAll('.nest')].map(n => {
        const s = n.querySelector('.nest-art').getBoundingClientRect();
        // the egg-and-twigs part of the art (the viewBox has empty margins at the sides and top)
        const art = { left: s.left + s.width * 0.1, right: s.right - s.width * 0.1, top: s.top + s.height * 0.2, bottom: s.bottom - s.height * 0.1 };
        return { n: n.getBoundingClientRect(), r: n.querySelector('.readout').getBoundingClientRect(), art };
      });
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const inside = nests.every(x => x.n.left >= f.left - 1 && x.n.right <= f.right + 1 && x.n.top >= f.top - 1 && x.r.bottom <= f.bottom + 1);
      let overlaps = 0, covered = 0;
      for (let i = 0; i < nests.length; i++) for (let j = 0; j < nests.length; j++) {
        if (i === j) continue;
        if (j > i && hit(nests[i].r, nests[j].r)) overlaps++;
        if (hit(nests[i].r, nests[j].art)) covered++;
      }
      return { inside, overlaps, covered, w: innerWidth, h: innerHeight };
    })()`);
    ok(lay.inside, `every nest and readout stays inside the field   [${lay.w}×${lay.h}]`);
    eq(lay.overlaps, 0, `no two readouts overlap   [${lay.w}×${lay.h}]`);
    eq(lay.covered, 0, `no nest's egg or twigs cover another nest's readout   [${lay.w}×${lay.h}]`);
    if (w === 1440) {
      await ev(`(() => { document.querySelectorAll('.mess').forEach((m, i) => i % 3 === 0 && ET.mess.splatter(m, 6)); return 1; })()`);
      await shot("10-full-board");
    }
    break;   // the viewport is fixed by the driver; one size is what this rig can measure honestly
  }

  /* ------------------------------------------------------------ K. errors */
  section("K. a clean run");
  const errs = c.errors().filter((e) => !/favicon\.ico/.test(e));
  eq(errs, [], "no page errors, failed requests or 404s");
} finally {
  c.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFAILED:\n  " + fails.join("\n  "));
  process.exit(1);
}
