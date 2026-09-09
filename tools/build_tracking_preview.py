#!/usr/bin/env python3
"""Root-authorized opt-in2D experiment, distinct from default/production tracking."""
import argparse
import json
from pathlib import Path
from video_frames import write_json, digest


def build(args):
    registration=json.loads(Path(args.registration).read_text())
    flow=json.loads(Path(args.flow).read_text())
    folder=Path(args.video_directory).resolve(strict=True)
    frames=json.loads((folder/'frames.json').read_text())
    target=folder/'tracking-preview.json'
    if target.exists():raise ValueError('Frozen preview exists; refuse replacement')
    expected='4d8fa4dbf444ebbcdde91ed6ac91859463f387b16f0b7a30ff6497b31948dd8a'
    if not(registration['videoSha256']==flow['videoSha256']==frames['source']['videoSha256']==expected):
        raise ValueError('Exact clip identity mismatch')
    if registration['inliers']<20 or registration['p95ResidualReviewPx']>2:
        raise ValueError('Initial registration gate failed')
    if [(f['index'],f['time']) for f in flow['frames']] != [(f['index'],f['time']) for f in frames['frames']]:
        raise ValueError('Flow/frame timeline mismatch')
    for frame in flow['frames']:
        if {g['depth'] for g in frame['groups']}!={1,2,3,4,5}:
            raise ValueError('Each frame needs all five explicit validity decisions')
        for group in frame['groups']:
            if (group['affine'] is None)==group['valid']:
                raise ValueError('Invalid fit must be null; valid fit must have measured affine')
    result={'schemaVersion':1,'reviewStatus':'preview-only','enabled':True,
        'method':'measured-2d-flow','videoSha256':expected,
        'label':'Video preview · 2D tracked alignment; depth is approximate.',
        'activation':'Only after explicit visitor opt-in; original/default/Still behavior unchanged.',
        'coordinateSpace':{'width':registration['nativeVideoSize'][0],'height':registration['nativeVideoSize'][1]},
        'sourcePlateCoordinateSpace':{'width':registration['sourcePlateSize'][0],'height':registration['sourcePlateSize'][1]},
        'initialMatrix':registration['plateToFirstVideoNative'],
        'initialRegistrationQuality':{k:registration[k] for k in ('matches','inliers','medianResidualReviewPx','p95ResidualReviewPx','inlierSpanReviewPx')},
        'regionMapping':[{'depth':i+1,'referenceFrameIndex':0,'referenceImageSize':[1280,960],
            'featureRegionPolygons':region,'assignment':'Existing authored easel-pair depth uses apparent near-to-far pier feature group; physical depth is approximate.'}
            for i,region in enumerate(flow['regionPolygonsAt1280'])],
        'slotDepths':[{'id':slot['id'],'depth':slot['depth']} for slot in registration['slots']],
        'frames':flow['frames'],'qualitySummary':flow['summary'],
        'compositionOrder':'viewport cover transform × native frame-group affine × initial plate-to-video matrix; no legacy travel scaling',
        'invalidGroupPolicy':'Hide that group and its interactive anchors/category signs for that frame; no interpolation or stale transform reuse.',
        'limitations':['Generated4:3 video is not the unchanged3:2 source photograph.',
            'Initial image registration and per-region feature flow are measured; physical easel depth/camera pose are not solved.',
            'Manual pier feature regions may contain crossing members; low inlier residual does not prove ground contact.',
            'Invalid groups disappear in this opt-in experiment; disappearance is not certified physical occlusion.',
            'Photographic2.5D sprites cannot reveal unseen sides, backs or missing wood.']}
    write_json(target,result)
    text=target.read_text()
    if '/Users/' in text or 'https://' in text or 'command' in result:
        raise ValueError('Unexpected private path, external URL, or command in preview packet')
    print(json.dumps({'path':str(target),'sha256':digest(target),'frames':len(result['frames']),
                      'enabled':'explicit-opt-in-only','method':result['method']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('registration','flow','video-directory'):parser.add_argument('--'+name,required=True)
    build(parser.parse_args())
