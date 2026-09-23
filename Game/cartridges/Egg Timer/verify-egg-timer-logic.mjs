/* ===========================================================================
   verify-egg-timer-logic.mjs — does the DOM-free core do what the packet says?

   RUN   node verify-egg-timer-logic.mjs      (from this folder; no server needed)

   Loads files/core/*.js into a plain VM context, exactly as a browser would load
   them as classic scripts, then checks every curve against the packet's own
   numbers and drives the game through its states with a seeded random source.
   Each "must reject" check is paired with the same action succeeding once the
   rule allows it, so a check that can never fail can't hide here.
   ========================================================================= */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HERE = new URL("./", import.meta.url);
const read = (p) => readFileSync(new URL(p, HERE), "utf8");

const ctx = vm.createContext({ Math, console });
for (const f of ["config", "rules", "commands", "data", "game"]) {
  vm.runInContext(read(`files/core/${f}.js`), ctx, { filename: `${f}.js` });
}
const ET = ctx.ET;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  cond ? pass++ : (fail++, fails.push(label));
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`);
}
const eq = (got, want, label) => ok(JSON.stringify(got) === JSON.stringify(want), `${label}   [got ${JSON.stringify(got)}]`);
const section = (s) => console.log(`\n${s}`);
const R = ET.rules;

/* ---------------------------------------------------------------- A. curves */
section("A. curves match the packet's numbers");
eq([1, 2, 3, 4, 5, 15, 16, 30].map(R.nestsForWave), [5, 5, 6, 6, 7, 12, 12, 12], "nests: 5, +1 every 2 waves, 6 from wave 3, cap 12 at wave 15");
eq([1, 2, 3].map(R.quotaForWave), [8, 10, 12], "quota: 8, +2 per wave");
eq(R.spawnGapRange(1), [5, 7], "spawn gap wave 1 is 5–7 s");
eq(R.spawnGapRange(9), [1, 3], "spawn gap wave 9: low end at the 1 s floor");
eq(R.spawnGapRange(13), [1, 1], "spawn gap is a flat 1 s by wave 13");
eq(R.cleanupRange(1), [5, 10], "cleanup window wave 1 is 5–10 s");
eq(R.cleanupRange(5), [3, 8], "cleanup: low end at the 3 s floor by wave 5");
eq(R.cleanupRange(15), [3, 3], "cleanup is a flat 3 s by wave 15");
eq([1, 2, 13, 20].map(R.placementTimeout), [20, 19, 8, 8], "auto-open timeout: 20 s, −1 s per wave, floor 8 s at wave 13");
eq([1, 2, 3, 4, 5, 12, 13, 30].map(R.overtimeBaseFor), [6, 6, 5.75, 5.75, 5.5, 4.75, 4.5, 4.5], "overtime: 6 s, −0.25 s every 2 waves (odd waves), floor 4.5 s at wave 13");
eq([1, 2, 3, 4, 5, 18, 20, 40].map((w) => Math.round(R.clockSpeed(w) * 100) / 100), [1, 1.1, 1.1, 1.2, 1.2, 1.9, 2, 2], "clock speed: 1.0, +10% on even waves, cap 2× at wave 20");
eq([1, 20].map(R.clockRate), [30, 60], "a displayed minute takes 2 s at base speed, 1 s at the cap (10:00 in 10 s)");
eq([1, 2, 3, 4, 13, 14].map((w) => Math.round(R.placementChance(w) * 100)), [0, 0, 0, 10, 100, 100], "Follow Progression: 0 in waves 1–3, 10% at wave 4, 100% at wave 13");
eq([0, 2.5, 5, 9].map((x) => R.clearPoints(x, 5)), [100, 63, 25, 25], "clear points: 100 at bold, linear to 25 at the hatch");
eq([1, 5, 10].map(R.perfectWaveBonus), [50, 250, 500], "perfect wave bonus: 50 × wave");
eq([R.minutesFor({ code: "VS", min: 10, max: 10 }, () => 0.5), R.minutesFor({ code: "MB", min: 30, max: 30 }, () => 0.5)], [10, 30], "fixed types go bold at their own minutes");
eq([0, 0.5, 0.999999].map((u) => R.minutesFor({ code: "AD", min: 10, max: 30 }, () => u)), [10, 20, 30], "AD: whole minutes, 10–30 inclusive");
ok(!Number.isInteger(R.minutesFor({ code: "VF", min: 10, max: 30 }, () => 0.37)), "VF: still a uniform draw across 10–30 min (hidden, and no note to read)");
{
  const ot = [0, 0.5, 0.999999].map((u) => R.overtimeFor(1, () => u));
  eq(ot.map((x) => Math.round(x * 100) / 100), [5.4, 6, 6.6], "overtime wave 1: 6 s ±10%");
  const late = [0, 0.999999].map((u) => R.overtimeFor(20, () => u));
  eq(late.map((x) => Math.round(x * 100) / 100), [4.05, 4.95], "overtime wave 20: 4.5 s, still only ±10%");
}

/* -------------------------------------------------------------- B. commands */
section("B. PowerLine syntax");
const P = (s) => JSON.parse(JSON.stringify(ET.commands.parse(s)));
eq(P("CAV 2101 MB"), { kind: "cav", unit: "2101", type: "MB", comment: "" }, "CAV #### TYPE");
eq(P("cav 2101 mb, fuel truck delay"), { kind: "cav", unit: "2101", type: "MB", comment: "FUEL TRUCK DELAY" }, "optional trailing comment, any case");
eq(P("  RCAV   2101 "), { kind: "rcav", unit: "2101" }, "RCAV ####, extra spaces tolerated");
eq([P("CAV 210 MB"), P("RCAV 21010"), P("CAV MB 2101"), P("RCAV"), P("")], [null, null, null, null, null], "not PowerLine → null (wrong unit length, code-before-unit, bare word)");

/* ------------------------------------------------------------------ C. data */
section("C. data");
const types = ET.data.parseTypes(read("files/datasets/cav_types.csv"));
eq(types.map((t) => t.code), ["VS", "STR", "SS", "EOS", "MB", "AD", "VF"], "the type table is the packet's seven codes, in order");
eq(types.filter((t) => t.twoPhaseOnly).map((t) => t.code), ["VF"], "only VF is two-phase only");
eq(types.filter((t) => t.hiddenUntilTrigger).map((t) => t.code), ["VF"], "only VF hides until its trigger");
{
  // D1 (ruled 2026-09-17): a Developer-Mode-only copy of the seven real types, same values
  const blank = ET.data.parseTypes(read("files/datasets/cav_types_blank.csv"));
  ok(blank.length === 7 && JSON.stringify(blank) === JSON.stringify(types), `D1: the Blank Dataset Module holds the seven real types, every value the same   [${blank.map((t) => t.code).join(",")}]`);
}
const units = ET.data.parseUnits(read("../../datasets/AP_ENP_BSE/2. Units_Transports.csv"));
eq(units.length, 59, "59 transport units from the shared Data Sheet");
ok(units.every((u) => /^\d{4}$/.test(u)), "every unit is four digits");

/* ------------------------------------------------------------------ D. game */
const T = (code, min, extra = {}) => ({ code, meaning: code, min, max: min, twoPhaseOnly: false, hiddenUntilTrigger: false, ...extra });
function game(mode, typeList, seed = 7) {
  const g = new ET.Game({ mode, types: typeList, units, rng: ET.seededRandom(seed) });
  g.start();
  return g;
}
function advance(g, seconds, each) {
  const steps = Math.round(seconds / 0.05);
  for (let i = 0; i < steps; i++) {
    g.step(0.05);
    if (each) each(g);
    if (g.phase === "over") break;
  }
}
const inState = (g, s) => g.unlocked().filter((n) => n.state === s);

section("D. one CAV, one clear (Clear CAVs Only)");
{
  const g = game("clear", [T("VS", 10)]);
  advance(g, 0.05);
  const n = inState(g, "active")[0];
  ok(!!n, "a CAV opens on its own at the start of wave 1");
  eq(g.unlocked().length, 5, "wave 1 has 5 nests");
  ok(!g.submit("RCAV " + n.unit).ok, "RCAV before the real duration has passed does nothing");
  advance(g, 19.9);
  ok(n.state === "active" && !g.submit("RCAV " + n.unit).ok, "…still nothing at 19.95 s");
  advance(g, 0.1);
  eq(n.state, "overtime", "at 20 s the nest turns bold (overtime)");
  const r = g.submit("rcav " + n.unit);
  ok(r.ok && r.points >= 95, `…and the same RCAV now clears it, near full points   [${r.points}]`);
  eq(n.state, "splat", "a clear smooshes the egg");
  eq(g.pool, 3, "a clear doesn't touch the pool");
  advance(g, 1.2);
  eq(n.state, "idle", "the smooshed nest resets to idle");
}

section("E. hatching, the pool, and game over");
{
  const g = game("clear", [T("XX", 1)]);
  const over = [];
  advance(g, 120, (x) => x.events.forEach((e) => e.type === "game-over" && over.push(e)));
  eq(g.phase, "over", "never clearing anything ends the game");
  eq([g.pool, g.stats.hatched], [0, 3], "…after exactly three hatches, pool 3 → 0");
  const t = g.time;
  g.step(1);
  eq(g.time, t, "a finished game doesn't advance");
}
{
  const g = game("clear", [T("XX", 1)]);
  let hatchedAt = null;
  advance(g, 30, (x) => { if (hatchedAt === null && x.stats.hatched === 1) hatchedAt = x.pool; });
  eq(hatchedAt, 2, "one hatch costs exactly one from the pool");
}

section("F. waves: quota, perfect bonus, cleanup, growth");
{
  const g = game("clear", [T("XX", 1)]);
  const seen = [];
  const clearAll = (x) => {
    x.events.forEach((e) => seen.push(e));
    x.events = [];
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  };
  advance(g, 200, (x) => { clearAll(x); if (x.wave === 3) x.phase = x.phase; });
  const ends = seen.filter((e) => e.type === "wave-end");
  ok(ends.length >= 2, `waves end and the next begins   [${ends.length} wave ends]`);
  eq(ends[0] && [ends[0].wave, ends[0].perfect, ends[0].bonus], [1, true, 50], "clearing every CAV makes wave 1 perfect, +50");
  eq(ends[0] && ends[0].poolGained, false, "a perfect wave can't lift a full pool past 3");
  const w1 = seen.filter((e) => e.type === "active" && e.time <= ends[0].time).length;
  eq(w1, 8, "wave 1 spawns exactly its quota of 8 (then stops)");
  const starts = seen.filter((e) => e.type === "wave-start").map((e) => e.wave);
  ok(starts.includes(3), `play reaches wave 3   [waves ${starts.join(",")}]`);
  const gap = seen.find((e) => e.type === "wave-start" && e.wave === 2).time - ends[0].time;
  ok(gap >= 5 - 0.051 && gap <= 10 + 0.051, `a 5–10 s cleanup window sits between waves 1 and 2   [${gap.toFixed(2)} s]`);
  if (g.wave >= 3) eq(g.unlocked().length, 6, "wave 3 has 6 nests");
}
{
  // one hatch in wave 1, then a perfect wave 2: the pool comes back
  const g = game("clear", [T("XX", 1)]);
  let letOneGo = true, poolAfterW2 = null;
  advance(g, 400, (x) => {
    const ev = x.drain();
    ev.forEach((e) => { if (e.type === "wave-end" && e.wave === 2) poolAfterW2 = [x.pool, e.perfect, e.poolGained]; });
    inState(x, "overtime").forEach((n) => {
      if (letOneGo && x.wave === 1) return;              // let wave 1's first CAV hatch
      x.submit("RCAV " + n.unit);
    });
    if (x.stats.hatched >= 1) letOneGo = false;
  });
  eq(poolAfterW2, [3, true, true], "a perfect wave refills the pool by one (2 → 3)");
}

{
  // D4 (ruled 2026-09-17): spawning stops once the wave's quota has spawned. Longer
  // CAVs (30 s) are needed to see it: short ones clear before a 9th spawn is due.
  const g = game("clear", [T("MID", 15)]);
  let most = 0;
  advance(g, 200, (x) => {
    if (x.wave === 1) most = Math.max(most, x.spawned);
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  });
  eq(most, 8, "wave 1 never spawns more than its quota, even while CAVs are still running");
}

section("G. a full board skips the spawn");
{
  const g = game("clear", [T("LONG", 60)]);
  advance(g, 60);
  eq(inState(g, "active").length + inState(g, "overtime").length, 5, "five long CAVs fill the five nests");
  ok(g.stats.skipped > 0, `further spawns are skipped, not queued   [${g.stats.skipped} skipped]`);
  ok(g.spawned === 5, `a skipped spawn doesn't count toward the wave   [spawned ${g.spawned}]`);
}

