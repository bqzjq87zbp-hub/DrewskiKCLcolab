# Public acceptance — first 13-photo expansion

**[Certain] The bounded expansion and footer correction passed the release owner and independent reviewer’s public checks.** This record concerns the deployed Pixpa gallery. GitHub source delivery requires its own commit, push and remote readback evidence.

- [Public gallery](https://kiyonocreativelab.com/pier-gallery?release=first13-final-20260910).
- Published hosting source: `4c8bd39a65c7ebb29213d14d63f144ff62d318b3`, Sites version 9; deployment succeeded `2026-09-10T16:05:32.388978Z`.
- 82 collection entries: **17 Branding, 24 Families, 33 Headshots, 8 Coastal**. All 69 old entries, relative order, photograph bytes and ten easel slots remain.
- Exactly 13 additions / 26 JPEG derivatives. New sheen work and the future 12-photo batch are excluded.

## Actual public evidence

Core image and pathway checks were performed on version 8. Version 9 changed only the viewer footer’s `text-align:center`; its public CSS and unchanged category/main hashes were reverified. The distinction is preserved in the evidence rather than claiming every interaction was repeated after a one-declaration change.

- `evidence/first13/independent-public-image-qa.json`: all **114 distinct thumbnail/full URLs decoded**, and all **13 added photos were actually opened** in the public Pixpa iframe at their supplied dimensions, with `object-fit:contain` and opacity 1. Closing and returning restored the aisle’s Y 400.
- `evidence/first13/live-owner-pathways.json`: desktop native wheel Y **0→650→400**, zero horizontal overflow; coarse/no-hover 390×844 compositor-touch Y **1628.5→3408→2485.5**. Actual enlargement and focus return passed. The phone glass control was transparent and 48px high. System reduced-transparency/reduced-motion produced solid `rgb(16,44,64)`, no blur and no overflow.
- Actual **Plan Your Portrait** navigation left the gallery iframe for the top-level Inquiry page. The form loaded and its First Name field was focused, with no data entered or submitted. Browser Back returned to Branding; Back to the aisle restored Y 400. The JSON adapter captured an empty string for that return’s progress property; it must not be treated as zero or as a numeric proof. The owner separately verified the accessibility progress value of approximately 0.080808. Main exit reached Home and browser Back restored the gallery.
- `evidence/first13/footer-center-public.json`: all three changed runtime responses returned HTTP 200 with exact hashes and **no injected QA style**. Owner tests at 844×390, 320×568, 390×844 and 1440×900 found no image/viewport overflow and no footer/exit overlap.
- `evidence/first13/independent-footer-version9-qa.json`: independent settled public renders confirmed zero footer intersection with either 48px exit at **844×390, 320×568, 390×844 and 1440×1000**. This resolves the one overlap found during version 8 review.

Exact public SHA-256:

| File | SHA-256 |
|---|---|
| `categories.json` | `3a8ea3a46ee82f143aecd8e9f253939f2c70b759b2827b392286299f18108ba9` |
| `collections.css` | `a38976fef5b5e845c014cd8c977272b61600a08b99b86e9a69262ed39c10e927` |
| `main-v2.js` | `30d1f979270e6eaa16e79a4e9d4c2a9a8ae5ddd60ca76258aa1ccef09eec85b5` |

## Rendered evidence and limits

The actual public `live-desktop-walk.png` and `live-phone-new-headshot.png` show the version 8 aisle/image pathway. `footer-center-public-390x844.png` and `independent-footer-fixed-844x390.png` show the final centered footer. Each was visually inspected before inclusion. The publisher’s stale 844px screenshot and the earlier mixed-pointer phone-menu screenshot were rejected as acceptance artifacts and are **not included**. Their capture inconsistencies are not a demonstrated live-site defect.

These are installed-Chrome browser and compositor-input tests, **not physical iPhone/iPad or mobile-Safari certification**. Generated-video tracking/occlusion and a hyper-realistic reconstruction are not declared finished.

The external Inquiry form’s existing Privacy/Terms links still point to `example.com`. That unrelated legal-link issue remains unresolved and outside this release. A successful navigation/focus probe does not certify the whole form, delivery or legal content.

## Preservation and rollback

The Pixpa wrapper is unchanged: 3,900 bytes, SHA-256 `3618931079d93eed39867d54ae242c1808390a9bafbaf95a8b57fd51c40e6ab9`. No new Home, Shared Body or other Pixpa route save accompanied this expansion. Host rollback authority remains version 7 at `a3e11d42389229d67913934f9e82a845e605620d`; preserve its existing photo URLs.

The exact version 9 archive is 261,251,340 compressed / 268,013,056 unpacked bytes, leaving 422,400 bytes below 256 MiB. SHA-256: `539dbaa689accc2f603be472ea925a84b51c1124ca2d1a714a5a205a70cdcf16`. The separate 277-file gallery rebuild verifies 193,348,761 bytes from shared source alone; those are different package scopes.
