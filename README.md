# EzPix by GlitchBong

Local Chrome capture companion and authoritative deterministic pixel-art core.
Current core/extension **0.68.0**, project writer **v10**, readers **v1-v10**.
The website lives in sibling `glitchbong` on branch `ezpix`; this repository uses
`main`. No runtime AI, model, account or image upload is required.

## Essential references

- [Current handoff and next bounded phase](../glitchbong/docs/ezpix-continue80.md).
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
