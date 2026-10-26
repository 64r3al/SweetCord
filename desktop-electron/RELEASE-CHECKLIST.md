# SweetCord Desktop Release Checklist

This checklist applies before merging a release-tagged performance change. SweetCord is a preview wrapper around Discord's web app; automated CI alone cannot establish that live Discord messaging and voice calls work on real hardware.

## Automated gates

- [ ] JavaScript syntax checks and all Electron policy tests pass.
- [ ] PowerShell benchmark script parses successfully in Windows CI.
- [ ] Tauri URL-policy, lean-mode tests and Windows build pass when Tauri files changed.
- [ ] Electron Windows installer builds from a clean checkout.
- [ ] Changelog, README and release notes accurately describe what changed and what remains unverified.

## Windows manual smoke tests

- [ ] Clean install and launch; existing preferences load correctly after upgrading.
- [ ] Login and supported OAuth/verification flow complete successfully.
- [ ] Open DMs, switch servers/channels, read history, type and send messages, and navigate normally.
- [ ] Extreme Lite filters images/recognized visual media; Balanced still allows static images; Custom preferences persist.
- [ ] Change profiles only after saving drafts, confirm the page reload is expected, and verify the selected profile remains selected after restart.
- [ ] Start and receive a microphone voice call; test input/output device selection, mute/unmute, reconnect, and normal channel navigation.
- [ ] Keep a real voice call running while minimizing, restoring and resizing the app; confirm audio does not stop or become unstable.
- [ ] Confirm camera and display capture remain denied, and that image/video filtering does not suppress audio traffic.
- [ ] Leave the app open for at least 30 minutes; review crashes, renderer restarts and continuing private-memory growth.

## Performance evidence

- [ ] Compare official Discord, Electron Extreme Lite and Tauri/WebView2 only when each candidate is feature-ready.
- [ ] Run at least three samples each for idle, text chat, active microphone call, and minimized active call, keeping workload and settings consistent.
- [ ] Use one process root per benchmark run and include descendants. Save separate CSVs per run/scenario.
- [ ] Record median and P95 CPU, median/peak working set and private memory, process count, startup latency, GPU utilization and dedicated/shared GPU memory.
- [ ] Record OS build, CPU, RAM, GPU/driver, screen resolution, app version and test date.
- [ ] Treat summed working set as an estimate because shared pages can be counted in multiple processes.
- [ ] Claim a performance improvement only when repeated results show a consistent benefit without materially degrading another required scenario.

## Release decision

- [ ] No known critical regression remains open.
- [ ] Attach or link test evidence in the pull request/release notes.
- [ ] Describe the build as a **preview** until real-world coverage is complete.
- [ ] Do not claim a hard RAM cap or savings percentage without direct measurements on the target workload.

If voice or login tests fail, do not promote the candidate as a usable release. Revert the risky runtime/filter change, or keep it confined to the experimental Tauri branch while retaining the previous Electron build.
