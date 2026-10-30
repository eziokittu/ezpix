# EzPIX Insta extension architecture

30 October 2026. Core/vendor/extension **0.465.0**. Shared algorithms in packages/core; website consumes a versioned archive. See [current handoff](../../glitchbong/docs/ezpix-release-local.md) and [core contracts](../packages/core/README.md).

## Capture and conversion panel

Chrome MV3, minimum Chrome 120. Toolbar action opens app.html in the persistent side panel and grants activeTab. The panel provides visible-page, region and element capture, image/video files, camera/screen chooser, full-image default conversion, optional selection and background removal. All processing and downloads run locally. Collapsible controls conserve panel space. Manual editing is provided by the website; retired popup/manual editor files are excluded from the release.

The selector supports Escape and removes its overlay before capture. Background checks the initiating active tab/document, viewport/scroll/DPR before and after screenshot capture, and crops using actual image dimensions. Navigation, protected pages, moved/closed tabs and changed geometry reject. Visible screenshots cap at 16 megapixels; retained crops at four. Captures are saved with ten-minute expiry, then CAPTURE_READY refreshes open panels. Reopening the panel reads the retained capture.

New sources select the full rectangle and keep background. Shape selections remain optional; Select entire image restores the full rectangle. Colour removal samples raw source RGB, never the processed preview. A circular nearest-neighbour magnifier and keyboard arrows/Enter/Escape support exact sampling. Tolerance is 0-255 per-channel distance; soft edges fade the next 0-128 steps. Border-connected removal is also available. No semantic segmentation or AI is implied. Matching colours inside an object may be removed; inspect the preview.

Output fits 256px axes. Video input caps at eight seconds, 32 MiB and 32 sampled frames; working video frames resize to 512px. Camera/screen streams stop after frame capture, Stop or panel closure. Jobs reject stale responses. Downloads exclude source images. Capture files, user names, URLs and palettes never enter logs/telemetry.

## Permissions and retention

Exactly activeTab (explicit page capture), scripting (selector/geometry), alarms (expiry), sidePanel (persistent controls). No blanket host, clipboard, storage/sync or browsing-history permission. IndexedDB stores capture/selection/transfer records for ten minutes. Legacy opt-in manual recovery drafts retain their earlier seven-day/four-draft/8 MiB expiry cleanup; this version creates no new manual drafts. Appearance is localStorage. Bundled and hosted privacy pages describe these policies.

## Guarded website handoff

Production origin is https://glitchbong.com; development is http://localhost:3791. Production externally_connectable is exactly https://glitchbong.com/*; development only localhost. Internal START/HANDOFF requires this extension's app.html sender. Website discovery verifies origin, supported path and top frame. Transfer additionally binds random 256-bit token, exact destination tab, expiry, protocol, engine version, chunk bounds and SHA-256. A holding page is initialized before navigation. Worker restart resumes from IndexedDB; ACK clears bytes and remains idempotent.

Open in Pixel studio encodes only converted artwork and opens /tools/ezpix with a temporary transfer fragment. Website Receive then Import requires explicit review and preserves existing art on cancellation/failure. A mismatched engine fails with project-file fallback. No original media enters the project and no server receives pixels through this browser-message handoff. The public store ID is eijjjhokfogdfcnednolghbegpddneci.

## Release

Run npm run release:local. ZIP allowlist, versions, production origin and permissions are checked alongside actual unpacked capture, transfer, media downloads, narrow layouts, raw indexed PNG and independent readers. Product scope and remaining roadmap live in the current website documents. Local tests do not prove installed store updates, physical devices, manual external-editor/engine roundtrips, complete accessibility or endurance/minimum hardware.
