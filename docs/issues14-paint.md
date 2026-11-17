# Android Paint package: 0.483.0

16 November 2026. Owner explicitly authorized a new Android engine for issues14.
`photo-paint.ts` adds local full-resolution gradients (linear/radial/angle/
reflected/diamond), connected or global bucket fill, solid fill and three patterns.
It validates raster/options/membership, uses bounded iterative traversal, preserves
input buffers and returns the existing `patch` edit. Alpha uses source-over.

Photo v1/v2 and dense/tiled document schemas are unchanged. Import/export,
Original, history and existing workspace budgets retain their existing contracts.
Android processes Paint in a worker, checks workspace revision before commit,
and supports cancellation without modifying artwork.

The package version is **0.483.0**. The legacy `ENGINE_VERSION` value **0.482.0**
is deliberately retained as the existing serialized/extension bridge identity:
this additive photo-processing export does not change that protocol. Do not
change the bridge identity merely to match the npm package or force the frozen
extension to update. A future protocol change requires explicit compatibility work.

Android consumes `vendor/ezpix-core-0.483.0.tgz` with SHA-256 provenance. The
extension manifest/runtime and the website's installed engine/studio package
were not updated or published. Do not overwrite the 0.483.0 archive with new
code; mint another version for subsequent changes.

Validation: all 1,105 core/extension tests pass, including four Paint tests.
Android's `scripts/check-paint-compatibility.mjs` reads eight new Paint variants
through the frozen 0.482.0 decoder/renderer, compares exact pixels, round-trips
back to 0.483.0, checks Original and Undo, and opens an older effects project.
Results are in Android `artifacts/issues14-compatibility/report.json`.

This is local automated proof. Physical Android/peer testing and Play submission
remain separate gates. No commit, push, deployment or store upload was performed.
