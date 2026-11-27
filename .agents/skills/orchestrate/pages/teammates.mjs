/**
 * What the dashboard shows about each teammate: the People table, the Person
 * page, and the Spec page that reads a spec's Team Runs together.
 *
 * Every figure comes from the Run Records alone. Run counts and run lengths
 * are per run kind and never mixed; only per-Delegation figures are compared
 * across kinds. People are shown by login, sorted by login, with no ranking,
 * score, total or "best" and "worst", and nothing here is switched by a config
 * key: whoever can read the sink reads every record, so hiding a name on the
 * page would only pretend to protect it. A person is `(repository, login)`;
 * on All repositories a person is `(host, login)`. Logins are never merged
 * across hosts and there is no alias map.
 *
 * The date range (30 days, 90 days, all; 90 by default) is static HTML: each
 * range is rendered, and the page's small script shows the chosen one.
 *
 * The helpers of the dashboard (`kit`) are passed in, so this module does not
 * import `dashboard.mjs`, which imports it.
 */

const DAY = 86_400_000;
const KINDS = ["tickets", "spec", "team"];
const OUTCOMES = ["merged", "partly-merged", "abandoned"];
const AUTHORITIES = ["relay", "autonomous"];

export const RANGES = [
  ["30", "30 days", 30],
  ["90", "90 days", 90],
  ["all", "All", null],
];
const DEFAULT_RANGE = "90";

export const personRoute = (repository, login) => `/repo/${repository}/person/${login}`;
export const specRoute = (repository, spec) => `/repo/${repository}/spec/${spec}`;

const ms = (iso) => Date.parse(iso);
const loginOf = (entry) => entry.login ?? entry.record.run.operator ?? null;
const hostOf = (repository) => repository.split("/")[0];
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/** Counts of a value over a list, as `[value, n]` pairs, most common first, then by name. */
const tally = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || byText(a[0], b[0]));
};

// --- The date range.

/** The select that shows one range; the script in the shell does the showing. */
const rangeSelect = () =>
  `<label class="range">Date range <select data-range-select aria-label="Date range">${RANGES.map(
    ([key, label]) =>
      `<option value="${key}"${key === DEFAULT_RANGE ? " selected" : ""}>${label}</option>`,
  ).join("")}</select></label>`;

/** Render once per range, over the runs that closed inside it, and show only the default. */
function ranged(entries, now, render) {
  return RANGES.map(([key, , days]) => {
    const inside =
      days === null
        ? entries
        : entries.filter((e) => ms(e.record.run.closed_at) >= now - days * DAY);
    return `<div class="ranged" data-range="${key}"${key === DEFAULT_RANGE ? "" : " hidden"}>\n${
      inside.length ? render(inside) : `<p class="muted">No runs closed in this range.</p>`
    }\n</div>`;
  }).join("\n");
}

/** When the page was built: the end of every range. */
export const builtMs = (context, entries) =>
  context.builtAt
    ? ms(context.builtAt)
    : Math.max(0, ...entries.map((e) => ms(e.record.run.closed_at)));

// --- The figures of one person's runs.

