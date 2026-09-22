import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { truncate, unique } from "./utils.js";

const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/i;
const TEXT_FILE_PATTERN = /\.(php|js|mjs|cjs|ts|tsx|jsx|json|md|txt|sql|css|scss|html|vue|py|java|xml|ya?ml)$/i;

export function scanProjects(config, previousSnapshot, now = new Date(), isBaselineScan = false) {
  const rootEntries = fs.readdirSync(config.workspaceRoot, { withFileTypes: true });
  const projectNames = rootEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !config.excludeProjects.includes(name));

  return projectNames.map((projectName) => {
    const projectPath = path.join(config.workspaceRoot, projectName);
    const previousProject = previousSnapshot?.projects?.find((project) => project.name === projectName);
    const fileInventory = collectFileInventory(projectPath, config);
    const changes = compareFileInventory(previousProject?.fileInventory || {}, fileInventory, isBaselineScan);
    const git = collectGitActivity(projectPath, previousSnapshot?.generatedAt);
    const categories = classifyChanges(changes);
    const todos = collectTodoItems(
      projectPath,
      isBaselineScan ? [] : [...changes.created, ...changes.modified],
      config.maxTodoItemsPerProject
    );
    const inferredFeatures = inferFeatures(changes, git, categories);
    const inferredFixes = inferFixes(changes, git, categories);
    const pendingWork = inferPendingWork(changes, git, todos);

    return {
      name: projectName,
      path: projectPath,
      scannedAt: now.toISOString(),
      isBaselineScan,
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

function collectFileInventory(projectPath, config) {
  const inventory = {};
  walkDirectory(projectPath, projectPath, config, inventory);
  return inventory;
}

function walkDirectory(currentPath, projectPath, config, inventory) {
  const entries = safeReadDir(currentPath);

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(projectPath, fullPath);
    const normalizedRelativePath = relativePath.split(path.sep).join("/");

    if (entry.isDirectory()) {
      if (shouldIgnoreDirectory(entry.name, normalizedRelativePath, config.ignoredDirectories)) {
        continue;
      }

      walkDirectory(fullPath, projectPath, config, inventory);
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
      continue;
    }
  }
}

function safeReadDir(directoryPath) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch (error) {
    return [];
  }
}

function shouldIgnoreDirectory(entryName, relativePath, ignoredDirectories) {
  const normalized = relativePath.split(path.sep).join("/").toLowerCase();
  const normalizedName = entryName.toLowerCase();

  return ignoredDirectories.some((candidate) => {
    const normalizedCandidate = candidate.replaceAll("\\", "/").toLowerCase();
    return normalizedName === normalizedCandidate || normalized.startsWith(`${normalizedCandidate}/`);
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
  } catch (error) {
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

function collectTodoItems(projectPath, candidateFiles, maxTodoItems) {
  const items = [];

  for (const relativePath of candidateFiles.filter((filePath) => TEXT_FILE_PATTERN.test(filePath))) {
    if (items.length >= maxTodoItems) {
      break;
    }

    const fullPath = path.join(projectPath, relativePath);
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (items.length >= maxTodoItems) {
          return;
        }

        if (TODO_PATTERN.test(line)) {
          items.push({
            file: relativePath,
            line: index + 1,
            text: truncate(line.trim(), 160)
          });
        }
      });
    } catch (error) {
      continue;
    }
  }

  return items;
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
