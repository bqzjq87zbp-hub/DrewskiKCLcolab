#!/usr/bin/env python3
"""Solve one global forward-dolly camera model for the whole sequence.

Model:  q_i(t) = f + s_i(t)*(p_i - f) + T(t),   s_i(t) = 1/(1 - d(t)*w_i)

f    focus of expansion (constant)
d(t) camera forward displacement, shared by every feature   -> observable all 10s
w_i  inverse depth of feature i (constant)
T(t) residual pan/tilt translation

Because d(t) is shared, a depth group whose own features have left the frame
still receives a correct scale from the rest of the scene. Nothing extrapolates
a noisy per-group time series; each group contributes one constant, w_g.
"""
import sys, json, numpy as np, cv2

z = np.load(sys.argv[1])
pts, alive, p0 = z['pts'], z['alive'], z['p0']
W, H = z['size']
T, N = alive.shape

# ---- 1. focus of expansion: every flow vector points along (p - f) ----------
# Least squares on perpendicular distance from f to each flow line.
A = np.zeros((2, 2)); b = np.zeros(2)
for t in range(T // 3, T):                      # late frames: long, stable vectors
    m = alive[t]
    p, q = p0[m], pts[t][m]
    v = q - p
    n = np.linalg.norm(v, axis=1)
    m2 = n > 6.0                                # ignore near-static, ill-posed
    p, v, n = p[m2], v[m2], n[m2]
    u = v / n[:, None]
    P = np.eye(2)[None] - u[:, :, None] * u[:, None, :]   # I - uu^T
    A += P.sum(0); b += np.einsum('kij,kj->i', P, p)
foe = np.linalg.solve(A, b)
print('focus of expansion (1280x960): %.2f, %.2f' % (foe[0], foe[1]), flush=True)

# ---- 2. per-feature radial scale s_i(t) ------------------------------------
rad0 = p0 - foe
r0 = np.linalg.norm(rad0, axis=1)
good = r0 > 60.0                                # far enough from FoE to be conditioned
S = np.full((T, N), np.nan)
for t in range(T):
    m = alive[t] & good
    S[t, m] = np.linalg.norm(pts[t][m] - foe, axis=1) / r0[m]
R = 1.0 / S                                     # r = 1 - d*w  (linear!)

# ---- 3. alternating least squares:  R[t,i] = 1 - d(t)*w_i ------------------
obs = np.isfinite(R)
# seed: w from the last frame each feature is seen, d ramping linearly
w = np.zeros(N); d = np.linspace(0, 0.35, T)
for i in range(N):
    ts = np.where(obs[:, i])[0]
    if len(ts) > 4:
        num = np.sum(d[ts] * (1 - R[ts, i])); den = np.sum(d[ts] ** 2)
        w[i] = num / den if den > 1e-9 else 0.0
for it in range(60):
    # d(t) given w:  minimise sum_i (1 - R - d*w)^2
    for t in range(T):
        m = obs[t]
        den = np.sum(w[m] ** 2)
        d[t] = np.sum(w[m] * (1 - R[t, m])) / den if den > 1e-9 else d[t]
    d[0] = 0.0
    # w_i given d
    for i in range(N):
        m = obs[:, i]
        den = np.sum(d[m] ** 2)
        if den > 1e-9:
            w[i] = np.sum(d[m] * (1 - R[m, i])) / den
    # gauge fix: median inverse-depth == 1
    g = np.median(w[np.abs(w) > 1e-6])
    w /= g; d *= g
resid = np.abs((1 - d[:, None] * w[None, :]) - R)[obs]
print('rank-2 fit residual  median %.5f  p95 %.5f' % (np.median(resid), np.percentile(resid, 95)), flush=True)
print('d(t): first %.4f  mid %.4f  last %.4f  monotonic=%s'
      % (d[0], d[T // 2], d[-1], bool(np.all(np.diff(d) > -1e-4))), flush=True)

# ---- 4. depth groups from the author's measured feature regions ------------
track = json.load(open('public/video/tracking-preview.json'))
wg = {}
for region in track['regionMapping']:
    depth = region['depth']
    sel = np.zeros(N, bool)
    for poly in region['featureRegionPolygons']:
        cnt = np.array(poly, np.float32).reshape(-1, 1, 2)
        sel |= np.array([cv2.pointPolygonTest(cnt, (float(x), float(y)), False) >= 0
                         for x, y in p0])
    cand = w[sel & good & (np.sum(obs, 0) > 12)]
    wg[depth] = float(np.median(cand))
    print('  depth %d: %4d seed features -> w=%.4f' % (depth, sel.sum(), wg[depth]), flush=True)

# enforce monotonic depth ordering (1 = nearest = largest inverse depth)
order = [wg[k] for k in sorted(wg)]
print('  inverse depths near->far:', [round(v, 4) for v in order],
      'monotonic=', all(order[i] > order[i + 1] for i in range(len(order) - 1)), flush=True)

# ---- 5. residual translation T(t), fitted per frame on group-mean scale ----
Tt = np.zeros((T, 2))
for t in range(1, T):
    m = obs[t]
    if m.sum() < 20: continue
    s_pred = 1.0 / (1.0 - d[t] * w[m])
    pred = foe + s_pred[:, None] * (p0[m] - foe)
    Tt[t] = np.median(pts[t][m] - pred, axis=0)
print('residual translation max |T| = %.2f px' % np.abs(Tt).max(), flush=True)

np.savez(sys.argv[2], foe=foe, d=d, w=w, Tt=Tt,
         wg=np.array([wg[k] for k in sorted(wg)]), size=np.array([W, H]))
print('saved')
