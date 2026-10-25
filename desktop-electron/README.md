# SweetCord Desktop — Performance Profiles Preview

SweetCord Desktop wraps Discord's official web app. Version **0.5.0** adds configurable performance profiles and better local diagnostics. It does not replace Discord's renderer or implement a separate Discord protocol.

## Performance profiles

- **Extreme Lite (default):** blocks all image requests and clearly identified video/GIF assets, hides visual extras, disables UI effects, and keeps microphone-only voice calls available.
- **Balanced:** allows still images while blocking recognizable GIF/APNG/video assets; keeps optional promotions and decorative effects reduced.
- **Custom:** exposes individual controls for image blocking, promo/navigation visibility, motion, profile decorations and still avatars.

Switching profiles reloads Discord so the network policy takes effect consistently. Changes made in Custom preserve the other active settings. Existing v0.4.0 preference files are migrated without discarding an explicit prior choice to allow images.

The wrapper cannot suspend Discord's own application logic. All profiles still run Discord's JavaScript, API, text renderer and Chromium. Profiles are behavior controls, not memory-limit enforcement.

## Ultra-Lite mode

Extreme Lite remains the default for new installs and existing preference files without a saved profile:

- Extreme Lite cancels image requests, including profile photos, server icons, banners, GIFs, stickers, custom emoji images, image attachments and image embeds. Balanced allows still images but cancels clearly identified animated-image formats.
- All profiles cancel media requests only when the URL clearly identifies a video/GIF asset. Ambiguous media URLs are allowed to protect voice-call compatibility.
- Hides visual extras, embeds, video/camera/screen-share controls, profile decoration, Activities and Nitro/Shop/Quests promotions.
- Disables decorative transitions and profile effects.
- Allows microphone-only capture from HTTPS Discord origins. Camera, mixed audio/video capture and display capture are denied.
- Skips avatar observers and avatar scans while Ultra-Lite mode is enabled.

Discord's selectors, URLs and request behavior can change, so these filters are best-effort. Text chat and microphone-only calls are the supported priorities.

## Trade-offs and limitations

Profile photos, server icons, banners, emoji images, stickers, GIFs, image previews and many embeds are missing. Camera calls and screen sharing are deliberately unavailable. Discord's scripts, API traffic, channel lists, message rendering and Electron/Chromium remain active. There is no hard 1 GiB RAM cap and no unmeasured resource-savings promise. Unknown-extension video requests may pass through because ambiguous media URLs are allowed to protect voice.

Switching **Performance → Extreme Lite / Balanced / Custom** reloads Discord so network filtering applies consistently. Changes to the image-blocking checkbox also reload the page. Save any unsent message before switching profiles.

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

The installer is emitted to `desktop-electron/release/SweetCord-Setup-0.5.0.exe`. The packaged files include `permission-policy.cjs`.

## Performance menu

- **Extreme Lite / Balanced / Custom** — mutually exclusive performance profiles. Profile changes reload Discord.
- **Block all images + recognized video (Custom setting)** — independent image switch for Custom mode.
- **Hide optional promos and navigation** — hides common Store, Shop, Quests, Nitro and Discovery destinations.
- **Disable UI animations and transitions** — removes most CSS animations/transitions.
- **Hide profile banners and decorations** — removes decorative profile effects.
- **Use still profile avatars** — mainly useful in Balanced or Custom mode.
- **Sample CPU + memory for 5 seconds** — explicitly samples aggregate Electron process metrics. The summed process CPU percentage can exceed 100% across cores; GPU usage still needs separate measurement.

## Benchmark on the same PC

Compare official Discord and SweetCord on the same Windows PC, account, network, window size and channel. Measure idle, text chat and an active microphone-based voice call separately.

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -ProcessName SweetCord,Discord,Vesktop -SampleSeconds 60 -IntervalSeconds 2 -OutputPath .\\benchmark-sweetcord.csv
```

The script now samples repeatedly and reports median/peak working set and private memory, median/P95/peak CPU, and peak process count. Pass `-OutputPath .\\benchmark-sweetcord.csv` to export samples. It does not upload measurements. For GPU, open **Task Manager → Details**, enable **GPU** and **GPU engine**, and compare the same scenario. Include WebView2 host/renderer processes when testing Tauri. CSS-only changes do not guarantee lower CPU/GPU usage; request blocking and removing active media work are the intended optimizations.

## Security and tests

SweetCord never requests a Discord personal account token. Authentication remains in Discord's persistent browser profile. Image/video blocking applies only to the main Discord WebContents, not authentication popups. Microphone permission is limited to HTTPS Discord origins and audio-only requests. Camera and screen capture are denied.

Run `npm test` from `desktop-electron`. CI tests source syntax, request policy and microphone-only permissions and builds the installer. These checks do not replace real Windows login, message and voice-call testing. SweetCord is unofficial and not affiliated with Discord.
