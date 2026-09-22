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
  const intelligence = scanResult.operationalIntelligence;
  const aiSummary = await maybeGenerateAiSummary(config, {
    executiveSummary: scanResult.executiveSummary,
    keyProjects: scanResult.projects.slice(0, 5).map(toAiProjectSummary),
    urgentActions: intelligence.topActions.slice(0, 8)
  });

  const projectSections = scanResult.projects
    .map((project) => {
      const health = intelligence.projectHealth.find((item) => item.name === project.name);
      return \`### \${project.name}

- **Status:** \${health?.status || "unknown"}
- **Branch:** \${project.git.branch || "n/a"}
- **Movement:** \${project.isBaselineScan ? \`baseline of \${project.fileCounts.total} tracked file(s)\` : \`\${project.fileCounts.created} created · \${project.fileCounts.modified} modified · \${project.fileCounts.deleted} deleted\`}
- **Recent commits:** \${project.git.commitsSinceLastScan.length}
- **Uncommitted changes:** \${project.git.status.length}
- **TODO/FIXME markers:** \${project.todos.length}
- **Progress:** \${project.progressReport}
- **Attention:** \${health?.signals?.length ? health.signals.join(" · ") : "No major project-health signals"}\`;
    })
    .join("\n\n");

  return \`# Personal OS — Executive Report

**Generated:** \${formatDateTime(scanResult.generatedAt)}  
**Window:** \${scanResult.monitorWindowHours} hour(s)  
**Mode:** \${scanResult.isBaselineScan ? "Baseline" : "Operational"}

## Executive Brief

\${aiSummary || scanResult.executiveSummary.summary}

\${scanResult.isBaselineScan ? "> Baseline scan captured the existing state. Subsequent runs will show real movement and operational deltas.\n" : ""}

## At a Glance

| Signal | Value |
| --- | ---: |
| Active projects | \${scanResult.executiveSummary.activeProjects} |
| Files changed | \${scanResult.executiveSummary.totalFilesChanged} |
| Recent commits | \${scanResult.executiveSummary.recentCommits} |
| Critical actions | \${intelligence.metrics.criticalActions} |
| High-priority actions | \${intelligence.metrics.highActions} |
| Projects needing attention | \${intelligence.metrics.projectsNeedingAttention} |
| Pending follow-ups | \${scanResult.crossDomain.communications.pending.length} |
| Waiting on others | \${scanResult.crossDomain.communications.waitingOn?.length || 0} |
| Overdue commitments | \${scanResult.executiveSummary.overdueItems} |

## Priority Queue

\${buildActionTable(intelligence.topActions)}

## Project Health

\${buildProjectHealthTable(intelligence.projectHealth)}

## Today & Near-Term Commitments

### Schedule
\${scanResult.crossDomain.schedule.today.map((event) => \`- \${event.when} — **\${event.title}**\${event.location ? \` @ \${event.location}\` : ""}\`).join("\n") || "- No events recorded for today."}

### Academic deadlines
\${scanResult.crossDomain.academics.dueSoon.slice(0, 6).map((item) => \`- **\${item.title}** (\${item.course}) — due \${item.due_label}\`).join("\n") || "- No academic deadlines due soon."}

### Responsibility deadlines
\${scanResult.crossDomain.responsibilities.upcoming.slice(0, 6).map((item) => \`- **\${item.title}** [\${item.area}] — due \${item.due_label}\`).join("\n") || "- No responsibility deadlines due soon."}

## Waiting On

\${buildWaitingOnList(scanResult.crossDomain.communications.waitingOn || [])}

## Recommendations

\${scanResult.recommendations.map((item) => \`- \${item}\`).join("\n") || "- No recommendations generated."}

## Project Detail

\${projectSections}
\`;
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
  const intelligence = scanResult.operationalIntelligence;
  const todaySchedule = scanResult.crossDomain.schedule.today;
  const focusActions = intelligence.topActions.slice(0, 5);
  const watchProjects = intelligence.projectHealth
    .filter((project) => project.status === "attention" || project.status === "active")
    .slice(0, 6);

  return \`# Personal OS — Morning Briefing

**Generated:** \${formatDateTime(scanResult.generatedAt)}

## Start Here

\${focusActions.length
    ? focusActions.map((action, index) => \`\${index + 1}. **[\${action.priority.toUpperCase()}] \${action.title}** — \${action.nextAction || action.detail || action.reason}\`).join("\n")
    : "No priority actions were generated."}

## Today's Timeline

\${todaySchedule.map((event) => \`- \${event.when} — **\${event.title}**\${event.location ? \` @ \${event.location}\` : ""}\`).join("\n") || "- No events recorded for today."}

## Deadlines

\${[
    ...scanResult.crossDomain.academics.dueSoon.slice(0, 4).map((item) => \`- Academic · **\${item.title}** (\${item.course}) · \${item.due_label}\`),
    ...scanResult.crossDomain.responsibilities.upcoming.slice(0, 4).map((item) => \`- \${item.area} · **\${item.title}** · \${item.due_label}\`)
  ].join("\n") || "- No immediate deadlines recorded."}

## Follow-ups

\${scanResult.crossDomain.communications.pending.slice(0, 8).map((conversation) =>
    \`- **\${conversation.contact}** via \${conversation.channel}: \${conversation.commitment || conversation.topic || "Pending conversation"} (\${conversation.ageHours}h)\`
  ).join("\n") || "- No pending follow-ups recorded."}

## Waiting On

\${buildWaitingOnList(scanResult.crossDomain.communications.waitingOn || [])}

## Project Watch

\${watchProjects.length
    ? watchProjects.map((project) => \`- **\${project.name}** · \${project.status} · \${project.changedFiles} change(s) · \${project.uncommittedChanges} uncommitted\${project.signals.length ? \` · \${project.signals.join("; ")}\` : ""}\`).join("\n")
    : "- No projects currently require special attention."}

## System Recommendations

\${scanResult.recommendations.slice(0, 6).map((item) => \`- \${item}\`).join("\n") || "- No recommendations generated."}
\`;
}

function buildEndOfDayReview(scanResult) {
  const intelligence = scanResult.operationalIntelligence;
  const activeProjects = intelligence.projectHealth.filter((project) => project.status === "active" || project.status === "attention");
  const accomplishments = scanResult.projects
    .flatMap((project) => project.inferredFeatures.concat(project.inferredFixes))
    .slice(0, 10);

  return \`# Personal OS — End-of-Day Review

**Generated:** \${formatDateTime(scanResult.generatedAt)}

## Day Snapshot

| Signal | Value |
| --- | ---: |
| Active projects in latest window | \${scanResult.executiveSummary.activeProjects} |
| Files changed | \${scanResult.executiveSummary.totalFilesChanged} |
| Recent commits | \${scanResult.executiveSummary.recentCommits} |
| Open critical actions | \${intelligence.metrics.criticalActions} |
| Open high-priority actions | \${intelligence.metrics.highActions} |
| Pending follow-ups | \${scanResult.crossDomain.communications.pending.length} |

## Project Movement

\${scanResult.isBaselineScan
    ? "- Baseline inventory captured; activity narratives will become more meaningful after subsequent scans."
    : activeProjects.length
      ? activeProjects.map((project) => \`- **\${project.name}** · \${project.status} · \${project.changedFiles} changed file(s) · \${project.recentCommits} recent commit(s) · \${project.uncommittedChanges} uncommitted\`).join("\n")
      : "- No project movement detected in the latest scan window."}

## Accomplishment Signals

\${accomplishments.length ? accomplishments.map((item) => \`- \${item}\`).join("\n") : "- No clear feature or fix signals were inferred."}

## Unresolved Priority Queue

\${buildActionTable(intelligence.topActions.slice(0, 10))}

## Waiting On

\${buildWaitingOnList(scanResult.crossDomain.communications.waitingOn || [])}

## Carry Into Tomorrow

\${intelligence.topActions.slice(0, 5).map((action, index) => \`\${index + 1}. **\${action.title}** — \${action.nextAction || action.detail || action.reason}\`).join("\n") || "No priority carry-over generated."}

## Recommendations

\${scanResult.recommendations.slice(0, 6).map((item) => \`- \${item}\`).join("\n") || "- No recommendations generated."}
\`;
}

function buildActionTable(actions) {
  if (!actions.length) return "No priority actions generated.";

  const rows = actions.map((action) =>
    \`| \${markdownCell(action.priority.toUpperCase())} | \${markdownCell(action.domain)} | \${markdownCell(action.title)} | \${markdownCell(action.nextAction || action.detail || action.reason || "Review")} |\`
  );

  return [
    "| Priority | Domain | Action | Next step |",
    "| --- | --- | --- | --- |",
    ...rows
  ].join("\n");
}

function buildProjectHealthTable(projects) {
  if (!projects.length) return "No tracked projects.";

  const rows = projects.map((project) =>
    \`| \${markdownCell(project.name)} | \${markdownCell(project.status)} | \${markdownCell(project.branch || "n/a")} | \${project.changedFiles} | \${project.recentCommits} | \${project.uncommittedChanges} | \${project.todoCount} |\`
  );

  return [
    "| Project | Status | Branch | Changes | Commits | Uncommitted | TODOs |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ...rows
  ].join("\n");
}

function buildWaitingOnList(items) {
  if (!items.length) return "- Nothing is currently tracked as waiting on someone else.";

  return items
    .slice(0, 10)
    .map((item) => \`- **\${item.contact || item.awaiting_response_from || "Pending response"}** — \${item.commitment || item.topic || "Awaiting response"} (\${item.ageHours}h)\`)
    .join("\n");
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\\\|").replaceAll("\n", " ");
}
