# Asteroid Command — Gameplay Reference

*Niagara Region Defense System — a typing-defense dispatcher trainer.*

This document describes exactly how the game behaves as built. All numbers are pulled from
the live datasets (`files/datasets/`) and config (`files/core/config.js`). Where a value comes
from a CSV, the file is named so it can be traced.

---

## 1. The Premise

You are a dispatcher at the Niagara Region defense console. Inbound targets ("asteroids")
fall toward five landmarks along the escarpment. Each target carries a plain-language
**challenge**. You destroy it by translating that challenge into **PowerLine** — the CAD
command language — and typing it correctly before it lands.

You are not aiming. You are not dodging. **Typing the right command *is* the shot.**

### What you are defending

| Zone | Landmark | Type |
|---|---|---|
| NOTL | Sir Adam Beck generating station | Zone |
| NIAGARA FALLS | Skylon Tower | Zone |
| **RADIO TOWER** | The transmitter | **Your gun** |
| THOROLD | Welland Canal lift bridge | Zone |
| PORT COLBORNE | Robin Hood flour mill | Zone |

The **Radio Tower** is the middle structure and it is not just scenery — it is what fires.
If it goes down you cannot shoot until a repair unit arrives.

**The run ends when all four zones are destroyed.** The tower being down does not end the
run; losing every zone does.

---

## 2. How to Shoot — Speaking PowerLine

Every target displays two things: a **unit number** and a **challenge phrase** naming a base.

```
        2105
   Mobile to Westwood
```

You answer with three parts, space-separated:

```
   <COMMAND CODE>  <UNIT>  <BASE NUMBER>
```

So the target above is destroyed by typing:

```
   ENP 2105 72122
```

Press **Enter** to fire. The match is exact — the whole string must be right. There is no
partial credit and no autocomplete.

### The four command codes

The challenge phrase tells you which code to use. Phrasings come from `commands.csv`:

| Code | Meaning | Challenge phrases that map to it | Type |
|---|---|---|---|
| **AP** | Assign / post a unit to a base | Post to · Assign to · Required at · Needed at | direction |
| **ENP** | Enroute — unit is travelling | Enroute to · Mobile to · On our way to · Heading to | radio |
| **BSE** | On scene / arrived at base | Arriving · Arriving at · Made it to · At | radio |
| **LA** | Local area — mobile in a district | Mobile around · On the air by · Area of · Staying local at | radio |

> **The trap:** "Mobile **to** Westwood" is **ENP**. "Mobile **around** Westwood" is **LA**.
> One preposition changes the answer. This is the core skill the game trains.

### The base numbers

The challenge names a base in plain English; you type its number. From `bases.csv`:

| Base | # | | Base | # |
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

Units are the four-digit car numbers (2100, 2101, 2102 …) from `units.csv`. The unit is shown
on the target — you just retype it.

### What happens when you get it wrong

Any command that matches no target on screen is a **misfire**:

- **−50 points**
- **1 shield damage**
- Kill streak → 0, perfect streak → 0, banner chain → 0
- Message: `MISFIRE -50 — SHIELD ABSORBS`

Pressing Enter on an **empty** box while targets are up is also a misfire (`NO COMMAND`).

If the shield is already at zero, a misfire produces `SYSTEM FAILURE` instead and the gun
fires wild.

---

## 3. Keyboard Reference

| Key | Effect |
|---|---|
| **Enter** | Fire — submit the command |
| **F12** | **Clear the command box.** Wipes the input to a clean slate without firing. No penalty, no cost. Use it the instant you realise you've typed garbage — it is strictly better than backspacing, because **backspaces cost points and F12 does not.** |
| **Escape** | Pause / resume |
| **Backspace** | Corrects a character — but see the typing penalties below. Counted per target. |
| Arrow keys | Navigate menus |
| Any key | Activate the highlighted menu button |

> **F12 is the single most underused key in the game.** Backspacing five characters costs you
> −30 and breaks your perfect streak. Hitting F12 and retyping costs nothing at all. If the
> command is more than one or two characters wrong, clear it and start over.

---

## 4. How Points Work

### The pipeline

Every kill is scored in this exact order (`scoring.csv`, `calcScore()`):

```
  Base Hit
    → + multiplier bonuses   (Perfect, Early Intercept, Speed Demon — additive)
    → × kill-streak multiplier
    → + flat bonuses         (milestones, Close Call, First Blood)
    → − typing penalties
    → score floor at 0
```

