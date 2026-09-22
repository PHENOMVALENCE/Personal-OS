# Operations and troubleshooting

## Registered Windows tasks

| Task | Trigger | Script |
| --- | --- | --- |
| `PersonalOS-ScanEvery3Hours` | Five minutes after registration, then every 3 hours | `scripts/run-monitor.ps1` |
| `PersonalOS-MorningBriefing` | Daily at configured morning time (example 07:00) | `scripts/morning-briefing.ps1` |
| `PersonalOS-EndOfDayReview` | Daily at configured evening time (example 21:00) | `scripts/end-of-day-review.ps1` |

Tasks use a limited-privilege interactive-user principal and hidden PowerShell windows. The user must be signed in; this is not an always-on server. Registration enables StartWhenAvailable and allows starting on battery, but does not wake a sleeping computer. Missed runs depend on Windows availability. Repetition is configured for 3,650 days. Registration uses `-Force` and replaces same-named tasks; multiple installations will conflict on those names.

Run registration from the installation you intend to keep:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-tasks.ps1
```

The wrapper invokes `node` through PATH, even though registration prints a detected Node path. Ensure the scheduled user's environment can resolve Node. Notifications and automatic opening are controlled by the local configuration. Wrapper output paths currently assume the default directories.

## Inspect task health

```powershell
Get-ScheduledTask -TaskName 'PersonalOS-*' | Select-Object TaskName, State
Get-ScheduledTask -TaskName 'PersonalOS-*' | Get-ScheduledTaskInfo |
  Select-Object LastRunTime, NextRunTime, LastTaskResult
```

Also inspect report timestamps. The current PowerShell wrapper does not propagate a nonzero Node exit code explicitly, so Task Scheduler result zero alone does not prove report generation succeeded. Run `npm run scan` manually to see an underlying error. A future improvement should prevent success notifications after a failed CLI run.

## Pause, resume or remove scheduling

```powershell
Get-ScheduledTask -TaskName 'PersonalOS-*' | Disable-ScheduledTask
Get-ScheduledTask -TaskName 'PersonalOS-*' | Enable-ScheduledTask
```

To remove registrations, run the following only when you intend to stop recurring execution. It leaves configuration, code and reports on disk:

```powershell
Get-ScheduledTask -TaskName 'PersonalOS-*' | Unregister-ScheduledTask
```

Do not manually launch scans concurrently with scheduled scans. There is no shared lock across task names or manual invocations.

## Output and backups

| Path | Contents |
| --- | --- |
| `data/state/latest-snapshot.json` | Current comparison baseline and full scan result |
| `data/history/scan-*.json` | Timestamped full scan results |
| `reports/latest-three-hour.md` | Most recent executive report |
| `reports/latest-morning-briefing.md` | Most recent morning briefing |
| `reports/latest-end-of-day.md` | Most recent evening review |
| `reports/*-<timestamp>.md` | Historical reports |
| `dashboard/index.html` | Latest static dashboard |
| `dashboard/latest.json` | Latest full scan result |

There is no automatic retention or backup. Back up `config/personal-os.config.json`, `data/inputs/`, and `data/state/` to a private location. Preserve history/reports if needed for your records. Avoid public cloud shares. Pause tasks before moving or restoring state so snapshots remain consistent.

To deliberately reset comparison history, pause tasks and move `latest-snapshot.json` to a private backup location, then run a new scan. The next scan will be a baseline. Deleting historical reports alone does not reset the baseline. Do not remove directories through an unreviewed wildcard command.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| Config file not found | Run `npm run setup`, then edit `workspaceRoot`. |
| ENOENT or access denied on workspace | Verify the root exists and the current account can read it. |
| Empty personal sections | Validate JSON and root keys; check dates/status values. |
| No file changes after edits | Check exclusions; comparison uses size and modification time; another command may already have advanced the baseline. |
| End-of-day report is quiet | It reflects the latest delta, not an aggregate of the whole day. |
| Dashboard looks stale | Check generated timestamp and refresh/reopen the static file. |
| Task ready but no new reports | Run the CLI manually; check PATH, signed-in account and Scheduler history. |
| AI summary absent | Confirm opt-in and environment availability; errors and unsupported response shapes fall back silently. |
| Reports grow continuously | Archive older outputs privately; no retention job exists yet. |

## Updates

Review changes before pulling into a running installation. Preserve ignored local files; never use `git clean -fdx` as an update procedure because it can delete private runtime data. Run the checks after updating. Re-register only if paths or scheduling settings change. Public CI verifies synthetic behavior, not your live inputs, Windows notification display, or API account access.
