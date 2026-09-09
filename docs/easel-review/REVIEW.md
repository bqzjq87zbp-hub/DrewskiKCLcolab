# Dimensional easels, printed canvas and the photographic walk

Draft for collaboration. This is an improved working scene; the single-image pier reconstruction and experimental video are not approved as a photoreal production release.

## Feedback addressed

The previous view combined flat-looking dark supports, brightly pasted image planes, weak water contact and a long virtual walk against a fixed photograph. The dimensional print geometry in the recovered patch already preserved source ratios; the old video affine transforms and square DOM fallback were separate paths. A 24-by-24 example was interpreted as fixed physical proportions, not a request to square every photograph.

- The browser now uses geometry actually built, exported and rendered in Blender. CC0 Coated Pine maps have verified source hashes and a redistribution record.
- Prints retain the full front composition and source ratio, with fixed 1.05 m long-edge dimensions. Their 38 mm wrapped shell, subtle weave, worked edges, rear wood stretcher, folded cloth and staples make them physical objects.
- Neutral canvas-only fill keeps artwork brighter while preserving woven diffuse response. Original photo files, pier exposure and timber light remain unchanged by that fill.
- One camera governs the prints, easels, proxy environment, waterline and reflection pass. The 7.5 m path and row spacing expose the final bottle-cap and coastal prints after preceding supports pass.
- The water visibly moves while the camera is idle; upper pier and artwork geometry remain still. Wet contacts, underwater attenuation and distorted reflected geometry share y=0.
- Native vertical wheel/trackpad and touch scrolling work immediately, including under system reduced motion. That preference disables ambient motion. Phone viewing is guided across artwork pairs by the user's scroll position. Source-frustum checks keep supported views inside the available photograph.
- Clear floating controls replace opaque surfaces. The caption sits away from the central aisle. Optional controls live inside Menu. The HUD has one text owner and stable dimensions; the alternating-label jitter is removed.

## Reproduce

```sh
npm run check
LIVE_RELOAD=1 PORT=4274 npm start
```

The website runs from vendored browser dependencies. For automated browser checks, install Playwright separately or point `PLAYWRIGHT_MODULE` to an existing installation, then run `node scripts/qa-easel.mjs`. `QA_OUTPUT` selects an evidence directory; the default is a temporary directory. The browser test uses an installed Chrome channel and launches a separate profile. `scripts/record-easel.mjs` records a continuous native-scroll traversal.

The asset review at `/aisle/assets/review.html` shows the actual runtime model from oblique, rear and canvas-edge views. Portable Blender generation and GLB conversion scripts are included with the assets. Private construction-reference photos are not included.

## Construction evidence

![Blender easel construction](blender-construction.png)

![Runtime canvas edge and weave](canvas-edge.png)

![Runtime rear stretcher, folded cloth and staples](canvas-rear.png)

## Validation

Browser acceptance: **661/661 checks passed**, no failed assertions, no missing test diagnostics and no console/asset failures. Both desktop and phone emulation sampled all 121 video frames in both directions, real print geometry/UVs and source ratios, native wheel and emulated touch gestures, explicit Still behavior, system reduced motion, idle water differences, menu/category/detail and focus return, final Coke/panorama visibility and click targets. Runtime source hashes stayed unchanged during the run. A separate 60-frame HUD probe found one stable layout; a reload probe preserved exact normalized progress and view mode.

The bundled `npm run check` also passes: all 92 existing photograph hashes match, 69 category entries and ten slots remain present, all 121 video-frame hashes match, and server private-path/write-method probes pass.

| Earlier recovered view | Current entrance |
| --- | --- |
| ![Earlier supports and HUD](before-desktop.png) | ![Blender easels and quiet glass HUD](after-desktop-start.png) |

![Current middle of walk](after-desktop-mid.png)

![Final bottle-cap and coastal prints](after-desktop-end.png)

| Phone bottle-cap print | Phone panoramic print |
| --- | --- |
| ![Coke canvas](after-phone-coke.png) | ![Panorama canvas](after-phone-panorama.png) |

Automated checks establish behavior and source identity; they do not certify photorealism or real-device performance.

[Browser check summary](BROWSER-CHECKS.md) · [Continuous 17.8-second forward/reverse recording](continuous-forward-reverse.webm). The recording included one approximately one-second animation-frame delay; smooth performance on physical mobile hardware remains unverified.

## Remaining release limits

- The pier is one photograph on estimated corridor geometry. Its actual post depths, unseen faces and occlusion have not been recovered from a camera solve. Long-travel timber texture stretch is reduced but still visible.
- Photographic water motion is a restrained compositing approximation. It is not a measured wave field or fluid simulation. Water/pier contact and easel reflections still need artistic review in continuous motion.
- The easel uses a scanned repeating pine material and regular modeled cloth corners. It is more detailed than the prior supports but remains visibly computer-rendered at some angles.
- The video is generated footage with an authored camera path, not validated 3D registration. It remains an opt-in preview.
- Viewport tests emulate phones in desktop Chrome; they do not establish performance on a physical iPhone or an actual Magic Mouse's hardware momentum.

This branch does not merge the separate collaborator water-shader PR, alter the upstream default branch, or deploy Pixpa/production.