function figuresOf(entries) {
  const runs = [...entries].sort((a, b) => ms(a.record.run.closed_at) - ms(b.record.run.closed_at));
  const records = runs.map((e) => e.record);
  const kinds = KINDS.map((kind) => {
    const lengths = records.filter((r) => r.run.kind === kind).map((r) => r.run.duration_seconds);
    return lengths.length
      ? { kind, runs: lengths.length, median: median(lengths), longest: Math.max(...lengths) }
      : null;
  }).filter(Boolean);
  const steps = records.reduce((n, r) => n + r.summary.human_steps, 0);
  const avoidable = records.reduce((n, r) => n + r.summary.avoidable, 0);
  const delegations = records.reduce((n, r) => n + r.delegations.length, 0);
  const causes = {};
  for (const r of records)
    for (const [cause, n] of Object.entries(r.summary.by_cause))
      causes[cause] = (causes[cause] ?? 0) + n;
  return {
    runs,
    kinds,
    outcomes: tally(records.map((r) => r.run.outcome)),
    waiting: records.reduce((n, r) => n + r.summary.human_wait_seconds, 0),
    steps,
    avoidable,
    delegations,
    causes,
    authority: tally(records.map((r) => r.run.decision_authority)),
    withQa: records.filter((r) => r.qa.length > 0).length,
    harness: tally(records.map((r) => r.run.harness)),
    models: tally(records.flatMap((r) => r.delegations.map((d) => d.model))),
    last: records.reduce((m, r) => (r.run.closed_at > m ? r.run.closed_at : m), ""),
    trend: records.map((r) => r.summary.avoidable),
  };
}

const mixText = (pairs) => pairs.map(([name, n]) => `<div>${name} <b>${n}</b></div>`).join("");

/** A small grey line of avoidable steps per run, oldest first. A trend is not a cause: it carries no colour. */
function sparkline(values) {
  const W = 84;
  const H = 22;
  const top = Math.max(1, ...values);
  const x = (i) => 3 + (values.length === 1 ? (W - 6) / 2 : (i * (W - 6)) / (values.length - 1));
  const y = (v) => 3 + (H - 6) * (1 - v / top);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  return `<svg class="spark" data-trend viewBox="0 0 ${W} ${H}" role="img" aria-label="Avoidable human steps per run, oldest first: ${values.join(", ")}">${
    values.length > 1 ? `<polyline class="line" points="${points.join(" ")}"/>` : ""
  }${values.map((v, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="1.8"><title>${v}</title></circle>`).join("")}</svg>`;
}

// --- The People table.

const PEOPLE_HEAD = [
  "Login",
  "Runs by kind",
  "Outcomes",
  "Median run length",
  "Longest run",
  "Waiting on the human",
  "Human steps per Delegation",
  "Avoidable",
  "Top avoidable cause",
  "Trend",
  "Decision authority",
  "QA",
  "Harness",
  "Model",
  "Last record",
];

/** Entries that name a repository and a login, grouped by the person's key. */
function peopleOf(entries, byHost) {
  const people = new Map();
  for (const entry of entries) {
    const login = loginOf(entry);
    if (!entry.repository || !login) continue;
    const key = byHost ? `${hostOf(entry.repository)}/${login}` : `${entry.repository}/${login}`;
    const person = people.get(key) ?? {
      key,
      host: hostOf(entry.repository),
      login,
      repository: entry.repository,
      entries: [],
    };
    person.entries.push(entry);
    people.set(key, person);
  }
  return [...people.values()].sort((a, b) => byText(a.host, b.host) || byText(a.login, b.login));
}

function peopleTable(kit, entries, { byHost }) {
  const { chip, table, link, one, duration, state, esc, code } = kit;
  const people = peopleOf(entries, byHost);
  const unnamed = entries.filter((e) => !e.repository || !loginOf(e)).length;
  const rows = people.map((person) => {
    const f = figuresOf(person.entries);
    const repositories = [...new Set(person.entries.map((e) => e.repository))].sort();
    const names = byHost
      ? `${esc(person.login)} ${repositories.map((r) => link(personRoute(r, person.login), esc(r.split("/").slice(1).join("/")))).join(" ")}`
      : link(personRoute(person.repository, person.login), esc(person.login));
    const top = Object.entries(f.causes)
      .filter(([cause, n]) => n > 0 && kit.CAUSE_INFO[cause].avoidable)
      .sort(
        (a, b) => b[1] - a[1] || kit.CAUSE_LIST.indexOf(a[0]) - kit.CAUSE_LIST.indexOf(b[0]),
      )[0];
    const perKind = (pick) =>
      f.kinds
        .map((k) => `<div data-kind="${k.kind}">${k.kind} ${esc(duration(pick(k)))}</div>`)
        .join("");
    const cells = [
      ["login", names],
      ...(byHost
        ? [
            ["host", code(person.host)],
            ["repositories", String(repositories.length)],
          ]
        : []),
      [
        "runs",
        f.kinds.map((k) => `<div data-kind="${k.kind}"><b>${k.runs}</b> ${k.kind}</div>`).join(""),
      ],
      ["outcomes", mixText(f.outcomes.map(([o, n]) => [state(o), n]))],
      ["median", perKind((k) => k.median)],
      ["longest", perKind((k) => k.longest)],
      ["waiting", esc(duration(f.waiting))],
      ["steps-per-delegation", f.delegations ? one(f.steps / f.delegations) : "n/a"],
      ["avoidable", f.steps ? `${Math.round((f.avoidable / f.steps) * 100)}%` : "n/a"],
      ["top-cause", top ? chip(top[0]) : "none"],
      ["trend", sparkline(f.trend)],
      ["authority", mixText(f.authority.map(([a, n]) => [esc(a), n]))],
      ["qa", `${Math.round((f.withQa / f.runs.length) * 100)}%`],
      ["harness", mixText(f.harness.map(([h, n]) => [esc(h), n]))],
      ["model", mixText(f.models.map(([m, n]) => [esc(m), n]))],
      ["last", esc(f.last.slice(0, 10))],
    ];
    return `<tr data-person="${esc(person.key)}" data-login="${esc(person.login)}"${byHost ? ` data-host="${esc(person.host)}"` : ""}>${cells.map(([col, html]) => `<td data-col="${col}">${html}</td>`).join("")}</tr>`;
  });
  const head = byHost
    ? [PEOPLE_HEAD[0], "Host", "Repositories", ...PEOPLE_HEAD.slice(1)]
    : PEOPLE_HEAD;
  return `${table(head, rows, ' data-table="people"')}${
    unnamed
      ? `<p class="muted small">${unnamed} ${unnamed === 1 ? "record names" : "records name"} no repository or login, so ${unnamed === 1 ? "it is" : "they are"} not in this table.</p>`
      : ""
  }`;
}

/** The one sentence a page that shows teammates carries: the sink it read, and who is not shown. */
const missingTeammates = (code, sink) =>
  `<div class="callout" data-missing-teammates>Only runs uploaded to ${code(sink)} are here. Teammates who haven't uploaded, upload elsewhere, or have runs still open aren't shown.</div>`;

/** The People panel of a Repository page, or of All repositories (`byHost`). */
export function peoplePanel(kit, entries, context, { byHost }) {
  const now = builtMs(context, entries);
  const note = byHost
    ? `One row per host and login, with a count of repositories: the same login on two hosts is two people. It covers only the repositories this machine and ${kit.code(context.sink?.name ?? "local")} hold.`
    : "One row per login in this repository.";
  return `<div class="panel" data-panel="people"><h2>People</h2>
