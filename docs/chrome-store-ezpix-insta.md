# EzPIX Insta: Chrome Web Store entry sheet

Prepared 29 October 2026 for **0.464.0**. This supersedes the 0.463.0 draft
branding. Keep the same Chrome Web Store item and its assigned extension ID.
Use Package / Upload new package for `dist/release/ezpix-insta-0.464.0.zip`, then
Save draft. The manifest supplies the updated name, summary and version. If the
old item is already under review, cancel that review before replacing its package.
This document does not submit, publish or change your dashboard.

## Store listing

**Name:** EzPIX Insta

**Summary / short description (also supplied by the manifest):**

```text
Draw, animate and capture pixel art in a local Chrome studio. Edit sprites and tilemaps, then download your work. No account.
```

**Category:** Art & Design

**Language:** English

**Detailed description — paste this block:**

```text
EzPIX Insta is a local pixel-art studio for Chrome. Draw sprites, animate frames, build tilemaps or turn a page capture into a pixel asset, then download your work directly.

CREATE AND EDIT
- Draw with Pencil, Eraser, Fill, colour picker, Line, Rectangle and Ellipse.
- Choose brush size, colour and alpha. Work with layers, timed frames, Undo and Redo.
- Review selection transforms and canvas resizing, cropping, scaling, rotations and flips before applying them.
- Keep exact indexed palette slots distinct, including duplicate colours.

CAPTURE AND CONVERT
- Capture a visible page region, an element or the visible viewport after your toolbar action.
- Open local images or supported short videos. Camera and screen capture use the browser chooser.
- Review colour-based background removal, palettes, pixel-grid settings and image adjustments.
- Choose Edit in Pixel studio for manual cleanup, with Apply and Cancel before replacing artwork.

BUILD WITH SHARED TILES
- Create static RGBA tilemap layers and shared tilesets.
- Paint, fill, erase, pick and transform tile placements.
- Review shared tile edits, tile reorder/removal and rasterization, with Undo.
- Export Tiled JSON/atlas bundles or review supported single-atlas Tiled ZIP imports.

KEEP YOUR FILES
- Save editable EzPix projects. Export PNG, animated PNG, GIF, sprite sheets, frame ZIPs and the supported Aseprite subset.
- Review local project, image and supported Aseprite/Piskel imports.
- Optional on-device recovery offers explicit restore. Keep project downloads as backups.

LOCAL BY DESIGN
No account, AI, extension analytics, image upload or remote processing. Artwork processing runs inside the extension. This release works independently of the EzPIX website.

LIMITS
Pixel studio supports up to 256 pixels per axis, 16 layers, 32 frames and a 4 MiB logical cel budget. Tilemaps are static RGBA and have additional resource limits. Tiled import supports a documented single-atlas subset. Videos are limited to 8 seconds, 32 MiB and 32 sampled frames. Protected browser pages cannot be captured. Native formats support documented subsets; inspect export differences before saving.

Privacy and support: use the links on this listing.
```

**Homepage / official website:** Leave optional homepage blank for the initial
standalone launch; add the product page after it is publicly deployed.

**Support URL:** `https://glitchbong.com/contact` (HTTP 200 verified 29 October 2026).

**Privacy policy URL:** Intended location `https://glitchbong.com/tools/ezpix/privacy`.
**Do not submit that URL while it returns 404.** It returned 404 when checked
29 October 2026. Publish the prepared policy first, then check its public response
and the EzPIX Insta name. The same policy is provided as a self-contained static
HTML file in `dist/store-assets/privacy.html`, so it can be hosted separately
without releasing the full web editor. Enter its actual final HTTPS URL.

**Support/developer email:** Your existing monitored, verified developer/support
email. This is account-specific; no email address has been invented here.

## Privacy practices

**Single purpose description — paste:**

```text
Create pixel-art assets locally in Chrome, either from scratch or from user-selected images and visible-page captures, with sprite, animation and tilemap editing and direct file downloads.
```

**activeTab justification — paste:**

```text
Provides temporary access to the active tab after the user opens the extension and requests a visible-page capture. It is used to capture the selected visible region, element or viewport and to check that the target is an ordinary HTTP/HTTPS page. The extension does not read a browsing-history list or capture pages in the background.
```

**scripting justification — paste:**

```text
Runs the capture selector in the user-chosen active page, lets the user select a visible region or element, and reads viewport, scroll and device-pixel-ratio geometry to crop the screenshot accurately. The selector is removed before capture. It does not inject advertising or run continuously across sites.
```

**alarms justification — paste:**

```text
Schedules cleanup of temporary local capture/selection records, which expire after ten minutes. The same local cleanup checks also remove opted-in recovery drafts older than seven days when the extension wakes. No data is uploaded by the expiry task.
```

**Are you using remote code?** Select **No, I am not using remote code.**

If a justification field appears, paste:

