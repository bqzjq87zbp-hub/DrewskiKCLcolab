# Scroll-driven video: preparation and review gates

## Authority and status

- Authority: Kyle's requested original-underpier forward, level dolly; root agent owns provider, GitHub and release. Worker scope is local tools, this plan and the named clip QA folder only.
- Provider job: `30b5bab1-1ede-4d57-9487-b5f4357fcdf3` (Seedance2.0 standard; requested10s/4K with original start frame). Provider metadata is not decoded-file proof.
- This packet prepares extraction and a **disabled tracking scaffold**. A prompt is not a camera solve, an easel track or evidence of level motion.
- Existing `public/` app, menu, collections, original media and projection remain unchanged by these tools. The large provider master must remain outside `public/` and GitHub.

## One route at a time

1. Inspect the downloaded master: file hash, actual ffprobe dimensions/color/duration/frame timestamps, then six-frame review.
2. If the generated camera/crop/rigid structure fails, HOLD and return evidence to root. Do not hide a generation defect with scroll speed or guessed easel motion.
3. If root accepts the clip, extract one1280px full-frame JPEG sequence into a new quarantine directory. Review size, frame order and decoded results before any proposed public copy.
4. Only after an actual camera solve or manually reviewed per-frame measurements exist, populate tracking. Validate its structure, then review actual rendered tracking at390/1440.
5. Root chooses integration/release. This tool never uploads, publishes, invokes a generation provider or activates tracking.

Terminal condition: an accepted clip plus explicit frame/tracking evidence, or a named HOLD with exact failed frames. Return address: root agent. Do not loop generation or tracking guesses under this document's authority.

## Local tools

Requires Python3, Pillow, FFmpeg and FFprobe on PATH. The scripts invoke subprocess argument arrays, preserve source files, hash inputs before/after, and refuse existing output directories or outputs beneath this repo's `public/`. No package installation is performed.

From the export root, replace placeholders with the actual local master/source paths:

```sh
python3 tools/video_frames.py review \
  --input /absolute/path/to/master.mp4 \
  --source-image /absolute/path/to/original.jpg \
  --out /absolute/path/to/NEW-review-directory
```

Default review points are0/2/4/6/8/9.9seconds. The nearest **actual decoded timestamp** is selected and recorded; requested times are not falsely reported as exact frames. Outputs: six JPEGs, contact sheet, ffprobe/timeline JSON, frame manifest and `tracking.unreviewed.json`. Proportional resize only; no crop/upscale, new frames, FPS conversion, optical flow, artistic grade or invented geometry. JPEG is a review derivative, not lossless source identity. FFmpeg performs the video-to-RGB conversion; color metadata remains recorded for review.

For an accepted clip only:

```sh
python3 tools/video_frames.py sequence \
  --input /absolute/path/to/master.mp4 \
  --source-image /absolute/path/to/original.jpg \
  --out /absolute/path/to/NEW-sequence-directory --max-edge 1280 --every 2
```

For a24fps source, `--every 2` exports every other actual frame at12fps, retaining native frame indices and timestamps, with no generated in-between frames. Omit it to keep every frame. Boundaries:30seconds/2000frames maximum,128–1920px review edge, no HDR tone mapping, no non-square pixels or rotated coordinate spaces. Such inputs need separate review. Native-size detail crops may be made separately when specifically authorized; never bulk-export all4K lossless PNGs by default.

`stage_video_frames.py SOURCE NEW_DESTINATION` is a separately authorized local staging command. It verifies all JPEG hashes/decoded dimensions, strips private command/path fields and copies only derived frames plus sanitized manifests. It sets `reviewStatus:preview-only`, retains disabled tracking, refuses replacement and never uploads. Root authorized the current121-frame export to `public/video/`; this does not authorize publishing or staging any future clip.

## Clip acceptance evidence

- First frame compared to the **whole original**: aspect/crop changes, shifted pier center, changed people/objects, color and added content. Start-image input does not guarantee unchanged pixels.
- Frames0/2/4/6/8/9.9s: forward translation versus flat zoom; consistent level horizon/roll; no orbit, tilt, rise or sideways swerve beyond the accepted move.
- Rigid pylons/beams: no bending, melting, duplicated columns, discontinuous spacing or impossible occlusion. Moving surf is not itself a tracking feature or structural failure.
- Examine adjacent frames near any suspect point and at playback speed before claiming temporal continuity. A six-frame sheet is only the first gate.
- Report actual decoded width/height, duration/frame count, color, source hash, and any provider metadata mismatch. No release merely because FFmpeg decodes successfully.

## Tracking manifest contract (not yet measured)

`tracking.unreviewed.json` starts with `enabled:false`, `reviewStatus:"pending"`, `method:"none"`, empty `slotIds`/`frames`, and no review signature. Do not populate quads from the old aisle's fixed-depth enlargement or the generation prompt.

Coordinates are native decoded-video pixels, top-left origin, quads ordered TL/TR/BR/BL. Every observation uses the matching decoded `index` and timestamp relative to the first video PTS. The source video SHA256 must match. Every published frame in `frames.json` must be explicitly measured/projected before enabling; interpolation is `none` in this initial contract.

```text
schemaVersion:1
enabled:false
reviewStatus:pending
method:none | manual-per-frame | camera-solve-projected
videoSha256:<exact master hash>
coordinateSpace:{kind:native-video-pixels,width,height,origin:top-left,quadOrder:TL,TR,BR,BL}
timestampOrigin:<first decoded PTS>
interpolation:none
slotIds:[<actual existing slot IDs>]
frames:[
  {index,time,slots:[
    {id,visible,quad:<measured four corners or null when invisible>,depthOrder,
     confidence:<0..1>,evidence:[<actual source evidence>],
     occlusionPolygons:<optional reviewed geometry>}
  ]}
]
review:{reviewer,reviewedAt,evidence,limitations} | null
```

