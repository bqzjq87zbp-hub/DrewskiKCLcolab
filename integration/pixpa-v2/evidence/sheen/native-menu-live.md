# Native-menu sheen — independent LIVE acceptance

Date: 2026-09-10. Scope: saved native optical-menu runtime on public Home and Families. Read-only publication check; no Studio, Sites, GitHub, source, live DOM, or live CSS modifications.

## Result

[Certain] PASS for the bounded live native-menu sheen change on Chrome at1440×900 and390×844. Fresh public pages serve the exact accepted optical script. Actual down/up scrolling, open/closed navigation, idle disappearance, clipped desktop phase wraps, no horizontal overflow, Escape/focus, actual links, and the existing appearance-preference contract passed. This is live evidence, not reuse of the localhost fixture result. It is not a whole-site design audit or physical-device Safari certification.

Home: `https://kiyonocreativelab.com/?native-sheen-live=20260910-1010`
Families: `https://kiyonocreativelab.com/families?native-sheen-live=20260910-1014`

## Exact source identity

Both browser DOMs contained exactly one `script#kcl-b-optical-glass-runtime-20260904` with SHA-256:
`93d81d23e261dc3b72db526231c9d328e479942ebb685142f456e63849bf40d7`.

Independent network-only worker also fetched both fresh cache-busted pages at17:13:16UTC: HTTP200 / cacheMISS. Each contained exactly one optical script, one optical CSS owner, and one appearance-runtime companion. All matched the accepted candidate:

| Owner | SHA-256 |
| --- | --- |
| Optical script | `93d81d23e261dc3b72db526231c9d328e479942ebb685142f456e63849bf40d7` |
| Optical CSS | `93710a787cad207cbd91ee4e072bab38cac1e32d6456493fb6e21bda9b8e2481` |
| Appearance runtime | `3d91bf2a5b69b43c205181c1ba70eeb2bf7117d6e3da41890b06abf5f4d581db` |

Accepted shared-body identity:286466bytes; SHA-256 `3b538d6cbbdf38d037143bac07bf6b80daabd60db42b9b3452b43cc4e2bc76d9`. Editor save/reload verification belongs to root; this report verifies effective public runtime independently.

## Actual native scroll measurements

Normal mode: visitor choiceClear, reduced motion off, reduced transparency off, contrast off, forced colors off. Actual compositor wheel gestures drove native document scrolling. No replacement script, handler, preview CSS, forced transform, or scroll-position setter was injected. Read-only animation-frame sampling recorded180frames per gesture; rendered screenshots were captured during motion.

| Page / viewport / menu | Down Y; toggle X | Up Y; toggle X | Outcome |
| --- | --- | --- | --- |
| Home1440 open | 0→677; −129.75…239.54% | 678.5→135.5; −130.37…239.13% | Both menus travel; clipped wraps both directions |
| Home1440 closed | 129→328;112.59→190.00% | 328.5→149.5;190.62→116.72% | Toggle travel; hidden dropdown opacity0 |
| Home390 open | 0→32;56.54→68.68% | 32→1;66.48→55.66% | Visible subtle glint in header’s existing visible range |
| Home390 closed | 1→35;58.09→70.23% | 35→17;68.90→62.94% | Visible toggle glint; hidden dropdown opacity0 |
| Families1440 open | 0→643.5;−129.54…239.96% | 646→118.5;−129.54…240.16% | Both menus travel; clipped wraps both directions |
| Families1440 closed | 110→261;104.54→162.55% | 261→136;159.66→111.15% | Toggle travel; hidden dropdown opacity0 |
| Families390 open | 0→230.5;59.41→156.74% | 231→32;156.74→69.35% | Header stays visible; both menus travel |
| Families390 closed | 31→155;71.77→123.19% | 155→80;120.99→90.53% | Toggle travel; hidden dropdown opacity0 |

