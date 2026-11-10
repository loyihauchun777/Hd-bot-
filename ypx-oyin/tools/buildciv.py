# Build a textured street car from an orthographic 2x2 reference sheet on a magenta background.
# usage: python3 -I buildciv.py <image> <id> "<display name>" <length_m> <width_m>
import sys, json, cv2, numpy as np
img_path, cid, cname, L, WID = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web3d') + os.sep
im = cv2.imread(img_path)
# despill: anti-aliased edges carry some of the magenta background; pull purple-ish pixels to grey
_b, _g, _r = [im[..., i].astype(int) for i in range(3)]
_spill = (_r - _g > 35) & (_b - _g > 35) & (np.abs(_r - _b) < 90)
_grey = np.minimum(np.minimum(_r, _b), _g + 30).clip(0, 255).astype(np.uint8)
im_d = im.copy()
for _i in range(3): im_d[..., _i] = np.where(_spill, _grey, im[..., _i])
b, g, r = [im[..., i].astype(int) for i in range(3)]
mag = (r > 170) & (b > 170) & (g < 120) & (r - g > 90) & (b - g > 90)
fg = (~mag).astype(np.uint8) * 255
fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(fg)
order = np.argsort(-st[1:, cv2.CC_STAT_AREA])[:4] + 1
H, W = fg.shape
views = {}
for i in order:
    cx, cy = cen[i]
    key = ('side' if cx < W / 2 else 'top') if cy < H / 2 else ('front' if cx < W / 2 else 'rear')
    x, y, w, h = st[i, :4]
    m = np.where(lab[y:y + h, x:x + w] == i, 255, 0).astype(np.uint8)
    # fill holes (dark windows etc. are foreground anyway, but be safe)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    f = np.zeros_like(m); cv2.drawContours(f, cs, -1, 255, -1)
    crop = im_d[y:y + h, x:x + w].copy()
    views[key] = (crop, f)
assert set(views) == {'side', 'top', 'front', 'rear'}, views.keys()

side, sm = views['side']; Hs, Ws = sm.shape
GROUND = Hs - 1
# wheels: dark tyre blobs in the lower part of the side view
hsv = cv2.cvtColor(side, cv2.COLOR_BGR2HSV)
dark = ((hsv[..., 2] < 75) & (sm > 0)).astype(np.uint8) * 255
dark[: int(Hs * 0.5)] = 0
dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))  # drop thin sill lines joining the tyres
dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
nn, ll, ss, cc = cv2.connectedComponentsWithStats(dark)
blobs = sorted([ss[k] for k in range(1, nn) if 0.6 < ss[k][2] / max(1, ss[k][3]) < 1.7], key=lambda s: -s[4])[:2]
blobs = sorted(blobs, key=lambda s: s[0])  # front (left) first
wheels = []
for (x, y, w, h, a) in blobs:
    rr = max(w, h) / 2; wheels.append((x + w / 2, y + h - rr, rr))
cols = range(Ws)
top = np.array([np.nonzero(sm[:, x])[0].min() for x in cols], float)
bot = np.array([np.nonzero(sm[:, x])[0].max() for x in cols], float)
for (wx, wy, wr) in wheels:
    R = wr * 1.07
    for x in cols:
        dx = x - wx
        if abs(dx) < R: bot[x] = min(bot[x], wy - np.sqrt(R * R - dx * dx))
top = np.convolve(top, np.ones(5) / 5, mode='same'); top[:2] = top[2]; top[-2:] = top[-3]
pts = [(x, top[x]) for x in range(0, Ws, 3)] + [(x, bot[x]) for x in range(Ws - 1, -1, -3)]
poly = cv2.approxPolyDP(np.array(pts, np.float32).reshape(-1, 1, 2), 1.0, True)[:, 0, :]
k = L / (Ws - 1); cxm = (Ws - 1) / 2
P = lambda px, py: [round(float((cxm - px) * k), 4), round(float((GROUND - py) * k), 4), round(float(px / Ws), 5), round(float(1 - py / Hs), 5)]
poly_m = [P(px, py) for px, py in poly]
height = float((GROUND - top.min()) * k)

