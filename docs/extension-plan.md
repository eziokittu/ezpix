# EzPix extension implementation map

2026-10-21: extension 0.11.0 uses core 0.11.0 and opens `/tools/ezpix` directly. Exact root and
legacy editor paths are authorized; help/other subroutes remain denied. The
website shell correction and remaining migration/capture integration work are
recorded in continuation 18 and the correction roadmap. Release work is deferred.

2026-10-19: phases 2 and 3 implemented locally. Read the authoritative
[specification](../../glitchbong/docs/ezpix-spec.md) and latest
[handoff](../../glitchbong/docs/ezpix-continue18.md).

## Implemented architecture

Manifest V3, minimum Chrome 120. Popup invokes region/element/visible capture.
An isolated injected selector clips to the viewport, supports Esc and removes
its overlay before capture. The background verifies document, active tab and
viewport/scroll/DPR around the screenshot. Cropping uses actual screenshot
dimensions. Full screenshots are bounded to 16 MP; retained crops to 4 MP.
No arbitrary remote image proxy or full-desktop capture is implemented.

The extension tab uses the core 0.11.0 converter and worker. PNG/project downloads
are available without the website. Source inclusion is explicit: it retains the
entire imported image, including pixels outside the conversion crop.

Permissions: activeTab for user-invoked visible capture, scripting for selector
and viewport validation, alarms for expiry cleanup. IndexedDB stores capture,
selection and transfer state; there is no storage/sync or blanket host permission.
User images, project names and source URLs do not enter analytics or logs.

## Local website handoff

Externally connectable messaging is scoped to the website; runtime authorization
also checks exact origin, the exact `/tools/ezpix` or legacy `/tools/ezpix/editor` path, top frame, destination tab,
random token, protocol and expiry. Only a fragment token and extension ID enter
the URL. Payloads use 128 KiB raw/base64 chunks, a 16 MiB total cap, engine/version
checks and SHA-256 validation before project decode. The website receives into
staging and replaces artwork only on explicit import, warning for unsaved edits.

Transfer state survives service-worker suspension. ACK removes payload bytes,
keeps an idempotent receipt until expiry and is sent after accepted import.
Closing the destination tab invalidates its transfer. Capture/selection/transfer
records expire after 10 minutes. Clear removes retained extension data. Existing
pixels in open converter/editor tabs remain until replaced or closed.

One pending handoff is retained: opening another invalidates the old pending
token. There is no background sync, collaborative editing or reverse web bridge.
Project-file export/import is the fallback. Browser and extension preferences
are local and independent; both offer GlitchBong System/Dark/Light colours.

## Evidence and remaining gates

The production Next build, 41 engine/protocol/navigation tests, lint and route policy checks
pass. Actual unpacked-Chrome region/element capture and website messaging pass,
including exact fixture pixels, wrong tab/token, worker stop/restart, import
cancellation and ACK retry. See the handoff for exact evidence and commands.

Phase 7a adds real zoom/scroll/clipped/iframe/restricted-page/navigation capture
checks, native Chrome/Edge visibility checks, fresh npm-ci and configured builds,
and a bounded browser process-memory/input stress run. Selection now intercepts
pointer events above embedded frames; element hit testing still uses the parent
document and captures visible pixels only. Extension 0.9.1 uses shared core 0.9.0.

Still required before release: longer endurance and true peak/VRAM measurements,
Firefox/Safari and broader real-page capture coverage, physical
touch/stylus checks, product/dependency licence review,
packaged release review, deployment and store submission. Successful local QA
does not establish those gates. Palette grab, references as layers, recipe import,
desktop capture remain proposals. Sprite slicing is available on the website.

## Website toolkit update

Core 0.11.0 writes multi-frame layered project v4 and reads v1/v2/v3. The companion continues
to create a single-layer conversion; website import and retained-source tuning
remain explicit replacements. The website provides layer editing and bounded
local recovery, not background extension-to-web sync. Rebuild both surfaces
after a core bump because the transfer validates matching engine versions.

Current continuation 11 adds shared quick conversion presets, transparent-margin
trimming, cached source thumbnails and reusable idle conversion workers. Busy
work is still terminated on cancellation/replacement. Sprite finishing is
undoable and layer/frame scoped. The website has a separate tiles/map workspace
with .eztiles files, independent recovery, exact deduplication and starter
patterns. Maps do not change sprite v4 files. See the latest handoff for bounds,
measured performance and remaining release gates. No permissions or uploads added.

Handoff initialization now uses an active extension-owned holding page and waits
for complete initialization before persisting the transfer and navigating the
same bound tab. Closed/timeout cases preserve the file-download fallback. This
avoids racing an uninitialized inactive blank tab; repeated local capture checks
pass, while the broader navigation matrix remains a release gate. No permissions
or origin/token/tab checks were broadened.

Phase 8b: shared core 0.11.0 adds bounded Aseprite/Piskel codecs. Their native
import/export UI is on the website; the extension remains the capture/conversion
companion with the same minimal permissions. Reload the rebuilt unpacked 0.11.0
extension for engine-matched handoffs. See continuation 18 for exclusions and QA.
