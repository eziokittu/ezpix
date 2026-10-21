# EzPix remaining release verification worksheet

Current local evidence is in
[continuation 42](../../glitchbong/docs/ezpix-continue42.md). This worksheet records
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

Core/extension 0.32.0 writes v10 and reads v1-v10. Latest implementation verification:
145 core/protocol tests, independent numerical/native checks, production TypeScript
and 1,245-page build, 62 ad-route checks, staged browser downloads/recovery and real
unpacked-extension capture/handoff. Full details and ignored artifact locations are
in the current handoff. These checks do not close any unperformed gate in the table.
The progress estimate is a planning range, not a release-readiness score.

The owner authorized documentation cleanup and local commits only. Push, hosted
repository creation, deployment and store submission require separate authorization.
