# EzPix by GlitchBong

2026-10-21 correction phase: the website now opens its fixed editor directly at
`/tools/ezpix`; extension 0.11.0 hands off there using core 0.11.0. Read
[continuation 18](../glitchbong/docs/ezpix-continue18.md) and the
[correction roadmap](../glitchbong/docs/ezpix-rework-plan.md) before continuing.
The website also has persistent stacked/resizable panels, a cel timeline grid,
and three original editable starter projects. Bounded RGBA Aseprite/Piskel native
exchange is now available on the website, with staged import and explicit losses.
The broader native format roadmap and the
expanded Aseprite/NovaBoard feature target
precede release preparation; they are not all implemented.

Chrome capture companion and shared pixel-art engine. Website UI and authoritative
specification live in sibling `glitchbong` on branch `ezpix`; this repo uses
`main`. Read [the latest handoff](../glitchbong/docs/ezpix-continue18.md) and
[AGENTS.md](AGENTS.md). Local workspace links do not imply hosted repositories.

## Implemented locally

Core 0.11.0, sized square/round pencil and eraser, shared HSV conversion, local PNG/JPEG conversion, crop/output size, nearest/area sampling,
extracted and preset palettes, dithering, transparency controls and retained
source/recipe. The same controls and worker engine run in both products.
System/Dark/Light modes match GlitchBong Tools. No AI, accounts or uploads.

MV3 extension: region, visible element/image and visible-page screenshots;
explicit conversion; PNG/project downloads; confirmed local website handoff.
Capture references and pending transfer state use IndexedDB with a 10-minute
expiry and explicit clear. Project downloads remain the durable backup action:
the website now supports up to 16 layers and a single bounded local recovery
checkpoint. The website also has line/rectangle/ellipse tools, staged selection move/copy/flip
and project palettes with import/export and visible-colour grab. Multi-frame animation, timing and local playback are available on the website.
The website supports display-only onion skin, PNG/JSON sprite-sheet export, and
explicitly staged sheet import using EzPix JSON or an exact uniform grid.

The extension is not on the Chrome Web Store. The production website destination
is `https://glitchbong.com/tools/ezpix`; no deployment is claimed.
Product licence and name/trademark clearance remain undecided.

## Build and try locally

```powershell
npm ci
npm test
npm run build:extension
```

Load unpacked `dist/extension-dev` from Chrome's extensions developer page to
use a website running at `http://localhost:3791`. Click the toolbar action on a
normal webpage, choose a capture mode, then tune the result in the extension tab.
`dist/extension` targets the production website; it requires a separate website
deployment. Do not load both builds together for testing.

The only permissions are activeTab, scripting and alarms. There are no all-site
host grants. Only visible content is captured; inaccessible/protected pages can
fail. Use content you have permission to reuse. Download/open `.ezpix` is the
fallback when direct messaging is unavailable or exceeds 16 MiB.

From the website, `node scripts/sync-ezpix-core.mjs` tests, deterministically
packs, installs and records SHA-256 provenance. `--offline-copy` supports a locked
local npm install for this dependency-free package, with lock integrity updated.
Website runtime/build uses the versioned `vendor` artifact, never sibling imports.

## Verification

After a website production build, `node scripts/phase23-e2e.mjs` launches an
isolated Chrome for Testing profile and unpacked extension. Set
`EZPIX_CHROMIUM_PATH` if Playwright's default Chromium is unavailable. It checks
capture pixels, the real activeTab grant, external messaging, worker restart,
import safeguards, downloads, conversion and 390px layout. QA outputs stay in
ignored `artifacts/`. `EZPIX_QA_HARNESS=1` uses an isolated editor harness and
must not be reported as production-site evidence.

`node scripts/web-smoke.mjs` checks ordinary drawing, history, project/PNG and
emulated touch against the built website. Browser automation is not physical
device, public deployment or Chrome Web Store approval evidence.

Earlier continuation 11 added shared quick conversion presets, transparent-margin
trimming, cached source thumbnails and reusable idle conversion workers. Busy
work is still terminated on cancellation/replacement. Sprite finishing is
undoable and layer/frame scoped. The website has a separate tiles/map workspace
with .eztiles files, independent recovery, exact deduplication and starter
patterns. Maps do not change sprite v4 files. See the latest handoff for bounds,
measured performance and remaining release gates. No permissions or uploads added.

Phase 7a fixes selection over embedded frames in extension 0.9.1 (shared core
still 0.9.0). Capture QA covers scrolled/zoomed crops, cross-origin iframe
elements/regions, navigation and restricted pages. Native Chrome and Edge tab
visibility tests and isolated dependency installs are recorded in continuation
12, alongside bounded conversion stress measurements. Physical devices,
cross-engine coverage, longer endurance and publication remain separate gates.

Additional local verification commands, run sequentially against a built site:

```powershell
node scripts/phase7a-capture.mjs
node scripts/phase7a-browsers.mjs
node scripts/phase7a-soak.mjs
node scripts/summarize-soak.mjs
node scripts/verify-clean-install.mjs --use-local-env
```

The clean-install runner creates ignored isolated copies. `--use-local-env`
loads the website's existing configuration in memory for database-backed site
SSG; no dotenv files are copied. Without it the complete site build needs its
own configured database, although EzPix itself performs processing locally.
