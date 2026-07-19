# Pitstop — `files/assets/`

Raster art (Gemini PNGs) for the Pitstop cartridge lands here.

Paths in `files/core/config.js` are relative to `files/` (where `index.html` lives),
so a file dropped here as `region_map.png` is referenced in config as `assets/region_map.png`.

## Config hooks that consume files from this folder

| Config (`files/core/config.js`) | Expected file | Status |
|---|---|---|
| `REGION_MAP.image` + `REGION_MAP.bounds` | `assets/region_map.png` | dormant (`null`) — map renders as SVG vector until set |
| `ROAD_VIEW.image` | `assets/road_loop.png` | dormant (`null`) — road is a procedural CSS scene; see `../Pitstop_Art_Brief.md` before using |

## Car sprites (OutRun banking cars)

Hero cars go in `cars/` — 5 selectable units × 3 frames each (straight + 2 right-leans;
the engine mirrors the leans for left curves):

    cars/{unit}_c.png    cars/{unit}_r1.png    cars/{unit}_r2.png

e.g. `cars/2107_c.png`. The unit number and shadow render as DOM layers on top, so sprites
carry **no baked digits**. Full spec: `../Pitstop_Car_Sprite_Brief.md`.

Frames are picked up **independently** — `_c` on its own already puts that unit's car on
the road (it fake-leans through bends, as the placeholder did); adding `_r1`/`_r2` upgrades
it to real banking art. Today all five units ship `_c` only, so the lean frames are the
outstanding art ask.

## Other targets

See `../Pitstop_Art_Brief.md` for the region map + hub tile — exact specs, and which
targets are clean drop-ins vs. a Design decision.