**Your score can never go below zero.** Penalties that would take you negative just park you
at 0.

### Base Hit — what a clean kill is worth

Base Hit is set by your current rank (`progression.csv`), from **+100** at Trainee to
**+1,200** at O.A.S. Everything else in the scoring system is a multiplier or a modifier of
this number, which is why the same mistake costs far more at high rank.

### Bonuses that multiply the Base Hit

These stack additively — you can earn all three on one kill (+0.9× Base Hit).

| Bonus | Value | Condition |
|---|---|---|
| **PERFECT** | +0.25× | Zero backspaces on that target |
| **EARLY INTERCEPT** | +0.50× | Destroyed in the **top 25%** of the screen |
| **SPEED DEMON** | +0.15× | Destroyed within **1.5 seconds** of it spawning |

### Kill-streak multiplier

Applied after the bonuses above. A streak is consecutive kills **without losing a zone**.

| Streak | Multiplier | Callout |
|---|---|---|
| 0–2 | 1.0× | — |
| 3–4 | 1.1× | — |
| 5–7 | 1.2× | WARMING UP |
| 8–14 | 1.35× | ON FIRE |
| 15–24 | 1.5× | UNSTOPPABLE |
| 25+ | **1.75×** | LEGEND MODE |

### Flat bonuses

| Bonus | Value | Condition |
|---|---|---|
| **CLOSE CALL!** | +15 | Destroyed in the bottom 10% of the screen — a genuine last-second save |
| **ONLINE** | +25 | First kill of the session |
| **BACK ONLINE** | +25 | Three kills in a row after losing a zone |
| **SYSTEMS CALIBRATED** | +50 | Every 500 points earned within a rank — repeatable |
| **RANK UP!** | 2× new rank's Base Hit | One-time, on each promotion |

### Perfect-streak milestones

Consecutive **zero-backspace** kills. One-time each per streak.

| Streak | Bonus | Callout |
|---|---|---|
| 5 | +75 | LOCKED IN |
| 8 | +150 | EXCELLENT |
| 15 | +400 | UNSTOPPABLE |
| 25 | **+1,000** | LEGEND |

**Streak forgiveness:** one backspace on a target is forgiven and keeps the perfect streak
alive. **Two or more backspaces on a single target breaks it** and clears all milestones.

### Typing penalties

Counted **per target**. Only the highest applicable tier is charged — they don't stack.

| Backspaces | Penalty | Callout |
|---|---|---|
| 1–2 | −10% of Base Hit | KEY DUST |
| 3–4 | −20% of Base Hit | SIGNAL NOISE |
| 5–6 | −30 flat | COMMS DRIFT |
| 7+ | −50 flat | STATIC JAM |

*(Again: **F12 costs nothing.** Clearing and retyping is free.)*

### Losing a zone

The penalty escalates only for zones lost **back to back**. Destroying any target resets the
counter, so one clean kill wipes the escalation.

| Consecutive zone loss | Penalty | Callout |
|---|---|---|
| 1st | 0 | BASE LOST |
| 2nd | −100 | SECTOR BREACH |
| 3rd | −200 | CRITICAL FAILURE |
| 4th+ | −300 (capped) | SYSTEM COLLAPSE |

Losing a zone also zeroes your kill streak and perfect streak.

### Debris Strike

Targets keep getting aimed at zones that are already rubble. Those calls still have to be
cleared. If one lands on a destroyed zone:

- **−25% of Base Hit** (capped at −300)
- It is **not** a zone loss — the consecutive counter and your kill streak are untouched

### Penalty caps

No single event deducts more than **−300**. This is deliberate: it prevents death spirals at
high rank.

---

## 5. Shields and the Tower

- **Shield strength: 9 points**, shown as a nine-block bar.
- **Three diamonds** = three shield layers of 3 HP each. Top = HP 7–9, middle = 4–6, bottom = 1–3.
- A **misfire** costs 1 shield. A **target hitting the Radio Tower** costs 3.
- **The shield never regenerates.** There is no way to get it back during a run.

When the shield hits zero the tower is **exposed**. The next tower impact destroys it: the
gun stops firing, the music degrades to static, and a repair unit is dispatched.

**Repair time doubles each occurrence** — 4s, then 8s, then 16s, then 32s. While the tower is
down and rebuilding you cannot shoot at all, and targets keep coming.

> Note: the CARD Shorthand lifeline still works while the tower is rebuilding.

