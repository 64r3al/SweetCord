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

## Configure Discord sign-in (real SweetCord sessions)

With the Supabase project configured, **Continue with Discord** uses Supabase Auth's official Discord provider flow. This creates or restores a SweetCord account session rather than merely showing the Discord profile.

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. In Supabase, open **Authentication → Sign In / Providers → Discord** and enable the provider.
3. Copy the Supabase project's displayed callback URL (typically `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) and add it to the Discord application's OAuth2 Redirects.
4. Add the Discord Application ID and Client Secret to the Supabase Discord provider settings and save.
5. In Supabase Auth URL Configuration, allow the local app URL `http://127.0.0.1:5173` as a redirect URL (also add your production origin later).
6. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, then restart `npm run dev`.
7. Click **Continue with Discord** and authorize your dedicated test account. Supabase handles the OAuth code exchange and session lifecycle.

The Discord button now has two safe modes:

- When the Supabase URL and publishable key are configured, it performs actual Discord OAuth sign-in to SweetCord. Supabase provider settings must be enabled.
- If Supabase is not configured, it can use the standalone identity-preview path, provided `VITE_DISCORD_CLIENT_ID`, `VITE_DISCORD_REDIRECT_URI`, and `VITE_DISCORD_EXCHANGE_ENDPOINT` are configured. That fallback only verifies basic profile identity and does **not** create a signed-in SweetCord session.

### Optional standalone profile-preview fallback

The fallback exchanges the short-lived OAuth code server-side and returns only basic profile fields. If you use it, configure these Supabase Edge Function secrets:

- `DISCORD_CLIENT_ID` — same application ID as above
- `DISCORD_CLIENT_SECRET` — from the Discord Developer Portal
- `SWEETCORD_ALLOWED_ORIGIN` — exact frontend origin, e.g. `http://127.0.0.1:5173`
- `SWEETCORD_ALLOWED_REDIRECT_URI` — exact redirect URI, e.g. `http://127.0.0.1:5173/`

The browser calls the public Edge Function with the project's publishable key in the `apikey` header. The function validates the expected origin and exact redirect URI. The publishable key is not an authorization secret.

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
