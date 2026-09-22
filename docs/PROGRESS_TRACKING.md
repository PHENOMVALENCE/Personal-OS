# Folder and checklist progress

Personal OS recursively inventories the immediate project folders under `workspaceRoot`. Reports now combine file movement with evidence from Markdown checklists and persistent TODO markers. The same information appears in the command-center project cards.

## What counts as progress

Write ordinary Markdown checkboxes in project documents, for example `docs/ROADMAP.md`:

```markdown
- [x] Create the initial repository
- [ ] Implement the preview
- [ ] Verify access controls
```

A transition from `[ ]` to `[x]` is recorded as a check-off event. The reverse is a reopening. Newly added tasks and removed tasks are reported separately. Removing a task does not complete it. A checked task added in a new document contributes to the current checklist count but is not claimed as a newly completed task.

The percentage is **checked boxes divided by all discovered boxes**, not overall project completion, code quality, or deployment readiness. Multiple documents may repeat the same work and are counted independently. Projects without checklists show no percentage. Code-fenced examples are excluded; instructions found in documents are never executed.

Tasks are identified by document path, exact title and occurrence among duplicate titles. Moving a document or renaming a task appears as removal/addition. Moving line numbers alone preserves identity. Duplicate-title reordering can be ambiguous; use distinct task titles.

## Persistent evidence

The first scan after upgrading captures a checklist baseline without manufacturing completion events. New project folders likewise get their own file baseline. Future scans compare against the prior snapshot by absolute project path.

TODO/FIXME/HACK/XXX extraction includes unchanged eligible text files, using cached per-file evidence when size and modification time match. `maxTodoItemsPerProject` limits the displayed marker sample, while `progress.todoCount` retains the full discovered count. Text eligibility still follows `textExtensions`; include `.md` for checklists.

The default maximum text file size is 524,288 bytes. Override with `progress.maxTextFileBytes` (1,024 through 10,485,760). Larger files remain in file inventory but are skipped for text evidence. Read warnings and skipped-file counts appear in reports. Task-transition claims are withheld if Markdown coverage is incomplete, a relevant read failed, or scan settings changed. Incomplete traversal retains previous inventory entries rather than claiming unreadable files were deleted.

## Folder movement and history

Folder summaries group files by their first two containing path components, with root-level files under `(root)`. They list created, modified and deleted counts. The snapshot contains all groups; reports show the first 15 changed groups and cards the first 10.

Each project retains its last 60 progress observations inside the current snapshot. Reports aggregate today's retained check-off/reopening events and file-change observations using local calendar dates. Repeated edits may count more than once, and more than 60 scans can truncate the day's totals. Historical snapshots continue to be written separately. This is not a unique-files-per-day statistic or a backfill of older reports.

The end-of-day report includes this retained progress summary even when its latest scan is quiet. Its original project-movement section still describes the latest delta. Last observed activity measures file changes seen after tracking starts; a first baseline is not evidence that work happened today.

## Scope and limitations

The current live installation continues to monitor its configured workspace; this feature does not automatically scan all personal folders. Nested folders are traversed within each project, but nested repositories are not promoted into separate project cards. Removed top-level projects are still absent from subsequent snapshots. Git ignore rules, hashing, scan locks and retention cleanup remain separate roadmap items.

The generated dashboard and reports contain local task titles and paths. They remain ignored by Git and should not be published. Scanning reports progress only: it does not modify checkboxes, edit projects, run project code or commit their work.
