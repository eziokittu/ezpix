# @ezpix/core

The current version is defined by package.json and ENGINE_VERSION. Browser
conversion defaults to the full image with its background kept. The Chrome
capture-only side panel and website converter share this implementation.

Original deterministic RGBA editor and image conversion engine. No runtime
dependencies or inference. Build with the workspace `npm run build`.

`prepareAdjustment`, `adjustmentPreview` and `PixelEditor.applyAdjustment` stage
bounded selected-cel HSL, master/per-channel RGB levels and curves, OKLCH, palette remapping and dithering. HSL uses encoded sRGB with whole
hue offsets +/-180 and saturation/lightness percentage-point offsets +/-100.
Levels validates input black < white, output black <= white (whole 0-255), and
finite gamma 0.1-10. A 256-entry LUT evaluates
`outputBlack + (outputWhite-outputBlack) * clamp((v-inputBlack)/(inputWhite-inputBlack),0,1) ** (1/gamma)`.
HSL/levels round nearest with upward ties snapped within 1e-10 byte. Curves use
`curveLookup(points)`: 2-16 strictly input-ordered integer points (0-255), with
input endpoints exactly 0 and 255; output may rise or fall. A 256-entry LUT uses
piecewise linear rational interpolation and exact nearest rounding, ties upward.
The copied points and each point object are frozen in the prepared plan.
All six preserve alpha
and all fully transparent RGBA bytes, affect linked members together, reject
hidden/locked ancestors, and regenerate validated stages on Apply. Neutral/no-op
results retain sparse storage and create no history. One bounded bitmap command
supports undo/redo under the existing eviction budget. These are baked pixels;
v10 and legacy readers remain unchanged. No adjustment layer or live stack.

The main entry exports document/history/codec and pure conversion functions.
`/browser`, `/converter` and `/converter.css` provide optional browser adapters
and shared controls; `/worker` processes conversion jobs; `/transfer` validates
the local Chrome handoff. Pure conversion does not access the DOM or network.

Up to 16 layers, up to 32 frames within a 4 MiB cel-pixel budget, 1–256 pixels per axis. Project v16 is bounded plain JSON, at most
24 MiB, with optional original RGBA source and a versioned conversion recipe.
The entire source is included, even outside the crop, unless explicitly omitted.
v1/v2/v3/v4/v5/v6/v7/v8/v9/v10/v11/v12/v13/v14/v15/v16 remain readable; unknown versions and malformed/bounded data are rejected.
Projects store ordered frames with 20-5000 ms durations and explicit empty, independent or linked RGBA cels
per layer/frame, selected frame/layer, visibility and names. Legacy v1-v3 files
migrate into one frame. Frame operations validate the dense cel budget before
allocation; 256-square projects can hold at most 16 total cels.
frameAtTime provides nonmutating duration-based looping.
Source-over compositing is shared by preview and PNG output. Saving excludes undo history. PNG/JPEG adapters inspect dimensions before decode
and accept at most 20 MiB encoded / 4 megapixels decoded.

Nearest and premultiplied-alpha area sampling, deterministic extracted palettes,
Pocket/GlitchBong presets, ordered dithering and alpha threshold are supported.
Worker cancellation is managed by the shared converter UI. Preview changes never
apply automatically. Conversion is raster reduction, not object recognition.

History stores small changed-pixel deltas or compact before/after buffers for
large gestures, at most 100 gestures and an estimated 8 MiB
budget across undo and redo by default. Pixel commands reserve 512 bytes per
changed pixel; layer commands account for retained buffers and metadata. This is not a
measured peak heap limit. Transfer protocol 1 uses bounded 128 KiB raw chunks,
a 16 MiB total limit and SHA-256 validation before decoding/import confirmation.

Product licence remains undecided. This private package implies no licence grant.

Toolkit exports deterministic integer shapes and pure staged selection transforms.
Selection application validates the original layer/buffer and commits one pixel
command. Transparent pixels replace destination pixels; transforms remain inside
the canvas. Pending selections and shape previews are not document data.

Project v5 also stores up to 256 hex palette colours. Older v3 files
without this field use the defaults. Palette metadata changes are undoable.
EzPix palette JSON v1 imports are bounded to 16 KiB; palette grab keeps the most
frequent actual visible RGB values without recolouring pixels.

Sheet helpers export untrimmed row-major visible composites with exact integer
scale 1-8, source padding/spacing 0-32, and frame rectangles/durations in an EzPix
JSON v1 sidecar. Max sheet: 4096 per axis / 4 megapixels. Onion skin is a pure
adjacent-frame tinted overlay, never document data. Import validates sidecars
(up to 64 KiB), IDs, bounds, nonoverlap, durations and native cel budget. Uniform
grids must fit the full image; scaled cells must have exact repeated pixel
blocks. Imported cels are flattened and independent. Unknown metadata fields are
ignored; filenames/URLs are never fetched. Pure core raster operations preserve
bytes; browser PNG canvas processing can round semitransparent RGB channels.

Animated PNG is rejected in the shared predecode header gate. Static PNG/JPEG
files still rely on browser decode for complete codec/CRC validation.

Shared quick conversion supports presets, transparent-margin
trimming, cached source thumbnails and reusable idle conversion workers. Busy
work is still terminated on cancellation/replacement. Sprite finishing is
undoable and layer/frame scoped. The website has a separate tiles/map workspace
with .eztiles files, independent recovery, exact deduplication and starter
patterns. Maps do not change sprite project files. See the latest handoff for bounds,
measured performance and remaining release gates. No permissions or uploads added.

## Native exchange (bounded first slice)

`decodeAseprite` and `decodePiskel` asynchronously stage a document and warnings.
`encodeAseprite` writes independent raw RGBA cels with per-frame durations;
`encodePiskel` writes v2 PNG chunks at an explicit global FPS.
`piskelExportWarnings` reports timing and metadata differences before export.
Both inputs cap encoded size at 16 MiB and decoded cels at 4 MiB. Native zlib
streams stop when declared raster output is exceeded. The Piskel PNG subset
checks CRCs, row filters, dimensions and layout coverage without DOM/canvas alpha
rounding. Web CompressionStream/DecompressionStream are required when called.

Groups, blends, indexed Aseprite, linked/tilemap cels and custom profiles remain
unsupported. Tags/slices/user metadata produce import warnings. Piskel partial
pixel/layer alpha and hidden-frame sequences are rejected; palette swatches and
conversion sources are not stored there. See the current website handoff and release worksheet for evidence and remaining gates.

## Layer exchange and properties

`decodePsd`/`encodePsd` and `decodeOra`/`encodeOra` handle the bounded flat normal
RGBA subset. Explicit `selected-frame`/`frames-as-layers` export reports static
conversion losses. PSD channels are raw/PackBits; ORA ZIP is stored/raw-deflate,
with safe unique paths, directory/local-header agreement, CRC, 40-entry and
8 MiB expansion caps. Inputs cap at 16 MiB. Groups/masks/blends/custom profiles
are rejected. Shared code does not depend on a general third-party archive or
PSD runtime. Platform deflate-raw streams are required for compressed ORA import.

Project v5 stores integer layer opacity (0-255) and edit locks; v1-v4 default to
opaque unlocked layers. Composite applies opacity. Merge-down processes all
frames as one undo action and requires visible unlocked layers. Imported companion
layers require matching dimensions and bounded cels; palette/reference plans
are nonmutating. Native edit locks are omitted with review; limited Aseprite/
Piskel exports reject partial layer opacity. These codec limits are also enforced by native exchange tests.

## Phases 10a groups and 10b palettes

Project v6 introduced up to 16 nested isolated
normal groups (four levels), inherited locks/visibility, structural undo and
strict tree validation. Groups do not allocate cels. Existing native codecs
reject hierarchy; explicit flattened PSD/ORA frames, PNG and sheets render groups.
Shared palette exchange supports bounded RGB EzPix JSON, GPL, JASC/RIFF PAL, ACT,
ACO, Adobe ASE and hex text, with staged website review, loss warnings and no
recolouring. Product runtime dependencies and extension permissions are unchanged.
Reload the matching rebuilt extension. See the current handoff for independent QA, browser evidence and outstanding gates. No publication
or full editor parity is claimed.

Phase 11a adds up to 16 named animation tags (unique 1-80 character names),
inclusive zero-based frame slots and per-tag loop/once/reverse/ping-pong modes.
Project v7 stores tags; v1-v6 migrate with none. Overlap is allowed. Insertion
strictly inside a range expands it; insertion before shifts it; appending after
its last frame is excluded. Deletion shrinks or removes single-frame tags.
Reorder keeps numbered boundaries unchanged. All structural/tag edits undo
atomically, and metadata counts toward history estimates. animationAtTime is pure:
reverse loops from the last frame, once holds the final frame and reports done,
and ping-pong omits repeated endpoints, respecting every frame duration. Legacy
frameAtTime remains compatible. Native exchange omits tags with website review;
static exports keep all timeline frames. Explicit empty/linked cels are described below.

Phase 11b represents empty cels with distinct zero-length arrays, expanding only
for writes. rasterCel reads a full raster without retaining a blank buffer;
ensureCel and compatibility pixels getters are mutable/allocating adapters.
Derived pixels/cel getters are non-enumerable so object snapshots do not allocate
blank art. v8 writes either empty:true or base64 RGBA; v1-v7 zero buffers compact
on migration. Nonzero RGB under alpha zero is preserved. Clear cel is undoable;
pixel history retains its buffer identity so structural undo/redo stays correct.
History estimates include those retained buffers. Existing conservative dense
cel budgets remain unchanged, independently of sparse live allocation.

Phase 11c adds explicit same-layer linked cels. In memory, linked slots share a
single typed-array identity, including empty cels; writes and compaction update
all members. linkCel replaces only the selected slot with a source frame in the
same layer, unlinkCel independently clones it, and clearCel clears all members.
Pixel history records affected frame IDs and its original buffer; structure and
membership undo atomically. Frame deletion/reorder retain surviving members;
duplicate frames are independent and duplicate layers retain internal membership
without sharing pixels with the source layer. v9 writes one concrete cel followed
by direct links to its first timeline member. Forward/self/cyclic/chained/mixed
and cross-layer targets reject before imported raster decoding. v1-v8 remain
readable without new links. Native exports expand links and website review reports
the lost shared editing identity. Native linked-cel imports remain unsupported.

Phase 11d persists up to four display-only references in v10 projects, with a
1024px axis limit and combined one-megapixel RGBA budget. Reference selection,
rename, add and remove have separate undo commands and buffer-aware estimates.
Encoded reference metadata and sizes validate before imported artwork allocation.
v1-v9 read with an empty reference collection. Omitting the conversion source
never omits references. Native/image/sheet exports exclude reference images.

Phase 11e prepares whole-cel translation into 1-16 new independent frames.
Integer offsets are bounded to +/-256, interpolated linearly with symmetric
half-away-from-zero rounding. Other layers copy the starting cel; global
metadata and existing frames/links remain intact. Clipped nonzero source pixels
are counted across generated frames. Apply validates a source fingerprint,
regenerates bounded pixels and records one structural undo. This is baked
translation, not live keyframes, morphing, rotation or AI generation.

Phase 11f captures flattened reusable animation clips from all frames or one
named range. Clip v1 embeds a strict flat v10 or v11 project with no groups, sources,
references or linked cels. Limits: 6 MiB encoded, 4 MiB decoded pixels, 256px per
axis and 32 frames. The browser library allows four clips / 12 MiB encoded total;
all stored records validate as untrusted input. Append creates one independent
root layer plus new frames, retains the target palette/references/old cels and
adds a relocated clip tag if present. One structural undo restores the target.
Sources and references are never included in clip files; native clip instances,
external URLs and embedded linked animations are not implemented.

## OKLCH and palette remapping (phases 12d/12e)

`{kind:'oklch',hue,chroma,lightness}` accepts integer offsets: hue -180..180
in degrees, chroma -40..40 in hundredths, lightness -100..100 in percentage
points. Decode sRGB with the standard piecewise transfer, use Ottosson's 2021
D65 linear-sRGB/Oklab matrices, then convert to polar coordinates. Chroma at
or below 0.000004 is treated as zero with hue zero before the hue offset.
Clamp adjusted L to 0..1 and C to 0..0.4; L endpoints return black/white.
If outside linear sRGB [0,1], use 24 fixed bisections reducing chroma at fixed
L/hue, retaining the in-gamut lower bound. Encode sRGB, clamp and quantize
nearest, upward ties within 1e-10 byte. Identity bypasses conversion exactly.
This bounded policy is not CSS local-MINDE or a colour-profile workflow.
Sources: https://bottosson.github.io/posts/oklab/ and
https://www.w3.org/TR/2026/CRD-css-color-4-20261009/#ok-lab .

`{kind:'palette',colors}` accepts 1..256 six-digit RGB hex swatches via the
existing palette validator (lowercase, first-occurrence deduplication). For each
nontransparent pixel choose minimum integer squared encoded-sRGB RGB distance;
equal distances choose the earliest swatch. Keep source alpha; never use swatch
alpha or dithering. Settings and the copied palette are frozen. The website
snapshots the current project palette when opening the dialog; it does not edit
that palette. Stage fingerprinting includes the palette and all ordinary project
metadata. At most 256*256*256 distance comparisons; no per-image colour cache.
Preparation retains the existing bounded project fingerprint/output raster and
at most 256 strings; conversion temporaries are per-pixel and palette-sized.


## Channel curves and palette tools (phases 12f-12i)

Curves optionally accept `channels:{red,green,blue}` with full validated point
arrays. Missing channels object means identity channels; supplying it requires
all three. Build all four LUTs, apply master first (rounded byte), then the
corresponding channel LUT. Copied arrays, points and channels object are frozen.

`auditPalette(doc)` reads only the selected stored cel, not its composite. Count
all nonzero-alpha pixels once by exact RGB palette membership, independent of
layer opacity/visibility or linked count. Report unused swatches, total outside
pixels, up to 16 first-seen distinct outside samples, and excluded transparent
pixels. Hidden RGB is not counted. Work is canvas-sized with bounded palette
lookup/count arrays and 16 sample strings; no unbounded histogram.

