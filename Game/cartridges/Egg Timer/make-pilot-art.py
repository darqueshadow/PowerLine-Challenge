"""Egg Timer pilot art (Chat ruling, 2026-09-25): cut Andrew's approved pictures out of their white backgrounds and
lay each part on the slot-0 layer canvas (404 x 374 px = viewBox -60 -62 120 110), the brief's raster route.
    python make-pilot-art.py     (from this folder; needs Pillow and numpy)
Reads files/assets/imgages/ (Andrew's source pictures) and writes files/art/*@2x.png. The placements below are the
ones art.js assumes (the cracks' paths are repeated there). Never deployed (*.py)."""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "files", "assets", "imgages")
OUT = os.path.join(HERE, "files", "art")
PREV = os.path.join(HERE, "..", "..", "..", "..", "pilot-art-preview")   # outside Game/: never published
W, H = 404, 374                  # the layer canvas
X0, Y0, VW, VH = -60, -62, 120, 110
SX, SY = W / VW, H / VH          # px per viewBox unit


def u2p(x, y):
    return (x - X0) * SX, (y - Y0) * SY


def cutout(path):
    """White background -> transparent, keeping the dark outlines crisp: the background is the near-white region
    joined to the picture's edge (so pale highlights inside stay), and a thin band round it is un-blended from white."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    mn = a.min(axis=2)
    near = Image.fromarray(((mn > 225) * 255).astype(np.uint8))
    pad = Image.new("L", (near.width + 2, near.height + 2), 255)
    pad.paste(near, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    bg = (np.asarray(pad)[1:-1, 1:-1] == 128)
    # the edge band: background dilated by 3 px, minus the background itself
    bgimg = Image.fromarray((bg * 255).astype(np.uint8))
    band = (np.asarray(bgimg.filter(ImageFilter.MaxFilter(7))) > 0) & ~bg
    alpha = np.ones(mn.shape, np.float32)
    alpha[bg] = 0
    # colour-to-alpha against white in the band: alpha from how far the pixel is from white
    whit = (255 - mn[band]) / 255.0
    ab = np.clip(whit / 0.85, 0, 1)
    alpha[band] = ab
    rgb = a.copy()
    sel = band & (alpha > 0.02)
    for c in range(3):
        ch = rgb[..., c]
        ch[sel] = np.clip((ch[sel] - (1 - alpha[sel]) * 255) / alpha[sel], 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def trim(im):
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def splits(im, axis, n):
    """Split a cut-out picture into n parts along empty gaps (columns if axis=0)."""
    al = np.asarray(im.getchannel("A")) > 8
    prof = al.any(axis=axis)
    runs, inside, start = [], False, 0
    for i, v in enumerate(prof):
        if v and not inside: inside, start = True, i
        if not v and inside: inside = False; runs.append((start, i))
    if inside: runs.append((start, len(prof)))
    runs = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:n]
    runs.sort()
    parts = []
    for s, e in runs:
        box = (s, 0, e, im.height) if axis == 0 else (0, s, im.width, e)
        parts.append(trim(im.crop(box)))
    return parts


def place(canvas, part, x0, y0, w=None, h=None, mirror=False):
    """Put `part` on the canvas with its top-left at viewBox (x0, y0), `w` units wide (or `h` high), aspect kept."""
    if w is not None:
        pw = w * SX; ph = pw * part.height / part.width
    else:
        ph = h * SY; pw = ph * part.width / part.height
    p = part.resize((max(1, round(pw)), max(1, round(ph))), Image.LANCZOS)
    if mirror: p = p.transpose(Image.FLIP_LEFT_RIGHT)
    px, py = u2p(x0, y0)
    canvas.alpha_composite(p, (round(px), round(py)))
    return (x0, y0, x0 + pw / SX, y0 + ph / SY)


def blank():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def _cuts():
    os.makedirs(OUT, exist_ok=True)
    egg = trim(cutout(os.path.join(SRC, "fresh_egg.jpg")))
    nest = trim(cutout(os.path.join(SRC, "empty_nest.jpg")))
    tend = splits(trim(cutout(os.path.join(SRC, "tendrils.jpg"))), 0, 3)
    bits_all = trim(cutout(os.path.join(SRC, "alien_bits.jpg")))
    top, bottom = splits(bits_all, 1, 2)
    antenna, leg = splits(top, 0, 2)
    tentacle, eye = splits(bottom, 0, 2)
    for n, im in [("egg", egg), ("nest", nest), ("antenna", antenna), ("leg", leg), ("tentacle", tentacle), ("eye", eye)] + [("tendril%d" % i, t) for i, t in enumerate(tend)]:
        im.save(os.path.join(PREV, "cut_" + n + ".png"))
        print(n, im.size)


# ── layout (viewBox units), shared with art.js ─────────────────────────────
NEST = dict(x0=-48, y0=-21, w=96)                 # the nest picture, bottom at about y 37
CAVITY = dict(cx=0.506, cy=0.47, rx=0.19, ry=0.15)  # the bowl's inner hollow, as shares of the nest picture
EGG = dict(x0=-22, w=44)                            # the egg, base on y 20
HINTS = {"hint-3": ("antenna", dict(x0=-4, y0=-44, h=11.5)),
         "hint-4": ("leg", dict(x0=-10, y0=-26, w=26)),
         "hint-5": ("tentacle", dict(x0=-21, y0=-8, w=19)),
         "hint-eye": ("eye", dict(x0=4, y0=-6, w=16))}
TENDRILS = [dict(x0=-47, y0=-42, h=44, mirror=False), dict(x0=29, y0=-42, h=44, mirror=True), dict(x0=-31, y0=-31, h=32, mirror=False)]
CRACKS = ["M-3 -36.5 L0 -31 L-3 -27 L1 -23",
          "M21.5 -14 L16 -11 L18 -5 L12 -1 L13 3 L10 5",
          "M-21.5 -5 L-16 -2 L-17 3 L-11 5 L-8 9"]
SLATE = np.array([0x3a, 0x31, 0x50], np.float32)


def nest_layers(nest):
    """Split the nest along the bowl's front lip: the front rim (below the hollow's lower arc, and the side walls below its
    middle) covers the egg's base; the rest is the back rim."""
    a = np.asarray(nest).copy()
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy, rx, ry = CAVITY["cx"] * w, CAVITY["cy"] * h, CAVITY["rx"] * w, CAVITY["ry"] * h
    dx = np.clip((xx - cx) / rx, -1, 1)
    arc = np.where(np.abs(xx - cx) < rx, cy + ry * np.sqrt(1 - dx ** 2), cy)
    front = yy >= arc
    fa, ba = a.copy(), a.copy()
    fa[~front, 3] = 0
    ba[front, 3] = 0
    return Image.fromarray(ba, "RGBA"), Image.fromarray(fa, "RGBA")


