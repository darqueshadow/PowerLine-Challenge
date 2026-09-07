# `Game/disks/` — the C64 disk library

Drop `.d64` / `.t64` / `.prg` / `.g64` / `.tap` / `.crt` files straight into this folder.
The CAT hub reads whatever is here **at runtime** — there is no manifest to regenerate,
no count written down anywhere, and nothing to rebuild. Add a disk, reload the hub, it's
in the box.

## 🚨 Nothing in here is committed, and that is deliberate

`PowerLine-Challenge` is a **public** repo that publishes to GitHub Pages
(`REPO_WIRING.md` §2: *"Public. No access grant, authorization, or login needed"*), and
unlike the `+Nerva Beacon` repo it has **no `githooks/pre-push` to refuse a push**. A disk
image committed here is a disk image on the public internet, permanently — deleting it
afterwards does not undo that, because GitHub keeps unreachable objects and forks keep
copies.

So the repo's `.gitignore` excludes everything in this folder except this README. 🚫 **Do
not "fix" that by un-ignoring it.** The folder travelling empty is the intended behaviour.

## What that means for a fresh clone

**An empty library is the NORMAL state, not an error.** A clone on a new machine has no
disks, the hub says so plainly in the terminal, and the PLC cartridges work exactly as they
always did. Copy your own files in when you want them.

## Multi-disk titles

Name the sides so the hub can group them into one disk. Any of these work:

```
Airborne Ranger - d1.d64      Airborne Ranger - d2.d64
Maniac Mansion (Disk 1).d64   Maniac Mansion (Disk 2).d64
Zak McKracken - Side A.d64    Zak McKracken - Side B.d64
```

They appear in the box as **one** entry — "Airborne Ranger", 2 disks — and the play bar
grows a disk selector while the game is running.

⚠️ The grouping is on the **base name**, so the parts must match exactly apart from the
side marker. `Afterburner - d1.d64` and `After Burner - d2.d64` are two different games as
far as the hub is concerned.

## Favourites

Optional. Create `_favourites.txt` in this folder, one filename per line:

```
# lines starting with # are ignored
Airborne Ranger - d1.d64
Paradroid.d64
```

Those disks sort to the front of the box. Everything else follows alphabetically, mixed in
with the PLC cartridges — the box makes no distinction between a cartridge and a disk.
Without the file, everything is simply alphabetical.

📌 Name a title by **any one of its sides**; the whole group is lifted.