${missingTeammates(kit.code, context.sink?.name ?? "local")}
<p class="muted small">${note} Sorted by login, side by side: nothing here is ordered by a figure or summed across people. Run counts and lengths are per kind of run; only the human steps per Delegation compare across kinds.</p>
${rangeSelect()}
${ranged(entries, now, (inside) => peopleTable(kit, inside, { byHost }))}</div>`;
}

// --- The Person page.

function runsOverTime(kit, entries) {
  const months = [...new Set(entries.map((e) => e.record.run.started_at.slice(0, 7)))].sort();
  const top = Math.max(
    1,
    ...months.map((m) => entries.filter((e) => e.record.run.started_at.startsWith(m)).length),
  );
  return `<div data-chart="runs-over-time">${months
    .map((m) => {
      const of = entries.filter((e) => e.record.run.started_at.startsWith(m));
      const kinds = KINDS.map((k) => [k, of.filter((e) => e.record.run.kind === k).length])
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k}`)
        .join(", ");
      return `<div class="bar neutral"><span class="lbl">${kit.esc(m)} <span class="muted small">${kit.esc(kinds)}</span></span><span class="track"><span class="fill" style="width:${Math.round((of.length / top) * 100)}%"></span></span><span class="val">${of.length}</span></div>`;
    })
    .join("\n")}</div>`;
}

function runLengths(kit, entries) {
  const { table, link, esc, duration, state } = kit;
  const f = figuresOf(entries);
  const rows = KINDS.flatMap((kind) =>
    entries
      .filter((e) => e.record.run.kind === kind)
      .sort((a, b) => ms(a.record.run.started_at) - ms(b.record.run.started_at))
      .map(
        (e) =>
          `<tr data-kind="${kind}"><td>${kind}</td><td>${link(kit.runRoute(e.slug) + "/summary", esc(e.record.run.id))}</td><td class="nowrap">${esc(e.record.run.started_at)}</td><td>${esc(duration(e.record.run.duration_seconds))}</td><td>${state(e.record.run.outcome)}</td></tr>`,
      ),
  );
  return `<p class="muted small">${f.kinds.map((k) => `${k.kind}: median ${esc(duration(k.median))}, longest ${esc(duration(k.longest))}`).join(" · ")}. Each kind is measured only against itself.</p>
${table(["Kind", "Run", "Started", "Length", "Outcome"], rows, ' data-table="run-lengths"')}`;
}

function stepsByCause(kit, entries) {
  const f = figuresOf(entries);
  const all = Object.entries(f.causes)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = Math.max(1, ...all.map(([, n]) => n));
  return `<div data-chart="steps-by-cause">${
    all.length
      ? all
          .map(
            ([cause, n]) =>
              `<div class="bar c-${cause}"><span class="lbl">${kit.chip(cause)}</span><span class="track"><span class="fill" style="width:${Math.round((n / top) * 100)}%"></span></span><span class="val">${n}</span></div>`,
          )
          .join("\n")
      : `<p class="muted">No human step.</p>`
  }</div>`;
}

function personPage(kit, repository, login, entries, context) {
  const { esc, link, page, code } = kit;
  const now = builtMs(context, entries);
  const body = ranged(entries, now, (inside) => {
    const f = figuresOf(inside);
    const specs = [
      ...new Set(
        inside
          .filter((e) => e.record.run.team && e.record.run.spec !== undefined)
          .map((e) => e.record.run.spec),
      ),
    ].sort((a, b) => a - b);
    return `<p class="sentence">${kit.plural(f.runs.length, "run")}, ${kit.plural(f.steps, "human step")} over ${kit.plural(f.delegations, "Delegation")}, ${f.avoidable} avoidable, ${esc(kit.duration(f.waiting))} waiting on the human.</p>
<div class="panel"><h2>Runs over time</h2>
<p class="muted small">Runs started each month, by kind.</p>
${runsOverTime(kit, inside)}</div>
<div class="panel"><h2>Run lengths</h2>
${runLengths(kit, inside)}</div>
<div class="panel"><h2>Human steps by cause</h2>
${stepsByCause(kit, inside)}</div>
<div class="panel"><h2>The avoidable trend</h2>
<p class="muted small">The share of human steps that were avoidable, by month.</p>
${kit.avoidableTrend(inside)}</div>
<div class="panel"><h2>Spec pages</h2>${
      specs.length
        ? `<ul>${specs.map((n) => `<li>${link(specRoute(repository, n), `Spec #${n}`)}</li>`).join("")}</ul>`
        : `<p class="muted">No Team Run over a spec in this range.</p>`
    }</div>`;
  });
  return page(
    personRoute(repository, login),
    `<div class="crumbs"><a href="#/">All repositories</a> / ${link(`/repo/${repository}`, esc(repository))} / ${esc(login)}</div>
<h1>${esc(login)}</h1>
<p class="muted">${esc(login)} in ${code(repository)}. The same login on another host is another person: logins are never merged across hosts.</p>
${rangeSelect()}
${body}`,
  );
}

/** One Person page per `(repository, login)`. */
export function personPages(kit, entries, context) {
  return peopleOf(entries, false).map((person) =>
    personPage(kit, person.repository, person.login, person.entries, context),
  );
}

// --- The Spec page.

/** The Team Runs over one spec: `(repository, run.spec)` where `run.team` is true. */
function specGroups(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const { run } = entry.record;
    if (!run.team || run.spec === undefined || !entry.repository) continue;
    const key = `${entry.repository}#${run.spec}`;
    const group = groups.get(key) ?? { repository: entry.repository, spec: run.spec, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => byText(a.repository, b.repository) || a.spec - b.spec);
}

/** The Spec pages of a repository, as `{spec, logins}`: for the list on the Repository page. */
export function specsOf(entries, repository) {
  return specGroups(entries)
    .filter((g) => g.repository === repository)
    .map((g) => ({
      spec: g.spec,
      runs: g.entries.length,
      logins: [...new Set(g.entries.map(loginOf).filter(Boolean))].sort(),
    }));
}

const LANE_LABEL = 190;
const LANE_W = 760;
const LANE_H = 30;

function specPage(kit, group, context) {
  const { esc, link, code, page, table, chip, duration, state, plural } = kit;
  const { repository, spec } = group;
  const sink = context.sink?.name ?? "local";
  const runs = [...group.entries].sort(
    (a, b) =>
      byText(loginOf(a) ?? "", loginOf(b) ?? "") ||
      ms(a.record.run.started_at) - ms(b.record.run.started_at),
  );
  const logins = [...new Set(runs.map(loginOf).filter(Boolean))].sort();
  // A run id alone does not name a run: two teammates' runs over one spec can share one. A taken-over
  // id is the taker's own run of that id, else the one run with it; with neither, it is not shown.
  const takenOver = (taker, id) => {
    const same = runs.filter((r) => r.record.run.id === id && r !== taker);
    return same.find((r) => loginOf(r) === loginOf(taker)) ?? (same.length === 1 ? same[0] : null);
  };
  const supersededBy = new Map();
  for (const e of runs)
    for (const id of e.record.run.took_over) {
      const old = takenOver(e, id);
      if (old) supersededBy.set(old, e);
    }

  const t0 = Math.min(...runs.map((e) => ms(e.record.run.started_at)));
  const t1 = Math.max(t0 + 1, ...runs.map((e) => ms(e.record.run.closed_at)));
  const x = (iso) =>
    LANE_LABEL + 10 + ((Math.min(Math.max(ms(iso), t0), t1) - t0) / (t1 - t0)) * LANE_W;
  const parts = runs.map((e, i) => {
    const { run } = e.record;
    const cy = i * LANE_H + LANE_H / 2;
    const marks = [
      `<a href="#${esc(kit.runRoute(e.slug))}/timeline"><rect class="mark delegation" x="${x(run.started_at).toFixed(1)}" y="${cy - 5}" width="${Math.max(2, x(run.closed_at) - x(run.started_at)).toFixed(1)}" height="10"><title>${esc(`${run.id}: ${run.outcome}, ${duration(run.duration_seconds)}`)}</title></rect></a>`,
      ...e.record.delegations
        .filter((d) => d.landed_at)
        .map(
          (d) =>
            `<rect class="mark landed" x="${(x(d.landed_at) - 1).toFixed(1)}" y="${cy - 8}" width="2" height="16"><title>${esc(`${d.id} landed`)}</title></rect>`,
        ),
      ...e.record.human_steps
        .filter((s) => s.cause === "teammate-blocker" && s.opened_at)
        .map(
          (s) =>
            `<rect class="mark wait c-teammate-blocker" x="${x(s.opened_at).toFixed(1)}" y="${cy - 5}" width="${Math.max(2, x(s.at) - x(s.opened_at)).toFixed(1)}" height="10"><title>${esc(`parked on ${s.blocker ? `#${s.blocker}` : "a teammate's ticket"}, ${duration(s.waited_seconds)}`)}</title></rect>`,
        ),
    ];
    return `<g class="lane" data-lane="${esc(`${loginOf(e)}:${run.id}`)}"><rect class="lane-bg" x="${LANE_LABEL}" y="${i * LANE_H + 2}" width="${LANE_W + 20}" height="${LANE_H - 4}" rx="4"></rect><text x="4" y="${cy + 4}">${esc(loginOf(e) ?? "?")} · ${esc(run.id)}</text>${marks.join("")}</g>`;
  });
  const axisY = runs.length * LANE_H + 14;
  parts.push(
    `<text class="mt" x="${LANE_LABEL}" y="${axisY}">${esc(new Date(t0).toISOString().replace(/\.\d+Z$/, "Z"))}</text><text class="mt" x="${LANE_LABEL + LANE_W + 20}" y="${axisY}" text-anchor="end">${esc(new Date(t1).toISOString().replace(/\.\d+Z$/, "Z"))}</text>`,
  );

  const models = (e) => [...new Set(e.record.delegations.map((d) => d.model))].sort();
  const laneRows = runs.map((e) => {
    const { run } = e.record;
    const notes = [
      supersededBy.has(e)
        ? `superseded by ${link(kit.runRoute(supersededBy.get(e).slug) + "/summary", esc(supersededBy.get(e).record.run.id))}`
        : null,
      ...run.took_over.map(
        (id) => `took over ${takenOver(e, id) ? esc(id) : `${esc(id)} (not shown)`}`,
      ),
    ].filter(Boolean);
    return `<tr data-lane-login="${esc(loginOf(e) ?? "")}" data-lane-run="${esc(run.id)}"><td>${esc(loginOf(e) ?? "")}</td><td>${link(kit.runRoute(e.slug) + "/summary", esc(run.id))}</td><td>${esc(run.harness)} <span class="muted small">${esc(run.support_level)}</span></td><td>${models(e).map(esc).join(", ")}</td><td class="nowrap">${esc(run.started_at)}</td><td>${esc(duration(run.duration_seconds))}</td><td>${state(run.outcome)}</td><td>${notes.join("; ")}</td></tr>`;
  });

  // The tickets each teammate built: Delegations of kind `building` that name an issue.
  const built = logins.map((login) => {
    const tickets = new Map();
    for (const e of runs.filter((r) => loginOf(r) === login))
      for (const d of e.record.delegations)
        if (d.kind === "building" && d.issue !== null) tickets.set(d.issue, d.outcome);
    return `<tr><td>${esc(login)}</td><td>${
      [...tickets]
        .sort((a, b) => a[0] - b[0])
        .map(([n, outcome]) => `#${n} ${state(outcome)}`)
        .join(" ") || `<span class="muted">none</span>`
    }</td></tr>`;
  });

  // Time parked on a teammate's ticket: a `teammate-blocker` wait, from its open and its close.
  const parked = runs.flatMap((e) =>
    e.record.human_steps
      .filter((s) => s.cause === "teammate-blocker")
      .map((s) => {
        const ticket =
          s.issue ?? e.record.delegations.find((d) => d.id === s.delegation)?.issue ?? null;
        return { login: loginOf(e), step: s, ticket };
      }),
  );
  const parkedSeconds = parked.reduce((n, p) => n + (p.step.waited_seconds ?? 0), 0);

  // Spec totals.
  const stepsTotal = runs.reduce((n, e) => n + e.record.summary.human_steps, 0);
  const listed = [...new Set(runs.flatMap((e) => e.record.run.tickets))].sort((a, b) => a - b);
  // The record holds no per-ticket merge: a ticket counts by the outcome of the run it landed in.
  const landedIn = (n, outcome) =>
    runs.some(
      (e) =>
        e.record.run.outcome === outcome &&
        e.record.delegations.some((d) => d.issue === n && d.outcome === "landed"),
    );
  const merged = listed.filter((n) => landedIn(n, "merged"));
  const partly = listed.filter((n) => !merged.includes(n) && landedIn(n, "partly-merged"));

  return page(
    specRoute(repository, spec),
    `<div class="crumbs"><a href="#/">All repositories</a> / ${link(`/repo/${repository}`, esc(repository))} / Spec #${spec}</div>
<h1>Spec #${spec}</h1>
<p class="muted">${plural(runs.length, "Team Run")} by ${plural(logins.length, "login")} in ${code(repository)}, on one clock.</p>
${missingTeammates(code, sink)}
<p class="small">Logins found: ${logins.map(esc).join(", ")}. Live state, including open runs, is on the Shared Board: ${code(`/orchestrate --status --spec ${spec}`)}. This page never reads the tracker.</p>
<div class="panel"><h2>Spec totals</h2>
<dl class="dl" data-totals>
  <dt>First start to last close</dt><dd>${esc(duration((t1 - t0) / 1000))}</dd>
  <dt>Human steps</dt><dd>${stepsTotal}</dd>
  <dt>Tickets landed in merged runs</dt><dd>${merged.length} of ${listed.length} listed tickets landed in merged runs <span class="muted small">(the record holds no per-ticket merge: a ticket counts when its Delegation landed in a run that merged)</span></dd>
  <dt>Landed in partly-merged runs</dt><dd>${partly.length} more <span class="muted small">(landed in a run that merged only part of its work, so the record cannot say whether they merged)</span></dd>
  <dt>Parked on a teammate</dt><dd>${esc(duration(parkedSeconds))}</dd>
</dl></div>
<div class="panel"><h2>Lanes</h2>
<p class="muted small">One lane per run, grouped under its login, on one clock from the first start to the last close. A band coloured as a teammate blocker is a ticket parked on a teammate's ticket. Everything else is grey.</p>
<svg class="timeline" data-chart="spec-lanes" viewBox="0 0 ${LANE_LABEL + LANE_W + 30} ${runs.length * LANE_H + 28}" role="img" aria-label="Lanes of the Team Runs over spec ${spec}">${parts.join("")}</svg>
${table(["Login", "Run", "Harness", "Model", "Started", "Length", "Outcome", "Takeover"], laneRows, ' data-table="lanes"')}</div>
<div class="panel"><h2>Tickets each teammate built</h2>${table(["Login", "Tickets"], built, ' data-table="tickets-built"')}</div>
<div class="panel"><h2>Parked on a teammate's ticket</h2>${
      parked.length
        ? table(
            [
              "Login",
              "Ticket parked",
              "Blocked on",
              "Teammate",
              "Cause",
              "Time parked",
              "Unparked",
            ],
            parked.map(
              (p) =>
                `<tr><td>${esc(p.login ?? "")}</td><td>${p.ticket === null ? "" : `#${p.ticket}`}</td><td>${p.step.blocker ? `#${p.step.blocker}` : "a teammate's ticket"}</td><td>${p.step.blocker_login ? esc(p.step.blocker_login) : ""}</td><td>${chip("teammate-blocker")}</td><td>${p.step.waited_seconds === null ? "" : esc(duration(p.step.waited_seconds))}</td><td class="nowrap">unparked ${esc(p.step.at)}</td></tr>`,
            ),
            ' data-table="parked"',
          )
        : `<p class="muted">No ticket was parked on a teammate's ticket.</p>`
    }</div>`,
  );
}

/** One Spec page per `(repository, spec)` that has a Team Run. */
export function specPages(kit, entries, context) {
  return specGroups(entries).map((group) => specPage(kit, group, context));
}
