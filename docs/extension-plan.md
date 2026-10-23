# EzPix Chrome companion architecture

Current: core/extension **0.190.0**, project v13 writer / v1-v13 readers.
Read [current handoff](../../glitchbong/docs/ezpix-continue202.md),
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

Historical package/companion 0.133.0 added editor command discovery/bindings, staged
geometry/raster/cel/timeline operations and display-only onion helpers. Website
integration uses the vendored package. Capture, protocol 1, retained-byte budgets,
permissions and transfer destinations remain unchanged. Exact new editor tests
and local companion regression evidence are in continuation 145. Project writer
remains v10; no account/model/upload or additional permission is introduced.


## Local phases 13cz-13dd

Historical core/companion 0.138.0 added direct canvas helpers, bounded view guides,
shortcut migration and the website's same-document split preview. Writer stays
v10/readers v1-v10; capture protocol/permissions remain unchanged. See current
handoff150 for exact local evidence. Physical devices/stylus, broader browsers,
external human roundtrips, endurance/true peak memory, licence/name, hosted/offline
updates and store gates remain open. The five new phases remain uncommitted.

## Local phases 13de-13dn

Core/companion 0.148.0 retains writer v10/readers v1-v10 and the same minimal
capture permissions. The shared engine now supports pressure-aware brushes,
authored bitmap text, isometric construction, transform pivots/bilinear sampling
and baked motion/mosaic/posterization/edge/noise filters. Website controls consume
the versioned core. These changes do not add capture permissions or a live
layer-effect stack. Current contracts/evidence and remaining gates are in
[handoff 160](../../glitchbong/docs/ezpix-continue192.md). Physical pen and release
checks remain separate. The batch is uncommitted and unpublished.


## Local phases 13do-13dx - soft selection workflows and baked tween

Core/companion 0.158.0 adds a separate full-canvas byte coverage workflow:
capture/feather; algebra/levels; soft mask brush with cancellation and keyboard
paths; weighted fill/erase/alpha; affine and perspective transforms with pivots
and nearest/bilinear sampling; existing shared filters through coverage; grayscale
RGB PNG exchange and four session slots; tight/full raw-cel PNG/project extraction.
Coverage stays outside v10 projects and never reinterprets old binary masks.
Baked transform tweening adds angle, uniform scale, translation, easing and an
end-frame preview over existing target frames. Each target becomes independent;
outside linked peers remain intact. This does not add live keyframes/effect stacks.

All editing remains local/deterministic, guarded by source/locks/budgets and
atomic artwork Undo. Coverage history is separate. Current evidence and remaining
feature/device/release gates are in [handoff 170](../../glitchbong/docs/ezpix-continue192.md). This batch is uncommitted; no push,
deployment or publication was requested. Existing historical completion estimates
have not been mechanically changed.


## Local phases 13dy-13dz (0.180.0)

Website layer blends and checked-layer metadata/duplicate/delete/group/reorder
batches use the authoritative shared core. Writer v11 retains blend metadata;
readers v1-v10 migrate to Normal. Capture protocol, conversion semantics and
minimal permissions stay unchanged. Blend-aware composites reach previews and
flattened exports; unsupported layered native export rejects explicit loss.
See sibling `glitchbong/docs/ezpix-continue192.md` and `ezpix-progress.md` for
current evidence, remaining phase estimates and separate release gates.


## Phases 193-197 / 13eu-13ey: local image exchange

Core/companion 0.185.0 adds animated GIF export/import, BMP/QOI exchange and
static SVG pixel-rectangle export. Website Asset exports supports these formats
and existing presets/batches. Native exchange stages GIF/BMP/QOI imports; the
shared converter/companion supports BMP/QOI sources and reviewed two-step image
downloads. It retains converted artwork, editable-project fallback and the real
website handoff. No dependency, permission or project schema was added.

Pure APIs: `exportGif`, `decodeGif`, `encodeBmp`, `decodeBmp`, `encodeQoi`,
`decodeQoi`, `encodePixelSvg`, `rasterImport`; new `AssetExportOptions.format`
values `gif`, `bmp`, `qoi`, `svg` work with existing preset and batch APIs.
GIF uses full-canvas frames, disposal 2, transparent index 0, alpha cutoff 128,
nearest 10 ms timing and an exact palette up to 255 visible RGBs, otherwise a
fixed 6x7x6 grid. Plays 0 loops forever; plays 1 omits the Netscape extension;
other counts encode repeats=plays-1. Literal LZW clears every 200 indices, trading
compression efficiency for bounded predictable output. Decoder supports dynamic
LZW up to 4096 entries, deferred clear, local tables, offsets, interlace and
restore-background/previous disposal. Input sub-blocks are counted before exact
allocation. Unsupported graphic controls/plain text fail. Loops/comments/app data
are omitted with review. Imported timing clamps to 20-5000 ms.

