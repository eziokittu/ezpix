# Alignment and preview performance — 0.466.2

The popup header now places **Expanded view** immediately to the left of Appearance. It opens the last-used input/output workspace and stays disabled when no media is loaded. Closing the workspace returns focus to the entry button.

Settings use explicit caption, control and value cells. Numbers, dropdowns and sliders share a 30px control row; checkboxes align with those rows. The source-colour field, swatch and picker fit narrow panels. Photo controls have a real inner grid so Chrome's native details-content wrapper cannot force landscape settings into one vertical column. Hidden Magic/brush controls stay hidden. Normal, portrait/square and landscape layouts reuse the same controls.

## Performance changes

- Completed previews retain an idle worker instead of creating another one. If a newer request interrupts a busy worker, it is terminated and the replacement reloads its own frames. Idle-worker failure during debounce also discards that worker without losing the pending request.
- The worker caches successfully loaded focus frames. Subsequent settings changes send current settings and mask, without cloning the unchanged media frames again. New media, changed sampling, RESET and disposal invalidate the appropriate caches. Rejected replacement data cannot poison a successful worker cache.
- Static source pixels and the compact selection mask are reused while adjusting the output. Selection drawing, cancelled gestures, source replacement and enabled-state changes still repaint as needed. There is no persistent storage, telemetry or permission change.

## Evidence

The same one-megapixel original fixture and four completed brightness adjustments were checked in actual Chromium action popups with the 0.466.1 ZIP and the current build:

| Work during four adjustments | 0.466.1 | 0.466.2 |
| --- | ---: | ---: |
| New workers | 4 | 0 |
| Repeated media-frame loads | 4 | 0 |
| Media-frame bytes cloned | 16,777,216 | 0 |
| Source-canvas drawImage calls | 8 | 0 |

Four output previews still run, and selection masks/settings still cross the worker boundary. These are measured operation counts, not a claim of zero processing or a device-wide speed score. Timing samples were collected alongside other local work and are not treated as an isolated benchmark. Reports: `artifacts/popup-performance/baseline/result.json` and `artifacts/popup-performance/current/result.json`.

`scripts/popup-performance-qa.mjs` checks exact output, superseded busy-worker cancellation, idle-worker failure, and replacement-media cache invalidation. Its default mode needs only the current package; optional baseline mode takes an explicit old extension folder. `scripts/expanded-selection-qa.mjs` checks the header button, every settings tab, caption/control overlap and the horizontal photo-grid geometry at normal and short popup sizes. Screenshots are under `artifacts/expanded-selection` and `artifacts/expanded-selection-small`.

The user explicitly authorized committing and pushing the accumulated EzPix changes in both repositories. Current matching extension/core/vendor version is **0.466.2**. Source pushes and any automatic website deployment remain distinct from publishing the Chrome Web Store update. The runtime ZIP is `dist/release/ezpix-insta-0.466.2.zip`; the adjacent JSON contains its current hash. Store promotional assets were not refreshed.

Final local verification: 1,030 core/extension tests, 15 expanded-workspace groups at each of two popup sizes, four performance/cache lifecycle groups, 22 capture/export/local-handoff groups, and 10 resource-page browser groups passed. The matching website production build passed TypeScript and generated 1,249 pages. Scoped ESLint, 64 route-policy checks, package/provenance equality and independent CRC/exact-byte checks on the 17-file runtime ZIP passed. Evidence is under `artifacts/expanded-selection`, `artifacts/expanded-selection-small`, `artifacts/popup-performance`, `artifacts/toolbar-popup` and `artifacts/resource-pages`.
