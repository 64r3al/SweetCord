# SweetCord Lite — Master Plan

**Status:** Feasibility and measurement first  
**Plan date:** 2026-10-26  
**Current release posture:** Do not treat the Discord-wrapping / client-modification path as approved.

## 1. Product objective

Build the lowest-resource chat experience that can be supported reliably and lawfully, while being honest about which data and capabilities it can actually access.

The aspiration is to investigate whether an ultra-low-memory experience can approach 200 MB at idle. **200 MB is a stretch target, not a promise or acceptance criterion before measurement.** A full web client, browser renderer, realtime connections, caching, and voice transport may make this target unrealistic without a different architecture.

SweetCord currently contains separate products:

- **SweetCord Web:** an independent React + Supabase text-chat application.
- **SweetCord Desktop (Electron):** a shell around Discord's official web application, currently with experimental filtering/customization.
- **SweetCord Desktop (Tauri):** an experimental WebView2 wrapper.
- **Python prototype:** a UI demonstration, not a production chat client.

These products are not interchangeable. An independent SweetCord account or Discord OAuth sign-in does not itself grant access to Discord friends, servers, DMs, private message history, or voice.

## 2. Non-negotiable guardrails

1. **Authorization before Discord-client customization.** Discord's published Platform Manipulation Policy Explainer says not to modify the Discord client, including its appearance or layout. The Discord Social SDK terms also restrict competitive analysis and products that compete with Discord services. Do not assume a wrapper, custom layout, media filter, or Social SDK is allowed for this use case. Ask Discord for an explicit written decision covering the actual intended product.
2. **Use supported access only.** Do not use copied user tokens, browser cookies, self-bots, undocumented endpoints, private protocol reverse engineering, or scraping.
3. **Never imply data access we do not have.** A bot, OAuth identity scope, Social SDK integration, and approved partner scopes have different capabilities. Verify every required scope and use case against official documentation and written approvals.
4. **Measure before optimizing.** Do not claim a RAM limit or a savings percentage without repeated, comparable measurements.
5. **Protect user data.** Keep benchmark output local by default. Never log message contents, credentials, access tokens, or cookies in benchmark reports.
6. **Preserve a reversible path.** Work in a dedicated branch and pull request. Do not merge or ship changes that depend on unapproved client modification.

### Official policy references (reviewed 2026-10-26)

- Discord Platform Manipulation Policy Explainer: https://discord.com/safety/platform-manipulation-policy-explainer-oct-2023
- Discord Social SDK Terms: https://support-dev.discord.com/hc/en-us/articles/30225844245271-Discord-Social-SDK-Terms
- Discord Developer Policy: https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy
- Discord OAuth2 scopes and partner restrictions: https://github.com/discord/discord-api-docs/blob/main/developers/topics/oauth2.mdx
- Discord Developer Terms: https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service

The current policy pages do **not** establish that SweetCord has an exception. Silence or lack of enforcement is not approval.

## 3. Phase 0 — Feasibility and written authorization

**Goal:** decide which Discord integration, if any, is permissible before expanding the desktop client.

Tasks:

- [ ] Submit the draft in [DISCORD-ACCESS-REQUEST.md](./DISCORD-ACCESS-REQUEST.md) through Discord's appropriate official support/developer channel.
- [ ] Describe SweetCord truthfully, including that it is intended to be a lightweight desktop chat experience and that the current prototype has experimented with UI/media filtering.
- [ ] Ask specifically about a third-party desktop client or wrapper, client appearance/layout changes, media filtering, distribution to other users, existing-account sign-in, friends, private messages/history, guilds/channels, and voice.
- [ ] Request the exact supported API/SDK scopes and partner approval process for each required feature.
- [ ] Save the written response in project notes, removing private account/contact details as appropriate.
- [ ] Record a decision: **approved as specified**, **approved only with constraints**, **not approved**, or **no answer yet**.

**Gate:** until the response gives clear approval for the intended client behavior, do not add more code that alters Discord's client or depends on unauthorized access. Keep the existing client-customization PR separate and unmerged. If approval is denied or unavailable, select a fallback architecture in Phase 2.

## 4. Phase 1 — Establish a repeatable baseline

**Goal:** learn what the current choices really cost on the target Windows PC.

Use `desktop-electron/benchmark-windows.ps1`. It collects process-tree memory and CPU samples and supports targeting one root process by PID plus a JSON summary with environment metadata.

### Comparison rules

- Test **one application root at a time**.
- Prefer `-RootProcessId` over process-name matching so similarly named app instances are not accidentally aggregated.
- Let the application settle before starting a sample.
- Keep the Windows session, power mode, display resolution, app version, account, network, and workload consistent.
- Run each scenario at least **three times**; compare medians and peaks, not a single screenshot.
- Keep the raw CSV and JSON report local. Review the JSON before sharing it because it includes basic machine metadata.
- Record Task Manager GPU utilization and dedicated/shared GPU memory separately; the script does not sample GPU counters.
- If comparing a browser, isolate the browser profile/session as much as possible. Browser processes can include unrelated tabs and shared renderer processes, which makes attribution imperfect.
- Do not compare a single idle app to multiple overlapping Discord processes or an active voice/media workload.

### Scenario matrix

| Scenario | Procedure | What it helps reveal |
|---|---|---|
| Idle | Open the app, wait 3 minutes, do not interact, sample 60 seconds | Baseline background and renderer cost |
| Text chat | Open the same type of text channel/conversation and scroll/read at a consistent pace | Message rendering and list cost |
| Media | Use the same image/GIF-rich channel or conversation | Media decoding, cache and rendering cost |
| Voice call | Join the same microphone-only call with the same devices/settings, if voice is supported | Voice transport and active-call overhead |
| Minimized voice | Maintain the call and minimize the app during the sample, if supported | Background activity when not visible |

