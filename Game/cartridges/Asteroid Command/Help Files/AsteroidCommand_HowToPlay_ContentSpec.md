# Asteroid Command — "HOW TO PLAY" Manual
## Content Specification — Handoff to Claude Code

**Status:** Draft for Andrew's approval. Not implementation-ready until approved.
**Supersedes:** the in-game help text currently built by Claude Code, and the older
`Asteroid_Command_-_Game_Play.docx` (which carries stale figures — see *Data Integrity Note*).

**What this document is:** the exact player-facing copy, panel by panel, plus the structure
those panels sit in. It is content and layout intent only. File placement, DOM structure,
and styling implementation remain Claude Code's domain.

---

## Design Intent (read this first)

The reference point is the **Atari 2600 manual**, with one deliberate inversion.

Those manuals oversold a game that was four coloured squares — the box art and the fiction did
the heavy lifting the hardware could not. **Asteroid Command is the opposite problem.** The game
already looks better than any manual could promise. So the manual's job is not to sell the
visuals. Its job is to be **short, confident, and instantly usable** while the fiction carries
the tone.

Rules for the copy:

1. **One idea per screen.** No scrolling walls of text. If a panel needs a scrollbar, it should
   have been two panels.
2. **Short declarative sentences.** "Rocks fall. You type. They stop falling." Not "In this game,
   the player will be required to…"
3. **No tutorial hedging.** No "you may want to consider." Tell the dispatcher what to do.
4. **Fiction on top, facts underneath.** Every panel opens with a line of voice, then delivers
   the actual information plainly.
5. **Tables are for reference, prose is for teaching.** Never make the player read a table to
   learn a mechanic for the first time.

---

## Panel Structure

`HOW TO PLAY` opens on a **menu of eight cards**, not a document. The player picks what they
need. Every panel has a `BACK` return to this menu.

| # | Panel | Covers |
|---|---|---|
| 1 | **THE SITUATION** | The story. Opens by default the first time the player ever enters. |
| 2 | **BASIC GAMEPLAY** | The loop, the controls, F12 |
| 3 | **SPEAKING POWERLINE** | Command anatomy, the four codes, the preposition trap, base numbers |
| 4 | **THE DEFENSE GRID** | The five structures, shields, the tower, NanoMedic repair |
| 5 | **SCORING** | Bonuses, streaks, penalties |
| 6 | **SHORTHAND COMMENTS** | Sub-menu → *How Banners Work* · *Master List* · *The CARD Lifeline* |
| 7 | **DIFFICULTY & RANK** | The eight ranks, choosing your start |
| 8 | **DISPATCHER'S EDGE** | Strategy tips |

Panel 6 is the only one with sub-pages. Everything else is a single screen.

---

# PANEL 1 — THE SITUATION

> **NIAGARA REGION DEFENSE SYSTEM**
> *Dispatcher Briefing — Read Once, Then Never Again*

It is 2075, and nobody can agree on why the asteroids chose Niagara.

The leading theory is the power grid. Sixty years of hydroelectric hum leaking into deep space,
and something out there heard it, decided it was a dinner bell, and RSVP'd. Loudly. With rocks.

Humanity built a great many defense systems in the panic that followed. Exactly one of them
worked, and — in a development that surprised absolutely everyone except dispatchers — it was
**the CAD terminal.** It turns out asteroid targeting arrays and emergency dispatch consoles
speak close enough to the same language that if you type a properly formatted PowerLine command
at an incoming asteroid, the Radio Tower on the escarpment will lock on and vaporize it.

Type it wrong and the tower fires anyway. Wild. Into your own shield.

So here is where things stand. Four landmarks are still standing. Everyone with the sense to
evacuate has evacuated. You had a shift.

**You are the last dispatcher on the escarpment. Your keyboard is a planetary defense weapon.
Type clean, type fast, and the Niagara Region sees morning.**

Coffee's in the pot. It's been in the pot a while.

---

# PANEL 2 — BASIC GAMEPLAY

> **Rocks fall. You type. They stop falling.**

Targets drop from the top of the screen toward the five structures below. Each one carries a
**unit number** and a **plain-English radio call**.

Your job is to translate that call into PowerLine and type it before the rock lands.

```
        2105
   Mobile to Westwood          →   ENP 2105 72122
```

