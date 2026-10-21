# @ezpix/core 0.11.0

Original deterministic RGBA editor and image conversion engine. No runtime
dependencies or inference. Build with the workspace `npm run build`.

The main entry exports document/history/codec and pure conversion functions.
`/browser`, `/converter` and `/converter.css` provide optional browser adapters
and shared controls; `/worker` processes conversion jobs; `/transfer` validates
the local Chrome handoff. Pure conversion does not access the DOM or network.

Up to 16 layers, up to 32 frames within a 4 MiB cel-pixel budget, 1–256 pixels per axis. Project v4 is bounded plain JSON, at most
24 MiB, with optional original RGBA source and a versioned conversion recipe.
The entire source is included, even outside the crop, unless explicitly omitted.
v1/v2/v3 remain readable; unknown versions and malformed/bounded data are rejected.
v4 stores ordered frames with 20-5000 ms durations and one independent RGBA cel
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

Project v4 also stores up to 256 hex palette colours. Older v3 files
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

Current continuation 11 adds shared quick conversion presets, transparent-margin
trimming, cached source thumbnails and reusable idle conversion workers. Busy
work is still terminated on cancellation/replacement. Sprite finishing is
undoable and layer/frame scoped. The website has a separate tiles/map workspace
with .eztiles files, independent recovery, exact deduplication and starter
patterns. Maps do not change sprite v4 files. See the latest handoff for bounds,
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
conversion sources are not stored there. See sibling website continuation 18
for the exact support matrix, independent-reader evidence and remaining gates.