`confidence` is a recorded judgement, not an automatically computed guarantee. Invisible slots must not retain clickable quads. The original photograph has no easels to track: stable environment/camera measurements plus anchored easel planes, or reviewed manual projection, are required. Current photographic wood sprites cannot reveal unseen backs/rails; arbitrary quad warping is still2.5D, not full3D proof. Occlusion polygons and wood geometry need their own visual review; the structural validator does not certify them.

```sh
python3 tools/validate_tracking.py /path/tracking.unreviewed.json \
  --frames /path/frames.json --timeline /path/timeline.json

# This must fail for the initial scaffold:
python3 tools/validate_tracking.py /path/tracking.unreviewed.json \
  --frames /path/frames.json --timeline /path/timeline.json --require-reviewed
```

Even a structural pass never certifies tracking quality or authorizes activation.

## Minimum later runtime seam

Preserve `public/aisle/photographic-aisle.js` native scroll progress, System/Guided/Still preference and category anchors. Add an optional frame driver below the easels. Replace, rather than stack onto, its existing fixed-depth projection branch when reviewed tracking is selected. A committed sample must bind **the displayed frame's timestamp** to its easel quads; rapid scroll must not display new quads over an old frame. Keep `getState().slots[].projectedQuad`/`interactive` for existing category signs and publish a frame-commit layout invalidation. Preserve collection history, return scroll and focus.

Use a single cover transform for video pixels and all tracked coordinates. If a frame cannot decode, retain the last coherent pair or original/static fallback, not stale clickable geometry. Still/System reduced-motion mode must stay nonanimated; guided mode only on explicit choice. No wheel/touch interception, scroll lock or autoplay camera timeline.

If serving compressed video instead of frames, the current server needs explicit video MIME and byte-range support. The existing whole-file handler is not verified seeking infrastructure. Extracted image frames avoid random video-seek timing but require bounded preload/cache and measured memory/network budgets.

Final tests after a separately authorized implementation:390/1440 forward/reverse/rapid scrub; endpoints and cover-crop mapping; frame/quad synchronization; environment-anchor drift and occlusion; readable glass; visible48px-or-larger controls; collection return and Escape/focus; System/Guided/Still reversals; failed/slow media; no unrelated app/source change.

## Current actual asset and flow investigation

The decoded master is3326×2494 (approximately4:3), HEVC Main10 BT.709 SDR,24fps,241frames,10.041667s,134569404bytes; not the provider-reported3840×2160 shape. Exact SHA256: `4d8fa4dbf444ebbcdde91ed6ac91859463f387b16f0b7a30ff6497b31948dd8a`. The original3:2 framing is not preserved as a full-frame unchanged photograph.

Authorized preview sequence: `/video/frames.json`,121JPEGs1280×960, nativeindices0,2…240, times0…10s,31117150JPEGbytes. Sanitized manifest SHA256: `4c3f346d67e5ee76a719b07164155eebc880a0e7f26aec457597c074d5696ed3`. This is opt-in generated-video preview material, not accepted tracking or final release.

`pier_flow_probe.py` is a clip-specific diagnostic, guarded by the exact video hash. It uses inspected rigid pier feature regions, original-frame Shi-Tomasi points, sequential pyramidal Lucas–Kanade flow, a1px forward/backward gate and RANSAC2D affine fits. It never uses surf, reseeds identities or enables runtime tracking. The five regions are apparent near-to-far hypotheses, not solved world-depth groups. It produces actual feature overlays, per-frame residuals, rejected states and native-coordinate matrices in a NEW evidence directory. Any later use of those matrices for easels needs reviewed placement and fail-closed behavior; low fit residuals alone are insufficient.

`compare_first_frame.py` measures source-to-first-frame static feature alignment/crop only; it is not a camera solve. `python3 tools/test_video_tools.py` exercises the disabled-manifest, identity, geometry and sampled-frame-coverage gates with synthetic data.

Root additionally authorized `register_easel_plate.py`: SIFT excludes measured canvas faces/edges and lower surf, then registers the supplied plate to the first video frame. Actual80matches/60inliers,0.534px median/1.414px95th residual at1280 provide a measured initial mapping for all existing slot corners. This is static image registration, not easel world-depth proof. `stage_flow_experiment.py` may stage this exact registration plus actual flow diagnostics as separately named, disabled experimental data. It does not alter the default disabled `tracking.json` or activate runtime behavior. The explicit experiment can compose cover × measured-group-affine × measured-initial-registration; invalid groups must not silently reuse/interpolate geometry. Authored depth-to-feature-group correspondence and any per-frame hiding remain experimental and must be visually reviewed.

### Root-authorized opt-in measured2D preview

After inspecting the actual registration/flow evidence, root explicitly authorized a separate `public/video/tracking-preview.json`, built by `build_tracking_preview.py`. It is `enabled:true` **only for an explicitly chosen preview mode**, `reviewStatus:preview-only`, `method:measured-2d-flow`. The ordinary `tracking.json` remains disabled. Runtime must display: “Video preview · 2D tracked alignment; depth is approximate.” Invalid groups and their anchors/signs hide per-frame; no interpolation, stale fit or legacy scale substitution. The packet contains the measured initial matrix, all121native-frame-indexed group fits/validity/residuals and approximate region mapping. This is an authorized local experiment, not production-quality tracking approval. Root/runtime owner must inspect matching rendered overlays before release.
