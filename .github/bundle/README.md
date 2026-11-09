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
3. The App opens the local monitor automatically: 16 test-tone toggles,
   per-channel volume and a master fader, all tones muted by default. If you
   open it manually, use the actual monitor URL in the App's runtime details;
   internal ports may be assigned dynamically.
4. Open the bottom network popover and copy its complete public LAN HTTP URL
   or display its QR. On the phone, open that address and explicitly enter the
   displayed performance. Phone and monitor share the console, authoritative
   server state and the same audio engine.

The monitor follows the App language and theme.


Runtime requirements: PNDS App v1.6.2 or a Host supporting the exact shared libraries in manifest.json. The project bundle carries references and project assets; standalone development can still use npm ci. See docs/shared-libraries.md in the source repository.

## App performer QR migration

The project has no in-page QR interface or `/qr` endpoint. In performance mode,
share the public HTTP entry from the App's bottom network popover, then explicitly
enter the displayed performance. Creation device tests keep their separate
Performers button. Direct fixed-port addresses are only a standalone or legacy
fallback, not the stable saved Host entry.

## Unified Host entry (1.4.0)

In an adapted PNDS Host, copy or scan the complete public URL in the bottom network control, then explicitly enter the displayed performance. The phone console and local monitor control the same audio engine: channel toggles, individual channel-volume trims and master fader use server-authoritative state. Channel trims default to unity and combine with the master; tones remain muted until switched on. Reopening the page only reads state and never restarts audio.

All scripts and HTTP controls retain the confirmed performance prefix. Stop or a new performance revokes old network access; explicitly enter again. The page prepares only after a valid authoritative state arrives. The Host may assign internal ports dynamically; direct project addresses remain a standalone/legacy fallback and are not the saved stable entry. No WAN, remote library, Worker, WebSocket, sensor or media permission is required by this tool. Saving an icon grants no extra HTTP capabilities. Native Client storage/origin behavior and existing direct/HTTPS access remain unchanged.

Local tests use a fake scsynth; real phone/speaker output needs separate device acceptance.
