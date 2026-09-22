import path from "node:path";
import { maybeGenerateAiSummary } from "./llm.js";
import { buildDashboard } from "./dashboard.js";
import { ensureDir, formatDateTime, writeJson, writeText } from "./utils.js";

export async function persistScanArtifacts(config, scanResult) {
  ensureDir(config.stateDir);
  ensureDir(config.historyDir);
  ensureDir(config.reportsDir);
  ensureDir(config.dashboardDir);

  const stamp = scanResult.generatedAt.replaceAll(":", "-");
  writeJson(path.join(config.stateDir, "latest-snapshot.json"), scanResult);
  writeJson(path.join(config.historyDir, `scan-${stamp}.json`), scanResult);

  const threeHourReport = await buildThreeHourReport(config, scanResult);
  writeText(path.join(config.reportsDir, `three-hour-${stamp}.md`), threeHourReport);
  writeText(path.join(config.reportsDir, "latest-three-hour.md"), threeHourReport);

  const dashboardHtml = buildDashboard(scanResult);
  writeText(path.join(config.dashboardDir, "index.html"), dashboardHtml);
  writeJson(path.join(config.dashboardDir, "latest.json"), scanResult);

  return {
    reportPath: path.join(config.reportsDir, `three-hour-${stamp}.md`),
    dashboardPath: path.join(config.dashboardDir, "index.html")
  };
}

export async function writeMorningBriefing(config, scanResult) {
  const stamp = scanResult.generatedAt.replaceAll(":", "-");
  const content = buildMorningBriefing(scanResult);
  const reportPath = path.join(config.reportsDir, `morning-briefing-${stamp}.md`);
  writeText(reportPath, content);
  writeText(path.join(config.reportsDir, "latest-morning-briefing.md"), content);
  return reportPath;
}

export async function writeEndOfDayReview(config, scanResult) {
  const stamp = scanResult.generatedAt.replaceAll(":", "-");
  const content = buildEndOfDayReview(scanResult);
  const reportPath = path.join(config.reportsDir, `end-of-day-${stamp}.md`);
  writeText(reportPath, content);
  writeText(path.join(config.reportsDir, "latest-end-of-day.md"), content);
  return reportPath;
}

async function buildThreeHourReport(config, scanResult) {
  const aiSummary = await maybeGenerateAiSummary(config, {
    executiveSummary: scanResult.executiveSummary,
    keyProjects: scanResult.projects.slice(0, 5).map(toAiProjectSummary),
    urgentActions: scanResult.highPriorityActions
  });

  const projectSections = scanResult.projects
    .map(
      (project) => `## ${project.name}

- Work completed: ${project.progressReport}
- Files changed: ${
        project.isBaselineScan
          ? `Baseline only (${project.fileCounts.total} tracked file(s))`
          : `${project.fileCounts.created} created, ${project.fileCounts.modified} modified, ${project.fileCounts.deleted} deleted`
      }
- New features added: ${project.inferredFeatures.length > 0 ? project.inferredFeatures.join(" | ") : "No clear feature signal detected"}
- Bugs fixed: ${project.inferredFixes.length > 0 ? project.inferredFixes.join(" | ") : "No clear bug-fix signal detected"}
- Pending tasks: ${project.pendingWork.length > 0 ? project.pendingWork.join(" | ") : "No major pending flags from this scan"}
- TODO items: ${project.todos.length > 0 ? project.todos.map((todo) => `${todo.file}:${todo.line}`).join(", ") : "None detected"}`
    )
    .join("\n\n");

  return `# 3-Hour Executive Report

Generated: ${formatDateTime(scanResult.generatedAt)}

## Executive Summary

${aiSummary || scanResult.executiveSummary.summary}

${scanResult.isBaselineScan ? "Baseline note: this first run captured the existing project state. The next scans will show actual created, modified, deleted, and renamed deltas.\n" : ""}

## High-Priority Actions

${scanResult.highPriorityActions.map((item) => `- ${item}`).join("\n") || "- None"}

## Suggested Next Steps

${scanResult.recommendations.map((item) => `- ${item}`).join("\n") || "- No suggestions available"}

## Cross-Domain Signals

- Today: ${scanResult.crossDomain.schedule.today.length} scheduled item(s), ${scanResult.crossDomain.schedule.conflicts.length} conflict warning(s)
- University: ${scanResult.crossDomain.academics.dueSoon.length} due soon, ${scanResult.crossDomain.academics.overdue.length} overdue
- Follow-ups: ${scanResult.crossDomain.communications.pending.length} pending message thread(s)
- Responsibilities: ${scanResult.crossDomain.responsibilities.upcoming.length} upcoming, ${scanResult.crossDomain.responsibilities.overdue.length} overdue
- Finance: ${scanResult.crossDomain.finance.upcomingBills.length} upcoming bill(s)

${projectSections}
`;
}

