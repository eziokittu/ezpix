# EzPix remaining release verification worksheet

Current local evidence is in
[current local rework](../../glitchbong/docs/ezpix-issues3-local.md). This worksheet records
remaining manual gates; its presence does not mean any row passed. Use original
fixtures, keep captures local, and record actual hardware, OS/browser versions,
date, result and artifact location for each run. Never attach personal artwork,
page URLs or project contents to analytics or public issue logs.

| Gate | Concrete exercise | Expected result | Evidence/status |
| --- | --- | --- | --- |
| Android website | Real phone: pencil/eraser, drag outside canvas, cancel gesture, pinch/scroll around editor, undo, PNG and project download/reopen | Intentional pixels; page navigation remains usable; exported pixels and reopened project match | Not performed |
| iPhone/iPad website | Safari: conversion presets/trim, draw, sheet import/export, tile-map scroll and stamps, download/reopen through Files | Controls reachable; no accidental gesture commits; files reopen without silent loss | Not performed |
| Physical stylus | Named tablet/pen: tap, fast stroke, leave/re-enter canvas, pointer cancellation, UI scroll, undo | Stroke boundaries and undo behave correctly; no stuck gesture | Not performed; browser force simulation verifies the implemented response, not physical hardware |
| Interruption/recovery | Save a sprite checkpoint and separate map checkpoint, background app, OS-close browser, reopen and explicitly restore; exercise two tabs | Restore only committed work; checkpoints remain independent; writer conflict explains backup option | Not performed on physical devices |
| Resource pressure | 256-square document with four layers/four frames at cel budget; draw/undo, sheets and map exports; low-memory interruption | Bound rejection preserves existing art; no silent replacement or corrupt checkpoint | Not performed on minimum hardware |
| Non-Chromium browsers | Current Firefox and Safari on named machines: conversion worker, drawing, project/PNG, sheets, tiles, native visibility and recovery | Correct pixels/files, usable layout and clear unsupported-feature errors | Not performed; Chrome/Edge are not this gate |
| Longer endurance | At least one hour on representative hardware alternating drawing, layer/frame edits, conversion/source replacement, maps, save/export/restore | No stuck input, runaway accumulation or data loss; record first/last latency distributions | Not performed; phase 7a has five minutes per conversion surface |
| Full memory profiling | Record browser/renderer/worker/GPU-process memory, allocation lifecycle after cancel/close, true process peaks and GPU VRAM separately | Evidence-backed budgets; explain sharing, GC controls and sampling limits | Partial: phase 7a sampled whole-browser Windows process memory; no VRAM/continuous-peak proof |
| Stroke latency | Real pointer/stylus input to completed canvas paint on named refresh-rate hardware, near supported document limits | Measured median/p95, with capture method and dropped frames disclosed | Not performed; ArrowRight-to-RAF is a different measurement |
| Capture real-page matrix | Desktop Chrome: zoom/scroll, iframe-containing pages, navigation/tab change during capture, restricted pages, rapid retries, closed handoff tab | Correct visible pixels or useful error; no permission expansion; project-download fallback works | Partial: original-fixture automated matrix and prior handoff tests passed |
| Local retention | Clear extension data, wait expiry, restart worker/browser, retry stale token, confirm file backups survive | Expired/cleared capture and transfer inaccessible; downloaded files remain independent | Existing automated protocol checks; real-profile/manual review pending |
| Candidate packaging | Inspect production manifest/origin/CSP/permissions, archive contents, versions, core provenance, no secrets/test profiles/source captures | Only intended release files; minimal permissions; matching shared engine | Pending release-candidate phase |
| Licensing/name | Review exact dependency/artwork licences and product/name clearance | Written owner-reviewed decision before distribution | Not performed |
| Hosted/store release | Review concrete candidate, hosted smoke, privacy/support listings and store package | Separate explicit owner authorization and actual hosted/store evidence | Not authorized or performed |

