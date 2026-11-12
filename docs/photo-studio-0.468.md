# EzPix Photo studio and mobile revision

12 November 2026. Shared core/extension 0.468.0; Android 0.4.0 / code 5.

EzPix is now a local photo editor with an optional pixel/sprite workflow. The new
Photo mode processes at source resolution (within the existing four-megapixel
input budget) in a worker and exports PNG/JPEG/WebP. It does not pass photos
through the 256px PixelDocument converter. Animated inputs export their first
frame in Photo mode; switch to Pixel mode for the existing animation formats.
Photo PNGs are flattened images, not layered projects. Source edits retain
Preview/Apply/Cancel and the bounded image Undo/Redo history.

Eight new editing groups:

1. Local sticker/image import, including transparent PNG and validated SVG.
2. Emoji drawer using device fonts; glyph appearance depends on the device.
3. Regular text with Sans/Serif/Mono, plain/outline/label, colour and placement.
4. Original star/heart/speech/arrow/lightning/circle clip art.
5. Freehand doodling with colour and brush width; one Apply per stroke.
6. Regional pixelation, blur and solid cover. Only solid cover fully conceals
   information; decorative blur/pixelation are not secure redaction.
7. Photo resizing with aspect-preserving fit presets, custom dimensions and
   smooth or nearest sampling, within four megapixels.
8. Foreground live camera: six looks, camera facing, mirror, grid and 0/3/10s
   timer. Looks/mirror bake into the captured image; the grid does not. Camera
   and pending shots stop on close, visibility loss or disposal. No audio.

Stickers, emoji, text and clip art have size, position, rotation and opacity.
Apply bakes them into all source frames; they are not individually editable
layers after Apply. Undo restores the source. Pending image previews cannot be
exported until Apply or Cancel. No model, account or remote sticker/font service.

Selection New/Add/Remove is prominent and persists across magic, rectangle,
ellipse, brush and lasso. The website dense editor combines selection snapshots
in document coordinates and provides Move separately from membership drawing.
Its sparse editor preserves Add/Remove and now supports a selection brush too.
All paths preserve holes until the explicit image/selection operation is applied.

Android: the drawer overlays the lower canvas and can expand or collapse without
changing canvas allocation. The restore-control button sits below the viewport.
The loop shows three full items and two partially clipped edge items, with a
larger centre icon/label and perceptible individual fading. Pan/Fit sit left;
Save/Share sits right with PNG save, Android app chooser and account-free LAN
handoff. Shared Android copies remain in private cache for up to an hour so the
receiving app can read asynchronously; cleanup also runs at startup.

Web: /tools/ezpix/photo, linked from both pixel workspaces, uses the same engine
and creative forms. Local share receives large photos here without fitting them
to a pixel document. Existing pixel workspaces and document schemas retain their
bounds and indexed semantics.

Chrome: the popup gains creative groups integrated into its expanded settings
tabs. Photo & camera opens photo.html in a persistent extension tab, so permission
prompts do not dismiss the toolbar popup. Default Insta capture remains Pixel
mode. Device sharing snapshots either the current photo PNG or pixel project.

Research: Snapchat's official sticker drawer and creative tools informed the
interaction pattern, not its assets or implementation:
https://help.snapchat.com/hc/en-us/articles/7012364407060-How-do-I-add-stickers-to-my-Snaps
All supplied clip art is original canvas geometry; imported artwork stays local.

Verification records and remaining device gates are in the Android STATUS and
website photo-studio handoff. Builds/DOM/CPU pixels do not prove camera drivers,
Android URI grants, touch feel or physical LAN pairing. No stores/site deployed.
