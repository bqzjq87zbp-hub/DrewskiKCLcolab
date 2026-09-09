#!/usr/bin/env python3
"""Stage measured but explicitly experimental2D data; never enables tracking."""
import argparse
import json
from pathlib import Path
from video_frames import write_json, digest


def stage(args):
    registration=json.loads(Path(args.registration).read_text())
    flow=json.loads(Path(args.flow).read_text())
    out=Path(args.out).resolve(strict=True)
    frames=json.loads((out/'frames.json').read_text())
    if not(registration['videoSha256']==flow['videoSha256']==frames['source']['videoSha256']):
        raise ValueError('Video identity mismatch')
    for name in ('initial-registration.json','tracking-experiment.json'):
        if (out/name).exists():raise ValueError('Refusing to overwrite '+name)
    experiment={'schemaVersion':1,'kind':'measured-2d-flow-experiment','enabled':False,
        'reviewStatus':'experimental-not-production-tracking',
        'videoSha256':flow['videoSha256'],'nativeVideoSize':registration['nativeVideoSize'],
        'initialPlateToVideoNative':registration['plateToFirstVideoNative'],
        'initialSlots':registration['slots'],'frames':flow['frames'],
        'summary':flow['summary'],'method':flow['method'],
        'invalidGroupPolicy':'No interpolation or stale matrix reuse; explicit experiment may hide that group for that frame.',
        'limitations':registration['limitations']+flow['limitations']}
    write_json(out/'initial-registration.json',registration)
    write_json(out/'tracking-experiment.json',experiment)
    print(json.dumps({'enabled':False,'initialRegistrationSha256':digest(out/'initial-registration.json'),
                      'flowExperimentSha256':digest(out/'tracking-experiment.json')}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('registration','flow','out'):parser.add_argument('--'+name,required=True)
    stage(parser.parse_args())
