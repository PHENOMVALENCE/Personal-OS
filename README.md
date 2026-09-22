# Personal OS

[![Checks](https://github.com/PHENOMVALENCE/Personal-OS/actions/workflows/ci.yml/badge.svg)](https://github.com/PHENOMVALENCE/Personal-OS/actions/workflows/ci.yml)

A local personal operating system that turns software-project activity and manually maintained life inputs into executive reports, daily briefings, and a browser dashboard.

Built with dependency-free Node.js modules and Windows PowerShell automation. Your project files remain on your computer. Optional AI summaries are disabled by default; enabling them sends selected monitoring data to an external API.

## Current capabilities

- Inventory immediate child projects in one workspace and compare file size/modification times between scans.
- Read local Git branches, working-tree status, and recent commits.
- Categorize changed files and surface TODO/FIXME/HACK/XXX markers in changed text files.
- Summarize schedule, academics, communications, responsibilities, bills, and goals from local JSON inputs.
- Generate a three-hour executive report, morning briefing, end-of-day review, and static HTML dashboard.
- Run through Windows Task Scheduler every three hours, with optional desktop notifications and automatic report opening.

This is an early local tool. Feature/fix descriptions are heuristic signals, not verified delivery claims. Gmail, Calendar, WhatsApp, and GitHub service integrations are not implemented. Git inspection uses your local repositories.

## Quick start

Install Node.js 22 or newer and Git. Scheduling requires Windows and PowerShell; the CLI is checked on Windows and Linux.

```powershell
git clone https://github.com/PHENOMVALENCE/Personal-OS.git
cd Personal-OS
npm run setup
```

Edit `config/personal-os.config.json` and set `workspaceRoot` to an existing directory containing your projects, for example `C:\Projects`. The scanner treats each immediate child directory as a project. Setup creates empty private input files and never overwrites existing configuration or inputs.

```powershell
npm run scan
```

Open `dashboard/index.html` in your browser and read `reports/latest-three-hour.md`. The first scan captures a baseline; subsequent scans report changes. No package installation is required because there are no third-party runtime dependencies.

To enable recurring Windows runs after a successful manual scan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-tasks.ps1
```

This registers or replaces three tasks named `PersonalOS-*` for the current interactive user. Read [operations](docs/OPERATIONS.md) before changing an existing installation.

## Commands

| Command | Result |
| --- | --- |
| `npm run setup` | Create missing local configuration and empty inputs |
| `npm run scan` | Scan, save snapshot/history, generate executive report and dashboard |
| `npm run briefing:morning` | Scan and also write morning briefing |
| `npm run briefing:eod` | Scan and also write end-of-day review |
| `npm run dashboard` | Perform a new scan and regenerate dashboard/report |
| `npm run report:all` | Scan once and produce all three reports |
| `npm run check` | Parse JavaScript source, scripts, and tests |
| `npm test` | Exercise setup and CLI in a temporary synthetic workspace |

## Documentation

- [Installation and first run](docs/GETTING_STARTED.md)
- [Configuration reference](docs/CONFIGURATION.md)
- [Input formats and fictional examples](docs/INPUTS.md)
- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Scheduling, backups, and troubleshooting](docs/OPERATIONS.md)
- [Privacy and security boundaries](SECURITY.md)
- [Contributing and validation](CONTRIBUTING.md)
- [Known limitations and roadmap](docs/ROADMAP.md)
- [Change history](CHANGELOG.md)

## Repository layout

```text
src/cli.js                  command dispatcher
src/core/                   scanning, domain summaries, reports, utilities
scripts/                    setup, checks, Windows scheduling and notifications
config/*.example.json       public configuration template
examples/inputs/            empty public input templates
tests/                      isolated workflow verification
docs/                       user and developer documentation
.github/                    CI and contribution templates
```

Local configuration, personal inputs, generated reports, dashboard, and snapshots are ignored by Git. Do not force-add them. See [SECURITY.md](SECURITY.md) for what reports and optional AI requests can contain.

## License

No open-source license has been granted in this repository yet. A public repository does not itself grant general reuse rights; licensing is an owner decision.