Press **ENTER** to fire.

- **Right command** — the tower locks on, fires, and the target is gone. Points awarded.
- **Wrong command** — **MISFIRE.** The tower fires wild, your own shield absorbs it. −50 points,
  one shield point, and every streak you had resets to zero.
- **Nothing typed, ENTER pressed** — also a misfire. The tower does not need your permission to
  embarrass you.
- **Target reaches the ground** — the landmark under it is destroyed.

**Lose all four landmarks and the region falls.** That is the only way the run ends.

> **You are not aiming. You are not dodging. Typing the right command *is* the shot.**

### Controls

| KEY | ACTION |
|---|---|
| **ENTER** | Fire — submit the command |
| **F12** | **Clear the command box.** Free. No penalty. |
| **BACKSPACE** | Fix a typo — and pay for it |
| **ESCAPE** | Pause / Resume |
| **ARROW KEYS** | Navigate menus |

> ### ⌨ THE MOST IMPORTANT KEY IN THE GAME IS F12
> Backspacing costs points and breaks your Perfect Streak. **F12 costs nothing.**
> Typed garbage? Don't fix it. **Wipe it and start again.** Every experienced dispatcher on this
> console does exactly that, and every rookie backspaces their score into the floor.

---

# PANEL 3 — SPEAKING POWERLINE

> **Three parts. Always three parts.**

```
   <CODE>   <UNIT>   <BASE NUMBER>
    ENP      2105      72122
```

The **unit number** is printed on the target — just retype it. The **code** and the **base
number** are what you have to know.

### The Four Codes

The wording of the radio call tells you which code to use.

| CODE | MEANING | THE CALL SOUNDS LIKE |
|---|---|---|
| **AP** | Post a unit to a base | Post to · Assign to · Required at · Needed at |
| **ENP** | Enroute — the unit is travelling there | Enroute to · Mobile to · On our way to · Heading to |
| **BSE** | On scene — the unit has arrived | Arriving · Arriving at · Made it to · At |
| **LA** | Local area — mobile *around* a district | Mobile around · On the air by · Area of · Staying local at |

> ### ⚠ THE TRAP
> **"Mobile to Westwood" is ENP.**
> **"Mobile around Westwood" is LA.**
>
> One preposition. Different command. This is not a gotcha — it is the exact distinction you
> make on a live radio, and it is the single skill this game exists to drill into you.

### Base Numbers

| BASE | # | | BASE | # |
|---|---|---|---|---|
| Niagara Falls | 72100 | | Smithville | 72109 |
| Ontario St | 72101 | | Vineland | 72110 |
| Linwell | 72102 | | Pelham | 72111 |
| Thorold | 72103 | | Ridgeway | 72113 |
| NOTL | 72104 | | Glendale | 72115 |
| Grimsby | 72105 | | St Paul | 72116 |
| Port Colborne | 72107 | | Fort Erie | 72117 |
| King St | 72108 | | Merittville | 72118 |
| HQ | 72120 | | Westwood | 72122 |
| Fitch St | 72121 | | Fleet | 72123 |
| Fallsview | 72124 | | Prince Charles | 72125 |

Exact match only. The whole string has to be right. There is no partial credit and no
autocomplete — same as the real console.

---

# PANEL 4 — THE DEFENSE GRID

> **Four landmarks. One gun. No spare parts.**

| | STRUCTURE | ROLE |
|---|---|---|
| NOTL | **Sir Adam Beck** generating station | Zone |
| NIAGARA FALLS | **Skylon Tower** | Zone |
| **CENTRE** | **RADIO TOWER** | **Your gun** |
| THOROLD | **Welland Canal lift bridge** | Zone |
| PORT COLBORNE | **Robin Hood flour mill** | Zone |

The Radio Tower in the middle is not scenery. **It is the thing that shoots.** If it goes down,
you cannot fire — and the rocks do not stop coming while you wait.

**The run ends when all four zones are gone.** Losing the tower is bad. Losing the zones is fatal.

### Shields

Your tower carries **9 shield points** — three layers of three.

- **Misfire** — 1 point
- **Target hits the tower** — 3 points
- **The shield never regenerates.** What you spend is gone for the rest of the run.

