# SweetCord Desktop — Performance Profiles Preview

SweetCord Desktop is an experimental shell around Discord's official web app. It does not replace Discord's renderer or implement a separate Discord protocol.

> [!CAUTION]
> **Policy gate:** Discord's published Platform Manipulation Policy Explainer says not to modify the Discord client, including its appearance or layout. The experimental customization/filtering route in this repository has no written exception documented here. Do not treat it as an approved third-party client or distribute it as such unless Discord explicitly authorizes the intended behavior. See the [SweetCord Lite master plan](../docs/SWEETCORD-LITE-MASTER-PLAN.md) and [access request draft](../docs/DISCORD-ACCESS-REQUEST.md).

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

Use the benchmark to compare one application workload at a time. It follows child process IDs so Electron/Chromium helper processes and WebView2 renderers can be included. Prefer an exact **main-process PID** when possible; process-name matching can aggregate multiple instances with the same executable name. Run from the repository root after the selected app has started and settled.

Find candidate PIDs in PowerShell:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match '^(SweetCord|Discord|msedge|chrome)\.exe$' } |
  Select-Object ProcessId, ParentProcessId, Name
```

Example for one SweetCord process tree (replace `1234` with the main process PID from Task Manager → Details):

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -RootProcessId 1234 -Scenario idle -SampleSeconds 60 -IntervalSeconds 2 -OutputPath .\benchmarks\sweetcord-idle-run1.csv -SummaryPath .\benchmarks\sweetcord-idle-run1.json
```

For name-based fallback, use `-ProcessName Discord` or `-ProcessName SweetCord`; note that all matching root names may be aggregated. Available scenario labels are `idle`, `text-chat`, `voice-call`, `minimized-voice-call`, `media`, and `custom`.

Run each comparable scenario three times at minimum: idle, text chat, media (if applicable), microphone-only voice (if supported), and minimized voice (if supported). Keep settings, account, power mode, window size, network, and app version consistent. Let the app settle before each sample. Use a unique CSV and JSON path for every run and never compare a busy run against an idle run.

The CSV contains time-series samples. The optional JSON report adds summary medians/peaks, raw samples, and basic Windows/machine metadata; both remain local unless you choose to share them. The script does not upload telemetry and does not collect message content. Review JSON metadata before sharing it. The script does not collect GPU counters: open **Task Manager → Details**, enable **GPU** and **GPU engine**, and record the same scenario. Also record dedicated/shared GPU memory from **Task Manager → Performance → GPU**.

A summed working set can count shared memory more than once; compare private memory as well and treat both as process-level estimates, not a hard physical-RAM cap. Browser benchmarks are harder to isolate if unrelated tabs share the same browser process tree. Startup latency and GPU usage need separate measurements. Measure each change on the same workload before declaring a win.


## Security and tests

SweetCord never requests a Discord personal account token. Authentication remains in Discord's persistent browser profile. Image/video blocking applies only to the main Discord WebContents, not authentication popups. Microphone permission is limited to HTTPS Discord origins and audio-only requests. Camera and screen capture are denied.

Run `npm test` from `desktop-electron`. CI tests source syntax, request policy and microphone-only permissions and builds the installer. These checks do not replace real Windows login, message and voice-call testing. Follow [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) before merging a version-bumping performance change. SweetCord is unofficial and not affiliated with Discord.
