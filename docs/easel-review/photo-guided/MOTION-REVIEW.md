> Portable copy of the independent local review. Links below point to curated recordings, screenshots and compact evidence; full raw reports remain locally preserved and their hashes are recorded. The original review SHA-256 is `89910d75cd27713c0f3701d28a4b0bb50660085dde4746718590f1279e4b0415`.

# Final guided-gallery motion review

**Recommendation: retain the final guided candidate over the accepted `004c282` scene for this photographic gallery.** [Certain] The reviewed views preserve the original photographed timber, barnacles and surf while removing the accepted scene's visible foot partition. The final phone sequence is less rushed than `native-motion-v1`. I found no concrete visual blocker in the sampled evidence.

This is a bounded local design recommendation. It does not establish physical-phone performance, every-frame playback smoothness, motion comfort for every viewer, or a measured reconstruction of the pier. Root's separate coverage and functional checks remain the authority for those tested behaviors.

## Scope and method

Only this report was written in the final evidence directory. No app/docs source, original images, browser state or GPU render was changed. Video frames were decoded into temporary diagnostic sheets outside the project.

| Recording | Encoded dimensions/rate | Duration | Sequential visual sampling |
|---|---|---:|---|
| [Final desktop](desktop-native-forward-reverse.webm) | 1440×900, 25fps | 42.64s | Every 1 second across the recording |
| [Final phone](phone-native-forward-reverse.webm) | 390×844, 25fps | 37.32s | Every 0.5 second across the recording |
| [Accepted desktop](accepted-desktop-native.webm) | 1440×900, 25fps | 40.84s | Every 1 second across the recording |
| [Accepted phone](accepted-phone-native.webm) | 390×844, 25fps | 27.92s | Every 0.5 second across the recording |

Native-resolution late-forward PNGs and the entry/returned PNGs supplement these ordered samples. The [v1 review](VERIFICATION.md), its ordered video samples and trace measurements provide the earlier pacing comparison.

The accepted and final recordings use the same scripted gesture cadence, but their cameras, gallery placements, phone scroll ranges and distance mappings differ deliberately. Comparisons are by normalized walk stage and visible artwork, not by matching video timestamps or claiming a matched-camera pixel A/B. I did not watch every encoded frame at native playback speed.

## Original photographic atmosphere and contact

The accepted sequence produces much stronger movement of the pier itself. During its middle/end progression, the roof and foreground posts expand and skew across the proxy surfaces; the barnacled feet meet a conspicuous flattened/sloping lower band. This is especially clear in the [accepted late-forward desktop](accepted-desktop-late-forward.png) and [phone](accepted-phone-late-forward.png) views.

In the [final desktop](final-desktop-late-forward.png) and [phone](final-phone-late-forward.png), the photographed timber, original sky openings, irregular sleeves and surf remain one coherent composition. The previously sliced feet remain connected to their shafts. I found no detached toe, new opaque water shelf, or drifting local photo patch in the ordered forward or reverse samples. The scene retains the source photograph's under-pier shade and color rather than substituting plain constructed surfaces.

There is a deliberate tradeoff: the 80m photographic backdrop has shallow whole-image parallax while the easels advance substantially. It reads as dimensional artwork within photographic scenery. The accepted proxy scene suggests more travel through the pier structure, but also exposes its texture/depth mismatch. For preserving this photograph while browsing the art, the final balance is preferable; it must not be presented as independent movement past recovered 3D pier posts.

The final near-water composite remains visibly active while source timber stays still. The distant photographed breaker is largely static, and easel reflections remain subtle, approximate planar reflections. I found no new visible reflection gap or source-foot overdraw requiring another contact patch. Fine shimmer or transient reflection artifacts between sampled frames remain unexcluded.

## Return stability and clock separation

The final desktop and phone traces both return to progress 0, distance 0 and their initial viewing direction. Their water phases advance from 1.80592→32.738 and 1.46672→28.67888 respectively.

Independent lossless entry/returned PNG comparisons reproduce zero RGB change in these fixed screenshot regions:

| Final region, original screenshot pixels | Mean / maximum absolute RGB difference |
|---|---:|
| Desktop source crossbeam: x400–1049, y200–399 | 0 / 0 |
| Desktop left barnacle interior: x110–144, y730–769 | 0 / 0 |
| Desktop right barnacle interior: x1220–1249, y735–764 | 0 / 0 |
| Desktop actual easel shaft: x306–314, y760–779 | 0 / 0 |
| Phone upper roof: x130–249, y30–99 | 0 / 0 |
| Desktop water/effects: x520–599, y860–898 | 6.20235 / 42 |

**[Certain] At these two separated clock phases and matching poses, the sampled source timber, barnacles and actual shaft are identical while water changes.** This is strong local evidence against clock-driven timber wobble, not a whole-frame or all-time guarantee.

## Phone turning and forward tempo

The final phone sequence gives the first right-hand family print, headshot, under-pier print and red-tray scene longer centered intervals than v1. They remain recognizable across more adjacent 0.5-second samples rather than appearing only briefly between turns. The final pair is approached, both sides are visited, and the reverse sequence retraces those views without a source-image jump.

