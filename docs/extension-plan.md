# EzPIX Insta extension architecture

30 October 2026. Extension **0.465.1**, shared engine/vendor **0.465.0**. Shared algorithms in packages/core; website consumes a versioned archive. See [current handoff](../../glitchbong/docs/ezpix-release-local.md) and [core contracts](../packages/core/README.md).

## Capture and conversion window

Chrome MV3, minimum Chrome 120. Toolbar action opens app.html in the floating window and grants activeTab. The floating window provides visible-page, region and element capture, image/video files, camera/screen chooser, full-image default conversion, optional selection and background removal. All processing and downloads run locally. The fixed viewport reserves the right column for one expanded settings section. Manual editing is provided by the website; retired popup/manual editor files are excluded from the release.

The selector supports Escape and removes its overlay before capture. Background checks the initiating active tab/document, viewport/scroll/DPR before and after screenshot capture, and crops using actual image dimensions. Navigation, protected pages, moved/closed tabs and changed geometry reject. Visible screenshots cap at 16 megapixels; retained crops at four. Captures are saved with ten-minute expiry, then CAPTURE_READY refreshes the floating window. Reopening the window reads the retained capture.

New sources select the full rectangle and keep background. Shape selections remain optional; Select entire image restores the full rectangle. Colour removal samples raw source RGB, never the processed preview. A circular nearest-neighbour magnifier and keyboard arrows/Enter/Escape support exact sampling. Tolerance is 0-255 per-channel distance; soft edges fade the next 0-128 steps. Border-connected removal is also available. No semantic segmentation or AI is implied. Matching colours inside an object may be removed; inspect the preview.

Output fits 256px axes. Video input caps at eight seconds, 32 MiB and 32 sampled frames; working video frames resize to 512px. Camera/screen streams stop after frame capture, Stop or window closure. Jobs reject stale responses. Downloads exclude source images. Capture files, user names, URLs and palettes never enter logs/telemetry.

## Permissions and retention

Exactly activeTab (explicit page capture), scripting (selector/geometry) and alarms (expiry). Floating-window creation needs no additional permission. No blanket host, clipboard, storage/sync or browsing-history permission. IndexedDB stores capture/selection/transfer records for ten minutes. Legacy opt-in manual recovery drafts retain their earlier seven-day/four-draft/8 MiB expiry cleanup; this version creates no new manual drafts. Appearance is localStorage. Bundled and hosted privacy pages describe these policies.

## Guarded website handoff

Production origin is https://glitchbong.com; development is http://localhost:3791. Production externally_connectable is exactly https://glitchbong.com/*; development only localhost. Internal START/HANDOFF requires this extension's app.html sender. Website discovery verifies origin, supported path and top frame. Transfer additionally binds random 256-bit token, exact destination tab, expiry, protocol, engine version, chunk bounds and SHA-256. A holding page is initialized before navigation. Worker restart resumes from IndexedDB; ACK clears bytes and remains idempotent.

Open in Pixel studio encodes only converted artwork and opens /tools/ezpix with a temporary transfer fragment. Website Receive then Import requires explicit review and preserves existing art on cancellation/failure. A mismatched engine fails with project-file fallback. No original media enters the project and no server receives pixels through this browser-message handoff. The public store ID is eijjjhokfogdfcnednolghbegpddneci.

## Release

Run npm run release:local. ZIP allowlist, versions, production origin and permissions are checked alongside actual unpacked capture, transfer, media downloads, narrow layouts, raw indexed PNG and independent readers. Product scope and remaining roadmap live in the current website documents. Local tests do not prove installed store updates, physical devices, manual external-editor/engine roundtrips, complete accessibility or endurance/minimum hardware.

## Floating workspace layout

The toolbar reuses one native popup window. Empty mode is 460x360 outer pixels; media mode targets 1060x760, clamped to available screen bounds. Source and output are vertically stacked in the left column. Settings alone scroll on the right, with one named accordion section always expanded. Export and web-editor controls span the full width below both columns. Camera preview gets a compact live mode before a frame is captured. Clearing capture returns to compact mode. Canvas display sizes preserve their actual aspect ratios so pointer sampling/selection stay accurate.

The toolbar binds the explicitly chosen source tab/window in IndexedDB. Capture checks that this is still the active source tab, focuses that browser window for selection, and returns the studio to the front after capture/cancellation. Repeated toolbar clicks update the explicit source binding without discarding current media. Extension context identity is checked through runtime.getContexts rather than requesting broad tab URL access. IDs survive worker restarts and are discarded when the studio closes or its document is stale.

Extension UI releases now have an independent manifest version; transfer still compares the unchanged shared ENGINE_VERSION. This extension-only layout update requires no website engine/package change.

## Verification of floating update 0.465.1

All **1,017 core/protocol/extension tests** passed, with zero failures. Actual unpacked production extension tests passed **13 browser groups**, including compact/media sizing, side-by-side geometry, no outer scrolling, independent settings scrolling, one-open accordion, exact source colour sampling/downloads, single-window reuse, source-tab change rejection, real region/viewport capture, Escape preservation, actual worker restart, compact reset, portrait fit and exact transfer to the live HTTPS web editor. Chromium: 151.0.7922.34. Four independent project-reader groups passed, plus fourteen-file runtime ZIP and twelve-file listing ZIP byte/CRC/dimension checks. Desktop, compact, portrait and scrolling/magnifier screenshots were visually inspected.

Runtime ZIP: `dist/release/ezpix-insta-0.465.1.zip`, 304,098 bytes, SHA-256 `14dfbe14b30a89a918f5c813f2973735844a3a1f69db33c5730c1dc093192a89`. Store assets ZIP: `dist/release/ezpix-insta-store-assets-0.465.1.zip`, SHA-256 `4f5d50ac2e439066c683a3b81a00682326f8de93fd867a97a62823375acb5536`. Reports and actual downloads are ignored under `artifacts/floating-studio/`.

This is an extension-only local update. Shared source, vendor package and deployed website engine remain **0.465.0** and byte-verified unchanged. No website build/deployment was necessary for the extension layout; live handoff was tested. Chrome Store upload/installed-update and physical-device/accessibility/endurance gates remain separate.