# windshield / rear window along the side silhouette (front = left)
ymin = top.min(); carh = GROUND - ymin
roof = np.nonzero(top <= ymin + 0.045 * carh)[0]; rs, re = roof.min(), roof.max()
slope = np.gradient(np.convolve(top, np.ones(9) / 9, mode='same'))
x = rs
while x > 5 and slope[x] < -0.18: x -= 1
ws0 = x
x = re
while x < Ws - 6 and slope[x] > 0.18: x += 1
rw1 = x
fs = [0, ws0 / (Ws - 1), rs / (Ws - 1), re / (Ws - 1), rw1 / (Ws - 1), 1]

# same points in the top view: dark glass runs along the centre line
tv, tm = views['top']; Ht, Wt = tm.shape
row = cv2.cvtColor(tv, cv2.COLOR_BGR2HSV)[Ht // 2 - 3:Ht // 2 + 4, :, 2].mean(0)
darkc = row < 90
runs, sx = [], None
for xx in range(Wt):
    if darkc[xx] and sx is None: sx = xx
    if (not darkc[xx] or xx == Wt - 1) and sx is not None:
        if xx - sx > 0.03 * Wt: runs.append((sx, xx))
        sx = None
ft = [0, runs[0][0] / Wt, runs[0][1] / Wt, runs[-1][0] / Wt, runs[-1][1] / Wt, 1] if len(runs) >= 2 else fs

def plate_frac(view):
    crop, m = view; hh = crop.shape[0]
    hv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    wm = ((hv[..., 2] > 225) & (hv[..., 1] < 30)).astype(np.uint8) * 255
    wm[: hh // 2] = 0
    cs, _ = cv2.findContours(wm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for c in cs:
        x, y, w, h = cv2.boundingRect(c)
        if h > 0 and 2.8 < w / h < 7 and w > crop.shape[1] * 0.15 and (best is None or w > best[2]): best = (x, y, w, h)
    if not best: return 0.25
    return float((hh - 1 - (best[1] + best[3] / 2)) / (hh - 1))

# textures (background -> white so edges never show magenta)
def clean(view):
    crop, m = view; c = crop.copy(); c[m == 0] = (238, 240, 242); return c
cv2.imwrite(OUT + f'textures/civ_{cid}_side_l.jpg', clean(views['side']), [cv2.IMWRITE_JPEG_QUALITY, 86])
cv2.imwrite(OUT + f'textures/civ_{cid}_side_r.jpg', cv2.flip(clean(views['side']), 1), [cv2.IMWRITE_JPEG_QUALITY, 86])
cv2.imwrite(OUT + f'textures/civ_{cid}_top.jpg', clean(views['top']), [cv2.IMWRITE_JPEG_QUALITY, 86])
cv2.imwrite(OUT + f'textures/civ_{cid}_front.jpg', clean(views['front']), [cv2.IMWRITE_JPEG_QUALITY, 86])
cv2.imwrite(OUT + f'textures/civ_{cid}_rear.jpg', clean(views['rear']), [cv2.IMWRITE_JPEG_QUALITY, 86])
wx, wy, wr = wheels[1]
wc = side[int(wy - wr):int(wy + wr), int(wx - wr):int(wx + wr)].copy()
yy, xx = np.mgrid[:wc.shape[0], :wc.shape[1]]
wc[(yy - wc.shape[0] / 2) ** 2 + (xx - wc.shape[1] / 2) ** 2 > (wr * 0.97) ** 2] = (22, 22, 22)  # outside the tyre -> rubber
wcm = mag[0:0]  # (background never reaches inside the circle)
cv2.imwrite(OUT + f'textures/civ_{cid}_wheel.jpg', cv2.resize(wc, (192, 192)), [cv2.IMWRITE_JPEG_QUALITY, 86])
data = {'id': cid, 'name': cname, 'poly': poly_m, 'length': L, 'width': WID, 'height': round(height, 3),
        'wheelR': round(float(np.mean([w[2] for w in wheels]) * k), 3),
        'wheelX': [round(float((cxm - w[0]) * k), 3) for w in wheels], 'wheelY': round(float((GROUND - np.mean([w[1] for w in wheels])) * k), 3),
        'topMap': [[round(v, 4) for v in fs], [round(v, 4) for v in ft]],
        'plateFront': round(plate_frac(views['front']) * height, 3), 'plateRear': round(plate_frac(views['rear']) * height, 3)}
json.dump(data, open(OUT + f'models/civ_{cid}.json', 'w'))
print(json.dumps({k2: v for k2, v in data.items() if k2 != 'poly'}), len(poly_m), 'pts')
