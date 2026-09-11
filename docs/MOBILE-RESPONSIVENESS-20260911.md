# Mobile pier responsiveness — bounded review handoff

2026-09-11. This is the five-file performance change and reproducible integration handoff, not a physical-iPhone performance or publication certificate.

## Exact source

- Standalone source: `4aa23292a36010ba2110f7d25dd3d848bafe87bf`.
- Adapted HOST source: `bcc79184027b8697621b2299e9cffcef16c33a58`.
- Review-handoff baseline: `b1749ab0c8da1ecf449263c84f15401aecb1970f`.
- Changed runtime files: `aisle-integration.js`, `aisle/aisle.css`, `aisle/photographic-aisle.js`, `aisle/physical-display.js`, and `aisle/physical-easel.js` in both standalone `public/` and integration runtime overrides. Only those five asset-map hashes and byte sizes change.

The patch removes the approximately 30-fps paint gate, shortens phone scroll travel, caches repeated diagnostics and layout work, and batches static opaque easel parts. Native scroll still maps linearly to forward/back distance; only explicit look controls change heading. The leg-bearing timber stays separate for the existing underwater selection. No photograph, category record, crop, camera-layout constant, water shader or texture-quality reduction is included.

## Recorded matched local measurements

[Certain] The authoritative bounded comparison used Chrome 152.0.7977.83 on an M3 Pro host, 390×844 CSS, deviceScaleFactor 3, effective scene DPR 1.5, and trusted non-flinging touch gestures. These are matched scratch-to-scratch measurements, not public-network or hardware-phone benchmarks.

| Metric | Before | Candidate |
|---|---:|---:|
| Scroll range for 7 m | 7,596 px | 4,642 px |
| Approximately 380 px forward swipe | 0.352 m | 0.575 m |
| Main + reflected draw submissions | 333 | 177 |
| Main submitted triangles | 141,092 | 156,258 |
| Normal forward camera-gap p50 / p95 | 33.2 / 34.0 ms | 16.7 / 17.3 ms |
| Normal forward scroll-to-next-commit p95 | 20.4 ms | 2.5 ms |
| Normal forward render-callback CPU p95 | 3.7 ms | 2.1 ms |
| 4× CPU forward camera-gap p95 | 34.2 ms | 33.2 ms |
| 4× CPU forward scroll-to-next-commit p95 | 26.9 ms | 12.3 ms |

Travel per scroll pixel rises 1.636× and draw submissions fall 46.8%. Submitted triangles rise 10.7%; this is not a polygon-reduction claim. Tracked geometries rise 91→100; textures remain 23. The 4× CPU forward run is not consistently 60 fps. Aggregate task duration is not consistently lower when drawing more frames, and the short cold-local startup samples did not improve. Do not infer lower battery, GPU load or startup time.

[Certain] The final local visual/functional review passed 116/116 checks. All 111 unique photo IDs and their category/source/full mappings, all 314 tracked image assets, and six same-progress phone/desktop pose invariants were preserved. Rendered comparisons found no discernible composition/aspect/camera/glass regression, but raster output is not bit-identical: 1–5 pixels per compared image differ by more than two RGB channel units. Collection/viewer/return, clear glass, look controls, Still/System and zero-overflow checks passed within that bounded coverage.

## Rebuild and limits

Run `node integration/pixpa-v2/build.mjs --check`, then `node integration/pixpa-v2/build.mjs --output /absolute/new-directory`. The integration asset map has 295 paths; use a new output directory so no original build is overwritten. Existing v1 original-photograph and v2 runtime URL prefixes remain intentional.

Mac WebKit 26.4 also passed one mobile-layout scroll ramp, but neither desktop WebKit nor synthetic CPU slowdown represents physical iPhone Safari. Native iPhone touch latency, screen presentation, GPU timing, thermals and battery remain unmeasured. Camera commits mean render submission, not pixels proven visible on a phone screen. Public acceptance and normal review-branch push remain the release owner's separate evidence gates.

## Publication checkpoint

The candidate is **not deployed**. Exact HOST source was pushed successfully, but the Sites archive-upload service failed repeatedly before a new version could be saved (including validated gzip and equivalent uncompressed TAR). The normalized archive preserves all 606 tracked file payloads plus the generated hosting manifest, and is 268,222,976 bytes unpacked, below the 256 MiB limit. No Deploy call was made. A final cache-busted public check confirms all five runtime files and the category manifest still match the prior live version 18. This review-branch source is a tested candidate, not evidence of a live responsiveness repair.
