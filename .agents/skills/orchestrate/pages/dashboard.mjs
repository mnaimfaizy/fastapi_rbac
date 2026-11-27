/**
 * The past-runs dashboard as HTML: pure functions from Run Records to pages.
 *
 * `buildPages(entries, context)` returns the page list, the header links and
 * the Repository switcher; `renderDashboard` puts them in the shared shell.
 * Entries come from the local records and the configured sink alike, and a
 * repository is whatever namespace they came from. Later tickets add pages
 * to the list: the shell and the stylesheet do not change.
 *
 * An entry is `{record, repository, login, source}`. A Run Record holds no
 * prose, so nothing here can show any; the one prose is the local Activity
 * Log, which comes in through `context.logs` and only when the caller built
 * a local-only page.
 *
 * This module does not import `records.mjs` (which imports it, when the
 * command runs): `renderDashboard` is handed the vocabulary and checks it.
 *
 * Colour means `cause` and nothing else: a cause is a class (`c-<cause>`)
 * that the stylesheet colours, so no page element carries a colour itself.
 */

import { esc, shell } from "./shell.mjs";
import { peoplePanel, personPages, specPages, specRoute, specsOf } from "./teammates.mjs";

/** What each cause means and how to remove it. By design causes have nothing to remove. */
export const CAUSE_INFO = Object.freeze({
  "by-design": {
    avoidable: false,
    label: "By design",
    meaning:
      "A step the process asks for on purpose: approving the Dispatch Plan, the landing choice, close-out.",
    fix: "Nothing to fix. Shown so the total adds up.",
  },
  "teammate-blocker": {
    avoidable: false,
    label: "Teammate blocker",
    meaning: "A ticket was parked on a teammate's ticket, and the run waited for them.",
    fix: "Nothing to fix in the run. Plan the order of the spec's tickets around it.",
  },
  "human-choice": {
    avoidable: true,
    label: "Human choice",
    meaning:
      "A decision that was yours to make but could have been approved ahead of time: merging, merging the default branch in, passing QA Review boxes.",
    fix: "Approve it ahead of time if you always answer the same way.",
  },
  "harness-limit": {
    avoidable: true,
    label: "Harness limit",
    meaning:
      "The harness would not let the Chief of Staff do it: a session start refused on a background turn became a card click, or a command had to be typed.",
    fix: "Start Delegations from a user turn, batch the starts, or start QA from a brief.",
  },
  "permission-refusal": {
    avoidable: true,
    label: "Permission refusal",
    meaning: "A tool call was refused by the permission mode and needed you.",
    fix: "Allow the tool before the run.",
  },
  "missing-config": {
    avoidable: true,
    label: "Missing config",
    meaning:
      "You were asked for something the config or the Dispatch Plan could have answered: a review label, posting replies, a readiness answer.",
    fix: "Approve it as a routine write in the Dispatch Plan, or set it in orchestrate.config.yml.",
  },
  "spec-gap": {
    avoidable: true,
    label: "Spec gap",
    meaning:
      "The spec or ticket did not cover it: a scope fence too tight, an unclear review scope.",
    fix: "Widen the fences or state the scope when writing the tickets.",
  },
  "skill-bug": {
    avoidable: true,
    label: "Skill bug",
    meaning: "The skill did the wrong thing and you caught it, or it asked twice.",
    fix: "File it against the skill.",
  },
  "tool-missing": {
    avoidable: true,
    label: "Tool missing",
    meaning: "A tool the run needed was not there, so you did it by hand.",
    fix: "Install or configure the tool, or teach the skill to start it.",
  },
  other: {
    avoidable: true,
    label: "Other",
    meaning: "Not yet classified.",
    fix: "Classify it. A new cause may be needed.",
  },
});

/** One sentence per human step kind: what the person did. */
export const KIND_INFO = Object.freeze({
  "plan-approval": "approved the Dispatch Plan",
  "card-start": "clicked a card to start a Delegation the Chief of Staff could not start itself",
  "decision-request": "answered a Decision Request",
  "write-as-human": "had the Chief of Staff make a write in their name",
  "typed-command": "typed a command into a session",
  "readiness-answer": "answered a readiness question",
  "permission-refusal": "allowed a tool call that was refused",
  "review-label": "added a review label",
  "post-replies": "had the replies to a review posted",
  "ruling-review": "gave a verdict on a Ruling",
  merge: "merged a pull request",
  "close-out": "did a close-out step",
  "teammate-blocker": "waited on a teammate's ticket",
  "qa-command": "typed a QA command",
  "qa-readiness": "answered a QA readiness question",
  "qa-plan-delivery": "took delivery of a QA Plan",
  "qa-run-need": "started something QA needed to run",
  "qa-host": "set up the host for QA",
  "qa-held": "held a QA scenario back",
  other: "did something not yet in the list of kinds",
});

const MARK_INFO = [
  ["human-step", "A dot on the Human lane: one touch of a person. Its colour is the cause."],
  ["wait", "A band on the Human lane: how long the run waited before that touch. Same colour."],
  [
    "write",
    "A mark on the Chief of Staff lane: a write to the tracker. Filled for the Chief of Staff, hollow for a Delegation, light for a write in a human's name. Grey: a write has no cause.",
  ],
  [
    "delegation",
    "A bar on a Delegation's lane, from start to end, with a tick where it landed. Grey.",
  ],
  ["review", "A review round on the Reviews and CI lane. The record keeps no time for it. Grey."],
  ["ci", "A CI result on the Reviews and CI lane. The record keeps no time for it. Grey."],
];

const CAUSE_LIST = Object.keys(CAUSE_INFO);
const KIND_LIST = Object.keys(KIND_INFO);

/** The pages explain exactly the causes and kinds the records script knows: a drift is an error, not a blank. */
function checkVocabulary({ causes, stepKinds }) {
  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  for (const [cause, kind] of Object.entries(causes))
    if (CAUSE_INFO[cause]?.avoidable !== (kind === "avoidable"))
      throw new Error(`the dashboard does not know cause \`${cause}\` as ${kind}`);
  if (!same(Object.keys(causes), CAUSE_LIST) || !same([...stepKinds], KIND_LIST))
    throw new Error("the dashboard's causes or step kinds differ from the records script's");
}

// --- Small formatters.

const ms = (iso) => Date.parse(iso);
const day = (iso) => iso.slice(0, 10);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** `1h 53m`, `5m 20s`, `40s`. */
export function duration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** A cause chip: the colour of its cause, its name, and avoidable or by design. */
export function chip(cause) {
  const info = CAUSE_INFO[cause];
  const design = !info.avoidable;
  return `<span class="chip cause c-${cause}"><i class="sw"></i>${esc(info.label)} <span class="tag ${design ? "design" : "avoid"}">${design ? "by design" : "avoidable"}</span></span>`;
}

