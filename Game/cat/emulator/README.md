# `Game/cat/emulator/` — the C64 drive

EmulatorJS driving the **`vice_x64sc`** libretro core, self-hosted. Loaded into the CAT hub's
play overlay; never opened directly by a player.

## Installing the core (once per machine)

`data/` is **gitignored** — it is ~10–15 MB of third-party GPL build output, and this repo is
public.

🚨 **THIS IS TWO DOWNLOADS, NOT ONE.** The clone gives you the **loader**; it leaves
`data/cores/` holding nothing but a `README.md` and a `package.json`. **The core is a separate
package.** Corrected 2026-09-08 — the earlier instructions here stopped after step 1 and were
wrong.

From this folder:

```
# 1. the loader
git clone --depth 1 https://github.com/EmulatorJS/EmulatorJS.git _ejs
mv _ejs/data data
rm -rf _ejs

# 2. the CORE — the clone does NOT include this.
#    Match the version in data/version.json.
npm install @emulatorjs/core-vice_x64sc@4.2.3
mkdir -p data/cores/reports
cp node_modules/@emulatorjs/core-vice_x64sc/vice_x64sc-*.data data/cores/
cp node_modules/@emulatorjs/core-vice_x64sc/reports/vice_x64sc.json data/cores/reports/
rm -rf node_modules package.json package-lock.json
```

`data/cores/` should end up holding four `vice_x64sc-*.data` builds (~6 MB) and
`reports/vice_x64sc.json`. EmulatorJS picks between the plain and `-legacy` builds at runtime
from what the browser supports, which is why all of them are copied.

### 🔴 Why step 2 matters more than it looks

**If the core is missing, EmulatorJS does not fail — it silently fetches the core from
`cdn.emulatorjs.org` at runtime.** Two problems with that: the arcade is not allowed to need the
internet to run, and a core quietly arriving over the network makes the emulator *look* like it
works, which hides whatever else is wrong. On 2026-09-08 that masked a disk-path 404 in the hub
and sent the investigation at the core instead.

`emu.js` now checks for the **core**, not just the loader, and refuses with a named message
before EmulatorJS ever gets the chance to reach for the CDN. ⚠️ The old check HEAD-ed
`data/loader.js` alone, so once `data/` existed it could never fail — the "no core" message was
unreachable on exactly the machines that had no core.

`emu.js` already points at `data/` and asks for the `c64` core, which carries the KERNAL / BASIC
/ CHARGEN ROMs itself — **there is no ROM-supply step.**

## 🚨 It cannot run from `file://`

WebAssembly is instantiated through `fetch`, and `fetch` refuses the `file:` scheme. The native
failure is a bare *"Failed to fetch"* that sends you looking for a missing file, so `emu.js`
checks the scheme first and says what is actually wrong.

- **In Fang Rock:** apply `arcade-origin.patch.md` (filed to the shell track) so the arcade is
  served from a real origin instead of `file://`.
- **For dev:** `python -m http.server 8899` from the `(PCL)` repo root.

The PLC cartridges are unaffected either way — they keep working from `file://` as they always
have.

## Input modes — joystick and keyboard, never both

A C64 needs the keyboard for a loader menu or a Y/N prompt and the stick for the game, and
**EmulatorJS treats those as one mode**: `keyChange()` returns early while its `keyboardInput`
setting is `enabled`, so the RetroPad mapping (Ctrl + arrows) is bypassed wholesale the moment
free keyboard input is on. It is therefore a *mode switch*, not a preference.

His ruling, 2026-09-08 — a **hub-level toggle**, not a per-title default and not left to
EmulatorJS's own settings menu: most disks hit a menu or a prompt before the game starts, and a
real session flips between the two constantly, so pre-classifying a disk would describe a session
that does not happen.

- The play bar's **Input:** button names the mode that is live. Click it, or press **F2**.
- The label is painted from the cartridge's own report, never assumed — `emu.js` owns the truth.

### ✅ The exit key is F10 (was Shift/Ctrl+Escape) — resolved 2026-09-16

