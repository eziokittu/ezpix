# EzPix by GlitchBong

Local Chrome capture companion and authoritative deterministic pixel-art core.
Current core/extension **0.133.0**, project writer **v10**, readers **v1-v10**.
The website lives in sibling `glitchbong` on branch `ezpix`; this repository uses
`main`. No runtime AI, model, account or image upload is required.

## Essential references

- [current handoff](../glitchbong/docs/ezpix-continue145.md).
- [Product specification](../glitchbong/docs/ezpix-spec.md) and [full roadmap](../glitchbong/docs/ezpix-rework-plan.md).
- [Shared core API, file and numerical contracts](packages/core/README.md).
- [Extension architecture and transfer rules](docs/extension-plan.md).
- [Unperformed manual/release gates](docs/release-verification.md).
- [Approximate completion and remaining-phase estimate](../glitchbong/docs/ezpix-progress.md).

Older handoffs were consolidated during the owner's Markdown cleanup. Keep these
current references coherent and preserve original issue inputs in the website.

## Build and try locally

```powershell
npm ci
npm test
npm run build:extension
```

Load unpacked `dist/extension-dev` from Chrome's extensions developer page for
`http://localhost:3791`. `dist/extension` targets the production website and needs
separate deployment/install authorization. Do not load both builds together.
Click the extension toolbar on a normal webpage, capture a visible region,
element or viewport, tune locally, and download PNG/project or open the editor.

Only `activeTab`, `scripting` and `alarms` are requested; minimum Chrome is 120.
No blanket host, clipboard, arbitrary desktop or protected-content access.
Use content you have permission to reuse. Only visible content is captured;
restricted pages can fail. File download/open is the independent fallback.

From the website, `node scripts/sync-ezpix-core.mjs` tests, deterministically packs,
installs the versioned vendor artifact and records SHA-256 provenance. Use
`--offline-copy` for a locked local npm install of this dependency-free core.
Website builds/runtime never import sibling source. The package/lock, installed
core, extension builds and provenance must agree before transfer testing.

## Local verification

After a configured website production build, run browser scripts sequentially:

```powershell
node scripts/phase13abc-independent.mjs
node scripts/verify-package.mjs
node scripts/phase13abc-ui.mjs
node scripts/phase13abc-ui.mjs --crop
node scripts/phase13abc-ui.mjs --trim
node scripts/phase13abc-ui.mjs --scale
node scripts/phase13abc-ui.mjs --scale-down
node scripts/phase12km-independent.mjs
node scripts/phase12km-ui.mjs
node scripts/phase12km-ui.mjs --sort
node scripts/phase12km-ui.mjs --prune
$env:EZPIX_QA_PHASE8D='1'
node scripts/phase23-e2e.mjs
```

The handoff contains the complete current reproduction commands. Scripts use
port 3791 and isolated browser profiles. Set `EZPIX_CHROMIUM_PATH` when required
for the installed Chrome-for-Testing binary. Actual toolbar activeTab capture,
worker restart and all four handoff destinations are tested by `phase23-e2e`.
`EZPIX_QA_HARNESS=1` is an isolated harness, not production-site evidence.
Generated outputs stay in ignored `artifacts/`, `dist/` and dependency folders.

Additional capture/browser/soak/clean-install scripts remain available under
`scripts/`. Keep CPU-heavy work out of timing runs; retain historical evidence
labels. Configured SSG uses the existing website environment without copying or
logging credentials. No runtime dependency or QA reader should be added merely
to simplify external-reader checks.

170 core/protocol tests and the recorded local build/browser/numerical checks
pass. Physical devices, manual external apps, longer endurance, true peak RAM/
VRAM, hosted/offline/update behavior, licence/name decisions and store approval
remain separate unperformed gates. This is local software, not a released product.
Earlier cleanup commits were authorized; the current feature continuation remain
uncommitted. Nothing is pushed, deployed or published without separate authorization.

Phases 13ac-13al add transient binary selection masks with bounded shapes,
morphology and rectangle algebra; see the current handoff and core contracts.


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


## Latest local editor batch

Phases 13ck-13cy add searchable configurable commands, staged numeric geometry,
RGBA gradients/contours/shadows/alpha morphology, multi-target cel edits, range
retiming/sequencing and expanded display-only onion skins. Exact scope and all
local validation are in [current handoff](../glitchbong/docs/ezpix-continue145.md). The remaining
feature and physical/hosted/store gates remain explicit; this is uncommitted local
implementation. No AI/upload or permission expansion was introduced.
