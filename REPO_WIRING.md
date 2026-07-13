# PowerLine Challenge — GitHub Wiring

_For Chat / Design · prepared by Claude Code (Systems Integrator) · 2026-07-12_

> **Heads up — the structure is the opposite of what was assumed.** PLC was **not** folded
> into the Aquanaut repo as a subfolder. Everything was consolidated into a **new repo where
> PLC is the root**, and The Aquanaut is now just one cartridge folder *inside* it. The old
> Aquanaut repo is a read-only archive now — **do not point at it.**

## 1. Repo URL
**`https://github.com/darqueshadow/PowerLine-Challenge`**

(Ignore `github.com/darqueshadow/The-Aquanaut---Below-The-Black` — that's the old, now-private
history archive, not the working repo.)

## 2. Public or private
**Public.** No access grant, authorization, or login needed — read it directly.

## 3. Where PLC lives in the repo
**At the root — the repo *is* the PLC project.** Key paths:

| Path | What it is |
|---|---|
| `Game/index.html` | The arcade **hub** (main menu / entry point) |
| `Game/cartridges/` | The games — one folder each |
| `Game/cartridges/Asteroid Command/` | Asteroid Command cartridge |
| `Game/cartridges/The Aquanaut/` | The Aquanaut cartridge **(the active one)** |
| `Game/cartridges/Pitstop/` | Pitstop cartridge (shell) |
| `Game/cartridges/blank/` | Empty template |
| `Game/core/`, `Game/styles/`, `Game/assets/`, `Game/datasets/` | Shared hub code / art / data |
| `Documents/` | Governance docs |
| `Archive/`, `Future Builds/` | Old / scratch material |

> ⚠️ **Naming landmine (read this):** cartridge folder names use **spaces and Title Case**
> (e.g. `The Aquanaut`, `Asteroid Command`) and **GitHub Pages is case-sensitive** —
> `asteroid-command` ≠ `Asteroid Command`, and `-` ≠ a space. Match folder names *exactly* or
> links 404 on the live site (this already bit the hub once and had to be fixed).

## 4. Branch
**`main`** — single branch, everything is merged there. No temporary dev/working branch.

## 5. What changed (summary)
- Consolidated the **entire PLC project** (hub + all cartridges + Documents + Archive + Future
  Builds) into the new `PowerLine-Challenge` monorepo (fresh git history).
- **Before:** only The Aquanaut was version-controlled (its own repo). **After:** The Aquanaut
  is one subfolder among the cartridges; the old repo is kept as a private archive.
- Made the new repo **public**.
- Set up **GitHub Pages** via a GitHub Actions workflow that publishes the `Game/` folder.
- Fixed a hub cartridge-launch path bug (Asteroid Command).

## Bonus — the live hub
Prefer to look at the running site instead of the code?
**→ https://darqueshadow.github.io/PowerLine-Challenge/**
(Only *Blank* and *Asteroid Command* are wired into the menu so far; Aquanaut/Pitstop files are
deployed but not yet added to the hub menu.)

---
**Not included on purpose:** no logins, tokens, or credentials — none are needed to read a
public repo, and none should ever live in a doc like this.