/** A state (an outcome, a result): always grey. */
const state = (text) => `<span class="state">${esc(text)}</span>`;

const code = (text) => `<code>${esc(text)}</code>`;

function table(head, rows, attrs = "") {
  return `<div class="scroll"><table${attrs}><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

// --- Routes.

const runRoute = (id) => `/run/${id}`;
const stepRoute = (id, n) => `${runRoute(id)}/step/${n}`;
const delegationRoute = (id, d) => `${runRoute(id)}/delegation/${d}`;
const link = (route, text) => `<a href="#${esc(route)}">${text}</a>`;

const TABS = [
  ["summary", "Summary"],
  ["timeline", "Timeline"],
  ["delegations", "Delegations"],
  ["steps", "Human steps"],
  ["reviews", "Reviews & CI"],
  ["log", "Log"],
  ["record", "Record (JSON)"],
];

/** A page. `repository` names the switcher option a run's page belongs to (its `data-repo`). */
const page = (id, html, repository = null) => ({
  id,
  html: `<section class="page" id="${esc(id)}"${repository ? ` data-repo="${esc(repoRoute(repository))}"` : ""}>\n${html}\n</section>`,
});

// --- The text derived from a record: Run Events as text, and the report.

/** The steps of a run as `{at, rank, text}` lines, from the record alone. */
function eventLines(record) {
  return eventLineEntries(record).map((l) => l.text);
}

/** The lines of eventLines, in order, each with `step`, the index of its human step, on that step's line. */
function eventLineEntries(record) {
  const { run } = record;
  const lines = [];
  const add = (at, rank, kind, fields, step = null) =>
    lines.push({
      at,
      rank,
      step,
      text: `${at}  ${kind.padEnd(19)}${fields.filter(Boolean).join(" ")}`,
    });
  add(run.started_at, 0, "run-opened", [
    `kind=${run.kind}`,
    run.spec !== undefined && `spec=${run.spec}`,
    `authority=${run.decision_authority}`,
    `harness=${run.harness}`,
  ]);
  if (run.plan_approved_at) add(run.plan_approved_at, 1, "plan-approved", []);
  for (const d of record.delegations) {
    add(d.started_at, 1, "delegation-started", [d.id, `kind=${d.kind}`, `route=${d.start_route}`]);
    if (d.landed_at) add(d.landed_at, 1, "delegation-landed", [d.id]);
    if (d.ended_at) add(d.ended_at, 1, "delegation-ended", [d.id, `outcome=${d.outcome}`]);
  }
  record.human_steps.forEach((s, n) => {
    if (s.opened_at)
      add(s.opened_at, 1, "wait-opened", [
        s.wait_id && `wait=${s.wait_id}`,
        s.delegation,
        `kind=${s.kind}`,
        `cause=${s.cause}`,
      ]);
    add(
      s.at,
      1,
      "human-step",
      [
        s.delegation,
        `kind=${s.kind}`,
        `actor=${s.actor}`,
        `cause=${s.cause}`,
        s.how && `how=${s.how}`,
        s.waited_seconds !== null && `waited=${duration(s.waited_seconds)}`,
      ],
      n,
    );
  });
  for (const w of record.writes)
    add(w.at, 1, "write", [w.delegation, `kind=${w.kind}`, `actor=${w.actor}`]);
  add(run.closed_at, 2, "run-closed", [`outcome=${run.outcome}`]);
  // Stable: lines of one second keep the order they were added in.
  return lines.sort((a, b) => ms(a.at) - ms(b.at) || a.rank - b.rank);
}

/** A short text report of the run, from the record alone. */
function reportText(record) {
  const { run, summary } = record;
  const out = [
    `Run ${run.id}`,
    `  ${[run.repo, run.kind + (run.spec === undefined ? "" : ` spec #${run.spec}`), run.decision_authority, run.landing, run.outcome, duration(run.duration_seconds)].filter(Boolean).join(" · ")}`,
    `  started ${run.started_at}, closed ${run.closed_at}${run.operator ? `, by ${run.operator}` : ""}`,
    "",
    `Human steps: ${plural(summary.human_steps, "human step")} (${summary.avoidable} avoidable, ${summary.by_design} by design), ${duration(summary.human_wait_seconds)} waiting`,
    ...Object.entries(summary.by_cause)
      .filter(([, n]) => n > 0)
      .map(([cause, n]) => `  ${cause.padEnd(20)}${n}`),
    "",
    "Delegations",
    ...record.delegations.map(
      (d) =>
        `  ${d.id.padEnd(10)}${d.kind.padEnd(10)}${d.outcome.padEnd(20)}${duration(d.duration_seconds ?? 0).padEnd(9)}send-backs ${d.send_backs}, decision requests ${d.decision_requests}, rulings ${d.rulings}`,
    ),
    "",
    `Reviews: ${record.reviews.map((r) => `PR #${r.pr} round ${r.round}: ${r.findings} findings, ${r.fixed} fixed`).join("; ") || "none"}`,
    `CI: ${record.ci.map((c) => `PR #${c.pr} ${c.head.slice(0, 7)} ${c.result}`).join("; ") || "none"}`,
    `Rulings: ${record.rulings.made} made, ${record.rulings.upheld} upheld, ${record.rulings.overturned} overturned`,
  ];
  return out.join("\n");
}

const logBox = (id, text, filename) =>
  `<div class="tools"><button class="btn" type="button" data-copy="${esc(id)}">Copy</button><button class="btn" type="button" data-download="${esc(id)}" data-filename="${esc(filename)}">Download</button></div>\n<pre class="log" id="${esc(id)}">${esc(text)}</pre>`;

// --- The Run page, tab by tab.

function tabs(entry, current) {
  const { record } = entry;
  const id = entry.slug;
  const counts = {
    delegations: record.delegations.length,
    steps: record.human_steps.length,
    reviews: record.reviews.length + record.ci.length,
  };
  return `<nav class="tabs">${TABS.map(
    ([tab, label]) =>
      `<a class="tab${tab === current ? " on" : ""}" href="#${esc(runRoute(id))}/${tab}">${esc(label)}${counts[tab] === undefined ? "" : ` <span class="n">${counts[tab]}</span>`}</a>`,
  ).join("")}</nav>`;
}

function runHead(entry, tab) {
  const { run } = entry.record;
  const id = run.id;
  const repository = entry.repository
    ? `${link(repoRoute(entry.repository), esc(entry.repository))} / `
    : "";
  return `<div class="crumbs"><a href="#/">All repositories</a> / ${repository}${esc(id)}</div>
<h1>${esc(id)}</h1>
<p class="muted">${[run.repo, run.operator && `by ${run.operator}`, `${run.kind} run${run.spec === undefined ? "" : ` over spec #${run.spec}`}`].filter(Boolean).map(esc).join(" · ")} · ${state(run.outcome)} ${notUploaded(entry)}</p>
${tabs(entry, tab)}`;
}

function summaryTab(entry) {
  const { record } = entry;
  const { run, summary } = record;
  const avoidable = Object.entries(summary.by_cause)
    .filter(([cause, n]) => n > 0 && CAUSE_INFO[cause].avoidable)
    .sort((a, b) => b[1] - a[1]);
  const all = Object.entries(summary.by_cause)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = Math.max(1, ...all.map(([, n]) => n));
  const improve = avoidable.length
    ? avoidable
        .map(
          ([cause, n]) =>
            `<div class="callout">${chip(cause)} <b>${plural(n, "step")}</b>. ${esc(CAUSE_INFO[cause].fix)}</div>`,
        )
        .join("\n")
    : `<p class="muted">Nothing avoidable: every human step was by design.</p>`;
  return `${runHead(entry, "summary")}
<p class="sentence">${plural(summary.human_steps, "human step")}, ${summary.avoidable} avoidable and ${summary.by_design} by design, with ${esc(duration(summary.human_wait_seconds))} waiting on a human.</p>
<div class="kpis">
  <div class="kpi"><b>${summary.human_steps}</b><span>${summary.human_steps === 1 ? "human step" : "human steps"}</span></div>
  <div class="kpi"><b>${summary.avoidable}</b><span>avoidable</span></div>
  <div class="kpi"><b>${summary.by_design}</b><span>by design</span></div>
  <div class="kpi"><b>${esc(duration(summary.human_wait_seconds))}</b><span>waiting on a human</span></div>
  <div class="kpi"><b>${esc(duration(run.duration_seconds))}</b><span>run length</span></div>
  <div class="kpi"><b>${record.delegations.length}</b><span>${record.delegations.length === 1 ? "Delegation" : "Delegations"}</span></div>
</div>
<div class="panel"><h2>Improve next run</h2>
<p class="muted small">The avoidable causes of this run, most common first, with the fix for each.</p>
${improve}</div>
<div class="panel"><h2>Why you were needed</h2>
${
  all.length
    ? all
        .map(
          ([cause, n]) =>
            `<div class="bar c-${cause}"><span class="lbl">${chip(cause)}</span><span class="track"><span class="fill" style="width:${Math.round((n / top) * 100)}%"></span></span><span class="val">${n}</span></div>`,
        )
        .join("\n")
    : `<p class="muted">The run needed no human step.</p>`
}</div>
<div class="panel"><h2>Plan</h2>
<dl class="dl">
  <dt>Tickets</dt><dd>${run.tickets.length ? run.tickets.map((n) => `#${n}`).join(", ") : "none"}</dd>
  <dt>Decision authority</dt><dd>${esc(run.decision_authority)}</dd>
  <dt>Landing</dt><dd>${esc(run.landing ?? "none")}</dd>
  <dt>Harness</dt><dd>${esc(run.harness)} (${esc(run.support_level)})</dd>
  <dt>Plan approved</dt><dd>${esc(run.plan_approved_at ?? "never")}</dd>
</dl></div>
<div class="panel"><h2>Outcome</h2>
<dl class="dl">
  <dt>Outcome</dt><dd>${state(run.outcome)}</dd>
  <dt>Pull requests</dt><dd>${run.pull_requests.length ? run.pull_requests.map((n) => `#${n}`).join(", ") : "none"}</dd>
  <dt>Started</dt><dd>${esc(run.started_at)}</dd>
  <dt>Closed</dt><dd>${esc(run.closed_at)}</dd>
  <dt>Open waits at close</dt><dd>${run.open_waits}</dd>
</dl></div>`;
}

const LANE_LABEL = 130;
const LANE_W = 800;
const LANE_H = 30;

function timelineTab(entry) {
  const { record } = entry;
  const { run } = record;
  const t0 = ms(run.started_at);
  const t1 = Math.max(ms(run.closed_at), t0 + 1);
  const x = (iso) => {
    const at = Math.min(Math.max(ms(iso), t0), t1);
    return LANE_LABEL + 10 + ((at - t0) / (t1 - t0)) * LANE_W;
  };
  const lanes = [
    { key: "human", label: "Human" },
    { key: "chief-of-staff", label: "Chief of Staff" },
    { key: "reviews-ci", label: "Reviews & CI" },
    ...record.delegations.map((d) => ({ key: `delegation:${d.id}`, label: d.id })),
  ];
  const height = lanes.length * LANE_H + 28;
  const y = (i) => i * LANE_H;
  const parts = [];
  lanes.forEach((lane, i) => {
    const cy = y(i) + LANE_H / 2;
    const marks = [];
    if (lane.key === "human") {
      for (const s of record.human_steps) {
        if (s.opened_at)
          marks.push(
            `<rect class="mark wait c-${s.cause}" x="${x(s.opened_at).toFixed(1)}" y="${cy - 5}" width="${Math.max(2, x(s.at) - x(s.opened_at)).toFixed(1)}" height="10"><title>${esc(`wait for ${duration(s.waited_seconds)}`)}</title></rect>`,
          );
      }
      record.human_steps.forEach((s, n) =>
        marks.push(
          `<a href="#${esc(stepRoute(entry.slug, n + 1))}"><circle class="mark human-step c-${s.cause} actor-${s.actor}" cx="${x(s.at).toFixed(1)}" cy="${cy}" r="${s.actor === "human" ? 5 : 3}"><title>${esc(`${s.kind}, ${CAUSE_INFO[s.cause].label}, ${s.at}`)}</title></circle></a>`,
        ),
      );
    } else if (lane.key === "chief-of-staff") {
      for (const w of record.writes)
        marks.push(
          `<rect class="mark write actor-${w.actor}" x="${(x(w.at) - 4).toFixed(1)}" y="${cy - 4}" width="8" height="8"><title>${esc(`${w.kind} by ${w.actor}, ${w.at}`)}</title></rect>`,
        );
    } else if (lane.key === "reviews-ci") {
      // The record keeps no time for a review or a CI result: they are drawn in order.
      const items = [
        ...record.reviews.map((r) => ["review", `PR #${r.pr} review round ${r.round}`]),
        ...record.ci.map((c) => ["ci", `PR #${c.pr} CI ${c.result}`]),
      ];
      items.forEach(([kind, title], n) =>
        marks.push(
          `<circle class="mark ${kind}" cx="${LANE_LABEL + 20 + n * 16}" cy="${cy}" r="4"><title>${esc(title)}</title></circle>`,
        ),
      );
      if (items.length)
        marks.push(
          `<text class="mt" x="${LANE_LABEL + 30 + items.length * 16}" y="${cy + 4}">in order: the record keeps no time for them</text>`,
        );
    } else {
      const d = record.delegations.find((e) => `delegation:${e.id}` === lane.key);
      const end = d.ended_at ?? d.landed_at ?? run.closed_at;
      marks.push(
        `<a href="#${esc(delegationRoute(entry.slug, d.id))}"><rect class="mark delegation" x="${x(d.started_at).toFixed(1)}" y="${cy - 5}" width="${Math.max(2, x(end) - x(d.started_at)).toFixed(1)}" height="10"><title>${esc(`${d.id}: ${d.outcome}, ${duration(d.duration_seconds ?? 0)}`)}</title></rect></a>`,
      );
      if (d.landed_at)
        marks.push(
          `<rect class="mark landed" x="${(x(d.landed_at) - 1).toFixed(1)}" y="${cy - 8}" width="2" height="16"></rect>`,
        );
      record.human_steps.forEach((s, n) => {
        if (s.delegation === d.id)
          marks.push(
            `<a href="#${esc(stepRoute(entry.slug, n + 1))}"><circle class="mark human-step c-${s.cause}" cx="${x(s.at).toFixed(1)}" cy="${cy}" r="4"></circle></a>`,
          );
      });
    }
    parts.push(
      `<g class="lane" data-lane="${esc(lane.key)}"><rect class="lane-bg" x="${LANE_LABEL}" y="${y(i) + 2}" width="${LANE_W + 20}" height="${LANE_H - 4}" rx="4"></rect><text x="4" y="${cy + 4}">${esc(lane.label)}</text>${marks.join("")}</g>`,
    );
  });
  const axisY = lanes.length * LANE_H + 14;
  parts.push(
    `<text class="mt" x="${LANE_LABEL}" y="${axisY}">${esc(run.started_at)}</text><text class="mt" x="${LANE_LABEL + LANE_W + 20}" y="${axisY}" text-anchor="end">${esc(run.closed_at)}</text>`,
  );
  const used = [...new Set(record.human_steps.map((s) => s.cause))];
  return `${runHead(entry, "timeline")}
<div class="panel"><h2>Timeline</h2>
<p class="muted small">One clock, from the start of the run to its close. Dots are human steps, coloured by cause; open one for the step. Everything else is grey.</p>
<svg class="timeline" viewBox="0 0 ${LANE_LABEL + LANE_W + 30} ${height}" role="img" aria-label="Timeline of ${esc(run.id)}">${parts.join("")}</svg>
<div class="legend">${used.map(chip).join(" ")}</div>
<p class="small">What each mark means: ${link("/key", "the Key")}.</p></div>`;
}

