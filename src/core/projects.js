import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { unique } from "./utils.js";
import { collectProgress } from "./progress.js";



export function scanProjects(config, previousSnapshot, now = new Date(), isBaselineScan = false) {
  const rootEntries = fs.readdirSync(config.workspaceRoot, { withFileTypes: true });
  const projectNames = rootEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !config.excludeProjects.includes(name))
    .sort((left, right) => left.localeCompare(right));

  return projectNames.map((projectName) => {
    const projectPath = path.join(config.workspaceRoot, projectName);
    const previousProject = previousSnapshot?.projects?.find((project) => path.resolve(project.path) === path.resolve(projectPath));
    const warnings = [];
    const fileInventory = collectFileInventory(projectPath, config, warnings);
    // An incomplete traversal must not report unreadable files as deleted.
    if (warnings.length) {
      for (const [file, stat] of Object.entries(previousProject?.fileInventory || {})) {
        if (!(file in fileInventory)) fileInventory[file] = stat;
      }
    }
    const projectBaseline = isBaselineScan || !previousProject;
    const changes = compareFileInventory(previousProject?.fileInventory || {}, fileInventory, projectBaseline);
    const git = collectGitActivity(projectPath, previousSnapshot?.generatedAt);
    const categories = classifyChanges(changes);
    const progress = collectProgress(projectPath, fileInventory, previousProject, changes, config, now, warnings);
    const todos = progress.todos;
    const inferredFeatures = inferFeatures(changes, git, categories);
    const inferredFixes = inferFixes(changes, git, categories);
    const pendingWork = inferPendingWork(changes, git, todos);
    if (progress.openTasks.length) pendingWork.unshift(`${progress.openTasks.length} unchecked documented task(s).`);
    if (warnings.length) pendingWork.unshift("Partial scan: review unreadable paths before drawing conclusions.");

    return {
      name: projectName,
      path: projectPath,
      scannedAt: now.toISOString(),
      isBaselineScan: projectBaseline,
      warnings,
      progress,
      fileInventory,
      fileCounts: {
        total: Object.keys(fileInventory).length,
        created: changes.created.length,
        modified: changes.modified.length,
        deleted: changes.deleted.length
      },
      changes,
      categories,
      git,
      todos,
      inferredFeatures,
      inferredFixes,
      pendingWork,
      progressReport: buildProjectProgressReport(projectName, changes, categories, git, inferredFeatures, inferredFixes, pendingWork)
    };
  });
}

function collectFileInventory(projectPath, config, warnings) {
  const inventory = {};
  walkDirectory(projectPath, projectPath, config, inventory, warnings);
  return inventory;
}

function walkDirectory(currentPath, projectPath, config, inventory, warnings) {
  const entries = safeReadDir(currentPath, warnings).sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(projectPath, fullPath);
    const normalizedRelativePath = normalizeRelativePath(relativePath);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (shouldIgnoreDirectory(entry.name, normalizedRelativePath, config.ignoredDirectories)) {
        continue;
      }

      walkDirectory(fullPath, projectPath, config, inventory, warnings);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (config.ignoredExtensions.includes(extension)) {
      continue;
    }

    try {
      const stat = fs.statSync(fullPath);
      inventory[normalizedRelativePath] = {
        size: stat.size,
        mtimeMs: stat.mtimeMs
      };
    } catch (error) {
      warnings.push(`Cannot inspect ${normalizedRelativePath}: ${error.code || error.message}`);
      continue;
    }
  }
}

function safeReadDir(directoryPath, warnings) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch (error) {
    warnings.push(`Cannot list ${directoryPath}: ${error.code || error.message}`);
    return [];
  }
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function shouldIgnoreDirectory(entryName, relativePath, ignoredDirectories) {
  const normalizedPath = normalizeRelativePath(relativePath).toLowerCase();
  const normalizedName = entryName.toLowerCase();

  return ignoredDirectories.some((candidate) => {
    const normalizedCandidate = String(candidate).replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "").toLowerCase();
    if (!normalizedCandidate) return false;

    const isPathRule = normalizedCandidate.includes("/");
    if (!isPathRule && normalizedName === normalizedCandidate) {
      return true;
    }

    return normalizedPath === normalizedCandidate || normalizedPath.startsWith(`${normalizedCandidate}/`);
  });
}

