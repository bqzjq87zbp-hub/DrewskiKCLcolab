#!/usr/bin/env python3
"""Track frame-0 features forward through the sequence with LK + FB rejection.
Emits tracks.npz: p0 (N,2) frame-0 positions, pts (T,N,2), alive (T,N) bool."""
import sys, glob, numpy as np, cv2

frames = sorted(glob.glob(sys.argv[1] + '/f-*.jpg'))
T = len(frames)
g0 = cv2.imread(frames[0], cv2.IMREAD_GRAYSCALE)
H, W = g0.shape
print('frames', T, 'size', W, 'x', H, flush=True)

# Dense, well-spread corners across the whole scene (pier structure is high-contrast).
p0 = cv2.goodFeaturesToTrack(g0, maxCorners=4000, qualityLevel=0.005,
                             minDistance=8, blockSize=7)
p0 = p0.reshape(-1, 2).astype(np.float32)
print('seed features', len(p0), flush=True)

N = len(p0)
pts = np.full((T, N, 2), np.nan, np.float32)
alive = np.zeros((T, N), bool)
pts[0] = p0; alive[0] = True

lk = dict(winSize=(31, 31), maxLevel=4,
          criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 0.01))
cur = p0.copy()
idx = np.arange(N)          # indices of still-living tracks
prev = g0
for t in range(1, T):
    nxt = cv2.imread(frames[t], cv2.IMREAD_GRAYSCALE)
    fwd, st, _ = cv2.calcOpticalFlowPyrLK(prev, nxt, cur, None, **lk)
    back, st2, _ = cv2.calcOpticalFlowPyrLK(nxt, prev, fwd, None, **lk)
    fb = np.linalg.norm(back - cur, axis=1)
    ok = (st.ravel() == 1) & (st2.ravel() == 1) & (fb < 1.0)
    # Drop anything that leaves the frame (with a small margin).
    ok &= (fwd[:, 0] > 2) & (fwd[:, 0] < W - 3) & (fwd[:, 1] > 2) & (fwd[:, 1] < H - 3)
    idx, cur, prev = idx[ok], fwd[ok], nxt
    pts[t, idx] = cur; alive[t, idx] = True
    if t % 40 == 0 or t == T - 1:
        print(f'  t={t:3d} alive={len(idx)}', flush=True)

np.savez_compressed(sys.argv[2], p0=p0, pts=pts, alive=alive, size=np.array([W, H]))
print('surviving to last frame:', alive[-1].sum(), '/', N)
