"""Side B of the 5¼" disk: the PLAIN JACKET, cut from disk.png (Andrew's ruling
2026-10-05: no new art; Side A has the label, Side B none).

  LABEL  painted over with the jacket's own pixels: each row of the label's box
         (plus a margin for its edge) takes the jacket from the SAME row, from the
         plain strip left of the label, so the top bevel runs on unbroken.
  Nothing else changes here. The page shows this flipped VERTICALLY (cat.css
  .disk-back), which after the card's rotateY(180°) puts the notch and the index
  hole on the opposite edge, as on the back of a real disk; the oval stays on top.
Reads disk.png + meta.json beside it; writes disk-back.png. Pillow and numpy only.
"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(HERE, "meta.json")))
im = np.asarray(Image.open(os.path.join(HERE, "disk.png")).convert("RGBA")).copy()
H, W = im.shape[:2]

l, t, r, b = meta["label"]
M = 4                                           # px past the cream, for its soft edge
x0, x1 = int(l * W) - M, int(np.ceil(r * W)) + M
y0, y1 = max(0, int(t * H) - M), int(np.ceil(b * H)) + M
# the donor strip: plain jacket between the left edge's bevel and the label
d0, d1 = 24, x0 - 6
strip = im[y0:y1, d0:d1]
assert d1 - d0 > 40, "donor strip too narrow"
for x in range(x0, x1):
    im[y0:y1, x] = strip[:, (x - x0) % (d1 - d0)]
Image.fromarray(im, "RGBA").save(os.path.join(HERE, "disk-back.png"))
print("disk-back.png", W, "x", H, "label patched", [x0, y0, x1, y1], "from x", [d0, d1])
