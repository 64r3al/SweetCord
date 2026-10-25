# SweetCord Desktop — Text-only Preview

SweetCord Desktop is an Electron wrapper around Discord's official web app. It does **not** replace Discord's renderer or implement a separate Discord protocol. Version **0.3.0** introduces a deliberately aggressive, default-on text-only profile because hiding a few promo links was not enough to reduce the app's visual/media workload.

## What text-only mode does

New installs and existing installs with no saved value start with text-only mode enabled. In the main Discord window, it:

- Cancels image and media network requests initiated by the main Discord tab. This includes profile photos, server icons, avatars, banner assets, GIFs, stickers, custom emoji images, image attachments, and many external image embeds.
- Hides Discord UI elements associated with avatars, profile decorations/badges, image attachments, embeds, GIFs, stickers, the emoji picker, video, screen sharing, Activities, Nitro/Shop/Quests and related promotions.
- Disables CSS animations and transitions and removes decorative profile effects.
- Skips the avatar MutationObserver and avatar scans while text-only mode is active.
- Denies camera/microphone capture permission until text-only mode is turned off.

The goal is a simpler text-focused interface with fewer image downloads and less image decoding/compositing. Discord's class names and request behavior can change, so the filters are best-effort rather than a permanent compatibility guarantee.

## Trade-offs

Text-only mode is intentionally destructive to visuals:

- Profile pictures, server icons, banners, custom emoji images, stickers, GIFs, image/file previews and many embeds will be missing.
- Camera/microphone permission is denied while the mode is on; voice/video-related interface elements are hidden where recognized.
- Discord's normal scripts, app state, channel lists and message rendering still run. Messages that are plain text remain available, but Discord can change its web app so some controls may be hidden or behave differently.
- When changing **Performance → Text-only mode**, SweetCord reloads Discord so the browser can re-request assets under the new setting. Do not toggle it while composing an unsent message.

## Run or package on Windows

1. Install a current Node.js LTS release.
2. From the repository root, double-click `Launch SweetCord Desktop.bat`, or run:

```powershell
cd desktop-electron
npm install
npm start
```

Create the installer:

```powershell
cd desktop-electron
npm install
npm test
npm run package:win
```

The installer is emitted to `desktop-electron/release/SweetCord-Setup-0.3.0.exe`. Packaged builds include `resource-policy.cjs`; it is required for network blocking to work in the installed app.

## Performance menu

Open the native application menu and choose **Performance**:

- **Text-only mode — block images, GIFs, stickers and media** — enabled by default. Turning it off restores image/media requests after a reload.
- **Hide optional promos and navigation** — hides common Store, Shop, Quests, Nitro and Discovery destinations.
- **Disable UI animations and transitions** — removes most CSS animations and transitions.
- **Hide profile banners and decorations** — removes decorative profile effects.
- **Use still profile avatars** — relevant when text-only mode is disabled.
- **Show current memory snapshot** — sums Electron's reported process working sets and private memory as a local diagnostic.

Preferences are saved under SweetCord's Electron user-data folder. The memory snapshot is approximate and does not upload any information.

## Benchmark on the same PC

Close extra apps and compare the same account, channel, window size and scenario. Run the same test for official Discord and SweetCord, first idle and then in the same text channel. Do not compare a voice call in one app with idle in the other.

From PowerShell in the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -ProcessName SweetCord,Discord,Vesktop -SampleSeconds 30
```

The script reports aggregate Working Set, private memory and average CPU use for the process names selected. For GPU, open **Task Manager → Details**, enable **GPU** and **GPU engine**, and compare equivalent states. The measurement is local; nothing is uploaded.

## The 1 GiB target

**SweetCord does not guarantee or enforce a hard 1 GiB process-memory ceiling.** Electron's browser, renderer, GPU and utility processes plus Discord's own JavaScript application can exceed that amount. A real hard cap could cause Discord's renderer or the whole app to crash when it reaches the limit; a JavaScript heap setting would not cap Chromium's total native/GPU memory. The built-in memory snapshot helps measure the app but is not a cap.

This release reduces image/media work more aggressively, but no resource savings are claimed until measured on the target Windows PC. If text-only mode still exceeds 1 GiB, the remaining cost is likely in Discord's base web client and Electron/Chromium runtime; an actually lower memory ceiling would require a much smaller custom client, not simply more CSS hiding.

## Security and compatibility

- SweetCord never asks for a Discord personal account token or adds a token-export feature.
- Credentials and sessions are handled by Discord's own website in Electron's persistent profile.
- Text-only resource blocking applies only to the main Discord WebContents; OAuth popup content is deliberately excluded from the filter.
- Sign-in, OAuth, verification, account recovery and logout routes are exempted from image blocking.
- Third-party Discord client modifications may carry account and Terms of Service risks. SweetCord is unofficial and not affiliated with Discord.
- This project does not copy Vesktop or Vencord source code.

## Tests

Run:

```powershell
cd desktop-electron
npm test
```

CI tests the generated browser script, request-blocking policy and JavaScript syntax before packaging. They do not replace a real-device benchmark or manual testing of sign-in and message sending.