Inputs cap at 16 MiB, 256 pixels/axis, 32 frames and 4 MiB cel pixels. Exports cap
at one megapixel/image, GIF at 16 MiB decoded/8 MiB encoded, SVG at 65536 scaled
pixels. BMP writes top-down sRGB V4 BGRA with explicit channel masks; reads
uncompressed RGB24/32 (BI_RGB32 ignores undefined alpha) and standard V4/V5 RGBA
masks; embedded/calibrated profiles and other compression fail. QOI is straight
RGBA, all standard chunk types decode, header colorspace 0 only; its encoder
uses RGB/RGBA and runs. SVG includes numeric rectangles/colour/opacity only, no
imported strings, script, external resources or tracing. Static exports choose
the active frame unless a named range selects its first playback frame. They
omit animation and project metadata. References never enter exported artwork.

Reproduce with `node scripts/phase13euey-independent.mjs` and, after the website
production build, `node scripts/phase13euey-ui.mjs`. Set `EZPIX_QA_RASTER=1` and
`EZPIX_QA_PHASE8D=1` for `node scripts/phase23-e2e.mjs` to include real companion
image downloads/BMP-QOI source import alongside toolbar capture/transfer tests.
Physical devices, human external editors, minimum-hardware/performance, licence,
hosted/offline/update and store publication remain separate open gates.


## Phases 198-202 / 13ez-13fd: legacy raster, icon/cursor and APNG import

Shared core/companion 0.190.0, project writer/readers v13/v1-v13. New pure APIs:
`encodeTga`/`decodeTga`, `encodePcx`/`decodePcx`, `encodeIcon`/`decodeIcon`,
`inspectIcon`, `decodeApng`. Asset export formats now include `tga`, `pcx`,
`ico`, `cur`. Optional preset fields `hotspotX`/`hotspotY` default to zero;
older seven-field presets remain valid. Hotspots use source-canvas coordinates
and scale with nearest image scaling. Export rejects out-of-canvas hotspots.

TGA: top-left raw BGRA32 with eight attribute bits and zero-offset TGA2 footer;
reads raw/RLE RGB24, RGBA32, grayscale8 and all four origins. Colour maps,
interleave, extension/developer areas and alternate alpha semantics fail.
32-bit descriptor alpha=0 is treated as opaque, alpha=8 as straight alpha.
PCX: ZSoft v5 RLE RGB24 export, even scanline padding, alpha flattened onto white.
Decoder supports v5 8-bit indexed plus trailing 256-colour palette, or RGB24
three-plane data. It checks scanline run bounds; indexed input becomes RGBA,
not an indexed document mode. Both static imports cap at 256 pixels/axis,
16 MiB input. Exports cap at one megapixel within existing bundle budgets.

ICO/CUR: one PNG-backed image export; 1-16 PNG-backed resource alternatives on
import, 1-256 pixels/axis, at most 4 MiB declared RGBA across the directory,
16 MiB input. Directory dimensions, ranges, nonoverlap, reserved fields and
hotspots validate before selected-resource PNG decoding. Legacy DIB resources
fail explicitly. Alternatives are selected independently, never made into an
animation. CUR export stores scaled hotspots; selected CUR import retains its
hotspot as a full-canvas `Cursor hotspot` slice pivot. Export coordinates must
be set explicitly. This does not install or change an operating-system cursor.

APNG: PNG3 non-interlaced 8-bit RGB/RGBA/indexed subset inherited from the bounded
PNG decoder. Validates all original CRCs, chunk order, acTL/fcTL/fdAT sequences,
frame bounds/count and 4 MiB cel budget before frame inflation. At most 32 frames,
256 pixels/axis, 4096 chunks and 16 MiB input. Composes SOURCE/OVER and NONE/
BACKGROUND/PREVIOUS; OVER uses exact integer numerator/denominator and nearest
byte rounding at each frame boundary. The default static fallback is validated
and omitted when not an animation frame. Duration fractions round to whole ms
and clamp to 20-5000 with review. Loop and source metadata are omitted. Custom
profiles, interlacing, 16-bit samples and unsupported chunks fail explicitly.

Website imports use the existing staged native-file review/replacement and
unsaved-art confirmation; replacing is a new document, not artwork Undo. New
exports use Prepare/Download, device/portable presets and batch ZIP contracts.
The shared converter/Chrome companion adds TGA/PCX sources and reviewed TGA/
PCX/ICO/CUR downloads. Hotspot edits invalidate even in-flight asynchronous
preparation. Full animation/resource-selection imports remain editor workflows.
No new runtime dependencies, permissions, AI, telemetry or image uploads.

Reproduce: `node scripts/phase13ezfd-independent.mjs`, then after website build
`node scripts/phase13ezfd-ui.mjs`. Real companion QA adds `EZPIX_QA_LEGACY=1`
to `EZPIX_QA_PHASE8D=1` for `node scripts/phase23-e2e.mjs`. Run browser suites
sequentially on port 3791. `phase13ezfd-report.mjs` aggregates current package,
final build and fresh browser/integration results. Human external-app/OS cursor,
physical devices, browser diversity, endurance/performance and release gates
remain separate. See current handoff for exact recorded verification.
