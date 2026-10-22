# EzPix remaining release verification worksheet

Current local evidence is in
[current handoff](../../glitchbong/docs/ezpix-continue145.md). This worksheet records
remaining manual gates; its presence does not mean any row passed. Use original
fixtures, keep captures local, and record actual hardware, OS/browser versions,
date, result and artifact location for each run. Never attach personal artwork,
page URLs or project contents to analytics or public issue logs.

| Gate | Concrete exercise | Expected result | Evidence/status |
| --- | --- | --- | --- |
| Android website | Real phone: pencil/eraser, drag outside canvas, cancel gesture, pinch/scroll around editor, undo, PNG and project download/reopen | Intentional pixels; page navigation remains usable; exported pixels and reopened project match | Not performed |
| iPhone/iPad website | Safari: conversion presets/trim, draw, sheet import/export, tile-map scroll and stamps, download/reopen through Files | Controls reachable; no accidental gesture commits; files reopen without silent loss | Not performed |
| Physical stylus | Named tablet/pen: tap, fast stroke, leave/re-enter canvas, pointer cancellation, UI scroll, undo | Stroke boundaries and undo behave correctly; no stuck gesture | Not performed; pressure sensitivity is not an implemented promise |
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

Core/extension 0.133.0 writes v10 and reads v1-v10. Latest implementation verification:
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
[current handoff](../../glitchbong/docs/ezpix-continue145.md). Numeric geometry controls are
not canvas transform handles, text/fonts, live effects or document mode support.
All physical devices/stylus, other browsers, external human application/engine
roundtrips, endurance, actual peak memory, minimum hardware, licensing/name,
hosted/offline/update, store packaging and approval gates remain open. No release,
commit, push or deployment was authorized by this continuation request.
