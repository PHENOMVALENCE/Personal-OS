# Contributing

## Development

Use Node.js 22+ and Git. Run `npm run setup` for local use, configure your workspace, and keep personal inputs private. There are no third-party dependencies to install. Tests create their own isolated checkout and need no local setup.

Before submitting:

```powershell
npm run check
npm test
git diff --check
git status --short
```

The workflow test verifies non-overwriting setup, baseline capture, created/modified/deleted file detection, changed-file TODO extraction, all CLI report modes, dashboard output, and nonzero exit for unknown commands. GitHub Actions runs this on Windows/Linux and Node 22/24, plus PowerShell syntax parsing. Add focused tests for behavior changes, especially failure paths; do not run tests against real personal inputs.

## Small commits

Keep one purpose per commit. Separate scanner behavior, Windows integration, tests and documentation when they can be reviewed independently. Suggested prefixes are `feat:`, `fix:`, `docs:`, `test:` and `build:`. Use a topic branch and a pull request for follow-up work. Do not rewrite shared history without coordinating with the owner.

Explain the concrete problem, resulting behavior, and verification in each pull request. Update the relevant configuration/input/operations reference when behavior changes. State remaining limitations. Do not describe a heuristic inference as verified project completion.

## Public-data review

Review staged files with `git diff --cached` and `git diff --cached --name-only`. Only synthetic fixtures belong in tests and examples. Never force-add ignored inputs, local config, reports, dashboard snapshots or credentials. Report security issues privately as described in [SECURITY.md](SECURITY.md).

## Design conventions

Use ES modules and built-in Node APIs where practical. Keep filesystem traversal in project scanning, personal input processing in domains, and rendering in reporting. Prefer explicit configuration and preserve local data during setup or migration. Avoid network requests in automated tests. PowerShell changes should be parsed on Windows and tested with a disposable installation before replacing live task registrations.

## Licensing

There is currently no license granting general reuse. Discuss licensing with the repository owner before redistributing the project or introducing third-party code with additional obligations.
