"""Egg Timer break art (brief slot 13, E26): cut Andrew's two approved sheets out of their dark grey backgrounds.
    python make-break-art.py     (from this folder; needs Pillow and numpy)
Reads files/assets/imgages/yolk_goo.jpg (the five splats, neat to gross) and shells.jpg (ten shell pieces, 5 x 2) and
writes files/art/break-<n>-<name>@2x.png (each splat on the slot canvas, 404 x 374 px = viewBox -60 -62 120 110) and
files/art/break--shell-01@2x.png ... -10 (tight sprites; the game scales, turns and flips them). Never deployed (*.py).

All five splats share ONE scale (the sheet draws them the same size), set so the largest fits the brief's box
x -40..40, y -40..28, and each is centred in that box. The sheet's stray dark square sits in the background, so the
cut-out drops it with the rest of the grey."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "files", "assets", "imgages")
OUT = os.path.join(HERE, "files", "art")
W, H = 404, 374                       # the slot canvas
X0, Y0, VW, VH = -60, -62, 120, 110
SX, SY = W / VW, H / VH               # px per viewBox unit
BOX = (-40, -40, 40, 28)              # the brief's box for a break, viewBox units
SHELL_LONG = 72                       # px: a shell sprite's longest side at the shared scale (shown ~13 units)
NAMES = ["elegant", "messier", "alien-signs", "half-formed", "leftovers"]
SPLIT = 12                            # colour distance from the grey that counts as picture when finding the sprites
BG_T = 10                             # ...and that counts as background for the cut-out


def runs(p):
    r, start = [], None
    for i, v in enumerate(list(p) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            r.append((start, i))
            start = None
    return r


def sheet(name):
    a = np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(np.float32)
    bg = np.median(a[:120, :120].reshape(-1, 3), axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    return a, bg, d


def cutout(a, bg, d, box, pad=8):
    """One sprite: the grey joined to its crop's edge becomes transparent; a thin band round it is un-blended from
    the grey (alpha from how far a pixel is from the grey, against the dark plum outline's distance), so the outline
    stays crisp. Detached drops inside the crop keep their own outline."""
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    a, d = a[y0:y1, x0:x1], d[y0:y1, x0:x1]
    near = Image.fromarray(((d <= BG_T) * 255).astype(np.uint8))
    padded = Image.new("L", (near.width + 2, near.height + 2), 255)
    padded.paste(near, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    back = np.asarray(padded)[1:-1, 1:-1] == 128
    band = (np.asarray(Image.fromarray((back * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0) & ~back
    # the outline's distance from the grey: the typical distance of the band's darkest-but-solid ring
    solid = np.percentile(d[band], 85) if band.any() else 40
    alpha = np.ones(d.shape, np.float32)
    alpha[back] = 0
    alpha[band] = np.clip(d[band] / solid, 0, 1)
    rgb = a.copy()
    sel = band & (alpha > 0.02)
    for c in range(3):
        ch = rgb[..., c]
        ch[sel] = np.clip((ch[sel] - (1 - alpha[sel]) * bg[c]) / alpha[sel], 0, 255)
    im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def boxes(d, cols, rows):
    fg = d > SPLIT
    out = []
    for r0, r1 in rows:
        for c0, c1 in cols:
            sub = fg[r0:r1, c0:c1]
            ys, xs = np.nonzero(sub)
            out.append((c0 + xs.min(), r0 + ys.min(), c0 + xs.max() + 1, r0 + ys.max() + 1))
    return out


def big(rs, n):
    """The n widest runs, in order (drops specks)."""
    keep = sorted(sorted(rs, key=lambda r: r[1] - r[0])[-n:])
    return keep


def splats():
    a, bg, d = sheet("yolk_goo.jpg")
    fg = d > SPLIT
    cols, rows = big(runs(fg.any(axis=0)), 5), big(runs(fg.any(axis=1)), 1)
    cuts = [cutout(a, bg, d, b) for b in boxes(d, cols, rows)]
    bw, bh = (BOX[2] - BOX[0]) * SX, (BOX[3] - BOX[1]) * SY
    k = min(min(bw / c.width, bh / c.height) for c in cuts)
    cx, cy = ((BOX[0] + BOX[2]) / 2 - X0) * SX, ((BOX[1] + BOX[3]) / 2 - Y0) * SY
    for i, c in enumerate(cuts):
        s = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.alpha_composite(s, (round(cx - s.width / 2), round(cy - s.height / 2)))
        path = os.path.join(OUT, "break-%d-%s@2x.png" % (i + 1, NAMES[i]))
        canvas.save(path, optimize=True)
        print(os.path.basename(path), "sprite %dx%d px (%.1f x %.1f units)" % (s.width, s.height, s.width / SX, s.height / SY))


def shells():
    a, bg, d = sheet("shells.jpg")
    fg = d > SPLIT
    cols, rows = big(runs(fg.any(axis=0)), 5), big(runs(fg.any(axis=1)), 2)
    cuts = [cutout(a, bg, d, b) for b in boxes(d, cols, rows)]
    k = SHELL_LONG / max(max(c.width, c.height) for c in cuts)
    for i, c in enumerate(cuts):
        s = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
        path = os.path.join(OUT, "break--shell-%02d@2x.png" % (i + 1))
        s.save(path, optimize=True)
        print(os.path.basename(path), "%dx%d" % s.size)


if __name__ == "__main__":
    splats()
    shells()
