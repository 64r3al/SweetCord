# SweetCord Desktop — Ultra-Lite Voice + Text Preview

SweetCord Desktop wraps Discord's official web app. Version **0.4.0** prioritizes text messaging and microphone-only voice calls on gaming PCs that need to conserve resources. It does not replace Discord's renderer or implement a separate Discord protocol.

## Ultra-Lite mode

New installs and preference files without an explicit setting start with Ultra-Lite mode enabled:

- Cancels image requests, including profile photos, server icons, banners, GIFs, stickers, custom emoji images, image attachments and image embeds.
- Cancels media requests only when the URL clearly identifies a video/GIF asset. Ambiguous media URLs are allowed to protect voice-call compatibility.
- Hides visual extras, embeds, video/camera/screen-share controls, profile decoration, Activities and Nitro/Shop/Quests promotions.
- Disables decorative transitions and profile effects.
- Allows microphone-only capture from HTTPS Discord origins. Camera, mixed audio/video capture and display capture are denied.
- Skips avatar observers and avatar scans while Ultra-Lite mode is enabled.

Discord's selectors, URLs and request behavior can change, so these filters are best-effort. Text chat and microphone-only calls are the supported priorities.

## Trade-offs and limitations

Profile photos, server icons, banners, emoji images, stickers, GIFs, image previews and many embeds are missing. Camera calls and screen sharing are deliberately unavailable. Discord's scripts, API traffic, channel lists, message rendering and Electron/Chromium remain active. There is no hard 1 GiB RAM cap and no unmeasured resource-savings promise. Unknown-extension video requests may pass through because ambiguous media URLs are allowed to protect voice.

Toggling **Performance → Ultra-Lite mode** reloads Discord so the request policy applies cleanly. Do not toggle it while composing an unsent message.

## Run/build on Windows

Install current Node.js LTS. From the repository root, double-click `Launch SweetCord Desktop.bat`, or run:

```powershell
cd desktop-electron
npm install
npm start
```

Create the installer:

```powershell
npm test
npm run package:win
```

The installer is emitted to `desktop-electron/release/SweetCord-Setup-0.4.0.exe`. The packaged files include `permission-policy.cjs`.

## Performance menu

- **Ultra-Lite mode — block images and video (voice audio stays enabled)** — enabled by default; toggling reloads Discord.
- **Hide optional promos and navigation** — hides common Store, Shop, Quests, Nitro and Discovery destinations.
- **Disable UI animations and transitions** — removes most CSS animations/transitions.
- **Hide profile banners and decorations** — removes decorative profile effects.
- **Use still profile avatars** — only applies when Ultra-Lite mode is disabled.
- **Show current memory snapshot** — shows Electron-reported process working sets/private memory locally.

## Benchmark on the same PC

Compare official Discord and SweetCord on the same Windows PC, account, network, window size and channel. Measure idle, text chat and an active microphone-based voice call separately.

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -ProcessName SweetCord,Discord,Vesktop -SampleSeconds 30
```

The script reports aggregate working set, private memory and average CPU use. For GPU, open **Task Manager → Details**, enable **GPU** and **GPU engine**, and compare the same scenario. Include WebView2 host/renderer processes when testing Tauri. CSS-only changes do not guarantee lower CPU/GPU usage; request blocking and removing active media work are the intended optimizations.

## Security and tests

SweetCord never requests a Discord personal account token. Authentication remains in Discord's persistent browser profile. Image/video blocking applies only to the main Discord WebContents, not authentication popups. Microphone permission is limited to HTTPS Discord origins and audio-only requests. Camera and screen capture are denied.

Run `npm test` from `desktop-electron`. CI tests source syntax, request policy and microphone-only permissions and builds the installer. These checks do not replace real Windows login, message and voice-call testing. SweetCord is unofficial and not affiliated with Discord.
