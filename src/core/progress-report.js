export function progressSummary(progress) {
  if (!progress) return "Progress baseline not yet captured";
  const checklist = progress.totalTasks
    ? `${progress.completedTasks}/${progress.totalTasks} documented tasks checked (${progress.checklistPercent}%)`
    : "No documented checklist found";
  return `${checklist}; ${progress.todoCount} TODO markers${progress.complete ? "" : "; partial text coverage"}`;
}

export function buildProgressReport(projects, generatedAt) {
  const today = new Date(generatedAt).toDateString();
  return projects.map((project) => {
    const p = project.progress;
    if (!p) return "";
    const daily = p.history.filter((point) => new Date(point.at).toDateString() === today);
    const completed = daily.reduce((sum, point) => sum + point.completed, 0);
    const reopened = daily.reduce((sum, point) => sum + point.reopened, 0);
    const changed = daily.reduce((sum, point) => sum + point.changedFiles, 0);
    const tasks = (items) => items.slice(0, 12).map((task) => `- ${safe(task.title)} — ${safe(task.file)}:${task.line}`).join("\n") || "- None recorded.";
    const folders = p.folders.filter((folder) => folder.created + folder.modified + folder.deleted > 0);
    return `### ${safe(project.name)} — folder progress

- ${progressSummary(p)}. This measures checkboxes, not overall project completion.
- Today in retained history: ${completed} check-off event(s), ${reopened} reopening(s), ${changed} file-change observation(s). Repeated edits can count more than once.
- Last observed file movement: ${p.lastActivityAt || "Not yet observed since progress tracking began"}.
- Comparison: ${p.baseline ? "initial checklist baseline" : p.comparable ? "compared with previous scan" : "task transitions withheld because coverage or configuration changed"}.
- Scan coverage: ${(project.warnings || []).length} read warning(s); ${p.skippedFiles.length} text file(s) over size limit.

#### Newly checked off
${tasks(p.delta.completed)}

#### Reopened
${tasks(p.delta.reopened)}

#### Outstanding documented tasks (first 12)
${tasks(p.openTasks)}

#### Scope changes
- ${p.delta.added.length} added task(s); ${p.delta.removed.length} removed task(s). Removed tasks are not counted as completed.

#### Changed folders (first 15)
| Folder | Files | Created | Modified | Deleted |
| --- | ---: | ---: | ---: | ---: |
${folders.slice(0, 15).map((f) => `| ${safe(f.folder)} | ${f.files} | ${f.created} | ${f.modified} | ${f.deleted} |`).join("\n") || "| No folder changes observed | — | — | — | — |"}
${project.warnings?.length ? `\nRead warnings:\n${project.warnings.slice(0, 10).map((warning) => `- ${safe(warning)}`).join("\n")}` : ""}`;
  }).filter(Boolean).join("\n\n");
}

function safe(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "\\|").replace(/[\r\n]/g, " ");
}