function delegationsTab(entry) {
  const { record } = entry;
  const id = entry.slug;
  return `${runHead(entry, "delegations")}
<div class="panel"><h2>Delegations</h2>${table(
    [
      "Id",
      "Issue",
      "Kind",
      "Executor",
      "Model",
      "Started",
      "Length",
      "Outcome",
      "Send-backs",
      "Steps",
    ],
    record.delegations.map((d) => {
      const steps = record.human_steps.filter((s) => s.delegation === d.id).length;
      return `<tr><td>${link(delegationRoute(id, d.id), esc(d.id))}</td><td>${d.issue === null ? "" : `#${d.issue}`}</td><td>${esc(d.kind)}</td><td>${esc(d.executor)}</td><td>${esc(d.model)}</td><td class="nowrap">${esc(d.started_at)}</td><td>${esc(duration(d.duration_seconds ?? 0))}</td><td>${state(d.outcome)}</td><td class="num">${d.send_backs}</td><td class="num">${steps}</td></tr>`;
    }),
  )}</div>`;
}

function stepRows(id, steps, only = null) {
  return steps
    .map((s, n) => ({ s, n }))
    .filter(({ s }) => only === null || s.delegation === only)
    .map(
      ({ s, n }) =>
        `<tr data-cause="${esc(s.cause)}" data-kind="${esc(s.kind)}" data-actor="${esc(s.actor)}"><td class="num">${link(stepRoute(id, n + 1), String(n + 1))}</td><td class="nowrap">${esc(s.at)}</td><td>${esc(s.kind)}</td><td>${chip(s.cause)}</td><td>${esc(s.actor)}</td><td>${s.delegation ? esc(s.delegation) : ""}</td><td class="num">${s.waited_seconds === null ? "" : esc(duration(s.waited_seconds))}</td><td>${s.how ? esc(s.how) : ""}</td></tr>`,
    );
}