`paletteRamp({from,to,steps})` creates 2-32 endpoint-inclusive encoded-sRGB steps.
For channel endpoints A/B at step i of span n, use
`floor((2*(A*(n-i)+B*i)+n)/(2*n))`. Return requested steps, including duplicate
colours. `preparePaletteRamp` stages unique first-occurrence append to current
palette; reject over 256 before mutation. Freeze copied settings/output and bind
to the full bounded project fingerprint. `PixelEditor.applyPaletteRamp` checks
source, regenerates settings and uses one existing palette history command. No
artwork change, no schema change, no history for duplicate-only append.

`{kind:'dither',colors,strength}` stages selected-cel ordered 4x4 palette mapping.
Strength is an integer 0-100; canvas origin anchors the matrix rows
`0 8 2 10 / 12 4 14 6 / 3 11 1 9 / 15 7 13 5`.
For rank B, offset numerator q=(2*B-15)*strength. Compare integer squared
`sum((50*(sourceChannel-targetChannel)+q)^2)` and choose the first tied swatch.
No pre-distance clipping or offset rounding occurs. Strength 100 shifts at most
30 byte values, 0 equals nearest palette. Preserve exact existing palette RGB,
so repeated Apply is a no-op; skip fully transparent pixels and preserve alpha.
The converter shares the same distance/threshold helper while retaining its old
strength-100 policy without exact-swatch bypass. No error diffusion, random noise,
new permissions, inference, runtime dependency or project metadata is introduced.


## Independent channel levels (phase 12j)

`LevelsAdjustment` optionally accepts `channels:{red,green,blue}`. Supplying the
object requires all three complete settings; omitting it keeps legacy master-only
behavior. Each `LevelsSettings` has integer input/output black/white in 0-255,
input black < white, output black <= white, and finite gamma 0.1-10.
`levelsLookup` validates and returns 256 channel bytes. The mapping is unchanged:
`floor(outputBlack+(outputWhite-outputBlack)*clamp((v-inputBlack)/(inputWhite-inputBlack),0,1)^(1/gamma)+0.5+1e-10)`.
Apply master lookup first and quantize to its byte, then the corresponding
channel lookup. This discrete order is part of the contract. Equal output
endpoints give constant output; gamma >1 lightens midtones. `IDENTITY_LEVELS`
is frozen and exported for consistent defaults/resets. Prepared channel settings
and their container are copied/frozen; Apply revalidates and regenerates them.
Four temporary LUTs and at most 20 copied numeric values extend the existing
bounded staged operation. Alpha, transparent RGB, links, metadata and history
contracts stay unchanged; no schema migration or live effects stack.


## Palette harmonies, sorting and document usage (phases 12k-12m)

`paletteHarmony({kind:'harmony',base,mode})` returns normalized six-digit encoded
RGB swatches in fixed order. Complementary uses [0,180] degree offsets, analogous
[0,-30,30], triadic [0,120,240]. Hue rotates at fixed encoded RGB min/max, equivalent
to hue-only HSL/HSV rotation. Achromatic input stays unchanged. Integer rational
intermediates use 1/60-byte units and floor((numerator+30)/60), exact nearest ties
upward. No floating hue or channel interpolation is used. Preview can contain
repeated greys; append deduplicates, preserving existing first-occurrence order.

`sortPalette(colors,{kind:'sort',by,direction})` accepts hue, brightness or hex;
ascending/descending. Hue is an exact rational degree angle with grey hue zero;
brightness is max encoded RGB (HSV V), not luminance. Hex uses numeric RRGGBB.
All ties preserve original order even descending. Current RGBA artwork is not
indexed; sorting affects future nearest-palette tie choices, not existing pixels.

`auditDocumentPalette` scans all stored frame/layer cels including hidden/locked
art. Shared buffers count once per layer; identical independent buffers each
count. Alpha >0 counts once, hidden RGB/fully transparent pixels are excluded.
Empty cels contribute transparent canvas area without raster allocation. Reference
images and retained conversion sources do not count as editable-art usage.
Counts and membership are palette-sized; outside samples cap at 16. Per-layer
seen sets have at most 32 references; no unbounded unique-colour histogram.

`preparePaletteOperation` / `PixelEditor.applyPaletteOperation` stage harmony
append, sorting or `{kind:'prune'}` removal. The stage copies/freezes settings,
output/preview, and binds the normal bounded project fingerprint excluding original
source pixels. Apply regenerates from settings and uses one palette history
command. Pruning keeps only used swatches in their existing order; if none are
used, retain the first swatch so the palette stays valid. Cap is 256; overflow
rejects before mutation, and duplicate-only/unchanged results create no history.
Pixels, cel buffers/links, source/recipe, groups/tags and references do not change.
Writer stays v10. No palette groups, locks, indexed mode or new dependencies.

## Canvas geometry (13a-13c)

`prepareCanvasGeometry(doc, options, historyBudget?)` stages `resize`, `crop` or
`trim`; `PixelEditor.applyCanvasGeometry(plan)` revalidates the source/settings
and regenerates all output. Dimensions are integers 1-256. Resize anchors are
`start`, `center`, `end` on each axis; center uses floor((new-old)/2), then
integer offsets -256..256 move artwork right/down. Old-canvas position at the
new origin is minus this displacement. Crop uses old-canvas x/y and a fully
contained positive rectangle. Padding is zero RGBA; clipping copies retained
bytes exactly, including partial alpha and hidden RGB. No resampling is used.

`storedArtworkBounds`/trim uses the union of any nonzero RGBA in every stored
cel, including hidden/locked layers/groups and all frames. References and source
pixels do not set bounds. An all-zero document keeps its dimensions. It does
not trim based on the visible composite or alpha alone. Clipped counts include
any nonzero RGBA, once per linked buffer per layer. Preview is the transformed
selected-frame composite without references, never a live document mutation.

Each layer maps a buffer once, retaining linked versus independent equivalence
classes even when clipping makes cels empty. Groups, tags, timing, selection IDs,
palette, references and original source/crop/sampling stay intact. Recipe output
width/height follow the new canvas to retain v10 reader validity. Retuning still
regenerates from source, not transformed manual edits. Undo restores the exact
prior geometry, buffers and recipe dimensions. Project writer stays v10.

Dense-equivalent cels remain capped at 4 MiB before allocation. Preflight also
checks an undo estimate: unique before buffers + one output raster per nonempty
same-layer buffer + two structural metadata estimates + 2048 bytes. Operations
that cannot retain their one undo command within the editor budget reject before
transformed raster allocation. Older commands may be evicted under the existing
8 MiB/100-command history limit. This is a conservative history bound, not total
heap/peak-memory or latency measurement. Plans retain bounded project fingerprints
without original source pixels and a single at-most-256-square preview. Output
geometry/preview fields are ignored on Apply; validated frozen copied settings
are authoritative. Identity geometry is a no-op and keeps redo/sparse buffers.

## Nearest-neighbour sprite scaling (13d)

`prepareCanvasGeometry(doc, {kind:'scale', width, height})` stages whole-sprite
scaling; `PixelEditor.applyCanvasGeometry` applies it via the same validated
structural-history path. This is a separate Image / Scale sprite command. Each
output (x,y) copies the complete source RGBA at
`floor((2*x+1)*oldWidth/(2*width)), floor((2*y+1)*oldHeight/(2*height))`.
These integer-ratio pixel-center samples use exact midpoint ties toward the
higher coordinate. No colour/alpha blending, quantization or palette mapping.
Dimensions are independent integers 1-256. Integer enlargement replicates pixels;
noninteger changes can produce uneven runs, and reduction can omit artwork and
hidden RGB. Copied pixels retain exact partial alpha/hidden RGB. No reversible
resampling promise is made beyond editor Undo.

All layers/frames, including hidden/locked artwork, use the same sample mapping.
Same-layer linked/independent/empty buffer classes, metadata and active IDs are
preserved; outputs with only zeros compact without merging independent cels.
Sparse empty inputs never allocate rasters. Selected-frame preview samples the
composite (equivalent to composing the same per-layer samples); references are
excluded. There is no canvas clipping count for scaling; zero clippedPixels is
not a claim that downsampling retains all source pixels. The UI explicitly warns
that downsampling omits details. References/source pixels and source recipe crop/
sampling stay unchanged; recipe output dimensions follow the new canvas for v10
reader validity. One Undo restores original buffers/dimensions/recipe, and later
pixel/structural history remains coherent. Same-size scale is an exact no-op.

Existing 4 MiB dense-equivalent cel and conservative one-command undo preflight,
regenerated Apply, source fingerprint/revision guards and history eviction rules
apply. No new project schema, area/bilinear sampling, masks, rotation or effects.
Bounds do not establish measured peak heap/RAM/VRAM, minimum-device latency or
long endurance.


## Phase 13e-13h exact raster transforms

`prepareCanvasGeometry` also accepts `{kind:'rotate',rotation:90|180|270}`
(clockwise in screen coordinates) and `{kind:'flip',axis:'horizontal'|'vertical'}`.
90/270 swap dimensions. Source `(x,y)` maps clockwise to `(H-1-y,x)`,
counterclockwise to `(y,W-1-x)`, or 180 to `(W-1-x,H-1-y)`.
Flips map to `(W-1-x,y)` or `(x,H-1-y)`. Every stored RGBA pixel moves intact,
including hidden RGB. Existing copied settings, fingerprint, regeneration,
all-layer/frame/link preservation and pre-allocation cel/history checks apply.
References and source/crop stay unchanged; recipe output size follows canvas.
Rotations/flips are explicit commands even for symmetric/empty artwork.

`Transform` adds optional `rotation:0|90|180|270`, `width`, `height`.
`selectionSize` returns rotated dimensions unless an explicit output size is set.
Order: rotate, pixel-center nearest sample to output size, flip on output axes,
then replace the destination. Missing fields retain old move/copy/flip behavior.
Output bounds must fit; the core rejects out-of-canvas destinations without clipping.
UI rotates the current requested size and clamps the destination into the canvas;
if rotated size cannot fit, the previous preview is retained with an explanation.
Move clears the original rectangle before writing from the immutable snapshot;
copy retains original pixels outside destination. Full RGBA replaces destination,
including transparent pixels. Sampling ties go right/bottom; reduction is lossy.
Apply binds to the selected layer/frame/dimensions/complete cel baseline and
editable ancestry. It updates that cel's linked frames, preserving independent
cels and other layers. One bitmap history command is preflighted at three dense
cel buffers plus metadata; too-small undo budgets reject before mutation.
Identity selection results preserve history/redo. Undo history is not serialized.
No arbitrary-angle interpolation, masks, pivots, shear or perspective is included.


## Rectangular selection fill and inset stroke (13i/13j)

`prepareSelectionPaint(doc, rect, options, historyBudget?)` accepts
`{kind:'fill',color:[r,g,b,a]}` or `{kind:'stroke',color:[r,g,b,a],thickness}`.
RGBA is four integer bytes 0-255; stroke thickness is an integer 1-256.
The original rectangle must fit the canvas. Fill replaces every pixel. Stroke
replaces pixels whose minimum distance to an inside rectangle edge is less than
thickness; its square-cornered bands never extend outside the rectangle. When
bands overlap, stroke fills the rectangle. Alpha zero retains the chosen RGB;
this is full-byte replacement, with no blending, mask or colour quantization.

The staged plan copies/freezes rectangle/options/colour and captures a full
project fingerprint. It contains selected-cel pixels and selected-frame composite
preview without references, changed-pixel count, linked-frame count and a
conservative history estimate. Invalid, hidden/locked/ancestor-ineligible and
stale sources reject. Apply regenerates pixels using copied parameters, ignoring
mutated preview/pixels/counts/estimates. Only selected cel and its linked frames
change. Independent cels/layers, source, recipe, palettes, references and document
metadata remain intact. No-op preserves redo and empty buffers. Bitmap history
preflight counts three full cel buffers plus 256 bytes and 64 per linked frame;
changed commands reject before output allocation if capacity is exceeded.
Default history remains 8 MiB/100 commands; estimates are not peak-heap measurements.

The UI operates on the original selected rectangle and explicitly replaces the
pending transform only on Apply. Close returns to the original pending preview.
The RGBA fields begin with drawing RGB and alpha 255. Editing any field invalidates
the stage; Apply is explicit and disabled for no-op output. There is no schema
change or secondary-colour/mask infrastructure in these phases.


## Original-rectangle layer, clear and export actions (13k-13o)

`prepareSelectionAction(doc, rect, options, historyBudget?)` stages `copy-layer`,
`cut-layer`, `clear`, `export-png` or `export-project`. All except clear take a
trimmed 1-80 character name. Rectangle must fit the canvas. Settings/rectangle
are copied/frozen and a full source fingerprint binds Prepare to Apply/export.
Outputs/preview/estimates are regenerated; mutable stage buffers cannot inject
pixels. Mutations require visible editable ancestry. Read-only exports allow
visible locked layers; hidden ancestry rejects. All actions read original raw
selected-cel RGBA, with no opacity/group bake, masks, transforms or quantization.

Copy inserts/selects a new visible unlocked layer immediately above the source,
inheriting source group/opacity. Only the selected frame receives the extracted
rectangle at its original canvas coordinates; other frames get distinct sparse
empty cels. Source buffers remain untouched. Cut also clears RGBA to zero on the
source linked-frame class and mirrors that class in the destination. Other
frames remain distinct empty destination cels. This retains the composite for
all frames while preserving independent source cels. Even an empty copy/cut
creates a reviewed new layer. One structural Undo restores exact old buffers.

Layer/cel preflight runs before output allocation. Conservative structural
history counts unique retained old buffers, one dense destination (plus one
dense cleared source for cut), before/after layer/frame/group/tag metadata and
2048 bytes. Too-large commands reject; default history stays 8 MiB/100 commands.
Clear writes zero RGBA inside the rectangle on selected/linked cels; other
pixels and independent frames stay unchanged. Clear uses the existing three-
dense-buffer bitmap estimate plus frame metadata. No-op retains sparse buffers,
redo and history. Empty outputs preserve link classes; hidden RGB remains dense.
These are correctness/accounting bounds, without measured peak-memory claims.

`exportSelectionAction(doc, plan)` asynchronously regenerates tightly cropped
PNG or .ezpix bytes. PNG reuses the existing bounded RGBA PNG encoder directly,
retaining hidden RGB and partial alpha exactly without browser canvas encoding.
Fingerprint checks before and after compression reject stale async exports.
UI cancellation/settings changes invalidate pending downloads with an epoch.
`selectionProject` builds one independent frame/layer, retaining exact cropped
RGBA, palette, source layer name and selected-frame duration. Project name comes
from options; opacity is 255 and no groups/tags/references/source/recipe/other
frames/undo are retained. Exports are download-only and preserve current document,
selection preview, history and redo. File names are sanitized in browser UI.
No schema, host permission, clipboard dependency, upload or runtime dependency
was added. The editor resets selection-action dialogs on preview cancellation
and document replacement to avoid carrying a stale dialog into a new selection.


