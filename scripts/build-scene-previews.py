#!/usr/bin/env python3
"""Reproducible, full-frame scene previews from existing public photographs."""
import hashlib
import io
import json
import struct
from pathlib import Path
from PIL import Image, ImageCms, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
slots = json.loads((PUBLIC / 'slots.json').read_text())
categories = json.loads((PUBLIC / 'categories.json').read_text())['categories']
urls = {s['src'] for s in slots}
urls.update(c['items'][0]['src'] for c in categories)
urls.add('/media/underpier-photograph.jpg')
profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB'))
# Stable ICC creation date: profile colorimetry is unchanged across rebuilds.
profile_bytes = bytearray(profile.tobytes())
profile_bytes[24:36] = struct.pack('>6H', 2026, 9, 10, 0, 0, 0)
profile_bytes = bytes(profile_bytes)
records = []
for url in sorted(urls):
    source = PUBLIC / url.lstrip('/')
    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original)
        source_size = im.size
        if original.info.get('icc_profile'):
            im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(io.BytesIO(original.info['icc_profile'])), profile, outputMode='RGB')
        else:
            im = im.convert('RGB')
        bound = 1600 if source.name == 'underpier-photograph.jpg' else 1024
        im.thumbnail((bound, bound), Image.Resampling.LANCZOS)
        dest = PUBLIC / 'media/scene-mobile' / source.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, 'JPEG', quality=84, optimize=True, progressive=True, icc_profile=profile_bytes)
        records.append({'source': url, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                        'source_width': source_size[0], 'source_height': source_size[1],
                        'path': '/media/scene-mobile/' + source.name, 'width': im.width, 'height': im.height,
                        'bytes': dest.stat().st_size, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()})
(ROOT / 'docs/mobile-scene-assets.json').write_text(json.dumps({'schema': 'kcl-scene-previews-v1',
    'purpose': 'Scene display only; original gallery identities, URLs and full files are unchanged.',
    'processing': 'Orientation normalized, ICC to sRGB, proportional Lanczos resize, JPEG84; no crop or retouch.',
    'assets': records}, indent=2) + '\n')
mapping = {Path(r['source']).name: {'file': Path(r['path']).name, 'width': r['source_width'], 'height': r['source_height']} for r in records}
(PUBLIC / 'scene-images.js').write_text('const previews = ' + json.dumps(mapping, indent=2) + ';\n\n' + '''export const mobileScene = matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 600px)').matches;
export function sceneImage(source, preview = mobileScene) {
  const record = previews[new URL(source, location.href).pathname.split('/').pop()];
  return preview && record ? (record.url || new URL('./media/scene-mobile/' + record.file, import.meta.url).href) : source;
}
export function sceneSourceSize(source) {
  return previews[new URL(source, location.href).pathname.split('/').pop()] || null;
}
''')
print(json.dumps({'images': len(records), 'bytes': sum(r['bytes'] for r in records),
                  'rgba_bytes': sum(r['width'] * r['height'] * 4 for r in records)}))
