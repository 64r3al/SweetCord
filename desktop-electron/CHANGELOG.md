# Changelog

## v0.7.0 — Process-tree benchmark and safer WebView2 startup (preview)

- Make the Windows benchmark target one application root by default and include its descendant processes, including relevant Chromium/WebView2 helpers, by process ID.
- Fail early when the requested root process is not found and clearly report whether descendants are included.
- Document repeat-run comparisons for idle, text, live microphone call and minimized-call scenarios, with GPU measurements collected separately.
- Add PowerShell syntax validation to the Windows CI pipeline.
- Start the experimental Tauri/WebView2 window at `about:blank`, install the native resource filter first, then navigate to Discord. If filter installation fails, the experimental preview does not continue into an unfiltered Discord session.

Known limits: the benchmark is a sampler and adds some process-enumeration overhead; GPU metrics remain manual. The Tauri preview has not been manually validated against live Discord voice on user hardware and is not promoted as the default client.

## v0.6.0 — MIME-aware visual media filtering (preview)

- Inspect response MIME types as a fallback for visual resources whose URL does not expose a file extension.
- Block recognized video and HLS/DASH response types while explicitly allowing `audio/*` and unknown content types to protect voice compatibility.
- In Balanced mode, detect recognized animated-image MIME types while permitting still images.
- Add regression tests for extensionless video, audio, static images, auth routes and window scoping.

Known limits: CI success does not prove real-world voice compatibility or quantify CPU/RAM/GPU savings. The app still runs Discord's web client and Chromium.


## v0.5.0 — Performance profiles and diagnostics (preview)

- Add saved **Extreme Lite**, **Balanced**, and **Custom** performance profiles.
- Keep Extreme Lite as the default; Balanced permits still images while blocking recognizable GIF/APNG/video assets, and Custom exposes the existing individual performance controls.
- Preserve old preference files, including an explicit older choice to allow images.
- Add regression tests for profile normalization and balanced media classification.
- Replace the one-shot benchmark comparison with repeated CPU/memory sampling and median, peak, and P95 summaries; optionally export the samples to CSV.
- Upgrade the in-app resource snapshot to sample process CPU and memory for five seconds when explicitly opened.
- Add a Windows-only native WebView2 request-filtering experiment for image and clearly recognized visual-media resources.

Known limits: no Windows hardware benchmark or live Discord call has been executed by the code-writing environment. Measurements must be collected on the target PC before publishing savings percentages. Ambiguous media URLs remain allowed to protect voice traffic; hardware counter availability varies by GPU driver. The Tauri interception experiment must pass its Windows CI and manual voice tests before it is recommended as the default.

## v0.4.0 — Ultra-Lite voice + text preview

- Preserve microphone-only voice calls and keep voice-channel UI/audio elements available.
- Block images and only clearly identified video/GIF media assets; ambiguous media requests fail open to protect calling compatibility.
- Add tested microphone-only permission policy: camera, mixed audio/video and display capture are denied.
- Add permission-policy regression tests and include the policy module in packaged builds.
- Update performance guidance; no unmeasured CPU/RAM/GPU savings or fixed memory cap are claimed.

Known limits: Discord's web client and Electron/Chromium still run, unknown-extension video requests may pass through, and real Windows benchmarking plus manual voice-call validation remain necessary.

## v0.3.0 — Text-only desktop preview

This is an experimental Windows preview focused on reducing Discord's image/media workload.

### Changed

- Turn on text-only mode by default for new installs and older preference files without an explicit text-only setting.
- Block image and media requests initiated by the main Discord tab, while leaving scripts, API requests, stylesheets and external authentication popups alone.
- Keep Discord sign-in, OAuth, verification, logout and account-recovery routes exempt from image blocking.
- Hide recognized profile photos, server icons, banners, badges, GIFs, stickers, custom-emoji images, media attachments, embeds, Activities, video/screen-sharing UI and Nitro/Shop/Quests promo elements.
- Deny camera/microphone permission while text-only mode is active.
- Stop avatar observer and scan work while text-only mode is enabled; reload the Discord page when the user changes text-only mode so resource filtering applies cleanly.
- Add a native memory snapshot for the total Electron process working set/private-memory estimate.
- Add unit tests for the request policy and the text-only injection.
- Publish a versioned Windows prerelease from the desktop workflow whenever the package version is changed on the main branch.

### Known limitations

- No hard 1 GiB total-memory ceiling is enforced. A hard limit could make Chromium's renderer or the entire app crash, and a JavaScript heap cap would not cap native or GPU memory.
- The Discord web app and the Electron/Chromium processes still run. Text-only mode reduces image/media work but does not remove the cost of Discord's core web client.
- Discord can change selectors, URLs, request types and UI structure without notice. Real-PC CPU/RAM/GPU results are required before claiming a performance improvement.
- Video and screen-sharing UI and image/media displays are intentionally reduced in Extreme Lite. Balanced mode restores still images but is not equivalent to the maximum-reduction profile.
