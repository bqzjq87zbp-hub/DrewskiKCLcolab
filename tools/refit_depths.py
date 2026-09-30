#!/usr/bin/env python3
"""Re-estimate per-feature inverse depth on ABSOLUTE pixel error.

The radial-ratio estimator divides by r0, so features near the focus of
expansion (exactly where the far easels stand) get their noise amplified.
Fitting || predicted - observed ||^2 in pixels is well conditioned everywhere.
d(t), T(t) and the FoE come from the global solve, which the strong near
features determine on their own.
"""
import sys, json, numpy as np, cv2

z = np.load(sys.argv[1]); m = np.load(sys.argv[2])
pts, alive, p0 = z['pts'], z['alive'], z['p0']
foe, d, Tt = m['foe'], m['d'], m['Tt']
T, N = alive.shape

rad = p0 - foe                                  # (N,2)
grid = np.linspace(-0.10, 2.60, 541)            # candidate inverse depths

best_w = np.full(N, np.nan); best_e = np.full(N, np.inf); nobs = alive.sum(0)
for i in range(N):
    ts = np.where(alive[:, i])[0]
    if len(ts) < 8:
        continue
    dt = d[ts][:, None]                          # (K,1)
    den = 1.0 - dt * grid[None, :]               # (K,G)
    den[np.abs(den) < 1e-3] = np.nan
    px = foe[0] + rad[i, 0] / den + Tt[ts, 0][:, None]
    py = foe[1] + rad[i, 1] / den + Tt[ts, 1][:, None]
    err = np.nanmean((px - pts[ts, i, 0][:, None]) ** 2 +
                     (py - pts[ts, i, 1][:, None]) ** 2, axis=0)
    if np.all(np.isnan(err)):
        continue
    k = int(np.nanargmin(err))
    # parabolic refinement on the 1-D error curve
    if 0 < k < len(grid) - 1 and np.all(np.isfinite(err[k-1:k+2])):
        a, b, c = err[k-1], err[k], err[k+1]
        denom = a - 2*b + c
        off = 0.5 * (a - c) / denom if abs(denom) > 1e-12 else 0.0
        best_w[i] = grid[k] + np.clip(off, -1, 1) * (grid[1] - grid[0])
    else:
        best_w[i] = grid[k]
    best_e[i] = np.sqrt(err[k])

fit = np.isfinite(best_w) & (best_e < 3.0) & (nobs > 12)
print('features with a trusted depth: %d  (rms<3px)' % fit.sum(), flush=True)
print('  reprojection rms  median %.3f px  p95 %.3f px'
      % (np.median(best_e[fit]), np.percentile(best_e[fit], 95)), flush=True)

# ---- depth groups: author's pier regions, plus each easel's own footprint ---
track = json.load(open('public/video/tracking-preview.json'))
M = np.array(track['initialMatrix'], float)
slots = json.load(open('public/slots.json'))
kx, ky = 3326 / 1280, 2494 / 960

def plate_to_small(pt):
    v = M @ np.array([pt[0], pt[1], 1.0])
    return np.array([v[0] / v[2] / kx, v[1] / v[2] / ky])

base_pts = {}
for s in slots:
    q = np.array(s['quad'], float)
    base = q[np.argsort(q[:, 1])[-2:]].mean(0)   # midpoint of the lower edge
    base_pts.setdefault(s['depth'], []).append(plate_to_small(base))

out = {}
for region in track['regionMapping']:
    depth = region['depth']
    sel = np.zeros(N, bool)
    for poly in region['featureRegionPolygons']:
        cnt = np.array(poly, np.float32).reshape(-1, 1, 2)
        sel |= np.array([cv2.pointPolygonTest(cnt, (float(x), float(y)), False) >= 0
                         for x, y in p0])
    # add features within 90px of either easel base at this depth
    near = np.zeros(N, bool)
    for b in base_pts[depth]:
        near |= np.linalg.norm(p0 - b, axis=1) < 90.0
    cand = best_w[(sel | near) & fit]
    out[depth] = (float(np.median(cand)), int(len(cand)),
                  [round(float(x), 1) for x in base_pts[depth][0]])
    print('  depth %d: n=%3d  w=%.4f  base~%s' % (depth, len(cand), out[depth][0], out[depth][2]), flush=True)

vals = [out[k][0] for k in sorted(out)]
print('inverse depth near->far:', [round(v, 4) for v in vals])
print('strictly decreasing:', all(vals[i] > vals[i+1] for i in range(len(vals)-1)))
np.savez(sys.argv[3], w=best_w, err=best_e, fit=fit,
         wg=np.array(vals), nobs=nobs)
