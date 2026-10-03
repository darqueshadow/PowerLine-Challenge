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

eq([1, 2, 3, 4, 5, 12, 13, 30].map(R.overtimeBaseFor), [6, 6, 5.75, 5.75, 5.5, 4.75, 4.5, 4.5], "overtime: 6 s, −0.25 s every 2 waves (odd waves), floor 4.5 s at wave 13");
eq([1, 2, 3, 4, 5, 18, 20, 40].map((w) => Math.round(R.clockSpeed(w) * 100) / 100), [1, 1.1, 1.1, 1.2, 1.2, 1.9, 2, 2], "clock speed: 1.0, +10% on even waves, cap 2× at wave 20");
eq([1, 20].map(R.clockRate), [30, 60], "a displayed minute takes 2 s at base speed, 1 s at the cap (10:00 in 10 s)");
eq(["placementTimeout", "placementChance", "needsPlacement"].filter((k) => k in R), [], "E54: the placement curves (auto-open, Follow Progression) are gone with the modes");
eq(ET.CONFIG.clearScoring, "tiers", "E26 (ruled): a clear scores by tier, not the old slide");
eq([0, 0.19, 0.2, 0.39, 0.4, 0.59, 0.6, 0.79, 0.8, 0.99, 1, 1.5].map((t) => R.clearTier(t * 5, 5)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5], "E26: the tiers are fifths of the egg's own overtime window");
eq([0.1, 0.3, 0.5, 0.7, 0.9].map((t) => R.clearPoints(t * 5, 5)), [100, 75, 50, 35, 25], "E26: tier points 100 / 75 / 50 / 35 / 25");
{
  // every tier stays reachable at every wave: its share of the SHORTEST window (floor, −10% jitter) is still wide
  const shortest = R.overtimeBaseFor(40) * (1 - ET.CONFIG.overtimeJitter);
  const widths = ET.CONFIG.clearTierEnds.map((e, i) => (e - (i ? ET.CONFIG.clearTierEnds[i - 1] : 0)) * shortest);
  ok(widths.every((w) => w >= 0.8), `E26: every tier lasts at least 0.8 s, even in the shortest overtime window   [${widths.map((w) => w.toFixed(2)).join(", ")} s]`);
}
{
  const was = ET.CONFIG.clearScoring;
  ET.CONFIG.clearScoring = "slide";
  eq([0, 2.5, 5, 9].map((x) => R.clearPoints(x, 5)), [100, 63, 25, 25], "the \"slide\" switch value still slides 100 at bold, linearly to 25 at the hatch");
  eq([0, 0.3, 0.34, 0.6].map((t) => R.isFastClear(t * 6, 6)), [true, true, false, false], "…and its fast clear is still the first third");
  ET.CONFIG.clearScoring = was;
}
eq([1, 5, 10].map(R.perfectWaveBonus), [50, 250, 500], "perfect wave bonus: 50 × wave");
eq([R.minutesFor({ code: "VS", min: 10, max: 10 }, () => 0.5), R.minutesFor({ code: "MB", min: 30, max: 30 }, () => 0.5)], [10, 30], "fixed types go bold at their own minutes");

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
eq(types.filter((t) => t.code === "VS" || t.code === "STR").map((t) => [t.code, t.min, t.max]), [["VS", 10, 10], ["STR", 10, 10]], "E54: the two types in play come from Andrew's table as it is: VS 10:00 and STR 10:00");
{
  // E54: a table (or the Blank Dataset Module) without a VS or an STR row refuses to start, and says which row
  const refuse = (list, sheet) => { try { ET.data.needed(list, sheet); return null; } catch (e) { return { sheet: e.sheet, message: e.message }; } };
  const noStr = refuse(types.filter((t) => t.code !== "STR"), "types"), noVs = refuse(types.filter((t) => t.code !== "VS"), "blank");
  ok(!!noStr && noStr.sheet === "types" && /no "STR" row/.test(noStr.message), `E54: a type table with no STR row refuses to start, and says so   [${noStr && noStr.message}]`);
  ok(!!noVs && noVs.sheet === "blank" && /no "VS" row/.test(noVs.message), `E54: …and one with no VS row, naming the sheet   [${noVs && noVs.message}]`);
  eq(refuse(types, "types"), null, "…while the real table passes");
}
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
/* E54: one mode, every egg a VS. A test sets the VS's length in minutes (a stand-in, so short or long eggs can be
   played; the real one is the table's 10:00), the seed and the share of hospital eggs (0: every egg a refusal). */
