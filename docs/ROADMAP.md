# Roadmap and current limitations

This is a direction for future work, not a claim that the features below exist.

## Reliability

- Validate personal input schemas with actionable field-level errors.
- Propagate CLI failures through PowerShell and suppress misleading success notifications.
- Serialize scans across scheduled tasks and manual commands; write artifacts atomically.
- Make report opening honor custom output directories.
- Add retention policies, structured logs and scan-duration/error metrics.
- Aggregate end-of-day activity across a day rather than only the latest delta.

## Scanning quality

- Support explicit ignored files and project Git ignore rules.
- Offer content hashes when size/mtime comparisons are insufficient.
- Track deleted/renamed projects and improve rename detection.
- Surface partial traversal and Git failures rather than quietly omitting evidence.
- Expand fixture coverage for Git history, exclusions, domain dates and failures.

## Personal inputs

- Add a local editing interface with validation and backup/restore.
- Improve schedule overlap detection for nested and overnight events.
- Surface overdue bills and explicit currencies.
- Add opt-in calendar/inbox integrations with narrow permissions; current inputs remain manual JSON.

## Optional AI

- Verify raw API response parsing and account/model compatibility.
- Add explicit opt-in diagnostics for external request failures without leaking payload content.
- Add configurable redaction rules for names, commit subjects, and obligation text before external processing.
- Track usage and keep generated inferences visibly distinct from measured facts.

## Repository maturity

CI currently checks syntax and a synthetic CLI workflow on Windows/Linux. It does not prove desktop notification behavior, live scheduling, API integration, or all domain edge cases. Licensing remains an owner decision. No release support policy is promised yet.
