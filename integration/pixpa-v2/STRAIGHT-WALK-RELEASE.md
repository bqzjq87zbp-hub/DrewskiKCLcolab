# Straight scroll travel — September 11, 2026

[Certain] Published to the existing public gallery as Sites18 at2026-09-11T16:39:50.442651Z. Hosting source `eabd8589db7be166352f84b4899090fe913b8dc3`; exact bounded rollback is Sites17 source `d9763848c59dfe8d1bfdd05de1a5ef3b2eb2ef90`. No native Pixpa field, image or account setting changed.

## Cause and correction

Kyle's real-phone report showed vertical scrolling looked left/right rather than walking clearly forward. A fresh public390px Chrome compositor swipe reproduced it:701 scroll pixels moved just0.08825 authored metres, while yaw swept from+0.39 to−0.35965 radians. The previous authored reading intervals reserved about92% of travel for short bridges and automatically rotated portrait views. Numerical progress alone had missed this experiential failure.

The four-file repair makes distance equal `7 * clamp(progress)`, starts looking ahead, and removes automatic scroll-driven turning. Explicit Left/Ahead/Right controls hold a chosen heading independently of travel and are now visible outside Menu on supported portrait phones. All targets are at least48px high. Pair shortcuts use quarter stops, each placing its pair3.2m ahead. The original photographic camera calibration, safe source envelope, print aspect ratios, geometry, water, material/sheens, natural page scroll, reduced-motion and Still fallback remain unchanged.

## Current evidence

- [Actual-public browser results](evidence/straight-walk/public-checks.json):9 profiles/682 checks, allPASS. Chrome320/390/430 portrait,844landscape,768tablet use compositor touch;1024/1440 desktop use native wheel; Mac WebKit390 uses real PageDown/PageUp focused inside the iframe, not a synthetic touch claim; reduced-motion390 passed.
- Actual forward/reverse inputs change translation with unchanged forward heading. Explicit look holds while scrolling. Collection/viewer/Escape and exact return, source-edge coverage, no overflow, frozen print dimensions and Still fallback passed. Four public script/style hashes match the released candidate; categories remain48,279B/SHA256 `825e08e10d64116a0b18ed65ce7c9072135a5c3bff0d4288a03bc8d6afdced25`.
- [Rendered progression and controls](evidence/straight-walk/README.md) were inspected independently as well as by the publisher. Controls do not overlap Back/fullscreen/progress; landscape correctly hides unsupported side looking.
- The source preview independently passed2,647 source/math/browser checks at390/1440. [Current source helper](../../scripts/qa-straight-walk.mjs) and [contract](../../docs/straight-walk/README.md) replace the old B7m auto-yaw assumptions for this repair; historical evidence remains frozen.
- Rebuild:295 mapped paths/194,808,089bytes match the hosted source byte-for-byte. External58 native derivatives/38,294,003bytes remain verified. All111 records, ten easels and original photographs preserved.

## Limits

Browser profiles are desktop-engine emulations, not physical-iPhone certification or cellular-performance measurements. The original photograph remains continuous shallow-parallax scenery; hidden pylons are not reconstructed. Near prints can leave a narrow viewport as the viewer passes or looks sideways; this is perspective clipping, not cropped/stretched source images. Opening a collection still offers complete-frame enlargement.

[Public Pixpa gallery](https://kiyonocreativelab.com/pier-gallery?repair=straight-walk-live-20260911) · [Direct gallery](https://kiyono-coastal-gallery.kiyonophotography.chatgpt.site/pier-v2-20260910/)

No force push or merge is part of this handoff. Existing PR journal, collaborator work and main are preserved.
