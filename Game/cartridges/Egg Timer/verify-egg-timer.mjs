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
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DRIVER = new URL("../../../../+Nerva Beacon/Nerva Beacon Main/tools/cdp.mjs", import.meta.url);
if (!existsSync(fileURLToPath(DRIVER))) {
  console.error("\n  Cannot find NB's cdp.mjs at:\n    " + fileURLToPath(DRIVER) + "\n");
  process.exit(2);
}
const { open } = await import(DRIVER);

const SHOTS = process.argv.slice(2).find((a) => !a.startsWith("--")) || null;
// `--write-theme-baseline` records section T's baseline instead of checking against it: run it ONLY when a colour
// (or any other style) is changed on purpose, and commit the new baseline in the same commit as that change.
const WRITE_THEME = process.argv.includes("--write-theme-baseline");
const THEME_BASELINE = new URL("./verify-egg-timer-theme-baseline.mjs", import.meta.url);
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
const ev = (s) => c.ev(s);
const snap = () => ev("__et.snapshot()");
async function shot(name) { if (SHOTS) await c.shot(`${SHOTS}\\${name}.png`); }

/* Load the page afresh. The driver spots a finished load by the first load event in its log, so the log is emptied
   first; anything it already held that the clean-run check (K) must see is carried over. */
const carried = [];
async function reload(url = URL_GAME) {
  carried.push(...c.errors());
  c.drain();
  await c.goto(url);
}
/* Wait (in real time) for a request the rig is holding back with the Fetch domain. */
async function held(pattern) {
  for (let i = 0; i < 200; i++) {
    const m = c.events().find((e) => e.method === "Fetch.requestPaused" && pattern.test(e.params.request.url));
    if (m) return m.params.requestId;
    await wait(50);
  }
  return null;
}

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
/* How-to panel everywhere (2026-09-23): on a menu screen, at every test size, the panel hangs down the right
   edge, the screen's own content sits inside the window and clear of it and of each other, and the panel's
   text fits and is never under a doodle. Leaves the window at 1440×900. */
const SIZES = [[1920, 1080], [1440, 900], [1280, 720], [1024, 640]];
async function menuFit(name, panelSel = "#howto") {
  for (const [w, h] of SIZES) {
    await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await wait(150);
    const f = await ev(`(() => {
      const screen = document.querySelector('#screen-${name}'), panel = document.querySelector('${panelSel}');
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const P = panel.getBoundingClientRect();
      const parts = [...screen.children].filter(e => e !== panel && !e.hidden && getComputedStyle(e).display !== 'none').map(e => ({ id: e.id || e.className || e.tagName, r: e.getBoundingClientRect() }));
      let overlaps = [];
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (hit(parts[i].r, parts[j].r)) overlaps.push(parts[i].id + '/' + parts[j].id);
      const words = [];
      panel.querySelectorAll('.title span, .banner, li').forEach(e => { const rg = document.createRange(); rg.selectNodeContents(e); words.push(...rg.getClientRects()); });
      return { here: panel.parentNode === screen && !screen.hidden, right: innerWidth - P.right, tall: P.height / innerHeight,
               outside: parts.filter(x => x.r.top < 0 || x.r.bottom > innerHeight || x.r.left < 0 || x.r.right > innerWidth).map(x => x.id),
               underPanel: parts.filter(x => hit(x.r, P)).map(x => x.id), overlaps,
               textInside: [...panel.querySelectorAll('.banner, li, .title')].every(e => { const r = e.getBoundingClientRect(); return r.left >= P.left + 3 && r.right <= P.right - 3; }),
               fits: Math.max(...[...panel.querySelectorAll('li')].map(l => l.getBoundingClientRect().bottom)) <= P.bottom - 4, lines: panel.querySelectorAll('li').length,
               doodled: [...panel.querySelectorAll('.doodle')].filter(d => { const r = d.getBoundingClientRect(); return words.some(x => x.width > 0 && hit(r, x)); }).length,
               bulbs: panel.querySelectorAll('.bulb').length,
               bulbOnWord: [...panel.querySelectorAll('.bulb')].filter(d => { const r = d.getBoundingClientRect(); return words.some(x => x.width > 0 && hit(r, x)); }).length };
    })()`);
    const at = `[${name}, ${w}×${h}]`;
    ok(f.here && f.right < 20 && f.tall > 0.9 && f.lines >= 4, `the ${panelSel === '#howto' ? 'how-to panel' : 'How To Play card'} shows down the right edge   ${at}`);
    ok(f.outside.length === 0 && f.underPanel.length === 0 && f.overlaps.length === 0, `…with everything else on the screen inside the window, clear of the panel and of each other   ${at} ${JSON.stringify([f.outside, f.underPanel, f.overlaps])}`);
    ok(f.fits && f.textInside && f.doodled === 0, `…its text fitting inside it, no doodle on a word   ${at}`);
    ok(f.bulbs > 16 && f.bulbOnWord === 0, `…its attract lights round the edge, none behind a word   ${at} [${f.bulbs} bulbs]`);
    if (SHOTS && w === 1024) await shot(`15-panel-${name}-${w}x${h}`);
  }
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(100);
}

/* Arcade attract lights: watch the bulb log for `seconds` and measure the worst flashing. A flash is an
   off→on→off pair; the safety limit is 3 a second for any light or group. Groups: the panel as a whole
   (its lit share swinging from ≤25% to ≥75% counts as one flash of the group). */
async function watchLights(seconds) {
  await ev("ET.lights.clearLog()");
  await wait(seconds * 1000);
  return ev(`(() => {
    const log = ET.lights.log(), per = {};
    log.forEach(e => (per[e.id] = per[e.id] || []).push(e));
    const worst = (times) => { let m = 0; for (let i = 0; i < times.length; i++) { let n = 0; for (let j = i; j < times.length && times[j] < times[i] + 1; j++) n++; m = Math.max(m, n); } return m; };
    let onsPerSec = 0, changesPerSec = 0;
    Object.values(per).forEach(es => { onsPerSec = Math.max(onsPerSec, worst(es.filter(e => e.on).map(e => e.t))); changesPerSec = Math.max(changesPerSec, worst(es.map(e => e.t))); });
    const n = ET.lights.state().bulbs; let lit = ET.lights.state().lit;
    // replay the log backwards from now to get the lit count over time
    const series = []; for (let i = log.length - 1; i >= 0; i--) { series.unshift([log[i].t, lit]); lit += log[i].on ? -1 : 1; }
    const rises = []; let low = true;
    series.forEach(([t, k]) => { if (low && k >= 0.75 * n) { rises.push(t); low = false; } else if (!low && k <= 0.25 * n) low = true; });
    return { changes: log.length, rate: log.length / ${seconds} / n, onsPerSec, changesPerSec, groupPerSec: worst(rises), bulbs: n, mode: ET.lights.state().mode };
  })()`);
}

/* Section T: every rule of the game's own stylesheets (theme.css, style.css), resolved to final values: each var()
   substituted from :root (unknown ones, set at runtime on an element, kept as a marker), then run through a probe
   element so the browser writes every value in one canonical form, shorthands split into longhands. Custom
   properties themselves are left out: only what they produce counts. Two snapshots are equal only if every
   rule gives every property the same value, so moving a colour into a variable changes nothing here. */
