# Changelog

## Unreleased

### Operational intelligence and reporting

- Added a normalized cross-domain action engine with critical/high/medium/low prioritization, reasons, and suggested next actions.
- Added deterministic project-health snapshots driven by project movement, working-tree pressure, TODO markers, rename signals, and commit recency.
- Added a Waiting On queue for communications that depend on another person or party.
- Rebuilt the local dashboard as a responsive command center with action filtering, project-health cards, timeline, deadlines, and waiting-on visibility.
- Restructured executive, morning, and end-of-day reports around decisions and next actions rather than raw scan output.
- Added tests for action prioritization and command-center output.

### Reliability and polish

- Added actionable startup validation for configuration and workspace paths.
- Made project ordering deterministic, fixed exact/path-prefix directory exclusions, skipped symbolic links, and wired TODO scanning to configured text extensions.
- Added bounded optional AI requests with resilient response parsing and reduced project payloads that omit full inventories and absolute paths.
- Expanded workflow tests for nested exclusions and configurable text scanning.
- Reworked the public README to present architecture, privacy boundaries, commands, limitations, and project status more clearly.


## 0.1.0 — initial repository publication

### Existing application imported

- Local project inventory and change comparisons, Git activity, and heuristic progress signals.
- Personal-domain JSON summaries and priority recommendations.
- Executive reports, morning/evening briefings, and a static local dashboard.
- Windows three-hour scan and daily briefing registration.
- Optional external AI summary integration, disabled by default.

### Repository setup

- Private runtime files excluded from version control; empty public input templates and example configuration.
- Non-overwriting setup command for fresh and existing installations.
- JavaScript checks and isolated CLI workflow verification.
- Windows/Linux CI on Node.js 22 and 24, including PowerShell syntax validation.
- Installation, configuration, architecture, inputs, operations, security, contribution and roadmap documentation.
- Issue and pull-request templates for reproducible, privacy-conscious contributions.

The import preserves existing application behavior. Known limitations are documented in the roadmap; publication does not imply those limitations have been fixed.

## Folder progress update

- Retain TODO evidence across quiet scans and track Markdown checklist transitions.
- Show folder movement, explicit completion/reopening, outstanding tasks and retained daily observations in reports and project cards.
- Cache text signals and bound text reads; expose incomplete coverage and suppress unreliable transitions.
- Match project baselines by path and baseline newly discovered projects.
