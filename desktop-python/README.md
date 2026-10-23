# SweetCord Python Desktop Preview

A minimal Windows-friendly desktop prototype built with Python's standard-library Tkinter. No pip dependencies are required.

## Run it

1. Install Python 3.10+ from [python.org](https://www.python.org/downloads/windows/). During installation, enable **Add Python to PATH** and include Tcl/Tk.
2. Open this folder in File Explorer.
3. Double-click `run.bat`, or run from the repository root:

   ```powershell
   py -3 desktop-python/sweetcord.py
   ```

4. Click **Launch local demo**.

If Tkinter is missing, rerun the Python installer and add the Tcl/Tk optional feature. The app requires a graphical Windows desktop.

## What works in this preview

- Dark compact desktop UI designed for low visual and dependency overhead.
- Local sample conversations and a message composer.
- Switch between sample DMs/friends.
- Create local demo DMs, servers, private groups, and text channels.
- Add a message to the active local conversation.

## Important: this is not a Discord client yet

This Python sandbox is **local-only**. It does not sign into Discord, connect to Discord's API, read real messages, or send data over the network. Demo messages exist only in memory and reset when the app closes.

It intentionally does not accept Discord passwords or user-account tokens. A pasted user token is a bearer credential, and Discord says automating normal user accounts outside the supported OAuth2/bot API is prohibited and can result in account termination. A README warning doesn't make token collection safer.

The supported Discord OAuth identity flow can verify a profile, but that alone does **not** grant access to a user's DMs or voice. Discord documents `dm_channels.read`, `relationships.read`, `voice`, and related scopes as restricted to approved partners or special supported integrations. This app needs approved Discord authorization for any genuine Discord-network integration. Otherwise, SweetCord should use its own accounts, messages, servers, and voice infrastructure.

Official references:
- [Discord OAuth2 documentation](https://docs.discord.com/developers/topics/oauth2)
- [Discord: Automated User Accounts (Self-Bots)](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots)
- [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)

## Next engineering milestones

1. Connect the already-started SweetCord web app to its dedicated Supabase project.
2. Keep the desktop UI separate from account secrets. For real Discord identity, launch official OAuth and finish the code exchange through an appropriately secured integration.
3. Apply and test the `supabase/schema/identity-friends.sql` and `supabase/schema/chat-workspaces.sql` migrations against a dedicated SweetCord project.
4. Build real low-overhead voice with an approved transport, then profile RAM and CPU use on older PCs.

Don't call this production-ready until the real sign-in, server-side access rules, messaging and security paths have all been tested.
