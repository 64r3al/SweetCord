param(
    [string[]]$ProcessName = @("SweetCord", "Discord", "Vesktop"),
    [ValidateRange(5, 600)]
    [int]$SampleSeconds = 30,
    [ValidateRange(1, 10)]
    [int]$IntervalSeconds = 2,
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$wantedNames = @($ProcessName | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })

if ($wantedNames.Count -eq 0) {
    throw "Provide at least one process name, e.g. -ProcessName SweetCord,Discord,Vesktop"
}
if ($IntervalSeconds -ge $SampleSeconds) {
    throw "IntervalSeconds must be shorter than SampleSeconds."
}

function Get-ProcessSnapshot {
    param([string[]]$Names)

    $procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $Names -contains $_.ProcessName.ToLowerInvariant()
    })

    $perProcess = foreach ($process in $procs) {
        try {
            [pscustomobject]@{
                Id = [int]$process.Id
                Name = [string]$process.ProcessName
                CPUSeconds = [double]$process.CPU
                WorkingSetBytes = [long]$process.WorkingSet64
                PrivateBytes = [long]$process.PrivateMemorySize64
            }
        } catch {
            # Processes can exit while Windows is enumerating them.
        }
    }

    return @($perProcess)
}

function Get-Median {
    param([double[]]$Values)
    $sorted = @($Values | Sort-Object)
    if ($sorted.Count -eq 0) { return 0.0 }
    $middle = [int][math]::Floor($sorted.Count / 2)
    if (($sorted.Count % 2) -eq 1) { return [double]$sorted[$middle] }
    return ([double]$sorted[$middle - 1] + [double]$sorted[$middle]) / 2.0
}

function Get-Percentile95 {
    param([double[]]$Values)
    $sorted = @($Values | Sort-Object)
    if ($sorted.Count -eq 0) { return 0.0 }
    $index = [int][math]::Ceiling($sorted.Count * 0.95) - 1
    $index = [math]::Max(0, [math]::Min($index, $sorted.Count - 1))
    return [double]$sorted[$index]
}

function Format-MB {
    param([double]$Bytes)
    return [math]::Round($Bytes / 1MB, 1)
}

Write-Host ""
Write-Host "SweetCord resource benchmark" -ForegroundColor Cyan
Write-Host ("Process names: {0}" -f ($wantedNames -join ", "))
Write-Host ("Duration: {0}s · Interval: {1}s · Logical processors: {2}" -f $SampleSeconds, $IntervalSeconds, [Environment]::ProcessorCount)
Write-Host "Keep the PC and app state unchanged throughout this sample."
Write-Host "For a fair comparison, repeat at idle, in a text channel, in a voice call, and while minimized during a call."
Write-Host "GPU counters are not collected by this script; use Task Manager/Process Explorer and include WebView2 child processes for Tauri."
Write-Host ""

$baseline = @(Get-ProcessSnapshot -Names $wantedNames)
$baselineById = @{}
foreach ($item in $baseline) { $baselineById[$item.Id] = $item }
$lastSampleAt = Get-Date
$stopAt = $lastSampleAt.AddSeconds($SampleSeconds)
$samples = [System.Collections.Generic.List[object]]::new()
$logicalProcessors = [math]::Max(1, [Environment]::ProcessorCount)

