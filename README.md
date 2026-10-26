<div align="center">

# SweetCord

### Less noise. More focus. Better time with your squad.

A community-built gaming chat project exploring a lighter desktop experience and a focused, self-hostable text-chat app.

<p>
  <a href="https://github.com/64r3al/SweetCord/actions/workflows/ci.yml"><img alt="Main CI" src="https://github.com/64r3al/SweetCord/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/64r3al/SweetCord/actions/workflows/desktop-shell.yml"><img alt="Windows desktop build" src="https://github.com/64r3al/SweetCord/actions/workflows/desktop-shell.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/64r3al/SweetCord/actions/workflows/tauri-preview.yml"><img alt="Tauri preview build" src="https://github.com/64r3al/SweetCord/actions/workflows/tauri-preview.yml/badge.svg?branch=main"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-React-3178C6?style=flat&logo=typescript&logoColor=white">
  <img alt="Platform" src="https://img.shields.io/badge/Desktop-Windows-0078D4?style=flat&logo=windows&logoColor=white">
</p>

[Explore the code](https://github.com/64r3al/SweetCord) · [Windows releases](https://github.com/64r3al/SweetCord/releases) · [Report a problem](https://github.com/64r3al/SweetCord/issues)

</div>

---

> [!IMPORTANT]
> **SweetCord has separate products with different capabilities.** The native web app is a React + Supabase text-chat application. The Electron and Tauri desktop wrappers open **Discord's official web app**; they are not native Discord protocol clients and do not add Discord voice to the native SweetCord web app.

## Table of contents

- [Project at a glance](#project-at-a-glance)
- [Choose your version](#choose-your-version)
- [Features and limitations](#features-and-limitations)
- [Get the Windows desktop app](#get-the-windows-desktop-app)
- [Run the web app](#run-the-web-app)
- [Configure the backend](#configure-the-backend)
- [Desktop development](#desktop-development)
- [Performance profiles](#performance-profiles)
- [Testing and validation](#testing-and-validation)
- [Security notes](#security-notes)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License and project status](#license-and-project-status)

## Project at a glance

SweetCord is a small, community-built project with two different goals:

- **Desktop efficiency:** provide a configurable, resource-conscious window around Discord's official web client.
- **A separate chat application:** build the foundations for SweetCord accounts, friends, private conversations, spaces, channels, and realtime text messaging.

The repository also includes an experimental Tauri/WebView2 wrapper and a Python UI prototype.

## Choose your version

| Edition | What it does | Status |
| --- | --- | --- |
| **SweetCord Web** | SweetCord accounts, friends, direct and group DMs, spaces, text channels, and realtime messages | Main React/Supabase application; requires backend setup |
| **SweetCord Desktop (Electron)** | Opens Discord's official web app in a SweetCord-branded Windows window, with optional visual-resource filtering | Primary desktop preview |
| **SweetCord Desktop (Tauri)** | Opens Discord's official web app through Tauri and Windows WebView2 | Experimental; security and real-device validation still required |
| **Python prototype** | Local Tkinter interface with sample conversations | UI demo only; no real accounts or network chat |

### Feature comparison

| Capability | SweetCord Web | Electron wrapper | Tauri wrapper | Python prototype |
| --- | :---: | :---: | :---: | :---: |
| Uses SweetCord accounts and database | Yes | No | No | No |
| Uses Discord's official web client | No | Yes | Yes | No |
| Friends and private text messaging | Yes, after setup | Through Discord | Through Discord | Sample data only |
| Voice through Discord | Not implemented | Microphone-focused mode | Experimental; test manually | No |
| Video and screen sharing | Not implemented | Deliberately disabled | Not a supported target | No |
| Requires a configured Supabase project | Yes | No | No | No |

## Features and limitations

### Native SweetCord web app

The React/Supabase app currently includes:

- Discord OAuth via Supabase Auth, when configured.
- Optional SweetCord email/password accounts.
- Exact-username friend requests with accept and decline actions.
- One-to-one direct messages with stored history and realtime updates.
- Group DMs with up to eight invited friends.
- Servers and private group spaces with text channels.
- Message history and a 4,000-character message limit.
- A responsive dark interface.
- PostgreSQL row-level security policies for profiles, friendships, workspace membership, conversations, and messages.

The web app **does not currently implement native voice transport, video calls, file uploads, server invite/discovery flows, or built-in reporting and moderation**. These should not be confused with the features available inside Discord when using one of the desktop wrappers.

### Desktop wrappers

Electron and Tauri are shells for Discord's official web client. They keep using Discord's web application, APIs, and browser runtime. SweetCord's UI and resource filters are best-effort enhancements; they do not replace Discord's underlying application.

## Get the Windows desktop app

Pre-release installers and workflow builds are available through GitHub:

- **[Browse Windows releases](https://github.com/64r3al/SweetCord/releases)** for published preview installers.
- **[Open the Electron workflow](https://github.com/64r3al/SweetCord/actions/workflows/desktop-shell.yml)** to inspect builds and artifacts.
- **[Open the Tauri workflow](https://github.com/64r3al/SweetCord/actions/workflows/tauri-preview.yml)** for experimental artifacts.

Packaged installers do not require Node.js to run. These are **preview builds, not stable releases**. Check the asset version and release notes before installing; a published installer may not yet contain the newest changes on the `main` branch.

### Build or launch Electron from source

On Windows, install a current Node.js LTS release and then either double-click **Launch SweetCord Desktop.bat** in the repository root or run:

```powershell
cd desktop-electron
npm install
npm start
```

To run tests and create an installer:

```powershell
npm test
npm run package:win
```

The installer is written to `desktop-electron/release/`. For the desktop-specific controls and troubleshooting, see [desktop-electron/README.md](desktop-electron/README.md).

## Run the web app

### Requirements

- A current Node.js LTS release and npm.
- A dedicated [Supabase](https://supabase.com/) project for SweetCord.
- A [Discord Developer Portal](https://discord.com/developers/applications) application if using Discord sign-in.

### 1. Clone and install

```bash
git clone https://github.com/64r3al/SweetCord.git
cd SweetCord
npm install
```

### 2. Configure environment variables

Copy the example file to your local configuration:

**PowerShell**
```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**
```bash
cp .env.example .env.local
```

For the native app, set the public Supabase project URL and publishable key in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

These are client-side configuration values. The publishable key is only appropriate when database access is protected by correctly configured RLS policies. **Never** put a Supabase service-role key or Discord client secret in a `VITE_*` variable.

### 3. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite. The default development origin is `http://127.0.0.1:5173`. Keep the terminal open while using the app.

On Windows, **Launch SweetCord.bat** starts the web development server. It does not install or configure the backend automatically.

## Configure the backend

The SQL files in `supabase/schema/` are **schema source files**, not proof that a database has already been created or configured. Use a dedicated SweetCord Supabase project and keep the migration history in source control.

### 1. Configure Discord OAuth in Supabase

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. In Supabase, enable **Authentication → Providers → Discord**.
3. Add the callback URL shown in Supabase's provider configuration to the Discord application's OAuth2 redirect URLs. It typically resembles `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
4. Add the local application origin to Supabase Auth's URL configuration.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.

Discord authentication should happen on Discord's official authorization page. SweetCord should never ask users to enter a Discord password or personal account token into the app.

### 2. Apply the identity and friends schema

Create a migration with the Supabase CLI:

```bash
supabase migration new identity_friends
```

Copy `supabase/schema/identity-friends.sql` into the generated migration, link the CLI to your **dedicated SweetCord project**, and apply it.

### 3. Apply the chat schema

Create the next migration after the identity/friends migration:

```bash
supabase migration new chat_workspaces
```

Copy `supabase/schema/chat-workspaces.sql` into that migration and apply migrations in order. The chat schema adds spaces, membership, text channels, DM conversations, participants, and messages.

Before inviting real users, review the SQL and Supabase security advisors. Test with at least two accounts: verify that a non-member cannot read a private space's messages and that realtime messages arrive in a second session.

### Optional: profile-only Discord OAuth preview

When Supabase is not configured, the local Vite server can exchange a Discord authorization code to verify a **basic Discord profile**. This is a development/preview path only: it does not create a SweetCord chat session, access Discord DMs or servers, or implement voice. A deployed profile-preview Edge Function can be configured with `VITE_DISCORD_EXCHANGE_ENDPOINT`.

For this local test, register the exact redirect URL `http://127.0.0.1:5173/` with the Discord application and configure:

```dotenv
VITE_DISCORD_CLIENT_ID=your_discord_application_id
VITE_DISCORD_REDIRECT_URI=http://127.0.0.1:5173/
VITE_DISCORD_EXCHANGE_ENDPOINT=
DISCORD_CLIENT_SECRET=your_discord_client_secret
```

Keep `DISCORD_CLIENT_SECRET` server-side without a `VITE_` prefix, and never commit a real secret. The deployed Edge Function uses the server-side settings `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SWEETCORD_ALLOWED_ORIGIN`, and `SWEETCORD_ALLOWED_REDIRECT_URI`.

## Desktop development

### Electron

Electron is the primary desktop preview. It loads `https://discord.com/app`, keeps Discord's session in a persistent Electron session partition, and applies the controls described under [Performance profiles](#performance-profiles).

```powershell
cd desktop-electron
npm install
npm test
npm start
```

Build the Windows installer:

```powershell
npm run package:win
```

See [desktop-electron/README.md](desktop-electron/README.md) for the implementation details and known limitations.

### Tauri / WebView2

Tauri is experimental and should not be treated as a drop-in replacement for Electron. Its real CPU, memory, login persistence, popup behavior, notifications, and voice compatibility need testing on real Windows hardware.

```powershell
npm install --prefix desktop-tauri
npm run tauri:build --prefix desktop-tauri
```

**Known limitation:** the current Tauri popup path validates the initial popup URL, but later redirects in the default popup are not independently filtered by the main-window navigation handler. Keep this version experimental until popup navigation is hardened and verified.

See [desktop-tauri/README.md](desktop-tauri/README.md) and the [Tauri preview workflow](https://github.com/64r3al/SweetCord/actions/workflows/tauri-preview.yml).

### Python UI prototype

The Python app uses only the standard library and Tkinter. It is a local UI sandbox with sample conversations and does not contact Discord or provide network messaging.

- Launcher: `desktop-python/run.bat`
- Guide: [desktop-python/README.md](desktop-python/README.md)
- Source: [desktop-python/sweetcord.py](desktop-python/sweetcord.py)

## Performance profiles

The Electron wrapper offers three profiles:

| Profile | Behavior | Best for |
| --- | --- | --- |
| **Extreme Lite** | Blocks image requests and recognized visual media; hides optional UI and reduces animation work | Text-first use on resource-constrained PCs |
| **Balanced** | Allows still images while filtering recognized animation and video resources | A middle ground between visuals and resource reduction |
| **Custom** | Lets you adjust individual visual and UI settings | Users who want to choose the trade-offs |

The current Electron source adds response-MIME checks to catch some visual media that does not have a recognizable file extension. Unknown content types generally fail open to avoid accidentally breaking audio.

**Important trade-offs:**

- Profile photos, server icons, banners, image attachments, emoji, stickers, GIFs, and embeds may be missing in Extreme Lite.
- Microphone-only audio capture is allowed on HTTPS Discord origins; camera and display capture are denied.
- Switching profiles reloads Discord. Save unsent messages before switching.
- Discord's selectors, CDN formats, and web behavior can change at any time.
- The desktop wrapper cannot enforce a hard RAM limit and does not guarantee a specific performance improvement.

### Measure performance fairly

Use the same Windows PC, Discord account, network, window size, and activity for every comparison. Measure idle, text chat, and an active microphone-based call separately.

From PowerShell at the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -ProcessName SweetCord,Discord,Vesktop -SampleSeconds 60 -IntervalSeconds 2 -OutputPath .\benchmark-sweetcord.csv
```

The benchmark reports repeated CPU and memory samples, including median and peak metrics. It writes a CSV only when `-OutputPath` is provided; results stay on your machine. Process-name differences or processes that exit during the measurement can affect results. For GPU activity, use **Task Manager → Details** and enable the **GPU** and **GPU engine** columns. When testing Tauri, account for WebView2 processes and unrelated Edge windows.

## Testing and validation

Run the web application checks from the repository root:

```bash
npm run typecheck
npm run build
```

Run the Electron regression tests:

```powershell
cd desktop-electron
npm install
npm test
```

Run the Tauri JavaScript regression tests from the repository root:

```bash
node --test desktop-tauri/test/lean-mode.test.cjs
```

GitHub Actions also checks the OAuth Edge Function, Python syntax, desktop JavaScript policies, and Windows packaging. CI passing is useful evidence, but it is **not** a substitute for live end-to-end tests of OAuth, session persistence, RLS, messages, voice, notifications, and performance.

## Security notes

SweetCord is an independent, unofficial project and is **not affiliated with, endorsed by, or supported by Discord**.

- Never enter or share your Discord password or personal account token with SweetCord.
- Keep Discord client secrets and Supabase service-role keys on a trusted server; never commit secrets.
- Use a dedicated Supabase project and review RLS policies before testing with real accounts.
- The database schema contains access controls, but the project still needs production work for abuse prevention, rate limiting, account recovery, reporting, moderation, monitoring, and live security testing.
- Treat desktop releases as preview software. Review the source and release notes, and verify builds before relying on them with a sensitive account.
- The desktop resource filters are best-effort and may need maintenance when Discord changes its web client or CDN.
- Using an unofficial Discord wrapper may carry account and Terms of Service risks.

## Roadmap

The current desktop performance and access-feasibility work is tracked in the [SweetCord Lite master plan](docs/SWEETCORD-LITE-MASTER-PLAN.md), with a [Discord access-request draft](docs/DISCORD-ACCESS-REQUEST.md) and [repeatable Windows baseline procedure](docs/PERFORMANCE-BASELINE.md). Client customization remains a policy-gated experiment pending explicit written guidance from Discord.

- [ ] Complete and document backend setup and validate account flows with multiple test users.
- [ ] Add automated integration tests for database permissions and realtime chat.
- [ ] Improve abuse prevention, account recovery, blocking, reporting, and moderation.
- [ ] Harden Tauri popup navigation and verify the full login flow.
- [ ] Test desktop stability and performance on lower-end Windows systems.
- [ ] Publish reproducible CPU, memory, and GPU measurements before making performance claims.
- [ ] Explore native voice rooms for the SweetCord web app using a suitable WebRTC transport and TURN support.

## Contributing

Bug reports, focused improvements, and reproducible test cases are welcome. Before opening a pull request:

1. Explain the user problem or technical motivation.
2. Keep security-sensitive changes small and easy to review.
3. Run the relevant checks listed under [Testing and validation](#testing-and-validation).
4. Clearly identify anything that still needs manual testing on Windows or against a configured Supabase project.

Use [GitHub Issues](https://github.com/64r3al/SweetCord/issues) for bugs and suggestions, and include reproduction steps when possible.

## License and project status

SweetCord is an early-stage community project. Desktop artifacts are preview builds, and the web app requires a separately configured backend.

**No repository license is currently declared.** Until a license is added, do not assume that public availability grants permission to reuse, modify, or redistribute the code.

---

<div align="center">

**SweetCord** · Built for quieter, more focused gaming sessions.

<sub>Unofficial community project. Not affiliated with Discord.</sub>

</div>
