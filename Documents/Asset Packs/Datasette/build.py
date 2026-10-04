"""Datasette art for the C64 corner (Phase 4, Andrew's rulings 2026-10-04).

Builds true-alpha PNGs from the three Gemini JPGs in Downloads:
  MASTER   Gemini_Generated_Image_38fqz38fqz38fqz3.jpg  (closed lid)   -> datasette-lid.png
  BASE     Gemini_Generated_Image_b99wb6b99wb6b99w.jpg  (lid removed)  -> datasette-base.png
  CASSETTE Gemini_Generated_Image_k7bnuek7bnuek7bn.jpg                 -> cassette.png
MASTER and BASE line up to JPEG noise (median |diff| 2-3 outside the lid), so the
lid and the base share ONE canvas; the cassette is scaled so its two hubs sit on
BASE's two spindles (its bottom ridge then lands on BASE's painted ridge).

  BASE      background cut (white flood from the edge); the SAVE lamp's white disc
            cut out, so an unlit lamp can sit BEHIND it (the page draws the lamp).
  LID       MASTER's silver lid panel only (rounded rect). Its window becomes smoked
            glass: alpha = how much MASTER is lighter than BASE there (glass over the
            same well), colour a pale grey, so the cassette below shows through and
            the glare stays.
  CASSETTE  cut by the shell silhouette (white flood from the edge; the bottom-centre
            pixel is grey, so the flood cannot get into the head opening), then the
            two hub holes, the four bottom holes and the head opening's white bar.
            Label left blank: the page prints the game's name on it.
Writes meta.json with every position as a fraction of the base canvas.
Needs Pillow and numpy only.
"""
import json, os
import numpy as np
from PIL import Image

DL = os.path.expanduser(r"~/Downloads")
OUT = os.path.dirname(os.path.abspath(__file__))
SRC = {k: os.path.join(DL, f"Gemini_Generated_Image_{v}.jpg") for k, v in
       {"master": "38fqz38fqz38fqz3", "base": "b99wb6b99wb6b99w", "cassette": "k7bnuek7bnuek7bn"}.items()}
W_OUT = 800                      # base/lid canvas width out (shown ~300 px wide, x2 for HiDPI)

def load(k): return np.asarray(Image.open(SRC[k]).convert("RGB")).astype(np.float32)

def flood(allowed, seeds):
    """Pixels of `allowed` connected (4-way) to `seeds`, by repeated dilation."""
    cur = seeds & allowed
    while True:
        n = cur.copy()
        n[1:] |= cur[:-1]; n[:-1] |= cur[1:]; n[:, 1:] |= cur[:, :-1]; n[:, :-1] |= cur[:, 1:]
        n &= allowed
        if (n == cur).all(): return cur
        cur = n

def edge_seeds(shape):
    s = np.zeros(shape, bool); s[0] = s[-1] = True; s[:, 0] = s[:, -1] = True; return s

def point_seeds(shape, pts):
    s = np.zeros(shape, bool)
    for x, y in pts: s[y, x] = True
    return s

def rgba(rgb, alpha):
    return np.dstack([rgb, alpha * 255.0]).clip(0, 255).astype(np.uint8)

def save_scaled(arr, size, name):
    """Downscale on PREMULTIPLIED colour, so cut edges do not pick up a white fringe."""
    a = arr.astype(np.float32) / 255.0
    pre = np.dstack([a[..., :3] * a[..., 3:4], a[..., 3:4]])
    im = Image.fromarray((pre * 255).round().astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)
    p = np.asarray(im).astype(np.float32) / 255.0
    al = p[..., 3:4]
    rgb = np.where(al > 1e-4, p[..., :3] / np.maximum(al, 1e-4), 0)
    Image.fromarray((np.dstack([rgb, al]) * 255).round().clip(0, 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, name))

def rounded_rect(shape, x0, y0, x1, y1, r):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    inside = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
    cx = np.clip(xx, x0 + r, x1 - r); cy = np.clip(yy, y0 + r, y1 - r)
    return inside & ((xx - cx) ** 2 + (yy - cy) ** 2 <= r * r)

def polygon(shape, pts):
    from PIL import ImageDraw
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.asarray(m) > 127

M, B, C = load("master"), load("base"), load("cassette")
H, W = B.shape[:2]
H_OUT = round(W_OUT * H / W)
k = W_OUT / W

