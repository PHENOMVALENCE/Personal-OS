import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
for (const directory of ["src", "scripts", "tests"]) {
  for (const name of fs.readdirSync(directory, { recursive: true })) {
    if (name.endsWith(".js")) execFileSync(process.execPath, ["--check", path.join(directory, name)], { stdio: "inherit" });
  }
}
console.log("JavaScript syntax checks passed.");