function stepsTab(entry) {
  const { record } = entry;
  const id = entry.slug;
  const causes = [...new Set(record.human_steps.map((s) => s.cause))].sort();
  const kinds = [...new Set(record.human_steps.map((s) => s.kind))].sort();
  const actors = [...new Set(record.human_steps.map((s) => s.actor))].sort();
  const options = (values) =>
    `<option value="">all</option>${values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}`;
  return `${runHead(entry, "steps")}
<div class="panel"><h2>Human steps</h2>
<div class="filters">
  <label>Cause <select data-filter="cause">${options(causes)}</select></label>
  <label>Kind <select data-filter="kind">${options(kinds)}</select></label>
  <label>Actor <select data-filter="actor">${options(actors)}</select></label>
</div>
${table(["#", "At", "Kind", "Cause", "Actor", "Delegation", "Waited", "How"], stepRows(id, record.human_steps), " data-filterable")}</div>`;
}

function reviewsTab(entry) {
  const { record } = entry;
  return `${runHead(entry, "reviews")}
<div class="panel"><h2>Reviews</h2>${
    record.reviews.length
      ? table(
          ["PR", "Round", "Head", "Findings", "Fixed", "Answered"],
          record.reviews.map(
            (r) =>
              `<tr data-review><td>#${r.pr}</td><td class="num">${r.round}</td><td>${r.head ? code(r.head.slice(0, 7)) : ""}</td><td class="num">${r.findings}</td><td class="num">${r.fixed}</td><td class="num">${r.answered}</td></tr>`,
          ),
        )
      : `<p class="muted">No review rounds in this run.</p>`
  }</div>