This used to be a parked limitation: Shift+Escape was the exit chord, so **Shift+RUN/STOP could
not reach a running game**. The concrete case Andrew was waiting for arrived with the real C64
screen — 63 of the 108 disks are tapes, and Shift+RUN/STOP is how a tape loads — and he moved
the exit to **F10**. Escape and Shift+Escape now reach the core as RUN/STOP and Shift+RUN/STOP.
F10, like F2 and F9, is not a key a C64 has. `emu.js` and `cat.js` each hold `HOTKEY_EXIT`.

## 🆕 The machine — `index.html?machine=1` (2026-09-16)

In cracked mode (inside Fang Rock, or `?cart=cracked`) the hub puts a **real C64 at `READY.`** on
the CAT computer's screen, and its buttons type into it. `emu.js` ("THE MACHINE") has the full
reasoning; the measured facts it rests on:

- **Boot with no game:** EmulatorJS will not start without one, so it boots on an in-memory zip
  (an `.m3u` + five slot images, the blank disk and tape built byte by byte). `vice_autostart`
  disabled, and **`EJS_disableLocalStorage` is what makes the options apply at boot** — without
  it, a fresh profile boots with the defaults and autostart has already typed `LOAD"*",8,1`.
- **Insert into the running machine:** write the image over a slot, `gameManager.setCurrentDisk(i)`.
  No reset. A zero-byte slot is a truly empty drive.
- **Tapes (`.T64`) need `vice_virtual_device_traps` enabled**, or a typed `LOAD` never finishes —
  and **only tapes**: it is switched on when a tape goes in and off for a disk. With it always on,
  disk loads ran twice as slow and one in a few rig runs hung at `LOADING`.
- **Typing** goes to `EJS_emulator.elements.parent` (not window or document), timed in **emulated
  frames**. The machine runs on the **positional** keymap, for buttons and people alike (Andrew's
  ruling, 2026-09-17): a key types what sits in that place on a real C64, so `"` is Shift+2 and
  `*` is `]`. The symbolic one (PC labels, Shift+' is a quote) races on `*` `+` `:` `@` — about
  one `*` in ten came out as SHIFT+*. Positional was 40/40.
- **Proof:** `../verify-c64.mjs` runs under the shell's own Electron and reads the C64's screen
  memory. Headless Chrome cannot run the core at all.

✅ **Disk swapping in the play overlay** (the ordinary hub, outside Fang Rock) was fixed on
2026-09-17, in line with the machine's swap. It used to try three method names EmulatorJS 4.2.3
does not have and hand the core side 1 only. Now a game with more than one side boots on an
in-memory **playlist** (an `.m3u` zipped with every side, like the machine's boot media), and a
swap is `gameManager.setCurrentDisk(n)`: the running game is not reset. A one-sided game still
boots on its image directly. `../verify-c64.mjs` §K proves it in a window without Fang Rock.

## ⚠️ First-run checklist — three things that are written but not yet watched working

`data/` was absent when this was built, so there was no core to run and no disk to run in it.
These three are written against EmulatorJS's documented surface and each **fails loudly and
names itself** rather than degrading quietly. Check them in this order the first time:

| # | Check | Where it lives | If it's wrong |
|---|---|---|---|
| 1 | The core loads and a disk autostarts | `EJS_core` / `EJS_gameUrl` | The page will already be telling you which step failed |
| 2 | **Ctrl fires**, arrows move | `EJS_defaultControls`, player 0, index 0 = B | Remap the index; the C64 stick has one button, so a second binding does nothing |
| 3 | **A two-disk game swaps without resetting** ✅ 2026-09-17 | `swapDisk()` — `setCurrentDisk` over a playlist of every side | It reports `cat:swapfailed` and the hub offers an explicit restart. 🚫 Never make that restart automatic |

Also unverified: the joystick-port option pair (`vice_joyport` / `"1"` `"2"`). If the hub's port
flip appears to do nothing, check that key and value against the core's own option list before
suspecting the button.

## Why this core

Full VICE. Its 1541 emulation is the reason a folder of *cracked* `.d64` images actually runs —
fastloaders and custom formats are where lighter cores fall over. Autostart is the core's own
default behaviour.

**Fallback** if EmulatorJS's chrome ever spoils the Tommodore look: [vc64web](https://vc64web.github.io/).
**Rejected:** native `x64sc.exe` — a second OS window exits to the desktop, not to the hub.
