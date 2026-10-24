# SweetCord Desktop Shell

This is a separate Electron desktop build that follows the broad wrapper architecture used by projects such as Vesktop: it opens Discord's own web app inside a desktop window instead of reimplementing Discord's private message, server, and voice systems.

## What it does

- Opens `https://discord.com/app` in a SweetCord-branded Electron window.
- Lets the user sign in on Discord's own page; Discord handles the account session and application data.
- Keeps the regular web session in Electron's persistent profile between launches.
- Allows microphone, camera/media, notification, and fullscreen permissions only for Discord HTTPS origins.
- Opens ordinary external links in the system browser while allowing Discord and common identity-provider popups needed for sign-in.
- Keeps Electron Node.js integration disabled in the Discord renderer, uses context isolation and sandboxing, and enables background throttling.
- Includes keyboard shortcuts for reloading, switching lean mode, and opening Discord's sign-out page.
- Starts in a compact 1120×720 window with background throttling enabled.
- Keeps GPU acceleration and media permissions available for voice/video calls.
- Makes packaged builds hide developer tools and disables webpage spellcheck to avoid extra work in the chat renderer.
- Enables a configurable ultra-low-effects profile by default: optional promo navigation hidden, UI animation/transitions disabled, decorative profile banners/effects hidden, and animated avatars switched to their static PNG versions when Discord's CDN supports them.
- Stores those four performance preferences locally; they can be changed from the **Performance** menu.

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

## Ultra-low-effects profile

The **Performance** menu contains independently reversible settings:
- **Hide optional promos and navigation** — hides common Store, Shop, Quests, Nitro, and Discovery destinations, plus matching promotion cards.
- **Disable UI animations and transitions** — removes most CSS animations/transitions in the Discord renderer.
- **Hide profile banners and decorations** — hides decorative profile banner/effect/avatar-decoration layers while retaining real user avatars.
- **Use still profile avatars** — attempts to load PNG versions of animated Discord avatar GIF URLs and restores the original source when disabled.

All four options are enabled by default. Use `Ctrl+Shift+M` to toggle promo/navigation trimming quickly (on macOS, use `Cmd+Shift+M`). Preferences are saved locally under SweetCord's Electron user data folder.

These tweaks are compatibility best-effort: Discord changes its selectors and CDN behavior without notice. If something essential looks wrong, disable a setting and reload. The shell keeps GPU acceleration, WebRTC, camera/microphone permissions, and the Discord messaging/call app intact. No private-user-token login or token export is added.

**Memory target reality:** 200 MB is not a safe promise when running Discord's full web client. The browser renderer, server list, avatars, messages, and active calls have their own costs; video calls can exceed the target. We need benchmark results from the target PC before quantifying savings. This profile primarily reduces decorations, motion, and some image animation; it cannot make Discord's underlying client intrinsically tiny.

## Measuring performance on your PC

Run the included PowerShell script from the repository root while the desktop clients are open:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -ProcessName SweetCord,Discord,Vesktop -SampleSeconds 30
```

It reports summed Working Set, private memory, and average CPU use for matching process names. Repeat comparable 30-second samples with the same conditions: idle, text chat, and an active voice/video call. If you run the development shell rather than the packaged app, add `electron` to `-ProcessName`, but close unrelated Electron apps first.

For GPU, use Windows Task Manager → Details, enable the **GPU** and **GPU engine** columns, and compare under the same test scenario. The script does not upload any data. Treat the results as local estimates, not a universal benchmark.
