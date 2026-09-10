# Pixpa V2 integration: 82 photographs and optical-glass sheen

This is the reproducible source handoff for the current 82-entry photographic pier gallery. Sites version 10 adds scroll-responsive optical-glass sheen to the existing controls and two Pixpa exit links. The accepted aisle, ten easels, photograph bytes, category order and centered full-image footer are unchanged from version 9. The first expansion's 13 reviewed photographs remain included; the separate 12-photo/94-entry candidate is excluded.

- [Public Pixpa gallery](https://kiyonocreativelab.com/pier-gallery?release=sheen-live-20260910)
- [Direct gallery](https://kiyono-coastal-gallery.kiyonophotography.chatgpt.site/pier-v2-20260910/?release=sheen-live-20260910)
- Current hosting source: `5ad8f30538858534937cbaa1a2249db63dc3fcd6`, **Sites version 10**, deployment `SUCCEEDED` at `2026-09-10T16:55:59.161188Z`. [Sheen release](SHEEN-RELEASE.md) records source hashes, actual live checks, persisted Pixpa fields and rollback boundaries.
- Previous 82-photo shared handoff: `e9bc20bdd2f55c070070111a6128be214fc812ef`.
- Previous shared handoff: `0569af6934e89acafcfc12b3bdf337c6bcacf4ee`.
- Accepted original standalone source: `78b36c1f5c4f0eadac850d4f00ab9761d4e05e3b`.
- Tested expansion donor: `09ce87a0e41630865b8c94550b2cd1d1c70923d3`.
- Historical hosting source: `4c8bd39a65c7ebb29213d14d63f144ff62d318b3`, Sites version 9, deployed at `2026-09-10T16:05:32.388978Z`. The first expansion was version 8 at `843390d75c8bb10c6d6ff9981099acc1ec05908e`; version 9 added only the footer-centering correction. [Public acceptance](PUBLIC-ACCEPTANCE.md) distinguishes the current sheen checks from the historical image/walk and footer checks.

You do not need access to the private hosting repository to rebuild these gallery files. Public deployment and GitHub source delivery are distinct verification steps; the owner verifies the final commit, push and remote branch separately. Nothing here merges the separate collaborator PR.

## Current sheen change and preservation boundaries

The version 10 gallery change consists of `glass-sheen.js`, `glass-sheen.css`, and one import/install pair in `main-v2.js`, with the existing hosted-path adapter retained. It adds **10,080 source bytes and two asset paths**. Reflection layers are confined to controls; no photograph or printed canvas receives a sheen overlay. The live independent pass covers desktop and emulated-phone forward/reverse input, idle stability, full-image viewing and exact return, footer clearance, exits and accessibility preferences. See [SHEEN-RELEASE.md](SHEEN-RELEASE.md) for the exact tested scope.

`pixpa-page-code.html` is now the exact persisted **6,805-byte** gallery wrapper, SHA-256 `f9774d3dfbfd0f99f366a065538d83580b959b846ca4834cef0f78daeef5b17d`. It retains the full-height gallery and two clear 48px exit links, adding their bounded reflection bridge. Pixpa removed only the staged fragment's terminal newline.

The separate native optical-runtime patch has been saved and its Shared Body field reread after reload with the exact accepted hash. **Independent live acceptance passed on Home and Families at 1440×900 and 390×844**, and fresh source checks found the exact unique script on seven public routes. The native and gallery appearance contracts remain distinct; this is not full material parity. `patch-native-menu-sheen.mjs` provides a local, exact-baseline-only reproduction helper; the full Shared Body is intentionally not included. It cannot contact or save to Pixpa. Read the exact scope and limitations in [SHEEN-RELEASE.md](SHEEN-RELEASE.md) before use.

## First-expansion source history retained in this release

At version 9 the standalone `public/` tree received the tested expansion's 29 release paths: `categories.json`, `collections.css`, `main-v2.js`, and 26 hash-named JPEG derivatives. Twenty-eight matched the exact donor bytes. The CSS was the donor plus the owner's one-declaration follow-up: `#viewer>p:last-child{grid-row:4;text-align:center}`. It centers the full-file link away from the Pixpa Exit controls, verified independently at 844×390, 320×568, 390×844 and 1440×1000. The image-loading change sets lazy loading before the image source. The preceding CSS change fits the enlarged photograph and its controls inside short viewports without nested viewer scrolling. Version 10 retains these changes and adds the sheen import/install pair to the main script.

The four categories contain **82 entries: 17 Branding, 24 Families, 33 Headshots and 8 Coastal**. All 69 old entries retain complete metadata, category membership and relative order. All old photographs and URLs remain; no original is overwritten, removed or recompressed. The 26 new files are 13 full photographs plus 13 thumbnails, totaling **20,065,602 bytes**.

The exact sanitized `docs/expansion-assets.json`, `docs/expansion-baseline.json`, `scripts/verify.mjs`, and `public/expansion-review.json` accompany the source so `npm run check` can verify the reviewed identities and old baseline. These four files are **not in the hosted asset map**. `expansion-review.json` retains the donor's historical "Private local review only" label; it is a test fixture, not the current publication record. Review UI, import tooling and private provenance are not included.

`runtime/` still contains 12 hosting overlays. The first expansion changed only `categories.json`, `collections.css` and `main-v2.js` in that directory. They matched version 9 browser-fetched bytes at that release; version 10 subsequently adds only the sheen import/install pair to `main-v2.js`. Categories and the centered collections CSS remain byte-identical to version 9. Path adapters preserve the existing V1 media URLs and use V2 for expansion and sheen assets. The other nine overlays, original pier photograph and 121 accepted video frames remain unchanged.

The first expansion used the historical 3,900-byte wrapper, SHA-256 `3618931079d93eed39867d54ae242c1808390a9bafbaf95a8b57fd51c40e6ab9`, without a new Pixpa Page Code or Shared Body save. Version 10's separate saves are recorded above and in the sheen release. Solid reduced-transparency, increased-contrast and forced-colors fallbacks remain intentional accessibility behavior.

## Rebuild and review locally

From the repository root with Node.js 20 or newer:

```sh
npm run check
node integration/pixpa-v2/build.mjs --check
node integration/pixpa-v2/build.mjs --output /absolute/path/to/new-gallery-build
python3 -m http.server 4330 --bind 127.0.0.1 --directory /absolute/path/to/new-gallery-build
```

Then open `http://127.0.0.1:4330/pier-v2-20260910/`. Choose an unused port. `CHECK_PORT` selects an unused temporary port for `npm run check`. The builder refuses an existing output directory and checks every source and copied output hash. It never publishes, changes the standalone files or starts a server automatically.

`asset-map.json` maps **279 unique URLs totaling 193,358,841 file bytes**: the version 9 set of 277 paths plus two sheen resources, with the existing main-script row updated. The set contains 149 accepted non-photo files, 12 hosting overlays, 26 expansion JPEGs and 92 reused original photographs. All previous URLs remain. The historical first-expansion transition preserved 248 old rows, updated three text rows and added 26 JPEG rows; those figures describe version 9, not the subsequent sheen change.

The 92 reused photographs intentionally remain under `/pier-v1-20260909/media/`; the 187 other files are under `/pier-v2-20260910/`. A fresh host needs both generated directories. V1 here means byte-verified reuse of photographs, not an old runtime or an expiring upload. Do not delete those paths or blindly replace every V1 prefix. This builder reproduces the current gallery and its dependencies, not unrelated historical pages on the same hosting account. It does not apply the Pixpa wrapper or native Shared Body patch.

## Historical first-expansion evidence

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

For any future Pixpa edit, read and preserve the **current** field first. This checked-in wrapper and exact-baseline helper are evidence, not continuing permission to overwrite a changed page. The separate native Shared Body patch is bounded to its existing optical runtime; Home page code, other page-code fields and collaborator PR2 are not changed by this source package.

Sheen is included in this version 10 handoff. The future 12-photo/94-entry batch remains separate and absent from the derivative manifest and 279-file integration build.

## Rollback and capacity

For the current sheen release, host rollback is version 9 at `4c8bd39a65c7ebb29213d14d63f144ff62d318b3`; the gallery wrapper and native Shared Body have distinct recorded baseline hashes. See [SHEEN-RELEASE.md](SHEEN-RELEASE.md) before any authorized rollback. The version 10 hosting archive is **261,255,113 compressed / 268,028,928 unpacked bytes**, leaving **406,528 bytes** below 256 MiB. Its SHA-256 is `d540e308a003b9e583cd5b5def22000a983d20919957014fb5e45b8ba8cd50e7`.

Historically, the bounded first-expansion rollback was version 7 at source `a3e11d42389229d67913934f9e82a845e605620d`; that expansion used the same V2 URL and unchanged wrapper. Keep existing photo paths in any rollback.

The release owner measured the version 9 package at **261,251,340 compressed bytes / 268,013,056 unpacked archive bytes**, leaving **422,400 bytes** below the 256 MiB unpacked limit. Archive SHA-256: `539dbaa689accc2f603be472ea925a84b51c1124ca2d1a714a5a205a70cdcf16`. This is not room for an unmeasured second photo batch. Gallery-only rebuild output is smaller than the complete hosting archive; do not confuse their sizes or treat a successful local build as publication proof.
