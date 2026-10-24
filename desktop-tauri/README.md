# SweetCord Tauri / WebView2 experiment

This is a separate experimental Windows desktop shell. It does **not** replace the existing Electron installer. The goal is to measure whether using the Windows WebView2 runtime reduces shell overhead and installer size while preserving Discord's own website for sign-in, messages, servers, voice, and video.

## Current design

- Loads the official Discord web app in a Tauri WebView2 window.
- Uses the system-installed Evergreen WebView2 runtime where available; the installer uses Tauri's download-bootstrapper mode if the runtime is missing.
- Does not expose SweetCord commands or a token API to the remote webpage.
- Allows HTTPS navigation only to Discord and a small set of identity-provider hosts. Normal HTTP(S)/mailto external links open in the system browser; unsafe schemes are ignored.
- Applies reduced-motion styling, hides common upsell destinations/decorative profile layers, and batches avatar handling through requestAnimationFrame. Avatar observation is scoped to Discord's `#app-mount` subtree and deduplicates overlapping additions and source changes to reduce repeated DOM traversal.
- Replaces animated **profile avatars** with PNG URLs when the CDN supports them, with a one-shot fallback to the original GIF on load failure. It deliberately does not rewrite message attachments, animated stickers, or call-media streams.
- Keeps microphone, camera, display-capture, notifications, and autoplay permission requests on the browser's default permission flow for Discord HTTPS pages; other permission categories are denied.
- The new-window handler checks the initial popup URL against the HTTPS allowlist. Non-allowlisted destinations open in the system browser. Trusted authentication popups currently use WebView2's default popup implementation to avoid a known Windows deadlock when creating a child window synchronously inside the callback; subsequent redirects inside those default popups are not independently filtered by SweetCord's main-window navigation handler, so this remains an experimental compatibility/security limitation.

## Build on Windows

Install the current Rust stable toolchain, Visual Studio Build Tools with **Desktop development with C++**, Node.js LTS, and the Microsoft Edge WebView2 Runtime. WebView2 is included on supported Windows 10/11 systems, but the installer attempts to install it if missing.

```powershell
cd desktop-tauri
npm install
npm run tauri:dev
```

Build a Windows NSIS installer:

```powershell
npm run tauri:build
```

The installer is produced under src-tauri/target/release/bundle/nsis/. The repository's **SweetCord Tauri / WebView2 experiment** workflow also builds this installer on Windows and uploads it as a CI artifact. It is **not** published as the default nightly release until it passes real-device compatibility checks.

## Test before replacing anything

Compare the Tauri preview with Electron under the same PC, account, network, window size, and content:

1. Login and session persistence after restart.
2. Direct messages, server/channel switching, search, attachments and screen sharing.
3. Join/leave voice channels, microphone mute, camera toggle, screen share, and notification sound.
4. Trusted login popup and external-link behavior.
5. CPU, working set/private memory and GPU usage at idle, in text chat, in an active voice call, and during video/screen sharing.

Do not assume this will use 200 MB RAM. WebView2 may reduce duplicated desktop-runtime overhead, but Discord's web application, active media streams and GPU surfaces still consume resources. Use the benchmark script in desktop-electron/benchmark-windows.ps1 for Electron; use Task Manager or Process Explorer to compare the WebView2 host/WebView2 renderer processes for the Tauri build.

This is an unofficial wrapper of Discord's website. Third-party client modifications may carry account and Terms of Service risk. It is not affiliated with Discord.
