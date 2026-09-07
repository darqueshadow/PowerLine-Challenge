# The CAT Computer — cracked-disk spec

_Written 2026-09-07 from Andrew's rulings. Implementation: `crackintro.js`, `library.js`,
`emulator/`._

## 🚨 Why this file exists at all

`disks.js` and `cat.js` both cited **`cat-computer-cracked-disk-easter-egg-spec.md`** as the
governing spec for cracked disks. **That file was on no disk anywhere** — not in this repo, not
in `+Nerva Beacon`, not in OneDrive. Two source files pointed at a document that had never been
written, and anyone following the citation would have found nothing and had to guess.

His ruling: write it fresh, and commit it, so the citation resolves. This is that file.

📌 It is kept in `Game/cat/` beside the code it governs, not in `Documents/` — the two files
that cite it are three lines away from it.

---

## 1. The name is wrong, and the name is staying

⭐⭐ **This is not an Easter egg.** His ruling, verbatim in effect: the crack intro is
*"not flag-gated, not a one-time hidden Easter egg"*. It plays **before every disk load,
automatically, every time.**

The filename keeps the word "easter-egg" only because that is the string `disks.js` and `cat.js`
already cite. 🚫 Renaming the file to match the behaviour would break both citations to fix a
word — the wrong trade. This section is the correction; the filename is a pointer.

## 2. What plays

Before a disk boots, between the load theatre's `RUN` and the game appearing:

| Element | Content |
|---|---|
| Group name | **NOAH COLLECTIVE** — chrome letters, per-character sine wobble |
| Sub-line | `PRESENTS` |
| Title | The disk's display name, uppercased |
| Raster bars | Two counter-rolling gradient bands behind the stage |
| Scroller | A bottom-edge marquee, greetz and boasts in the scene idiom |

**Greetz name the mascots:** PENN · DEX · FERGIE · TRACE · RUE · BEV.

⚠️ **Names only — never a species, never a description.** `doors-and-tools.md` in the NB repo
cost an afternoon to the assumption that a mascot's name tells you what it is (`who:'dex'` had
been drawing a red panda). A scroller needs the name and nothing else, so it asserts nothing
anyone would have to go and check against the art.

🚫 **No real scene group names, and no Commodore branding.** The 1980s cracking scene is the
*form* being paid tribute; the actual group names and trademarks are not reproduced. Same rule
the Tommodore CAT machine name already follows.

## 3. Timing and the way out

- **2600 ms**, dropping to **700 ms** under `prefers-reduced-motion`.
- 🚫 **Reduced motion SHORTENS it; it never removes it.** The spec wants the splash seen.
  Hiding it entirely changes what the machine does, not how much it moves.
- **Any key or a click skips it.** Authentic, and the mercy valve — this plays on every single
  load, so the fiftieth time must cost one keypress.
- 🚨 The skip listener is on the **capture phase**. The hub's own document-level `keydown` would
  otherwise take the key first and type it into the BASIC prompt behind the overlay; the player
  would skip the intro and find junk on the command line.

## 4. Scope — the one switch

`APPLIES_TO` in `crackintro.js`. Two legal values:

- **`"all"`** — every disk, cartridges included. **This is the ruling and the shipped value.**
- `"library"` — C64 disks only; PLC cartridges boot straight through.

🚫 There is deliberately **no per-disk override**. A splash that appears for some disks and not
others is precisely the flag-gating the ruling refused.

⚠️ **The literal reading was taken.** He wrote "before EVERY disk loads", in a spec about
cracked disks — which could have meant every *cracked* disk. `"all"` is the literal reading, and
the alternative is a one-word change on one line. Flagged rather than quietly narrowed.

## 5. What a "cracked disk" actually is here

A file in **`Game/disks/`**, found by `library.js` at runtime.

- 🚫 **No cracked disk is ever listed in `disks.js`.** That file is the cartridge roster now.
- The box renders a disk and a cartridge **identically** — his ruling, *"one mixed box, all
  equal"*. No badge, no shelf, no section header.
- ⭐ Which is exactly why the **`runner` field**, not the look of the row, must stay the only
  thing that decides where a disk loads.

## 6. Failure states, and which surface owns each

The honest refusal that used to live in `cat.js` **moved; it was not deleted.** `cat.js` cannot
tell the three "no" cases apart, so it no longer claims to:

| State | Owner | What it says |
|---|---|---|
| No core installed | `emulator/emu.js` | Names the install command |
| Origin cannot run WASM (`file://`) | `emulator/emu.js` | Names the patch and the dev server |
| Core present but won't execute | `emulator/emu.js` | Points at a partial download |
| Folder holds no disks | `cat.js` | "empty. drop .d64 files into game/disks/" |
| Origin cannot list a directory | `cat.js` | "not readable from this origin" |
| Group with no sides behind it | `cat.js` | Reported as a hub fault, not blamed on the drive |

🚨 **The last two rows must never share a line.** A folder that answered and held nothing means
*put some disks in*. A request that never resolved means *this origin cannot list directories* —
expected on `file://`, a real fault on a dev server. Collapsing them hides the second behind the
first permanently, and sends someone hunting for files that are sitting right there.

## 7. Disk swapping

Built now, not deferred — his ruling, because he hand-picks the library and multi-disk titles
are an ordinary near-term case.

- Sides are grouped off the **filename**: `- d1`, `(Disk 1)`, `- Side A`. See
  `Game/disks/README.md`.
- The control lives in the **play bar** — the hub's chrome, not the emulator's.
- 🚨 **A failed swap is never silently converted into a restart.** Reloading with the other image
  would look like a swap and would actually reset the machine: the game loses everything and
  lands back on its title screen, and the player blames the game. `emu.js` reports
  `cat:swapfailed` and the hub offers the restart **as a choice, in words**.

## 8. Controls

Arrows = joystick. **Ctrl = fire.** Space and Shift stay free as real keyboard keys.

⭐ **Why Space is not fire**, recorded so it does not get "fixed": a great many C64 titles use
Space as a real key — start, pause, continue, dismiss. Bound to fire, those games become
unstartable, and it looks like a broken emulator rather than a bound key.

Joystick port defaults to **2** with a per-title flip to 1; no single mapping is right for every
title and pretending otherwise would just move the problem.
