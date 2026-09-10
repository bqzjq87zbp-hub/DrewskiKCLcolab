# Published Pixpa V2 integration

This directory is the reproducible source handoff for the complete accepted gallery published on10 September2026. It deliberately leaves the standalone `public/` tree and original photography unchanged.

- [Public Pixpa gallery](https://kiyonocreativelab.com/pier-gallery?release=glass-walk-restored-20260910)
- [Direct gallery](https://kiyono-coastal-gallery.kiyonophotography.chatgpt.site/pier-v2-20260910/)
- Accepted standalone baseline: `78b36c1f5c4f0eadac850d4f00ab9761d4e05e3b`.
- Published hosting integration source: `a3e11d42389229d67913934f9e82a845e605620d`, Sites version7. You do not need access to that private hosting repository to rebuild these gallery files.

## What actually differs

`runtime/` contains exactly11 rebased text files plus the new native-site navigation adapter. No photograph, video frame, model or material binary was changed. The11 files are `aisle-integration.js`, `aisle/assets/review.html`, `aisle/photographic-aisle.js`, `aisle/physical-display.js`, `aisle/video-frame-seam.js`, `categories.json`, `collections.css`, `collections.js`, `index.html`, `main-v2.js`, `slots.json`. The added file is `pixpa-adapter.js`. These are the actual deployed bytes, not instructions to guess replacements.

`pixpa-page-code.html` is the final saved Pixpa fragment, including the full-height iframe and two clear48px exit links. SHA-256: `3618931079d93eed39867d54ae242c1808390a9bafbaf95a8b57fd51c40e6ab9`. Pixpa stripped one final LF from the staged3901-byte source; the persisted3900-byte file is included exactly. Return uses the site's root; direct fallback opens the external gallery in a new tab. Solid reduced-transparency/increased-contrast/forced-colors fallbacks remain intentional.

## Rebuild and review locally

From this repository root with Node.js:

```sh
node integration/pixpa-v2/build.mjs --check
node integration/pixpa-v2/build.mjs --output /absolute/path/to/new-gallery-build
python3 -m http.server 4330 --bind 127.0.0.1 --directory /absolute/path/to/new-gallery-build
```

Then open `http://127.0.0.1:4330/pier-v2-20260910/`. Choose an unused port. The builder refuses an existing output directory and verifies every source and copied output hash. It never edits the accepted `public/` directory, starts a service automatically, or publishes anything.

`asset-map.json` maps251 unique URLs to source paths, exact hashes and bytes.147 unchanged accepted files and12 text overlays go under`/pier-v2-20260910/`.92 identical approved photographs go under`/pier-v1-20260909/media/`. This old media prefix is intentional byte-verified reuse, **not** an old runtime or temporary upload. A fresh host needs both generated directories. On the existing host retain the current old-path photographs; do not delete them or blindly change every v1 string. The output reproduces this gallery and dependencies, not unrelated historical pages hosted in the same account.

The121 accepted video frames are NEW and stay underV2; do not substitute older same-number frames. Generated video remains opt-in and in visual review. Native user-controlled travel remains usable with System Reduce Motion; explicit Still exposes Start walk.

For a future Pixpa update, stage/review the exact generated asset URLs first. Read and preserve the **current** page field before any edit. This checked-in fragment is evidence, not continuing authorization to overwrite changed live code. Home, Shared Body, other routes, collaborator work and client assets were outside this release.

## Evidence and honest test boundaries

- `evidence/seven-width-walk.json`: public embedded native Chrome forward/reverse at390/430/844/768/1024/1440/1728, before the final footer-to-glass wrapper change.
- `evidence/compositor-touch.json`:390px compositor touch advanced the public aisle; not physical-phone certification.
- `evidence/final-public-wrapper-qa.json`: independent native desktop/390px wheel passed after the final full-height wrapper change; Return reached Home and browserBack restored exact prior progress. The browserBack command timed out after navigation; a fresh state verified success without a secondBack.
- `evidence/local-wrapper-geometry.json`:9 size/pointer cases, both48px controls on the photograph and clear of the walk HUD, no overflow. `local-coarse-phone.png` is explicitly a same-origin local coarse-pointer render; `public-desktop.png` is public normal-mode glass.
- `evidence/local-solid-fallback.json`: solid, blur-free reduced-transparency fallback.
- `evidence/public-glass-conditions.json`: independent normal-versus-reduced-transparency checks. The default test machine requests reduced transparency; its opaque control screenshots are intentional fallbacks. `public-normal-glass-desktop.png` and `public-normal-glass-390.png` explicitly emulate normal transparency and show the clear material. The 390px test is a fine-pointer browser viewport, not a physical phone.
- `evidence/independent-native-wheel.json`: independent direct and Pixpa-embedded wheel success; outer page remained still.
-247 non-HTML public responses matched exact hashes. Two HTML responses only add a hosting-provider Cloudflare script; normalized hashes match. See`evidence/host-html-normalization.json`. All69 collection images decoded in the deployed browser.
- An independent visible Family easel click opened the correct category/full image and restored exactY450/progress on return and browserBack. No physical iPhone/iPad, mobile Safari or video tracking registration claim is made.

IAB cross-origin wheel automation did not reliably forward into the child; installed Chrome native wheel did. Rapid IAB menu samples shifted their own baseline and were inconclusive; no speculative camera change was added for them. Pointer/media emulation can affect the parent without its cross-origin child; do not label such mixed screenshots as physical-phone proof.

The shared pull request remains a draft. This integration handoff does not merge the separate collaborator PR or replace the accepted standalone experience.

The handoff builder was actually executed in a fresh output directory: all 251 source and output hashes passed, including 92 reused photographs (173,275,575 total file bytes). The original `public/` tree remains unchanged. No deployment is triggered by this check or build.
