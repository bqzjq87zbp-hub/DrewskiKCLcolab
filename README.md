# Drewski KCL collaboration

A self-contained Newport Pier photography portfolio, exported for collaboration. It has 13 Branding, 21 Family, 31 Headshot and 4 Coastal gallery entries, including ten NWPRT photographs within Branding.

## Run locally

Install Node.js 20 or newer, then run:

```sh
npm run check
npm start
```

Open `http://127.0.0.1:4260/`. No package installation, API key or account is required. Use `PORT=4300 npm start` for a different local port. The server exposes only inventoried files under `public/`; repository documentation and development scripts are not public routes.

## Current experience

The entrance is a photographic 2.5D forward/back projection using separately positioned canvas layers. The pier background is a real photograph. `public/media/easel-composition-reference.jpg` is the supplied AI-generated composition reference used for easel wood cutouts. It is not an unaltered photograph of a physical gallery. `public/media/underpier-photograph.jpg` is the real pier photograph.

Each canvas opens a category. Galleries include full-image enlargement, keyboard dismissal and focus return. Appearance offers Clear, Solid and System settings; Travel offers Guided, Still and System settings. Reduced-motion and reduced-transparency alternatives remain available.

**An optional Seedance 2.0 video-walk preview is included.** Choose **Preview video walk**, then scroll or swipe forward/back. The app displays actual generated-video frames and updates the easel projection on the same decoded-frame clock. **Easel placement is still approximate, not solved 3D camera tracking.** The original-photo version is the default and remains available. Still view and operating-system reduced motion suppress the video preview; no video frames are requested before opting in.

The generation used the requested 4K provider setting and the original no-logo pier photograph. The actual downloaded master decodes to **3326×2494**, 24 fps, 241 frames, 10.041667 seconds—not 3840×2160. Its first frame is a measured center crop of the original 3:2 photograph to approximately 4:3. The repository contains 121 full-frame **1280×960 JPEG samples at 12 fps**, totaling approximately 31.1 MB, loaded lazily with a bounded decoded cache. No upscaled sample is presented as native 4K. The 128 MB provider master and generation credentials are intentionally excluded. See [video-scroll plan](docs/video-scroll-plan.md) for the remaining tracking/release gates.

## Project layout

- `public/index.html`: page shell and no-JavaScript photograph links.
- `public/main-v2.js`: canvas/category integration, menu and enlargement.
- `public/collections.js`, `public/collections.css`: category galleries.
- `public/aisle/`: photographic camera projection and easel masks.
- `public/canvas-wrap.js`, `public/slots.json`: image-to-canvas geometry.
- `public/categories.json`: browser-safe gallery data with site-relative media URLs.
- `public/media/`: allowlisted website images only.
- `public/video/`: actual generated-video JPEG samples and hash/timestamp manifest.
- `public/aisle/video-frame-seam.js`: opt-in frame loading and atomic frame commit.
- `docs/asset-manifest.json`: shipped image sizes and SHA-256 values.

The app uses root-relative URLs. A static host must serve `public/` at the origin root; a repository subpath deployment needs an explicit base-path adaptation. Restart the local server after adding new files because its public-file inventory is built at startup. There is no deployment configuration or automatic publication here. The noindex metadata is intentionally retained for this development preview. A repository upload is not a Pixpa or production-site release.

## Ownership and boundaries

Photography and branding remain the property of their respective rights holders. This repository grants no new stock-photo, model, trademark or template redistribution license. Included photographs are the existing selected website assets; no archive, camera originals, private user records or source-machine paths are included. Export copies retain their color profiles while other embedded capture/edit metadata is removed.

Three purchased room backgrounds and their six artwork overlays were deliberately excluded because template redistribution rights were not verified. Families falls back to its complete 21-image gallery. See [optional licensed rooms](docs/OPTIONAL-LICENSED-ROOMS.md).

## Handoff route

Authority: the project owner's request for a clean collaboration export. Scope: this standalone folder only. Check `docs/EXPORT-CHECK.md` and run `npm run check` before editing or distributing it. If checks fail, repair this export and repeat them; otherwise return to the coordinator for independent rendered QA and repository decisions. Source previews, Pixpa and other hosting projects remain outside this repository. Terminal condition: a runnable, checked local export. A Git commit, push or deployment requires its own verified result.