section("H. placement (Both)");
{
  const g = game("both", [T("MB", 30), T("VS", 10)]);
  advance(g, 0.05);
  const n = inState(g, "trigger")[0];
  ok(!!n, "in Both, a spawn is a placement trigger");
  const wrong = n.type.code === "MB" ? "VS" : "MB";
  ok(!g.submit(`CAV ${n.unit} ${wrong}`).ok, "a real code that doesn't match the nest is rejected");
  ok(!g.submit(`CAV ${n.unit} XX`).ok, "a code that doesn't exist is rejected");
  eq(g.pool, 3, "rejections never touch the pool");
  const s0 = g.score;
  const r = g.submit(`CAV ${n.unit} ${n.type.code}, running late`);
  ok(r.ok && n.state === "active", "the matching CAV (with a comment) places it");
  eq(g.score - s0, 10, "placement is worth 10 points");
}
{
  const g = game("both", [T("MB", 30)]);
  advance(g, 0.05);
  const n = inState(g, "trigger")[0];
  advance(g, 19.9);
  eq(n.state, "trigger", "an ignored trigger is still waiting at 19.95 s");
  advance(g, 0.1);
  eq([n.state, g.stats.autoOpened], ["active", 1], "…and opens itself at 20 s (wave 1 timeout)");
}