Run all scenarios under matched conditions and save each run separately. Example commands are in [PERFORMANCE-BASELINE.md](./PERFORMANCE-BASELINE.md).

**Deliverable:** a baseline table with app version, exact scenario, median/peak private memory, median/peak working set, CPU, process count, startup timing, and manual GPU readings.

## 5. Phase 2 — Architecture decision

Do not select a framework by reputation. Use the evidence and the Phase 0 result.

### Route A — Approved Discord integration

Only pursue this route if written authorization and official interfaces cover the intended use. Create an access matrix for sign-in, friends, DMs/history, guilds/channels, text send/receive, and voice. Implement only approved features and scopes.

**Risk:** access may not be granted for the full experience; the Social SDK is not a general-purpose replacement-client API.

### Route B — Lightweight companion to the official client

A companion can launch the official app, guide users through supported settings, and collect local performance information without injecting into, scraping, or modifying the Discord client.

**Trade-off:** it cannot independently provide Discord DMs, friend lists, server content, or voice. The official client remains responsible for those features and its resource cost.

### Route C — Independent SweetCord app

Build the product UI and backend for features SweetCord owns: accounts, spaces, channels, direct/group conversations, realtime text messaging, notifications and later voice using a suitable supported transport.

**Trade-off:** existing Discord DMs, servers, friend relationships and history do not automatically become available or migrate. Discord OAuth can be considered only for the specific officially supported identity/linking use case; it is not a general data-export permission.

### Route D — Official Discord app/web with user-side configuration

If a supported integration or companion does not serve the need, help users optimize the official product using its own settings and normal browser controls. This is the lowest-risk way to retain the full existing Discord experience while we assess alternatives.

**Decision:** document feature coverage, permission basis, user-data limitations, estimated engineering cost and performance evidence for each viable route, then choose one primary route. Do not quietly combine incompatible routes.

## 6. Phase 3 — Minimal usable prototype

The first prototype should implement one complete path end to end, rather than many half-working features.

1. Secure, officially supported account flow (or SweetCord-owned account flow for Route C).
2. Conversation list and a focused message view.
3. Efficient message history loading and virtualized lists where appropriate.
4. Explicit loading, empty, offline, permission-denied and reconnect states.
5. Small, deliberate cache and realtime-subscription lifetimes.
6. Clear settings and diagnostics with no secrets or conversation contents in logs.
7. Automated tests for access control, reconnect behavior and data boundaries.

Do not add camera, screen sharing, rich media, animations, voice, games, or decorative UI before the essential text path and memory baseline are reliable. Voice should be designed only after the chosen architecture and permitted transport are confirmed.

## 7. Phase 4 — Optimization loop

For every change:

1. State the suspected bottleneck and the metric expected to improve.
2. Capture the pre-change baseline using the same scenario.
3. Change one main variable at a time.
4. Run tests and repeat the same benchmark scenario at least three times.
5. Keep the change only when the improvement is repeatable and required functionality is not materially worse.
6. Record trade-offs (for example, lower RAM at the cost of missing images or longer startup).

Priority order:

- Eliminate duplicate clients, duplicate subscriptions and needless background work.
- Virtualize large conversation/message lists and avoid loading entire histories.
- Lazy-load screens and media.
- Bound caches and release references/listeners when views unmount.
- Profile leaks and long-lived objects over a 30-minute session.
- Only then compare runtime/framework or rendering choices on the same workload.

## 8. Phase 5 — Validation and release

- [ ] Fresh-install, upgrade, sign-in/out, session expiry and reconnect tests.
- [ ] Send/receive and conversation-history tests for all supported messaging paths.
- [ ] Permission and access-control tests, including denied/unapproved features.
- [ ] 30-minute stability test and repeat memory sampling over time.
- [ ] Startup and responsiveness tests.
- [ ] Voice device, mute, reconnect and minimize/restore tests if voice is implemented.
- [ ] Windows installer build from a clean checkout.
- [ ] Security review of storage, logs, dependencies and outbound network behavior.
- [ ] Benchmark evidence attached to the release or pull request.
- [ ] Release notes state what was measured, the hardware/software conditions, features removed and known limitations.

A build is not release-ready solely because CI passes or an installer compiles. Real-device messaging, permissions and long-session behavior must be tested.

## 9. Success criteria

The initial target is evidence-based improvement, not an arbitrary RAM promise.

- **Performance:** repeated measurable reduction from the baseline in the intended workload, without a material regression in responsiveness or CPU.
- **Memory:** report median and peak private memory and working set separately. A 200 MB idle target remains aspirational until the chosen architecture is benchmarked.
- **Correctness:** essential supported sign-in, messaging and reconnect flows pass.
- **Safety and policy:** access uses documented, approved interfaces and is covered by the applicable terms and permissions.
- **Reliability:** no known critical regressions; no unbounded memory growth during the extended-session test.
- **Honesty:** all user-facing performance claims are backed by published test conditions and results.

## 10. Immediate order of work

1. Keep the existing client-customization PR unmerged while the authorization question is unresolved.
2. Submit the access request.
3. Add reliable process-isolated benchmark output and run it on the target Windows computer.
4. Record three-run baseline results for each scenario that can be tested today.
5. Use the written answer plus performance evidence to select Route A, B, C or D.
6. Only then start architecture-specific implementation.
