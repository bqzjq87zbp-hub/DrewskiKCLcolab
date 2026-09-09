# Clean local export check

Date: 2026-09-08. Status: prepared locally, no Git commit, push or deployment performed by the export worker.

## Authority and purpose

The project owner requested a clean website collaboration repository. The export worker owned only this newly created project folder. The existing preview, archives, source photographs and public Pixpa were unchanged. The required creative-director privacy discipline informed exclusion of private records and purchased room templates; existing portfolio copy and imagery were otherwise retained.

## Evidence and results

[Certain] `npm run check` passed against this export:

| Check | Result |
| --- | --- |
| Branding | 13 entries, including 10 NWPRT |
| Family portraits | 21 entries |
| Professional headshots | 31 entries |
| Coastal photographs | 4 entries |
| Total gallery entries | 69 |
| Measured easel slots | 10 |
| Purchased room backgrounds | 0 shipped; 3 excluded |
| Room artwork overlays | 0 shipped; 6 excluded |
| Unique shipped JPEG files | 92 |
| Total shipped JPEG bytes | 135,713,230 |
| Asset-manifest hashes | All matched |
| Symlinks | None |
| Private-path / secret-shaped text matches | None in the scanned source/data/docs |
| Public application route probes | HTTP 200 |
| Private development/document routes | HTTP 404 |
| POST request | HTTP 405 |
| HEAD request | HTTP 200 |

The 69 entries intentionally reuse a few photographs between Families and Coastal. Each entry's gallery/full URLs resolve to a self-contained website file. The larger 92-file count includes enlargement variants, easel-entry assets, the original pier background and the supplied easel composition reference.

[Certain] A separate metadata and binary-image check read every source/export pair: **92 of 92 JPEG compressed image scan streams were identical** after removing nonvisual metadata from exported copies. No EXIF, XMP, IPTC, GPS or comment fields remained in those copies; ICC color profiles were preserved. Original source file hashes remained unchanged during export. This is a metadata-only copy operation, with no cropping, recoloring or recompression.

JavaScript syntax checks passed for the server, verifier and all six runtime JavaScript modules. The test server exposes only inventoried supported file types in `public/`, rejects symlinks/out-of-root targets, and does not serve package files, documentation, environment files or Git internals. This is a bounded safety check, not a claim of a complete security audit.

## Preserved behavior and known limits

The runtime files were copied with mechanical media-URL replacements. The page title and composition-reference alternative text were made explicit for this standalone export. Families naturally skips the empty room list and displays all 21 photographs.

The existing movement is photographic 2.5D with a still pier background and separately projected easels. No 4K video or Seedance integration has been added. The no-JavaScript photograph list, menu appearance alternatives, travel choices and ordinary galleries remain in the code. Independent actual-browser rendering and interaction QA is the next gate, rather than being inferred from these structural checks.

No private source manifest, source-path map, archive evidence, account configuration, hosting project identifier, purchased room template or generation credential is included. Pattern scans cannot prove that every conceivable secret is absent, but no matching sensitive values were found in this explicit export allowlist.

## Route and stop condition

Prerequisites: inspect `README.md`, `public/categories.json` and `docs/asset-manifest.json`; run `npm run check` after any changes. If it fails, repair only this repository and rerun. If it passes, the coordinator may run independent desktop/mobile rendering checks and decide repository actions. A successful Git push or public release needs separate direct evidence. Export worker's terminal condition is this runnable local packet, with findings returned to the coordinator.

Provenance: operational synthesis from current selected website runtime and media, verified 2026-09-08. Refresh this record after runtime, gallery, server or asset changes. This report does not authorize publication or replace licensing review.
