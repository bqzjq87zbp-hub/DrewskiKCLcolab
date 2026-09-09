#!/usr/bin/env python3
"""Local, non-destructive video review/extraction. Never supplies guessed tracking.

Requires ffmpeg/ffprobe on PATH and Pillow for review contact sheets.
Outputs must be a NEW directory outside public/. Source files are never written.
"""
import argparse
import hashlib
import json
import math
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=600)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:])
    return result.stdout


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def probe(source):
    data = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                           '-of', 'json', str(source)]))
    videos = [s for s in data['streams'] if s.get('codec_type') == 'video']
    if len(videos) != 1:
        raise ValueError('Exactly one video stream is required for this workflow')
    video = videos[0]
    rotation = float(video.get('tags', {}).get('rotate', 0))
    for side in video.get('side_data_list', []):
        rotation = float(side.get('rotation', rotation))
    if rotation % 360:
        raise ValueError('Rotated media needs a separately reviewed coordinate transform')
    if video.get('sample_aspect_ratio', '1:1') not in ('1:1', 'N/A'):
        raise ValueError('Non-square pixels need a separately reviewed coordinate transform')
    if video.get('color_transfer') in ('smpte2084', 'arib-std-b67'):
        raise ValueError('HDR media needs an explicit, reviewed display conversion')
    frames = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_frames', '-show_entries',
        'frame=best_effort_timestamp_time,width,height,key_frame', '-of', 'json',
        str(source)]))['frames']
    if not frames or len(frames) > 2000:
        raise ValueError('Empty or over-2000-frame input is outside this bounded workflow')
    times = [float(f['best_effort_timestamp_time']) for f in frames]
    if any(not math.isfinite(t) for t in times) or any(b <= a for a, b in zip(times, times[1:])):
        raise ValueError('Frame timestamps must be finite and strictly increasing')
    if any((f['width'], f['height']) != (video['width'], video['height']) for f in frames):
        raise ValueError('Changing video dimensions are unsupported')
    origin = times[0]
    return data, video, [{**f, 'index': i, 'mediaTime': times[i],
                         'time': times[i] - origin} for i, f in enumerate(frames)]