const STYLE_SNAPSHOT = `(() => {
  const root = getComputedStyle(document.documentElement);
  const sheets = [...document.styleSheets].filter(s => s.href && /\\/files\\/(theme|style)\\.css(\\?|$)/.test(s.href));
  const probe = document.createElement('div'); document.body.appendChild(probe);
  const SH = ['background','border','border-top','border-right','border-bottom','border-left','border-color','border-style','border-width',
    'border-radius','border-image','outline','font','margin','padding','inset','flex','flex-flow','gap','grid','grid-area','grid-template',
    'list-style','text-decoration','transition','animation','overflow','place-items','place-content','place-self','columns','mask',
    'text-emphasis','border-block','border-inline','container','offset','white-space','text-wrap','font-variant'];
  const VAR = /var\\(\\s*(--[\\w-]+)\\s*(?:,((?:[^()]|\\([^()]*\\))*))?\\)/;
  const resolve = (v) => { for (let i = 0; i < 60 && VAR.test(v); i++) v = v.replace(VAR, (m, n, fb) => root.getPropertyValue(n).trim() || (fb !== undefined ? fb.trim() : '<' + n + '>')); return v; };
  const canon = (prop, val, imp) => {
    probe.style.cssText = ''; probe.style.setProperty(prop, val);
    const out = {};
    if (!probe.style.length) out[prop] = 'RAW ' + val.replace(/\\s+/g, ' ').trim() + imp;
    for (let i = 0; i < probe.style.length; i++) out[probe.style[i]] = probe.style.getPropertyValue(probe.style[i]) + imp;
    return out;
  };
  const snap = {}, seen = {};
  const walk = (rules, prefix) => { for (const r of rules) {
    if (r.cssRules && !r.style) { walk(r.cssRules, prefix + (r.cssText.split('{')[0].trim()) + ' » '); continue; }
    if (!r.style) continue;
    const decls = {};
    for (let i = 0; i < r.style.length; i++) {
      const n = r.style[i]; if (n.startsWith('--')) continue;
      const v = r.style.getPropertyValue(n); if (v === '') continue;
      Object.assign(decls, canon(n, resolve(v), r.style.getPropertyPriority(n) ? ' !important' : ''));
    }
    for (const S of SH) { const v = r.style.getPropertyValue(S); if (v && v.includes('var(')) Object.assign(decls, canon(S, resolve(v), r.style.getPropertyPriority(S) ? ' !important' : '')); }
    if (!Object.keys(decls).length) continue;
    let key = prefix + (r.selectorText || r.keyText || r.cssText.split('{')[0].trim());
    seen[key] = (seen[key] || 0) + 1; if (seen[key] > 1) key += ' #' + seen[key];
    snap[key] = Object.fromEntries(Object.keys(decls).sort().map(k => [k, decls[k]]));
  } };
  sheets.forEach(s => walk(s.cssRules, ''));
  probe.remove();
  return snap;
})()`;

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
  eq(await ev("__et.data().units.length"), 54, "54 transport units load from the shared Data Sheet");
  eq(await ev("JSON.stringify(__et.data().blankTypes) === JSON.stringify(__et.data().types) && __et.data().blankTypes.map(t => t.code).join(',')"), "VS,STR,SS,EOS,MB,AD,VF", "D1: the Blank Dataset Module loads the seven real types, every value the same");
  eq(await ev("__et.screen()"), "title", "it opens on the title screen");
  eq(await ev("[...document.querySelectorAll('.logo .et')].map(e => e.textContent).join('')"), "ET", "the styled letters in the title spell ET");
  {
    // Refinement 4 §6: the title scene
    const t = await ev(`(() => { const sc = document.querySelector('#title-scene svg'); return sc ? { mommy: sc.querySelectorAll('.mommy').length, babies: sc.querySelectorAll('.baby').length,
      toothy: sc.querySelectorAll('.baby .teeth').length > 0, singing: getComputedStyle(sc.querySelector('.baby .mouth')).animationName, notes: sc.querySelectorAll('.note').length,
      width: sc.getBoundingClientRect().width } : null; })()`);
    ok(!!t && t.mommy === 1 && t.babies === 3 && t.notes > 0, `Refinement 4 §6: the title shows a mommy alien and her baby aliens, singing   [${t && t.babies} babies]`);
    ok(!!t && t.toothy && t.singing === "sing", "…looping, with one baby's slightly too many teeth");
  }
  await shot("01-title");
  {
    // Refinement 6 §1: the title screen's own How To Play card, in the panel's place, laid out differently
    const card = await ev(`(() => { const c = document.querySelector('#howto-title'); return { steps: [...c.querySelectorAll('li')].map(l => l.querySelector('.num').textContent + ' ' + l.querySelector('.step').textContent),
      banner: c.querySelector('.banner').textContent, panelHere: !!document.querySelector('#screen-title #howto'), shown: c.getBoundingClientRect().width > 150 }; })()`);
    eq(card.steps, ["1 The aliens are laying eggs in your CAVs.", "2 Clear each CAV the moment it's done, before the egg hatches.", "3 Clear fast, and breakfast gets fancier.", "4 Hose off the mess between waves."],
      "Refinement 6 §1: the title screen shows a How To Play card with four numbered steps");
    ok(card.shown && card.banner === "HOW TO PLAY" && !card.panelHere, "…in place of the in-game panel, which isn't on the title screen");
  }
  await menuFit("title", "#howto-title");
  {
    // Arcade attract lights (Andrew approved, 2026-09-23)
    const L = await watchLights(4);
    eq(L.mode, "attract", "the menu screens run the arcade lights in attract mode");
    ok(L.rate > 0.5, `…lively: bulbs blinking on and off at random, with a chase now and then   [${L.changes} changes in 4 s over ${L.bulbs} bulbs]`);
    ok(L.onsPerSec <= 3 && L.changesPerSec <= 6, `SAFETY: no light flashes more than 3 times a second in attract mode   [worst ${L.onsPerSec} flashes, ${L.changesPerSec} changes in any 1 s]`);
    ok(L.groupPerSec <= 3, `SAFETY: …nor the panel's lights as a group   [worst ${L.groupPerSec} in any 1 s]`);
    const tries = await ev("(() => { let n = 0; for (let i = 0; i < 40; i++) n += ET.lights.tryToggle(0) ? 1 : 0; return n; })()");
    ok(tries <= 1, `SAFETY: the guard refuses a bulb changing again inside 0.2 s   [${tries} of 40 rapid tries went through]`);
    ok((await ev("ET.CONFIG.lightsMinToggle")) >= 1 / 6, "SAFETY: the guard's minimum gap is never below 1/6 s (3 flashes a second)");
    await shot("16-lights-attract");
  }

  /* ------------------------------------------------------------ B. setup */
  section("B. setup: mode buttons and box count on one screen");
  await press("Enter");
  eq(await ev("__et.screen()"), "setup", "Enter goes to setup");
  {
    // E21 (ruled): the first key unlocks sound, and the tune plays on through the mode-selection screen
    let on = false;
    for (let i = 0; i < 20 && !on; i++) { await wait(100); on = await ev("__et.tune()"); }
    ok(on, "E21: the title tune plays on the mode-selection screen once the first key has unlocked sound");
  }
  {
    // Options creature (Andrew approved, 2026-09-23): a different picture from the title family, eyes on the cursor
    const cr = await ev(`(() => { const s = document.querySelector('#setup-critter svg'); return s ? { heads: s.querySelectorAll('.head').length, eyes: s.querySelectorAll('.pupil').length,
      singing: getComputedStyle(s.querySelector('.mouth')).animationName, beats: [...s.querySelectorAll('.mouth')].map(m => m.style.animationDuration), idle: getComputedStyle(s.querySelector('.breathe')).animationName,
      titleKin: !!s.closest('#title-scene') || s.querySelectorAll('.mommy, .baby').length > 0 } : null; })()`);
    ok(!!cr && cr.heads === 3 && !cr.titleKin, `options creature: one blob with three baby heads, not the title family   [${cr && cr.heads} heads]`);
    ok(!!cr && cr.singing === "sing" && new Set(cr.beats).size === 3 && cr.idle === "breathe", `…each head singing a little out of step with the others, with a gentle idle   [${cr && cr.beats.join(" ")}]`);
    const look = async (fx) => {
      await ev(`document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: innerWidth * ${fx}, clientY: innerHeight * 0.5 }))`);
      await wait(80);
      return ev(`[...document.querySelectorAll('#setup-critter .pupil')].map(p => { const t = p.getAttribute('transform') || ''; const m = /translate\\(([-\\d.]+) ([-\\d.]+)\\)/.exec(t); return m ? Number(m[1]) : 0; })`);
    };
    const left = await look(0.02), right = await look(0.98);
    ok(left.length === 6 && left.every((x) => x < -0.5) && right.every((x) => x > 0.5), `…and every eye follows the cursor, left and right   [${left.map((x) => x.toFixed(1)).join(",")} / ${right.map((x) => x.toFixed(1)).join(",")}]`);
    await menuFit("setup");
    ok((await ev("document.querySelector('#setup-critter').getBoundingClientRect().height")) > 80, "…and the options creature still shows");
  }
  eq(await ev("document.querySelector('[data-mode].selected').dataset.mode + '/' + document.querySelector('[data-boxes].selected').dataset.boxes"), "clear/1", "defaults: Clear CAVs Only, 1 box");
  await press("ArrowRight");
  await press("ArrowUp"); await press("ArrowUp"); await press("ArrowUp"); await press("ArrowUp");
  eq(await ev("document.querySelector('[data-mode].selected').dataset.mode + '/' + document.querySelector('[data-boxes].selected').dataset.boxes"), "progression/4", "arrows change mode, and boxes stop at 4");
  await c.key("keyDown", "2", "Digit2", 50, 0); await c.key("keyUp", "2", "Digit2", 50, 0); await wait(30);
  eq(await ev("document.querySelector('[data-boxes].selected').dataset.boxes"), "2", "a digit picks the box count");
  ok((await ev("document.querySelector('#howto').innerText")).includes("CAV <unit> <type>"), "on the options screen the panel follows the mode picked (Follow Progression adds the Place line)");
  ok(!(await ev("getComputedStyle(document.querySelector('[data-mode]')).cursor")).includes("url("), "menus and setup keep the normal pointer");
  eq(await ev("!document.querySelector('#hose') || document.querySelector('#hose').hidden || document.querySelector('#screen-play').hidden"), true, "no hose outside the game");
  await shot("02-setup");
  await press("Enter");
  eq(await ev("__et.screen() + '/' + __et.snapshot().mode + '/' + __et.boxes().count"), "play/progression/2", "Enter starts Follow Progression with 2 boxes");
  eq(await ev("__et.tune()"), false, "…and the title tune stops when the game starts");

  /* ------------------------------------------------------- C. one CAV */
  section("C. one CAV: grow, bold, clear (Clear CAVs Only)");
  await ev("__et.start('clear', 1)");
  await ev("__et.advance(0.1)");
  eq(await ev("document.querySelectorAll('.nest').length + '/' + document.querySelectorAll('.nest[hidden]').length"), "12/0", "Refinement 3 §8: all 12 nests are on screen");
  eq(await ev("[...document.querySelectorAll('.nest:not(.inactive)')].map(n => n.dataset.id).sort((a, b) => a - b).join(',')"), "0,3,5,8,11", "wave 1 activates 5 of them, spread out");
  eq(await ev("[getComputedStyle(document.querySelector('.nest.inactive .readout')).visibility, getComputedStyle(document.querySelector('.nest.inactive .ooze')).display, getComputedStyle(document.querySelector('.nest:not(.inactive) .ooze')).display]"), ["hidden", "none", "inline"], "an inactive nest is plain and blank; an active one has the alien-nest look");
  let s = await snap();
  {
    // Refinement 3 §7: the egg is laid first, on a cord from the top of the screen
    const lay = s.nests.find((x) => x.state === "laying");
    ok(!!lay, "a new CAV starts by laying its egg");
    await press("Escape");   // hold the live clock still: only __et.advance moves it through the lay
    await ev("__et.advance(0.15)");
    const cord = await ev(`ET.view.cord(${lay.id})`);
    ok(!!cord && !cord.egg && !cord.bulge && /^M[\d.]+ 0 /.test(cord.d), `…on a cord that drops, empty at first, from the top of the screen   [${cord && cord.d.slice(0, 30)}…]`);
    eq(await ev(`[document.querySelector('.nest[data-id="${lay.id}"] .clock').textContent, getComputedStyle(document.querySelector('.nest[data-id="${lay.id}"] .egg')).display]`), ["--:--", "none"], "…with no clock running and no egg in the nest yet");
    const z = await ev("[Number(getComputedStyle(document.querySelector('#cords')).zIndex), Number(getComputedStyle(document.querySelector('#field')).zIndex), Number(getComputedStyle(document.querySelector('.hud')).zIndex)]");
    ok(z[0] < z[1] && z[0] < z[2], `…drawn under the nests, the HUD and every readout   [cord ${z[0]} < ${z[1]}, ${z[2]}]`);
    const look = await ev(`(() => { const g = document.querySelectorAll('#cords .cord')[${lay.id}], cs = (s) => getComputedStyle(g.querySelector(s));
      return { w: parseFloat(cs('.cord-line').strokeWidth), red: cs('.cord-line').stroke, purple: cs('.cord-stripes').stroke, stripes: cs('.cord-stripes').strokeDasharray, ribs: cs('.cord-ribs').strokeDasharray }; })()`);
    ok(look.w >= 8 && look.red === "rgb(158, 10, 30)" && look.purple === "rgb(122, 44, 196)" && look.stripes !== "none" && look.ribs !== "none",
      `Refinement 6 §4: the cord is thick, striped blood red and purple, and ribbed   [${look.w}px, ${look.red} / ${look.purple}]`);
    await ev("__et.advance(0.5)");
    const mid = await ev(`ET.view.cord(${lay.id})`);
    ok(!!mid && mid.bulge && !mid.egg, "Refinement 4 §1: then a bulge, the egg, travels down inside the cord");
    await ev("document.querySelector('#pause').hidden = true");
    await shot("03-laying");
    await ev("document.querySelector('#pause').hidden = false");
    await ev("__et.advance(0.5)");
    const popping = await ev(`ET.view.cord(${lay.id})`);
    ok(!!popping && popping.egg && !popping.bulge && (await snap()).nests.find((x) => x.id === lay.id).state === "laying", "…and squeezes out of the tip into the nest (the pop), before the clock starts");
    await ev("__et.advance(0.3)");
    const after = (await snap()).nests.find((x) => x.id === lay.id);
    ok(after.state === "active" && after.elapsed < 30, `the egg pops off and the clock starts from 00:00   [${after.state}, ${after.elapsed.toFixed(1)} displayed s]`);
    const back = await ev(`ET.view.cord(${lay.id})`);
    ok(!!back && !back.egg, "…while the cord snakes back up, empty");
    await ev("__et.advance(0.9)");
    ok(!!(await ev(`ET.view.cord(${lay.id})`)), "…slowly: still on its way up a second later");
    await ev("__et.advance(0.7)");
    eq(await ev(`ET.view.cord(${lay.id})`), null, "…and out of view");
    await press("Escape");
    ok(await ev("__et.boxes().focused && !__et.paused()"), "the keyboard is in the Command Line after the lay");
  }
  s = await snap();
  let n = s.nests.find((x) => x.state === "active");
  ok(!!n, `a CAV is running   [${n && n.unit} ${n && n.code}]`);
  const q = (sel) => `document.querySelector('.nest[data-id="${n.id}"] ${sel}')`;
  eq(await ev(`${q(".unit")}.textContent + ' ' + ${q(".code")}.textContent`), `${n.unit} ${n.code}`, "the readout shows the unit and the literal type code");
  eq(await ev(`getComputedStyle(${q(".egg")}).display`), "inline", "the egg is showing from the start");
  const boxes = () => ev(`[".unit", ".code", ".clock"].map(s => { const cs = getComputedStyle(${q("")}.querySelector(s)); return [cs.fontWeight, cs.color, cs.backgroundColor].join(" "); })`);
  eq(await boxes(), ["400 rgb(28, 79, 216) rgb(255, 255, 255)", "400 rgb(0, 0, 0) rgb(185, 185, 198)", "400 rgb(59, 10, 92) rgb(255, 210, 58)"],
    "Refinement 5 §2: before the limit, regular type: unit blue on white, type black on grey, timer purple on yellow");

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
  eq(await boxes(), ["900 rgb(11, 93, 30) rgb(255, 255, 255)", "900 rgb(0, 0, 0) rgb(185, 185, 198)", "900 rgb(255, 255, 255) rgb(255, 45, 138)"],
    "Refinement 5 §2: at the limit, all three at once: unit bold dark green on white, type bold black on grey, timer bold white on hot pink");
  const expect = { VS: 10, STR: 10, SS: 15, EOS: 30, MB: 30 }[n.code];
  // the rig samples every 0.25 s, which is 7.5 displayed seconds at base speed, and the live page also keeps
  // stepping in real time between samples, so the trigger reads N:00 to N:09 (a flake read N:08 against "< 8")
  if (expect) {
    const clk = await ev(`${q(".clock")}.textContent`);
    const [mm, ss] = clk.split(":").map(Number);
    ok(mm === expect && ss < 10, `the nest clock shows displayed time: ${n.code} goes bold at ${expect}:00   [${clk}]`);
  }
  ok(Number(await ev(`${q(".crack")}.style.strokeDashoffset`)) <= 1, "the egg starts cracking");
  await shot("03-bold");

  // the clears on the way left mess of their own: start the mess checks below from a clean board
  await ev("(() => { document.querySelectorAll('.nest .mess, .floor-mess').forEach(m => ET.mess.clear(m)); return 1; })()");
  const before = await ev("__et.snapshot().score");
  await typeAndEnter(`RCAV ${n.unit}`);
  s = await snap();
  eq(s.nests.find((x) => x.id === n.id).state, "splat", "the same RCAV after the trigger smooshes the egg");
  ok(s.score > before, `points awarded   [+${s.score - before}]`);
  eq(await ev("__et.boxes().values[0]"), "", "an accepted command clears the box");
  eq(await ev(`${q(".pan")}.className`), "pan hit", "the frying pan slams down on the clear");
  eq(await ev(`parseFloat(getComputedStyle(${q(".pan")}).animationDuration) < 0.5`), true, "…in under half a second");
  {
    // the egg ladder (Refinement 3 rulings): a fast clear serves the next dish over the nest, with a caption
    const d = await ev(`(() => { const d = [...document.querySelectorAll('#popups .dish')].pop(); return d ? [d.dataset.rung, d.querySelector('.caption').textContent, getComputedStyle(d).pointerEvents] : null; })()`);
    const want = (await snap()).streak - 1;
    ok(!!d && Number(d[0]) === Math.min(want, 6) && d[2] === "none", `a fast clear serves the egg ladder's dish over the nest   [${d && d[1]}, streak ${want + 1}]`);
    await shot("04a-dish");
  }
  ok(await ev("__et.boxes().focused"), "the keyboard stays in the Command Line while the pan comes down");
  await wait(600);
  eq(await ev(`getComputedStyle(${q(".pan")}).opacity`), "0", "…and the pan is gone again a moment later");

  const cov = await ev(`__et.mess(${n.id})`);
  ok(cov > 0.0005, `the smashed nest gets a small splat of its own   [${(cov * 100).toFixed(1)}%]`);
  {
    // E15 (ruled): the rest of the gunk lands evenly at random over the whole board, on nests and floor alike
    const spread = await ev(`(() => ({ nests: [...Array(12).keys()].filter(i => i !== ${n.id} && __et.mess(i) > 0).length, floor: __et.floor() }))()`);
    ok(spread.floor > 0 || spread.nests > 0, `the rest lands anywhere on the board   [${spread.nests} other nests, ${(spread.floor * 100).toFixed(2)}% of the floor]`);
    // over many clears it covers the board evenly: every quarter of the board gets some
    const quarters = await ev(`(() => {
      const f = ET.view.floor(); ET.mess.clear(f);
      document.querySelectorAll('.nest .mess').forEach(m => ET.mess.clear(m));
      for (let i = 0; i < 12; i++) ET.view.fling(10);
      const b = document.querySelector('#board').getBoundingClientRect();
      const g = f.getContext('2d'), q = [0, 0, 0, 0];
      const cv = [f, ...document.querySelectorAll('.nest .mess')];
      for (const c of cv) {
        const r = c.getBoundingClientRect(), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let y = 2; y < c.height; y += 8) for (let x = 2; x < c.width; x += 8) {
          if (d[(y * c.width + x) * 4 + 3] <= 40) continue;
          const px = r.left + x / c.width * r.width, py = r.top + y / c.height * r.height;
          q[(px > b.left + b.width / 2 ? 1 : 0) + (py > b.top + b.height / 2 ? 2 : 0)]++;
        }
      }
      cv.forEach(c => ET.mess.clear(c));
      return q;
    })()`);
    ok(quarters.every((x) => x > 0), `…evenly: 120 blobs reach every quarter of the board   [${quarters.join(", ")}]`);
    const z = await ev(`(() => {
      const nest = document.querySelector('.nest[data-id="${n.id}"]');
      const zi = (e) => Number(getComputedStyle(e).zIndex) || 0;
      const board = document.querySelector('#board');
      return { mess: zi(nest.querySelector('.mess')), readout: zi(nest.querySelector('.readout')), postit: zi(nest.querySelector('.postit')),
               cords: zi(document.querySelector('#cords')), hose: zi(document.querySelector('#hose')), field: zi(document.querySelector('#field')),
               floorFirst: board.firstElementChild.classList.contains('floor-mess') && zi(board.firstElementChild) === 0 };
    })()`);
    ok(z.mess > z.readout && z.mess > z.postit, `E14 (ruled): a nest's gunk covers its readout and post-it again   [mess ${z.mess} > ${z.readout}, ${z.postit}]`);
    ok(z.cords < z.field, "…while the egg-laying cord still draws under all text");
    ok(z.floorFirst, "the floor gunk sits under every nest");
  }
  await shot("04-splat");

  /* ------------------------------------------------------ C2. wall clock */
  section("C2. the wall clock");
  const wallTxt = () => ev("document.querySelector('#wall-hm').textContent + '|' + document.querySelector('#wall-ss').textContent");
  const w0 = await wallTxt();
  ok(/^\d\d:\d\d\|\d\d$/.test(w0), `24-hour HH:MM with the seconds on their own   [${w0}]`);
  eq(await ev("parseFloat(getComputedStyle(document.querySelector('#wall-ss')).fontSize) < parseFloat(getComputedStyle(document.querySelector('#wall-hm')).fontSize)"), true, "the seconds are smaller than HH:MM");
  eq(await ev("getComputedStyle(document.querySelector('#wall-ss')).verticalAlign !== 'baseline'"), true, "…and raised");
  {
    await press("Escape");   // hold the live page still (advance still steps), so no real time slips in between reads
    const s0 = await snap();
    const wallNow = (x) => ((x.wall % 86400) + 86400) % 86400;
    const nestNow = s0.nests.find((y) => y.state === "active" || y.state === "overtime");
    await ev("__et.advance(2)");
    const s1 = await snap();
    await press("Escape");
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
  {
    const fl = await ev(`(() => {
      const fcv = document.querySelector('.floor-mess');
      ET.mess.clear(fcv);
      const g = fcv.getContext('2d'); g.fillStyle = '#ffc21a'; g.fillRect(0, 0, fcv.width, fcv.height);
      const before = __et.floor();
      const r = fcv.getBoundingClientRect(), field = document.querySelector('#field');
      const fire = (type, x, y) => field.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 6, buttons: 1 }));
      fire('pointerdown', r.left + 10, r.top + 10);
      fire('pointermove', r.right - 10, r.top + 10);
      fire('pointerup', r.right - 10, r.top + 10);
      const mid = g.getImageData(800, 14, 1, 1).data[3];
      const after = __et.floor();
      ET.mess.clear(fcv);
      return [before, after, mid];
    })()`);
    ok(fl[1] < fl[0] - 0.02, `the hose wipes the board-wide gunk too   [${(fl[0] * 100).toFixed(1)}% → ${(fl[1] * 100).toFixed(1)}%]`);
    eq(fl[2], 0, "…one pass wipes it clean, not half-way (a clear's splatter used to leave the eraser half-transparent)");
  }
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
  {
    // Refinement 5 §4: the hatchling is horrific (⏳ placeholder): many red eyes, fangs, eight legs
    const hx = await ev(`(() => { const c = document.querySelector('.nest.scurry .creature, .nest.lunge .creature'); return c ? { eyes: c.querySelectorAll('.eye').length, fangs: !!c.querySelector('.fangs'), legs: c.querySelectorAll('.legs path').length, red: getComputedStyle(c.querySelector('.eye')).fill } : null; })()`);
    ok(!!hx && hx.eyes >= 4 && hx.fangs && hx.legs >= 4 && hx.red === "rgb(255, 26, 46)", `Refinement 5 §4: the hatchling is horrific: a cluster of red eyes, fangs and jointed legs   [${hx && hx.eyes} eyes]`);
    if (SHOTS) {
      // a still of the hatchling at full size, in its nest, for a look (the flourish itself is too quick to catch)
      await ev(`(() => { const n = document.querySelector('.nest.scurry, .nest.lunge'); n.classList.remove('scurry', 'lunge'); n.style.transform = 'translate(-50%, -50%) scale(2.2)'; n.style.zIndex = 50; return 1; })()`);
      await shot("05b-hatchling");
      await ev(`(() => { const n = document.querySelector('.nest[style*="scale(2.2)"]'); n.style.transform = ''; n.style.zIndex = ''; return 1; })()`);
    }
  }

  /* ------------------------------------------------------ F. command boxes */
  section("F. Command Lines: Tab / Shift+Tab / F12, as in CAD5 (Refinement 3 §1)");
  await ev("__et.start('clear', 3)");
  let b = await ev("__et.boxes()");
  eq([b.count, b.active, b.focused], [3, 0, true], "3 lines, line 1 active and focused");
  eq(await ev("!!document.querySelector('#switcher')"), false, "the switcher pop-up is gone");
  await ev("document.querySelector('.box.active input').focus()");
  await c.insert("RCAV 2041");
  await press("Tab");
  b = await ev("__et.boxes()");
  eq([b.active, b.focused, b.values], [1, true, ["RCAV 2041", "", ""]], "Tab moves to the next line, and line 1 keeps its text");
  ok(await ev("document.querySelectorAll('.box')[1].classList.contains('switched')"), "…with one quick flash on the line switched to");
  ok(await ev("getComputedStyle(document.querySelector('.box.active')).animationName.includes('neon')"), "the active line pulses (neon)");
  ok(await ev("parseFloat(getComputedStyle(document.querySelectorAll('.box')[0]).opacity) < 1"), "the inactive lines are dimmed");
  await c.insert("CAV 2042 MB");
  await press("Tab"); await press("Tab");
  eq((await ev("__et.boxes()")).active, 0, "Tab wraps from the last line to the first");
  await press("Tab", SHIFT);
  eq((await ev("__et.boxes()")).active, 2, "Shift+Tab goes to the previous line, wrapping at the start");
  await press("Tab", SHIFT);
  b = await ev("__et.boxes()");
  eq([b.active, b.values], [1, ["RCAV 2041", "CAV 2042 MB", ""]], "…and every line keeps what was typed in it");
  await ev("document.querySelector('.box.active input').setSelectionRange(3, 3)");
  await press("ArrowLeft");
  eq([(await ev("__et.boxes()")).active, await ev("document.querySelector('.box.active input').selectionStart")], [1, 2], "Left/Right move the text cursor, not the line");
  await press("Tab", SHIFT);
  await press("F12");
  b = await ev("__et.boxes()");
  eq([b.active, b.values], [1, ["RCAV 2041", "", ""]], "⏳ E13: F12 moves to the next line and clears the line it lands on");
  await press("F12", SHIFT);
  eq((await ev("__et.boxes()")).active, 1, "Shift+F12 does nothing");
  const t0 = (await snap()).time;
  await wait(400);
  ok((await snap()).time > t0 + 0.2, "switching never pauses the game");
  // A real browser keeps Ctrl+Tab before the page sees it (so a CDP key never arrives); send it in-page instead.
  const ctrlTab = `(() => {
    const opts = { key: 'Tab', code: 'Tab', ctrlKey: true, bubbles: true, cancelable: true };
    const down = new KeyboardEvent('keydown', opts);
    document.activeElement.dispatchEvent(down);
    return down.defaultPrevented;
  })()`;
  eq([await ev(ctrlTab), (await ev("__et.boxes()")).active], [false, 1], "Ctrl+Tab is retired: the game leaves it alone");
  await ev("window.fangRockShell = true");
  eq([await ev(ctrlTab), (await ev("__et.boxes()")).active], [false, 1], "…inside Fang Rock too (the shell's flag, simulated)");
  await ev("delete window.fangRockShell");
  await shot("06-lines");
  // line 2 is active, so line 1's staged text sits in an inactive line for the wave check below

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
  await ev("document.querySelector('.box.active input').focus()");
  await c.insert("RCAV 2");
  await press("Tab");
  eq([(await ev("__et.boxes()")).active, (await ev("__et.boxes()")).values], [0, ["RCAV 2"]], "with 1 line, Tab does nothing");
  await press("F12");
  eq((await ev("__et.boxes()")).values, [""], "…and F12 just clears it");

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
  await ev("window.dispatchEvent(new Event('blur'))");
  ok(await ev("__et.paused() && !document.querySelector('#pause').hidden"), "losing window focus pauses the game (a reflex Alt+Tab)");
  await press("Escape");
  ok(await ev("!__et.paused()"), "…and Esc resumes it like any pause");

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
  eq([s.nests.find((x) => x.id === trig.id).state, s.score - sc], ["laying", 10], "the right code (with a comment) places it for 10 points, and its egg is laid");

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
    // poll rather than wait a fixed time: a busy machine can hold a CSS animation back a little
    let faded = "";
    for (let i = 0; i < 50 && faded !== "0"; i++) {
      await wait(100);
      faded = await ev(`getComputedStyle(document.querySelector('.nest[data-id="${vf.id}"] .bubble')).opacity`);
    }
    eq(faded, "0", "the bubble has faded a moment later");
    eq(await ev("document.querySelectorAll('.bubble.show').length"), 1, "no other nest has a bubble (VF is the only type with a pop-up)");
  }

  /* ---------------------------------------------------------- H2. AD note */
  section("H2. the AD post-it");
  await ev("__et.start('clear', 1)");
  let kinds = new Set(), adOk = true, otherNotes = 0, sawBold = false, looks = {};
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
      if (!looks[x.note.kind] && x.note.kind === "duration") await shot("11b-ad-minutes");
      if (!looks[x.note.kind]) looks[x.note.kind] = await ev(`(() => { const p = document.querySelector('.nest[data-id="${x.id}"] .postit'), cs = getComputedStyle(p), w = getComputedStyle(document.querySelector('.wallclock'));
        const hm = p.querySelector('.led-hm'), lbl = p.querySelector('.led-text');
        return { cls: p.className, font: cs.fontFamily, hmFont: hm && getComputedStyle(hm).fontFamily, hmText: hm && hm.textContent, lblFont: lbl && getComputedStyle(lbl).fontFamily, lblColor: lbl && getComputedStyle(lbl).color, hmColor: hm && getComputedStyle(hm).color,
                 color: cs.color, bg: cs.backgroundColor, border: cs.borderTopColor, wallFont: w.fontFamily, wallColor: w.color, wallBg: w.backgroundColor, wallBorder: w.borderTopColor }; })()`);
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
  {
    // AD note styles (Andrew approved, 2026-09-23)
    const k = looks.clock, d = looks.duration;
    ok(!!k && k.cls.includes("at-clock") && k.hmFont === k.wallFont && k.hmColor === k.wallColor && k.border === k.wallBorder,
      `the "Clear @ HH:MM" note's time mirrors the wall clock: its colour and its digital font   [${k && k.hmFont} ${k && k.hmColor}]`);
    ok(!!k && /^"?DSEG7 Classic/.test(k.wallFont) && /^\d\d:\d\d$/.test(k.hmText), `…the digits in DSEG7 (7-segment LED)   [${k && k.hmText}]`);
    // Andrew, 2026-09-23 night: the wording in a chunky rounded cream font, on a dark charcoal note
    ok(!!k && /^"?Fredoka/.test(k.lblFont || "") && k.lblColor === "rgb(255, 243, 209)" && k.bg === "rgb(43, 42, 46)",
      `…"Clear @" in chunky rounded cream (Fredoka), on dark charcoal   [${k && k.lblFont} ${k && k.lblColor} on ${k && k.bg}]`);
    ok(!!k && !!d && k.bg !== d.bg && k.font !== d.font, `…and clearly not the yellow "N min" post-it   [${k && k.bg} vs ${d && d.bg}]`);
    ok(!!d && d.cls.includes("minutes") && /Patrick Hand/.test(d.font) && d.bg === "rgb(255, 233, 92)", `the "N min" note stays a post-it, hand-lettered   [${d && d.font}]`);
    await ev(`Promise.all(['16px "Patrick Hand"', '700 16px "DSEG7 Classic"', '700 16px "Fredoka"'].map(f => document.fonts.load(f))).then(() => 1)`);
    const f = await ev(`({ ok: ['16px "Patrick Hand"', '700 16px "DSEG7 Classic"', '700 16px "Fredoka"'].every(x => document.fonts.check(x)),
                          src: performance.getEntriesByType('resource').map(e => e.name).filter(n => /PatrickHand|DSEG|Fredoka/.test(n)) })`);
    ok(f.ok && f.src.length === 3 && f.src.every((u) => u.startsWith("http://localhost:8898/")), `…in fonts bundled with the game, not fetched from the web (works offline in Fang Rock)   [${f.src.map((u) => u.split("/").slice(-2).join("/")).join(", ")}]`);
    // each bundled font's licence ships beside it (the deploy publishes licence .txt files in fonts/ folders)
    eq(await ev(`Promise.all(['OFL.txt', 'DSEG-LICENSE.txt', 'Fredoka-LICENSE.txt'].map((n) => fetch('fonts/' + n).then((r) => r.ok ? r.text() : '').then((t) => /SIL OPEN FONT LICENSE/i.test(t))))`),
      [true, true, true], "every bundled font's licence file is served beside it (Patrick Hand, DSEG, Fredoka)");
  }

  /* ----------------------------------------------- O. Refinement 2 extras */
  section("O. the how-to panel, the hose, sound");
  {
    const txt = await ev("document.querySelector('#howto').innerText");
    ok(await ev("!!document.querySelector('#howto') && document.querySelector('#howto').getBoundingClientRect().width > 100"), "a how-to panel sits down one side during play");
    const lines = await ev("[...document.querySelectorAll('#howto li')].map(l => l.textContent)");
    eq(lines, ["GOAL Clear the CAVs as soon as they're done, as quick as you can.", "SWITCH Tab / Shift+Tab: next / previous Command Line (keeps what you typed).",
      "F12 Next Command Line, cleared.", "ESC Pause.", "CLEANUP Click & drag the hose to clean up the mess."], "Refinement 3 §2: the panel's lines, in order (Refinement 5 §6: the new Cleanup line)");
    for (const gone of ["RCAV", "post-it", "Clear Fueling", "Ctrl"]) ok(!txt.includes(gone), `…with no "${gone}" line any more`);
    ok(!/\d+:\d\d|\b\d+\s*min/i.test(txt), "…and never lists a CAV duration");
    const overlap = await ev(`(() => {
      const h = document.querySelector('#howto').getBoundingClientRect();
      return [...document.querySelectorAll('.nest:not([hidden])')].filter(n => { const r = n.getBoundingClientRect(); return r.right > h.left && r.left < h.right && r.bottom > h.top && r.top < h.bottom; }).length;
    })()`);
    eq(overlap, 0, "…without covering a nest");
    // Refinement 5 §3: the cartoon look, with doodles that turn now and then
    const look = await ev(`(() => { const cs = getComputedStyle(document.querySelector('#howto')); return { bg: cs.backgroundColor, ink: getComputedStyle(document.querySelector('#howto li')).color, round: parseFloat(cs.borderTopLeftRadius) > 8, doodles: document.querySelectorAll('#howto .doodle').length }; })()`);
    ok(look.bg === "rgb(255, 243, 209)" && look.ink === "rgb(26, 13, 46)" && look.round, `Refinement 5 §3: the panel is a cartoon card, dark ink on cream, rounded   [${look.bg} / ${look.ink}]`);
    ok(look.doodles >= 4, `…with alien-family doodles around the text   [${look.doodles}]`);
    const turns = () => ev("[...document.querySelectorAll('#howto .doodle')].map(d => d.style.getPropertyValue('--turn')).join(',')");
    const t0 = await turns();
    await wait(5600);
    const t1 = await turns();
    ok(t0 !== t1, `…turning to a new angle now and then   [${t0} → ${t1}]`);
  }
  eq(await ev("parseFloat(getComputedStyle(document.querySelector('.wallclock')).fontSize) > 2 * parseFloat(getComputedStyle(document.querySelector('#hud-score')).fontSize)"), true, "the wall clock is larger again: over twice the HUD's type");
  {
    // Andrew, 2026-09-23 night: the wall clock is neon green, not Time Warp's mint, and never glows (glow is for lit bulbs)
    const w = await ev(`(() => { const cs = getComputedStyle(document.querySelector('.wallclock')), r = getComputedStyle(document.documentElement);
      return { color: cs.color, border: cs.borderTopColor, text: cs.textShadow, box: cs.boxShadow, warp: r.getPropertyValue('--warp').trim() }; })()`);
    ok(w.color === "rgb(57, 255, 20)" && w.border === w.color && w.warp.toLowerCase() === "#3dff9a", `the wall clock is neon green, not Time Warp's green   [${w.color} vs ${w.warp}]`);
    const blurs = (sh) => sh === "none" ? [] : [...sh.matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px/g)].map((m) => +m[3]).filter((b) => b > 0);
    eq([blurs(w.text), blurs(w.box)], [[], []], "…with no glow: its shadows are hard offsets, no blur");
  }
  ok((await ev("ET.audio.state()")) !== "none", `sound is unlocked by the first key press   [${await ev("ET.audio.state()")}]`);
  await ev("__et.start('clear', 1)");
  await ev("__et.advance(0.2)");
  {
    // Hose ruling (2026-09-22): in-game the cursor is always the nozzle; menus keep the normal pointer
    const cur = (sel) => ev(`getComputedStyle(document.querySelector('${sel}')).cursor`);
    ok((await cur("#field")).includes("url(") && (await cur("#howto")).includes("url(") && (await cur(".box.active input")).includes("url("), "in-game the cursor is always the hose nozzle (board, how-to panel, Command Line)");
    const hosePath = await ev(`(() => {
      const f = document.querySelector('#field').getBoundingClientRect();
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: f.left + f.width * 0.8, clientY: f.top + 120 }));
      return __et && ET.view.hose();
    })()`);
    ok(!!hosePath && /^M[\d.]+ [\d.]+ C/.test(hosePath), `the hose body runs from a spigot on the bottom edge to the nozzle, as a curve   [${(hosePath || "").slice(0, 40)}…]`);
    const lay = await ev(`(() => {
      const z = (sel) => Number(getComputedStyle(document.querySelector(sel)).zIndex) || 0;
      const f = document.querySelector('#field').getBoundingClientRect();
      const spig = document.querySelector('#hose .pipe').getBoundingClientRect();
      return { hose: z('#hose'), board: z('#field'), text: [z('.hud'), z('#howto'), z('#console')], spigotOnEdge: Math.abs(spig.bottom - f.bottom) < 2 && spig.left > f.left && spig.right < f.right,
               width: parseFloat(getComputedStyle(document.querySelector('#hose .hose-body')).strokeWidth) };
    })()`);
    ok(lay.hose > lay.board, `Refinement 4 §2: the hose draws above the whole board (nests, gunk, readouts)   [hose ${lay.hose} > board ${lay.board}]`);
    ok(lay.text.every((t) => t > lay.hose), `…and below the HUD (cleanup banner), the how-to panel and the Command Lines   [hose ${lay.hose} < ${lay.text.join(", ")}]`);
    {
      // what's actually on top where the hose crosses a readout: nothing on the board should cover it
      const hit = await ev(`(() => {
        const r = document.querySelector('.nest:not(.inactive) .readout').getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: cx - 24, clientY: cy - 24 }));
        const hose = document.querySelector('#hose');
        hose.style.pointerEvents = 'auto';
        const top = document.elementsFromPoint(cx, cy).find(e => e.closest && (e.closest('#hose') || e.closest('.readout')));
        hose.style.pointerEvents = '';
        return top ? (top.closest('#hose') ? 'hose' : 'readout') : 'none';
      })()`);
      eq(hit, "hose", "…so where the hose crosses a readout, the hose is on top");
    }
    ok(lay.spigotOnEdge, "the spigot is fixed on the board's bottom edge");
    const tag = await ev(`(() => { const t = document.querySelector('#hose-tag'), r = t.getBoundingClientRect(), p = document.querySelector('#hose .pipe').getBoundingClientRect(), f = document.querySelector('#board').getBoundingClientRect();
      return { text: t.textContent.replace(/\\s+/g, ' ').trim(), mouse: !!t.querySelector('svg.mouse'), shown: r.width > 0, nearTap: r.left - p.right < 30 && r.left >= p.right - 1 && Math.abs(r.bottom - f.bottom) < 8 }; })()`);
    ok(tag.shown && tag.text === "CLEANING HOSE: click & drag to spray" && tag.mouse, `Refinement 5 §6: the hose tap has a tag, with a mouse icon   [${tag.text}]`);
    ok(tag.nearTap, "…right by the tap on the board's bottom edge");
    ok(lay.width <= 8, `the hose is thin   [${lay.width}px]`);
    const moveOnly = await ev(`(() => {
      const f = document.querySelector('#field').getBoundingClientRect();
      document.querySelectorAll('#water .drop').forEach(d => d.remove());
      document.querySelector('#field').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: f.left + 100, clientY: f.top + 100 }));
      return document.querySelectorAll('#water .drop').length;
    })()`);
    eq(moveOnly, 0, "no water without a drag");
    const mid = await ev(`(() => {
      const field = document.querySelector('#field');
      const r = field.getBoundingClientRect();
      const fire = (type, x, y) => field.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 8, buttons: 1 }));
      fire('pointerdown', r.left + 60, r.top + 60);
      fire('pointermove', r.left + 90, r.top + 80);
      const n = document.querySelectorAll('#water .drop').length;
      fire('pointerup', r.left + 90, r.top + 80);
      return n;
    })()`);
    ok(mid > 0, `mid-wave, dragging sprays water   [${mid} drops]`);
  }
  eq(await ev("document.querySelector('#howto').innerText.includes('PLACE')"), false, "E8: Clear CAVs Only has no placement line");
  await ev("__et.start('both', 1)");
  ok((await ev("document.querySelector('#howto').innerText")).includes("CAV <unit> <type>, e.g. CAV 2101 VS"), "E8: Both shows \"Place: CAV <unit> <type>, e.g. CAV 2101 VS\"");
  await ev("__et.start('progression', 1)");
  ok((await ev("document.querySelector('#howto').innerText")).includes("CAV <unit> <type>"), "E8: Follow Progression shows it too");
  eq(await ev("document.querySelector('#screen-setup h2:nth-of-type(2)').textContent"), "COMMAND LINES", "E7: players see \"Command Line\" on the setup screen");
  eq([await ev("'FRIED' in ET.art"), await ev("ET.art.DISHES")], [false, 7], "the egg ladder replaces the fried eggs: seven dishes, no fried-egg art");
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
    await ev("__et.advance(0.3)");
    const cb = await ev(`(() => {
      const el = document.querySelector('#cleanup'), r = el.getBoundingClientRect(), f = document.querySelector('#field').getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { shown: !el.hidden, text: el.textContent, top: r.top, clearOfBoard: r.bottom <= f.top + 1, wide: r.width > 0.9 * innerWidth,
               flash: el.classList.contains('flash'), times: cs.animationIterationCount, centre: document.querySelector('#banner').hidden };
    })()`);
    ok(cb.shown && /^WAVE 1 CLEAR.*CLEAN UP \d+$/.test(cb.text), `Refinement 3 §3: a cleanup banner shows   [${cb.text}]`);
    ok(cb.top <= 1 && cb.wide && cb.clearOfBoard, "…across the top of the screen, without covering the board");
    ok(cb.flash && cb.times === "3", `…flashing a few times as cleanup starts, then holding steady   [${cb.times}]`);
    {
      // 🚨 SAFETY (Andrew, 2026-09-24): the banner flashes at most 2 times a second (it was 3.3), and a guard in view.js
      // never lets it pass 2.5 whatever cleanupFlashSeconds is tuned to
      const r0 = await ev("1 / parseFloat(getComputedStyle(document.querySelector('#cleanup')).animationDuration)");
      ok(r0 <= 2 + 1e-9, `SAFETY: the cleanup banner flashes at most 2 times a second   [${r0.toFixed(2)} a second]`);
      const tuned = await ev(`(() => {
        const keep = ET.CONFIG.cleanupFlashSeconds, el = document.querySelector('#cleanup');
        const rate = () => 1 / parseFloat(getComputedStyle(el).animationDuration);
        const flash = (s) => { ET.CONFIG.cleanupFlashSeconds = s; ET.view.handle([{ type: 'wave-end', wave: 1, perfect: false, bonus: 0, poolGained: false }], null); return rate(); };
        const fast = flash(0.1), zero = flash(0);
        el.style.removeProperty('--flash-each');
        const bare = rate();
        flash(keep);
        return { fast, zero, bare };
      })()`);
      ok(tuned.fast <= 2.5 + 1e-9 && tuned.zero <= 2.5 + 1e-9, `SAFETY: tuned past the cap (0.1 s, then 0 s a flash), the guard still holds it to 2.5 a second   [${tuned.fast.toFixed(2)}, ${tuned.zero.toFixed(2)}]`);
      ok(tuned.bare <= 2 + 1e-9, `…and the stylesheet's own fallback is 2 a second too   [${tuned.bare.toFixed(2)}]`);
    }
    ok(cb.centre, "…and nothing is left in the middle of the board");
    ok(await ev("document.querySelector('#howto').parentNode.classList.contains('playrow') && document.querySelector('#howto').getBoundingClientRect().width > 100"), "the how-to panel shows during cleanup too, in the play row");
    ok(await ev("getComputedStyle(document.querySelector('#howto-title')).display === 'none' || document.querySelector('#screen-title').hidden"), "…and the title's How To Play card is only on the title screen");
    {
      await press("Escape");                     // hold the cleanup still while the lights are watched in real time
      const L = await watchLights(4);
      await press("Escape");
      const dim = await ev("(() => { const b = document.querySelector('#howto .bulb'); return Number(getComputedStyle(b).opacity); })()");
      eq(L.mode, "calm", "in play and cleanup the lights are calm");
      ok(L.rate < 0.2 && dim <= 0.6, `…a slow, dim twinkle   [${L.changes} changes in 4 s over ${L.bulbs} bulbs, opacity ${dim}]`);
      ok(L.onsPerSec <= 1 && L.changesPerSec <= 2 && L.groupPerSec === 0, `SAFETY: calm lights never flash fast   [worst ${L.onsPerSec} flashes, ${L.changesPerSec} changes, group ${L.groupPerSec} in any 1 s]`);
    }
    await shot("12a-cleanup-banner");
    eq(await ev("getComputedStyle(document.querySelector('#field')).cursor.includes('url(')"), true, "during cleanup the cursor is the hose nozzle too");
    const drops = await ev(`(() => {
      const field = document.querySelector('#field');
      const r = field.getBoundingClientRect();
      const fire = (type, x, y) => field.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 9, buttons: 1 }));
      fire('pointerdown', r.left + 200, r.top + 200);
      fire('pointermove', r.left + 240, r.top + 220);
      const n = document.querySelectorAll('#water .drop').length;
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
  await menuFit("over");
  await press("Enter");
  eq(await ev("__et.screen()"), "setup", "Enter goes back to setup");

  /* ------------------------------------------------------ L. full-board layout */
  section("L. layout: all 12 nests beside the how-to panel, at every measured size");
  await ev("__et.start('both', 4)");
  await ev("__et.advance(0.1)");
  // measure in the real faces, not the fallback they swap from (the LED faces are wider than Courier)
  await ev(`Promise.all(['16px "Patrick Hand"', '700 16px "DSEG7 Classic"', '700 16px "Fredoka"'].map(f => document.fonts.load(f))).then(() => document.fonts.ready).then(() => 1)`);
  for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 640]]) {
    await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await ev(`(() => { document.querySelectorAll('.nest').forEach(n => n.classList.remove('inactive', 'unlock')); return 1; })()`);
    await wait(150);   // measure settled boxes, not nests mid pop-in (the unlock animation scales them)
    const lay = await ev(`(() => {
      // Refinement 4 §5: every box holds its widest reading (bold, as in overtime), and every post-it its longest
      document.querySelectorAll('.nest').forEach(n => {
        n.classList.add('bold');
        n.querySelector('.unit').textContent = '8888';
        n.querySelector('.code').textContent = 'EOS';
        n.querySelector('.clock').textContent = '88:88';
        // AD note styles: both kinds, each at its widest (every other nest), under a coat of gunk
        const p = n.querySelector('.postit'), clock = n.dataset.id % 2 === 0;
        p.hidden = false; p.textContent = ''; ET.view.fillNote(p, clock ? { kind: 'clock', at: 23 * 3600 + 58 * 60 } : { kind: 'duration', minutes: 30 });
        p.classList.toggle('at-clock', clock); p.classList.toggle('minutes', !clock);
        ET.mess.splatter(n.querySelector('.mess'), 6);
      });
      const spill = [...document.querySelectorAll('.readout > span, .postit')].filter(e => e.scrollWidth > e.clientWidth + 0.5 || e.scrollHeight > e.clientHeight + 0.5).length;
      const f = document.querySelector('#board').getBoundingClientRect();
      const postitsInside = [...document.querySelectorAll('.postit')].every(p => { const r = p.getBoundingClientRect(); return r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1; });
      const nests = [...document.querySelectorAll('.nest')].map(n => {
        const s = n.querySelector('.nest-art').getBoundingClientRect();
        // the egg-and-twigs part of the art (the viewBox has empty margins at the sides and top)
        const art = { left: s.left + s.width * 0.1, right: s.right - s.width * 0.1, top: s.top + s.height * 0.2, bottom: s.bottom - s.height * 0.1 };
        return { n: n.getBoundingClientRect(), r: n.querySelector('.readout').getBoundingClientRect(), art };
      });
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const inside = nests.every(x => x.n.left >= f.left - 1 && x.n.right <= f.right + 1 && x.n.top >= f.top - 1 && x.r.bottom <= f.bottom + 1 && x.r.left >= f.left - 1 && x.r.right <= f.right + 1);
      let overlaps = 0, covered = 0;
      for (let i = 0; i < nests.length; i++) for (let j = 0; j < nests.length; j++) {
        if (i === j) continue;
        if (j > i && hit(nests[i].r, nests[j].r)) overlaps++;
        if (hit(nests[i].r, nests[j].art)) covered++;
      }
      const howto = document.querySelector('#howto').getBoundingClientRect();
      const top = [...document.querySelectorAll('#fieldtop > *, #warp')].map(e => e.getBoundingClientRect());
      const W = document.querySelector('#warp').getBoundingClientRect(), B = document.querySelector('#board').getBoundingClientRect();
      const warpClear = nests.filter(x => hit(W, x.n) || hit(W, x.r)).length;
      const warpCentre = Math.abs((W.left + W.right) / 2 - (B.left + B.right) / 2) < 2 && Math.abs((W.top + W.bottom) / 2 - (B.top + B.bottom) / 2) < 2;
      const clearOfTop = nests.filter(x => top.some(t => hit(t, x.n))).length;
      // Refinement 5 §3: no doodle sits on a word of the panel's text (each text line's own box, not the block's)
      const words = [];
      document.querySelectorAll('#howto .title span, #howto li').forEach(e => { const rg = document.createRange(); rg.selectNodeContents(e); words.push(...rg.getClientRects()); });
      const bulbOnWord = [...document.querySelectorAll('#howto .bulb')].filter(d => { const r = d.getBoundingClientRect(); return words.some(w => w.width > 0 && hit(r, w)); }).length;
      const tag = document.querySelector('#hose-tag').getBoundingClientRect();
      const tagged = nests.filter(x => hit(tag, x.r) || hit(tag, x.art)).length;
      // …measured at the full turn both ways, not just wherever the doodles happen to be pointing
      let doodled = 0;
      const ds = [...document.querySelectorAll('#howto .doodle')], was = ds.map(d => d.style.getPropertyValue('--turn'));
      for (const sign of [1, -1]) {
        ds.forEach(d => { d.style.transition = 'none'; d.style.setProperty('--turn', sign * ET.CONFIG.doodleTurnMax + 'deg'); });
        doodled += ds.filter(d => { const r = d.getBoundingClientRect(); return words.some(w => w.width > 0 && hit(r, w)); }).length;
      }
      ds.forEach((d, i) => { d.style.setProperty('--turn', was[i]); d.style.transition = ''; });
      const clock = document.querySelector('.wallclock').getBoundingClientRect();
      const field = document.querySelector('#field').getBoundingClientRect();
      document.querySelectorAll('.nest .postit').forEach(p => { p.hidden = true; });
      return { bulbOnWord, tagged, tagIn: tag.left >= f.left && tag.right <= f.right && tag.bottom <= f.bottom + 1, doodled, spill, postitsInside, inside, overlaps, covered, besideHowto: nests.every(x => x.n.right <= howto.left + 1), clearOfTop,
               warpClear, warpCentre,
               clockCentre: Math.abs((clock.left + clock.right) / 2 - (field.left + field.right) / 2) < 3 && clock.top < field.top + 30 && clock.right <= howto.left + 1,
               howtoFits: Math.max(...[...document.querySelectorAll('#howto li')].map(l => l.getBoundingClientRect().bottom)) <= howto.bottom - 4,
               w: innerWidth, h: innerHeight };
    })()`);
    const at = `[${lay.w}×${lay.h}]`;
    if (w === 1920) {
      const dim = await ev(`(() => { const n = [...document.querySelectorAll('.nest')].find(x => x.dataset.state === 'idle'); return n ? getComputedStyle(n.querySelector('.readout .unit')).filter : null; })()`);
      ok(!!dim && /brightness\(0\.[0-4]\d*\)|brightness\(0\.45\)/.test(dim), `a blank nest's display boxes are darkened further, reading "not in play"   [${dim}]`);
    }
    eq(lay.spill, 0, `Refinement 4 §5: every box's widest reading, and both kinds of AD note (gunk-covered), fit inside their boxes   ${at}`);
    ok(lay.postitsInside, `every post-it stays on the board   ${at}`);
    ok(lay.inside, `every nest and readout stays inside the board   ${at}`);
    eq(lay.overlaps, 0, `no two readouts overlap   ${at}`);
    eq(lay.covered, 0, `no nest's egg or twigs cover another nest's readout   ${at}`);
    ok(lay.besideHowto, `every nest sits beside the how-to panel, none under it   ${at}`);
    eq(lay.clearOfTop, 0, `the wall clock and TIME WARP panel sit clear of every nest   ${at}`);
    ok(lay.clockCentre, `Refinement 6 §3: the wall clock is at the top centre of the playing field   ${at}`);
    ok(lay.warpCentre && lay.warpClear === 0, `Refinement 6 §2: the Time Warp panel sits in the centre of the board, clear of every nest and readout   ${at}`);
    ok(lay.howtoFits, `the how-to panel fits without scrolling   ${at}`);
    eq(lay.doodled, 0, `Refinement 5 §3: no doodle covers any of the panel's text   ${at}`);
    eq(lay.bulbOnWord, 0, `no attract light sits behind a word of the panel   ${at}`);
    ok(lay.tagged === 0 && lay.tagIn, `Refinement 5 §6: the hose tag stays on the board and touches no nest or readout   ${at}`);
    if (SHOTS) {
      await ev(`(() => { document.querySelectorAll('.mess').forEach((m, i) => i % 3 === 0 && ET.mess.splatter(m, 6)); return 1; })()`);
      await shot(`10-full-board-${w}x${h}`);
    }
  }
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  /* ------------------------------------------------------- P. Time Warp */
  section("P. Time Warp (Refinement 3 §4)");
  await ev("__et.start('clear', 1)");
  await ev("__et.advance(0.1)");
  eq(await ev("document.querySelector('#warp').classList.contains('lit')"), false, "the TIME WARP panel is dark at the start of a wave");
  {
    let lit = null;
    for (let t = 0; t < 300 && !lit; t += 0.25) {
      const x = await snap();
      if (x.warp) { lit = x; break; }
      for (const y of x.nests.filter((z) => z.state === "overtime")) await ev(`__et.submit('RCAV ${y.unit}')`);
      await ev("__et.advance(0.25)");
    }
    ok(!!lit && lit.spawned === lit.quota, "the clocks warp once the wave's last egg has spawned");
    eq([await ev("document.querySelector('#warp').classList.contains('lit')"), await ev("document.querySelector('#warp').textContent")], [true, "TIME WARP"], "…and the panel lights up \"TIME WARP\"");
    await ev("__et.advance(0)");
    const glow = () => ev(`(() => {
      const one = (n) => ({ border: getComputedStyle(n.querySelector('.readout .unit')).borderTopColor, art: getComputedStyle(n.querySelector('.nest-art')).filter });
      const running = (n) => n.dataset.state === 'active' || n.dataset.state === 'overtime';
      return { running: [...document.querySelectorAll('.nest')].filter(running).map(one), idleInPlay: [...document.querySelectorAll('.nest:not(.inactive)')].filter(n => !running(n)).map(one),
               inactive: [...document.querySelectorAll('.nest.inactive')].map(one), active: [...document.querySelectorAll('.nest:not(.inactive)')].map(one) };
    })()`);
    const G = "rgb(61, 255, 154)";
    const g1 = await glow();
    eq(await ev("ET.CONFIG.warpGlow"), "running", "E22 (ruled): only the nests whose clock is running glow");
    ok(g1.running.length > 0 && g1.running.every((x) => x.border === G && x.art.includes("drop-shadow")), `Refinement 5 §1: during the warp every nest with a running clock, and its boxes' borders, glows Time Warp green   [${g1.running.length} running]`);
    ok(g1.idleInPlay.every((x) => x.border !== G && x.art === "none") && g1.inactive.every((x) => x.border !== G && x.art === "none"), `…but not an empty nest in play, nor an inactive one   [${g1.idleInPlay.length} empty in play]`);
    {
      // the other reading still works as a switch (it isn't the design): every nest in play
      await ev("ET.CONFIG.warpGlow = 'unlocked'; __et.advance(0); 1");
      const gu = await glow();
      await ev("ET.CONFIG.warpGlow = 'running'; __et.advance(0); 1");
      ok(gu.active.length === 5 && gu.active.every((x) => x.border === G), "…(the \"unlocked\" switch value glows every nest in play instead)");
    }
    await shot("13-time-warp");
    {
      // Refinement 6 §2: lightning from the panel, daisy-chained to every nest whose clock is running
      const lt = await ev(`(() => { const L = ET.view.lightning(), sr = document.querySelector('#screen-play').getBoundingClientRect(), W = document.querySelector('#warp').getBoundingClientRect();
        const m = (L.d || '').slice(1).split(' ').map(Number);
        return { on: L.on, links: L.links, running: [...document.querySelectorAll('.nest')].filter(n => n.dataset.state === 'active').length,
                 fromWarp: m[0] + sr.left > W.left && m[0] + sr.left < W.right && m[1] + sr.top > W.top && m[1] + sr.top < W.bottom,
                 moves: (L.d.match(/M/g) || []).length, jagged: (L.d.match(/L/g) || []).length > L.links * 3, layer: !!document.querySelector('#cords .lightning'),
                 stroke: getComputedStyle(document.querySelector('#cords .bolt-glow')).stroke }; })()`);
      ok(lt.on && lt.links === lt.running && lt.running > 0 && lt.moves === lt.links, `Refinement 6 §2: jagged lightning reaches every nest whose clock is running, one link each   [${lt.links} links, ${lt.running} running]`);
      ok(lt.fromWarp && lt.jagged && lt.stroke === "rgb(61, 255, 154)", "…starting from the central panel, in the Time Warp green, kinked");
      ok(lt.layer && (await ev("Number(getComputedStyle(document.querySelector('#cords')).zIndex) < Number(getComputedStyle(document.querySelector('#field')).zIndex)")), "…drawn in the cord's layer, under every readout, taking no input");
      // flicker: hold the game (Esc) so the warp stays on, and watch in real time
      await press("Escape");
      const t0 = await ev("performance.now() / 1000");
      await wait(3000);
      const fl = await ev(`(() => { const log = ET.view.lightning().log.filter(t => t >= ${t0}); let m = 0;
        for (let i = 0; i < log.length; i++) { let n = 0; for (let j = i; j < log.length && log[j] < log[i] + 1; j++) n++; m = Math.max(m, n); } return { n: log.length, worst: m }; })()`);
      ok(fl.n > 0 && fl.worst <= 2.5, `SAFETY: the lightning flickers, but never more than 2.5 times a second (2 a second [T], headroom under the 3 limit)   [${fl.n} re-jags in 3 s, worst ${fl.worst} in any 1 s]`);
      // for Andrew (2026-09-23 night): the neon-green wall clock beside the lit Time Warp panel, taken while held so
      // the warp stays on; the wave banner and the pause card are kept out of this one picture only
      await ev("['#banner', '#pause'].forEach((q) => document.querySelector(q).style.visibility = 'hidden'); 1");
      await shot("13c-clock-vs-warp");
      await ev("['#banner', '#pause'].forEach((q) => document.querySelector(q).style.visibility = ''); 1");
      await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      await wait(500);
      const still0 = await ev("ET.view.lightning().d");
      await wait(1500);
      const still1 = await ev("ET.view.lightning().d");
      ok(still0 === still1 && !!still0, "SAFETY: with reduced motion the lightning holds still");
      await c.send("Emulation.setEmulatedMedia", { features: [] });
      await press("Escape");
    }
    // measured over a short step that stays inside the warp (an egg going bold part-way would end it)
    // (the live page keeps stepping in real time too, so try until a step starts and ends inside a warp)
    let w = null;
    for (let i = 0; i < 200 && w === null; i++) {
      w = await ev(`(() => { const a = __et.snapshot(); if (!a.warp) return null; __et.advance(0.05); const b = __et.snapshot(); return b.warp ? ((b.wall - a.wall + 86400) % 86400) / (b.time - a.time) : null; })()`);
      if (w === null) {
        for (const y of (await snap()).nests.filter((z) => z.state === "overtime")) await ev(`__et.submit('RCAV ${y.unit}')`);
        await ev("__et.advance(0.1)");
      }
    }
    ok(w !== null && Math.abs(w - 150) < 1, `the wall clock warps too, 5× (150 displayed s per second in wave 1)   [${w && w.toFixed(1)}]`);
    const b = await until((x) => x.nests.some((y) => y.state === "overtime"), 120, 0.1);
    eq([!!b.hit, b.s.warp, await ev("document.querySelector('#warp').classList.contains('lit')")], [true, false, false], "an egg going bold ends the warp, and the panel goes dark");
    const g2 = await glow();
    eq((await ev("ET.view.lightning()")).on, false, "Refinement 6 §2: …and the lightning is off the same instant");
    ok(g2.active.every((x) => x.border !== G && x.art === "none"), "…and the green glow is off the same instant, bold nest included");
    await shot("13b-warp-over");
  }

  /* ------------------------------------------------------- R. reduced motion */
  section("R. reduced motion (Andrew, 2026-09-24): the place-me cue, the overtime wobble, the cord twitch and the legs hold still");
  {
    // each is read first without reduced motion, so a check that can't fail can't hide here
    await ev("__et.start('both', 1)");
    await ev("__et.advance(0.1)");
    const cue = () => ev(`(() => { const s = document.querySelector('.nest[data-state="trigger"] .readout > span'); if (!s) return null; const cs = getComputedStyle(s); return { anim: cs.animationName, border: cs.borderTopColor }; })()`);
    const legs = () => ev(`(() => { const n = document.querySelector('.nest[data-id="0"]'); n.classList.add('scurry'); const a = getComputedStyle(n.querySelector('.legs')).animationName; n.classList.remove('scurry'); return a; })()`);
    // one evaluation, so the live page can't step in between: place the CAV, then read the cord's x at every point
    // and how far it spreads, over six moments of the lay
    const layCord = (t) => ev(`(() => {
      __et.submit('CAV ${t.unit} ${t.code}');
      const out = [];
      for (let i = 0; i < 6; i++) {
        __et.advance(0.1);
        const c = ET.view.cord(${t.id});
        const xs = c ? [...c.d.matchAll(/[ML]([-\\d.]+) /g)].map(m => Number(m[1])) : [];
        out.push(xs.length ? Math.max(...xs) - Math.min(...xs) : null);
      }
      return out;
    })()`);
    const tilts = (id) => ev(`(() => {
      const out = [];
      for (let i = 0; i < 6; i++) {
        __et.advance(0.02);
        const m = /rotate\\(([-\\d.]+)\\)/.exec(document.querySelector('.nest[data-id="${id}"] .egg').getAttribute('transform') || '');
        out.push(m ? Math.abs(Number(m[1])) : null);
      }
      return out;
    })()`);
    // advance until `find` matches, clearing every other bold egg on the way so nothing hatches meanwhile
    // (up to 150 s of play: an EOS or MB takes 60 s to go bold in wave 1)
    const seek = async (find, keep = -1) => {
      for (let t = 0; t < 150; t += 0.25) {
        const x = await snap();
        const hit = find(x);
        if (hit) return hit;
        for (const y of x.nests.filter((z) => z.state === "overtime" && z.id !== keep)) await ev(`__et.submit('RCAV ${y.unit}')`);
        await ev("__et.advance(0.25)");
      }
      return null;
    };
    // a trigger that isn't VF (VF lays no egg, E16), and later that same egg in overtime
    const trigger = () => seek((x) => x.nests.find((y) => y.state === "trigger" && y.code !== "VF"));
    const bold = (id) => seek((x) => x.nests.find((y) => y.id === id && y.state === "overtime"), id);
    const motion = async (label) => {
      const t = await trigger();
      const cu = await cue();
      const cord = t ? await layCord(t) : [];
      const b = t ? await bold(t.id) : null;
      const w = b ? await tilts(b.id) : [];
      if (b) await ev(`__et.submit('RCAV ${b.unit}')`);
      return { label, t: !!t, cue: cu, cord, bold: !!b, wobble: w, legs: await legs() };
    };
    const live = await motion("normal");
    ok(live.t && !!live.cue && live.cue.anim === "cue", `without reduced motion the place-me cue blinks   [${live.cue && live.cue.anim}]`);
    ok(live.cord.some((d) => d !== null && d > 0), `…the laying cord twitches   [spread ${live.cord.map((d) => d === null ? "-" : d.toFixed(1)).join(" ")} px]`);
    ok(live.bold && live.wobble.some((a) => a !== null && a > 0), `…the egg wobbles in overtime   [${live.wobble.map((a) => a === null ? "-" : a.toFixed(2)).join(" ")}°]`);
    eq(live.legs, "legs", "…and the escaping hatchling's legs flip");
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const still = await motion("reduced");
    ok(still.t && !!still.cue && still.cue.anim === "none" && still.cue.border === "rgb(34, 227, 255)", `SAFETY: with reduced motion the place-me cue stops blinking and holds a steady cyan border   [${still.cue && still.cue.anim}, ${still.cue && still.cue.border}]`);
    ok(still.cord.length === 6 && still.cord.every((d) => d === 0), `SAFETY: …the laying cord hangs straight, no twitch   [spread ${still.cord.map((d) => d === null ? "-" : d.toFixed(1)).join(" ")} px]`);
    ok(still.bold && still.wobble.length === 6 && still.wobble.every((a) => a === 0), `SAFETY: …the overtime egg doesn't wobble   [${still.wobble.map((a) => a === null ? "-" : a.toFixed(2)).join(" ")}°]`);
    eq(still.legs, "none", "SAFETY: …and the hatchling's legs don't flip");
    await c.send("Emulation.setEmulatedMedia", { features: [] });
  }

  /* ------------------------------------------------------- Q. the scary mom face */
  section("Q. the scary mom face (Refinement 5 §5)");
  await ev("__et.start('both', 4)");
  await ev("__et.advance(0.1)");
  {
    const C0 = await ev("JSON.stringify([ET.CONFIG.momFaceChance, ET.CONFIG.momFaceWindow])");
    eq(await ev("ET.CONFIG.momFaceZones"), ["top", "panel"], "E23 (ruled): both zones are kept (the top one may cover the HUD bar, the panel one some how-to text, for its 0.85 s)");
    ok((await ev("ET.CONFIG.momFaceSeconds")) < 1, `it lasts under a second   [${await ev("ET.CONFIG.momFaceSeconds")} s]`);
    await ev("window.__hiss = 0; (function (h) { ET.audio.hiss = function () { window.__hiss++; return h.apply(this, arguments); }; })(ET.audio.hiss)");
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 640]]) {
      await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await ev(`(() => { document.querySelectorAll('.nest').forEach(n => n.classList.remove('inactive', 'unlock')); return 1; })()`);
      await wait(150);
      for (const zone of ["top", "panel"]) {
        const went = await ev(`ET.view.mom('${zone}')`);
        await wait(Math.round(0.45 * 1000 * (await ev("ET.CONFIG.momFaceSeconds"))));   // mid-way: fully in
        const m = await ev(`(() => {
          const box = document.querySelector('#mom'), b = box.getBoundingClientRect(), f = box.querySelector('.face').getBoundingClientRect();
          const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
          const seen = { left: Math.max(b.left, f.left), right: Math.min(b.right, f.right), top: Math.max(b.top, f.top), bottom: Math.min(b.bottom, f.bottom) };
          const keep = [...document.querySelectorAll('.nest .nest-art, .nest .readout')].map(e => e.getBoundingClientRect()).concat([document.querySelector('#console').getBoundingClientRect()]);
          return { shown: !box.hidden, covers: keep.filter(r => hit(b, r)).length, big: seen.bottom - seen.top, pe: getComputedStyle(box).pointerEvents,
                   anim: getComputedStyle(box.querySelector('.face')).animationName, focused: __et.boxes().focused };
        })()`);
        const at = `[${zone}, ${w}×${h}]`;
        ok(went === zone && m.shown && m.big > 40, `it pops in ${zone === "top" ? "from the top edge" : "out of the side panel"}   ${at} [${Math.round(m.big)}px showing]`);
        eq(m.covers, 0, `…never over a nest, a readout or a Command Line   ${at}`);
        ok(m.pe === "none" && m.focused && /^mom-(top|bottom)$/.test(m.anim), `…takes no input (the Command Line keeps the keyboard) and slides rather than flashes   ${at}`);
        if (SHOTS && (w === 1440 || w === 1024)) await shot(`14-mom-${zone}-${w}x${h}`);
        await wait(700);
      }
    }
    await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    ok(await ev("document.querySelector('#mom').hidden"), "…and is gone again within a second");
    ok((await ev("window.__hiss")) >= 8, `each one comes with the hiss and gurgle   [${await ev("window.__hiss")} of 8]`);
    // the schedule: at most once a wave, sometimes not at all, held by a pause
    await ev("ET.CONFIG.momFaceChance = 1; ET.CONFIG.momFaceWindow = [0.5, 1]; __et.start('clear', 1); __et.advance(0.1); 1");
    await ev("__et.advance(3)");
    const once = await ev("ET.view.momState()");
    await ev("__et.advance(12)");
    const still = await ev("ET.view.momState()");
    ok(once.shown === 1 && still.shown === 1 && (await snap()).wave === 1, `at most once a wave   [${once.shown}, then ${still.shown} later in wave 1]`);
    await ev("ET.CONFIG.momFaceChance = 0; __et.start('clear', 1); __et.advance(0.1); __et.advance(20); 1");
    eq((await ev("ET.view.momState()")).shown, 0, "…and some waves get none");
    await ev(`(() => { const c0 = ${C0}; ET.CONFIG.momFaceChance = c0[0]; ET.CONFIG.momFaceWindow = c0[1]; return 1; })()`);
  }

  /* ------------------------------------------------ V. while the data loads */
  section("V. loading: nothing starts before the data is in (Andrew, 2026-09-24)");
  {
    // hold the CAV table back, so the title sits on LOADING… for as long as the rig likes
    await c.send("Fetch.enable", { patterns: [{ urlPattern: "*/datasets/cav_types.csv*", requestStage: "Request" }] });
    await reload();
    const id = await held(/\/datasets\/cav_types\.csv/);
    ok(!!id, "(the rig holds the CAV table back, so the page is still loading)");
    await press("Enter");
    await ev("document.querySelector('#screen-title').click(), 1");
    eq(await ev("[__et.screen(), __et.ready(), document.querySelector('#title-prompt').textContent]"), ["title", false, "LOADING…"],
      "Enter (or a click) on the title while the data is still loading does nothing: no way into setup without it");
    if (id) await c.send("Fetch.continueRequest", { requestId: id });
    await c.send("Fetch.disable");
    for (let i = 0; i < 100 && !(await ev("!!(window.__et && __et.ready())")); i++) await wait(50);
    eq(await ev("document.querySelector('#title-prompt').textContent"), "PRESS ENTER", "…the prompt changes once it has loaded");
    await press("Enter");
    eq(await ev("__et.screen()"), "setup", "…and then Enter goes on to setup as usual");

    // Andrew, 2026-09-24: a unit list the game can't use refuses to start, with a clear message (served here in place
    // of the real sheet, which is never touched)
    const unusable = async (body) => {
      await c.send("Fetch.enable", { patterns: [{ urlPattern: "*Units_Transports.csv*", requestStage: "Request" }] });
      await reload();
      const rid = await held(/Units_Transports\.csv/);
      if (rid) await c.send("Fetch.fulfillRequest", { requestId: rid, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/csv" }], body: Buffer.from(body).toString("base64") });
      await c.send("Fetch.disable");
      for (let i = 0; i < 100 && (await ev("!!window.__et && __et.screen()")) !== "error"; i++) await wait(50);
      await press("Enter");
      await ev("document.querySelector('#screen-title').click(), 1");
      return ev("({ screen: __et.screen(), ready: __et.ready(), prompt: document.querySelector('#title-prompt').textContent, why: document.querySelector('#title-error').hidden ? '' : document.querySelector('#title-error').textContent })");
    };
    const said = (u) => `[${u.prompt} · ${u.why}]`;
    const empty = await unusable("Units\r\n");
    ok(empty.screen === "error" && !empty.ready && empty.prompt === "CAN'T START: NO USABLE UNIT LIST" && /lists no four-digit unit numbers/.test(empty.why),
      `an empty unit list: the title says it can't start, and why, and neither Enter nor a click starts anything   ${said(empty)}`);
    ok(empty.why.includes("Game/datasets/AP_ENP_BSE/2. Units_Transports.csv") && !empty.why.includes("http://"), "…naming the sheet, with no misleading server hint");
    const noCol = await unusable("Unit Number,Station\r\n" + Array.from({ length: 12 }, (_, i) => `${2101 + i},St`).join("\r\n") + "\r\n");
    ok(noCol.screen === "error" && !noCol.ready && /no "Units" column/.test(noCol.why), `a sheet without a "Units" column: the same, naming the missing column   ${said(noCol)}`);
    await reload();   // back to the real sheet
    for (let i = 0; i < 100 && !(await ev("!!(window.__et && __et.ready())")); i++) await wait(50);
    ok(await ev("__et.ready() && __et.data().units.length === 54"), "(the real sheet loads again)");
  }

  /* ------------------------------------------------------------ K. errors */
  section("T. the theme file: the palette in its own file, the game looking exactly as before");
  {
    const links = await ev("[...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href'))");
    eq(links, ["theme.css", "style.css"], "the page reads theme.css, then style.css");
    const lit = await ev(`fetch('style.css').then(r => r.text()).then(t => {
      const bare = t.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/url\\((["'])[\\s\\S]*?\\1\\)/g, 'url()');
      return bare.match(/#[0-9a-f]{3,8}\\b|\\b(rgba?|hsla?)\\(/gi) || [];
    })`);
    eq(lit, [], "style.css holds no colour of its own: every colour comes from theme.css (the hose cursor's data-URI image aside)");
    const now = await ev(STYLE_SNAPSHOT);
    const rules = Object.keys(now).length;
    if (WRITE_THEME) {
      writeFileSync(THEME_BASELINE, "/* verify-egg-timer-theme-baseline.mjs: section T's record of every rule of the game's stylesheets, resolved\n" +
        "   to final values. Written by `node verify-egg-timer.mjs --write-theme-baseline` on " + new Date().toISOString().slice(0, 10) + ".\n" +
        "   Rewrite it ONLY when a style is changed on purpose, in the same commit. Never published (verify-*.mjs). */\n" +
        "export default " + JSON.stringify(now, null, 1) + ";\n");
      console.log(`  (wrote the theme baseline: ${rules} rules)`);
    }
    const base = existsSync(fileURLToPath(THEME_BASELINE)) ? (await import(THEME_BASELINE + "?" + Date.now())).default : null;
    const diffs = [];
    if (base) for (const k of new Set([...Object.keys(base), ...Object.keys(now)])) {
      if (!base[k]) { diffs.push(`new rule ${k}`); continue; }
      if (!now[k]) { diffs.push(`rule gone ${k}`); continue; }
      for (const p of new Set([...Object.keys(base[k]), ...Object.keys(now[k])])) if (base[k][p] !== now[k][p]) diffs.push(`${k} { ${p}: ${base[k][p]} → ${now[k][p]} }`);
    }
    ok(!!base && diffs.length === 0, `every rule resolves exactly as in the baseline: the game looks identical   [${rules} rules, ${diffs.length} differences]` + (diffs.length ? "\n        " + diffs.slice(0, 8).join("\n        ") : ""));
  }

  section("K. a clean run");
  const errs = carried.concat(c.errors()).filter((e) => !/favicon\.ico/.test(e));
  eq(errs, [], "no page errors, failed requests or 404s");
} finally {
  c.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFAILED:\n  " + fails.join("\n  "));
  process.exit(1);
}
