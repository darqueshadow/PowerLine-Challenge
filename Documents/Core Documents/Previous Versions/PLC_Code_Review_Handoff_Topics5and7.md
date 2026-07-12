# Handoff: Technical Review of Audit Topics 5 & 7 (Pre-Laws v2.0)

**From:** Claude Chat (Senior Developer)
**To:** Claude Code (Systems Integrator)
**Type:** Review only — no implementation, no file changes requested at this stage.

---

## Context

Andrew and Claude Chat completed a full audit (Topics 1–8) toward a Laws v2.0 / Overview v2.0 / Build Procedure v2.0 rewrite. The full audit document (`PLC_LawsV2_Audit_Session1.md`) is attached/available in the project. Before drafting the actual updated Laws, Andrew wants your review of two sections specifically, since you have visibility into the current repo and implementation state that Claude Chat doesn't.

**This is a review request, not a build request.** Do not modify any files. Report findings back to Andrew (who will relay to Claude Chat for incorporation into the rewrite).

---

## What to review

### 1. The §0.9 / §0.19 Zone/Impact restructuring (see audit doc, section "§0.9 / §0.19 Restructuring")

Laws §0.9 currently defines "Impact" narrowly around fall-to-zone. The audit generalizes it into a **Zone** primitive that any Cartridge can declare, with two consequence types (Cumulative / Critical) and an optional save window.

**Please check:**
- Does anything currently implemented (Asteroid Command, Aquanaut's in-progress work, NEMS 500's rough-in) rely on fall-to-zone assumptions that this generalization would break or require refactoring?
- Is the proposed Zone data shape (`{id, consequenceType: Cumulative|Critical, saveWindow: null|seconds, sharedResourcePool?}`) workable against how you've already structured target/impact logic, or does it need adjustment before it becomes a Law?
- Any conflicts between this and what's already built for Aquanaut's hose/diver system specifically, since that's the furthest along under the old informal model?

### 2. Topic 5: Shared Engine Capability Gaps (sections A–E in the audit doc)

This is a consolidated list of `/core` engine work implied by Aquanaut and NEMS 500. Please sanity-check each against reality:

- **A. Generalized Zone system** — see #1 above.
- **B. Attack/consequence state machine** — is the "idle → threat-telegraphed → resolved" model, and the DOM/CSS-overlay-decoupled-from-canvas approach for kill screens, consistent with how Aquanaut's combat is currently built or planned?
- **C. Partially-ordered command chains + concurrency** (NEMS 500 Shift Change: RCAV → OD → SS → BSEH-before-CAV-SS → CAV SS, with NOTE insertable any time after SS, and multiple units potentially concurrent) — does this require a new validator built from scratch, or does anything in the existing command-validation logic already handle partial ordering that this could extend?
- **D. Data-driven config pattern** — confirming this matches your existing approach (Aquanaut's CSV pattern in `dataset/Gameplay/`) and there's no friction extending it to NEMS 500's tire config / Shift Change frequency ratio.
- **E. Photoreal PNG as project-wide default, SVG for HUD/UI/chrome** — this is asset-style guidance, not really a "your implementation" question, but flag it if it conflicts with anything already built.

### 3. Topic 7: Hosting & Deployment

- Confirm current repo state: is it public or private right now?
- Confirm GitHub Pages is (or isn't) auto-publishing on push with no approval gate, as Andrew described.
- Flag anything about the current setup that would make "public repo including the Data Sheet CSVs is fine" a bad assumption in practice (e.g., anything else in the repo beyond gameplay data that shouldn't be public).

---

## What NOT to do

- Don't implement anything from Topic 5 yet — no Zone system, no state machine refactor, no validator. This is pending Laws v2.0 being finalized and, per existing Law, pending each Cartridge's Zones being documented in its own Mini-Game Context Packet and authorized by Andrew.
- Don't touch repo visibility/settings without Andrew's explicit go-ahead.
- Don't treat this as a request to review Topics 1, 2, 6, or 8 — those are design/process decisions outside your lane for this review.

## What to deliver back

A plain report (not code) covering: any conflicts found, any adjustments you'd recommend to the Zone data shape or the A–D technical approach before it's locked into Laws v2.0, and a straight answer on current repo visibility/publish behavior. Andrew will bring this back to Claude Chat before the Laws v2.0 draft begins.
