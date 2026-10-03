# Drewski KCL collaboration

A self-contained photography portfolio for Kiyono Creative Lab, exported for collaboration. It has 13 Branding, 21 Family, 31 Headshot and 4 Coastal gallery entries, including ten NWPRT photographs within Branding.

The front door hangs those four collections as exhibitions, built on the exhibition engine from Drewski's Newsstand site: a dark lockup and four covers, then one exhibition per collection with a hang in chapters, a reading view, a 3D hall, a palette of colours measured from the photographs, a flip book and a 3D atelier.

The site stands on one photograph: a blurred view from under a pier. It lies behind the covers on the front door, under a dark scrim, and under every exhibition's hero, recoloured in that exhibition's own hero colour so each one keeps its identity. There is no film grain over anything; the photographs are shown clean.

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
| `/` | The front door: the lockup, four covers that flip in over the blurred pier, and a way in to booking. Hovering a cover lays its photograph across the room, dimmed, behind the covers. |
| `/branding/`, `/families/`, `/headshots/`, `/coastal/` | One exhibition per collection: the hero (the wordmark and pool light over the blurred pier), the hang in chapters (zoom, reading view, canvas view), Walk the hall, The palette, the contents and the footer. |
| `/<exhibition>/book/` | The flip book. Landscape photographs are printed whole on the page, and the book ends on its back cover. |
| `/<exhibition>/atelier/` | The same photographs as a lit 3D book (WebGL). The way back to the exhibition is always at hand and lights up on the last spread; the lamp's colour, power and room fold away behind a Lamp pill. |

Every photograph in an exhibition is a 1600 px web copy of an approved file from `public/categories.json`, made by `tools/build_exhibitions.py`; the originals in `public/media/` are only read. Colours on the palette, in the reading view and in the finder are measured from the pixels, not described. "Ask the exhibition" runs entirely on the visitor's device: it navigates, picks out photographs by colour or subject, changes viewing settings, and plans a session in three questions before opening a booking email with the answers in its subject line. No AI service is called and no prices are stated. Booking links use the address in `tools/exhibitions.json`, currently Kyle's Apple private relay, which may reject unknown senders; changing that one value and rebuilding updates every link.

To change captions, chapters, colours or covers, edit `tools/exhibitions.json`, then run `npm run exhibitions` (Python 3 with Pillow) and restart the server. That rewrites `public/catalog.json`, each `public/<exhibition>/issue.json`, the page shells and the web copies; unchanged inputs give byte-identical files.

The blurred pier is `public/brand/pier-blur.jpg`, a 960 x 640 copy of `public/media/underpier-photograph.jpg` with the blur already in the file, so no live blur filter runs. `public/assets/x/x.css` lays it under the front door (`.ld-bg`) and blends it into each hero (`.hero`, a luminosity blend under a veil of the hero colour). That is the only place the pier photograph appears: no wall hangs it, so the badged copy among the Branding gallery entries stays out of the Branding exhibition.

WebGL drives the page turns, paper entrances, hall, pool light and atelier. Without WebGL, or in Low power or Calm motion, each one falls back to a CSS or flat version and nothing is hidden.

## Project layout

- `public/index.html`, `public/catalog.json`: the front door and its list of exhibitions (generated).
- `public/<exhibition>/`: each exhibition's shell, `issue.json`, `img/` web copies, `book/` and `atelier/` (generated).
- `public/assets/x/`: the exhibition engine (plain ES modules, no build step); `public/assets/vendor/`: GSAP 3.15 (ScrollTrigger, SplitText, Flip) and Lenis 1.3.
- `public/assets/flipbook.*`, `public/assets/stpageflip.js`: the flip book; `public/assets/atelier.*`, `public/assets/env/`: the 3D book and its two CC0 Poly Haven HDRIs.
- `public/brand/`: the blurred pier the site stands on and the studio logo (`kiyono-logo.png`).
- `public/categories.json`: browser-safe gallery data with site-relative media URLs.
- `public/media/`: allowlisted website images only: the photographs the exhibitions are copied from, and the pier photograph.
- `tools/exhibitions.json`, `tools/build_exhibitions.py`: the exhibitions' content and the script that builds them.
- `tests/unit/`: `npm test`, covering the hang, physics, astronomy, search, the content and the finder.
- `docs/asset-manifest.json`: shipped image sizes and SHA-256 values.
- The video-alignment scripts still in `tools/` (`track_frames.py`, `solve_dolly.py`, `refit_depths.py`, `build_video_assets.py` and their helpers, and `tools/water/`) belonged to the retired pier walk; nothing served uses them.

The app uses root-relative URLs. A static host must serve `public/` at the origin root; a repository subpath deployment needs an explicit base-path adaptation. Restart the local server after adding new files because its public-file inventory is built at startup. There is no deployment configuration or automatic publication here. The noindex metadata is intentionally retained for this development preview. A repository upload is not a Pixpa or production-site release.

## Ownership and boundaries

Photography and branding remain the property of their respective rights holders. This repository grants no new stock-photo, model, trademark or template redistribution license. Included photographs are the existing selected website assets; no archive, camera originals, private user records or source-machine paths are included. Export copies retain their color profiles while other embedded capture/edit metadata is removed.

Three purchased room backgrounds and their six artwork overlays were deliberately excluded because template redistribution rights were not verified. Families falls back to its complete 21-image gallery. See [optional licensed rooms](docs/OPTIONAL-LICENSED-ROOMS.md).

## Handoff route

Repository: https://github.com/bqzjq87zbp-hub/DrewskiKCLcolab. After accepting collaborator access, clone it, create a feature branch, and open a pull request for review. Do not commit private photographs, purchased template source files, credentials, or the provider video master. Work here does not automatically change the live Pixpa site.

Authority: the project owner's request for a clean collaboration export. Scope: this standalone folder only. Check `docs/EXPORT-CHECK.md` and run `npm run check` before editing or distributing it. If checks fail, repair this export and repeat them; otherwise return to the coordinator for independent rendered QA and repository decisions. Source previews, Pixpa and other hosting projects remain outside this repository. Terminal condition: a runnable, checked local export. A Git commit, push or deployment requires its own verified result.
