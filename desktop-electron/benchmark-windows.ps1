param(
    [string[]]$ProcessName = @("SweetCord"),
    [ValidateRange(0, 2147483647)]
    [int]$RootProcessId = 0,
    [bool]$IncludeDescendants = $true,
    [ValidateSet("idle", "text-chat", "voice-call", "minimized-voice-call", "media", "custom")]
    [string]$Scenario = "custom",
    [ValidateRange(5, 600)]
    [int]$SampleSeconds = 30,
    [ValidateRange(1, 10)]
    [int]$IntervalSeconds = 2,
    [string]$OutputPath = "",
    [string]$SummaryPath = ""
)

$ErrorActionPreference = "Stop"
$wantedNames = @($ProcessName | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })

if ($RootProcessId -le 0 -and $wantedNames.Count -eq 0) {
    throw "Provide -RootProcessId for one exact app process, or -ProcessName to match process names."
}
if ($IntervalSeconds -ge $SampleSeconds) {
    throw "IntervalSeconds must be shorter than SampleSeconds."
}

function Get-ProcessSnapshot {
    param(
        [string[]]$Names,
        [int]$RootProcessId,
        [bool]$IncludeDescendants
    )

    # Query parent/child relationships so WebView2/Chromium helper processes
    # are counted with the selected application instead of mixing in every
    # unrelated msedgewebview2.exe process on the PC.
    try {
        $metadata = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop |
            Select-Object ProcessId, ParentProcessId, Name)
    } catch {
        throw ("Could not enumerate the Windows process tree: {0}" -f $_.Exception.Message)
    }

    $rootIds = [System.Collections.Generic.HashSet[int]]::new()
    if ($RootProcessId -gt 0) {
        $rootEntry = $metadata | Where-Object { [int]$_.ProcessId -eq $RootProcessId } | Select-Object -First 1
        if ($null -ne $rootEntry) {
            [void]$rootIds.Add([int]$RootProcessId)
        }
    } else {
        foreach ($item in $metadata) {
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension([string]$item.Name).ToLowerInvariant()
            if ($Names -contains $baseName) {
                [void]$rootIds.Add([int]$item.ProcessId)
            }
        }
    }

    if ($rootIds.Count -eq 0) {
        return @()
    }

    $targetIds = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($rootId in $rootIds) { [void]$targetIds.Add([int]$rootId) }

    if ($IncludeDescendants) {
        $changed = $true
        while ($changed) {
            $changed = $false
            foreach ($item in $metadata) {
                $processId = [int]$item.ProcessId
                $parentId = [int]$item.ParentProcessId
                if ($targetIds.Contains($parentId) -and -not $targetIds.Contains($processId)) {
                    [void]$targetIds.Add($processId)
                    $changed = $true
                }
            }
        }
    }

    $metadataById = @{}
    foreach ($item in $metadata) { $metadataById[[int]$item.ProcessId] = $item }
    $targetPidArray = @($targetIds | ForEach-Object { [int]$_ })
    $procs = @(Get-Process -Id $targetPidArray -ErrorAction SilentlyContinue)

    $perProcess = foreach ($process in $procs) {
        try {
            $parentId = 0
            if ($metadataById.ContainsKey([int]$process.Id)) {
                $parentId = [int]$metadataById[[int]$process.Id].ParentProcessId
            }
            [pscustomobject]@{
                Id = [int]$process.Id
                ParentProcessId = $parentId
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
if ($RootProcessId -gt 0) {
    Write-Host ("Exact root PID: {0}" -f $RootProcessId)
    Write-Host "ProcessName matching is ignored because an exact root PID was supplied."
} else {
    Write-Host ("Root process name match: {0}" -f ($wantedNames -join ", "))
    Write-Host "Name mode can include more than one app instance with the same executable name; prefer -RootProcessId for controlled comparisons."
}
Write-Host ("Scenario: {0}" -f $Scenario)
Write-Host ("Include descendant processes: {0}" -f $IncludeDescendants)
Write-Host ("Duration: {0}s · Interval: {1}s · Logical processors: {2}" -f $SampleSeconds, $IntervalSeconds, [Environment]::ProcessorCount)
Write-Host "Keep the PC and app state unchanged throughout this sample."
Write-Host "For a fair comparison, repeat at idle, in a text channel, in a voice call, and while minimized during a call."
Write-Host "GPU counters are not collected by this script; use Task Manager > Details and enable GPU + GPU engine columns."
Write-Host "This sampler follows process descendants, which helps include Electron helpers or WebView2 renderers without counting unrelated Edge tabs."
Write-Host ""

$baseline = @(Get-ProcessSnapshot -Names $wantedNames -RootProcessId $RootProcessId -IncludeDescendants $IncludeDescendants)
if ($baseline.Count -eq 0) {
    if ($RootProcessId -gt 0) {
        throw ("No running process found for root PID {0}. Recheck Task Manager > Details and pass the main app process PID." -f $RootProcessId)
    }
    throw ("No matching root process found for: {0}. Start the app first and pass its executable name without .exe." -f ($wantedNames -join ", "))
}
if ($RootProcessId -gt 0) {
    $rootProcessDescription = [string](($baseline | Where-Object { $_.Id -eq $RootProcessId } | Select-Object -First 1).Name)
    if ([string]::IsNullOrWhiteSpace($rootProcessDescription)) {
        throw ("PID {0} was found in the tree query but could not be sampled as the root process." -f $RootProcessId)
    }
} else {
    $rootProcessDescription = "process-name match: " + ($wantedNames -join ", ")
}
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
    $current = @(Get-ProcessSnapshot -Names $wantedNames -RootProcessId $RootProcessId -IncludeDescendants $IncludeDescendants)
    if ($current.Count -eq 0) {
        throw "The target process tree disappeared during sampling. The app may have closed or restarted; discard this run and repeat."
    }
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

$rootSelectionMode = if ($RootProcessId -gt 0) { "exact-pid" } else { "process-name" }
$summaryRootProcessId = if ($RootProcessId -gt 0) { $RootProcessId } else { $null }
$summary = [pscustomobject]@{
    Processes = $wantedNames -join ", "
    RootSelectionMode = $rootSelectionMode
    RootProcessId = $summaryRootProcessId
    RootProcessDescription = $rootProcessDescription
    Scenario = $Scenario
    IncludeDescendants = $IncludeDescendants
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
Write-Host "- Memory values sum the selected root process(es) and descendants when IncludeDescendants is true."
Write-Host "- Prefer -RootProcessId to isolate one app root; ProcessName mode can aggregate multiple instances with the same name."
Write-Host "- Compare one application at a time. The sampler does not automatically control unrelated programs that share a root name."
Write-Host "- Child processes are included by parent PID; a helper that deliberately detaches from the application process tree may still be missed."
Write-Host "- GPU utilization and dedicated/shared GPU memory are hardware-driver dependent. Record them separately in Task Manager > Details/Performance."
Write-Host "- This script is a short sampler, not a complete Windows profiler; launch and shutdown spikes may need a separate cold-start test."
Write-Host "- No telemetry is uploaded. Samples are only saved when OutputPath is supplied."

$resolvedCsvPath = $null
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $resolvedCsvPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
    $directory = Split-Path -Parent $resolvedCsvPath
    if (-not [string]::IsNullOrEmpty($directory) -and -not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $samples | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $resolvedCsvPath
    Write-Host ("Samples saved to: {0}" -f $resolvedCsvPath) -ForegroundColor Green
}

if (-not [string]::IsNullOrWhiteSpace($SummaryPath)) {
    $osInfo = $null
    $computerInfo = $null
    $cpuInfo = $null
    try { $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop } catch {}
    try { $computerInfo = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop } catch {}
    try { $cpuInfo = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Select-Object -First 1 } catch {}

    $osName = if ($osInfo) { [string]$osInfo.Caption } else { $null }
    $osVersion = if ($osInfo) { [string]$osInfo.Version } else { $null }
    $osBuild = if ($osInfo) { [string]$osInfo.BuildNumber } else { $null }
    $computerModel = if ($computerInfo) { [string]$computerInfo.Model } else { $null }
    $cpuName = if ($cpuInfo) { [string]$cpuInfo.Name } else { $null }
    $installedRamGB = if ($computerInfo) { [math]::Round([double]$computerInfo.TotalPhysicalMemory / 1GB, 2) } else { $null }
    $environment = [pscustomobject]@{
        OSName = $osName
        OSVersion = $osVersion
        OSBuild = $osBuild
        ComputerModel = $computerModel
        CPUName = $cpuName
        LogicalProcessors = [Environment]::ProcessorCount
        InstalledRAMGB = $installedRamGB
        PowerShellVersion = [string]$PSVersionTable.PSVersion
    }

    $report = [ordered]@{
        schemaVersion = 1
        generatedAt = (Get-Date).ToString("o")
        environment = $environment
        summary = $summary
        rawSamples = @($samples)
        csvPath = $resolvedCsvPath
        privacy = "Saved locally by this script; no telemetry is uploaded."
    }
    $resolvedSummaryPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($SummaryPath)
    $summaryDirectory = Split-Path -Parent $resolvedSummaryPath
    if (-not [string]::IsNullOrEmpty($summaryDirectory) -and -not (Test-Path $summaryDirectory)) {
        New-Item -ItemType Directory -Path $summaryDirectory -Force | Out-Null
    }
    $report | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -Path $resolvedSummaryPath
    Write-Host ("Machine metadata and summary saved to: {0}" -f $resolvedSummaryPath) -ForegroundColor Green
}