At zero the tower is **exposed**. The next hit destroys it.

### NanoMedic Repair Unit

When the tower falls, a NanoMedic — a space ambulance, because of course it is — is dispatched
to rebuild it. The gun is offline until it finishes. The music degrades to static so you know
exactly how the region feels about this.

**Each repair takes twice as long as the last: 4s → 8s → 16s → 32s.**

> The CARD Shorthand lifeline still works while the tower is rebuilding. It is the only thing
> that does.

### Debris Strike

Calls keep getting routed to zones that are already rubble. Those calls still have to be cleared.

A target landing on a destroyed zone costs you points — but it is **not** a zone loss. Your kill
streak survives it.

---

# PANEL 5 — SCORING

> **A clean kill pays. Everything else in this system is a modifier on that one number.**

Your **base hit** value is set by your rank — it climbs from Trainee to O.A.S. That means every
bonus is worth more at high rank, and every mistake costs more too.

**Your score can never drop below zero.** No single mistake costs more than **−300**.

### Bonuses that multiply the hit

These stack. You can earn all three on one target.

| BONUS | WORTH | HOW |
|---|---|---|
| **PERFECT** | +25% | Zero backspaces on that target |
| **EARLY INTERCEPT** | +50% | Destroyed in the top quarter of the screen |
| **SPEED DEMON** | +15% | Destroyed within 1.5 seconds of it appearing |

**Early Intercept is the biggest single bonus in the game. Kill high.**

### Kill Streak

Consecutive kills without losing a zone.

| STREAK | MULTIPLIER | CALLOUT |
|---|---|---|
| 3–4 | 1.10× | — |
| 5–7 | 1.20× | WARMING UP |
| 8–14 | 1.35× | ON FIRE |
| 15–24 | 1.50× | UNSTOPPABLE |
| **25+** | **1.75×** | **LEGEND MODE** |

### Perfect Streak

Consecutive kills with **zero backspaces**. Pays a one-time flat bonus at each milestone.

**5 → +75 · 8 → +150 · 15 → +400 · 25 → +1,000**

> **One backspace on a target is forgiven. Two breaks the streak** and clears every milestone
> you were building toward. This is what F12 is for.

### Flat bonuses

| | |
|---|---|
| **CLOSE CALL!** +15 | Destroyed in the bottom 10% — a genuine last-second save |
| **ONLINE** +25 | First kill of the session |
| **BACK ONLINE** +25 | Three kills in a row after losing a zone |
| **SYSTEMS CALIBRATED** +50 | Every 500 points earned within a rank |
| **RANK UP!** | Two full base hits, paid on every promotion |

### Penalties

| | |
|---|---|
| **Misfire** | −50, one shield point, all streaks reset |
| **Backspaces** | 1–2: −10% · 3–4: −20% · 5–6: −30 flat · 7+: −50 flat *(highest tier only, counted per target)* |
| **Zone lost** | Free the first time. Then −100, −200, −300 for consecutive losses |
| **Debris strike** | −25% of base hit, capped at −300 |

> **One kill wipes the zone-loss escalation.** If you have just lost two zones, do not panic and
> do not chase — get *any* target down and the counter resets.

---

# PANEL 6 — SHORTHAND COMMENTS

Sub-menu with three entries:

- **6A — HOW BANNERS WORK**
- **6B — MASTER LIST**
- **6C — THE CARD LIFELINE**

---

## 6A — HOW BANNERS WORK

> **Somebody is still running ads during the apocalypse.**

Every so often a satellite tows an advertising banner across the sky. The banner displays the
**full text** of a CAD shorthand comment.

You score it by typing **the code itself, with a leading slash**, before the banner leaves the
screen.

```
   BANNER READS:   Police have been notified
   YOU TYPE:       /PDN
```

- **250 points** each.
- Catch them back to back and you build a **separate chain multiplier, up to 5×.**
- A **wrong** `/code` is a misfire — points, shield, chain gone.
- Letting one drift off untouched just resets the chain. No points lost.

Commands never start with a slash, so `/` is an unambiguous signal. You can answer a banner
mid-flow without your normal typing getting confused.

**The window shrinks as you rank up.** Roughly 16–24 seconds at Trainee, down to 3–5 at O.A.S.

