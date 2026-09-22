import path from "node:path";
import { endOfToday, formatDateTime, readJson, scorePriority, startOfToday } from "./utils.js";

export function loadDomainState(rootDir) {
  const inputsDir = path.join(rootDir, "data", "inputs");

  const schedule = readJson(path.join(inputsDir, "schedule.json"), { events: [] });
  const academics = readJson(path.join(inputsDir, "academics.json"), { items: [] });
  const communications = readJson(path.join(inputsDir, "communications.json"), { conversations: [] });
  const responsibilities = readJson(path.join(inputsDir, "responsibilities.json"), { areas: [] });
  const finance = readJson(path.join(inputsDir, "finance.json"), { bills: [], goals: [] });
  const goals = readJson(path.join(inputsDir, "goals.json"), { goals: [] });

  return {
    schedule: summarizeSchedule(schedule.events || []),
    academics: summarizeAcademics(academics.items || []),
    communications: summarizeCommunications(communications.conversations || []),
    responsibilities: summarizeResponsibilities(responsibilities.areas || []),
    finance: summarizeFinance(finance),
    goals: goals.goals || []
  };
}

function summarizeSchedule(events) {
  const now = new Date();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const normalized = events
    .map((event) => ({
      ...event,
      startsAt: new Date(event.starts_at),
      endsAt: new Date(event.ends_at)
    }))
    .sort((left, right) => left.startsAt - right.startsAt);

  const today = normalized.filter((event) => event.startsAt >= todayStart && event.startsAt <= todayEnd);
  const upcoming = normalized.filter((event) => event.startsAt >= now && event.startsAt <= next24Hours);
  const conflicts = [];

  for (let index = 0; index < today.length - 1; index += 1) {
    const current = today[index];
    const next = today[index + 1];
    if (current.endsAt > next.startsAt) {
      conflicts.push(`${current.title} overlaps with ${next.title}`);
    }
  }

  return {
    today: today.map(toDisplayEvent),
    upcoming: upcoming.map(toDisplayEvent),
    conflicts
  };
}

function toDisplayEvent(event) {
  return {
    title: event.title,
    category: event.category,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    when: `${formatDateTime(event.startsAt)} - ${formatDateTime(event.endsAt)}`,
    location: event.location || null,
    notes: event.notes || ""
  };
}

function summarizeAcademics(items) {
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const normalized = items.map((item) => ({
    ...item,
    dueDate: new Date(item.due_at)
  }));

  const overdue = normalized.filter((item) => item.dueDate < now && item.status !== "done");
  const dueSoon = normalized
    .filter((item) => item.dueDate >= now && item.dueDate <= sevenDays && item.status !== "done")
    .sort(sortByDateThenPriority);

  return {
    overdue: overdue.map(toAcademicDisplay),
    dueSoon: dueSoon.map(toAcademicDisplay),
    priorities: dueSoon.slice(0, 5).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      course: item.course,
      due_at: item.due_at
    }))
  };
}

function toAcademicDisplay(item) {
  return {
    title: item.title,
    course: item.course,
    type: item.type,
    due_at: item.due_at,
    status: item.status,
    priority: item.priority,
    due_label: formatDateTime(item.dueDate)
  };
}

function summarizeCommunications(conversations) {
  const now = new Date();
  const pending = conversations
    .filter((conversation) => conversation.awaiting_response_from === "me" || conversation.needs_follow_up)
    .map((conversation) => ({
      ...conversation,
      ageHours: Math.round((now.getTime() - new Date(conversation.last_message_at).getTime()) / 36e5)
    }))
    .sort((left, right) => scorePriority(right.priority) - scorePriority(left.priority) || right.ageHours - left.ageHours);

  return {
    pending,
    highPriority: pending.filter((conversation) => conversation.priority === "high").slice(0, 8)
  };
}

function summarizeResponsibilities(areas) {
  const now = new Date();
  const flattened = areas.flatMap((area) =>
    (area.items || []).map((item) => ({
      ...item,
      area: area.name,
      dueDate: item.due_at ? new Date(item.due_at) : null
    }))
  );

  const overdue = flattened.filter((item) => item.dueDate && item.dueDate < now && item.status !== "done");
  const upcoming = flattened
    .filter((item) => item.dueDate && item.dueDate >= now && item.status !== "done")
    .sort(sortByDateThenPriority)
    .slice(0, 12);

  return {
    overdue: overdue.map(toResponsibilityDisplay),
    upcoming: upcoming.map(toResponsibilityDisplay)
  };
}

function toResponsibilityDisplay(item) {
  return {
    title: item.title,
    area: item.area,
    due_at: item.due_at,
    status: item.status,
    priority: item.priority,
    due_label: item.dueDate ? formatDateTime(item.dueDate) : "No due date"
  };
}

function summarizeFinance(finance) {
  const now = new Date();
  const upcomingBills = (finance.bills || [])
    .map((bill) => ({
      ...bill,
      dueDate: new Date(bill.due_at)
    }))
    .filter((bill) => bill.dueDate >= now && bill.status !== "paid")
    .sort((left, right) => left.dueDate - right.dueDate)
    .slice(0, 10)
    .map((bill) => ({
      title: bill.title,
      amount: bill.amount,
      due_at: bill.due_at,
      due_label: formatDateTime(bill.dueDate)
    }));

  return {
    upcomingBills,
    goals: finance.goals || []
  };
}

function sortByDateThenPriority(left, right) {
  return left.dueDate - right.dueDate || scorePriority(right.priority) - scorePriority(left.priority);
}

