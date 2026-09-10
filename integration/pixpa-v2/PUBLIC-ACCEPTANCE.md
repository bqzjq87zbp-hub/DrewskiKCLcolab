# Public acceptance: 94-photo release and preserved history

## Current release: Sites version 11

**[Certain] The 94-photo version is deployed and independently accepted on the actual public Pixpa iframe.** It deployed at `2026-09-10T18:10:12.341447Z`, hosting source `874050f23a65d4adc4f1734572f7b6de9ef6bcaf`; independent acceptance completed at `2026-09-10T18:22:07.762531Z`. [Public gallery](https://kiyonocreativelab.com/pier-gallery?release=next12-live-20260910). This is a category-only addition of twelve approved photographs, not a runtime or Pixpa field update.

Fresh public response checks match all seven inspected category/runtime/slot files. Categories are 40,566 bytes, SHA-256 `4806f5f9c2f9b7d15958c24ea293f7c5d4d218c664903c65ab80e156209ddb18`, with 21 Branding / 26 Families / 34 Headshots / 13 Coastal. Owner actual iframe interaction opened the new white-coat portrait at 2133×3200 with contain/no-filter presentation, returned focus on Close, and moved the aisle by native wheel Y 0→620→360 without overflow. Independent post-publication acceptance is recorded separately in [NEXT12-RELEASE.md](NEXT12-RELEASE.md); a deployment result or source hash alone is not the rendered acceptance gate.

The [independent live report](evidence/next12/independent-live/README.md) verifies all 24 external-image decodes, all twelve new desktop full-photo clicks, five phone representatives, landscape/full-file/Next/Previous, native touch and exact aisle return, clear glass with stable idle, and intentional accessibility suppression. Zero gallery errors. Only settled accepted captures are included; test overrides were cleared. This remains browser emulation, not physical-device certification.

## Historical sheen acceptance: Sites version 10

**[Certain] The 82-photo pier gallery and its two outer exit reflections passed independent live checks.** Hosting source `5ad8f30538858534937cbaa1a2249db63dc3fcd6`, Sites version 10, deployment `SUCCEEDED` at `2026-09-10T16:55:59.161188Z`. [Current public gallery](https://kiyonocreativelab.com/pier-gallery?release=sheen-live-20260910).

The exact category bytes still contain 17 Branding, 24 Families, 33 Headshots and 8 Coastal entries. Photograph bytes, ten easels, camera path, centered footer and 121 video frames are unchanged. The version 10 delta is optical-glass sheen, not another photo expansion. The independent reviewer fetched exact live source hashes and tested desktop and true coarse-pointer Chrome emulation, native forward/reverse input, idle stability, full-photo viewing, exact return, three viewer widths, both exits and disabled-state preferences. The gallery recorded zero browser errors.

See [SHEEN-RELEASE.md](SHEEN-RELEASE.md) for the complete current acceptance scope, hashes, capacity and rollback records; [independent live report](evidence/sheen/independent-gallery-live.md) and [raw gallery probes](evidence/sheen/independent-gallery-live.json) provide the underlying observations. These checks do not claim that all 114 image URLs were re-decoded on version 10; the complete first-expansion image pass remains historical evidence below.

The gallery's persisted Pixpa wrapper is 6,805 bytes, SHA-256 `f9774d3dfbfd0f99f366a065538d83580b959b846ca4834cef0f78daeef5b17d`, and remains unchanged in version 11. The separate native-menu Shared Body patch was saved and exact after editor reload; **independent live acceptance also passed on Home and Families at 1440×900 and 390×844**. [Native live acceptance](evidence/sheen/native-menu-live.md) records actual motion, idle, links, focus and the existing appearance contract. [Fresh source and persistence evidence](evidence/sheen/live-source-and-persistence.json) verifies the exact unique optical script on seven routes; source identity alone is not a rendered seven-route audit. The known 390px Home-header scroll-out behavior, differing native/gallery reduced-transparency contracts and external Inquiry legal-link limitation remain disclosed. The then-separate 94-entry candidate is now the version 11 release above.

## Historical acceptance: first 13-photo expansion, versions 8 and 9

**[Certain] The bounded expansion and footer correction passed the release owner and independent reviewer’s public checks.** This record concerns the deployed Pixpa gallery. GitHub source delivery requires its own commit, push and remote readback evidence.

- [Public gallery](https://kiyonocreativelab.com/pier-gallery?release=first13-final-20260910).
- Published hosting source: `4c8bd39a65c7ebb29213d14d63f144ff62d318b3`, Sites version 9; deployment succeeded `2026-09-10T16:05:32.388978Z`.
- 82 collection entries: **17 Branding, 24 Families, 33 Headshots, 8 Coastal**. All 69 old entries, relative order, photograph bytes and ten easel slots remain.
- Exactly 13 additions / 26 JPEG derivatives. Sheen and the subsequent 12-photo batch were excluded from this historical acceptance. They are covered separately by versions 10 and 11 above.

### Actual public evidence for versions 8 and 9

Core image and pathway checks were performed on version 8. Version 9 changed only the viewer footer’s `text-align:center`; its public CSS and unchanged category/main hashes were reverified. The distinction is preserved in the evidence rather than claiming every interaction was repeated after a one-declaration change.

- `evidence/first13/independent-public-image-qa.json`: all **114 distinct thumbnail/full URLs decoded**, and all **13 added photos were actually opened** in the public Pixpa iframe at their supplied dimensions, with `object-fit:contain` and opacity 1. Closing and returning restored the aisle’s Y 400.
- `evidence/first13/live-owner-pathways.json`: desktop native wheel Y **0→650→400**, zero horizontal overflow; coarse/no-hover 390×844 compositor-touch Y **1628.5→3408→2485.5**. Actual enlargement and focus return passed. The phone glass control was transparent and 48px high. System reduced-transparency/reduced-motion produced solid `rgb(16,44,64)`, no blur and no overflow.
- Actual **Plan Your Portrait** navigation left the gallery iframe for the top-level Inquiry page. The form loaded and its First Name field was focused, with no data entered or submitted. Browser Back returned to Branding; Back to the aisle restored Y 400. The JSON adapter captured an empty string for that return’s progress property; it must not be treated as zero or as a numeric proof. The owner separately verified the accessibility progress value of approximately 0.080808. Main exit reached Home and browser Back restored the gallery.
- `evidence/first13/footer-center-public.json`: all three changed runtime responses returned HTTP 200 with exact hashes and **no injected QA style**. Owner tests at 844×390, 320×568, 390×844 and 1440×900 found no image/viewport overflow and no footer/exit overlap.
- `evidence/first13/independent-footer-version9-qa.json`: independent settled public renders confirmed zero footer intersection with either 48px exit at **844×390, 320×568, 390×844 and 1440×1000**. This resolves the one overlap found during version 8 review.

Exact public SHA-256 at version 9; version 10 retains the category/CSS hashes and updates `main-v2.js` as recorded in the sheen release:

| File | SHA-256 |
|---|---|
| `categories.json` | `3a8ea3a46ee82f143aecd8e9f253939f2c70b759b2827b392286299f18108ba9` |
| `collections.css` | `a38976fef5b5e845c014cd8c977272b61600a08b99b86e9a69262ed39c10e927` |
| `main-v2.js` | `30d1f979270e6eaa16e79a4e9d4c2a9a8ae5ddd60ca76258aa1ccef09eec85b5` |

### Historical rendered evidence and limits

The actual public `live-desktop-walk.png` and `live-phone-new-headshot.png` show the version 8 aisle/image pathway. `footer-center-public-390x844.png` and `independent-footer-fixed-844x390.png` show the final centered footer. Each was visually inspected before inclusion. The publisher’s stale 844px screenshot and the earlier mixed-pointer phone-menu screenshot were rejected as acceptance artifacts and are **not included**. Their capture inconsistencies are not a demonstrated live-site defect.

These are installed-Chrome browser and compositor-input tests, **not physical iPhone/iPad or mobile-Safari certification**. Generated-video tracking/occlusion and a hyper-realistic reconstruction are not declared finished.

The external Inquiry form’s existing Privacy/Terms links still point to `example.com`. That unrelated legal-link issue remains unresolved and outside this release. A successful navigation/focus probe does not certify the whole form, delivery or legal content.

### Historical preservation and rollback

The Pixpa wrapper is unchanged: 3,900 bytes, SHA-256 `3618931079d93eed39867d54ae242c1808390a9bafbaf95a8b57fd51c40e6ab9`. No new Home, Shared Body or other Pixpa route save accompanied this expansion. Host rollback authority remains version 7 at `a3e11d42389229d67913934f9e82a845e605620d`; preserve its existing photo URLs.

The exact version 9 archive is 261,251,340 compressed / 268,013,056 unpacked bytes, leaving 422,400 bytes below 256 MiB. SHA-256: `539dbaa689accc2f603be472ea925a84b51c1124ca2d1a714a5a205a70cdcf16`. The separate 277-file gallery rebuild verifies 193,348,761 bytes from shared source alone; those are different package scopes.
