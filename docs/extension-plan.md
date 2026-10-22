# EzPix Chrome companion architecture

Current: core/extension **0.133.0**, project v10 writer / v1-v10 readers.
Read [current handoff](../../glitchbong/docs/ezpix-continue145.md),
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
and store approval open. Prior cleanup commits were authorized; this feature continuation
remains uncommitted. Push, hosting/deployment and store publication require new authorization.


## Local phases 13aw-13bk - 2026-10-22

Masked clear, copy/cut to layer, selection PNG/project export and session
copy/cut are implemented. Only original members are read/cleared; holes and
exterior source bytes remain intact. Exports/buffers keep original bounds
with transparent-black holes; later paste replaces that entire rectangle,
including holes. No persistent membership metadata is added. Empty clear is
a no-op; explicit structural copy/cut still creates an undoable empty layer.
Eight transient mask controls add empty membership, X/Y mirrors, half-turn
and one-pixel shifts left/right/up/down. Shifts clip without wrapping.
Pending transforms remain intact until mutating Apply/Cut. Staged source,
lock, linked-cel, resource and history contracts remain in force.
See the current handoff for measured verification and remaining gates.


## Phases 13bl-13bz: advanced selection families

Fifteen larger feature families add contiguous wand (seed-relative tolerance,
RGB/RGBA and four/eight connectivity), global colour range, inclusive alpha
range, polygon and direct freehand lasso, square/round add/erase mask brushing,
shape combinations, configurable distance morphology/open/close, enclosed-hole
filling, connected-component filtering, tight membership bounds, 32-edit mask
Undo/Redo, four reusable named session slots, strict binary mask PNG interchange
and optional mask-aware paste preserving destination holes.

All selection generation remains within the original selection rectangle.
The Advanced selection dialog stages membership before Use membership; artwork
and pending transforms stay intact. Membership history is separate from artwork
history. Tightening requires identity pending geometry, refuses empty membership
and keeps original pixel positions. Session slots survive selection replacement
but clear on reload. Mask files contain membership only; normal project files
still omit masks. Paste selected members only is an explicit option when a
session mask or matching binary source mask PNG is available. The default full
rectangle paste remains compatible. Selected transparent pixels still replace
RGBA; nonmembers preserve destination bytes. Both share existing linked-cel,
stale-source and undo/resource guards.

Algorithms are local and deterministic in shared core; project writer remains
v10/readers v1-v10, and the companion permissions are unchanged. See the current
handoff for measured checks, remaining issues and future release gates.


## Phases 13ca-13cj: drawing workflow families

Primary/secondary RGBA inks now support alpha, swap/reset shortcuts, raw-cel or
composite sampling and legacy brush/fill/shape integration. Opt-in Advanced Pencil
adds replace/source-over and destination alpha lock, pixel-perfect cleanup, moving
average stabilization and sample spacing, wrapped/mirrored footprints, custom
selection/PNG stamps with four session slots, primary/secondary Bayer dithering,
seeded spray, palette-step shading and immutable-source blur/sharpen brushes.
Advanced drawing offers a staged path preview plus direct main-canvas strokes.
Release applies one Undo; pointer cancellation/Escape discard the transient stroke.
Legacy pencil/eraser remains available. All algorithms are shared and local;
project writer/readers stay v10/v1-v10, with unchanged companion permissions.
See current handoff for exact arithmetic, measured gates and remaining work.


## Local phases 13ck-13cy - 2026-10-22

Shared package/companion 0.133.0 adds editor command discovery/bindings, staged
geometry/raster/cel/timeline operations and display-only onion helpers. Website
integration uses the vendored package. Capture, protocol 1, retained-byte budgets,
permissions and transfer destinations remain unchanged. Exact new editor tests
and local companion regression evidence are in continuation 145. Project writer
remains v10; no account/model/upload or additional permission is introduced.