<div class="panel"><h2>CI</h2>${
    record.ci.length
      ? table(
          ["PR", "Head", "Result", "Failed checks"],
          record.ci.map(
            (c) =>
              `<tr data-ci><td>#${c.pr}</td><td>${code(c.head.slice(0, 7))}</td><td>${state(c.result)}</td><td class="num">${c.failed_checks}</td></tr>`,
          ),
        )
      : `<p class="muted">No CI results in this run.</p>`
  }</div>`;
}

function logTab(entry, context) {
  const { record } = entry;
  const id = entry.slug;
  const runId = record.run.id;
  // A record that came only from a sink never gains prose, whatever the logs hold.
  const prose = context.logs && entry.source !== "sink" ? context.logs[runId] : undefined;
  const proseSection =
    context.logs === null || context.logs === undefined
      ? ""
      : typeof prose === "string"
        ? `\n<div class="panel"><h2>Activity Log (local only)</h2>\n<pre class="log prose">${esc(prose)}</pre></div>`
        : `\n<div class="panel"><h2>Prose</h2><p class="muted">There is no prose for this run: no run folder on this machine, or none with a log in it. A record from a sink never gains prose.</p></div>`;
  return `${runHead(entry, "log")}
<div class="panel"><h2>Run Events</h2>
<p class="muted small">The steps of the run as text, derived from its Run Record.</p>
${logBox(`events-${id}`, eventLines(record).join("\n") + "\n", `${runId}-events.txt`)}</div>
<div class="panel"><h2>Report</h2>
${logBox(`report-${id}`, reportText(record) + "\n", `${runId}-report.txt`)}</div>${proseSection}`;
}

function recordTab(entry) {
  const { record } = entry;
  const id = entry.slug;
  return `${runHead(entry, "record")}
<div class="panel"><h2>Record (JSON)</h2>
${logBox(`record-${id}`, JSON.stringify(record, null, 2) + "\n", `${record.run.id}.json`)}</div>`;
}

// --- Drill-down pages.

const stepSentence = (record, s) => {
  const who =
    s.actor === "human"
      ? "You"
      : s.actor === "chief-of-staff"
        ? "The Chief of Staff"
        : "A Delegation";
  const where = s.delegation ? `in ${s.delegation}` : "in the run";
  const wait =
    s.waited_seconds === null ? "" : `, after the run waited ${duration(s.waited_seconds)}`;
  return `${who} ${KIND_INFO[s.kind]} ${where} on ${day(s.at)}${wait}.`;
};

function stepPage(entry, s, n, lines) {
  const { record } = entry;
  const id = entry.slug;
  const info = CAUSE_INFO[s.cause];
  // The step's own line, by its index: two steps of one kind in one second are two lines.
  const at = lines.findIndex((l) => l.step === n);
  const around = lines.slice(Math.max(0, at - 3), at + 4).map((l) => l.text);
  return page(
    stepRoute(id, n + 1),
    `<div class="crumbs"><a href="#/">All repositories</a> / ${link(runRoute(id) + "/steps", esc(record.run.id))} / step ${n + 1}</div>
<h1>Human step ${n + 1}</h1>
<p class="sentence">${esc(stepSentence(record, s))}</p>
<div class="panel"><h2>Cause and fix</h2>
<p>${chip(s.cause)}</p>
<p>${esc(info.meaning)}</p>
<div class="callout">${esc(info.fix)}</div></div>
<div class="panel"><h2>Around it</h2>
<pre class="log">${esc(around.join("\n"))}</pre></div>
<div class="panel"><h2>Raw entry</h2>
<pre class="log">${esc(JSON.stringify(s, null, 2))}</pre></div>`,
    entry.repository,
  );
}

function delegationPage(entry, d) {
  const { record } = entry;
  const id = entry.slug;
  const steps = stepRows(id, record.human_steps, d.id);
  const writes = record.writes.filter((w) => w.delegation === d.id);
  const qa = record.qa.filter((q) => q.delegation === d.id);
  return page(
    delegationRoute(id, d.id),
    `<div class="crumbs"><a href="#/">All repositories</a> / ${link(runRoute(id) + "/delegations", esc(record.run.id))} / ${esc(d.id)}</div>
<h1>Delegation ${esc(d.id)}</h1>
<p class="muted">${d.issue === null ? "No issue" : `Issue #${d.issue}`} · ${state(d.outcome)}</p>
<div class="panel"><h2>Facts</h2>
<dl class="dl">
  <dt>Kind</dt><dd>${esc(d.kind)}</dd>
  <dt>Executor</dt><dd>${esc(d.executor)}</dd>
  <dt>Model</dt><dd>${esc(d.model)}</dd>
  <dt>Started from</dt><dd>${d.start_route === "card" ? "a card, by a human" : "a direct start"}</dd>
  <dt>Started</dt><dd>${esc(d.started_at)}</dd>
  <dt>Landed</dt><dd>${esc(d.landed_at ?? "never")}</dd>
  <dt>Ended</dt><dd>${esc(d.ended_at ?? "still open")}</dd>
  <dt>Length</dt><dd>${esc(duration(d.duration_seconds ?? 0))}</dd>
  <dt>Send-backs</dt><dd>${d.send_backs}</dd>
  <dt>Decision Requests</dt><dd>${d.decision_requests}</dd>
  <dt>Rulings</dt><dd>${d.rulings}</dd>
</dl></div>
<div class="panel"><h2>Human steps</h2>${
      steps.length
        ? table(["#", "At", "Kind", "Cause", "Actor", "Delegation", "Waited", "How"], steps)
        : `<p class="muted">This Delegation needed no human step.</p>`
    }</div>
<div class="panel"><h2>Writes and QA</h2>${
      writes.length || qa.length
        ? `<ul>${writes.map((w) => `<li>${esc(w.at)}: ${esc(w.kind)} by ${esc(w.actor)}</li>`).join("")}${qa.map((q) => `<li>QA on ${esc(q.target)} by ${esc(q.route)}: ${state(q.result)}</li>`).join("")}</ul>`
        : `<p class="muted">None recorded.</p>`
    }</div>`,
    entry.repository,
  );
}

// --- The Key page.

function keyPage() {
  return page(
    "/key",
    `<div class="crumbs"><a href="#/">All repositories</a> / Key</div>
