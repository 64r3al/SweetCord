# Changelog

All entries describe preview builds. Performance claims require measurements from the same Windows device and workload.

## v0.8.0 - Deep Lite interface pruning (preview)

- Expand Ultra-Lite selectors for commerce and promotion components whose CSS class names vary across Discord versions.
- Add route-aware pruning for Nitro, Shop, Quests, Store, Discovery and Activities navigation, with a bounded observer to handle dynamically rendered navigation.
- Install the stylesheet through Electron's native insertCSS API before toggling lightweight mode, reducing reliance on a page-injected style element.
- Hide additional profile badge and decoration elements in lightweight mode.
- Add a regression test for the generated navigation-pruning policy.
- Correct the root benchmark example to sample one app process tree at a time and add release smoke-test coverage for navigation pruning.

Known limitations: the wrapper still runs Discord's web application and the Electron/Chromium runtime. It does not enforce a hard 200 MB RAM ceiling. The changes have not yet been measured on the target Windows PC, and live login, messaging and microphone voice tests remain necessary before release promotion.

## v0.7.0 - Process-tree benchmark and safer WebView2 startup (preview)

- Improve Windows process-tree resource measurement and PowerShell syntax validation in CI.
- Start the experimental Tauri/WebView2 window at about:blank, install the native resource filter first, then navigate to Discord.

## v0.6.0 - MIME-aware visual media filtering (preview)

- Inspect response MIME types as a fallback for visual resources whose URL does not expose a file extension.
- Block recognized video and HLS/DASH responses while explicitly allowing audio MIME responses.
