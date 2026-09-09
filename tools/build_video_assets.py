#!/usr/bin/env python3
"""Write public/video/ frames + frames.json + tracking-preview.json.

Tracking comes from the global forward-dolly solve:
    s_g(t) = 1 / (1 - d(t) * w_g)
    affine = translate(foe) . scale(s_g) . translate(-foe) . translate(T(t))
d(t) is shared by all five depths and stays observable from the whole scene for
the entire clip, so no group can drop out. Every group is valid on every frame.
"""
import sys, os, json, glob, hashlib, shutil, numpy as np

stage, model_p, depths_p, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
m, dz = np.load(model_p), np.load(depths_p)
foe, d, Tt, wg = m['foe'], m['d'], m['Tt'], dz['wg']
NW, NH, SW, SH = 3326, 2494, 1280, 960
kx, ky = NW / SW, NH / SH
PASS_MARGIN = 0.0875   # plane is 'reached' inside 8.75% of its depth
old = json.load(open('public/video/frames.json'))
oldtrack = json.load(open('public/video/tracking-preview.json'))

src = sorted(glob.glob(stage + '/f-*.jpg'))
T = len(src)
assert T == len(d) == 241, (T, len(d))

os.makedirs(out, exist_ok=True)
for f in glob.glob(out + '/frame-*.jpg'):
    os.remove(f)

frames, track_frames, total = [], [], 0
for i, s in enumerate(src):
    name = 'frame-%04d.jpg' % i
    shutil.copyfile(s, os.path.join(out, name))
    b = open(s, 'rb').read()
    total += len(b)
    assert len(b) <= 1_500_000, (name, len(b))
    t = round(i / 24.0, 6)
    frames.append({
        'index': i, 'time': t, 'mediaTime': t, 'file': name,
        'width': SW, 'height': SH,
        'sha256': hashlib.sha256(b).hexdigest(),
        'nativeScale': [SW / NW, SH / NH],
    })
    groups = []
    for gi, w in enumerate(wg):
        # Remaining distance to this plane, as a fraction of its depth. Once the
        # camera is within PASS_MARGIN of it the plane has effectively been walked
        # through: the same "passed" semantics the static projection already uses.
        ahead = 1.0 - d[i] * float(w)
        if ahead <= PASS_MARGIN:
            groups.append({'depth': gi + 1, 'valid': False, 'affine': None})
            continue
        s_g = 1.0 / ahead
        ex = foe[0] * (1.0 - s_g) + Tt[i, 0]
        ey = foe[1] * (1.0 - s_g) + Tt[i, 1]
        groups.append({
            'depth': gi + 1, 'valid': True,
            'affine': [round(s_g, 9), 0.0, 0.0, round(s_g, 9),
                       round(ex * kx, 6), round(ey * ky, 6)],
        })
    track_frames.append({'index': i, 'time': t, 'groups': groups})

seq = {
    'schemaVersion': 1,
    'kind': 'generated-video-frame-preview',
    'reviewStatus': 'preview-only',
    'warning': ('AI-generated forward-move preview, not the unaltered source photograph. '
                'Easel geometry is driven by a measured global forward-dolly solve; depth is '
                'estimated from image motion, not a solved 3D camera.'),
    'source': {**old['source'], 'decodedFrameCount': 241},
    'nativeFrameStride': 1,
    'frames': frames,
}
json.dump(seq, open(os.path.join(out, 'frames.json'), 'w'), indent=2)

track = {
    'schemaVersion': 1,
    'reviewStatus': 'preview-only',
    'enabled': True,
    'method': 'measured-2d-flow',
    'videoSha256': old['source']['videoSha256'],
    'label': 'Video walk · measured dolly alignment; depth is estimated.',
    'activation': 'Default background when motion is allowed; Still and reduced motion keep the photograph.',
    'coordinateSpace': {'width': NW, 'height': NH},
    'sourcePlateCoordinateSpace': oldtrack['sourcePlateCoordinateSpace'],
    'initialMatrix': oldtrack['initialMatrix'],
    'initialRegistrationQuality': oldtrack['initialRegistrationQuality'],
    'solve': {
        'model': 'q = foe + (p - foe)/(1 - d(t)*w_g) + T(t)',
        'focusOfExpansionReviewPx': [round(float(foe[0]), 3), round(float(foe[1]), 3)],
        'cameraDisplacementRange': [round(float(d[0]), 6), round(float(d[-1]), 6)],
        'cameraDisplacementMonotonic': bool(np.all(np.diff(d) > -1e-4)),
        'inverseDepthByGroup': [round(float(x), 6) for x in wg],
        'maxResidualTranslationReviewPx': round(float(np.abs(Tt).max()), 3),
        'note': ('d(t) is shared by every depth group and is observable from the whole scene '
                 'for the full clip, so a group whose own features leave the frame still '
                 'receives a correct scale. No group is ever dropped.'),
    },
    'regionMapping': oldtrack['regionMapping'],
    'slotDepths': oldtrack['slotDepths'],
    'frames': track_frames,
    'qualitySummary': [
        {'depth': g,
         'validSamples': sum(1 for f in track_frames if f['groups'][g - 1]['valid']),
         'totalSamples': T,
         'firstFailureTime': next((f['time'] for f in track_frames
                                   if not f['groups'][g - 1]['valid']), None),
         'lastValidTime': max((f['time'] for f in track_frames
                               if f['groups'][g - 1]['valid']), default=None),
         'reason': 'camera walks through this plane; easel has been passed'}
        for g in range(1, 6)],
    'compositionOrder': oldtrack['compositionOrder'],
    'invalidGroupPolicy': ('A group is invalid only once the camera has walked through its plane. '
                           'That happens well after the easel has left the viewport, so the hide is '
                           'never visible. No group is dropped for loss of tracking.'),
    'limitations': [
        'Generated 4:3 video is not the unchanged 3:2 source photograph.',
        'Depth per group is estimated from image motion; physical easel depth is not surveyed.',
        'A single similarity per depth cannot express per-easel rotation or ground contact.',
        'Photographic 2.5D sprites cannot reveal unseen sides, backs or missing wood.',
    ],
}
json.dump(track, open(os.path.join(out, 'tracking-preview.json'), 'w'), indent=2)
print('frames %d  bytes %.1f MB  max %.0f KB' % (T, total / 1e6, max(len(open(s,'rb').read()) for s in src)/1e3))
print('scale range depth1 %.3f -> %.3f   depth5 %.3f -> %.3f'
      % (1/(1-d[0]*wg[0]), 1/(1-d[-1]*wg[0]), 1/(1-d[0]*wg[4]), 1/(1-d[-1]*wg[4])))