<h1>Key</h1>
<p class="muted">Colour means cause, and nothing else. Every chip also says its name, and whether the step was avoidable or by design. States, such as an outcome or a result, are grey.</p>
<div class="panel"><h2>Causes</h2>${table(
      ["Cause", "Means", "Fix"],
      CAUSE_LIST.map(
        (cause) =>
          `<tr data-cause="${esc(cause)}"><td>${chip(cause)}</td><td>${esc(CAUSE_INFO[cause].meaning)}</td><td>${esc(CAUSE_INFO[cause].fix)}</td></tr>`,
      ),
    )}</div>
<div class="panel"><h2>Kinds of human step</h2>${table(
      ["Kind", "Means"],
      KIND_LIST.map(
        (kind) =>
          `<tr data-kind="${esc(kind)}"><td>${code(kind)}</td><td>A person ${esc(KIND_INFO[kind])}.</td></tr>`,
      ),
    )}</div>
<div class="panel"><h2>Timeline marks</h2>${table(
      ["Mark", "Means"],
      MARK_INFO.map(
        ([mark, text]) =>
          `<tr data-mark="${mark}"><td>${code(mark)}</td><td>${esc(text)}</td></tr>`,
      ),
    )}</div>
<div class="panel"><h2>States</h2><p>${state("landed")} ${state("merged")} ${state("pass")} ${state("fail")} are states of a Delegation, a run or a check. They are grey: they say where something is, not why a person was needed.</p></div>`,
  );
}

// --- The repository pages: All repositories, and one repository.

const repoRoute = (repository) => `/repo/${repository}`;
const month = (entry) => entry.record.run.started_at.slice(0, 7);
const stepsOf = (entry) => entry.record.summary.human_steps;
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const one = (n) => String(Math.round(n * 10) / 10);

/** A record that is only on this machine says so, and says how to upload it. */
const notUploaded = (entry) =>
  entry.notUploaded
    ? `<span class="state not-uploaded">not uploaded</span> ${code(`/orchestrate --upload ${entry.record.run.id}`)}`
    : "";

/** The figures of a set of runs. The top cause is the most common avoidable one: a by design step has nothing to fix. */
function figures(entries) {
  const causes = {};
  for (const { record } of entries)
    for (const [cause, n] of Object.entries(record.summary.by_cause))
      if (CAUSE_INFO[cause].avoidable) causes[cause] = (causes[cause] ?? 0) + n;
  const top = Object.entries(causes)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || CAUSE_LIST.indexOf(a[0]) - CAUSE_LIST.indexOf(b[0]))[0];
  const merged = entries.filter((e) => e.record.run.outcome === "merged").length;
  return {
    runs: entries.length,
    mergeRate: entries.length ? Math.round((merged / entries.length) * 100) : null,
    perRun: mean(entries.map(stepsOf)),
    topCause: top ? top[0] : null,
  };
}

function kpis(entries) {
  const f = figures(entries);
  return `<div class="kpis">
  <div class="kpi"><b>${f.runs}</b><span>${f.runs === 1 ? "run" : "runs"}</span></div>
  <div class="kpi" data-kpi="merge-rate"><b>${f.mergeRate === null ? "n/a" : `${f.mergeRate}%`}</b><span>of runs merged</span></div>
  <div class="kpi" data-kpi="steps-per-run"><b>${one(f.perRun)}</b><span>human steps per run</span></div>
  <div class="kpi" data-kpi="top-cause"><span>top avoidable cause</span>${f.topCause ? `<div>${chip(f.topCause)}</div>` : `<b>none</b>`}</div>
</div>`;
}

/** Runs, newest first, as a table. */
function runsTable(entries, { withRepository, kind }) {
  const sorted = [...entries].sort(
    (a, b) => ms(b.record.run.started_at) - ms(a.record.run.started_at),
  );
  return table(
    [
      "Run",
      ...(withRepository ? ["Repository"] : []),
      "Kind",
      "Started",
      "Length",
      "Outcome",
      "Human steps",
      "Avoidable",
      "Top cause",
    ],
    sorted.map((entry) => {
      const { run, summary } = entry.record;
      const top = Object.entries(summary.by_cause)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])[0];
      return `<tr><td>${link(runRoute(entry.slug) + "/summary", esc(run.id))} ${notUploaded(entry)}</td>${withRepository ? `<td>${esc(entry.repository ?? "")}</td>` : ""}<td>${esc(run.kind)}</td><td class="nowrap">${esc(run.started_at)}</td><td>${esc(duration(run.duration_seconds))}</td><td>${state(run.outcome)}</td><td class="num">${summary.human_steps}</td><td class="num">${summary.avoidable}</td><td>${top ? chip(top[0]) : ""}</td></tr>`;
    }),
    ` data-table="${kind}"`,
  );
}

/** The share of human steps that were avoidable, month by month. Grey: it is not a cause. */
function avoidableTrend(entries) {
  const months = [...new Set(entries.map(month))].sort();
  const rows = months.map((m) => {
    const of = entries.filter((e) => month(e) === m);
    const steps = of.reduce((n, e) => n + stepsOf(e), 0);
    const avoidable = of.reduce((n, e) => n + e.record.summary.avoidable, 0);
    const share = steps ? Math.round((avoidable / steps) * 100) : 0;
    return `<div class="bar neutral"><span class="lbl">${esc(m)} <span class="muted small">${plural(of.length, "run")}</span></span><span class="track"><span class="fill" style="width:${share}%"></span></span><span class="val">${share}%</span></div>`;
  });
  return `<div data-chart="avoidable-trend">${rows.join("\n")}</div>`;
}

const DASHES = ["", "6 3", "2 3", "8 3 2 3", "1 4"];

/** Human steps per run by month, one line per repository. Lines are told apart by dash and label, never colour. */
function repositoryChart(entries, repositories) {
  const months = [...new Set(entries.map(month))].sort();
  const W = 760;
  const H = 250;
  const L = 44;
  const R = 230;
  const T = 14;
  const B = 30;
  const series = repositories.map((repository) =>
    months.map((m) => {
      const of = entries.filter((e) => e.repository === repository && month(e) === m);
      return of.length ? mean(of.map(stepsOf)) : null;
    }),
  );
  const top = Math.max(1, ...series.flat().filter((v) => v !== null));
  const x = (i) =>
    L + (months.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (months.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const parts = [
    `<line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>`,
    `<line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>`,
    `<text x="${L - 6}" y="${T + 4}" text-anchor="end">${one(top)}</text>`,
    `<text x="${L - 6}" y="${H - B + 4}" text-anchor="end">0</text>`,
    ...months.map(
      (m, i) => `<text x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${esc(m)}</text>`,
    ),
  ];
  repositories.forEach((repository, r) => {
    const dash = DASHES[r % DASHES.length];
    const points = series[r].map((v, i) => (v === null ? null : [x(i), y(v), v]));
    const drawn = points.filter(Boolean);
    if (drawn.length > 1)
      parts.push(
        `<polyline class="line" ${dash ? `stroke-dasharray="${dash}" ` : ""}points="${drawn.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ")}"/>`,
      );
    for (const [px, py, v] of drawn)
      parts.push(
        `<circle class="dot" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3"><title>${esc(`${repository}: ${one(v)} human steps per run`)}</title></circle>`,
      );
    const ly = T + 12 + r * 18;
    parts.push(
      `<line class="line" ${dash ? `stroke-dasharray="${dash}" ` : ""}x1="${W - R + 14}" y1="${ly - 4}" x2="${W - R + 44}" y2="${ly - 4}"/>`,
      `<text x="${W - R + 50}" y="${ly}">${esc(repository)}</text>`,
    );
  });
  return `<svg class="chart" data-chart="repositories" viewBox="0 0 ${W} ${H}" role="img" aria-label="Human steps per run by month, one line per repository">${parts.join("")}</svg>`;
}

