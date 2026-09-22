import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const REQUIRED_PATH_FIELDS = ["workspaceRoot", "stateDir", "historyDir", "reportsDir", "dashboardDir"];
const ARRAY_FIELDS = ["excludeProjects", "ignoredDirectories", "ignoredExtensions", "textExtensions"];

export function getRootDir() {
  return rootDir;
}

export function loadConfig() {
  const configPath = path.join(rootDir, "config", "personal-os.config.json");
  let config;

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    config = JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Configuration not found at ${configPath}. Run "npm run setup" first.`);
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Configuration at ${configPath} is not valid JSON: ${error.message}`);
    }

    throw error;
  }

  validateConfig(config, configPath);

  const resolved = {
    ...config,
    workspaceRoot: resolveFromRoot(config.workspaceRoot),
    stateDir: resolveFromRoot(config.stateDir),
    historyDir: resolveFromRoot(config.historyDir),
    reportsDir: resolveFromRoot(config.reportsDir),
    dashboardDir: resolveFromRoot(config.dashboardDir),
    excludeProjects: config.excludeProjects || [],
    ignoredDirectories: config.ignoredDirectories || [],
    ignoredExtensions: (config.ignoredExtensions || []).map((value) => value.toLowerCase()),
    textExtensions: (config.textExtensions || []).map((value) => value.toLowerCase())
  };

  validateWorkspace(resolved.workspaceRoot);
  return resolved;
}

export function resolveFromRoot(targetPath) {
  return path.isAbsolute(targetPath) ? path.normalize(targetPath) : path.resolve(rootDir, targetPath);
}

function validateConfig(config, configPath) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`Configuration at ${configPath} must be a JSON object.`);
  }

  const missingPaths = REQUIRED_PATH_FIELDS.filter(
    (field) => typeof config[field] !== "string" || config[field].trim().length === 0
  );

  if (missingPaths.length > 0) {
    throw new Error(`Configuration is missing valid path value(s): ${missingPaths.join(", ")}.`);
  }

  for (const field of ARRAY_FIELDS) {
    if (config[field] !== undefined && !Array.isArray(config[field])) {
      throw new Error(`Configuration field "${field}" must be an array.`);
    }
  }

  if (!Number.isInteger(config.maxTodoItemsPerProject) || config.maxTodoItemsPerProject < 0) {
    throw new Error('Configuration field "maxTodoItemsPerProject" must be a non-negative integer.');
  }

  if (typeof config.scanWindowHours !== "number" || !Number.isFinite(config.scanWindowHours) || config.scanWindowHours <= 0) {
    throw new Error('Configuration field "scanWindowHours" must be a positive number.');
  }

  if (config.ai?.timeoutMs !== undefined) {
    if (!Number.isInteger(config.ai.timeoutMs) || config.ai.timeoutMs < 1000 || config.ai.timeoutMs > 120000) {
      throw new Error('Configuration field "ai.timeoutMs" must be an integer between 1000 and 120000 milliseconds.');
    }
  }
}

function validateWorkspace(workspaceRoot) {
  if (!fs.existsSync(workspaceRoot)) {
    throw new Error(`workspaceRoot does not exist: ${workspaceRoot}`);
  }

  if (!fs.statSync(workspaceRoot).isDirectory()) {
    throw new Error(`workspaceRoot must point to a directory: ${workspaceRoot}`);
  }
}
