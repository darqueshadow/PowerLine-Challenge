# `Game/cat/assets/disk-art/` — the picture of each disk

Drop one image per disk straight into this folder. When a disk is selected in the CAT hub,
its image shows in the preview frame under the crates. There is no manifest and nothing to
regenerate. Add an image, reload the hub, and it's there.

## Naming

Name the image after the disk, and keep the image's own extension. Case doesn't matter.

| the disk | any of these images match |
|---|---|
| `Paradroid.d64` | `Paradroid.png` |
| `Airborne Ranger - d1.d64` + `- d2.d64` | `Airborne Ranger.png` · `Airborne Ranger - d1.png` |
| the **Asteroid Command** cartridge | `Asteroid Command.png` (a cartridge has no disk file, so it goes by its name in the crate) |

Formats: `.png` `.webp` `.jpg` `.jpeg` `.gif`. If one name exists in two formats, the first in
that list wins.

⚠️ A name shared by two entries matches **both**. The crates currently hold a *Pitstop*
cartridge **and** a *Pitstop* cracked disk, so `Pitstop.png` shows for both of them.

## When there's no image

The frame shows the disk's screenshot if `games.js` has one (today only Asteroid Command
does). Otherwise it shows a blank sleeve labelled **NO ART YET**. That's the normal state
for most disks, not an error. A file that is present but won't open gets the same blank
sleeve rather than a dark frame.

## Where the images show

The hub finds the images by **listing this folder**, the same way it finds the disks. So
they show wherever the disk list works: inside **Fang Rock**, and on the local dev server
(`python -m http.server`). On `file://` and on the public Pages site a folder cannot be
listed, so there every disk shows its screenshot or the blank sleeve.

## 🚨 Nothing in here is committed

Same rule as `Game/disks/`, for the same reason: this repo is **public** and publishes to
GitHub Pages, and box art and sleeve scans of commercial games are other people's artwork.
`.gitignore` excludes everything in this folder except this README. 🚫 Don't "fix" that by
un-ignoring it. If a PLC cartridge's own art should ever travel with the repo, that is a
separate decision to make on purpose.
