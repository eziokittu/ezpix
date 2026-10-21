# EzPix contributor instructions

Read README.md and docs/extension-plan.md, plus the authoritative product spec
and latest docs/ezpix-continueN.md in the sibling glitchbong checkout.

- This is the separate EzPix extension/shared-core repository. Website UI lives
  in glitchbong on its long-lived ezpix branch; this repo starts on main.
- No runtime AI: no inference, local models, AI SDKs, or generative redraw.
- Authoritative algorithms and document/recipe schemas belong in packages/core.
  Both extension and website consume the same version. Do not duplicate them.
- Keep all processing local by default. User images, captures, project names,
  source URLs, and palettes must not enter logging/telemetry/upload services.
- Use explicit user-triggered capture and justified minimal permissions. Do not
  request blanket host, clipboard, screen-sharing, or tab access speculatively.
- Treat captured page data and imported archives as untrusted. Validate schema,
  bounds, sizes, archive expansion, origin, sender/tab binding, and transfer state.
- Preserve manual edits. Conversion changes and imports must not silently replace
  artwork. Support reliable PNG/project-file fallback if direct transfer fails.
- Resource budgets, physical mobile tests, browser extension tests, and exported
  image inspection are separate evidence gates. A build does not establish them.
- Do not copy Aseprite source or assume redistributability from public source.
  Check licences of dependencies and artwork. Product licence remains undecided.
- Keep generated builds, dependencies, captures, credentials, and personal
  projects out of Git. Use original or explicitly licensed test fixtures.
- Do not commit, push, create hosted repositories, or deploy unless authorised
  by the user. This planning pass has no remote and no initial commit.