def slate(im):
    """The not-in-play look: the same twigs in the slate tone (--twig-inactive #3a3150), light and shade kept."""
    a = np.asarray(im).astype(np.float32)
    lum = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]) / 255
    k = 0.35 + 1.4 * lum
    out = a.copy()
    out[..., :3] = np.clip(SLATE[None, None, :] * k[..., None], 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def build():
    egg = trim(cutout(os.path.join(SRC, "fresh_egg.jpg")))
    nest = trim(cutout(os.path.join(SRC, "empty_nest.jpg")))
    tend = splits(trim(cutout(os.path.join(SRC, "tendrils.jpg"))), 0, 3)
    top, bottom = splits(trim(cutout(os.path.join(SRC, "alien_bits.jpg"))), 1, 2)
    antenna, leg = splits(top, 0, 2)
    tentacle, eye = splits(bottom, 0, 2)
    bits = {"antenna": antenna, "leg": leg, "tentacle": tentacle, "eye": eye}
    layers, boxes = {}, {}
    back, front = nest_layers(nest)
    for name, part in [("nest--twigs-back", back), ("nest--twigs-front", front)]:
        c = blank(); boxes[name] = place(c, part, NEST["x0"], NEST["y0"], w=NEST["w"]); layers[name] = c
        layers[name + "-inactive"] = slate(c)
    for i, (t, spec) in enumerate(zip(tend, TENDRILS)):
        c = blank(); boxes["nest--tendril-%d" % (i + 1)] = place(c, t, spec["x0"], spec["y0"], h=spec["h"], mirror=spec["mirror"])
        layers["nest--tendril-%d" % (i + 1)] = c
    c = blank(); eh = EGG["w"] * egg.height / egg.width
    boxes["egg--shell"] = place(c, egg, EGG["x0"], 20 - eh, w=EGG["w"]); layers["egg--shell"] = c
    for hint, (part, spec) in HINTS.items():
        c = blank(); boxes["egg--" + hint] = place(c, bits[part], spec["x0"], spec["y0"], w=spec.get("w"), h=spec.get("h"))
        layers["egg--" + hint] = c
    return layers, boxes


def preview(layers, which, path, cracks=True, scale=2, bg=(27, 15, 51, 255)):
    c = Image.new("RGBA", (W, H), bg)
    for n in which:
        c.alpha_composite(layers[n])
    if cracks:
        d = ImageDraw.Draw(c)
        for p in CRACKS:
            pts = [tuple(map(float, s.split())) for s in p.replace("M", "").split(" L")]
            d.line([u2p(*q) for q in pts], fill=(0x1a, 0x0d, 0x2e, 255), width=round(3.5 * SX), joint="curve")
    c.resize((W * scale, H * scale), Image.LANCZOS).save(path)


def save(layers):
    for n, im in layers.items():
        im.save(os.path.join(OUT, n + "@2x.png"), optimize=True)


if __name__ == "__main__":
    L, B = build()
    save(L)
    for k, v in sorted(B.items()):
        print(k, tuple(round(x, 1) for x in v))