section("I. modes and VF");
{
  const all = [T("VS", 10), T("VF", 10, { max: 30, twoPhaseOnly: true, hiddenUntilTrigger: true })];
  const g = game("clear", all, 11);
  const codes = new Set();
  advance(g, 300, (x) => { x.unlocked().forEach((n) => n.type && codes.add(n.type.code)); inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit)); });
  ok(!codes.has("VF") && codes.has("VS"), `Clear CAVs Only never spawns VF   [${[...codes].join(",")}]`);

  const b = game("both", all, 3);
  let vf = null;
  advance(b, 200, (x) => {
    inState(x, "trigger").forEach((n) => x.submit(`CAV ${n.unit} ${n.type.code}`));
    const a = x.snapshot().nests.find((n) => n.code === "VF" && n.state === "active");
    if (a && !vf) vf = a;
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  });
  ok(!!vf, "Both does spawn VF");
  ok(vf && vf.hidden === true, "a running VF nest reports itself hidden until its trigger");

  const p = game("progression", all, 5);
  let trig = 0;
  advance(p, 60, (x) => { trig += x.drain().filter((e) => e.type === "trigger").length; inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit)); });
  eq([p.wave <= 2, trig], [true, 0], "Follow Progression wave 1 has no placement triggers");
}

section("J. units");
{
  const g = game("clear", [T("LONG", 60)]);
  let clash = false;
  advance(g, 60, (x) => {
    const busy = x.unlocked().filter((n) => n.state !== "idle").map((n) => n.unit);
    if (new Set(busy).size !== busy.length) clash = true;
  });
  ok(!clash, "no two busy nests ever show the same unit");
  ok(g.unlocked().every((n) => n.state === "idle" || units.includes(n.unit)), "every unit on the board is a real transport unit");
}
{
  // D2 (ruled 2026-09-17): a new random unit per CAV, never one already showing on the board.
  // Short CAVs, every one placed and cleared, over many waves: units keep turning over as nests reach 12.
  const g = game("both", [T("VS", 10)], 21);
  const SHOWING = ["trigger", "active", "overtime"];
  const lastUnit = {};
  let clash = false, cavs = 0, changed = 0;
  advance(g, 1500, (x) => {
    x.drain().forEach((e) => {
      if (e.type !== "trigger") return;
      const u = x.nests[e.nest].unit;
      if (e.nest in lastUnit) { cavs++; if (lastUnit[e.nest] !== u) changed++; }
      lastUnit[e.nest] = u;
    });
    const showing = x.unlocked().filter((n) => SHOWING.includes(n.state)).map((n) => n.unit);
    if (new Set(showing).size !== showing.length) clash = true;
    inState(x, "trigger").forEach((n) => x.submit(`CAV ${n.unit} ${n.type.code}`));
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  });
  ok(g.unlocked().length === 12 && cavs > 100, `a long game reaches 12 nests with plenty of repeat CAVs   [${g.unlocked().length} nests, ${cavs} repeat CAVs, wave ${g.wave}]`);
  ok(!clash, "D2: a unit already showing on the board is never drawn again, all game");
  ok(changed > cavs * 0.9, `D2: a nest's next CAV brings a new unit   [${changed} of ${cavs} changed]`);
}

