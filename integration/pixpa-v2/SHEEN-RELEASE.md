# Optical-glass sheen release, 2026-09-10

## Current state and scope

**[Certain] The published 82-photo pier gallery and its two outer Pixpa exit reflections passed independent live acceptance.** Hosting source is `5ad8f30538858534937cbaa1a2249db63dc3fcd6`, Sites version 10; deployment status was `SUCCEEDED` at `2026-09-10T16:55:59.161188Z`.

- [Public Pixpa gallery](https://kiyonocreativelab.com/pier-gallery?release=sheen-live-20260910)
- [Direct hosted gallery](https://kiyono-coastal-gallery.kiyonophotography.chatgpt.site/pier-v2-20260910/?release=sheen-live-20260910)
- [Independent gallery acceptance](evidence/sheen/independent-gallery-live.md)
- [Actual gallery browser probes](evidence/sheen/independent-gallery-live.json)

The separate native-menu patch is **saved, with exact Shared Body bytes confirmed after editor reload, and independently accepted live on Home and Families at 1440×900 and 390×844**. Fresh source-only checks also confirm the exact unique script on seven routes. The native and gallery preference contracts remain distinct; this acceptance does not claim complete visual/material parity or a rendered seven-route audit.

This source package does not merge either PR, publish itself, modify unrelated page-code fields, submit an inquiry or include the separate 12-photo expansion. GitHub delivery requires the owner's distinct commit, push and remote readback verification.

## Exact gallery delta and preserved content

The tested sheen donor is `575723f6ebdcd8a5350590a35afae3226093e50f`. The bounded gallery change adds `public/glass-sheen.js`, `public/glass-sheen.css`, and one import/install pair to `public/main-v2.js`. The hosted overlay retains its existing path adaptations and receives the same import/install change. Total gallery source increase is **10,080 bytes**, including two additional asset paths.

The gallery retains **82 entries: 17 Branding, 24 Families, 33 Headshots and 8 Coastal**. All category data, original and first-expansion photograph bytes, relative order, ten easel slots, scene/camera files, 121 accepted video frames and version 9's centered full-image footer remain unchanged. Reflections decorate existing glass controls; no photograph, enlarged image or printed canvas receives a sheen layer.

`asset-map.json` now contains **279 unique paths / 193,358,841 file bytes**. It preserves all 277 version 9 paths, updates the main-script row and adds the two sheen resources. The 92 reused original photographs remain at their existing V1 media paths; 187 paths are under V2. Use the [README rebuild instructions](README.md#rebuild-and-review-locally) to reproduce this gallery from shared source. The gallery builder neither applies Pixpa fields nor includes unrelated historical hosting pages.

The independent live fetches returned HTTP 200 and these exact SHA-256 values:

| Hosted file | Bytes | SHA-256 |
|---|---:|---|
| `glass-sheen.js` | 8,280 | `2600e91b10d6483b876821640dbb15296b6dbda95ece0d58d8103d3ce51fa9a8` |
| `glass-sheen.css` | 1,706 | `acb356d387b6896cfc71602b4d89813854f99246ffa6361fc98d0a3ab83d0612` |
| `main-v2.js` | 7,421 | `67651d17d4754bb571dc91b7766a556122804f9ec748486c8f7ece19404bf637` |
| `collections.css` | 9,537 | `a38976fef5b5e845c014cd8c977272b61600a08b99b86e9a69262ed39c10e927` |
| `categories.json` | 35,246 | `3a8ea3a46ee82f143aecd8e9f253939f2c70b759b2827b392286299f18108ba9` |

## Actual live acceptance

The independent reviewer used a fresh installed-Chrome visit to the public page, without fixture responses, interception, source edits or publication. The [live report](evidence/sheen/independent-gallery-live.md) and [raw JSON](evidence/sheen/independent-gallery-live.json) separate measured behavior from scope limits.

- Desktop 1440×1000: 22 native-wheel inputs, 14 forward and 8 reverse, moved inner scroll from 0 to 1120 and back to 480. Child reflection and both outer exit reflections followed and reversed. Outer-page scroll remained zero.
- Phone 390×844: the actual iframe reported coarse pointer and no hover. Native touch moved inner scroll from 2349.5 to 2649.5 and back to 2304.5. Both outer reflections followed; horizontal overflow and parent scroll were zero.
- Idle: child frame count remained 169 across six observations, with `scheduled=false`; child phase/opacity and both outer transforms/opacities remained unchanged. This is an idle probe, not a frame-rate certification.
- A visible easel, category selection, Pink-ball enlargement, Next, Previous, Close and Back restored exactly **Y 2304.5 / progress 0.3033833596629805**. The full photograph decoded at 2133×3200, with `object-fit:contain`, opacity 1, no filter and zero photo-layer reflections.
- Viewer checks at 390×844, 844×390 and 1440×1000 found zero dialog scrolling, zero horizontal overflow, a centered full-file link and zero overlap with either 48px outer exit. The stale first landscape compositor capture was replaced before acceptance.
- Solid, reduced motion, reduced transparency, increased contrast and forced colors each disabled the child sheen and both parent exit reflections. Disabled scrolling preserved child frame count 808. System reduced transparency retained the intended opaque fallback. Clear was restored afterward.
- Actual direct-gallery and main-site exit clicks reached their intended destinations. Gallery browser errors: zero. Browser media/device overrides and temporary QA tabs were removed after the checks.

The [desktop-forward image](evidence/sheen/live-desktop-forward.png) and [phone-forward image](evidence/sheen/live-phone-forward.png) are the release owner's actual public captures. The independent [390px viewer](evidence/sheen/live-viewer-390x844.png), [844px landscape viewer](evidence/sheen/live-viewer-844x390.png) and [reduced-transparency fallback](evidence/sheen/live-reduced-transparency.png) have their own provenance. The solid fallback image is deliberately labeled and is not normal Clear-mode proof. The original independent motion recordings used timestamped screenshot frames without interpolation or generated imagery; this compact source packet links the report and raw motion states rather than claiming to include every recording frame.

The complete 114-image decode / 13-addition enlargement checks belong to the earlier expansion record in [PUBLIC-ACCEPTANCE.md](PUBLIC-ACCEPTANCE.md). Version 10 preserved those photo bytes and rechecked the bounded sheen/viewer paths above; it does not claim a fresh full-image sweep.

## Persisted Pixpa gallery wrapper

`pixpa-page-code.html` preserves the full-height gallery, links, focus behavior and two 48px exits, adding an `aria-hidden`, pointer-none reflection bridge. The bridge validates the exact child origin and iframe window; it has no independent idle animation loop. The child sends bounded reflection state, not photograph or visitor data.

| Wrapper state | Bytes | SHA-256 |
|---|---:|---|
| Previous persisted baseline | 3,900 | `3618931079d93eed39867d54ae242c1808390a9bafbaf95a8b57fd51c40e6ab9` |
| Staged sheen candidate | 6,806 | `edb2d2248d2f385e0bd5a5e99326a055cc4190f0b4dd04ca60d299267423cfc7` |
| Saved and reloaded field | 6,805 | `f9774d3dfbfd0f99f366a065538d83580b959b846ca4834cef0f78daeef5b17d` |

The candidate and persisted file were byte-compared: **only the single terminal LF was removed**. No other byte differs. The independently verified gallery result covers this published wrapper, not merely its staged version.

## Separate native-menu patch

The native patch changes one calculation inside the existing `kcl-b-optical-glass-runtime-20260904` script. Fixed navigation surfaces derive their reflection phase from actual page scroll; other surfaces keep the existing geometry-based calculation. It does not pin the native header, replace Home content or add a second runtime.

| Native source identity | Bytes | SHA-256 |
|---|---:|---|
| Previous Shared Body | 286,002 | `c29620c604d825e315522b9edbc08b7189d6ea63ac384d6130b5cb4823417484` |
| Saved/reloaded Shared Body | 286,466 | `3b538d6cbbdf38d037143bac07bf6b80daabd60db42b9b3452b43cc4e2bc76d9` |
| Resulting optical-runtime script | See bounded patch | `93d81d23e261dc3b72db526231c9d328e479942ebb685142f456e63849bf40d7` |

**[Certain] The bounded native-menu live check passed**, independently of the save and gallery checks. The [native live report](evidence/sheen/native-menu-live.md) covers Home and Families, each at 1440×900 and 390×844. Fresh public DOMs contained exactly one optical runtime with the accepted script hash. The [source and persistence record](evidence/sheen/live-source-and-persistence.json) additionally records HTTP 200 and that unique exact script on Home, Families, About, Portfolio, Content Creation, Inquiry and Professional Headshots; those seven source probes do not certify all seven pages' rendered behavior.

Actual compositor wheel gestures drove down/up document scroll with both open and closed menus. Both tested pages/widths showed control reflections during movement, zero horizontal overflow, zero settled opacity and `will-change:auto` after idle. The desktop phase wraps were fully outside each overflow-hidden clip, without a visible reset flash. Escape closed the menu and returned focus to its toggle; Enter, Tab and actual Home/Families links passed. The [Home desktop](evidence/sheen/home-desktop-open-down.png), [Home portrait](evidence/sheen/home-portrait-open-down.png) and [Families portrait](evidence/sheen/families-portrait-open-down.png) images are actual independent public captures, not fixture renders.

The known **390px Home masthead scroll-out remains**: at page Y 242, menu top was −233. The phase-calculation patch adds visible sheen while that existing header is visible; it does not repair its positioning. Families at 390px did not exhibit the same limitation in the tested range. This is bounded sheen acceptance, not a declaration that all native navigation geometry is repaired.

The native appearance contract was tested on live Families. Reduced motion, Solid, increased contrast and forced colors suppressed sheen. **Reduced transparency with System selected produced Solid and zero sheen; reduced transparency with an explicit Clear choice retained Clear and active sheen**, preserving the existing visitor-choice contract. The [System reduced-transparency image](evidence/sheen/pref-system-reduced-transparency.png) is a labeled solid fallback. Gallery sheen instead disables under reduced transparency even with Clear selected. Do not describe these two implementations as identical preference behavior or complete material parity. Native media/device overrides were cleared and the original Clear choice was restored after tests. No forms were submitted. The independent native packet consists of its sanitized report and selected screenshots; it does not claim an accompanying raw native JSON capture.

`patch-native-menu-sheen.mjs` reproduces this one change offline from the exact prior Shared Body hash. Supply an authorized local baseline and a new absolute output filename:

```sh
node integration/pixpa-v2/patch-native-menu-sheen.mjs /absolute/current-body.html /absolute/new-candidate.html
```

It rejects another baseline or an existing output file, checks the original script identity and final body hash, and never contacts or saves to Pixpa. The complete Shared Body is intentionally absent from this repository. The already patched live body will correctly fail the old-baseline guard; do not reapply it or overwrite later work. Fresh authority and a current-field capture are required before any further live change.

## Capacity, rollback and remaining boundaries

The complete version 10 hosting archive is **261,255,113 compressed / 268,028,928 unpacked bytes**, SHA-256 `d540e308a003b9e583cd5b5def22000a983d20919957014fb5e45b8ba8cd50e7`. It leaves **406,528 bytes** below the 256 MiB unpacked limit. The smaller 193,358,841-byte gallery map and the full hosting archive have different scopes. This remaining space does not authorize or accommodate an unmeasured photo batch.

The immediate host rollback is version 9 at `4c8bd39a65c7ebb29213d14d63f144ff62d318b3`. The gallery wrapper and native Shared Body have distinct baselines in the tables above. A host rollback does not revert either Pixpa field. Preserve existing photo URLs and capture the current fields before any separately authorized rollback.

The future 12-photo/94-entry candidate remains separate and requires its own storage route and release verification. The external Inquiry form's existing Privacy/Terms destinations at `example.com` remain unresolved; no form was submitted. Installed-Chrome desktop and phone emulation do not certify a physical iPhone/iPad, mobile Safari, FPS performance, hyper-realistic reconstruction or final generated-video registration. Those limits are unchanged by the sheen acceptance.
