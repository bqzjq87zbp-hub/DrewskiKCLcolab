> Historical checkpoint evidence. Preserve these results with their stated source versions; they do not certify the current photograph-guided implementation. See [current review](REVIEW.md) for the active method and verification. Proposed next steps below describe that earlier stage.

# Browser acceptance evidence

Initial checkpoint status: PASS

661/661 checks passed at commit `6eda83b`.

## Failures

None.

## Evidence gaps

None recorded.

## Limits

- Rendered screenshots require visual review. Passing dimensions does not establish photorealism or camera-to-photograph alignment.
- Phone browser is viewport/touch emulation on desktop hardware; real device performance remains unmeasured.
- No deployment, account change, GitHub write, or message is performed by this script.

## Reflection follow-up

450/453 assertions passed in the first compact run. The three phone look-control comparisons were proven to compare different unsettled scroll poses. With the existing scroll-idle precondition and unchanged strict tolerances, the targeted sequence passed 103/103 assertions, including all three affected comparisons. The QA helper now waits for that stable pose. Raw initial and targeted results are retained in the local evidence packet.

Six same-pose desktop/phone comparisons preserved visible artwork pixels, print geometry/UVs/scales and projected quads. The HUD had one text/rectangle state over 60 animation frames in each pose. Native input, reduced motion, and shader/console checks passed. The source was frozen throughout verification.

## Pier-contact restoration

Six experimental variants were visually rejected; their runtime was restored to `8b0c073`. Twelve actual desktop/phone poses match baseline camera, artwork pixels, print geometry/UVs, projected quads and HUD. All 216 original image hashes match. A separate 25/25 targeted smoke pass confirms native navigation, normal water motion, reduced-motion freeze and no browser/HTTP failures. [Details and comparisons](PIER-CONTACT.md). This does not claim that the remaining pier contact is visually accepted or that the earlier full suite was rerun.

## Constrained desktop viewport follow-up

104 desktop assertions passed across eight panel sizes. A separate 390×844 phone retest passed 21/21. Normal renders confirm complete entry/final artworks, centered travel through progress 1 and reachable menus. Native input, saved Still, reduced preference, resize and reload checks passed; protected rendering modules are unchanged.

The initial combined run retains its fatal mixed-input touch timeout despite 118 passed assertions. Four isolated gestures and the separate phone sequence passed. These are separate completed checks, not a clean rerun of the full 661-check checkpoint. [Comparisons, accounting and limitations](VIEWPORT-FIT.md). Actual Codex panel inspection and physical-device performance remain unverified.
