# SweetCord Desktop — Performance Profiles Preview

SweetCord Desktop wraps Discord's official web app. Version **0.7.0** adds MIME-aware visual-media filtering, a process-tree-aware Windows benchmark, and safer startup ordering for the experimental Tauri/WebView2 filter. It does not replace Discord's renderer or implement a separate Discord protocol.

## Performance profiles

- **Extreme Lite (default):** blocks all image requests and clearly identified video/GIF assets, hides visual extras, disables UI effects, and keeps microphone-only voice calls available.
- **Balanced:** allows still images while blocking recognizable GIF/APNG/video assets; keeps optional promotions and decorative effects reduced.
- **Custom:** exposes individual controls for image blocking, promo/navigation visibility, motion, profile decorations and still avatars.

Switching profiles reloads Discord so the network policy takes effect consistently. Changes made in Custom preserve the other active settings. Existing v0.4.0 preference files are migrated without discarding an explicit prior choice to allow images.

The wrapper cannot suspend Discord's own application logic. All profiles still run Discord's JavaScript, API, text renderer and Chromium. URL and response-MIME filtering can catch more visual media, but profiles are behavior controls—not memory-limit enforcement—and cannot guarantee a fixed CPU/RAM target.

## Ultra-Lite mode

Extreme Lite remains the default for new installs and existing preference files without a saved profile:

- Extreme Lite cancels image requests, including profile photos, server icons, banners, GIFs, stickers, custom emoji images, image attachments and image embeds. Balanced allows still images but cancels clearly identified animated-image formats.
- All profiles cancel media requests when the URL clearly identifies video/GIF assets or the response MIME type identifies video/HLS/DASH content. Audio MIME responses are explicitly allowed to protect voice-call compatibility; unknown response types fail open.
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

The installer is emitted to `desktop-electron/release/SweetCord-Setup-0.7.0.exe`. The packaged files include `permission-policy.cjs`.

## Performance menu

- **Extreme Lite / Balanced / Custom** — mutually exclusive performance profiles. Profile changes reload Discord.
- **Block all images + recognized video (Custom setting)** — independent image switch for Custom mode.
- **Hide optional promos and navigation** — hides common Store, Shop, Quests, Nitro and Discovery destinations.
- **Disable UI animations and transitions** — removes most CSS animations/transitions.
- **Hide profile banners and decorations** — removes decorative profile effects.
- **Use still profile avatars** — mainly useful in Balanced or Custom mode.
- **Sample CPU + memory for 5 seconds** — explicitly samples aggregate Electron process metrics. The summed process CPU percentage can exceed 100% across cores; GPU usage still needs separate measurement.

## Benchmark on the same PC

Use one root application per run; do not pass multiple installed clients together. The script follows descendant process IDs by default, so Chromium/Electron helper processes and WebView2 renderer processes are included without indiscriminately counting unrelated Edge tabs. Run from the repository root after the selected app has started.

Example for SweetCord Electron:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -ProcessName SweetCord -SampleSeconds 60 -IntervalSeconds 2 -OutputPath .\electron-idle-run1.csv
```

Use `-ProcessName Discord` for official Discord. For the experimental Tauri build, use `-ProcessName "SweetCord Tauri Preview"` if that is the executable name shown in Task Manager. If the name differs, use the executable's name without `.exe`.

Repeat each test three times at minimum, keeping account, network, window size and activity consistent. Test idle, active text chat, a real microphone voice call, and a minimized call. Let the app settle before starting each sample. Use one output CSV per run and scenario; don't compare a busy run against an idle run.

The report includes median/peak working set and private memory, median/P95/peak CPU, and peak process count. It samples Windows process metadata to follow parent/child relationships; this adds some measurement overhead, so use the same script settings for each comparison. It does not upload data. No GPU counters are collected by the script: open **Task Manager → Details**, enable **GPU** and **GPU engine**, and compare the same scenario. Also record dedicated/shared GPU memory from Task Manager's **Performance → GPU** view.

A summed working set can count shared memory more than once; compare private memory as well and treat it as a process-level estimate, not a hard physical-RAM cap. CSS-only changes do not guarantee lower CPU/GPU usage. Measure each change on the same workload before declaring a win.

## Security and tests

SweetCord never requests a Discord personal account token. Authentication remains in Discord's persistent browser profile. Image/video blocking applies only to the main Discord WebContents, not authentication popups. Microphone permission is limited to HTTPS Discord origins and audio-only requests. Camera and screen capture are denied.

Run `npm test` from `desktop-electron`. CI tests source syntax, request policy and microphone-only permissions and builds the installer. These checks do not replace real Windows login, message and voice-call testing. Follow [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) before merging a version-bumping performance change. SweetCord is unofficial and not affiliated with Discord.