def contact_sheet(paths, labels, output):
    from PIL import Image, ImageDraw
    cell_w, cell_h = 640, 525
    sheet = Image.new('RGB', (cell_w * 3, cell_h * math.ceil(len(paths) / 3)), '#152029')
    draw = ImageDraw.Draw(sheet)
    for i, (path, label) in enumerate(zip(paths, labels)):
        with Image.open(path) as src:
            image = src.convert('RGB')
            image.thumbnail((cell_w - 16, cell_h - 42))
            x, y = (i % 3) * cell_w, (i // 3) * cell_h
            sheet.paste(image, (x + (cell_w - image.width) // 2, y + 32))
            draw.text((x + 10, y + 9), label, fill='white')
    sheet.save(output, quality=93)


def extract(args):
    source = Path(args.input).expanduser().resolve(strict=True)
    original = Path(args.source_image).expanduser().resolve(strict=True) if args.source_image else None
    out = Path(args.out).expanduser().resolve()
    public = Path(__file__).resolve().parent.parent / 'public'
    if out == public or public in out.parents:
        raise ValueError('Quarantine extraction outside public/; release is a separate gate')
    if out.exists():
        raise ValueError('Refusing to overwrite an existing output directory')
    if args.max_edge < 128 or args.max_edge > 1920:
        raise ValueError('Review/web extraction is bounded to128–1920px; native analysis is separate')
    before = {'video': digest(source), 'sourceImage': digest(original) if original else None}
    data, video, timeline = probe(source)
    if timeline[-1]['time'] > 30:
        raise ValueError('Over30s input is outside the bounded workflow')
    requested = [float(x) for x in args.times.split(',')]
    if args.mode == 'review' and any(not math.isfinite(t) or t < 0 or t > timeline[-1]['time'] for t in requested):
        raise ValueError('Requested review times must be within the decoded timeline')
    if not 1 <= args.every <= 24:
        raise ValueError('--every must be between1 and24 native frames')
    indices = list(range(0, len(timeline), args.every)) if args.mode == 'sequence' else sorted(set(
        min(range(len(timeline)), key=lambda i: abs(timeline[i]['time'] - t)) for t in requested))
    out.mkdir(parents=True, exist_ok=False)
    try:
        write_json(out / 'ffprobe.json', data)
        write_json(out / 'timeline.json', timeline)
        filters = []
        if args.mode == 'review':
            filters.append("select='" + '+'.join(f'eq(n,{i})' for i in indices) + "'")
        elif args.every > 1:
            filters.append(f"select='not(mod(n,{args.every}))'")
        # Fit inside a square bound: no crop, interpolation, FPS conversion, or upscale.
        filters.append(f"scale=w='min(iw,{args.max_edge})':h='min(ih,{args.max_edge})':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos")
        command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
            '-noautorotate', '-i', str(source), '-map', '0:v:0', '-an', '-sn', '-dn',
            '-vf', ','.join(filters), '-fps_mode', 'passthrough', '-q:v', '2',
            '-start_number', '0', str(out / 'frame-%04d.jpg')]
        run(command)
        paths = sorted(out.glob('frame-*.jpg'))
        if len(paths) != len(indices):
            raise ValueError(f'Frame count mismatch: {len(paths)} vs {len(indices)}')
        from PIL import Image
        records = []
        for path, index in zip(paths, indices):
            with Image.open(path) as image:
                image.load()
                width, height = image.size
            records.append({'index': index, 'time': timeline[index]['time'],
                'mediaTime': timeline[index]['mediaTime'], 'file': path.name,
                'width': width, 'height': height, 'sha256': digest(path),
                'nativeScale': [width / video['width'], height / video['height']]})
        after = {'video': digest(source), 'sourceImage': digest(original) if original else None}
        if before != after:
            raise ValueError('Input changed during extraction; output must not be released')
        manifest = {'schemaVersion': 1, 'kind': 'review-frames' if args.mode == 'review' else 'web-frame-candidate',
            'createdAt': datetime.now(timezone.utc).isoformat(), 'reviewStatus': 'pending',
            'source': {'videoFilename': source.name, 'videoSha256': before['video'],
                'sourceImageFilename': original.name if original else None,
                'sourceImageSha256': before['sourceImage'], 'nativeWidth': video['width'],
                'nativeHeight': video['height'], 'duration': data['format'].get('duration'),
                'colorPrimaries': video.get('color_primaries'), 'colorTransfer': video.get('color_transfer'),
                'timestampOrigin': timeline[0]['mediaTime'], 'decodedFrameCount': len(timeline)},
            'sourceHashesBefore': before, 'sourceHashesAfter': after,
            'transform': 'full-frame proportional resize only; FFmpeg video-to-JPEG RGB conversion; no crop or artistic grade',
            'requestedReviewTimes': requested if args.mode == 'review' else None,
            'nativeFrameStride': args.every if args.mode == 'sequence' else None,
            'command': command, 'ffmpegVersion': run(['ffmpeg', '-version']).splitlines()[0],
            'frames': records}
        write_json(out / 'frames.json', manifest)
        tracking = {'schemaVersion': 1, 'enabled': False, 'reviewStatus': 'pending',
            'method': 'none', 'videoSha256': before['video'],
            'coordinateSpace': {'kind': 'native-video-pixels', 'width': video['width'],
                'height': video['height'], 'origin': 'top-left', 'quadOrder': 'TL,TR,BR,BL'},
            'timestampOrigin': timeline[0]['mediaTime'], 'interpolation': 'none',
            'slotIds': [], 'frames': [], 'review': None,
            'warning': 'Empty scaffold. No easels or camera geometry have been tracked. Do not enable.'}
        write_json(out / 'tracking.unreviewed.json', tracking)
        if args.mode == 'review':
            contact_sheet(paths, [f"Frame {r['index']} · {r['time']:.4f}s" for r in records], out / 'contact-sheet.jpg')
        print(json.dumps({'status': 'extracted-not-reviewed', 'out': str(out),
                          'frames': len(records), 'videoSha256': before['video']}))
    except Exception as error:
        (out / 'EXTRACTION-FAILED.txt').write_text(str(error) + '\n')
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['review', 'sequence'])
    parser.add_argument('--input', required=True)
    parser.add_argument('--source-image')
    parser.add_argument('--out', required=True)
    parser.add_argument('--times', default='0,2,4,6,8,9.9')
    parser.add_argument('--max-edge', type=int, default=1280)
    parser.add_argument('--every', type=int, default=1, help='Sequence only: select every Nth actual frame; no interpolation')
    args = parser.parse_args()
    for tool in ['ffmpeg', 'ffprobe']:
        if not shutil.which(tool):
            parser.error(f'{tool} is required on PATH')
    extract(args)


if __name__ == '__main__':
    main()
