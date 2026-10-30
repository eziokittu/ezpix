# EzPIX Insta Chrome update entry sheet

30 October 2026. Update **0.465.1** in the SAME published item, ID `eijjjhokfogdfcnednolghbegpddneci`.
Extension package: `dist/release/ezpix-insta-0.465.1.zip`. Listing media: `dist/release/ezpix-insta-store-assets-0.465.1.zip` (not an extension package).
No dashboard upload or submission is performed by these scripts.

## Listing

Name: **EzPIX Insta**. Category: Art & Design. Language: English.

Summary:

```text
Capture and convert images in a floating pixel studio. Compare source and preview, tune settings and download or open the web editor.
```

Detailed description:

```text
Turn what catches your eye into pixel art, right in a floating window.

EzPIX Insta opens a floating Chrome window. Capture the entire visible page with one click, select an area or pick an element. Open your own image or supported short video, or use the browser camera and screen chooser.

PREVIEW IMMEDIATELY
Your full image converts automatically, with its background kept. Draw a smaller selection when needed or restore the entire image with one button.

CHOOSE WHAT TO KEEP
Pick a background colour directly from the input image through a circular magnifier. Adjust tolerance to remove nearby shades, and soften the edge. Colour removal can affect matching colours inside the subject; inspect your preview.

MAKE IT YOURS
Compare source above pixel preview on the left. Settings scroll independently on the right, with exactly one section expanded. Exports stay below both columns. Expand the pixel-grid, palette, animation and light/colour controls as needed. Tune output dimensions, pixel detail, colour count, dithering and photo adjustments without leaving the panel.

DOWNLOAD OR KEEP EDITING
Download PNG, animated PNG, GIF, sprite sheets, editable EzPix projects, SVG, QOI, BMP, JPEG or WebP within supported limits. Open in Pixel studio explicitly sends converted artwork to the GlitchBong web editor for receive/import review. Drawing, layers, animation and tilemaps are in the web editor.

LOCAL BY DESIGN
No account, AI, extension analytics, image uploads or remote conversion. Downloads work without the website. Optional web handoff uses local browser messages and omits original source images.

LIMITS
Images: up to four megapixels. Videos: up to eight seconds, 32 MiB and 32 sampled frames. Pixel output: up to 256 pixels per axis. Page capture covers visible pixels; protected browser pages cannot be captured. Formats have bounded supported subsets. Camera and screen sharing require the browser chooser.
```

Homepage: https://glitchbong.com/tools/ezpix/extension
Support: https://glitchbong.com/contact
Privacy: https://glitchbong.com/tools/ezpix/privacy
Published listing: https://chromewebstore.google.com/detail/ezpix-insta/eijjjhokfogdfcnednolghbegpddneci

Check hosted engine and privacy after master deployment. The installed older extension has a different engine and lacks the new panel until this update is reviewed and installed.

## Permission explanations

- **activeTab:** Temporary access after toolbar action for the visible-page capture the user requests. No background page capture or browsing-history collection.
- **scripting:** Temporary region/element selector and viewport/scroll/DPR checks for correct cropping; selector removed before capture.
- **alarms:** Cleanup of ten-minute capture/selection/transfer records and legacy expired opt-in recovery drafts when the extension wakes.
- The floating window uses the existing Chrome windows API; no additional permission is requested. This update removes sidePanel.
- **Remote code:** No. Executable scripts, algorithms and workers are packaged with the extension.

Single purpose: Create pixel-art assets locally from user-selected media and explicitly requested visible-page captures, with preview controls, downloads and optional reviewed handoff to the web Pixel studio.

Retain accurate disclosure that user-selected website content and capture-selection interactions are handled locally. No identity, health, financial, authentication, location, communications or browsing-history collection feature is implemented. Captures can incidentally contain personal information; the extension does not extract those fields. No sale, advertising use or unrelated transfer is implemented. Account-specific declarations remain the owner's submission responsibility.

## Reviewer instructions

1. Pin the extension and click its toolbar icon on an ordinary HTTP/HTTPS page. A compact floating window opens.
2. Choose Capture entire visible page. The whole capture appears as a pixel preview without drawing another box; background defaults to Keep background.
3. Select a smaller source area, then expand Selection and choose Select entire image to restore it.
4. Expand Background and choose Chosen colour. Pick from image shows magnification over the original source; click to sample. Keyboard arrows/Enter also sample; Escape cancels. Increase Tolerance to remove nearby shades.
5. Expand Pixel grid, Style and Light, colour & finish. Change settings, then download an asset or editable project. Local files work without visiting the website.
6. Open in Pixel studio opens glitchbong.com/tools/ezpix. Choose Receive extension artwork, review, then Import received artwork. Existing website artwork requires replacement confirmation. Download/open an editable project if direct transfer is unavailable.
7. Camera/screen chooser can be cancelled. Streams stop after a frame, Stop or closing the floating window. Clear capture & pending handoff deletes retained temporary records.

## Assets

Upload the new shared 128px transparent canvas/pencil icon, five numbered 1280x800 screenshots, 440x280 small promo and 1400x560 marquee. Icon variants use the same illustration without a surrounding green badge. Promo backgrounds remain full opaque layouts. Optional video remains blank; no hosted video is supplied.
