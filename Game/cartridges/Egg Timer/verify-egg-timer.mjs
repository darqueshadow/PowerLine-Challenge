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
    const card = await ev(`(() => { const c = document.querySelector('#howto-title'); return { steps: [...c.querySelectorAll('.strip > li')].map(l => l.querySelector('.num').textContent + ' ' + l.querySelector('.say').textContent),
      pics: [...c.querySelectorAll('.strip > li')].map(l => l.querySelectorAll('.scene .pic').length), heads: c.querySelectorAll('.strip .head').length, split: c.querySelectorAll('.strip > li:nth-child(3) .half').length,
      banner: c.querySelector('.banner').textContent, panelHere: !!document.querySelector('#screen-title #howto'), shown: c.getBoundingClientRect().width > 150 }; })()`);
    eq(card.steps, ["1 The aliens are laying eggs in your CAVs.", "2 When the timer turns pink and bold, type RCAV + the unit. Too early won't work.",
      "3 Clear fast, and breakfast gets fancier.", "4 Two lines! Tab to switch. Type the next RCAV while you wait.",
      "5 Every clock speeds up 5× till an egg is ready. Get your next RCAV ready!"],
      "E29 (ruled): the title's How To Play card is a five-panel comic strip, each step's words in a speech bubble, as ruled");
    ok(card.pics.every((n) => n >= 1) && card.heads === 0 && card.split === 2, `…a picture in every panel, a number badge and no heading, panel 3 split fast / slow   [${card.pics.join(",")}]`);
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
    ok(!b.cursor.includes("url("), "…with the normal pointer on the menus");
    const m0 = await m();
    eq([m0.pressed, m0.muted, m0.saved], ["false", false, null], "sound starts on: a fresh browser has nothing remembered");
    await press("m");   // also the first key, so sound unlocks here
    const l1 = await levelTo(0), m1 = await m();
    ok(m1.pressed === "true" && m1.muted && m1.saved === "1" && l1 !== null && l1 < 0.002, `M mutes: the button shows it, the browser remembers it, and the master level goes to 0   [${l1}]`);
    await ev("ET.audio.thong(); ET.audio.buzz(); ET.audio.clunk(0); 1");
    const quiet = await loudest(700);
    ok(quiet < 1e-4 && (await ev("__et.tune()")), `muted, nothing leaves the speakers: not the title tune, nor a pan, buzz and clunk played together   [peak ${quiet.toExponential(1)}]`);
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
    // a background tab (the page's visibility, simulated): the title tune stops and every sound is held
    await ev("Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1");
    let st = ""; for (let i = 0; i < 40 && st !== "suspended"; i++) { await wait(50); st = await ev("ET.audio.state()"); }
    const away = await ev("__et.tune()");
    ok(!away && st === "suspended", `in a background tab the title tune stops and every sound is held   [tune ${away}, sound ${st}]`);
    await ev("delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); 1");
    let back = false; for (let i = 0; i < 60 && !back; i++) { await wait(50); back = (await ev("__et.tune()")) && (await ev("ET.audio.state()")) === "running"; }
    ok(back, "…and the tune starts again when the tab comes back");
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
  eq(await ev("document.querySelector('[data-mode].selected').dataset.mode + '/' + document.querySelector('[data-boxes].selected').dataset.boxes"), "clear/2", "defaults: Clear CAVs Only, and (E28) 2 Command Lines");
  await press("ArrowRight");
  await press("ArrowUp"); await press("ArrowUp"); await press("ArrowUp"); await press("ArrowUp");
  eq(await ev("document.querySelector('[data-mode].selected').dataset.mode + '/' + document.querySelector('[data-boxes].selected').dataset.boxes"), "progression/4", "arrows change mode, and boxes stop at 4");
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
    const st = await ev(`(() => { const says = (q) => [...document.querySelectorAll(q + ' .strip .say')].map(e => e.textContent); const p = document.querySelector('#howto');
      const strip = p.querySelector('.strip').getBoundingClientRect(), signs = p.querySelector('.signs').getBoundingClientRect();
      return { same: JSON.stringify(says('#howto')) === JSON.stringify(says('#howto-title')), shown: strip.height > 100, under: strip.top >= signs.bottom, lines: [...p.querySelectorAll('ul li')].filter(l => l.getBoundingClientRect().height > 0).length }; })()`);
    ok(st.same && st.shown && st.under && st.lines === 0, "E29: the options screen's panel shows the same comic strip, under the HOW / TO / PLAY signs, in place of its lines");
  }
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
  {
    // poll, not a fixed wait: a busy machine can hold the page's timer back a little (steadied 2026-09-24)
    let gone = false;
    for (let i = 0; i < 80 && !gone; i++) { await wait(50); gone = !(await ev("__et.boxes().error[0]")); }
    ok(gone, "the ERROR is gone after about a second");
  }
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
  eq(await boxes(), ["900 rgb(11, 93, 30) rgb(255, 255, 255)", "900 rgb(0, 0, 0) rgb(185, 185, 198)", "900 rgb(255, 255, 255) rgb(255, 45, 138)"],
    "Refinement 5 §2: at the limit, all three at once: unit bold dark green on white, type bold black on grey, timer bold white on hot pink");
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
    ok((await ev("getComputedStyle(document.querySelector('#mute')).cursor")).includes("url("), "…and over it the cursor is still the hose nozzle, as everywhere in the game");
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
        if (txt !== "Clear @ " + hms(x.note.at).slice(0, 5)) adOk = false;   // the note's own time, not just its shape
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
  ok(adOk, "every running AD shows its note, reading its own \"N min\" or \"Clear @ HH:MM\"");
  {
    // Midnight, exactly (Andrew, 2026-09-24). A rig-only start: the wall clock at 23:55, ADs only, and a random source
    // fixed at 0.1, which draws 12 minutes and the clock note every time. The first AD spawns on the page's first frame
    // and pops 1.4 s later, at 23:55:42 plus that frame (under 23:56), so its note must read "Clear @ 00:08" (the next
    // whole minute, 23:56, + 12, across midnight), and it must go bold as the wall clock passes 00:08:00. The wall
    // clock is recorded at the very step the egg goes bold.
    // the start and the watch in one evaluation, so no step of the game before it can slip a bold of its own in
    // between (review fix, 2026-09-24); starting a game emits no bold of its own
    await ev(`(() => { __et.start('clear', 1, { wallStart: 23 * 3600 + 55 * 60, types: ['AD'], rng: () => 0.1 });
      const h = ET.view.handle; window.__boldWall = null;
      ET.view.handle = function (events, game) { events.forEach((e) => { if (e.type === 'bold' && window.__boldWall === null) window.__boldWall = game.wall(); }); return h.apply(this, arguments); };
      window.__unwatchBold = () => { ET.view.handle = h; };
      return 1; })()`);
    const first = await until((x) => x.nests.find((y) => y.state === "active" && y.note), 10, 0.1);
    const note = first.hit ? await ev(`(() => { __et.advance(0); const s = __et.snapshot(), x = s.nests.find((y) => y.id === ${first.hit.id});
      return { text: document.querySelector('.nest[data-id="${first.hit.id}"] .postit').textContent, started: ((s.wall - x.elapsed) % 86400 + 86400) % 86400 }; })()`) : null;
    ok(!!note && note.text === "Clear @ 00:08" && note.started >= 23 * 3600 + 55 * 60 + 42 && note.started < 23 * 3600 + 56 * 60,
      `midnight: an AD started at 23:55 with a 12-minute draw reads "Clear @ 00:08"   [${note && note.text}, started ${note && hms(note.started)}]`);
    const b = await until((x) => x.nests.some((y) => y.state === "overtime"), 40, 0.25);
    const bw = await ev("window.__boldWall");
    await ev("window.__unwatchBold(), 1");
    ok(!!b.hit && bw !== null && bw >= 8 * 60 && bw < 8 * 60 + 3.5, `…and goes bold as the wall clock passes 00:08:00, after midnight   [the wall read ${hms(bw)} at the bold step]`);
    await ev("__et.start('clear', 1), 1");   // an ordinary game again for what follows
  }
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
  ok((await ev("ET.audio.state()")) !== "none", `sound is unlocked by the first key press   [${await ev("ET.audio.state()")}]`);
  await ev("__et.start('clear', 1)");
  await ev("__et.advance(0.2)");
  {
    // Hose ruling (2026-09-22): in-game the cursor is always the nozzle; menus keep the normal pointer
    const cur = (sel) => ev(`getComputedStyle(document.querySelector('${sel}')).cursor`);
    ok((await cur("#field")).includes("url(") && (await cur(".box.active input")).includes("url("), "in-game the cursor is always the hose nozzle (board, Command Line)");
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
      return { text: t.textContent.replace(/\\s+/g, ' ').trim(), mouse: !!t.querySelector('svg.mouse'), sink: !!t.querySelector('svg.sink .drain'), shown: r.width > 0, nearTap: r.left - p.right < 30 && r.left >= p.right - 1 && Math.abs(r.bottom - f.bottom) < 8 }; })()`);
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
    // E30 (ruled): the Place hint moved into the empty Command Line, while a nest waits to be placed
    const ph = () => ev("document.querySelector('#console .box input').placeholder");
    eq(await ph(), "RCAV + unit", "E30: in Clear CAVs Only the empty line always says \"RCAV + unit\"");
    const w = await ev(`(() => { __et.start('both', 1); __et.advance(0.1);
      for (let i = 0; i < 400 && !__et.snapshot().nests.some(n => n.state === 'trigger'); i++) __et.advance(0.05);
      const t = __et.snapshot().nests.find(n => n.state === 'trigger'), during = document.querySelector('#console .box input').placeholder;
      if (t) __et.submit('CAV ' + t.unit + ' ' + t.code);
      __et.advance(0.05);
      const busy = __et.snapshot().nests.some(n => n.state === 'trigger');
      return { t: !!t, during, after: document.querySelector('#console .box input').placeholder, busy }; })()`);
    ok(w.t && w.during === "CAV + unit + type" && (w.busy || w.after === "RCAV + unit"), `E30: while a nest waits to be placed it says "CAV + unit + type", and "RCAV + unit" again once none waits   [${w.during} → ${w.after}]`);
  }
  ok(await ev("(() => { const t = document.querySelector('#screen-setup').innerText; return /Command Lines/.test(document.querySelector('#screen-setup h2:nth-of-type(2)').textContent) && !/Command Box/i.test(t); })()"), "E7: players see \"Command Line\" on the setup screen, never \"Command Box\" (E29's heading)");
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
  section("W. wave 1's first-game tags (E28)");
  {
    // only ADs, so a "Clear @" note turns up; every clear right at its bold
    const run = await ev(`(() => {
      __et.start('clear', 1, { types: ['AD', 'VS'] }); __et.advance(0.1);
      const out = { ready: null, clock: null, readyAgain: false, clockAgain: false, hitNest: 0, anim: [], after: null, wave2: false };
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const covers = (el) => { const r = el.getBoundingClientRect(); return [...document.querySelectorAll('.nest')].filter(n => hit(r, n.getBoundingClientRect()) || hit(r, n.querySelector('.readout').getBoundingClientRect())).length; };
      for (let i = 0; i < 20000 && __et.snapshot().wave < 3; i++) {
        __et.advance(0.05);
        const s = __et.snapshot(), t = ET.view.tips();
        if (t[0].shown && !out.ready) { const b = s.nests.find(n => n.id === t[0].nest); out.ready = { text: t[0].text, unit: b && b.unit, bold: b && b.state === 'overtime', line: !!t[0].line, pink: getComputedStyle(document.querySelector('#tip-ready')).backgroundColor }; out.hitNest += covers(document.querySelector('#tip-ready')); out.anim.push(getComputedStyle(document.querySelector('#tip-ready')).animationName); }
        if (t[1].shown && !out.clock) { out.clock = { text: t[1].text, line: !!t[1].line, wave: s.wave }; out.hitNest += covers(document.querySelector('#tip-clock')); out.anim.push(getComputedStyle(document.querySelector('#tip-clock')).animationName); }
        if (out.ready && out.after === null && !t[0].shown) out.after = true;
        if (out.ready && out.after && t[0].shown) out.readyAgain = true;
        if (out.clock && !t[1].shown && s.nests.some(n => n.note && n.note.kind === 'clock' && n.id !== t[1].nest) && t[1].shown) out.clockAgain = true;
        if (s.wave >= 2 && (t[0].shown || t[1].shown)) out.wave2 = true;
        s.nests.filter(n => n.state === 'overtime').forEach(n => __et.submit('RCAV ' + n.unit));
      }
      return out;
    })()`);
    ok(!!run.ready && run.ready.bold && run.ready.text === "Pink = ready! Type RCAV " + run.ready.unit && run.ready.line, `E28: in wave 1 the first egg to go bold gets a tag, with a leader line to it   [${run.ready && run.ready.text}]`);
    eq(run.ready && run.ready.pink, "rgb(255, 45, 138)", "…in the bold timer's pink");
    ok(!!run.clock && run.clock.text === "◀ Check the wall clock" && run.clock.line && run.clock.wave === 1, `E28: the first "Clear @" note gets "Check the wall clock", beside the wall clock, with a leader line to the note   [${run.clock && run.clock.text}]`);
    eq(run.hitNest, 0, "E28: neither tag covers a nest or a readout");
    ok(run.after === true && !run.readyAgain && !run.wave2, "E28: the ready tag goes when that egg is cleared, and neither tag comes back that game (wave 2 included)");
    ok(run.anim.length === 2 && run.anim.every((a) => a === "none"), `E28: neither tag flashes   [${run.anim.join(", ")}]`);
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
  await ev("__et.start('clear', 1)");
  const o = await until((x) => x.phase === "over", 400, 1);
  ok(!!o.hit, "an empty pool ends the game");
  for (let i = 0; i < 40 && (await ev("__et.screen()")) !== "over"; i++) await wait(100);
  eq(await ev("__et.screen()"), "over", "the end screen follows the last escape");
  eq(await ev("document.querySelector('#over-score').textContent"), String(o.s.score), "it shows the final score");
  ok(/^SKIPPED SPAWNS  W1 \d+/.test(await ev("document.querySelector('#over-skipped').textContent")), `the playtest log lists skipped spawns per wave   [${await ev("document.querySelector('#over-skipped').textContent")}]`);
  await shot("09-over");
  {
    // E30: the menus keep the panel; on the game-over screen it holds what has no object of its own
    const txt = await ev("document.querySelector('#howto').innerText");
    const lines = await ev("[...document.querySelectorAll('#howto ul li')].map(l => l.textContent)");
    eq(lines, ["GOAL Clear the CAVs as soon as they're done, as quick as you can.", "ESC Pause."], "E28 and E30: on the game-over screen the panel keeps Goal and Esc");
    for (const gone of ["RCAV", "post-it", "Clear Fueling", "Ctrl"]) ok(!txt.includes(gone), `…with no "${gone}" line`);
    ok(!/\d+:\d\d|\b\d+\s*min/i.test(txt), "…and never lists a CAV duration");
    // Refinement 5 §3: the cartoon look, with doodles that turn now and then
    const look = await ev(`(() => { const cs = getComputedStyle(document.querySelector('#howto')); return { bg: cs.backgroundColor, ink: getComputedStyle(document.querySelector('#howto li')).color, round: parseFloat(cs.borderTopLeftRadius) > 8, doodles: document.querySelectorAll('#howto .doodles .doodle').length }; })()`);
    ok(look.bg === "rgb(255, 243, 209)" && look.ink === "rgb(26, 13, 46)" && look.round, `Refinement 5 §3: the panel is a cartoon card, dark ink on cream, rounded   [${look.bg} / ${look.ink}]`);
    ok(look.doodles >= 4, `…with alien-family doodles around the text   [${look.doodles}]`);
    const turns = () => ev("[...document.querySelectorAll('#howto .doodles .doodle')].map(d => d.style.getPropertyValue('--turn')).join(',')");
    // poll for up to 15 s: a turn picks a random angle, which can land on the one it had (steadied 2026-09-24)
    const t0 = await turns();
    let t1 = t0;
    for (let i = 0; i < 60 && t1 === t0; i++) { await wait(250); t1 = await turns(); }
    ok(t0 !== t1, `…turning to a new angle now and then   [${t0} → ${t1}]`);
  }
  await menuFit("over");
  await press("Enter");
  eq(await ev("__et.screen()"), "setup", "Enter goes back to setup");

  /* ------------------------------------------------------ L. full-board layout */
  section("L. layout: all 12 nests across the whole board (E30: no side panel in play), at every measured size");
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
      // E28: both first-game tags shown at their longest, beside the wall clock, measured with the band
      const tr = document.querySelector('#tip-ready'), tc = document.querySelector('#tip-clock');
      tr.hidden = false; tr.textContent = 'Pink = ready! Type RCAV 8888'; tc.hidden = false;
      ET.view.placeTips();
      const tipsIn = [tr, tc].every(t => { const r = t.getBoundingClientRect(), f = document.querySelector('#field').getBoundingClientRect(); return r.left >= f.left && r.right <= f.right && r.width > 40; });
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
      // E24: the mute button in the HUD bar's left end, clear of its words, the wall clock and the board
      const M = document.querySelector('#mute').getBoundingClientRect(), H = document.querySelector('.hud').getBoundingClientRect();
      const hudWords = [...document.querySelectorAll('.hud > div:not(#cleanup)')].map(e => e.getBoundingClientRect());
      const muteClear = M.width > 20 && M.top >= H.top && M.bottom <= H.bottom && !hudWords.concat([clock, field]).some(r => hit(r, M));
      return { muteClear, bulbOnWord, tagged, tagIn: tag.left >= f.left && tag.right <= f.right && tag.bottom <= f.bottom + 1, doodled, spill, postitsInside, inside, overlaps, covered, panelGone: howto.width === 0 && innerWidth - field.right < 20, clearOfTop,
               warpClear, warpCentre, tipsIn,
               clockCentre: Math.abs((clock.left + clock.right) / 2 - (field.left + field.right) / 2) < 3 && clock.top < field.top + 30 && clock.right <= field.right,
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
    ok(lay.panelGone, `E30: no side panel in play: the board runs to the window's right edge   ${at}`);
    {
      // E28 / E30: the longest grey hint fits in every Command Line (4 lines here), in the hint's own type
      const fit = await ev(`(() => { const cv = document.createElement('canvas').getContext('2d');
        return [...document.querySelectorAll('#console .box')].filter(b => b.getBoundingClientRect().width > 0).map(b => { const i = b.querySelector('input'), cs = getComputedStyle(i, '::placeholder');
          cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; return Math.round(i.clientWidth - cv.measureText('CAV + unit + type').width); }); })()`);
      ok(fit.length === 4 && fit.every((x) => x >= 0), `E30: "CAV + unit + type" fits in each of 4 Command Lines   ${at} [${fit.join(", ")} px spare]`);
    }
    eq(lay.clearOfTop, 0, `the wall clock, both first-game tags (E28) and Time Warp's clock sit clear of every nest   ${at}`);
    ok(lay.tipsIn, `E28: both first-game tags fit on the board beside the wall clock   ${at}`);
    await ev("(() => { document.querySelector('#tip-ready').hidden = true; document.querySelector('#tip-clock').hidden = true; return 1; })()");
    ok(lay.clockCentre, `Refinement 6 §3: the wall clock is at the top centre of the playing field   ${at}`);
    ok(lay.warpCentre && lay.warpClear === 0, `Refinement 6 §2, E27 and E28: Time Warp's grandfather clock, sign and caption sit in the centre of the board, clear of every nest and readout   ${at}`);
    ok(lay.tagged === 0 && lay.tagIn, `Refinement 5 §6: the hose tag stays on the board and touches no nest or readout   ${at}`);
    ok(lay.muteClear, `E24: the mute button sits in the HUD bar's left end, clear of its words, the wall clock and the board   ${at}`);
    if (SHOTS) {
      await ev(`(() => { document.querySelectorAll('.mess').forEach((m, i) => i % 3 === 0 && ET.mess.splatter(m, 6)); return 1; })()`);
      await shot(`10-full-board-${w}x${h}`);
    }
  }
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  /* ------------------------------------------------------- P. Time Warp */
  section("P. Time Warp (Refinement 3 §4, E27, E28)");
  await ev("__et.start('clear', 1)");
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
      __et.start('clear', 1); __et.advance(0.1);
      const s = __et.snapshot(), t0 = s.time + 0.05, seen = [];
      ET.view.render(Object.assign({}, s, { warp: false }));
      for (let i = 0; i < 60; i++) { ET.view.render(Object.assign({}, s, { warp: true, time: t0 + i * 0.05 })); seen.push(ET.view.warpSign().lit ? 1 : 0); }
      const log = ET.view.warpSign().log, ons = log.filter(e => e.on).map(e => e.t);
      let worst = 0;
      for (let i = 0; i < ons.length; i++) { let n = 0; for (let j = i; j < ons.length && ons[j] < ons[i] + 1; j++) n++; worst = Math.max(worst, n); }
      const out = { seen: seen.join(''), offs: log.filter(e => !e.on).length, ons: ons.length, worst, gaps: log.slice(1).map((e, i) => e.t - log[i].t), anim: getComputedStyle(document.querySelector('#warp .plaque')).animationName };
      __et.start('clear', 1); __et.advance(0.1);
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
    await ev("__et.start('clear', 1); __et.advance(0.1); 1");
  }
  {
    // E31 (ruled 2026-09-24): after the flashes, while Time Warp runs, the letters wobble and stretch; the sign's brightness
    // never changes. A real Time Warp, held on pause (the page keeps drawing it), watched in real time. The flashes are
    // skipped for this one check (warpSignFlashes 0), so the wobble starts the moment Time Warp does.
    const esc = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    const held = await ev(`(() => {
      ET.CONFIG.__flashes = ET.CONFIG.warpSignFlashes; ET.CONFIG.warpSignFlashes = 0;
      __et.start('clear', 1, { types: ['MB'] }); __et.advance(0.1);
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
    await ev(`(() => { ${esc}; ET.CONFIG.warpSignFlashes = ET.CONFIG.__flashes; delete ET.CONFIG.__flashes; __et.start('clear', 1); __et.advance(0.1); return 1; })()`);
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
      // E27: the clock's hands hold still too, and its face reads "5×" (stepped in one evaluation while it runs)
      const h = await ev("(() => { const a = ET.view.clockHands(); __et.advance(0.1); const b = ET.view.clockHands(); return { a, b, warp: __et.snapshot().warp, five: document.querySelector('#warp .fivex').textContent }; })()");
      ok(h.warp && h.a.minute === h.b.minute && h.a.hour === h.b.hour && h.b.fivex && h.five === "5×", `SAFETY: with reduced motion the clock's hands hold still and its face shows "5×"   [${h.five}, ${h.b.fivex}]`);
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

  /* ------------------------------------------------------- S. egg-laying sound */
  section("S. egg-laying sound (Chat ruling, 2026-09-25)");
  {
    const esc = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    // log every squeeze and pop with the game's moment, the laying nest's progress, and the pitch it used
    await ev(`(() => { window.__lay = []; ['squeeze', 'pop'].forEach(k => { const f = ET.audio[k]; if (f.__wrapped) return;
      const w = function () { const s = __et.snapshot(), n = s.nests.find(x => x.state === 'laying'); const j = f.apply(this, arguments);
        window.__lay.push({ k, t: s.time, lay: n ? n.lay : null, j }); return j; }; w.__wrapped = true; ET.audio[k] = w; }); return 1; })()`);
    const lays = await ev(`(() => { window.__lay = []; __et.start('clear', 1, { types: ['VS'] }); __et.advance(0.1); const starts = [];
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
    const vf = await ev(`(() => { window.__lay = []; __et.start('clear', 1, { types: ['VF'] }); __et.advance(0.1);
      for (let i = 0; i < 1500; i++) { __et.advance(0.02); __et.snapshot().nests.filter(n => n.state === 'overtime').forEach(n => __et.submit('RCAV ' + n.unit)); }
      return window.__lay.length; })()`);
    eq(vf, 0, "a VF lays no egg on a cord (E16), so it makes neither sound");
    // pause holds the squeeze: stop just before it, wait, see nothing
    const held = await ev(`new Promise((done) => { window.__lay = []; __et.start('clear', 1, { types: ['VS'] }); __et.advance(0.1);
      for (let i = 0; i < 2000; i++) { const n = __et.snapshot().nests.find(x => x.state === 'laying'); if (n && n.lay > ${at} - 0.1) break; __et.advance(0.02); }
      ${esc}; const n0 = window.__lay.length; setTimeout(() => { const n1 = window.__lay.length; ${esc}; done({ n0, n1 }); }, 1200); })`);
    ok(held.n0 === 0 && held.n1 === 0, "pause holds the squeeze (it follows the lay's own progress)");
    // a burst of lays: at most 2 pops (and 2 squeezes) sounding at once
    const burst = await ev("(() => { const p = [], s = []; for (let i = 0; i < 6; i++) { p.push(ET.audio.pop()); s.push(ET.audio.squeeze()); } return { p: p.filter(x => x !== false).length, s: s.filter(x => x !== false).length, on: ET.audio.state() }; })()");
    ok(burst.p <= 2 && burst.s <= 2 && (burst.on === "none" || burst.p >= 1), `a burst of lays can't pile up: at most 2 pops and 2 squeezes at once   [${burst.p} pops, ${burst.s} squeezes of 6 each]`);
    // the mix: both clearly under THONG, the error buzz and the hiss
    const m = await ev(`Promise.all([['squeeze'], ['pop'], ['thong'], ['buzz'], ['hiss', [0.85, 0.12]]].map(([k, a]) => ET.audio.measure(k, a, 1)))
      .then(r => r.map(x => ({ peak: +x.peak.toFixed(3), rms: +x.rms.toFixed(4) })))`);
    const [msq, mpop, ...cues] = m, quiet = { peak: Math.min(...cues.map((c) => c.peak)), rms: Math.min(...cues.map((c) => c.rms)) };
    ok([msq, mpop].every((s) => s.peak <= 0.6 * quiet.peak && s.rms <= 0.6 * quiet.rms),
      `the squeeze and the pop sit clearly under THONG, the buzz and the hiss (under 60% of the quietest cue's peak and loudness)   [squeeze ${msq.peak}/${msq.rms}, pop ${mpop.peak}/${mpop.rms}; cues ${cues.map((c) => c.peak + "/" + c.rms).join(", ")}]`);
    await ev("__et.start('clear', 2); __et.advance(0.1); 1");
  }

  /* ------------------------------------------------------- U. board lights and Time Warp dark */
  section("U. board lights and Time Warp dark (Chat ruling, 2026-09-25)");
  {
    const esc = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    await ev("__et.start('clear', 2); __et.advance(0.1); 1");
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
      __et.start('clear', 2); __et.advance(0.1);
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
        return { life: s[s.length - 1][0] - s[0][0], whole: s.length >= 3 && s[0][1] < 0.01 && s[s.length - 1][1] < 0.01, turns, jump, peak: Math.max(peak, s[0][1]) };
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
    const muted = await ev(`(() => { __et.start('clear', 2); __et.advance(0.1); const was = ET.audio.muted(); if (!was) document.querySelector('#mute').click(); const n0 = ET.view.backdrop().starts.length;
      for (let i = 0; i < 400; i++) { __et.advance(0.05); __et.snapshot().nests.filter(n => n.state === 'overtime').forEach(n => __et.submit('RCAV ' + n.unit)); }
      const n1 = ET.view.backdrop().starts.length; const m = ET.audio.muted(); if (!was) document.querySelector('#mute').click(); return { m, more: n1 - n0 }; })()`);
    ok(muted.m && muted.more > 0, `mute doesn't stop the lights (they follow the beat clock)   [${muted.more} new while muted]`);
    // Time Warp dark: a steady Time Warp drawn frame by frame (all in one evaluation)
    const dark = await ev(`(() => {
      __et.start('clear', 2); __et.advance(0.1);
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
      __et.start('clear', 2); __et.advance(0.1);
      return { on, off, same: JSON.stringify(before) === JSON.stringify(during), gaps: log.slice(1).map((e, i) => +(e.t - log[i].t).toFixed(2)) };
    })()`);
    ok(dark.on.dark && dark.on.cls && dark.on.fade === "0.5s" && dark.on.prop === "opacity" && !dark.off,
      `when Time Warp starts, the board and its lights fade to dark over half a second, and fade back when it ends   [${dark.on.fade} ${dark.on.prop}]`);
    ok(dark.same, "…leaving the nests, eggs, text boxes, the clock, its sign and caption and the bolts untouched");
    ok(dark.gaps.length > 0 && dark.gaps.every((g) => g >= 0.5 - 1e-6), `SAFETY: the dark changes at most once in half a second, however fast Time Warp flips   [gaps ${dark.gaps.slice(0, 6).join(" ")} s]`);
    // reduced motion: no lights; the Time Warp dark still happens, as a fade
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const rm = await ev(`(() => { __et.start('clear', 2); __et.advance(0.1); let most = 0;
      for (let i = 0; i < 200; i++) { __et.advance(0.05); most = Math.max(most, ET.view.backdrop().lights.length); }
      const s = __et.snapshot(); ET.view.render(Object.assign({}, s, { warp: true, time: s.time + 0.05 }));
      const v = getComputedStyle(document.querySelector('#backdrop .veil'));
      const out = { most, starts: ET.view.backdrop().starts.length, dark: ET.view.backdrop().dark, fade: v.transitionDuration };
      __et.start('clear', 2); __et.advance(0.1); return out; })()`);
    ok(rm.most === 0 && rm.starts === 0 && rm.dark && rm.fade === "0.5s", `SAFETY: with reduced motion there are no lights, and the Time Warp dark is still a fade   [${rm.starts} lights, ${rm.fade}]`);
    await c.send("Emulation.setEmulatedMedia", { features: [] });
  }

  /* ------------------------------------------------------- Q. the scary mom face */
  section("Q. the scary mom face (Refinement 5 §5)");
  await ev("__et.start('both', 4)");
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
      if (${!st.inactive}) Object.assign(n, { state: '${st.state || "idle"}', grow: ${st.grow ?? 0}, crack: ${st.crack ?? 0}, elapsed: 600, hidden: false, lay: null, retract: null, note: null }); else n.state = 'idle';
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
    await ev(`(() => { __et.start('clear', 1, { types: ['MB'] }); __et.advance(0.1); ${"document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))"}; return 1; })()`);
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
    await ev(`(() => { ${"document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))"}; __et.start('clear', 2); __et.advance(0.1); return 1; })()`);
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

    // E24: the mute setting is remembered per browser, across a reload, before any key is pressed
    await press("m");
    const before = await ev("[ET.audio.muted(), localStorage.getItem('eggtimer.muted')]");
    await reload();
    for (let i = 0; i < 100 && !(await ev("!!(window.__et && __et.ready())")); i++) await wait(50);
    const after = await ev("[ET.audio.muted(), document.querySelector('#mute').getAttribute('aria-pressed')]");
    eq([before, after], [[true, "1"], [true, "true"]], "E24: muted stays muted after a reload: the browser remembers it");
    await press("m");
    eq(await ev("[ET.audio.muted(), localStorage.getItem('eggtimer.muted')]"), [false, "0"], "…and M turns it back on");
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