## Project paste and session copy/cut (13p-13t)

`prepareSelectionPaste(target,source,options,historyBudget?)` accepts sourceMode
selection (exactly one layer/frame) or project (explicit source layer/frame),
destination new-layer or cel, integer x/y and a trimmed 1-80 character name.
The complete source raster must fit; no clipping, resampling, blend or palette
mapping. Raw RGBA includes transparent replacement and exact hidden RGB. Source
opacity/locks/groups/palette/timing/tags/references/recipe are excluded from paste.
Destination palette/timing/source/reference/metadata remain intact.

New layers are visible/unlocked, opacity 255, in the selected target layer's
group, immediately above it. Only the current frame gets pasted pixels; all
other frames have independent empty cels. Current-cel paste updates its linked
frame class, retaining independent frames and other layers. The target layer and
ancestry must be visible/editable. New-layer count/dense-cel/history preflight
runs before output allocation. Structural history counts unique old buffers,
one dense output and metadata plus 2048 bytes; existing cel uses the established
three-dense-buffer bitmap estimate. No-op retains history/redo/sparse buffers.
One Undo restores dimensions, buffers, links and active IDs; geometry never changes.

Plans copy/freeze options and capture the target serialized fingerprint plus a
minimal single-layer/frame source snapshot string. The snapshot excludes retained
source/reference bytes and stays independent of later input-object changes.
Apply regenerates outputs from the canonical snapshot; tampered output/preview/
estimates cannot inject pixels. Original source choices are stored in options;
regeneration normalizes IDs to the extracted snapshot's independent layer/frame.
The UI checks initial target identity/revision/fingerprint, invalidates stages on
settings/source changes, guards async file reads on replace/unmount, and rejects
files over 24 MiB before text/decode. Existing bounded v1-v10 readers are reused.

Session Copy uses existing cropped selection-project extraction without artwork
or history changes and retains a pending transform. Session Cut pre-encodes that
snapshot, then applies guarded zero-RGBA clear to selected/linked source cels.
A failed clear preserves the prior buffer. Cut consumes the pending preview;
Undo restores artwork but leaves the copied buffer. One string slot (at most a
256x256 one-layer/frame project plus bounded palette/metadata) stays in Editor
memory across project replacement; Clear buffer or page reload/navigation drops
it. It is never written to system clipboard, localStorage, IndexedDB or project
files. Paste session buffer uses the same staged paste UI/core. Pending selections
must be explicitly resolved before opening either file or buffer paste.


## Staged rectangular gradients/patterns/colour edits (13u-13ab)

`prepareSelectionEffect(doc,rect,options,historyBudget?)` and
`PixelEditor.applySelectionEffect` support eight independent operation families.
All use original rectangle/local coordinates, full stored RGBA, copied/frozen
options/rect/colour arrays, serialized source fingerprint, regenerated Apply,
visible/editable ancestry, selected/linked cel updates and one bitmap Undo.
Exterior pixels, independent frames, palette, source/recipe, references and
metadata remain intact. Changed commands preflight three dense buffers plus
command/link metadata before output allocation. No-op retains sparse buffers,
history and redo. Bounds remain 1-256px and existing 4 MiB cel / 8 MiB history.

Linear `gradient` interpolates start/end straight encoded RGBA independently at
x/(W-1) or y/(H-1), nearest byte with exact half ties upward. One-pixel axes use
start. No gamma transfer or source-over blend. `dither-gradient` uses the same
linear progress but selects a complete endpoint with a 4x4 Bayer matrix anchored
at the rectangle origin; threshold is (2*Bayer+1)/32, choose end on >=. Force exact
start/end at t=0/1. `radial` uses squared elliptical distance from rectangle center:
min(1,((2*x-(W-1))/max(1,W-1))^2+((2*y-(H-1))/max(1,H-1))^2), then the same RGBA
rounding. It is squared-radius interpolation, not a linear Euclidean radial ramp.
Even rectangles lack an exact center sample; 1x1 uses start. All integer runtime
arithmetic stays below 2^53 inside canvas bounds.

`checker` chooses complete start/end RGBA by parity of floor(x/cellWidth)+
floor(y/cellHeight), dimensions 1-256, local origin; partial cells remain.
`replace` requires an exact four-byte match (including alpha/hidden RGB) and
replaces full RGBA. No tolerance. `grayscale` uses floor((77R+150G+29B+128)/256),
writing RGB and preserving alpha. `invert` writes 255-R/G/B and preserves alpha.
Both transform hidden RGB too and do not create an indexed/grayscale document
mode or effect stack. `alpha` takes integer percent 0-200, writes
min(255,floor((alpha*percent+50)/100)), retaining RGB even when alpha reaches zero.

The UI has explicit numeric RGBA endpoints/match/replacement, axis, checker size,
alpha percent and endpoint-swap controls. Fields invalidate stages. Prepare/Close
preserve pending transforms; Apply consumes them. Raw project/native outputs stay
exact. Canvas previews and legacy canvas PNG export can round partial-alpha RGB
or discard hidden RGB; use .ezpix/raw native workflows for exact stored bytes.
Long Select menus now scroll so all commands remain reachable in short viewports.
No schema, masks, runtime dependency, clipboard permission or publication change.

## Phases 13ac-13al: transient binary selection masks

Selection.mask is optional Uint8Array of exactly rect.width*rect.height bytes,
all 0 or 1. Undefined selects the complete rectangle; full results canonicalize
to undefined and empty masks are valid. Masks never enter v10 project/recovery
files. editSelectionMask returns a copied rectangle and new membership without
changing art, baseline or pending transform. Selected transparent pixels still
replace all four destination bytes; unselected pixels do not write. Move clears
only selected source pixels, then reads immutable baseline for overlap safety.
The shared inverse mapping rotates, nearest-scales and flips both RGBA and mask.
Applying uses existing stale/lock/link/budget checks and one bitmap Undo; empty
and identical outputs preserve redo, allocation and history.

Ellipse includes local pixel center (x+.5,y+.5) when
(2x+1-W)^2*H^2+(2y+1-H)^2*W^2 <= W^2*H^2.
Diamond uses abs(2x+1-W)*H+abs(2y+1-H)*W <= W*H.
Invert is bounded complement. Grow is union with four direct neighbours; shrink
is intersection with them; border is source minus shrink. Each is one simultaneous
pass, outside=0, clipped to original bounds. Boolean union/subtract/intersect/XOR
uses a validated positive local integer rectangle within those same bounds.
No antialiasing, feathering, lasso, wand or full-canvas expansion. Shape commands
replace membership; Reset rectangular mask re-enables rectangle-only workflows.

Website Transform exposes all operations, membership count and a separate blue
canvas overlay. It preserves pending movement/scale when membership changes.
Rectangle-only fills, colour edits, copy/cut buffer, extraction and selection
exports explicitly disable for non-full masks, in both menus and Transform.
Whole-document save/export settle previews through the existing Apply/Discard
prompt. The overlay is UI only and never enters the art or exports. Mask storage
is at most 64 KiB; nearest transformation uses two further 64 KiB temporaries.
RGBA source/output temporaries and one bitmap history retain existing canvas,
cel and history limits. This is a bounded allocation statement, not a measured
process-memory or latency guarantee.

## Phases 13am-13av: masked paint and colour edits

prepareSelectionPaint and prepareSelectionEffect now accept optional binary
Uint8Array membership as their fifth argument (fourth remains history budget).
Rectangular callers retain their existing behavior. Validation rejects wrong
types, size and non-binary bytes before copying; an omitted mask selects all.
Plans keep a private copy and expose mask through a getter returning a new copy.
Caller mutation of the input or exposed mask cannot alter staged membership.
Apply compares the document fingerprint then regenerates pixels, counts and
history preflight from validated rect/options/mask; exposed pixel arrays and
estimates are not trusted. Empty/identity plans preserve redo and sparse cels.

Fill replaces complete RGBA on original members only. Stroke is an inner
Manhattan band: a selected pixel is painted if its distance to the nearest
unselected pixel or outside original bounds is <= thickness (integer 1-256).
Holes create inner boundaries; diagonal-only adjacency is not a direct neighbour.
A two-pass exact Manhattan distance transform is O(W*H), with a Uint16 distance
buffer <=128 KiB and binary band <=64 KiB; thickness does not multiply runtime.
Rectangular stroke keeps its square-cornered inset-band behavior.

Linear/dither/radial/checker/replace/grayscale/invert/alpha retain the 13u-ab
numerical contracts, but counts and writes skip nonmembers. Gradients/dither and
checker remain anchored to the entire original rectangle, without tightening to
mask extents or reindexing disconnected components. Exterior pixels and holes
retain every RGBA byte. Hidden RGB/partial-alpha rules are unchanged.

Website captures a source-mask copy when opening each dialog. Prepare and Close
preserve pending move/copy/rotation/flip/scale and membership; Apply consumes that
preview and edits the original committed mask on selected/linked cels as one
Undo. All ten commands enable in Select and Transform for binary masks. Numeric
fields invalidate prepared output. Buffer/extraction/clear/selection exports
remain disabled for masks until separately adapted. No schema, layer-mask,
clipboard, AI, upload, runtime-dependency or permission changes were made.
Mask storage and copies remain bounded by 64 KiB each; bitmap history retains
its existing three dense-cel buffers plus linked-frame bookkeeping. These source
bounds are not true process-memory/VRAM or hardware latency measurements.


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

`prepareSelectionAction(doc, rect, options, historyBudget?, mask?)` accepts an
optional binary Uint8Array with exactly width*height bytes. It validates/copies
membership and exposes defensive copies. Apply and export regenerate outputs
from current validated source/settings/membership, ignoring exposed output buffers.
Undefined selects all members. All-zero membership is valid. `editSelectionMask`
also accepts `empty`, `mirror-x`, `mirror-y`, `turn-half`, `shift-left`,
`shift-right`, `shift-up`, `shift-down`. All are O(W*H), bounded at 256x256;
shifts sample one adjacent source member with outside=0. No raster bytes, schema
or persistent history are changed by these membership controls.


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

Advanced API: `advancedSelectionMask(selection, operation, combine?)` supports
replace/union/subtract/intersect/XOR for every operand. Wand/colour compares max
absolute byte difference to the seed, including hidden RGB, with optional alpha.
Polygon/lasso use even-odd pixel-center fill with boundary included. Brush paths
use connected Bresenham stamps, size 1-64, clipped square/round footprints. Paths
cap at 4096 points and 16M polygon samples or stamp-pixel visits. Morphology uses
O(W*H) exact L1/Chebyshev distance, radius 1-256, exterior=0; components/holes use
bounded traversal. Largest-component ties select first row-major component.
`selectionMaskBounds`/`tightenSelectionMask` preserve source raster binding; empty
tightening rejects. `SelectionMaskSession` bounds mask undo to 32 entries per
rectangle; `SelectionMaskLibrary` bounds reusable storage to four defensive slots
with exact dimension matching. Neither stores artwork or serializes to projects.
`exportSelectionMaskPng` and `importSelectionMaskPng` exchange opaque black/white
PNG at exact bounds; imports cap at 1 MiB and use the strict bounded PNG reader.
`prepareSelectionPaste(target, source, options, historyBudget?, mask?)` optionally
uses private copied source membership. Apply regenerates output with that mask,
ignores exposed pixel/preview mutations and preserves nonmember destination bytes.


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

`prepareDrawing(doc,path,options,historyBudget?)` validates/copies/freeze settings,
colours, paths and custom stamps. Apply regenerates from source fingerprint and
private stamp bytes, ignoring exposed output mutations. Each destination pixel
changes at most once per stroke, preserving source-order-independent alpha/filter
results (spray acceptance is seed/path dependent). Source-over uses exact integer
straight-RGBA composition; transparent-over is identity. Alpha lock skips zero-alpha
destination and preserves other destination alpha. Shade/sharpen retain final
alpha even with source-over. Blur averages alpha and alpha-weighted RGB over a 3x3
source neighbourhood, preserving center hidden RGB when summed alpha is zero.
Sharpen clamps 5*center-minus-four-neighbours in encoded RGB. Sampling clamps or
wraps per axis. Dither uses canvas-anchored 4x4 Bayer complete RGBA endpoints.
Density 0/100 gives secondary/primary exactly; seeded spray uses a documented
32-bit integer hash. Shade uses stable nearest palette RGB then signed clamped
index steps, skipping transparent source pixels. Pixel-perfect removes orthogonal
one-pixel corners before spacing; stabilization averages up to 17 input anchors
with upward half ties and no release catch-up. Connected path max 65536 samples,
input max 4096 anchors, footprint/mirror max 8M visits. Stamp max 32x32 RGBA, PNG
input 256 KiB, four library slots (16 KiB pixels total), no storage/network. Mask
stamps modulate ink alpha; RGBA stamps use stamp colour; transparent replacement
is explicit. Selected/linked cels, lock/stale checks and bitmap Undo budget stay
in force. Empty outputs preserve redo and sparse cels. No schema change.


## Studio and command workflows (13ck-13cy)

`EDITOR_COMMANDS`, `searchCommands`, `defaultCommandBindings`,
`validateCommandBindings` and `commandForKey` are the shared discovery/binding
contract. Mod means Ctrl/Command. Bindings use a single letter, digit or square
bracket with canonical Mod/Shift/Alt modifiers. Duplicate and selected reserved
browser bindings reject atomically. Empty disables a command. Website preferences
use device-local `ezpix.shortcuts.v1`; shortcut JSON import caps at 16 KiB.
Typing suppresses tool/edit bindings; Mod-bound Save remains available outside dialogs. Composition, native dialogs and pending action prompts suppress global bindings.

`defaultStudioOptions`, `prepareStudio` and `PixelEditor.applyStudio` support
polygon (even-odd fill or outline), quadratic/cubic Bezier curves, premultiplied
RGBA linear/radial/diamond gradients, free clockwise rotation, simultaneous X/Y
shears, convex four-corner projective mapping, cyclic/clipped offsets, diamond
outer contours, alpha-aware cast shadows, alpha dilation/erosion/threshold,
range cel clear/copy/unlink, duration set/percent and range reverse/pingpong/repeat.
These are baked raster/timeline operations, not live effect stacks or indexed
project modes. Numeric geometry controls are a staged workflow; canvas polygon
handles and text/font tools remain future work. Output keeps current dimensions.