Dropdown open travel was also sampled: Home390 down56.58→69.03%, up66.76→55.68%; Families390 down59.52→159.22%, up159.22→69.69%. Active opacity reached0.14. Separately settled open-menu snapshots on both pages and both viewports recorded opacity0 and `will-change:auto` for both layers. Home normal owner count10; Families14, with no duplicate optical runtime.

Representative rendered files: `home-desktop-open-down.png`, `home-portrait-open-down.png`, `families-desktop-open-up.png`, `families-portrait-open-down.png`, their matching `*-idle.png`, and open/closed down/up captures for every matrix row. Screenshots were visually inspected: glint stays on glass; photography remains the underlying public imagery. Existing keyboard focus rings and Families current-link outline are not sheen artifacts.

## Wrap clipping and overflow

Selectors: `.kcl-premium-nav-toggle > .kcl-b-sheen-layer::before` and `#kcl-premium-primary-navigation.kcl-premium-nav-dropdown > .kcl-b-sheen-layer::before`.

Each retained an overflow-hidden layer,48%-wide band, and skew matrix c=−0.19438. Home1440 down wrap sampledX239.54→−129.75% (toggle),243.48→−133.69% (dropdown). Transformed band bounds before/after: toggle left100.70>clip91 then right−8.59<0; dropdown left482.04>clip438 then right−40.99<0. Reverse wrap also remained fully clipped. Families1440 crossings likewise had toggle outside margin≥8.49px and dropdown≥40.45px on the left, with the previous band entirely beyond the right edge. No visible phase-reset flash or horizontal overflow was observed.

Document scrollWidth did not exceed innerWidth on either page at either tested width. This check does not claim an unrelated full-page layout audit.

## Existing390 Home caveat preserved

Home’s pre-existing narrow-screen masthead still computes `position:sticky` but scrolls out with the page: fresh live probe atY242 gave menuTop−233. This was already independently reproduced in unchanged public and localhost baselines before the runtime change. The fixed-menu phase offset adds an immediately visible glint while that header remains visible; it does not repair header geometry. Families390 did not exhibit this limitation in the tested range: menuTop remained8 atY31 after the longer down/up sequence.

## Navigation and preferences

Escape closed the menu and focused `.kcl-premium-nav-toggle`. Enter reopened; Tab focused the actual Portfolio link `/portfolio`. Clicking the actual Families link from Home loaded public `/families` and its expected heading. Clicking the actual Home brand link from Families loaded public `/`. No forms were submitted.

The existing appearance contract was exercised on live Families. Temporary visitor choices were restored to the originalClear choice immediately after tests:

| State | Effective appearance | Sheen layers / active opacity |
| --- | --- | --- |
| Reduced motion + Clear | Clear | 0 /0 |
| Reduced transparency + System | Solid | 0 /0 |
| Reduced transparency + explicitClear | Clear | 14 /0.14 |
| Solid choice + normal media | Solid | 0 /0 |
| Increased contrast + Clear | Contrast presentation | 0 /0 |
| Forced colors + Clear | System-color presentation | 0 /0 |

Solid menu rendered dark panels/light text; contrast rendered white panels/black button text/blue links; forced colors rendered black panels/white button text/yellow links. This is a menu-preference contract check, not certification of all underlying page typography in every accessibility mode. Each state has its own `pref-*.png` screenshot. Normal Clear and accessibility fallbacks are not conflated.

## Restoration and evidence hygiene

Both owned live tabs had media and device-metric overrides cleared. Fresh final readback on both: choiceClear, effectiveClear, reduced motion=true, reduced transparency=true, contrast=false, forced colors=false, sheen layers0. No browser-local content patch or interception was used in this live turn. No Studio/source/deployment writes occurred.

Evidence contains public page screenshots and this sanitized report only—no cookies, tokens, credentials, private source paths, or Studio captures. Agent-browser guidance informed isolated tab ownership, real interaction, fresh state checks, and cleanup.
