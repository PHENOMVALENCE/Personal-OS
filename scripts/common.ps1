$ErrorActionPreference = "Stop"

function Get-PersonalOsRoot {
  return Split-Path -Parent $PSScriptRoot
}

function Get-PersonalOsConfig {
  $root = Get-PersonalOsRoot
  $configPath = Join-Path $root "config\personal-os.config.json"
  return Get-Content $configPath -Raw | ConvertFrom-Json
}

function Show-PersonalOsNotification {
  param (
    [string]$Title,
    [string]$Message
  )

  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.BalloonTipTitle = $Title
    $notify.BalloonTipText = $Message
    $notify.Visible = $true
    $notify.ShowBalloonTip(5000)
    Start-Sleep -Seconds 6
    $notify.Dispose()
  } catch {
    try {
      $shell = New-Object -ComObject WScript.Shell
      [void]$shell.Popup($Message, 8, $Title, 64)
    } catch {
      Write-Warning "Notification could not be displayed: $($_.Exception.Message)"
    }
  }
}

function Open-PersonalOsArtifacts {
  param (
    [bool]$OpenDashboard,
    [bool]$OpenReport,
    [string]$ReportPath
  )

  $root = Get-PersonalOsRoot
  $dashboardPath = Join-Path $root "dashboard\index.html"

  if ($OpenDashboard -and (Test-Path $dashboardPath)) {
    Start-Process $dashboardPath | Out-Null
  }

  if ($OpenReport -and $ReportPath -and (Test-Path $ReportPath)) {
    Start-Process $ReportPath | Out-Null
  }
}

function Invoke-PersonalOsCommand {
  param (
    [ValidateSet("scan", "morning", "eod")]
    [string]$Mode
  )

  $root = Get-PersonalOsRoot
  $config = Get-PersonalOsConfig
  Set-Location $root

  switch ($Mode) {
    "scan" {
      & node "$root\src\cli.js" scan
      $reportPath = Join-Path $root "reports\latest-three-hour.md"
      $notificationTitle = "Personal OS 3-Hour Report"
      $notificationMessage = "Your latest development and accountability report is ready."
    }
    "morning" {
      & node "$root\src\cli.js" morning
      $reportPath = Join-Path $root "reports\latest-morning-briefing.md"
      $notificationTitle = "Personal OS Morning Briefing"
      $notificationMessage = "Today's schedule, deadlines, and priorities are ready."
    }
    "eod" {
      & node "$root\src\cli.js" eod
      $reportPath = Join-Path $root "reports\latest-end-of-day.md"
      $notificationTitle = "Personal OS End-of-Day Review"
      $notificationMessage = "Your end-of-day review and tomorrow priorities are ready."
    }
  }

  if ($config.automation.notificationsEnabled) {
    Show-PersonalOsNotification -Title $notificationTitle -Message $notificationMessage
  }

  Open-PersonalOsArtifacts `
    -OpenDashboard ([bool]$config.automation.autoOpenDashboard) `
    -OpenReport ([bool]$config.automation.autoOpenReports) `
    -ReportPath $reportPath
}

