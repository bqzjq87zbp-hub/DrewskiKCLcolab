# Independent collaboration-prototype QA

Date: 2026-09-08. Scope: local export browser behavior and publish allowlist. Reviewer: independent QA lane. No runtime edits, uploads, commits or publication by this reviewer.

## Verdict

[Certain] No blocker was found for sharing the checked **collaboration prototype** through an explicit repository allowlist. This is not production-site acceptance, a video-tracking approval, or evidence that a GitHub upload succeeded.

The original 2.5D gallery baseline passed independent actual Chrome checks at **390×844** and **1440×900**. A later default-view check confirmed that the newly added video module loads after the local server restart, while its preview remains opt-in. The full new-video matrix is owned by the separate video QA lane.

## Baseline browser results

| Check | Evidence |
| --- | --- |
| Gallery counts | Branding 13, Families 21, Headshots 31, Coastal 4 at both sizes |
| Gallery images | 138 successful decode checks, all 69 entries at each size |
| Full-image viewer | 32 successful opens/decodes: all 13 Branding images plus one image in each other collection, at both sizes |
| Escape return | All 32 restored the exact thumbnail, route and scroll position, with 0px scroll difference |
| Image layout | Tested gallery/full images visible; full-image view uses contain framing |
| Viewer controls | Previous, Next and Close inside the viewport, each at least 44px high |
| Category navigation | All four actual navigation links and return-to-aisle flow worked |
| Horizontal overflow | 0px in all four collections at both widths |
| Menu | Five links and two native selects, all 48px high and inside both viewports |
| Menu Escape | Closed the panel and restored the menu toggle |
| Appearance | Explicit Clear and Solid choices produced their distinct intended material states |
| Scroll | A 650px wheel movement advanced the baseline progress from 0 to approximately 0.140 mobile / 0.131 desktop |
| Console/runtime errors | 0 |
| Failed browser requests | 0 |
| Purchased room fallback | Zero room templates; all 21 Family photographs available |

Rendered photographs, menu and enlargement screenshots were visually inspected. The dense easel/label arrangement remains a prototype design, and the small distant photographs are category entry points. This report does not call the scene photorealistic.

The initial desktop screenshot briefly showed an undecoded headshot placeholder. A deliberate loaded-image recapture after the server restart decoded all 60 scene image elements at each width; the actual headshot then appeared. The early loading screenshot is not treated as a missing-file defect.

## Baseline versus video module

Baseline runtime hash: `public/aisle/photographic-aisle.js` = `b752dc574353beddeeaa16c7091c2a62b238155b054b99bb15adb2bd6b0e6bbc`.

New default-view recapture used:

- `public/aisle/photographic-aisle.js`: `4be92b833ee39a5760b895996b50a5b7f7dfc0f1922bdb133692a2239b17d643`
- `public/aisle/video-frame-seam.js`: `f56bff759612363a67c1f8152af58bacbdbc2747623bac9243f4980d8267b01f`

Both default entrances rendered with the new Preview video walk control. This independent lane did **not** enable the clip or validate tracking, frame timing, 4K fidelity, temporal realism or geometric alignment. Refer to the video lane's current report for those separate claims. An intermediate load failure occurred between module arrival and server-allowlist restart; it was resolved by the coordinator's restart and is excluded from the baseline result.

Gallery manifest remained `6eb94e96d67f8a6103b1414ab8b72aef4d265d9ed0ec346802395a7892a2134c`. The baseline run's gallery modules and manifest hashes matched before and after that run.

## Publish allowlist and privacy

[Certain] The latest read-only tree scan found **213 JPEGs: 92 portfolio/reference files plus 121 preview frames**. No MP4, MOV, MKV or WebM master was present in the export. No private-machine path, secret-shaped value, or Python bytecode was found in the scanned source/data/docs/tools. No file exceeded 25 MiB.

Actual `git check-ignore --no-index` probes confirmed exclusion of provider-master files in `local-masters/`, private tool/data directories, evidence, `.env`, `.openai` and `*.private.json`. The new generic Python tooling contains parameterized inputs, not actual source-machine paths. Its future private outputs must stay in ignored directories. This bounded scan cannot prove the absence of every conceivable secret.

Purchased room backgrounds remain excluded. Include only reviewed runtime code, sanitized category/frame data, explicit web images and generic collaboration tooling/documentation. Exclude the source video master, private evidence, credentials, account configuration and source-machine records even if a manual upload chooser allows their selection. An ignore file is not an upload allowlist for a browser file picker.

The repository's `npm run check` was rerun after the new module arrived. Its verified scope remains the gallery asset manifest, private-pattern checks and local server routes; it is not a frame-tracking acceptance test.

## Known GitHub UI workflow

GitHub documents folder drag-and-drop through Add file → Upload files, with at most 100 files per batch and 25 MiB per file. The 92-image media folder fits one file-count batch; the 123-file video directory needs at least two. Preserve the intended parent directory and inspect every staged relative path before committing. Do not assume a native multi-file picker adds the enclosing folder. [GitHub upload documentation](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)

No UI upload was attempted by this reviewer. Sharing code, making a Git commit and deploying a production website are separate outcomes.

## Evidence, method and handoff

Browser evidence is retained outside this repository under audit ID `20260908-clean-export-qa`: `baseline/results.json`, baseline gallery/menu/enlargement screenshots, and `new-driver-default/entrance-results.json` with decoded entrance screenshots. This avoids committing QA tools with local source paths or private working records.

CUA was attempted first. Its Chrome viewport operation detached the QA tab; the temporary override was reset. The in-app browser was unavailable. The coordinator then explicitly authorized isolated headless Chrome/Playwright for local testing only. No authenticated browser, cookies or remote debugging attachment were used for the successful test matrix.

Authority and purpose: the owner's bounded clean-export QA request. Prerequisite: current local runtime and explicit media allowlist. Exit check: evidence above. If runtime, gallery or asset files change, recheck the affected scope. Otherwise return to the coordinator for video-lane results and repository decisions. Terminal condition: this independent local report, with no publication claim. Provenance: current tool probes and rendered artifacts; refresh after changes.
