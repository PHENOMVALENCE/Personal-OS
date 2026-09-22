import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../", import.meta.url));
test("fresh setup preserves local data and CLI detects real changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "personal-os-test-"));
  try {
    for (const directory of ["src", "scripts", "examples"]) fs.cpSync(path.join(source, directory), path.join(root, directory), { recursive: true });
    fs.copyFileSync(path.join(source, "package.json"), path.join(root, "package.json"));
    fs.mkdirSync(path.join(root, "config"));
    fs.copyFileSync(path.join(source, "config/personal-os.config.example.json"), path.join(root, "config/personal-os.config.example.json"));
    const run = (...args) => execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "" } });
    run("scripts/setup.js");
    const configPath = path.join(root, "config/personal-os.config.json");
    const config = JSON.parse(fs.readFileSync(configPath));
    config.workspaceRoot = path.join(root, "workspace");
    fs.writeFileSync(configPath, JSON.stringify(config));
    run("scripts/setup.js");
    assert.equal(JSON.parse(fs.readFileSync(configPath)).workspaceRoot, config.workspaceRoot);
    const project = path.join(config.workspaceRoot, "demo");
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, "app.js"), "export const value = 1;\n");
    const snapshot = () => JSON.parse(fs.readFileSync(path.join(root, "data/state/latest-snapshot.json")));
    run("src/cli.js", "scan");
    assert.equal(snapshot().isBaselineScan, true);
    assert.equal(snapshot().projects[0].fileCounts.created, 0);
    fs.writeFileSync(path.join(project, "app.js"), "export const value = 222; // TODO: example\n");
    fs.writeFileSync(path.join(project, "new.md"), "New documentation");
    run("src/cli.js", "scan", "--with-briefings");
    assert.equal(snapshot().projects[0].fileCounts.modified, 1);
    assert.equal(snapshot().projects[0].fileCounts.created, 1);
    assert.equal(snapshot().projects[0].todos.length, 1);
    fs.unlinkSync(path.join(project, "new.md"));
    run("src/cli.js", "morning");
    assert.equal(snapshot().projects[0].fileCounts.deleted, 1);
    run("src/cli.js", "eod");
    run("src/cli.js", "dashboard");
    for (const file of ["latest-three-hour.md", "latest-morning-briefing.md", "latest-end-of-day.md"]) assert.ok(fs.readFileSync(path.join(root, "reports", file), "utf8").includes("Generated:"));
    assert.ok(fs.readFileSync(path.join(root, "dashboard/index.html"), "utf8").includes("demo"));
    assert.equal(spawnSync(process.execPath, ["src/cli.js", "invalid"], { cwd: root }).status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

