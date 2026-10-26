# SweetCord performance baseline procedure

The goal is to compare candidates fairly before optimization. This procedure measures local Windows process-tree metrics; it does not collect application message content or upload telemetry.

## 1. Prepare Windows

1. Reboot or close unrelated high-load applications when practical.
2. Use the same Windows power mode for every run. Record whether the computer is plugged in.
3. Decide which app build/version and workload will be tested.
4. Open **Task Manager → Details** and enable the PID column. Identify the main process for the application you are measuring.
5. Close other instances of the same application where practical. Do not compare a run that includes multiple app instances with a run that includes only one.
6. Let the app settle for about three minutes before the idle sample.

For a quick process listing in PowerShell:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match '^(SweetCord|Discord|msedge|chrome)\.exe$' } |
  Select-Object ProcessId, ParentProcessId, Name
```

Choose the **main app process** PID, not a helper/renderer PID. If you cannot identify it confidently, record that fact and use the name-matching mode only as a rough diagnostic. Browser benchmarks are harder to isolate because one browser process tree can contain other tabs and shared helper processes.

## 2. Run a sample

From the repository root, substitute the real main-process PID and use a different output filename for every scenario/run.

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -RootProcessId 1234 -Scenario idle -SampleSeconds 60 -IntervalSeconds 2 -OutputPath .\benchmarks\sweetcord-idle-run1.csv -SummaryPath .\benchmarks\sweetcord-idle-run1.json
```

The script includes descendant processes by default. That is important for Electron/Chromium helper processes. Exact-PID mode prevents the script from automatically selecting every root process with the same executable name. The selected process must remain running for the full sample.

To use process-name matching instead:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-electron\benchmark-windows.ps1 -ProcessName Discord -Scenario idle -SampleSeconds 60 -IntervalSeconds 2 -OutputPath .\benchmarks\discord-idle-run1.csv -SummaryPath .\benchmarks\discord-idle-run1.json
```

**Warning:** name mode can include multiple application instances with the same executable name. Prefer PID mode for an apples-to-apples comparison.

## 3. Required scenarios

Run three repetitions for every candidate you can reasonably test. Save unique CSV and JSON files.

- `idle`: after the app has settled; do not interact during the 60-second measurement.
- `text-chat`: open the same type of text channel/conversation and scroll at a consistent pace.
- `media`: use the same image/GIF-rich channel or conversation, if media is part of the supported test.
- `voice-call`: join the same microphone-only call with the same input/output devices and settings, if voice is supported.
- `minimized-voice-call`: maintain the call and minimize the app during the sample, if supported.
- `custom`: use for an explicitly described non-standard workload.

Do not treat text chat, media, voice, and idle as interchangeable results. Compare the same scenario and settings across candidates. Do not benchmark voice if the build does not legitimately support it.

## 4. What the report contains

The CSV contains time-series samples:

- working set (MB)
- private memory (MB)
- CPU percent normalized across logical processors
- process count
- sample timestamps and elapsed time

The JSON summary stores medians and peaks, scenario/configuration, raw samples, and basic machine metadata: Windows version/build, CPU name/model, logical processor count, installed RAM, and PowerShell version. It is saved only to the path supplied to the script. Review the report before sharing it; remove any machine metadata you do not wish to publish.

The script does not collect GPU counters. While repeating the exact same workload, also record Task Manager GPU utilization, GPU engine and dedicated/shared GPU memory manually if relevant.

### Interpretation notes

- Working set approximates resident memory and can overcount shared physical pages when summed across processes.
- Private bytes are useful alongside working set, but neither is a guarantee of total system RAM use.
- CPU is an aggregate normalized across logical processors; it is not equivalent to the per-core value shown by every monitoring tool.
- Startup time should be measured separately (launch to a usable conversation list), because the periodic sampler does not capture every cold-start spike.
- A process restart or a changed workload invalidates a run. Discard it and repeat.
- Compare three-run medians and note peaks. A one-off low number is not a reliable improvement.

## 5. Record a comparison table

Copy the result into a local spreadsheet or a PR comment in this format:

| App/build | Scenario | Run | Median private MB | Peak private MB | Median working set MB | Peak working set MB | Median CPU % | P95 CPU % | Peak processes | GPU notes |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Example build | idle | 1 | — | — | — | — | — | — | — | — |

Also record the test date, Windows build, CPU/RAM/GPU, monitor resolution, power mode, app version, and whether other clients/tabs were open.

**Do not claim an improvement until repeated runs show a consistent change and the same essential workflows remain usable.** The 200 MB goal is not validated until the chosen architecture is benchmarked this way.
