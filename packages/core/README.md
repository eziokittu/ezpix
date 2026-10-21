# @ezpix/core 0.32.0

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

Up to 16 layers, up to 32 frames within a 4 MiB cel-pixel budget, 1–256 pixels per axis. Project v10 is bounded plain JSON, at most
24 MiB, with optional original RGBA source and a versioned conversion recipe.
The entire source is included, even outside the crop, unless explicitly omitted.
v1/v2/v3/v4/v5/v6/v7/v8/v9 remain readable; unknown versions and malformed/bounded data are rejected.
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
named range. Clip v1 embeds a strict flat v10 project with no groups, sources,
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
