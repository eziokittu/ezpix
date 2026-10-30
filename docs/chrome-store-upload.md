# Current Chrome extension update

30 October 2026. Published item: [EzPIX Insta](https://chromewebstore.google.com/detail/ezpix-insta/eijjjhokfogdfcnednolghbegpddneci).

Upload `dist/release/ezpix-insta-0.465.1.zip` to this existing item. The adjacent JSON contains the exact SHA-256 and fourteen-file allowlist. Upload matching listing media from `dist/release/ezpix-insta-store-assets-0.465.1.zip`; that archive is not the extension package. See [copy-ready listing fields](chrome-store-ezpix-insta.md).

Run `npm run release:local` to rebuild and verify current source, packaged core, production website, floating-window workflows, exact capture/handoff/download pixels, raw indexed PNG and listing archives. Current evidence and unresolved external gates are recorded in [the website release handoff](../../glitchbong/docs/ezpix-release-local.md).

The update replaces the side panel with one compact/expanded floating Chrome window, left-side source/output images, a right-side settings accordion and full-width export controls. It removes the sidePanel permission. Shared engine 0.465.0 and the existing guarded web-editor transfer remain compatible. Existing store installs remain on the preceding version until this update is uploaded, reviewed and installed. Check matching hosted engine, public privacy and assigned-ID installation/update after deployment. These scripts do not modify the store dashboard.
