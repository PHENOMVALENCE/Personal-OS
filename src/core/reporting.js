import path from "node:path";
import { maybeGenerateAiSummary } from "./llm.js";
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
    keyProjects: scanResult.projects.slice(0, 5),
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

function buildDashboard(scanResult) {
  const cards = [
    dashboardCard("Today", [
      `${scanResult.crossDomain.schedule.today.length} schedule item(s)`,
      `${scanResult.crossDomain.schedule.conflicts.length} conflict warning(s)`,
      `${scanResult.crossDomain.academics.dueSoon.length} academic due-soon item(s)`
    ]),
    dashboardCard(
      "Coding Projects",
      scanResult.projects.slice(0, 8).map((project) =>
        scanResult.isBaselineScan
          ? `${project.name}: baseline captured (${project.fileCounts.total} tracked file(s))`
          : `${project.name}: ${project.fileCounts.created + project.fileCounts.modified + project.fileCounts.deleted} file change(s)`
      )
    ),
    dashboardCard("University", [
      ...scanResult.crossDomain.academics.dueSoon.slice(0, 5).map((item) => `${item.title} due ${item.due_label}`),
      ...scanResult.crossDomain.academics.overdue.slice(0, 3).map((item) => `Overdue: ${item.title}`)
    ]),
    dashboardCard("YBF / AIESEC", filterArea(scanResult, "YBF / AIESEC")),
    dashboardCard("Church", filterArea(scanResult, "Church")),
    dashboardCard("Freelance Work", filterArea(scanResult, "Freelance Work")),
    dashboardCard("Finance", [
      ...scanResult.crossDomain.finance.upcomingBills.slice(0, 4).map((bill) => `${bill.title} due ${bill.due_label}`),
      ...scanResult.crossDomain.finance.goals.slice(0, 2).map((goal) => `${goal.title}: ${goal.current_amount}/${goal.target_amount}`)
    ]),
    dashboardCard("Messages & Follow-ups", scanResult.crossDomain.communications.pending.slice(0, 8).map((conversation) => `${conversation.contact}: ${conversation.commitment || conversation.topic}`)),
    dashboardCard("Goals", scanResult.crossDomain.goals.map((goal) => `${goal.title} (${goal.status})`)),
    dashboardCard("Recommendations", scanResult.recommendations)
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Personal Operating System Dashboard</title>
  <style>
    :root {
      --bg: #f4efe8;
      --panel: rgba(255, 252, 248, 0.88);
      --ink: #172121;
      --muted: #56666b;
      --accent: #d76b39;
      --accent-2: #2d5f5d;
      --line: rgba(23, 33, 33, 0.08);
      --shadow: 0 18px 50px rgba(44, 38, 30, 0.12);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Segoe UI", "Trebuchet MS", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(215, 107, 57, 0.18), transparent 26%),
        radial-gradient(circle at top right, rgba(45, 95, 93, 0.2), transparent 22%),
        linear-gradient(180deg, #fbf7f2 0%, var(--bg) 100%);
      min-height: 100vh;
    }

    .shell {
      width: min(1280px, calc(100% - 32px));
      margin: 24px auto 48px;
    }

    .hero {
      background: linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,248,241,0.9));
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 28px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }

    .hero::after {
      content: "";
      position: absolute;
      width: 280px;
      height: 280px;
      border-radius: 50%;
      background: rgba(215, 107, 57, 0.12);
      right: -80px;
      top: -80px;
      filter: blur(12px);
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 4vw, 3.75rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
    }

    .subtitle {
      max-width: 760px;
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.6;
      margin: 0;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 14px;
      margin-top: 22px;
    }

    .stat {
      padding: 16px;
      background: rgba(255,255,255,0.7);
      border: 1px solid var(--line);
      border-radius: 18px;
    }

    .stat strong {
      display: block;
      font-size: 1.75rem;
      color: var(--accent-2);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      margin-top: 22px;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 20px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
    }

    .card h2 {
      margin: 0 0 12px;
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }

    ul {
      margin: 0;
      padding-left: 18px;
      color: var(--ink);
    }

    li + li {
      margin-top: 8px;
    }

    .footer {
      margin-top: 18px;
      color: var(--muted);
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <h1>Personal Operating System</h1>
      <p class="subtitle">${escapeHtml(scanResult.executiveSummary.summary)}</p>
      <div class="stats">
        <div class="stat"><strong>${scanResult.projects.length}</strong><span>Tracked projects</span></div>
        <div class="stat"><strong>${scanResult.executiveSummary.totalFilesChanged}</strong><span>Files changed</span></div>
        <div class="stat"><strong>${scanResult.highPriorityActions.length}</strong><span>Priority actions</span></div>
        <div class="stat"><strong>${scanResult.crossDomain.communications.pending.length}</strong><span>Pending follow-ups</span></div>
      </div>
      <p class="footer">Last updated ${escapeHtml(formatDateTime(scanResult.generatedAt))}</p>
    </section>
    <section class="grid">
      ${cards.join("\n")}
    </section>
  </main>
</body>
</html>`;
}

function dashboardCard(title, items) {
  const listItems = (items.length > 0 ? items : ["No major signals right now"])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  return `<article class="card"><h2>${escapeHtml(title)}</h2><ul>${listItems}</ul></article>`;
}

function filterArea(scanResult, areaName) {
  return scanResult.crossDomain.responsibilities.upcoming
    .filter((item) => item.area === areaName)
    .map((item) => `${item.title} due ${item.due_label}`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