Frame indices are zero-based inclusive. Raster operations validate every selected
layer/group's visibility/lock and preserve links, reporting peers outside the
range. Copy snapshots each layer's original active-frame cel and detaches only
selected targets. Unlink detaches each selected target. Clear keeps links and
compacts zeros. Equal independent source buffers remain independent. Sequence
insertion links appended cels to their original frames; reversal moves frame IDs
while tags remain positional. Insertions shift later tags and expand tags ending
at or spanning the insertion boundary. Frame durations remain 20-5000 ms; frames
cap at 32 and the existing dense cel cap remains 4 MiB. Retime is half-up.

Perspective corners are ordered pixel-edge coordinates, inverse mapped at pixel
centres with nearest-neighbour sampling. Shear percentages reject a determinant
below 0.01. Curves use 32-8192 subdivisions based on four times control-polygon
length, joining half-up rounded points with integer segments. Shared destination
membership prevents overpainting at polygon/curve intersections. Alpha dilation
uses the strongest Manhattan-neighbour alpha, nearest distance then row-major
sampling to break ties; newly visible colour borrows that neighbour. Erosion and
threshold retain hidden RGB. Contours touch only alpha-zero destinations; shadows
composite original artwork over the offset colour. All byte output is half-up.

Preparation owns private copied options, detached previews and copied planned frame order/durations. Apply rejects
forged or stale plans and regenerates output. Full structural snapshots provide
one atomic Undo, preserving tags, groups, references, palette and conversion
source. Before Apply mutates artwork: 64 control points within +/-1024, radius1-16,
32 million raster/edge visits, existing dense cel budget, and exact retained-buffer
Undo budget. A no-op does not enter history. Source fingerprints exclude retained
conversion source bytes consistently with other staged core tools.

`expandedOnion` is display-only: 0-8 ghosts each direction, RGBA tints, opacity,
distance falloff and optional wrapping. Nearest visits win duplicate frame IDs;
current frame is never included. Far ghosts composite before near ghosts.
Settings remain in this tab and never enter project pixels/schema. Project writer
stays v10; readers stay v1-v10. Extension permissions remain unchanged.


## Direct canvas workflow helpers (13cz-13dd)

`canvasHandles` and `moveCanvasHandle` translate integer handle positions into
existing Studio options. Polygon, quadratic/cubic curve and gradient points feed
`prepareStudio`; rotation uses atan2 about the true canvas centre; simultaneous
shear handles constrain one percentage each (-400..400); offset handles use an
integer centre anchor; perspective uses four pixel-edge corners. All raster math,
source checks, linking and Undo still run once through the staged Studio engine.
Numeric edits remain available for exact values and singular transforms reject.
Canvas edits commit only on explicit Apply/Enter, not pointer release. Cancelled
or lost pointer capture restores the pre-drag control state without changing art.

`CanvasGuides` keeps at most 16 distinct whole positions per axis, a grid step
1-32, snap tolerance0-8, visibility/rulers and optional canvas edges/centre snap.
`snapCanvasPoint` chooses the nearest guide within tolerance (lower position wins
equal ties), then falls back to half-up grid snapping, clamped to +/-1024.
Guide visibility is independent of snapping. Rulers/guides and split preview are
session view state, never artwork or project schema. UI guide drags snap to grid
without attracting themselves; crossing an occupied guide position is ignored.

Shared command discovery includes unbound Canvas commands. `upgradeCommandBindings`
accepts the complete previous registry or current registry, adds new defaults,
rejects unknown/missing old IDs/conflicts, and preserves existing custom bindings.
Website split preview has independent zoom1-24, pan/scroll/keyboard navigation,
Composite or raw active-cel source, optional staged composite and bounded 3x3
repeat. Overlays never enter native exports. This is one-document split viewing,
not multi-document editing. Physical stylus/mobile and other release gates remain
separate. Writer remains v10/readers v1-v10; no new permissions or dependencies.


## Phases 13de-13dn: dynamics, construction and baked filters

`DrawingPoint.pressure` is optional finite 0-1 (default 1). The moving window
averages pressure alongside coordinates; connected samples interpolate it.
Optional `dynamics` has Boolean size/opacity, minimum percent 0-100 and
linear/soft(square root)/firm(square) response. Paint/dither/spray only.
Geometric size rounds half up with minimum 1; stamps keep their original size.
Opacity scales ink alpha; zero response with opacity enabled skips the dab.
First successful destination visit still wins. Raw anchors remain capped at4096,
connected samples65536 and footprints8M. Website pen events retain pressure;
mouse/touch/keyboard use full pressure. Cancellation does not apply the stage.

Studio `text` bakes an original 3x5 bitmap alphabet with uppercase Latin, digits,
spaces/newlines and !?.,:-+/(). Text128 characters, scale1-8, spacing0-8;
first point is origin. No external font/assets or editable text layer.
`iso` draws diamond/grid/box wireframes using 2:1 projection, origin firstpoint,
unit radius1-16, extent amount1-32, box height secondaryAmount1-32. Intersections
blend once, top/vertical colour wins shared vertices. Construction clips.

Rotate/shear accept optional copied whole-pixel pivot within +/-1024; absent
means exact canvas centre, including half coordinates. Transform `sampling`
defaults nearest; bilinear uses four premultiplied neighbours, transparent
outside samples or wrap. Zero weighted alpha keeps nearest hidden RGB.
Fixed canvas clips; this does not change selection-transform sampling.

New Studio baked filters (all bounded, range/layer selectable, one Undo):
- motion: centered/trailing immutable premultiplied line averages, vector+/-32,
  radius1-16, clamp/wrap; fully transparent averages retain destination hiddenRGB.
- mosaic: average/nearest blocks1-16 anchored to origin, partial edge blocks;
  average is premultiplied, nearest uses block top-left. No document resize.
- posterize: RGB/luma/alpha quantization to2-32 levels, half-up; luma weights
  54/183/19 over256. Fully transparent pixels unchanged.
- edges: Sobel magnitude, absolute4-neighbour Laplacian, diagonal emboss128;
  premultiplied RGB inputs, gain0-500%, clamp/wrap, destination alpha retained.
- noise: mono/RGB/salt variation, uint32 seed, amplitude0-255, density0-100;
  integer hash, no time/randomness, alpha/transparent hiddenRGB preserved.

Studio plans privately capture options including pivots, reject stale/forged
plans and validate all targets/locks/links/budgets before changes. The32M work
limit accounts for block, motion, edge and bilinear sample costs. Existing
linked peers outside target range change and are reported; independent equal
cels stay independent. Writer10/readers1-10 remain unchanged. These are baked
operations, not a live effect stack. Seven new unbound commands migrate without
resetting existing shortcut preferences. Physical pen, browser/device, external
reader and release gates require separate evidence.

## Phases 13do-13dx: soft selection workflow and baked transform tween

`Coverage` is a separate full-canvas width/height and Uint8Array of 0-255 weights.
It is never a binary Selection.mask or a project schema field. `captureCoverage`
selects the full canvas or embeds original binary membership at its canvas offset,
checking layer/frame/dimensions/raw baseline. Sparse reads remain detached.

`editCoverage` provides box feather radius0-32 with zero exterior, exact integral
sum and one half-up division by(2r+1)^2; rectangle/ellipse/diamond operands;
max union, min intersection, clamped subtraction, absolute-difference XOR,
replace, inversion, threshold, levels and opacity. `paintCoverage` connects up to
4096 pixel anchors/65536 samples, with square/round tip1-64, opacity0-255,
hardness0-100, maximum dab overlap and add/erase/replace;8M footprint cap.
CoverageSession holds32 separate mask Undo records and4 named copied session slots.
Slots require exact canvas dimensions; neither masks nor slots enter projects.

`prepareCoverage` captures private mask/action data and stages selected-cel
fill/erase/alpha, affine/perspective transforms or nine existing Studio filter
families. `PixelEditor.applyCoverage` rejects forged/stale plans and regenerates
from private inputs, preserving links and making one bitmap Undo. Previews/pixels
are defensive copies. Existing visibility/group locks and history budgets apply.
Weighted replacement interpolates premultiplied source/destination RGBA; when
both alpha values are zero it interpolates hidden RGB. Weight0 is exact identity,
weight255 exact source replacement. Erase attenuates alpha and retains hidden RGB.
Masked filters render from the whole immutable original cel then mix by coverage;
their neighbourhoods may read pixels outside coverage. Other layers/frames are
unchanged except existing linked peers. References/source/palette/tags stay intact.

Coverage affine transforms combine X/Y scale1-400%, simultaneous shear+/-400%,
rotation+/-360, translation/pivot+/-1024 and nearest/bilinear inverse sampling.
Perspective reuses the shared convex homography, mapping tight nonzero coverage
bounds into four ordered destination edge corners. Payload and coverage sample
together in premultiplied space, excluding nonmember colour. Canvas clips output.
Inverse coordinates within1e-9 of whole pixels snap before interpolation, avoiding
spurious colour from vanishing numerical weights at exact projective boundaries.
Copy retains original outside destination; Move clears weighted source alpha first,
then mixes destination. Overlapping soft moves can reduce alpha; identity affine
transforms are explicit exact no-ops. Fully selected moved pixels clear to RGBA0.

`exportCoveragePng`/`importCoveragePng` use opaque grayscale at exact canvas size,
with1MiB encoded input cap. Gray128 means weight128; old binary-mask PNG import
still rejects it. `extractCoverage` exports raw active-cel pixels with alpha scaled
by coverage, optionally tight cropped by nonzero weights. Unselected pixels are
transparent black. Selected hidden RGB survives. New extracted projects deliberately
contain one independent layer/frame and copied palette, omitting source/references/
tags/history. `exportCoverageExtractionPng` shares the bounded native PNG encoder.

Studio kind `transform-tween` bakes the first selected frame's source on chosen
layers into an existing inclusive range of at least two frames. Angle amount
+/-360, uniform end-scale secondaryAmount1-400%, first point final translation,
optional pivot and sampling, with linear/ease-in/ease-out/smooth easing. Integer
parameters round half up per frame. Every selected cel becomes independent;
outside linked peers stay unchanged. Render destinations start transparent.
Durations/order/tags/references/source/palette remain unchanged. All targets,
work<=32M estimated visits and structural Undo budget validate before mutation.
This is baked animation, not live keyframes. Writer10/readers1-10 are unchanged.

Coverage PNG input uses the shared non-interlaced8-bit RGB/RGBA/indexed decoder,
requiring equal R/G/B and opaque alpha. PNG grayscale/gray-alpha colour types
are not yet supported; convert those files to RGB first. Tween preview displays
the final target frame; applying retains the document's active-frame selection.


## Phases 13dy-13dz: blends and checked layers (0.160.0)

Project writer v11 adds required per-layer `blendMode`. Readers v1-v10 migrate
all layers to Normal; v11 rejects missing/unknown modes before cel allocation.
Eight modes: normal, multiply, screen, overlay, darken, lighten, difference,
exclusion. Channels use encoded byte RGB, no linear-light conversion. Source
alpha includes layer opacity; overlap uses the component blend, non-overlap
retains source/backdrop colours, then source-over alpha. Premultiplied floating
channels round only at the final document pixel. Existing Normal fast paths
remain unchanged. Groups remain isolated Normal composites, with opacity applied
once after their children. A first child blends with transparent black, never
with the group's outer backdrop. No group blend modes or live effect stack.

`setLayerBlendMode` changes global layer metadata in one Undo. Copies, geometry,
Studio previews, playback, sheets, PNG and clips preserve/use the shared blend.
Raw cels, hidden RGB and linked edit identity stay intact. Merge requires both
layers Normal; ungroup requires all descendant blends Normal to avoid changing
their backdrop implicitly. Native layered Aseprite/Piskel/PSD/ORA subsets reject
non-Normal blends explicitly. Explicit PSD/ORA frames-as-layers export bakes
visible composites and retains its existing loss warnings. EzPix retains modes.
Clip v1 readers accept legacy v10 and new v11 embedded projects, with v11 clips
restricted to a Normal flattened layer.

`setLayersProperties`, `duplicateLayers`, `deleteLayers`, `groupLayers` and
`moveLayers` validate distinct existing leaf IDs and create one history command.
Metadata supports visible/locked/opacity/blend; it can change hidden/locked
leaves without painting them, consistent with single-layer controls. No-op
property/reorder operations create no record. Duplication preflights the dense
cel budget, preserves links within each copy and detaches copied pixel buffers.
Delete retains at least one layer and prunes empty groups; Undo restores them.
Grouping requires a contiguous run of sibling leaves within existing group/depth
limits. Moves require siblings, move each selected run one sibling position,
and preserve selected order; neighbouring groups move as complete subtrees.

Website checkboxes are session-only UI state, separate from the active painting
layer and project schema. Batch buttons use the existing pending-preview guard,
dirty/recovery updates and history. This does not add direct multi-cel grid drag,
persistent layer masks, adjustment layers or broader extension permissions.


## Phases 13ea-13ej / 173-182: persistent layer workflows (0.170.0)

Current writer **v12**, readers **v1-v12**. Optional layer `mask` contains an
`enabled` Boolean and exactly width*height bytes; JSON encodes these as `gray`
base64. Optional `effects` is an ordered list of at most eight validated records
(kind, enabled, integer amount). All encoded mask sizes/flags and effect metadata
are checked before cel decoding. Old projects have neither field. Disabled data
is retained, validated and protected from silent native export loss. Masks are
global across frames and separate from binary membership/soft selection sessions.
One full-size mask per leaf adds at most 1 MiB across sixteen 256x256 layers.
Cel limits remain 4 MiB dense equivalent; project limit remains 24 MiB.

`prepareLayerWorkflow` and `PixelEditor.applyLayerWorkflow` copy caller options,
retain private regeneration inputs and reject forged/stale plans. They require
visible/unlocked targets and ancestors, preflight conservative retained-history
bytes (including mask buffers and effect metadata), and create one atomic Undo.
No-op plans preserve redo. Raw artwork, independent/link identities, source,
recipe, references, tags and palette survive metadata edits. Single/batch layer
duplication detaches masks/effects and preserves links inside detached cel copies.

