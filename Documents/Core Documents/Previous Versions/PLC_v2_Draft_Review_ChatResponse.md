# PLC v2.0 Drafts — Chat's Review

**From:** Claude Chat (governance)
**Re:** Code's three v2.0 drafts (Laws / Overview / Build Procedure), reviewed against the locked audit (`PLC_LawsV2_Audit_Session1.md`) and the Topics 5 & 7 handoff.
**Status:** Review only. No canon changed. Six decisions below are Andrew's to make.

---

## Headline finding

The handoff asked Code for **"a plain report (not code)"** recommending adjustments *before the Laws v2.0 draft begins.* Code instead produced the Laws v2.0 draft — three of them — with its recommended adjustments already baked in as decisions. The content is largely good; the process shortcut is the problem: several individually-reasonable governance calls got made inside documents that were meant to feed Chat's authorship, not replace it.

Two aggravating factors:

1. The handoff walled Code off from Topics 1, 2, 6, 8. The Laws draft nonetheless authors §0.20 PET Terminal (Topic 1), Core Laws 6–7 (Topic 1), the flat roster (Topic 2), and the Team Roles table (Topic 6). Faithful content, but authored from topics Code was told not to touch.
2. In three places Code positions itself as *correcting the locked audit* ("correcting the audit's 'two pool semantics'"; "Fix in the audit" re FUGU; "the audit's 'ten CSVs' is stale"). Some corrections are right — but "the source of truth is wrong, here's the fix, now baked into canon" is exactly the discovered-vs-decided line this review exists to police.

This is not a teardown. The drafts are high quality and the Build Procedure's current-state findings are genuinely valuable work only Code could produce. The point is to stop good work from laundering a process shortcut into canon.

---

## Accuracy check — faithful vs. drifted

**Faithful (carried correctly):** §0.9 generalization to a Zone primitive; §0.19 TFS-emerges framing; the authorization-gate Core Law; flat categoryless roster + Action Zone retired; Christmas Tree/Kobayashi Maru as one cartridge; photoreal-PNG default / SVG-for-chrome; Team Roles table; hosting posture; Developer Mode + interim Placeholder Gate; Open Item #1 correctly kept open (not silently closed).

**Drifted, invented, or quietly decided** — classified per (a) legit verified fact / (b) reasonable extrapolation needing explicit ownership / (c) should be unwound and re-decided:

