# Mobile loading and graphics recovery — published repair

The live gallery remains **104 photographs:25 Branding,27 Family,36 Headshots,16 Coastal**. This repair changes startup/rendering resources and recovery, not photography curation, full-image URLs, print proportions, desktop placement, glass-sheen sources, native Home, or the Pixpa wrapper.

[Open the current public gallery](https://kiyonocreativelab.com/pier-gallery?release=walk-repaired-v16-20260910).

## Published identity

- Hosting source: `b352db8e50f3d62a8efb053b594d753fc9c33c08`.
- Sites version16, published2026-09-10T23:21:09Z.
- Previous accepted104 hosting source: `0e8e58237a7a8ab6875944c8d1da5bfc26015be1`, version14.
- Accepted standalone repair source: `6e20f7e5ca4125cfedd2b3e5198cb37e6bd30bf4`.
- Final hosted HTML9,234bytes/SHA256 `b98cd11e3f6490e88182f32b019722913de33b7b85cbf244909fcb96fd5538df`.
- Protected hosted category SHA256 `f839b9716516405ae360933431650a348e44a330687c15af6d887768e8f67980`; slots SHA256 `6488477c2b3294f9fd292d24e052b690a9a91b370020312a1870d2ed7b2dbc21`.

Fourteen proportional scene-only JPEG previews total1,432,573bytes. Originals/full collections are unchanged. Startup retains the genuine pier photograph until a successful graphics frame; a20-second deadline, graphics-loss handling and Retry preserve usable photograph browsing when3D cannot run. Fallback is **not** reported as interactive walking. The render loop settles at rest. See [source rationale](../../docs/MOBILE-LOADING.md) and [derivative manifest](../../docs/mobile-scene-assets.json).

An intermediate version15 post-publication check caught eleven static fallback image paths resolving outside the nested hosting directory. Version16 corrects only those HTML source URLs to `./media/scene-mobile/`; fresh public no-JavaScript tests decoded all11 and recorded zero failed responses. Runtime texture paths were already correct. All hosted dependencies must be included when rebuilding; do not copy only the HTML.

## Actual public acceptance

The tests start at the real public Home and click Walk the Pier into its cross-origin child. A pass requires actual GPU draw calls, movement and exact return, not just a successful document request.

| Environment | Input | Walk progress | Collection return |
|---|---|---|---|
| Chrome152,1440×900 | Native wheel | 0 →0.1656565657 | Exact |
| Chrome152,390×844 | Compositor touch scroll | 0 →0.0725381780 | Exact |
| MacWebKit26.4,390×844 | Child-focused native PageDown | 0 →0.1058451817 | Exact |

All three passed painted3D →Menu →Coastal →Back to the same position; zero child HTTP errors, application/renderer errors, crashes or post-ready horizontal overflow; seven menu destinations48px high. The initial pier image decoded. In-app keyboard PageDown/PageUp also advanced and returned to the entrance. Public JavaScript-disabled WebKit decoded all11 static images with zero overflow.

[Evidence summary](evidence/mobile-safari/public-qa-summary.json) · [Phone entry](evidence/mobile-safari/phone-entry.png) · [Phone touch walk](evidence/mobile-safari/phone-walk.png) · [Desktop walk](evidence/mobile-safari/desktop-walk.png) · [No-JavaScript fallback](evidence/mobile-safari/no-js-fallback.png).

Local frozen-source WebKit/Chrome also passed simulated context loss+Retry, unavailableWebGL, stalled-module timeout, full photograph return and landscape. Same-scope local response bodies fell24,553,419 →4,329,414bytes; dimension-based RGBA estimate fell247,656,000 →45,986,560bytes. These are local response-size and image-dimension estimates, **not measured iPhone memory or cellular timings**.

Physical iPhone Safari remains unverified. The exact reported device crash was not reproduced; resource pressure plus prior failure handling remains the likely explanation. Desktop-engine emulation and a functioning fallback do not certify a phone repair. The HTML's raw network response also contains a single CDN-injected challenge script; only separately normalized authored HTML matches the source hash. No unrelated curation or native Pixpa changes are part of this release.