function game(minutes = 10, seed = 7, hospital = 0) {
  const g = new ET.Game({ types: [T("VS", minutes), T("STR", 10)], units, rng: ET.seededRandom(seed), hospitalShare: hospital });
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
// E39's second Time Warp trigger (2+ eggs over 8:00 from bold) speeds up any test with long eggs; the tests of other
// things (spawning, bold timing) run without it, and section E39 tests it
function withoutFarWarp(fn) {
  const was = ET.CONFIG.warpFar.eggs;
  ET.CONFIG.warpFar.eggs = Infinity;
  try { fn(); } finally { ET.CONFIG.warpFar.eggs = was; }
}

section("D. one CAV, one clear (a refusal egg)");
{
  const g = game(10);
  advance(g, 0.05 + LAY);
  const n = inState(g, "active")[0];
  ok(!!n, "a CAV opens on its own at the start of wave 1");
  eq(g.unlocked().length, 5, "wave 1 has 5 nests");
  ok(!g.submit("RCAV " + n.unit).ok, "RCAV before the real duration has passed does nothing");
  eq(g.submit("RCAV " + n.unit).early, true, "…and the game calls it too early (Andrew, 2026-10-01: \"Too Early!\")");
  eq(g.submit("RCAV 0000").early, false, "…but not an RCAV for a unit that isn't running");
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
  const g = game(1);
  const over = [];
  advance(g, 120, (x) => x.events.forEach((e) => e.type === "game-over" && over.push(e)));
  eq(g.phase, "over", "never clearing anything ends the game");
  eq([g.pool, g.stats.hatched], [0, 3], "…after exactly three hatches, pool 3 → 0");
  const t = g.time;
  g.step(1);
  eq(g.time, t, "a finished game doesn't advance");
}
{
  const g = game(1);
  let hatchedAt = null;
  advance(g, 30, (x) => { if (hatchedAt === null && x.stats.hatched === 1) hatchedAt = x.pool; });
  eq(hatchedAt, 2, "one hatch costs exactly one from the pool");
}

section("E45–E47. hatchlings: cute, then mixed, then horror (Andrew, 2026-09-27)");
{
  const at = (u) => () => u;
  eq([0, 0.5, 0.99].map((u) => R.hatchSet(1, false, 0.9, at(u))), ["cute", "cute", "cute"], "E45: every wave-1 hatch is cute");
  eq([3, 4, 12].map((w) => R.hatchSet(w, true, 0, at(0.99))), ["horror", "horror", "horror"], "E45: from wave 3 on, every hatch is horror");
  eq(R.hatchSet(2, true, 0, at(0.99)), "horror", "E45: wave 2's first hatch is always horror, however early");
  eq([[0.25, 0.2], [0.25, 0.3], [0.75, 0.7], [0.75, 0.8]].map(([p, u]) => R.hatchSet(2, false, p, at(u))),
    ["horror", "cute", "horror", "cute"], "E45: later wave-2 hatches are horror with a chance equal to how far through the wave (25% a quarter in, 75% three quarters in)");
  const rng = ET.seededRandom(3), share = (p) => { let h = 0; for (let i = 0; i < 4000; i++) h += R.hatchSet(2, false, p, rng) === "horror"; return h / 4000; };
  const s = [share(0.25), share(0.75)];
  ok(Math.abs(s[0] - 0.25) < 0.03 && Math.abs(s[1] - 0.75) < 0.03, `E45: …which comes out about that often over many draws   [${s.map((x) => x.toFixed(3)).join(", ")}]`);
}
{
  // let everything hatch through waves 1–3 (the pool kept topped up so the game runs on)
  const g = new ET.Game({ types: [T("VS", 1)], units, rng: ET.seededRandom(11), hatchRng: ET.seededRandom(12) });
  g.start();
  const hatches = [], escapes = [];
  advance(g, 400, (x) => {
    x.pool = 3;
    x.drain().forEach((e) => { if (e.type === "hatch") hatches.push({ wave: x.wave, ...e }); });
    x.nests.forEach((n) => { if (n.state === "escape" && !escapes.some((q) => q.id === n.id && q.from === n.busyUntil)) escapes.push({ id: n.id, from: n.busyUntil, len: n.busyUntil - x.time }); });
    if (x.wave > 3) x.phase = "over";
  });
  const w = (k) => hatches.filter((h) => h.wave === k);
  ok(w(1).length >= 5 && w(1).every((h) => h.set === "cute"), `E45 in play: wave 1 hatches cute only   [${w(1).length} hatches]`);
  ok(w(2).length >= 5 && w(2)[0].set === "horror", `E45 in play: wave 2's first hatch is horror   [${w(2).map((h) => h.set[0]).join("")}]`);
  ok(w(2).some((h) => h.set === "cute"), "E45 in play: …and wave 2 still mixes cute in after it");
  ok(w(3).length >= 5 && w(3).every((h) => h.set === "horror"), `E45 in play: wave 3 hatches horror only   [${w(3).length} hatches]`);
  ok(hatches.every((h) => ET.CONFIG.hatchAliens[h.set].includes(h.alien)), "E45: each alien comes from its own set (crab/octopus/worm cute, Scuttler/Grabber/Wriggler horror)");
  ok(hatches.every((h, i) => !i || h.alien !== hatches[i - 1].alien), `E45: the same alien never comes out twice in a row   [${hatches.length} hatches]`);
  const firstSix = w(1).slice(0, 6).map((h) => h.alien);
  eq([new Set(firstSix.slice(0, 3)).size, new Set(firstSix.slice(3, 6)).size], [3, 3], "E45: a shuffle bag: each three cute hatches in a row are the three cute aliens");
  // Andrew, 2026-10-01 (replaces E46): every hatch scurries out and dances; a cute one then hops at the player, a horror
  // one freezes, stares and jumps at the player full screen
  ok(hatches.some((h) => h.set === "cute") && hatches.filter((h) => h.set === "cute").every((h) => h.exit === "hop"), "Andrew, 2026-10-01: a cute alien ends with a goofy hop toward the player");
  ok(hatches.some((h) => h.set === "horror") && hatches.filter((h) => h.set === "horror").every((h) => h.exit === "scare"), "…and a horror alien with the jump scare, every time");
  eq(ET.CONFIG.escapeSeconds, 3.2, "Andrew, 2026-10-01: the hatch is longer, about 3 s (E47's 2 s)");
  ok(ET.CONFIG.hatchScare.freeze < ET.CONFIG.hatchScare.leap && ET.CONFIG.hatchScare.leap < 1, "…the freeze comes before the jump, and both inside the hatch");
  ok(escapes.length && escapes.every((q) => Math.abs(q.len - ET.CONFIG.escapeSeconds) < 0.06), `in play: each escape lasts the hatch's ${ET.CONFIG.escapeSeconds} s, then the nest empties   [${escapes.length} escapes]`);
}
{
  // E45's draws have their own random source, so a seeded replay's spawns don't shift with the hatchlings
  const spawns = (h) => {
    const g = new ET.Game({ types: [T("VS", 1), T("STR", 2)], units, rng: ET.seededRandom(5), hatchRng: ET.seededRandom(h) });
    g.start();
    const out = [];
    advance(g, 200, (x) => { x.pool = 3; x.drain().forEach((e) => e.type === "active" && out.push(x.nests[e.nest].unit + x.nests[e.nest].type.code)); });
    return out.join(",");
  };
  ok(spawns(1) === spawns(2), "E45: the hatchlings' draws never shift a seeded game's spawns");
}

section("F. waves: quota, perfect bonus, cleanup, growth");
{
  const g = game(1);
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
  const g = game(1);
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
  const g = game(15);
  let most = 0;
  advance(g, 200, (x) => {
    if (x.wave === 1) most = Math.max(most, x.spawned);
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  });
  eq(most, 8, "wave 1 never spawns more than its quota, even while CAVs are still running");
}

section("G. a full board skips the spawn");
withoutFarWarp(() => {
  const g = game(60);
  advance(g, 60);
  eq(inState(g, "active").length + inState(g, "overtime").length, 5, "five long CAVs fill the five nests");
  ok(g.stats.skipped > 0, `further spawns are skipped, not queued   [${g.stats.skipped} skipped]`);
  ok(g.spawned === 5, `a skipped spawn doesn't count toward the wave   [spawned ${g.spawned}]`);
});

section("H. hospital eggs: RCAV, then CAV #### STR, in the same window (E52, E53, ruled 2026-10-02)");
/* One egg alone on the board (no more spawns, so nothing else hatches or warps the clocks), cracking: a hospital egg
   (hospital 1) or a refusal (0), in `wave`. */
function oneEgg(hospital, wave = 1) {
  const g = game(10, 7, hospital);
  if (wave !== 1) g.startWave(wave);
  advance(g, 0.05);
  g.nextSpawnAt = Infinity;
  const n = inState(g, "laying")[0];
  while (n.state !== "overtime") g.step(0.05);
  return { g, n };
}
{
  // every egg a hospital egg; the first one, alone, played through both windows
  const g = game(10, 7, 1);
  advance(g, 0.05);
  g.nextSpawnAt = Infinity;
  const n = inState(g, "laying")[0];
  ok(!!n && n.hospital && g.snapshot().nests.find((x) => x.id === n.id).hospital === true, "a hospital egg is marked as it's laid, and the snapshot says so (the H sign)");
  eq(g.submit(`CAV ${n.unit} STR`).why, "rcav-first", "E53: CAV STR while the egg is still being laid: \"RCAV first!\"");
  advance(g, LAY);
  eq([n.state, g.submit(`CAV ${n.unit} STR`).why], ["active", "rcav-first"], "E53: …and while its VS runs");
  eq(g.submit("RCAV " + n.unit).why, "early", "an RCAV before the VS's 10:00 is still \"Too Early!\"");
  while (n.state !== "overtime") g.step(0.05);
  eq(g.submit(`CAV ${n.unit} STR`).why, "rcav-first", "E53: …and once it's cracking, before the RCAV");
  eq([n.removed, n.state], [false, "overtime"], "…which leaves the VS on, the egg still cracking");
  advance(g, 1.8);                             // a little way into window 1, so its tier isn't simply the first
  const s0 = g.score, res0 = g.resolved;
  g.drain();
  const into = g.time - n.boldAt, span = n.hatchAt - n.boldAt, crackWas = g.snapshot().nests.find((x) => x.id === n.id).crack;
  const r1 = g.submit("RCAV " + n.unit);
  ok(r1.ok && r1.removed && r1.points === 0, "the RCAV is accepted: it takes the VS off, for no points yet");
  ok(Math.abs(n.hatchAt - g.time - 12) < 1e-9 && ET.CONFIG.hospitalResetSeconds === 12, `Chat (2026-10-02): the RCAV restarts the hatch countdown at 12 s (the player's seconds), not the rest of window 1   [${(n.hatchAt - g.time).toFixed(2)} s; window 1 had ${(span - into).toFixed(2)} s left]`);
  ok(Math.abs(g.snapshot().nests.find((x) => x.id === n.id).crack - crackWas) < 1e-6, "…the cracks go on from where they were (no jump back)");
  eq([n.state, n.removed, g.score - s0, g.resolved - res0], ["overtime", true, 0, 0], "…the egg keeps cracking (still bold), nothing scored or resolved");
  const sn = g.snapshot().nests.find((x) => x.id === n.id);
  eq([sn.code, sn.removed], ["", true], "E53: the readout's type box empties, asking for the STR");
  ok(g.drain().some((e) => e.type === "removed" && e.nest === n.id), "…and a \"removed\" event says so");
  eq([g.submit("RCAV " + n.unit).ok, g.submit("RCAV " + n.unit).why], [false, null], "E53: a second RCAV is ERROR (nothing to remove)");
  eq(g.submit(`CAV ${n.unit} VS`).why, null, "E53: CAV with any other type is ERROR");
  ok(n.removed && n.state === "overtime", "…and none of those undo the RCAV");
  g.streak = 4;   // as if four fast clears came before
  advance(g, 7);                               // well into the 12 s: the tier must still be the RCAV's
  const s1 = g.score;
  const r2 = g.submit(`cav ${n.unit} str, to hospital`);
  ok(r2.ok && r2.repaired, "CAV #### STR (any case, with a comment) puts the STR on");
  ok(R.clearTier(into, span) === 2 && g.score - s1 === R.clearPoints(into, span), `Chat (2026-10-02): window 1 is paid at the STR by the tier the RCAV landed in, not by the restarted 12 s   [tier ${R.clearTier(into, span)}, ${g.score - s1} points]`);
  const ev = g.drain(), rep = ev.find((e) => e.type === "repaired");
  ok(!!rep && rep.tier === R.clearTier(into, span) && rep.points === r2.points && rep.mom === "sweet", `…the "repaired" event carries the tier, the points and wave 1's sweet Mom   [tier ${rep && rep.tier}, ${rep && rep.mom}]`);
  ok(!ev.some((e) => e.type === "cleared"), "E52: no \"cleared\" event at window 1 (no pan, THONG, splat, mess or pieces)");
  eq(g.streak, 4, "E52: the egg ladder follows the final clear only: window 1 leaves the streak where it was");
  eq([n.state, n.type.code, n.removed, n.repaired, g.resolved - res0], ["active", "STR", false, true, 0], "the egg is whole again, on its STR, and not resolved yet");
  const sr = g.snapshot().nests.find((x) => x.id === n.id);
  ok(sr.code === "STR" && sr.elapsed < 1e-6 && sr.grow === 1 && sr.retract === null && sr.crack === 0, `the STR's clock starts now from 00:00, the egg stays full size, no cord, no cracks   [${sr.code} ${sr.elapsed} grow ${sr.grow}]`);
  eq(g.submit(`CAV ${n.unit} STR`).why, null, "E53: a second CAV STR is ERROR");
  eq(g.submit("RCAV " + n.unit).why, "early", "E53: RCAV during the STR's 10:00 is \"Too Early!\"");
  advance(g, 19.9);
  eq(n.state, "active", "the STR runs its own 10:00 (20 s at wave 1's speed)…");
  advance(g, 0.15);
  eq(n.state, "overtime", "…then the egg cracks again for an ordinary window");
  const s2 = g.score, into2 = g.time - n.boldAt, span2 = n.hatchAt - n.boldAt;
  g.drain();
  const r3 = g.submit("RCAV " + n.unit);
  const cl = g.drain().find((e) => e.type === "cleared");
  ok(r3.ok && n.state === "splat" && !!cl && cl.hospital === true, "the final RCAV is an ordinary clear: the splat, the mess and the pieces come now, once");
  eq([g.score - s2, g.resolved - res0, g.stats.cleared], [R.clearPoints(into2, span2), 1, 1], "E52: window 2 scores its own tier, and the egg resolves once");
}
{
  // a refusal egg: the STR is an ERROR on it
  const { g, n } = oneEgg(0);
  eq([n.hospital, g.submit(`CAV ${n.unit} STR`).why], [false, null], "E53: CAV STR on a refusal egg is ERROR");
  ok(g.submit("RCAV " + n.unit).ok && n.state === "splat", "…and one RCAV clears it, as always");
}
{
  // the window runs out between the RCAV and the STR: it hatches
  const { g, n } = oneEgg(1);
  g.submit("RCAV " + n.unit);
  while (n.state === "overtime") g.step(0.05);
  eq([n.state, g.pool, g.stats.hatched], ["escape", 2, 1], "E53: the window running out after the RCAV, before the STR: it hatches, and the pool drops");
}
{
  // …and an STR left to run out hatches like any egg
  const { g, n } = oneEgg(1);
  g.submit("RCAV " + n.unit);
  g.submit(`CAV ${n.unit} STR`);
  while (n.state !== "escape" && g.time < 200) g.step(0.05);
  eq([n.state, g.pool], ["escape", 2], "a hospital egg left uncleared on its STR hatches as any egg");
}
{
  // E55: creepy Mom from wave 2 on
  const { g, n } = oneEgg(1, 2);
  g.submit("RCAV " + n.unit);
  g.drain();
  g.submit(`CAV ${n.unit} STR`);
  eq(g.drain().find((e) => e.type === "repaired").mom, "creepy", "E55: from wave 2 the repair is creepy Mom's");
}
{
  // Chat (2026-10-02): a hospital egg waiting for its STR after the RCAV doesn't count as bold for Time Warp
  const { g, n } = oneEgg(1);
  g.spawned = g.quota;                         // as if the wave's last egg has spawned
  const before = g.warping();
  g.submit("RCAV " + n.unit);
  const waiting = g.warping(), left = n.hatchAt - g.time;
  advance(g, 2);
  eq([before, waiting, g.warping(), +(n.hatchAt - g.time).toFixed(6)], [false, true, true, +(left - 2).toFixed(6)], "Time Warp waits while the egg is bold before its RCAV, then runs while it waits for its STR; its countdown is the player's seconds, so the warp doesn't shorten it");
}
{
  // E53's window switch: a hospital egg's first window × hospitalWindowScale; the STR's window is never scaled
  const was = ET.CONFIG.hospitalWindowScale;
  ET.CONFIG.hospitalWindowScale = 1.5;
  try {
    const { g, n } = oneEgg(1);
    const w1 = n.hatchAt - n.boldAt;
    g.submit("RCAV " + n.unit);
    g.submit(`CAV ${n.unit} STR`);
    while (n.state !== "overtime") g.step(0.05);
    const w2 = n.hatchAt - n.boldAt;
    ok(w1 >= 5.4 * 1.5 - 1e-9 && w1 <= 6.6 * 1.5 + 1e-9 && w2 >= 5.4 - 1e-9 && w2 <= 6.6 + 1e-9, `the switch stretches window 1 only   [${w1.toFixed(2)} s, then ${w2.toFixed(2)} s]`);
  } finally { ET.CONFIG.hospitalWindowScale = was; }
}
{
  // a player who does both steps fast never loses an egg, over three waves of the real table and its 70%
  const g = new ET.Game({ types, units, rng: ET.seededRandom(17) });
  g.start();
  advance(g, 600, (x) => {
    inState(x, "overtime").forEach((n) => {
      if (n.hospital && !n.repaired) { if (!n.removed) x.submit("RCAV " + n.unit); x.submit(`CAV ${n.unit} STR`); }
      else x.submit("RCAV " + n.unit);
    });
    if (x.wave > 3) x.phase = "over";
  });
  // (⏳ E59: only the VS eggs can be hospital eggs now, about a fifth of what's laid)
  ok(g.stats.hatched === 0 && g.stats.repaired > 3 && g.stats.cleared > 20, `both steps in time: no hatches through wave 3   [${g.stats.repaired} repaired, ${g.stats.cleared} cleared, ${g.stats.rejected} rejected]`);
  eq(g.stats.rejected, 0, "…and no rejected Enter along the way");
}

section("J. units");
{
  const g = game(60);
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
  // Short CAVs, every one cleared, over many waves: units keep turning over as nests reach 12.
  const g = game(10, 21);
  const SHOWING = ["laying", "active", "overtime"];
  const lastUnit = {};
  let clash = false, cavs = 0, changed = 0;
  advance(g, 1500, (x) => {
    x.drain().forEach((e) => {
      if (e.type !== "laying") return;
      const u = x.nests[e.nest].unit;
      if (e.nest in lastUnit) { cavs++; if (lastUnit[e.nest] !== u) changed++; }
      lastUnit[e.nest] = u;
    });
    const showing = x.unlocked().filter((n) => SHOWING.includes(n.state)).map((n) => n.unit);
    if (new Set(showing).size !== showing.length) clash = true;
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  });
  ok(g.unlocked().length === 12 && cavs > 100, `a long game reaches 12 nests with plenty of repeat CAVs   [${g.unlocked().length} nests, ${cavs} repeat CAVs, wave ${g.wave}]`);
  ok(!clash, "D2: a unit already showing on the board is never drawn again, all game");
  ok(changed > cavs * 0.9, `D2: a nest's next CAV brings a new unit   [${changed} of ${cavs} changed]`);
}

section("K. the activation order (Refinement 3 §8)");
{
  const g = game(10);
  eq("neighborsOf" in g, false, "E15 (ruled): a clear no longer targets neighbouring nests, so the game has no neighbour lookup");
  eq(g.unlocked().map((n) => n.id).sort((a, b) => a - b), [0, 3, 5, 8, 11], "wave 1 activates the four corners and a centre nest, spread across the board");
  eq(Array.from(ET.Game.UNLOCK_ORDER), [0, 3, 8, 11, 5, 6, 1, 10, 2, 9, 4, 7], "the activation order is fixed");
  eq([...new Set(ET.Game.UNLOCK_ORDER)].length, 12, "…and covers all 12 nests once");
}

section("N. Refinement 3 rulings (2026-09-23): the egg ladder");
eq([0, 0.19, 0.39, 0.4, 0.6, 1].map((t) => R.isFastClear(t * 6, 6)), [true, true, true, false, false, false], "E26: a fast clear is a tier 1 or tier 2 clear (the first 40% of the overtime window)");
eq(ET.CONFIG.panSeconds < 0.5, true, "the pan's slam is under 0.5 s");
eq(ET.CONFIG.ladder, ["Scrambled", "Sunny-Side Up", "Over Easy", "Poached", "Eggs Benny", "Eggs Benny w/ Avocado", "Steak, Eggs & Brew!"], "the ladder's seven dishes, bottom to top");
{
  // Clear every CAV right at its bold: the streak climbs a rung a clear, then holds at the top, across waves.
  const g = game(10);
  const rungs = [], waves = new Set(), tiers = new Set();
  let scoreGap = 0;
  advance(g, 400, (x) => {
    inState(x, "overtime").forEach((n) => {
      const before = x.score, into = x.time - n.boldAt, span = n.hatchAt - n.boldAt;
      x.submit("RCAV " + n.unit);
      scoreGap = Math.max(scoreGap, Math.abs(x.score - before - R.clearPoints(into, span)));
    });
    x.drain().forEach((e) => { if (e.type === "cleared") { rungs.push(e.rung); tiers.add(e.tier); waves.add(x.wave); } });
  });
  eq([...tiers], [1], "E26: a clear right at its bold is tier 1, and the cleared event says so");
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
  eq(climb(game(10), 3).streak, 3, "three fast clears: the streak is 3");
  {
    const g = climb(game(10), 2);
    let e = null;
    for (let i = 0; i < 4000 && !e; i++) {
      g.step(0.05);
      const late = inState(g, "overtime").find((y) => g.time - y.boldAt > 0.5 * (y.hatchAt - y.boldAt));
      if (late) { g.drain(); g.submit("RCAV " + late.unit); e = g.drain().find((x) => x.type === "cleared"); }
    }
    eq([e && e.fast, e && e.rung, g.streak], [false, -1, 0], "a slow clear shows no dish and drops the streak to the bottom");
    ok(e && e.tier >= 3 && e.points === ET.CONFIG.clearTierPoints[e.tier - 1], `E26: that slow clear is tier 3 or later, and scores its tier's points   [tier ${e && e.tier}, ${e && e.points}]`);
  }
  {
    const g = climb(game(10), 2);
    g.submit("RCAV 0000");
    eq(g.streak, 0, "any ERROR drops it to the bottom");
  }
  {
    const g = climb(game(10), 2);
    for (let i = 0; i < 4000 && !g.stats.hatched; i++) g.step(0.05);
    ok(g.stats.hatched > 0 && g.streak === 0, "a hatch drops it to the bottom");
  }
  eq(game(10).streak, 0, "a new game starts at the bottom");
}

section("M. the Timer Refinement (2026-09-22): two clocks, speed, the wall clock");
{
  const g = new ET.Game({ types: [T("VS", 10)], units, rng: ET.seededRandom(7), wallStart: 14 * 3600 });
  g.start();
  advance(g, 2);
  eq(Math.round(g.clock), 60, "the clocks run 1 displayed minute per 2 s in wave 1");
  eq(Math.round(g.wall()), 14 * 3600 + 60, "the wall clock starts where it's told and runs at the same speed");
  const n = inState(g, "active")[0];
  const el = g.snapshot().nests.find((x) => x.id === n.id).elapsed;
  ok(Math.abs(el - (g.time - n.startedAt) * 30) < 1e-6, `a nest clock shows displayed seconds, at the same speed   [${el.toFixed(1)} after ${(g.time - n.startedAt).toFixed(2)} s]`);
}
{
  const g = new ET.Game({ types: [T("VS", 10)], units, rng: ET.seededRandom(7), wallStart: 86400 - 30 });
  g.start();
  advance(g, 2);
  ok(g.wall() >= 0 && g.wall() < 60, `the wall clock wraps past midnight   [${g.wall().toFixed(1)}]`);
}
withoutFarWarp(() => {
  // Every clock shares one speed: at wave 20 a VS bolds in 10 s, and its overtime is still player seconds.
  const g = game(10);
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
});
{
  // The nest clock keeps counting through overtime.
  const g = game(10);
  advance(g, 0.05 + LAY);
  const n = inState(g, "active")[0];
  advance(g, 22);
  const e = g.snapshot().nests.find((x) => x.id === n.id);
  ok(e.state === "overtime" && e.elapsed > 600, `a bold nest clock keeps counting past 10:00   [${Math.floor(e.elapsed / 60)}:${String(Math.floor(e.elapsed % 60)).padStart(2, "0")}]`);
}
{
  // Speed changes at wave start; the step lands on the even waves.
  const g = game(1);
  const speeds = {};
  advance(g, 400, (x) => {
    x.drain().forEach((e) => { if (e.type === "wave-start") speeds[e.wave] = e.speed; });
    inState(x, "overtime").forEach((n) => x.submit("RCAV " + n.unit));
  });
  eq([1, 2, 3, 4].map((w) => speeds[w]), [1, 1.1, 1.1, 1.2], "each wave starts at its own speed (W1 1.0, W2 1.1, W3 1.1, W4 1.2)");
}
{
  // Skipped spawns are logged per wave (Refinement §9).
  const g = game(60);
  advance(g, 60);
  ok(g.stats.skipped > 0 && g.stats.skippedByWave[1] === g.stats.skipped, `skipped spawns are counted against the wave they fell in   [W1 ${g.stats.skippedByWave[1]} of ${g.stats.skipped}]`);
}

section("O. Refinement 3 §4: Time Warp");
{
  // MB (30 min, 60 s at base speed): long enough that wave 1 has spawned all 8 while some still run.
  const g = game(30);
  let warpedBeforeLast = false, warpWithBold = false, sawWarp = false, sawAfter = false;
  const bolds = [];
  const ot = [];
  let prev = null;
  advance(g, 400, (x) => {
    if (x.wave !== 1) return;
    const w = x.warping();
    if (w && x.spawned < x.quota && x.farEggs() < ET.CONFIG.warpFar.eggs) warpedBeforeLast = true;
    if (w && x.unlocked().some((n) => n.state === "overtime")) warpWithBold = true;
    if (w) sawWarp = true;
    x.drain().forEach((e) => { if (e.type === "bold") { const n = x.nests[e.nest]; bolds.push(x.clock - n.boldClock - (x.time - n.boldAt) * x.rate); ot.push(n.hatchAt - n.boldAt); } });
    if (prev && prev.warp && !w) sawAfter = true;
    prev = { warp: w };
    inState(x, "overtime").forEach((n) => { if (x.time - n.boldAt > 1) x.submit("RCAV " + n.unit); });
  });
  ok(sawWarp, "the clocks warp once the wave's last egg has spawned and none is bold");
  ok(!warpedBeforeLast, "…never before the last egg of the wave has spawned, unless E39's rule holds (2+ eggs over 8:00 from bold)");
  ok(!warpWithBold, "…and never while an egg is bold");
  ok(sawAfter, "an egg going bold ends the warp (it comes back after the clear)");
  ok(bolds.length >= 8 && bolds.every((d) => Math.abs(d) < 1e-6), `the warp stops on the exact instant an egg goes bold (the clock runs normally from there)   [${bolds.length} bolds, worst ${Math.max(...bolds.map(Math.abs)).toExponential(1)}]`);
  ok(ot.every((x) => x >= 5.4 - 1e-9 && x <= 6.6 + 1e-9), "the overtime window stays 6 s ±10% of the player's seconds");
}
{
  // The rate: 5× the wave's speed, for the nest clocks and the wall clock alike.
  const g = game(30);
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
  const g = game(10);
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
  // a hospital egg's STR starts on the egg already in the nest: no second lay, no cord
  const { g, n } = oneEgg(1);
  g.submit("RCAV " + n.unit);
  g.drain();
  g.submit(`CAV ${n.unit} STR`);
  ok(!g.drain().some((e) => e.type === "laying") && n.state === "active", "a hospital egg's STR lays no new egg: Mom repairs the one in the nest");
}

section("E39 (Chat, 2026-09-25): Time Warp also runs while 2+ eggs are each over 8:00 from their bold mark");
{
  eq(ET.CONFIG.warpFar, { eggs: 2, seconds: 480 }, "the rule as ruled: 2 eggs, 8:00 of displayed time");
  // MB is 30 min: a fresh MB is 30:00 from its bold mark. Wave 1 spawns 8, so the last-CAV rule is far off at first.
  const g = game(30);
  let one = null, two = null, stops = [], withBold = false, sawFarOnly = false;
  let prev = false;
  for (let i = 0; i < 40000 && g.wave === 1; i++) {
    const w0 = g.warping(), far0 = g.farEggs();
    if (one === null && inState(g, "active").length === 1) one = w0;
    if (two === null && far0 >= 2 && g.spawned < g.quota) { two = w0; }
    if (w0 && g.spawned < g.quota) sawFarOnly = true;
    if (w0 && inState(g, "overtime").length) withBold = true;
    // how far the second-furthest egg is from its 8:00 mark before the step
    const toMark = inState(g, "active").map((n) => n.boldClock - 480 - g.clock).sort((a, b) => b - a)[1], c0 = g.clock;
    g.step(0.05);
    const w1 = g.warping();
    // when E39's rule alone was running it and it stops, the step splits on that egg's 8:00 mark: warp speed up to it,
    // the wave's own speed after it
    if (prev && !w1 && g.spawned < g.quota && !inState(g, "overtime").length && toMark > 0) {
      const want = toMark + (0.05 - toMark / (g.rate * ET.CONFIG.warpFactor)) * g.rate;
      stops.push(g.clock - c0 - want);
    }
    inState(g, "overtime").forEach((n) => g.submit("RCAV " + n.unit));
    prev = g.warping();   // after the clears, so a clear ending it isn't taken for a stop at the mark
  }
  eq(one, false, "one egg over 8:00 away is not enough");
  eq(two, true, "two eggs each over 8:00 away start Time Warp, before the wave's last CAV has even spawned");
  ok(sawFarOnly, "…so it runs earlier in the wave than the last-CAV rule allows");
  ok(!withBold, "never while an egg is bold");
  ok(stops.length > 0 && stops.every((d) => Math.abs(d) < 1e-6), `it stops on the exact instant the second egg comes within 8:00 of its bold mark   [${stops.length} stops, worst ${stops.length ? Math.max(...stops.map(Math.abs)).toExponential(1) : "-"}]`);
}
{
  // the guard: two far eggs and one bold one: no warp
  const g = game(30);
  const ns = g.nests.filter((n) => n.unlocked).slice(0, 3);
  ns.forEach((n) => { n.type = T("MB", 30); n.unit = String(2101 + n.id); g.activate(n, "auto"); });
  for (let i = 0; i < 400 && ns.some((n) => n.state !== "active"); i++) g.step(0.05);
  const w = g.warping();
  ns[2].boldClock = g.clock;   // one of them reaches its mark
  g.step(0.001);
  eq([w, ns[2].state, g.farEggs() >= 2, g.warping()], [true, "overtime", true, false], "with an egg bold it doesn't run, even with two eggs over 8:00 away");
}

section("S. Refinement 4 §3: no duplicate units, no repeats within a wave");
{
  // A long game of short CAVs, watching every spawn.
  const g = game(10, 33);
  const distinct = new Set(units).size;
  eq([units.length, distinct, g.units.length], [54, 54, 54], "the Data Sheet's 54 rows are 54 distinct units (the five doubles removed 2026-09-23); the pool is the 54");
  let dupOnBoard = false, repeatBeforeRefill = 0, spawnsChecked = 0;
  let seen = new Set(), wave = 1;
  for (let i = 0; i < 40000 && g.phase !== "over"; i++) {
    g.step(0.05);
    if (g.wave !== wave) { wave = g.wave; seen = new Set(); }
    g.drain().forEach((e) => {
      if (e.type !== "laying") return;
      const u = g.nests[e.nest].unit;
      spawnsChecked++;
      if (seen.has(u) && seen.size < distinct) repeatBeforeRefill++;
      if (seen.size >= distinct) seen = new Set();
      seen.add(u);
    });
    const showing = g.unlocked().filter((n) => n.state !== "idle").map((n) => n.unit);
    if (new Set(showing).size !== showing.length) dupOnBoard = true;
    inState(g, "overtime").forEach((n) => g.submit("RCAV " + n.unit));
  }
  ok(spawnsChecked > 300, `a long game   [${spawnsChecked} CAVs over ${g.wave} waves]`);
  ok(!dupOnBoard, "a unit is never on two nests at once");
  eq(repeatBeforeRefill, 0, "within a wave, no unit repeats until all 54 have been used");
}
{
  // Force the refill: a wave's quota bigger than the pool (5 units, quota 8).
  const g = new ET.Game({ types: [T("VS", 1)], units: ["1001", "1002", "1003", "1004", "1005"], rng: ET.seededRandom(3) });
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

section("U. ⏳ E59 (2026-10-02): one mode, the type bag back; E56: about 70% of the VS eggs are hospital eggs, a plain random roll");
{
  // the real table, with the game's own share: every egg laid is a VS, and about 70% carry the H sign
  const run = (seed) => {
    const g = new ET.Game({ types, units, rng: ET.seededRandom(seed) });
    g.start();
    const laid = [];
    for (let i = 0; i < 60000 && g.phase !== "over" && laid.length < 400; i++) {
      g.pool = 3;
      g.step(0.05);
      g.drain().forEach((e) => { if (e.type === "laying") laid.push({ code: g.nests[e.nest].type.code, hospital: e.hospital, unit: g.nests[e.nest].unit }); });
      inState(g, "overtime").forEach((n) => g.submit("RCAV " + n.unit));
    }
    return laid;
  };
  const laid = run(4);
  const codes = [...new Set(laid.map((x) => x.code))].sort();
  eq(codes, ["AD", "EOS", "MB", "SS", "VS"], "E59 (bag): every type in the table is laid but the STR (the hospital step) and the two-phase-only VF");
  // a shuffle bag: every run of 5 straight from a fresh bag holds each type once (a wave start empties the bag, so
  // count within the first wave's eggs only)
  const first5 = laid.slice(0, 5).map((x) => x.code).sort();
  eq(first5, ["AD", "EOS", "MB", "SS", "VS"], "…out of a shuffle bag: the first five eggs are one of each");
  const counts = codes.map((k) => laid.filter((x) => x.code === k).length);
  ok(Math.max(...counts) - Math.min(...counts) <= 12, `…so the mix stays even   [${codes.map((k, i) => k + " " + counts[i]).join(", ")}]`);
  ok(laid.filter((x) => x.hospital).every((x) => x.code === "VS"), "only a VS egg can be a hospital egg");
  const vs = laid.filter((x) => x.code === "VS");
  const share = vs.filter((x) => x.hospital).length / vs.length;
  ok(vs.length >= 70 && Math.abs(share - 0.7) < 0.1, `E56: about 70% of the VS eggs are hospital eggs   [${(share * 100).toFixed(1)}% of ${vs.length}]`);
  const allVS = new ET.Game({ types, units, rng: ET.seededRandom(4), eggTypes: "VS" });
  allVS.start();
  const laidVS = [];
  for (let i = 0; i < 20000 && laidVS.length < 40; i++) { allVS.pool = 3; allVS.step(0.05); allVS.drain().forEach((e) => { if (e.type === "laying") laidVS.push(allVS.nests[e.nest].type.code); }); inState(allVS, "overtime").forEach((n) => allVS.submit("RCAV " + n.unit)); }
  ok(laidVS.length >= 40 && laidVS.every((c) => c === "VS"), `the switch's "VS" is E54 as built: every egg a VS   [${laidVS.length}]`);
  eq(ET.CONFIG.hospitalShare, 0.7, "E56: the share is a setting, 0.7 [T]");
  eq(JSON.stringify(run(9).slice(0, 60)), JSON.stringify(run(9).slice(0, 60)), "the roll comes from the game's seeded source, so ?seed= replays which eggs are hospital eggs");
  const none = new ET.Game({ types, units, rng: ET.seededRandom(3), hospitalShare: 0 });
  eq([none.first.code, none.second.code], ["VS", "STR"], "the game takes its VS and STR from the table by code");
  eq(["mode"].filter((k) => k in none), [], "E54: no mode");
}

section("AD. Chat (2026-10-03): the AD \"Clear @ HH:MM\" note is back (E1: the next whole minute after the start, plus the draw)");
{
  eq([ET.CONFIG.postItCodes, ET.CONFIG.adClockTarget], [["AD"], "full-minutes"], "only AD carries the note; E1's \"full-minutes\"");
  const AD = { code: "AD", meaning: "Admin CAV", min: 10, max: 30, twoPhaseOnly: false, hiddenUntilTrigger: false };
  let checked = 0, whole = true, never = true, inRange = true;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const g = new ET.Game({ types: [AD], units, rng: ET.seededRandom(seed), wallStart: 14 * 3600 + 15 * 60 + 40, eggTypes: "bag" });
    g.start();
    for (let i = 0; i < 400 && !g.nests.some((n) => n.state === "active"); i++) g.step(0.05);
    const n = g.nests.find((x) => x.state === "active");
    const sn = g.snapshot().nests.find((x) => x.id === n.id);
    const startWall = g.wallStart + n.startedClock, boldWall = g.wallStart + n.boldClock;
    whole = whole && Number.isInteger(n.note.minutes) && Math.abs(boldWall % 60) < 1e-6 && sn.note.at === boldWall % 86400;
    never = never && boldWall - startWall >= n.note.minutes * 60 - 1e-6 && boldWall - startWall < n.note.minutes * 60 + 60;
    inRange = inRange && n.note.minutes >= 10 && n.note.minutes <= 30 && sn.note.kind === "clock";
    checked++;
  }
  ok(checked === 8 && inRange, "an AD egg pops with a \"Clear @\" note, its draw 10–30 whole minutes");
  ok(whole, "…its bold mark lands on the whole minute the note names (the wall clock)");
  ok(never, "…never sooner than the draw, never a minute or more past it (E1: rounded up)");
  const vs = new ET.Game({ types: [T("VS", 10)], units, rng: ET.seededRandom(3) });
  vs.start();
  for (let i = 0; i < 400 && !vs.nests.some((n) => n.state === "active"); i++) vs.step(0.05);
  eq(vs.snapshot().nests.find((x) => x.state === "active").note, null, "a VS has no note");
}

section("L. the build questions' switches match the rulings (Draft 9, 2026-09-17; D5 superseded 2026-09-22)");
eq([ET.CONFIG.unitAssignment, ET.CONFIG.stopSpawningAtQuota, ET.CONFIG.keepTextOnReject, "timerDisplay" in ET.CONFIG],
  ["per-spawn", true, false, false], "D2 per spawn · D4 stop at quota · D6 superseded: a rejected Enter clears the box · D5's switch is gone");
eq([ET.CONFIG.hoseWhen, ET.CONFIG.errorOnEmpty], ["always", false], "the hose is always the in-game cursor (Hose ruling, replacing E5) · E6 no ERROR on an empty Enter");
eq(["vfHides", "adNoteFrom", "placementPoints", "placementTimeoutStart", "progressionOnePhaseWaves"].filter((k) => k in ET.CONFIG), [], "E54: the VF and placement switches are gone with what they set (AD's note is back, Chat 2026-10-03)");
eq(ET.CONFIG.eggTypes, "bag", "⏳ E59 PENDING: eggs come out of the type bag (Chat's playtest, 2026-10-02; E54's all-VS is \"VS\")");
eq([ET.CONFIG.eggType, ET.CONFIG.hospitalType, ET.CONFIG.hospitalShare, ET.CONFIG.hospitalWindowScale, ET.CONFIG.momSweetUntilWave],
  ["VS", "STR", 0.7, 1, 1], "E52–E56 (ruled 2026-10-02): VS eggs, STR second, 70% hospital, window 1 the same as every egg's, sweet Mom in wave 1");
eq(ET.CONFIG.devModePasswordHash, null, "⏳ D3: no phrase set yet, so Developer Mode denies every entry");
eq(ET.CONFIG.muteKeyInPlay, "ctrl-m", "E25 (ruled 2026-09-24): in play M types; the button and Ctrl+M mute there");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFAILED:\n  " + fails.join("\n  "));
  process.exit(1);
}
