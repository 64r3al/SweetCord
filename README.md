# SweetCord

A lightweight, voice-first desktop communication app for gaming communities.

## Current phase

The repository is being initialized. The first milestone is a lightweight login/profile experience and a local demo mode, followed by official Discord OAuth2 authorization and then the app's own voice and messaging services.

## Security and authentication

- Do not collect Discord user-account tokens or Discord passwords.
- Use Discord's official OAuth2 authorization flow for Discord identity, with state validation and PKCE where supported.
- Use a separate SweetCord account system for app-native authentication.
- Keep OAuth client secrets and service-role keys out of the desktop bundle and source control.
- Demo mode uses a clearly labeled local mock profile; it does not authenticate with Discord or access Discord data.

## Development

The frontend will use Vite, React, and TypeScript. The desktop shell is planned with Tauri 2 once the UI and core state contracts are established.

## Status

Early development; not affiliated with or endorsed by Discord.
