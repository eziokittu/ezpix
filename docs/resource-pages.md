# Settings and resource pages — 2 November 2026

Current local extension/shared engine: **0.466.1**. This builds on the pending 0.466.0 cutout work. Nothing was committed, pushed, deployed or submitted to the Web Store.

## Delivered

- A centred red **Exit expanded view** button replaces the close glyph.
- Expanded settings use five browser-style tabs, with exactly one active panel. Arrow keys, Home and End navigate the tabs. Landscape controls use compact rows below the preview; portrait/square settings remain on the right.
- Normal popup groups can all collapse. Opening another group closes the previous one.
- Magic colour selection is the initial/reset tool. Full-image coverage remains until a selection gesture. The website Select button starts with its colour wand; explicit rectangle/ellipse/lasso/polygon choices remain available.
- Extension footer Docs, FAQ and Privacy use the anchored GlitchBong HTTPS routes. The packaged privacy file remains as a fallback but is no longer the footer destination.
- Help, Docs, FAQ, Privacy and the extension overview share the actual EzPIX wordmark centred above a large heading, appearance controls, navy/cyan/blue styling, section navigation and a branded footer. Articles are justified, with emphasis and underlined links. Mobile layouts fit 320px and 390px widths.
- Detailed editor reference and FAQ content are retained on dedicated canonical pages. Help focuses on quick start. Legacy help#faq and help#reference retain relevant onward links.
- Relevant back links say **EzPIX Tool**. Tool issue links open Gmail compose addressed to glitchbong.dev@gmail.com using the supplied URL. No email is sent automatically.
- Titles, descriptions, canonical URLs, Open Graph/Twitter metadata, semantic headings and sitemap entries cover all five pages.

## Destinations

| Link | URL |
| --- | --- |
| Help | https://glitchbong.com/tools/ezpix/help#start |
| Docs | https://glitchbong.com/tools/ezpix/docs#documentation |
| FAQ | https://glitchbong.com/tools/ezpix/faq#faq |
| Privacy | https://glitchbong.com/tools/ezpix/privacy#privacy |
| Extension | https://glitchbong.com/tools/ezpix/extension#extension |
| Issues | https://mail.google.com/mail/u/0/?to=glitchbong.dev@gmail.com&fs=1&tf=cm |

The new routes and content require website deployment before the extension can reach them publicly. Matching-engine deployment is still required for artwork handoff. Runtime image processing and downloads remain local.

## Verification

Full core/extension suite: **1,028 passed** (`artifacts/expanded-selection/core-sync-tabs.log`). Real action-popup checks cover normal/short displays, tabs, collapse-all, defaults, anchored HTTPS footer targets and cutout/picker/export regressions. Reports: `artifacts/expanded-selection` and `artifacts/expanded-selection-small`.

`scripts/resource-pages-qa.mjs` checks all five pages, canonical/social metadata, Gmail URLs, fragment scrolling, current FAQ, 320px/390px layouts and web wand defaults. Screenshots under `artifacts/resource-pages` were visually inspected. `scripts/website-audit-qa.mjs` follows the dedicated FAQ/Docs routes and includes security headers on both new routes. The local release gate includes the resource-page suite.

Use `NEXT_PUBLIC_BASE_URL=https://glitchbong.com` for canonical production metadata and the deliberate local extension ID for handoff QA. `node scripts/verify-package.mjs` verifies exact source/archive/installed bytes and minimal permissions.

Current ZIP: `dist/release/ezpix-insta-0.466.1.zip`; its adjacent JSON records the SHA-256. Load `dist/extension` unpacked, or `dist/extension-dev` for localhost. Website package/lock/provenance use the matching 0.466.1 vendor archive, without sibling runtime imports.

The full combined release orchestrator, hosted deployment, store publication and physical-device/stylus qualification are separate. Store promotional assets were not refreshed.

## Final local results

- Production website build passed TypeScript and generated 1,249 pages. Log: `artifacts/resource-pages/production-build.log`.
- 14 production action-popup groups passed at each of 780×580 and 776×490. Reports: `artifacts/expanded-selection/result.json` and `artifacts/expanded-selection-small/result.json`.
- 10 resource-page groups and 10 website security/import/recovery groups passed against the production build. Reports: `artifacts/resource-pages/result.json` and `artifacts/website-audit/security-ui-result.json`.
- Scoped EzPix/sitemap ESLint, 64 route-policy checks and unique sitemap entries for all five resource pages passed. The 22-group toolbar regression includes the matching-engine local website handoff; report: `artifacts/toolbar-popup/result.json`.
- Package/provenance checks passed. Independent ZIP CRCs, all 17 runtime file bytes and bundled links/labels/tabs passed. ZIP SHA-256: `8976d30c7c71b5962a20fa991eec45e4927f3f8d5d87ebaea3c611917869349c`.