function toAiProjectSummary(project) {
  return {
    name: project.name,
    fileCounts: project.fileCounts,
    changedAreas: Object.entries(project.categories)
      .filter(([, files]) => files.length > 0)
      .map(([area]) => area),
    git: {
      branch: project.git.branch,
      uncommittedChanges: project.git.status.length,
      recentCommits: project.git.commitsSinceLastScan.slice(0, 5).map((commit) => commit.subject)
    },
    todoCount: project.todos.length,
    featureSignals: project.inferredFeatures.slice(0, 3),
    fixSignals: project.inferredFixes.slice(0, 3),
    pendingWork: project.pendingWork.slice(0, 3)
  };
}

function buildMorningBriefing(scanResult) {
  const todaySchedule = scanResult.crossDomain.schedule.today;
  const deadlines = [
    ...scanResult.crossDomain.academics.dueSoon.slice(0, 5).map((item) => `${item.title} (${item.course}) due ${item.due_label}`),
    ...scanResult.crossDomain.responsibilities.upcoming.slice(0, 5).map((item) => `${item.title} [${item.area}] due ${item.due_label}`)
  ].slice(0, 8);

  return `# Morning Briefing

Generated: ${formatDateTime(scanResult.generatedAt)}

## Today's Schedule

${todaySchedule.map((event) => `- ${event.when} | ${event.title}${event.location ? ` @ ${event.location}` : ""}`).join("\n") || "- No events recorded for today"}

## Upcoming Deadlines

${deadlines.map((item) => `- ${item}`).join("\n") || "- No immediate deadlines recorded"}

## Priority Tasks

${scanResult.highPriorityActions.map((item) => `- ${item}`).join("\n") || "- No high-priority actions generated"}

## Follow-Up Reminders

${scanResult.crossDomain.communications.highPriority.map((conversation) => `- Reply to ${conversation.contact} on ${conversation.channel}: ${conversation.commitment || conversation.topic}`).join("\n") || "- No urgent follow-ups recorded"}

## Recommended Focus Areas

${scanResult.recommendations.map((item) => `- ${item}`).join("\n") || "- No recommendations generated"}
`;
}

function buildEndOfDayReview(scanResult) {
  const activeProjects = scanResult.projects.filter((project) => project.fileCounts.created + project.fileCounts.modified + project.fileCounts.deleted > 0);
  const missedTasks = [
    ...scanResult.crossDomain.academics.overdue.map((item) => `${item.title} (${item.course})`),
    ...scanResult.crossDomain.responsibilities.overdue.map((item) => `${item.title} [${item.area}]`)
  ].slice(0, 10);

  return `# End-of-Day Review

Generated: ${formatDateTime(scanResult.generatedAt)}

## Work Completed

${scanResult.isBaselineScan ? "- Baseline inventory captured; end-of-day change narratives will improve after the next scan window." : activeProjects.map((project) => `- ${project.progressReport}`).join("\n") || "- No project activity detected in the latest scan"}

## Progress Made

${scanResult.projects
    .map((project) =>
      scanResult.isBaselineScan
        ? `- ${project.name}: baseline captured with ${project.fileCounts.total} tracked file(s)`
        : `- ${project.name}: ${project.fileCounts.created + project.fileCounts.modified + project.fileCounts.deleted} file change(s)`
    )
    .join("\n")}

## Missed Tasks

${missedTasks.map((item) => `- ${item}`).join("\n") || "- No missed tasks recorded"}

## Key Accomplishments

${scanResult.projects.flatMap((project) => project.inferredFeatures.concat(project.inferredFixes)).slice(0, 10).map((item) => `- ${item}`).join("\n") || "- No clear accomplishment signals were inferred"}

## Priorities For Tomorrow

${scanResult.highPriorityActions.concat(scanResult.recommendations).slice(0, 10).map((item) => `- ${item}`).join("\n") || "- No priorities generated"}
`;
}