| Trace fact, same scripted gesture cadence | v1 phone | Final phone |
|---|---:|---:|
| Scroll range | 4,642px | 7,596px |
| Trace duration, round trip | 21.9595s | 33.8987s |
| Forward peak sampled yaw rate | 147.43°/s | 110.75°/s |
| Reverse peak sampled yaw rate | 174.23°/s | 109.15°/s |
| Forward 95th-percentile yaw rate | 117.00°/s | 97.97°/s |
| Reverse 95th-percentile yaw rate | 151.18°/s | 92.22°/s |

These are sampled camera-trace rates, not a comfort or device-performance measurement. The visually longer viewing intervals support the pacing change independently of those numbers.

The advance/settle rhythm remains visible: short faster transits alternate with slower inspection portions. The mapping is monotone, not constant-speed walking. Desktop retains its centered yaw and the same 4,950px scroll range, so its pacing is materially unchanged from v1. I would retain this current balance for review rather than reopen the geometry or add another timer; finer pacing decisions need actual interaction at the user's chosen scroll speed.

Outgoing artworks are cropped during side turns, and prior rows grow beyond the viewport when passed. The centered moments are more usable than in the accepted sequence, where the headshot and several later artworks cross the phone edge rapidly. I do not use sparse video samples to certify every complete original front; root's independent ten-photo coverage test must support that claim.

Both versions include a pre-ready fallback-to-3D framing change. Both also allow ordinary page scrolling beyond the gallery endpoint and back. In the final late-phone PNG, the scene has begun moving out of the page and the top Menu is clipped by that page motion; this is not an exposed photograph border within an active camera view. Loading and page-exit behavior should not be mistaken for a pier-transform discontinuity.

## Technical evidence and limits

The [final capture results](native-evidence.json) record 632 desktop and 555 phone samples, no JS errors and nine stable served files. Independent trace checks find monotone 0→7m→0 traversal with no distance steps opposite to the current direction. The [accepted capture results](accepted-native-evidence.json) record 604/396 samples, no JS errors, eight stable files and 0→7.5m→0 traversal. The accepted baseline has not been modified by this review.

The unchanged hero file was independently hashed in both checkouts: `cfa91375ee89923fdd0230a95aba042f1d4a8e698e70735de94f69fe20569ee3`. Thus the visual improvement is not evidence of newly painted or generated source-image content.

No physical device was tested. No native-rate motion comfort assessment or full frame-pacing analysis was performed. These limits qualify the recommendation; they are not claims of an observed defect. No additional visual contact correction is indicated by the reviewed recordings.

## Exact recorded source identity

### Final candidate

| Served file | SHA-256 |
|---|---|
| `/main-v2.js` | `9114b28935e50f624050966032e1747a8e3128f47eec3cda66d47b588d048d6a` |
| `/collections.js` | `f67a920331b8619fd75716e80a4effe3e9d5558261a5448823b43142e0b14681` |
| `/aisle/photographic-environment.js` | `b02bb20191720694315f7935c178a6e25183b409044eda882d305bd13da9f13a` |
| `/aisle/physical-display.js` | `b789013835bbc24ade3f3750b4684241203d538afdfff0166dd4deb459924caa` |
| `/aisle/gallery-layout.js` | `8dce2b4b907ba810162c99b902fe851fa163b5bbbea65124ac484ac3d2204b67` |
| `/aisle/photographic-aisle.js` | `7574db834454c64a7af710ba0cdc93372872d471c6414ca8d3fa3b559706f0be` |
| `/aisle-integration.js` | `707bb6b86f1314de8f9e69df7bd0fd8ba6b84ed6af8acef8a5fa48b540af09d8` |
| `/aisle/aisle.css` | `c7d10efe666e36b89872b9b6ea9c45d8bd915a834c8ce5ff3d622b964d6b652e` |
| `/aisle/water-surface.js` | `cacde7ea838c518651af338b4c6518d149d2d9472d057ff2811f2f65910b95d5` |

### Untouched accepted 004c282

| Served file | SHA-256 |
|---|---|
| `/main-v2.js` | `f58bd63fcae775ec347282362fdff89426e6d78a01992d54673359f56db8e65d` |
| `/collections.js` | `fc5839be42c6d9ccf5ffb777972cd28c31f4e32b198564fbc7a42721ad79711c` |
| `/aisle/photographic-environment.js` | `fda35aca98b47b39cc27e4d46cd6ef465bbe7bd613ba97d56c98c714d398d3cf` |
| `/aisle/physical-display.js` | `6d1600be25caf132ef32c1ab2fca68627d6e332af75c6880809702c8946385a6` |
| `/aisle/gallery-layout.js` | `091d8000f0809a585004008437190cc582da4ce40f9353fd1b755284df3907f0` |
| `/aisle/photographic-aisle.js` | `bc1efccc05290fe146e3182f249bfe4c169de749535c111e2a01db76f5df7345` |
| `/aisle-integration.js` | `f39c03df335dbc94019644b7c1e542280fc9efd4df82953a4ded5b642d9e45a4` |
| `/aisle/aisle.css` | `2feb0a1cb87d2ccf6b9b6f2ca105700607dfa73bbd301113a4d74ff242833876` |
