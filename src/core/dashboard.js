import { formatDateTime } from "./utils.js";

export function buildDashboard(scanResult) {
  const intelligence = scanResult.operationalIntelligence || {
    topActions: [],
    projectHealth: [],
    metrics: {
      criticalActions: 0,
      highActions: 0,
      projectsNeedingAttention: 0
    }
  };

  const waitingOn = scanResult.crossDomain.communications.waitingOn || [];
  const today = scanResult.crossDomain.schedule.today || [];
  const actions = intelligence.topActions || [];
  const projectHealth = intelligence.projectHealth || [];

  return \`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Personal OS · Command Center</title>
  <style>
    :root {
      --bg: #071019;
      --panel: #0d1823;
      --panel-2: #101f2c;
      --line: rgba(255,255,255,.08);
      --text: #f6f8fb;
      --muted: #93a4b5;
      --blue: #6ea8fe;
      --cyan: #67e8f9;
      --green: #59d499;
      --amber: #f6c85f;
      --red: #ff7a90;
      --violet: #a78bfa;
      --shadow: 0 24px 70px rgba(0,0,0,.32);
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at 10% 0%, rgba(76, 125, 255, .22), transparent 28rem),
        radial-gradient(circle at 95% 10%, rgba(103, 232, 249, .12), transparent 24rem),
        linear-gradient(180deg, #08111b 0%, #050a10 100%);
      font-family: Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    button, input { font: inherit; }
    a { color: inherit; }

    .app {
      width: min(1480px, calc(100% - 32px));
      margin: 0 auto;
      padding: 24px 0 56px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 18px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 760;
      letter-spacing: -.02em;
    }

    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 13px;
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, rgba(110,168,254,.24), rgba(103,232,249,.12));
      border: 1px solid rgba(110,168,254,.35);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      color: var(--muted);
      border: 1px solid var(--line);
      background: rgba(255,255,255,.035);
      font-size: .83rem;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: \${scanResult.isBaselineScan ? "var(--amber)" : "var(--green)"};
      box-shadow: 0 0 16px currentColor;
    }

    .hero {
      position: relative;
      overflow: hidden;
      padding: clamp(26px, 4vw, 48px);
      border-radius: 28px;
      border: 1px solid var(--line);
      background:
        linear-gradient(135deg, rgba(16,31,44,.96), rgba(9,20,31,.92)),
        var(--panel);
      box-shadow: var(--shadow);
    }

    .hero::after {
      content: "";
      position: absolute;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      right: -100px;
      top: -150px;
      background: radial-gradient(circle, rgba(110,168,254,.18), transparent 68%);
      pointer-events: none;
    }

    .eyebrow {
      margin: 0 0 10px;
      color: var(--cyan);
      font-weight: 700;
      font-size: .78rem;
      letter-spacing: .16em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      max-width: 900px;
      font-size: clamp(2.4rem, 6vw, 5.5rem);
      line-height: .94;
      letter-spacing: -.065em;
    }

    .hero-copy {
      max-width: 900px;
      margin: 20px 0 0;
      color: #b9c5d2;
      line-height: 1.65;
      font-size: clamp(.98rem, 1.5vw, 1.12rem);
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 30px;
    }

    .metric {
      min-height: 112px;
      padding: 18px;
      border-radius: 20px;
      background: rgba(255,255,255,.035);
      border: 1px solid var(--line);
    }

    .metric strong {
      display: block;
      font-size: 2rem;
      line-height: 1;
      letter-spacing: -.05em;
      margin-bottom: 9px;
    }

    .metric span {
      color: var(--muted);
      font-size: .86rem;
    }

    .main-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.55fr) minmax(320px, .75fr);
      gap: 18px;
      margin-top: 18px;
      align-items: start;
    }

    .stack { display: grid; gap: 18px; }

    .panel {
      border-radius: 24px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(15,28,40,.96), rgba(10,20,30,.96));
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 22px;
      border-bottom: 1px solid var(--line);
    }

    .panel-head h2 {
      margin: 0;
      font-size: 1rem;
      letter-spacing: -.01em;
    }

    .panel-head p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: .82rem;
    }

    .panel-body { padding: 18px 22px 22px; }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .filter {
      border: 1px solid var(--line);
      color: var(--muted);
      background: rgba(255,255,255,.035);
      border-radius: 999px;
      padding: 7px 10px;
      cursor: pointer;
      transition: .16s ease;
      font-size: .78rem;
    }

    .filter:hover, .filter.active {
      color: var(--text);
      border-color: rgba(110,168,254,.42);
      background: rgba(110,168,254,.11);
    }

    .action-list { display: grid; gap: 10px; }

    .action {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      padding: 15px;
      border-radius: 17px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.025);
    }

    .priority-bar {
      width: 4px;
      min-height: 100%;
      border-radius: 999px;
      background: var(--blue);
    }

    .action[data-priority="critical"] .priority-bar { background: var(--red); }
    .action[data-priority="high"] .priority-bar { background: var(--amber); }
    .action[data-priority="medium"] .priority-bar { background: var(--blue); }
    .action[data-priority="low"] .priority-bar { background: var(--green); }

    .action-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .action-title {
      font-weight: 690;
      letter-spacing: -.012em;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 7px;
      font-size: .68rem;
      font-weight: 760;
      letter-spacing: .04em;
      text-transform: uppercase;
      border: 1px solid var(--line);
      color: var(--muted);
      background: rgba(255,255,255,.03);
    }

    .badge.critical { color: var(--red); background: rgba(255,122,144,.08); }
    .badge.high { color: var(--amber); background: rgba(246,200,95,.08); }
    .badge.medium { color: var(--blue); background: rgba(110,168,254,.08); }
    .badge.low { color: var(--green); background: rgba(89,212,153,.08); }

    .action-detail, .action-reason, .empty {
      color: var(--muted);
      line-height: 1.5;
      font-size: .86rem;
    }

    .next {
      margin-top: 8px;
      color: #dce7f1;
      font-size: .84rem;
    }

    .next strong { color: var(--cyan); font-weight: 680; }

    .timeline { display: grid; gap: 12px; }

    .event {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: 12px;
      align-items: start;
    }

    .event-time {
      color: var(--cyan);
      font-size: .79rem;
      font-variant-numeric: tabular-nums;
      line-height: 1.45;
    }

    .event-card {
      padding: 12px 13px;
      border-radius: 15px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.025);
    }

    .event-card strong {
      display: block;
      font-size: .9rem;
    }

    .event-card span {
      display: block;
      color: var(--muted);
      font-size: .78rem;
      margin-top: 4px;
    }

    .project-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 10px;
    }

    .project {
      padding: 15px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.025);
    }

    .project-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .project-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
      letter-spacing: -.02em;
    }

    .project-meta {
      margin-top: 12px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
    }

    .project-meta div {
      padding: 8px;
      border-radius: 12px;
      background: rgba(255,255,255,.025);
      border: 1px solid rgba(255,255,255,.045);
    }

    .project-meta strong {
      display: block;
      font-size: .93rem;
    }

    .project-meta span {
      color: var(--muted);
      font-size: .68rem;
    }

    .signals {
      margin: 11px 0 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .signals li {
      color: var(--muted);
      font-size: .7rem;
      padding: 5px 7px;
      border-radius: 999px;
      border: 1px solid var(--line);
    }

    .status-chip {
      display: inline-flex;
      border-radius: 999px;
      padding: 5px 8px;
      font-size: .67rem;
      text-transform: uppercase;
      letter-spacing: .055em;
      font-weight: 780;
      border: 1px solid var(--line);
    }

    .status-chip.active { color: var(--green); }
    .status-chip.attention { color: var(--red); }
    .status-chip.steady { color: var(--blue); }
    .status-chip.baseline { color: var(--amber); }

    .compact-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 9px;
    }

    .compact-list li {
      padding: 11px 12px;
      border-radius: 14px;
      background: rgba(255,255,255,.024);
      border: 1px solid var(--line);
    }

    .compact-list strong {
      display: block;
      font-size: .85rem;
    }

    .compact-list span {
      display: block;
      color: var(--muted);
      font-size: .76rem;
      line-height: 1.45;
      margin-top: 4px;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 20px;
      color: var(--muted);
      font-size: .78rem;
    }

    @media (max-width: 980px) {
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .main-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 680px) {
      .app { width: min(100% - 20px, 1480px); padding-top: 14px; }
      .topbar { align-items: flex-start; }
      .status { display: none; }
      .hero { border-radius: 22px; padding: 24px 20px; }
      .metrics { grid-template-columns: 1fr 1fr; }
      .metric { min-height: 96px; padding: 14px; }
      .project-grid { grid-template-columns: 1fr; }
      .panel-head { align-items: flex-start; flex-direction: column; }
      .event { grid-template-columns: 72px 1fr; }
      .footer { flex-direction: column; }
    }

    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <main class="app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">OS</div>
        <div>Personal OS <span style="color:var(--muted);font-weight:500">/ Command Center</span></div>
      </div>
      <div class="status"><span class="dot"></span>\${scanResult.isBaselineScan ? "Baseline captured" : "Operational scan active"}</div>
    </header>

    <section class="hero">
      <p class="eyebrow">Operational intelligence</p>
      <h1>What needs your attention now.</h1>
      <p class="hero-copy">\${escapeHtml(scanResult.executiveSummary.summary)}</p>

      <div class="metrics">
        \${metricCard(intelligence.metrics.criticalActions, "Critical actions")}
        \${metricCard(intelligence.metrics.highActions, "High-priority actions")}
        \${metricCard(intelligence.metrics.projectsNeedingAttention, "Projects needing attention")}
        \${metricCard(scanResult.crossDomain.communications.pending.length, "Pending follow-ups")}
      </div>
    </section>

    <section class="main-grid">
      <div class="stack">
        <section class="panel" aria-labelledby="actions-title">
          <div class="panel-head">
            <div>
              <h2 id="actions-title">Top actions</h2>
              <p>Prioritized across projects and personal domains.</p>
            </div>
            <div class="filters" aria-label="Action priority filter">
              <button class="filter active" data-filter="all" type="button">All</button>
              <button class="filter" data-filter="critical" type="button">Critical</button>
              <button class="filter" data-filter="high" type="button">High</button>
              <button class="filter" data-filter="medium" type="button">Medium</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="action-list">
              \${actions.length ? actions.map(actionCard).join("") : '<div class="empty">No priority actions generated from the current state.</div>'}
            </div>
          </div>
        </section>

        <section class="panel" aria-labelledby="projects-title">
          <div class="panel-head">
            <div>
              <h2 id="projects-title">Project health</h2>
              <p>Activity, working-tree pressure, TODO signals, and recency.</p>
            </div>
          </div>
          <div class="panel-body">
            <div class="project-grid">
              \${projectHealth.length ? projectHealth.map(projectCard).join("") : '<div class="empty">No tracked projects found.</div>'}
            </div>
          </div>
        </section>
      </div>

      <aside class="stack">
        <section class="panel" aria-labelledby="today-title">
          <div class="panel-head">
            <div>
              <h2 id="today-title">Today</h2>
              <p>\${today.length} scheduled item(s) · \${scanResult.crossDomain.schedule.conflicts.length} conflict warning(s)</p>
            </div>
          </div>
          <div class="panel-body">
            <div class="timeline">
              \${today.length ? today.map(eventCard).join("") : '<div class="empty">No events recorded for today.</div>'}
            </div>
          </div>
        </section>

        <section class="panel" aria-labelledby="waiting-title">
          <div class="panel-head">
            <div>
              <h2 id="waiting-title">Waiting on</h2>
              <p>Items currently dependent on someone else.</p>
            </div>
          </div>
          <div class="panel-body">
            \${compactList(
              waitingOn.slice(0, 8).map((item) => ({
                title: item.contact || item.awaiting_response_from || "Pending response",
                detail: \`\${item.commitment || item.topic || "Awaiting response"} · \${item.ageHours}h\`
              })),
              "No external responses are currently tracked."
            )}
          </div>
        </section>

        <section class="panel" aria-labelledby="deadlines-title">
          <div class="panel-head">
            <div>
              <h2 id="deadlines-title">Upcoming deadlines</h2>
              <p>Academic and responsibility commitments.</p>
            </div>
          </div>
          <div class="panel-body">
            \${compactList(buildDeadlineItems(scanResult), "No near-term deadlines recorded.")}
          </div>
        </section>

        <section class="panel" aria-labelledby="recommendations-title">
          <div class="panel-head">
            <div>
              <h2 id="recommendations-title">System recommendations</h2>
              <p>Deterministic suggestions from the latest scan.</p>
            </div>
          </div>
          <div class="panel-body">
            \${compactList(
              scanResult.recommendations.slice(0, 6).map((item) => ({ title: item, detail: "" })),
              "No recommendations generated."
            )}
          </div>
        </section>
      </aside>
    </section>

    <footer class="footer">
      <span>Generated locally · Personal OS</span>
      <span>Last updated \${escapeHtml(formatDateTime(scanResult.generatedAt))}</span>
    </footer>
  </main>

  <script>
    document.querySelectorAll(".filter").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        const filter = button.dataset.filter;
        document.querySelectorAll(".action").forEach((item) => {
          item.hidden = filter !== "all" && item.dataset.priority !== filter;
        });
      });
    });
  </script>
</body>
</html>\`;
}

function metricCard(value, label) {
  return \`<div class="metric"><strong>\${escapeHtml(value)}</strong><span>\${escapeHtml(label)}</span></div>\`;
}

function actionCard(action) {
  return \`
    <article class="action" data-priority="\${escapeHtml(action.priority)}">
      <div class="priority-bar" aria-hidden="true"></div>
      <div>
        <div class="action-top">
          <span class="action-title">\${escapeHtml(action.title)}</span>
          <span class="badge \${escapeHtml(action.priority)}">\${escapeHtml(action.priority)}</span>
          <span class="badge">\${escapeHtml(action.domain)}</span>
        </div>
        \${action.detail ? \`<div class="action-detail">\${escapeHtml(action.detail)}</div>\` : ""}
        \${action.reason ? \`<div class="action-reason">\${escapeHtml(action.reason)}</div>\` : ""}
        \${action.nextAction ? \`<div class="next"><strong>Next:</strong> \${escapeHtml(action.nextAction)}</div>\` : ""}
      </div>
    </article>\`;
}

function eventCard(event) {
  const start = formatClock(event.starts_at);
  const end = formatClock(event.ends_at);
  return \`
    <div class="event">
      <div class="event-time">\${escapeHtml(start)}<br>→ \${escapeHtml(end)}</div>
      <div class="event-card">
        <strong>\${escapeHtml(event.title)}</strong>
        \${event.location ? \`<span>\${escapeHtml(event.location)}</span>\` : ""}
      </div>
    </div>\`;
}

function projectCard(project) {
  const signals = project.signals.length
    ? \`<ul class="signals">\${project.signals.slice(0, 4).map((signal) => \`<li>\${escapeHtml(signal)}</li>\`).join("")}</ul>\`
    : '<ul class="signals"><li>No major risk signals</li></ul>';

  return \`
    <article class="project">
      <div class="project-top">
        <div class="project-name" title="\${escapeHtml(project.name)}">\${escapeHtml(project.name)}</div>
        <span class="status-chip \${escapeHtml(project.status)}">\${escapeHtml(project.status)}</span>
      </div>
      <div class="project-meta">
        <div><strong>\${escapeHtml(project.changedFiles)}</strong><span>changes</span></div>
        <div><strong>\${escapeHtml(project.recentCommits)}</strong><span>commits</span></div>
        <div><strong>\${escapeHtml(project.uncommittedChanges)}</strong><span>uncommitted</span></div>
      </div>
      \${signals}
    </article>\`;
}

function compactList(items, emptyText) {
  if (!items.length) return \`<div class="empty">\${escapeHtml(emptyText)}</div>\`;
  return \`<ul class="compact-list">\${items
    .map((item) => \`<li><strong>\${escapeHtml(item.title)}</strong>\${item.detail ? \`<span>\${escapeHtml(item.detail)}</span>\` : ""}</li>\`)
    .join("")}</ul>\`;
}

function buildDeadlineItems(scanResult) {
  const academics = scanResult.crossDomain.academics.dueSoon.slice(0, 4).map((item) => ({
    title: item.title,
    detail: \`\${item.course} · \${item.due_label}\`
  }));
  const responsibilities = scanResult.crossDomain.responsibilities.upcoming.slice(0, 4).map((item) => ({
    title: item.title,
    detail: \`\${item.area} · \${item.due_label}\`
  }));

  return [...academics, ...responsibilities].slice(0, 7);
}

function formatClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