Chrome extension capture is a desktop workflow. Phone/tablet website tests do
not establish mobile Chrome extension support. Protected-content failures must
remain failures with clear recovery; do not bypass access controls.

Repeat local automated checks sequentially after the production website build:
`phase7a-capture.mjs`, `phase23-e2e.mjs`, `phase7a-browsers.mjs`, then the
five-minute-per-surface `phase7a-soak.mjs` and `summarize-soak.mjs`. Keep CPU-heavy
builds and other browser suites out of timing runs. Do not overwrite the older
0.7.0 baseline with a current build and label it historical evidence.


## Current local evidence

Core/extension 0.158.0 writes v10 and reads v1-v10. Latest implementation verification:
268 core/protocol tests, independent numerical/native checks, production TypeScript
and 1,245-page build, 62 ad-route checks, staged browser downloads/recovery and real
unpacked-extension capture/handoff. Full details and ignored artifact locations are
in the current handoff. These checks do not close any unperformed gate in the table.
The progress estimate is a planning range, not a release-readiness score.

The owner authorized documentation cleanup and local commits only. Push, hosted
repository creation, deployment and store submission require separate authorization.


## Local 13e-13h evidence update

Core/extension 0.38.0 adds exact sprite quarter turns/flips and rectangular
selection quarter turns/nearest scaling. Continuation 50 records
181 passing core/protocol tests, 840 independent transform cases, native-reader
checks, production build, all five sprite-direction browser modes, selection
browser/download/recovery/narrow checks, prior geometry oracles/regressions and
real toolbar activeTab companion handoff. These are local automated checks.
All existing physical-device, external-app manual, endurance, memory, licensing,
hosted/offline/update and store gates remain open. No publication was performed.


## Local 13i/13j evidence update

Core/extension 0.40.0 adds staged original-rectangle RGBA selection fill and
square-cornered inset stroke. Continuation 52 records 193 passing core/protocol
tests, 320 independent full-canvas paint cases, raw native-reader checks,
production TypeScript/build and 62 route-policy checks, both paint browser modes
with actual downloads/undo/recovery/320px Apply, selection-transform and linked-
cel regressions, and the real toolbar activeTab companion handoff/restart flow.
These are local automated checks. Physical devices, manual external editors,
endurance/peak memory, licensing/name, hosted/offline/update and store approval
remain separate open gates. No publication or commit was performed.


## Local 13k-13o evidence update

Core/extension 0.45.0 adds staged original-rectangle copy/cut to layer, zero-RGBA
clear, raw RGBA PNG download and cropped independent EzPix project download.
Continuation 57 records 208 core/protocol tests, 305 independent whole-output
cases including 256px selections, raw Pillow PNG and native-reader checks,
production TypeScript/build and 62 route-policy checks, all five browser modes
with actual downloads/undo/recovery/320px controls, existing selection and linked-
cel regressions, and the real toolbar activeTab companion handoff/restart flow.
These are local automated checks. Physical devices, external-editor manual use,
endurance/peak memory, licensing/name, hosted/offline/update and store approval
remain separate open gates. No commit or publication was performed.


## Local 13p-13t evidence update

Core/extension 0.50.0 adds cropped/larger EzPix project paste, current-cel paste
and one in-memory session Copy/Cut/Paste buffer. Continuation 62 records 221
core/protocol tests, 242 independent paste cases including 256px output,
raw native-reader checks, TypeScript/1,245-page production build and 62 route
checks, all five browser modes with actual files/undo/recovery/320px controls,
buffer survival across project replacement and clearing on reload, existing
selection/linked-cel regressions, and the real toolbar activeTab capture/handoff/
worker restart flow. These are local automated gates. Physical devices, manual
external editors, peak memory/endurance, licensing/name, hosted/offline/update
and store approval remain open. No commit or publication was performed.


## Local 13u-13ab evidence update