function compareFileInventory(previousInventory, currentInventory, isBaselineScan) {
  if (isBaselineScan) {
    return {
      created: [],
      modified: [],
      deleted: [],
      renamedCandidates: [],
      baselineFiles: Object.keys(currentInventory).length
    };
  }

  const previousPaths = new Set(Object.keys(previousInventory));
  const currentPaths = new Set(Object.keys(currentInventory));

  const created = [];
  const modified = [];
  const deleted = [];

  for (const filePath of currentPaths) {
    if (!previousPaths.has(filePath)) {
      created.push(filePath);
      continue;
    }

    const previous = previousInventory[filePath];
    const current = currentInventory[filePath];
    if (previous.mtimeMs !== current.mtimeMs || previous.size !== current.size) {
      modified.push(filePath);
    }
  }

  for (const filePath of previousPaths) {
    if (!currentPaths.has(filePath)) {
      deleted.push(filePath);
    }
  }

  created.sort();
  modified.sort();
  deleted.sort();

  const renamedCandidates = detectPotentialRenames(created, deleted);

  return {
    created,
    modified,
    deleted,
    renamedCandidates,
    baselineFiles: 0
  };
}

function detectPotentialRenames(created, deleted) {
  const renamePairs = [];

  for (const deletedPath of deleted) {
    const deletedBase = path.basename(deletedPath, path.extname(deletedPath));
    const match = created.find((createdPath) => path.basename(createdPath, path.extname(createdPath)) === deletedBase);
    if (match) {
      renamePairs.push({ from: deletedPath, to: match });
    }
  }

  return renamePairs;
}

function collectGitActivity(projectPath, previousGeneratedAt) {
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return {
      isGitRepo: false,
      branch: null,
      status: [],
      commitsSinceLastScan: [],
      lastCommit: null
    };
  }

  const branch = runGit(projectPath, ["branch", "--show-current"]);
  const statusRaw = runGit(projectPath, ["status", "--short"]);
  const lastCommitRaw = runGit(projectPath, ["log", "-1", "--pretty=format:%H|%ct|%s"]);
  const logArgs = previousGeneratedAt
    ? ["log", `--since=${previousGeneratedAt}`, "--pretty=format:%h|%ct|%s"]
    : ["log", "-5", "--pretty=format:%h|%ct|%s"];
  const commitsRaw = runGit(projectPath, logArgs);

  return {
    isGitRepo: true,
    branch: branch || null,
    status: parseMultiline(statusRaw),
    commitsSinceLastScan: parseCommitLines(commitsRaw),
    lastCommit: parseCommitLine(lastCommitRaw)
  };
}

