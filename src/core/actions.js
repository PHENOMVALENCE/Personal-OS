import { slugify } from "./utils.js";

const PRIORITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export function buildOperationalIntelligence(projects, crossDomain, isBaselineScan, now = new Date()) {
  const actions = [
    ...buildScheduleActions(crossDomain.schedule),
    ...buildAcademicActions(crossDomain.academics, now),
    ...buildResponsibilityActions(crossDomain.responsibilities, now),
    ...buildCommunicationActions(crossDomain.communications),
    ...buildProjectActions(projects, isBaselineScan)
  ].sort(sortActions);

  const projectHealth = projects.map((project) => buildProjectHealth(project, isBaselineScan, now));
  const topActions = actions.slice(0, 12);

  return {
    actions,
    topActions,
    projectHealth,
    metrics: {
      criticalActions: actions.filter((action) => action.priority === "critical").length,
      highActions: actions.filter((action) => action.priority === "high").length,
      activeProjects: projectHealth.filter((project) => project.status === "active").length,
      projectsNeedingAttention: projectHealth.filter((project) => project.status === "attention").length
    }
  };
}

function buildScheduleActions(schedule) {
  return schedule.conflicts.map((conflict, index) =>
    createAction({
      id: `schedule-conflict-${index + 1}`,
      title: "Resolve schedule conflict",
      detail: conflict,
      priority: "critical",
      domain: "schedule",
      reason: "Two recorded commitments overlap."
    })
  );
}

function buildAcademicActions(academics, now) {
  const overdue = academics.overdue.map((item) =>
    createAction({
      id: `academic-overdue-${slugify(item.course || "course")}-${slugify(item.title)}`,
      title: item.title,
      detail: `${item.course} · overdue since ${item.due_label}`,
      priority: "critical",
      domain: "academics",
      dueAt: item.due_at,
      reason: "Academic work is overdue.",
      nextAction: "Complete, reschedule, or explicitly close this academic item."
    })
  );

  const dueSoon = academics.dueSoon.map((item) => {
    const hours = hoursUntil(item.due_at, now);
    return createAction({
      id: `academic-due-${slugify(item.course || "course")}-${slugify(item.title)}`,
      title: item.title,
      detail: `${item.course} · due ${item.due_label}`,
      priority: hours <= 48 ? "high" : "medium",
      domain: "academics",
      dueAt: item.due_at,
      reason: hours <= 48 ? "Academic deadline is within 48 hours." : "Academic deadline is approaching.",
      nextAction: "Reserve a focused study block."
    });
  });

  return [...overdue, ...dueSoon];
}

function buildResponsibilityActions(responsibilities, now) {
  const overdue = responsibilities.overdue.map((item) =>
    createAction({
      id: `responsibility-overdue-${slugify(item.area)}-${slugify(item.title)}`,
      title: item.title,
      detail: `${item.area} · overdue since ${item.due_label}`,
      priority: "critical",
      domain: "responsibilities",
      dueAt: item.due_at,
      reason: "A responsibility commitment is overdue.",
      nextAction: "Complete it or renegotiate the deadline."
    })
  );

  const upcoming = responsibilities.upcoming.map((item) => {
    const hours = hoursUntil(item.due_at, now);
    if (hours > 72) return null;

    return createAction({
      id: `responsibility-due-${slugify(item.area)}-${slugify(item.title)}`,
      title: item.title,
      detail: `${item.area} · due ${item.due_label}`,
      priority: hours <= 24 ? "high" : "medium",
      domain: "responsibilities",
      dueAt: item.due_at,
      reason: "A responsibility deadline is approaching.",
      nextAction: "Prepare the next concrete deliverable."
    });
  }).filter(Boolean);

  return [...overdue, ...upcoming];
}

function buildCommunicationActions(communications) {
  return communications.pending.map((conversation) => {
    const priority =
      conversation.priority === "high" || conversation.ageHours >= 72
        ? "high"
        : conversation.priority === "medium" || conversation.ageHours >= 24
          ? "medium"
          : "low";

    return createAction({
      id: `communication-${slugify(conversation.contact || "contact")}-${slugify(conversation.channel || "channel")}`,
      title: `Follow up with ${conversation.contact}`,
      detail: conversation.commitment || conversation.topic || "Pending communication",
      priority,
      domain: "communications",
      reason: `Communication has been pending for approximately ${conversation.ageHours} hour(s).`,
      nextAction: `Reply via ${conversation.channel || "the recorded channel"}.`
    });
  });
}

