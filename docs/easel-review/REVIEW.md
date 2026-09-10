# Dimensional easels in the original photographic pier

This draft preserves the original under-pier photograph while moving through ten physical prints. The continuous photographic backdrop removes the split wall/floor projection that separated barnacles from their photographed feet. It keeps shallow whole-image parallax rather than inventing unseen timber surfaces.

## Current behavior

- Actual Blender-exported easels and CC0 Coated Pine materials remain in the browser. Each photograph retains its full source ratio, fixed 1.05m long edge, 38mm wrapped shell, woven surface, rear stretcher, folds and staples. Neutral canvas-only fill keeps the prints readable.
- A deterministic 7m path moves through five pairs. Reading spans advance slowly; connecting spans do most of the travel. Portrait Auto viewing turns between the prints according to native scroll position, and reverse input retraces the same path. No elapsed-time camera motion or required Start action is introduced. Portrait scroll length gives each swipe more inspection room.
- One continuous original photograph sits at an authored 80m scenic depth. A bounded source envelope reserves the supported travel/look range without dynamically scaling the physical prints. Photographed feet and surf stay on the same surface.
- Foreground photographic water and actual y=0 reflections use shared world-space wave phases. The reflection mask follows the same original photograph and keeps reflected easels off its timber. These are compositing and planar-reflection approximations.
- Native wheel/touch navigation, clear glass controls, collection enlargement/return, explicit Still and system reduced-motion behavior remain available. Desktop panels fit the whole scene proportionally. Actual viewport resizes preserve normalized travel progress, including a resize while a collection is open. Pair buttons use the same target calculation for their enabled state and action, and remain hidden in explicit Still view until Start walk resumes the camera.
- Direct collection links retain their local history ownership when switching categories. Browser Back dismisses an open photograph and lets the destination restore scroll/focus, so a delayed modal close cannot move the aisle to old collection pixels.
- The existing generated-video preview remains optional and unregistered. Its committed frames use the same authored distance mapping; it is not a recovered camera solve. Original photographs and video frames are unchanged.

## Rendered evidence

The all-ten coverage review sampled 603 actual rendered scroll positions across desktop 1440×900 and phones 390×844 and 430×932. Every exact photograph ID has a contiguous full-photo reading interval of at least .025 progress and 100 scroll pixels, clear of other actual easels and visible controls. Thirty selected views received dense ray checks against cloned runtime easel geometry. A canvas's own retaining shelf still touches its exact bottom boundary; that existing self-contact is recorded separately.

That coverage run preceded the final portrait scroll-length increase and optional-video scalar alignment. Neither changes normal poses at a given progress. Its phone pixel intervals are conservative for the longer final scroll range; the final interaction audit measures that range independently. [Coverage evidence and scope](photo-guided/COVERAGE.md).

Current motion, interaction and bundle results are recorded with their own source fingerprints in [verification](photo-guided/VERIFICATION.md). Earlier 661-check, reflection and viewport test counts are historical and are not represented as current full-suite passes.

The later [photograph-loading and visitor-path review](image-loading/VERIFICATION.md) records the stopped-preview diagnosis, every collection image decoded on desktop and phone, interrupted-request recovery, and the reproduced Back/return regressions.

## Reproduce

```sh
npm run check
LIVE_RELOAD=1 PORT=4274 npm start
```

The foreground preview ends with its owning process. Keep it independent of short-lived audits. On macOS or Linux, a separately detached local preview can be started from the repository root with:

```sh
nohup env LIVE_RELOAD=1 PORT=4274 node server.mjs > "${TMPDIR:-/tmp}/drewski-preview-4274.log" 2>&1 < /dev/null &
```

Use one listener per port and inspect that log if startup fails. This installs no daemon and does not promise persistence across computer sleep, shutdown, or restart. `node scripts/qa-gallery-navigation.mjs` exercises the direct-entry and modal-Back regressions against the independently running preview; `--prepare` launches no browser.

For separate-profile browser checks, install Playwright separately or set `PLAYWRIGHT_MODULE` to an existing installation. `QA_URL` selects the local preview and `QA_OUTPUT` selects a temporary evidence directory. Run `node scripts/qa-photograph-coverage.mjs` for the ten-photo coverage audit, or `node scripts/record-photograph-walk.mjs` for native wheel/emulated-touch forward and reverse recordings. Recordings need visual review; they are not performance benchmarks. The older `qa-easel.mjs` is the earlier checkpoint suite, and `record-easel.mjs` uses programmatic scrolling.

The asset review at `/aisle/assets/review.html` shows the actual runtime model from oblique, rear and canvas-edge views. [Asset provenance](../../public/aisle/assets/PROVENANCE.md) includes the Blender export and material hashes.

## Limits

The background has no recovered post depth, unseen faces or independent pier occlusion. The original horizon breaker remains predominantly photographic while nearer water animates. The real easels are more dimensional, but their material, regular cloth corners and planar reflections can still look rendered. Emulated touch in desktop Chrome does not establish physical-phone, Magic Mouse or exact Codex embedded-panel performance.

The 121 existing JPEGs sample AI-generated Seedance motion. Their 2D flow is not real-camera pose or metric depth. They remain an opt-in preview. No public/Pixpa deployment or collaborator merge is part of this draft.

## Earlier evidence

[Blender construction and earlier browser/shader checkpoints](CHECKPOINT-REVIEW.md) · [Rejected contact-mask trials](PIER-CONTACT.md) · [Earlier registration trials](PIER-REGISTRATION.md) · [Earlier viewport-fit correction](VIEWPORT-FIT.md). Later connected-bay reconstruction was also tested in isolation and rejected for lost photographic atmosphere and remaining timber/contact artifacts. The current implementation returns to continuous photographic scenery; rejected reconstruction assets are not included.
