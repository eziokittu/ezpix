# EzPix Chrome companion architecture

Current: core/extension **0.32.0**, project v10 writer / v1-v10 readers.
Read [the current handoff](../../glitchbong/docs/ezpix-continue42.md),
[product spec](../../glitchbong/docs/ezpix-spec.md) and [core reference](../packages/core/README.md).
Website UI belongs to sibling `glitchbong` on `ezpix`; this repository uses `main`.

## Capture and local conversion

Manifest V3, minimum Chrome 120. Explicit toolbar action opens region/element/
visible-viewport capture. The isolated selector supports Escape, clips to the
viewport and removes its overlay before capture. Background verifies active tab,
document, viewport/scroll/DPR around the screenshot; cropping uses actual image
dimensions. Full screenshots cap at 16 megapixels and retained crops at four.
Iframe-containing pages are visible-pixel capture; parent hit testing must not
inspect cross-origin DOM or bypass access controls. Navigation, moved/closed tabs
or protected pages fail with a useful error rather than broaden access.

The extension tab bundles the matching shared converter and worker. Source crop,
size, sampling, palette and dither tuning stay local. PNG/project downloads work
without the website. Optional source inclusion retains the entire source image,
including outside the crop. Manual edits remain a separate editor workflow.

Permissions are exactly `activeTab` for explicit visible capture, `scripting` for
selector/viewport checks, and `alarms` for expiry cleanup. IndexedDB holds bounded
capture/selection/transfer state; there is no storage/sync or blanket host grant.
No runtime AI, account, upload, clipboard or arbitrary desktop capture is needed.
Artwork, names, palettes, source URLs, reference/clip content must not enter logs
or analytics. Website traffic collection must not be confused with image upload.

## Configured discovery and handoff

Production targets `https://glitchbong.com`; development targets localhost:3791.
The help/setup flow accepts and validates an extension ID and supports configured
discovery/absent/error states. The website cannot capture another tab or grant
activeTab. The actual toolbar action is required for capture verification.

External messaging is origin, exact editor route, top-frame, tab, random token,
protocol, engine and expiry bound. Authorized routes are `/tools/ezpix` and legacy
`/tools/ezpix/editor`; help/other paths are denied. Only fragment token/extension
ID appear in URLs, never artwork or project-specific query strings.
Protocol 1 uses 128 KiB raw/base64 chunks, a 16 MiB total cap, engine equality
and SHA-256 validation before decode. Stage and review all received data.

The destination choices are new document, matching-canvas new layer, palette
append or persistent reference. Explicit confirmation and dirty/pending-preview
guards protect manual art. Source/destination budgets and format validation run
before mutation. Palette edits do not recolour artwork. References are display-
only and persist in v10. Wrong canvas or count/budget rejection keeps current art.

Transfer state survives worker suspension. ACK follows accepted import, removes
payload bytes and retains an idempotent receipt until expiry. Closing destination
invalidates its transfer. Only one pending handoff is retained; opening another
invalidates its old token. Capture/selection/transfer records expire after ten
minutes. Clear removes retained extension records; already open converter/editor
pixels last until replaced or closed. Files are independent backups. There is
no reverse bridge, background sync or collaborative editing.

## Build and verification

`npm run build:extension` builds production and development folders. Reload the
matching unpacked extension after core changes. Website consumes a versioned
vendor tarball with lock/provenance agreement, never sibling source imports.
Both variants keep identical minimal permissions. Browser preferences/themes
are local and independent; both expose Light/Dark/System.

`phase23-e2e` verifies real toolbar activeTab capture, fixture pixels, wrong-tab/
token rejection, worker restart, transfer/ACK, import cancellation/preservation,
configured discovery and all destinations on the rebuilt package. Keep isolated
harness evidence separate from the production website. Current tests, artifact
locations and sequential reproduction are in the handoff. Additional capture,
soak and isolated-install scripts remain available; prior five-minute stress
runs do not establish endurance or minimum-device latency.

[Release verification](release-verification.md) keeps physical Android/iOS/
stylus, non-Chromium browsers, manual external editors, broader real pages,
endurance, true peak RAM/VRAM, hosted/offline behavior, packaging/licence/name
and store approval open. Local commits are authorized by the owner's cleanup
request; push, hosting/deployment and store publication require new authorization.
