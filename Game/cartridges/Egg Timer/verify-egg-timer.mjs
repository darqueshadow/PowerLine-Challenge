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
let setupFont = 0;   // E27: the options screen's panel type size, compared with play's in section O
const fails = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function ok(cond, label) {
  cond ? pass++ : (fail++, fails.push(label));
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`);
  return cond;
}
const eq = (got, want, label) => ok(JSON.stringify(got) === JSON.stringify(want), `${label}   [got ${JSON.stringify(got)}]`);
const section = (s) => console.log(`\n${s}`);
/* Seconds past midnight → "HH:MM:SS". */
const hms = (s) => s === null || s === undefined ? "-" : [3600, 60, 1].map((d, i) => String(Math.floor(s / d) % (i ? 60 : 24)).padStart(2, "0")).join(":");

const KEYS = {
  Enter: ["Enter", 13], Tab: ["Tab", 9], Escape: ["Escape", 27], F12: ["F12", 123], F3: ["F3", 114],
  ArrowRight: ["ArrowRight", 39], ArrowLeft: ["ArrowLeft", 37], ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40]
};
const SHIFT = 8, CTRL = 2;

const c = await open({ gpu: true, w: 1440, h: 900 });
// the font check (O) reads the page's resource log, whose default 250 entries a full run can fill first (2026-10-01)
await c.send("Page.addScriptToEvaluateOnNewDocument", { source: "performance.setResourceTimingBufferSize(5000)" });
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
  await farWarpOff();
}
/* E39's second Time Warp trigger (2+ eggs over 8:00 from bold) would warp most scenes here early; they test other
   things, so the rig runs without it, and section P turns it on once to see the panel light for it (the logic rig
   tests the rule itself). */
const farWarpOff = () => ev("(window.ET && ET.CONFIG ? (ET.CONFIG.warpFar.eggs = Infinity) : 0, 1)");
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
      // the words themselves (text only: E29's comic strip has pictures inside its panels)
      panel.querySelectorAll('.title span, .banner, li').forEach(e => { const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n;
        while ((n = tw.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); words.push(...rg.getClientRects()); } });
      return { here: panel.parentNode === screen && !screen.hidden, right: innerWidth - P.right, tall: P.height / innerHeight,
               outside: parts.filter(x => x.r.top < 0 || x.r.bottom > innerHeight || x.r.left < 0 || x.r.right > innerWidth).map(x => x.id),
               underPanel: parts.filter(x => hit(x.r, P)).map(x => x.id), overlaps,
               textInside: [...panel.querySelectorAll('.banner, li, .title')].every(e => { const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= P.left + 3 && r.right <= P.right - 3); }),
               fits: Math.max(...[...panel.querySelectorAll('li')].map(l => l.getBoundingClientRect().bottom)) <= P.bottom - 4, lines: panel.querySelectorAll('li').length,
               doodled: [...panel.querySelectorAll('.doodle')].filter(d => { const r = d.getBoundingClientRect(); return words.some(x => x.width > 0 && hit(r, x)); }).length,
               bulbs: panel.querySelectorAll('.bulb').length,
               bulbOnWord: [...panel.querySelectorAll('.bulb')].filter(d => { const r = d.getBoundingClientRect(); return words.some(x => x.width > 0 && hit(r, x)); }).length,
               mute: (() => { const m = document.querySelector('#mute').getBoundingClientRect();
                 return { shown: m.width > 20 && m.left >= 0 && m.top >= 0, hits: parts.filter(x => hit(x.r, m)).map(x => x.id).concat(hit(P, m) ? ['the panel'] : []) }; })() };
    })()`);
    const at = `[${name}, ${w}×${h}]`;
    ok(f.here && f.right < 20 && f.tall > 0.9 && f.lines >= 2, `the ${panelSel === '#howto' ? 'how-to panel' : 'How To Play card'} shows down the right edge   ${at}`);
    ok(f.outside.length === 0 && f.underPanel.length === 0 && f.overlaps.length === 0, `…with everything else on the screen inside the window, clear of the panel and of each other   ${at} ${JSON.stringify([f.outside, f.underPanel, f.overlaps])}`);
    ok(f.fits && f.textInside && f.doodled === 0, `…its text fitting inside it, no doodle on a word   ${at}`);
    ok(f.bulbs > 16 && f.bulbOnWord === 0, `…its attract lights round the edge, none behind a word   ${at} [${f.bulbs} bulbs]`);
    ok(f.mute.shown && f.mute.hits.length === 0, `…and the mute button top left, clear of all of it   ${at} ${f.mute.hits.length ? JSON.stringify(f.mute.hits) : ""}`);
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
  await farWarpOff();

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
    // Refinement 6 §1: the title screen's own How To Play card, in the panel's place, laid out differently. E57 (ruled
    // 2026-10-02): it holds a six-step animated cartoon, Andrew's captions, the same on the options screen
    const CAPS = ["The Queen lays an egg", "The CAV runs out, the egg starts to crack", "Fast clear: pan, neat splat, big points",
      "Slow clear: messier splat, fewer points", "Hospital egg? Get the STR on, and Mom patches it up",
      "Too slow: the egg hatches, the baby dances and does its goofy hop"];   // ⚑ Chat 2026-10-03 (F): "baby" for Andrew's "crab"
    const card = await ev(`(() => { const c = document.querySelector('#howto-title'); return {
      caps: ET.howto.CAPTIONS.slice(), still: [...c.querySelectorAll('.toon-still > li')].map(l => l.querySelector('.num').textContent + ' ' + l.querySelector('.say').textContent),
      stage: c.querySelector('.toon-anim .toon-stage').getBoundingClientRect().width, mini: !!c.querySelector('.toon-anim .toon-mini'), dots: c.querySelectorAll('.toon-anim .dots li').length,
      stillShown: c.querySelector('.toon-still').getBoundingClientRect().height, oldStrip: c.querySelectorAll('.scene, .alien-pic').length,
      banner: c.querySelector('.banner').textContent, panelHere: !!document.querySelector('#screen-title #howto'), shown: c.getBoundingClientRect().width > 150 }; })()`);
    eq(card.caps, CAPS, "E57: How To Play is a six-step cartoon, with Andrew's six captions word for word");
    ok(card.stage > 150 && card.mini && card.dots === 6 && card.stillShown === 0 && card.oldStrip === 0, `…one stage (not E29's five panels), a mini Command Line and six step dots   [stage ${Math.round(card.stage)} px]`);
    eq(card.still, CAPS.map((t, i) => (i + 1) + " " + t), "…and, for reduced motion, a still strip of six numbered panels with the same captions");
    ok(card.shown && card.banner === "HOW TO PLAY" && !card.panelHere, "…in place of the in-game panel, which isn't on the title screen");
    // each step at its moment (the rig holds the cartoon's clock with ET.howto.at)
    const L = await ev("ET.CONFIG.howtoStepSeconds");
    const T0 = L.map((_, i) => L.slice(0, i).reduce((a, b) => a + b, 0));
    const look = (t) => ev(`(() => { const at = ET.howto.at(${t}); const c = document.querySelector('#howto-title .toon-anim'), n = c.querySelector('.toon'), fx = n.querySelector('.toon-fx');
      return { step: at.k + 1, say: c.querySelector('.say').textContent, dot: [...c.querySelectorAll('.dots li')].findIndex(d => d.classList.contains('on')) + 1,
        other: document.querySelector('#howto .toon-anim .say').textContent, state: n.dataset.state, bold: n.classList.contains('bold'), asks: n.classList.contains('asks'), hop: n.classList.contains('hop'),
        code: n.querySelector('.readout .code').textContent, clock: n.querySelector('.readout .clock').textContent, typed: c.querySelector('.typed').textContent,
        cord: c.querySelector('.toon-cord g').style.display !== 'none', sign: !n.querySelector('.hsign').hidden, pan: n.querySelector('.pan').classList.contains('hit'),
        brk: n.querySelector('.break').getAttribute('data-stage'), pts: [...fx.querySelectorAll('.popup')].map(p => p.textContent), dish: !!fx.querySelector('.dish'), goo: fx.querySelectorAll('.goo').length,
        mom: fx.querySelector('.mom-visit') ? 'gemini' : fx.querySelector('.toon-mom .replica .mommy') ? 'replica' : null, plaster: !!fx.querySelector('.toon-plaster.on'),
        alien: n.querySelector('.creature .alien.replica .baby') ? 'baby' : n.querySelector('.creature .alien') ? 'puppet' : null, momSway: (fx.querySelector('.toon-mom .sway') ? getComputedStyle(fx.querySelector('.toon-mom .sway')).animationName : null),
        crack: Number(n.querySelector('.crack').style.strokeDashoffset) }; })()`);
    const s1 = await look(T0[0] + 0.7), s1b = await look(T0[0] + 2.2);
    ok(s1.step === 1 && s1.say === CAPS[0] && s1.dot === 1 && s1.cord && s1.state === "laying" && s1.clock === "--:--", "E57 step 1: the cord comes down with the egg in it, no clock yet");
    ok(s1b.state === "active" && /^0\d:\d\d$/.test(s1b.clock) && s1b.code === "VS", `…then the egg is in and the VS's clock runs toward 10:00   [${s1b.clock}]`);
    const s2 = await look(T0[1] + 2.0);
    ok(s2.step === 2 && s2.say === CAPS[1] && s2.dot === 2 && s2.bold && /^10:/.test(s2.clock) && s2.crack < 1, `E57 step 2: at 10:00 the boxes go bold and the egg cracks   [${s2.clock}]`);
    const s3a = await look(T0[2] + 0.6), s3 = await look(T0[2] + 1.2);
    ok(/^RCAV/.test(s3a.typed) && s3.typed === "" && s3.state === "splat" && s3.pan && s3.brk === "1" && s3.dish && s3.pts.includes("+100"), `E57 step 3: RCAV types itself, then the pan, a neat splat (break stage 1), +100 and a dish   [${s3a.typed}]`);
    const s4 = await look(T0[3] + 1.5);
    ok(s4.say === CAPS[3] && s4.state === "splat" && s4.brk === "4" && s4.goo >= 3 && s4.pts.includes("+35"), "E57 step 4: a slow clear: a messier splat (break stage 4), gunk, +35");
    const s5a = await look(T0[4] + 1.6), s5 = await look(T0[4] + 2.6);
    ok(s5a.sign && s5a.asks && s5a.code === "" && /^CAV/.test(s5a.typed), `E57 step 5: the H sign; RCAV empties the type box (its pulse), then CAV 2101 STR types   [${s5a.typed}]`);
    ok(s5.mom === "replica" && s5.plaster && s5.momSway === "sway" && s5.code === "STR" && !s5.bold && s5.pts.includes("+75"), `…and Mom patches it: Chat (2026-10-03) the title's mommy as a replica, swaying as on the title, putting a plaster on (never the game's Gemini Mom); the box reads STR   [${s5.mom}]`);
    const s6 = await look(T0[5] + 1.0);
    ok(s6.say === CAPS[5] && s6.state === "escape" && s6.hop && s6.alien === "baby", `E57 step 6: the egg hatches and the hatchling does its goofy hop: Chat (2026-10-03) the title's two-antenna baby, not the crab (never a horror alien)   [${s6.alien}]`);
    eq([s1.other, s6.other], [CAPS[0], CAPS[5]], "E57: one clock: the options screen's copy is always on the same step");
    const t1 = await ev("(ET.howto.at(null), ET.howto.state().t)");
    await wait(700);
    const t2 = await ev("ET.howto.state()");
    ok(!t2.frozen && t2.t > t1 + 0.3 && Math.abs(t2.loop - L.reduce((a, b) => a + b, 0)) < 1e-9, `E57: it runs on its own, round and round, about ${t2.loop.toFixed(1)} s a loop   [${(t2.t - t1).toFixed(2)} s in 0.7 s]`);
    await shot("01b-howto-cartoon");
    // reduced motion: the still strip, each panel its step's key frame, nothing moving
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    await ev("ET.howto.stills()");
    const rs = await ev(`(() => { const c = document.querySelector('#howto-title'), cells = [...c.querySelectorAll('.toon-still > li')];
      const q = (i, s) => cells[i].querySelector(s);
      return { anim: c.querySelector('.toon-anim').getBoundingClientRect().height, still: c.querySelector('.toon-still').getBoundingClientRect().height,
        p1: q(0, '.toon').dataset.state, p2: q(1, '.toon').classList.contains('bold'), p3: q(2, '.break').getAttribute('data-stage'), p4: q(3, '.break').getAttribute('data-stage'),
        p5: [!q(4, '.hsign').hidden, !!q(4, '.toon-mom .replica'), q(4, '.toon-mom') ? q(4, '.toon-mom').style.transform + ' ' + getComputedStyle(q(4, '.toon-plaster')).visibility : null],
        p6: [q(5, '.toon').dataset.state, getComputedStyle(q(5, '.creature')).animationName],
        moving: [...c.querySelectorAll('.toon-still *')].filter(e => { const a = getComputedStyle(e).animationName; return a !== 'none' && !/^alien-/.test(a); }).map(e => e.getAttribute('class')).slice(0, 4) }; })()`);
    ok(rs.anim === 0 && rs.still > 200, "SAFETY: with reduced motion the cartoon gives way to the still strip");
    ok(rs.p1 === "laying" && rs.p2 && rs.p3 === "1" && rs.p4 === "4" && rs.p5[0] && rs.p5[1] && rs.p6[0] === "escape", `…each panel its step's key frame: the lay, the bold crack, the neat and messy splats, the replica Mom with the sign, the replica baby out   [${JSON.stringify([rs.p1, rs.p3, rs.p4, rs.p6[0]])}]`);
    ok(rs.p5[2] === "translateY(0px) visible" && rs.p6[1] === "none" && rs.moving.length === 0, `SAFETY: …and nothing in it moves (the alien puppets' own swings aside, held still by their own rule)   [${rs.moving.join(", ")}]`);
    await shot("01c-howto-still");
    await c.send("Emulation.setEmulatedMedia", { features: [] });
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

  /* ------------------------------------------------------------ A2. sound */
  section("A2. sound on and off (E24, Andrew 2026-09-24)");
  {
    const ET_LEVEL = await ev("ET.audio.LEVEL");
    const m = () => ev("({ pressed: document.querySelector('#mute').getAttribute('aria-pressed'), muted: ET.audio.muted(), saved: localStorage.getItem('eggtimer.muted'), level: ET.audio.level() })");
    const levelTo = async (want) => { let l = null; for (let i = 0; i < 60; i++) { l = await ev("ET.audio.level()"); if (l !== null && Math.abs(l - want) < 0.002) break; await wait(50); } return l; };
    // the loudest sample leaving the master chain over `ms` of real time
    const loudest = async (ms) => { let p = 0; for (let t = 0; t < ms; t += 25) { p = Math.max(p, await ev("ET.audio.peak()")); await wait(25); } return p; };
    const b = await ev("(() => { const e = document.querySelector('#mute'), r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cursor: getComputedStyle(e).cursor }; })()");
    ok(b.w > 20 && b.h > 20 && b.x < 40 && b.y < 40, `a mute button sits top left   [${Math.round(b.x)},${Math.round(b.y)}, ${Math.round(b.w)}×${Math.round(b.h)}]`);
    ok(!b.cursor.includes("url(") && b.cursor !== "none", "…with the normal pointer on the menus");
    const m0 = await m();
    eq([m0.pressed, m0.muted, m0.saved], ["false", false, null], "sound starts on: a fresh browser has nothing remembered");
    await press("m");   // also the first key, so sound unlocks here
    const l1 = await levelTo(0), m1 = await m();
    // E35: the title track is queued from the start now, so let the mute's fade finish before measuring silence
    for (let i = 0; i < 40 && (await ev("ET.audio.level()")) > 1e-5; i++) await wait(25);
    ok(m1.pressed === "true" && m1.muted && m1.saved === "1" && l1 !== null && l1 < 0.002, `M mutes: the button shows it, the browser remembers it, and the master level goes to 0   [${l1}]`);
    await ev("ET.audio.thong(); ET.audio.buzz(); ET.audio.hiss(ET.CONFIG.momFaceSeconds, ET.CONFIG.momFaceVolume); 1");
    const quiet = await loudest(700);
    ok(quiet < 1e-4 && (await ev("__et.tune()")), `muted, nothing leaves the speakers: not the title tune, nor a pan, buzz and hiss played together   [peak ${quiet.toExponential(1)}]`);
    await press("M");   // Shift or Caps Lock: the same key
    const l2 = await levelTo(ET_LEVEL), m2 = await m();
    await ev("ET.audio.thong(); 1");
    const loud = await loudest(700);
    ok(!m2.muted && m2.pressed === "false" && m2.saved === "0" && Math.abs(l2 - ET_LEVEL) < 0.002 && loud > 0.01, `M again brings it back   [level ${l2 && l2.toFixed(2)}, peak ${loud.toFixed(3)}]`);
    {
      // a held M mutes once: the keyboard's auto-repeats don't flip it on and off (review fix, 2026-09-24)
      await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "m", code: "KeyM", windowsVirtualKeyCode: 77 });
      const flips = [];
      for (let i = 0; i < 7; i++) {
        await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "m", code: "KeyM", windowsVirtualKeyCode: 77, autoRepeat: true });
        flips.push(await ev("ET.audio.muted()"));
      }
      await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "m", code: "KeyM", windowsVirtualKeyCode: 77 });
      const held = await m();
      ok(flips.every((x) => x === true) && held.muted && held.saved === "1", `holding M down mutes once; its auto-repeats change nothing   [${flips.join(",")}]`);
      eq(await ev("document.querySelector('#mute').title"), "Sound off (M)", "…and the button's tooltip names the key");
      await press("m");
      eq(await ev("[ET.audio.muted(), document.querySelector('#mute').title]"), [false, "Sound on (M)"], "…and M, pressed again, brings it back");
    }
    // a real mouse click on the button, as a player would
    const click = async () => {
      const r = await ev("(() => { const q = document.querySelector('#mute').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()");
      for (const type of ["mousePressed", "mouseReleased"]) await c.send("Input.dispatchMouseEvent", { type, x: r[0], y: r[1], button: "left", clickCount: 1 });
      await wait(30);
    };
    await click();
    const m3 = await m();
    await click();
    const m4 = await m();
    ok(m3.muted && m3.saved === "1" && !m4.muted && m4.saved === "0", "a click on the button mutes, and a second click brings it back");
    ok((await ev("__et.screen()")) === "title" && (await ev("document.activeElement !== document.querySelector('#mute')")), "…without leaving the title screen or taking the keyboard");
    // a background tab (the page's visibility, simulated): every sound is held, the music where it is (music ruling,
    // 2026-09-25: it pauses rather than stopping)
    await ev("Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1");
    let st = ""; for (let i = 0; i < 40 && st !== "suspended"; i++) { await wait(50); st = await ev("ET.audio.state()"); }
    const at0 = (await ev("ET.audio.musicState()")).at;
    await wait(600);
    const at1 = (await ev("ET.audio.musicState()")).at;
    ok(st === "suspended" && at0 !== null && at0 === at1, `in a background tab every sound is held, and the title music pauses where it is   [sound ${st}, at ${at0 && at0.toFixed(2)} → ${at1 && at1.toFixed(2)} s]`);
    await ev("delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); 1");
    let back = false; for (let i = 0; i < 60 && !back; i++) { await wait(50); back = (await ev("ET.audio.state()")) === "running" && (await ev("ET.audio.musicState()")).at > at1; }
    ok(back, "…and carries on from there when the tab comes back");
    // the master chain's ceiling, measured on a context of the rig's own (rendered offline, so it's exact)
    const clip = await ev(`(async () => {
      const sr = 44100, peak = (b) => { const d = b.getChannelData(0); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; };
      const render = (voices, through) => { const a = new OfflineAudioContext(1, sr * 0.25, sr), into = through ? ET.audio.chain(a).input : a.destination;
        voices.forEach(([type, f, g]) => { const o = a.createOscillator(), v = a.createGain(); o.type = type; o.frequency.value = f; v.gain.value = g; o.connect(v).connect(into); o.start(0); });
        return a.startRendering().then(peak); };
      const pile = Array.from({ length: 12 }, (_, i) => ['square', 110 * (1 + i * 0.07), 0.35]);   // twelve pan-loud sounds at once
      return { raw: await render(pile, false), capped: await render(pile, true), one: await render([['sine', 440, 0.3]], true) };
    })()`);
    const CEIL = await ev("ET.audio.CEILING");
    ok(clip.raw > 1, `twelve loud sounds at once would clip on their own   [peak ${clip.raw.toFixed(2)}]`);
    ok(CEIL < 1 && clip.capped <= CEIL + 1e-6, `…through the master chain they never pass its ceiling, so nothing clips   [peak ${clip.capped.toFixed(3)}, ceiling ${CEIL}]`);
    ok(Math.abs(clip.one - 0.3 * ET_LEVEL) < 0.005, `…while one ordinary sound passes untouched but for the master level   [${clip.one.toFixed(3)} for 0.3 × ${ET_LEVEL}]`);
    // every sound goes through that chain: only audio.js makes sound, and it reaches the speakers in one place
    const src = await ev(`Promise.all([...document.scripts].filter(s => s.src).map(s => fetch(s.src).then(r => r.text()).then(t => [s.src.split('/').pop(), (t.match(/\\.destination\\b/g) || []).length, /create(Oscillator|BufferSource)/.test(t)])))`);
    eq([src.filter((x) => x[1] > 0).map((x) => x[0] + ":" + x[1]), src.filter((x) => x[2]).map((x) => x[0])], [["audio.js:1"], ["audio.js"]],
      "every sound goes through the master chain: only audio.js makes sound, and only the chain reaches the speakers");
  }

  /* ------------------------------------------------------------ B. setup */
  section("B. setup: the Command Line count and START (E54: one mode, no mode buttons)");
  await press("Enter");
  eq(await ev("__et.screen()"), "setup", "Enter goes to setup");
  {
    // E21 (ruled): the first key unlocks sound, and the tune plays on through the options screen
    let on = false;
    for (let i = 0; i < 20 && !on; i++) { await wait(100); on = await ev("__et.tune()"); }
    ok(on, "E21: the title tune plays on the options screen once the first key has unlocked sound");
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
  {
    // E27 (ruled 2026-09-24): bigger instructions on the options screen, under three HOW / TO / PLAY signs
    setupFont = await ev("parseFloat(getComputedStyle(document.querySelector('#howto')).fontSize)");
    const words = await ev("[...document.querySelectorAll('#screen-setup #howto .sign')].map(e => e.textContent)");
    eq(words, ["HOW", "TO", "PLAY"], "E27: the options screen's panel has three signs, HOW / TO / PLAY");
    // watch them in real time: one word at a time, then all three, then round again
    const t0 = await ev("performance.now() / 1000");
    await wait(6000);
    const S = await ev(`(() => { const log = ET.lights.signLog().filter(e => e.t >= ${t0}); let m = 0;
      for (let i = 0; i < log.length; i++) { let n = 0; for (let j = i; j < log.length && log[j].t < log[i].t + 1; j++) n++; m = Math.max(m, n); }
      return { seq: log.map(e => e.lit.join('')), worst: m, gaps: log.slice(1).map((e, i) => e.t - log[i].t) }; })()`);
    const seq = S.seq.join(" ");
    ok(/0 1 2 012/.test(seq) && S.seq.length >= 6, `…they light one word at a time, then all three together, and repeat   [${seq}]`);
    ok(S.worst <= 2 && S.gaps.every((g) => g >= 0.5 - 0.02), `SAFETY: the signs never change more than 2 times a second   [worst ${S.worst} in any 1 s, shortest gap ${Math.min(...S.gaps).toFixed(2)} s]`);
    const tries = await ev("(() => { let n = 0; for (let i = 0; i < 20; i++) n += ET.lights.trySign() ? 1 : 0; return n; })()");
    ok(tries <= 1, `SAFETY: the signs' guard refuses a change inside 0.5 s, like the lights'   [${tries} of 20 rapid tries went through]`);
    await shot("02b-setup-signs");
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await wait(300);
    const n0 = await ev("ET.lights.signLog().length");
    await wait(1500);
    const still = await ev("({ lit: ET.lights.signsLit(), n: ET.lights.signLog().length })");
    ok(still.lit.every(Boolean) && still.lit.length === 3 && still.n === n0, `SAFETY: with reduced motion all three signs stay lit, and nothing changes   [${JSON.stringify(still.lit)}, ${still.n - n0} changes]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
  }
  eq(await ev("[document.querySelectorAll('[data-mode]').length, [...document.querySelectorAll('#screen-setup h2')].map(h => h.textContent), document.querySelector('[data-boxes].selected').dataset.boxes]"),
    [0, ["How Many Command Lines?"], "2"], "E54: no mode buttons, only \"How Many Command Lines?\"; (E28) 2 lines by default");
  eq(await ev("document.querySelector('#screen-setup .hint').textContent.replace(/\\s+/g, ' ').trim()"), "↑ ↓ LINES · ENTER START", "…and the hint names only the keys that do something here");
  await press("ArrowRight");
  await press("ArrowUp"); await press("ArrowUp"); await press("ArrowUp"); await press("ArrowUp");
  eq(await ev("document.querySelector('[data-boxes].selected').dataset.boxes"), "4", "← → do nothing now; ↑ ↓ change the lines, and they stop at 4");
  await c.key("keyDown", "2", "Digit2", 50, 0); await c.key("keyUp", "2", "Digit2", 50, 0); await wait(30);
  eq(await ev("document.querySelector('[data-boxes].selected').dataset.boxes"), "2", "a digit picks the box count");
  {
    // E29 (ruled 2026-09-24): "How Many Command Lines?", One to Four, each in its line's colour; the one picked lit, the rest dimmed
    const pk = await ev(`(() => { const bs = [...document.querySelectorAll('[data-boxes]')];
      return { head: [...document.querySelectorAll('#screen-setup h2')].map(h => h.textContent).find(t => /Command/.test(t)), words: bs.map(b => b.textContent),
               borders: bs.map(b => getComputedStyle(b).borderTopColor), lines: ET.boxes.COLORS,
               lit: bs.map(b => [b.classList.contains('selected'), getComputedStyle(b).opacity, getComputedStyle(b).backgroundColor]), anim: bs.map(b => getComputedStyle(b).animationName) }; })()`);
    const hex = (c) => "#" + c.match(/\d+/g).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
    eq([pk.head, pk.words], ["How Many Command Lines?", ["One", "Two", "Three", "Four"]], "E29: the picker asks \"How Many Command Lines?\", One to Four");
    const unpicked = pk.lit.filter((l) => !l[0]), picked = pk.lit.find((l) => l[0]);
    ok(pk.lit.every((l, i) => !l[0] || hex(l[2]) === pk.lines[i]) && pk.borders.every((b, i) => pk.lit[i][0] || hex(b) === pk.lines[i]),
      `…each option in its Command Line's in-game colour   [${pk.borders.map(hex).join(" ")}]`);
    ok(!!picked && picked[1] === "1" && unpicked.length === 3 && unpicked.every((l) => Number(l[1]) < 0.6) && pk.anim.every((a) => a === "none"),
      `…the one picked lit, the rest dimmed, nothing flashing   [${pk.lit.map((l) => l[1]).join(" ")}]`);
    await ev("document.querySelector('[data-boxes=\"3\"]').click(); 1");
    eq(await ev("document.querySelector('[data-boxes].selected').dataset.boxes"), "3", "…and the mouse picks too");
    await ev("document.querySelector('[data-boxes=\"2\"]').click(); 1");
  }
  {
    const st = await ev(`(() => { const p = document.querySelector('#howto');
      const strip = p.querySelector('.cartoon .toon-anim').getBoundingClientRect(), signs = p.querySelector('.signs').getBoundingClientRect();
      return { same: p.querySelector('.toon-anim .say').textContent === ET.howto.CAPTIONS[ET.howto.state().step - 1],
        shown: strip.height > 100, under: strip.top >= signs.bottom, lines: [...p.querySelectorAll('ul li')].filter(l => l.getBoundingClientRect().height > 0).length }; })()`);
    ok(st.same && st.shown && st.under && st.lines === 0, "E57: the options screen's panel shows the same cartoon, on the shared clock's step, under the HOW / TO / PLAY signs, in place of its lines");
  }
  ok(!/url\(|none/.test(await ev("getComputedStyle(document.querySelector('[data-boxes]')).cursor")) && (await ev("document.querySelector('#nozzle').hidden")), "menus and setup keep the normal pointer (and no drawn nozzle)");
  eq(await ev("!document.querySelector('#hose') || document.querySelector('#hose').hidden || document.querySelector('#screen-play').hidden"), true, "no hose outside the game");
  await shot("02-setup");
  await press("Enter");
  eq(await ev("__et.screen() + '/' + ('mode' in __et.snapshot()) + '/' + __et.boxes().count + '/' + !!document.querySelector('#hud-mode')"), "play/false/2/false", "Enter starts the one game with 2 lines, and the HUD has no mode label");
  eq(await ev("__et.tune()"), false, "…and the title tune stops when the game starts");

  /* ------------------------------------------------------- C. one CAV */
  section("C. one CAV: grow, bold, clear (a refusal egg)");
  // start, step and pause in one go, so the lay below starts at a known point: paused by a separate key press, the live
  // page could run on a little first on a busy machine, and the pop then fell between the fixed steps (steadied 2026-10-01)
  await ev("__et.start(1, { hospital: 0 }); __et.advance(0.1); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); __et.paused()");
  eq(await ev("document.querySelectorAll('.nest').length + '/' + document.querySelectorAll('.nest[hidden]').length"), "12/0", "Refinement 3 §8: all 12 nests are on screen");
  eq(await ev("[...document.querySelectorAll('.nest:not(.inactive)')].map(n => n.dataset.id).sort((a, b) => a - b).join(',')"), "0,3,5,8,11", "wave 1 activates 5 of them, spread out");
  eq(await ev("[getComputedStyle(document.querySelector('.nest.inactive .readout')).visibility, getComputedStyle(document.querySelector('.nest.inactive .ooze')).display, getComputedStyle(document.querySelector('.nest:not(.inactive) .ooze')).display]"), ["hidden", "none", "inline"], "an inactive nest is plain and blank; an active one has the alien-nest look");
  let s = await snap();
  {
    // Refinement 3 §7: the egg is laid first, on a cord from the top of the screen
    const lay = s.nests.find((x) => x.state === "laying");
    ok(!!lay, "a new CAV starts by laying its egg");
    ok(await ev("__et.paused()"), "(held still since the start: only __et.advance moves it through the lay)");
    await ev("__et.advance(0.15)");
    const cord = await ev(`ET.view.cord(${lay.id})`);
    ok(!!cord && !cord.egg && !cord.bulge && /^M[\d.]+ 0 /.test(cord.d), `…on a cord that drops, empty at first, from the top of the screen   [${cord && cord.d.slice(0, 30)}…]`);
    eq(await ev(`[document.querySelector('.nest[data-id="${lay.id}"] .clock').textContent, getComputedStyle(document.querySelector('.nest[data-id="${lay.id}"] .egg')).display]`), ["--:--", "none"], "…with no clock running and no egg in the nest yet");
    // Andrew, 2026-10-01: the cord draws on top of everything else in the game; only the pause panel and the drawn nozzle are above it
    const z = await ev(`(() => { const zi = (q) => { const e = document.querySelector(q); return e ? Number(getComputedStyle(e).zIndex) || 0 : 'missing ' + q; };
      return { cord: zi('#cord-top'), under: ['#field', '.hud', '#console', '#hose', '#popups', '#banner'].map(zi), pause: zi('#pause'), nozzle: zi('#nozzle'), inCords: !!document.querySelector('#cords .cord') }; })()`);
    ok(z.under.every((u) => z.cord > u) && z.cord < z.pause && z.cord < z.nozzle && !z.inCords,
      `…drawn on top of everything else (the board, nests, readouts, hose, HUD, Command Lines), under only the pause panel and the nozzle   [cord ${z.cord} > ${z.under.join(", ")}; < ${z.pause}, ${z.nozzle}]`);
    const look = await ev(`(() => { const g = document.querySelectorAll('#cord-top .cord')[${lay.id}], cs = (s) => getComputedStyle(g.querySelector(s));
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
    const eggOut = await ev(`(() => { const n = document.querySelector('.nest[data-id="${lay.id}"]'); return n.classList.contains('popping') && getComputedStyle(n.querySelector('.egg')).display !== 'none'; })()`);
    ok(!!popping && eggOut && !popping.egg && !popping.bulge && (await snap()).nests.find((x) => x.id === lay.id).state === "laying", "…and squeezes out of the tip into the nest (the pop), before the clock starts: the nest's own egg, not an oval of the cord's (Chat's answers, 2026-09-25)");
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
  eq(await ev("__et.boxes().error[0]"), true, "…and the line's border turns red");
  eq(await ev("[__et.boxes().say.text, __et.boxes().say.shown]"), ["Too Early!", true], "Andrew, 2026-10-01: an RCAV before the CAV's real duration says \"Too Early!\"");
  {
    // Chat's playtest rulings (2026-10-02): the words sit just above Time Warp's clock, on a solid dark plate with a light
    // outline, and no longer under the Command Line
    const m = await ev(`(() => { const e = document.querySelector('#reject'), r = e.getBoundingClientRect(), a = document.querySelector('#warp .clock-art').getBoundingClientRect(), cs = getComputedStyle(e);
      return { above: r.bottom <= a.bottom, centred: Math.abs((r.left + r.right) / 2 - (a.left + a.right) / 2) < 2, bg: cs.backgroundColor, edge: cs.borderTopColor, ink: cs.color,
        anim: cs.animationName, underLine: !!document.querySelector('.box .err'), overBanner: Number(cs.zIndex) > Number(getComputedStyle(document.querySelector('#banner')).zIndex) }; })()`);
    ok(m.above && m.centred && !m.underLine && m.overBanner, "Chat (2026-10-02): the words show at Time Warp's clock, centred on it, over the wave banner, not under the Command Line (E60, 2026-10-03: in its pendulum window)");
    eq([m.bg, m.edge, m.ink, m.anim], ["rgb(18, 8, 20)", "rgb(244, 236, 204)", "rgb(255, 107, 120)", "none"], "…on a solid dark plate with a light outline, light red, steady (no animation)");
  }
  eq((await snap()).pool, 3, "…with no pool penalty");
  eq(await ev("document.querySelector('.box.active').getBoundingClientRect().width > 0.9 * document.querySelector('#console').getBoundingClientRect().width"), true, "…and the Command Line keeps its full width (no class clash with the title screen's .error)");
  await shot("03a-error");
  {
    // poll, not a fixed wait: a busy machine can hold the page's timer back a little (steadied 2026-09-24)
    let gone = false;
    for (let i = 0; i < 80 && !gone; i++) { await wait(50); gone = !(await ev("__et.boxes().error[0]")); }
    ok(gone, "the ERROR is gone after about a second");
  }
  await typeAndEnter("RCAV 1");
  eq(await ev("__et.boxes().say.text"), "ERROR", "…any other rejected Enter still says ERROR");
  {
    // a run of rejected Enters holds the one message steady and restarts its time: it never goes off and on again
    const s0 = await ev("__et.boxes().say.shows");
    await typeAndEnter("RCAV 2");
    await typeAndEnter("RCAV 3");
    await typeAndEnter("RCAV 4");
    const s1 = await ev("__et.boxes().say");
    ok(s1.shown && s1.shows === s0, `Chat (2026-10-02): repeat errors hold one message steady and restart its time, no re-flash   [${s1.shows - s0} new showings for 3 more errors]`);
    const log = s1.log;
    let worst = 0;
    for (let i = 0; i < log.length; i++) { let k = 0; for (let j = i; j < log.length && log[j] < log[i] + 1; j++) k++; worst = Math.max(worst, k); }
    ok(worst <= 2, `SAFETY: the message comes on at most 2 times in any second   [worst ${worst}]`);
    // E60 (Chat, 2026-10-03): a pinball backglass sign. Its bulbs swap bright/dim together: count the swaps over 2 s
    const bulbs = await ev(`new Promise((done) => { const e = document.querySelector('#reject'), seen = [];
      const t0 = performance.now(), look = () => getComputedStyle(e, '::before').borderTopColor;
      let last = look(), swaps = [];
      const tick = () => { const now = look(); if (now !== last) { swaps.push(performance.now() - t0); last = now; }
        if (performance.now() - t0 < 2000) { if (!e.hidden) requestAnimationFrame(tick); else done({ swaps, gone: true }); } else done({ swaps, style: getComputedStyle(e, '::before').borderTopStyle, anim: getComputedStyle(e, '::before').animationName }); };
      ET.view.reject('ERROR'); const keep = setInterval(() => ET.view.reject('ERROR'), 300); setTimeout(() => clearInterval(keep), 2100);
      requestAnimationFrame(tick); })`);
    let worstB = 0;
    for (let i = 0; i < bulbs.swaps.length; i++) { let k = 0; for (let j = i; j < bulbs.swaps.length && bulbs.swaps[j] < bulbs.swaps[i] + 1000; j++) k++; worstB = Math.max(worstB, k); }
    ok(bulbs.style === "dotted" && bulbs.anim === "reject-bulbs" && bulbs.swaps.length >= 2 && worstB <= 2, `E60: a ring of bulbs that swap bright and dim together, held through repeats: SAFETY at most 2 swaps (one flash) in any second   [${bulbs.swaps.length} swaps in 2 s, worst ${worstB}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    eq(await ev("(ET.view.reject('ERROR'), getComputedStyle(document.querySelector('#reject'), '::before').animationName)"), "none", "…with reduced motion the bulbs stay lit and still");
    await c.send("Emulation.setEmulatedMedia", { features: [] });
  }
  for (let i = 0; i < 80 && (await ev("__et.boxes().error[0]")); i++) await wait(50);
  await c.insert("RCAV 1");
  await press("F12");
  eq(await ev("__et.boxes().values[0]"), "", "F12 clears the box, no penalty");
  await press("Enter");
  eq(await ev("__et.boxes().error[0]"), false, "⏳ E6: an Enter on an empty Command Line shows no ERROR");

  // record the nest clock at the very step this nest goes bold (the view hears every event with the game), so the
  // reading can't drift with the live page's own frames between the rig's samples (steadied 2026-09-24)
  await ev(`(() => { const h = ET.view.handle; window.__boldAt = null;
    ET.view.handle = function (events, game) {
      events.forEach((e) => { if (e.type === 'bold' && e.nest === ${n.id} && window.__boldAt === null) window.__boldAt = game.snapshot().nests.find((x) => x.id === ${n.id}).elapsed; });
      return h.apply(this, arguments);
    };
    window.__unwatchBold = () => { ET.view.handle = h; };
    return 1; })()`);
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
  eq(await boxes(), ["900 rgb(11, 93, 30) rgb(255, 255, 255)", "900 rgb(0, 0, 0) rgb(185, 185, 198)", "900 rgb(255, 255, 255) rgb(209, 0, 106)"],
    "Refinement 5 §2: at the limit, all three at once: unit bold dark green on white, type bold black on grey, timer bold white on the ready pink (E33: #d1006a)");
  eq(await ev(`(() => { ET.howto.at(ET.CONFIG.howtoStepSeconds[0] + 2); const out = [".toon-anim .toon.bold .readout .clock", ".strip .cell:nth-child(2) .num"].map(s => { const e = document.querySelector(s), c = getComputedStyle(e); return c.backgroundColor + " " + c.color; }); ET.howto.at(null); return out; })()`),
    ["rgb(209, 0, 106) rgb(255, 255, 255)", "rgb(209, 0, 106) rgb(255, 255, 255)"], "E33: the How To Play cartoon's bold timer and the still strip's panel 2 badge are the real timer's pink, white on it");
  const expect = { VS: 10, STR: 10, SS: 15, EOS: 30, MB: 30 }[n.code];
  {
    // the clock as it read at the bold step: one step of play is at most 0.1 s, 3 displayed seconds at base speed
    const at = await ev("window.__boldAt");
    await ev("window.__unwatchBold(), 1");
    const clk = at === null ? "none" : `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(Math.floor(at % 60)).padStart(2, "0")}`;
    if (expect) ok(at !== null && Math.floor(at / 60) === expect && at - expect * 60 >= 0 && at - expect * 60 < 3.5, `the nest clock shows displayed time: ${n.code} goes bold at ${expect}:00   [${clk} at the bold step]`);
    // and the readout shows the snapshot's own time, read in one go with the page held still
    const shown = await ev(`(() => { __et.advance(0); const x = __et.snapshot().nests.find((y) => y.id === ${n.id}); return [${q(".clock")}.textContent, x.elapsed]; })()`);
    const want = `${String(Math.floor(shown[1] / 60)).padStart(2, "0")}:${String(Math.floor(shown[1] % 60)).padStart(2, "0")}`;
    eq(shown[0], want, "…and the readout shows the nest clock as MM:SS of displayed time");
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
  {
    // poll, not a fixed wait: a busy machine can hold a CSS animation back a little (steadied 2026-09-24)
    let op = "";
    for (let i = 0; i < 80 && op !== "0"; i++) { await wait(50); op = await ev(`getComputedStyle(${q(".pan")}).opacity`); }
    eq(op, "0", "…and the pan is gone again a moment later");
  }

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
      return { mess: zi(nest.querySelector('.mess')), readout: zi(nest.querySelector('.readout')), hsign: zi(nest.querySelector('.hsign')), refused: zi(nest.querySelector('.refused')),
               cords: zi(document.querySelector('#cords')), hose: zi(document.querySelector('#hose')), field: zi(document.querySelector('#field')),
               floorFirst: board.firstElementChild.classList.contains('floor-mess') && zi(board.firstElementChild) === 0 };
    })()`);
    ok(z.mess > z.readout && z.mess > z.hsign && z.mess > z.refused, `E14 (ruled): a nest's gunk covers its readout (and its H sign or "Patient Refused" bubble, as it did AD's post-it)   [mess ${z.mess} > ${z.readout}, ${z.hsign}, ${z.refused}]`);
    ok(z.cords < z.field, "…while Time Warp's lightning (the old cord layer) still draws under all text");
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
      const pass = () => { fire('pointerdown', r.left + 10, r.top + 10); fire('pointermove', r.right - 10, r.top + 10); fire('pointerup', r.right - 10, r.top + 10); };
      pass();
      const mid = g.getImageData(800, 14, 1, 1).data[3];
      pass();
      const mid2 = g.getImageData(800, 14, 1, 1).data[3];
      const after = __et.floor();
      ET.mess.clear(fcv);
      return [before, after, mid, mid2];
    })()`);
    ok(fl[1] < fl[0] - 0.02, `the hose washes the board-wide gunk too   [${(fl[0] * 100).toFixed(1)}% → ${(fl[1] * 100).toFixed(1)}%]`);
    const thin = await ev("ET.CONFIG.liquid.thin");
    ok(Math.abs(fl[2] - 255 * (1 - thin)) < 8 && fl[3] < 12, `E38: one pass thins the liquid (to ${Math.round(100 * (1 - thin))}%), it isn't erased like a solid; E42: two passes wash it out (it took three)   [alpha 255 → ${fl[2]} → ${fl[3]}]`);
  }
  ok(await ev("__et.boxes().focused"), "the command box gets the keyboard back after wiping");
  {
    // a clear's gunk that lands on a nest while it is still growing in (its unlock) is the same size as any other: one
    // smallest blob, pinned (by the random numbers) onto an unlocking nest's canvas, measured once the nest is full size
    const one = await ev(`(() => { __et.start(1, { hospital: 0 }); __et.advance(0.05);
      const n = document.querySelector('.nest.unlock'), id = +n.dataset.id, cv = ET.view.nest(id).mess; ET.mess.clear(cv);
      const b = document.querySelector('#board').getBoundingClientRect(), m = cv.getBoundingClientRect();
      const seq = [(m.left + m.width / 2 - b.left) / b.width, (m.top + m.height / 2 - b.top) / b.height, 0], R = Math.random;
      Math.random = () => (seq.length ? seq.shift() : 0.5);
      try { ET.view.fling(1); } finally { Math.random = R; }
      return { id, scaled: m.width < cv.offsetWidth * 0.9 }; })()`);
    await wait(600);   // the unlock is over
    const blob = await ev(`__et.mess(${one.id})`);
    ok(one.scaled && blob > 0 && blob < 0.03, `gunk landing on a nest as it grows in is the usual size, not blown up once it's full size   [${(blob * 100).toFixed(1)}% of the nest's canvas]`);
    await ev(`(ET.mess.clear(ET.view.nest(${one.id}).mess), 1)`);
  }

  /* ------------------------------------------------------ E. hatch, pool */
  section("E. a hatch drains the pool");
  await ev("__et.start(1, { hospital: 0 })");                       // fresh: nothing has hatched yet
  // E37: count every THONG, and every pan that comes down, from here to the hatch
  await ev(`(() => { window.__e37 = { thong: 0, pan: 0 }; const f = ET.audio.thong; ET.audio.thong = function () { __e37.thong++; return f.apply(this, arguments); };
    ET.audio.thong.__orig = f; new MutationObserver((ms) => ms.forEach((m) => { if (m.target.classList && m.target.classList.contains('pan') && m.target.className !== 'pan') __e37.pan++; }))
      .observe(document.querySelector('#field') || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); return 1; })()`);
  const h = await until((x) => x.stats.hatched >= 1, 120, 0.1);
  ok(!!h.hit, "leaving a CAV alone lets it hatch");
  eq(await ev("document.querySelector('#hud-pool').textContent"), "●●○", "the pool shows 2 of 3");
  eq(await ev("document.querySelector('#hud-pool-label').textContent"), "POOL", "the pool is shown by its placeholder key only");
  ok(await ev("!!document.querySelector('.nest.hop, .nest.scare')"), "the creature does its hatch (Andrew, 2026-10-01: a hop or a scare)");
  {
    // E45/E46 (Andrew, 2026-09-27): wave 1 hatches cute, and a cute alien only scurries (⏳ placeholder: a smile, yellow eyes, no fangs).
    // Paused in the same ev() (and left paused through this section), so the 2 s escape can't end under the checks and stills.
    const cx = await ev(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.querySelector('#pause').hidden = true;
      const n = document.querySelector('.nest[data-state="escape"]'); if (!n) return null; const c = n.querySelector('.creature'), d = (s) => getComputedStyle(c.querySelector(s)).display;
      const al = c.querySelector('.alien'), imgs = al ? [...al.querySelectorAll('image')] : [];
      return { set: n.dataset.hatch, alien: n.dataset.alien, puppet: al && al.dataset.alien, parts: imgs.length, drawn: imgs.filter((i) => i.getBBox().width > 0).length,
        placeholder: d('.body'), hop: n.classList.contains('hop'), scare: n.classList.contains('scare') }; })()`);
    ok(!!cx && cx.set === "cute" && ["crab", "octopus", "worm"].includes(cx.alien), `E45: a wave-1 hatch is one of the cute set   ${JSON.stringify(cx)}`);
    ok(!!cx && cx.hop && !cx.scare, "Andrew, 2026-10-01: …and it ends with a goofy hop, never the jump scare");
    ok(!!cx && cx.puppet === cx.alien && cx.parts >= 3 && cx.drawn === cx.parts && cx.placeholder === "none",
      "E45: the nest shows that alien's puppet from Andrew's sheets, every piece drawn, and the placeholder bug steps aside");
    if (SHOTS) {
      await ev(`(() => { const n = document.querySelector('.nest[data-state="escape"]'); n.classList.remove('hop', 'scare'); n.style.transform = 'translate(-50%, -50%) scale(2.2)'; n.style.zIndex = 50; return 1; })()`);
      await shot("05a-hatchling-cute");
      await ev(`(() => { const n = document.querySelector('.nest[style*="scale(2.2)"]'); n.style.transform = ''; n.style.zIndex = ''; n.classList.add('hop'); return 1; })()`);
    }
  }
  await wait(600);   // longer than the old late pan's delay plus its slam
  eq(await ev("(() => { const r = [__e37.thong, __e37.pan, document.querySelectorAll('.pan:not([class=\"pan\"])').length]; ET.audio.thong = ET.audio.thong.__orig; return r; })()"), [0, 0, 0],
    "E37: a hatch shows the hatch only: no THONG and no pan (counted from the start to after the hatch)");
  await shot("05-escape");
  {
    // E45: from wave 2's first hatch on, the horror set (⏳ placeholder): many red eyes, fangs, eight legs. The page is paused
    // (paused above) and the same escaping nest is handed a horror hatch.
    const hx = await ev(`(() => { const n = document.querySelector('.nest[data-state="escape"]'); if (!n) return null;
      ET.view.handle([{ type: 'hatch', nest: +n.dataset.id, pool: 2, set: 'horror', alien: 'scuttler', exit: 'scare' }], null);
      const c = n.querySelector('.creature'), al = c.querySelector('.alien');
      return { set: n.dataset.hatch, scare: n.classList.contains('scare'), puppet: al && al.dataset.alien,
        legs: al ? al.querySelectorAll('[data-part="leg"]').length : 0, mandibles: al ? al.querySelectorAll('[data-part^="mandible"]').length : 0 }; })()`);
    ok(!!hx && hx.set === "horror" && hx.scare && hx.puppet === "scuttler" && hx.legs === 8 && hx.mandibles === 2,
      `E45: a horror hatch shows the horror puppet: the Scuttler, eight legs and two mandibles   ${JSON.stringify(hx)}`);
    if (SHOTS) {
      // a still of the hatchling at full size, in its nest, for a look (the flourish itself is too quick to catch)
      await ev(`(() => { const n = document.querySelector('.nest.hop, .nest.scare'); n.classList.remove('hop', 'scare'); n.style.transform = 'translate(-50%, -50%) scale(2.2)'; n.style.zIndex = 50; return 1; })()`);
      await shot("05b-hatchling");
      await ev(`(() => { const n = document.querySelector('.nest[style*="scale(2.2)"]'); n.style.transform = ''; n.style.zIndex = ''; return 1; })()`);
    }
  }

  /* ------------------------------------------------------ AL. the six aliens */
  section("AL. the hatchlings: Andrew's six aliens as puppets (E45, sheets approved 2026-09-27)");
  {
    const al = await ev(`(async () => {
      const c = document.querySelector('.nest[data-id="0"] .creature'), out = {};
      for (const a of Object.keys(ET.aliens.RIGS)) {
        ET.aliens.fill(c, a);
        const imgs = [...c.querySelectorAll('.alien image')];
        out[a] = { parts: imgs.length, hrefs: imgs.every((i) => i.getAttribute('href') === 'art/hatch-' + a + '--' + i.closest('[data-part]').dataset.part + '@2x.png') };
      }
      ET.aliens.clear(c);
      // one at a time, with a retry: the test server serves one request at a time, and 42 at once got some refused (steadied 2026-10-01)
      const srcs = ET.aliens.sources(), codes = [];
      for (const s of srcs) { let st = 0; for (let k = 0; k < 3 && st !== 200; k++) st = await fetch(s, { cache: 'no-store' }).then((r) => r.status, () => 0); codes.push(st); }
      return { out, n: srcs.length, bad: srcs.filter((s, i) => codes[i] !== 200), cleared: !c.querySelector('.alien') && !c.classList.contains('has-art') };
    })()`);
    eq(Object.keys(al.out).sort(), ["crab", "grabber", "octopus", "scuttler", "worm", "wriggler"], "all six aliens have a puppet");
    ok(Object.values(al.out).every((x) => x.parts >= 4 && x.hrefs), `each is built from its own cut pieces   [${Object.entries(al.out).map(([a, x]) => a + " " + x.parts).join(", ")}]`);
    eq(al.bad, [], `every piece's picture loads   [${al.n} pictures]`);
    ok(al.cleared, "clearing a nest takes its alien away and brings the placeholder back");
    eq(await ev("[...Object.keys(ET.aliens.RIGS)].sort().join() === [...ET.CONFIG.hatchAliens.cute, ...ET.CONFIG.hatchAliens.horror].sort().join()"), true,
      "the puppets are exactly the aliens the game draws from (hatchAliens)");
  }

  /* ------------------------------------------- HS. the hatch (Andrew, 2026-10-01) */
  section("HS. the hatch: out, dance, then a goofy hop (cute) or freeze, stare and a full-screen jump (horror) (Andrew, 2026-10-01)");
  {
    // One real hatch, re-dealt as the case wanted, and recorded in the page every frame (the live page keeps running, so
    // nothing here is a fixed wait). `pause`: [from, to] seconds after the hatch to hold the game with Esc.
    const hatchRun = (set, alien, exit, pause = null) => ev(`new Promise((done) => {
      __et.start(1, { hospital: 0 });
      let n = null;
      for (let i = 0; i < 4000 && !n; i++) { __et.advance(0.1); n = __et.snapshot().nests.find((x) => x.state === 'escape'); }
      if (!n) return done(null);
      const el = document.querySelector('.nest[data-id="' + n.id + '"]'), sc = document.querySelector('#scare'), svg = sc.querySelector('svg');
      ET.view.handle([{ type: 'hatch', nest: n.id, pool: 2, set: '${set}', alien: '${alien}', exit: '${exit}' }], null);
      const t0 = performance.now(), out = { anim: getComputedStyle(el.querySelector('.creature')).animationName, cls: el.className };
      if (!ET.audio.stinger.__orig) { for (const k of ['stinger', 'boing']) { const f = ET.audio[k]; ET.audio[k] = function () { window['__' + k + 's']++; return f.apply(this, arguments); }; ET.audio[k].__orig = f; } }
      window.__stingers = 0; window.__boings = 0;
      const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const pause = ${JSON.stringify(pause)}; let paused = false, resumed = false;
      (function look() {
        const t = (performance.now() - t0) / 1000;
        if (pause && !paused && t >= pause[0]) { paused = true; esc(); }
        if (pause && paused && !resumed && t >= pause[1]) { resumed = true; esc(); }
        if (out.freeze === undefined && el.classList.contains('freeze')) { out.freeze = t; out.hushAtFreeze = ET.audio.hushed(); }
        if (out.freeze !== undefined && out.leap === undefined && sc.hidden) out.hushStare = (out.hushStare !== false) && ET.audio.hushed();
        if (out.boing === undefined && window.__boings > 0) out.boing = t;
        if (out.leap === undefined && !sc.hidden) { out.leap = t; out.stingers = window.__stingers; out.alien = (sc.querySelector('.alien') || {}).dataset?.alien; out.leapt = el.classList.contains('leapt'); out.still = sc.classList.contains('still'); }
        if (out.leap !== undefined && !sc.hidden) {
          const r = svg.getBoundingClientRect();
          if (out.big === undefined && r.height >= innerHeight * 0.95) { out.big = t; out.transform = getComputedStyle(svg).transform; }
          if (out.big !== undefined && out.gone === undefined && r.top >= innerHeight) out.gone = t;
        } else if (out.big !== undefined && out.gone === undefined) {
          out.gone = t;
        }
        // Chat (2026-10-03, D): the slime, as the alien hits the screen
        const sl = document.querySelector('#board .slime');
        if (sl && out.slime === undefined) { const warp = document.querySelector('#warp'), bl = sl.querySelector('.blob');
          out.slime = t; out.slimeUnder = !!(sl.compareDocumentPosition(warp) & Node.DOCUMENT_POSITION_FOLLOWING) && getComputedStyle(sl).zIndex === '0';
          out.slimeFill = getComputedStyle(bl).fill; out.slimeStill = sl.classList.contains('still'); out.slimeRuns = [...sl.querySelectorAll('.run')].map(g => getComputedStyle(g).animationName); out.slimeFade = getComputedStyle(sl).animationName; }
        if (t < 4.6) requestAnimationFrame(look); else { out.hushEnd = ET.audio.hushed(); done(out); }
      })();
    })`);
    const C = await ev("({ total: ET.CONFIG.escapeSeconds, freeze: ET.CONFIG.hatchScare.freeze, leap: ET.CONFIG.hatchScare.leap })");
    const near = (t, want, tol = 0.3) => t !== undefined && Math.abs(t - want) <= tol;
    const h = await hatchRun("horror", "scuttler", "scare");
    ok(!!h && h.anim === "hatch-scare", `a horror hatch comes out, scurries and dances on the spot   [${h && h.anim}]`);
    ok(!!h && near(h.freeze, C.freeze * C.total), `…then freezes and stares (its own swings stop too)   [at ${h && h.freeze && h.freeze.toFixed(2)} s, ${(C.freeze * C.total).toFixed(2)} wanted]`);
    ok(!!h && near(h.leap, C.leap * C.total) && h.alien === "scuttler" && h.leapt, `…then jumps at the player: the same alien, out of its nest   [at ${h && h.leap && h.leap.toFixed(2)} s]`);
    ok(!!h && h.big !== undefined && h.big - h.leap <= 0.3, `…sudden and fast: it fills the screen almost at once   [${h && h.big !== undefined ? ((h.big - h.leap) * 1000).toFixed(0) + " ms" : "never"}]`);
    ok(!!h && h.gone !== undefined && h.gone - h.big >= 0.3 && h.gone <= C.total + 0.4, `…holds a moment, then drops away out of view   [held ${h && h.gone !== undefined ? (h.gone - h.big).toFixed(2) : "?"} s, gone at ${h && h.gone && h.gone.toFixed(2)} s]`);
    {
      const jump = C.total * (1 - C.leap), want = C.leap * C.total + 0.18 * jump;
      ok(!!h && near(h.slime, want, 0.25) && h.slimeUnder && h.slimeFill === "rgb(176, 77, 255)" && h.slimeFade === "slime-fade", `Chat (2026-10-03, D): as the alien hits the screen a glowing purple splat lands, in a layer under Time Warp, every nest, readout and timer   [at ${h && h.slime && h.slime.toFixed(2)} s, ${want.toFixed(2)} wanted; ${h && h.slimeFill}]`);
      ok(!!h && h.slimeRuns.length >= 4 && h.slimeRuns.every((a) => a === "slime-run") && !h.slimeStill, `…its slime streaks run down, then all of it fades and goes   [${h && h.slimeRuns.length} streaks]`);
      // D2 (2026-10-03): near the hatching nest, clear of every nest, readout, Time Warp, the hose tag; held, then fading
      const sl = await ev(`(() => { const e = document.querySelector('#board .slime'); if (!e) return null; const r = e.getBoundingClientRect();
        const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
        const keep = [...document.querySelectorAll('.nest')].map(n => { const s = n.querySelector('.nest-art').getBoundingClientRect(); return { left: s.left + s.width * 0.1, right: s.right - s.width * 0.1, top: s.top + s.height * 0.2, bottom: s.bottom - s.height * 0.1 }; })
          .concat([...document.querySelectorAll('.nest .readout > span, #warp .clock-art, #warp .plaque, #warp .caption, #hose-tag, .wallclock, #console .box')].map(x => x.getBoundingClientRect()).filter(x => x.width > 0));
        const cs = getComputedStyle(e), log = ET.view.slimeLog();
        return { clear: !keep.some(k => hit(r, k)), w: Math.round(r.width), delay: cs.animationDelay, dur: cs.animationDuration, glow: getComputedStyle(e.querySelector('svg')).filter, last: log[log.length - 1] }; })()`);
      ok(!!sl && sl.clear && sl.delay === "2s" && sl.dur === "4s" && /drop-shadow.*drop-shadow/.test(sl.glow), `Chat (2026-10-03, D2): it lands at the clear spot nearest its nest, touching no nest, readout, Time Warp, the hose tag or a Command Line; fully there 2 s, then fading over 4 s, two steady halos   [${sl && sl.w} px wide, scale ${sl && sl.last && sl.last.scale}]`);
      const gone = await ev(`new Promise((done) => setTimeout(() => done(document.querySelectorAll('#board .slime').length), (ET.CONFIG.hatchSlime.hold + ET.CONFIG.hatchSlime.fade) * 1000 + 600))`);
      eq(gone, 0, "…and is gone by itself after its few seconds");
    }
    ok(!!h && h.hushAtFreeze && h.hushStare && h.stingers === 1 && !h.hushEnd, `the sound (Andrew, 2026-10-01): the music drops out for the stare, the jump hits with the stinger, and the music comes back   [${JSON.stringify(h && [h.hushAtFreeze, h.hushStare, h.stingers, h.hushEnd])}]`);
    {
      // levels, with the randomness seeded (as in section S): the stinger as loud as THONG and no louder; the boing under the loud cues
      const lv = await ev(`(window.__seeded = (seed, fn) => { const R = Math.random; let s = seed; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; try { return fn(); } finally { Math.random = R; } }, Promise.all([['thong'], ['buzz'], ['hiss', [0.85, 0.12]], ['stinger'], ['boing']].map(([k, a]) => Promise.all([0, 1, 2, 3, 4].map((i) => __seeded(1009 + 7919 * i, () => ET.audio.measure(k, a, 1))))
        .then((rs) => ({ pMax: Math.max(...rs.map(x => x.peak)), pMin: Math.min(...rs.map(x => x.peak)), rMax: Math.max(...rs.map(x => x.rms)), rMin: Math.min(...rs.map(x => x.rms)) })))))`);
      const [th, bz, hs, st, bo] = lv, quiet = { peak: Math.min(th.pMin, bz.pMin, hs.pMin), rms: Math.min(th.rMin, bz.rMin, hs.rMin) };
      ok(st.pMax <= th.pMax && st.rMax <= th.rMin && st.rMin >= 0.8 * th.rMin && st.pMin >= 0.8 * th.pMin,
        `…the stinger as loud as THONG and no louder   [stinger ${st.pMin.toFixed(3)}–${st.pMax.toFixed(3)} / ${st.rMax.toFixed(4)}; THONG ${th.pMin.toFixed(3)}–${th.pMax.toFixed(3)} / ${th.rMin.toFixed(4)}]`);
      ok(bo.pMax <= 0.6 * quiet.peak && bo.rMax <= 0.6 * quiet.rms, `…and the cute hop's boing under THONG, the buzz and the hiss   [${bo.pMax.toFixed(3)} / ${bo.rMax.toFixed(4)}]`);
    }
    const p = await hatchRun("horror", "grabber", "scare", [1.0, 2.0]);
    ok(!!p && near(p.leap, C.leap * C.total + 1.0, 0.35), `a pause holds the hatch: a 1 s pause before the jump puts the jump 1 s later   [at ${p && p.leap && p.leap.toFixed(2)} s]`);
    await ev("__et.paused() && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1");
    const k = await hatchRun("cute", "crab", "hop");
    ok(!!k && k.anim === "hatch-hop" && k.leap === undefined && k.freeze === undefined, `a cute hatch comes out, dances and ends with a goofy hop toward the player: no freeze, no scare   [${k && k.anim}]`);
    ok(!!k && k.boing !== undefined && near(k.boing, C.freeze * C.total) && !k.hushEnd, `…with a boing as it hops, and the music never drops out   [at ${k && k.boing && k.boing.toFixed(2)} s]`);
    const kf = await ev(`(() => { const out = {}; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
      for (const r of rs) if (r.type === CSSRule.KEYFRAMES_RULE && ['hatch-scare', 'hatch-hop', 'scare-jump', 'slime-run'].includes(r.name)) out[r.name] = /opacity|filter|brightness|color/.test(r.cssText); } return out; })()`);
    eq(Object.keys(kf).sort().map((k) => k + " " + kf[k]), ["hatch-hop false", "hatch-scare false", "scare-jump false", "slime-run false"], "SAFETY: the hatch only moves: nothing in it changes opacity, colour or brightness, so nothing can flash (the slime's streaks too; it fades once, slowly, as it goes)");
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 60 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const r = await hatchRun("horror", "wriggler", "scare");
    ok(!!r && r.anim === "none", `reduced motion: the alien sits still in its nest   [${r && r.anim}]`);
    ok(!!r && r.still && r.transform === "none" && near(r.leap, C.leap * C.total), `E49 (ruled "still"): the full-screen alien just appears for the hold, no zoom, no movement   [${r && r.transform}]`);
    ok(!!r && r.slimeStill && near(r.slime, C.leap * C.total, 0.2) && r.slimeRuns.every((a) => a === "none"), `Chat (2026-10-03, D): reduced motion: the splat is there at once, its short streaks still, and it fades as it goes   [${r && r.slimeRuns.join(" ")}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
    for (let i = 0; i < 60 && (await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
  }

  /* ------------------------------------------------------ F. command boxes */
  section("F. Command Lines: Tab / Shift+Tab / F12, as in CAD5 (Refinement 3 §1)");
  await ev("__et.start(3, { hospital: 0 })");
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
  {
    // poll, not a fixed wait: on a busy machine the page's frames come slower (steadied 2026-09-24)
    const t0 = (await snap()).time;
    let moved = false;
    for (let i = 0; i < 100 && !moved; i++) { await wait(50); moved = (await snap()).time > t0 + 0.2; }
    ok(moved && !(await ev("__et.paused()")), "switching never pauses the game");
  }
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

  await ev("__et.start(1, { hospital: 0 })");
  await ev("document.querySelector('.box.active input').focus()");
  await c.insert("RCAV 2");
  await press("Tab");
  eq([(await ev("__et.boxes()")).active, (await ev("__et.boxes()")).values], [0, ["RCAV 2"]], "with 1 line, Tab does nothing");
  await press("F12");
  eq((await ev("__et.boxes()")).values, [""], "…and F12 just clears it");
  // Andrew's all-games rule (2026-10-01): F3 types COM at the cursor, no trailing space
  await c.insert("CAV 12");
  await press("F3");
  eq((await ev("__et.boxes()")).values, ["CAV 12COM"], "F3 types COM into the Command Line");
  await ev("document.querySelector('.box.active input').setSelectionRange(4, 4)");
  await press("F3");
  eq([(await ev("__et.boxes()")).values, await ev("document.querySelector('.box.active input').selectionStart")], [["CAV COM12COM"], 7], "…at the cursor, which ends up after it");
  eq(await ev(`(() => { const d = new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(d); return d.defaultPrevented; })()`), true, "…and the browser's Find bar stays shut");
  await ev("(() => { const i = document.querySelector('.box.active input'); i.value = 'X'.repeat(i.maxLength - 1); i.setSelectionRange(i.value.length, i.value.length); })()");
  await press("F3");
  eq(await ev("document.querySelector('.box.active input').value.length"), 60, "…and never past the line's 60 characters");
  await press("F12");

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
  {
    // E24, and E25 (ruled): in play M is a letter players type (MB), so it types and doesn't mute; there Ctrl+M mutes;
    // paused, M mutes; the button mutes any time, and never takes the keyboard from the Command Line
    const typeM = async (mods = 0) => {
      await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "m", code: "KeyM", windowsVirtualKeyCode: 77, modifiers: mods, ...(mods ? {} : { text: "m", unmodifiedText: "m" }) });
      await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "m", code: "KeyM", windowsVirtualKeyCode: 77, modifiers: mods });
      await wait(30);
    };
    const line = () => ev("[document.querySelector('.box.active input').value, ET.audio.muted(), __et.boxes().focused]");
    await ev("document.querySelector('.box.active input').value = ''; document.querySelector('.box.active input').focus(); 1");
    await typeM();
    eq(await line(), ["m", false, true], "E25: in play M types into the Command Line (MB needs it) and doesn't mute");
    const tip = () => ev("document.querySelector('#mute').title");
    eq(await tip(), "Sound on (Ctrl+M)", "…so in play the button's tooltip names Ctrl+M, the key that works there");
    await press("Escape");
    const pausedTip = await tip();
    await press("m");
    const pausedMute = await ev("ET.audio.muted()");
    await press("m");
    await press("Escape");
    ok(pausedMute && !(await ev("ET.audio.muted()")) && pausedTip === "Sound on (M)", `…while paused, M mutes and unmutes, and the tooltip says so   [${pausedTip}]`);
    eq(await tip(), "Sound on (Ctrl+M)", "…and back in play it names Ctrl+M again");
    const at = await ev("(() => { const q = document.querySelector('#mute').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()");
    const click = async () => { for (const type of ["mousePressed", "mouseReleased"]) await c.send("Input.dispatchMouseEvent", { type, x: at[0], y: at[1], button: "left", clickCount: 1 }); await wait(30); };
    await click();
    const clicked = await line();
    await click();
    ok(clicked[1] && clicked[2] && clicked[0] === "m" && !(await ev("ET.audio.muted()")), `in play the button mutes (and unmutes), and the Command Line keeps the keyboard and its text   [${JSON.stringify(clicked)}]`);
    ok((await ev("getComputedStyle(document.querySelector('#mute')).cursor")) === "none", "…and over it the cursor is still the hose nozzle (the drawn one: the system cursor is hidden), as everywhere in the game");
    // E25 (ruled): Ctrl+M mutes in play, leaving the Command Line's text alone
    await typeM(CTRL);
    const ctrlOn = await line();
    const ctrlTip = await tip();
    await typeM(CTRL);
    const ctrlOff = await line();
    ok(ctrlOn[1] && ctrlOn[0] === "m" && ctrlOn[2] && !ctrlOff[1] && ctrlTip === "Sound off (Ctrl+M)", `E25: in play Ctrl+M mutes and unmutes, the Command Line keeping the keyboard and its text   [${JSON.stringify(ctrlOn)}, ${ctrlTip}]`);
    // the other value still works as a switch: with "none" Ctrl+M does nothing in play
    await ev("ET.CONFIG.muteKeyInPlay = 'none'; 1");
    await typeM(CTRL);
    const noneOff = !(await ev("ET.audio.muted()"));
    await ev("ET.CONFIG.muteKeyInPlay = 'ctrl-m'; 1");
    ok(noneOff, "(with the switch's other value, \"none\", Ctrl+M does nothing in play)");
    await ev("document.querySelector('.box.active input').value = ''; 1");
  }

  /* --------------------------------------- G2. E48: the way out to the Arcade room */
  section("G2. E48: the way out to the Arcade room (Andrew, 2026-10-01)");
  {
    // the rig page isn't inside the CAT hub, so __et.hub(true) plays as if it were; `cat:exit` then lands on this window
    await ev("window.__exits = 0; window.__exitHook || (window.__exitHook = addEventListener('message', (e) => { if (e.data && e.data.type === 'cat:exit') window.__exits++; })); 1");
    const exits = async () => { await wait(60); return ev("window.__exits"); };
    const shown = (sel) => ev(`(() => { const e = document.querySelector('${sel}'); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; })()`);
    ok(!(await ev("__et.hub()")), "the rig page isn't inside the hub");
    await press("Escape");
    eq([await ev("__et.paused()"), await shown("#pause .quit")], [true, false], "outside the hub the pause panel has no way out (there's nowhere to go)");
    await press("q");
    eq([await ev("__et.asking()"), await exits()], [false, 0], "…and Q does nothing there");
    await ev("__et.hub(true)");
    eq(await shown("#pause .quit"), true, "inside the hub the pause panel offers [Q] Quit to Arcade");
    eq(await ev("document.querySelector('#pause .quit').textContent"), "[Q] QUIT TO ARCADE", "…in those words");
    await press("q");
    eq([await ev("__et.asking()"), await shown("#pause .confirm"), await shown("#pause .quit"), await exits()], [true, true, false, 0], "mid-game Q asks first: \"Quit this game? [Y] / [N]\", and nothing leaves yet");
    await shot("07b-quit-ask");
    await press("n");
    eq([await ev("__et.asking()"), await ev("__et.paused()"), await exits()], [false, true, 0], "N goes back to the pause panel");
    await press("q");
    await press("Escape");
    eq([await ev("__et.asking()"), await ev("__et.paused()"), await exits()], [false, true, 0], "…and so does Esc (it doesn't resume from the question)");
    await press("q");
    await press("y");
    eq(await exits(), 1, "Y sends the hub `cat:exit`, its own Exit Game path");
    await press("n");   // (inside the hub the game is gone by now; here it's still on the question)
    await press("Escape");
    ok(!(await ev("__et.paused()")), "Esc still resumes the game from the pause panel");
    await ev("document.querySelector('.box.active input').focus()");
    await c.insert("RCAV 2");
    await press("q");
    await press("Q");
    eq([await exits(), await ev("__et.paused()")], [1, false], "in play (not paused) Q is only a letter: nothing leaves");
    await ev("document.querySelector('.box.active input').value = ''; 1");
    for (const name of ["title", "setup", "over"]) {
      await ev(`__et.show('${name}')`);
      const vis = await shown("#quit-hint");
      await press("q");
      eq([vis, await exits()], [true, 2], `on the ${name} screen the hint shows and Q leaves at once (no run to lose)`);
      await ev("window.__exits = 1");
    }
    await ev("__et.hub(false)");
    await ev("__et.show('title')");
    await press("q");
    eq([await shown("#quit-hint"), await exits()], [false, 1], "outside the hub the menu screens show no hint and Q does nothing");
    await ev("__et.hub(undefined)");
  }

  /* ------------------------------------------------ H. hospital eggs */
  section("H. hospital eggs in the page: the H sign, RCAV then CAV STR, Mom's repair (E52–E56, ruled 2026-10-02)");
  {
    // every egg a hospital egg; the first one, played through both windows by real keys in the Command Line
    await ev("(() => { __et.start(1, { hospital: 1 }); __et.advance(0.1); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return __et.paused(); })()");
    s = await snap();
    const h = s.nests.find((x) => x.state === "laying");
    const q = (sel) => `document.querySelector('.nest[data-id="${h.id}"]${sel}')`;
    ok(!!h && h.hospital, `a hospital egg is laid   [${h && h.unit}]`);
    eq(await ev(`${q(" .hsign")}.hidden`), true, "…its H sign isn't there while the egg is still on the cord");
    await ev("(document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })), 1)");
    await ev(`(() => { for (let i = 0; i < 200 && __et.snapshot().nests.find(n => n.id === ${h.id}).state !== 'active'; i++) __et.advance(0.05); return 1; })()`);
    const sign = await ev(`(() => { const e = ${q(" .hsign")}, r = e.getBoundingClientRect(), ro = ${q(" .readout")}.getBoundingClientRect(), eg = ${q(" .egg")}.getBoundingClientRect();
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return { shown: !e.hidden && r.width > 8, anim: getComputedStyle(e).animationName, plate: getComputedStyle(e.querySelector('.plate')).fill, h: getComputedStyle(e.querySelector('.h')).stroke, onReadout: hit(r, ro), onEgg: hit(r, eg) }; })()`);
    ok(sign.shown && sign.anim === "hsign-drop, mark-bounce", `E55: as the egg pops the H sign drops into the nest, then bounces (Chat, 2026-10-03)   [${sign.anim}]`);
    {
      // Chat (2026-10-03, C): one bounce a second; the hospital half a bounce after the sign
      const bo = await ev(`(() => { const s = ${q(" .hsign")}, h = ${q(" .bld.hosp")}, cs = getComputedStyle(s), ch = getComputedStyle(h);
        return { sDur: cs.animationDuration, sDelay: cs.animationDelay, hidden: h.hidden, hName: ch.animationName, hDur: ch.animationDuration, hDelay: ch.animationDelay }; })()`);
      const sd = parseFloat(bo.sDelay.split(",")[1]), hd = parseFloat(bo.hDelay);
      ok(bo.sDur.split(",")[1].trim() === "1s" && bo.hDur === "1s" && bo.hName === "mark-bounce" && Math.abs(hd - sd - 0.5) < 1e-6, `Chat (2026-10-03, C): the sign and its hospital bounce once a second, half a bounce apart   [${bo.sDelay} / ${bo.hDelay}${bo.hidden ? ", hospital skipped here" : ""}]`);
      await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
      eq(await ev(`[getComputedStyle(${q(" .hsign")}).animationName, getComputedStyle(${q(" .bld.hosp")}).animationName, getComputedStyle(${q(" .bld.house")}).animationName, getComputedStyle(${q(" .refused")}).animationName]`), ["none", "none", "none", "none"], "SAFETY: …with reduced motion the sign, the bubble and both buildings stand still");
      await c.send("Emulation.setEmulatedMedia", { features: [] });
    }
    eq([sign.plate, sign.h], ["rgb(20, 86, 200)", "rgb(255, 255, 255)"], "E55: the hospital road sign: a white H on blue (never a red cross)");
    eq([sign.onReadout, sign.onEgg], [false, false], "…clear of the readout and the egg");
    eq(await ev(`(() => { const e = ${q(" .hsign")}, ro = ${q(" .readout")}; return [e.parentNode === ro, !e.classList.contains('tab-b') && e.style.left === '', e.offsetLeft === ro.offsetWidth + 3]; })()`), [true, true, true],
      "Chat (2026-10-03, G): the H sign is a tab on the timer box, just to its right (only the tab moves; the timer doesn't)");
    eq(await ev(`${q(" .refused")}.hidden`), true, "Chat (2026-10-02): a hospital egg never gets the \"Patient Refused\" bubble");
    await typeAndEnter(`CAV ${h.unit} STR`);
    eq([await ev("__et.boxes().values[0]"), await ev("__et.boxes().error[0]"), await ev("__et.boxes().say.text")], ["", true, "RCAV first!"], "E53: CAV STR before the RCAV: the line clears and says \"RCAV first!\"");
    await ev(`(() => { for (let i = 0; i < 1200 && __et.snapshot().nests.find(n => n.id === ${h.id}).state !== 'overtime'; i++) __et.advance(0.05); return 1; })()`);
    await press("F12");
    await typeAndEnter(`RCAV ${h.unit}`);
    await ev("__et.advance(0.01)");
    const asks = await ev(`(() => { const n = ${q("")}, c = n.querySelector('.readout .code');
      return { cls: n.classList.contains('asks'), text: c.textContent, anim: getComputedStyle(c).animationName, others: getComputedStyle(n.querySelector('.readout .unit')).animationName, bold: n.classList.contains('bold'),
               hint: document.querySelector('#console .box input').placeholder, tip: ET.view.tips()[0].text }; })()`);
    ok(asks.cls && ["CAV", "STR"].includes(asks.text) && asks.anim === "cue" && asks.others === "none" && asks.bold, `E53: after the RCAV the type box takes the cyan "place me" pulse and (J, 2026-10-03) spells the next command; the egg stays bold   [${JSON.stringify(asks.text)} ${asks.anim}]`);
    eq(asks.hint, "CAV + unit + type", "E53: …and the empty Command Line's grey hint asks for the CAV");
    eq(asks.tip, `Now type CAV ${h.unit} STR`, "E28's wave-1 tag follows the step: it asks for the STR now");
    await shot("08-hospital-asks");
    const sc0 = (await snap()).score;
    await typeAndEnter(`CAV ${h.unit} STR`);
    // paused at once, so the live page can't run her visit on between the timed checks below (__et.advance still steps)
    await ev("(document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })), __et.advance(0.01), 1)");
    const fix = await ev(`(() => { const m = document.querySelector('#popups .mom-visit'); if (!m) return null;
      const pics = [...m.querySelectorAll('img')].map((i) => i.getAttribute('src').slice('art/mom-'.length, -'@2x.png'.length)).sort();
      return { kind: m.className, pics: pics.join(' '), pointer: getComputedStyle(document.querySelector('#popups')).pointerEvents,
               pan: ${q(" .pan")}.className, code: ${q(" .code")}.textContent, asks: ${q("")}.classList.contains('asks'), list: ET.view.momFixes() }; })()`);
    eq(fix && [fix.kind, fix.pics], ["mom-visit sweet", "sweet--down sweet--face sweet--giggle sweet--plaster sweet--tentacle sweet--tentacle"], "E55 (Mom kit): the STR brings wave 1's sweet Mom: three heads, two tentacles (one picture, mirrored) and her plaster");
    ok(!!fix && fix.pointer === "none", "…in the layer that takes no pointer or keys");
    ok(!!fix && fix.pan === "pan" && fix.code === "STR" && !fix.asks, `E52: no pan at window 1; the type box reads STR again   [${fix && fix.pan}]`);
    ok((await snap()).score > sc0, "E52: window 1 scores at the STR");
    ok(await ev("document.activeElement === document.querySelector('.box.active input') || __et.paused()"), "…and the Command Line keeps the keys while she's there");
    await ev(`__et.advance(${0.3 * 1.5})`);
    const mid = await ev(`({ crack: Number(${q(" .crack")}.style.strokeDashoffset), giggled: ET.view.momFixes()[0] && ET.view.momFixes()[0].giggled, pose: document.querySelector('#popups .mom-visit').dataset.pose })`);
    await shot("08b-hospital-mom");
    await ev(`__et.advance(${0.3 * 1.5})`);
    const later = await ev(`({ crack: Number(${q(" .crack")}.style.strokeDashoffset), giggled: ET.view.momFixes()[0] && ET.view.momFixes()[0].giggled, pose: document.querySelector('#popups .mom-visit').dataset.pose, want: ET.mom.pose(ET.view.momFixes()[0].u, false) })`);
    ok(mid.crack < 1 && later.crack === 1 && !mid.giggled && later.giggled, `E55: she patches the cracks closed, then turns and giggles   [crack ${(1 - mid.crack).toFixed(2)} → ${(1 - later.crack).toFixed(2)}]`);
    eq([mid.pose, later.pose === later.want && later.pose !== "down"], ["down", true], `Mom kit: looking down (A) while she patches, facing the player once she's done   [${later.pose}]`);
    // the poses through one visit, as config's momTimeline has them: A, B, C (held), B
    eq(await ev(`[0.45, 0.9, 1.3, 1.7, 1.95].map((s) => ET.mom.pose(s / ET.CONFIG.momRepairSeconds)).join(' ')`), "down face giggle giggle face", "Mom kit: A, then B, then C held, then B");
    // Chat's giggle ruling (2026-10-02, flash safety): every pose change through a visit, 5 ms apart
    const swaps = await ev(`(() => { const T = ET.CONFIG.momRepairSeconds, out = []; let was = ET.mom.pose(0);
      for (let s = 0.005; s < T; s += 0.005) { const p = ET.mom.pose(s / T); if (p !== was) out.push([+s.toFixed(3), p]); was = p; } return out; })()`);
    const cAt = swaps.findIndex((x) => x[1] === "giggle"), holdC = cAt >= 0 && swaps[cAt + 1] ? swaps[cAt + 1][0] - swaps[cAt][0] : 0;
    ok(swaps.filter((x) => x[1] === "giggle").length === 1 && holdC >= 0.5, `SAFETY (giggle ruling): pose C is held at least 0.5 s, one swap in and one out   [held ${holdC.toFixed(2)} s]`);
    ok(swaps.every((x, i) => i < 2 || x[0] - swaps[i - 2][0] > 1), `SAFETY (giggle ruling): at most 2 pose changes in any second of the visit   [${swaps.map((x) => x[1] + "@" + x[0]).join(" ")}, of ${await ev("ET.CONFIG.momRepairSeconds")} s]`);
    await ev(`__et.advance(${await ev("ET.CONFIG.momRepairSeconds")} - 0.9 + 0.1)`);
    eq(await ev("[document.querySelectorAll('#popups .momfix').length, ET.view.momFixes().length]"), [0, 0], `E55: …and ducks out after ${await ev("ET.CONFIG.momRepairSeconds")} s`);
    eq(await ev(`${q(" .hsign")}.hidden`), false, "the H sign stays on through the STR");
    // the final clear: the ordinary pan, splat and break stage
    await ev(`(() => { for (let i = 0; i < 1200 && __et.snapshot().nests.find(n => n.id === ${h.id}).state !== 'overtime'; i++) __et.advance(0.05); return 1; })()`);
    await ev("(document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })), 1)");
    await typeAndEnter(`RCAV ${h.unit}`);
    await ev("__et.advance(0.01)");
    eq(await ev(`[${q("")}.dataset.state, ${q(" .pan")}.classList.contains('hit'), ${q(" .hsign")}.hidden]`), ["splat", true, true], "the final RCAV is an ordinary clear: the pan and the splat, and the sign goes");
  }
  {
    // Chat (2026-10-03, J): after a hospital egg's RCAV, its type box spells the STR: CAV and STR in turn, 0.75 s each;
    // reduced motion: both words, stacked and still
    const spell = (reduce) => ev(`(() => { __et.start(1, { hospital: 1 }); let n = null;
      for (let i = 0; i < 4000 && !(n = __et.snapshot().nests.find(x => x.state === 'overtime')); i++) __et.advance(0.05);
      if (__et.paused()) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      __et.submit('RCAV ' + n.unit); __et.advance(0.001);
      const c = document.querySelector('.nest[data-id="' + n.id + '"] .readout .code'), seen = [];
      for (let k = 0; k < 60; k++) { seen.push([__et.snapshot().time, c.textContent, c.classList.contains('both')]); __et.advance(0.05); }
      return seen; })()`);
    const sp = await spell(false);
    const changes = sp.slice(1).filter((x, i) => x[1] !== sp[i][1]).map((x) => x[0]);
    let worst = 0;
    for (let i = 0; i < changes.length; i++) { let k = 0; for (let j = i; j < changes.length && changes[j] < changes[i] + 1 - 1e-6; j++) k++; worst = Math.max(worst, k); }
    const words = [...new Set(sp.map((x) => x[1]))].sort();
    ok(words.join(" ") === "CAV STR" && sp[0][1] === "CAV" && changes.length >= 3 && worst <= 2, `Chat (2026-10-03, J): after the RCAV the type box spells it, CAV then STR in turn; SAFETY at most 2 changes in any second   [${changes.length} changes in 3 s, worst ${worst}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const st = await spell(true);
    ok(st.every((x) => x[1] === "CAVSTR" && x[2]), `…with reduced motion both words, CAV over STR, still   [${st[0][1]}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
  }
  {
    // Chat (2026-10-03, K): an overrunning timer box swaps its colours, slow at first (2 s), faster toward the hatch,
    // never more than 2 swaps a second; a hospital egg's RCAV starts it slow again; reduced motion: still, inverted for
    // the last third
    const inv = (hospital, rcavAt) => ev(`(() => { __et.start(1, { hospital: ${hospital} }); let n = null;
      for (let i = 0; i < 4000 && !(n = __et.snapshot().nests.find(x => x.state === 'overtime')); i++) __et.advance(0.05);
      if (__et.paused()) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const t0 = __et.snapshot().time, c = document.querySelector('.nest[data-id="' + n.id + '"] .readout .clock'), seen = [];
      let rcav = null, bg = null;
      for (let k = 0; k < 600; k++) { const s = __et.snapshot().nests.find(x => x.id === n.id); if (!s || s.state !== 'overtime') break;
        if (${rcavAt} > 0 && rcav === null && s.winShare !== null && __et.snapshot().time - t0 >= ${rcavAt}) { __et.submit('RCAV ' + n.unit); rcav = __et.snapshot().time - t0; }
        seen.push([__et.snapshot().time - t0, c.classList.contains('inv'), s.winShare]);
        if (!bg && c.classList.contains('inv')) { const a = getComputedStyle(c); bg = [a.backgroundColor, a.color]; }
        __et.advance(0.02); }
      return { seen, rcav, bg }; })()`);
    const swaps = (seen) => seen.slice(1).filter((x, i) => x[1] !== seen[i][1]).map((x) => x[0]);
    const r1 = await inv(0, 0), s1 = swaps(r1.seen), gaps = s1.map((x, i) => x - (i ? s1[i - 1] : 0));
    let worst = 0;
    for (let i = 0; i < s1.length; i++) { let k = 0; for (let j = i; j < s1.length && s1[j] < s1[i] + 1 - 1e-6; j++) k++; worst = Math.max(worst, k); }
    ok(s1.length >= 3 && Math.abs(gaps[0] - 2) < 0.06 && gaps.every((g) => g >= 0.5 - 0.03) && gaps[gaps.length - 1] < gaps[0] && worst <= 2,
      `Chat (2026-10-03, K): an overrunning timer box swaps its colours, the first after 2 s, then faster toward the hatch; SAFETY never under 0.5 s, at most 2 swaps in any second   [gaps ${gaps.map((g) => g.toFixed(2)).join(" ")} s; worst ${worst}]`);
    eq(r1.bg, ["rgb(255, 255, 255)", "rgb(209, 0, 106)"], "…to the inverse: pink figures on white (5:1, as the white on pink)");
    const r2 = await inv(1, 3), s2 = swaps(r2.seen).filter((x) => x > r2.rcav);
    ok(r2.rcav !== null && s2.length >= 1 && Math.abs(s2[0] - r2.rcav - 2) < 0.06, `…and a hospital egg's RCAV, restarting its countdown at 12 s, starts the swaps slow again (and steady between: no stray swap)   [first swap ${s2.length ? (s2[0] - r2.rcav).toFixed(2) : "-"} s after the RCAV]`);
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const r3 = await inv(0, 0), s3 = swaps(r3.seen);
    ok(s3.length === 1 && r3.seen.every((x) => x[1] === (x[2] >= 2 / 3)), `…with reduced motion no swapping: plain, then inverted and still for the last third   [${s3.length} change]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
  }
  {
    // Chat's playtest rulings (2026-10-02): a VS refusal egg's "Patient Refused" bubble, from the pop to its RCAV
    await ev("(() => { __et.start(1, { hospital: 0 }); __et.advance(0.1); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return 1; })()");
    const r = (await snap()).nests.find((x) => x.state === "laying");
    const q = (sel) => `document.querySelector('.nest[data-id="${r.id}"]${sel}')`;
    eq([r.code, r.hospital, await ev(`${q(" .refused")}.hidden`)], ["VS", false, true], "a VS refusal egg: no bubble while it's still on the cord");
    await ev(`(() => { for (let i = 0; i < 200 && __et.snapshot().nests.find(n => n.id === ${r.id}).state !== 'active'; i++) __et.advance(0.05); return 1; })()`);
    const bub = await ev(`(() => { const e = ${q(" .refused")}, b = e.getBoundingClientRect(), t = ${q(" .clock")}.getBoundingClientRect(), ro = [...${q("")}.querySelectorAll('.readout > span')].map(x => x.getBoundingClientRect());
      const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
      return { shown: !e.hidden && e.offsetWidth > 30, text: e.textContent, above: e.parentNode.classList.contains('readout'), spot: e.classList.contains('tab-b') ? 'below the timer' : e.style.left !== '' ? 'the shoulder' : 'right of the timer', onReadout: ro.some(x => hit(b, x)), sign: ${q(" .hsign")}.hidden,
        bg: getComputedStyle(e).backgroundColor, ink: getComputedStyle(e).color, anim: getComputedStyle(e).animationName, z: Number(getComputedStyle(e).zIndex) < Number(getComputedStyle(${q(" .mess")}).zIndex) }; })()`);
    ok(bub.shown && bub.text === "PatientRefused" && bub.anim === "refused-in, mark-bounce" && bub.sign, `…from the pop: the bubble reads "Patient Refused" (no H sign), fading in   [${bub.text}, ${bub.anim}]`);
    ok(bub.above && !bub.onReadout && bub.z, `…a tab on its timer box (Chat, 2026-10-03, G), else on the shoulder; clear of every readout box, and the gunk covers it as it covers the H sign (E14)   [${bub.spot}; ${[bub.above, bub.onReadout, bub.z]}]`);
    {
      // live play really places it (not only the rigs' hook): once the nests' unlock pops are over, it has a spot
      let placed = false;
      for (let i = 0; i < 40 && !placed; i++) { await wait(50); placed = await ev(`(ET.view.markState().find(m => m && m.id === ${r.id}) || {}).placed === true`); }
      ok(placed, "…placed by the game itself in live play, once the unlock pops are over (G fix: placement used to wait for a class that never went)");
    }
    eq([bub.bg, bub.ink], ["rgb(255, 182, 39)", "rgb(42, 26, 0)"], "Chat (2026-10-03, B): …amber with dark lettering (no white fill; not red, pink or green)");
    await ev(`(() => { for (let i = 0; i < 1200 && __et.snapshot().nests.find(n => n.id === ${r.id}).state !== 'overtime'; i++) __et.advance(0.05); return 1; })()`);
    eq(await ev(`${q(" .refused")}.hidden`), false, "…still there while it cracks");
    await ev(`(document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })), __et.submit('RCAV ${r.unit}'), __et.advance(0.01), 1)`);
    eq(await ev(`${q(" .refused")}.hidden`), true, "…and gone once the RCAV is accepted");
    // another type gets neither the H sign nor the bubble
    const other = await ev(`(() => { __et.start(1, { hospital: 1, eggTypes: "bag" }); let n = null;
      for (let i = 0; i < 4000 && !(n = __et.snapshot().nests.find(x => x.state === 'active' && x.code !== 'VS')); i++) __et.advance(0.05);
      if (!n) return null; const e = document.querySelector('.nest[data-id="' + n.id + '"]');
      return [n.code, n.hospital, e.querySelector('.hsign').hidden, e.querySelector('.refused').hidden]; })()`);
    ok(!!other && other[0] !== "VS" && other[1] === false && other[2] && other[3], `…another CAV type gets neither the H sign nor the bubble, even with every VS a hospital egg   [${other}]`);
  }
  {
    // Chat (2026-10-03, combined batch Part 2): a VF fuels: FUELING in its timer box, its pump in the egg; DONE in green as
    // it goes bold (the RCAV window opens then), then the ordinary pink timer. Its clock runs on, hidden.
    // (Chat, 2026-10-03, E: VF is out of play; this scene switches it back on to keep its timer box and pump tested)
    const vf = await ev(`(() => { window.__vfWas = ET.CONFIG.vfInPlay; ET.CONFIG.vfInPlay = true; __et.start(1, { hospital: 0, eggTypes: "bag" }); let n = null;
      const clr = (keep) => __et.snapshot().nests.filter(x => x.state === 'overtime' && x.id !== keep).forEach(x => { __et.submit('RCAV ' + x.unit); if (x.hospital) __et.submit('CAV ' + x.unit + ' STR'); });
      for (let i = 0; i < 20000 && !(n = __et.snapshot().nests.find(x => x.state === 'active' && x.code === 'VF')); i++) { __et.advance(0.05); clr(-1); }
      if (!n) return null; __et.advance(0.5); clr(n.id);
      const e = document.querySelector('.nest[data-id="' + n.id + '"]'), q = (s) => e.querySelector(s);
      const e0 = __et.snapshot().nests.find(x => x.id === n.id).elapsed; __et.advance(2); const e1 = __et.snapshot().nests.find(x => x.id === n.id).elapsed;
      return { id: n.id, unit: n.unit, text: q('.clock').textContent, unitShown: q('.unit').textContent === n.unit, code: q('.code').textContent,
        ink: getComputedStyle(q('.clock')).color, fits: q('.clock').scrollWidth <= q('.clock').clientWidth + 0.5, pump: getComputedStyle(q('.pump')).display, runs: e1 > e0,
        early: (__et.submit('RCAV ' + n.unit) || {}).early }; })()`);
    ok(!!vf && vf.text === "FUELING" && vf.unitShown && vf.code === "VF" && vf.ink === "rgb(155, 134, 168)" && vf.fits, `a VF fuels: its timer box says a dim FUELING (fitting the box); the unit and "VF" stay   [${vf && vf.text}]`);
    ok(!!vf && vf.pump === "inline" && vf.runs && vf.early === true, "…its alien pump stands in the egg; its clock runs on, hidden, and an RCAV now is \"Too Early!\"");
    const done = await ev(`(() => { const id = ${vf.id}; for (let i = 0; i < 40000 && __et.snapshot().nests.find(n => n.id === id).state !== 'overtime'; i++) {
        __et.advance(0.05); __et.snapshot().nests.filter(n => n.state === 'overtime' && n.id !== id).forEach(n => { __et.submit('RCAV ' + n.unit); if (n.hospital) __et.submit('CAV ' + n.unit + ' STR'); }); }
      const e = document.querySelector('.nest[data-id="' + id + '"]'), c = e.querySelector('.clock');
      const a = { text: c.textContent, bg: getComputedStyle(c).backgroundColor, anim: getComputedStyle(c).animationName, out: getComputedStyle(e.querySelector('.pump')).animationName, since: __et.snapshot().nests.find(n => n.id === id).sinceBold };
      __et.advance(ET.CONFIG.vfDoneSeconds + 0.05);
      const b = { text: c.textContent, bg: getComputedStyle(c).backgroundColor, pump: getComputedStyle(e.querySelector('.pump')).display };
      return { a, b }; })()`);
    ok(done.a.text === "DONE" && done.a.bg === "rgb(36, 196, 90)" && done.a.anim === "fuel-done" && done.a.out === "pump-out" && done.a.since < 0.1, `…as it goes bold the box turns green and says DONE with one soft pulse, and the pump pulls out   [${done.a.text}, ${done.a.bg}]`);
    ok(/^\d\d:\d\d$/.test(done.b.text) && done.b.bg === "rgb(209, 0, 106)" && done.b.pump === "none", `…then, after ${await ev("ET.CONFIG.vfDoneSeconds")} s, the ordinary pink bold timer   [${done.b.text}, ${done.b.bg}]`);
    ok((await ev(`(__et.submit('RCAV ${vf.unit}') || {}).ok`)) === true, "…and an RCAV clears it, as any egg");
    await ev("(ET.CONFIG.vfInPlay = window.__vfWas, 1)");
  }
  {
    // Chat (2026-10-03): an AD egg's "Clear @ HH:MM" note, back, stuck on beside its nest, from the pop until it's cleared
    const ad = await ev(`(() => { __et.start(1, { hospital: 0, eggTypes: "bag" }); let n = null;
      for (let i = 0; i < 6000 && !(n = __et.snapshot().nests.find(x => x.state === 'active' && x.code === 'AD')); i++) __et.advance(0.05);
      if (!n) return null; __et.advance(0.05);
      const e = document.querySelector('.nest[data-id="' + n.id + '"] .postit'), cs = getComputedStyle(e), hm = e.querySelector('.led-hm'), lbl = e.querySelector('.led-text');
      const at = n.note.at, want = String(Math.floor(at / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(at / 60) % 60).padStart(2, '0');
      return { id: n.id, unit: n.unit, shown: !e.hidden && e.offsetWidth > 40, text: e.textContent, want: 'Clear @ ' + want, side: e.className,
        hmFont: getComputedStyle(hm).fontFamily, hmColor: cs.color, lblFont: getComputedStyle(lbl).fontFamily, bg: cs.backgroundColor, tilt: cs.transform !== 'none',
        z: Number(cs.zIndex) < Number(getComputedStyle(document.querySelector('.nest[data-id="' + n.id + '"] .mess')).zIndex) }; })()`);
    {
      let placed = false;
      for (let i = 0; i < 40 && !placed; i++) { await wait(50); placed = await ev(`ET.view.notePlaced(${ad.id})`); }
      ok(placed, "…and the game places the note itself in live play (G fix)");
    }
    ok(!!ad && ad.shown && ad.text === ad.want, `an AD egg shows its "Clear @ HH:MM" note from the pop   [${ad && ad.text}]`);
    ok(!!ad && /DSEG7/.test(ad.hmFont) && ad.hmColor === "rgb(57, 255, 20)" && /Fredoka/.test(ad.lblFont) && ad.bg === "rgb(43, 42, 46)" && ad.tilt && ad.z, `…HH:MM in the wall clock's green 7-segment face, "Clear @" in cream rounded lettering, on charcoal, tilted, under the gunk (E14)   [${ad && ad.side}]`);
    // the rest of the board is cleared as it goes bold, so the game lasts until the AD's minute (a pool can't run dry)
    await ev(`(() => { for (let i = 0; i < 40000 && __et.snapshot().nests.find(n => n.id === ${ad.id}).state !== 'overtime'; i++) {
      __et.advance(0.05); __et.snapshot().nests.filter(n => n.state === 'overtime' && n.id !== ${ad.id}).forEach(n => { __et.submit('RCAV ' + n.unit); if (n.hospital) __et.submit('CAV ' + n.unit + ' STR'); }); } return 1; })()`);
    const wall = await ev(`(() => { const s = __et.snapshot(); return [Math.floor(s.wall / 60) % 1440, document.querySelector('.nest[data-id="${ad.id}"] .postit').hidden]; })()`);
    const [hh, mm] = ad.want.slice(8).split(":").map(Number);
    ok(wall[0] === hh * 60 + mm && wall[1] === false, `…it goes bold as the wall clock reaches it, the note still up   [${ad.want}]`);
    await ev(`(__et.submit('RCAV ${ad.unit}'), __et.advance(0.01), 1)`);
    eq(await ev(`document.querySelector('.nest[data-id="${ad.id}"] .postit').hidden`), true, "…and it goes with the clear");
  }
  {
    // creepy Mom from wave 2 (momSweetUntilWave), and a pause holds her
    const kind = await ev(`(() => { const was = ET.CONFIG.momSweetUntilWave; ET.CONFIG.momSweetUntilWave = 0; __et.start(1, { hospital: 1 }); __et.advance(0.1);
      let n = null; for (let i = 0; i < 1200 && !(n = __et.snapshot().nests.find(x => x.state === 'overtime')); i++) __et.advance(0.05);
      __et.submit('RCAV ' + n.unit); __et.submit('CAV ' + n.unit + ' STR'); __et.advance(0.01); ET.CONFIG.momSweetUntilWave = was;
      const m = document.querySelector('#popups .mom-visit'); return m ? [m.className, m.querySelectorAll('img[src*="mom-creepy--"]').length] : null; })()`);
    eq(kind, ["mom-visit creepy", 6], "E55: creepy Mom from wave 2 on, her own kit");
    const held = await ev(`new Promise((done) => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const look = () => { const m = document.querySelector('#popups .mom-visit'); return m ? m.dataset.pose + ' ' + m.querySelector('.mom-rig').style.transform + ' ' + m.querySelector('.mom-head').style.transform : null; };
      const was = look();
      setTimeout(() => { const n = ET.view.momFixes().length, now = look();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); done([n, now === was]); }, 2200); })`);
    eq(held, [1, true], "a pause holds her, however long it lasts");
  }
  {
    // Mom kit: creepy Mom's drool and its splat, code-drawn, at a nest she reaches from an edge with a clear landing
    await ev("(() => { __et.start(4, { hospital: 0 }); __et.advance(0.1); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); document.querySelectorAll('.nest').forEach(n => n.classList.remove('inactive', 'unlock')); return 1; })()");
    const drool = (reduced) => ev(`(() => {
      const fl = document.querySelector('.floor-mess'); ET.mess.clear(fl);
      let id = -1, plan = null;
      for (let i = 0; i < 12 && id < 0; i++) { const p = ET.view.momPlan(i, 'creepy'); if (!p.fallback && p.drool.land) { id = i; plan = p; } }
      if (id < 0) return null;
      const T = ET.CONFIG.momRepairSeconds; let at = 0;
      const to = (u) => { __et.advance((u - at) * T); at = u; const m = document.querySelector('#popups .mom-visit.creepy');
        const vis = (s) => !!m && [...m.querySelectorAll('.mom-drool ' + s)].some(e => getComputedStyle(e).visibility === 'visible');
        return { pose: m && m.dataset.pose, strand: vis('.strand'), drop: vis('.mom-drop.falling'), tongue: !!m && !!m.querySelector('.mom-pose.giggle').style.filter, splat: !!(ET.view.momFixes().find((x) => x.kind === 'creepy') || { drool: {} }).drool.splat }; };
      ET.view.momVisit(id, 'creepy');
      const bobs = [];
      const s = [to(0.45 / T), to(0.82 / T), to(0.96 / T)];
      for (let k = 0; k <= 12; k++) { to((1.21 + k * 0.045) / T); bobs.push(document.querySelector('#popups .mom-visit.creepy .mom-head').style.transform); }
      s.push(to(1.75 / T));
      const glow = (() => { const m = document.querySelector('#popups .mom-visit.creepy .mom-drool'); return m ? getComputedStyle(m).filter : ''; })();
      s.push(to(2.15 / T));
      // the splat's glow on the floor canvas: none of it over any nest, readout, sign, timer, the sink tag or the trough
      const flr = fl.getBoundingClientRect(), fld = document.getElementById('field').getBoundingClientRect(), kx = fl.width / flr.width, ky0 = fl.height / flr.height;
      const px = fl.getContext('2d').getImageData(0, 0, fl.width, fl.height).data;
      let onObstacle = 0, purple = 0;
      const obs = plan.obstacles.all.concat(plan.obstacles.own).concat([document.querySelector('#trough .t-left'), document.querySelector('#trough .t-right'), document.querySelector('#trough .t-bl')].filter(Boolean).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left - fld.left, t: r.top - fld.top, r: r.right - fld.left, b: r.bottom - fld.top }; }));
      for (let y = 0; y < fl.height; y += 2) for (let x = 0; x < fl.width; x += 2) {
        const i = (y * fl.width + x) * 4; if (!px[i + 3]) continue;
        if (px[i + 2] > px[i + 1] + 60 && px[i] > px[i + 1] + 30) purple++;
        const fx = x / kx + (flr.left - fld.left), fy = y / ky0 + (flr.top - fld.top);
        if (obs.some((o) => fx > o.l && fx < o.r && fy > o.t && fy < o.b)) onObstacle++;
      }
      const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b, box = plan.drool.land.box;
      const clear = !plan.obstacles.all.concat(plan.obstacles.own).some((o) => hit(box, o)) && box.l >= plan.floor.l && box.r <= plan.floor.r && box.t >= plan.floor.t && box.b <= plan.floor.b;
      const cov = ET.mess.coverage(fl);
      // wash it off as the hose would any goo: the floor's own wipe over where it landed
      const fr = fl.getBoundingClientRect(), f = document.getElementById('field').getBoundingClientRect(), k = fl.width / fr.width, ky = fl.height / fr.height;
      for (let y = box.t; y <= box.b; y += 6) ET.mess.wipe(fl, (box.l - (fr.left - f.left)) * k, (y - (fr.top - f.top)) * ky, (box.r - (fr.left - f.left)) * k, (y - (fr.top - f.top)) * ky, 8 * k);
      const after = ET.mess.coverage(fl);
      __et.advance(0.2);
      ET.view.momVisit(id, 'sweet');
      const sweet = document.querySelector('#popups .mom-visit.sweet');
      return { id, s, clear, cov, after, glow, onObstacle, purple, bobs: [...new Set(bobs)].length, fill: getComputedStyle(document.documentElement).getPropertyValue('--mom-drool').trim(),
        sweetDrool: !!(sweet && sweet.querySelector('.mom-drool')), sweetTongue: !!(sweet && sweet.querySelector('.mom-pose.giggle').style.filter),
        defs: document.querySelectorAll('.mom-defs').length }; })()`);
    const d = await drool(false);
    ok(!!d, "Mom kit: some nest has an edge entry and a clear landing for the drool");
    if (d) {
      eq(d.s.map((x) => [x.pose, x.strand, x.splat]).concat([d.s[2].drop]), [["down", false, false], ["face", true, false], ["face", true, false], ["giggle", false, true], ["face", false, true], true],
        `Mom kit: creepy Mom drools in pose B only: the strand, then the drop falling, then the splat where it lands   [nest ${d.id}]`);
      ok(d.fill === "#b04dff" && d.purple > 50 && /drop-shadow/.test(d.glow), `Chat's colour ruling: the drool, the drop and the splat are glowing purple, a halo that follows the shapes   [${d.fill}, ${d.purple} purple px, ${d.glow}]`);
      eq(d.onObstacle, 0, "Chat's colour ruling: the splat's glow, like the splat, touches no nest, readout, sign, timer, the sink tag or the trough");
      ok(d.bobs > 3, `Chat's giggle ruling: pose C bobs gently while it's held   [${d.bobs} heights]`);
      ok(d.clear && d.cov > 0, `Mom kit: the splat lands on the floor, clear of every nest, readout, sign, timer, the sink tag and the trough   [coverage ${(d.cov * 100).toFixed(2)}%]`);
      ok(d.after < d.cov * 0.05, `Mom kit: …and washes off like any goo (the floor's own wipe)   [${(d.cov * 100).toFixed(2)}% → ${(d.after * 100).toFixed(2)}%]`);
      eq(d.sweetDrool, false, "Mom kit: sweet Mom never drools");
      eq(d.s.map((x) => x.tongue), [false, false, false, true, false], "Mom kit: creepy Mom's tongue wobbles (its warp filter) while she giggles, pose C only");
      eq([d.sweetTongue, d.defs], [false, 0], "Mom kit: â€¦never sweet Mom's, and its filter goes when she does");
      if (SHOTS) {   // to look at: the glowing purple strand and drop, then the splat
        await ev(`(__et.advance(0.3), ET.view.momVisit(${d.id}, 'creepy'), __et.advance(0.9), 1)`);
        await shot("08c-creepy-drool");
        await ev("(__et.advance(1.25), 1)");
        await shot("08d-creepy-splat");
        await ev("(__et.advance(0.2), ET.mess.clear(document.querySelector('.floor-mess')), 1)");
      }
    }
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const r = await drool(true);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
    ok(!!r && r.s.every((x) => !x.strand && !x.drop) && !r.s[1].splat && r.s[2].splat, `SAFETY: under reduced motion no strand, no falling drop; the splat is simply there once it would have landed   [${r && r.s.map((x) => x.splat).join(",")}]`);
    ok(!!r && r.bobs === 1 && JSON.stringify(r.s.map((x) => x.tongue)) === "[false,false,false,true,false]", `Chat's giggle ruling: under reduced motion pose C doesn't bob, and the tongue wobbles for the whole hold   [${r && r.bobs} heights]`);
  }
  {
    // E56: the placeholder giggles sit under THONG (rendered offline, each alone)
    const g = await ev(`Promise.all([ET.audio.measure('thong', [], 1), ET.audio.measure('giggle', ['sweet'], 1), ET.audio.measure('giggle', ['creepy'], 1)]).then(r => r.map(x => [x.peak, x.active]))`);
    ok(g[1][0] > 1e-3 && g[2][0] > 1e-3 && g[1][0] < g[0][0] && g[2][0] < g[0][0] && g[1][1] < g[0][1] && g[2][1] < g[0][1],
      `E56: Mom's giggles, sweet and creepy, sound under THONG   [peak ${g[1][0].toFixed(3)} / ${g[2][0].toFixed(3)} vs ${g[0][0].toFixed(3)}]`);
  }
  {
    // the fonts the game bundles (the wall clock's DSEG7, and Patrick Hand and Fredoka, still served)
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
    // E30 (ruled 2026-09-24): no side panel in play; the board takes its width
    const gone = await ev(`(() => { const p = document.querySelector('#howto'), f = document.querySelector('#field').getBoundingClientRect();
      return { inPlay: !!p.closest('#screen-play'), w: p.getBoundingClientRect().width, right: innerWidth - f.right }; })()`);
    ok(!gone.inPlay && gone.w === 0 && gone.right < 20, `E30: no side panel in play; the board runs to the right edge   [${gone.right}px spare]`);
    {
      // E28: the Command Lines' grey hint, and the switching hints just under the lines
      const cl = await ev(`(() => { const i = document.querySelector('#console .box input'), h = document.querySelector('#line-hints'), hr = h.getBoundingClientRect();
        const boxes = [...document.querySelectorAll('#console .box')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getBoundingClientRect());
        const c = document.querySelector('#console').getBoundingClientRect();
        return { ph: i.placeholder, phColour: getComputedStyle(i, '::placeholder').color, count: __et.boxes().count, text: h.textContent.replace(/\\s+/g, ' ').trim(),
                 under: boxes.every(b => hr.top >= b.bottom + 12), inside: hr.bottom <= c.bottom && hr.left >= c.left, fits: h.scrollWidth <= h.clientWidth + 1 }; })()`);
      eq([cl.ph, cl.phColour], ["RCAV + unit", "rgb(111, 102, 135)"], "E28: an empty Command Line shows a grey \"RCAV + unit\"");
      const want = (cl.count > 1 ? "TAB / SHIFT+TAB next / previous line (keeps what you typed) · F12 next line, cleared" : "F12 clears the line") + " · ESC pause";
      ok(cl.text === want && cl.under && cl.inside && cl.fits, `E28 and E30: the Tab / F12 / Esc hints sit just under the Command Lines, below the ERROR line, on one line   [${cl.count} lines: ${cl.text}]`);
      const typed = await ev("(() => { const i = document.querySelector('#console .box.active input'); i.value = 'R'; const shown = i.matches(':placeholder-shown'); i.value = ''; return shown; })()");
      eq(typed, false, "…and the grey hint is gone as soon as the player types");
    }
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
  eq(await ev("ET.audio.state()"), "running", "sound is unlocked by the first key press");
  await ev("__et.start(1, { hospital: 0 })");
  await ev("__et.advance(0.2)");
  {
    // Hose ruling (2026-09-22): in-game the cursor is always the nozzle; menus keep the normal pointer
    const cur = (sel) => ev(`getComputedStyle(document.querySelector('${sel}')).cursor`);
    const drawn = await ev("(() => { document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 700, clientY: 400 })); return !document.querySelector('#nozzle').hidden; })()");
    ok((await cur("#field")) === "none" && (await cur(".box.active input")) === "none" && drawn, "in-game the cursor is always the hose nozzle (board, Command Line): E44 draws it, the system cursor hidden");
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
      return { text: t.textContent.replace(/\\s+/g, ' ').trim(), mouse: !!t.querySelector('svg.mouse'), sink: !!t.querySelector('svg.sink .drain'), shown: r.width > 0, nearTap: r.left - p.right < 30 && r.left >= p.right - 1 && f.bottom - r.bottom >= 0 && f.bottom - r.bottom < 22 }; })()`);   // E38: raised just clear of the trough
    ok(tag.shown && tag.text === "CLEANING HOSE: click & drag to spray. Use it any time!" && tag.mouse && tag.sink, `E28: a small sink with a drain beside the spigot carries the hose's instructions   [${tag.text}]`);
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
  {
    // E30 (ruled): the hint in the empty Command Line; E53: "CAV + unit + type" while a hospital egg waits for its STR
    const ph = () => ev("document.querySelector('#console .box input').placeholder");
    eq(await ph(), "RCAV + unit", "E30: with no hospital egg waiting for its STR the empty line says \"RCAV + unit\"");
    const w = await ev(`(() => { __et.start(1, { hospital: 1 }); __et.advance(0.1);
      let t = null; for (let i = 0; i < 1200 && !(t = __et.snapshot().nests.find(n => n.state === 'overtime')); i++) __et.advance(0.05);
      const before = document.querySelector('#console .box input').placeholder;
      __et.submit('RCAV ' + t.unit); __et.advance(0.01);
      const during = document.querySelector('#console .box input').placeholder;
      __et.submit('CAV ' + t.unit + ' STR'); __et.advance(0.01);
      return { t: !!t, before, during, after: document.querySelector('#console .box input').placeholder }; })()`);
    ok(w.t && w.before === "RCAV + unit" && w.during === "CAV + unit + type" && w.after === "RCAV + unit", `E53: while a hospital egg waits for its STR it says "CAV + unit + type", and "RCAV + unit" again once none waits   [${w.before} → ${w.during} → ${w.after}]`);
  }
  ok(await ev("(() => { const t = document.querySelector('#screen-setup').innerText; return /Command Lines/.test(document.querySelector('#screen-setup h2').textContent) && !/Command Box/i.test(t); })()"), "E7: players see \"Command Line\" on the setup screen, never \"Command Box\" (E29's heading)");
  eq([await ev("'FRIED' in ET.art"), await ev("ET.art.DISHES")], [false, 7], "the egg ladder replaces the fried eggs: seven dishes, no fried-egg art");
  await ev("__et.start(1, { hospital: 0 })");
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
    ok(cb.shown && /^WAVE 1 CLEAR.*CLEAN-UP TIME! \d+Hose down the mess before the next wave\.$/.test(cb.text), `Refinement 3 §3 and E28: a cleanup banner shows "CLEAN-UP TIME! Hose down the mess before the next wave."   [${cb.text}]`);
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
    ok(await ev("document.querySelector('#howto').getBoundingClientRect().width === 0"), "E30: no side panel during cleanup either");
    ok(await ev("getComputedStyle(document.querySelector('#howto-title')).display === 'none' || document.querySelector('#screen-title').hidden"), "…and the title's How To Play card is only on the title screen");
    await shot("12a-cleanup-banner");
    eq(await ev("getComputedStyle(document.querySelector('#field')).cursor === 'none' && !document.querySelector('#nozzle').hidden"), true, "during cleanup the cursor is the hose nozzle too");
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
  section("W. wave 1's first-game tag (E28; E54 took the wall-clock tag)");
  {
    // every clear right at its bold
    const run = await ev(`(() => {
      __et.start(1, { hospital: 0 }); __et.advance(0.1);
      const out = { ready: null, clock: null, readyAgain: false, clockAgain: false, hitNest: 0, anim: [], after: null, wave2: false };
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const covers = (el) => { const r = el.getBoundingClientRect(); return [...document.querySelectorAll('.nest')].filter(n => hit(r, n.getBoundingClientRect()) || hit(r, n.querySelector('.readout').getBoundingClientRect())).length; };
      for (let i = 0; i < 20000 && __et.snapshot().wave < 3; i++) {
        __et.advance(0.05);
        const s = __et.snapshot(), t = ET.view.tips();
        if (t[0].shown && !out.ready) { const b = s.nests.find(n => n.id === t[0].nest); out.ready = { text: t[0].text, unit: b && b.unit, bold: b && b.state === 'overtime', line: !!t[0].line, pink: getComputedStyle(document.querySelector('#tip-ready')).backgroundColor }; out.hitNest += covers(document.querySelector('#tip-ready')); out.anim.push(getComputedStyle(document.querySelector('#tip-ready')).animationName); }
        if (out.ready && out.after === null && !t[0].shown) out.after = true;
        if (out.ready && out.after && t[0].shown) out.readyAgain = true;
        if (s.wave >= 2 && t[0].shown) out.wave2 = true;
        s.nests.filter(n => n.state === 'overtime').forEach(n => __et.submit('RCAV ' + n.unit));
      }
      return out;
    })()`);
    ok(!!run.ready && run.ready.bold && run.ready.text === "Pink = ready! Type RCAV " + run.ready.unit && run.ready.line, `E28: in wave 1 the first egg to go bold gets a tag, with a leader line to it   [${run.ready && run.ready.text}]`);
    eq(run.ready && run.ready.pink, "rgb(209, 0, 106)", "…in the bold timer's pink (E33)");
    eq([await ev("ET.view.tips().length"), await ev("!!document.querySelector('#tip-clock')")], [1, false], "E54: the \"Check the wall clock\" tag is gone with AD's notes");
    eq(run.hitNest, 0, "E28: the tag covers no nest or readout");
    ok(run.after === true && !run.readyAgain && !run.wave2, "E28: the ready tag goes when that egg is cleared, and doesn't come back that game (wave 2 included)");
    ok(run.anim.length === 1 && run.anim.every((a) => a === "none"), `E28: it doesn't flash   [${run.anim.join(", ")}]`);
    await shot("17-first-game-tags");
  }

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
  await ev("__et.start(1, { hospital: 0 })");
  const o = await until((x) => x.phase === "over", 400, 1);
  ok(!!o.hit, "an empty pool ends the game");
  for (let i = 0; i < 80 && (await ev("__et.screen()")) !== "over"; i++) await wait(100);   // the hatch's 3.2 s + 0.5 s
  eq(await ev("__et.screen()"), "over", "the end screen follows the last escape");
  eq(await ev("document.querySelector('#over-score').textContent"), String(o.s.score), "it shows the final score");
  ok(/^SKIPPED SPAWNS  W1 \d+/.test(await ev("document.querySelector('#over-skipped').textContent")), `the playtest log lists skipped spawns per wave   [${await ev("document.querySelector('#over-skipped').textContent")}]`);
  await shot("09-over");
  {
    // Andrew, 2026-10-01: no How To Play on the game-over screen
    const g = await ev("(() => { const p = document.querySelector('#howto'), s = document.querySelector('#screen-over'); return { inside: s.contains(p), shown: p.getBoundingClientRect().width > 0, padded: s.classList.contains('with-howto') }; })()");
    eq(g, { inside: false, shown: false, padded: false }, "Andrew, 2026-10-01: the game-over screen has no How To Play");
  }
  // (the panel's lines (Goal, Esc) and its doodles showed only here; the options screen shows the comic strip in their place,
  // so since 2026-10-01 they show nowhere, and their checks went with them)
  {
    // the game-over screen (music ruling, 2026-09-25): a clear way back to the title screen, and play again
    const ob = await ev("({ words: [...document.querySelectorAll('#over-buttons button')].map(b => b.textContent), lit: document.querySelector('#over-buttons .selected').dataset.go, def: ET.CONFIG.overDefault })");
    eq([ob.words, ob.lit], [["TITLE SCREEN", "PLAY AGAIN"], ob.def], "game over has two buttons, TITLE SCREEN and PLAY AGAIN, the default one lit (E34)");
    await press("ArrowRight");
    eq(await ev("document.querySelector('#over-buttons .selected').dataset.go"), ob.def === "title" ? "again" : "title", "…← → pick the other");
    await press("ArrowLeft");
  }
  eq(await ev("__et.music().want"), "over", "the game-over track plays on the game-over screen");
  {
    // E34: Enter does nothing in the screen's first second (dispatched in the same ev() as the screen appearing), nor
    // on a held key's auto-repeat after it; then a fresh press works (below)
    const key = (rep) => `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', repeat: ${rep}, bubbles: true, cancelable: true }))`;
    const arrow = (k) => `document.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', code: '${k}', bubbles: true, cancelable: true }))`;
    eq(await ev(`(() => { __et.show('over'); ${key(false)}; const early = __et.overEnterIn() > 0.9; ${arrow("ArrowRight")};
      const lit = document.querySelector('#over-buttons .selected').dataset.go; ${arrow("ArrowLeft")}; return [__et.screen(), early, lit]; })()`),
      ["over", true, "again"], "E34: game over ignores Enter in its first second, while ← → pick straight away");
    for (let i = 0; i < 40 && (await ev("__et.overEnterIn()")) > 0; i++) await wait(100);
    eq(await ev(`(() => { ${key(true)}; return __et.screen(); })()`), "over", "…and a held Enter's auto-repeat after it");
  }
  await press("Enter");
  eq(await ev("__et.screen()"), (await ev("ET.CONFIG.overDefault")) === "again" ? "setup" : "title", "Enter presses the lit button: back to the title screen");
  eq(await ev("__et.music().want"), "title", "…and the title music takes over");

  /* ------------------------------------------------------ L. full-board layout */
  section("L. layout: all 12 nests across the whole board (E30: no side panel in play), at every measured size");
  await ev("__et.start(4, { hospital: 0 })");
  await ev("__et.advance(0.1)");
  // measure in the real faces, not the fallback they swap from (the LED faces are wider than Courier)
  await ev(`Promise.all(['16px "Patrick Hand"', '700 16px "DSEG7 Classic"', '700 16px "Fredoka"'].map(f => document.fonts.load(f))).then(() => document.fonts.ready).then(() => 1)`);
  for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 640]]) {
    await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await ev(`(() => { document.querySelectorAll('.nest').forEach(n => n.classList.remove('inactive', 'unlock')); return 1; })()`);
    await wait(150);   // measure settled boxes, not nests mid pop-in (the unlock animation scales them)
    const lay = await ev(`(() => {
      // Refinement 4 §5: every box holds its widest reading (bold, as in overtime), and (E55) every nest its H sign
      document.querySelectorAll('.nest').forEach(n => {
        n.classList.add('bold');
        n.querySelector('.unit').textContent = '8888';
        n.querySelector('.code').textContent = 'STR';
        n.querySelector('.clock').textContent = '88:88';
        n.querySelector('.hsign').hidden = false;
        n.querySelector('.hsign').style.animation = 'none';   // at rest: shown, its drop would start from the top
        ET.mess.splatter(n.querySelector('.mess'), 6);
      });
      const spill = [...document.querySelectorAll('.readout > span')].filter(e => e.scrollWidth > e.clientWidth + 0.5 || e.scrollHeight > e.clientHeight + 0.5).length;
      const f = document.querySelector('#board').getBoundingClientRect();
      const signs = [...document.querySelectorAll('.nest .hsign')].map(e => e.getBoundingClientRect());
      const signsInside = signs.every(r => r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1);
      const signOnReadout = signs.filter(r => [...document.querySelectorAll('.nest .readout')].some(o => { const q = o.getBoundingClientRect(); return r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom; })).length;
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
      // E28: the first-game tag shown at its longest, beside the wall clock, measured with the band
      const tr = document.querySelector('#tip-ready');
      tr.hidden = false; tr.textContent = 'Pink = ready! Type RCAV 8888';
      ET.view.placeTips();
      const tipsIn = [tr].every(t => { const r = t.getBoundingClientRect(), f = document.querySelector('#field').getBoundingClientRect(); return r.left >= f.left && r.right <= f.right && r.width > 40; });
      const top = [...document.querySelectorAll('#fieldtop > *')].map(e => e.getBoundingClientRect());
      const W = document.querySelector('#warp').getBoundingClientRect(), B = document.querySelector('#board').getBoundingClientRect();
      // E50 (Andrew, 2026-10-01, option A): about 1.5× bigger, and where it meets a nest the nest draws over it
      const warpEl = document.querySelector('#warp'), art = warpEl.querySelector('svg.clock-art').getBoundingClientRect();
      const warpBig = art.height / Math.min(0.17 * B.height, 0.30 * B.width);
      const warpBehind = Number(getComputedStyle(warpEl).zIndex) === 0
        && [...document.querySelectorAll('#board > .nest')].every(n => (warpEl.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) && ['auto', '0'].includes(getComputedStyle(n).zIndex) || Number(getComputedStyle(n).zIndex) > 0);
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
      document.querySelectorAll('.nest .hsign').forEach(p => { p.hidden = true; p.style.animation = ''; });
      // Chat (2026-10-02): every nest's "Patient Refused" bubble instead, at rest: clear of every readout, every nest's egg
      // and twigs, the other bubbles, the Command Lines, the trough, the sink's hose tag and the wall clock
      document.querySelectorAll('.nest .refused').forEach(p => { p.hidden = false; p.style.animation = 'none'; });
      ET.view.placeBubbles();   // as each frame places them once they show (Chat, 2026-10-03: off Time Warp's words)
      const flipped = document.querySelectorAll('.nest .refused.flip').length;
      const warpWords = [document.querySelector('#warp .plaque').getBoundingClientRect()];
      { const rg = document.createRange(); rg.selectNodeContents(document.querySelector('#warp .caption')); warpWords.push(...rg.getClientRects()); }
      const bubbles = [...document.querySelectorAll('.nest .refused')].map(e => e.getBoundingClientRect());
      const keepOff = [...document.querySelectorAll('.nest .readout > span, #console .box, #trough > *, #hose-tag, .wallclock')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0)
        .concat(nests.map(x => x.art), warpWords.filter(r => r.width > 0));
      const bubbleBad = bubbles.filter((r, i) => keepOff.some(o => hit(r, o)) || bubbles.some((o, j) => j !== i && hit(r, o)) || r.left < f.left || r.right > f.right).length;
      // G (2026-10-03): every bubble is a tab on its timer box (right of it, else below it), or on the shoulder where neither has room
      const bubSpots = [...document.querySelectorAll('.nest')].map(n => { const e = n.querySelector('.refused'); return e.classList.contains('tab-r') ? 'R' : e.classList.contains('tab-b') ? 'B' : e.style.left !== '' ? 'S' : '?'; });
      const bubbleAbove = !bubSpots.includes('?'), bubbleShoulder = bubSpots.map((x, i) => x === 'S' ? i : null).filter(x => x !== null);
      const bubbleSize = Math.round(Math.min(...bubbles.map(r => r.width)));
      // …and never over its own unit number or timer (above them, whichever shoulder it's on)
      const bubbleOwn = [...document.querySelectorAll('.nest')].every(n => { const b = n.querySelector('.refused').getBoundingClientRect(); return [...n.querySelectorAll('.readout > span')].every(x => !hit(b, x.getBoundingClientRect())); });
      // Chat (2026-10-03, Part 2): every nest fuelling a VF: its pump clear of every readout and every other nest, and
      // FUELING fitting its timer box
      const live0 = ET.view.render, nestEls0 = [...document.querySelectorAll('.nest')]; ET.view.render = () => 0;   // hold the frame while the fake fuelling is measured
      nestEls0.forEach(n => { n.classList.add('fueling'); n.querySelector('.clock').classList.add('fueling'); n.querySelector('.clock').textContent = 'FUELING'; });
      const roAll = [...document.querySelectorAll('.nest .readout > span')].map(e => e.getBoundingClientRect());
      const pumpBad = nestEls0.filter((n, i) => { const p = n.querySelector('.pump').getBoundingClientRect(); return p.width < 20 || roAll.some(r => hit(p, r)) || nests.some((x, j) => j !== i && hit(p, x.art)); }).length;
      const fuelSpill = nestEls0.filter(n => { const c = n.querySelector('.clock'); return c.scrollWidth > c.clientWidth + 0.5 || c.scrollHeight > c.clientHeight + 0.5; }).length;
      const fuelPx = parseFloat(getComputedStyle(nestEls0[0].querySelector('.clock')).fontSize).toFixed(1), pumpPx = Math.round(nestEls0[0].querySelector('.pump').getBoundingClientRect().width);
      nestEls0.forEach(n => { n.classList.remove('fueling'); n.querySelector('.clock').classList.remove('fueling'); n.querySelector('.clock').textContent = '88:88'; });
      ET.view.render = live0;
      // Chat (2026-10-03): the AD "Clear @" note. (A) one at a time, with every other nest's H sign and bubble (either
      // shoulder) up; (B) all 12 at once: never on a readout, a nest, a marker, another note, Time Warp's sign or caption,
      // the trough, the hose tag or the wall clock, and on the board
      // every other nest's marks where the game puts them: the H sign with its hospital, and the bubble with its house
      const marks = [];
      document.querySelectorAll('.nest').forEach(n => ['h', 'r'].forEach(k => {
        const m = n.querySelector(k === 'h' ? '.hsign' : '.refused'); m.hidden = false; m.style.animation = 'none';
        ET.view.placeMarks();
        n.querySelectorAll(k === 'h' ? '.hsign, .bld.hosp' : '.refused, .bld.house').forEach(e => { if (!e.hidden) marks.push({ n, r: e.getBoundingClientRect() }); });
        m.hidden = true; m.style.animation = ''; m.classList.remove('flip'); n.querySelectorAll('.bld').forEach(d => { d.hidden = true; d.classList.remove('flip'); });
      }));
      document.querySelectorAll('.nest .refused').forEach(p => { p.hidden = true; p.style.animation = ''; });
      document.querySelectorAll('.nest .bld').forEach(d => { d.hidden = true; d.classList.remove('flip'); });
      const noteFixed = [...document.querySelectorAll('.nest .readout > span, #console .box, #trough > *, #hose-tag, .wallclock')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0).concat(warpWords.filter(r => r.width > 0));
      const nestEls = [...document.querySelectorAll('.nest')], notes = nestEls.map(n => n.querySelector('.postit'));
      const noteAt = { kind: 'clock', at: 23 * 3600 + 59 * 60 };
      const noteBad = (i, withMarks) => { const r = notes[i].getBoundingClientRect();
        return noteFixed.some(o => hit(r, o)) || nests.some(x => hit(r, x.art)) || (withMarks && marks.some(m => m.n !== nestEls[i] && hit(r, m.r)))
          || notes.some((o, j) => j !== i && !o.hidden && hit(r, o.getBoundingClientRect())) || r.left < f.left || r.right > f.right; };
      let noteOneBad = 0, noteAllBad = 0;
      notes.forEach((p, i) => { notes.forEach(q => { q.hidden = true; }); ET.view.fillNote(i, noteAt); if (noteBad(i, true)) noteOneBad++; });
      notes.forEach(q => { q.hidden = true; });
      notes.forEach((p, i) => ET.view.fillNote(i, noteAt));
      notes.forEach((p, i) => { if (noteBad(i, false)) noteAllBad++; });
      const noteSize = [Math.round(notes[0].getBoundingClientRect().width), Math.round(notes[0].getBoundingClientRect().height)], noteHigh = notes.filter(p => p.classList.contains('high')).length;
      notes.forEach(q => { q.hidden = true; });
      // Chat (2026-10-03, A/B): every nest's H sign or bubble, with its building, placed by the game (placeMarks), at rest:
      // all hospital, all refusal, and the two alternating mixes. Clear of every readout, every other nest, its own egg,
      // Time Warp's sign and caption, the hose tag, the trough, the wall clock, the Command Lines, each other and the edges
      const markRun = (mode) => {
        const ns = [...document.querySelectorAll('.nest')];
        ns.forEach((n, i) => { const k = mode === 'h' ? 'h' : mode === 'r' ? 'r' : ((i + (mode === 'mix1' ? 1 : 0)) % 2 ? 'h' : 'r');
          n.dataset.mk = k; n.querySelector('.hsign').hidden = k !== 'h'; n.querySelector('.refused').hidden = k !== 'r';
          n.querySelectorAll('.hsign, .refused, .bld').forEach(e => { e.style.animation = 'none'; }); });
        // placed while no egg is bold, measured with every one bold (its widest readout): a tab must stay clear (G fix)
        ns.forEach(n => n.classList.remove('bold'));
        ET.view.placeMarks();
        ns.forEach(n => n.classList.add('bold'));
        const items = [];
        ns.forEach(n => n.querySelectorAll('.hsign, .refused, .bld').forEach(e => { if (!e.hidden) items.push({ n, e, r: e.getBoundingClientRect() }); }));
        const ro = [...document.querySelectorAll('.nest .readout > span')].map(e => e.getBoundingClientRect());
        const fx = [...document.querySelectorAll('#hose-tag, #trough > *, .wallclock, #console .box')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0).concat(warpWords.filter(r => r.width > 0));
        const why = [];
        const bad = items.filter(it => { const r = it.r, w = [];
          if (ro.some(o => hit(r, o))) w.push('readout'); if (nests.some((x, j) => ns[j] !== it.n && hit(r, x.art))) w.push('nest'); { const k = fx.findIndex(o => hit(r, o)); if (k >= 0) w.push('fixed#' + k + '@' + [fx[k].left, fx[k].top, fx[k].right, fx[k].bottom].map(Math.round) + ' vs ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); }
          const o2 = items.find(o => o !== it && hit(r, o.r)); if (o2) w.push(o2.n.dataset.id + ':' + o2.e.className);
          if (r.left < f.left - 1 || r.right > f.right + 1 || r.top < f.top - 1) w.push('edge');
          if (w.length && why.length < 3) why.push(it.n.dataset.id + ' ' + it.e.className + ' ' + w.join('+'));
          return w.length; }).length;
        // …and at the bottom of the bounce's dip (Chat, 2026-10-03, C), the most it moves from where it stands
        ns.forEach(n => n.querySelectorAll('.hsign, .refused, .bld').forEach(e => { if (!e.hidden) e.style.transform = 'translateY(7%) scale(1.04, 0.94)'; }));
        const dip = [];
        ns.forEach(n => n.querySelectorAll('.hsign, .refused, .bld').forEach(e => { if (!e.hidden) dip.push({ n, r: e.getBoundingClientRect() }); }));
        const dipBad = dip.filter(it => ro.some(o => hit(it.r, o)) || nests.some((x, j) => ns[j] !== it.n && hit(it.r, x.art)) || fx.some(o => hit(it.r, o)) || dip.some(o => o !== it && hit(it.r, o.r))).length;
        ns.forEach(n => n.querySelectorAll('.hsign, .refused, .bld').forEach(e => { e.style.transform = ''; }));
        const out = { why, bad: bad + dipBad, flips: ns.filter(n => n.querySelector('.hsign.flip, .refused.flip')).map(n => n.dataset.id), skipped: ns.filter(n => n.querySelector(n.dataset.mk === 'h' ? '.bld.hosp' : '.bld.house').hidden).map(n => n.dataset.id),
          sign: Math.round(ns[0].querySelector('.hsign').getBoundingClientRect().width) };
        ns.forEach(n => { n.querySelector('.hsign').hidden = true; n.querySelector('.refused').hidden = true; n.querySelectorAll('.bld').forEach(d => { d.hidden = true; d.classList.remove('flip'); }); n.querySelectorAll('.hsign, .refused, .bld').forEach(e => { e.style.animation = ''; e.classList.remove('flip'); }); });
        return out;
      };
      const markRuns = { h: markRun('h'), r: markRun('r'), mix0: markRun('mix0'), mix1: markRun('mix1') };
      // Chat (2026-10-02): the rejected-Enter message, at its longest, above Time Warp's clock: clear of every nest, readout,
      // Command Line, the trough, the hose tag and the wall clock, and on the board
      const rj = document.querySelector('#reject'), rjWas = rj.textContent;
      rj.hidden = true; ET.view.reject('RCAV first!');   // placed as the game places it (⏳ E60 "drop")
      const rr = rj.getBoundingClientRect(), artBox = document.querySelector('#warp .clock-art').getBoundingClientRect(), artTop = artBox.top;
      const rejectKeep = [...document.querySelectorAll('.nest .readout > span, #console .box, #trough > *, #hose-tag, .wallclock, #warp .plaque, #warp .caption, #warp .face')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
      const rejectHits = rejectKeep.concat(nests.map(x => x.art)).filter(o => hit(rr, o)).length;
      const rejectOk = rr.top >= f.top && rr.left >= f.left && rr.right <= f.right && rr.bottom <= artBox.bottom;
      const faceBox = document.querySelector('#warp .face').getBoundingClientRect(), signBox = document.querySelector('#warp .plaque').getBoundingClientRect();
      const rejectBox = [Math.round(rr.width), Math.round(rr.height)], rejectOnClock = Math.round(signBox.top - faceBox.bottom), clockTall = Math.round(parseFloat(getComputedStyle(rj).fontSize));
      const rejectInWindow = rr.top >= faceBox.bottom && rr.bottom <= signBox.top;
      rj.hidden = true; rj.textContent = rjWas;
      // E24: the mute button in the HUD bar's left end, clear of its words, the wall clock and the board
      const M = document.querySelector('#mute').getBoundingClientRect(), H = document.querySelector('.hud').getBoundingClientRect();
      const hudWords = [...document.querySelectorAll('.hud > div:not(#cleanup)')].map(e => e.getBoundingClientRect());
      const muteClear = M.width > 20 && M.top >= H.top && M.bottom <= H.bottom && !hudWords.concat([clock, field]).some(r => hit(r, M));
      return { bubbleShoulder, markRuns, pumpBad, fuelSpill, fuelPx, pumpPx, rejectInWindow, noteOneBad, noteAllBad, noteSize, noteHigh, flipped, bubbleOwn, rejectHits, rejectOk, rejectBox, rejectOnClock, clockTall, bubbleBad, bubbleAbove, bubbleSize, muteClear, bulbOnWord, tagged, tagIn: tag.left >= f.left && tag.right <= f.right && tag.bottom <= f.bottom + 1, doodled, spill, signsInside, signOnReadout, inside, overlaps, covered, panelGone: howto.width === 0 && innerWidth - field.right < 20, clearOfTop,
               warpBig, warpBehind, warpCentre, tipsIn,
               clockCentre: Math.abs((clock.left + clock.right) / 2 - (field.left + field.right) / 2) < 3 && clock.top < field.top + 30 && clock.right <= field.right,
               w: innerWidth, h: innerHeight };
    })()`);
    const at = `[${lay.w}×${lay.h}]`;
    if (w === 1920) {
      const dim = await ev(`(() => { const n = [...document.querySelectorAll('.nest')].find(x => x.dataset.state === 'idle'); return n ? getComputedStyle(n.querySelector('.readout .unit')).filter : null; })()`);
      ok(!!dim && /brightness\(0\.[0-4]\d*\)|brightness\(0\.45\)/.test(dim), `a blank nest's display boxes are darkened further, reading "not in play"   [${dim}]`);
    }
    eq(lay.spill, 0, `Refinement 4 §5: every box's widest reading fits inside its box   ${at}`);
    ok(lay.signsInside && lay.signOnReadout === 0, `E55: every H sign stays on the board, clear of every readout   ${at} [${lay.signOnReadout} on a readout]`);
    ok(lay.bubbleBad === 0 && lay.bubbleAbove && lay.bubbleOwn && lay.bubbleSize >= 44, `Chat (2026-10-02/03): all 12 "Patient Refused" bubbles are tabs on their timers (G), else on the shoulder, on the board, clear of every readout (their own unit and timer too), nest, Command Line, the trough, the hose tag, the wall clock, each other and Time Warp's sign and caption   ${at} [${lay.bubbleBad} touching, ${lay.bubbleSize} px wide, on the shoulder: ${lay.bubbleShoulder.join(" ") || "none"}]`);
    {
      const m = lay.markRuns;
      ok(Object.values(m).every((x) => x.bad === 0), `Chat (2026-10-03, A and B): the 1.4× H sign or the bigger amber bubble, with its hospital or house, placed by the game, touch no readout, other nest, own egg, Time Warp's words, hose tag, trough, Command Line or each other, all hospital, all refusal and both mixes   ${at} [${Object.entries(m).map(([k, x]) => k + " " + x.bad).join(", ")}; sign ${m.h.sign} px; ${Object.values(m).map((x) => x.why.join(" | ")).filter(Boolean).join(" / ")}; flipped ${m.h.flips.join(" ") || "none"}; hospitals skipped ${m.h.skipped.join(" ") || "none"}; houses skipped ${m.r.skipped.join(" ") || "none"}]`);
    }
    ok(lay.pumpBad === 0 && lay.fuelSpill === 0, `Chat (2026-10-03): every VF's pump stays clear of every readout and every other nest, and FUELING fits its timer box   ${at} [${lay.pumpBad} touching, pump ${lay.pumpPx} px wide, FUELING in ${lay.fuelPx} px type]`);
    ok(lay.noteOneBad === 0 && lay.noteAllBad === 0, `Chat (2026-10-03): the AD "Clear @" note sits beside its nest clear of every readout, nest, H sign, bubble, other note, Time Warp's words, the trough, the hose tag and the wall clock, one at a time with every other nest's sign or bubble and building up where the game puts them, and all 12 at once   ${at} [${lay.noteOneBad} + ${lay.noteAllBad} touching, ${lay.noteSize.join("×")} px, ${lay.noteHigh} on a shoulder with all 12 up]`);
    ok(lay.rejectHits === 0 && lay.rejectOk && lay.rejectInWindow, `E60 (Chat, 2026-10-03): the rejected-Enter plate sits in the clock's pendulum window, below its face (the "5×" label included) and above the TIME WARP sign, clear of the caption, every nest, readout, Command Line, the trough, the hose tag and the wall clock   ${at} [${lay.rejectHits} touching, ${lay.rejectBox.join("×")} px in a ${lay.rejectOnClock} px window, ${lay.clockTall} px type]`);
    ok(lay.inside, `every nest and readout stays inside the board   ${at}`);
    eq(lay.overlaps, 0, `no two readouts overlap   ${at}`);
    eq(lay.covered, 0, `no nest's egg or twigs cover another nest's readout   ${at}`);
    ok(lay.panelGone, `E30: no side panel in play: the board runs to the window's right edge   ${at}`);
    {
      // E28 / E30: the longest grey hint fits in every Command Line (4 lines here), in the hint's own type
      const fit = await ev(`(() => { const cv = document.createElement('canvas').getContext('2d');
        return [...document.querySelectorAll('#console .box')].filter(b => b.getBoundingClientRect().width > 0).map(b => { const i = b.querySelector('input'), cs = getComputedStyle(i, '::placeholder');
          cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; return Math.round(i.clientWidth - cv.measureText('CAV + unit + type').width); }); })()`);
      ok(fit.length === 4 && fit.every((x) => x >= 0), `E30: "CAV + unit + type" fits in each of 4 Command Lines   ${at} [${fit.join(", ")} px spare]`);
    }
    eq(lay.clearOfTop, 0, `the wall clock and the first-game tag (E28) sit clear of every nest   ${at}`);
    ok(lay.tipsIn, `E28: the first-game tag fits on the board beside the wall clock   ${at}`);
    await ev("(() => { document.querySelector('#tip-ready').hidden = true; return 1; })()");
    ok(lay.clockCentre, `Refinement 6 §3: the wall clock is at the top centre of the playing field   ${at}`);
    ok(lay.warpCentre && lay.warpBehind && lay.warpBig > 1.45 && lay.warpBig < 1.55, `E50 (option A): Time Warp's grandfather clock, sign and caption sit in the centre of the board, about 1.5× bigger, every nest and readout drawn over it where they meet   ${at} [×${lay.warpBig.toFixed(2)}]`);
    ok(lay.tagged === 0 && lay.tagIn, `Refinement 5 §6: the hose tag stays on the board and touches no nest or readout   ${at}`);
    ok(lay.muteClear, `E24: the mute button sits in the HUD bar's left end, clear of its words, the wall clock and the board   ${at}`);
    // Mom kit (Chat's brief, 2026-10-02): for every nest, both Moms come in from an edge (nearest first) or, with no
    // edge clear, take E58's fallback inside her own nest; either way her head (upright and turned) and both tentacles
    // (the whole band their S-curve can swing over) cover no other nest, readout, H sign, the wall clock, Time Warp,
    // the sink tag or the trough, and her head covers nothing of her own nest when she comes from an edge
    const mom = await ev(`(() => {
      const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const out = { bad: [], edges: {}, fallback: [] };
      for (const kind of ['sweet', 'creepy']) for (let id = 0; id < 12; id++) {
        const p = ET.view.momPlan(id, kind), c = p.clip;
        const where = kind + ' ' + id;
        if (p.head.l < c.l - 0.5 || p.head.r > c.r + 0.5 || p.head.t < c.t - 0.5 || p.head.b > c.b + 0.5) out.bad.push(where + ' head outside');
        // E58's fallback stays inside her own nest's box: what that box already lies over (Time Warp, drawn under the
        // nests, E50) isn't hers to clear
        p.obstacles.all.forEach((o) => { if (hit(p.head, o) && !(p.fallback && hit(p.nest, o))) out.bad.push(where + ' head'); });
        if (p.fallback) {
          out.fallback.push(id);
          if (p.head.l < p.nest.l - 0.5 || p.head.r > p.nest.r + 0.5 || p.head.t < p.nest.t - 0.5 || p.head.b > p.readout.t + 0.5) out.bad.push(where + ' fallback leaves its nest');
        } else {
          out.edges[p.from] = (out.edges[p.from] || 0) + 1;
          // creepy Mom's splat, where it lands: on the floor and clear, droplets and all
          const land = p.drool && p.drool.land;
          if (land) {
            if (land.box.l < p.floor.l || land.box.r > p.floor.r || land.box.t < p.floor.t || land.box.b > p.floor.b) out.bad.push(where + ' splat off the floor');
            p.obstacles.all.concat(p.obstacles.own).forEach((o) => { if (hit(land.box, o)) out.bad.push(where + ' splat'); });
          }
          p.obstacles.own.forEach((o) => { if (hit(p.head, o)) out.bad.push(where + ' head on its own nest'); });
          p.tents.forEach((t) => {
            for (let s = 0; s <= 40; s++) {
              const x = t.from.x + (t.to.x - t.from.x) * s / 40, y = t.from.y + (t.to.y - t.from.y) * s / 40, r = p.tube / 2;
              const d = { l: x - r, t: y - r, r: x + r, b: y + r };
              p.obstacles.all.forEach((o) => { if (hit(d, o)) out.bad.push(where + ' tentacle'); });
            }
          });
        }
      }
      out.bad = [...new Set(out.bad)];
      out.fallback = [...new Set(out.fallback)].join(',');
      // E58 condition (b): her head's size at every nest, both Moms; and condition (a): no readout under her
      out.heads = [];
      for (const kind of ['sweet', 'creepy']) for (let id = 0; id < 12; id++) {
        const p = ET.view.momPlan(id, kind);
        out.heads.push({ kind, id, w: p.head.r - p.head.l, h: p.head.b - p.head.t, fb: !!p.fallback });
        if (hit(p.head, p.readout)) out.bad.push(kind + ' ' + id + ' head on its own readout');
      }
      return out; })()`);
    ok(mom.bad.length === 0, `Mom kit: both Moms, every nest: her head and tentacles cover no other nest, readout, sign, timer, the sink tag or the trough   ${at} [${mom.bad.slice(0, 4).join('; ') || JSON.stringify(mom.edges) + ', E58 fallback: ' + (mom.fallback || 'none')}]`);
    {
      const small = mom.heads.filter((x) => Math.min(x.w, x.h) < 60), least = mom.heads.reduce((a, x) => Math.min(a, x.w, x.h), 1e9);
      console.log(`    note: E58 (b) ${at}: smallest head ${least.toFixed(0)} px; under 60 px: ${small.length ? small.map((x) => x.kind + ' ' + x.id + (x.fb ? ' (nest)' : '') + ' ' + x.w.toFixed(0) + '×' + x.h.toFixed(0)).join(', ') : 'none'}`);
    }
    if (SHOTS) {
      await ev(`(() => { document.querySelectorAll('.mess').forEach((m, i) => i % 3 === 0 && ET.mess.splatter(m, 6)); return 1; })()`);
      await shot(`10-full-board-${w}x${h}`);
    }
  }
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  /* ------------------------------------------------------- P. Time Warp */
  section("P. Time Warp (Refinement 3 §4, E27, E28)");
  await ev("__et.start(1, { hospital: 0 })");
  await ev("__et.advance(0.1)");
  eq(await ev("document.querySelector('#warp').classList.contains('lit')"), false, "Time Warp is dark at the start of a wave");
  {
    // E27: a grandfather clock whose hands turn only while it runs
    const off = await ev("(() => { const a = ET.view.clockHands(); __et.advance(0.5); const b = ET.view.clockHands(); return { a, b, svg: !!document.querySelector('#warp svg.clock-art .hour') && !!document.querySelector('#warp .minute'), text: document.querySelector('#warp .plaque').textContent }; })()");
    ok(off.svg && off.text === "TIME WARP", `E27 and E28: the centre panel is a grandfather clock with an hour and a minute hand, over a "TIME WARP" sign   [${off.text}]`);
    ok(off.a.minute === off.b.minute && off.a.hour === off.b.hour, "…and its hands stand still while it isn't running");
    eq(await ev("document.querySelector('#warp .caption').textContent"), "All clocks 5× fast. Get your next RCAV ready!", "E28: a caption under the sign");
    ok(!(await ev("document.body.innerText")).toUpperCase().includes("ACCELERATOR"), "E28: E27's rename is undone: nothing a player sees says \"Accelerator\"");
  }
  {
    // E28: the sign's flash, watched by drawing a steady Time Warp frame by frame (a real one can end, when the next
    // egg goes bold, before the flashes are done); the game's own Time Warp is checked below. All in one evaluation.
    const watchSign = `(() => {
      __et.start(1, { hospital: 0 }); __et.advance(0.1);
      const s = __et.snapshot(), t0 = s.time + 0.05, seen = [];
      ET.view.render(Object.assign({}, s, { warp: false }));
      for (let i = 0; i < 60; i++) { ET.view.render(Object.assign({}, s, { warp: true, time: t0 + i * 0.05 })); seen.push(ET.view.warpSign().lit ? 1 : 0); }
      const log = ET.view.warpSign().log, ons = log.filter(e => e.on).map(e => e.t);
      let worst = 0;
      for (let i = 0; i < ons.length; i++) { let n = 0; for (let j = i; j < ons.length && ons[j] < ons[i] + 1; j++) n++; worst = Math.max(worst, n); }
      const out = { seen: seen.join(''), offs: log.filter(e => !e.on).length, ons: ons.length, worst, gaps: log.slice(1).map((e, i) => e.t - log[i].t), anim: getComputedStyle(document.querySelector('#warp .plaque')).animationName };
      __et.start(1, { hospital: 0 }); __et.advance(0.1);
      return out;
    })()`;
    const fl = await ev(watchSign);
    ok(fl.ons === 4 && fl.offs === 3 && /^1+0+1+0+1+0+1+$/.test(fl.seen), `E28: when Time Warp kicks in its sign flashes 3 times, then stays lit   [${fl.seen}]`);
    ok(fl.worst <= 2 && fl.gaps.every((g) => g >= 0.25 - 1e-6) && fl.anim === "none", `SAFETY: the sign never flashes more than 2 times a second   [worst ${fl.worst} in any 1 s, shortest gap ${Math.min(...fl.gaps).toFixed(2)} s]`);
    // E28: under reduced motion the sign lights at once when Time Warp kicks in, with no flash
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const rm = await ev(watchSign);
    ok(/^1+$/.test(rm.seen) && rm.offs === 0, `SAFETY: with reduced motion the sign lights at once and doesn't flash   [${rm.seen}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
    await ev("__et.start(1, { hospital: 0 }); __et.advance(0.1); 1");
  }
  {
    // E31 (ruled 2026-09-24): after the flashes, while Time Warp runs, the letters wobble and stretch; the sign's brightness
    // never changes. A real Time Warp, held on pause (the page keeps drawing it), watched in real time. The flashes are
    // skipped for this one check (warpSignFlashes 0), so the wobble starts the moment Time Warp does.
    const esc = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    const held = await ev(`(() => {
      ET.CONFIG.__flashes = ET.CONFIG.warpSignFlashes; ET.CONFIG.warpSignFlashes = 0;
      __et.start(1, { hospital: 0, minutes: 30 }); __et.advance(0.1);
      for (let i = 0; i < 6000 && !__et.snapshot().warp; i++) { __et.snapshot().nests.filter(n => n.state === 'overtime').forEach(n => __et.submit('RCAV ' + n.unit)); __et.advance(0.05); }
      const warp = __et.snapshot().warp;
      ${esc};                                        // pause at once: nothing steps in between
      return { warp, paused: !document.querySelector('#pause').hidden };
    })()`);
    const watch = () => ev(`new Promise((done) => {
      const p = document.querySelector('#warp .plaque'), l = p.querySelector('.letters'), looks = [], shapes = [], n0 = ET.view.warpSign().log.length;
      const look = () => { const a = getComputedStyle(p), b = getComputedStyle(l);
        return [a.backgroundColor, a.color, a.opacity, a.filter, a.boxShadow, b.color, b.opacity, b.filter, b.textShadow].join('|'); };
      let k = 0;
      const t = setInterval(() => {
        looks.push({ t: performance.now() / 1000, v: look() });
        shapes.push(getComputedStyle(l).transform);
        if (++k >= 40) {
          clearInterval(t);
          const changes = looks.slice(1).filter((x, i) => x.v !== looks[i].v).map((x) => x.t);
          let worst = 0;
          for (let i = 0; i < changes.length; i++) { let m = 0; for (let j = i; j < changes.length && changes[j] < changes[i] + 1; j++) m++; worst = Math.max(worst, m); }
          done({ wobble: p.classList.contains('wobble'), anim: getComputedStyle(l).animationName, shapes: new Set(shapes).size, changes: changes.length, worst,
                 lit: ET.view.warpSign().lit, signChanges: ET.view.warpSign().log.length - n0, warp: __et.snapshot().warp });
        }
      }, 50);
    })`);
    const wb = await watch();
    ok(held.warp && held.paused && wb.warp && wb.wobble && wb.anim === "warp-wobble" && wb.shapes >= 5, `E31: while Time Warp runs, the "TIME WARP" letters wobble and stretch   [${wb.shapes} shapes in 2 s]`);
    ok(wb.lit && wb.signChanges === 0 && wb.changes === 0 && wb.worst <= 2, `SAFETY: during the wobble the sign stays lit and its brightness never changes (the cap is 2 a second)   [${wb.changes} changes, worst ${wb.worst} in any 1 s]`);
    await shot("13e-time-warp-wobble");
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    await wait(200);
    const still = await watch();
    ok(still.warp && still.lit && !still.wobble && still.anim === "none" && still.shapes === 1 && still.changes === 0, `SAFETY: with reduced motion the sign stays lit and doesn't wobble   [${still.anim}, ${still.shapes} shape]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
    await ev(`(() => { ${esc}; ET.CONFIG.warpSignFlashes = ET.CONFIG.__flashes; delete ET.CONFIG.__flashes; __et.start(1, { hospital: 0 }); __et.advance(0.1); return 1; })()`);
  }
  {
    let lit = null;
    for (let t = 0; t < 300 && !lit; t += 0.25) {
      const x = await snap();
      if (x.warp) { lit = x; break; }
      for (const y of x.nests.filter((z) => z.state === "overtime")) await ev(`__et.submit('RCAV ${y.unit}')`);
      await ev("__et.advance(0.25)");
    }
    ok(!!lit && lit.spawned === lit.quota, "the clocks warp once the wave's last egg has spawned");
    {
      // E39: with its rule on, two eggs each over 8:00 from bold light Time Warp early in a wave (one ev: nothing between)
      const e39 = await ev(`(() => { ET.CONFIG.warpFar.eggs = 2; __et.start(1, { hospital: 0, minutes: 30 }); let s = null;
        for (let i = 0; i < 4000; i++) { __et.advance(0.02); s = __et.snapshot(); if (s.nests.filter(n => n.state === 'active').length >= 2) break; }
        __et.advance(0.02); s = __et.snapshot();
        const r = { warp: s.warp, early: s.spawned < s.quota, lit: document.querySelector('#warp').classList.contains('lit') };
        ET.CONFIG.warpFar.eggs = Infinity; return r; })()`);
      eq(e39, { warp: true, early: true, lit: true }, "E39: two eggs each over 8:00 from bold light Time Warp, before the wave's last CAV has spawned");
      await ev("__et.start(1, { hospital: 0 }); __et.advance(0.1); 1");
      lit = null;
      for (let t = 0; t < 300 && !lit; t += 0.25) {
        // found and held (Esc) in one evaluation: the live page would otherwise run the warp out (an egg going bold)
        // between the checks below; __et.advance and the drawing still run while paused (steadied 2026-10-02)
        const x = await ev("(() => { const s = __et.snapshot(); if (s.warp) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return s; })()");
        if (x.warp) { lit = x; break; }
        for (const y of x.nests.filter((z) => z.state === "overtime")) await ev(`__et.submit('RCAV ${y.unit}')`);
        await ev("__et.advance(0.25)");
      }
    }
    eq([await ev("document.querySelector('#warp').classList.contains('lit')"), await ev("document.querySelector('#warp .plaque').textContent")], [true, "TIME WARP"], "…and Time Warp lights up");
    {
      // E27: the hands spin fast while it runs (one evaluation, so the live page can't end it in between)
      const sp = await ev("(() => { const a = ET.view.clockHands(); __et.advance(0.1); const b = ET.view.clockHands(), s = __et.snapshot(); return { a, b, warp: s.warp, anim: getComputedStyle(document.querySelector('#warp .plaque')).animationName + '/' + getComputedStyle(document.querySelector('#warp')).animationName }; })()");
      const turned = ((sp.b.minute - sp.a.minute) + 360) % 360;
      ok(sp.warp && turned > 20 && sp.b.hour !== sp.a.hour, `E27: while it runs the clock's hands spin fast   [minute hand ${turned.toFixed(0)}° in 0.1 s]`);
      eq([sp.b.fivex, sp.anim], [false, "none/none"], "…with no \"5×\" on the face, and nothing on the clock flickering");
    }
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
      // Chat's playtest rulings (2026-10-02): the lit sign, its caption and the lightning are hot red, each darker than the
      // mint it replaced; the grandfather clock's glow, the nests' glow and the wall clock keep their greens
      const lum = (c) => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      // read it lit and steady: the sign flashes 3 times as Time Warp starts, so wait (up to 3 s) until those are over
      for (let i = 0; i < 8; i++) { const a = await ev("ET.view.warpSign().log.length"); await wait(600); if (await ev(`ET.view.warpSign().lit && ET.view.warpSign().log.length === ${a}`)) break; }
      const red = await ev(`(() => { const p = document.querySelector('#warp .plaque'), cs = getComputedStyle(p);
        return { lit: p.classList.contains('on'), bg: cs.backgroundColor, ink: cs.color, caption: getComputedStyle(document.querySelector('#warp .caption')).color,
          core: getComputedStyle(document.querySelector('#cords .bolt-core')).stroke, clockGlow: getComputedStyle(document.querySelector('#warp .clock-art')).filter }; })()`);
      ok(red.lit && red.bg === "rgb(255, 31, 61)" && red.caption === "rgb(255, 92, 108)" && red.core === "rgb(255, 194, 202)", `the lit Time Warp sign, its caption and the lightning's core are hot red   [${red.bg}, ${red.caption}, ${red.core}]`);
      ok(lum(red.bg) < lum("rgb(61, 255, 154)") && lum(red.caption) < lum("rgb(61, 255, 154)") && lum(red.core) < lum("rgb(200, 255, 226)"), `…each darker than the mint it replaced: nothing brighter   [${lum(red.bg).toFixed(2)}, ${lum(red.caption).toFixed(2)}, ${lum(red.core).toFixed(2)} vs 0.75 / 0.90]`);
      ok(red.clockGlow.includes("rgb(61, 255, 154)"), "…while the grandfather clock keeps its mint glow");
    }
    {
      // Refinement 6 §2: lightning from the panel, daisy-chained to every nest whose clock is running
      const lt = await ev(`(() => { const L = ET.view.lightning(), sr = document.querySelector('#screen-play').getBoundingClientRect(), W = document.querySelector('#warp').getBoundingClientRect();
        const m = (L.d || '').slice(1).split(' ').map(Number);
        return { on: L.on, links: L.links, running: [...document.querySelectorAll('.nest')].filter(n => n.dataset.state === 'active').length,
                 fromWarp: m[0] + sr.left > W.left && m[0] + sr.left < W.right && m[1] + sr.top > W.top && m[1] + sr.top < W.bottom,
                 moves: (L.d.match(/M/g) || []).length, jagged: (L.d.match(/L/g) || []).length > L.links * 3, layer: !!document.querySelector('#cords .lightning'),
                 stroke: getComputedStyle(document.querySelector('#cords .bolt-glow')).stroke }; })()`);
      ok(lt.on && lt.links === lt.running && lt.running > 0 && lt.moves === lt.links, `Refinement 6 §2: jagged lightning reaches every nest whose clock is running, one link each   [${lt.links} links, ${lt.running} running]`);
      ok(lt.fromWarp && lt.jagged && lt.stroke === "rgb(255, 31, 61)", "…starting from the central panel, in hot red (Chat, 2026-10-02), kinked");
      ok(lt.layer && (await ev("Number(getComputedStyle(document.querySelector('#cords')).zIndex) < Number(getComputedStyle(document.querySelector('#field')).zIndex)")), "…drawn in the cord's layer, under every readout, taking no input");
      // flicker: the game is held (Esc, above) so the warp stays on; watch in real time
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
      // poll until the page sees it, then a frame (it once read the old setting on a busy machine; steadied 2026-10-01)
      for (let i = 0; i < 60 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
      await wait(500);
      const still0 = await ev("ET.view.lightning().d");
      await wait(1500);
      const still1 = await ev("ET.view.lightning().d");
      ok(still0 === still1 && !!still0, "SAFETY: with reduced motion the lightning holds still");
      // E27: the clock's hands hold still too, and its face reads "5×" (stepped in one evaluation while it runs)
      // a tiny step, just to draw a frame: a 0.1 s step could take an egg to bold and end the warp (steadied 2026-10-01)
      const h = await ev("(() => { const a = ET.view.clockHands(); __et.advance(0.01); const b = ET.view.clockHands(); return { a, b, warp: __et.snapshot().warp, five: document.querySelector('#warp .fivex').textContent }; })()");
      ok(h.warp && h.a.minute === h.b.minute && h.a.hour === h.b.hour && h.b.fivex && h.five === "5×", `SAFETY: with reduced motion the clock's hands hold still and its face shows "5×"   [${h.five}, ${h.b.fivex}, warp ${h.warp}]`);
      await shot("13d-accelerator-reduced-motion");
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

  /* ------------------------------------------------------- H3. the hatchling's legs */
  section("H3. the hatchling's legs in a scurry (Chat ruling, 2026-09-25)");
  {
    // watch one scurry frame by frame: the legs keep their height the whole time (a swing, never a squash or a flip)
    const sc = await ev(`new Promise((done) => {
      const n = document.querySelector('.nest[data-id="0"]'), legs = n.querySelector('.legs');
      n.dataset.state = 'escape'; n.classList.remove('lunge'); n.classList.add('scurry');
      const h = [], slant = [], looks = [];
      const t0 = performance.now();
      const tick = () => {
        const m = new DOMMatrix(getComputedStyle(legs).transform === 'none' ? undefined : getComputedStyle(legs).transform);
        h.push(m.d); slant.push(+m.c.toFixed(3));
        const p = getComputedStyle(legs.querySelector('path')); looks.push(p.stroke + '|' + p.opacity + '|' + getComputedStyle(legs).opacity + '|' + getComputedStyle(legs).visibility);
        if (performance.now() - t0 < 1300) requestAnimationFrame(tick);
        else { n.classList.remove('scurry'); n.dataset.state = 'idle'; done({ frames: h.length, minH: Math.min(...h), slants: new Set(slant).size, looks: new Set(looks).size, anim: getComputedStyle(legs).animationName }); }
      };
      requestAnimationFrame(tick);
    })`);
    ok(sc.frames > 20 && sc.minH > 0.99 && sc.slants > 5, `the legs stay visible through the whole scurry: they swing (shuffle), never squashed to zero height or flipped   [${sc.frames} frames, smallest height ×${sc.minH.toFixed(2)}, ${sc.slants} slants]`);
    ok(sc.looks === 1, "SAFETY: …and they never change colour or fade, so nothing flashes");
  }

  /* ------------------------------------------------------- R. reduced motion */
  section("R. reduced motion (Andrew, 2026-09-24): the place-me cue, the H sign's drop, Mom's repair, the overtime wobble, the cord twitch and the legs hold still");
  {
    // each is read first without reduced motion, so a check that can't fail can't hide here
    await ev("__et.start(1, { hospital: 1 })");
    await ev("__et.advance(0.1)");
    const cue = () => ev(`(() => { const s = document.querySelector('.nest.asks .readout .code'); if (!s) return null; const cs = getComputedStyle(s); return { anim: cs.animationName, border: cs.borderTopColor }; })()`);
    // E55: the H sign's drop and Mom's repair, read the moment the STR goes on
    // Mom kit: read early in her entrance (u about 0.06): sliding in, or (reduced motion) fading in where she rests
    // deterministic (Chat, 2026-10-03): unpaused so the STR is taken, then a zero-length frame so this visit is painted at
    // exactly 0.09 s in, and the NEWEST visit read (an older one could still be in the layer on a slow machine)
    const hosp = (b) => ev(`(() => { if (__et.paused()) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const took = __et.submit('CAV ${b.unit} STR'); __et.advance(0.09); __et.advance(0);
      const all = [...document.querySelectorAll('#popups .mom-visit')], m = took && took.ok ? all[all.length - 1] : null;
      const t = m ? m.querySelector('.mom-rig').style.transform : '';
      return { sign: getComputedStyle(document.querySelector('.nest[data-id="${b.id}"] .hsign')).animationName, slide: !!t && t !== 'translate(0px, 0px)',
               fade: m ? Number(m.style.opacity || 1) : null, there: !!m && m.querySelector('.mom-head').getBoundingClientRect().height > 10 }; })()`);
    const legs = () => ev(`(() => { const n = document.querySelector('.nest[data-id="0"]'); n.classList.add('scurry'); const a = getComputedStyle(n.querySelector('.legs')).animationName; n.classList.remove('scurry'); return a; })()`);
    // E45: every moving piece of all six aliens, built in nest 0's slot one at a time: its animation's name
    const aliens = () => ev(`(() => { const c = document.querySelector('.nest[data-id="0"] .creature'), out = {};
      Object.keys(ET.aliens.RIGS).forEach((a) => { ET.aliens.fill(c, a);
        out[a] = [...c.querySelectorAll('.wig, .squish, .drip')].map((g) => getComputedStyle(g).animationName); });
      ET.aliens.clear(c); return out; })()`);
    // one evaluation, so the live page can't step in between: read the cord's x at every point and how far it spreads,
    // over six moments of the lay
    const layCord = (t) => ev(`(() => {
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
        for (const y of x.nests.filter((z) => z.state === "overtime" && z.id !== keep)) await ev(`(__et.submit('RCAV ${y.unit}'), __et.submit('CAV ${y.unit} STR'), 1)`);
        await ev("__et.advance(0.25)");
      }
      return null;
    };
    // an egg at the start of its lay, and later that same egg in overtime; its RCAV puts up the cue, its STR Mom
    const laying = () => seek((x) => x.nests.find((y) => y.state === "laying" && y.lay < 0.1));
    const bold = (id) => seek((x) => x.nests.find((y) => y.id === id && y.state === "overtime"), id);
    const motion = async (label) => {
      const t = await laying();
      const cord = t ? await layCord(t) : [];
      const b = t ? await bold(t.id) : null;
      const w = b ? await tilts(b.id) : [];
      if (b) await ev(`(__et.submit('RCAV ${b.unit}'), __et.advance(0.01), 1)`);
      const cu = b ? await cue() : null;
      const hs = b ? await hosp(b) : null;
      return { label, t: !!t, cue: cu, hosp: hs, cord, bold: !!b, wobble: w, legs: await legs(), aliens: await aliens() };
    };
    const live = await motion("normal");
    ok(live.t && !!live.cue && live.cue.anim === "cue", `without reduced motion the place-me cue blinks   [${live.cue && live.cue.anim}]`);
    ok(!!live.hosp && live.hosp.sign === "hsign-drop, mark-bounce" && live.hosp.slide && live.hosp.fade === 1, `…the H sign drops in, and Mom slides in   [${live.hosp && [live.hosp.sign, live.hosp.slide, live.hosp.fade].join(", ")}]`);
    ok(live.cord.some((d) => d !== null && d > 0), `…the laying cord twitches   [spread ${live.cord.map((d) => d === null ? "-" : d.toFixed(1)).join(" ")} px]`);
    ok(live.bold && live.wobble.some((a) => a !== null && a > 0), `…the egg wobbles in overtime   [${live.wobble.map((a) => a === null ? "-" : a.toFixed(2)).join(" ")}°]`);
    eq(live.legs, "legs", "…and the escaping hatchling's legs shuffle");
    ok(Object.values(live.aliens).every((n) => n.length >= 3 && n.every((x) => /^alien-(wig|squish|drip)$/.test(x))),
      `…and every piece of all six aliens moves   [${Object.entries(live.aliens).map(([a, n]) => a + " " + n.length).join(", ")}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const still = await motion("reduced");
    ok(still.t && !!still.cue && still.cue.anim === "none" && still.cue.border === "rgb(34, 227, 255)", `SAFETY: with reduced motion the place-me cue stops blinking and holds a steady cyan border   [${still.cue && still.cue.anim}, ${still.cue && still.cue.border}]`);
    ok(!!still.hosp && still.hosp.sign === "none" && !still.hosp.slide && still.hosp.fade > 0 && still.hosp.fade < 1 && still.hosp.there, `SAFETY: …the H sign is simply there, and Mom only fades in where she rests (no slide)   [${still.hosp && [still.hosp.sign, still.hosp.slide, still.hosp.fade && still.hosp.fade.toFixed(2)].join(", ")}]`);
    ok(still.cord.length === 6 && still.cord.every((d) => d === 0), `SAFETY: …the laying cord hangs straight, no twitch   [spread ${still.cord.map((d) => d === null ? "-" : d.toFixed(1)).join(" ")} px]`);
    ok(still.bold && still.wobble.length === 6 && still.wobble.every((a) => a === 0), `SAFETY: …the overtime egg doesn't wobble   [${still.wobble.map((a) => a === null ? "-" : a.toFixed(2)).join(" ")}°]`);
    eq(still.legs, "none", "SAFETY: …and the hatchling's legs hold still");
    ok(Object.values(still.aliens).every((n) => n.length >= 3 && n.every((x) => x === "none")),
      `SAFETY: …and every alien's legs, tentacles, feelers, bodies and drips hold still   [${Object.entries(still.aliens).map(([a, n]) => a + " " + n.filter((x) => x === "none").length + "/" + n.length).join(", ")}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
  }

  /* ------------------------------------------------------- M. music */
  section("M. music (Chat ruling, 2026-09-25)");
  {
    const esc = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    // the files: small, decoding to exactly the lengths make-music.py wrote, the loop points as in its manifest
    const files = await ev(`fetch('audio/music.json').then(r => r.json()).then(man => Promise.all(Object.entries(ET.CONFIG.music).map(([k, M]) =>
      fetch(M.file).then(r => r.arrayBuffer()).then(ab => { const kb = Math.round(ab.byteLength / 1024);
        return new OfflineAudioContext(2, 44100, 44100).decodeAudioData(ab).then(b => {
          const d0 = b.getChannelData(0), d1 = b.getChannelData(1), m = (i) => (d0[i] + d1[i]) / 2, sr = b.sampleRate;
          const out = { k, kb, seconds: +(b.length / sr).toFixed(3), want: man[k].loop ? +man[k].loop[1].toFixed(3) : man[k].seconds, same: JSON.stringify(M.loop) === JSON.stringify(man[k].loop || null) && M.bpm === man[k].bpm };
          if (M.loop) {
            const i0 = Math.round(M.loop[0] * sr), i1 = Math.round(M.loop[1] * sr), w = 8 * sr;
            const rms = (a, z) => { let q = 0; for (let i = a; i < z; i++) q += m(i) * m(i); return Math.sqrt(q / (z - a)); };
            out.step = +Math.abs(m(i1 - 1) - m(i0)).toFixed(4);
            out.joinDb = +(20 * Math.log10(rms(i1 - w, i1) / rms(i0, i0 + w))).toFixed(2);
          }
          // the loud parts: the 90th percentile of 400 ms windows
          const W = Math.round(0.4 * sr), r = []; for (let a = 0; a + W < b.length; a += W) { let q = 0; for (let i = a; i < a + W; i += 4) q += m(i) * m(i); r.push(Math.sqrt(q / (W / 4))); }
          r.sort((x, y) => x - y); out.p90 = r[Math.floor(r.length * 0.9)];
          let pk = 0; for (let i = 0; i < b.length; i++) pk = Math.max(pk, Math.abs(d0[i]), Math.abs(d1[i])); out.peak = pk;
          return out; }); }))))`);
    const fm = Object.fromEntries(files.map((f) => [f.k, f]));
    ok(files.length === 3 && files.every((f) => f.kb < 2600 && f.same && Math.abs(f.seconds - f.want) < 0.01),
      `three music files, each under 2.6 MB, decoding to exactly the length make-music.py wrote, loop points and tempo as in its manifest   [${files.map((f) => f.k + " " + f.kb + " KB, " + f.seconds + " s").join("; ")}]`);
    ok(fm.title.step < 0.02 && fm.gameplay.step < 0.02, `each loop's join has no click: the jump from its end to its start is a tiny step   [title ${fm.title.step}, gameplay ${fm.gameplay.step}]`);
    ok(Math.abs(fm.gameplay.joinDb) <= 0.5, `the gameplay loop's volume ramp is baked in: its end matches its start within 0.5 dB   [${fm.gameplay.joinDb} dB]`);
    eq(await ev("ET.view.backdrop().bpm"), await ev("ET.CONFIG.music.gameplay.bpm"), "the board lights keep time to the gameplay track's BPM, measured from the file");
    // E36: every track plays at the other PLC cartridges' music loudness (its file's own loudness, measured with ffmpeg
    // and recorded in config.js, plus its level and the master level), and at that level music alone never reaches the
    // master ceiling's knee, so it is never rounded off (no distortion)
    const mix = await ev("({ M: ET.CONFIG.music, target: ET.CONFIG.musicLufs, LEVEL: ET.audio.LEVEL, KNEE: 0.75 })");
    const heardAt = Object.fromEntries(Object.entries(mix.M).map(([k, t]) => [k, +(t.lufs + 20 * Math.log10(t.level * mix.LEVEL)).toFixed(2)]));
    ok(Object.values(heardAt).every((v) => Math.abs(v - mix.target) <= 0.2), `E36: each track plays at ${mix.target} LUFS, the median of Asteroid Command's and the Aquanaut's music   [${Object.entries(heardAt).map(([k, v]) => k + " " + v).join(", ")}]`);
    const tops = Object.fromEntries(files.map((f) => [f.k, +(f.peak * mix.M[f.k].level * mix.LEVEL).toFixed(3)]));
    ok(Object.values(tops).every((v) => v < mix.KNEE), `E36: at those levels the music's loudest sample stays under the ceiling's knee (${mix.KNEE}): never rounded off   [${Object.entries(tops).map(([k, v]) => k + " " + v).join(", ")}]`);
    // the menus share one track: title → options doesn't restart it; into play it fades over to the gameplay track
    await ev("__et.start(1, { hospital: 0 }); 1");
    if (await ev("__et.paused()")) await ev(`(() => { ${esc}; return 1; })()`);   // start unpaused
    const into = async (screen, want) => { await ev(`__et.show('${screen}')`); for (let i = 0; i < 60; i++) { const m = await ev("__et.music()"); if (m.playing === want) return m; await wait(50); } return ev("__et.music()"); };
    const t1 = await into("title", "title"), n1 = t1.log.filter((e) => e.started === "title").length;
    const t2 = await into("setup", "title"), n2 = t2.log.filter((e) => e.started === "title").length;
    ok(t1.playing === "title" && t2.playing === "title" && n2 === n1, "the title and options screens share the title track: moving between them doesn't restart it");
    const g0 = await into("play", "gameplay");
    await wait(100);   // (a ramp's first moment reads back as its old value)
    const early = (await ev("__et.music()")).level;
    await wait(700);
    const full = (await ev("__et.music()")).level, lvl = await ev("ET.CONFIG.music.gameplay.level");
    ok(g0.playing === "gameplay" && early < lvl * 0.9 && Math.abs(full - lvl) < 1e-4, `changing screens fades the music out and the next in, about half a second, no hard cut   [gameplay level ${early.toFixed(4)} → ${full.toFixed(4)}]`);
    {
      // E36: the music dips under THONG, the error buzz and the hiss, then comes back; the small sounds don't dip it
      const D = await ev("ET.CONFIG.musicDuck");
      const dip = async (call) => {
        for (let i = 0; i < 60 && (await ev("__et.music().duck")) < 0.999; i++) await wait(50);   // back to full first
        const r = await ev(`new Promise((done) => { ${call}; setTimeout(() => done(__et.music().duck), 120); })`);
        let back = 0; for (let i = 0; i < 60; i++) { await wait(50); back = await ev("__et.music().duck"); if (back > 0.999) break; }
        return [+r.toFixed(3), +back.toFixed(3)];
      };
      const dips = {
        thong: await dip("ET.audio.thong()"), buzz: await dip("ET.audio.buzz()"),
        hiss: await dip("ET.audio.hiss(ET.CONFIG.momFaceSeconds, ET.CONFIG.momFaceVolume)"),
        squeeze: await dip("ET.audio.squeeze()"), pop: await dip("ET.audio.pop()")
      };
      ok(["thong", "buzz", "hiss"].every((k) => Math.abs(dips[k][0] - D.depth) < 0.02 && dips[k][1] > 0.999),
        `E36: the music dips (to ${D.depth}) under THONG, the error buzz and the hiss, then comes back   [${["thong", "buzz", "hiss"].map((k) => k + " " + dips[k].join(" → ")).join("; ")}]`);
      ok(dips.squeeze[0] > 0.999 && dips.pop[0] > 0.999, `…and the egg-laying squeeze and pop ride under it with no dip   [${dips.squeeze[0]}, ${dips.pop[0]}]`);
    }
    // Time Warp leaves the music alone
    const tw = await ev("(() => { const s = __et.snapshot(), a = ET.audio.musicState(); ET.view.render(Object.assign({}, s, { warp: true, time: s.time + 0.05 })); const b = ET.audio.musicState(); ET.view.render(Object.assign({}, s, { warp: false, time: s.time + 0.7 })); return [a.playing, b.playing, a.level === b.level]; })()");
    eq(tw, ["gameplay", "gameplay", true], "Time Warp doesn't change the music");
    // Esc pauses the gameplay music where it is, and resumes from there
    if (await ev("__et.paused()")) await ev(`(() => { ${esc}; return 1; })()`);
    await wait(300);
    const before = (await ev("__et.music()")).at;
    await ev(`(() => { ${esc}; return 1; })()`);
    const held = await ev("__et.music()");
    await wait(500);
    await ev(`(() => { ${esc}; return 1; })()`);
    let res = null; for (let i = 0; i < 40; i++) { res = await ev("__et.music()"); if (res.playing) break; await wait(50); }
    const resumedFrom = res.log.filter((e) => e.started === "gameplay").pop().from;
    ok(held.paused && !held.playing && Math.abs(resumedFrom - before) < 0.25, `Esc pauses the gameplay music, and it resumes where it stopped   [paused at ${before.toFixed(2)} s, resumed from ${resumedFrom.toFixed(2)} s]`);
    // game over: its track plays once, and at its end the game goes back to the title screen and the title music
    await ev("__et.show('over')");
    let ov = null; for (let i = 0; i < 60; i++) { ov = await ev("__et.music()"); if (ov.playing === "over") break; await wait(50); }
    const once = await ev("ET.CONFIG.music.over.loop === null");
    await ev("__et.endMusic()");   // as if it had played to its end
    let home = null; for (let i = 0; i < 60; i++) { home = await ev("({ screen: __et.screen(), m: __et.music() })"); if (home.screen === "title" && home.m.want === "title") break; await wait(50); }
    ok(ov.playing === "over" && once && home.screen === "title" && home.m.want === "title", "the game-over track plays once; left alone, at its end the game goes back to the title screen and the title music starts");
    await ev("__et.show('setup'); 1");
  }

  /* ------------------------------------------------------- S. egg-laying sound */
  section("S. egg-laying sound (Chat ruling, 2026-09-25)");
  {
    const esc = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    // log every squeeze and pop with the game's moment, the laying nest's progress, and the pitch it used
    await ev(`(() => { window.__lay = []; ['squeeze', 'pop'].forEach(k => { const f = ET.audio[k]; if (f.__wrapped) return;
      const w = function () { const s = __et.snapshot(), n = s.nests.find(x => x.state === 'laying'); const j = f.apply(this, arguments);
        window.__lay.push({ k, t: s.time, lay: n ? n.lay : null, j }); return j; }; w.__wrapped = true; ET.audio[k] = w; }); return 1; })()`);
    const lays = await ev(`(() => { window.__lay = []; __et.start(1, { hospital: 0 }); __et.advance(0.1); const starts = [];
      for (let i = 0; i < 2400 && starts.length < 3; i++) { const b = __et.snapshot(); __et.advance(0.02); const a = __et.snapshot();
        a.nests.forEach(n => { const was = b.nests.find(x => x.id === n.id); if (n.state === 'active' && was && was.state === 'laying') starts.push(a.time); });
        a.nests.filter(n => n.state === 'overtime').forEach(n => __et.submit('RCAV ' + n.unit)); }
      return { log: window.__lay.slice(), starts }; })()`);
    const sq = lays.log.filter((x) => x.k === "squeeze"), pops = lays.log.filter((x) => x.k === "pop");
    const at = await ev("ET.CONFIG.laySqueezeAt");
    ok(lays.starts.length === 3 && sq.length === 3 && sq.every((x) => x.lay !== null && x.lay >= at && x.lay < at + 0.05),
      `each lay squeezes once, as the bulge travels the cord's last stretch   [at ${sq.map((x) => x.lay && x.lay.toFixed(2)).join(", ")} of the lay]`);
    ok(pops.length === 3 && pops.every((p, i) => Math.abs(p.t - lays.starts[i]) < 0.03 && p.t > sq[i].t), "…then pops once, the moment the egg drops into the nest");
    const pitches = lays.log.map((x) => x.j).filter((j) => typeof j === "number");
    ok(pitches.length >= 4 && new Set(pitches.map((j) => j.toFixed(4))).size === pitches.length && pitches.every((j) => Math.abs(j - 1) <= 0.08 + 1e-9),
      `…each at its own small pitch shift, so repeats don't sound identical   [${pitches.map((j) => j.toFixed(3)).join(" ")}]`);

    // pause holds the squeeze: stop just before it, wait, see nothing
    const held = await ev(`new Promise((done) => { window.__lay = []; __et.start(1, { hospital: 0 }); __et.advance(0.1);
      for (let i = 0; i < 2000; i++) { const n = __et.snapshot().nests.find(x => x.state === 'laying'); if (n && n.lay > ${at} - 0.1) break; __et.advance(0.02); }
      ${esc}; const n0 = window.__lay.length; setTimeout(() => { const n1 = window.__lay.length; ${esc}; done({ n0, n1 }); }, 1200); })`);
    ok(held.n0 === 0 && held.n1 === 0, "pause holds the squeeze (it follows the lay's own progress)");
    // a burst of lays: at most 2 pops (and 2 squeezes) sounding at once
    const burst = await ev("(() => { const p = [], s = []; for (let i = 0; i < 6; i++) { p.push(ET.audio.pop()); s.push(ET.audio.squeeze()); } return { p: p.filter(x => x !== false).length, s: s.filter(x => x !== false).length, on: ET.audio.state() }; })()");
    ok(burst.p <= 2 && burst.s <= 2 && (burst.on === "none" || burst.p >= 1), `a burst of lays can't pile up: at most 2 pops and 2 squeezes at once   [${burst.p} pops, ${burst.s} squeezes of 6 each]`);
    // the mix: both clearly under THONG, the error buzz and the hiss
    // the squeeze and the pop are random (pitch, noise): each is measured 5 times and its loudest taken. So are THONG's
    // pitch and the buzz's and the hiss's noise: the randomness is SEEDED here, so each run measures the same variants
    // (it flaked with both sides random, sitting near the limit; steadied 2026-10-01)
    const m = await ev(`(window.__seeded = (seed, fn) => { const R = Math.random; let s = seed; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
        try { return fn(); } finally { Math.random = R; } },
      Promise.all([['squeeze'], ['pop'], ['thong'], ['buzz'], ['hiss', [0.85, 0.12]], ['squelch'], ['bloop']].map(([k, a]) =>
        Promise.all(Array.from({ length: ['thong', 'buzz', 'hiss'].includes(k) ? 1 : 5 }, (_, i) => __seeded(1009 + 7919 * i, () => ET.audio.measure(k, a, 1))))
          .then(rs => ({ peak: Math.max(...rs.map(x => x.peak)), rms: Math.max(...rs.map(x => x.rms)) }))))
      .then(r => r.map(x => ({ peak: +x.peak.toFixed(3), rms: +x.rms.toFixed(4) }))))`);
    const [msq, mpop, th, bz, hs, msl, mbl] = m, cues = [th, bz, hs], quiet = { peak: Math.min(...cues.map((c) => c.peak)), rms: Math.min(...cues.map((c) => c.rms)) };
    ok([msq, mpop, msl, mbl].every((s) => s.peak <= 0.6 * quiet.peak && s.rms <= 0.6 * quiet.rms),
      `the squeeze and the pop (and E38's squelch and bloop) sit clearly under THONG, the buzz and the hiss (under 60% of the quietest cue's peak and loudness)   [squeeze ${msq.peak}/${msq.rms}, pop ${mpop.peak}/${mpop.rms}, squelch ${msl.peak}/${msl.rms}, bloop ${mbl.peak}/${mbl.rms}; cues ${cues.map((c) => c.peak + "/" + c.rms).join(", ")}]`);
    await ev("__et.start(2, { hospital: 0 }); __et.advance(0.1); 1");
  }

  /* ------------------------------------------------------- U. board lights and Time Warp dark */
  section("U. board lights and Time Warp dark (Chat ruling, 2026-09-25)");
  {
    const esc = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    await ev("__et.start(2, { hospital: 0 }); __et.advance(0.1); 1");
    // colours: WCAG relative luminance and contrast, compositing an rgba colour over an opaque one
    const colours = await ev(`(() => {
      const rgba = (s) => { const m = s.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const root = getComputedStyle(document.documentElement), hex = (h) => { h = h.trim().slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return rgba('rgb(' + [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(',') + ')'); };
      const base = hex(root.getPropertyValue('--bg-2')), tint = rgba(getComputedStyle(document.querySelector('#backdrop')).backgroundColor);
      const light = Object.assign(hex(root.getPropertyValue('--board-light')), { a: ET.CONFIG.lightsPeak });
      const board = over(tint, base);
      // the brightest spot on the board, under whichever of the three tints Andrew picks: a light at its peak
      const lits = ['lilac', 'mint', 'cream'].map(k => over(light, over(rgba(root.getPropertyValue('--board-tint-' + k)), base)));
      const lit = lits.reduce((a, b) => lum(a) > lum(b) ? a : b);
      // text drawn straight on the board: Time Warp's caption, both ways; readouts have opaque boxes of their own
      const cap = document.querySelector('#warp .caption'), capOff = rgba(getComputedStyle(cap).color);
      document.querySelector('#warp').classList.add('lit'); const capOn = rgba(getComputedStyle(cap).color); document.querySelector('#warp').classList.remove('lit');
      const boxes = [...document.querySelectorAll('.nest .readout > span')].map(s => rgba(getComputedStyle(s).backgroundColor).a);
      const inks = ['--readout-timer', '--readout-bold-timer', '--readout-unit', '--readout-type'].map(k => ratio(hex(root.getPropertyValue(k + (k === '--readout-unit' ? '-ink' : '-ink'))), hex(root.getPropertyValue(k + '-bg')))).map(x => +x.toFixed(2));
      return { tint: ET.view.backdrop().tint, dark: lum(board), litLum: lum(lit), capOff: +ratio(capOff, lit).toFixed(2), capOn: +ratio(capOn, lit).toFixed(2), opaque: boxes.every(a => a === 1), inks,
               z: ['#backdrop', '#cords', '#field'].map(q => Number(getComputedStyle(document.querySelector(q)).zIndex)) };
    })()`);
    ok(colours.tint === (await ev("ET.CONFIG.boardTint")) && colours.dark < 0.05, `the board gets its faint tint and stays dark   [${colours.tint}, luminance ${colours.dark.toFixed(3)}]`);
    ok(colours.z[0] < colours.z[1] && colours.z[1] < colours.z[2], `the tint, lights and veil sit behind everything: the cord and bolts, then the board   [z ${colours.z.join(" < ")}]`);
    ok(colours.opaque, `readouts stay legible over a light: every box is opaque, so a light behind it never changes its contrast   [ink on box: timer ${colours.inks[0]}, bold timer ${colours.inks[1]}, unit ${colours.inks[2]}, type ${colours.inks[3]}]`);
    ok(colours.capOff >= 4.5 && colours.capOn >= 4.5, `…and text drawn straight on the board (Time Warp's caption) keeps 4.5:1 over a light at its brightest, under any of the three tints   [${colours.capOff}, ${colours.capOn}]`);
    // the beat lights, over 60 s of the player's seconds, in one evaluation
    const run = await ev(`(() => {
      __et.start(2, { hospital: 0 }); __et.advance(0.1);
      const seen = {}, beat = 60 / ET.view.backdrop().bpm; let most = 0;
      for (let i = 0; i < 1200; i++) {
        __et.advance(0.05);
        __et.snapshot().nests.filter(n => n.state === 'overtime').forEach(n => __et.submit('RCAV ' + n.unit));
        const b = ET.view.backdrop(), t = __et.snapshot().time;
        most = Math.max(most, b.lights.length);
        b.lights.forEach(l => (seen[l.id] = seen[l.id] || []).push([t, l.o]));
      }
      const lights = Object.values(seen).map(s => {
        let turns = 0, rising = true, jump = 0, peak = 0;
        for (let i = 1; i < s.length; i++) { const d = s[i][1] - s[i - 1][1]; jump = Math.max(jump, Math.abs(d)); peak = Math.max(peak, s[i][1]); if (rising && d < 0) { rising = false; turns++; } else if (!rising && d > 0) turns += 10; }
        // only a light seen from its start to its end counts for its life (one born near the end of the run is cut off)
        return { life: s[s.length - 1][0] - s[0][0], whole: s.length >= 3 && s[0][1] < 0.01 && s[s.length - 1][1] < 0.01 && Math.max(...s.map(q => q[1])) > 0.9 * ET.CONFIG.lightsPeak, turns, jump, peak: Math.max(peak, s[0][1]) };
      });
      const starts = ET.view.backdrop().starts, beats = starts.map(t => Math.round(t / beat));
      return { most, n: lights.length, lights, starts: starts.length, oneABeat: new Set(beats).size === beats.length };
    })()`);
    const max = await ev("ET.CONFIG.lightsMax"), peak = await ev("ET.CONFIG.lightsPeak");
    ok(run.n >= 3 && run.oneABeat && run.most <= max, `white lights come and go on the beat: at most one new light a beat, at most ${max} at once   [${run.n} lights in 60 s, most ${run.most} at once]`);
    ok(run.lights.every((l) => l.turns <= 1 && l.peak <= peak + 1e-6), `…each fading in and out once, no brighter than ${peak * 100}% white   [peaks ${run.lights.map((l) => l.peak.toFixed(3)).join(" ")}]`);
    const whole = run.lights.filter((l) => l.whole);
    ok(run.lights.every((l) => l.jump < 0.01) && whole.length >= 3 && whole.every((l) => l.life >= 2),
      `SAFETY: no light snaps on or off or flashes more than 2 times a second (each rises and falls once over seconds)   [biggest step ${Math.max(...run.lights.map((l) => l.jump)).toFixed(4)}, shortest whole life ${Math.min(...whole.map((l) => l.life)).toFixed(1)} s]`);
    // pause freezes them; mute doesn't stop them
    const frozen = await ev(`new Promise((done) => { const a = JSON.stringify(ET.view.backdrop().lights); ${esc};
      setTimeout(() => { const b = JSON.stringify(ET.view.backdrop().lights); ${esc}; done({ same: a === b, any: a !== '[]' }); }, 1000); })`);
    ok(frozen.same, `pause freezes the lights   [${frozen.any ? "lights showing" : "none showing"}]`);
    const muted = await ev(`(() => { __et.start(2, { hospital: 0 }); __et.advance(0.1); const was = ET.audio.muted(); if (!was) document.querySelector('#mute').click(); const n0 = ET.view.backdrop().starts.length;
      for (let i = 0; i < 400; i++) { __et.advance(0.05); __et.snapshot().nests.filter(n => n.state === 'overtime').forEach(n => __et.submit('RCAV ' + n.unit)); }
      const n1 = ET.view.backdrop().starts.length; const m = ET.audio.muted(); if (!was) document.querySelector('#mute').click(); return { m, more: n1 - n0 }; })()`);
    ok(muted.m && muted.more > 0, `mute doesn't stop the lights (they follow the beat clock)   [${muted.more} new while muted]`);
    // Time Warp dark: a steady Time Warp drawn frame by frame (all in one evaluation)
    const dark = await ev(`(() => {
      __et.start(2, { hospital: 0 }); __et.advance(0.1);
      const s = __et.snapshot(), t0 = s.time;
      const keep = ['.nest .nest-art', '.nest .readout > span', '#warp svg.clock-art', '#warp .plaque', '#warp .caption', '#cords .lightning'];
      const look = () => keep.map(q => [...document.querySelectorAll(q)].slice(0, 3).map(e => { const c = getComputedStyle(e); return c.opacity + '|' + (c.filter.includes('brightness') ? 'dim' : '') + '|' + !!e.closest('#backdrop'); }).join(','));
      ET.view.render(Object.assign({}, s, { warp: false, time: t0 }));
      const before = look();
      ET.view.render(Object.assign({}, s, { warp: true, time: t0 + 0.05 }));
      const veil = document.querySelector('#backdrop .veil'), cs = getComputedStyle(veil);
      const on = { dark: ET.view.backdrop().dark, cls: veil.classList.contains('dark'), fade: cs.transitionDuration, prop: cs.transitionProperty };
      const during = look();
      ET.view.render(Object.assign({}, s, { warp: false, time: t0 + 0.7 }));
      const off = ET.view.backdrop().dark;
      // rapid Time Warp on and off, every 0.1 s: the veil's guard
      for (let i = 0; i < 40; i++) ET.view.render(Object.assign({}, s, { warp: i % 2 === 0, time: t0 + 1.5 + i * 0.1 }));
      const log = ET.view.backdrop().darkLog.filter(e => e.t >= t0 + 1.5);
      __et.start(2, { hospital: 0 }); __et.advance(0.1);
      return { on, off, same: JSON.stringify(before) === JSON.stringify(during), gaps: log.slice(1).map((e, i) => +(e.t - log[i].t).toFixed(2)) };
    })()`);
    ok(dark.on.dark && dark.on.cls && dark.on.fade === "0.5s" && dark.on.prop === "opacity" && !dark.off,
      `when Time Warp starts, the board and its lights fade to dark over half a second, and fade back when it ends   [${dark.on.fade} ${dark.on.prop}]`);
    ok(dark.same, "…leaving the nests, eggs, text boxes, the clock, its sign and caption and the bolts untouched");
    ok(dark.gaps.length > 0 && dark.gaps.every((g) => g >= 0.5 - 1e-6), `SAFETY: the dark changes at most once in half a second, however fast Time Warp flips   [gaps ${dark.gaps.slice(0, 6).join(" ")} s]`);
    // reduced motion: no lights; the Time Warp dark still happens, as a fade
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const rm = await ev(`(() => { __et.start(2, { hospital: 0 }); __et.advance(0.1); let most = 0;
      for (let i = 0; i < 200; i++) { __et.advance(0.05); most = Math.max(most, ET.view.backdrop().lights.length); }
      const s = __et.snapshot(); ET.view.render(Object.assign({}, s, { warp: true, time: s.time + 0.05 }));
      const v = getComputedStyle(document.querySelector('#backdrop .veil'));
      const out = { most, starts: ET.view.backdrop().starts.length, dark: ET.view.backdrop().dark, fade: v.transitionDuration };
      __et.start(2, { hospital: 0 }); __et.advance(0.1); return out; })()`);
    ok(rm.most === 0 && rm.starts === 0 && rm.dark && rm.fade === "0.5s", `SAFETY: with reduced motion there are no lights, and the Time Warp dark is still a fade   [${rm.starts} lights, ${rm.fade}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
  }

  /* ------------------------------------------------------- Q. the scary mom face */
  /* ------------------------------------------------------ E38. pieces, the hose's push, the trough */
  section("E38. pieces, the hose's push and the trough (Chat, 2026-09-25)");
  {
    const escK = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    await ev(`(() => { __et.start(1, { hospital: 0 }); __et.advance(0.1); ${escK}; return 1; })()`);   // paused: only the rig moves things
    for (let i = 0; i < 60 && !(await ev("ET.pieces.state().ready")); i++) await wait(100);
    // helpers, in board px: a drag as the player makes one, the physics stepped on its own, a row clear of every readout
    await ev(`(() => {
      window.__drag = (pts) => { const f = document.querySelector('#field'), b = document.querySelector('#board').getBoundingClientRect();
        const fire = (t, p) => f.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: b.left + p[0], clientY: b.top + p[1], pointerId: 9, buttons: 1 }));
        // Andrew, 2026-09-30: the water pushes every frame the jet is on, so each pointer event here is followed by two
        // frames of play (the stream, then the pieces): a hand's sweep, at 60 frames a second
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const frame = () => { for (let k = 0; k < 2; k++) { ET.view.stream(1 / 60); ET.pieces.frame(1 / 60, still); } };
        fire('pointerdown', pts[0]); frame(); pts.slice(1).forEach((p) => { fire('pointermove', p); frame(); }); fire('pointerup', pts[pts.length - 1]); };
      window.__steps = (n, still) => { for (let i = 0; i < n; i++) ET.pieces.frame(0.05, !!still); return 1; };
      window.__row = (m) => { const s = ET.pieces.state(); let best = null;
        for (let y = 60; y < s.H - 60; y += 4) if (s.walls.every((w) => y < w.y0 - m || y > w.y1 + m)) { if (best === null || Math.abs(y - s.H / 2) < Math.abs(best - s.H / 2)) best = y; }
        return best; };
      window.__col = (m) => { const s = ET.pieces.state(); let best = null;
        for (let x = s.T + 40; x < s.W - s.T - 40; x += 4) if (s.walls.every((w) => w.y0 > 220 || x < w.x0 - m || x > w.x1 + m)) { if (best === null || Math.abs(x - s.W / 3) < Math.abs(best - s.W / 3)) best = x; }
        return best; };
      window.__floorAt = (x, y) => { const s = ET.pieces.state(), f = ET.view.floor(); return [x / s.W * f.width, y / s.H * f.height]; };
      window.__p = (id) => ET.pieces.list().find((p) => p.id === id) || null;
      return 1; })()`);

    // the walls pieces pile round are the readouts where they're drawn (measured by layout, so an unlock can't skew them)
    await wait(600);
    const wallsOk = await ev(`(() => { ET.pieces.layout(); const s = ET.pieces.state(), b = document.querySelector('#board').getBoundingClientRect(), pad = ET.CONFIG.pieces.wallPad * s.H;
      const drawn = [...document.querySelectorAll('.nest .readout')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      let worst = 0; drawn.forEach((r) => { const best = Math.min(...s.walls.map((w) => Math.abs(w.x0 + pad - (r.left - b.left)) + Math.abs(w.y0 + pad - (r.top - b.top)) + Math.abs(w.x1 - pad - (r.right - b.left)) + Math.abs(w.y1 - pad - (r.bottom - b.top)))); worst = Math.max(worst, best); });
      return { n: drawn.length, walls: s.walls.length, worst }; })()`);
    ok(wallsOk.n === 12 && wallsOk.walls === 12 && wallsOk.worst < 4, `the pieces' walls are the 12 readouts, where they're drawn   [worst ${wallsOk.worst.toFixed(1)} px out]`);
    // every clear leaves shell pieces; break stages 3-5 add the alien's parts, more the slower
    const made = await ev(`(() => { ET.pieces.reset(); const svg = document.querySelector('.nest .nest-art'), out = [];
      for (const t of [1, 2, 3, 4, 5]) { const k0 = ET.pieces.state().kinds; ET.pieces.clear(svg, t); const k1 = ET.pieces.state().kinds;
        const parts = Object.keys(k1).filter((k) => k !== 'shell').reduce((a, k) => a + k1[k] - (k0[k] || 0), 0);
        out.push({ t, shell: (k1.shell || 0) - (k0.shell || 0), parts }); }
      return out; })()`);
    const PT = await ev("ET.CONFIG.pieces");
    ok(made.every((m) => m.shell >= PT.shards[0] && m.shell <= PT.shards[1]), `every clear leaves ${PT.shards[0]}-${PT.shards[1]} shell pieces   [${made.map((m) => m.shell).join(", ")}]`);
    eq(made.map((m) => m.parts), [0, 0, 1, 2, 3], "break stages 3, 4 and 5 add 1, 2 and 3 alien parts (antenna, clawed leg, tentacle and goo, eye); 1 and 2 none");
    await ev("__steps(80)");
    const settled = await ev(`(() => { const s = ET.pieces.state(), L = ET.pieces.list();
      const onWall = L.filter((p) => p.state === 'rest' && s.walls.some((w) => p.x > w.x0 + 1 && p.x < w.x1 - 1 && p.y > w.y0 + 1 && p.y < w.y1 - 1)).length;
      const off = L.filter((p) => p.x < 0 || p.x > s.W || p.y < 0 || p.y > s.H).length;
      return { n: L.length + s.drained, rest: s.rest, onWall, off }; })()`);
    ok(settled.rest > 0 && settled.onWall === 0 && settled.off === 0, `they slide, settle and pile round the readouts, never on one, and stay on the board   [${settled.rest} at rest, ${settled.onWall} on a readout]`);
    await ev("__steps(400)");
    eq(await ev("ET.pieces.state().count + ET.pieces.state().drained"), settled.n, "…and never fade or vanish on their own (20 s later, every one is still there)");
    // Andrew's ruling (2026-09-26): the shell pieces are the break stages' ten shell sprites (they were cut from the egg
    // picture), plain or mirrored
    const sprites = await ev(`(() => { ET.pieces.reset(); const svg = document.querySelector('.nest .nest-art'); for (let i = 0; i < 40; i++) ET.pieces.clear(svg, 1);
      const L = ET.pieces.list().filter((p) => p.kind === 'shell'); ET.pieces.reset();
      return { n: L.length, bad: L.filter((p) => !/^break--shell-(0[1-9]|10)(:mirrored)?$/.test(p.sprite || '')).length,
               names: new Set(L.map((p) => (p.sprite || '').split(':')[0])).size, mirrored: L.filter((p) => /:mirrored$/.test(p.sprite || '')).length }; })()`);
    ok(sprites.n > 0 && sprites.bad === 0 && sprites.names === 10 && sprites.mirrored > 0 && sprites.mirrored < sprites.n,
      `every shell piece is one of the break stages' ten shell sprites, so the shell looks the same everywhere, plain or mirrored   [${sprites.n} pieces, ${sprites.names} sprites, ${sprites.mirrored} mirrored, ${sprites.bad} other]`);

    // E42: one good sweep of the hose carries a piece all the way across the board into the trough on the far side (it
    // went ~80% of the way), at every measured size (the board is 2.25-2.74 board heights wide)
    const sweeps = [];
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 640]]) {
      await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await wait(200);
      // (the nozzle is aimed the sweep's way first, over an empty board: E44 turns it over a tenth of a second or so)
      sweeps.push(await ev(`(() => { ET.pieces.layout(); const s = ET.pieces.state(), row = __row(40); ET.pieces.reset();
        __drag([0, 1, 2, 3].map((i) => [s.T + 20 + 30 * i, row])); ET.pieces.reset(); const id = ET.pieces.place('shell', s.T + 70, row);
        __drag([0, 1, 2, 3, 4, 5, 6].map((i) => [s.T + 20 + 20 * i, row])); const mid = __p(id).state; let at = null;
        for (let i = 0; i < 400 && at === null; i++) { __steps(1); const p = __p(id); if (!p || p.state === 'trough') at = p ? p.x : 'gone'; }
        return { size: '${w}x${h}', mid, at, far: s.W - s.T }; })()`));
    }
    await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await wait(200);
    ok(sweeps.every((q) => q.mid === "live" && typeof q.at === "number" && q.at >= q.far - 2), `E42: one good sweep of the hose carries a piece all the way across the board into the trough on the far side, at every measured size   [${sweeps.map((q) => q.size + (typeof q.at === "number" ? " in at x " + Math.round(q.at) + " of " + Math.round(q.far) : " " + q.at)).join(", ")}]`);
    // a flick (one spray event) sends it sliding the way it goes; it tumbles, then settles with friction
    const row = await ev("__row(40)"), W = await ev("ET.pieces.state().W"), T = await ev("ET.pieces.state().T");
    const pushed = await ev(`(() => { ET.pieces.layout(); ET.pieces.reset(); const id = ET.pieces.place('shell', ${T} + 70, ${row}); const a0 = __p(id).a;
      __drag([[${T} + 50, ${row}], [${T} + 70, ${row}]]);
      const mid = __p(id).state; __steps(120); const p = __p(id); return { mid, x: p ? p.x : null, state: p ? p.state : 'gone', turned: p ? Math.abs(p.a - a0) > 0.3 : false }; })()`);
    ok(pushed.mid === "live" && pushed.x > T + 70 + 0.2 * W && pushed.turned && pushed.state === "rest", `a flick of the hose sends a piece sliding the way it goes, tumbling, then settling with friction   [${Math.round(pushed.x - T - 70)} px of ${Math.round(W)}]`);
    // the top edge stops a piece (no trough there)
    const col = await ev("__col(40)");
    ok(col !== null, `(a column near the top clear of every readout, for the next checks   [x ${col}])`);
    const top = await ev(`(() => { ET.pieces.reset(); const id = ET.pieces.place('shell', ${col}, 90);
      __drag([[${col}, 140], [${col}, 120], [${col}, 100], [${col}, 80], [${col}, 60], [${col}, 40]]); __steps(80); const p = __p(id);
      return { y: p && Math.round(p.y), state: p ? p.state : 'gone', r: p && p.r }; })()`);
    ok(top.state === "rest" && top.y <= top.r + 2, `pushed up, a piece stops at the top edge (no trough along the top)   [y ${top.y}]`);

    // the trough: in it goes, it rides the flow to the drain under the sink, with a squelch; an eye goes "bloop"
    await ev(`(() => { window.__snd = { squelch: 0, bloop: 0 }; ['squelch', 'bloop'].forEach((k) => { const f = ET.audio[k]; ET.audio[k] = function () { __snd[k]++; return f.apply(this, arguments); }; ET.audio[k].__orig = f; }); return 1; })()`);
    const tr = await ev(`(() => { ET.pieces.reset(); const s = ET.pieces.state();
      ET.pieces.place('eye', s.T + 50, ${row}); ET.pieces.place('shell', s.W - s.T - 50, ${row});
      __drag([[s.T + 110, ${row}], [s.T + 90, ${row}], [s.T + 70, ${row}], [s.T + 50, ${row}], [s.T + 30, ${row}]]);
      __drag([[s.W - s.T - 110, ${row}], [s.W - s.T - 90, ${row}], [s.W - s.T - 70, ${row}], [s.W - s.T - 50, ${row}], [s.W - s.T - 30, ${row}]]);
      __steps(6); const inT = ET.pieces.state().trough; const path = [];
      for (let i = 0; i < 400 && ET.pieces.state().count; i++) { __steps(1); ET.pieces.list().forEach((p) => { if (p.state === 'trough') path.push([p.x, p.y]); }); }
      const e = ET.pieces.state(), inside = path.every(([x, y]) => x <= s.T || x >= s.W - s.T || y >= s.H - s.T);
      return { inT, drained: e.drained, eyes: e.eyesDrained, left: e.count, inside, snd: Object.assign({}, __snd) }; })()`);
    ok(tr.inT === 2 && tr.inside && tr.drained === 2 && tr.left === 0, `pushed into the trough, a piece rides the flow along the edges to the drain under the sink and goes down it   [${tr.drained} drained]`);
    ok(tr.snd.squelch >= 1 && tr.eyes === 1 && tr.snd.bloop === 1, `…with a squelch as it drops in, and a "bloop" as an eyeball goes down the drain   [${tr.snd.squelch} squelch, ${tr.snd.bloop} bloop]`);
    await ev("(() => { ['squelch', 'bloop'].forEach((k) => { ET.audio[k] = ET.audio[k].__orig; }); return 1; })()");

    // liquid: the spray streaks it along and thins it; pushed to the top, it drips back down
    const streak = await ev(`(() => { const f = ET.view.floor(); ET.mess.clear(f); const y = ${row}, x = ${W} / 2;
      const c = __floorAt(x, y), r = __floorAt(x + 70, y); ET.mess.blob(f, c[0], c[1], 20);
      const a0 = ET.mess.sample(f, c[0], c[1]).alpha, b0 = ET.mess.sample(f, r[0], r[1]).alpha;
      __drag([[x - 40, y], [x - 20, y], [x, y], [x + 20, y], [x + 40, y]]);
      return [a0, ET.mess.sample(f, c[0], c[1]).alpha, b0, ET.mess.sample(f, r[0], r[1]).alpha]; })()`);
    ok(streak[1] < streak[0] * 0.6 && streak[3] > streak[2], `the spray streaks yolk the way it goes and thins it where it was, not pushed like a solid   [${streak[0]} → ${streak[1]} here, ${streak[2]} → ${streak[3]} further on]`);
    const drip = await ev(`(() => { const f = ET.view.floor(); ET.mess.clear(f); ET.pieces.reset(); const x = ${col};
      const c = __floorAt(x, 30); ET.mess.blob(f, c[0], c[1], 45);
      __drag([[x, 150], [x, 120], [x, 90], [x, 60], [x, 40], [x, 24], [x, 12]]);
      const s0 = ET.pieces.state(); const y0 = s0.dripsAt.length ? s0.dripsAt[0][1] : null; __steps(20); const s1 = ET.pieces.state();
      return { n: s0.drips, y0, y1: s1.dripsAt.length ? s1.dripsAt[0][1] : null }; })()`);
    ok(drip.n >= 1 && drip.y1 > drip.y0, `yolk pushed to the top edge slowly drips back down   [${drip.n} drip, y ${drip.y0 && drip.y0.toFixed(0)} → ${drip.y1 && drip.y1.toFixed(0)}]`);
    const around = await ev(`(() => { ET.pieces.reset(); const s = ET.pieces.state(), w = s.walls[0];
      ET.pieces.drip((w.x0 + w.x1) / 2, w.y0 - 30); let over = 0, n = 0;
      for (let i = 0; i < 300 && ET.pieces.state().drips; i++) { __steps(1); ET.pieces.state().dripsAt.forEach(([x, y]) => { n++; if (x > w.x0 && x < w.x1 && y > w.y0 && y < w.y1) over++; }); }
      return { over, n }; })()`);
    ok(around.n > 0 && around.over === 0, `a drip that meets a readout runs round it, never over it   [${around.n} drip steps, ${around.over} over]`);
    const ride = await ev(`(() => { const f = ET.view.floor(); ET.mess.clear(f); ET.pieces.reset(); const x = ${col};
      const c = __floorAt(x, 10); ET.mess.blob(f, c[0], c[1], 40);
      const id = ET.pieces.place('shell', x, 10); const s0 = ET.pieces.state(), y0 = __p(id).y; __steps(40); const y1 = __p(id).y, riding = ET.pieces.state().riding;
      __steps(400); const p = __p(id); return { riding0: s0.riding, riding, y0, y1, end: p.state, still: ET.pieces.state().riding }; })()`);
    ok(ride.riding0 === 1 && ride.riding === 1 && ride.y1 > ride.y0 + 10 && ride.end === "rest" && ride.still === 0, `a piece at the top edge sitting in yolk slowly slides down with its drip, then settles   [y ${ride.y0.toFixed(0)} → ${ride.y1.toFixed(0)}]`);
    await ev("(ET.mess.clear(ET.view.floor()), 1)");

    // performance: a pile at rest is baked into a still layer and costs nothing a frame; the spray wakes only what it touches
    const perf = await ev(`(() => { ET.pieces.reset(); ET.pieces.bench(3000); const t0 = performance.now(); for (let i = 0; i < 60; i++) ET.pieces.frame(0.016, false);
      const frame = (performance.now() - t0) / 60, s = ET.pieces.state(), y = ${row};
      // (Andrew, 2026-09-30: the stream works every frame, so the sweep is timed per frame of play: 5 events, 2 frames each)
      const t1 = performance.now(); __drag([[s.W * 0.3, y], [s.W * 0.35, y], [s.W * 0.4, y], [s.W * 0.45, y], [s.W * 0.5, y]]); ET.pieces.frame(0.016, false); let sweep = (performance.now() - t1) / 11;
      const woke = ET.pieces.state().live;
      // timing is noisy on a busy machine: two more sweeps along the same row, and the fastest counts (steadied 2026-10-01)
      for (let k = 0; k < 2; k++) { const xs = [0.5, 0.45, 0.4, 0.35, 0.3].map((f) => [s.W * f, y]); if (k) xs.reverse(); const t = performance.now(); __drag(xs); ET.pieces.frame(0.016, false); sweep = Math.min(sweep, (performance.now() - t) / 11); }
      __steps(200); return { frame, sweep, woke, count: ET.pieces.state().count + ET.pieces.state().drained }; })()`);
    ok(perf.frame < 3 && perf.sweep < 16 && perf.woke > 0 && perf.count === 3000, `a pile of 3000 pieces costs ${perf.frame.toFixed(2)} ms a frame at rest; a sweep through it wakes ${perf.woke} and takes ${perf.sweep.toFixed(1)} ms a frame (under a 60 fps frame); nothing disappears`);

    // reduced motion: no tumbling, pieces only slide; the trough's flow is a fade; its water stands still
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const rm = await ev(`(() => { ET.pieces.reset(); const id = ET.pieces.place('shell', ${T} + 70, ${row}), a0 = __p(id).a;
      __drag([[${T} + 50, ${row}], [${T} + 70, ${row}]]); __steps(60, true); const p = __p(id);
      const s = ET.pieces.state(); const e = ET.pieces.place('shell', s.W - s.T - 50, ${row});
      __drag([[s.W - s.T - 110, ${row}], [s.W - s.T - 70, ${row}], [s.W - s.T - 30, ${row}]]); __steps(4, true); const q = __p(e);
      __steps(40, true);
      return { slid: p.x > ${T} + 150, same: p.a === a0, fading: !!q && q.state === 'trough', gone: !__p(e), anim: getComputedStyle(document.querySelector('#trough .t-left')).animationName }; })()`);
    ok(rm.slid && rm.same && rm.fading && rm.gone && rm.anim === "none", `SAFETY: with reduced motion pieces slide without tumbling, the trough takes a piece with a fade, and its water stands still   [${JSON.stringify(rm)}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });

    // the hose's tag moves up just clear of the trough, still beside the hose and the sink (E28)
    const tag = await ev(`(() => { const t = document.querySelector('#hose-tag').getBoundingClientRect(), b = document.querySelector('#trough .t-br').getBoundingClientRect(), f = document.querySelector('#field').getBoundingClientRect();
      return { gap: b.top - t.bottom, off: t.left - (f.left + f.width * ET.CONFIG.hoseSpigotX) }; })()`);
    ok(tag.gap >= 0 && tag.gap < 8 && tag.off >= 0 && tag.off < 40, `the CLEANING HOSE tag sits just clear of the trough, still beside the hose and the sink   [${tag.gap.toFixed(1)} px above it, ${tag.off.toFixed(0)} px from the spigot]`);
    // and the trough crowds nothing, at every measured size
    const fits = [];
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 640]]) {
      await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await wait(150);
      fits.push(await ev(`(() => { const rs = (q) => [...document.querySelectorAll(q)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
        const tr = rs('#trough i'), things = rs('.nest .readout').concat(rs('.nest .nest-art'), rs('#console'));
        const hit = tr.some((a) => things.some((b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5));
        return { size: '${w}x${h}', hit, t: Math.round(tr[0].width) }; })()`));
    }
    await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await wait(150);
    ok(fits.every((f) => !f.hit), `the trough (left, right, bottom; none on top) touches no nest, readout or Command Line at any measured size   [${fits.map((f) => f.size + " " + f.t + " px" + (f.hit ? " HIT" : "")).join(", ")}]`);
    await ev(`(() => { ET.pieces.reset(); ${escK}; return 1; })()`);   // resume

    // what's left at the end of cleanup carries into the next wave: nothing removed
    const carry = await ev(`(() => { __et.start(2, { hospital: 0 }); __et.advance(0.1); ET.pieces.bench(30); const ids = ET.pieces.list().map((p) => p.id);
      for (let i = 0; i < 20000 && __et.snapshot().wave === 1; i++) { __et.advance(0.05); __et.snapshot().nests.filter((n) => n.state === 'overtime').forEach((n) => __et.submit('RCAV ' + n.unit)); }
      const now = ET.pieces.list().map((p) => p.id); return { wave: __et.snapshot().wave, kept: ids.every((id) => now.includes(id)), more: now.length > ids.length }; })()`);
    ok(carry.wave === 2 && carry.kept && carry.more, `pieces left at the end of cleanup carry into the next wave, none removed (and the wave's clears added more)   [wave ${carry.wave}]`);
  }

  /* ------------------------------------------------------ E42. the hose's blast */
  section("E42. the hose's blast: a jet, not a trickle (Chat, 2026-09-25)");
  {
    const escK = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    await ev("__et.start(1, { hospital: 0 }); __et.advance(0.1); 1");
    if (await ev("__et.paused()")) await ev(`(() => { ${escK}; return 1; })()`);
    const fireJs = "const f = document.querySelector('#field'), b = document.querySelector('#board').getBoundingClientRect(); const fire = (t, x, y) => f.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: b.left + x, clientY: b.top + y, pointerId: 11, buttons: 1 }));";
    // press, drag right, hold still 0.4 s, release: all in one evaluation, timed in the page
    const held = await ev(`new Promise((done) => { ${fireJs}
      document.querySelectorAll('#water .drop, #water .splash').forEach((d) => d.remove());
      fire('pointerdown', 400, 300);
      const j = document.querySelector('#water .jet'), m0 = new DOMMatrix(getComputedStyle(j).transform);
      const r0 = { shown: !j.hidden, blasting: ET.audio.blasting(), aim: [+m0.a.toFixed(3), +m0.b.toFixed(3)] };
      fire('pointermove', 430, 300); fire('pointermove', 460, 300);
      let r1 = null;
      setTimeout(() => { const jr = j.getBoundingClientRect(), m1 = new DOMMatrix(getComputedStyle(j).transform);
        r1 = { w: parseFloat(j.style.height), len: parseFloat(j.style.width), H: b.height, aim: [+m1.a.toFixed(3), +m1.b.toFixed(3)], left: jr.left - b.left,
          anim: getComputedStyle(j.querySelector('.core')).animationName + '/' + getComputedStyle(j.querySelector('.burst')).animationName, drops: document.querySelectorAll('#water .drop').length }; }, 300);
      setTimeout(() => {
        const r2 = { drops: document.querySelectorAll('#water .drop').length, splash: document.querySelectorAll('#water .splash').length, shown: !j.hidden, blasting: ET.audio.blasting() };
        fire('pointerup', 460, 300);
        done({ r0, r1, r2, r3: { shown: !j.hidden, blasting: ET.audio.blasting() } });
      }, 700); })`);
    const J = await ev("ET.CONFIG.hoseJet");
    ok(held.r0.shown && held.r0.blasting && Math.abs(held.r0.aim[0] + Math.SQRT1_2) < 0.01 && Math.abs(held.r0.aim[1] + Math.SQRT1_2) < 0.01,
      `pressing starts the jet at once, pointing the nozzle's way (up-left), and the blast with it   [${JSON.stringify(held.r0)}]`);
    ok(held.r1.aim[0] > 0.99 && Math.abs(held.r1.left - 460) <= held.r1.w && Math.abs(held.r1.len - J.length * held.r1.H) < 1,
      `dragging, the jet runs from the nozzle the way the drag goes (E44), ${J.length} board heights long   [${Math.round(held.r1.len)} px, from x ${Math.round(held.r1.left)}]`);
    ok(held.r1.w >= 10 && held.r1.anim === "jet-flow/jet-burst" && held.r1.drops > 0,
      `it's a thick, fast jet (${held.r1.w.toFixed(1)} px; the old drops were 6), streaming, with a burst at the nozzle and mist along it   [${held.r1.anim}, ${held.r1.drops} mist]`);
    ok(held.r2.shown && held.r2.blasting && held.r2.drops > 0 && held.r2.splash > 0, `held still, it keeps blasting: mist, a splash where it hits, the sound   [${JSON.stringify(held.r2)}]`);
    ok(!held.r3.shown && !held.r3.blasting, "letting go ends the jet and the blast");
    // the jet pushes what it reaches ahead of the nozzle (the old spray caught only what the nozzle passed)
    const reach = await ev(`(() => { ET.pieces.layout(); ET.pieces.reset(); const s = ET.pieces.state(), row = __row(40), x = s.W / 2, L = ET.CONFIG.hoseJet.length * s.H;
      const id = ET.pieces.place('shell', x + 0.7 * L, row); __drag([[x - 20, row], [x, row]]); const st = __p(id).state; ET.pieces.reset(); return st; })()`);
    eq(reach, "live", "the jet pushes a piece it reaches ahead of the nozzle");
    // Andrew, 2026-09-30: the WATER pushes: every frame the jet is on, held still or not, anything any part of the stream
    // touches goes the way the water flows, harder near the nozzle; goo along the stream washes and is carried the same way
    const water = await ev(`(() => { ET.pieces.layout(); ET.pieces.reset(); const s = ET.pieces.state(), row = __row(40), x = s.W * 0.35, L = ET.CONFIG.hoseJet.length * s.H;
      const f = document.querySelector('#field'), b = document.querySelector('#board').getBoundingClientRect();
      const fire = (t, px, py) => f.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: b.left + px, clientY: b.top + py, pointerId: 9, buttons: 1 }));
      __drag([[x - 90, row], [x - 60, row], [x - 30, row], [x, row]]);   // aim it right, along the row
      ET.pieces.reset();
      const near = ET.pieces.place('shell', x + 0.2 * L, row), far = ET.pieces.place('shell', x + 0.9 * L, row + 0.4 * L);
      const fl = ET.view.floor(); ET.mess.clear(fl);
      // press and HOLD STILL, the nozzle turned up-right (-30°) by a short drag that way first
      fire('pointerdown', x, row); fire('pointermove', x + 10 * Math.cos(-Math.PI / 6), row + 10 * Math.sin(-Math.PI / 6));
      for (let i = 0; i < 40; i++) ET.view.stream(1 / 60);
      const aimNow = ET.view.aim().shown;
      ET.pieces.reset();
      const n = ET.pieces.place('shell', x + 10 + 0.2 * L * Math.cos(aimNow), row + 0.2 * L * Math.sin(aimNow));
      const m = ET.pieces.place('shell', x + 10 + 0.9 * L * Math.cos(aimNow), row + 0.9 * L * Math.sin(aimNow));
      ET.view.stream(1 / 60);
      const pn = __p(n), pm = __p(m), vn = Math.hypot(pn.vx, pn.vy), vm = Math.hypot(pm.vx, pm.vy);
      const dirErr = Math.abs(Math.atan2(pn.vy, pn.vx) - aimNow);
      ET.pieces.reset();
      const gp = __floorAt(x + 10 + 0.6 * L * Math.cos(aimNow), row + 0.6 * L * Math.sin(aimNow)); ET.mess.blob(fl, gp[0], gp[1], 14);
      const g0 = ET.mess.sample(fl, gp[0], gp[1]).alpha;
      for (let i = 0; i < 30; i++) ET.view.stream(1 / 60);
      const g1 = ET.mess.sample(fl, gp[0], gp[1]).alpha;
      fire('pointerup', x + 10, row); ET.pieces.reset(); ET.mess.clear(fl);
      return { held: pn.state, vn: +vn.toFixed(1), vm: +vm.toFixed(1), dirErr: +dirErr.toFixed(3), aim: +(aimNow * 180 / Math.PI).toFixed(0), g0, g1 }; })()`);
    ok(water.held === "live" && water.vn > 0, `held still, the stream still pushes what it touches   ${JSON.stringify(water)}`);
    ok(water.dirErr < 0.05, "…the way the water flows (the jet's own direction, not the drag's)");
    ok(water.vm > 0 && water.vn > water.vm * 1.5, "…harder near the nozzle than at the far end of the stream");
    ok(water.g0 > 150 && water.g1 < water.g0 * 0.5, "…and goo anywhere along the stream washes out, held still, not only under the nozzle");
    const taps = await ev(`(() => { ${fireJs} const r = []; for (let i = 0; i < 4; i++) { fire('pointerdown', 400, 300); r.push(ET.audio.blasting()); fire('pointerup', 400, 300); } return r; })()`);
    eq(taps, [true, true, true, true], "quick taps blast every time (the last blast's fade never uses up the cap)");
    // a pause, and the play screen closing, end the blast
    const paused = await ev(`(() => { ${fireJs} fire('pointerdown', 400, 300); const a = ET.audio.blasting(); ${escK}; const r = { a, b: ET.audio.blasting(), shown: !document.querySelector('#water .jet').hidden }; ${escK}; return r; })()`);
    ok(paused.a && !paused.b && !paused.shown, `Esc mid-spray pauses the game and ends the jet and its blast   [${JSON.stringify(paused)}]`);
    const gone = await ev(`(() => { ${fireJs} fire('pointerdown', 400, 300); const a = ET.audio.blasting(); __et.show('over'); const z = ET.audio.blasting(); return { a, b: z }; })()`);
    ok(gone.a && !gone.b, "leaving the play screen mid-spray ends the blast");
    await ev("__et.start(1, { hospital: 0 }); __et.advance(0.1); 1");
    if (await ev("__et.paused()")) await ev(`(() => { ${escK}; return 1; })()`);

    // the sound: under the music with no dip; under THONG, the buzz and the hiss; on the overlap cap; muted with the rest
    const dip = await ev("new Promise((done) => { ET.audio.blast(true); setTimeout(() => { const d = __et.music().duck; ET.audio.blast(false); done(d); }, 150); })");
    ok(dip > 0.999, `the blast doesn't dip the music   [music at ${dip}]`);
    const loud = await ev(`(async () => {
      // BS.1770's K-weighting (a shelf and a high-pass), then its loudness: -0.691 + 10 log10(mean square)
      const kw = async (buf) => { const o = new OfflineAudioContext(1, buf.length, buf.sampleRate), s = o.createBufferSource(), a = o.createBiquadFilter(), b = o.createBiquadFilter();
        s.buffer = buf; a.type = 'highshelf'; a.frequency.value = 1681; a.gain.value = 4; b.type = 'highpass'; b.frequency.value = 38; b.Q.value = 0.5; s.connect(a).connect(b).connect(o.destination); s.start();
        const r = await o.startRendering(), d = r.getChannelData(0); let q = 0; for (let i = 0; i < d.length; i++) q += d[i] * d[i]; return -0.691 + 10 * Math.log10(q / d.length); };
      const out = {};
      for (const [k, a] of [['thong'], ['buzz'], ['hiss', [0.85, 0.12]], ['blast', [true]]]) { const r = await ET.audio.measure(k, a, 1); out[k] = { peak: +r.peak.toFixed(3), active: +r.active.toFixed(4) }; if (k === 'blast') out.lufs = +(await kw(r.buffer) + 20 * Math.log10(ET.audio.LEVEL)).toFixed(1); }
      return out; })()`);
    const target = await ev("ET.CONFIG.musicLufs"), cues = [loud.thong, loud.buzz, loud.hiss];
    ok(loud.lufs <= target - 6, `the blast sits under the music: ${loud.lufs} LUFS at the master level, the music ${target}`);
    ok(loud.blast.peak <= 0.6 * Math.min(...cues.map((q) => q.peak)) && loud.blast.active <= 0.6 * Math.min(...cues.map((q) => q.active)),
      `…and clearly under THONG, the buzz and the hiss (under 60% of the quietest one's peak and loudness while it sounds)   [blast ${loud.blast.peak}/${loud.blast.active}; cues ${cues.map((q) => q.peak + "/" + q.active).join(", ")}]`);
    const cap = await ev("(() => { const n = ET.CONFIG.layMaxOverlap; ET.CONFIG.layMaxOverlap = 0; const r = ET.audio.blast(true); ET.CONFIG.layMaxOverlap = n; if (r) ET.audio.blast(false); return r; })()");
    eq(cap, false, "it shares the egg-laying sounds' overlap cap");
    const heard = await ev("new Promise((done) => { ET.audio.blast(true); setTimeout(() => { let p = 0; for (let i = 0; i < 5; i++) p = Math.max(p, ET.audio.peak()); ET.audio.blast(false); done(p); }, 200); })");
    await ev("ET.audio.setMuted(true)");
    await wait(100);
    const hush = await ev("new Promise((done) => { ET.audio.blast(true); setTimeout(() => { let p = 0; for (let i = 0; i < 5; i++) p = Math.max(p, ET.audio.peak()); ET.audio.blast(false); done(p); }, 200); })");
    await ev("ET.audio.setMuted(false)");
    ok(heard > 1e-3 && hush < 1e-4, `muting silences it with everything else   [${heard.toFixed(4)} → ${hush.toExponential(1)}]`);

    // SAFETY: with reduced motion, the jet only, standing still: no burst, mist or splash
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const rm = await ev(`new Promise((done) => { ${fireJs}
      document.querySelectorAll('#water .drop, #water .splash').forEach((d) => d.remove());
      fire('pointerdown', 400, 300); fire('pointermove', 430, 300);
      setTimeout(() => { const j = document.querySelector('#water .jet');
        const r = { shown: !j.hidden, core: getComputedStyle(j.querySelector('.core')).animationName, burst: getComputedStyle(j.querySelector('.burst')).display, bits: document.querySelectorAll('#water .drop, #water .splash').length };
        fire('pointerup', 430, 300); done(r); }, 300); })`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
    ok(rm.shown && rm.core === "none" && rm.burst === "none" && rm.bits === 0, `SAFETY: with reduced motion the jet shows standing still: no burst, no mist, no splash   [${JSON.stringify(rm)}]`);
  }

  /* ------------------------------------------------------ E44. the nozzle turns with the jet */
  section("E44 and E51. the nozzle picture turns with the jet, at once, the way the mouse is going (Chat, 2026-09-25; Andrew, 2026-10-01)");
  {
    await ev("__et.start(1, { hospital: 0 }); __et.advance(0.1); 1");
    if (await ev("__et.paused()")) await ev("(document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })), 1)");
    const UL = -3 * Math.PI / 4;
    // where the drawn nozzle's tip is, its turn, and the hose's end, with the pointer at (x, y)
    const look = `(() => { const n = document.querySelector('#nozzle'), m = new DOMMatrix(getComputedStyle(n).transform), a = ET.view.aim();
      const d = document.querySelector('#hose .hose-body').getAttribute('d').trim().split(/[ ,]+/), sr = document.querySelector('#screen-play').getBoundingClientRect();
      const j = document.querySelector('#water .jet'), jm = j && !j.hidden ? new DOMMatrix(getComputedStyle(j).transform) : null;
      return { shown: !n.hidden, tip: [3 + m.e, 3 + m.f], turn: Math.atan2(m.b, m.a), want: a.want, at: a.shown,
        hoseEnd: [+d[d.length - 2] + sr.left, +d[d.length - 1] + sr.top], jet: jm ? Math.atan2(jm.b, jm.a) : null }; })()`;
    const near = (x, y, e = 0.02) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y))) < e;
    const s0 = await ev(`(() => { document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 600, clientY: 420 })); return ${look}; })()`);
    ok(s0.shown && near(s0.at, UL) && near(s0.turn, 0) && Math.hypot(s0.tip[0] - 600, s0.tip[1] - 420) < 0.5,
      `before the first drag the nozzle points up-left, as the cursor did, its tip on the pointer   [tip ${s0.tip.map(Math.round)}]`);
    const fireJs = "const f = document.querySelector('#field'); const fire = (t, x, y) => { const e = new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 12, buttons: 1 }); document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y })); f.dispatchEvent(e); };";
    // a drag to the right: E51, the picture snaps onto it (no swing), about its tip, and the jet agrees at every moment
    const sw = await ev(`new Promise((done) => { ${fireJs} const out = [];
      fire('pointerdown', 600, 420); fire('pointermove', 640, 420); out.push(${look});
      setTimeout(() => { out.push(${look}); setTimeout(() => { out.push(${look}); fire('pointermove', 642, 423); fire('pointermove', 639, 419); fire('pointermove', 641, 422); out.push(${look}); done(out); }, 400); }, 40); })`);
    const [a0, a1, a2, a3] = sw;
    ok(near(a0.want, 0) && near(a0.at, 0) && near(a1.at, 0) && near(a2.at, 0),
      `E51: a drag turns it the way the mouse is going at once, no swing   [${[a0, a1, a2].map((q) => (q.at * 180 / Math.PI).toFixed(0) + "°").join(" → ")}]`);
    const rev = await ev(`(() => { ${fireJs} fire('pointermove', 635, 420); const q = ${look}; fire('pointermove', 640, 420); return q; })()`);
    ok(near(rev.at, Math.PI) && near(rev.jet, Math.PI), `…and a reversal flips it at once   [${(rev.at * 180 / Math.PI).toFixed(0)}°]`);
    ok(sw.every((q) => near(q.turn, q.at - UL) && q.jet !== null && near(q.jet, q.at)),
      "…and the picture and the jet point the same way at every moment");
    ok(sw.every((q, i) => Math.hypot(q.tip[0] - (i ? [640, 640, 641][i - 1] : 640), q.tip[1] - (i ? [420, 420, 422][i - 1] : 420)) < 0.5),
      "…turning about its tip, which stays on the pointer (the cleaning point)");
    const back = (q, x, y) => { const t = q.at - UL; return [x + 24 * Math.cos(t) - 24 * Math.sin(t), y + 24 * Math.sin(t) + 24 * Math.cos(t)]; };
    const want2 = back(a2, 640, 420);
    ok(Math.hypot(a2.hoseEnd[0] - want2[0], a2.hoseEnd[1] - want2[1]) < 1, `the hose joins the back of the turned nozzle   [${a2.hoseEnd.map(Math.round)} vs ${want2.map(Math.round)}]`);
    ok(near(a3.want, 0) && near(a3.at, 0), "a small wobble of the mouse (a few px) doesn't turn it");
    // still: it keeps its last direction, through a release and a fresh press
    const kept = await ev(`(() => { ${fireJs} fire('pointerup', 641, 422); const u = ${look}; fire('pointerdown', 641, 422); const p = ${look}; fire('pointerup', 641, 422); return [u, p]; })()`);
    ok(kept.every((q) => near(q.at, 0)) && near(kept[1].jet, 0), "still, it keeps its last direction, and a fresh press sprays that way");
    // down-left, then a new game points it up-left again
    const dl = await ev(`new Promise((done) => { ${fireJs} fire('pointerdown', 700, 300); fire('pointermove', 680, 320); fire('pointermove', 660, 340);
      setTimeout(() => { const q = ${look}; fire('pointerup', 660, 340); done(q); }, 400); })`);
    ok(near(dl.at, 3 * Math.PI / 4), `it follows any direction (down-left here)   [${(dl.at * 180 / Math.PI).toFixed(0)}°]`);
    const fresh = await ev(`(() => { __et.start(1, { hospital: 0 }); __et.advance(0.1); return ${look}; })()`);
    ok(near(fresh.at, UL) && near(fresh.want, UL), "each new game starts it pointing up-left");
    // reduced motion: the same snap (there's no swing to still)
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const snapTurn = await ev(`(() => { ${fireJs} fire('pointerdown', 600, 420); fire('pointermove', 600, 460); const q = ${look}; fire('pointerup', 600, 460); return q; })()`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
    ok(near(snapTurn.at, Math.PI / 2) && near(snapTurn.turn, Math.PI / 2 - UL), `SAFETY: with reduced motion it snaps to the new direction at once, no swing   [${(snapTurn.at * 180 / Math.PI).toFixed(0)}°]`);
    await ev("__et.start(1, { hospital: 0 }); __et.advance(0.1); 1");
  }

  /* ------------------------------------------------------ E43. Time Warp's sound */
  section("E43. Time Warp's sound (Chat, 2026-09-25)");
  {
    await ev("__et.start(1, { hospital: 0 }); __et.advance(0.1); 1");
    if (await ev("__et.paused()")) await ev("(document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })), 1)");
    // every zap, as the board draws: warp off, on (and 3 s of frames), off again (one evaluation: nothing steps between)
    const z = await ev(`(() => { const log = [], o = ET.audio.warp; ET.audio.warp = function (on) { log.push(on); return o(on); };
      const s = __et.snapshot(); let t = s.time; const r = (w) => { t += 0.05; ET.view.render(Object.assign({}, s, { warp: w, time: t })); };
      r(false); const a = log.slice(); r(true); const b = log.slice(); for (let i = 0; i < 60; i++) r(true); const c = log.slice();
      r(false); const d = log.slice(); for (let i = 0; i < 20; i++) r(false); const e = log.slice();
      ET.audio.warp = o; return [a, b, c, d, e]; })()`);
    eq(z, [[], [true], [true], [true, false], [true, false]], "a zap as Time Warp starts, nothing while it runs (3 s of frames), another as it ends, nothing after");
    // rising, then falling: the waveform's crossings get closer together, or further apart; each is over in under a second
    const m = await ev(`Promise.all([['thong'], ['buzz'], ['hiss', [0.85, 0.12]], ['warp', [true]], ['warp', [false]]].map(([k, a]) => ET.audio.measure(k, a, 1).then((r) => {
      const d = r.buffer.getChannelData(0), sr = r.buffer.sampleRate, cross = (t0, t1) => { let n = 0; for (let i = Math.floor(t0 * sr) + 1; i < t1 * sr; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) n++; return n; };
      return { peak: +r.peak.toFixed(3), rms: +r.rms.toFixed(4), span: +r.span.toFixed(2), early: cross(0.03, 0.18), late: cross(0.33, 0.48) }; })))`);
    const [th, bz, hs, up, down] = m, cues = [th, bz, hs];
    ok(up.late > 1.5 * up.early && down.early > 1.5 * down.late, `the start's zap rises and the end's falls   [crossings early → late: ${up.early} → ${up.late}, ${down.early} → ${down.late}]`);
    ok(up.span < 0.8 && down.span < 0.8, `each is one short zap, no continuous sound   [${up.span} s, ${down.span} s]`);
    ok([up, down].every((q) => q.peak <= 0.6 * Math.min(...cues.map((x) => x.peak)) && q.rms <= 0.6 * Math.min(...cues.map((x) => x.rms))),
      `both sit clearly under THONG, the buzz and the hiss (under 60% of the quietest one's peak and loudness)   [${up.peak}/${up.rms}, ${down.peak}/${down.rms}; cues ${cues.map((q) => q.peak + "/" + q.rms).join(", ")}]`);
    for (let i = 0; i < 60 && (await ev("__et.music().duck")) < 0.999; i++) await wait(50);
    const dip = await ev("new Promise((done) => { ET.audio.warp(true); setTimeout(() => done(__et.music().duck), 120); })");
    ok(dip > 0.999, `they don't dip the music   [music at ${dip}]`);
    const loudest = "new Promise((done) => { ET.audio.warp(true); let p = 0; const iv = setInterval(() => { p = Math.max(p, ET.audio.peak()); }, 20); setTimeout(() => { clearInterval(iv); done(p); }, 400); })";
    await wait(700);
    const heard = await ev(loudest);
    await ev("ET.audio.setMuted(true)");
    await wait(100);
    const hush = await ev(loudest);
    await ev("ET.audio.setMuted(false)");
    ok(heard > 1e-3 && hush < 1e-4, `muting silences them with everything else   [${heard.toFixed(4)} → ${hush.toExponential(1)}]`);
  }

  section("Q. the scary mom face (Refinement 5 §5)");
  await ev("__et.start(4, { hospital: 0 })");
  await ev("__et.advance(0.1)");
  {
    const C0 = await ev("JSON.stringify([ET.CONFIG.momFaceChance, ET.CONFIG.momFaceWindow])");
    eq(await ev("ET.CONFIG.momFaceZones"), ["top"], "E23 and E30: with no side panel in play, only the top zone is left (it may cover the HUD bar for its 0.85 s)");
    ok((await ev("ET.CONFIG.momFaceSeconds")) < 1, `it lasts under a second   [${await ev("ET.CONFIG.momFaceSeconds")} s]`);
    await ev("window.__hiss = 0; (function (h) { ET.audio.hiss = function () { window.__hiss++; return h.apply(this, arguments); }; })(ET.audio.hiss)");
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 640]]) {
      await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await ev(`(() => { document.querySelectorAll('.nest').forEach(n => n.classList.remove('inactive', 'unlock')); return 1; })()`);
      await wait(150);
      for (const zone of ["top"]) {
        // show it, hold its slide still mid-way (fully in), and measure, all in one evaluation: nothing in the page can
        // run in between, so a busy machine can't catch it half in or already gone (steadied 2026-09-24)
        const m = await ev(`(() => {
          const went = ET.view.mom('${zone}');
          const slide = document.querySelector('#mom .face').getAnimations()[0];
          if (slide) { slide.pause(); slide.currentTime = 0.45 * ET.CONFIG.momFaceSeconds * 1000; }
          const box = document.querySelector('#mom'), b = box.getBoundingClientRect(), f = box.querySelector('.face').getBoundingClientRect();
          const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
          const seen = { left: Math.max(b.left, f.left), right: Math.min(b.right, f.right), top: Math.max(b.top, f.top), bottom: Math.min(b.bottom, f.bottom) };
          const keep = [...document.querySelectorAll('.nest .nest-art, .nest .readout')].map(e => e.getBoundingClientRect()).concat([document.querySelector('#console').getBoundingClientRect()]);
          return { went, shown: !box.hidden, covers: keep.filter(r => hit(b, r)).length, big: seen.bottom - seen.top, pe: getComputedStyle(box).pointerEvents,
                   anim: getComputedStyle(box.querySelector('.face')).animationName, focused: __et.boxes().focused };
        })()`);
        const at = `[${zone}, ${w}×${h}]`;
        ok(m.went === zone && m.shown && m.big > 40, `it pops in ${zone === "top" ? "from the top edge" : "out of the side panel"}   ${at} [${Math.round(m.big)}px showing]`);
        eq(m.covers, 0, `…never over a nest, a readout or a Command Line   ${at}`);
        ok(m.pe === "none" && m.focused && /^mom-(top|bottom)$/.test(m.anim), `…takes no input (the Command Line keeps the keyboard) and slides rather than flashes   ${at}`);
        if (SHOTS && (w === 1440 || w === 1024)) await shot(`14-mom-${zone}-${w}x${h}`);
      }
    }
    await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    {
      // it hides itself on its own timer (0.85 s + 50 ms after the last one): poll for that, don't guess a wait
      const t0 = Date.now();
      let gone = false;
      for (let i = 0; i < 60 && !gone; i++) { gone = await ev("document.querySelector('#mom').hidden"); if (!gone) await wait(50); }
      ok(gone, `…and is gone again by itself a moment later   [after ${Date.now() - t0} ms]`);
    }
    ok((await ev("window.__hiss")) >= 4, `each one comes with the hiss and gurgle   [${await ev("window.__hiss")} of 4]`);
    {
      // Chat's playtest rulings (2026-10-02): the face is the Mom kit's head, pose A: sweet Mom (sm_org) in wave 1, creepy
      // Mom (hm_org) after, as her visit; the old drawn face is gone
      const sweet = await ev("(() => { ET.view.mom('top'); const s = ET.view.momState(), i = document.querySelector('#mom .face img'); return [s.kind, s.src, !!i && i.complete && i.naturalWidth > 100, !!document.querySelector('#mom svg, .mom-face'), typeof ET.art.momFaceSvg]; })()");
      eq(sweet, ["sweet", "art/mom-sweet--down@2x.png", true, false, "undefined"], "the HUD face is sweet Mom's head, pose A (sm_org's cut-out), in wave 1; the old drawn face is gone");
      const creepy = await ev("(() => { const was = ET.CONFIG.momSweetUntilWave; ET.CONFIG.momSweetUntilWave = 0; ET.view.mom('top'); ET.CONFIG.momSweetUntilWave = was; const s = ET.view.momState(); return [s.kind, s.src]; })()");
      eq(creepy, ["creepy", "art/mom-creepy--down@2x.png"], "…and creepy Mom's (hm_org's cut-out) after the sweet waves");
      let gone = false;
      for (let i = 0; i < 60 && !gone; i++) { gone = await ev("document.querySelector('#mom').hidden"); if (!gone) await wait(50); }
    }
    // the schedule: at most once a wave, sometimes not at all, held by a pause
    await ev("ET.CONFIG.momFaceChance = 1; ET.CONFIG.momFaceWindow = [0.5, 1]; __et.start(1, { hospital: 0 }); __et.advance(0.1); 1");
    await ev("__et.advance(3)");
    const once = await ev("ET.view.momState()");
    await ev("__et.advance(12)");
    const still = await ev("ET.view.momState()");
    ok(once.shown === 1 && still.shown === 1 && (await snap()).wave === 1, `at most once a wave   [${once.shown}, then ${still.shown} later in wave 1]`);
    await ev("ET.CONFIG.momFaceChance = 0; __et.start(1, { hospital: 0 }); __et.advance(0.1); __et.advance(20); 1");
    eq((await ev("ET.view.momState()")).shown, 0, "…and some waves get none");
    await ev(`(() => { const c0 = ${C0}; ET.CONFIG.momFaceChance = c0[0]; ET.CONFIG.momFaceWindow = c0[1]; return 1; })()`);
  }

  /* ------------------------------------------------ Z. the pilot art (slot 0: nest + egg) */
  section("Z. the pilot art: nest + egg, a hybrid of pictures and vector cracks (Chat ruling, 2026-09-25)");
  {
    // every layer loads, and each part stays inside its bounds (read from the picture's own pixels, in viewBox units)
    const layers = await ev(`(() => {
      const names = ['nest--twigs-back', 'nest--twigs-front', 'nest--twigs-back-inactive', 'nest--twigs-front-inactive', 'nest--tendril-1', 'nest--tendril-2',
        'nest--tendril-3', 'egg--shell', 'egg--hint-3', 'egg--hint-4', 'egg--hint-5', 'egg--hint-eye'];
      return Promise.all(names.map(n => new Promise((done) => { const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, im.width, im.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const ux = (p) => +(-60 + p * 120 / im.width).toFixed(1), uy = (p) => +(-62 + p * 110 / im.height).toFixed(1);
        done({ n, w: im.width, h: im.height, box: [ux(x0), uy(y0), ux(x1 + 1), uy(y1 + 1)] }); };
        im.onerror = () => done({ n, err: true }); im.src = 'art/' + n + '@2x.png'; })));
    })()`);
    const bad = layers.filter((l) => l.err || l.w !== 404 || l.h !== 374);
    ok(bad.length === 0, `all 12 pilot layers load, each on the whole 404 × 374 slot canvas   ${bad.length ? JSON.stringify(bad) : ""}`);
    const inside = (b, [x0, y0, x1, y1]) => b[0] >= x0 - 0.3 && b[1] >= y0 - 0.3 && b[2] <= x1 + 0.3 && b[3] <= y1 + 0.3;
    const BOUNDS = { "nest--twigs": [-48, -40, 48, 37], "egg--shell": [-22, -38, 22, 20], "egg--hint": [-30, -44, 30, 20], "nest--tendril": [-60, -62, 60, 48] };
    const out = layers.filter((l) => !l.err && !inside(l.box, BOUNDS[Object.keys(BOUNDS).find((k) => l.n.startsWith(k))]));
    ok(out.length === 0, `every part stays inside its bounds: the nest in x −48…48, y −40…37; the egg on its base at y 20; each hint in x −30…30, y −44…20   ${out.length ? JSON.stringify(out.map((l) => [l.n, l.box])) : ""}`);
    // the states, drawn one at a time on one nest at the largest and smallest nest sizes
    const draw = (st) => `(() => {
      const s = JSON.parse(JSON.stringify(__et.snapshot())); s.warp = false;
      const n = s.nests[0], el = document.querySelector('.nest[data-id="' + n.id + '"]');
      el.classList.remove('unlock'); el.classList.toggle('inactive', ${!!st.inactive}); el.classList.toggle('mirrored', ${!!st.mirror}); el.classList.toggle('has-eye', ${!!st.eye});
      if (${!st.inactive}) Object.assign(n, { state: '${st.state || "idle"}', grow: ${st.grow ?? 0}, crack: ${st.crack ?? 0}, elapsed: 600, lay: null, retract: null }); else n.state = 'idle';
      ET.view.render(s);
      const art = el.querySelector('.nest-art').getBoundingClientRect(), seen = (q) => { const e = el.querySelector(q); return !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'; };
      const hints = ['hint-3', 'hint-4', 'hint-5', 'hint-eye'].filter(h => seen('.' + h));
      const within = [...el.querySelectorAll('.egg .hint, .egg .shell')].filter(e => e.getBoundingClientRect().width > 0).every(e => { const r = e.getBoundingClientRect(); return r.left >= art.left - 1 && r.right <= art.right + 1 && r.top >= art.top - 1 && r.bottom <= art.bottom + 1; });
      return { egg: seen('.egg .shell'), live: seen('.twigs.back .look-live') && seen('.twigs.front .look-live'), slate: seen('.twigs.back .look-slate') && seen('.twigs.front .look-slate'),
               ooze: seen('.ooze .tendril'), hints, within, mirror: getComputedStyle(el.querySelector('.egg .mirror')).transform, w: Math.round(art.width) };
    })()`;
    const STATES = [
      ["not in play", { inactive: true }, (r) => !r.live && r.slate && !r.ooze && !r.egg],
      ["a fresh egg at 35%", { state: "active", grow: 0 }, (r) => r.live && !r.slate && r.ooze && r.egg && r.hints.length === 0],
      ["40%: the antenna", { state: "overtime", grow: 1, crack: 0.42 }, (r) => r.hints.join() === "hint-3"],
      ["60%: the leg too", { state: "overtime", grow: 1, crack: 0.62 }, (r) => r.hints.join() === "hint-3,hint-4"],
      ["80%: the tentacle too", { state: "overtime", grow: 1, crack: 0.85 }, (r) => r.hints.join() === "hint-3,hint-4,hint-5"],
      ["the eye, from 50%, on an egg that has it", { state: "overtime", grow: 1, crack: 0.52, eye: true }, (r) => r.hints.join() === "hint-3,hint-eye"],
      ["mirrored", { state: "overtime", grow: 1, crack: 0.85, eye: true, mirror: true }, (r) => r.mirror === "matrix(-1, 0, 0, 1, 0, 0)" && r.hints.length === 4],
    ];
    // (each state is drawn and measured inside one evaluation, so the page's own drawing can't get in between)
    await ev(`(() => { __et.start(1, { hospital: 0, minutes: 30 }); __et.advance(0.1); ${"document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))"}; return 1; })()`);
    for (const [w, h] of [[1920, 1080], [1024, 640]]) {
      await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await wait(200);
      const res = [];
      for (const [name, st, pass] of STATES) { const r = await ev(draw(st)); res.push([name, pass(r), r]); }
      const failed = res.filter((x) => !x[1]);
      ok(failed.length === 0, `every state draws right, with its own parts showing (their bounds are the pixel check above): ${STATES.map((s) => s[0]).join("; ")}   [${w}×${h}, nest ${res[0][2].w} px wide] ${failed.length ? JSON.stringify(failed.map((f) => [f[0], f[2]])) : ""}`);
    }
    await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    // the odds, rolled as laying does: half mirrored, about 1 in 6 with the eye
    const odds = await ev("(() => { let m = 0, e = 0; for (let i = 0; i < 3000; i++) { const r = ET.view.rollEgg(0); m += r.mirrored; e += r.eye; } return { m: m / 3000, e: e / 3000, want: ET.CONFIG.eggEyeChance }; })()");
    ok(Math.abs(odds.m - 0.5) < 0.04 && Math.abs(odds.e - odds.want) < 0.03, `each egg is mirrored 50/50 and gets the eye about 1 time in 6 (a config value)   [${odds.m.toFixed(3)} mirrored, ${odds.e.toFixed(3)} with the eye]`);
    eq(await ev("[...document.querySelectorAll('.nest[data-id=\"0\"] .crack')].map(c => [c.getAttribute('pathLength'), getComputedStyle(c).strokeWidth, (c.getAttribute('d').match(/M/g) || []).length])"),
      [["1", "3.5px", 1], ["1", "3.5px", 1], ["1", "3.5px", 1]], "the three cracks stay vector: single unbranched lines, pathLength 1, 3.5 units bold");
    // the cord egg (Chat's answers, 2026-09-25): from the pop, the egg coming out of the cord is the nest's own egg picture,
    // mirrored as laid, tilted with the nest; at the landing it is exactly the 35% egg that then starts its clock
    const lay = await ev(`(() => {
      const C = ET.CONFIG, pop = (u) => (C.layDrop + u * C.layPop) / (C.layDrop + C.layPop);
      const frame = (patch, mirror) => { const s = JSON.parse(JSON.stringify(__et.snapshot())); s.warp = false; const n = s.nests[0];
        Object.assign(n, { crack: 0, elapsed: 0, grow: 0, retract: null }, patch);
        const el = document.querySelector('.nest[data-id="' + n.id + '"]'); el.classList.remove('inactive', 'unlock'); el.classList.toggle('mirrored', mirror);
        ET.view.render(s);
        const egg = el.querySelector('.egg'), shell = el.querySelector('.egg .shell'), r = shell.getBoundingClientRect(), cord = ET.view.cord(n.id);
        return { shown: getComputedStyle(egg).display !== 'none' && r.width > 0, box: [r.left, r.top, r.width, r.height].map(v => +v.toFixed(1)),
                 mirror: getComputedStyle(el.querySelector('.egg .mirror')).transform, oval: cord ? cord.egg : null, tilt: getComputedStyle(el.querySelector('.nest-art')).transform }; };
      return { drop: frame({ state: 'laying', lay: pop(0) * 0.8 }, true), mid: frame({ state: 'laying', lay: pop(0.5) }, true),
               land: frame({ state: 'laying', lay: pop(1) }, true), start: frame({ state: 'active', lay: null, retract: 0.01 }, true) };
    })()`);
    ok(!lay.drop.shown && lay.mid.shown && lay.mid.oval === false && lay.mid.mirror === "matrix(-1, 0, 0, 1, 0, 0)" && lay.mid.box[1] < lay.land.box[1] - 5,
      `the cord egg: from the pop the egg coming out of the cord is the nest's own egg picture (mirrored as laid), above its resting place, with no oval of the cord's own   [${lay.mid.box[1]} px → ${lay.land.box[1]} px]`);
    ok(lay.land.box.every((v, i) => Math.abs(v - lay.start.box[i]) < 0.6) && lay.land.tilt === lay.start.tilt,
      `…it lands exactly as the 35% egg that starts its clock: no swap and no drop, tilted with the nest   [${lay.land.box.join(",")} vs ${lay.start.box.join(",")}]`);
    await ev(`(() => { ${"document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))"}; __et.start(2, { hospital: 0 }); __et.advance(0.1); return 1; })()`);
  }

  /* ------------------------------------------------ BR. the break stages */
  section("BR. the break stages: Andrew's splats and shell fragments (E26, brief slot 13, 2026-09-26)");
  {
    const escK = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    for (let i = 0; i < 60 && !(await ev("ET.breaks.isReady()")); i++) await wait(100);
    ok(await ev("ET.breaks.isReady()"), "the five splats and ten shell fragments load");
    // the files: each splat on the whole slot canvas, inside the brief's box, all five the same size
    const art = await ev(`(() => {
      const names = ['break-1-elegant', 'break-2-messier', 'break-3-alien-signs', 'break-4-half-formed', 'break-5-leftovers'];
      return Promise.all(names.map(n => new Promise((done) => { const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, im.width, im.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const ux = (p) => +(-60 + p * 120 / im.width).toFixed(1), uy = (p) => +(-62 + p * 110 / im.height).toFixed(1);
        done({ n, w: im.width, h: im.height, box: [ux(x0), uy(y0), ux(x1 + 1), uy(y1 + 1)] }); };
        im.onerror = () => done({ n, err: true }); im.src = 'art/' + n + '@2x.png'; })));
    })()`);
    ok(art.every((a) => !a.err && a.w === 404 && a.h === 374), `all five splats load, each on the whole 404 × 374 slot canvas   ${JSON.stringify(art.filter((a) => a.err || a.w !== 404))}`);
    ok(art.every((a) => a.box[0] >= -40.3 && a.box[1] >= -40.3 && a.box[2] <= 40.3 && a.box[3] <= 28.3), `each sits in the brief's box, x −40…40, y −40…28   [${art.map((a) => a.box.join(",")).join(" | ")}]`);
    const big = art.map((a) => Math.max(a.box[2] - a.box[0], a.box[3] - a.box[1]));
    ok(Math.max(...big) / Math.min(...big) < 1.1, `all five show at the same size: only the grossness changes   [${big.map((b) => b.toFixed(1)).join(", ")} units]`);

    // fill(): the stage's splat, a count of fragments that climbs with the stage, every one inside the splat's outline
    await ev(`(() => { __et.start(1, { hospital: 0, minutes: 30 }); __et.advance(0.1); ${escK}; return 1; })()`);
    const fills = await ev(`(() => { const g = document.querySelector('.nest .break'), C = ET.CONFIG.breakShells, out = [];
      for (let st = 1; st <= 5; st++) { let lo = 99, hi = 0, outside = 0, onFeature = 0, inZone = 0, href = '', flips = 0, big = 0, seen = new Set(); const want = C.count[st], Z = ET.breaks.zones(st);
        for (let i = 0; i < 150; i++) { const n = ET.breaks.fill(g, st), c = ET.breaks.check(g); lo = Math.min(lo, n); hi = Math.max(hi, n); outside += c.outside; onFeature += c.onFeature;
          // an independent test: no fragment's centre may sit in a keep-clear zone
          g.querySelectorAll('.piece').forEach((p) => { const m = /translate\\(([-\\d.]+) ([-\\d.]+)\\)/.exec(p.getAttribute('transform')); if (Z.some((z) => Math.hypot(+m[1] - z[0], +m[2] - z[1]) < z[2])) inZone++; });
          href = g.querySelector('.splat').getAttribute('href');
          g.querySelectorAll('.piece').forEach((p) => { seen.add(p.getAttribute('href')); if (/scale\\(-1/.test(p.getAttribute('transform'))) flips++;
            if (Math.max(+p.getAttribute('width'), +p.getAttribute('height')) > C.size * C.jitter[1] + 0.01) big++; }); }
        out.push({ st, lo, hi, want, outside, onFeature, inZone, zones: Z.length, href, flips, big, kinds: seen.size }); }
      return out; })()`);
    ok(fills.every((f) => f.href === `art/break-${f.st}-${["elegant", "messier", "alien-signs", "half-formed", "leftovers"][f.st - 1]}@2x.png`), "each stage shows its own splat");
    ok(fills.every((f) => f.lo >= f.want[0] && f.hi <= f.want[1]) && fills[0].hi <= 4 && fills[4].lo >= 6,
      `fragments by stage, few to many (stage 1 about 3-4, stage 5 about 6-8), never one short   [${fills.map((f) => `${f.st}: ${f.lo}-${f.hi} of ${f.want.join("-")}`).join("; ")}]`);
    ok(fills.every((f) => f.outside === 0), `every fragment lies inside (or on) its splat's outline, tested on each fragment's own pixels   [${fills.map((f) => f.outside).join(", ")} outside, of 750 splats]`);
    ok(fills.every((f) => f.onFeature === 0 && f.inZone === 0) && fills[0].zones === 0 && fills[1].zones === 0 && fills.slice(2).every((f) => f.zones > 0),
      `Andrew's ruling (2026-09-26): no fragment touches stage 3's antenna (tip included) or stage 4's and 5's eyes and face; stages 1 and 2 have no zones   [touching ${fills.map((f) => f.onFeature).join(", ")}; centres in a zone ${fills.map((f) => f.inZone).join(", ")}]`);
    // each zone sits on its stage's art (so a zone can't drift off the feature it guards into empty space)
    const zoneOn = await ev(`Promise.all([3, 4, 5].map((st) => new Promise((done) => { const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const off = ET.breaks.zones(st).filter((z) => g.getImageData(Math.floor((z[0] + 60) * im.width / 120), Math.floor((z[1] + 62) * im.height / 110), 1, 1).data[3] < 200);
        done(off.length); }; im.src = document.querySelector('.nest .break') && ['', '', '', 'art/break-3-alien-signs@2x.png', 'art/break-4-half-formed@2x.png', 'art/break-5-leftovers@2x.png'][st]; })))`);
    eq(zoneOn, [0, 0, 0], "…and every keep-clear zone's centre sits on its stage's art");
    ok(fills.every((f) => f.big === 0 && f.kinds === 10 && f.flips > 0), `fragments are small (a ${await ev("ET.CONFIG.breakShells.size")}-unit longest side at most +15%, the egg is 44 wide), drawn from all ten pieces, turned and flipped at random`);
    const same = await ev(`(() => { const g = document.querySelector('.nest .break'); ET.breaks.fill(g, 3); const a = g.innerHTML; ET.breaks.fill(g, 3); return a === g.innerHTML; })()`);
    ok(!same, "…so no two splats look the same");

    // in play: a clear shows the stage for its tier (fifths from bold to hatch) while the nest is "splat", then it's gone.
    // (unpaused, since a paused game refuses commands; the whole case runs inside this one evaluation)
    const play = async (share) => ev(`(() => {
      __et.start(1, { hospital: 0, minutes: 30 }); __et.advance(0.1);
      for (let i = 0; i < 40000; i++) { const s = __et.snapshot(), n = s.nests.find((x) => x.state === 'overtime' && x.crack >= ${share});
        if (n) { const crack = n.crack; __et.submit('RCAV ' + n.unit); __et.advance(0.01);
          const el = document.querySelector('.nest[data-id="' + n.id + '"]'), g = el.querySelector('.break'), st = __et.snapshot().nests.find((x) => x.id === n.id).state;
          const shown = getComputedStyle(g).display !== 'none' && g.getBoundingClientRect().width > 0, stage = +g.getAttribute('data-stage'), pieces = g.querySelectorAll('.piece').length;
          const eggGone = getComputedStyle(el.querySelector('.egg')).display === 'none';
          __et.advance(ET.CONFIG.splatSeconds + 0.1);
          return { crack, st, shown, stage, pieces, eggGone, after: getComputedStyle(g).display, afterState: __et.snapshot().nests.find((x) => x.id === n.id).state }; }
        __et.advance(0.05); }
      return null; })()`);
    for (const [share, want] of [[0, 1], [0.5, 3], [0.9, 5]]) {
      const r = await play(share);
      ok(r && r.st === "splat" && r.shown && r.eggGone && r.stage === Math.min(5, Math.floor(r.crack * 5) + 1) && r.stage === want && r.pieces > 0,
        `a clear ${Math.round(share * 100)}% of the way from bold to hatch leaves break stage ${want} in the nest, where the egg was, with its fragments   ${JSON.stringify(r)}`);
      ok(r && r.after === "none" && r.afterState !== "splat", `…and it's gone when the nest idles (${await ev("ET.CONFIG.splatSeconds")} s of the player's time)`);
    }
    await shot("br-break-stages");
    await ev(`(() => { ${escK}; __et.start(2, { hospital: 0 }); __et.advance(0.1); return 1; })()`);
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
    // (E40: LOADING… also covers the prompt's short wait for autoplay, so poll)
    let pr = ""; for (let i = 0; i < 40 && (pr = await ev("document.querySelector('#title-prompt').textContent")) === "LOADING…"; i++) await wait(50);
    eq(pr, "PRESS ENTER", "…the prompt changes once it has loaded");
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

    // E24: the mute setting is remembered per browser, across a reload, before any key is pressed
    await press("m");
    const before = await ev("[ET.audio.muted(), localStorage.getItem('eggtimer.muted')]");
    await reload();
    for (let i = 0; i < 100 && !(await ev("!!(window.__et && __et.ready())")); i++) await wait(50);
    const after = await ev("[ET.audio.muted(), document.querySelector('#mute').getAttribute('aria-pressed')]");
    eq([before, after], [[true, "1"], [true, "true"]], "E24: muted stays muted after a reload: the browser remembers it");
    await press("m");
    eq(await ev("[ET.audio.muted(), localStorage.getItem('eggtimer.muted')]"), [false, "0"], "…and M turns it back on");

    // E35: the title music starts on the title screen. Headless Chrome holds sound until a key or click, like a normal
    // browser, so this is the browser case; where autoplay is allowed (Fang Rock) the same queued track simply plays.
    const fresh = async (setup = "") => {
      await reload();
      for (let i = 0; i < 100 && !(await ev("!!(window.__et && __et.ready())")); i++) await wait(50);
      if (setup) await ev(setup);
      let q = null; for (let i = 0; i < 100; i++) { q = await ev("({ state: ET.audio.state(), m: ET.audio.musicState(), screen: __et.screen() })"); if (q.m.playing === "title") break; await wait(50); }
      return q;
    };
    const heard = async () => { let r = null; for (let i = 0; i < 60; i++) { r = await ev("({ state: ET.audio.state(), tune: __et.tune(), screen: __et.screen() })"); if (r.state === "running" && r.tune) break; await wait(50); } return r; };
    const q0 = await fresh();
    eq([q0.state, q0.m.playing, q0.screen], ["suspended", "title", "title"], "E35: before any key, the title track is already set going on the title screen, held only by the browser");
    // E40: until that first press the prompt reads PRESS ANY KEY, blinking as the prompt always has (1 a second)
    const prompt = () => ev("(() => { const p = document.querySelector('#title-prompt'), cs = getComputedStyle(p); return { text: p.textContent, anim: cs.animationName, secs: parseFloat(cs.animationDuration) }; })()");
    let p0 = null; for (let i = 0; i < 40; i++) { p0 = await prompt(); if (p0.text === "PRESS ANY KEY") break; await wait(50); }
    ok(p0.text === "PRESS ANY KEY" && p0.anim === "blink" && p0.secs >= 0.5, `E40: before the first press the title says PRESS ANY KEY, blinking at most 2 a second   [${p0.text}, ${p0.anim} every ${p0.secs} s]`);
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    eq((await prompt()).anim, "none", "E40: …steady under reduced motion");
    await c.send("Emulation.setEmulatedMedia", { features: [] });
    await press("Enter");
    eq(await heard(), { state: "running", tune: true, screen: "title" }, "E35: the first Enter starts the title music ON the title screen (titleFirstPress \"sound\")");
    eq((await prompt()).text, "PRESS ENTER", "E40: …and the prompt goes back to PRESS ENTER");
    await press("Enter");
    eq(await ev("__et.screen()"), "setup", "…and the next Enter goes on to the options screen, the music playing on");
    await fresh();
    const tAt = await ev("(() => { const r = document.querySelector('#title-prompt').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()");
    const tClick = async () => { for (const type of ["mousePressed", "mouseReleased"]) await c.send("Input.dispatchMouseEvent", { type, x: tAt[0], y: tAt[1], button: "left", clickCount: 1 }); await wait(60); };
    await tClick();
    eq(await heard(), { state: "running", tune: true, screen: "title" }, "E35: a first click on the title does the same: the music starts, the title stays");
    await tClick();
    eq(await ev("__et.screen()"), "setup", "…and the next click goes on");
    await fresh("ET.CONFIG.titleFirstPress = 'go'; 1");
    await wait(450);   // past the prompt's wait for autoplay
    await ev("__et.prompt()");   // (the switch changed after the page painted it)
    eq((await prompt()).text, "PRESS ENTER", "E40: with \"go\" there's no extra press, so no PRESS ANY KEY");
    await press("Enter");
    const go = await heard();
    eq([go.screen, go.tune], ["setup", true], "E35 (the other value, \"go\"): the first Enter starts the music and goes on, as before");
    await reload();   // back to the switch as shipped
    for (let i = 0; i < 100 && !(await ev("!!(window.__et && __et.ready())")); i++) await wait(50);
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