173 / 13ea adds persistent masks, enable/disable/remove and project/recovery
persistence. 174 / 13eb adds mask construction (white/black/raw alpha/shapes),
feather, levels, inversion, square/round soft brush with hardness/opacity and
add/erase/replace, 32-entry draft Undo/Redo and numeric paths. Pointer cancel or
Escape restores the draft stroke. Artwork changes only at Prepare/Apply.
175 / 13ec adds fixed-canvas mask shift, X/Y flip and clockwise quarter-turns:
flip source coordinates, rotate around the canvas centre, then translate;
inverse pixel-centre nearest sampling crops to black outside. Whole-document
resize/crop/scale/rotate/flip remaps masks alongside raw cels, padding masks black.
Spatial effects stay live in the resulting coordinates, and geometry previews
render the actual resulting document rather than transforming an old composite.
176 / 13ed adds exact-canvas opaque RGB grayscale PNG interchange (1 MiB input),
mask removal versus baking, and atomic baking across all distinct linked cels.
PNG grayscale/gray-alpha colour types remain outside the existing decoder subset;
use RGB/RGBA PNG with equal RGB channels. Raw mask draft download preserves the
current draft, regardless of whether it has been applied. Bake effects before
baking a mask; disabled masks remove without changing raw appearance.

177 / 13ee adds live invert, grayscale (54R+183G+19B)/256, brightness -255..255,
contrast -100..100, alpha 0..200% and posterize 2..32 levels. Colour operations
include hidden RGB. Contrast is centred at 127.5 with slope (100+c)/(100-c);
+100 saturates values on either side, with no integer channel at the midpoint.
Posterize rounds to the nearest of N evenly spaced encoded-byte levels.
178 / 13ef adds live top-left nearest mosaic blocks 1..16px and clipped-edge
premultiplied box blur radius 1..4px; zero-alpha blur output has zero RGB.
Each enabled effect rounds half up to bytes before the next effect. Disabled
effects pass through unchanged. Then mask multiplies alpha with half-up byte
rounding (RGB unchanged), followed by layer opacity/blending and isolated groups.
179 / 13eg adds ordered enable/reorder/delete, staged stack replacement and
all-frame stack baking. Baking renders each distinct linked cel once, preserves
independent identity, clears the stack and keeps the mask. Merge refuses remaining
mask/effect metadata. This is a per-artwork-layer stack, not adjustment layers,
group filters, animatable parameters or text layers. Masked/effected visible
composites feed animation, previews, sheets, flattened raster exports and clips.
Layered native subsets reject metadata loss; explicit flattened PSD/ORA frame
export and clip capture bake it. Clip v1 accepts flattened v10/v11/v12 projects.

180 / 13eh adds staged reference-pixel clockwise rotations, flips, nearest scaling
and crop, with the existing four/1024px/one-megapixel collection limits and history
budget. These transform retained display-only reference pixels; canvas positioning,
opacity and tracing overlays are future work. References never enter artwork exports.
181 / 13ei adds multi-layer/frame raw rectangle copy/move to consecutive destination
layers/frames at a chosen canvas origin. Full rectangles must fit. Snapshot reads
make overlapping moves deterministic: clear all sources first, then write original
source rectangles, including transparent RGBA. Edited cels detach from outside
linked peers. Source check order determines destination layer mapping. No system
clipboard, cross-document paste or direct timeline grid dragging is implied.
182 / 13ej adds explicit linked holds through a frame range, range unlink and clear.
Hold reuses the first range frame's cel in each selected layer and overwrites later
slots; empty cels remain explicit. Unlink makes each targeted cel independent.
Frame count/durations/tags stay unchanged. These are explicit links, not implicit
missing-cel holds, live keyframes or embedded clip instances.

Reproduction: `npm test`, `node scripts/phase13eaej-reference.mjs`,
`node scripts/phase13eaej-native.mjs`, `node scripts/phase13eaej-ui.mjs`;
see website handoff 182 for package/build/extension checks and remaining gates.


## Phases 13ek-13et / 183-192: authored assets (0.180.0)

Current writer **v13**, readers **v1-v13**. New metadata is optional; effect records serialize in canonical kind/enabled/amount order. v1-v12
migrations do not reinterpret unknown reference placement, special layers,
group effects, palette organisation or slices. v13 validates new metadata before
cel/reference raster allocation. Shared `prepareAuthored`/`applyAuthored` retains
copied options in a private WeakMap, fingerprints the complete source (without
retained conversion source pixels), regenerates on Apply, rejects stale/forged
plans and preflights conservative retained history. Snapshot restoration removes
absent optional fields, avoiding metadata leaking through Undo. Existing source,
recipe, tags, frames, palette, references and manual raw cels stay intact unless
an explicit reviewed operation changes them.

183 / 13ek: references optionally store `placement` (x/y +/-1024, displayed
width/height 1-2048, opacity byte, visible Boolean, behind/above). Missing placement
means no canvas overlay, preserving legacy sidebar-only display. Placement is
fixed in canvas coordinates across frames and canvas geometry; retained reference
pixel rotation/crop/scale remains separate. `referenceOverlay` clips nearest
sampling to canvas and source-over composites reference order. `referenceDisplay`
is a review helper only; `composite`, animation, PNG/native/APNG/assets/clip exports
never call it. Website overlays use separate pointer-transparent canvases. Reference
pixel limits stay four images, 1024 per source axis, one megapixel combined.

184 / 13el: optional leaf `text` defines original 3x5 authored glyphs, 128 supported
characters, integer origin +/-1024, scale 1-8, spacing 0-8, and RGBA bytes. One global
text definition appears in every frame. Existing baked text shares the glyph data.
Text renders before leaf effects/mask/opacity/blend, keeps raw cel slots empty and
blocks raw painting, linking and pixel transformations. Rasterize explicitly bakes
the definition into independent frame cels and clears `text`, retaining masks and
live effects. Whole-canvas geometry requires rasterization first. Additional fonts,
rich runs, per-frame text and text transform handles remain future work.

185 / 13em: optional leaf `adjustment:true` filters preceding siblings in the same
isolated parent, then interpolates original and filtered premultiplied planes by
layer opacity times enabled mask coverage. Adjustment layers require Normal blend
and empty raw slots. Existing eight live effects are reused. This is ordered
backdrop filtering, not a paintable raster or a pass-through group. Full-stack
Flatten is the explicit bake path because independent adjustment baking can rebind
a backdrop. Flatten bakes all visible frames to one Normal raster leaf, removes
hidden art, original layers/groups, link identity and live metadata, and retains
references/palette/tags/source/slices. One Undo restores the complete prior state.

186 / 13en: isolated groups optionally store up to eight ordered effects. Render
children as premultiplied floats, convert to byte RGBA once at the filter boundary,
apply enabled effects in order, then apply group opacity and source-over. Ordinary
unfiltered groups keep the previous float path/rounding. Ungroup refuses remaining
group effect metadata (even disabled); explicitly clear effects or flatten first.
Group effects and adjustment layers use a shared bounded full-raster compositor.
Per-leaf and group limits remain eight effects; blur radius remains 1-4. This is
not a measured latency/peak-memory guarantee. Native layered subsets reject live
special layers/groups; flattened PSD/ORA and clips bake visible composites.
Native review explicitly reports loss of new palette/slice metadata.

187 / 13eo: `prepareCelGrid` maps a contiguous rectangle in bottom-indexed layer
and timeline-frame slots to a visual top-left destination. Range must fit fully.
It reuses immutable-source raw cel copy/move/clear/unlink/hold plans and one atomic
Undo; targets detach outside linked peers. Website range mode supports anchor,
Shift-click/Shift-arrow or Extend-and-tap, local HTML drag/drop, and explicit
Choose destination for touch/keyboard. Drag/drop chooses a destination only;
Prepare and reviewed Apply remain required. Active paint target does not change.
The review composite is the editing frame; select another frame before range mode
to review it. Range/check state is session-only, never in project files.

188 / 13ep: optional `paletteOrganisation` holds at most sixteen uniquely named
`palette-group-N` groups with disjoint slot-index membership, plus unique locked
slot indices. Lock prevents replacement/removal, not painting with that colour.
Moves/removals remap group/lock indices to preserve identity, including duplicate
RGB swatches. Changes are atomic and never recolour artwork. Ordinary `setPalette`
may append an exact prefix while organisation exists; bulk replacement/reorder
requires the organisation-aware workflow or explicit clear. RGB palette files omit
groups/locks; EzPix and asset JSON retain them. Indexed document mode is not added.

189 / 13eq: optional `slices`, at most 32 unique names/IDs, in-canvas integer
rectangles and relative pivots +/-1024. Definitions are global across frames and
do not paint. UI reviews bounds/pivot crosses; asset bundles map them to scaled
atlas/image coordinates. Native subsets and clips omit them with review. Whole-
canvas geometry explicitly refuses slices until definitions are cleared, avoiding
silent clipping/deletion. Automatic slice remapping remains a later enhancement.