---

## 6. Shorthand Comments — the Satellite Banner Bonus

Periodically a **satellite** tows an advertising banner across the top of the sky. The banner
shows the **expanded text** of a CAD shorthand. You score by typing the **shorthand code
itself**, with a leading slash, before the banner leaves the screen.

```
   Banner reads:   Police have been notified
   You type:       /PDN
```

- Worth **250 points** each (the default; `shorthand.csv` may carry a `Points` column to vary this).
- Catching them back-to-back builds a **separate chain multiplier up to 5×**.
- A **wrong** `/code` is a misfire: −50, shield damage, and the chain resets.
- Letting a banner leave the screen untouched resets the chain (no points lost).
- Commands never start with `/`, so the slash is an unambiguous signal — you can answer a
  banner without disturbing your normal typing flow.

Timing tightens with rank. Rough on-screen windows: **Trainee ~16–24s · Signed Off ~11–16s ·
Full Time ~6–8s · O.A.S ~3–5s.**

### The full shorthand list

From `files/datasets/shorthand.csv` — 29 codes.

| Code | Expanded |
|---|---|
| `/PDN` | Police have been notified |
| `/PDE` | Police are enroute |
| `/PDNE` | Police are not yet enroute |
| `/PDO` | Police on scene |
| `/PDC` | Police have cancelled the call |
| `/PDW` | Crew to stage and wait for PD |
| `/FDN` | Fire Department Notified |
| `/HCA` | Hot / Cold Weather Advisory — Call Upgraded |
| `/ERP` | Emergency Room Patch |
| `/ERN` | Emergency Room Notified |
| `/BHP` | Base Hospital Patch |
| `/ORNGE` | Air Ambulance Notified |
| `/PS` | Paramedic Supervisor Notified |
| `/PSR` | Paramedic Supervisor responding to call |
| `/RHP` | Call from Registered Health Professional (Dr's or NH) |
| `/3PTY` | Call received from 3rd/4th party (PD/FD) caller |
| `/CCC` | Call Cancelled by Caller |
| `/DD` | Double Dispatch |
| `/ED` | Emergency Disconnect |
| `/UD` | Urgent Disconnect |
| `/UCWA` | Use Caution When Approaching |
| `/DELAY` | Crew Delayed, completing admin duty |
| `/HOLD` | Alert Status — Call being held due to vehicle count |
| `/RC` | Road Closure |
| `/GIS` | Address Information for GIS |
| `/ACK` | Shift Log Acknowledged |
| `/EVENT` | SpecialEvent923 |
| `/RNE` | Patient assessed/treated & referred |
| `/DNE` | Patient assessed/treated & discharged |

---

## 7. The CARD Shorthand Helper (mid-game lifeline)

Blanking on a code while the banner is flying? Type:

```
   CARD Shorthand
```

A card appears showing the banner text and exactly what to type — e.g. *"Type `/PDN` in
PowerLine"*.

**It is not free.** This is a deliberate cheat with teeth.

### The rules

| | |
|---|---|
| **The game does not pause.** | Targets keep falling behind the card. |
| **Your input line is locked.** | The *only* accepted entry is the code on the card. You cannot defend anything until you clear it. |
| **Asking resets your streak.** | Kill streak, perfect streak and banner chain all go to zero the moment you ask — win or lose. |
| **Clear it in time** | The banner is destroyed but scores **nothing**. |
| **Let it escape** | The banner hits your **tower** (shield damage) and you take a **heavy points penalty**. |

### The failure penalty

**2× your current rank's impact penalty** — it scales, so this hurts far more the better you are:

| Rank | Penalty for a failed CARD |
|---|---|
| Trainee | −100 |
| Mentoring | −120 |
| Signed Off | −200 |
| Out of Probation | −300 |
| 2 Years In | −450 |
| Full Time | −600 |
| Veteran | −1,000 |
| O.A.S | **−1,200** |

### Accepted phrasings

The help screen only tells the player **CARD Shorthand**, to keep it simple. In practice the
parser is forgiving — punctuation and slashes are stripped before matching — but **every
variant must start with the word CARD**:

`CARD SHORTHAND` · `CARD SHORTHAND COMMENT` · `CARD SHORTHANDS` · `CARD SHORT HAND` ·
`CARD SHORT HAND COMMENT` · `CARD SH` · `CARD HELP` · `CARD`

The CARD prefix exists so the trigger can never fire by accident during normal play.

If you ask with no banner in the sky you get `NO BANNER IN RANGE` — no hint, but no
punishment either.

---

## 8. Difficulty and Rank

### Rank progression

There are eight ranks. Normally you climb them by earning points; each promotion pays a
**Rank-Up Bonus of 2× the new rank's Base Hit**.

| Rank | Difficulty | Points | Speed | Spawn | Max on screen | Clean kill | Impact |
|---|---|---|---|---|---|---|---|
| Trainee | **Novice** | 0 | 0.6–0.8× | 5.0–6.5s | 6 | +100 | −50 |
| Mentoring | **Beginner** | 2,001 | 0.8–1.0× | 4.5–5.5s | 8 | +125 | −60 |
| Signed Off | **Apprentice** | 5,001 | 1.0–1.2× | 4.0–5.0s | 10 | +200 | −100 |
| Out of Probation | **Competent** | 10,001 | 1.2–1.4× | 3.5–4.0s | 12 | +300 | −150 |
| 2 Years In | **Proficient** | 20,001 | 1.5–1.8× | 3.0–3.5s | 14 | +450 | −225 |
| Full Time | **Advanced** | 35,001 | 1.8–2.2× | 2.5–3.0s | 16 | +600 | −300 |
| Veteran | **Elite** | 55,001 | 2.5–3.0× | 1.5–2.0s | 20 | +850 | −500 |
| O.A.S | **Expert** | 80,001 | 3.0–4.0× | 0.8–1.2s | 25 | +1,200 | −600 |

The rank names are the dispatcher career ladder; the difficulty names (Novice → Expert) are
the plain-English equivalent shown on the DIFFICULTY menu.

### Choosing your starting difficulty

**Main Menu → DIFFICULTY** opens a dropdown. Pick any of the eight and the run **opens at
that rank's speed, spawn rate, target count and scoring.** An experienced dispatcher does not
have to grind through the Trainee ramp.

Two things worth knowing:

1. **Your pick is also your floor.** You can still be promoted upward by points, but you will
   never be demoted below the difficulty you chose. Starting at Expert with a score of 0
   would otherwise demote you straight back to Trainee.
2. **It persists.** Your choice is remembered between sessions.

Per-target speed also carries a **±15% random variance**, so no two targets fall at exactly
the same rate even within a rank.

---

## 9. Menus

| Menu | What it does |
|---|---|
| **BEGIN MISSION** | Start a run at your selected difficulty |
| **HOW TO PLAY** | In-game version of this document — CARD Shorthand, scoring, streaks, commands, full shorthand list |
| **DIFFICULTY** | Dropdown selector, with a live readout of that rank's shift conditions |
| **SCORING & PROGRESSION** | The rank ladder and scoring reference |
| **SETTINGS** | Music and SFX toggles |
| **HIGH SCORES** | Top 10 dispatchers |

---

## 10. Quick Strategy Notes

1. **Learn the preposition traps first.** *to* = ENP, *around/by/at* = LA, *Arriving* = BSE,
   *Post/Assign/Required/Needed* = AP. This is most of the game.
2. **Use F12 instead of backspace.** Backspaces are the single most common avoidable points
   leak. Clearing is free.
3. **Kill high.** Early Intercept is +50% — the biggest single bonus available. Targets caught
   near the top are worth half again as much.
4. **Protect the streak, not the score.** At 25+ kills every clean call is worth 1.75×. One
   misfire throws that away — a moment's care is worth more than a fast wrong answer.
5. **One kill resets the zone-loss escalation.** If you've just lost two zones, get *any*
   target down before worrying about the rest.
6. **Treat CARD Shorthand as a last resort.** It costs your streak *and* locks you out of
   defending. At high rank a failed CARD (−1,200) undoes a full clean kill and then some.
7. **Banners are free money at low rank** — 16–24 seconds is a long time. Build the 5× chain
   early while the window is generous.

---

## Appendix — Where the numbers live

| Data | File |
|---|---|
| Rank ladder, speeds, difficulty labels | `files/datasets/progression.csv` |
| Full scoring rules | `files/datasets/scoring.csv` |
| Command codes and phrasings | `files/datasets/commands.csv` |
| Base names → numbers | `files/datasets/bases.csv` |
| Unit numbers | `files/datasets/units.csv` |
| Shorthand codes | `files/datasets/shorthand.csv` |
| Shield/damage, satellite, CARD lifeline tuning | `files/core/config.js` |