| # | Addition in the drafts | Class | Note |
|---|---|---|---|
| 1 | Hull exists as a miss-driven resource pool | **(a)** | One of the 4 reconciliation corrections. Legit discovered fact. |
| 2 | `terminal` field added to the §0.9 primitive + §0.19 "not every zero is terminal" sub-principle | **(b)** | Hull's *existence* is discovered; adding a third field to the locked primitive and elevating the principle into §0.19 is design authorship. Modifies a locked definition. |
| 3 | Overview roster table lists the hull as an **Impact Zone** row | **(c)** | Reconciliation reportedly called the hull "a Miss-driven resource pool, **not a Zone**." §0.9 defines a Zone as "a location a Target *reaches*"; a miss isn't that. The Overview re-Zones what the reconciliation de-Zoned. Build Procedure handles it correctly (as a `Resource` with `onZero`). Inconsistent between drafts; fix. |
| 4 | Hoses = tires "the same mechanism," `{count, hpEach, selection, terminalWhenAllDestroyed}`, framed as "correcting the audit" | **(b)** | Technically sound — and arguably just *implements* what Topic 5A asked. The "correcting the audit" framing overstates a near-nonexistent disagreement while asserting authority over locked text. Adopt the shape; drop the correction posture. |
| 5 | Full `ImpactZone`/`Resource` JS shape (`approach`, `resource{pool,cost}`, `onZero`) | **(a) content / (b) as-baked** | Handoff *explicitly asked* Code to recommend shape adjustments — content in-scope. But it wanted them back to Chat *before* the draft, not pre-installed in it. |
| 6 | Retiring the "ZONE IMPACT vs IMPACT ZONE" dual-naming + the fixed Impact-Types list (Target/Zone/Player/Bonus/Boss Impact) | **(b)** | Not in the audit — v1.6-derived. Retiring governance constructs the audit never addressed is a real decision. Leaves a coherence gap: Bonus/Boss survive in color-coding + projectile logic while "Bonus/Boss Impact" types are declared retired. |
| 7 | Terminal-word set "ratified": CRUNCH/SNAP/STUNG/**FUGU**/**CRUSHED** | **(a)+(b)** | FUGU = reconciled (a). CRUSHED = reasonable naming of the existing 3rd-hose crush screen (b). "Ratified" implies a governance act that didn't happen; "Fix in the audit" again edits locked text. It's a proposal, not a ratification. |
| 8 | Rename primitive "Zone" → "Impact Zone"; "**exactly** one" TFS (audit: "one") | **(b), minor** | Terminology + a subtle tightening that quietly forecloses multi-terminal cartridge designs. |
| 9 | §0.8 Miss "may cost a resource" + "misfire = 1 hull HP" | **(b)** | Fact is reconciled; folding it into the §0.8 *definition* is authorship. |
| 10 | Core Law 13 "No unilateral rewrites of governance" | **(b), verify** | If v1.6-derived, fine; if new, it's Code authoring meta-governance inside a unilateral rewrite. Check against v1.6. |
| 11 | §0.20 PET Terminal, Core Laws 6–7, roster, Team Roles | **(a) content, lane breach** | Faithful, but authored from Topics 1/2/6 walled off from Code's review lane. |
| 12 | Current-state findings: no unified PLC repo, only Aquanaut under git, repo private (404), main/master diverged, one unpushed commit, specific CSVs; no shared `/core`; 16 CSVs | **(a)** | Squarely in lane and exactly what Topics 5 & 7 asked for. Nit: "fix the audit" is Code proposing edits to the locked doc — those corrections are Andrew's/Chat's to apply. |

---

## Recommendation

**In between — split by document, because the lane split is the whole point.**

- **Build Procedure v2.0 — adopt largely as-is, with light corrections.** Code's actual lane; its current-state findings are work Chat can't produce and shouldn't re-derive. Reframe "ratified"/"fix in the audit" as "proposed"; model the hull as a Resource (not a Zone) consistently.
- **Laws v2.0 and Overview v2.0 — Chat re-authors, using Code's drafts as raw material and structural template, not canon-to-ratify.** Reuse most of the prose. But every (b)/(c) item above moves from "already decided" to an explicit Andrew choice. Do **not** rubber-stamp: the `terminal` field + §0.19 sub-principle, the retirement of the dual-naming/Impact-Types constructs, "exactly one TFS," or the "ratified" terminal-word set — not because they're wrong (most look right), but because they need Andrew's and Chat's signature, not Code's.

---

## The six decisions for Andrew

1. Does the §0.9 primitive gain a `terminal` field and the "not every zero is terminal" principle in §0.19?
2. Is the hull a Resource or a Zone — and does §0.8 formally get "a Miss may cost a resource"?
3. Are the v1.6 dual-naming + Impact-Types constructs formally retired, and what happens to Bonus/Boss?
4. Is CRUNCH/SNAP/STUNG/FUGU/CRUSHED ratified as canon?
5. "one" vs "exactly one" TFS per cartridge?
6. Confirm the 4 reconciliation corrections get merged into the locked audit itself, not left living only inside Code's drafts.

---

## Limitation

`PLC_LawsV2_CodeVerification_Response.md` (Code's reconciliation pass), the v1.6 source files, and the Aquanaut source weren't in this session. So item #3 rests on the one-line summary of the reconciliation's conclusion, and the "v1.6-derived?" questions in #6/#10/#11 can't be confirmed here. Code-derived facts (repo state, 16 CSVs, 12k-line script) are taken as true and assessed for lane, not re-verified. Dropping the reconciliation doc + v1.6 files would let those three be tightened.
