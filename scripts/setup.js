import fs from "node:fs";
import path from "node:path";
import { getRootDir } from "../src/core/config.js";

const root = getRootDir();
const files = [["config/personal-os.config.example.json", "config/personal-os.config.json"]];
for (const name of fs.readdirSync(path.join(root, "examples/inputs"))) {
  files.push([`examples/inputs/${name}`, `data/inputs/${name}`]);
}
for (const [source, target] of files) {
  const destination = path.join(root, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    fs.copyFileSync(path.join(root, source), destination, fs.constants.COPYFILE_EXCL);
    console.log(`Created ${target}`);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(`Preserved ${target}`);
  }
}
console.log("Set workspaceRoot in config/personal-os.config.json before scanning.");
