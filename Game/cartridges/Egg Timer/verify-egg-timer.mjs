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
const URL_GAME = "http://localhost:8898/Game/cartridges/Egg%20Timer/files/index.html?seed=42&clock=23:58&cb=" + process.pid;

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
/* Hold a key past the quick-tap window, so Tab opens the switcher and leaves it open. */
async function hold(name, mods = 0, ms = 400) {
  const [code, kc] = KEYS[name] || [name, name.toUpperCase().charCodeAt(0)];
  await c.key("rawKeyDown", name, code, kc, mods);
  await wait(ms);
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
  eq(await ev("__et.boxes().values[0]"), "", "a rejected Enter (RCAV too early) clears the Command Line");
  eq(await ev("__et.boxes().error[0]"), true, "…and a red ERROR shows under it");
  eq(await ev("getComputedStyle(document.querySelector('.box.active .err')).visibility"), "visible", "…drawn directly under the box");
  {
    const eb = await ev("document.querySelector('.box.active').getBoundingClientRect().bottom");
    const et = await ev("document.querySelector('.box.active .err').getBoundingClientRect().top");
    const vh = await ev("innerHeight");
    const errBottom = await ev("document.querySelector('.box.active .err').getBoundingClientRect().bottom");
    ok(et >= eb && errBottom <= vh, `…below the box and still on screen   [box ${eb.toFixed(0)}, ERROR ${et.toFixed(0)}–${errBottom.toFixed(0)}, window ${vh}]`);
  }
  eq((await snap()).pool, 3, "…with no pool penalty");
  eq(await ev("document.querySelector('.box.active').getBoundingClientRect().width > 0.9 * document.querySelector('#console').getBoundingClientRect().width"), true, "…and the Command Line keeps its full width (no class clash with the title screen's .error)");
  await shot("03a-error");
  await wait(1200);
  eq(await ev("__et.boxes().error[0]"), false, "the ERROR is gone after about a second");
  await c.insert("RCAV 1");
  await press("F12");
  eq(await ev("__et.boxes().values[0]"), "", "F12 clears the box, no penalty");
  await press("Enter");
  eq(await ev("__et.boxes().error[0]"), false, "⏳ E6: an Enter on an empty Command Line shows no ERROR");

  // clear the other nests on the way, or a long CAV (EOS, MB) waits out three hatches and the game ends first
  let r = { hit: null };
  for (let t = 0; t < 80 && !r.hit; t += 0.25) {
    const x = await snap();
    r.hit = x.nests.find((y) => y.id === n.id && y.state === "overtime") || null;
    if (r.hit) break;
    for (const y of x.nests.filter((z) => z.state === "overtime" && z.id !== n.id)) await ev(`__et.submit('RCAV ${y.unit}')`);
    await ev("__et.advance(0.25)");
  }
  ok(!!r.hit, "the nest reaches its trigger");
  eq(await ev(`getComputedStyle(${q(".readout")}).fontWeight`), "900", "at the trigger the readout goes bold");
  const expect = { VS: 10, STR: 10, SS: 15, EOS: 30, MB: 30 }[n.code];
  // the rig samples every 0.25 s, which is 7.5 displayed seconds at base speed, so the trigger reads N:00 to N:07
  if (expect) {
    const clk = await ev(`${q(".clock")}.textContent`);
    const [mm, ss] = clk.split(":").map(Number);
    ok(mm === expect && ss < 8, `the nest clock shows displayed time: ${n.code} goes bold at ${expect}:00   [${clk}]`);
  }
  ok(Number(await ev(`${q(".crack")}.style.strokeDashoffset`)) <= 1, "the egg starts cracking");
  await shot("03-bold");

  // the clears on the way left mess of their own: start the mess checks below from a clean board
  await ev("(() => { document.querySelectorAll('.nest .mess').forEach(m => ET.mess.clear(m)); return 1; })()");
  const before = await ev("__et.snapshot().score");
  await typeAndEnter(`RCAV ${n.unit}`);
  s = await snap();
  eq(s.nests.find((x) => x.id === n.id).state, "splat", "the same RCAV after the trigger smooshes the egg");
  ok(s.score > before, `points awarded   [+${s.score - before}]`);
  eq(await ev("__et.boxes().values[0]"), "", "an accepted command clears the box");
  ok(await ev(`${q(".splat")}.childElementCount > 0`), "a cooked-egg splat is drawn");
  eq(await ev(`${q(".pan")}.className`), "pan hit", "the frying pan slams down on the clear");
  eq(await ev(`parseFloat(getComputedStyle(${q(".pan")}).animationDuration) < 0.5`), true, "…in under half a second");
  eq(await ev(`document.querySelector('.nest[data-id="${n.id}"]').dataset.fried + '/' + ${q(".fx")}.className`), "sunny/fx sparkle", "a clear right at the bold fries a perfect sunny-side-up, with a sparkle");
  ok(await ev("__et.boxes().focused"), "the keyboard stays in the Command Line while the pan comes down");
  await wait(600);
  eq(await ev(`getComputedStyle(${q(".pan")}).opacity`), "0", "…and the pan is gone again a moment later");

  const cov = await ev(`__et.mess(${n.id})`);
  ok(cov > 0.02, `the smooshed nest gets mess   [${(cov * 100).toFixed(1)}%]`);
  const nb = { 1: [2, 5], 2: [1, 6], 5: [1, 6, 9], 6: [2, 5], 9: [5] }[n.id];
  const nbCov = await ev(`[${nb}].map(i => __et.mess(i))`);
  ok(nbCov.every((x) => x > 0), `its direct neighbours get mess too   [${nb.join(",")}]`);
  const far = [1, 2, 5, 6, 9].filter((i) => i !== n.id && !nb.includes(i));
  if (far.length) eq(await ev(`[${far}].map(i => __et.mess(i))`), far.map(() => 0), `non-neighbours stay clean   [${far.join(",")}]`);
  await shot("04-splat");

  /* ------------------------------------------------------ C2. wall clock */
  section("C2. the wall clock");
  const wallTxt = () => ev("document.querySelector('#wall-hm').textContent + '|' + document.querySelector('#wall-ss').textContent");
  const w0 = await wallTxt();
  ok(/^\d\d:\d\d\|\d\d$/.test(w0), `24-hour HH:MM with the seconds on their own   [${w0}]`);
  eq(await ev("parseFloat(getComputedStyle(document.querySelector('#wall-ss')).fontSize) < parseFloat(getComputedStyle(document.querySelector('#wall-hm')).fontSize)"), true, "the seconds are smaller than HH:MM");
  eq(await ev("getComputedStyle(document.querySelector('#wall-ss')).verticalAlign !== 'baseline'"), true, "…and raised");
  {
    const s0 = await snap();
    const wallNow = (x) => ((x.wall % 86400) + 86400) % 86400;
    const nestNow = s0.nests.find((y) => y.state === "active" || y.state === "overtime");
    await ev("__et.advance(2)");
    const s1 = await snap();
    const dWall = (wallNow(s1) - wallNow(s0) + 86400) % 86400;
    // the page's own frames keep running between the two reads, so allow a frame or two of drift
    ok(Math.abs(dWall - 60) < 2, `2 s moves the wall clock one minute, like the nest clocks   [+${dWall.toFixed(2)}]`);
    const n1 = nestNow && s1.nests.find((y) => y.id === nestNow.id);
    if (n1 && (n1.state === "active" || n1.state === "overtime")) ok(Math.abs((n1.elapsed - nestNow.elapsed) - dWall) < 0.01, "the nest clock moved exactly as far");
  }

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
  ok(await ev("!!document.querySelector('.nest.scurry .pan.late, .nest.lunge .pan.late')"), "the pan comes down late on the empty nest");
  await shot("05-escape");

  /* ------------------------------------------------------ F. command boxes */
  section("F. Command Boxes and the switcher (most-recently-used, Refinement 2 §4)");
  await ev("__et.start('clear', 3)");
  let b = await ev("__et.boxes()");
  eq([b.count, b.active, b.focused], [3, 0, true], "3 boxes, box 1 active and focused");
  await ev("document.querySelector('.box.active input').focus()");
  await c.insert("RCAV 2041");
  await hold("Tab");
  b = await ev("__et.boxes()");
  eq([b.open, b.highlighted], [true, 1], "a held Tab opens the switcher on the last-used box");
  eq(await ev("[...document.querySelectorAll('#switcher li .num')].map(e => e.textContent).join('')"), "123", "a fresh game lists the boxes in order");
  eq(await ev("document.querySelector('#switcher li .preview').textContent"), "RCAV 2041", "staged text shows as a preview");
  eq(await ev("document.querySelectorAll('#switcher li').length"), 3, "Command Lines only, no other entries");
  const t0 = (await snap()).time;
  await wait(500);
  ok((await snap()).time > t0 + 0.2, "the game keeps running while the switcher is open");
  await shot("06-switcher");
  await press("Tab"); await press("Tab", SHIFT);
  eq((await ev("__et.boxes()")).highlighted, 1, "Tab and Shift+Tab move the highlight");
  await press("ArrowDown");
  eq((await ev("__et.boxes()")).highlighted, 2, "arrows move it too");
  await c.insert("X");
  eq((await ev("__et.boxes()")).values, ["RCAV 2041", "", ""], "typing is ignored while the switcher is open");
  await press("Escape");
  b = await ev("__et.boxes()");
  eq([b.open, b.active, b.focused, (await ev("__et.paused()"))], [false, 0, true, false], "Esc closes the switcher without switching (and doesn't pause)");
  await hold("Tab"); await press("Enter");
  b = await ev("__et.boxes()");
  eq([b.open, b.active, b.focused, b.values[0]], [false, 1, true, "RCAV 2041"], "Enter switches to the highlighted box; box 1 keeps its text");
  await c.insert("CAV 2042 MB");
  await press("F12");
  eq((await ev("__et.boxes()")).values, ["RCAV 2041", "", ""], "F12 clears only the active box");

  await press("Tab");
  b = await ev("__et.boxes()");
  eq([b.open, b.active, b.focused], [false, 0, true], "a quick tap of Tab flips straight back to the last-used box");
  await press("Tab");
  eq((await ev("__et.boxes()")).active, 1, "…and again flips between the two most recent");
  await hold("Tab"); await press("ArrowDown"); await press("Enter");
  eq((await ev("__et.boxes()")).active, 2, "picking box 3 from the list");
  await hold("Tab");
  eq(await ev("[...document.querySelectorAll('#switcher li .num')].map(e => e.textContent).join('')"), "321", "the list is in most-recently-used order");
  await press("Escape");

  // A real browser keeps Ctrl+Tab before the page sees it (so a CDP key never arrives); send it in-page instead.
  const ctrlTab = `(() => {
    const opts = { key: 'Tab', code: 'Tab', ctrlKey: true, bubbles: true, cancelable: true };
    const down = new KeyboardEvent('keydown', opts);
    document.activeElement.dispatchEvent(down);
    document.activeElement.dispatchEvent(new KeyboardEvent('keyup', opts));
    return down.defaultPrevented;
  })()`;
  eq([await ev(ctrlTab), (await ev("__et.boxes()")).active], [false, 2], "in a plain browser the game leaves Ctrl+Tab alone (not even preventDefault)");
  await ev("window.fangRockShell = true");
  eq([await ev(ctrlTab), (await ev("__et.boxes()")).active], [true, 1], "inside Fang Rock, a quick Ctrl+Tab flips like Tab (⚠ the shell's flag, simulated here)");
  await ev("delete window.fangRockShell");
  // box 2 is active now, so box 1's staged text sits in an inactive box for the wave check below

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
  {
    const wp = await ev("document.querySelector('#wall-hm').textContent + ':' + document.querySelector('#wall-ss').textContent");
    await wait(400);
    eq(await ev("document.querySelector('#wall-hm').textContent + ':' + document.querySelector('#wall-ss').textContent"), wp, "the wall clock freezes on pause too");
  }
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
  eq([await ev("__et.boxes().values[0]"), await ev("__et.boxes().error[0]")], ["", true], "…the Command Line clears and shows ERROR (no more silent rejection)");
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
    eq([await ev(`getComputedStyle(${vq(" .egg")}).display`), await vis("clock"), await ev(`getComputedStyle(${vq(" .readout")}).fontWeight`)], ["inline", "visible", "900"], "at \"Clear Fueling\" (the trigger) the egg and the timer appear, bold");
    const shown = await ev(`(() => { const b = document.querySelector('.nest[data-id="${vf.id}"] .bubble'); return [!b.hidden, b.classList.contains('show'), b.textContent]; })()`);
    eq(shown, [true, true, "Clear Fueling"], "…with a \"Clear Fueling\" speech bubble");
    const vclk = await ev(`${vq(" .clock")}.textContent`);
    ok(/^\d\d:\d\d$/.test(vclk) && Number(vclk.slice(0, 2)) >= 10, `…and the clock appears already showing the time elapsed   [${vclk}]`);
    const eggVis = await ev(`Number(document.querySelector('.nest[data-id="${vf.id}"] .crack').style.strokeDashoffset) < 1`);
    ok(eggVis, "…and the egg appears already cracking");
    await shot("08b-vf-bubble");
    await wait(2000);
    eq(await ev(`getComputedStyle(document.querySelector('.nest[data-id="${vf.id}"] .bubble')).opacity`), "0", "the bubble has faded a moment later");
    eq(await ev("document.querySelectorAll('.bubble.show').length"), 1, "no other nest has a bubble (VF is the only type with a pop-up)");
  }

  /* ---------------------------------------------------------- H2. AD note */
  section("H2. the AD post-it");
  await ev("__et.start('clear', 1)");
  let kinds = new Set(), adOk = true, otherNotes = 0, sawBold = false;
  for (let i = 0; i < 600 && (kinds.size < 2 || !sawBold); i++) {
    s = await snap();
    for (const x of s.nests) {
      const txt = await ev(`(() => { const p = document.querySelector('.nest[data-id="${x.id}"] .postit'); return p.hidden ? null : p.textContent; })()`);
      if (x.state !== "active" && x.state !== "overtime") continue;
      if (x.code !== "AD") { if (txt !== null) otherNotes++; continue; }
      if (!x.note || txt === null) { adOk = false; continue; }
      if (x.note.kind === "clock") {
        if (!/^Clear @ \d\d:\d\d$/.test(txt)) adOk = false;
      } else if (txt !== x.note.minutes + " min") adOk = false;
      kinds.add(x.note.kind);
      if (x.state === "overtime" && !sawBold) {
        sawBold = (await ev(`getComputedStyle(document.querySelector('.nest[data-id="${x.id}"] .postit')).fontWeight`)) === "900";
        if (sawBold) await shot("11-ad-postit");
      }
    }
    for (const x of s.nests.filter((y) => y.state === "overtime" && !(y.code === "AD" && !sawBold))) await ev(`__et.submit('RCAV ${x.unit}')`);
    await ev("__et.advance(0.5)");
  }
  ok(adOk, "every running AD shows its note, reading \"N min\" or \"Clear @ HH:MM\"");
  eq([...kinds].sort(), ["clock", "duration"], "both kinds of note turn up");
  eq(otherNotes, 0, "no other type shows a note");
  ok(sawBold, "an AD's note goes bold with the nest");

  /* ----------------------------------------------- O. Refinement 2 extras */
  section("O. the how-to panel, the hose, sound");
  {
    const txt = await ev("document.querySelector('#howto').innerText");
    ok(await ev("!!document.querySelector('#howto') && document.querySelector('#howto').getBoundingClientRect().width > 100"), "a how-to panel sits down one side during play");
    for (const want of ["RCAV <unit>", "post-it", "Clear Fueling", "Tab", "F12", "Pause", "hose"]) ok(txt.includes(want), `…it covers "${want}"`);
    ok(!/\d+:\d\d|\b\d+\s*min/i.test(txt), "…and never lists a CAV duration");
    const overlap = await ev(`(() => {
      const h = document.querySelector('#howto').getBoundingClientRect();
      return [...document.querySelectorAll('.nest:not([hidden])')].filter(n => { const r = n.getBoundingClientRect(); return r.right > h.left && r.left < h.right && r.bottom > h.top && r.top < h.bottom; }).length;
    })()`);
    eq(overlap, 0, "…without covering a nest");
  }
  eq(await ev("parseFloat(getComputedStyle(document.querySelector('.wallclock')).fontSize) > 1.4 * parseFloat(getComputedStyle(document.querySelector('#hud-score')).fontSize)"), true, "the wall clock is larger than the rest of the HUD");
  ok((await ev("ET.audio.state()")) !== "none", `sound is unlocked by the first key press   [${await ev("ET.audio.state()")}]`);
  await ev("__et.start('clear', 1)");
  await ev("__et.advance(0.2)");
  eq(await ev("document.querySelector('#field').classList.contains('hose')"), false, "E5: mid-wave, the plain cursor until the player wipes");
  {
    const mid = await ev(`(() => {
      const field = document.querySelector('#field');
      const r = field.getBoundingClientRect();
      const fire = (type, x, y) => field.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 8, buttons: 1 }));
      fire('pointerdown', r.left + 60, r.top + 60);
      fire('pointermove', r.left + 90, r.top + 80);
      const during = [field.classList.contains('hose'), document.querySelectorAll('#popups .drop').length > 0];
      fire('pointerup', r.left + 90, r.top + 80);
      return during.concat(field.classList.contains('hose'));
    })()`);
    eq(mid, [true, true, false], "E5: mid-wave, the hose (and its water) while dragging, and back to the plain cursor after");
  }
  eq(await ev("document.querySelector('#howto').innerText.includes('PLACE')"), false, "E8: Clear CAVs Only has no placement line");
  await ev("__et.start('both', 1)");
  ok((await ev("document.querySelector('#howto').innerText")).includes("CAV <unit> <type>, e.g. CAV 2101 VS"), "E8: Both shows \"Place: CAV <unit> <type>, e.g. CAV 2101 VS\"");
  await ev("__et.start('progression', 1)");
  ok((await ev("document.querySelector('#howto').innerText")).includes("CAV <unit> <type>"), "E8: Follow Progression shows it too");
  eq([await ev("document.querySelector('#screen-setup h2:nth-of-type(2)').textContent"), await ev("document.querySelector('#switcher .title').textContent")], ["COMMAND LINES", "COMMAND LINES"], "E7: players see \"Command Line\" on the setup screen and the switcher");
  eq(await ev("ET.art.FRIED.join(',')"), "sunny,broken,burnt", "E11: only the three fried eggs remain");
  await ev("__et.start('clear', 1)");
  await ev("__et.advance(0.2)");
  {
    let cleanup = false;
    for (let t = 0; t < 400 && !cleanup; t += 0.5) {
      const x = await snap();
      if (x.phase === "cleanup") { cleanup = true; break; }
      for (const y of x.nests.filter((z) => z.state === "overtime")) await ev(`__et.submit('RCAV ${y.unit}')`);
      await ev("__et.advance(0.5)");
    }
    ok(cleanup, "play reaches the cleanup between waves");
    eq(await ev("document.querySelector('#field').classList.contains('hose') && getComputedStyle(document.querySelector('#field')).cursor.includes('url(')"), true, "during cleanup the cursor is a hose nozzle");
    const drops = await ev(`(() => {
      const field = document.querySelector('#field');
      const r = field.getBoundingClientRect();
      const fire = (type, x, y) => field.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 9, buttons: 1 }));
      fire('pointerdown', r.left + 200, r.top + 200);
      fire('pointermove', r.left + 240, r.top + 220);
      const n = document.querySelectorAll('#popups .drop').length;
      fire('pointerup', r.left + 240, r.top + 220);
      return n;
    })()`);
    ok(drops > 0, `dragging the hose sprays water   [${drops} drops]`);
    await shot("12-hose");
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
  ok(/^SKIPPED SPAWNS  W1 \d+/.test(await ev("document.querySelector('#over-skipped').textContent")), `the playtest log lists skipped spawns per wave   [${await ev("document.querySelector('#over-skipped').textContent")}]`);
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
