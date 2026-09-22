import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

export function getRootDir() {
  return rootDir;
}

export function loadConfig() {
  const configPath = path.join(rootDir, "config", "personal-os.config.json");
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);

  return {
    ...config,
    stateDir: resolveFromRoot(config.stateDir),
    historyDir: resolveFromRoot(config.historyDir),
    reportsDir: resolveFromRoot(config.reportsDir),
    dashboardDir: resolveFromRoot(config.dashboardDir)
  };
}

export function resolveFromRoot(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(rootDir, targetPath);
}

