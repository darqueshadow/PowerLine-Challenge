"""Egg Timer: the two Mom parts kits (E55; Andrew approved the art, Chat's build brief 2026-10-02).
    python make-mom-art.py [--anchors-only]     (from this folder; needs Pillow and numpy)
Reads Andrew's ten Gemini pictures, files/assets/imgages/alien_mom/{sm,hm}_{org,facingyou,giggling,tentacle,plaster}.jpg
(sm_ = sweet Mom, hm_ = creepy Mom; all on white), and writes:
  - beside each original, a full-size transparent cut-out <name>.png (the originals are kept; the folder is
    git-ignored, like all of Andrew's sources);
  - files/art/mom-<sweet|creepy>--<down|face|giggle|tentacle|plaster>@2x.png, the game's copies;
  - files/core/mom-parts.js, each piece's size and its anchor points (chin, mouth, tongue, the tentacle's base and tip),
    which core/view.js reads to lay her out.
What it does to them (the brief): the white joined to the picture's edge goes transparent, a thin band round it
un-blended from white so the aubergine outline stays crisp (the pilot art's cut); the sweet tentacle's curl hole goes
too. Each Mom's three heads are cropped with ONE box, so a pose swap never jumps. The creepy tentacle is flipped to
curl the sweet one's way; the creepy plaster is turned and scaled to the sweet one's angle and length. The speck in the
sweet plaster's pad is painted over; the warts poking past the creepy head's and tentacle's outline are shaved off and
the outline inked back over the cut. Never deployed (*.py)."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "files", "assets", "imgages", "alien_mom")
OUT = os.path.join(HERE, "files", "art")
PARTS_JS = os.path.join(HERE, "files", "core", "mom-parts.js")
OUTLINE = (26, 13, 46)          # #1a0d2e, the game's cartoon outline
HEAD_W, TENTACLE_H, PLASTER_L = 320, 440, 240   # the game copies' sizes in px (a head shows at most ~141 CSS px)

POSES = {"down": "org", "face": "facingyou", "giggle": "giggling"}

# Anchor points, as fractions of each written piece (measured on the written files; redo them if the art changes).
# Heads: `chin` is where the tentacles' stubs tuck under her; `mouth` where the creepy drool leaves her lower lip
# (pose "face"); `tongue` the giggle's tongue (centre and radii, pose "giggle"). Tentacle: `base` (the stub) and `tip`
# (the curl, where she holds the plaster), on the sweet orientation (the creepy one is flipped to match).
ANCHORS = {
    "sweet": {"chin": [0.55, 0.9], "mouth": [0.55, 0.8]},
    "creepy": {"chin": [0.57, 0.9], "mouth": [0.56, 0.8], "tongue": [0.63, 0.66, 0.08, 0.06]},
    "tentacle": {"sweet": {"base": [0.40, 0.96], "tip": [0.76, 0.2]}, "creepy": {"base": [0.28, 0.96], "tip": [0.58, 0.22]}},
}


def near_white(a):
    return a.min(axis=2) > 225


def cutout(path, holes=False):
    """White background -> transparent. `holes`: every near-white patch goes, not only the one joined to the edge
    (for a piece with no white of its own, such as a tentacle with a curl)."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    mn = a.min(axis=2)
    near = near_white(a)
    if holes:
        bg = near
    else:
        nimg = Image.fromarray((near * 255).astype(np.uint8))
        pad = Image.new("L", (nimg.width + 2, nimg.height + 2), 255)
        pad.paste(nimg, (1, 1))
        ImageDraw.floodfill(pad, (0, 0), 128)
        bg = np.asarray(pad)[1:-1, 1:-1] == 128
    bgimg = Image.fromarray((bg * 255).astype(np.uint8))
    band = (np.asarray(bgimg.filter(ImageFilter.MaxFilter(7))) > 0) & ~bg
    alpha = np.ones(mn.shape, np.float32)
    alpha[bg] = 0
    alpha[band] = np.clip((255 - mn[band]) / 255.0 / 0.85, 0, 1)
    rgb = a.copy()
    sel = band & (alpha > 0.02)
    for c in range(3):
        ch = rgb[..., c]
        ch[sel] = np.clip((ch[sel] - (1 - alpha[sel]) * 255) / alpha[sel], 0, 255)
    return np.dstack([rgb, alpha * 255])