/** Human steps of each run, stacked by cause. */
function stackedChart(entries) {
  const runs = [...entries]
    .sort((a, b) => ms(a.record.run.started_at) - ms(b.record.run.started_at))
    .slice(-40);
  const BAR = 18;
  const GAP = 6;
  const L = 36;
  const H = 220;
  const T = 12;
  const B = 24;
  const top = Math.max(1, ...runs.map(stepsOf));
  const unit = (H - T - B) / top;
  const parts = [
    `<line class="axis" x1="${L}" y1="${H - B}" x2="${L + runs.length * (BAR + GAP)}" y2="${H - B}"/>`,
    `<text x="${L - 6}" y="${T + 4}" text-anchor="end">${top}</text>`,
    `<text x="${L - 6}" y="${H - B + 4}" text-anchor="end">0</text>`,
  ];
  runs.forEach((entry, n) => {
    const x = L + n * (BAR + GAP) + GAP / 2;
    let floor = H - B;
    const segments = CAUSE_LIST.filter((c) => entry.record.summary.by_cause[c] > 0).map((cause) => {
      const count = entry.record.summary.by_cause[cause];
      floor -= count * unit;
      return `<rect class="seg c-${cause}" x="${x}" y="${floor.toFixed(1)}" width="${BAR}" height="${(count * unit).toFixed(1)}"><title>${esc(`${CAUSE_INFO[cause].label}: ${count}`)}</title></rect>`;
    });
    parts.push(
      `<a href="#${esc(runRoute(entry.slug))}/summary"><title>${esc(`${entry.record.run.id}: ${plural(stepsOf(entry), "human step")}`)}</title>${segments.join("")}</a>`,
    );
  });
  const width = L + runs.length * (BAR + GAP) + 10;
  return `<svg class="chart" data-chart="steps-by-cause" viewBox="0 0 ${width} ${H}" role="img" aria-label="Human steps per run, stacked by cause">${parts.join("")}</svg>`;
}

/** host, then owner, then repository, then login, each with the runs under it. */
function namespaceTree(entries) {
  const tree = new Map();
  for (const entry of entries) {
    if (!entry.repository) continue;
    // The name is the last segment and the owner everything between: a GitLab owner may be `grp/sub`.
    const parts = entry.repository.split("/");
    const [host, owner, name] = [parts[0], parts.slice(1, -1).join("/"), parts.at(-1)];
    const login = entry.login ?? "(no login)";
    const o = tree.get(host)?.get(owner) ?? new Map();
    const r = o.get(name) ?? new Map();
    r.set(login, (r.get(login) ?? 0) + 1);
    o.set(name, r);
    const h = tree.get(host) ?? new Map();
    h.set(owner, o);
    tree.set(host, h);
  }
  const list = (map, render) =>
    `<ul class="tree">${[...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(render)
      .join("")}</ul>`;
  return `<ul class="tree" data-tree>${[...tree]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([host, owners]) =>
        `<li>${code(host)}${list(
          owners,
          ([owner, names]) =>
            `<li>${code(owner)}${list(names, ([name, logins]) => {
              const repository = `${host}/${owner}/${name}`;
              const runs = [...logins.values()].reduce((a, b) => a + b, 0);
              return `<li>${link(repoRoute(repository), esc(name))} <span class="muted small">${plural(runs, "run")}</span>${list(
                logins,
                ([login, n]) =>
                  `<li><code>${esc(login)}</code> <span class="muted small">${plural(n, "run")}</span></li>`,
              )}</li>`;
            })}</li>`,
        )}</li>`,
    )
    .join("")}</ul>`;
}

function allPage(entries, context, repositories, kit) {
  const skipped = context.skipped ?? [];
  const where = context.sink
    ? context.sink.read
      ? `from this machine and from ${code(context.sink.name)}`
      : context.sink.cached
        ? `from this machine, with the records of ${code(context.sink.name)} an earlier build cached (the server reads no sink)`
        : `from this machine (${code(context.sink.name)} could not be read)`
    : "from this machine";
  return page(
    "/",
    `<h1>All repositories</h1>
<p class="muted">${plural(entries.length, "Run Record")} read ${where}, across ${plural(repositories.length, "repository", "repositories")}. ${link("/key", "Key")}: what the colours and marks mean.</p>
${(context.warnings ?? []).map((w) => `<div class="warn">${esc(w)}</div>`).join("\n")}
${kpis(entries)}
<div class="panel"><h2>The avoidable trend</h2>
<p class="muted small">The share of human steps that were avoidable, by month.</p>
${avoidableTrend(entries)}</div>
<div class="panel"><h2>Repositories over time</h2>
<p class="muted small">Human steps per run, by month. Each repository has its own dash pattern and label.</p>
${repositories.length ? repositoryChart(entries, repositories) : `<p class="muted">No run names its repository.</p>`}</div>
${peoplePanel(kit, entries, context, { byHost: true })}
<div class="panel"><h2>Recent runs</h2>${runsTable(
      entries
        .slice()
        .sort((a, b) => ms(b.record.run.started_at) - ms(a.record.run.started_at))
        .slice(0, 20),
      { withRepository: true, kind: "recent-runs" },
    )}</div>
<div class="panel"><h2>Namespaces</h2>
<p class="muted small">Found from the paths in the sink and the local records, nowhere else.</p>
${repositories.length ? namespaceTree(entries) : `<p class="muted">None.</p>`}
${
  skipped.length
    ? `<h3>Skipped paths</h3><p class="muted small">These paths in the sink do not read as ${code("records/<host>/<owner>/<repo>/<login>/<run-id>.json")}.</p><ul data-skipped>${skipped.map((p) => `<li>${code(p)}</li>`).join("")}</ul>`
    : ""
}</div>`,
  );
}

