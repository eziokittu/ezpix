# EzPIX Insta and EzPix shared core

Photo studio, live camera and expanded selection: [0.468 delivery notes](docs/photo-studio-0.468.md).

Current local extension and shared engine: **0.482.0**. EzPIX Insta captures and converts media in a normal Chrome toolbar popup. Local share opens a persistent tab for account-free direct device transfer. Manual Pixel studio lives at https://glitchbong.com/tools/ezpix.

Android issues10 adds atomic image import, shared emoji/shape editing, an
animated display-only selection outline and collage performance improvements.
See [0.482 delivery](docs/issues10-0.482.md). Android is 1.4.0/code 17; its former
downloaded AI workflow is retired in favour of deterministic local Smart Remove.

The 11 November update adds shared mobile image edits, QR/security-code pairing,
mutual file consent, bounded/checksummed WebRTC transfer and matching Android/web
integrations. See [implementation and verification boundaries](docs/local-share-mobile.md).
The update is local; Web Store publication and hosted deployment are separate.

The published store item is https://chromewebstore.google.com/detail/ezpix-insta/eijjjhokfogdfcnednolghbegpddneci. Source is maintained at https://github.com/eziokittu/ezpix; update ZIPs are prepared locally. Upload the new version to the same store item.

New sources preview the full image with background preserved and Original colours selected by default, including after RESET. Select smaller geometry or restore the entire image. Sample background colours through a source-only circular magnifier and adjust tolerance/softness. Grid, palette, background, selection and photo controls expand as needed. Click the colour swatch to open a rectangular colour picker, or sample the source using the smaller magnifier. Both previews show zero-based image-pixel coordinates at the bottom right. Animation and Capture limits sections are hidden; media bounds and fixed animation defaults remain in force. Download locally, or explicitly transfer converted artwork to the web editor for automatic import, with confirmation when replacing unsaved artwork. The extension performs local deterministic processing without runtime AI or image uploads. Optional Google account sync transfers setup preferences only.

The website EzPIX Insta button installs the extension when unavailable or opens its existing toolbar popup when version 0.465.6+ is detected. Chrome grants page capture through the pinned icon; a website launch without that grant opens the local-media chooser. Source pushes require explicit owner authorization; Chrome Web Store uploads remain a separate action.

The bottom-left expand button on either image opens a workspace across the popup. Switch Input/Output at the upper left, close at the upper right or press Escape. Settings sit to the right for portrait/square previews and below landscape previews. The same live canvases keep selection and colour-picking coordinates accurate.

Selection now retains a pixel mask: completed freehand/polygon outlines, rectangles and ellipses isolate the output with transparency. Magic colour selection selects a four-connected colour region using adjustable seed-relative tolerance. Replace, Add and Remove work across all selection tools, including a continuous brush; Undo selection restores the previous edit. Add differently coloured object parts separately and remove spill with the lasso or brush. This is deterministic colour matching, not semantic object recognition. Later tone, palette, grid and export operations preserve the cutout. Downloadable formats that support alpha retain transparency; JPEG still uses white.

## Build and verification

Run `npm ci`, `npm test`, `npm run package:extension`. Load `dist/extension` for production or `dist/extension-dev` for http://localhost:3791. Click the toolbar icon on the page before capturing to grant activeTab. Permissions are activeTab, scripting and alarms, without host access.

`npm run release:local` runs the full current local gate: shared tests and package sync, website build/lint/routes, production ZIP, toolbar-popup media/capture/transfer, raw indexed PNG, listing assets and independent readers. Set `EZPIX_CHROMIUM_PATH` if needed. Generated artifacts, browser profiles and downloads stay ignored. Older phase/UI scripts are historical reproductions and may target retired layouts.

## Current references

- [Current alignment, header entry and preview performance changes](docs/alignment-performance.md)

- [Settings tabs and branded Help, Docs, FAQ and Privacy pages](docs/resource-pages.md)

