$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node).Source
$monitorScript = Join-Path $projectRoot "scripts\run-monitor.ps1"
$morningScript = Join-Path $projectRoot "scripts\morning-briefing.ps1"
$eodScript = Join-Path $projectRoot "scripts\end-of-day-review.ps1"
$config = Get-Content (Join-Path $projectRoot "config\personal-os.config.json") -Raw | ConvertFrom-Json
$taskPrefix = "PersonalOS"
$userId = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries

$scanAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$monitorScript`""
$morningAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$morningScript`""
$eodAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$eodScript`""

$scanStart = (Get-Date).AddMinutes(5)
$scanTrigger = New-ScheduledTaskTrigger -Once -At $scanStart -RepetitionInterval (New-TimeSpan -Hours 3) -RepetitionDuration (New-TimeSpan -Days 3650)

$morningTrigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Parse($config.schedule.morningBriefingTime))
$eodTrigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Parse($config.schedule.endOfDayReviewTime))

Register-ScheduledTask -TaskName "$taskPrefix-ScanEvery3Hours" -Action $scanAction -Trigger $scanTrigger -Principal $principal -Settings $settings -Description "Runs the Personal OS scan every 3 hours." -Force | Out-Null
Register-ScheduledTask -TaskName "$taskPrefix-MorningBriefing" -Action $morningAction -Trigger $morningTrigger -Principal $principal -Settings $settings -Description "Generates the Personal OS morning briefing." -Force | Out-Null
Register-ScheduledTask -TaskName "$taskPrefix-EndOfDayReview" -Action $eodAction -Trigger $eodTrigger -Principal $principal -Settings $settings -Description "Generates the Personal OS end-of-day review." -Force | Out-Null

Write-Host "Scheduled tasks registered:"
Write-Host "- $taskPrefix-ScanEvery3Hours"
Write-Host "- $taskPrefix-MorningBriefing"
Write-Host "- $taskPrefix-EndOfDayReview"
Write-Host ""
Write-Host "Node executable detected at: $nodePath"
Write-Host "3-hour scan starts at: $scanStart"
Write-Host "Tasks run hidden, show a desktop notification, and open the latest report/dashboard."
