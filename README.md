# EzPIX Insta and EzPix shared core

Current core/extension: **0.465.0**. EzPIX Insta captures and converts media in a persistent Chrome side panel. Manual Pixel studio lives at https://glitchbong.com/tools/ezpix.

The published store item is https://chromewebstore.google.com/detail/ezpix-insta/eijjjhokfogdfcnednolghbegpddneci. This repository has no remote; update ZIPs are prepared locally. Upload the new version to the same store item.

New sources preview the full image with background preserved. Select smaller geometry or restore the entire image. Sample background colours through a source-only circular magnifier and adjust tolerance/softness. Grid, palette, animation and photo controls expand as needed. Download locally, or explicitly transfer converted artwork to the web editor for receive/import review. No runtime AI, image upload, analytics or account.

## Build and verification

Run `npm ci`, `npm test`, `npm run package:extension`. Load `dist/extension` for production or `dist/extension-dev` for http://localhost:3791. Click the toolbar icon on the page before capturing to grant activeTab. Permissions are activeTab, scripting, alarms and sidePanel, without host access.

`npm run release:local` runs the full current local gate: shared tests and package sync, website build/lint/routes, production ZIP, side-panel media/capture/transfer, raw indexed PNG, listing assets and independent readers. Set `EZPIX_CHROMIUM_PATH` if needed. Generated artifacts, browser profiles and downloads stay ignored. Older phase/UI scripts are historical reproductions and may target retired layouts.

## Current references

- [Implementation, verification and release state](../glitchbong/docs/ezpix-release-local.md)
- [Product specification](../glitchbong/docs/ezpix-spec.md)
- [Remaining feature roadmap](../glitchbong/docs/ezpix-rework-plan.md)
- [Tilemap contract for the web editor](../glitchbong/docs/ezpix-tilemaps.md)
- [Core API and file contracts](packages/core/README.md)
- [Extension architecture](docs/extension-plan.md)
- [Chrome listing and update instructions](docs/chrome-store-ezpix-insta.md)
- [External qualification gates](docs/release-verification.md)

Website develops on GlitchBong ezpix and merges to master; core/extension uses this repository's main. Shared algorithms belong in packages/core. The website consumes a versioned vendor archive with provenance, never sibling runtime imports. Dense schemas remain v16 ordinary/v17 tilemaps, readers v1-v17; sparse remains tiled v5/readers v1-v5.
