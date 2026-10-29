# Current extension-first candidate, 29 October 2026

Version **0.463.0**. Run `npm run release:local`. Current ZIP:
`dist/release/ezpix-snapforge-0.463.0.zip`; exact size/hash/file allowlist are in
its adjacent JSON. Do not use the historical 0.460.0 hash below for this version.

The product now includes a packaged offline manual Pixel studio. Suggested listing:

**Name:** EzPix SnapForge

**Summary:** Capture, draw and animate pixel assets in a local studio. Editable layers, exact palettes and direct downloads. No account.

**Description:** Capture a visible page region, element or viewport. Refine its
cutout, palette and pixel grid, then use Edit in Pixel studio for manual cleanup.
Create sprites from scratch with Pencil, Eraser, Fill, Pick, shapes, selection
move/copy/flip/rotation/scale and reviewed canvas geometry. Edit layers and timed
animation frames with Undo/Redo. Paint static RGBA tilemaps using shared tilesets,
flip/rotate placements, review shared tile edits and download a Tiled map/atlas
bundle with the full editable EzPix project. Review single-atlas Tiled ZIP imports
to add editable map layers to a matching canvas. Open editable EzPix projects, supported Aseprite/
Piskel files and local images. Download PNG, APNG, GIF, sheets, frame ZIPs or
editable projects directly. The website is optional. All artwork processing is
local, without AI, image uploads, accounts or extension analytics.

Studio limits: 256px per axis, 16 layers, 32 frames, 4 MiB cel storage. Video:
eight seconds / 32 MiB / 32 sampled frames. Native formats support documented
subsets. Visible-page capture excludes protected browser pages. Optional recovery
retains four recent drafts / 8 MiB / seven days on this device with explicit restore.

Prepared public product route: `/tools/ezpix/extension`; policy route:
`/tools/ezpix/privacy`. Verify their actual HTTPS hosting before entering them in
the dashboard. The bundled privacy.html works offline. Runtime permissions remain
activeTab/scripting/alarms. IndexedDB recovery adds no permission or remote service.

`artifacts/studio-release/pixel-studio-desktop.png` shows the actual manual editor;
`artifacts/issues4/store/` retains actual 1280x800 capture/conversion screenshots.
Review the current binary, screenshots and dashboard declarations together.

Official policy references rechecked 29 October 2026:
[privacy policy FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
[program policies](https://developer.chrome.com/docs/webstore/program-policies/policies).
Local-only handling still needs accurate privacy disclosures. Nothing here means
Google has reviewed or approved this candidate.

Unclosed gates: product licence/name decision; deploy matching website 0.461.0
and privacy route; assigned store ID and production discovery/handoff/update;
representative permitted sites/OS/Chrome versions; owner account declarations and
explicit submission authorisation. Full details: [current handoff](../../glitchbong/docs/ezpix-release-local.md).

---

The following is historical 0.460.0 preparation evidence:

# SnapForge upload candidate

Prepared 2026-10-27, Asia/Calcutta. Version **0.460.0**.

Run `npm run package:extension` from this repository. Upload candidate:
`dist/release/ezpix-snapforge-0.460.0.zip`. Its manifest is at the archive root.
The adjacent JSON contains the exact file list and SHA-256. Do not upload
`extension-dev`, a source checkout, a browser profile, or the enclosing folder.
Packaging checks the production origin, engine version, file allowlist and the
three permissions. `scripts/phase481-500-release.py` verifies every ZIP entry
against the production folder using Python's independent ZIP/CRC implementation.

Current archive: **279,330 bytes**, SHA-256
`b0204ee25b4bd49697ea6e2d1fb6ab3ce21058d27b11849192b7a0f891147b3f`.
The fifteen-file production archive and real unpacked capture/explicit editor
transfer passed local checks; see [handoff 500](../../glitchbong/docs/ezpix-continue500.md).

## Listing text

**Name:** EzPix SnapForge

**Summary:** Capture, cut out and style pixel assets. Download images and animations directly, entirely on your device.

**Description:**

Turn a visible page region, element or viewport into a pixel asset. Open the
toolbar, choose what to capture, then refine it in the local Focus studio.
Open your own image or short video, or use the browser's camera and screen
chooser. Select an object, adjust background removal, choose a colour palette
and tune the pixel grid. Background removal uses colour rules and a selection;
inspect the result before saving.

Download PNG, animated PNG, GIF, sprite sheets or an editable EzPix project.
You can also explicitly send a project to the GlitchBong EzPix editor. Standalone
downloads work without opening the website. No account, AI or image upload is
needed. Protected browser pages cannot be captured.

Video input is bounded to eight seconds, 32 MiB and 32 sampled frames. Pixel
output is at most 256 pixels per axis. This is a visible-page capture tool,
not an automatic full-page screenshot service.

## Privacy practice fields to review against the submitted binary

- **Single purpose:** Capture and locally prepare pixel assets for download or
  explicit import into EzPix.
- **activeTab justification:** Allows visible capture of the active page only
  following a toolbar action.
- **scripting justification:** Shows the capture selector, measures the visible
  region and removes the overlay before capture.
- **alarms justification:** Expires temporary locally retained capture/transfer
  records.
- **Remote code:** No. Executable code and workers are packaged in the extension.
- **Collection/transmission:** The extension has no developer analytics or remote
  processing endpoint. Captures, source URLs and projects are used locally;
  an explicit handoff uses Chrome messaging to the authorised editor tab.
  Review the exact current dashboard wording before choosing its checkboxes.
- **Privacy policy:** The bundled `privacy.html` is available offline. A public
  HTTPS copy must be hosted and entered in the dashboard before submission.
  Do not use an invented or unverified URL.

Actual 1280x800 product screenshots are generated by `scripts/issues4-extension.mjs`
under `artifacts/issues4/store/`. Copy approved screenshots into the listing;
they are not bundled runtime assets.

## Separate release gates

The upload candidate does not establish publication readiness. Before submitting:

1. Resolve the product licence and name decision. Do not silently assign a
   product licence from a dependency or from the CC0 starter artwork.
2. Deploy the website engine **0.460.0**, host the privacy policy, configure the
   assigned store extension ID and verify production discovery/handoff. Engine
   mismatch deliberately refuses transfer; standalone download remains available.
3. Verify stable Chrome installation/update with the actual store ID, intended
   supported Chrome/OS versions and representative permitted real websites.
4. Review the listing, screenshots and current privacy/developer declarations;
   register/select the owner's developer account and complete its required fields.
5. Authorise submission separately. No upload, account change, payment or
   submission was performed by this batch. Store approval is an external outcome.

Official references checked on 2026-10-27:
[publication](https://developer.chrome.com/docs/webstore/publish),
[listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing),
[privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy),
[listing images](https://developer.chrome.com/docs/webstore/images).
