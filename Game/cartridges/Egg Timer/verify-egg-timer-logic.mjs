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
eq([1, 2, 6, 7].map((w) => Math.round(R.jitterForWave(w) * 100)), [10, 15, 35, 35], "overtime jitter: ±10%, +5% per wave, cap ±35% from wave 6");
eq([1, 2, 3, 4, 13, 14].map((w) => Math.round(R.placementChance(w) * 100)), [0, 0, 0, 10, 100, 100], "Follow Progression: 0 in waves 1–3, 10% at wave 4, 100% at wave 13");
eq([0, 2.5, 5, 9].map((x) => R.clearPoints(x, 5)), [100, 63, 25, 25], "clear points: 100 at bold, linear to 25 at the hatch");
eq([1, 5, 10].map(R.perfectWaveBonus), [50, 250, 500], "perfect wave bonus: 50 × wave");
eq(R.baseDurationFor({ min: 10, max: 10 }, () => 0.5), 20, "VS: 10 real minutes = 20 game-seconds");
eq(R.baseDurationFor({ min: 30, max: 30 }, () => 0.5), 60, "MB: 30 real minutes = 60 game-seconds");
eq([R.baseDurationFor({ min: 10, max: 30 }, () => 0), R.baseDurationFor({ min: 10, max: 30 }, () => 0.999999)].map(Math.round), [20, 60], "AD/VF: random 10–30 min = 20–60 game-seconds");
{
  const ot = [0, 0.5, 0.999999].map((u) => R.overtimeFor(1, () => u));
  eq(ot.map((x) => Math.round(x * 100) / 100), [4.5, 5, 5.5], "overtime wave 1: 5 s ±10%");
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

section("L. the build questions' switches match the rulings (Draft 9, 2026-09-17)");
eq([ET.CONFIG.unitAssignment, ET.CONFIG.stopSpawningAtQuota, ET.CONFIG.timerDisplay, ET.CONFIG.keepTextOnReject, ET.CONFIG.vfHides],
  ["per-spawn", true, "game", true, "timer"], "D2 per spawn · D4 stop at quota · D5 game seconds · D6 text stays · C15(b) timer only");
eq(ET.CONFIG.devModePasswordHash, null, "⏳ D3: no phrase set yet, so Developer Mode denies every entry");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFAILED:\n  " + fails.join("\n  "));
  process.exit(1);
}
