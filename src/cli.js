import path from "node:path";
import { loadConfig } from "./core/config.js";
import { persistScanArtifacts, writeEndOfDayReview, writeMorningBriefing } from "./core/reporting.js";
import { runScan } from "./core/system.js";

const command = process.argv[2] || "scan";
const args = new Set(process.argv.slice(3));
const config = loadConfig();

async function main() {
  if (command === "scan") {
    const scanResult = runScan(config);
    const artifacts = await persistScanArtifacts(config, scanResult);

    if (args.has("--with-briefings")) {
      await writeMorningBriefing(config, scanResult);
      await writeEndOfDayReview(config, scanResult);
    }

    console.log(`Scan complete.`);
    console.log(`Three-hour report: ${artifacts.reportPath}`);
    console.log(`Dashboard: ${artifacts.dashboardPath}`);
    return;
  }

  if (command === "morning") {
    const scanResult = runScan(config);
    await persistScanArtifacts(config, scanResult);
    const reportPath = await writeMorningBriefing(config, scanResult);
    console.log(`Morning briefing written to ${reportPath}`);
    return;
  }

  if (command === "eod") {
    const scanResult = runScan(config);
    await persistScanArtifacts(config, scanResult);
    const reportPath = await writeEndOfDayReview(config, scanResult);
    console.log(`End-of-day review written to ${reportPath}`);
    return;
  }

  if (command === "dashboard") {
    const scanResult = runScan(config);
    const artifacts = await persistScanArtifacts(config, scanResult);
    console.log(`Dashboard refreshed at ${artifacts.dashboardPath}`);
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

