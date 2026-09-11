# Seven approved additions: 94 → 101

Status: independent exact-adapter and actual-public acceptance passed. The category-only update is deployed and verified through the public Pixpa iframe.

## Exact scope

The release adds four Branding photographs, one Coastal photograph and two Headshots, preserving every prior 94 photograph record, caption, URL and relative order. Families remains at 26. The resulting counts are **25 Branding / 26 Families / 36 Headshots / 14 Coastal**.

| Collection | Added photograph |
| --- | --- |
| Branding | Stacked chilled cans |
| Branding | A close sip |
| Branding | Bottle in the surf |
| Branding | Team beside the truck |
| Coastal | Ball toss beneath the pier |
| Headshots | Portrait in a light gray jacket |
| Headshots | Portrait beneath an awning |

The light-gray-jacket portrait follows the flat-cap portrait. Cream knit and burgundy remain between it and the appended awning portrait. Literal titles, alt text, full-frame crops, intrinsic dimensions and category roles are unchanged from the accepted donor `26ffff0304b95c0ca36b9f568318cabbd34da434`.

## Photo delivery and source integrity

Fourteen distinct native Pixpa Files records supply the seven full/thumbnail pairs, totaling **9,889,606 bytes**. All 14 persisted through a full Studio reload; all 36 older file records remained unchanged. An independent anonymous download check returned 14 HTTP200 JPEGs with exact approved bytes, SHA256, dimensions and sRGB profiles, and no redirects or expiration headers. This establishes current delivery, not perpetual hosting or CORS/WebGL support.

Only the seven new ordinary collection/viewer records use these new URLs. No new file is added to the ten easel slots, WebGL textures or the nearly-full hosting archive. The standalone source retains the exact approved JPEGs for rebuilding. The adapter's external-image map keeps its previous 24 rows intact and appends 14, for 38 total.

The sole hosting change is `categories.json`: **40,566 → 43,826 bytes**. Previous SHA256: `4806f5f9c2f9b7d15958c24ea293f7c5d4d218c664903c65ab80e156209ddb18`. Candidate SHA256: `eb36fbca4ba112a61d76049be2f9afb7dfe89c552adf74e1c86b25a6ce571c82`. All 591 other tracked hosting files are unchanged. The 279-file source rebuild exactly reproduces the hosting adapter, including its centered viewer footer and existing media paths.

The [Home mobile-header repair](HOME-HEADER-RELEASE.md) remains intact. No Shared Body, native Page Code, Home parent, scene, water, camera, menu handler, sheen or photograph geometry changes are included. Prior hosting source/version: `874050f23a65d4adc4f1734572f7b6de9ef6bcaf`, Sites version11. Exact private field rollbacks and original-source provenance remain private, outside this repository.

## Rebuild checks

Run `node integration/pixpa-v2/build.mjs --check`, `node integration/pixpa-v2/verify-external-assets.mjs`, and `npm run check`. The checked source has 101 photographs, ten unchanged easel slots, 92 original source photographs and the cumulative 64 approved expansion derivatives. Private routes remain unavailable in the local preview. Source-only inspection found no private ledger, source-path, credential, GPS or sensitive image metadata exposure.

## Publication and independent acceptance

The accepted adapter report completed at 19:30:24 UTC on September 10, 2026, SHA256 `26db4d1e1f381850a767acb9c2c7d3de1bfc3a2f6798e4cd488fc3cb9a433d92`. All14 images decoded; all7 desktop viewers, Close controls and actual full-file links passed; phone and landscape samples preserved full frames and contained controls. Native touch, wheel, clear glass, directional sheen and idle scheduling passed. Closing a photograph and returning to the aisle restored scrollY110 and progress0.014481305950500263 exactly. Runtime errors:0.

After checking all591 protected hosting files, only categories.json was committed and pushed as `c5e5ff358302b70021cd7ce214bf52a8e1285142`. Sites version12 was saved, then its deployment succeeded at **2026-09-10T19:38:51.062919Z**. [Public Pixpa gallery](https://kiyonocreativelab.com/pier-gallery?release=seven101-live-20260910). Hosting URL: https://kiyono-coastal-gallery.kiyonophotography.chatgpt.site.

Actual-public [independent acceptance](evidence/seven/REVIEW.md) passed at **2026-09-10T19:57:45.348Z**, report SHA256 `0f631f153d4ff211b89d148d8692cd42228716ce19a5312f4eb2337fd59bff7d`. The embedded response matched the exact101 candidate. All14 ordinary native image decodes, all7 desktop viewers, four390×844 phone samples and844×390 landscape passed. Native phone touch traveled y0→455→110; Family canvas→Headshots→new gray jacket→Close→Back restored y110/progress0.014481305950500263 exactly. Both outer Pixpa glass reflections followed the inner down/up movement and enlargement/Close; idle frame1704 remained stable with scheduling false. Runtime errors:0. The lazy-thumbnail locator timeout was resolved by native scrolling/tap, not a code change. Original overrides were cleared and owned review tabs closed.

The `evidence/seven/` handoff retains the accepted desktop and phone screenshots/reports plus exact public source probes. Its checksum list covers only the shared subset; the private workflow instruction file is excluded. Browser viewport/touch emulation is not physical iPhone/Safari certification. The existing video reference remains labeled preview-only; this photo expansion does not claim a new hyper-realistic scene or calibrated camera reconstruction.
