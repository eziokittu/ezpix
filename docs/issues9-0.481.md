# Shared photo tools 0.481.0

Android issues9 is delivered as Android 1.3.0/code 16. Full issue mapping,
artifact hash, checks and external gates are recorded in
`../../ezpix-android/docs/ISSUES9-DELIVERY.md`.

The authoritative engine adds optional explicit collage slots and normalized
custom cells (up to 16), per-cell geometry/rotation/fit/crop/borders, a retained
source background and an undoable canvas-size operation. Legacy collage projects
without explicit slots retain their earlier repeating-photo rendering.

Double line and Sparkle now clamp/round offset strokes before calling the strict
selection brush. Twelve additional styles bring the brush list to 28. Shared
visual catalogues are centered; Shapes moves into Emoji Browse. Destructive
confirmations gain a light red surface.

The account preference validator accepts bounded photo-free custom layout
definitions, including canvas styling. Local storage participates in the same
opt-in merge protocol across Android, extension and website. Images, projects
and editing text remain excluded. The website consumes the versioned archive;
no sibling runtime imports were introduced.

1,097 shared tests passed. Android and API checks, browser screenshots, native
APK verification, package paths and unverified device/account gates are in the
Android delivery document. No release publication, commits or pushes occurred.
