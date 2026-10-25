# SweetCord

**SweetCord** is an independent, lightweight gaming chat project: direct messages, group chats, private spaces, community servers, and text channels—built around a simple interface and a low-overhead design.


> **Want the downloadable Windows desktop app?** [Get the latest SweetCord Desktop preview](https://github.com/64r3al/SweetCord/releases/tag/nightly). Install it like a normal Windows app; no Node.js or terminal is needed. This is an early preview and the resource savings are not yet benchmarked.

> SweetCord is not affiliated with or endorsed by Discord. Discord sign-in redirects to Discord's official OAuth page; SweetCord never asks for or stores a Discord account password or user token.

## Discord-backed desktop experiment

The repository includes a stable-in-place **Electron desktop shell** and a separate experimental **Tauri/WebView2 shell**; both open Discord's own web app. This is the closest architecture match to the account-and-voice goal: Discord itself provides the signed-in user's servers, messages, and calls, instead of SweetCord rebuilding those systems.

- Run it on Windows with [Launch SweetCord Desktop.bat](Launch%20SweetCord%20Desktop.bat).
- Electron source, performance settings and regression tests: [desktop-electron/README.md](desktop-electron/README.md).
- Experimental Tauri/WebView2 build and testing checklist: [desktop-tauri/README.md](desktop-tauri/README.md). The Tauri installer is built as a CI artifact and does not replace the Electron release.
- Sign in only on Discord's official page; SweetCord does not offer a paste-token form.
- The Electron shell has a configurable ultra-low-effects profile. Its avatar observer batches work and scans all avatars only when necessary; failed static-image conversions fall back without repeatedly retrying.
- It keeps GPU acceleration and call/media permissions enabled. These changes are compatibility best-effort; no fixed RAM/CPU/GPU savings are claimed until measured on real PCs.
- The Tauri/WebView2 preview is experimental until login, voice/video, and resource use are verified on real hardware. Neither desktop variant guarantees 200 MB RAM. The original React/Supabase SweetCord app remains available via [Launch SweetCord.bat](Launch%20SweetCord.bat).

> Important: third-party Discord client modifications may violate Discord's Terms of Service and can carry account risk. SweetCord is unofficial and not affiliated with Discord.

## What is in this build

- **Sign-in:** official Discord OAuth through Supabase Auth, plus optional SweetCord email/password accounts.
- **Friends:** exact-username friend requests with accept/decline.
- **Direct messages:** private one-to-one conversations with message history and Realtime updates.
- **Group DMs:** private group conversations with a name and up to eight invited friends.
- **Servers and private groups:** create a space, add text channels, and invite existing SweetCord friends.
- **Text chat:** messages up to 4,000 characters, newest history loading, and live updates.
- **Responsive UI:** dark interface designed for desktop first and usable on small screens.
- **Access rules:** separate SQL schema adds row-level security (RLS) for workspaces, memberships, conversations and messages.

**For the original React/Supabase web app:** voice calls, voice-channel transport, file uploads, server invite links/discovery, and moderation/reporting tools remain unimplemented. The Tauri shell is a separate wrapper for Discord's existing web app, not native SweetCord voice transport. The new Electron shell is a separate experiment that uses Discord's web app directly, so it does not depend on the SweetCord Supabase project for Discord's existing chats.

## Tech stack

- React + TypeScript + Vite
- Supabase Auth, Postgres RLS and Realtime
- Official Discord OAuth provider configured in Supabase
- Tauri 2 WebView2 wrapper experiment; low-overhead native voice transport remains future work for the original SweetCord app

## Run locally

**Windows shortcut:** double-click [Launch SweetCord.bat](Launch%20SweetCord.bat) from the repository folder. It checks for Node.js/npm, installs dependencies on first launch if needed, and opens SweetCord in your browser. Keep the terminal window open while using the app.

Manual setup, or setup on another operating system:

1. Install a current Node.js LTS release.
2. Clone this repository and copy `.env.example` to `.env.local`.
3. Create a **dedicated SweetCord Supabase project** (do not use the unrelated Exam website project).
4. Follow the setup steps below and configure the environment variables.
5. From the repository folder, run:

   ```bash
   npm install
   npm run dev
   ```

6. Open the local URL printed by Vite. The default redirect allowlist in the examples uses `http://127.0.0.1:5173`; use the exact local origin shown in your browser.

## Backend setup

The SQL sources are deliberately checked into the repository but **have not been applied to a live database**. Apply them only to the dedicated SweetCord project, in the order below. Generate migrations with the Supabase CLI so the project's migration history stays consistent.

### 1. Configure official Discord sign-in

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. In Supabase, open **Authentication → Sign In / Providers → Discord** and enable Discord.
3. Copy the callback URL shown by Supabase (typically `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) into the Discord app's OAuth2 redirect URLs.
4. Enter the Discord Application ID and Client Secret in the Supabase Discord provider settings.
5. Under Supabase Auth URL Configuration, allow your local app URL and later your production origin.
6. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.

When the user clicks **Continue with Discord**, the browser goes to Discord's official sign-in/authorization page and returns to SweetCord. Do not create an in-app form that asks for a Discord password or token.

### 2. Apply the identity and friend schema

Create a migration with the CLI:

```bash
supabase migration new identity_friends
```

Copy the contents of `supabase/schema/identity-friends.sql` into that generated migration, link the CLI to your SweetCord Supabase project, and apply it. Review the SQL and run Supabase's security advisors before testing.

This migration creates account profiles, friend requests, and accepted friendships. Email addresses are not returned by username lookup.

### 3. Apply the chat schema

Create a second migration **after** the identity/friends migration:

```bash
supabase migration new chat_workspaces
```

Copy `supabase/schema/chat-workspaces.sql` into that generated migration, then apply migrations in order. The chat migration creates workspace/server and group membership, text channels, direct/group conversations and messages. It enables RLS, limits message access to channel members or DM participants, restricts invites to friends, and adds the messages table to Supabase Realtime when that publication is available.

Useful checks after migration:
- Sign up two test users and complete email confirmation if enabled.
- Send and accept a friend request.
- Open a DM, create a group DM, create a server/private group, and post in a channel.
- Confirm a user who is not a member cannot read that workspace's messages.
- Verify message updates arrive live in a second browser session.

### 4. Environment variables

`.env.local` should contain your own project's URL and **public** publishable key:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never put a Supabase service-role key, Discord client secret, or other server secret in a `VITE_*` variable. Do not commit `.env.local`.

### Temporary local Discord sign-in test

For a temporary **profile-only** test, the local Vite development server includes a test-only OAuth code exchange route. It exists only while `npm run dev` is running; it is not included in production builds. It asks Discord to verify the signed-in profile using the official OAuth authorization-code flow, returns only basic profile fields, then attempts to revoke the short-lived access token. It does not read DMs, join servers, or create a logged-in SweetCord chat session.

1. Create or open your app in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under OAuth2 redirects, add exactly `http://127.0.0.1:5173/` and save changes.
3. In the repository root, copy `.env.example` to `.env.local`.
4. Set these values in `.env.local`:

   ```dotenv
   VITE_DISCORD_CLIENT_ID=your_discord_application_id
   VITE_DISCORD_REDIRECT_URI=http://127.0.0.1:5173/
   VITE_DISCORD_EXCHANGE_ENDPOINT=
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   ```

   Keep `DISCORD_CLIENT_SECRET` exactly as written, without the `VITE_` prefix. The local server reads it; the browser does not.
5. Save the file, restart `Launch SweetCord.bat`, and click **Continue with Discord**.

The temporary test does not need a Supabase project. The client ID and secret come from your own Discord application; never paste the secret or any account token into chat or commit it to GitHub. If Discord reports a redirect mismatch, check that both the Developer Portal and `.env.local` use the exact redirect above.

When the test is complete, the local-only test route can be removed. For actual SweetCord sessions and chats, configure Discord as an OAuth provider in a dedicated SweetCord Supabase project instead. For that flow, the Supabase callback URL is `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`, which is different from the local redirect above. See [Supabase's Discord sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-discord).

### Optional deployed Discord profile-preview fallback

The existing standalone profile-preview flow can also call a deployed `discord-oauth-exchange` Edge Function instead of the local test route. Set `VITE_DISCORD_EXCHANGE_ENDPOINT` to the function's HTTPS URL and set `VITE_SUPABASE_PUBLISHABLE_KEY`. Its server-side secrets are `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SWEETCORD_ALLOWED_ORIGIN`, and `SWEETCORD_ALLOWED_REDIRECT_URI`. Never put the client secret in a `VITE_*` variable.


## Security notes

- Discord account passwords and personal user tokens are never requested by SweetCord.
- Discord client secrets stay server-side.
- Workspace membership and DM participation are checked by RLS, not by frontend hiding alone.
- A shared workspace or conversation grants access only to basic peer-profile fields needed to render the chat.
- The backend still needs rate limiting, account recovery, block/report workflows, anti-abuse protections, and a production security review before a public launch.

## Build checks

GitHub Actions runs `npm run typecheck`, `npm run build`, and the Discord OAuth Edge Function tests on pushes and pull requests. You can run the frontend checks locally with:

```bash
npm run typecheck
npm run build
```

## Roadmap

1. Finish dedicated backend setup and test real accounts.
2. Add voice calls/rooms with a reliable WebRTC transport and TURN support.
3. Add file sharing, server invites/discovery, block/report tools, and moderation.
4. Build and profile the Tauri desktop client on lower-end Windows PCs.
5. Measure RAM and CPU usage with real sessions; lightweight performance is a goal, not a benchmark claim yet.

## Python desktop prototype

A separate standard-library Tkinter sandbox is available for quick UI testing without setting up a backend:

- Launch on Windows: double-click [`desktop-python/run.bat`](desktop-python/run.bat)
- Instructions and limitations: [`desktop-python/README.md`](desktop-python/README.md)
- Source: [`desktop-python/sweetcord.py`](desktop-python/sweetcord.py)

This prototype runs in local demo mode only. It is useful for evaluating the compact desktop UI and message interactions; it does not access real Discord accounts or send data to Discord. Real Discord DMs and voice features depend on approved integration permissions, not a pasted user token.
