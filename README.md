# SweetCord

SweetCord is an early-stage, lightweight, voice-first gaming communication app. The goal is simple: make it easy to talk and message friends without filling the screen—or a low-end PC—with features players don't need.

**Status:** login UI and local demo profile are committed. Real Discord profile confirmation requires a Discord developer application and a deployed server-side exchange function. Voice, messaging, and the Tauri desktop shell are not implemented yet.

## Stack

- Vite + React + TypeScript for the first UI slice
- Supabase Edge Function for confidential server-side Discord OAuth code exchange
- Planned desktop wrapper: Tauri 2
- Planned app-native accounts and messaging: Supabase Auth + Postgres + Realtime
- Planned voice transport: LiveKit/WebRTC

## Run the UI locally

1. Install a current Node.js LTS release.
2. Copy `.env.example` to `.env.local`.
3. Run `npm install`.
4. Run `npm run dev`.
5. Click **Explore with a demo profile** to test the confirmation screen and shell without authorizing a real account.

Demo mode uses a fixed local sample profile only. It does not read the Discord app, access Discord data, or create an authenticated session.

## Configure Discord OAuth (profile identity only)

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy its **Application ID** into `VITE_DISCORD_CLIENT_ID`.
3. Add the exact value of `VITE_DISCORD_REDIRECT_URI` to the application's OAuth2 redirect list. For local development, this is `http://127.0.0.1:5173/`.
4. Deploy the `discord-oauth-exchange` Supabase Edge Function below.
5. Set `VITE_DISCORD_EXCHANGE_ENDPOINT` to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-oauth-exchange`.
6. Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's public publishable key. It is sent only in the `apikey` header; never use a secret/service-role key in the frontend.
7. Restart the Vite dev server and click **Continue with Discord**.

The app requests only the `identify` scope. It confirms basic profile identity; it does not provide access to all existing Discord servers, DMs, or voice channels.

### Edge Function secrets

Configure these as Supabase Function secrets (never in `.env.local` or frontend code):

- `DISCORD_CLIENT_ID` — same application ID as above
- `DISCORD_CLIENT_SECRET` — from the Discord Developer Portal
- `SWEETCORD_ALLOWED_ORIGIN` — exact frontend origin, e.g. `http://127.0.0.1:5173`
- `SWEETCORD_ALLOWED_REDIRECT_URI` — exact redirect URI, e.g. `http://127.0.0.1:5173/`

The browser calls the public Edge Function with the Supabase publishable key in the `apikey` header. The function explicitly checks the expected origin and redirect URI; the public key is not an authorization secret.

Local function development can use `supabase/functions/.env`, excluded from source control. For a hosted project, add secrets through the Supabase dashboard or CLI.

## Auth design and security

- No field collects Discord user-account tokens or Discord passwords.
- Discord OAuth uses the authorization-code flow and checks the returned `state` against the session-bound value.
- The general Discord OAuth2 documentation currently documents state and a confidential server-side code exchange; it does not document PKCE for this general flow. This implementation does not send undocumented PKCE parameters. Revisit this only if Discord documents/supports PKCE for the specific flow we use.
- The Discord client secret stays on the server. The function exchanges the code, calls Discord's `/users/@me` endpoint, and returns only the minimum profile fields to the UI. Discord access/refresh tokens are not returned to or stored by the frontend.
- The edge endpoint validates the request origin and exact redirect URI. CORS is not authentication; the code is short-lived and single-use, and the confidential exchange is performed only server-side.
- The function is public at the platform layer because it is called before sign-in, so its request validation and server-side secret handling are essential. Add rate limiting/abuse monitoring before public beta.
- Never commit `.env.local`, Supabase function secrets, or OAuth client secrets.
- SweetCord is an independent community project and is not affiliated with or endorsed by Discord.

## Build checks

- `npm run typecheck`
- `npm run build`

The current environment could not run npm install/build, so those checks still need to be run locally or in CI.

## Roadmap

1. Login UI + local demo profile
2. Verified Discord identity display via OAuth (this milestone)
3. SweetCord-native account sessions and friend relationships
4. Direct messages
5. Low-overhead voice rooms and device controls
6. Tauri desktop integration, crash handling, and real low-end PC profiling

## Native SweetCord accounts and friends (Step 3)

This milestone adds SweetCord-native email/password sign-up and sign-in, restores persisted Supabase Auth sessions, creates a profile row through a database trigger, and supports exact-username friend requests with accept/decline and a canonical friendship record.

### Apply the identity/friends schema

1. Create and select a **dedicated SweetCord** Supabase project. Do not use the Exam website project.
2. Generate a migration through the Supabase CLI with `supabase migration new identity_friends`.
3. Copy the reviewed SQL from `supabase/schema/identity-friends.sql` into that generated migration.
4. Link the CLI to the SweetCord project and apply the migration. Inspect RLS policies and run the project security advisors before testing.
5. In Supabase Authentication settings, decide whether email confirmation is required. If enabled, the app will prompt the user to check their email before signing in.
6. Copy the project's URL and public publishable key to `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put a secret/service-role key into a `VITE_*` variable.
7. Run `npm install` then `npm run dev` and test with two separate SweetCord accounts.

### Friend-system behavior

- Usernames are lowercase and unique; discovery is an exact-username lookup returning only basic profile fields.
- Friend requests are private to their sender and recipient. Only the recipient can accept or decline.
- Accepting a request creates the friendship atomically through a database trigger.
- Profile reads are limited to your own profile, friends, and pending-request peers. Email addresses are never returned by the friend lookup.
- The schema is included as reviewed source, not yet applied to a live database. Once connected to the dedicated project, use a CLI-generated migration so migration history stays consistent.

This is a first production-minded foundation; add rate limiting, abuse reporting, blocking, recovery flows and desktop credential-store hardening before a public release.