190 / 13er: `exportApng` writes full-canvas non-interlaced RGBA8 SOURCE frames,
no disposal and a contiguous fcTL/fdAT sequence. First frame is also static PNG
fallback. Frame delays are exact duration/1000 seconds. Timeline order is independent
of the editing frame. Named reverse/ping-pong ranges expand playback order; Once
forces one play; otherwise plays 0 is infinite, 1-1000 finite. Integer nearest scale
1-8; one megapixel per frame, 16 MiB aggregate decoded frame bytes and 8 MiB encoded
output. Async source fingerprints reject mixed-generation output. No palette
quantization or browser canvas alpha conversion. Format baseline:
[W3C PNG 3 animation information](https://www.w3.org/TR/png-3/#11Animation).

191 / 13es: `exportAssets`/`exportAssetBundle` emits an engine-neutral ZIP: APNG or
atlas or per-frame/per-slice PNGs, plus `ezpix-assets` JSON v1. Origin is top-left.
Atlas metadata includes scaled frame and slice rectangles and local pivots; source
slice definitions, frame timing, tags/playback IDs and palette organisation remain
in JSON. Atlas and individual images include every timeline frame; named-range
playback order is separate. No native Unity/Godot importer is claimed. PNG is bounded
to one megapixel, region/frame image count to 38, ZIP to 40 entries/8 MiB content.
Paths are generated from numeric indices, never project/slice names or source URLs.
These exports bake visible composites and explicitly omit editable source structure,
references, conversion inputs, hidden art and history.

192 / 13et: up to four uniquely named export presets, strict settings schema and
16 KiB portable JSON. Website device storage contains settings only and requires
Save collection; imports are drafts until saved. APNG previews use the actual locally
prepared bytes. `exportBatch` applies selected presets to one source snapshot,
validates every preset/range, bounds total ZIP work/output, uses numbered preset
folders and includes a batch manifest. Invalid/stale/over-budget preparations yield
no download; artwork and history remain untouched. No background export/upload,
account, shared device sync or additional companion permission is introduced.

Website handoff 192 records exact current verification and remaining gates.

Empty or fully disabled adjustment stacks pass through without introducing a
rounding boundary. Disabled group stacks likewise preserve floating isolation.


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

Core/companion 0.193.0, project writer v14/readers v1-v14. This finishes the
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


## Source conversion and document workspace (206-215 / 13fh-13fq)

Project writer remains v14/readers v1-v14. Matching core/companion version 0.210.0.
`prepareAuthored({kind:'source-grayscale'})` converts every distinct raw cel once,
including hidden RGB/layers, editable text colours and project palette slots using
integer (299R+587G+114B+500)/1000 floored. Alpha, linked identity, masks, live stacks,
groups, timing/tags and palette slot/group/lock identity remain. Changed locked
layers/ancestors or palette slots reject before mutation. References and retained
conversion images remain original. Output mode resets to RGBA. This is a lossy
explicit conversion with one Undo, not a persistent grayscale storage/painting
mode. Future paint can introduce colour. No-op preserves Redo.

The website retains up to four PixelEditor instances, independent artwork/history
and tab labels/zoom. Tool settings are shared. Switches resolve pending previews;
opening an ordinary file still replaces only the active tab. Workspace commands
add blank/copy/file tabs, rename session labels, and explicitly close tabs/history.
Independent session histories are never serialized. Each editor retains the
existing 8 MiB/100-command history cap; four tabs are not a measured peak-memory
guarantee. Individual project/cel budgets still apply.

`prepareAuthored({kind:'document-transfer',project,destination})` takes a copied
source project and stages one target Undo. Raw layer transfer requires matching
canvas and frame count, RGBA source/target output, and an ungrouped non-adjustment
source leaf. It preserves within-layer cel links, copies buffers/masks/text/effects,
and does not modify source artwork. Group context cannot silently rebind. Frame
transfer appends source composites with source timing into a new root layer; old
frames remain unchanged and existing raw layers get sparse empty appended slots.
Existing global text/adjustment metadata still applies in appended frames. Source
layers/groups/links are baked; source tags/references/palette/source metadata are
not imported. Palette transfer appends only missing RGB values while retaining
existing indices and locks; reference transfer stores the active source composite
as display-only pixels. Capacity/geometry/history failures reject before mutation.

Workspace JSON v1 (`ezpix-workspace`) has activeId and 1-4 distinct document-N
entries with label and full project text. Input/output is capped at 8 MiB UTF-8,
projects are validated before restoration, and retained sources are optional. ZIP
v1 starts with stored mimetype application/x-ezpix-workspace, has a strict
workspace.json manifest and numeric documents/document-N.ezpix paths, with the
existing 40-entry/8 MiB expansion/16 MiB encoded archive bounds. Extra/missing/path
substitutions, CRC and invalid projects reject. Imports are reviewed all-tab
replacement, not artwork Undo. New histories start empty. Oversized sessions can
still use individual project downloads; workspace/checkpoint limits do not expand.

A separate all-document IndexedDB checkpoint uses navigator.locks and the existing
atomic write/pending-restore protocol. Restore/keep are explicit, failure retains
the previous checkpoint, and a competing browser tab cannot overwrite it. Source
inclusion follows the editor preference. The prior active-document checkpoint is
separate. Storage/reload automation is not OS-close, physical-device or durable
backup evidence.

Document library JSON v1 stores four uniquely named projects, at most 2 MiB total,
without retained conversion images or history. Device edits/imports remain drafts
until Save library; JSON is portable. Opening creates a new tab. Full authored
metadata/references remain. Storage errors preserve the open artwork and draft.

`exportWorkspaceAssets` bakes selected 1-4 document composites using one validated
asset setting set into numeric document folders and workspace-assets.json. Existing
format/image/frame budgets plus a total 40 ZIP entries/8 MiB content apply. Sources
are fingerprinted across async work. The website exports copied snapshots and
checks live workspace identity again before enabling/requesting a download. No
references/conversion sources/history enter asset images; normal asset losses and
per-document metadata apply. This is engine-neutral, not a native engine importer.

Project v14 palette validation now preserves equal-RGB slots on save/reopen.
Source grayscale can create such collisions; groups/locks keep their numeric
identity. Authored palette edits and cross-document append preserve those slots.
RGB-only palette exchange retains its existing colour-bank normalization.

## Grayscale editing policy (216-222)

Core/companion 0.210.0 writes project v15 and reads v1-v15. Optional
`editingMode: "grayscale"` constrains source RGB equality while storage remains
RGBA. `prepareAuthored({kind:"editing-policy", mode:"grayscale"|"rgba"})`
uses private staged plans, lock/budget checks and one authored history command.
Entry converts raw cels (including hidden RGB), text and palette; duplicate slots,
alpha and per-layer cel links survive. Exit removes the constraint without
recovering original colour. Undo restores source and policy together.

Direct inks, advanced drawing, selection fill/stroke and project paste, palette
and bitmap text, copied document layer/frame/palette transfers and companion
layer imports map through integer encoded-byte gray. References and original
conversion images remain colour. Effects/composites render gray. Unsupported
colour-producing adjustments, coverage/studio actions or clip append reject at
the history boundary and restore prior state without clearing Redo. This is a
bounded constrained editing policy, not gray-channel/indexed storage or profile
conversion. Direct external mutation of public document buffers is unsupported;
project encoding/decoding rejects invalid constrained state.

Project, recovery, workspace JSON/ZIP and library persistence retain the policy;
ordinary replacement imports open their own mode. Aseprite/Piskel and selected
layer PSD/ORA exports refuse policy loss; flattened PSD/ORA/image output bakes
visible pixels and warns that editing policy is omitted. No extension permission
or protocol change. See current handoff for local evidence and unperformed gates.

Grayscale ramp/harmony previews and commits use gray slots and preserve existing
equal-gray slots. RGB-bank sorting/pruning refuses ambiguous duplicate slots in
constrained mode; use authored slot tools to preserve identity.

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

Core/companion 0.232.0 writes project v16 and reads v1-v16. Optional root
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


## Indexed canvas tools (phases 235-244)

`IndexedToolOperation` participates in private `prepareAuthored` plans with
source revalidation, explicit Apply/Cancel, no-op/Redo preservation and atomic
Undo. `defaultIndexedBrush` supplies slot-addressed replacement, ordered 4x4
Bayer two-slot dither and original-index shade steps. Connected strokes use
1-4096 in-canvas integer anchors, at most 65536 connected samples and 8M
footprint visits, 1-32 square/circle tips, mirrors, edge wrapping, spacing,
optional stabilizer and pixel-perfect cleanup. Each covered pixel is changed
once per gesture. Alpha lock skips transparent pixels and any replacement whose
palette alpha differs; it does not synthesize colours. Erase requires the single
designated transparent slot. There is no pressure/opacity blending, spray,
custom stamp or blur/sharpen claim for indexed tools.

Flood uses exact slot identity and a bounded one-enqueue-per-pixel queue.
Line/Rectangle/Ellipse use deterministic integer shapes with outline/fill.
Whole active-cel flip, 180-degree rotation, square-only quarter turns and
wrapped/nonwrapped offset preserve index identity and linked members. Clipped
offset explicitly uses transparency. These are cel operations, not canvas
resize/crop or selection-transform parity.

`indexedSlotUsage` counts references in unique planes across hidden and visible
layers/frames. Remove accepts only an unused slot; prune retains every used slot
and unused designated transparency. Duplicate used slots never merge. Planes,
links and transparency are remapped together, retaining expanded RGBA.

`decodeIndexedCelPng` reads a strict 128 KiB, 1-256 per-axis, non-interlaced 8-bit
indexed PNG subset, preserving original PLTE order/duplicates/unused entries,
tRNS (default alpha 255), hidden RGB and index bytes. It validates chunk order,
CRC, row filters 0-4, exact bounded inflate, index bounds and the single-zero-alpha
storage invariant. Packed/animated/custom-profiled PNG and multi-transparent
tables reject. Existing ordinary PNG import still expands to RGBA. Raw indexed
studio PNG import needs an identical ordered document table, dimensions and
transparent role; no implicit remap or new-document indexed PNG import is claimed.
Project writer/readers remain v16/v1-v16; runtime permission/protocol unchanged.


## Indexed selection and geometry (245-254)

`captureSelection` attaches a private indexed snapshot token for indexed documents.
Main-canvas rectangular move/copy, quarter turns, output-axis flips and pixel-center
nearest-neighbour scale retain exact index identity and linked members. Tokens
survive selection-object copies; full-document source identity is rechecked before
Apply. Invalid/forged/masked snapshots reject. No-op preserves Redo. A move that
exposes source holes requires a transparent slot; an opaque in-place transform or
copy can succeed. Destinations must fit wholly; no implicit remap or clipping.
`indexedSelectionData` exports the original rectangle with its complete ordered
slot table, including unused/duplicate slots. `prepareIndexedSelectionClear`
stages the original rectangle's transparent cut as one authored command.

`prepareCanvasGeometry`/`applyCanvasGeometry` support indexed resize, crop, trim,
nearest scale, quarter turns and flips across every layer/frame, including hidden
and locked artwork, retaining links and independent cel identity. Padding requires
a transparent slot. Trim ignores only that index, even when it holds hidden RGB;
its palette entry remains. Entirely transparent documents retain their dimensions.
Slices must be cleared first. References/placements and original conversion source
stay unchanged; recipe dimensions follow the canvas. Private plans reject stale or
forged Apply; dimension, cel-allocation and undo budgets precede mutation. Indexed
geometry history uses authored state including dimensions and conversion recipe.

`createIndexedDocument` and `decodeIndexedPngDocument` construct a new independent
v16 indexed document from a validated raw cel or strict 8-bit indexed PNG, retaining
PLTE/tRNS/indices and unused/duplicate entries. Fresh histories are empty. Existing
PNG limits apply; no packed/profile/animation support was added. The website opens
a reviewed new tab, with explicit four-document cap and no silent replacement.
Main-canvas indexed masks, arbitrary RGBA effects and wider native fidelity remain
open. Project writer/readers stay v16/v1-v16; no permissions or protocol change.


## Indexed selection masks (255-264)

Version 0.272.0 retains project v16 and indexed/workspace/library envelopes v1.
Transient binary masks are now valid on private indexed selection snapshots.
`advancedSelectionMask` dispatches indexed wand/global range to exact original
slot comparison (tolerance 0, RGBA setting, four/eight neighbours); duplicate
colours never imply the same slot. Other existing shape/path/brush/boolean/
morphology/component/session/PNG membership operations apply within bounds.

Masked move clears only source members, then writes transformed members; holes
leave destination indices unchanged. Indices and membership share rotate,
nearest pixel-center scale and output flip mapping. Opaque moves require every
cleared member to be covered by transformed destination membership. Copy needs
no transparent slot. Empty masks are no-ops and preserve Redo.

`indexedSelectionData` retains original bounds/full table and encodes holes with
the existing transparent slot; opaque files with holes reject. Paste replaces
the full rectangle, including transparent holes. `prepareIndexedSelectionClear`
clears members only. `prepareIndexedSelectionPaint` fills members with an exact
slot or strokes an inner Manhattan band (thickness 1-256, including holes).
Plans privately copy masks, recheck full source/editability/budgets at Apply,
and update linked cels atomically. Membership edits are transient; artwork
history and v16 project persistence retain resulting slot planes. No indexed
RGBA colour effects, native Aseprite fidelity or persistent layer masks implied.


## Phases 265-284: bounded Aseprite fidelity (0.272.0)

`decodeAseprite` reads RGBA32 or indexed8 with original ordered RGBA slots,
including duplicate/unused entries and designated transparent hidden RGB. Input
is privately snapshotted before async inflate. 16 MiB input, 256 pixels/axis,
16 layers, 32 frames, 8192 chunks and the existing 4 MiB dense cel budget apply.
Modern tables take precedence globally over legacy 8/6-bit packets. Initial
palettes must be complete; subsequent partial updates may preserve the same
indexed table, but any frame-varying indexed table rejects. Additional zero-alpha
slots reject. Header transparency overrides only the designated slot with review.
One opaque indexed background layer with full-canvas cels is supported; mixed
background/transparent roles and multiple opaque background layers reject.

Raw/zlib cels inside the canvas expand with transparent padding. Absent indexed
cels get independent transparent planes. Earlier-frame links preserve plane and
raster identity when positions match. Relocated links expand independently with
review. Forward/self/missing-source links reject. Writer emits full-canvas raw
cels and earlier-frame links, including empty RGBA links; equal independent cels
are never implicitly linked. Normal layer opacity and editable/pixel-lock flags
survive both directions. Movement-lock/prefer-link/UUID metadata is reviewed loss.

Native tags support forward infinite/once, reverse infinite and ping-pong
infinite. Other repeats/directions reject. Static frame-zero single-key slices
retain in-canvas bounds and signed local pivots +/-1024; animated, hidden and
nine-patch slices reject. Tag colours/user data are reviewed losses. Groups,
blends, cel opacity/z-index, profiles, grayscale, tilemaps and external files
remain unsupported. `asepriteExportWarnings` reports actual omitted metadata,
including separate project swatches when indexed slots take the native palette.
Project v16, indexed/workspace/library v1 and capture permissions are unchanged.
The specification reference is [the official format document](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md).


## Phases 285-294: indexed ink families (0.296.0)

`IndexedBrush.mode` adds `replace`, `ramp`, `spray`, `stamp` alongside existing
paint/dither/shade. Optional fields preserve earlier callers. Dither density
0-100 and integer originX/Y +/-256 use the existing 4x4 Bayer matrix, strict
`matrix*100 < density*16`, anchored to destination minus origin modulo four.
Shade reads the original index once per destination and clamps signed -16..16
steps; the designated transparent source remains untouched. Explicit ramps
contain 1-256 distinct existing slot IDs in order; signed steps clamp or wrap.
Slots outside the ramp stay unchanged; explicit transparent ramp entries may
paint/erase. Replace compares the exact original `replaceSlot`, including equal
RGBA slots. All modes retain exact table bytes and do not quantize colours.

Spray uses seed 0..2^32-1, density 0-100 and an integer destination-index hash:
`n=(imul(i+1,0x9e3779b1)^seed)>>>0`, then the 0x7feb352d and 0x846ca68b xor-shift
mix; accept when unsigned result modulo 100 is below density. Each destination
is visited once, so overlaps do not accumulate and repeated coordinates replay
exactly. This is coordinate-anchored scatter, not time/rate-based airbrushing.

`copyIndexedStamp` validates/copies an indexed cel up to 32x32 and requires the
identical ordered RGBA table and transparent role. Stamps use native slot bytes,
center with floor((dimension-1)/2), clip/wrap/mirror, and first footprint visit
wins. By default transparent stamp slots leave holes; `stampTransparent:true`
paints the designated transparent slot. Keep-alpha requires equal original/new
slot alpha and skips originally transparent destinations. Palette changes can
invalidate a session stamp. Existing session/file v1 stamp data is an indexed
cel, not new persistent project metadata. `captureIndexedSelection` and
`.ezindexed` provide exact local stamp capture/file exchange.

Indexed flood optionally accepts connectivity 4/8 and global Boolean replacement.
It samples the seed's original exact slot; duplicate-RGBA slots remain distinct.
Only the active cel and linked peers change. Existing 4096 anchors, 65536 path
samples, 1-32 brush size and 8M mirrored footprint visits remain enforced.
Spacing/stabilization/pixel-perfect use shared integer path geometry. Authored
plans privately clone settings, recheck source and locks and apply one atomic
linked Undo. No-op edits preserve Redo. No palette growth, RGBA effects, pressure
alpha interpolation, persistent stamps or runtime dependencies are introduced.

## Indexed pressure (phases 295-298)

`IndexedBrush.pressure` optionally holds Boolean size/density flags, minimum
0-100 percent and linear/soft/firm response. Size supports paint/dither/spray;
density supports only dither/spray. Enabled unsupported combinations reject.
`DrawingPoint.pressure` is finite 0-1; absent is 1. The existing shared connected,
stabilized, spaced path interpolates pressure (stationary changes use the latest).
Response is p, sqrt(p), or p*p. Factor is (minimum+(100-minimum)*response)/100.
Size rounds floor(base*factor+0.5), minimum one pixel; density rounds likewise to
an integer percentage. Density changes Bayer threshold or coordinate-hash coverage,
never slot colour/alpha. Dither density zero writes secondary slots; spray zero
writes nothing. Original-source first-destination-visit semantics still apply,
including overlap at different pressures. Base-size footprint bounds dominate
the dynamic tips; the existing 8M visit budget is unchanged. Stamp resizing,
pressure alpha interpolation, and pressure in other indexed inks remain unsupported.
The website uses pen samples; mouse/touch/keyboard are full pressure. Changing
ink mode resets session pressure settings. Pending plans own copied samples and
settings, retain exact slot identity/linked cels and one atomic Undo. No schema
change; project writer v16 and readers v1-v16 remain.

## Reviewed Aseprite rendered import (phases 299-308)

`decodeAseprite(bytes,title,mode)` defaults to `preserve`. The explicit third
argument `rendered-rgba` renders supported visible normal layers to one unlocked,
opacity-255 RGBA layer with independent frame buffers. Always review its loss
warning before replacing a project. Timing, supported tags and static slices
remain. Hidden layers, edit locks, links, indexed slots and fully transparent
hidden RGB are omitted/baked; keep the original native file. It is not editable
cel-opacity/z-index metadata preservation or true gray-channel storage.

Rendered mode additionally accepts 16-bit grayscale value/alpha pairs, 8-bit
per-frame indexed palettes (including full-table size changes, partial same-size
updates and extra zero-alpha slots), cel opacity/z-index, mixed indexed background
roles, bounded off-canvas images and relocated linked chains. Linked raw data is
resolved from an earlier source; current frame palette/position/opacity/z-index
apply independently. Indexed background layers use palette alpha for the header
slot; other layers force that slot transparent. Missing palette/indices/links,
partial palette resizes and unsupported variants reject, including hidden art.

Cel/layer opacity combines as floor((layer*cel+127)/255), then the existing
straight-alpha normal compositor rounds final channels once. Z order compares
layer index plus signed cel offset, then signed offset. This follows the public
[ASE structure and ordering specification](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md)
with EzPix's explicit compositor/rounding contract; it is not a human Aseprite
pixel-parity certificate. Bounds remain 256px/axis, 16 layers, 32 frames, 4 MiB
dense RGBA cel equivalent, 8192 chunks and 16 MiB encoded input. Additional raw
unique decoded cel bytes cap at 4 MiB before allocation/decompression; linked
raw buffers are counted once. Raw cel dimensions cap at 256/axis, then output
clips to canvas. Groups/blends/tilemaps, custom profiles, precise cel transforms,
animated/nine-patch slices and other unsupported structures still reject.

The website mode selector invalidates staged/busy results and prepared downloads;
choose the file again after changing it. Read errors, Cancel and stale async
results retain artwork. Import uses existing reviewed whole-document replacement
and starts a fresh history; it does not promise Undo back across file replacement.
Subsequent artwork edits retain normal atomic Undo. No project schema, transfer
protocol, permission or runtime dependency change; writer v16/readers v1-v16.

## Issues3 local product rework (0.297.0)

`focusRaster` supports crop, polygon membership and border-connected colour removal.
`trackFocus` performs bounded template matching; `focusAnimation` converts recorded
frames into a shared-palette editable sprite. No still-image pose generation.
`mountConverter` opens shared Focus studio first; Full-image conversion retains the
previous conversion controls behind a disclosure. Video/camera do not upload media.
`readArtworkImage` adds static WebP and restricted SVG; `encodeBrowserImage` exports
reviewed selected-frame JPEG (white matte) and WebP using browser encoding.

`createLargeCanvas`, `LargeCanvasEditor`, `encodeLargeProject`, `decodeLargeProject`
and `exportLargePng` provide separate sparse single-surface editing to 10240px per
axis. Dense animation limits and project-v16 schema are unchanged. Tiled mode is
not a claim that dense tools or native codecs accept 10240px layered animation.
See the website [issues3 contract](../../../glitchbong/docs/ezpix-release-local.md).

Shape outlines accept brush size/tip; indexed shape operations mirror that width.
Jumble samples existing neighbouring RGBA with a deterministic seed.
`PixelEditor.reorderFrame(from,to)` moves a frame in one structural Undo operation.

## Sparse tiled layers and animation (phases 309-328)

The separate `ezpix-tiled` writer is v2; v1 files migrate to one layer/frame.
Dense project writer/readers stay v16/v1-v16. Tiled projects use 1-10240 axes,
1-8 normal RGBA layers and 1-32 timed frames (20-5000ms). No indexed/live masks,
text/effects, tags or direct oversized native format promise is added.

Each layer owns same-layer cel maps and an implicit RGBA background rectangle.
Raw tile pixels override that background, including transparent holes/hidden RGB.
Geometry clips/translates this rectangle so padding is transparent without
materializing an enormous background. A blank/cleared cel inherits its layer's
implicit background. Additional layers begin transparent. Cel links share a map;
independent copies clone maps and share immutable tile bytes until first write.
Duplicate layers retain their internal link classes but never link to the source.

`LargeCanvasEditor` provides layer/frame properties/creation/deletion/reorder,
link/unlink/clear, connected bounded strokes, selection capture/prepare/apply,
local RGBA placement, geometry and Undo/Redo. `largeLayer`, `largeAllocation`,
`largeCompositeTile` and `largePixel` are read helpers. One gesture/structural
operation is atomic, budget failures and cancel roll back, no-op retains Redo,
and default tiles compact away. Hidden/locked layers reject artwork changes;
canvas geometry is explicitly document-wide. Layer attributes remain editable.

Storage: 1024 distinct 64-square RGBA buffers / 16 MiB, 8192 tile references across
independent cel maps, and 24 MiB encoded projects. Linked maps count once per layer.
The v2 file has a shared tile byte table and explicit prior-frame cel links;
decoding checks references/structure before decoding bytes. Structural/history
snapshots share immutable buffers; Undo+Redo+current retain at most 32 MiB of unique
tile bytes and at most 32 commands, plus bounded metadata/maps. Existing history
is evicted only on a successful changed operation. Transient planning/encoding,
clipboard, image and browser buffers are additional; this is not measured total
peak heap, physical-device responsiveness, RAM/VRAM or endurance evidence.

Rectangular capture/placement is at most one megapixel / 4 MiB. Selection plans
keep private source/settings and an encoded source fingerprint; changing public
preview pixels cannot inject artwork, forged or stale plans reject. Move/copy/
flip replaces whole RGBA rectangles; moving clears source to zero RGBA. Fill,
clear and inner-stroke share the same staged transaction. Local clipboard is
session-only; there is no system clipboard permission. Stroke work is capped
at four megapixel brush visits per call, 41000 shape/path points and size 1-64.

`exportLargePng` snapshots the selected frame and composites normal layers with
straight source-over and per-layer opacity, rounded once. Fully transparent
composites normalize hidden RGB. It streams scanlines with a 64-row tile cache
(at most 160 tiles / 2.5 MiB) and a 24 MiB compressed-output guard; no 400 MiB
full-canvas RGBA plane is allocated. `exportLargeFrames` returns PNGs plus exact
frame durations in animation.json, capped at 16 megapixels across frames,
15 MiB PNG payload and the existing 16 MiB ZIP bound. This is a numbered PNG
sequence, not GIF/APNG/video or native cel metadata exchange.

`largeToDocument` materializes supported normal RGBA layers/frames/links/opacity/
locks only when dimensions <=256 and the existing dense cel budget permits it;
the normal editor then offers its reviewed native/animation export families.
`largeFromDocument` is a reviewed flattening conversion of visible composites,
retaining frame durations/active frame, while omitting source/references/tags/
indexed identity/live structure. It never changes the input dense document.

The website adds all-layer/frame controls, a cel grid, view-only timed playback,
staged selection/image/geometry review, local copy/paste, and a separate
`ezpix-tiled-recovery` IndexedDB/checkpoint writer lock. Restore/keep are explicit,
checkpoint replacement is atomic, and history is not serialized. Dense recovery,
Focus/SnapForge and their data/permissions remain independent.


## Tiled transient selections (phases 329-348)

`large-mask` supplies validated binary membership within one bounded rectangle
(up to 1,048,576 bytes), rectangle/ellipse/diamond/polygon shapes, raw selected-layer
RGBA wand with four/eight/global matching, algebra, four-neighbour morphology,
components and hole filling. Polygon/lasso accepts 3-256 integer local vertices
and at most 32 million edge visits. Morphology radius and masked inner stroke
are 1-16; grow clips to the window. Wand tolerance compares all four raw channels,
including hidden RGB and alpha; it does not sample the visible composite.

`LargeCanvasEditor.selection` owns a separate 16-command history and four private
session slots. Current/history/slots retain at most 21 one-megapixel byte planes;
getters return copies. Artwork, clipboard, temporary planes, encoding and flood
queues are additional allocations. This is not measured peak heap. Selection is
not serialized into tiled v2, recovery, PNG or the dense bridge. Geometry changes
clear website membership; selection undo can recall prior bounds, which must be
inside the current canvas before editing.

`prepareMasked`, `copyMasked` and `preparePaste` snapshot private mask/settings/
pixels. All prepared selection edits reject subsequent membership revisions,
project/layer/frame changes and forged plans. Public preview/clipboard bytes do
not control Apply. Selected source members alone clear on move; transformed
members replace destination RGBA while holes preserve destination artwork. Source
capture precedes overlapping writes. Clear/fill/inner stroke and paste use one
linked artwork Undo; no-op retains Redo. Membership stays at its source coordinates
after transforms. Local image placement retains full-rectangle replacement.

`encodeLargeMask` / `decodeLargeMask` exchange `.ezmask` JSON, kind
`ezpix-selection`, version 1, absolute rectangle and alternating zero/one run
lengths starting with zero. Input is capped at 3 MiB, total runs must exactly
match the validated window, only the first run may be zero. No artwork, source
media or project name is included. This is binary selection exchange, not PNG,
persistent layer masks, soft coverage or native-editor mask compatibility.


## Tiled transforms and PNG membership (phases 349-368)

`largeWarpRaster` transforms a bounded mask and raw RGBA together using nearest
pixel-centre sampling. `turn` performs 0/1/2/3 clockwise quarter turns, then
nonuniform output scaling; flips occur on output axes after sampling geometry.
`rotate` accepts -360..360 degrees and expands translated corner bounds; `shear`
accepts X/Y factors -4..4 with invertible matrices. `perspective` accepts four
convex corners in source-corner order inside an explicit output window, rejecting
self-intersection, degeneracy and projective horizons. Source/output windows each
stay at one megapixel and 10240px axes. There is no smoothing or colour inference.

`LargeCanvasEditor.prepareWarp` snapshots source/membership/settings into a private
plan and probes allocation limits before returning. The public output pixels,
membership, destination layer context and bounds are review data; mutations do
not affect Apply. Source moves clear original members before placing captured
output members, preserving destination holes and linked atomic Undo. Clipboard
transforms always copy. Artwork plans invalidate on content, layer/frame, lock or
membership revision changes. Empty/identity operations preserve Redo.

`adoptWarpSelection` explicitly installs private output membership, either as a
selection-only action before artwork Apply (invalidating that pending plan), or
after successful Apply at its recorded state. Selection history remains separate;
artwork Undo does not restore membership. The website defaults to retaining source
membership and offers an opt-in adoption checkbox. `prepareCut` stages clear and
a private clipboard snapshot; the website updates its clipboard only on successful
Apply. Cancel retains both; artwork Undo does not erase the local clipboard.

`exportLargeMaskPng` writes opaque RGBA black/white, at most one megapixel.
`importLargeMaskPng` snapshots input bytes, limits files to 5 MiB and requires exact
supplied window dimensions and opaque binary pixels using the existing strict
8-bit, noninterlaced PNG subset (including supported RGB/gray/indexed inputs).
No thresholding, colour-profile conversion or automatic resizing. PNG carries
membership dimensions, not its canvas origin; placement uses the current window.
JSON `.ezmask` remains the absolute-bounds exchange. Neither persists layer masks.

Transform planning retains private source/output masks, output RGBA and public
output/membership/context plus a sparse probe. Each dense plane is bounded by the
one-megapixel contract (RGBA at most 4 MiB, membership at most 1 MiB); temporary
planes and existing project/history storage are additional. This is not a measured
peak-process-memory or minimum-hardware certificate. Tiled v2 and dense v16 schemas,
16 MiB tile storage, 8192 references, 24 MiB project files and all release gates stay.


## Persistent tiled layer masks (369-388)

The phases 369-388 writer was v3 (readers v1-v3); v4 below supersedes that writer. Optional per-layer `mask` holds enabled state, an
outside coverage byte, absolute bounded rectangle and 8-bit coverage plane.
Each window is at most one megapixel; at most eight layers imply at most 8 MiB
current mask planes. A static mask applies across every frame of its layer.
Selection membership stays transient and separate. Coverage scales encoded-alpha
before normal source-over and layer opacity; raw artwork bytes are unchanged.
Projects serialize mask coverage as canonical base64, validate input bounds and
24 MiB total file size. Mask-enabled v3 files require the matching new reader.

Mask edits are private staged plans with explicit Apply/Cancel, whole-project and
selection-revision stale checks, one artwork Undo and no-op Redo retention.
History counts distinct coverage buffers along with tile buffers inside the same
32 MiB retained-byte cap. Non-mask actions share immutable mask planes; edits
replace them. Independent layer copies retain separate mask metadata and edits.
Reveal/hide derives binary coverage from selection; invert, uniform/outside,
enable/remove, bounded local strokes and separable box feather (radius 1-16) are
supported. Stroke work caps at four megapixel tip visits and 4096 input points.
Geometry translates/clips mask windows; wholly clipped masks become a uniform
outside-coverage representation. Pixel stroke edits still target raw artwork.

Opaque grayscale mask PNG exchange keeps every byte, requires exact window
sizes and <=5 MiB input. PNG omits canvas origin/outside/enabled metadata; native
v3 projects keep all three. Mask bake changes all unique cels, retains linked
identity and raw RGB, rounds alpha to a byte, then removes the mask as one Undo;
work caps at four megapixels across independent cel planes. Rounding may change
compositing by a byte. Dense bridging requires explicit baking/drop review for saved
masks, within existing dense budgets. Current export/recovery resolve v4 frame masks as described below.
Current storage caps, temporary allocation caveats and external release gates stay.


## Soft-mask authoring and portable coverage (389-408)

`authorLayerMask` adds local linear/radial gradients, square grow/shrink radius
1-16 (outside-padded, clipped to its window), levels/gamma (0.1-5), inclusive
threshold, coverage min/max/multiply/subtract, and nearest-neighbour transforms.
Gradient endpoints are local pixel centres; outside coverage stays unchanged.
Tonal and combine operations also update the outside byte. Combinations use the
union rectangle, capped at one megapixel, and mathematical outside coverage.
Disabled data can still be edited; the enabled flag is retained.

Coverage transforms share quarter-turn/scale/output-flip and inverse affine/
perspective sampling. They relocate/replace the saved window; the old window
returns to outside coverage. Geometric output holes use outside coverage. All
input coverage bytes, including zero, are sampled; this is separate from artwork
Copy/Move. `layerMaskSelection` thresholds only the bounded window into transient
binary membership and has separate selection history. Plans show future enabled,
outside and origin metadata, while retaining private Apply bytes.

`LayerMaskLibrary` owns four copied session slots, at most 4 MiB retained coverage,
additional to project/history storage. Store/clear are session operations; recall
is a staged project-mask replacement with one artwork Undo. A new editor clears
these slots. They are not checkpoint/project metadata.

`encodeLayerMask` / `decodeLayerMask` exchange `.ezcoverage` JSON kind
`ezpix-layer-mask`, version 1, enabled/outside/absolute rect and canonical base64
coverage. Input <=2 MiB; at most one megapixel and 10240px axes. No artwork/source
media. Grayscale PNG still omits origin/outside/enabled metadata: website import
uses the current mask window/outside with explicit replace/min/max/multiply/
subtract policy and reviewed output. At phase 408, the native project/recovery writer was v3;
dense writer stays v16. All previous resource and external-release gates remain.


## Tiled v4 mask animation (phases 409-438)

Writer v4 reads v1-v4. Existing static `layer.mask` data remains static on migration.
An optional `maskCels` record replaces it only through explicit animation review.
Every frame owns an explicit mask or null (unmasked); non-null object identity links
mask cels within a layer. Artwork maps and mask links are independent. No cross-layer
mask links are authored. `largeFrameMask` is the authoritative frame lookup.

`prepareMaskTimeline` stages enable/static conversion, link/unlink, selected-frame
copy to a range (independent or linked), clear range, advanced coverage edits on a
range and baked duration-weighted tween. Ranges are inclusive zero-based indices
in current frame order. Range edits preserve links inside the range and split links
outside it. Copy uses the selected mask, including unmasked. Tween needs at least
three frames, matching endpoint windows/enabled flags, preserves endpoints and
replaces intermediate cels using start-time weights (sum of preceding durations,
excluding the final frame duration). It interpolates bytes/outside with nearest
rounding; it does not add live keyframes. Static conversion retains selected-frame
coverage only and reviews discarded variations.

Ordinary `prepareLayerMask` affects a static mask or the selected animated mask and
its linked mask cels. Bake covers the entire selected layer, removes all saved masks
and splits raw cel links by effective mask identity where needed. Work is limited to
four megapixels across enabled cel/mask pairs; disabled/unmasked pairs need no scan.
Raw RGB, including hidden RGB, survives alpha baking; alpha quantization may change
multilayer composite rounding by one byte. Dense bridge requires explicit review,
uses the same pair separation and retains its existing dense limits.

Blank frames have null mask cels; duplicates copy independently (immutable coverage
buffers can be shared until edited). Layer duplicate preserves internal links and
copies ownership. Delete/reorder and all-frame geometry retain valid frame references
and mask link classes. Codec emits backward links in current frame order, explicit
nulls and canonical mask metadata/base64; it rejects forward/dangling/mixed-mode
references and rejects aggregate decoded coverage before allocating beyond 8 MiB.

One mask window remains at most 1,048,576 bytes. Current logical coverage is at most
8 MiB across unique mask cels, with at most 256 frame references; logical allocation
counts independent cels separately even if immutable byte arrays share storage.
Actual distinct retained coverage/tile buffers count against the existing 32 MiB /
32-command history bound. Project JSON remains 24 MiB; tiles remain 16 MiB / 8192
references. Preview clones, encoding strings, selection and session libraries add
temporary memory; these limits are not a measured peak heap guarantee.

Plans hold private snapshots with whole-project/selection staleness checks, explicit
Apply/Cancel and one atomic artwork Undo. Rendering, frame PNG/ZIP and separate local
recovery resolve the requested frame. PNG and portable coverage exchange affect
selected mask links. Indexed/live/text/native large-workspace integration and all
physical/human/release gates remain separate.


## Sparse indexed authoring (439-468)

Tiled writer v5 reads v1-v5; older versions remain RGBA. Optional `indexed` stores
1-256 exact RGBA palette entries plus a designated zero-alpha transparent slot.
Unused entries, duplicate colours and hidden RGB in zero-alpha entries persist.
Indexed layers use `backgroundIndex` inside their background bounds and the
transparent slot outside; their RGBA background must be zero. RGBA projects reject
index backgrounds. Tiles remain clamped byte arrays but indexed tiles contain
4096 slot bytes (64x64), versus 16384 RGBA bytes. Invalid slots, mixed storage,
noncanonical base64 and legacy mode injection reject. The 1024-tile/8192-reference
cap yields 4 MiB indexed or 16 MiB RGBA current raw storage. History counts actual
distinct tile/coverage bytes under its 32 MiB/32-command cap; metadata, previews,
encoding, selections and session libraries add memory outside that accounting.

`createLargeIndexed`, `largeRawIndex`, `largeIndexColor`, `largeBackground`,
`captureIndices` and `largeIndexWand` expose explicit mode-aware reads. Exact wand
supports four/eight/global membership inside one megapixel; equal RGBA colours
in different slots remain distinct and no colour tolerance is applied.

`strokeIndex` supplies square 1-64px slot tips, bounded to four megapixels of tip
work, with gesture commit/cancel and copy-on-write tiles. Existing shape points
feed that API. `prepareIndexed` stages bounded rectangle/membership fill, clear to
the transparent role, and 1-16px inner stroke; holes retain destination slots.
Saved coverage remains separate and composes after palette alpha. Linked cels,
independent duplicates, layers, frames, all-frame nearest geometry and recovery
retain slot identity. Blank frames reset overrides to the layer background.

Palette set/append/duplicate, unused non-transparent removal, complete permutation
and implicit background changes are reviewed. Permutation remaps palette, tile,
background and transparent-role references to preserve appearance. Removal rejects
any raw use, including background/padded tile bytes; remaining slot references
shift. Background changes affect implicit pixels only: existing allocated tiles
retain their raw slot values. Global palette/mode changes require unlocked layers.

Exact RGBA-to-indexed conversion scans sparse raw tiles/backgrounds in deterministic
order with transparent RGBA zero first; more than 256 raw RGBA entries reject with
no quantization. Masks, layers, frames and raw links persist. Indexed-to-RGBA
resolves raw slots and retains masks/links but loses duplicate/unused slot identity.
These changes are private snapshot plans with Apply/Cancel, whole-project and
selection staleness checks, no-op Redo and one artwork Undo. Dense bridge requires
explicit reviewed RGBA conversion/baking within existing dense limits.

PNG/frame ZIP render visible RGBA with palette alpha and per-frame coverage, not
raw indexed PNG identity. Indexed artwork transforms, cut/copy/paste, RGBA image
placement and alpha-mask bake reject until reviewed conversion to RGBA; coverage
transforms themselves remain supported. Direct raw indexed PNG/native exchange,
slot-safe artwork transforms/clipboard and richer indexed ink policies remain
separate work. No live layers/text/native large-workspace parity is implied.

RGBA conversion rejects nonzero hidden RGB in implicit transparent padding that the
RGBA sparse model cannot represent; keep indexed storage or use the reviewed dense
bridge within its materialized bounds. No hidden padding RGB is silently discarded.


## Issues-4 shared controls (0.459.0)

Eight original palette collections are exported as PALETTE_PRESETS and supported
by conversion recipes, editor swatches and Focus studio. Original/adaptive
remain available. New recipe palette values require this engine version.
Spray options accept optional spraySoftness and sprayColorMix integers 0-100;
omitted values retain legacy bytes. Softness tapers density and alpha by radial
distance. Colour mix interpolates primary to secondary RGB toward the edge.
The same seed/path/settings remain deterministic; source and linked-cel/Undo
contracts remain unchanged. This is dense RGBA brush support, not new sparse
indexed spray parity. See the issues-4 tests and current numbered handoff.


## Sparse indexed transforms and clipboard (481-500, 0.460.0)

prepareWarp now samples raw index bytes with exactly the same nearest-coordinate
kernel as RGBA. Quarter turns, scale, output flips, arbitrary angle, signed shear
and convex perspective preserve duplicate/unused palette entries and selected
zero-alpha slots. Output holes preserve the destination; moving clears every
original member to the designated transparent slot before replacing destination
members from a private pre-edit capture. Linked cels edit together; independent
copies retain COW buffers. Saved coverage stays at its existing frame/location.
Plans remain private, source/frame/layer/palette/selection/lock bound, atomic and
undoable. Output-membership adoption is explicit and uses separate selection
history. A source rectangle can be passed as the third prepareWarp argument;
it creates no persistent selection. Indexed prepare/prepareMasked transforms
use this kernel. RGBA fill/placement calls still reject indexed storage.

copyMasked/copyRect snapshot membership, raw slots and the complete ordered table
including hidden RGB, duplicate and unused entries and transparent role. Readonly
metadata and defensive getters expose display RGBA and copied slot/membership
planes, never the backing snapshot. Clipboard paste always copies; it cannot
clear an unrelated source. Cross-document paste requires identical colour mode,
ordered palette and transparent role, with no implicit remapping/quantization.
Cut returns a private clipboard and a separate staged clear plan. A no-op cut
can update a UI clipboard without adding artwork history or discarding Redo.

encodeLargeClipboard/decodeLargeClipboard exchange strict version-1
`ezpix-tiled-clipboard` JSON in .ezclipboard files. One-megapixel windows, 10240px
axes and an 8 MiB encoded limit apply. RGBA and indexed planes have exact lengths,
canonical base64 and explicit binary membership; holes contain zero RGBA or the
transparent slot. Full table binding is validated at paste preparation. This is
an explicit local file, not OS clipboard access or raw indexed PNG/native exchange.
Raw tile/history/project budgets and dense v16/tiled v5 remain unchanged. Preview,
clipboard and encoding copies add memory beyond retained-artwork accounting.


## Extension-first completion pass, 0.461.0

The packaged Chrome extension includes an offline manual Pixel studio using
PixelEditor and the shared authored/indexed plans: drawing, rectangle selection
move/copy/nearest scale/quarter turns/flips, reviewed all-frame canvas geometry,
layers, timed frames, Undo/Redo and file exchange. The converter and Focus studio
accept an optional onEdit callback; suspending their capture UI stops camera tracks.
Indexed delete-layer is an authored operation that removes both the layer and its
raw planes in one Undo. Dense v16 and tiled v5 schemas are unchanged.

RawIndexedRaster / encodeRawIndexedPng / decodeRawIndexedPng retain complete ordered
RGBA tables and raw index bytes, including duplicates, unused entries, multiple
zero-alpha slots, partial alpha and hidden RGB. Non-interlaced 8-bit palette PNG
only; 1-10240px axes, at most 1,048,576 pixels and a 5 MiB file. The shared strict
PNG parser validates CRC/order/filter/slot/bounded-inflation rules and rejects
animation, custom profiles, packed/interlaced and unsupported chunks. Existing
dense IndexedCel PNG wrappers retain their stricter 256px / 128 KiB / single-clear
policy, and share the raw writer without relaxing dense document validation.

captureLargeIndexedPng exports the selected raw-layer/frame rectangle. It does
not bake layer opacity, visibility, other layers, selection holes or saved coverage.
PNG omits location, animation, links and the editor clear role. largeFromIndexedPng
creates a separate one-layer/frame sparse project. The caller must explicitly
choose an existing zero-alpha slot, or append one unused transparent slot while
retaining every original slot. An opaque full 256-slot table cannot fit the sparse
editor's required clear role. No palette matching, quantization or RGBA remapping
occurs. Project save/reopen preserves the chosen role and all original raw slots.

## Integrated tilemaps, 0.462.0

`Layer.tilemap` stores static row-major exact tile references/flags and a shared
RGBA tileset. `TilemapOperation` authored plans capture, share, paint/fill/erase,
edit tile pixels, append/duplicate/reorder/remove tiles and explicitly rasterize.
Copy-on-write global tile edits update every map user atomically; stale/private
plans and Undo memory budgets include all tile/map arrays. Maps participate in
layer compositing, visibility, opacity, groups, blends, masks and live effects.
Ordinary projects still write v16; live map projects write v17 with a shared
root catalog. Readers accept v1-v17. Limits: four sets/256 total slots/1 MiB tile
bytes/65536 total cells, tile axes 1-64 dividing the dense canvas. No indexed
remapping or implicit baking. Unsupported raw/native workflows reject explicitly.

`exportTilemapBundle` produces finite orthogonal Tiled JSON plus exact atlas PNGs
and source.ezpix without conversion sources. Static map-layer order/visibility/
opacity and unsigned global-ID H/V/D bits survive. Map groups, enabled masks/
effects, non-Normal blends, mixed tile sizes and output conversion reject this
export; other non-map content is omitted from TMJ and retained in source.ezpix.
`mountTilemapPanel` from `@ezpix/core/tilemap-ui` shares the inspector and
cancellation-safe map pointer/keyboard-coordinate controls across both products.
Full schema, restrictions, directions and remaining capabilities are documented
in sibling glitchbong/docs/ezpix-tilemaps.md. This is dense/static RGBA tilemaps
with Tiled export, not animated/indexed/sparse maps or a Tiled importer.

## Reviewed Tiled import, 0.463.0

`decodeTilemapBundle` validates the complete ZIP directory/CRC/expansion budget,
strict Tiled JSON 1.10 map and native PNG atlas before allocating map planes.
Initial import is finite orthogonal tile layers with one inline, unspaced root
PNG atlas, common tile size, zero offsets, array cell data and H/V/D transforms.
Layer opacity rounds to the nearest byte, with upward ties, disclosed in review.
External resources/TSJ, groups/objects, properties, animated tiles, chunks and
compressed map data reject. Every atlas slot, duplicate, unused tile and hidden
RGB byte is retained; firstgid maps to local IDs. Optional source.ezpix/README.txt
are checked as ZIP bytes and ignored, never parsed or trusted. Fixed supported
filenames and all native archive/image limits apply (16 MiB input, 8 MiB ZIP
expansion, 2 MiB map JSON, one-megapixel atlas and existing tile/map budgets).

`tilemap-import` authored plans append the detached maps above existing artwork
on a matching RGBA canvas, with unique destination layer/tileset IDs, preserved
shared aliases, stale/private plan validation and one atomic Undo. Sprite cels,
palette, dimensions and timeline remain intact; the maps are static across all
existing frames. Imported tiles detach from prior tilesets. Wrong dimensions,
locks, modes and aggregate/Undo budgets reject before committing. The shared
inspector stages the same reviewed operation in both website and extension.
OpenRaster/workspace readers retain their original required-mimetype behaviour;
the Tiled codec explicitly selects the generic validated ZIP reader.

## EzPIX Insta standalone launch, 0.464.0

The public Chrome name is EzPIX Insta. Shared Focus studio branding and download
names match it. Converter/Focus `showApply:false` hides external apply controls;
default behaviour is unchanged for website and developer bridge tests. The
production extension disables website handoff/discovery and makes Pixel studio
the primary popup action. Formats, document schemas, algorithms and permissions
are unchanged. The website continues to consume the matching versioned archive.