while ((Get-Date) -lt $stopAt) {
    $remaining = ($stopAt - (Get-Date)).TotalSeconds
    if ($remaining -le 0) { break }
    $sleepMilliseconds = [int][math]::Max(100, [math]::Min($IntervalSeconds * 1000, $remaining * 1000))
    Start-Sleep -Milliseconds $sleepMilliseconds

    $sampleTime = Get-Date
    $elapsed = [math]::Max(0.1, ($sampleTime - $lastSampleAt).TotalSeconds)
    $current = @(Get-ProcessSnapshot -Names $wantedNames)
    $cpuDeltaSeconds = 0.0

    foreach ($item in $current) {
        if ($baselineById.ContainsKey($item.Id)) {
            $delta = $item.CPUSeconds - $baselineById[$item.Id].CPUSeconds
            if ($delta -gt 0) { $cpuDeltaSeconds += $delta }
        }
    }

    $workingSet = [double](($current | Measure-Object -Property WorkingSetBytes -Sum).Sum)
    $privateBytes = [double](($current | Measure-Object -Property PrivateBytes -Sum).Sum)
    $cpuPercent = ($cpuDeltaSeconds / $elapsed / $logicalProcessors) * 100.0

    $samples.Add([pscustomobject]@{
        Timestamp = $sampleTime.ToString("o")
        ElapsedSeconds = [math]::Round(($sampleTime - $stopAt.AddSeconds(-$SampleSeconds)).TotalSeconds, 2)
        ProcessInstances = $current.Count
        WorkingSetMB = [math]::Round($workingSet / 1MB, 1)
        PrivateMB = [math]::Round($privateBytes / 1MB, 1)
        CPUPercent = [math]::Round($cpuPercent, 2)
    })

    $baselineById = @{}
    foreach ($item in $current) { $baselineById[$item.Id] = $item }
    $lastSampleAt = $sampleTime
}

if ($samples.Count -eq 0) {
    throw "No samples collected. Check the process names and try again."
}

$workingSetValues = [double[]]@($samples | ForEach-Object { [double]$_.WorkingSetMB })
$privateValues = [double[]]@($samples | ForEach-Object { [double]$_.PrivateMB })
$cpuValues = [double[]]@($samples | ForEach-Object { [double]$_.CPUPercent })
$instanceValues = [double[]]@($samples | ForEach-Object { [double]$_.ProcessInstances })

$summary = [pscustomobject]@{
    Processes = $wantedNames -join ", "
    SampleSeconds = $SampleSeconds
    IntervalSeconds = $IntervalSeconds
    SampleCount = $samples.Count
    MedianWorkingSetMB = [math]::Round((Get-Median $workingSetValues), 1)
    PeakWorkingSetMB = [math]::Round(($workingSetValues | Measure-Object -Maximum).Maximum, 1)
    MedianPrivateMB = [math]::Round((Get-Median $privateValues), 1)
    PeakPrivateMB = [math]::Round(($privateValues | Measure-Object -Maximum).Maximum, 1)
    MedianCPUPercent = [math]::Round((Get-Median $cpuValues), 2)
    P95CPUPercent = [math]::Round((Get-Percentile95 $cpuValues), 2)
    PeakCPUPercent = [math]::Round(($cpuValues | Measure-Object -Maximum).Maximum, 2)
    PeakProcessInstances = [int](($instanceValues | Measure-Object -Maximum).Maximum)
}

$summary | Format-List

Write-Host "Notes:" -ForegroundColor Yellow
Write-Host "- CPU is averaged across logical processors; it is not a per-core percentage."
Write-Host "- Memory values sum the selected process names only. Add relevant child process names when comparing wrappers."
Write-Host "- Tauri/WebView2 may run renderers under msedgewebview2; broad name matching can include unrelated Edge tabs, so isolate the test machine if possible."
Write-Host "- GPU utilization and dedicated/shared GPU memory are hardware-driver dependent. Record them separately in Task Manager > Details/Performance."
Write-Host "- This script is a short sampler, not a complete Windows profiler; launch and shutdown spikes may need a separate cold-start test."
Write-Host "- No telemetry is uploaded. Samples are only saved when OutputPath is supplied."

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $resolvedPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
    $directory = Split-Path -Parent $resolvedPath
    if (-not [string]::IsNullOrEmpty($directory) -and -not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $samples | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $resolvedPath
    Write-Host ("Samples saved to: {0}" -f $resolvedPath) -ForegroundColor Green
}
