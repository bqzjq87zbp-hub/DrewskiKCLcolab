# Drewski KCL collaboration

A self-contained Newport Pier photography portfolio, exported for collaboration. It has 13 Branding, 21 Family, 31 Headshot and 4 Coastal gallery entries, including ten NWPRT photographs within Branding.

The front door hangs those four collections as exhibitions, built on the exhibition engine from Drewski's Newsstand site: a dark lockup and four covers, then one exhibition per collection with a hang in chapters, a reading view, a 3D hall, a palette of colours measured from the photographs, a reel under the pier, a flip book and a 3D atelier. The pier walk below is one of its rooms, at `/walk/`.

## Run locally

Install Node.js 20 or newer, then run:

```sh
npm run check
npm test
npm start
```

Open `http://127.0.0.1:4260/`. No package installation, API key or account is required. The exhibitions load their typefaces from Google Fonts and the atelier loads three.js from unpkg; offline, the type falls back to system serif and sans, and the atelier falls back to the flat book. Use `PORT=4300 npm start` for a different local port. The server exposes only inventoried files under `public/`; repository documentation and development scripts are not public routes.

## The exhibitions

| Route | What it is |
| --- | --- |
| `/` | The front door: the lockup, four covers that flip in, and the ways in to the walk and to booking. Hovering a cover lays its photograph across the room, dimmed, behind the covers. |
| `/branding/`, `/families/`, `/headshots/`, `/coastal/` | One exhibition per collection: hero, the hang in chapters (zoom, reading view, canvas view), Walk the hall, The palette, the reel under the pier, the contents and the footer. |
| `/<exhibition>/book/` | The flip book. Landscape photographs are printed whole on the page. |
| `/<exhibition>/atelier/` | The same photographs as a lit 3D book (WebGL). |
| `/walk/` | The Newport Pier walk described below, unchanged apart from a link back. |

Every photograph in an exhibition is a 1600 px web copy of an approved file from `public/categories.json`, made by `tools/build_exhibitions.py`; the originals in `public/media/` are only read. Colours on the palette, in the reading view and in the finder are measured from the pixels, not described. "Ask the exhibition" runs entirely on the visitor's device: it navigates, picks out photographs by colour or subject, changes viewing settings, and plans a session in three questions before opening a booking email with the answers in its subject line. No AI service is called and no prices are stated. Booking links use the address in `tools/exhibitions.json`, currently Kyle's Apple private relay, which may reject unknown senders; changing that one value and rebuilding updates every link.

To change captions, chapters, colours or covers, edit `tools/exhibitions.json`, then run `npm run exhibitions` (Python 3 with Pillow) and restart the server. That rewrites `public/catalog.json`, each `public/<exhibition>/issue.json`, the page shells and the web copies; unchanged inputs give byte-identical files. The reel is `public/video/walk-scrub.webm`/`.mp4`, encoded from the 241 walk frames with ffmpeg; the server answers byte-range requests so the browser can seek it.

WebGL drives the page turns, paper entrances, hall, pool light and atelier. Without WebGL, or in Low power or Calm motion, each one falls back to a CSS or flat version and nothing is hidden.

## The pier walk

The walk (`/walk/`) is a photographic 2.5D forward/back projection using separately positioned canvas layers. The pier background is a real photograph. `public/media/easel-composition-reference.jpg` is the supplied AI-generated composition reference used for easel wood cutouts. It is not an unaltered photograph of a physical gallery. `public/media/underpier-photograph.jpg` is the real pier photograph.

Each canvas opens a category. Galleries include full-image enlargement, keyboard dismissal and focus return. Appearance offers Clear, Solid and System settings; Travel offers Guided, Still and System settings. Reduced-motion and reduced-transparency alternatives remain available.

**The generated video walk is the background.** Scroll or swipe to move forward and back; the easel projection updates on the same decoded-frame clock. Alignment comes from a single global forward-dolly solve over the whole clip: one shared camera displacement `d(t)` plus one measured inverse depth per easel group, so a group whose own pier features have left the frame still receives a correct scale from the rest of the scene. **This is a measured 2D similarity per depth group, not solved 3D camera tracking**; it cannot express per-easel rotation or prove ground contact. Depth groups 2-5 stay aligned for the entire clip. Group 1 is retired at 7.29s, once the camera has walked through its plane, which happens well after those easels have left the viewport. The still photograph remains one click away, and Still view or operating-system reduced motion keeps it as the background.

