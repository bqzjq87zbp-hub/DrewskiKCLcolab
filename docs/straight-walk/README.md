# Straight-walk source contract — 2026-09-11

This is a small, independent handoff check for the current straight-forward/back walk. It does not replace visual review or prove publication.

## Run

From this checkout, with Node 20 or later:

```sh
node --check scripts/qa-straight-walk.mjs
node scripts/qa-straight-walk.mjs
```

The default run has no browser or network dependency. It checks the five source hashes in [CONTRACT.json](CONTRACT.json), 201 evenly spaced travel positions plus out-of-range clamps, reversible linear distance of 7 metres, zero automatic yaw, explicit fixed requested look of ±0.39 radians, default ahead, viewport-owned controls, and the 111 distinct photo identities across four categories.

Optional browser mode requires Playwright and a Chromium browser installed separately and resolvable from this checkout. This helper never installs packages, starts/restarts a server, edits assets, stages files, or publishes.

```sh
QA_URL=http://127.0.0.1:4303/ node scripts/qa-straight-walk.mjs
# To use an already installed Chrome instead of Playwright Chromium:
QA_URL=http://127.0.0.1:4303/ QA_CHANNEL=chrome node scripts/qa-straight-walk.mjs
```

Point QA_URL at an already running **direct source preview**, ending in a slash. Source bytes must match this checkout. Rewritten hosted modules/manifests and wrapper URLs deliberately fail its fingerprint gate; test the public wrapper with its own release harness.

Browser mode checks 390×844 touch emulation and 1440×900 desktop. It separately tests real browser input routing (Chromium compositor-generated touch swipe or browser wheel) forward and backward, zero unrequested heading, source-envelope containment, equal-progress camera/projection return, visible 44-pixel look targets where supported, fixed manual heading during native scroll, the source category inventory, rendered coastal count, and exact collection return. Programmatic seeks are explicitly labeled and are not counted as native-input proof. These are emulated-browser checks, not physical-device testing.

Output is a JSON report on stdout; a failing required check exits nonzero. A math-only PASS contains browser.status = NOT_RUN and is **not** a browser pass. Read the actual output from a completed run; this README itself is not run evidence. No screenshots are generated here.

## Current versus historical evidence

The current contract is distance = 7 × clamp(progress), stops [0, 0.25, 0.5, 0.75, 1], initial look ahead, and no automatic turns while scrolling. Left/right are explicit and independent of forward distance; the renderer's photograph-edge safety guard remains authoritative.

**scripts/qa-photograph-interaction.mjs is the frozen historical B7m harness. Its auto-yaw, reading-pause, and old focus-stop expectations do not apply to this linear-walk repair.** The old scripts and evidence were deliberately not rewritten. Do not report their conflicting historical assumptions as current acceptance criteria, and do not relabel old results as new proof.

The separate release review is recorded outside this source checkout at outputs/mobile-walk-direction-20260911/verify-walk.cjs in the parent working task. Its candidate/public runs and rendered screenshots are separate evidence; this helper makes no claim that those runs passed.

## Change discipline

A source-hash mismatch is a review gate, not a reason to silently refresh CONTRACT.json. Check the changed bytes and obtain the applicable approval before adopting a new contract. This helper does not authorize new source edits or publication.

Browser APIs used here follow [Playwright's wheel API](https://playwright.dev/docs/api/class-mouse#mouse-wheel), [CDP sessions](https://playwright.dev/docs/api/class-cdpsession), and [Chromium's synthesized-scroll protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-synthesizeScrollGesture).
