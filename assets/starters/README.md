# Original EzPix starters

The pixel rows and placements in `scripts/create-starters.mjs` are original
project-owned artwork authored for EzPix. No third-party images, game sprites,
logos, fonts or AI-generated bitmap assets are included. Product licensing
remains undecided; this note does not assign a public redistribution licence.

The script uses the shared engine to build editable v4 projects and the browser's
canvas PNG encoder for matching previews. It writes reviewed source assets to
`glitchbong/public/ezpix/starters` plus the typed-UI catalogue JSON. These are
intentional product assets, not test artifacts. Regeneration is explicit:

```powershell
npm run build
node scripts/create-starters.mjs
```

Lantern: 16x16, frame + flame layers, one frame.
Orbit loop: 24x24, stars + planet + moon layers, four 140ms frames.
Garden patch: 32x24, soil + plants layers, one frame.

Changing these files must regenerate both project and preview. Each open decodes
a fresh document; changes to an opened starter cannot modify the bundled original.
