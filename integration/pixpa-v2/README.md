# Pixpa V2 integration and first 13-photo expansion

This is the reproducible source handoff for the photographic pier gallery. The accepted aisle, ten easels, original photographs and full-height clear-glass Pixpa wrapper are retained. The first expansion adds 13 reviewed photographs to the collections; it does not add or rearrange the ten scene slots.

- [Public Pixpa gallery](https://kiyonocreativelab.com/pier-gallery?release=first13-final-20260910)
- [Direct gallery](https://kiyono-coastal-gallery.kiyonophotography.chatgpt.site/pier-v2-20260910/?release=first13-final-20260910)
- Previous shared handoff: `0569af6934e89acafcfc12b3bdf337c6bcacf4ee`.
- Accepted original standalone source: `78b36c1f5c4f0eadac850d4f00ab9761d4e05e3b`.
- Tested expansion donor: `09ce87a0e41630865b8c94550b2cd1d1c70923d3`.
- Published hosting source: `4c8bd39a65c7ebb29213d14d63f144ff62d318b3`, **Sites version 9**, deployed at `2026-09-10T16:05:32.388978Z`. The first expansion was version 8 at `843390d75c8bb10c6d6ff9981099acc1ec05908e`; version 9 adds only the footer-centering correction. [Public acceptance](PUBLIC-ACCEPTANCE.md) records the independent image/walk pass and version 9 clearance checks.

You do not need access to the private hosting repository to rebuild these gallery files. Public deployment and GitHub source delivery are distinct verification steps; the owner verifies the final commit, push and remote branch separately. Nothing here merges the separate collaborator PR.

## Exact change and preservation boundaries

The standalone `public/` tree carries the tested expansion's 29 release paths: `categories.json`, `collections.css`, `main-v2.js`, and 26 hash-named JPEG derivatives. Twenty-eight match the exact donor bytes. The CSS is the donor plus the owner's one-declaration follow-up: `#viewer>p:last-child{grid-row:4;text-align:center}`. It centers the full-file link away from the Pixpa Exit controls, verified independently at 844×390, 320×568, 390×844 and 1440×1000. The image-loading change sets lazy loading before the image source. The preceding CSS change fits the enlarged photograph and its controls inside short viewports without nested viewer scrolling.

The four categories contain **82 entries: 17 Branding, 24 Families, 33 Headshots and 8 Coastal**. All 69 old entries retain complete metadata, category membership and relative order. All old photographs and URLs remain; no original is overwritten, removed or recompressed. The 26 new files are 13 full photographs plus 13 thumbnails, totaling **20,065,602 bytes**.

The exact sanitized `docs/expansion-assets.json`, `docs/expansion-baseline.json`, `scripts/verify.mjs`, and `public/expansion-review.json` accompany the source so `npm run check` can verify the reviewed identities and old baseline. These four files are **not in the hosted asset map**. `expansion-review.json` retains the donor's historical "Private local review only" label; it is a test fixture, not the current publication record. Review UI, import tooling and private provenance are not included.

`runtime/` still contains 12 hosting overlays. Only `categories.json`, `collections.css` and `main-v2.js` change in this expansion. All three match exact version 9 browser-fetched public bytes; categories and main are unchanged from version 8. Path adapters preserve the existing V1 media URLs and use V2 only for the new expansion files. The other nine overlays are untouched. The full original pier photograph and 121 accepted video frames remain unchanged.

`pixpa-page-code.html` remains the exact persisted 3,900-byte wrapper, SHA-256 `3618931079d93eed39867d54ae242c1808390a9bafbaf95a8b57fd51c40e6ab9`. It embeds the full-height gallery with two clear 48px exit links. The expansion does not require a new Pixpa Page Code or Shared Body save. Solid reduced-transparency, increased-contrast and forced-colors fallbacks are intentional accessibility behavior.

## Rebuild and review locally

From the repository root with Node.js 20 or newer:

```sh
npm run check
node integration/pixpa-v2/build.mjs --check
node integration/pixpa-v2/build.mjs --output /absolute/path/to/new-gallery-build
python3 -m http.server 4330 --bind 127.0.0.1 --directory /absolute/path/to/new-gallery-build
```

Then open `http://127.0.0.1:4330/pier-v2-20260910/`. Choose an unused port. `CHECK_PORT` selects an unused temporary port for `npm run check`. The builder refuses an existing output directory and checks every source and copied output hash. It never publishes, changes the standalone files or starts a server automatically.

`asset-map.json` maps **277 unique URLs**: 147 unchanged accepted non-photo files, 12 hosting overlays, 26 new expansion JPEGs, and 92 reused original photographs. Exactly 248 old rows are unchanged, three old text-file rows have updated hashes and byte counts, and 26 rows are new. All 251 previous URLs remain.

The 92 reused photographs intentionally remain under `/pier-v1-20260909/media/`; the 185 other files are under `/pier-v2-20260910/`. A fresh host needs both generated directories. V1 here means byte-verified reuse of photographs, not an old runtime or an expiring upload. Do not delete those paths or blindly replace every V1 prefix. This builder reproduces the current gallery and its dependencies, not unrelated historical pages on the same hosting account.

## First-expansion evidence

`evidence/first13/` separates local preparation from actual public evidence. See [PUBLIC-ACCEPTANCE.md](PUBLIC-ACCEPTANCE.md) for the release decision. Local preparation records follow:

- `source-transport.json`: exact donor and host identities; 69 preserved entries; 13 additions; 26 derivative hashes; 248 unchanged mapping rows and all 251 retained URLs.
- `npm-start-http.json`: actual local `npm start` served the exact 82-entry categories bytes and all 26 new JPEGs with matching bytes/hashes. `rebuild-proof.json` records the actual 277-source and fresh 277-output build, totaling 193,348,761 file bytes after the 18-byte centered-footer correction. The prior 193,348,743-byte build is retained as history.
- `local-browser-qa.json`: the release owner's local hosted-copy browser results. All 13 new desktop images opened at their native dimensions with `object-fit: contain`, zero horizontal overflow and no inner viewer scrolling. Four phone category representatives passed enlargement, closing and focus return.
- `candidate-landscape-viewer-fixed.png`: at 844×390 the whole Coke photograph, navigation and full-file link fit in the viewport. JSON records image bottom 332.70px inside viewer bottom 382.20px, with equal viewer scroll/client heights.
- The Branding/Coastal desktop and Families/Headshots phone screenshots show actual local full-image renders from each collection, not contact-sheet simulations. They are image/fit evidence, not an assertion that the enlarged-photo viewer is transparent.
- `candidate-phone-walk.png`: the local coarse-pointer aisle after a genuine compositor touch gesture. JSON records scroll Y 0→473 and progress 0→0.06227, with zero horizontal overflow.
- Local System reduced-transparency plus reduced-motion gives solid `rgb(16, 44, 64)` controls with no blur; explicit normal Clear appearance gives transparent controls with `saturate(1.08)`. These are browser-emulated settings, not physical-phone certification.

The independent host-file audit checked 559 unchanged old files, the three exact allowed changes and all 26 new derivative hashes/dimensions. Its local HTTP pass fully decoded all 114 distinct thumbnail/full image responses. Twenty-three inherited full-image metadata sizes differ from decoded pixel dimensions, but all aspect-ratio differences are within 0.2% rounding tolerance (maximum 0.0625%); their accepted metadata and pixels were preserved.

Actual public records include `independent-public-image-qa.json` (114 decoded URLs and 13 actual enlargements), `live-owner-pathways.json` (desktop and compositor-touch walking, collection/Inquiry/Main navigation), `footer-center-public.json` (public hashes and corrected geometry), and `independent-footer-version9-qa.json`. The live screenshots are individually labeled; no local screenshot is promoted to public proof. The earlier stale publisher landscape capture and mixed-pointer phone-menu capture are excluded. The independently verified `independent-footer-fixed-844x390.png` supplies the accepted landscape proof.

## Previous live evidence and limitations

The pre-expansion evidence remains in `evidence/` for the already published 69-entry version 7. It is historical baseline evidence, not proof of the version 8 expansion or version 9 correction:

- `seven-width-walk.json`, `compositor-touch.json` and `independent-native-wheel.json`: direct/embedded native Chrome walking, including forward/reverse and a browser-emulated touch swipe.
- `final-public-wrapper-qa.json`: Return reached Home and browser Back restored the exact prior gallery progress after the wrapper update. The Back API wait timed out after navigation; a fresh state established the result without a duplicate Back command.
- `public-glass-conditions.json` and explicitly normal screenshots: clear controls with the photograph visible; the default test machine instead requested reduced transparency and correctly received the solid fallback.
- `host-html-normalization.json`: non-HTML assets matched exact bytes; two HTML responses contained the hosting provider's sole injected Cloudflare script and matched after that documented normalization.

The IAB did not reliably forward automated wheel input into the cross-origin child; installed Chrome native wheel did. Pointer and media emulation may affect a parent without its cross-origin iframe, so mixed states are not physical-phone proof. No physical iPhone/iPad, mobile Safari, hyper-realistic reconstruction or final video-tracking registration claim is made. Generated video remains opt-in and under visual review. User-controlled walking remains available under System Reduce Motion; explicit Still offers Start walk.

The existing external Inquiry form's `example.com` legal links remain an unrelated, unresolved limitation. A successful Plan Your Portrait navigation or field-focus check does not mean that the entire Inquiry service or its legal links have been repaired. No form submission is part of this expansion's test.

For any future Pixpa edit, read and preserve the **current** field first. This checked-in wrapper is evidence, not continuing permission to overwrite a changed page. Home, Shared Body, other routes and collaborator PR2 remain outside this expansion.

New sheen work and the future 12-photo batch remain separate, unshipped work. They are absent from this source handoff, derivative manifest and 277-file integration build.

## Rollback and capacity

The bounded host rollback is version 7 at source `a3e11d42389229d67913934f9e82a845e605620d`; keep its existing photo paths. The expansion uses the same V2 URL and unchanged Pixpa wrapper.

The release owner measured the version 9 package at **261,251,340 compressed bytes / 268,013,056 unpacked archive bytes**, leaving **422,400 bytes** below the 256 MiB unpacked limit. Archive SHA-256: `539dbaa689accc2f603be472ea925a84b51c1124ca2d1a714a5a205a70cdcf16`. This is not room for an unmeasured second photo batch. Gallery-only rebuild output is smaller than the complete hosting archive; do not confuse their sizes or treat a successful local build as publication proof.