Core/extension 0.58.0 adds eight staged rectangular families: linear/dithered/
squared-radial RGBA gradients, checker fill, exact RGBA replacement, integer
grayscale, RGB inversion and alpha scaling. Continuation 70 records 236 passing
core/protocol tests, 648 independent Fraction/geometric/Bayer/raw-output cases,
all eight native-reader checks, TypeScript/1,245-page build and 62 route checks,
all eight production-browser modes with exact project downloads/Undo/recovery/
320px Apply and long-menu access, existing workflow regressions, and real toolbar
activeTab capture/handoff/worker restart/destination checks. Canvas preview alpha
normalization is kept separate from raw stored-RGBA evidence. These are local
automated gates; physical devices, manual external editors, peak memory/endurance,
licensing/name, hosted/offline/update and store approval remain open. No commit
or publication was performed. Historical version labels above retain their
original per-batch versions rather than relabelling old evidence as current.

## Local 13ac-13al evidence update

Core/extension 0.68.0 adds ten bounded transient binary mask operations. Exact
membership and RGBA sampling share one raster mapping; unsupported rectangular
paint/effects/buffer/selection exports disable explicitly. Current handoff 80
records local tests and evidence separately from the unperformed physical,
manual-app, performance, hosted, licensing and store gates above. No release
permission follows from implementing these features.

## Local 13am-13av evidence update

Core/extension 0.118.0 adapts solid fill, inner four-neighbour stroke and all eight
selection colour operations to binary masks. Copied membership, regenerated
Apply, exact original-bounds sampling, holes and existing history/link/budget
contracts are covered by current handoff 90. Buffer/extraction/clear/selection
exports remain held for masks. No manual/physical, licensing or publication
gate above is closed by these local feature and automated checks.


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


## Local command/geometry/animation batch 13ck-13cy

Current core/companion 0.133.0 retains v10 writing/v1-v10 reading and identical
activeTab/scripting/alarms permissions. Command discovery/configuration, thirteen
staged raster/cel/timeline families and display-only expanded onion skins are
implemented. Local evidence and reproducible commands are consolidated in
[current local rework](../../glitchbong/docs/ezpix-issues3-local.md). Numeric geometry controls are
not canvas transform handles, text/fonts, live effects or document mode support.
All physical devices/stylus, other browsers, external human application/engine
roundtrips, endurance, actual peak memory, minimum hardware, licensing/name,
hosted/offline/update, store packaging and approval gates remain open. No release,
commit, push or deployment was authorized by this continuation request.


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
handoff 160 ([phase history](../../glitchbong/docs/ezpix-progress.md)). Physical pen and release
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
feature/device/release gates are in handoff 170 ([phase history](../../glitchbong/docs/ezpix-progress.md)). This batch is uncommitted; no push,
deployment or publication was requested. Existing historical completion estimates
have not been mechanically changed.


## Local phases 13dy-13dz

Layer blends and checked-layer batches use core/companion 0.160.0, writer v11
and readers v1-v11. These editor additions do not close any manual release row.
Current local tests, independent readers and real unpacked-toolbar integration
are recorded in handoff 172 ([phase history](../../glitchbong/docs/ezpix-progress.md)).
Website feature allowance is 18-26 further substantial phases plus 5-8 release
phases. Companion allowance is 0-2 feature gaps plus 4-6 integration/release
phases, with shared release gates overlapping. These estimates are scope-based,
not a measured completion score or store approval promise.


## Current authored-layer/export continuation (183-192)

See handoff 192 ([phase history](../../glitchbong/docs/ezpix-progress.md)) for current automated
evidence at core/companion 0.180.0 and project writer v13/readers v1-v13. Include
reference tracing, live text/adjustment/group effects, cel-grid drag/tap, palette
locks, slices/pivots, APNG and preset ZIPs in physical/manual testing. Independent
PNG/ZIP/PSD/ORA readers do not establish human external-app or engine integration.
All manual gate rows above remain open. Current scope estimate is in
[progress](../../glitchbong/docs/ezpix-progress.md).


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