def grow(mask, px, shrink=False):
    """Dilate (or erode) a boolean mask by about px pixels, in 3 x 3 steps (rounder than one big square)."""
    img = Image.fromarray((mask * 255).astype(np.uint8))
    f = ImageFilter.MinFilter(3) if shrink else ImageFilter.MaxFilter(3)
    for _ in range(px):
        img = img.filter(f)
    return np.asarray(img) > 127


def flood(mask, seed, val=100):
    """The connected patch of a boolean mask that holds `seed`, as a boolean mask (PIL's flood fill)."""
    im = Image.fromarray((mask * 255).astype(np.uint8)).copy()   # a copy: Pillow 12 won't flood-fill an array's view
    ImageDraw.floodfill(im, seed, val)
    return np.asarray(im) == val


def shave_warts(px, outline=30, sliver=7, most=12000):
    """Cut off the warts that sit OUTSIDE the outline (each drawn with its own outline, the main outline running on
    through it): find the piece's main body (the biggest patch inside the dark lines), fill its holes, and keep only
    what lies within an outline's width of it; of the rest, small patches (warts) go, big ones (a head's eyes on their
    stalks) stay. Bumps the outline itself bulges round are part of the body and stay."""
    a = px[..., :3]
    shape = px[..., 3] > 128
    lum = a.mean(axis=2)
    open_ = shape & (lum > 75)                       # inside the dark lines
    x0, y0, x1, y1 = box(px)
    best, body = 0, None
    for fy in np.linspace(0.1, 0.9, 9):
        for fx in np.linspace(0.1, 0.9, 9):
            y, x = int(y0 + (y1 - y0) * fy), int(x0 + (x1 - x0) * fx)
            if not open_[y, x] or (body is not None and body[y, x]):
                continue
            c = flood(open_, (x, y))
            if c.sum() > best:
                best, body = c.sum(), c
    # fill the body's holes: everything not reachable from the picture's edge without crossing it
    pad = np.pad(~body, 1, constant_values=True)
    filled = ~flood(pad, (0, 0))[1:-1, 1:-1]
    near = grow(filled, outline)
    out = shape & ~near
    out = grow(grow(out, sliver, shrink=True), sliver) & out    # drop the slivers (a thick stretch of outline)
    taken = np.zeros_like(shape)
    while out.any():
        ys, xs = np.nonzero(out)
        c = flood(out, (int(xs[0]), int(ys[0])))
        out &= ~c
        if c.sum() < most:
            taken |= c
    if not taken.any():
        return px, 0
    taken = grow(taken, 2) & shape & ~near
    px = px.copy()
    px[taken, 3] = 0
    return px, int(taken.sum())


def fix_speck(px):
    """The sweet plaster: paint over the little white speck in the middle of its pad with the pad's own colour (the
    only near-white well inside the piece)."""
    a = px[..., :3]
    shape = px[..., 3] > 128
    spot = near_white(a) & grow(shape, 30, shrink=True)
    if not spot.any():
        return px, 0
    cover = grow(spot, 10)
    ring = grow(cover, 6) & ~cover & shape & ~near_white(a)
    px = px.copy()
    px[cover & shape, :3] = np.median(a[ring], axis=0)
    return px, int(spot.sum())


def box(px):
    ys, xs = np.nonzero(px[..., 3] > 8)
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def img(px):
    return Image.fromarray(np.clip(px, 0, 255).astype(np.uint8), "RGBA")


def angle(px):
    """The long axis of a piece, in degrees (screen y down)."""
    ys, xs = np.nonzero(px[..., 3] > 128)
    xs, ys = xs - xs.mean(), ys - ys.mean()
    w, v = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
    d = v[:, np.argmax(w)]
    return float(np.degrees(np.arctan2(d[1], d[0])))


def length(im):
    px = np.asarray(im).astype(np.float32)
    ys, xs = np.nonzero(px[..., 3] > 128)
    xs, ys = xs - xs.mean(), ys - ys.mean()
    w, v = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
    d = v[:, np.argmax(w)]
    proj = xs * d[0] + ys * d[1]
    return float(proj.max() - proj.min())


def trimmed(im, pad=6):
    b = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop((max(0, b[0] - pad), max(0, b[1] - pad), min(im.width, b[2] + pad), min(im.height, b[3] + pad)))


def save_full(name, im):
    im.save(os.path.join(SRC, name + ".png"))