> Banners are free money at low rank. Build the 5× chain while the window is still generous.

---

## 6B — MASTER LIST

> 29 codes. You will not memorize these tonight. That's what the banners are for.

| CODE | MEANING |
|---|---|
| `/PDN` | Police have been notified |
| `/PDE` | Police are enroute |
| `/PDNE` | Police are not yet enroute |
| `/PDO` | Police on scene |
| `/PDC` | Police have cancelled the call |
| `/PDW` | Crew to stage and wait for PD |
| `/FDN` | Fire Department notified |
| `/HCA` | Hot / Cold Weather Advisory — call upgraded |
| `/ERP` | Emergency Room Patch |
| `/ERN` | Emergency Room notified |
| `/BHP` | Base Hospital Patch |
| `/ORNGE` | Air Ambulance notified |
| `/PS` | Paramedic Supervisor notified |
| `/PSR` | Paramedic Supervisor responding to call |
| `/RHP` | Call from Registered Health Professional (Dr's or NH) |
| `/3PTY` | Call received from 3rd / 4th party (PD / FD) caller |
| `/CCC` | Call cancelled by caller |
| `/DD` | Double Dispatch |
| `/ED` | Emergency Disconnect |
| `/UD` | Urgent Disconnect |
| `/UCWA` | Use caution when approaching |
| `/DELAY` | Crew delayed, completing admin duty |
| `/HOLD` | Alert status — call being held due to vehicle count |
| `/RC` | Road closure |
| `/GIS` | Address information for GIS |
| `/ACK` | Shift log acknowledged |
| `/EVENT` | Special Event |
| `/RNE` | Patient assessed / treated & referred |
| `/DNE` | Patient assessed / treated & discharged |

---

## 6C — THE CARD LIFELINE

> **Blanking on a code with the banner already halfway across the sky?**

Type:

```
   CARD Shorthand
```

A card appears showing the banner text and exactly what to type.

### It is not free. This is a cheat with teeth.

| | |
|---|---|
| **The game does not pause.** | Targets keep falling behind the card. |
| **Your input line is locked.** | The only thing the console will accept is the code on that card. You cannot defend anything until you clear it. |
| **Your streaks are already gone.** | Kill streak, perfect streak and banner chain zero out the moment you ask. Win or lose. |
| **Clear it in time** | The banner is destroyed — and pays **nothing**. |
| **Let it escape** | The banner strikes your tower, and you take a **heavy points penalty that scales with your rank.** At the top it is worse than losing a zone. |

If you ask with no banner in the sky, you get `NO BANNER IN RANGE`. No hint, but no punishment
either.

> **Use it to learn a code you genuinely don't know. Do not use it as a reflex.** A failed CARD
> at high rank undoes a full clean kill and then some.

---

# PANEL 7 — DIFFICULTY & RANK

> **Eight ranks. They are the real career ladder, and they behave like it.**

| RANK | DIFFICULTY | POINTS TO REACH | SPEED | SPAWN | MAX ON SCREEN |
|---|---|---|---|---|---|
| Trainee | Novice | 0 | 0.6–0.8× | 5.0–6.5s | 6 |
| Mentoring | Beginner | 2,001 | 0.8–1.0× | 4.5–5.5s | 8 |
| Signed Off | Apprentice | 5,001 | 1.0–1.2× | 4.0–5.0s | 10 |
| Out of Probation | Competent | 10,001 | 1.2–1.4× | 3.5–4.0s | 12 |
| 2 Years In | Proficient | 20,001 | 1.5–1.8× | 3.0–3.5s | 14 |
| Full Time | Advanced | 35,001 | 1.8–2.2× | 2.5–3.0s | 16 |
| Veteran | Elite | 55,001 | 2.5–3.0× | 1.5–2.0s | 20 |
| **O.A.S** | **Expert** | 80,001 | 3.0–4.0× | 0.8–1.2s | **25** |

Ranking up raises your base hit **and** your penalties. High rank is not a victory lap — it is a
harder shift that pays better.

### You don't have to start at the bottom

**MAIN MENU → DIFFICULTY** lets you open at any of the eight. Pick your level and the run starts
at that rank's speed, spawn rate, target count and scoring. An experienced dispatcher should not
have to grind the Trainee ramp to find a challenge.

Two things worth knowing:

1. **Your pick is your floor.** You can be promoted upward, but never demoted below the
   difficulty you chose.
2. **It sticks.** Your choice is remembered between sessions.

Every target also carries a **±15% speed variance**, so no two rocks fall at quite the same rate
even inside a single rank.

> **O.A.S:** sub-second spawns, four-times speed, twenty-five targets in the air at once. This is
> the endgame. Nobody expects you to enjoy it.

---

# PANEL 8 — DISPATCHER'S EDGE

> **Seven things the veterans on this console already know.**

1. **Learn the prepositions before anything else.**
   *to* = ENP · *around / by / at* = LA · *Arriving* = BSE · *Post / Assign / Required / Needed* = AP.
   That is most of the game right there.

2. **F12, not backspace.** Backspaces are the single biggest avoidable points leak in the game.
   Clearing is free. There is no situation where backspacing five characters beats a fresh start.

3. **Kill high.** Early Intercept is +50%. A rock caught near the top is worth half again as much
   as the same rock caught near the bottom.

4. **Protect the streak, not the score.** At 25+ kills every clean call pays 1.75×. One panicked
   misfire throws all of it away. A moment's care beats a fast wrong answer every single time.

5. **One kill resets the collapse.** Just lost two zones? Do not chase the whole screen. Get *any*
   target down and the escalation counter goes back to zero.

6. **Treat CARD as a last resort.** It costs your streak *and* locks you out of defending while
   rocks are falling. It is a learning tool, not a crutch.

7. **Farm banners early.** At Trainee you get up to 24 seconds to answer one. At O.A.S you get
   three. Build the chain while the window is generous.

---

# CLOSING CARD

Shown at the end of Panel 8, and on exit from HOW TO PLAY.

> **ASTEROID COMMAND**
> *A PowerLine Challenge Cartridge*
>
> Every unit number, base code, radio phrase and shorthand comment in this game is drawn from
> real Niagara Region EMS operational data. The rocks are made up. **The commands are not.**
>
> **Type clean. Type fast. Save the region.**

---

# Notes for Claude Code

**These are constraints on the build, not instructions on how to build it.**

1. **Panel menu, not a scroll.** Eight cards, `BACK` on every panel. Panel 6 is the only one with
   sub-pages. No panel should require scrolling on a standard console screen — if one does,
   raise it with Andrew and we will split it rather than shrink the type.

2. **Panel 1 opens by default on first entry only.** After that, HOW TO PLAY should land on the
   card menu so a returning player is one click from the base-number list.

3. **Callout boxes are load-bearing.** The blockquoted callouts (THE TRAP, F12, CARD warning) are
   the parts players actually retain. They need a visually distinct treatment — the Atari-manual
   "warning box" role. They are not decoration.

4. **Tone is fixed.** Do not rewrite this copy to be more explanatory, more polite, or more
   complete. Brevity is the specification. If a mechanic seems under-explained, the fix is a new
   panel, not a longer paragraph.

5. **Do not add mechanics to this manual that are not in it.** Anything omitted here was omitted
   deliberately. Raise additions with Andrew rather than filling gaps.

---

## ⚠ Data Integrity Note (flag for Andrew)

The manual quotes numbers that live in `progression.csv`, `scoring.csv`, `bases.csv` and
`shorthand.csv`. **Hardcoded help text drifts out of sync with the datasets the moment a value
is tuned** — the older `Asteroid_Command_-_Game_Play.docx` already disagrees with the live build
on tower impact damage and on several rank penalty values.

Two options, Andrew's call:

- **(a)** Claude Code renders the numeric tables in Panels 5 and 7 from the CSVs at load, so the
  manual can never go stale. Preferred.
- **(b)** They stay hardcoded, and the Build Procedure gains a standing requirement: *any change
  to a scoring or progression value requires a matching HOW TO PLAY update in the same commit.*

Panels 3 and 6B (base numbers, shorthand list) should be data-rendered in either case — those
lists are long enough that manual maintenance will fail eventually.

**Deliberate omission:** the CARD failure penalty is described qualitatively ("scales with your
rank") rather than as an eight-row table. The player does not need the exact figure to make the
decision, and it is one more thing to keep in sync. The full table stays in the gameplay
reference doc.
