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
  eq(await boxes(), ["900 rgb(11, 93, 30) rgb(255, 255, 255)", "900 rgb(0, 0, 0) rgb(185, 185, 198)", "900 rgb(255, 255, 255) rgb(209, 0, 106)"],
    "Refinement 5 §2: at the limit, all three at once: unit bold dark green on white, type bold black on grey, timer bold white on the ready pink (E33: #d1006a)");
  eq(await ev(`[".strip .chip.bold", ".strip .cell:nth-child(2) .num"].map(s => { const e = document.querySelector(s), c = getComputedStyle(e); return c.backgroundColor + " " + c.color; })`),
    ["rgb(209, 0, 106) rgb(255, 255, 255)", "rgb(209, 0, 106) rgb(255, 255, 255)"], "E33: the How To Play strip's pink chip and panel 2's badge are the real timer's pink, white on it");
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
    const one = await ev(`(() => { __et.start('clear', 1); __et.advance(0.05);
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
  await ev("__et.start('clear', 1)");                       // fresh: nothing has hatched yet
  // E37: count every THONG, and every pan that comes down, from here to the hatch
  await ev(`(() => { window.__e37 = { thong: 0, pan: 0 }; const f = ET.audio.thong; ET.audio.thong = function () { __e37.thong++; return f.apply(this, arguments); };
    ET.audio.thong.__orig = f; new MutationObserver((ms) => ms.forEach((m) => { if (m.target.classList && m.target.classList.contains('pan') && m.target.className !== 'pan') __e37.pan++; }))
      .observe(document.querySelector('#field') || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); return 1; })()`);
  const h = await until((x) => x.stats.hatched >= 1, 120, 0.1);
  ok(!!h.hit, "leaving a CAV alone lets it hatch");
  eq(await ev("document.querySelector('#hud-pool').textContent"), "●●○", "the pool shows 2 of 3");
  eq(await ev("document.querySelector('#hud-pool-label').textContent"), "POOL", "the pool is shown by its placeholder key only");
  ok(await ev("!!document.querySelector('.nest.scurry, .nest.lunge')"), "the creature does an escape flourish (scurry or lunge)");
  await wait(600);   // longer than the old late pan's delay plus its slam
  eq(await ev("(() => { const r = [__e37.thong, __e37.pan, document.querySelectorAll('.pan:not([class=\"pan\"])').length]; ET.audio.thong = ET.audio.thong.__orig; return r; })()"), [0, 0, 0],
    "E37: a hatch shows the hatch only: no THONG and no pan (counted from the start to after the hatch)");
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
  eq(await ev("ET.audio.state()"), "running", "sound is unlocked by the first key press");
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
    eq(run.ready && run.ready.pink, "rgb(209, 0, 106)", "…in the bold timer's pink (E33)");
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
    {
      // E39: with its rule on, two eggs each over 8:00 from bold light Time Warp early in a wave (one ev: nothing between)
      const e39 = await ev(`(() => { ET.CONFIG.warpFar.eggs = 2; __et.start('clear', 1, { types: ['MB'] }); let s = null;
        for (let i = 0; i < 4000; i++) { __et.advance(0.02); s = __et.snapshot(); if (s.nests.filter(n => n.state === 'active').length >= 2) break; }
        __et.advance(0.02); s = __et.snapshot();
        const r = { warp: s.warp, early: s.spawned < s.quota, lit: document.querySelector('#warp').classList.contains('lit') };
        ET.CONFIG.warpFar.eggs = Infinity; return r; })()`);
      eq(e39, { warp: true, early: true, lit: true }, "E39: two eggs each over 8:00 from bold light Time Warp, before the wave's last CAV has spawned");
      await ev("__et.start('clear', 1); __et.advance(0.1); 1");
      lit = null;
      for (let t = 0; t < 300 && !lit; t += 0.25) {
        const x = await snap();
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
    eq(live.legs, "legs", "…and the escaping hatchling's legs shuffle");
    await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (let i = 0; i < 20 && !(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches")); i++) await wait(50);
    const still = await motion("reduced");
    ok(still.t && !!still.cue && still.cue.anim === "none" && still.cue.border === "rgb(34, 227, 255)", `SAFETY: with reduced motion the place-me cue stops blinking and holds a steady cyan border   [${still.cue && still.cue.anim}, ${still.cue && still.cue.border}]`);
    ok(still.cord.length === 6 && still.cord.every((d) => d === 0), `SAFETY: …the laying cord hangs straight, no twitch   [spread ${still.cord.map((d) => d === null ? "-" : d.toFixed(1)).join(" ")} px]`);
    ok(still.bold && still.wobble.length === 6 && still.wobble.every((a) => a === 0), `SAFETY: …the overtime egg doesn't wobble   [${still.wobble.map((a) => a === null ? "-" : a.toFixed(2)).join(" ")}°]`);
    eq(still.legs, "none", "SAFETY: …and the hatchling's legs hold still");
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
    await ev("__et.start('clear', 1); 1");
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
    // the squeeze and the pop are random (pitch, noise): each is measured 5 times and its loudest taken
    const m = await ev(`Promise.all([['squeeze'], ['pop'], ['thong'], ['buzz'], ['hiss', [0.85, 0.12]], ['squelch'], ['bloop']].map(([k, a]) =>
        Promise.all(Array.from({ length: ['thong', 'buzz', 'hiss'].includes(k) ? 1 : 5 }, () => ET.audio.measure(k, a, 1)))
          .then(rs => ({ peak: Math.max(...rs.map(x => x.peak)), rms: Math.max(...rs.map(x => x.rms)) }))))
      .then(r => r.map(x => ({ peak: +x.peak.toFixed(3), rms: +x.rms.toFixed(4) })))`);
    const [msq, mpop, th, bz, hs, msl, mbl] = m, cues = [th, bz, hs], quiet = { peak: Math.min(...cues.map((c) => c.peak)), rms: Math.min(...cues.map((c) => c.rms)) };
    ok([msq, mpop, msl, mbl].every((s) => s.peak <= 0.6 * quiet.peak && s.rms <= 0.6 * quiet.rms),
      `the squeeze and the pop (and E38's squelch and bloop) sit clearly under THONG, the buzz and the hiss (under 60% of the quietest cue's peak and loudness)   [squeeze ${msq.peak}/${msq.rms}, pop ${mpop.peak}/${mpop.rms}, squelch ${msl.peak}/${msl.rms}, bloop ${mbl.peak}/${mbl.rms}; cues ${cues.map((c) => c.peak + "/" + c.rms).join(", ")}]`);
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
  /* ------------------------------------------------------ E38. pieces, the hose's push, the trough */
  section("E38. pieces, the hose's push and the trough (Chat, 2026-09-25)");
  {
    const escK = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    await ev(`(() => { __et.start('clear', 1); __et.advance(0.1); ${escK}; return 1; })()`);   // paused: only the rig moves things
    for (let i = 0; i < 60 && !(await ev("ET.pieces.state().ready")); i++) await wait(100);
    // helpers, in board px: a drag as the player makes one, the physics stepped on its own, a row clear of every readout
    await ev(`(() => {
      window.__drag = (pts) => { const f = document.querySelector('#field'), b = document.querySelector('#board').getBoundingClientRect();
        const fire = (t, p) => f.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: b.left + p[0], clientY: b.top + p[1], pointerId: 9, buttons: 1 }));
        fire('pointerdown', pts[0]); pts.slice(1).forEach((p) => fire('pointermove', p)); fire('pointerup', pts[pts.length - 1]); };
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
    ok(made.every((m) => m.shell >= PT.shards[0] && m.shell <= PT.shards[1]), `every clear leaves ${PT.shards[0]}-${PT.shards[1]} shell pieces cut from the egg picture   [${made.map((m) => m.shell).join(", ")}]`);
    eq(made.map((m) => m.parts), [0, 0, 1, 2, 3], "break stages 3, 4 and 5 add 1, 2 and 3 alien parts (antenna, clawed leg, tentacle and goo, eye); 1 and 2 none");
    await ev("__steps(80)");
    const settled = await ev(`(() => { const s = ET.pieces.state(), L = ET.pieces.list();
      const onWall = L.filter((p) => p.state === 'rest' && s.walls.some((w) => p.x > w.x0 + 1 && p.x < w.x1 - 1 && p.y > w.y0 + 1 && p.y < w.y1 - 1)).length;
      const off = L.filter((p) => p.x < 0 || p.x > s.W || p.y < 0 || p.y > s.H).length;
      return { n: L.length + s.drained, rest: s.rest, onWall, off }; })()`);
    ok(settled.rest > 0 && settled.onWall === 0 && settled.off === 0, `they slide, settle and pile round the readouts, never on one, and stay on the board   [${settled.rest} at rest, ${settled.onWall} on a readout]`);
    await ev("__steps(400)");
    eq(await ev("ET.pieces.state().count + ET.pieces.state().drained"), settled.n, "…and never fade or vanish on their own (20 s later, every one is still there)");

    // E42: one good sweep of the hose carries a piece all the way across the board into the trough on the far side (it
    // went ~80% of the way), at every measured size (the board is 2.25-2.74 board heights wide)
    const sweeps = [];
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 640]]) {
      await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await wait(200);
      sweeps.push(await ev(`(() => { ET.pieces.layout(); const s = ET.pieces.state(), row = __row(40); ET.pieces.reset(); const id = ET.pieces.place('shell', s.T + 70, row);
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
      const t1 = performance.now(); __drag([[s.W * 0.3, y], [s.W * 0.35, y], [s.W * 0.4, y], [s.W * 0.45, y], [s.W * 0.5, y]]); ET.pieces.frame(0.016, false); const sweep = performance.now() - t1;
      const woke = ET.pieces.state().live; __steps(200); return { frame, sweep, woke, count: ET.pieces.state().count + ET.pieces.state().drained }; })()`);
    ok(perf.frame < 3 && perf.sweep < 80 && perf.woke > 0 && perf.count === 3000, `a pile of 3000 pieces costs ${perf.frame.toFixed(2)} ms a frame at rest; a sweep through it wakes ${perf.woke} and takes ${perf.sweep.toFixed(1)} ms; nothing disappears`);

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
    const carry = await ev(`(() => { __et.start('clear', 2, { types: ['VS'] }); __et.advance(0.1); ET.pieces.bench(30); const ids = ET.pieces.list().map((p) => p.id);
      for (let i = 0; i < 20000 && __et.snapshot().wave === 1; i++) { __et.advance(0.05); __et.snapshot().nests.filter((n) => n.state === 'overtime').forEach((n) => __et.submit('RCAV ' + n.unit)); }
      const now = ET.pieces.list().map((p) => p.id); return { wave: __et.snapshot().wave, kept: ids.every((id) => now.includes(id)), more: now.length > ids.length }; })()`);
    ok(carry.wave === 2 && carry.kept && carry.more, `pieces left at the end of cleanup carry into the next wave, none removed (and the wave's clears added more)   [wave ${carry.wave}]`);
  }

  /* ------------------------------------------------------ E42. the hose's blast */
  section("E42. the hose's blast: a jet, not a trickle (Chat, 2026-09-25)");
  {
    const escK = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))";
    await ev("__et.start('clear', 1); __et.advance(0.1); 1");
    if (await ev("__et.paused()")) await ev(`(() => { ${escK}; return 1; })()`);
    const fireJs = "const f = document.querySelector('#field'), b = document.querySelector('#board').getBoundingClientRect(); const fire = (t, x, y) => f.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: b.left + x, clientY: b.top + y, pointerId: 11, buttons: 1 }));";
    // press, drag right, hold still 0.4 s, release: all in one evaluation, timed in the page
    const held = await ev(`new Promise((done) => { ${fireJs}
      document.querySelectorAll('#water .drop, #water .splash').forEach((d) => d.remove());
      fire('pointerdown', 400, 300);
      const j = document.querySelector('#water .jet'), m0 = new DOMMatrix(getComputedStyle(j).transform);
      const r0 = { shown: !j.hidden, blasting: ET.audio.blasting(), aim: [+m0.a.toFixed(3), +m0.b.toFixed(3)] };
      fire('pointermove', 430, 300); fire('pointermove', 460, 300);
      const jr = j.getBoundingClientRect(), m1 = new DOMMatrix(getComputedStyle(j).transform);
      const r1 = { w: parseFloat(j.style.height), len: parseFloat(j.style.width), H: b.height, aim: [+m1.a.toFixed(3), +m1.b.toFixed(3)], left: jr.left - b.left,
        anim: getComputedStyle(j.querySelector('.core')).animationName + '/' + getComputedStyle(j.querySelector('.burst')).animationName, drops: document.querySelectorAll('#water .drop').length };
      setTimeout(() => {
        const r2 = { drops: document.querySelectorAll('#water .drop').length, splash: document.querySelectorAll('#water .splash').length, shown: !j.hidden, blasting: ET.audio.blasting() };
        fire('pointerup', 460, 300);
        done({ r0, r1, r2, r3: { shown: !j.hidden, blasting: ET.audio.blasting() } });
      }, 400); })`);
    const J = await ev("ET.CONFIG.hoseJet");
    ok(held.r0.shown && held.r0.blasting && Math.abs(held.r0.aim[0] + Math.SQRT1_2) < 0.01 && Math.abs(held.r0.aim[1] + Math.SQRT1_2) < 0.01,
      `pressing starts the jet at once, pointing the nozzle's way (up-left), and the blast with it   [${JSON.stringify(held.r0)}]`);
    ok(held.r1.aim[0] > 0.99 && Math.abs(held.r1.left - 460) <= held.r1.w && Math.abs(held.r1.len - J.length * held.r1.H) < 1,
      `dragging, the jet runs from the nozzle the way the drag goes (hoseJet.aim "${J.aim}", ⏳ E44), ${J.length} board heights long   [${Math.round(held.r1.len)} px, from x ${Math.round(held.r1.left)}]`);
    ok(held.r1.w >= 10 && held.r1.anim === "jet-flow/jet-burst" && held.r1.drops > 0,
      `it's a thick, fast jet (${held.r1.w.toFixed(1)} px; the old drops were 6), streaming, with a burst at the nozzle and mist along it   [${held.r1.anim}, ${held.r1.drops} mist]`);
    ok(held.r2.shown && held.r2.blasting && held.r2.drops > 0 && held.r2.splash > 0, `held still, it keeps blasting: mist, a splash where it hits, the sound   [${JSON.stringify(held.r2)}]`);
    ok(!held.r3.shown && !held.r3.blasting, "letting go ends the jet and the blast");
    // the jet pushes what it reaches ahead of the nozzle (the old spray caught only what the nozzle passed)
    const reach = await ev(`(() => { ET.pieces.layout(); ET.pieces.reset(); const s = ET.pieces.state(), row = __row(40), x = s.W / 2, L = ET.CONFIG.hoseJet.length * s.H;
      const id = ET.pieces.place('shell', x + 0.7 * L, row); __drag([[x - 20, row], [x, row]]); const st = __p(id).state; ET.pieces.reset(); return st; })()`);
    eq(reach, "live", "the jet pushes a piece it reaches ahead of the nozzle");
    const taps = await ev(`(() => { ${fireJs} const r = []; for (let i = 0; i < 4; i++) { fire('pointerdown', 400, 300); r.push(ET.audio.blasting()); fire('pointerup', 400, 300); } return r; })()`);
    eq(taps, [true, true, true, true], "quick taps blast every time (the last blast's fade never uses up the cap)");
    // a pause, and the play screen closing, end the blast
    const paused = await ev(`(() => { ${fireJs} fire('pointerdown', 400, 300); const a = ET.audio.blasting(); ${escK}; const r = { a, b: ET.audio.blasting(), shown: !document.querySelector('#water .jet').hidden }; ${escK}; return r; })()`);
    ok(paused.a && !paused.b && !paused.shown, `Esc mid-spray pauses the game and ends the jet and its blast   [${JSON.stringify(paused)}]`);
    const gone = await ev(`(() => { ${fireJs} fire('pointerdown', 400, 300); const a = ET.audio.blasting(); __et.show('over'); const z = ET.audio.blasting(); return { a, b: z }; })()`);
    ok(gone.a && !gone.b, "leaving the play screen mid-spray ends the blast");
    await ev("__et.start('clear', 1); __et.advance(0.1); 1");
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
    // the cord egg (Chat's answers, 2026-09-25): from the pop, the egg coming out of the cord is the nest's own egg picture,
    // mirrored as laid, tilted with the nest; at the landing it is exactly the 35% egg that then starts its clock
    const lay = await ev(`(() => {
      const C = ET.CONFIG, pop = (u) => (C.layDrop + u * C.layPop) / (C.layDrop + C.layPop);
      const frame = (patch, mirror) => { const s = JSON.parse(JSON.stringify(__et.snapshot())); s.warp = false; const n = s.nests[0];
        Object.assign(n, { hidden: false, note: null, crack: 0, elapsed: 0, grow: 0, retract: null }, patch);
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