def save_game(kind, piece, im):
    im.save(os.path.join(OUT, "mom-%s--%s@2x.png" % (kind, piece)), optimize=True)


def build():
    sizes, notes = {}, []
    for kind, pre in (("sweet", "sm"), ("creepy", "hm")):
        sizes[kind] = {}
        # the three heads, one crop box
        heads = {}
        for pose, src in POSES.items():
            px = cutout(os.path.join(SRC, "%s_%s.jpg" % (pre, src)))
            if kind == "creepy":
                px, n = shave_warts(px)
                notes.append("%s head %s: %d px of wart shaved" % (kind, pose, n))
            heads[pose] = px
        bs = [box(p) for p in heads.values()]
        crop = (min(b[0] for b in bs) - 8, min(b[1] for b in bs) - 8, max(b[2] for b in bs) + 8, max(b[3] for b in bs) + 8)
        for pose, px in heads.items():
            full = img(px).crop(crop)
            save_full("%s_%s" % (pre, POSES[pose]), full)
            game = full.resize((HEAD_W, round(full.height * HEAD_W / full.width)), Image.LANCZOS)
            save_game(kind, pose, game)
            sizes[kind]["head"] = [game.width, game.height]
        # the tentacle (the creepy one flipped to curl the sweet one's way)
        px = cutout(os.path.join(SRC, "%s_tentacle.jpg" % pre), holes=True)
        if kind == "creepy":
            px, n = shave_warts(px, outline=24, sliver=3)   # its outline is even, its warts small
            notes.append("creepy tentacle: %d px of wart shaved" % n)
        t = trimmed(img(px))
        if kind == "creepy":
            t = t.transpose(Image.FLIP_LEFT_RIGHT)
        save_full("%s_tentacle" % pre, t)
        game = t.resize((round(t.width * TENTACLE_H / t.height), TENTACLE_H), Image.LANCZOS)
        save_game(kind, "tentacle", game)
        sizes[kind]["tentacle"] = [game.width, game.height]
        # the plaster
        px = cutout(os.path.join(SRC, "%s_plaster.jpg" % pre))
        if kind == "sweet":
            px, n = fix_speck(px)
            notes.append("sweet plaster: %d speck px painted over" % n)
            sweet_angle = angle(px)
        p = img(px)
        if kind == "creepy":
            turn = angle(px) - sweet_angle
            p = p.rotate(turn, resample=Image.BICUBIC, expand=True)
            notes.append("creepy plaster: turned %.1f deg to the sweet one's %.1f deg" % (turn, sweet_angle))
        p = trimmed(p)
        save_full("%s_plaster" % pre, p)
        k = PLASTER_L / length(p)
        game = p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)
        save_game(kind, "plaster", game)
        sizes[kind]["plaster"] = [game.width, game.height]
    write_js(sizes)
    for n in notes:
        print("  " + n)


def write_js(sizes):
    import json
    body = {k: dict(sizes[k], **ANCHORS[k]) for k in ("sweet", "creepy")}
    for k in ("sweet", "creepy"):
        body[k]["tentacleBase"] = ANCHORS["tentacle"][k]["base"]
        body[k]["tentacleTip"] = ANCHORS["tentacle"][k]["tip"]
    js = ("/* GENERATED by make-mom-art.py: do not edit by hand. The two Moms' pieces (E55): each one's size in px as\n"
          "   written to files/art/mom-<kind>--<piece>@2x.png, and the anchor points (fractions of the piece) that\n"
          "   core/view.js lays her out by. */\n"
          "(function (root) {\n  var ET = (root.ET = root.ET || {});\n  ET.MOM_PARTS = {\n" +
          ",\n".join("    %s: %s" % (k, json.dumps(body[k])) for k in ("sweet", "creepy")) + "\n  };\n})(window);\n")
    with open(PARTS_JS, "w", newline="\r\n") as f:
        f.write(js)


if __name__ == "__main__":
    import sys
    if "--anchors-only" in sys.argv:   # the pictures are as they were: rewrite mom-parts.js from them
        write_js({k: {p: list(Image.open(os.path.join(OUT, "mom-%s--%s@2x.png" % (k, f))).size)
                      for p, f in (("head", "face"), ("tentacle", "tentacle"), ("plaster", "plaster"))}
                  for k in ("sweet", "creepy")})
    else:
        build()