```text
All executable JavaScript, workers and editing/conversion algorithms are packaged with the extension. No remotely hosted scripts, executable modules, AI models or remote processing services are loaded.
```

**Data categories — conservative disclosures for the inspected production code:**

| Field | Select | What the code handles |
| --- | --- | --- |
| Personally identifiable information | No / unchecked | No identity/contact-detail collection feature. |
| Health information | No / unchecked | No health-data collection feature. |
| Financial and payment information | No / unchecked | No payment/billing collection feature. |
| Authentication information | No / unchecked | No login, password, cookie or credential collection feature. |
| Personal communications | No / unchecked | No message/email collection feature. |
| Location | No / unchecked | No location API or location tracking. |
| Web history | Yes / checked | Only the active page URL is checked transiently to permit HTTP/HTTPS capture. No visited-page history list, URL log or background tracking. |
| User activity | Yes / checked | User-requested capture/editor gestures and temporary viewport/scroll/crop geometry, processed locally. No behavioural analytics or background keystroke/click tracking. |
| Website content | Yes / checked | User-selected screenshots and image/video/artwork content, processed locally. |

These category mappings are deliberately conservative: Google's user-data FAQ
requires disclosure even for local-only processing. The category selections do
not mean data is sent to the developer. They describe the narrow local handling
above; do not describe this product as handling no user data. User-selected images
can incidentally contain personal information; the extension does not extract
those personal fields. The published privacy policy explains the source choice.

If the dashboard asks whether data is sold or transferred to third parties:
**No**. If it asks about unrelated purposes, advertising, or creditworthiness:
**No**. Check the three certification boxes confirming that data is not sold or
transferred outside approved uses, is not used for unrelated purposes, and is not
used to determine creditworthiness/lending eligibility. The owner must confirm
these statements remain true for their actual operation; no developer telemetry
or advertising endpoint exists in this package.

## Distribution

- **Visibility:** Public for the intended public launch. Use a restricted testing
  visibility first only if you want a tester release.
- **Pricing / purchases, if shown:** Free; this build has no paid unlock or in-app purchases.
- **Regions:** Select the countries where you intend to offer/support it; all
  available regions is a reasonable default for this English local utility.
- **Mature content, if asked:** No; the provided app/listing assets are general-audience.
- **Publish automatically after approval:** Off for a final manual release check.

## Reviewer test instructions — paste

```text
No account, login, subscription or external editor is required.

1. Pin EzPIX Insta and open its toolbar popup. Choose Open Pixel studio.
2. Draw on the blank canvas. Use Undo/Redo, add a layer, duplicate a frame and change its duration. Download an editable project, reopen it and review Apply/Cancel.
3. On an ordinary HTTP/HTTPS webpage, use Select area on this page, Pick an element or Visible page. Region selection supports Escape. Protected browser pages cannot be captured.
4. In Capture & convert, adjust the palette/grid or open a local image. Download an asset, or choose Edit in Pixel studio and review the replacement. Camera/screen access starts only through the browser chooser and can be cancelled.
5. In Pixel studio, expand Tilemap layers. On a raw RGBA sprite choose tile dimensions dividing the canvas, then review Create tilemap from sprite. Paint tile references, edit a shared tile, and use Undo. Game tilemap exchange supports local export and reviewed single-atlas Tiled ZIP import on matching canvases.
6. Local recovery is off by default. Opt in under Local recovery, save an edit, reload and use Review saved drafts for an explicit restore. Downloads are the backup method.

All artwork processing is local. Production website transfer is disabled in this release. There are no special credentials, paid gates, remote executable code or developer upload endpoints. Camera and screen capture are optional and do not block ordinary file editing.
```

## Graphic assets to upload

Files in `dist/store-assets/`:

- `ezpix-insta-icon-128.png`: store icon, 128x128, original pixel canvas and pencil mark.
- `01-pixel-studio-1280x800.png`: main editor.
- `02-layers-animation-1280x800.png`: frames and timing.
- `03-shared-tilemaps-1280x800.png`: map editing/shared tiles.
- `04-capture-convert-1280x800.png`: capture/image conversion UI.
- `privacy.html`: public-policy hosting source, not a screenshot or extension ZIP.
- `ARTWORK.txt`: original artwork provenance, not a store upload field.

All four screenshots are actual production-extension UI, with original authored
test artwork. Small promo tile (440x280), marquee (1400x560) and video are optional;
leave those fields blank until suitable assets are prepared. No old branding
screenshots should be uploaded to the renamed listing.

## Official references

- [Listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Local data/privacy FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq?authuser=8)
- [Image sizes](https://developer.chrome.com/docs/webstore/images)
- [Publishing/deferred publication](https://developer.chrome.com/docs/webstore/publish)

Dashboard field labels can change. These entries are based on the named build
and official documentation checked on the preparation date. Do not submit until
the public privacy URL works and the final displayed dashboard fields match this
package. No store approval is asserted.
