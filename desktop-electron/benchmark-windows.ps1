param(
    [string[]]$ProcessName = @("SweetCord", "Discord", "Vesktop"),
    [ValidateRange(5, 300)]
    [int]$SampleSeconds = 30
)

$ErrorActionPreference = "Stop"
$wantedNames = @($ProcessName | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })

if ($wantedNames.Count -eq 0) {
    throw "Provide at least one process name, e.g. -ProcessName SweetCord,Discord,Vesktop"
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

function Format-MB {
    param([long]$Bytes)
    return [math]::Round($Bytes / 1MB, 1)
}

Write-Host ""
Write-Host "SweetCord resource comparison" -ForegroundColor Cyan
Write-Host ("Processes: {0}" -f ($wantedNames -join ", "))
Write-Host ("Sampling for {0} seconds. Keep the PC in the same state during the test." -f $SampleSeconds)
Write-Host "For a fair comparison, repeat the test at idle, in a text chat, and in the same active call."
Write-Host ""

$beforeTime = Get-Date
$before = @(Get-ProcessSnapshot -Names $wantedNames)
Start-Sleep -Seconds $SampleSeconds
$afterTime = Get-Date
$after = @(Get-ProcessSnapshot -Names $wantedNames)
$elapsed = [math]::Max(1, ($afterTime - $beforeTime).TotalSeconds)

$beforeById = @{}
foreach ($item in $before) { $beforeById[$item.Id] = $item }

$results = foreach ($name in $wantedNames) {
    $current = @($after | Where-Object { $_.Name.ToLowerInvariant() -eq $name })
    if ($current.Count -eq 0) {
        [pscustomobject]@{
            Process = $name
            Instances = 0
            WorkingSetMB = "not running"
            PrivateMB = "not running"
            CPUPercent = "not running"
        }
        continue
    }

    $currentIds = @{}
    foreach ($item in $current) { $currentIds[$item.Id] = $true }

    $workingSet = [long](($current | Measure-Object -Property WorkingSetBytes -Sum).Sum)
    $privateBytes = [long](($current | Measure-Object -Property PrivateBytes -Sum).Sum)
    $cpuDelta = 0.0

    foreach ($item in $current) {
        if ($beforeById.ContainsKey($item.Id)) {
            $delta = $item.CPUSeconds - $beforeById[$item.Id].CPUSeconds
            if ($delta -gt 0) { $cpuDelta += $delta }
        } else {
            # A process launched mid-sample has no baseline; its accumulated CPU
            # time is the best available estimate for this interval.
            if ($item.CPUSeconds -gt 0) { $cpuDelta += $item.CPUSeconds }
        }
    }

    $cpuPercent = ($cpuDelta / $elapsed / [Environment]::ProcessorCount) * 100

    [pscustomobject]@{
        Process = $name
        Instances = $current.Count
        WorkingSetMB = Format-MB $workingSet
        PrivateMB = Format-MB $privateBytes
        CPUPercent = [math]::Round($cpuPercent, 1)
    }
}

$results | Format-Table -AutoSize

Write-Host ""
Write-Host "Notes:" -ForegroundColor Yellow
Write-Host "- Working Set is resident memory; Private MB is private committed memory. They are different metrics."
Write-Host "- CPU percent is averaged across logical processors for the sampling interval; brief spikes can be smoothed out."
Write-Host "- Processes that exit during the sample can make the CPU estimate slightly low."
Write-Host "- For GPU, open Task Manager > Details, enable the GPU and GPU engine columns, and compare during the same scenario."
Write-Host "- This script measures the local machine; it does not upload or save process data."
Write-Host ""
