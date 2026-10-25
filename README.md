# SweetCord

**A lightweight, community-built gaming chat project.** SweetCord combines friends, direct messages, group conversations, private spaces, community servers, and text channels with a deliberately restrained interface.

[![Main CI](https://github.com/64r3al/SweetCord/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/64r3al/SweetCord/actions/workflows/ci.yml)
[![Windows desktop build](https://github.com/64r3al/SweetCord/actions/workflows/desktop-shell.yml/badge.svg?branch=main)](https://github.com/64r3al/SweetCord/actions/workflows/desktop-shell.yml)
[![Tauri preview build](https://github.com/64r3al/SweetCord/actions/workflows/tauri-preview.yml/badge.svg?branch=main)](https://github.com/64r3al/SweetCord/actions/workflows/tauri-preview.yml)

> **Important distinction:** the SweetCord web app and the Windows desktop wrappers are separate products in this repository. The web app uses SweetCord's own React/Supabase backend. The desktop wrappers display Discord's official web app; they do not turn the original SweetCord web app into a voice client.

SweetCord is an independent project and is not affiliated with or endorsed by Discord. Never share a Discord password, personal account token, client secret, or Supabase service-role key.

## Choose the version

| Version | What it runs | Status |
| --- | --- | --- |
| **SweetCord web app** | SweetCord accounts, friends, DMs, servers, text channels, and Realtime messaging | Main React/Supabase application |
| **Electron desktop** | Discord's official web app in a SweetCord-branded Windows window | Default desktop preview |
| **Tauri / WebView2 desktop** | Discord's official web app using the Windows WebView2 runtime | Experimental; use the CI artifact to test |
| **Python desktop prototype** | Local-only Tkinter interface with sample data | UI sandbox; no real accounts or network chat |

### Get the Windows desktop preview

When a nightly build is available, download the installer from [SweetCord Desktop — Nightly Releases](https://github.com/64r3al/SweetCord/releases/tag/nightly). You do not need Node.js to run an already-built installer.

To build or run the Electron shell from source on Windows, double-click **Launch SweetCord Desktop.bat** in the repository root. See [desktop-electron/README.md](desktop-electron/README.md).

The Tauri installer is published as a temporary artifact on the [Tauri workflow page](https://github.com/64r3al/SweetCord/actions/workflows/tauri-preview.yml). It is not the default desktop release.

## What's implemented in the SweetCord web app

- **Authentication:** Discord OAuth through Supabase Auth, plus SweetCord email/password accounts when configured.
- **Friends:** exact-username friend requests and accept/decline actions.
- **Direct messages:** private one-to-one conversations with stored message history and Realtime updates.
- **Group DMs:** private group conversations with a name and up to eight invited friends.
- **Servers and private groups:** create a space, add text channels, and invite existing SweetCord friends.
- **Text chat:** messages up to 4,000 characters, recent message history, and live updates.
- **Responsive interface:** dark UI intended for desktop use and adapted for small screens.
- **Database access controls:** row-level security (RLS) for profiles, friendships, workspaces, memberships, conversations, and messages.

**Not implemented in the original React/Supabase app:** native voice calls or voice transport, video calls, file uploads, server invite/discovery flows, and moderation/reporting tools. The Electron and Tauri shells rely on Discord's own web app for Discord features; they are not implementations of those features inside SweetCord.

## Performance work

The goal is to reduce work SweetCord controls while preserving the features the underlying browser needs for a responsive interface and media calls.

### Web app

- Removed unused decorative ambient-blur elements and grid overlays.
- Memoized reusable avatar components and derived workspace/channel/member/conversation data to avoid repeating lookups and sorting on every render.
- Kept the Supabase Realtime message subscription stable across profile-map updates instead of recreating it unnecessarily.
- Avoids animating the message list when new messages arrive.

### Electron and Tauri desktop shells

- Batches avatar DOM work using requestAnimationFrame.
- Scopes avatar observation to Discord's app subtree where available, rather than watching the entire document.
- Deduplicates overlapping DOM additions and image-source changes so the same subtree or image is not needlessly processed more than once per batch.
- Disables decorative transitions and trims selected upsell/navigation elements in the optional lean-mode injection.
- Attempts to use static profile-avatar images when Discord's CDN supports them, and falls back to the original image if conversion fails.
- Keeps GPU acceleration and required browser media permissions available; disabling them could harm rendering smoothness, audio, video, or screen sharing.

These are code-level optimizations, **not a promise of a particular CPU, GPU, or RAM figure**. Discord's own web client, server/channel content, cached images, and active voice/video streams remain major parts of resource usage. The project has not established a universal 200 MB memory target.

### Measure performance on your PC

For a fair comparison, use the same Windows PC, account, network, window size, and activity for each build. Test separately at idle, in a text conversation, during voice, and during video or screen sharing.

From PowerShell in the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\\desktop-electron\\benchmark-windows.ps1 -ProcessName SweetCord,Discord,Vesktop -SampleSeconds 30
```

The script reports aggregate working set, private memory, and average CPU use for the process names selected. It does not upload or save your measurements. A process that exits during sampling or a child process with a different name can affect the comparison.

For GPU activity, open **Task Manager → Details**, enable the **GPU** and **GPU engine** columns, and compare equivalent scenarios. For the Tauri build, inspect the WebView2 host and renderer processes as well.

## Architecture and setup

### 1. Run the SweetCord web app

**Requirements:** a current Node.js LTS release, npm, and a dedicated SweetCord Supabase project.

1. Clone this repository.
2. Copy **.env.example** to **.env.local**.
3. Configure your dedicated SweetCord Supabase project using the backend instructions below.
4. Add the public project URL and publishable key to **.env.local**.
5. Run the app:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The example configuration uses http://127.0.0.1:5173; OAuth redirect origins must match the URL and redirect configured in your provider settings.

On Windows, **Launch SweetCord.bat** is a shortcut for starting the web application. Keep the terminal window open while it is running.

### 2. Configure Supabase and Discord sign-in

The SQL files in **supabase/schema/** are source files; do not assume they have been applied to a live database. Use a dedicated SweetCord Supabase project, review the SQL, and keep migration history managed by the Supabase CLI.

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. In Supabase, enable **Authentication → Sign In / Providers → Discord**.
3. Add the Supabase callback shown in the provider settings to the Discord application's OAuth2 redirect URLs. It typically looks like https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback.
4. Add your local app origin to Supabase Auth's URL configuration.
5. Set **VITE_SUPABASE_URL** and **VITE_SUPABASE_PUBLISHABLE_KEY** in **.env.local**.

When users select Continue with Discord, authentication should take place on Discord's official authorization page. SweetCord must not ask users for their Discord password or personal user token.

#### Apply the identity and friends schema

Create a migration:

```bash
supabase migration new identity_friends
```

Copy **supabase/schema/identity-friends.sql** into the generated migration, link the Supabase CLI to your dedicated SweetCord project, and apply the migration.

#### Apply the chat schema

Create a second migration after the identity/friends migration:

```bash
supabase migration new chat_workspaces
```

Copy **supabase/schema/chat-workspaces.sql** into that migration and apply migrations in order. The chat schema creates workspace and group membership, text channels, direct/group conversations, and messages. It enables RLS and limits access based on workspace membership or DM participation.

Before testing, use Supabase's security advisors and validate at least two test accounts. Confirm that a non-member cannot read a private workspace's messages and that Realtime updates arrive in a second session.

#### Environment variable example

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never put a Supabase service-role key, Discord client secret, or other server secret in a VITE_* variable. Do not commit **.env.local**.

### 3. Optional local Discord profile-only test

The Vite development server includes a test-only OAuth exchange route for confirming basic Discord profile identity. This route is for local testing; it is not a production chat-session provider and does not access Discord DMs or servers. It returns basic profile fields and attempts to revoke the short-lived access token.

For this local-only test, add the exact redirect http://127.0.0.1:5173/ to your Discord application's OAuth2 redirects. Copy **.env.example** to **.env.local**, then configure:

```dotenv
VITE_DISCORD_CLIENT_ID=your_discord_application_id
VITE_DISCORD_REDIRECT_URI=http://127.0.0.1:5173/
VITE_DISCORD_EXCHANGE_ENDPOINT=
DISCORD_CLIENT_SECRET=your_discord_client_secret
```

Keep **DISCORD_CLIENT_SECRET** server-side without the VITE_ prefix. Restart the development server after changing environment variables. This profile-only test does not require Supabase, but real SweetCord accounts and chat features do.

A deployed discord-oauth-exchange Edge Function can be used for the standalone profile-preview fallback by setting **VITE_DISCORD_EXCHANGE_ENDPOINT** to its HTTPS URL. The function's server-side configuration includes **DISCORD_CLIENT_ID**, **DISCORD_CLIENT_SECRET**, **SWEETCORD_ALLOWED_ORIGIN**, and **SWEETCORD_ALLOWED_REDIRECT_URI**. Keep all secrets server-side.

## Desktop builds

### Electron (default desktop preview)

The Electron shell opens https://discord.com/app and uses Discord's own account session and web client. Its renderer has Node integration disabled, context isolation and sandboxing enabled, and background throttling enabled. It includes configurable lean-mode options for reducing decorative UI work.

To run it from source on Windows:

```powershell
cd desktop-electron
npm install
npm start
```

To create the Windows installer:

```powershell
npm run package:win
```

The installer is written to **desktop-electron/release/**. See [desktop-electron/README.md](desktop-electron/README.md) for controls, tests, and limitations.

### Tauri / WebView2 (experimental)

This is a separate Windows wrapper for Discord's official website, using Tauri 2 and WebView2. It may reduce the overhead of shipping a separate browser runtime, but its real memory and CPU usage must be measured on the target PC.

Build instructions and a detailed validation checklist are in [desktop-tauri/README.md](desktop-tauri/README.md). The Tauri preview must not replace Electron until login persistence, OAuth popups, voice, video, screen sharing, notifications, and resource use have been tested on real Windows hardware.

Known limitation: the current experimental Tauri popup path checks the initial popup URL, but later redirects in that default popup are not independently filtered by the main-window navigation handler. Treat this build as experimental until that behavior is hardened and verified.

### Python desktop prototype

The standard-library Tkinter prototype is a local-only UI sandbox. It uses sample data and does not access real Discord accounts or provide live network messaging.

- Launcher: **desktop-python/run.bat**
- Guide: [desktop-python/README.md](desktop-python/README.md)
- Source: [desktop-python/sweetcord.py](desktop-python/sweetcord.py)

## Tests and CI

GitHub Actions checks the web app's TypeScript/build, the Discord OAuth Edge Function tests, and Python syntax. Separate Windows workflows validate the Electron and Tauri injected JavaScript, run their regression/security tests, build installers, and upload the installers as workflow artifacts.

Run the web app checks locally:

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

Run the Tauri lean-mode regression tests from the repository root:

```bash
node --test desktop-tauri/test/lean-mode.test.cjs
```

The CI checks catch syntax, type, unit-test, and packaging problems. They do not replace hands-on tests of login, session persistence, voice/video calls, screen sharing, notifications, or measurements on your actual PC.

## Security and project status

- Discord passwords and personal user tokens are never requested by SweetCord.
- Discord client secrets and Supabase service-role keys must remain server-side.
- Workspace membership and conversation participation are enforced by database RLS policies, not merely by hiding controls in the UI.
- The backend still needs a production review of rate limiting, account recovery, blocking/reporting, abuse prevention, and operational monitoring before a public launch.
- Discord may change its web app or CDN behavior at any time; desktop lean-mode tweaks are best-effort and may need maintenance.
- SweetCord is an unofficial third-party project. Using a modified Discord wrapper can carry account and Terms of Service risks.

## Roadmap

1. Complete the dedicated backend setup and validate account flows with test users.
2. Add native voice rooms and calls with a reliable WebRTC transport and TURN support to the original SweetCord app.
3. Add file sharing, server invites/discovery, blocking/reporting, and moderation.
4. Harden and test Tauri popup navigation, then compare its real resource usage with Electron on lower-end Windows PCs.
5. Publish measured, reproducible CPU/RAM/GPU comparisons before claiming a specific performance target.
