# Version 11 — twelve additional photographs

Status: **[Certain] deployed and independently accepted on the actual public Pixpa iframe.** Matching GitHub source delivery has its own commit/push/remote-readback gate; it is not inferred from site publication.

## Exact source and preservation

- Public source: `874050f23a65d4adc4f1734572f7b6de9ef6bcaf`, Sites version 11.
- Deployment: `appgdep_6aa2f2585fc8819186c20a4f964da066`, succeeded `2026-09-10T18:10:12.341447Z`.
- [Public Pixpa gallery](https://kiyonocreativelab.com/pier-gallery?release=next12-live-20260910).
- Photo donor: `7918fa7cc24cd6ba978e012980c64c9805141564`; previous shared source `8f7530a446fb1e94b513b47f26c01d0d051d62fd`.
- Category-only rollback: source `5ad8f30538858534937cbaa1a2249db63dc3fcd6`, Sites version 10.
- Sole host change: `categories.json`, 35,246→40,566 bytes. All 591 other tracked files unchanged. No new Page Code or Shared Body Save.
- Category rollback SHA-256 `3a8ea3a46ee82f143aecd8e9f253939f2c70b759b2827b392286299f18108ba9`; live candidate SHA-256 `4806f5f9c2f9b7d15958c24ea293f7c5d4d218c664903c65ab80e156209ddb18`.
- Final counts: **21 Branding / 26 Families / 34 Headshots / 13 Coastal**. Every prior 82 object, URL, category membership and relative ordering is preserved.

The accepted twelve-photo slate adds four Branding, two Families, one Headshots and five Coastal photographs. It does not alter ten easels, camera path, original pier photograph, 121 video frames, current sheen or centered full-viewer footer. Later batches are excluded.

## Native image delivery

Exactly 24 approved JPEG derivatives, 16,138,324 bytes, are saved as 24 distinct reload-persistent native Pixpa Files records. Anonymous responses passed 200 JPEG, exact byte hashes, dimensions and sRGB profiles, with no redirects or deletion headers observed. The source derivatives remain unchanged in `public/media/expansion/`.

The hosted category adapter uses these ordinary `https://px-files.pixpa.com/` image URLs; `external-collection-assets.json` is the exact source-to-URL map. They are not used for WebGL, anonymous-CORS textures or easel slots. `verify-external-assets.mjs` verifies these boundaries locally. This is current delivery evidence, not a guarantee of perpetual service.

The 279-path gallery rebuild totals 193,364,161 bytes. The whole hosting archive is 261,255,913 compressed / 268,034,560 unpacked bytes (400,896 bytes below 256 MiB), SHA-256 `49a4a573b919c05377d0be54a1266ef8177f78dd10534c2f2b54d48cb9f1383d`. External JPEGs are not duplicated into that archive.

## Candidate acceptance — not public proof

Independent final adapter review passed all 24 external image decodes, twelve actual desktop full-photo clicks, five phone representatives across all four categories, short landscape, exact full-file navigation, native touch forward/reverse, easel-to-viewer-to-aisle return at identical Y296.5/progress, explicit Still and accessibility sheen suppression. No browser errors. All twelve desktop screenshots and representative phone/landscape screenshots were visually inspected. Candidate files remain labeled candidate.

Native scrolling intentionally remains available in System travel mode under reduced motion; explicit Still selects the stationary accessible layout. Reduced motion suppresses decorative sheen. This is the existing unchanged contract, not a new runtime repair.

## Actual public acceptance

Fresh public source responses match all seven inspected files and the expected wrapper. Owner used the real public iframe menu and native wheel to reach the new white-coat portrait, opened the full 2133×3200 image with contain/opacity1, verified Close focus return, and walked forward/reverse Y0→620→360 with zero horizontal overflow. `evidence/next12/live-source-proof.json` and `owner-public-pathway.json` retain those observations. A failed offscreen semantic click was followed by native scrolling into view and a successful actual click; it is not reported as a successful first click.

Independent actual public acceptance passed at `2026-09-10T18:22:07.762531Z`: exact 94-entry identity, all 24 external image decodes and all 12 new desktop full-photo clicks; five phone representatives and short landscape; full-file link and Next/Previous; native touch forward/reverse with exact return to Y110 and progress 0.014481305950500263; clear glass and idle stability; Still route and all required sheen-suppression modes. Zero gallery errors. [Independent review](evidence/next12/independent-live/README.md), [verification data](evidence/next12/independent-live/verification.json) and six settled representative screenshots are included. The early loading/compositor frame is excluded; all reviewer overrides were cleared.

Browser emulation is not physical iPhone/iPad or mobile Safari certification. Generated-video tracking, hyper-realistic reconstruction and the external Inquiry form's existing legal-link issue are not repaired or certified by this photo release.

## Reproduce

```sh
CHECK_PORT=4315 npm run check
node integration/pixpa-v2/verify-external-assets.mjs
node integration/pixpa-v2/build.mjs --check
node integration/pixpa-v2/build.mjs --output /absolute/path/to/new-output
```

Use an available port. The checks validate 94 entries, the cumulative 25 reviewed added photographs/50 derivatives and all 279 integration paths. Local build evidence, deployed-site acceptance and GitHub remote readback are separate gates. No automatic deployment, force push or merge is performed by these scripts.
