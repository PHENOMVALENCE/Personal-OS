import path from "node:path";
import { buildOperationalIntelligence } from "./actions.js";
import { getRootDir } from "./config.js";
import { loadDomainState } from "./domains.js";
import { scanProjects } from "./projects.js";
import { readJson } from "./utils.js";

export function runScan(config) {
  const rootDir = getRootDir();
  const previousSnapshot = readJson(path.join(config.stateDir, "latest-snapshot.json"), null);
  const isBaselineScan = !previousSnapshot;
  const generatedAt = new Date().toISOString();
  const projects = scanProjects(config, previousSnapshot, new Date(generatedAt), isBaselineScan);
  const crossDomain = loadDomainState(rootDir);
  const executiveSummary = buildExecutiveSummary(projects, crossDomain, isBaselineScan);
  const operationalIntelligence = buildOperationalIntelligence(projects, crossDomain, isBaselineScan, new Date(generatedAt));
  const highPriorityActions = operationalIntelligence.topActions.map(formatAction);
  const recommendations = buildRecommendations(projects, crossDomain, isBaselineScan);

  return {
    generatedAt,
    monitorWindowHours: config.scanWindowHours,
    isBaselineScan,
    projects,
    crossDomain,
    executiveSummary,
    operationalIntelligence,
    highPriorityActions,
    recommendations
  };
}

function buildExecutiveSummary(projects, crossDomain, isBaselineScan) {
  const totalFilesChanged = projects.reduce(
    (sum, project) => sum + project.fileCounts.created + project.fileCounts.modified + project.fileCounts.deleted,
    0
  );
  const activeProjects = projects.filter((project) => project.fileCounts.created + project.fileCounts.modified + project.fileCounts.deleted > 0);
  const recentCommits = projects.reduce((sum, project) => sum + project.git.commitsSinceLastScan.length, 0);
  const overdueItems = crossDomain.academics.overdue.length + crossDomain.responsibilities.overdue.length;
  const followUps = crossDomain.communications.pending.length;

  const summary = isBaselineScan
    ? [
        `Initial baseline captured across ${projects.length} tracked project(s).`,
        `${recentCommits} recent commit(s) were recorded for context, and future scans will focus on real deltas.`,
        `${overdueItems} overdue item(s) and ${followUps} pending follow-up conversation(s) need visibility.`
      ].join(" ")
    : [
        `${activeProjects.length} of ${projects.length} tracked project(s) changed in the last scan window.`,
        `${totalFilesChanged} file change(s) and ${recentCommits} recent commit(s) were detected.`,
        `${overdueItems} overdue item(s) and ${followUps} pending follow-up conversation(s) need visibility.`
      ].join(" ");

  return {
    totalFilesChanged,
    activeProjects: activeProjects.length,
    recentCommits,
    overdueItems,
    followUps,
    summary
  };
}

function formatAction(action) {
  const detail = action.detail ? `: ${action.detail}` : "";
  return `[${action.priority.toUpperCase()}] ${action.title}${detail}`;
}

function buildRecommendations(projects, crossDomain, isBaselineScan) {
  const recommendations = [];
  const leastStableProject = [...projects].sort(
    (left, right) => right.fileCounts.modified + right.fileCounts.created - (left.fileCounts.modified + left.fileCounts.created)
  )[0];

  if (isBaselineScan) {
    recommendations.push("Let the next scheduled scan establish real project movement before drawing strong development conclusions.");
  } else if (leastStableProject && leastStableProject.fileCounts.modified > 0) {
    recommendations.push(`Run a focused review on ${leastStableProject.name}; it has the heaviest recent churn.`);
  }

  if (crossDomain.academics.dueSoon.length > 0) {
    recommendations.push(`Reserve a study block for ${crossDomain.academics.dueSoon[0].title} before ${crossDomain.academics.dueSoon[0].due_label}.`);
  }

  if (crossDomain.communications.highPriority.length > 0) {
    recommendations.push("Close at least one high-priority communication loop before the next scan window.");
  }

  if (crossDomain.responsibilities.upcoming.length > 0) {
    recommendations.push(`Prepare the next deliverable in ${crossDomain.responsibilities.upcoming[0].area} early to avoid deadline compression.`);
  }

  if (crossDomain.finance.upcomingBills.length > 0) {
    recommendations.push(`Review cash commitments for ${crossDomain.finance.upcomingBills[0].title} and confirm it is covered.`);
  }

  return recommendations.slice(0, 10);
}
