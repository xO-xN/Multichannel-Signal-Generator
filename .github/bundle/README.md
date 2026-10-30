# Multichannel Signal Generator

[中文](README.zh-CN.md) | **English**

A PNDS utility for checking multichannel routing: 16 sine-wave test tones toggled individually from a fader console, with a master fader and phone control. It runs in **Internal** audio mode only.

## How to use

1. In the PNDS App, press **⌘O** (Open) and select this `.pnds` bundle or its
   unzipped folder, choose **Internal Synth**, pick an output device, then
   **Load**. Don't have the App yet? Download it from
   https://github.com/xO-xN/PNDS-App/releases/latest (macOS) — no Node.js or
   SuperCollider installation is required, the App bundles both.
2. Put the Mac and the performers on the same local network.
3. Open `http://<Host-LAN-IP>:6869/` on the operator's machine: 16 test-tone
   toggles plus a master fader, all tones muted by default.
4. Display the App performer QR and scan it on a phone. Performer (`:6868`)
   and monitor (`:6869`) share the console and synchronized server state.

The monitor follows the App language and theme.


Runtime requirements: PNDS App v1.6.2 or a Host supporting the exact shared libraries in manifest.json. The project bundle carries references and project assets; standalone development can still use npm ci. See docs/shared-libraries.md in the source repository.

## App performer QR migration

This version removes the project QR interface and `/qr` endpoint. In PNDS App with built-in performer QR, use the bottom bar in performance mode or the Performers button in creation mode to open this project’s performer page. Standalone browsers and older Apps retain the project pages without an in-page QR entry.
