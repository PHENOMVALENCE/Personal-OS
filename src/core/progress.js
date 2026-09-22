import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const TODO = /\b(TODO|FIXME|HACK|XXX)\b/i;

// Parse evidence only; never execute instructions found in a project document.
export function parseSignals(file, content) {
  const tasks = [];
  const todos = [];
  const occurrences = new Map();
  let fence = null;
  const markdown = file.toLowerCase().endsWith(".md");
  content.split(/\r?\n/).forEach((line, index) => {
    const marker = markdown && line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return;
    }
    if (fence) return;
    const checkbox = markdown && line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (checkbox) {
      const title = checkbox[2].trim();
      const occurrence = occurrences.get(title) || 0;
      occurrences.set(title, occurrence + 1);
      const id = createHash("sha256").update(`${file}\0${title}\0${occurrence}`).digest("hex");
      tasks.push({ id, file, line: index + 1, title, done: checkbox[1].toLowerCase() === "x" });
    }
    if (TODO.test(line)) todos.push({ file, line: index + 1, text: line.trim().slice(0, 160) });
  });
  return { tasks, todos };
}

export function collectProgress(projectPath, inventory, previous, changes, config, now, warnings) {
  const cache = {};
  const maxBytes = config.progress?.maxTextFileBytes ?? 524288;
  const scope = JSON.stringify([config.textExtensions, config.ignoredDirectories, config.ignoredExtensions, maxBytes]);
  const skippedFiles = [];
  for (const [file, stat] of Object.entries(inventory).sort(([a], [b]) => a.localeCompare(b))) {
    if (!(config.textExtensions || []).some((extension) => file.toLowerCase().endsWith(extension))) continue;
    if (stat.size > maxBytes) { skippedFiles.push(file); continue; }
    const oldStat = previous?.fileInventory?.[file];
    const oldSignals = previous?.progress?.signals?.[file];
    if (previous?.progress?.scope === scope && oldSignals && !oldSignals.stale && oldStat?.size === stat.size && oldStat?.mtimeMs === stat.mtimeMs) {
      cache[file] = oldSignals;
      continue;
    }
    try {
      cache[file] = parseSignals(file, fs.readFileSync(path.join(projectPath, file), "utf8"));
    } catch (error) {
      warnings.push(`Cannot read ${file}: ${error.code || error.message}`);
      if (oldSignals) cache[file] = { ...oldSignals, stale: true };
    }
  }
  const tasks = Object.values(cache).flatMap((entry) => entry.tasks);
  const todos = Object.values(cache).flatMap((entry) => entry.todos);
  const previousTasks = Object.values(previous?.progress?.signals || {}).flatMap((entry) => entry.tasks);
  const oldById = new Map(previousTasks.map((task) => [task.id, task]));
  const newById = new Map(tasks.map((task) => [task.id, task]));
  const baseline = !previous?.progress;
  const taskCoverage = !warnings.length && !skippedFiles.some((file) => file.toLowerCase().endsWith(".md"));
  const comparable = !baseline && taskCoverage && previous.progress.taskCoverage && previous.progress.scope === scope;
  const delta = {
    completed: comparable ? tasks.filter((task) => task.done && oldById.has(task.id) && !oldById.get(task.id).done) : [],
    reopened: comparable ? tasks.filter((task) => !task.done && oldById.get(task.id)?.done) : [],
    added: comparable ? tasks.filter((task) => !oldById.has(task.id)) : [],
    removed: comparable ? previousTasks.filter((task) => !newById.has(task.id)) : []
  };
  const done = tasks.filter((task) => task.done).length;
  const changedFiles = changes.created.length + changes.modified.length + changes.deleted.length;
  const previousProgress = previous?.progress;
  const lastActivityAt = changedFiles ? now.toISOString() : previousProgress?.lastActivityAt || null;
  const point = { at: now.toISOString(), changedFiles, completed: delta.completed.length, reopened: delta.reopened.length, done, total: tasks.length, comparable };
  const history = [...(previousProgress?.history || []), point].slice(-60);
  return {
    version: 1,
    scope,
    taskCoverage,
    baseline,
    comparable,
    complete: !warnings.length && !skippedFiles.length,
    skippedFiles,
    signals: cache,
    totalTasks: tasks.length,
    completedTasks: done,
    openTasks: tasks.filter((task) => !task.done),
    checklistPercent: tasks.length ? Math.round(done / tasks.length * 100) : null,
    todoCount: todos.length,
    todos: todos.slice(0, config.maxTodoItemsPerProject),
    delta,
    lastActivityAt,
    status: warnings.length || skippedFiles.length ? "partial" : changedFiles || delta.completed.length || delta.reopened.length ? "active" : "quiet",
    history,
    folders: summarizeFolders(inventory, changes)
  };
}

function summarizeFolders(inventory, changes) {
  const folders = new Map();
  const row = (file) => {
    const folder = file.includes("/") ? file.split("/").slice(0, -1).slice(0, 2).join("/") : "(root)";
    if (!folders.has(folder)) folders.set(folder, { folder, files: 0, created: 0, modified: 0, deleted: 0 });
    return folders.get(folder);
  };
  for (const file of Object.keys(inventory)) row(file).files++;
  for (const kind of ["created", "modified", "deleted"]) for (const file of changes[kind]) row(file)[kind]++;
  return [...folders.values()].sort((a, b) => (b.created + b.modified + b.deleted) - (a.created + a.modified + a.deleted) || a.folder.localeCompare(b.folder));
}
