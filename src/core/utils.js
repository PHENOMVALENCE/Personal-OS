import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

export function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function hoursBetween(start, end) {
  return Math.round(((end.getTime() - start.getTime()) / 36e5) * 10) / 10;
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function truncate(value, length = 140) {
  if (!value || value.length <= length) {
    return value;
  }

  return `${value.slice(0, Math.max(0, length - 3))}...`;
}

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfToday() {
  const date = startOfToday();
  date.setHours(23, 59, 59, 999);
  return date;
}

export function isSameDay(first, second) {
  return first.toDateString() === second.toDateString();
}

export function scorePriority(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

