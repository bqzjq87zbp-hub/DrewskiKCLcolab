#!/usr/bin/env python3
"""Explicit local-only staging of reviewed preview derivatives; never a publish command."""
import argparse
import json
import shutil
from pathlib import Path
from video_frames import digest, write_json


def stage(source, destination):
    source = Path(source).resolve(strict=True)
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError('Refusing to replace an existing destination')
    manifest = json.loads((source / 'frames.json').read_text())
    if manifest['kind'] != 'web-frame-candidate':
        raise ValueError('Only a sequence candidate can be staged')
    if manifest['sourceHashesBefore'] != manifest['sourceHashesAfter']:
        raise ValueError('Source identity gate failed')
    from PIL import Image
    for record in manifest['frames']:
        path = source / record['file']
        if path.parent != source or path.suffix != '.jpg' or digest(path) != record['sha256']:
            raise ValueError('Invalid frame path, type, or hash')
        with Image.open(path) as image:
            image.load()
            if image.size != (record['width'], record['height']):
                raise ValueError('Frame dimension mismatch')
    safe_source = {k: manifest['source'][k] for k in ('videoSha256', 'sourceImageSha256',
        'nativeWidth', 'nativeHeight', 'duration', 'colorPrimaries', 'colorTransfer',
        'timestampOrigin', 'decodedFrameCount')}
    clean = {'schemaVersion': 1, 'kind': 'generated-video-frame-preview',
        'reviewStatus': 'preview-only',
        'warning': 'AI-generated forward-move preview. Not pixel-faithful original, not a solved3D camera.4:3 output differs from3:2 source. Temporal/tracking review is pending; no tracked easel geometry is enabled.',
        'source': safe_source, 'nativeFrameStride': manifest['nativeFrameStride'],
        'frames': manifest['frames']}
    destination.mkdir(parents=True, exist_ok=False)
    for record in manifest['frames']:
        shutil.copy2(source / record['file'], destination / record['file'])
    write_json(destination / 'frames.json', clean)
    tracking = json.loads((source / 'tracking.unreviewed.json').read_text())
    write_json(destination / 'tracking.json', tracking)
    result = {'status': 'local-preview-staged-not-published', 'count': len(clean['frames']),
        'jpegBytes': sum((destination / r['file']).stat().st_size for r in clean['frames']),
        'framesManifestSha256': digest(destination / 'frames.json'),
        'trackingEnabled': False}
    print(json.dumps(result))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    stage(args.source, args.destination)
