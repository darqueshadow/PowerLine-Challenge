"""Egg Timer hatchling art (E45, Andrew's six sheets approved as they are, 2026-09-27): cut each alien's puppet pieces.
    python make-alien-art.py     (from this folder; needs Pillow and numpy)
Reads files/assets/imgages/cute_crab.jpg, horror_scuttler.jpg, cute_worm.jpg, horror_wriggler.jpg, horror_grabber.jpg
(the wrong-run Grabber sheet: only its drips are used) and the two concept crops
concept_octopus.jpg / concept_grabber.jpg (the octopus and Grabber bodies, whole: Andrew's call, 2026-09-27).
Writes files/art/hatch-<alien>--<part>@2x.png and files/core/alien-parts.js (each part's size in the nest's viewBox
units, which core/aliens.js reads to lay the puppets out). Never deployed (*.py).

A piece is picked by a point on it: the connected shape under that point, grown a few pixels, is cut out of its grey
(the grey joined to the crop's edge goes transparent; a thin band round it is un-blended so the plum outline stays
crisp), so neighbours that share its box stay out. Every sprite is written at OUT_PPU pixels per viewBox unit, so the
lunge (up to 9x) still has detail."""
import os
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "files", "assets", "imgages")
OUT = os.path.join(HERE, "files", "art")
PARTS_JS = os.path.join(HERE, "files", "core", "alien-parts.js")
OUT_PPU = 8                 # px per viewBox unit in the written sprites (the nest shows ~1.7 CSS px per unit)
FG = 14                     # colour distance from the grey that counts as picture
BG_T = 10                   # ...and that counts as background for the cut-out
LAB = 4                     # the shapes are found on a 1/LAB grid (fast), then grown back to full size

# Sheet pixels per viewBox unit, per sheet: sets how big each alien comes out (the crab's body ~46 units wide, etc.)
UNIT = {
    "cute_crab.jpg": 17.5,
    "horror_scuttler.jpg": 17.0,
    "cute_worm.jpg": 15.0,
    "horror_wriggler.jpg": 21.0,
    "concept_octopus.jpg": 17.5,
    "concept_grabber.jpg": 19.0,
}
CRAB, SCUT, WORM, WRIG, GRAB_PARTS = "cute_crab.jpg", "horror_scuttler.jpg", "cute_worm.jpg", "horror_wriggler.jpg", "horror_grabber.jpg"
OCTO, GRAB = "concept_octopus.jpg", "concept_grabber.jpg"
OCTO_TINT = (160, 118, 166)     # the octopus's lavender (its loose tentacles are recoloured to it)
GRAB_TINT = (118, 84, 140)      # the Grabber's muted purple

