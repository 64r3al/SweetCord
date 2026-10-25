# Changelog

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
- Discord can change selectors, request types and UI structure without notice. Real-PC CPU/RAM/GPU results are required before claiming a performance improvement.
- Voice/video-related UI and image/media displays are intentionally reduced. Turn off **Performance → Text-only mode** if the missing visuals or features matter more than the reduction.