function runGit(projectPath, args) {
  try {
    return execFileSync("git", ["-C", projectPath, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function parseMultiline(value) {
  if (!value) return [];
  return value.split(/\r?\n/).filter(Boolean);
}

function parseCommitLines(value) {
  return parseMultiline(value).map(parseCommitLine).filter(Boolean);
}

function parseCommitLine(value) {
  if (!value) return null;
  const [hash, epochSeconds, ...subjectParts] = value.split("|");
  return {
    hash,
    timestamp: epochSeconds ? new Date(Number(epochSeconds) * 1000).toISOString() : null,
    subject: subjectParts.join("|")
  };
}

function classifyChanges(changes) {
  const buckets = {
    frontend: [],
    backend: [],
    api: [],
    database: [],
    config: [],
    tests: [],
    docs: [],
    assets: [],
    other: []
  };

  const allChangedFiles = [...changes.created, ...changes.modified, ...changes.deleted];
  for (const filePath of allChangedFiles) {
    const normalized = filePath.toLowerCase();
    const bucket = pickBucket(normalized);
    buckets[bucket].push(filePath);
  }

  return buckets;
}

function pickBucket(filePath) {
  if (/(^|\/)(routes|api)\//.test(filePath) || filePath.includes("swagger")) return "api";
  if (/(migration|seed|schema|database|\.sql$)/.test(filePath)) return "database";
  if (/(^|\/)(config|configs)\//.test(filePath) || /(^|\/)\.env/.test(filePath) || /\.(json|ya?ml|xml|ini)$/.test(filePath)) return "config";
  if (/(spec|test)\./.test(filePath) || /(^|\/)(tests|__tests__)\//.test(filePath)) return "tests";
  if (/\.(md|txt)$/.test(filePath) || /(^|\/)(docs|documentation)\//.test(filePath)) return "docs";
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico|mp4|mp3)$/.test(filePath) || /(^|\/)(public|assets|images)\//.test(filePath)) return "assets";
  if (/\.(css|scss|sass|less|vue|jsx|tsx|blade\.php|html)$/.test(filePath) || /(^|\/)(resources\/views|frontend|client|ui|components)\//.test(filePath)) return "frontend";
  if (/\.(php|js|ts|py|java)$/.test(filePath) || /(^|\/)(app|src|server|backend|controllers|services)\//.test(filePath)) return "backend";
  return "other";
}

function inferFeatures(changes, git, categories) {
  const features = [];
  for (const commit of git.commitsSinceLastScan) {
    if (/\b(feat|feature|add|create|implement|build|launch)\b/i.test(commit.subject)) {
      features.push(commit.subject);
    }
  }

  if (categories.frontend.length > 0 && changes.created.length > 0) {
    features.push("New frontend surface or UI change detected.");
  }

  if (categories.api.length > 0 && categories.backend.length > 0) {
    features.push("API and backend logic changed together, suggesting a feature iteration.");
  }

  if (categories.database.length > 0) {
    features.push("Database layer changed, which often means new data flows or schema work.");
  }

  return unique(features);
}

function inferFixes(changes, git, categories) {
  const fixes = [];
  for (const commit of git.commitsSinceLastScan) {
    if (/\b(fix|bug|resolve|patch|hotfix|repair)\b/i.test(commit.subject)) {
      fixes.push(commit.subject);
    }
  }

  if (categories.tests.length > 0 && changes.modified.length > 0) {
    fixes.push("Tests changed alongside code, which often signals bug-fix verification.");
  }

  return unique(fixes);
}

function inferPendingWork(changes, git, todos) {
  const pending = [];

  if (git.status.length > 0) {
    pending.push(`${git.status.length} uncommitted change(s) still in the working tree.`);
  }

  if (todos.length > 0) {
    pending.push(`${todos.length} TODO/FIXME markers detected.`);
  }

  if (changes.renamedCandidates.length > 0) {
    pending.push("Potential file renames detected; verify nothing was orphaned.");
  }

  if (changes.created.length > 0 && git.commitsSinceLastScan.length === 0) {
    pending.push("New files exist without corresponding recent commits.");
  }

  return pending;
}

function buildProjectProgressReport(projectName, changes, categories, git, inferredFeatures, inferredFixes, pendingWork) {
  const sentences = [];

  if (changes.baselineFiles > 0) {
    sentences.push(`${projectName} baseline captured with ${changes.baselineFiles} tracked file(s); future scans will highlight real deltas.`);
    if (git.commitsSinceLastScan.length > 0) {
      sentences.push(`${git.commitsSinceLastScan.length} recent commit(s) were recorded for context.`);
    }
    return sentences.join(" ");
  }

  const totalChanged = changes.created.length + changes.modified.length + changes.deleted.length;
  if (totalChanged === 0 && git.commitsSinceLastScan.length === 0) {
    sentences.push(`${projectName} was quiet during this scan window.`);
  } else {
    sentences.push(`${projectName} changed across ${totalChanged} file(s) with ${git.commitsSinceLastScan.length} recent commit(s).`);
  }

  const touchedAreas = Object.entries(categories)
    .filter(([, files]) => files.length > 0)
    .map(([name]) => name);
  if (touchedAreas.length > 0) {
    sentences.push(`Touched areas: ${touchedAreas.join(", ")}.`);
  }

  if (inferredFeatures.length > 0) {
    sentences.push(`Feature signals: ${inferredFeatures.slice(0, 2).join(" | ")}.`);
  }

  if (inferredFixes.length > 0) {
    sentences.push(`Fix signals: ${inferredFixes.slice(0, 2).join(" | ")}.`);
  }

  if (pendingWork.length > 0) {
    sentences.push(`Pending attention: ${pendingWork.slice(0, 2).join(" | ")}.`);
  }

  return sentences.join(" ");
}
