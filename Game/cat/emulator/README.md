# `Game/cat/emulator/` — the C64 drive

EmulatorJS driving the **`vice_x64sc`** libretro core, self-hosted. Loaded into the CAT hub's
play overlay; never opened directly by a player.

## Installing the core (once per machine)

`data/` is **gitignored** — it is ~10–15 MB of third-party GPL build output, and this repo is
public. From this folder:

```
git clone --depth 1 https://github.com/EmulatorJS/EmulatorJS.git _ejs
mv _ejs/data data
rm -rf _ejs
```

Nothing else needs configuring. `emu.js` already points at `data/` and asks for the `c64` core,
which carries the KERNAL / BASIC / CHARGEN ROMs itself — **there is no ROM-supply step.**

Until you do this, the page says so in plain words and names the command. That is a normal
state, not a fault.

## 🚨 It cannot run from `file://`

WebAssembly is instantiated through `fetch`, and `fetch` refuses the `file:` scheme. The native
failure is a bare *"Failed to fetch"* that sends you looking for a missing file, so `emu.js`
checks the scheme first and says what is actually wrong.

- **In Fang Rock:** apply `arcade-origin.patch.md` (filed to the shell track) so the arcade is
  served from a real origin instead of `file://`.
- **For dev:** `python -m http.server 8899` from the `(PCL)` repo root.

The PLC cartridges are unaffected either way — they keep working from `file://` as they always
have.

## ⚠️ First-run checklist — three things that are written but not yet watched working

`data/` was absent when this was built, so there was no core to run and no disk to run in it.
These three are written against EmulatorJS's documented surface and each **fails loudly and
names itself** rather than degrading quietly. Check them in this order the first time:

| # | Check | Where it lives | If it's wrong |
|---|---|---|---|
| 1 | The core loads and a disk autostarts | `EJS_core` / `EJS_gameUrl` | The page will already be telling you which step failed |
| 2 | **Ctrl fires**, arrows move | `EJS_defaultControls`, player 0, index 0 = B | Remap the index; the C64 stick has one button, so a second binding does nothing |
| 3 | **A two-disk game swaps without resetting** | `swapDisk()` — three API shapes tried in order | It reports `cat:swapfailed` and the hub offers an explicit restart. 🚫 Never make that restart automatic |

Also unverified: the joystick-port option pair (`vice_joyport` / `"1"` `"2"`). If the hub's port
flip appears to do nothing, check that key and value against the core's own option list before
suspecting the button.

## Why this core

Full VICE. Its 1541 emulation is the reason a folder of *cracked* `.d64` images actually runs —
fastloaders and custom formats are where lighter cores fall over. Autostart is the core's own
default behaviour.

**Fallback** if EmulatorJS's chrome ever spoils the Tommodore look: [vc64web](https://vc64web.github.io/).
**Rejected:** native `x64sc.exe` — a second OS window exits to the desktop, not to the hub.
