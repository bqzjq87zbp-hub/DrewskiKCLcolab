# Native Home mobile sticky-header repair

Date: 2026-09-10. This is separate from the completed 94-photo gallery release. It does not modify the gallery runtime, host deployment, photograph curation, native menu handlers, glass material, or scrolling sheen.

## Cause and exact correction

The native Home masthead sits inside Pixpa's `.is-section .is-boxes` wrapper. Below 768px the vendor stylesheet sets that wrapper to `overflow:hidden`, making it the sticky positioning reference even though the document is scrolling. The header therefore leaves the viewport. Families places its header outside that wrapper; desktop Home already uses visible overflow.

The repair inserts only this 213-byte packet inside the existing `kcl-pier-home-entry-20260909` style in Shared Body:

```css
/* Home only: the sticky masthead must reference the document scroller. */
@media (max-width:767px) {
  body:has(#kcl-pacific-landing) .is-section .is-boxes:has(#kcl-pacific-landing) {
    overflow:visible;
  }
}
```

The selector matches one diagnosed Home ancestor and no Families ancestor. Home retains its own `overflow-x:clip; overflow-y:visible`. No position, height, photograph, text, handler, or vendor stylesheet is changed.

## Saved and public identities

- Exact Shared Body rollback: 286,466 bytes; SHA-256 `3b538d6cbbdf38d037143bac07bf6b80daabd60db42b9b3452b43cc4e2bc76d9`.
- Exact staged and full-reload-persisted Shared Body: 286,679 bytes; SHA-256 `820a22a5b99477027456fb76daa3d4f7f984b31319e39c46f1dfb5269de836bc`.
- Patch: 213 bytes; SHA-256 `054b7b670d4cea6688aba923a7d5c9445e26236b601900a4bea9a1da57305b86`.
- Removing the one exact packet restores every original byte. All 14 script bodies are unchanged and parse successfully; all other External Scripts fields are unchanged.
- The initialized editor, not its stale backing textarea, supplied the authoritative value. A full editor reload proves persistence. The first Save click timed out before observed submission; one subsequent verified click was followed by exact reload readback. Network-response capture was unavailable, so no success claim rests on that capture.
- A fresh public Home response at 18:49:05 UTC contained exactly one of each of all 36 shared style/script nodes, each byte-identical to the saved candidate. No transient test style remained.
- Native Home Page Code and its template-bearing parent were not saved. The separate native Home code does not match the actual shared public owner, so it was deliberately left untouched.

## Rendered acceptance

The exact isolated candidate independently passed Home390/767/768/1440 and Families390, including native forward/reverse wheel scrolling, menu visibility, Escape/focus return, and zero horizontal overflow across 42 measurements. All 23 Home image-element geometries, URLs, object-fit, object-position and filter values were preserved. This includes the dormant viewer element; it is not a claim that 23 photographs were freshly downloaded.

Owner public touch verification at390: documentY0 → 447 → 219, mastheadTop0 throughout, menuTop9 and horizontal overflow0. A native pointer opened the menu atY219 without moving the document. Six current destinations remain present with targets at least48px high. Independent fresh public verification passed all33 states across Home390/767/768/1440 and Families390, retaining mastheadTop0 and horizontal overflow0. Existing sheen appears during scrolling and idles to opacity0. The [live report and screenshots](evidence/home-header/REPORT-LIVE.md) and [sanitized measurements](evidence/home-header/verification.json) record the exact scope.

This is Chrome viewport/compositor emulation, not physical-iPhone or Safari certification. Locator keyboard operations can scroll a focused control into view; the same behavior was recorded on unaffected controls. No keyboard-handler workaround was added. Existing material and preference behavior were preserved, not redesigned or certified site-wide.

## Protected gallery and reproducibility

The public gallery categories were re-fetched at18:49:43 UTC:200,40,566 bytes, SHA-256 `4806f5f9c2f9b7d15958c24ea293f7c5d4d218c664903c65ab80e156209ddb18`, exact to the accepted94-entry source. Hosting remains version11/source `874050f23a65d4adc4f1734572f7b6de9ef6bcaf`; no deployment was requested. The279-path gallery build check passes unchanged. No media, easel, walking, viewer, footer, or later curation batch enters this repair.

`patch-home-sticky-ancestor.mjs` reproduces the exact candidate from the exact rollback and refuses drift, existing output, or a duplicate application. It is offline-only and contains no private field, original photograph, credential, or Studio capture. The publisher retains full rollback/persistence records privately.

This source/evidence addition belongs to the existing draft PR3. It does not merge that PR or modify collaborator PR2.
