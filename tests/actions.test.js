import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationalIntelligence } from "../src/core/actions.js";

test("operational intelligence prioritizes urgent work and surfaces project health", () => {
  const now = new Date("2030-01-15T09:00:00Z");
  const projects = [
    {
      name: "demo",
      fileCounts: { created: 2, modified: 8, deleted: 0 },
      git: {
        branch: "feature/demo",
        status: Array.from({ length: 9 }, (_, index) => ` M file-${index}.js`),
        commitsSinceLastScan: [{ subject: "feat: demo" }],
        lastCommit: { timestamp: "2030-01-15T08:00:00Z" }
      },
      todos: [{ file: "app.js", line: 1 }],
      changes: { renamedCandidates: [] },
      pendingWork: ["9 uncommitted changes"]
    }
  ];

  const crossDomain = {
    schedule: { conflicts: ["Meeting A overlaps with Meeting B"] },
    academics: {
      overdue: [
        {
          title: "Submit assignment",
          course: "AI",
          due_at: "2030-01-14T17:00:00Z",
          due_label: "14 Jan 2030, 17:00"
        }
      ],
      dueSoon: []
    },
    responsibilities: { overdue: [], upcoming: [] },
    communications: {
      pending: [
        {
          contact: "Example Client",
          channel: "email",
          commitment: "Send follow-up",
          priority: "high",
          ageHours: 30
        }
      ]
    }
  };

  const result = buildOperationalIntelligence(projects, crossDomain, false, now);

  assert.equal(result.actions[0].priority, "critical");
  assert.ok(result.topActions.some((action) => action.title === "Review demo working tree"));
  assert.equal(result.projectHealth[0].status, "attention");
  assert.equal(result.projectHealth[0].uncommittedChanges, 9);
  assert.equal(result.metrics.projectsNeedingAttention, 1);
});