## Phases 203-205 / 13fe-13fg: document output and exact PNG exchange

Core/companion 0.203.0, project writer v14/readers v1-v14. This finishes the
requested eight-phase span 198-205 from handoff 197; phases 198-202 already lived
in the committed baseline and were preserved. Only 203-205 are new in this batch.

`PixelDocument.outputMode` is absent for RGBA, `grayscale` or `palette`. It is a
persistent **composite-output transform**, applied once after visible layers,
groups, adjustments/effects and normal byte quantization. Source RGBA cels,
text/effect colours, links, hidden pixels, references and palette metadata remain
editable and unchanged. It is not grayscale/indexed storage editing, profile
management or inferred native colour mode. Raw-cel operations/previews use source
colours. Palette edits can change palette-output appearance without rewriting
source cels. References/tracing retain their original colours.

Grayscale uses `floor((299*r+587*g+114*b+500)/1000)` on encoded RGB bytes. Palette
output minimizes squared encoded RGB distance to project swatches, first slot
wins ties; duplicate swatches remain distinct palette slots. Both preserve alpha;
transparent composite pixels remain transparent black. `prepareDocumentOutput`
copies its source and hides mode intent in a WeakMap; Apply regenerates, rejects
stale/fake plans, preflights the 512-byte history command and makes one Undoable
mode change. Same-mode requests preserve redo. Painting/structural/palette history
remain separate commands and retain mode through their own undo/redo.

v14 validates output metadata before cel/reference allocation. v1-v13 readers
ignore the new field and migrate to RGBA output. Saving/recovery/handoff retains
v14 metadata. Layered Aseprite/Piskel and selected-frame layered PSD/ORA reject
unsupported output loss. Explicit PSD/ORA frames-as-flattened-layers bakes each
frame and removes the mode, with warnings. PNG/APNG/GIF/assets/clips use normal
visible compositing, so they bake the output transform. Raw-cel exports remain
source workflows; keep a complete EzPix project as the editable backup.

`encodeModePng` writes non-interlaced 8-bit grayscale+alpha (type 4), requiring
already-gray pixels, or exact indexed PNG (type 3) with first-appearance RGBA
entries, PLTE and tRNS. Identical RGB at different alpha uses distinct entries.
More than 256 RGBA entries rejects rather than quantizing alpha or colours.
Maximum export one megapixel/8 MiB encoded. Asset formats `gray-png` and
`indexed-png` integrate with reviewed Prepare/Download, portable presets and batch
ZIPs. `decodePngProject` imports bounded static 8-bit gray/gray-alpha/indexed/RGB/
RGBA PNG into RGBA, or delegates APNG to its animation decoder. Static imports
are 16 MiB/256px per axis with exact streaming decompression/CRC checks. Custom
profiles, interlacing, 16-bit and sub-byte samples remain unsupported. PNG indices
and inferred output mode are not retained as indexed storage. Shared PNG decode
now supports grayscale types 0/4 and optional grayscale tRNS, preserving bytes.

The editor exposes Image / Document output and command search. Prepare/Apply/
Discard requires explicit retained-source review. The shared converter/companion
adds reviewed output choice (palette means default project swatches), exact gray/
indexed PNG exports and v14 project/handoff preservation. Its existing ordinary
PNG/JPEG source path remains the browser decoder; exact PNG import belongs to
editor native exchange. No new runtime dependency, permission, telemetry or AI.

Reproduce `phase13fefg-independent.mjs`, `phase13fefg-ui.mjs`, then real companion
`phase23-e2e.mjs` with `EZPIX_QA_OUTPUT=1` and `EZPIX_QA_PHASE8D=1` after builds.
Aggregate: `phase13fefg-report.mjs`. Physical/device/browser diversity, human native
app/engine roundtrips, endurance/performance, licence/name and hosted/store gates
remain open, along with an exhaustive Aseprite feature audit.


## Source colours and document workspace (206-215)

