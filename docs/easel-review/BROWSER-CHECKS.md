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