**Living water.** On browsers with WebGPU, a transparent shader overlay (`public/aisle/water-layer.js`) draws a small animated accent on the sea below the waterline. It is a visual effect over the video, not simulated surf geometry or verified physical easel contact. The overlay is premultiplied-alpha and returns zero alpha above the waterline, so the photograph there is composited untouched rather than resampled (measured: 0.000% of pixels above the waterline change between frames). Alpha carries the effect strength, so intensity is one uniform rather than a retune of every term. Sparkle frequencies are held under the source texture Nyquist limit; earlier builds aliased into visible noise. The overlay stays hidden while a new bitmap is being prepared, preventing a stale frame from covering the current image/easels, including on rapid reversal. Without WebGPU the bundle is not fetched; `?water=off` disables the effect for QA. Still view and operating-system reduced motion keep water animation off, although capable browsers may fetch the bundle and Still can initialize a hidden canvas. The bundle is committed build output; sources live in `tools/water/` (rebuild: `cd tools/water && npm ci --ignore-scripts --no-audit --no-fund && npm run build`, which validates the WGSL and refuses any output that would trip the repository checks).

The generation used the requested 4K provider setting and the original no-logo pier photograph. The actual downloaded master decodes to **3326×2494**, 24 fps, 241 frames, 10.041667 seconds—not 3840×2160. Its first frame is a measured center crop of the original 3:2 photograph to approximately 4:3. The repository contains 241 full-frame **1280×960 JPEG samples at the native 24 fps**, totaling approximately 48.3 MB, loaded lazily with a bounded decoded cache. No upscaled sample is presented as native 4K. The 128 MB provider master and generation credentials are intentionally excluded. See [video-scroll plan](docs/video-scroll-plan.md) for the original tracking/release gates.

## Project layout

- `public/index.html`, `public/catalog.json`: the front door and its list of exhibitions (generated).
- `public/<exhibition>/`: each exhibition's shell, `issue.json`, `img/` web copies, `book/` and `atelier/` (generated).
- `public/assets/x/`: the exhibition engine (plain ES modules, no build step); `public/assets/vendor/`: GSAP 3.15 (ScrollTrigger, SplitText, Flip) and Lenis 1.3.
- `public/assets/flipbook.*`, `public/assets/stpageflip.js`: the flip book; `public/assets/atelier.*`, `public/assets/env/`: the 3D book and its two CC0 Poly Haven HDRIs.
- `tools/exhibitions.json`, `tools/build_exhibitions.py`: the exhibitions' content and the script that builds them.
- `tests/unit/`: `npm test`, covering the hang, physics, astronomy, search, the content and the finder.
- `public/walk/index.html`: the pier walk's page shell and no-JavaScript photograph links.
- `public/main.js`: canvas/category integration, menu and enlargement for the walk.
- `public/collections.js`, `public/collections.css`: category galleries.
- `public/aisle/`: photographic camera projection and easel masks.
- `public/canvas-wrap.js`, `public/slots.json`: image-to-canvas geometry.
- `public/categories.json`: browser-safe gallery data with site-relative media URLs.
- `public/media/`: allowlisted website images only.
- `public/video/`: actual generated-video JPEG samples, hash/timestamp manifest and the solved per-frame easel alignment.
- `public/aisle/video-frame-seam.js`: opt-in frame loading and atomic frame commit.
- `docs/asset-manifest.json`: shipped image sizes and SHA-256 values.
- `tools/track_frames.py`, `tools/solve_dolly.py`, `tools/refit_depths.py`, `tools/build_video_assets.py`: the reproducible alignment solve.

The app uses root-relative URLs. A static host must serve `public/` at the origin root; a repository subpath deployment needs an explicit base-path adaptation. Restart the local server after adding new files because its public-file inventory is built at startup. There is no deployment configuration or automatic publication here. The noindex metadata is intentionally retained for this development preview. A repository upload is not a Pixpa or production-site release.

## Ownership and boundaries

Photography and branding remain the property of their respective rights holders. This repository grants no new stock-photo, model, trademark or template redistribution license. Included photographs are the existing selected website assets; no archive, camera originals, private user records or source-machine paths are included. Export copies retain their color profiles while other embedded capture/edit metadata is removed.

Three purchased room backgrounds and their six artwork overlays were deliberately excluded because template redistribution rights were not verified. Families falls back to its complete 21-image gallery. See [optional licensed rooms](docs/OPTIONAL-LICENSED-ROOMS.md).

## Handoff route

Repository: https://github.com/bqzjq87zbp-hub/DrewskiKCLcolab. After accepting collaborator access, clone it, create a feature branch, and open a pull request for review. Do not commit private photographs, purchased template source files, credentials, or the provider video master. Work here does not automatically change the live Pixpa site.

Authority: the project owner's request for a clean collaboration export. Scope: this standalone folder only. Check `docs/EXPORT-CHECK.md` and run `npm run check` before editing or distributing it. If checks fail, repair this export and repeat them; otherwise return to the coordinator for independent rendered QA and repository decisions. Source previews, Pixpa and other hosting projects remain outside this repository. Terminal condition: a runnable, checked local export. A Git commit, push or deployment requires its own verified result.