# (alien, part, sheet, a point on the piece in sheet px, options). flip: mirror it; unit: that sheet's scale for this
# alien (the Grabber sheet's segments are drawn thicker than either body's tentacles); tint: recolour to that purple;
# keepAbove: drop everything below this sheet-px y (the Grabber's slime puddle).
PIECES = [
    ("crab", "body", CRAB, (1760, 700), {}),
    ("crab", "stalk-1", CRAB, (1100, 260), {}),
    ("crab", "stalk-2", CRAB, (1560, 150), {}),
    ("crab", "stalk-3", CRAB, (2160, 180), {}),
    ("crab", "leg-1", CRAB, (874, 423), {}),          # the long curve
    ("crab", "leg-2", CRAB, (831, 592), {}),          # the short curve
    ("crab", "leg-3", CRAB, (1127, 824), {}),         # an L, used whole: it bends at the knee already
    ("crab", "leg-4", CRAB, (1127, 979), {}),         # the other L
    ("scuttler", "body", SCUT, (1350, 750), {}),
    ("scuttler", "leg", SCUT, (400, 400), {}),        # the one whole jointed leg (Andrew: legs cover the stub and claws)
    ("scuttler", "mandible-l", SCUT, (500, 700), {}),
    ("scuttler", "mandible-r", SCUT, (2200, 700), {}),
    ("worm", "head", WORM, (1360, 420), {}),
    ("worm", "segment", WORM, (1180, 720), {}),
    ("worm", "tail", WORM, (2080, 960), {}),
    ("worm", "antenna", WORM, (1760, 280), {}),
    ("wriggler", "body", WRIG, (1440, 900), {}),
    ("wriggler", "insides", WRIG, (780, 800), {}),
] + [
    # the ten feelers; each is turned so its ringed stub (the attaching end) is on the left
    ("wriggler", "feeler-%d" % (i + 1), WRIG, pt, {"flip": fl}) for i, (pt, fl) in enumerate([
        ((860, 190), True), ((1900, 180), False), ((1950, 350), False), ((830, 375), True), ((2080, 485), True),
        ((2400, 985), False), ((1920, 990), False), ((370, 1160), True), ((860, 1325), False), ((370, 1350), True)])
] + [
    ("octopus", "body", OCTO, (560, 760), {"noShadow": 1140}),   # its ground shadow (below y 1140) goes: the game draws none
    ("grabber", "body", GRAB, (480, 700), {"keepAbove": 1212}),
] + [
    # loose tentacles: the Wriggler's smooth feelers, recoloured (the Grabber sheet's base/middle/tip segments are drawn
    # as ringed cylinders, which read as bones next to the concept bodies' smooth tentacles)
    (alien, "tentacle-%d" % (i + 1), WRIG, pt, {"flip": fl, "unit": unit, "tint": tint})
    for alien, unit, tint, picks in [
        ("octopus", 15.0, OCTO_TINT, [((1900, 180), False), ((860, 190), True), ((1950, 350), False), ((370, 1160), True)]),
        ("grabber", 15.0, GRAB_TINT, [((2400, 985), False), ((830, 375), True), ((1920, 990), False), ((370, 1350), True)])]
    for i, (pt, fl) in enumerate(picks)
] + [
    ("grabber", "drip-%d" % (i + 1), GRAB_PARTS, pt, {"unit": 19.0})
    for i, pt in enumerate([(1168, 1330), (1322, 1330), (1468, 1330), (1616, 1300)])
]

_sheets = {}


def load(name):
    if name not in _sheets:
        a = np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(np.float32)
        bg = np.median(a[:60, :60].reshape(-1, 3), axis=0)
        d = np.sqrt(((a - bg) ** 2).sum(axis=2))
        _sheets[name] = (a, bg, d)
    return _sheets[name]


def shape_at(d, pt):
    """The connected shape under pt, on the coarse grid, grown back to full size (a box and a mask)."""
    m = d[::LAB, ::LAB] > FG
    h, w = m.shape
    sx, sy = pt[0] // LAB, pt[1] // LAB
    # the nearest picture pixel to the point, in case it landed on a highlight gap
    ys, xs = np.nonzero(m[max(0, sy - 12):sy + 13, max(0, sx - 12):sx + 13])
    if not len(ys):
        raise SystemExit("no picture near %r" % (pt,))
    k = np.argmin((ys - min(12, sy)) ** 2 + (xs - min(12, sx)) ** 2)
    sy, sx = max(0, sy - 12) + ys[k], max(0, sx - 12) + xs[k]
    seen = np.zeros_like(m)
    seen[sy, sx] = True
    q = deque([(sy, sx)])
    while q:
        y, x = q.popleft()
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                q.append((yy, xx))
    big = Image.fromarray((seen * 255).astype(np.uint8)).resize((w * LAB, h * LAB), Image.NEAREST)
    big = big.filter(ImageFilter.MaxFilter(2 * LAB + 1)).crop((0, 0, d.shape[1], d.shape[0]))
    mask = np.asarray(big) > 0
    ys, xs = np.nonzero(mask)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), mask


