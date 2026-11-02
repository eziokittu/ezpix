# Expanded workspace and object cutouts ? 2 November 2026

Extension and shared engine: **0.466.0**. Local implementation and package only; no commit, push, deployment or Web Store submission.

## Use

1. Load `dist/extension` as an unpacked extension, or reload it in chrome://extensions. Click the pinned toolbar icon and open/capture an image.
2. Click the expand icon at the lower left of Input or Output. The overlay fills the Chrome popup, covering capture/export chrome. Input/Output switches are at the upper left; close or Escape returns to the original layout. Settings sit right for portrait/square images and below landscape images, according to the active preview's intrinsic dimensions. Chrome's own popup size limit still applies.
3. In Selection, choose Freehand lasso and draw a closed outline. Releasing the pointer applies the filled mask to the preview. Polygon outline uses Finish outline. Nonselected pixels become transparent; a checkerboard shows transparency in Output.
4. For Magic colour selection, click the object in Input. Increase/decrease Colour tolerance to grow/shrink the connected seed-colour region. The distance always compares with the original clicked colour, avoiding a gradual flood across colour ramps. This is local colour matching, without semantic object recognition or an AI dependency.
5. Set Selection action to Add for a window, wheel or other missed colour, then click it with Magic or trace it with another tool. Remove subtracts unwanted areas with Magic, rectangle, ellipse, polygon, lasso or the continuous selection brush. Undo selection restores the last completed edit. Select entire image explicitly restores all coverage. Add/Remove modes persist until changed.
6. Other grid, style, background and photo controls process the retained cutout. Downloads and local web-editor handoff contain the resulting pixels, not the original background. Formats with alpha retain transparency; JPEG flattens to white as before. Empty selections clear the preview and disable export.

## Implementation

Shared deterministic functions live in `packages/core/src/focus-selection.ts`; the optional crop-relative binary mask is validated and applied in `focus.ts`. Freehand input retains coalesced samples, up to 8,192 points, and rasterizes with a scanline even-odd fill. The drawing no longer depends on repeatedly decimating an outline to 128 points or on a bounding rectangle alone. Committing a selection enables Focus object. Brush strokes connect sparse pointer samples continuously. Selection edits retain a single previous mask for Undo; tolerance changes recompute only the latest magic region against its original base mask. Pointer cancellation restores the last completed selection. Source-only sampling uses original pixels, including within the expanded modal; the magnifier joins the same modal layer.

The overlay moves the existing canvases, controls and status into a modal dialog and returns them to placeholders when closed. Pointer coordinates always derive from each live canvas's displayed bounds. Selection shading is cached independently of original sampling pixels; clearing media releases its mask and image buffers. Settings scroll independently. No extra browser windows/tabs, permissions, uploads, telemetry, inference, project schemas or capture/transfer trust changes.

## Local evidence

- Full core/extension suite: **1,028 tests passed**, including seven new deterministic selection tests. Independent even-odd polygon oracle; connected/transparent pixels; fixed-seed ramp behaviour; Add/Remove/holes; continuous brush; adjustment/animation preservation; invalid input guards. Log: `artifacts/expanded-selection/core-sync-final.log`.
- Real production Chrome action popup: **12 new browser groups** at 780?580 and 776?490 (800?600 virtual display). Landscape/portrait/square overlay geometry, direct Output entry, live switching/closing/Escape, 257-sample moon lasso, white/grey magic tolerance, multicolour car refinement, selection Undo, cancelled gestures, stale adjustment jobs, empty selection and original-colour magnifier. Screenshots and JSON: `artifacts/expanded-selection` and `artifacts/expanded-selection-small`.
- Existing toolbar regression: **22 groups passed**, including page capture, area/element selection, Escape, background-worker restart, RESET, themed controls, source picking, exact export and automatic matching-engine local website handoff. `artifacts/toolbar-popup/result.json`.
- Matching website production build passed TypeScript and generated **1,247 pages**. No website UI change is introduced; vendor package, lock and provenance advance together. `artifacts/expanded-selection/website-build.log`.
- `node scripts/verify-package.mjs` verifies exact source/archive/installed distribution bytes, package/lock integrity and unchanged minimal manifest permissions. Both production/development builds succeeded. The future `release:local` gate includes the new popup suite.

Browser evidence uses Chromium 151.0.7922.34, original synthetic fixtures and native popup pointer dispatch. Export checks account for the browser canvas's normal premultiplied-alpha RGB rounding; alpha/membership are preserved exactly. Actual hardware/mobile/stylus, arbitrary photographs, installed Web Store updates and a full combined release:local run are not established by these checks.

## Deliverables and release boundary

- Unpacked: `dist/extension` (production), `dist/extension-dev` (localhost QA).
- ZIP: `dist/release/ezpix-insta-0.466.0.zip`; adjacent JSON records current SHA-256 and allowlisted files.
- Website: `../glitchbong/vendor/ezpix-core-0.466.0.tgz`, matching package/lock/provenance and installed distribution.

The engine advances to 0.466.0 with its package. Existing hosted/store installs have not changed. Publish the matching website package before expecting the updated extension's Open in Pixel studio handoff to succeed against production; the version guard deliberately remains intact. Downloads work independently. Store submission, hosted deployment, promotional screenshots and physical-device qualification remain separate actions. Existing listing assets describe the previous popup and have not been regenerated.
