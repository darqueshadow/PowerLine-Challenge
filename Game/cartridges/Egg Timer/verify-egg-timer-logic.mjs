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
const LAY = ET.CONFIG.layDrop + ET.CONFIG.layPop;   // Refinement 3 §7: a CAV's clock starts when the egg is laid

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
eq(units.length, 54, "54 transport units from the shared Data Sheet");
ok(units.every((u) => /^\d{4}$/.test(u)), "every unit is four digits");
{
  // Andrew, 2026-09-24: the unit column is found by its header, and a unit list the game can't use refuses to start
  const twelve = Array.from({ length: 12 }, (_, i) => String(2101 + i));
  const sheet = (head, list) => [head, ...list].join("\r\n");
  const refuse = (text) => { try { ET.data.parseUnits(text); return null; } catch (e) { return { sheet: e.sheet, message: e.message }; } };
  eq(ET.data.parseUnits(sheet("Station,Units,Notes", twelve.map((u) => `St ${u},${u},x`))), twelve, "the unit column is read by its \"Units\" header, wherever it sits");
  eq(ET.data.parseUnits(sheet("units", twelve)).length, 12, "…in any case, and twelve different units (one per nest) are enough");
  const noCol = refuse(sheet("Unit Number,Station", twelve.map((u) => `${u},St`)));
  ok(!!noCol && noCol.sheet === "units" && /no "Units" column/.test(noCol.message), `a sheet with no "Units" column refuses to start, and says so   [${noCol && noCol.message}]`);
  const empty = refuse(""), headOnly = refuse("Units\r\n"), junk = refuse(sheet("Units", ["21O1", "abcd", "210"]));
  ok(!!empty && /is empty/.test(empty.message), `an empty sheet refuses to start   [${empty && empty.message}]`);
  ok(!!headOnly && !!junk && [headOnly, junk].every((x) => x.sheet === "units" && /no four-digit unit numbers/.test(x.message)), `a sheet with no four-digit unit in it refuses to start   [${headOnly && headOnly.message}]`);
  const short = refuse(sheet("Units", twelve.slice(0, 11).concat(["2101"])));
  ok(!!short && /only 11 different units; the game needs at least 12/.test(short.message), `eleven different units (one doubled to make twelve rows) refuse to start: D2 needs one per nest   [${short && short.message}]`);
  const types = (() => { try { ET.data.parseTypes("code,meaning\r\nVS,Vehicle Service"); return null; } catch (e) { return { sheet: e.sheet, message: e.message }; } })();
  ok(!!types && types.sheet === "types" && /no "min_minutes" column/.test(types.message), `a CAV type table missing a column says which one   [${types && types.message}]`);
}

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
  advance(g, 0.05 + LAY);
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
  ok(r.ok && n.state === "laying", "the matching CAV (with a comment) places it (the egg is laid first)");
  eq(g.score - s0, 10, "placement is worth 10 points");
}
{
  const g = game("both", [T("MB", 30)]);
  advance(g, 0.05);
  const n = inState(g, "trigger")[0];
  advance(g, 19.9);
  eq(n.state, "trigger", "an ignored trigger is still waiting at 19.95 s");
  advance(g, 0.1);
  eq([n.state, g.stats.autoOpened], ["laying", 1], "…and opens itself at 20 s (wave 1 timeout)");
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
  const SHOWING = ["trigger", "laying", "active", "overtime"];
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

section("K. the activation order (Refinement 3 §8)");
{
  const g = game("clear", [T("VS", 10)]);
  eq("neighborsOf" in g, false, "E15 (ruled): a clear no longer targets neighbouring nests, so the game has no neighbour lookup");
  eq(g.unlocked().map((n) => n.id).sort((a, b) => a - b), [0, 3, 5, 8, 11], "wave 1 activates the four corners and a centre nest, spread across the board");
  eq(Array.from(ET.Game.UNLOCK_ORDER), [0, 3, 8, 11, 5, 6, 1, 10, 2, 9, 4, 7], "the activation order is fixed");
  eq([...new Set(ET.Game.UNLOCK_ORDER)].length, 12, "…and covers all 12 nests once");
}

section("N. Refinement 3 rulings (2026-09-23): the egg ladder");
eq([0, 0.3, 0.34, 0.6, 1].map((t) => R.isFastClear(t * 6, 6)), [true, true, false, false, false], "a fast clear lands in the first third of the overtime window [T]");
eq(ET.CONFIG.panSeconds < 0.5, true, "the pan's slam is under 0.5 s");
eq(ET.CONFIG.ladder, ["Scrambled", "Sunny-Side Up", "Over Easy", "Poached", "Eggs Benny", "Eggs Benny w/ Avocado", "Steak, Eggs & Brew!"], "the ladder's seven dishes, bottom to top");
{
  // Clear every CAV right at its bold: the streak climbs a rung a clear, then holds at the top, across waves.
  const g = game("clear", [T("VS", 10)]);
  const rungs = [], waves = new Set();
  let scoreGap = 0;
  advance(g, 400, (x) => {
    inState(x, "overtime").forEach((n) => {
      const before = x.score, into = x.time - n.boldAt, span = n.hatchAt - n.boldAt;
      x.submit("RCAV " + n.unit);
      scoreGap = Math.max(scoreGap, Math.abs(x.score - before - R.clearPoints(into, span)));
    });
    x.drain().forEach((e) => { if (e.type === "cleared") { rungs.push(e.rung); waves.add(x.wave); } });
  });
  eq(rungs.slice(0, 9), [0, 1, 2, 3, 4, 5, 6, 6, 6], "consecutive fast clears climb the ladder, one dish a rung, and stay at the top");
  ok(waves.size >= 2 && rungs.every((r, i) => r === Math.min(i, 6)), `the streak carries across waves   [${rungs.length} fast clears over ${waves.size} waves]`);
  eq(scoreGap, 0, "the ladder is cosmetic: every clear scores exactly as before");
}
{
  // What drops it to the bottom: a slow clear, any ERROR, a hatch. `climb` clears k CAVs fast, then stops.
  const climb = (g, k) => {
    let done = 0;
    for (let i = 0; i < 4000 && done < k; i++) {
      g.step(0.05);
      inState(g, "overtime").forEach((n) => { if (done < k && g.submit("RCAV " + n.unit).ok) done++; });
    }
    g.drain();
    return g;
  };
  eq(climb(game("clear", [T("VS", 10)]), 3).streak, 3, "three fast clears: the streak is 3");
  {
    const g = climb(game("clear", [T("VS", 10)]), 2);
    let e = null;
    for (let i = 0; i < 4000 && !e; i++) {
      g.step(0.05);
      const late = inState(g, "overtime").find((y) => g.time - y.boldAt > 0.5 * (y.hatchAt - y.boldAt));
      if (late) { g.drain(); g.submit("RCAV " + late.unit); e = g.drain().find((x) => x.type === "cleared"); }
    }
    eq([e && e.fast, e && e.rung, g.streak], [false, -1, 0], "a slow clear shows no dish and drops the streak to the bottom");
  }
  {
    const g = climb(game("clear", [T("VS", 10)]), 2);
    g.submit("RCAV 0000");
    eq(g.streak, 0, "any ERROR drops it to the bottom");
  }
  {
    const g = climb(game("clear", [T("VS", 10)]), 2);
    for (let i = 0; i < 4000 && !g.stats.hatched; i++) g.step(0.05);
    ok(g.stats.hatched > 0 && g.streak === 0, "a hatch drops it to the bottom");
  }
  eq(game("clear", [T("VS", 10)]).streak, 0, "a new game starts at the bottom");
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
  advance(g, 0.05 + LAY);
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
  advance(g, 0.05 + LAY);
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
        if (p.note.kind === "duration" && Math.abs(boldNest - p.note.minutes * 60) > 1e-6) wrongBold.push("dur " + boldNest);
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
  g.pop(n);
  eq([n.note.kind, n.note.minutes, n.note.at, n.boldClock - n.startedClock], ["clock", 20, 14 * 3600 + 36 * 60, 20 * 60 + 20], "E1: 14:15:40 + 20 min reads \"Clear @ 14:36\" and bolds 20:20 later, never before the draw");
}
{
  // Midnight (Andrew, 2026-09-24): the same rule across the date line. A start at 23:59:30 with a draw of 20 →
  // "Clear @ 00:20", 20:30 later, never before the draw.
  const AD = { code: "AD", meaning: "AD", min: 10, max: 30, twoPhaseOnly: false, hiddenUntilTrigger: false };
  const g = new ET.Game({ mode: "clear", types: [AD], units, wallStart: 23 * 3600 + 59 * 60 + 30 });
  const seq = [0.5, 0.1];                     // minutes → 20, then the clock-time kind
  g.rng = () => seq.shift();
  const n = g.nests[5];
  n.type = AD;
  g.activate(n, "auto");
  g.pop(n);
  eq([n.note.kind, n.note.minutes, n.note.at, n.boldClock - n.startedClock], ["clock", 20, 20 * 60, 20 * 60 + 30], "midnight: 23:59:30 + 20 min reads \"Clear @ 00:20\" and bolds 20:30 later, never before the draw");
}
{
  // …and played out: an AD that spawns on the first step (0.05 s), pops 1.4 s later at 23:58:43.5 and draws 19 minutes
  // reads "Clear @ 00:18", and goes bold on the step the wall clock passes 00:18:00. A random source fixed at 0.45
  // draws 19 minutes and the clock note every time.
  const AD = { code: "AD", meaning: "AD", min: 10, max: 30, twoPhaseOnly: false, hiddenUntilTrigger: false };
  const g = new ET.Game({ mode: "clear", types: [AD], units, rng: () => 0.45, wallStart: 23 * 3600 + 58 * 60 });
  g.start();
  // copied as they happen: once the egg hatches its nest is reset, note and all
  let first = null, rec = null, boldWall = null;
  advance(g, 60, (x) => {
    if (!first) {
      first = x.unlocked().find((m) => m.state === "active" && m.note) || null;
      if (first) rec = { startedWall: (x.wallStart + first.startedClock) % 86400, note: { ...first.note }, boldMark: (x.wallStart + first.boldClock) % 86400 };
    }
    if (first && boldWall === null && first.state === "overtime") boldWall = x.wall();
  });
  ok(!!rec && Math.abs(rec.startedWall - (23 * 3600 + 58 * 60 + 43.5)) < 1e-6 && rec.note.kind === "clock" && rec.note.minutes === 19 && rec.note.at === 18 * 60,
    `midnight, played out: an AD popping at 23:58:43.5 with 19 minutes reads "Clear @ 00:18"   [${rec && JSON.stringify(rec.note)}, popped ${rec && rec.startedWall.toFixed(1)} s past midnight the day before]`);
  ok(!!rec && boldWall !== null && boldWall >= 18 * 60 && boldWall < 18 * 60 + 1.5 && Math.abs(rec.boldMark - 18 * 60) < 1e-6,
    `…and goes bold on the step the wall clock passes 00:18:00, on the far side of midnight   [wall ${boldWall && boldWall.toFixed(2)} s past midnight]`);
}
{
  // Skipped spawns are logged per wave (Refinement §9).
  const g = game("clear", [T("LONG", 60)]);
  advance(g, 60);
  ok(g.stats.skipped > 0 && g.stats.skippedByWave[1] === g.stats.skipped, `skipped spawns are counted against the wave they fell in   [W1 ${g.stats.skippedByWave[1]} of ${g.stats.skipped}]`);
}

section("O. Refinement 3 §4: Time Warp");
{
  // MB (30 min, 60 s at base speed): long enough that wave 1 has spawned all 8 while some still run.
  const g = game("clear", [T("MB", 30)]);
  let warpedBeforeLast = false, warpWithBold = false, sawWarp = false, sawAfter = false;
  const bolds = [];
  const ot = [];
  let prev = null;
  advance(g, 400, (x) => {
    if (x.wave !== 1) return;
    const w = x.warping();
    if (w && x.spawned < x.quota) warpedBeforeLast = true;
    if (w && x.unlocked().some((n) => n.state === "overtime")) warpWithBold = true;
    if (w) sawWarp = true;
    x.drain().forEach((e) => { if (e.type === "bold") { const n = x.nests[e.nest]; bolds.push(x.clock - n.boldClock - (x.time - n.boldAt) * x.rate); ot.push(n.hatchAt - n.boldAt); } });
    if (prev && prev.warp && !w) sawAfter = true;
    prev = { warp: w };
    inState(x, "overtime").forEach((n) => { if (x.time - n.boldAt > 1) x.submit("RCAV " + n.unit); });
  });
  ok(sawWarp, "the clocks warp once the wave's last egg has spawned and none is bold");
  ok(!warpedBeforeLast, "…never before the last egg of the wave has spawned");
  ok(!warpWithBold, "…and never while an egg is bold");
  ok(sawAfter, "an egg going bold ends the warp (it comes back after the clear)");
  ok(bolds.length >= 8 && bolds.every((d) => Math.abs(d) < 1e-6), `the warp stops on the exact instant an egg goes bold (the clock runs normally from there)   [${bolds.length} bolds, worst ${Math.max(...bolds.map(Math.abs)).toExponential(1)}]`);
  ok(ot.every((x) => x >= 5.4 - 1e-9 && x <= 6.6 + 1e-9), "the overtime window stays 6 s ±10% of the player's seconds");
}
{
  // The rate: 5× the wave's speed, for the nest clocks and the wall clock alike.
  const g = game("clear", [T("MB", 30)]);
  g.spawned = g.quota;                         // as if the last egg has spawned
  const n = g.nests[0];
  n.type = T("MB", 30); n.unit = "2101";
  g.activate(n, "auto");
  advance(g, 0.05);                            // …through the lay, if there is one
  while (n.state !== "active") advance(g, 0.05);
  const c0 = g.clock, w0 = g.wall(), t0 = g.time;
  advance(g, 1);
  eq([g.warping(), Math.round((g.clock - c0) / (g.time - t0)), Math.round((g.wall() - w0) / (g.time - t0))], [true, 150, 150], "under Time Warp every clock runs 5× the wave's speed (150 displayed s a second in wave 1)");
  eq(g.snapshot().warp, true, "the snapshot says so, for the panel");
  eq(ET.CONFIG.warpFactor, 5, "the warp factor is 5 [T]");
}

section("Q. Refinement 3 §7: egg-laying");
{
  const g = game("clear", [T("VS", 10)]);
  const ev = [];
  advance(g, 0.05, (x) => ev.push(...x.drain()));
  const n = inState(g, "laying")[0];
  ok(!!n && ev.some((e) => e.type === "laying" && e.nest === n.id && e.how === "auto"), "a new CAV starts with its egg being laid (auto-spawn)");
  advance(g, 0.2);
  const sn = g.snapshot().nests.find((x) => x.id === n.id);
  ok(sn.lay > 0 && sn.lay < 1 && sn.elapsed === 0, `…with no clock running yet   [lay ${sn.lay.toFixed(2)}]`);
  ok(!g.submit("RCAV " + n.unit).ok, "RCAV does nothing while the egg is being laid");
  advance(g, n.layAt + LAY - g.time - 0.05, (x) => ev.push(...x.drain()));
  eq(n.state, "laying", `…still laying just before ${LAY.toFixed(1)} s (drop ${ET.CONFIG.layDrop} s + pop ${ET.CONFIG.layPop} s)`);
  advance(g, 0.1, (x) => ev.push(...x.drain()));
  eq(n.state, "active", "…and the pop starts the CAV");
  ok(Math.abs(n.startedAt - (n.layAt + LAY)) < 1e-9, `the clock starts exactly at the pop, ${LAY.toFixed(1)} s after the lay began   [${(n.startedAt - n.layAt).toFixed(4)} s]`);
  const r0 = g.snapshot().nests.find((x) => x.id === n.id).retract;
  ok(r0 !== null && r0 < 1, "the cord snakes back up while the clock runs");
  advance(g, ET.CONFIG.layRetract);
  eq(g.snapshot().nests.find((x) => x.id === n.id).retract, null, "…and is gone once it's up");
  advance(g, n.startedAt + 20 - g.time - 0.05);
  eq(n.state, "active", "the CAV's full duration still counts from the pop");
  advance(g, 0.1);
  eq(n.state, "overtime", "…bold 20 s after the pop");
}
{
  const g = game("both", [T("VS", 10)]);
  advance(g, 0.05);
  const n = inState(g, "trigger")[0];
  g.drain();
  g.submit(`CAV ${n.unit} VS`);
  ok(n.state === "laying" && g.drain().some((e) => e.type === "laying" && e.how === "placed"), "a placed CAV lays its egg too");
  const m = inState(g, "trigger")[0] || null;
  const b = game("both", [T("VS", 10)]);
  advance(b, 0.05);
  const t = inState(b, "trigger")[0];
  b.drain();
  advance(b, 20);
  ok(["laying", "active"].includes(t.state) && b.drain().some((e) => e.type === "laying" && e.how === "auto-open"), "…and so does an auto-opened one");
}
{
  const VF = T("VF", 10, { max: 30, twoPhaseOnly: true, hiddenUntilTrigger: true });
  const g = game("both", [VF]);
  advance(g, 0.05);
  const n = inState(g, "trigger")[0];
  g.submit(`CAV ${n.unit} VF`);
  eq(g.snapshot().nests.find((x) => x.id === n.id).hidden, true, "⏳ E16: a VF being laid reports itself hidden (no egg to show until its trigger)");
}

section("R. E18 (ruled): no Time Warp while a placement trigger is still waiting");
{
  // Both: every spawn is a trigger. Place all but the wave's last one and let it wait.
  const g = game("both", [T("VS", 10)]);
  let warpedWithTrigger = false, sawLastWaiting = false, warpAfter = false;
  for (let i = 0; i < 20000 && g.wave === 1; i++) {
    g.step(0.05);
    const trig = inState(g, "trigger");
    trig.forEach((n) => { if (g.spawned < g.quota) g.submit(`CAV ${n.unit} VS`); });
    if (g.spawned >= g.quota && inState(g, "trigger").length) { sawLastWaiting = true; if (g.warping()) warpedWithTrigger = true; }
    if (g.spawned >= g.quota && !inState(g, "trigger").length && g.warping()) warpAfter = true;
    inState(g, "overtime").forEach((n) => g.submit("RCAV " + n.unit));
  }
  ok(sawLastWaiting, "the wave's last spawn sat waiting to be placed");
  ok(!warpedWithTrigger, "…and the clocks never warped while it waited");
  ok(warpAfter, "once it started (here it auto-opened), the warp came on");
}

section("S. Refinement 4 §3: no duplicate units, no repeats within a wave");
{
  // A long game of short CAVs in Both (triggers wait on the board too), watching every spawn.
  const g = game("both", [T("VS", 10)], 33);
  const distinct = new Set(units).size;
  eq([units.length, distinct, g.units.length], [54, 54, 54], "the Data Sheet's 54 rows are 54 distinct units (the five doubles removed 2026-09-23); the pool is the 54");
  let dupOnBoard = false, repeatBeforeRefill = 0, spawnsChecked = 0;
  let seen = new Set(), wave = 1;
  for (let i = 0; i < 40000 && g.phase !== "over"; i++) {
    g.step(0.05);
    if (g.wave !== wave) { wave = g.wave; seen = new Set(); }
    g.drain().forEach((e) => {
      if (e.type !== "trigger") return;
      const u = g.nests[e.nest].unit;
      spawnsChecked++;
      if (seen.has(u) && seen.size < distinct) repeatBeforeRefill++;
      if (seen.size >= distinct) seen = new Set();
      seen.add(u);
    });
    const showing = g.unlocked().filter((n) => n.state !== "idle").map((n) => n.unit);
    if (new Set(showing).size !== showing.length) dupOnBoard = true;
    inState(g, "trigger").forEach((n) => { if (i % 3 === 0) g.submit(`CAV ${n.unit} VS`); });
    inState(g, "overtime").forEach((n) => g.submit("RCAV " + n.unit));
  }
  ok(spawnsChecked > 300, `a long game   [${spawnsChecked} CAVs over ${g.wave} waves]`);
  ok(!dupOnBoard, "a unit is never on two nests at once, waiting triggers included");
  eq(repeatBeforeRefill, 0, "within a wave, no unit repeats until all 54 have been used");
}
{
  // Force the refill: a wave's quota bigger than the pool (5 units, quota 8).
  const g = new ET.Game({ mode: "clear", types: [T("XX", 1)], units: ["1001", "1002", "1003", "1004", "1005"], rng: ET.seededRandom(3) });
  g.start();
  const drawn = [];
  let dup = false;
  for (let i = 0; i < 4000 && g.wave === 1; i++) {
    g.step(0.05);
    g.drain().forEach((e) => { if (e.type === "laying") drawn.push(g.nests[e.nest].unit); });
    const showing = g.unlocked().filter((n) => n.state !== "idle").map((n) => n.unit);
    if (new Set(showing).size !== showing.length) dup = true;
    inState(g, "overtime").forEach((n) => g.submit("RCAV " + n.unit));
  }
  eq(new Set(drawn.slice(0, 5)).size, 5, "the first five draws use the whole (five-unit) pool before any repeats");
  ok(drawn.length >= 8 && !dup, `then it refills, still never doubling a unit on the board   [${drawn.join(" ")}]`);
}

section("U. Refinement 4 §4: an even CAV-type mix from a shuffle bag");
{
  const real = types;   // the seven real types, from the CSV
  const run = (mode, seed, waves) => {
    const g = new ET.Game({ mode, types: real, units, rng: ET.seededRandom(seed) });
    g.start();
    const byWave = {};
    for (let i = 0; i < 60000 && g.phase !== "over" && g.wave <= waves; i++) {
      g.step(0.05);
      g.drain().forEach((e) => {
        if (e.type !== "trigger" && !(e.type === "laying" && e.how === "auto")) return;
        (byWave[g.wave] = byWave[g.wave] || []).push({ code: g.nests[e.nest].type.code, placing: e.type === "trigger" });
      });
      inState(g, "trigger").forEach((n) => g.submit(`CAV ${n.unit} ${n.type.code}`));
      inState(g, "overtime").forEach((n) => g.submit("RCAV " + n.unit));
    }
    return byWave;
  };
  const chunks = (list, k) => { const out = []; for (let i = 0; i + k <= list.length; i += k) out.push(list.slice(i, i + k)); return out; };
  const both = run("both", 4, 4);
  const bothOk = Object.values(both).every((w) => chunks(w.map((x) => x.code), 7).every((c) => new Set(c).size === 7));
  ok(bothOk && Object.keys(both).length >= 4, `Both: each wave's spawns come seven at a time, every type once per seven   [waves ${Object.keys(both).join(",")}]`);
  const clear = run("clear", 5, 4);
  const clearCodes = Object.values(clear).flat().map((x) => x.code);
  ok(!clearCodes.includes("VF") && Object.values(clear).every((w) => chunks(w.map((x) => x.code), 6).every((c) => new Set(c).size === 6)),
    "Clear CAVs Only: the bag holds the six types it can use, each once per six, never VF");
  const prog = run("progression", 6, 9);
  const vfAuto = Object.values(prog).flat().filter((x) => x.code === "VF" && !x.placing).length;
  const vfAny = Object.values(prog).flat().filter((x) => x.code === "VF").length;
  ok(vfAuto === 0 && vfAny > 0, `⏳ E19: Follow Progression gives VF only to a spawn that needs placing   [${vfAny} VF, all placed]`);
  const w1 = both[1].map((x) => x.code);
  ok(new Set(w1.slice(0, 7)).size === 7, `⏳ E20: each wave starts a fresh bag   [wave 1 opens ${w1.slice(0, 7).join(" ")}]`);
}

section("L. the build questions' switches match the rulings (Draft 9, 2026-09-17; D5 superseded 2026-09-22)");
eq([ET.CONFIG.unitAssignment, ET.CONFIG.stopSpawningAtQuota, ET.CONFIG.keepTextOnReject, ET.CONFIG.vfHides, "timerDisplay" in ET.CONFIG],
  ["per-spawn", true, false, "timer", false], "D2 per spawn · D4 stop at quota · D6 superseded: a rejected Enter clears the box · C15(b) timer only · D5's switch is gone");
eq([ET.CONFIG.hoseWhen, ET.CONFIG.errorOnEmpty], ["always", false], "the hose is always the in-game cursor (Hose ruling, replacing E5) · E6 no ERROR on an empty Enter");
eq([ET.CONFIG.adClockTarget, ET.CONFIG.adNoteFrom], ["full-minutes", "start"], "E1 round up · E2 note at the start (ruled 2026-09-22)");
eq(ET.CONFIG.devModePasswordHash, null, "⏳ D3: no phrase set yet, so Developer Mode denies every entry");
eq(ET.CONFIG.muteKeyInPlay, "none", "⏳ E25: M doesn't mute while a Command Line has the keys (built provisionally; the button does)");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFAILED:\n  " + fails.join("\n  "));
  process.exit(1);
}
