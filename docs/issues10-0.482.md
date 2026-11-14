# Shared photo tools 0.482.0

Android issues10 ships as 1.4.0/code 17. The corresponding versioned core archive
is consumed by Android and GlitchBong, with SHA-256 provenance and npm integrity.
Authoritative algorithms and project validation remain in this repository.

- Editable stamps accept image metadata and remain portable photo-project objects.
  Batch edits atomically import an image plus optional canvas resizing in one Undo.
- Shapes use the inline Emoji catalogue, shared Properties and Emojis on scene.
- Selection contours form continuous clockwise outer loops, with holes and a
  bounded 512-cell display grid. The actual mask and exported pixels are unchanged.
  Show outline defaults on; outside-selection shading is reduced.
- Filtered object reads avoid copying collage media into unrelated tool lists.
  Collage property updates share immutable, engine-owned images across history;
  callers still receive defensive copies. Automatic editing renders once.
- Collage fills use native packed RGBA writes; opaque blends bypass alpha math;
  rotated cell loops use tight bounds. Fidelity is checked against 0.481.0 for
  translucent images, backgrounds, borders, rotation, contain, zoom and offsets.
- Worker output owns transferable pixels independently of cached input frames.
  Repeated unchanged previews remain valid after transfer.

Full checks, benchmark method/results, APK and remaining external gates:
`../../ezpix-android/docs/ISSUES10-DELIVERY.md`. The reproducible browser script is
`scripts/android-issues10-qa.mjs`; it needs an Android Vite preview at port 5190.
The benchmark script is `scripts/benchmark-collage.mjs`; first extract the previous
Android vendor 0.481.0 archive under `ezpix-android/artifacts/collage-baseline/`.

This commit also includes the previously uncommitted issues5-9 account, automatic
editing, collage, fonts and local Smart Remove foundations. Google setup remains
manual. Git publication is authorized; Web Store submission is a separate gate.
