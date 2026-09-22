# Configuration reference

The runtime reads `config/personal-os.config.json` relative to the installation directory. Run `npm run setup` to create it from `config/personal-os.config.example.json`. The local file is ignored by Git. JSON must have quoted keys and cannot contain comments or trailing commas. Startup validates required paths, array fields, scan limits, timing values, and the configured workspace before scanning.

| Field | Meaning |
| --- | --- |
| `workspaceRoot` | Existing parent directory whose immediate child directories are projects. Relative paths resolve from the Personal OS installation root. |
| `stateDir` | Latest scan snapshot directory; relative paths resolve from the installation root. |
| `historyDir` | Timestamped complete scan snapshots; relative to installation root. |
| `reportsDir` | Timestamped and latest Markdown reports; relative to installation root. |
| `dashboardDir` | Static `index.html` and `latest.json`; relative to installation root. |
| `maxTodoItemsPerProject` | Maximum changed-file TODO markers retained per project. Default example: 12. |
| `scanWindowHours` | Report metadata describing the monitoring window. Does not set the scheduler interval or filter file changes by age. |
| `excludeProjects` | Exact immediate child directory names to omit. |
| `ignoredDirectories` | Case-insensitive directory names/path prefixes omitted during traversal. |
| `ignoredExtensions` | File extensions omitted from inventory. Extension comparison uses lowercase names. |
| `textExtensions` | Case-insensitive suffixes eligible for TODO/FIXME/HACK/XXX extraction from changed files, including multi-part suffixes such as `.blade.php`. |
| `schedule.morningBriefingTime` | Local Windows time used when registering the morning task, e.g. `07:00`. |
| `schedule.endOfDayReviewTime` | Local Windows time used when registering the evening task, e.g. `21:00`. |
| `automation.notificationsEnabled` | Display a notification from PowerShell wrappers. |
| `automation.autoOpenDashboard` | Open the dashboard after a scheduled/wrapper run. |
| `automation.autoOpenReports` | Open the corresponding latest Markdown report after a wrapper run. |
| `ai.enabled` | Opt into the optional external summary request. Default false. |
| `ai.model` | Model identifier sent to the external API; example value is not a guarantee of account availability. |
| `ai.timeoutMs` | Maximum duration for an optional AI request. Must be 1,000–120,000 ms; the example uses 12,000 ms. |

## Timing and paths

The scan task repeats every three hours as hard-coded in `scripts/register-tasks.ps1`; its first run is five minutes after registration and its repetition duration is 3,650 days. Changing `scanWindowHours` alone changes neither that schedule nor the comparison baseline. Morning/evening time changes take effect after re-registering tasks.

Node reporting respects configured output directories. The PowerShell notification/opening helper currently expects default `reports/` and `dashboard/` locations. Retain those defaults when using automatic opening. Dates are displayed using the host's local timezone and an `en-GB` formatter; snapshots store ISO timestamps.

## Optional AI

The source checks both `ai.enabled` and `OPENAI_API_KEY`. It does not load `.env` files. For a manual session, set the environment variable outside source control; scheduled processes must inherit the variable in their own environment. Never paste credentials into configuration or issue reports.

The request includes the executive summary, urgent actions, and reduced summaries for up to five projects. Reduced project summaries include names, file-count totals, changed-area labels, branch names, uncommitted-change counts, recent commit subjects, TODO counts, and limited inference text. Full file inventories and absolute project paths are not sent by this path. Urgent actions can still include personal names and obligations. Read [privacy boundaries](../SECURITY.md) before enabling this.

Failures fall back to a local summary. Requests use the configured timeout and the response reader accepts both the convenience `output_text` field and nested output-text content. There is no retry policy or usage tracking yet. Local deterministic reports remain the supported default.