section("K. adjacency");
{
  const g = game("clear", [T("VS", 10)]);
  const ids = (n) => g.neighborsOf(n).map((x) => x.id).sort((a, b) => a - b);
  eq(ids(g.nests[5]), [1, 6, 9], "wave 1 centre nest 5: neighbours 1, 6, 9 (4 is still locked)");
  eq(ids(g.nests[2]), [1, 6], "nest 2: neighbours 1 and 6 (3 locked)");
  eq(g.unlocked().map((n) => n.id).sort((a, b) => a - b), [1, 2, 5, 6, 9], "wave 1 unlocks one compact cluster");
}

section("N. Refinement 2 (2026-09-22): the fried egg shows the timing");
eq([0, 0.3, 0.34, 0.6, 0.67, 0.99, 1].map((t) => R.clearThird(t * 6, 6)), [0, 0, 1, 1, 2, 2, 2], "overtime in thirds: sunny-side-up, broken yolk, burnt");
eq(ET.CONFIG.panSeconds < 0.5, true, "the pan's slam is under 0.5 s");
{
  // A clear reports its third, and an early clear is the high-points one.
  const g = game("clear", [T("VS", 10)]);
  advance(g, 0.05);
  const n = inState(g, "active")[0];
  advance(g, 20);
  g.drain();
  const r = g.submit("RCAV " + n.unit);
  const e = g.drain().find((x) => x.type === "cleared");
  ok(r.ok && e && e.third === 0 && e.points >= 90, `an RCAV right at the bold is the early third, near 100   [third ${e && e.third}, ${e && e.points} pts]`);
}
{
  const g = game("clear", [T("VS", 10)]);
  advance(g, 0.05);
  const n = inState(g, "active")[0];
  advance(g, 20);
  advance(g, (n.hatchAt - g.time) - 0.1);
  g.drain();
  const r = g.submit("RCAV " + n.unit);
  const e = g.drain().find((x) => x.type === "cleared");
  ok(r.ok && e && e.third === 2 && e.points <= 35, `an RCAV just before the hatch is the last third, near 25   [third ${e && e.third}, ${e && e.points} pts]`);
}

