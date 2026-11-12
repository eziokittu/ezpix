# EzPix Nearby desktop companion

Requires Node.js 24+. On Windows run `start.cmd` in this folder. On other systems
run `npm ci --ignore-scripts --no-audit --no-fund`, then `npm start`.
Keep the terminal open, allow Node on your private Wi-Fi network if the firewall
asks, and open Local share in EzPix on both devices. Choose a device, accept the
connection, then compare the security codes before transferring a file.

Android needs no companion. Browsers cannot enumerate Wi-Fi services directly.
The companion bridges DNS-SD discovery and pairing codes for the website and
Chrome extension. Artwork continues over the existing encrypted WebRTC channel,
with per-file consent. It runs locally, has no cloud service and sends no images.
Presence starts only while a Local share panel is polling and expires after 15
seconds without it. Closing the terminal stops the companion entirely.

The loopback API accepts only the production EzPix site, its published extension
and the documented local development origins. For a local unpacked extension,
set `EZPIX_EXTENSION_ORIGIN=chrome-extension://YOUR_32_CHARACTER_EXTENSION_ID`
in that terminal before starting. Browser local-network permission or firewall
policy may block the companion; QR remains available. Guest-network isolation,
VPNs and separate networks can prevent both direct connection methods.

DNS-SD names and pairing signals are visible on the local network. They are not
trusted identities: compare the code on both screens. Payloads are encrypted
with WebRTC DTLS. No public discovery or relay servers are used.

Dependencies are pinned in package-lock.json; bonjour-service is MIT licensed.
This companion is a local testing utility, not an installed background service.
