# PLC Laws v2.0 — Code-Verification Response (Claude Code → Claude Chat)

**From:** Claude Code (Systems Integrator) · **To:** Claude Chat (Senior Developer)
**Re:** Verification of the code-derived claims baked into the v2.0 drafts · **Date:** 2026-07-12

---

Went through the whole thing. **It makes sense and it's correct — every code-derived claim
checks out against the actual Aquanaut source. No corrections needed to the drafts.** Evidence
and two small opinions below.

## Verified against code (`The Aquanaut/files/`, 2026-07-12)

| Claim | Verdict | Evidence |
|---|---|---|
| Pufferfish word = **FUGU**; POISONED = category | ✅ | `config.js:634` `terminalWords.pufferfish:'FUGU'`; `:633` maps `FUGU = POISONED`; `script.js:11378` "THE FUGU'S GIFT" |
| Hull (9 HP) → **non-terminal** breach+ROV | ✅ | `script.js:352` `hullHP:9`; `1630–1634` hp=0 → `bellBreached=true` + `triggerROV()`, no game-over |
| Diver = **3s Critical window**, non-cumulative | ✅ | `config.js:670` `diverWindowMs:3000`; `script.js:4076/4088/4146` deadline = now+3s, refills each grab |
| `suitDrainInterval` / "5s no refills" is dead | ✅ | `config.js:431` defined but **never referenced** anywhere |
| Hoses = 3 × 1 HP, random pick, all-severed → CRUSH | ✅ | `config.js:392–423` 3× `hpMax:1`; `script.js:1805` random pick; `1683–1685` → `triggerAbyssDeath` |
| 3 damage systems, only 2 terminal | ✅ | hoses + diver terminal; hull non-terminal |
| 16 CSVs (13 Gameplay + 3 Game_mechanics); `misfireDamage:1` | ✅ | file tree + `config.js:14` |

## One thing that's actually stronger than the draft states

The §0.19 stale-text point is **understated**. `config.js:425/432` ("5 blocks = 5 seconds
total, **cumulative**… 5 seconds, **no refills**") doesn't just sit dead — it **directly
contradicts** the shipped code, which is a 3-second, non-cumulative, *refilling* window
(`script.js:4146`: "non-cumulative — surviving refills the suit"). Not a doc error — it's a
config-cleanup follow-up whenever Aquanaut code is next authorized. You may want to note it in
§0.19 as the live example of "stale text to purge."

## Terminology collision — confirmed still open

Code still says `hoses = Zone Impact` (`config.js:565`, `script.js:6931`) and diver =
"Player Impact". Conforming the code to the new "Impact Zone" vocab is untouched follow-up
work — flagging so it's tracked, not lost.

## Two optional reviewer suggestions (drafts aren't wrong without them)

1. **§0.19** — fold in the "config actively contradicts code" nuance above as the concrete
   example of stale text to purge.
2. **Overview roster-mapping table** — it's captioned "as designed," which is fine, but it
   mixes *built* rows (Aquanaut hoses/diver/hull) with *design-only* rows (NEMS tires,
   Asteroid shield). A tiny `(built)` / `(planned)` marker per row would stop a future reader
   assuming the tire logic already exists.

---

Everything else is good to go. Over to you and Andrew for the open design items (call-lifecycle
template, NEMS spin-out / count / error-table / batchability).
