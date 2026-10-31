# EzPIX Insta Chrome update entry sheet

1 November 2026. Update **0.465.5** in the SAME published item, ID `eijjjhokfogdfcnednolghbegpddneci`.
Extension package: `dist/release/ezpix-insta-0.465.5.zip`. Listing media: `dist/release/ezpix-insta-store-assets-0.465.5.zip` (not an extension package).
No dashboard upload or submission is performed by these scripts.

## Listing

Name: **EzPIX Insta**. Category: Art & Design. Language: English.

Summary:

```text
Capture and convert images in a toolbar pixel studio. Compare source and preview, tune settings and download or open the web editor.
```

Detailed description:

```text
EzPIX Insta turns images into pixel art in a Chrome toolbar popup.

Click the extension icon to capture the visible part of your current page. You can also select an area, choose an element, or open your own image or short video. Camera and screen capture use Chrome's permission prompts.

Compare the source and result while adjusting pixel size, colours and background removal. Collapse either preview to give the other more room.

Download finished artwork directly from the popup. For drawing and layers, Open in Pixel studio transfers the result to the optional GlitchBong web editor.

Images are processed on your device without uploads or an account. Page capture covers visible content only; protected browser pages cannot be captured. Media size and duration limits apply.
```

Homepage: https://glitchbong.com/tools/ezpix/extension
Support: https://glitchbong.com/contact
Privacy: https://glitchbong.com/tools/ezpix/privacy
Published listing: https://chromewebstore.google.com/detail/ezpix-insta/eijjjhokfogdfcnednolghbegpddneci

Check hosted engine and privacy after master deployment. Match installed extension and website engine versions. The toolbar layout is available after loading this local update or installing the reviewed store update.

## Revision after the reported Yellow Argon rejection

The owner supplied an earlier English-description rejection identifying an export-format list as keyword spam. The description above replaces the format enumeration with a short account of the user workflow. Website-only format support and repetitive feature inventories are omitted. The manifest summary, runtime code and package version are unchanged by this correction.

Replace the entire English detailed description in the existing item's Store listing with only the text inside the Detailed description block above. Do not append it to the rejected text or paste this whole entry sheet into that field. Save the dashboard changes and submit the revised item for review. A package upload does not replace the separately stored listing description. Review other localized descriptions if present. No dashboard edit, resubmission or appeal has been performed locally; approval remains subject to Google's review.

After running scripts/package-store-assets.mjs, the adjacent dist/release/ezpix-insta-store-description-0.465.5.txt contains only the replacement description, ready to paste. The store-assets archive also carries the corrected STORE-LISTING.md. The extension ZIP is unchanged.

References: [Yellow Argon guidance](https://developer.chrome.com/docs/webstore/troubleshooting/#keyword-stuffing), [listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements), [updating listing metadata](https://developer.chrome.com/docs/webstore/update).

## Permission explanations

- **activeTab:** Temporary access after toolbar action for the visible-page capture the user requests. No background page capture or browsing-history collection.
- **scripting:** Temporary region/element selector and viewport/scroll/DPR checks for correct cropping; selector removed before capture.
- **alarms:** Cleanup of ten-minute capture/selection/transfer records and legacy expired opt-in recovery drafts when the extension wakes.
- The normal action popup needs no additional permission. Chrome 127 or newer is required to reopen it after page selection. No sidePanel permission is used.
- **Remote code:** No. Executable scripts, algorithms and workers are packaged with the extension.

Single purpose: Create pixel-art assets locally from user-selected media and explicitly requested visible-page captures, with preview controls, downloads and optional explicit handoff to the web Pixel studio.

Retain accurate disclosure that user-selected website content and capture-selection interactions are handled locally. No identity, health, financial, authentication, location, communications or browsing-history collection feature is implemented. Captures can incidentally contain personal information; the extension does not extract those fields. No sale, advertising use or unrelated transfer is implemented. Account-specific declarations remain the owner's submission responsibility.

## Reviewer instructions

1. Pin the extension and click its toolbar icon on an ordinary HTTP/HTTPS page. The toolbar popup opens and converts the visible page automatically.
2. Clicking the icon captures the entire visible page automatically. Capture entire visible page refreshes it. The whole capture appears as a pixel preview without drawing another box; background defaults to Keep background.
3. Select a smaller source area, then expand Selection and choose Select entire image to restore it.
4. Expand Background and choose Chosen colour. Pick from image shows magnification over the original source; click to sample. Keyboard arrows/Enter also sample; Escape cancels. Increase Tolerance to remove nearby shades.
5. Expand Pixel grid, Style and Light, colour & finish. Change settings, then download an asset or editable project. Local files work without visiting the website.
6. Open in Pixel studio opens glitchbong.com/tools/ezpix. The exact preview imports automatically without Receive/Import clicks. Existing website artwork requires replacement confirmation. Download/open an editable project if direct transfer is unavailable.
7. Camera and Live screen open a temporary local capture tab. Choose Enable camera or Choose screen and grant access in Chrome; capture one frame to return to the toolbar popup. Camera errors show red guidance and Chrome/Windows settings help. Stop or closing this tab ends the stream. RESET opens a confirmation; Cancel keeps the current work and RESET removes retained temporary records and resets settings.

## Assets

Upload the new shared 128px transparent canvas/pencil icon, five numbered 1280x800 screenshots, 440x280 small promo and 1400x560 marquee. Icon variants use the same illustration without a surrounding green badge. Promo backgrounds remain full opaque layouts. Optional video remains blank; no hosted video is supplied.
