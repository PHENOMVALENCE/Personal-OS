# Security and privacy

## Public repository boundary

Publish source, documentation and fictional/empty examples only. Local configuration, `data/inputs/`, snapshots, history, reports and generated dashboard are ignored. Environment files and common key-file extensions are ignored too. Git ignore rules are a guardrail, not a secret scanner; `git add -f` bypasses them.

Before pushing, inspect `git diff --cached` and `git ls-files`. Never attach real reports, finance entries, contacts, API credentials, or full snapshots to public issues. Previously committed sensitive data must be removed from history as well as the working tree, and exposed credentials rotated.

## What the scanner reads and stores

The scanner records project paths, file size/modification times, Git status and commit subjects. It reads changed text files to extract TODO lines. It does not automatically respect project `.gitignore` files. The configured inventory can include sensitive filenames and metadata. Nested read failures are skipped, so a successful run does not prove full coverage.

Generated output combines project information and personal obligations. Keep it private. The static dashboard has no access control and is not intended for public hosting. Opening a copied dashboard is equivalent to sharing its content.

## External processing

AI is disabled by default. With opt-in plus `OPENAI_API_KEY`, selected project objects, executive summary and urgent actions are sent to the configured API endpoint in `src/core/llm.js`. This can expose paths, TODO excerpts, commit subjects, names and obligations. There is no redaction layer or granular field consent. Offline tests never invoke the API. Review the payload and applicable service terms yourself before enabling it.

## Current boundaries

This is a trusted local, single-user tool. It does not sandbox scanned repositories, implement a credential vault, enforce filesystem permissions, or protect against malicious local files. There is no authentication server, encrypted store, transactional snapshot write, or cross-process lock. Treat the optional language-model summary as advisory; project text can contain misleading instructions.

## Reporting a vulnerability

Do not include secrets in public issues. Use GitHub private vulnerability reporting if the repository offers it; otherwise contact the owner privately through an established channel. Provide affected source paths, reproduction with synthetic data, impact, and suggested mitigation. No response-time or supported-version guarantee is currently published.