function buildProjectActions(projects, isBaselineScan) {
  if (isBaselineScan) return [];

  return projects.flatMap((project) => {
    const actions = [];
    const uncommitted = project.git.status.length;

    if (uncommitted >= 8) {
      actions.push(
        createAction({
          id: `project-working-tree-${slugify(project.name)}`,
          title: `Review ${project.name} working tree`,
          detail: `${uncommitted} uncommitted change(s) detected`,
          priority: "high",
          domain: "projects",
          project: project.name,
          reason: "A large working tree increases context-switching and recovery risk.",
          nextAction: "Review, test, and split the work into coherent commits."
        })
      );
    } else if (uncommitted > 0) {
      actions.push(
        createAction({
          id: `project-working-tree-${slugify(project.name)}`,
          title: `Review ${project.name} working tree`,
          detail: `${uncommitted} uncommitted change(s) detected`,
          priority: "medium",
          domain: "projects",
          project: project.name,
          reason: "There is unfinished local work.",
          nextAction: "Review and commit or discard intentional changes."
        })
      );
    }

    if (project.todos.length > 0) {
      actions.push(
        createAction({
          id: `project-todos-${slugify(project.name)}`,
          title: `Review ${project.name} TODO markers`,
          detail: `${project.todos.length} TODO/FIXME marker(s) detected in changed files`,
          priority: "medium",
          domain: "projects",
          project: project.name,
          reason: "Changed files contain explicit unfinished-work markers.",
          nextAction: "Resolve or convert important markers into tracked work."
        })
      );
    }

    return actions;
  });
}

function buildProjectHealth(project, isBaselineScan, now) {
  const changeCount = project.fileCounts.created + project.fileCounts.modified + project.fileCounts.deleted;
  const signals = [];
  const uncommitted = project.git.status.length;
  const todoCount = project.todos.length;
  const lastCommitAt = project.git.lastCommit?.timestamp ? new Date(project.git.lastCommit.timestamp) : null;
  const daysSinceCommit = lastCommitAt && !Number.isNaN(lastCommitAt.getTime())
    ? Math.floor((now.getTime() - lastCommitAt.getTime()) / 86400000)
    : null;

  if (uncommitted >= 8) signals.push(`${uncommitted} uncommitted changes`);
  else if (uncommitted > 0) signals.push(`${uncommitted} uncommitted change(s)`);

  if (todoCount > 0) signals.push(`${todoCount} TODO/FIXME marker(s)`);
  if (project.changes.renamedCandidates.length > 0) signals.push("potential rename(s) need verification");
  if (daysSinceCommit !== null && daysSinceCommit >= 7) signals.push(`last commit ${daysSinceCommit} day(s) ago`);

  let status = "steady";
  if (isBaselineScan) status = "baseline";
  else if (uncommitted >= 8 || project.changes.renamedCandidates.length > 0) status = "attention";
  else if (changeCount > 0 || project.git.commitsSinceLastScan.length > 0) status = "active";

  return {
    name: project.name,
    status,
    branch: project.git.branch,
    changedFiles: changeCount,
    recentCommits: project.git.commitsSinceLastScan.length,
    uncommittedChanges: uncommitted,
    todoCount,
    daysSinceCommit,
    signals
  };
}

function createAction(action) {
  return {
    id: action.id,
    title: action.title,
    detail: action.detail || "",
    priority: action.priority || "medium",
    domain: action.domain || "general",
    project: action.project || null,
    dueAt: action.dueAt || null,
    reason: action.reason || "",
    nextAction: action.nextAction || ""
  };
}

function sortActions(left, right) {
  const priorityDifference = PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
  if (priorityDifference !== 0) return priorityDifference;

  const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
  if (leftDue !== rightDue) return leftDue - rightDue;

  return left.title.localeCompare(right.title);
}

function hoursUntil(value, now) {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((due.getTime() - now.getTime()) / 36e5));
}