Explicit grayscale source conversion now changes all raw cel RGB, editable text
and project palette colours with linked-aware atomic Undo. References/conversion
images remain original. It resets composite output to RGBA and does not constrain
future painting or introduce true grayscale/indexed storage editing.

Four document tabs retain independent histories. Workspace tools offer reviewed
new/copy/file/close lifecycle, separate all-document recovery, bounded JSON/ZIP
workspace exchange, raw layer/flattened frame/palette/reference transfers, a
portable/device authored-project library and multi-document asset ZIPs. Restoring
workspace files/checkpoints starts empty histories; ordinary File import still
replaces the active tab. Original issue inputs, minimal companion permissions and
local deterministic processing remain unchanged. See the
[current local rework](../../glitchbong/docs/ezpix-issues3-local.md) for exact limits and evidence. Physical devices,
Firefox/Safari, human external-app/engine use, endurance/true peak memory/minimum
hardware, licence/name and hosted/offline/update/store gates remain open.

## Grayscale editing policy continuation (216-222)

Core/companion 0.210.0 writes v15 and reads v1-v15. Local source tests,
independent readers, production policy UI and real toolbar integration are
recorded in handoff 222, with explicit build IDs for the older unchanged
regression scopes. This closes a bounded constrained grayscale editing policy
in RGBA storage. True gray-channel/indexed storage and colour profiles remain
open. All physical-device, external-app, endurance/memory/hardware, licence/name,
hosted/update/offline and store gates above remain separate and unperformed.
No commit, push, deployment or publication was authorized.

## Indexed cel contract and exchange (223-224)

Core/companion 0.212.0 retains project writer/readers v15/v1-v15. The separate
`ezpix-indexed-cel` v1 envelope holds width/height (1-256), 1-256 ordered RGBA
slots, a canonical base64 Uint8 index plane and `transparentIndex` (null or one
slot). Exactly the designated slot has alpha zero; all other slots have alpha
1-255. Duplicate opaque/partial-alpha and unused slots are legal and retained.
No reserved index is implied when transparency is absent. Encoded files cap at
128 KiB; strict schema, byte count and palette-index validation run before use.

`reorderIndexedSlots` accepts a complete permutation and remaps pixels and the
transparent slot together, preserving RGBA including hidden RGB. Replacing a
slot intentionally recolours only its references; transparent-slot alpha rules
remain enforced. No project palette edit implicitly mutates indexed slot data.
`encodeIndexedCelPng` writes the original PLTE/tRNS table and 8-bit index plane,
including duplicate/unused slots; it does not regenerate or deduplicate a table.

Image / Indexed cel exchange (also Commands) prepares the active visible frame
in first-appearance exact RGBA order for JSON/PNG downloads. It bakes layers and
effects; transparent composite RGB is normalized by existing compositing. More
than 256 unique RGBA values rejects without quantization. Low-level exact raw
indexing refuses multiple distinct zero-alpha RGB values rather than silently
losing them; use a normalized composite or retain RGBA source.

Indexed file import requires matching canvas dimensions and a visible/unlocked
raster target/ancestor. Private copied authored plans import a new layer in the
active frame or replace all linked members of the active cel, with one Undo.
Imported indices expand to RGBA; project palette/structure/metadata stay intact.
Grayscale editing maps the imported RGBA to gray. Equality is a no-op preserving
Redo. Stale/forged plans, malformed files, locks and budget failures reject.
Project v15 needs no schema bump because live documents remain RGBA.

This establishes bounded indexed representation/exchange, not persistent indexed
document storage/editing, PNG indexed-table import, indexed native parity or
ICC conversion. Workspace and native formats retain the expanded RGBA artwork;
keep the original .ezindexed to retain index identity. Companion capture uses
the same core/version with unchanged protocol, permissions and Chrome minimum.

## Persistent indexed storage and Indexed studio (225-234)

