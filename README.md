# Drewski KCL collaboration

A self-contained Newport Pier photography portfolio, exported for collaboration. The current gallery contains **101 entries: 25 Branding, 26 Family, 36 Headshot and 14 Coastal**, including the original ten NWPRT photographs within Branding. The seven latest additions preserve every previous 94 entry, photograph and URL, plus the ten easel slots and walking runtime.

## Start here: reproduce the published Pixpa integration

The published source is `c5e5ff358302b70021cd7ce214bf52a8e1285142`, **Sites version 12**, deployed at 19:38:51 UTC on September 10, 2026. It adds seven approved photographs while retaining the previous expansions, directional glass sheen and centered full-viewer footer. Independent exact-adapter and actual-public desktop/phone reviews passed; physical-phone/Safari testing remains unperformed. [Open the Pixpa gallery](https://kiyonocreativelab.com/pier-gallery?release=seven101-live-20260910) or use these commands with Node.js 20 or newer:

```sh
npm run check
node integration/pixpa-v2/build.mjs --check
node integration/pixpa-v2/verify-external-assets.mjs
node integration/pixpa-v2/build.mjs --output /absolute/path/to/new-gallery-build
python3 -m http.server 4330 --bind 127.0.0.1 --directory /absolute/path/to/new-gallery-build
```

Open `http://127.0.0.1:4330/pier-v2-20260910/`. Replace the example output path with a new absolute directory and choose an unused port. The builder verifies **279 gallery files** from this repository. The 38 externally mapped derivatives use native Pixpa Files URLs in the hosted adapter; their exact local copies are included for the standalone build. [Integration README](integration/pixpa-v2/README.md) explains the delivery split, public-verification state, preserved V1 photo URLs, unchanged Pixpa wrapper, rollback and capacity limit.

The plain `npm start` option below serves all 101 entries with local root-relative images. The integration build reproduces the hosted V1/V2 prefixes, ordinary external-image bindings and native Pixpa navigation adapter. Neither command saves or publishes a site, and no private hosting-repository access is required.

[Seven-photo release](integration/pixpa-v2/SEVEN-RELEASE.md) records the current release. [Earlier public acceptance](integration/pixpa-v2/PUBLIC-ACCEPTANCE.md) and the [twelve-photo release](integration/pixpa-v2/NEXT12-RELEASE.md) remain historical evidence. These distinguish source checks, actual live behavior and physical-device limits. Sheen is retained from version 10. Later curation batches and the unrelated external Inquiry legal-link issue are outside this release.

## Run locally

Install Node.js 20 or newer, then run:

```sh
npm run check
npm start
```

Open `http://127.0.0.1:4260/`. The runtime vendors Three.js, so no API key or account is required. `npm ci` installs the pinned authoring dependency when needed. Use `PORT=4300 npm start` for a different local port. The server exposes only inventoried files under `public/`; repository documentation and development scripts are not public routes.

## Current experience

The entrance uses Blender-authored dimensional wooden easels and full-source-ratio stretched canvases in a shared perspective scene. The original pier photograph stays on one continuous backdrop at an authored 80m depth, preserving its timber, barnacle and surf contours. Five pairs of artworks share a 7m guided forward/reverse path, with slower reading spans and eased transitions. The backdrop provides shallow whole-image parallax; it is not reconstructed pier geometry. Source photograph files remain unchanged.

Scroll vertically with a mouse/trackpad, or swipe vertically on a phone, to walk immediately. Portrait view looks across the pairs as a deterministic function of scroll position; it does not autoplay. System reduced motion stops ambient water animation and keeps direct scrolling available. **Still** remains an explicit Menu choice. The menu also contains optional previous/next pair controls and phone viewing overrides. Clear glass is the default; Solid and System appearance remain available.

Each canvas opens its category. Galleries retain full-image enlargement, keyboard dismissal and focus return. Returning to the walk preserves its normalized position even if the window resized while the collection was open. Canvas construction includes a 38 mm wrapped shell, fine woven surface, rear stretcher, folds and staples. Neutral fill brightens the actual printed surfaces; it does not brighten the pier or timber. The foreground water uses restrained motion within the original photograph. Real easel contacts, attenuated immersed legs and reflected geometry share a y=0 surface and the same wave phases. The photograph remains scenery rather than recovered structural depth.

**An optional generated-video preview remains in Menu and is not registered 3D footage.** It lazily loads the included video frames on a shared decode/commit clock, using the same bounded authored travel range as the photographic view. The stored 2D tracking data is retained for research and the legacy fallback; its shear is not applied to the dimensional canvases. No video frames load before opt-in. System reduced motion and Still suppress this secondary preview. Camera registration and physical occlusion remain release limitations.

See [easel review and evidence](docs/easel-review/REVIEW.md) for the current draft, visual limitations, test results and screenshots; [asset provenance](public/aisle/assets/PROVENANCE.md) explains the Blender export and CC0 wood maps.

The generation used the requested 4K provider setting and the original no-logo pier photograph. The actual downloaded master decodes to **3326×2494**, 24 fps, 241 frames, 10.041667 seconds—not 3840×2160. Its first frame is a measured center crop of the original 3:2 photograph to approximately 4:3. The repository contains 121 full-frame **1280×960 JPEG samples at 12 fps**, totaling approximately 31.1 MB, loaded lazily with a bounded decoded cache. No upscaled sample is presented as native 4K. The 128 MB provider master and generation credentials are intentionally excluded. See [video-scroll plan](docs/video-scroll-plan.md) for the remaining tracking/release gates.

## Project layout

- `public/index.html`: page shell and no-JavaScript photograph links.
- `public/main-v2.js`: canvas/category integration, menu and enlargement.
- `public/collections.js`, `public/collections.css`: category galleries.
- `public/aisle/`: shared camera, continuous photographic scenery, physical displays and retained fallback masks.
- `public/aisle/assets/`: Blender-exported geometry, CC0 material maps, portable authoring scripts and asset inspection page.
- `public/canvas-wrap.js`, `public/slots.json`: image-to-canvas geometry.
- `public/categories.json`: browser-safe gallery data with site-relative media URLs.
- `public/media/`: allowlisted website images only.
- `public/video/`: actual generated-video JPEG samples and hash/timestamp manifest.
- `public/aisle/video-frame-seam.js`: opt-in frame loading and atomic frame commit.
- `docs/asset-manifest.json`: shipped image sizes and SHA-256 values.

The app uses root-relative URLs. A static host must serve `public/` at the origin root; a repository subpath deployment needs an explicit base-path adaptation. The default server inventories public files at startup. `LIVE_RELOAD=1 PORT=4274 npm start` enables local-only automatic refresh, delayed during active input, with normalized walk/look state restored; it also discovers new public assets. Normal static hosting has no reload endpoint or injected development script. There is no deployment configuration or automatic publication here. The noindex metadata is intentionally retained for this development preview. A repository upload is not a Pixpa or production-site release.

## Ownership and boundaries

Photography and branding remain the property of their respective rights holders. This repository grants no new stock-photo, model, trademark or template redistribution license. Included photographs are the existing selected website assets; no archive, camera originals, private user records or source-machine paths are included. Export copies retain their color profiles while other embedded capture/edit metadata is removed.

Three purchased room backgrounds and their six artwork overlays were deliberately excluded because template redistribution rights were not verified. Families now uses its 26-image gallery. See [optional licensed rooms](docs/OPTIONAL-LICENSED-ROOMS.md).

## Handoff route

Repository: https://github.com/bqzjq87zbp-hub/DrewskiKCLcolab. After accepting collaborator access, clone it, create a feature branch, and open a pull request for review. Do not commit private photographs, purchased template source files, credentials, or the provider video master. Work here does not automatically change the live Pixpa site.

Authority: the project owner's request for a clean collaboration export. Scope: this standalone folder only. Check `docs/EXPORT-CHECK.md` and run `npm run check` before editing or distributing it. If checks fail, repair this export and repeat them; otherwise return to the coordinator for independent rendered QA and repository decisions. Source previews, Pixpa and other hosting projects remain outside this repository. Terminal condition: a runnable, checked local export. A Git commit, push or deployment requires its own verified result.
