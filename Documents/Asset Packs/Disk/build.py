"""The 5¼" disk for the C64 corner (Phase 4b, Andrew's spec 2026-10-04).

Builds one true-alpha PNG from the Gemini JPG in Downloads:
  Gemini_Generated_Image_r6cw0jr6cw0jr6cw.jpg  (flat, on white, label blank)  -> disk.png

  CUT       by the BLACK JACKET's silhouette: jacket = dark pixels (the black, its
            dark-grey bevel, the hub ring, the index hole, the head window); the
            background is the not-dark pixels reached from the image's edge, so the
            grey DROP SHADOW (right and bottom, L ~207) goes with it, and so do the
            LEFT NOTCH and the BOTTOM-EDGE GAP, which open onto the edge.
  HUB HOLE  the not-dark pixels reached from the hole's centre: the white and the
            grey crescent of shadow painted inside it, stopped by the dark ring.
  LABEL     left blank; the page prints the game's name on it. Its box is measured
            (the cream pixels) into meta.json as fractions of the disk.
Cropped to the jacket, downscaled on PREMULTIPLIED colour (no white fringe).
Same pipeline as ../Datasette/build.py. Needs Pillow and numpy only (no scipy).
"""
import json, os
import numpy as np
from PIL import Image

SRC = os.path.join(os.path.expanduser(r"~/Downloads"), "Gemini_Generated_Image_r6cw0jr6cw0jr6cw.jpg")
OUT = os.path.dirname(os.path.abspath(__file__))
W_OUT = 480                       # shown ~120-170 px wide, x2 (and a bit) for HiDPI

def flood(allowed, seeds):
    """Pixels of `allowed` connected (4-way) to `seeds`, by repeated dilation."""
    cur = seeds & allowed
    while True:
        n = cur.copy()
        n[1:] |= cur[:-1]; n[:-1] |= cur[1:]; n[:, 1:] |= cur[:, :-1]; n[:, :-1] |= cur[:, 1:]
        n &= allowed
        if (n == cur).all(): return cur
        cur = n

def save_scaled(rgb, alpha, size, path):
    """Downscale on PREMULTIPLIED colour, so cut edges do not pick up a white fringe."""
    pre = np.dstack([rgb / 255.0 * alpha[..., None], alpha])
    im = Image.fromarray((pre * 255).round().astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)
    p = np.asarray(im).astype(np.float32) / 255.0
    al = p[..., 3:4]
    col = np.where(al > 1e-4, p[..., :3] / np.maximum(al, 1e-4), 0)
    Image.fromarray((np.dstack([col, al]) * 255).round().clip(0, 255).astype(np.uint8), "RGBA").save(path)

A = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
H, W = A.shape[:2]
L = A.mean(axis=2)

dark = L < 128                                   # jacket black ~29, bevel ~70, ring ~64
edge = np.zeros(dark.shape, bool); edge[0] = edge[-1] = True; edge[:, 0] = edge[:, -1] = True
outside = flood(~dark, edge)
HUB = (1408, 774)                                # the white centre of the hub hole
hole_seed = np.zeros(dark.shape, bool); hole_seed[HUB[1], HUB[0]] = True
hole = flood(~dark, hole_seed)
alpha = np.where(outside | hole, 0.0, 1.0)

# crop to the jacket
ys, xs = np.nonzero(alpha > 0)
x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
crop = lambda a: a[y0:y1, x0:x1]
cw, ch = x1 - x0, y1 - y0

# the blank label: the cream pixels (L > 200, yellowish) inside the jacket, upper right
cream = (L > 200) & (A[..., 2] < A[..., 0] - 12) & ~outside & ~hole
ly, lx = np.nonzero(cream)
lab = [int(lx.min()), int(ly.min()), int(lx.max()) + 1, int(ly.max()) + 1]
hy, hx = np.nonzero(hole)

h_out = round(W_OUT * ch / cw)
save_scaled(crop(A), crop(alpha), (W_OUT, h_out), os.path.join(OUT, "disk.png"))

f = lambda v, of: round(v / of, 5)
meta = {
    "source": os.path.basename(SRC), "crop": [x0, y0, x1, y1], "png": [W_OUT, h_out],
    "aspect": f(cw, ch),
    "label": [f(lab[0] - x0, cw), f(lab[1] - y0, ch), f(lab[2] - x0, cw), f(lab[3] - y0, ch)],
    "hub": [f(hx.mean() - x0, cw), f(hy.mean() - y0, ch)], "hub_d": f(hx.max() - hx.min() + 1, cw),
}
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
print(json.dumps(meta, indent=1))
