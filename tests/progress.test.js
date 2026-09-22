import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanProjects } from "../src/core/projects.js";
import { parseSignals, collectProgress } from "../src/core/progress.js";
import { buildProgressReport } from "../src/core/progress-report.js";

test("checklists persist across scans and track completion, reopening and removal separately", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "personal-os-progress-"));
  try {
    const project = path.join(root, "sample");
    fs.mkdirSync(path.join(project, "docs"), { recursive: true });
    const config = { workspaceRoot: root, excludeProjects: [], ignoredDirectories: ["node_modules"], ignoredExtensions: [], textExtensions: [".md", ".js"], maxTodoItemsPerProject: 1 };
    const file = path.join(project, "docs/ROADMAP.md");
    const write = (value) => { fs.writeFileSync(file, value); const future = new Date(Date.now() + counter++ * 2000); fs.utimesSync(file, future, future); };
    let counter = 1;
    write("- [ ] Ship preview\n- [x] Set up repo\n- [ ] Review access\n");
    fs.writeFileSync(path.join(project, "app.js"), "// TODO: one\n// FIXME: two\n");
    let snapshot = null;
    const scan = () => {
      const generatedAt = new Date(Date.now() + counter * 2000).toISOString();
      const projects = scanProjects(config, snapshot, new Date(generatedAt), !snapshot);
      snapshot = { generatedAt, projects };
      return projects[0];
    };
    let result = scan();
    assert.equal(result.progress.totalTasks, 3);
    assert.equal(result.progress.completedTasks, 1);
    assert.equal(result.progress.checklistPercent, 33);
    assert.equal(result.progress.delta.completed.length, 0);
    assert.equal(result.progress.todoCount, 2);
    assert.equal(result.todos.length, 1);
    result = scan();
    assert.equal(result.progress.todoCount, 2, "unchanged TODOs remain visible");
    assert.equal(result.fileCounts.modified, 0);
    write("# Roadmap\n\n- [x] Ship preview\n- [x] Set up repo\n- [ ] Review access\n");
    result = scan();
    assert.equal(result.progress.delta.completed[0].title, "Ship preview");
    assert.equal(result.progress.folders.find((f) => f.folder === "docs").modified, 1);
    result = scan();
    assert.equal(result.progress.delta.completed.length, 0, "quiet scans do not repeat completion events");
    write("- [ ] Ship preview\n- [x] Set up repo\n");
    result = scan();
    assert.equal(result.progress.delta.reopened.length, 1);
    assert.equal(result.progress.delta.removed[0].title, "Review access");
    assert.equal(result.progress.delta.completed.length, 0);
    const report = buildProgressReport([result], snapshot.generatedAt);
    assert.match(report, /1 check-off event\(s\), 1 reopening/);
    assert.match(report, /Removed tasks are not counted as completed/);
    fs.mkdirSync(path.join(root, "new-project"));
    fs.writeFileSync(path.join(root, "new-project/file.js"), "hello");
    scan();
    const discovered = snapshot.projects.find((p) => p.name === "new-project");
    assert.equal(discovered.isBaselineScan, true);
    assert.equal(discovered.fileCounts.created, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("fenced examples are excluded and identical titles keep distinct identities", () => {
  const signals = parseSignals("plan.md", "```md\n- [x] Example\n```\n- [ ] Repeat\n- [x] Repeat\n");
  assert.equal(signals.tasks.length, 2);
  assert.notEqual(signals.tasks[0].id, signals.tasks[1].id);
});

test("partial coverage and changed settings suppress misleading transitions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "personal-os-coverage-"));
  try {
    fs.writeFileSync(path.join(root, "plan.md"), "- [ ] Finish\n");
    const config = { textExtensions: [".md"], maxTodoItemsPerProject: 12 };
    const inventory = { "plan.md": { size: 13, mtimeMs: 1 } };
    const changes = { created: [], modified: [], deleted: [] };
    const progress = collectProgress(root, inventory, null, changes, config, new Date(), []);
    const previous = { progress, fileInventory: inventory };
    const warnings = [];
    const current = collectProgress(root, { "missing.md": { size: 5 } }, previous, changes, config, new Date(), warnings);
    assert.equal(current.complete, false);
    assert.equal(current.delta.removed.length, 0);
    assert.equal(warnings.length, 1);
    const changed = collectProgress(root, inventory, previous, changes, { ...config, textExtensions: [] }, new Date(), []);
    assert.equal(changed.comparable, false);
    assert.equal(changed.delta.removed.length, 0);
    const large = collectProgress(root, { "plan.md": { size: 600000 } }, previous, changes, config, new Date(), []);
    assert.equal(large.taskCoverage, false);
    assert.equal(large.delta.completed.length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
