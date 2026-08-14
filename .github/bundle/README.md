# Multichannel Signal Generator

A runnable PNDS score project: 16 independent mono test tones for checking Internal multichannel routing.

This folder is a **PNDS score project**, packaged and ready to run offline. The release archive unzips into a folder named `Multichannel Signal Generator`.

## How to perform

1. Install PNDS App (macOS, Apple Silicon):
   https://github.com/xO-xN/PNDS-App/releases/latest
2. Put the Mac and the performers on the same local network.
3. In PNDS App, click **Open** and select **this folder**.
4. The project runs in **Internal** audio mode only — choose **Internal Synth**, pick an output device, then **Load**.
5. Open `http://<Host-LAN-IP>:6869/` on the operator's machine: 16
   test-tone toggles plus a master fader, all tones muted by default. The
   QR at the bottom points at the performer page
   `http://<Host-LAN-IP>:6868/` (a no-UI stub kept alive for the App
   health check) so phones can open it.

You do not need to install Node.js or SuperCollider. PNDS App bundles both.