Core/companion 0.222.0 writes project v16 and reads v1-v16. Optional root
`indexed:{palette,transparentIndex}` selects a shared ordered RGBA slot table.
Indexed raster cels serialize canonical base64 one-byte `indices`, `empty`
(designated transparent slot) or backward `link`, never an RGBA payload. Plain
Normal raster layers only: no text, masks, live effects, adjustment layers,
grayscale editing policy or final output mapping. Entry indexes all raw source
cels exactly, including hidden layers/RGB, and rejects >256 RGBA entries or
multiple distinct zero-alpha RGB values. References/conversion sources remain
original. Exit retains expanded source pixels and restores unrestricted RGBA.

Live RGBA cels are validated compositing caches for the index planes. Links in
both representations must agree. Plane data is copied on write; project encoding
and the editor history boundary reject mismatch/unsupported operations and
restore prior artwork without clearing Redo. Existing dense 4 MiB RGBA cel cap
remains; index planes add up to 1 MiB and history counts retained plane buffers.
These allocation bounds do not establish peak process RAM or minimum hardware.

Image / Indexed studio and Commands provide reviewed staged entry/exit, slot
append/replacement/permutation, 4096-anchor connected indexed pencil, index-aware
flood/rectangles, rectangular selection copy/paste, cel link/unlink/clear, blank/
duplicate layers and blank/duplicate/delete/timed frames. Slots may duplicate;
recolour changes only pixels referencing that slot. Reorder remaps all planes and
transparency, preserving RGBA. Only one slot has alpha zero; changing that role
is an explicit reviewed palette edit. Palette recolour rejects affected locked
art; frame deletion rejects locked layers. Copy/paste/import require the exact
ordered RGBA table and transparency, avoiding implicit remap. Source RGB palette
swatches remain a separate bank. Standard RGBA painting is disabled in this
bounded mode; other incompatible pixel/layer/geometry operations reject.

All operations use private copied authored plans, complete stale-source checks,
Apply/Discard, budget preflight and one Undo. Equal-index/no-op operations retain
Redo; equal-RGBA changes between duplicate slots are real index-history changes.
Workspace/checkpoint/library v1 envelopes carry v16 index planes/links and restore
fresh editor histories. Studio Files exports the active raw indexed cel as JSON/
PNG preserving unused/duplicate slots; the older exchange exports a new indexed
visible-composite table. Matching indexed file import preserves planes in indexed
mode, while ordinary RGBA import expands them. Native Aseprite/Piskel/selected
layer PSD/ORA refuse index loss; flattened/native/assets/clips bake visible RGBA
and warn. Keep projects for structure and raw .ezindexed for slot exchange.

This is bounded persistent indexed storage/editing in Indexed studio, not complete
main-canvas indexed tool integration or native indexed/profile parity. Actual
indexed PNG/native table import, broader tools/geometry/live layers, true gray
channel storage and profiles remain open, alongside existing manual/release gates.


## Indexed canvas continuation (235-244 / 13gk-13gt)

At continuation 244, core/website vendor/companion was **0.232.0**, project writer/readers
**v16/v1-v16**. The historical handoff is continuation 244 ([phase history](../../glitchbong/docs/ezpix-progress.md)). Exactly ten
phases extend the persistent indexed model with main-canvas staged Pencil,
Eraser, Fill, Line, Rectangle and Ellipse, exact Primary/Secondary slot selection
and raw-slot Pick. Pointer release leaves a preview; Apply/Enter keeps one atomic
linked-cel edit, Cancel/Escape discards it. Save/frame/playback changes resolve
pending previews. Preview controls keep the canvas position stable during strokes.

Indexed brush support includes square/circle tips, mirrors/wrapping, ordered
50-percent two-slot dither, forward-one-slot shade, Keep alpha and pixel-perfect
cleanup. The core also bounds spacing/stabilizer settings. No pressure/blending,
custom-stamp, spray/blur/sharpen or full indexed main-canvas selection claim.