function specList(repository, entries) {
  const specs = specsOf(entries, repository);
  return `<div class="panel" data-panel="specs"><h2>Spec pages</h2>${
    specs.length
      ? `<ul>${specs
          .map(
            (s) =>
              `<li>${link(specRoute(repository, s.spec), `Spec #${s.spec}`)} <span class="muted small">${plural(s.runs, "Team Run")} by ${esc(s.logins.join(", "))}</span></li>`,
          )
          .join("")}</ul>`
      : `<p class="muted">No Team Run over a spec in this repository.</p>`
  }</div>`;
}

function repositoryPage(repository, entries, warnings, context, kit) {
  return page(
    repoRoute(repository),
    `<div class="crumbs"><a href="#/">All repositories</a> / ${esc(repository)}</div>
<h1>${esc(repository)}</h1>
<p class="muted">${plural(entries.length, "Run Record")}.</p>
${warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join("\n")}
${kpis(entries)}
<div class="panel"><h2>Human steps per run</h2>
<p class="muted small">One bar per run, oldest first, stacked by cause.</p>
${stackedChart(entries)}</div>
${peoplePanel(kit, entries, context, { byHost: false })}
<div class="panel"><h2>Runs</h2>${runsTable(entries, { withRepository: false, kind: "runs" })}</div>
${specList(repository, entries)}`,
  );
}

/** A run's route key under its repository and login: unique, whatever other runs share its id. */
export const qualifiedSlug = (repository, login, id) =>
  `${repository ?? "-"}/${login ?? "-"}/${id}`;

/**
 * Each entry's route key: its run id, or, when two runs share an id, that id under its repository
 * and login (`qualified`). The qualified key always resolves: for a run keyed on its id alone it is
 * an alias, so a link made without the other runs (the live board's) still opens the run.
 */
function withSlugs(entries) {
  const count = new Map();
  for (const { record } of entries) count.set(record.run.id, (count.get(record.run.id) ?? 0) + 1);
  return entries.map((entry) => {
    const qualified = qualifiedSlug(entry.repository, entry.login, entry.record.run.id);
    return {
      ...entry,
      qualified,
      slug: count.get(entry.record.run.id) === 1 ? entry.record.run.id : qualified,
    };
  });
}

// --- The whole dashboard.

/**
 * @param {{record: object, repository?: string | null, login?: string | null, source?: "local" | "sink" | "both", notUploaded?: boolean}[]} entries
 *   `source` says where the record was read ("sink" only: never any prose); `notUploaded` is set on a
 *   local record the sink was read without.
 * @param {{vocabulary: {causes: Record<string, string>, stepKinds: readonly string[]}, logs?: Record<string, string> | null, warnings?: string[], skipped?: string[], home?: string | null, sink?: {name: string, read: boolean, cached?: boolean} | null, builtAt?: string}} context
 *   `logs` (run id to prose) is set only for a local-only page; `null` or absent means no prose at all.
 *   `home` is the repository the page opens on.
 */
export function buildPages(entries, context) {
  checkVocabulary(context.vocabulary);
  entries = withSlugs(entries);
  const repositories = [...new Set(entries.map((e) => e.repository).filter(Boolean))].sort();
  const kit = {
    CAUSE_INFO,
    CAUSE_LIST,
    avoidableTrend,
    chip,
    code,
    duration,
    esc,
    link,
    one,
    page,
    plural,
    runRoute,
    state,
    table,
  };
  const pages = [allPage(entries, context, repositories, kit)];
  for (const repository of repositories)
    pages.push(
      repositoryPage(
        repository,
        entries.filter((e) => e.repository === repository),
        context.warnings ?? [],
        context,
        kit,
      ),
    );
  pages.push(...personPages(kit, entries, context), ...specPages(kit, entries, context));
  for (const entry of entries) {
    const { record } = entry;
    const lines = eventLineEntries(record);
    const tabPages = {
      summary: summaryTab,
      timeline: timelineTab,
      delegations: delegationsTab,
      steps: stepsTab,
      reviews: reviewsTab,
      log: (e) => logTab(e, context),
      record: recordTab,
    };
    for (const [tab] of TABS)
      pages.push(page(`${runRoute(entry.slug)}/${tab}`, tabPages[tab](entry), entry.repository));
    for (const d of record.delegations) pages.push(delegationPage(entry, d));
    record.human_steps.forEach((s, n) => pages.push(stepPage(entry, s, n, lines)));
  }
  pages.push(keyPage());
  const switcher = repositories.length
    ? `<select id="repo-switch" class="switcher" aria-label="Repository"><option value="/">All repositories</option>${repositories.map((r) => `<option value="${esc(repoRoute(r))}">${esc(r)}</option>`).join("")}</select>`
    : "";
  const aliases = Object.fromEntries(
    entries
      .filter((e) => e.slug !== e.qualified)
      .map((e) => [runRoute(e.qualified), runRoute(e.slug)]),
  );
  return {
    pages,
    switcher,
    aliases,
    home: context.home ? repoRoute(context.home) : null,
    nav: [
      { href: "#/", label: "All repositories" },
      { href: "#/key", label: "Key" },
    ],
  };
}

/**
 * The dashboard page, whole.
 * @param {{record: object}[]} entries
 * @param {{vocabulary: {causes: Record<string, string>, stepKinds: readonly string[]}, builtAt: string, rebuild: {slash: string, node: string}, banner?: string | null, logs?: Record<string, string> | null, warnings?: string[]}} options
 *   `rebuild` is `{slash, node}`: the plain text of the two rebuild commands, escaped here.
 */
export function renderDashboard(
  entries,
  {
    vocabulary,
    builtAt,
    rebuild,
    banner = null,
    logs = null,
    warnings = [],
    skipped = [],
    home = null,
    sink = null,
  },
) {
  const built = buildPages(entries, { vocabulary, logs, warnings, skipped, home, sink, builtAt });
  return shell({
    title: "Run Records",
    builtAt,
    rebuild: `${code(rebuild.slash)} or ${code(rebuild.node)}`,
    banner,
    nav: built.nav,
    switcher: built.switcher,
    home: built.home,
    aliases: built.aliases,
    pages: built.pages,
  });
}
