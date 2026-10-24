# SweetCord Desktop Shell

This is a separate Electron desktop build that follows the broad wrapper architecture used by projects such as Vesktop: it opens Discord's own web app inside a desktop window instead of reimplementing Discord's private message, server, and voice systems.

## What it does

- Opens `https://discord.com/app` in a SweetCord-branded Electron window.
- Lets the user sign in on Discord's own page; Discord handles the account session and application data.
- Keeps the regular web session in Electron's persistent profile between launches.
- Allows microphone, camera/media, notification, and fullscreen permissions only for Discord HTTPS origins.
- Opens ordinary external links in the system browser while allowing Discord and common identity-provider popups needed for sign-in.
- Keeps Electron Node.js integration disabled in the Discord renderer, uses context isolation and sandboxing, and enables background throttling.
- Includes keyboard shortcuts for reloading and opening Discord's sign-out page.

## Run on Windows

1. Install Node.js LTS.
2. From the repository root, double-click `Launch SweetCord Desktop.bat`.
3. First launch installs this folder's Electron dependencies; subsequent launches reuse them.

Or use a terminal:

```powershell
cd desktop-electron
npm install
npm start
```

To create a Windows installer:

```powershell
cd desktop-electron
npm install
npm run package:win
```

The installer is written to `desktop-electron/release/`.

## Important limitations

- This is a desktop shell around Discord's actual website, not a new implementation of Discord's protocol or a custom chat backend. Discord controls which features are available to the signed-in account and web client.
- It deliberately does not provide a field for pasting/exporting a Discord personal user token. Sign in through Discord itself.
- This first shell does not yet remove Discord UI sections such as Nitro or Quests; fragile CSS selectors or client patches need a separate compatibility layer and can break when Discord updates.
- It does not claim lower measured CPU/GPU/RAM usage yet. It uses a separate Electron runtime with background throttling enabled, but actual resource use must be benchmarked against Discord and Vesktop on the target PC.
- Third-party Discord client modifications may be against Discord's Terms of Service and can carry account risk. This project is unofficial and not affiliated with Discord.
- This project does not copy Vesktop or Vencord source code. Vesktop is GPL-3.0-licensed; anyone adapting its code must comply with that license.

## Security notes

- SweetCord does not ask for, log, export, or store a pasted Discord user token.
- Discord's own sign-in website handles credentials and session tokens in the Electron browser profile.
- External links are restricted to HTTP(S)/mailto before opening in the system browser.

## Lean interface mode

The desktop shell now enables **Lean interface mode** by default. Open **Performance** in the app menu to toggle it. The setting is saved locally in SweetCord's own preferences file.

It hides common navigation entries for optional destinations such as Store, Shop, Quests, Nitro and Discovery, removes a few promotion containers when their class names are recognizable, shortens transition timings, and removes backdrop blur effects. These selectors are best-effort and can stop matching when Discord changes its web UI; reload Discord after a UI update if needed.

The mode deliberately does **not** turn off GPU acceleration or disable the microphone/camera/media permission path. Those can affect voice/video calls and screen sharing. Discord still controls its own rendering, messages, call implementation, and account features. This is a visual/resource-reduction pass, not proof of a specific RAM/CPU/GPU reduction, and it does not guarantee removal of every upsell/promotion.

## Measuring performance on your PC

Run the included PowerShell script from the repository root while the desktop clients are open:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -ProcessName SweetCord,Discord,Vesktop -SampleSeconds 30
```

It reports summed Working Set, private memory, and average CPU use for matching process names. Repeat comparable 30-second samples with the same conditions: idle, text chat, and an active voice/video call. If you run the development shell rather than the packaged app, add `electron` to `-ProcessName`, but close unrelated Electron apps first.

For GPU, use Windows Task Manager → Details, enable the **GPU** and **GPU engine** columns, and compare under the same test scenario. The script does not upload any data. Treat the results as local estimates, not a universal benchmark.