Indexed studio Transform offers complete-cel flips, 180-degree rotation,
square-only quarter turns and wrapped/nonwrapped offsets. Slots shows unique-plane
usage across hidden/visible art and allows unused-slot removal/cleanup without
merging duplicate identities. Cleanup retains unused designated transparency.
Files adds original-table non-interlaced 8-bit indexed PNG import (128 KiB,
1-256 pixels/axis, one transparent slot), requiring matching document table and
canvas. Packed/animated/custom-profiled and multiple-zero-alpha PNG reject;
ordinary PNG import still expands RGBA. Native indexed Aseprite fidelity, new
indexed-document PNG creation and wider profile support remain open.

No AI, image uploads, telemetry, dependency, extension permission, capture protocol
or Chrome minimum change. Local verification does not close physical devices,
stylus, Firefox/Safari, human external-app/engine, endurance/true peak memory,
licence/name, hosted/offline/update or store gates. No commit/push/deploy authorized.


## Indexed selections and document geometry (245-254 / 13gu-13hd)

At continuation 254, core, website vendor and companion were **0.242.0**, with project writer
**v16**, readers **v1-v16** and indexed/workspace/library envelopes v1.
[Handoff 254](../../glitchbong/docs/ezpix-continue254.md) completes exactly phases **245-254**.
No phases remain in this requested batch; next is **13he / 255**.

Indexed main-canvas rectangular Select now supports exact-slot move/copy,
quarter-turns, output flips and nearest-neighbour scaling. Copy/download/cut
explicitly use the original rectangle, retaining the entire ordered table.
Local-buffer/file paste requires the identical table and transparent role.
Move/cut need designated transparency when exposing source pixels. Masks and
ordinary RGBA selection effects remain unavailable in indexed mode.

Resize with anchors/offsets, crop, nontransparent-slot trim, nearest-neighbour
sprite scale and whole-document rotations/flips operate across every stored
plane, including hidden/locked art, preserving links and duplicate identities.
Quarter-turns can swap nonsquare dimensions. Previews require explicit Apply;
one Undo restores dimensions, recipe dimensions, planes and links. Retained
source pixels and references stay unchanged; slices must be cleared first.

Open indexed PNG validates a strict non-interlaced 8-bit indexed PNG and opens
a reviewed independent tab, preserving the source tab/history and all original
slots. Existing table-matching studio import remains separate. Packed, animated,
profiled and multiple-zero-alpha PNG reject; files cap at 128 KiB.

This supersedes earlier statements that indexed selections, document geometry
and new-tab indexed PNG were future work. Indexed native Aseprite fidelity,
selection masks/advanced inks, gray-channel storage, profiles, pinned parity
auditing and the separate physical/browser/human/endurance/licence/hosted/store
gates remain open. Local checks and exact limits are recorded in handoff 254.
No AI, upload, telemetry, dependency, permission or capture-protocol change.
No commit, push, deployment or store publication was performed.


## Indexed selection masks (255-264 / 13he-13hn)

Current core, website vendor and companion are **0.282.0**. Project writer
**v16**, readers **v1-v16**, indexed/workspace/library envelopes v1 remain.
[Handoff 264](../../glitchbong/docs/ezpix-continue264.md) completes exactly phases **255-264**;
zero remain in this requested batch. Next is **13ho / 265**.

Indexed Select / Transform now enables binary membership editing: exact-slot
contiguous/global selection, ellipse/diamond/polygon/lasso/brush, boolean masks,
morphology/components/holes, membership Undo/Redo, four session mask slots and
binary mask PNG exchange. Indexed wand compares original index bytes, with
four/eight neighbours; equal-colour duplicate slots remain distinct. No colour
tolerance or RGBA matching is inferred for indexed wand.

Move clears only selected source members; transformed members replace destination
slots while holes retain destination artwork. Indices and masks share quarter-turn,
nearest-scale and output-flip sampling. Opaque moves must cover every cleared
member with transformed membership. Copy needs no transparency.