section("M. the Timer Refinement (2026-09-22): two clocks, speed, the wall clock, AD notes");
{
  const g = new ET.Game({ mode: "clear", types: [T("VS", 10)], units, rng: ET.seededRandom(7), wallStart: 14 * 3600 });
  g.start();
  advance(g, 2);
  eq(Math.round(g.clock), 60, "the clocks run 1 displayed minute per 2 s in wave 1");
  eq(Math.round(g.wall()), 14 * 3600 + 60, "the wall clock starts where it's told and runs at the same speed");
  const n = inState(g, "active")[0];
  const el = g.snapshot().nests.find((x) => x.id === n.id).elapsed;
  ok(Math.abs(el - (g.time - n.startedAt) * 30) < 1e-6, `a nest clock shows displayed seconds, at the same speed   [${el.toFixed(1)} after ${(g.time - n.startedAt).toFixed(2)} s]`);
}
{
  const g = new ET.Game({ mode: "clear", types: [T("VS", 10)], units, rng: ET.seededRandom(7), wallStart: 86400 - 30 });
  g.start();
  advance(g, 2);
  ok(g.wall() >= 0 && g.wall() < 60, `the wall clock wraps past midnight   [${g.wall().toFixed(1)}]`);
}
{
  // Every clock shares one speed: at wave 20 a VS bolds in 10 s, and its overtime is still player seconds.
  const g = game("clear", [T("VS", 10)]);
  g.startWave(20);
  advance(g, 0.05);
  const n = inState(g, "active")[0];
  const t0 = n.startedAt;
  advance(g, 9.9);
  eq(n.state, "active", "wave 20 (2×): still regular weight just before 10 s");
  advance(g, 0.1);
  eq(n.state, "overtime", "…bold by 10 s: 10:00 in 10 real seconds");
  const ot = n.hatchAt - n.boldAt;
  ok(ot >= 4.05 - 1e-9 && ot <= 4.95 + 1e-9, `…and its overtime is 4.5 s ±10% of player time, speed or no speed   [${ot.toFixed(2)} s]`);
  ok(Math.abs(n.boldAt - (t0 + 10)) < 1e-6, `overtime counts from the instant the clock crossed the mark   [bold at +${(n.boldAt - t0).toFixed(4)} s]`);
}
{
  // The nest clock keeps counting through overtime.
  const g = game("clear", [T("VS", 10)]);
  advance(g, 0.05);
  const n = inState(g, "active")[0];
  advance(g, 22);
  const e = g.snapshot().nests.find((x) => x.id === n.id);
  ok(e.state === "overtime" && e.elapsed > 600, `a bold nest clock keeps counting past 10:00   [${Math.floor(e.elapsed / 60)}:${String(Math.floor(e.elapsed % 60)).padStart(2, "0")}]`);
}
{
  // Speed changes at wave start; the step lands on the even waves.
  const g = game("clear", [T("XX", 1)]);
  const speeds = {};
  advance(g, 400, (x) => {
    x.drain().forEach((e) => { if (e.type === "wave-start") speeds[e.wave] = e.speed; });
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  });
  eq([1, 2, 3, 4].map((w) => speeds[w]), [1, 1.1, 1.1, 1.2], "each wave starts at its own speed (W1 1.0, W2 1.1, W3 1.1, W4 1.2)");
}
{
  // AD post-its: every AD gets one, both kinds turn up, and each goes bold exactly where it says.
  const AD = { code: "AD", meaning: "AD", min: 10, max: 30, twoPhaseOnly: false, hiddenUntilTrigger: false };
  const g = new ET.Game({ mode: "clear", types: [AD, T("VS", 10)], units, rng: ET.seededRandom(9), wallStart: 9 * 3600 + 17 * 60 + 40 });
  g.start();
  const seen = { clock: 0, duration: 0 };
  let adWithout = 0, vsWith = 0, checked = 0;
  const wrongBold = [];
  const pending = new Map();
  advance(g, 900, (x) => {
    x.unlocked().forEach((n) => {
      if (n.state === "active" && !pending.has(n)) {
        if (n.type.code === "VS") { if (n.note) vsWith++; return; }
        if (!n.note) { adWithout++; return; }
        seen[n.note.kind]++;
        pending.set(n, { note: n.note, startClock: n.startedClock });
      }
      if (n.state === "overtime" && pending.has(n)) {
        const p = pending.get(n);
        const boldNest = n.boldClock - p.startClock;
        if (p.note.kind === "duration" && boldNest !== p.note.minutes * 60) wrongBold.push("dur " + boldNest);
        if (p.note.kind === "clock") {
          const at = (x.wallStart + n.boldClock) % 86400;
          const run = boldNest / 60;
          if (at !== p.note.at || at % 60 !== 0 || run < p.note.minutes || run >= p.note.minutes + 1) wrongBold.push("clock " + at + " " + run.toFixed(2));
        }
        checked++;
        pending.delete(n);
      }
      if (n.state !== "active" && n.state !== "overtime") pending.delete(n);
    });
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  });
  eq([adWithout, vsWith], [0, 0], "every AD shows a post-it, and no other type does");
  ok(seen.clock > 5 && seen.duration > 5, `both kinds of note turn up   [${seen.clock} "Clear @", ${seen.duration} "min"]`);
  ok(checked > 10 && wrongBold.length === 0, `each note goes bold where it says: "N min" at N:00 on the nest clock, "Clear @ HH:MM" when the wall clock reads it   [${checked} checked${wrongBold.length ? "; " + wrongBold.slice(0, 3).join(", ") : ""}]`);
}
{
  // E1 (ruled 2026-09-22): round UP. A start at 14:15:40 with a draw of 20 → "Clear @ 14:36", 20:20 later.
  const AD = { code: "AD", meaning: "AD", min: 10, max: 30, twoPhaseOnly: false, hiddenUntilTrigger: false };
  const g = new ET.Game({ mode: "clear", types: [AD], units, wallStart: 14 * 3600 + 15 * 60 + 40 });
  const seq = [0.5, 0.1];                     // minutes → 20, then the clock-time kind
  g.rng = () => seq.shift();
  const n = g.nests[5];
  n.type = AD;
  g.activate(n, "auto");
  eq([n.note.kind, n.note.minutes, n.note.at, n.boldClock - n.startedClock], ["clock", 20, 14 * 3600 + 36 * 60, 20 * 60 + 20], "E1: 14:15:40 + 20 min reads \"Clear @ 14:36\" and bolds 20:20 later, never before the draw");
}
{
  // Skipped spawns are logged per wave (Refinement §9).
  const g = game("clear", [T("LONG", 60)]);
  advance(g, 60);
  ok(g.stats.skipped > 0 && g.stats.skippedByWave[1] === g.stats.skipped, `skipped spawns are counted against the wave they fell in   [W1 ${g.stats.skippedByWave[1]} of ${g.stats.skipped}]`);
}

section("L. the build questions' switches match the rulings (Draft 9, 2026-09-17; D5 superseded 2026-09-22)");
eq([ET.CONFIG.unitAssignment, ET.CONFIG.stopSpawningAtQuota, ET.CONFIG.keepTextOnReject, ET.CONFIG.vfHides, "timerDisplay" in ET.CONFIG],
  ["per-spawn", true, false, "timer", false], "D2 per spawn · D4 stop at quota · D6 superseded: a rejected Enter clears the box · C15(b) timer only · D5's switch is gone");
eq([ET.CONFIG.hoseWhen, ET.CONFIG.errorOnEmpty], ["cleanup", false], "⏳ Refinement 2 gaps: hose during cleanup only, no ERROR on an empty Enter (provisional, flagged to Chat)");
eq([ET.CONFIG.adClockTarget, ET.CONFIG.adNoteFrom], ["full-minutes", "start"], "E1 round up · E2 note at the start (ruled 2026-09-22)");
eq(ET.CONFIG.devModePasswordHash, null, "⏳ D3: no phrase set yet, so Developer Mode denies every entry");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFAILED:\n  " + fails.join("\n  "));
  process.exit(1);
}