# ---- BASE -------------------------------------------------------------------
near_white = B.min(axis=2) > 238
bg = flood(near_white, edge_seeds(near_white.shape))
SAVE_SEED = (2140, 1091)
lamp = flood(B.min(axis=2) > 225, point_seeds(near_white.shape, [SAVE_SEED]))
ys, xs = np.nonzero(lamp)
lamp_box = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
alpha_b = np.where(bg | lamp, 0.0, 1.0)
save_scaled(rgba(B, alpha_b), (W_OUT, H_OUT), "datasette-base.png")

# ---- LID --------------------------------------------------------------------
LID = (345, 146, 1864, 906, 48)                 # measured from |MASTER - BASE|
lid = rounded_rect(B.shape[:2], *LID)
WINDOW = [(652, 259), (1559, 259), (1656, 356), (1656, 702), (1583, 775), (628, 775), (555, 702), (555, 356)]
win = polygon(B.shape[:2], WINDOW) & lid
G = 240.0
# 🔄 The glass is DRAWN, not taken from MASTER: MASTER's window has a cassette painted
# in it, a little unlike BASE's well, so |MASTER - BASE| left its ghost (and, blurred,
# a blotch). Measured haze over the well ~0.16; the glare is one soft diagonal band
# where MASTER's runs (top edge x~1310 at y 267, falling to x~986 at y 767).
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
x_edge = 1309 + (yy - 267) * (986 - 1309) / (767 - 267)     # the band's right edge, per row
dist = x_edge - xx                                           # >0 left of that edge
band = np.clip(dist / 40.0, 0, 1) * np.clip((330 - dist) / 120.0, 0, 1)
glass = 0.16 + 0.20 * band
lid_rgb = np.where(win[..., None], G, M)
alpha_l = np.where(win, glass, np.where(lid, 1.0, 0.0))
save_scaled(rgba(lid_rgb, alpha_l), (W_OUT, H_OUT), "datasette-lid.png")

# ---- CASSETTE ---------------------------------------------------------------
cw = C.min(axis=2) > 238
c_bg = flood(cw, edge_seeds(cw.shape))
HUBS = [(816, 764), (1997, 764)]                # white centroids of the two hub holes
HOLES = [(746, 1443), (2070, 1443), (1014, 1408), (1795, 1408), (1400, 1520)]
holes = flood(C.min(axis=2) > 240, point_seeds(cw.shape, HUBS + HOLES))
alpha_c = np.where(c_bg | holes, 0.0, 1.0)
SPINDLES = [(818, 545), (1389, 545)]            # BASE's dark discs (bbox centres)
s = (SPINDLES[1][0] - SPINDLES[0][0]) / (HUBS[1][0] - HUBS[0][0])
cx0 = SPINDLES[0][0] - HUBS[0][0] * s
cy0 = SPINDLES[0][1] - HUBS[0][1] * s
cass_w, cass_h = C.shape[1] * s, C.shape[0] * s
out_w, out_h = round(cass_w * k * 1.5), round(cass_h * k * 1.5)   # a little extra resolution: it is small
save_scaled(rgba(C, alpha_c), (out_w, out_h), "cassette.png")

frac = lambda x, y: [round(x / W, 5), round(y / H, 5)]
meta = {
    "canvas": [W_OUT, H_OUT], "aspect": round(W / H, 5),
    "lid": {"box": [round(LID[0] / W, 5), round(LID[1] / H, 5), round(LID[2] / W, 5), round(LID[3] / H, 5)],
            "hinge_y": round(LID[1] / H, 5)},
    "cassette": {"left": round(cx0 / W, 5), "top": round(cy0 / H, 5), "width": round(cass_w / W, 5), "height": round(cass_h / H, 5),
                 "label": [round(165 / C.shape[1], 4), round(138 / C.shape[0], 4), round(2652 / C.shape[1], 4), round(514 / C.shape[0], 4)],
                 "hubs": [[round(x / C.shape[1], 4), round(y / C.shape[0], 4)] for x, y in HUBS]},
    "spindles": [frac(*p) for p in SPINDLES], "spindle_d": round(173 / W, 5),
    "save_lamp": [round(lamp_box[0] / W, 5), round(lamp_box[1] / H, 5), round(lamp_box[2] / W, 5), round(lamp_box[3] / H, 5)],
    "counter": [round(1969 / W, 5), round(759 / H, 5), round(2324 / W, 5), round(899 / H, 5)],
}
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
print(json.dumps(meta, indent=1))
print("cassette scale", round(s, 4), "box", round(cx0), round(cy0), round(cx0 + cass_w), round(cy0 + cass_h), "of", W, H)
