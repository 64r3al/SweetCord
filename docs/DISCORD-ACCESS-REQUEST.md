# Draft: request for Discord client and data-access clarification

**Status:** Draft only. This file has not been sent to Discord.  
**Purpose:** obtain written guidance before implementing or distributing a third-party lightweight client.

## Suggested subject

Request for written guidance on a lightweight desktop chat project and supported Discord integrations

## Message

Hello Discord Developer Support,

I'm developing SweetCord, an experimental desktop and web chat project. My goal is to offer a resource-conscious desktop chat experience. I want to determine the supported and permitted way to integrate with Discord before investing further in the implementation or distributing it.

To be transparent, an early desktop prototype has wrapped Discord's web application and experimented with hiding parts of the interface and filtering visual media to reduce resource use. I have paused further work on those client-customization behaviors while seeking your guidance.

Could you please clarify the following in writing?

1. **Third-party desktop experience:** Is a separately distributed desktop application that opens or wraps Discord's official web client permitted? In particular, are custom navigation, layout changes, hiding interface elements, or filtering media requests permitted for this use case? If not, is there an approval or exception process?
2. **Account authentication:** Which official sign-in or account-linking path should be used for this project? What can standard OAuth authorize, and what requires separate review?
3. **Friends and relationships:** Is access to a user's existing friends list or relationship data available to this type of application? If so, which documented API/SDK and approval process apply?
4. **Private messages and history:** Is there any supported way for this application to read existing one-to-one/group DMs and message history? If a scope or capability is restricted to approved partners or local RPC, please clarify the eligibility and conditions.
5. **Servers and channels:** Which supported interfaces can expose existing guild, channel, membership and message data for this type of application, and which review/permissions are required?
6. **Text and voice communication:** Is sending/receiving messages or joining voice on behalf of a signed-in user supported for this use case? Which officially documented SDK/API and approvals are required?
7. **Distribution:** Would the answer differ for a private personal prototype versus distributing the application publicly or commercially?
8. **Appropriate alternative:** If this client concept is not permitted, which official integration or product approach would you recommend for a resource-conscious experience while retaining existing Discord account functionality?

I do not want to use self-bots, copied user tokens, browser cookies, undocumented endpoints, scraping, or reverse engineering as a workaround. I am asking so the project can use a supported approach and respect Discord's security, privacy, and developer requirements.

If any part of the concept is not permitted, please identify the relevant policy and whether a narrower approved integration is available. I would appreciate an explicit written response on what is and is not authorized, rather than treating silence as approval.

Thank you.

## Submission checklist

Before sending:

- Replace the description of the project if its current architecture changes.
- Add the public repository URL and a short demonstration only if requested and safe to share.
- Use the official Discord support/developer contact channel; do not send credentials, user tokens, cookies, or private message contents.
- Keep a copy of Discord's response and record the date, constraints, granted scopes, and whether the approval covers public distribution.
- Do not treat approval for one SDK, feature, or test as blanket approval for a competing client or for other data scopes.

## Policy and API references

- Platform Manipulation Policy Explainer: https://discord.com/safety/platform-manipulation-policy-explainer-oct-2023
- Discord Social SDK Terms: https://support-dev.discord.com/hc/en-us/articles/30225844245271-Discord-Social-SDK-Terms
- Discord Developer Policy: https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy
- OAuth2 scopes: https://github.com/discord/discord-api-docs/blob/main/developers/topics/oauth2.mdx
