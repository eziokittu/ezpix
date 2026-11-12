# Mobile tools and local sharing

11 November 2026. Android EzPix 0.3.0; shared core and extension 0.467.1.
Implementation is local. No push, deployment or Web Store publication is included.

## Mobile editing

The bottom rail is a native horizontal scroll wheel with five slots. Selection
centres the item, enlarges it and reveals its controls. Neighbouring items follow
a shallow curve and fade toward the edges. Touch scrolling selects the nearest
tool; mouse wheel and arrow/Home/End keys work too. Reduced motion is respected.

Eleven groups: Pixels, Palette, Select, Cutout, Adjust, Motion, Crop, Rotate,
Text, Frame and Effects. Crop offers square, 4:5, 9:16, 16:9, 3:2 and original
ratios with zoom and horizontal/vertical framing. Rotate applies quarter turns
to every frame. Text uses the original bitmap alphabet, up to 32 characters.
Frame extends the canvas with a chosen border. Effects include vignette,
posterisation, deterministic grain and peach/violet duotone.

New source edits have explicit preview/apply/cancel and image undo/redo. Geometry
edits restore whole-image selection; refine the cutout afterward. This history
is for applied image edits, independently of selection undo or live conversion
sliders. It has eight entries/32 MiB retained history; images stay within four
megapixels and edited frame sets within 32 MiB. Captions become source pixels;
they are not a separate editable text layer in exported conversion projects.

Research used primary product/tool descriptions from
[Photoshop Express Android](https://helpx.adobe.com/uk/photoshop-express/mobile/introduction/get-started-android.html),
[Adobe adjustment tools](https://helpx.adobe.com/ca/photoshop-express/mobile/quick-actions/adjustment.html),
and [Snapseed Tools and Filters](https://support.google.com/snapseed/answer/6155517).
The implementation uses original/shared deterministic algorithms; it does not
copy their assets, AI features or complete product scope.

## Connect and transfer

1. Install the Android APK and load the matching unpacked extension, or build
   the matching website. Open **Local share** on both devices on the same LAN.
   Load the website before disconnecting internet; it is not an offline PWA.
2. Choose **Create connection** on A and **Join a connection** on B. B scans A's
   QR or pastes its code. Android Scan QR takes a camera photo; web/extension
   Scan QR runs an explicitly requested live camera. QR images can be uploaded.
3. A scans B's reply QR (or pastes its reply). Both screens display the same
   security code. Confirm only when both match. Codes expire after five minutes.
4. Send the edited project, source PNG or a chosen image/project file. B accepts
   the offer, then explicitly opens it for editing or saves the original file.
   Declining, cancelled saves and invalid imports preserve existing artwork.
5. Disconnect/close to clear pairing and received bytes. Keep the sharing screen
   open throughout a transfer. A transfer times out after two minutes of inactivity.

Pairing is a two-way QR/code exchange, not automatic discovery or a short room
code. It needs no account, signaling server, host permission or public STUN/TURN.
Payloads use the WebRTC DTLS/SCTP data channel. Both peers must verify the code
before any filename or file bytes can be offered. Peer consent precedes receive
buffer allocation; ordered 16 KiB chunks, exact byte counts, sequence checks and
SHA-256 precede import. Replay IDs are rejected. Files cap at 24 MiB. A sender
gets completion only after the receiver explicitly opens/saves the verified file.

The website and extension prefer the browser's file-system save picker. Where
unavailable, the fallback confirms a download request, not a verified disk write.
The Android native destination picker reports completion/cancellation separately.

WebRTC has no configured ICE servers or cloud fallback. Guest-network isolation,
VPNs, blocked multicast/UDP and BlueStacks NAT may prevent connection even when
devices appear to share Wi-Fi. Physical Android-to-laptop qualification remains
necessary. Devices in unrelated networks are not promised to connect.

## Integration and fidelity

- Android: sharing is lazy-loaded in a full-height dialog. Native camera takes
  QR photos. Imports are decoded and checked against cancellation/stale epochs
  before replacing media. Native saving preserves filename and file bytes.
- Extension: Local share in the popup footer opens a persistent packaged tab.
  A random token binds a ten-minute local outgoing snapshot; consumption deletes
  it, expiry/reset also clears it. Closing the popup does not close the share tab.
  Received media can be converted and exported in the tab. Permissions remain
  activeTab, scripting and alarms; no blanket host or clipboard permission.
- Website: Local share is available in dense and tiled editors. Its dialog lives
  at the route layout level, so switching editor mode does not tear down a
  connection. Unsaved/staged artwork is protected. Large photos require explicit
  confirmation before fitting to the dense editor's 256px-per-axis canvas.
  Only EzPix web routes allow self-origin camera, requested by Scan QR; microphone
  and display capture remain disabled. Other website routes keep their policy.
- Original files transfer byte-for-byte. Full `.ezpix` structure opens in the
  website editor. Phone/extension conversion studios combine visible frames into
  a working raster; save the original received project to retain all structure.
  Their animation conversion remains uniform 1–4 FPS / eight seconds; other
  animations can be transferred/saved and opened in the website editor.
- PNG, JPEG, static WebP, restricted SVG, GIF, BMP, QOI and `.ezpix` are offered.
  Import decoders retain existing bounds (including 256px GIF/BMP/QOI limits).
  Unsupported/malformed images can never silently enter an editor.

`packages/core` owns `photo-edit`, `local-share`, `local-share-ui`,
`shared-artwork` and file contracts. All three apps consume the same 0.467.1
package, with vendor/archive/installed-byte verification. QR code uses bundled
MIT qrcode-generator and Apache-2.0 jsQR; their notices appear in the sharing UI.
No runtime AI or model is used. Camera streams stop on success, Stop, disconnect
or dispose; no audio is requested. No user content enters logging or telemetry.

## Evidence and remaining gates

The automated suite includes actual local DTLS/SCTP transfer in both directions
using a backend WebRTC implementation with public STUN explicitly disabled.
It checks exact multi-chunk bytes, mutual verification, refusal and retry.
Other checks exercise malformed/expired pairing, replay, sequence/size/checksum
rejection, offline QR encode/decode and independent pixel-edit expectations.
Mobile DOM/canvas tests exercise centring/scroll selection, edit preview/cancel,
apply/undo, real PNG/project export and lazy sharing entry without starting RTC.

These are not actual Android-to-Chrome tests. Computer-use returned no native
pipe or browser host, and installed/emulator/physical network qualification is
still open. Verify portrait/curved-wheel appearance, touch/insets, QR cameras,
all three send/receive combinations, file-system/native pickers, refusal,
disconnect, denied permissions and isolated networks before publishing.

See the Android `docs/STATUS.md`, website `docs/ezpix-local-share.md`, generated
APK/extension reports and local test/build logs for final packaging evidence.