Original-membership cut/copy/file export retains full bounds and the complete
ordered palette. File/buffer holes use the existing designated transparent slot;
opaque files with holes reject. Paste replaces its complete stored rectangle,
including holes. Indexed Fill/inner Stroke uses exact slots and four-neighbour
inset bands, including hole edges. Prepared cut/paint invalidates on membership
changes; Apply rechecks source, locks and budgets, with one linked artwork Undo.
Empty membership is a no-op and preserves Redo. Membership is transient.

This supersedes earlier statements that indexed selection masks were unavailable.
Ordinary RGBA colour effects, indexed native fidelity, gray-channel storage,
profiles, integrated tilemaps, pinned parity auditing and separate physical/
human/non-Chromium/endurance/licence/hosted/store gates remain open. No rough
planning estimate is reduced mechanically by ten. No AI, upload, telemetry,
dependency, capture-protocol or permission changes; no commit/push/deployment.


## Local phases 265-284 / 13ho-13ih: Aseprite fidelity

The current [20-phase handoff](../../glitchbong/docs/ezpix-continue284.md) records exact scope and verification. Shared
core/companion and website vendor 0.272.0 retain writer v16/readers v1-v16.
Aseprite RGBA/indexed exchange retains ordered RGBA slots, index planes,
matching-position cel links, normal opacity and pixel locks, four supported
animation-tag modes and static slice rectangles/pivots. Complete modern/legacy
palettes, bounded raw/zlib cels and transparent sparse expansion are supported.
Relocated linked cels become independent with review. True native profiles,
gray-channel storage, groups/blends, cel opacity/z-index, animated/nine-patch
slices, broader tag repeats, tilemaps and pinned parity auditing remain open.
One fully opaque indexed background layer is supported; mixed transparency
roles and changing indexed tables reject. Separate project swatches/palette
organisation and user data are reviewed losses. No broad planning count has
been mechanically reduced by twenty. Physical devices, non-Chromium browsers,
human external-editor use, endurance/peak memory/licence/hosted/store gates
remain separate. No AI, uploads, telemetry, dependencies or permission expansion.
No commit, push, deployment or publication is part of this continuation.


## Local phases 285-294 / 13ii-13ir: indexed ink families

Shared core/companion/vendor 0.282.0 retain writer v16/readers v1-v16. Indexed
main-canvas tools add configurable dither density/origin and signed shading,
exact original-slot replacement, ordered ramps with signed clamp/wrap, seeded
coordinate-anchored spray, exact-table captured/file stamps with explicit
transparent painting, and four/eight/global exact-slot fill. Shared paths retain
spacing/stabilization/pixel-perfect, clipping/wrapping/mirrors, alpha lock,
private settings, preview Apply/Cancel, stale rejection and one linked atomic
Undo. Brush settings/stamps are session tools, not new project schema fields.
See [current local rework](../../glitchbong/docs/ezpix-issues3-local.md) for exact measured evidence.

The [full feature inventory and completion estimate](../../glitchbong/docs/ezpix-completion-inventory.md) replaces the
old broad-family phase allowance with a named **60-98** further bounded-phase
planning range after 294. Chrome capture/conversion/handoff already works
locally; its **6-10** finish/release portion is included in that total. Literal
API/desktop parity, capacities, proprietary formats and external release gates
remain explicit, without a false exact completion promise. No owner issue files,
runtime dependencies, permissions, AI, image uploads or telemetry are added.
No commit, push, deployment or publication is part of this continuation.

Current phases 295-298: indexed pressure size and discrete density; see the
[current local rework](../../glitchbong/docs/ezpix-issues3-local.md). No extension permission/protocol expansion.
Physical stylus and all separate release gates remain open.

Current phases 299-308 add reviewed Aseprite rendered RGBA import; see the
[current local rework](../../glitchbong/docs/ezpix-issues3-local.md). Strict editable import remains separate. No transfer
protocol/permission expansion. Physical, external-app and release gates remain.