- [Implementation, verification and release state](../glitchbong/docs/ezpix-release-local.md)
- [Product specification](../glitchbong/docs/ezpix-spec.md)
- [Remaining feature roadmap](../glitchbong/docs/ezpix-rework-plan.md)
- [Tilemap contract for the web editor](../glitchbong/docs/ezpix-tilemaps.md)
- [Core API and file contracts](packages/core/README.md)
- [Extension architecture](docs/extension-plan.md)
- [Chrome listing and update instructions](docs/chrome-store-ezpix-insta.md)
- [External qualification gates](docs/release-verification.md)

Website work stays on GlitchBong master; core/extension uses this repository's main. Shared algorithms belong in packages/core. The website consumes a versioned vendor archive with provenance, never sibling runtime imports. Dense schemas remain v16 ordinary/v17 tilemaps, readers v1-v17; sparse remains tiled v5/readers v1-v5.

The empty toolbar popup is compact. With media, source and pixel preview are stacked on the left, normal settings groups can all collapse in the independently scrolling right column, and exports span the bottom. Expanded view uses settings tabs with exactly one active panel. The window itself does not scroll. Load dist/extension locally and click Reload after rebuilding.

Version 0.465.6 uses action.default_popup, like Table Grabber: 420x280 before media and 780x580 with media, reduced on short screens. Reload the unpacked extension in chrome://extensions, then click its pinned toolbar icon on a webpage. Page selection temporarily closes the popup and reopens it after capture or Escape. Each fresh toolbar click captures the entire visible page automatically. Returning from area/element selection, Escape or camera/screen capture restores that result once instead of recapturing. If the page cannot be captured, the compact chooser shows red guidance and local media can still be opened. Download completed edits before dismissing the popup. Chrome 127 or newer is required.

The 0.465.6 cyan/blue design has four separated sections, collapsible source/output stages, compact Selection controls, a single red RESET with confirmation and a new-tab icon beside Open in Pixel studio. Cancel preview is removed. Camera and Live screen use a temporary local capture tab for permission and one-frame capture, then return to the toolbar popup. Camera errors distinguish blocked access, busy devices and missing cameras, with red guidance and Chrome/Windows settings help.

For this local update, load/reload `dist/extension` in chrome://extensions. The matching website vendor package is synced locally. Automatic handoff requires that matching website engine; the existing hosted site and Web Store listing have not been updated by this change. Downloads work independently. Reproduce expanded-selection checks with `node scripts/expanded-selection-qa.mjs`; repeat with `EZPIX_QA_SCREEN=800x600` for the short-display layout. See [implementation and evidence](docs/expanded-selection.md).

Photo workspace changes for Android 0.5 are described in [the delivery map](../ezpix-android/docs/ISSUES1-DELIVERY.md). The new photo-layer/schema implementation remains in this shared core.

Android 0.6 dock, grouped editable photo layers (photo schema v2, v1 reader retained), and nearby device discovery are mapped in [issues2 delivery](../ezpix-android/docs/ISSUES2-DELIVERY.md). Desktop discovery uses the optional first-party [local companion](tools/nearby-desktop/README.md). QR and nearby pairing both retain mutual security-code confirmation and encrypted WebRTC payloads.

Android 0.9.0 adds fourteen authored photo looks, whole-canvas crop geometry and shared feedback intents. See [issues5 delivery](../ezpix-android/docs/ISSUES5-DELIVERY.md). Extension settings/footer feedback buttons await the owner's Google Form URL. The 0.477.2 ZIP is local; no publication is implied.
# Android 1.0 coordinated update

Shared engine and extension: **0.480.0**. Optional Google account setup sync,
bounded Google Fonts caching, and deterministic Tone lab / sampled Repair
operations are included. The Android UI consumes the versioned package; cloud
sync requires the prepared website migration and deployment. See
[account deployment](../glitchbong/docs/ezpix-account-1.0.md) and
[Android delivery](../ezpix-android/docs/ISSUES6-DELIVERY.md). Artwork processing
remains local. This is a local build; no extension publication was performed.


Issues8 for Android 1.2.0 updates shared text/emoji scene selection, complete
session history, confirmed colour sampling, floating style menus, gapless pixel
patterns and local exemplar removal. See `../ezpix-android/docs/ISSUES8-DELIVERY.md`.
The downloaded Android model workflow is retired; Smart Remove does not use AI.
