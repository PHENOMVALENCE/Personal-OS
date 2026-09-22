# Installation and first run

## Requirements

Use Node.js 22+ and Git on PATH. Windows Task Scheduler integration requires Windows PowerShell 5.1 or later and an interactive signed-in account. Node's built-in filesystem, child-process, HTTP, and test APIs provide all runtime functionality. There is no server, database service, npm dependency installation, or cloud account required for local reporting.

Check the tools:

```powershell
node --version
git --version
```

## Set up a checkout

1. Clone the repository to a stable folder. Scheduled tasks will reference this location.
2. Run `npm run setup`. This copies the configuration example and six empty input templates only when the destination does not exist.
3. Edit `config/personal-os.config.json`. Set `workspaceRoot` to the parent directory of the projects you want to monitor. Use escaped backslashes in JSON (`"C:\\Projects"`) or forward slashes (`"C:/Projects"`).
4. Review exclusions before the first scan. The scanner does not apply each project's `.gitignore` rules.
5. Run `npm run scan` and inspect the generated report and dashboard.
6. Add personal entries to `data/inputs/*.json` using the [input reference](INPUTS.md).
7. Run `npm run report:all` to review all output types.
8. Optionally register the Windows tasks as described in [operations](OPERATIONS.md).

The example disables notification and automatic opening settings. Turn them on individually when you want those desktop effects. Direct npm commands do not send notifications; the PowerShell wrappers do.

## Understand the first two runs

With no readable `data/state/latest-snapshot.json`, the first scan inventories existing files without labeling them all as newly created. It records up to five recent Git commits per repository for context. Change a sample project file and scan again to see the delta. Each command that scans advances the baseline, including `dashboard`, `morning`, and `eod`.

Keep the dashboard local. It is a generated static file, not a hosted website or an authenticated application. Refresh the browser after a new scan.

## Existing installations

Run setup safely against an existing checkout: existing configuration and input files are preserved. Generated history is also untouched. Do not copy example files over your live files manually unless you intend to replace their contents.

Updating the code does not require re-registering tasks when the installation path and schedule stay the same. Moving the checkout requires re-registering tasks, which replaces the existing `PersonalOS-*` registrations. Keep private input files and state when migrating; they are deliberately absent from GitHub.

## Verification

```powershell
npm run check
npm test
```

Tests copy public source and templates into a temporary directory and create a synthetic project. They do not scan the configured real workspace, make AI requests, or register scheduled tasks. GitHub Actions runs these checks on Node.js 22 and 24, on Windows and Linux, and parses PowerShell scripts for syntax errors.
