# Current Chrome extension update

30 October 2026. Published item: [EzPIX Insta](https://chromewebstore.google.com/detail/ezpix-insta/eijjjhokfogdfcnednolghbegpddneci).

Upload `dist/release/ezpix-insta-0.465.0.zip` to this existing item. The adjacent JSON contains the exact SHA-256 and thirteen-file allowlist. Upload matching listing media from `dist/release/ezpix-insta-store-assets-0.465.0.zip`; that archive is not the extension package. See [copy-ready listing fields](chrome-store-ezpix-insta.md).

Run `npm run release:local` to rebuild and verify current source, packaged core, production website, side-panel workflows, exact capture/handoff/download pixels, raw indexed PNG and listing archives. Current evidence and unresolved external gates are recorded in [the website release handoff](../../glitchbong/docs/ezpix-release-local.md).

The update replaces the popup/manual extension editor with capture/conversion in a persistent panel. It adds the justified sidePanel permission and enables explicit guarded transfer to the matching production website. Existing store installs remain on the preceding version until this update is uploaded, reviewed and installed. Check matching hosted engine, public privacy and assigned-ID installation/update after deployment. These scripts do not modify the store dashboard.