def cutout(a, bg, d, box, mask, pad=6):
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    a, d, mask = a[y0:y1, x0:x1], d[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    near = Image.fromarray((((d <= BG_T) | ~mask) * 255).astype(np.uint8))
    padded = Image.new("L", (near.width + 2, near.height + 2), 255)
    padded.paste(near, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    back = (np.asarray(padded)[1:-1, 1:-1] == 128) | ~mask
    band = (np.asarray(Image.fromarray((back * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0) & ~back
    solid = np.percentile(d[band], 85) if band.any() else 40
    alpha = np.ones(d.shape, np.float32)
    alpha[back] = 0
    alpha[band] = np.clip(d[band] / solid, 0, 1)
    rgb = a.copy()
    sel = band & (alpha > 0.02)
    for c in range(3):
        ch = rgb[..., c]
        ch[sel] = np.clip((ch[sel] - (1 - alpha[sel]) * bg[c]) / alpha[sel], 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")


def tint(im, target):
    """Recolour a piece to `target`'s hue, matching its body colour's saturation and value (outlines stay dark)."""
    rgb, al = im.convert("RGB"), np.asarray(im.getchannel("A"))
    hsv = np.asarray(rgb.convert("HSV")).astype(np.float32)
    body = (al > 200) & (hsv[..., 2] > 90)
    th, ts, tv = np.asarray(Image.new("RGB", (1, 1), target).convert("HSV")).astype(np.float32)[0, 0]
    h, s, v = [np.median(hsv[..., i][body]) for i in range(3)]
    hsv[..., 0] = (hsv[..., 0] + (th - h)) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * (ts / max(s, 1)), 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * (tv / max(v, 1)), 0, 255)
    out = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB").convert("RGBA")
    out.putalpha(im.getchannel("A"))
    return out


def main():
    sizes = {}
    for alien, part, sheet, pt, opt in PIECES:
        a, bg, d = load(sheet)
        box, mask = shape_at(d, pt)
        if opt.get("noShadow"):
            # the ground shadow: darker than the grey and nearly colourless (the plum outline is dark but coloured)
            spread = a.max(axis=2) - a.min(axis=2)
            core = (a.mean(axis=2) < bg.mean() - 2) & (spread < 16)
            # ...and its soft rim: grey pixels next to it (the outline's coloured pixels stay)
            grown = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
            shadow = grown & (spread < 22)
            shadow[:opt["noShadow"], :] = False
            d = np.where(shadow, 0, d)
            mask = mask & ~shadow
        if "keepAbove" in opt:
            mask = mask.copy()
            mask[opt["keepAbove"]:, :] = False
            box = (box[0], box[1], box[2], min(box[3], opt["keepAbove"]))
        im = cutout(a, bg, d, box, mask)
        if "keepAbove" in opt:
            # soften the cut: the last few rows fade out, so the drips end rather than stop dead
            al = np.asarray(im.getchannel("A")).astype(np.float32)
            n = min(14, al.shape[0])
            al[-n:, :] *= np.linspace(1, 0, n)[:, None]
            im.putalpha(Image.fromarray(al.astype(np.uint8)))
        im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
        if opt.get("tint"):
            im = tint(im, opt["tint"])
        if opt.get("flip"):
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        k = OUT_PPU / opt.get("unit", UNIT.get(sheet, 18))
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        name = "hatch-%s--%s@2x.png" % (alien, part)
        im.save(os.path.join(OUT, name), optimize=True)
        sizes.setdefault(alien, {})[part] = [round(im.width / OUT_PPU, 2), round(im.height / OUT_PPU, 2)]
        print(name, "%dx%d px" % im.size)
    lines = ["/* Egg Timer: the hatchlings' puppet pieces (E45). GENERATED by make-alien-art.py: don't edit by hand.",
             "   Each part's [width, height] in the nest's viewBox units; its picture is files/art/hatch-<alien>--<part>@2x.png. */",
             "(function (root) {", "  var ET = (root.ET = root.ET || {});", "  ET.ALIEN_PARTS = {"]
    for i, (alien, parts) in enumerate(sizes.items()):
        body = ", ".join('"%s": [%s, %s]' % (p, w, h) for p, (w, h) in parts.items())
        lines.append('    %s: { %s }%s' % (alien, body, "," if i < len(sizes) - 1 else ""))
    lines += ["  };", "})(window);", ""]
    with open(PARTS_JS, "w", encoding="utf-8", newline="\r\n") as f:
        f.write("\n".join(lines))
    print(os.path.basename(PARTS_JS), "written")


if __name__ == "__main__":
    main()
