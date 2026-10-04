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
4. Expand **Phone control** at the bottom and scan its QR code so phones can
   open the monitor page without typing the LAN address.

The monitor follows the App language and theme.
