/**
 * The live run board as HTML: pure functions from a run's Run Events (and the
 * prose that sits in its local run folder) to one self-reloading page.
 *
 * `boardModel(input)` folds the Run Events into cards, waits, Rulings and a
 * feed; `renderBoard(model, options)` puts them in the shared shell with the
 * shared stylesheet, so the board and the past-runs dashboard read as one
 * tool. The page carries its data inline, reloads itself about every 15
 * seconds and holds no credential: prose comes in only through `logs` and
 * `ledger`, which the caller read from the local run folder.
 *
 * With `live` set, the optional server is serving the page: instead of the
 * timed reload it connects to the server, reloads on each pushed Run Event,
 * and says where `board.html` is once the server stops.
 *
 * Colour means `cause` and nothing else: a cause is a `c-<cause>` class, and
 * states are grey.
 */

import { CAUSE_INFO, chip, duration } from "./dashboard.mjs";
import { esc, shell } from "./shell.mjs";

export const COLUMNS = Object.freeze([
  "Planned",
  "Needs you",
  "Running",
  "Checking",
  "Landed",
  "Merged",
]);

/** The board states of RUN.md, each in the column it belongs to. A Delegation with an open wait of its own is in Needs you instead. */
const COLUMN_OF = Object.freeze({
  planned: "Planned",
  parked: "Planned",
  running: "Running",
  "sent back": "Running",
  waiting: "Needs you",
  stalled: "Needs you",
  crashed: "Needs you",
  reported: "Checking",
  verified: "Checking",
  passed: "Checking",
  failed: "Checking",
  void: "Checking",
  "awaiting ruling review": "Checking",
  "ready to merge": "Checking",
  landed: "Landed",
  analysed: "Landed",
  dropped: "Landed",
  merged: "Merged",
});

/** How a Delegation's `delegation-ended` outcome reads as a board state. */
const ENDED = Object.freeze({
  landed: "landed",
  "sent-back": "sent back",
  abandoned: "dropped",
  "analysis-delivered": "analysed",
  "qa-pass": "passed",
  "qa-fail": "failed",
});

/** The heartbeat interval in minutes when the caller gives none: HARNESSES.md's default. */
export const HEARTBEAT_MINUTES = 10;
/** A Chief of Staff may miss one firing and still be well: stale is past this many intervals. */
export const STALE_INTERVALS = 2;
/** The page reloads itself this often. */
export const RELOAD_SECONDS = 15;

const FEED_SIZE = 40;
const ms = (iso) => Date.parse(iso);
const words = (text) => String(text).replaceAll("-", " ");
const stepName = (kind) => words(kind);

// --- Rulings: the Ledger's prose, read from `rulings.md`.

/**
 * The Ruling Ledger (`rulings.md`) as entries. A line `**Field:** …` starts a
 * field, and the lines under it belong to it.
 * @returns {{id: string, question: string, delegation: string, options: string[], choice: string, evidence: string, cites: string[], verdict: string, verdictLine: string}[]}
 */
export function parseLedger(text) {
  const entries = [];
  for (const block of text.split(/^### (?=R\d+:)/m).slice(1)) {
    const [head, ...lines] = block.split(/\r?\n/);
    const named = /^(R\d+): (.*)$/.exec(head);
    if (!named) continue;
    const fields = {};
    let current = null;
    for (const line of lines) {
      const field = /^\*\*([A-Za-z ]+):\*\*\s*(.*)$/.exec(line);
      if (field) {
        current = field[1].toLowerCase();
        fields[current] = [field[2]];
      } else if (current) fields[current].push(line);
    }
    const one = (name) => (fields[name] ?? []).join("\n").trim();
    const options = (fields.options ?? [])
      .map((l) => /^\s*\d+\.\s+(.*)$/.exec(l)?.[1])
      .filter(Boolean);
    const verdictLine = one("verdict");
    const verdict =
      /^(unreviewed|upheld|overturned|needs re-review)/i.exec(verdictLine)?.[1].toLowerCase() ??
      "unreviewed";
    const cites = one("cites")
      .split(/[,\s]+/)
      .filter((c) => /^R\d+$/.test(c));
    entries.push({
      id: named[1],
      question: named[2],
      delegation: one("delegation").split(/[,\s]/)[0] ?? "",
      options,
      choice: one("choice"),
      evidence: one("evidence"),
      cites,
      verdict,
      verdictLine,
    });
  }
  return entries;
}

// --- The model.

/**
 * @param {{events: object[], now: number, states?: Record<string, string>, ledger?: object[] | null, heartbeatMinutes?: number | null}} input
 *   `events` are checked and sorted. `states` is the State column of `board.md`, by Delegation id:
 *   it holds states no Run Event carries (`reported`, `verified`, `ready to merge`), so it wins
 *   where it has the row. `heartbeatMinutes` null means no heartbeat is armed, so nothing is stale.
 */
export function boardModel({ events, now, states = {}, ledger = null, heartbeatMinutes = null }) {
  const run = {
    id: null,
    repo: null,
    tracker: null,
    spec: null,
    team: false,
    kind: null,
    authority: "relay",
    landing: null,
    tickets: [],
    closed: null,
  };
  /** @type {Map<string, any>} */
  const delegations = new Map();
  const waits = new Map();
  const rulingEvents = new Map();
  const ensure = (id, at) => {
    if (!delegations.has(id))
      delegations.set(id, {
        id,
        issue: Number(/^d(\d+)/.exec(id)?.[1]) || null,
        facts: {},
        states: [{ state: "planned", at }],
        state: "planned",
        before: "running",
        events: [],
        waits: [],
      });
    return delegations.get(id);
  };
  const track = (d, state, at) => {
    if (d.state === state) return;
    d.states.push({ state, at });
    d.state = state;
  };

  for (const e of events) {
    if (e.kind === "run-opened") {
      Object.assign(run, {
        repo: e.repo ?? null,
        tracker: e.tracker ?? "github",
        spec: e.spec ?? null,
        team: e.team,
        kind: e.run_kind,
        authority: e.decision_authority,
        landing: e.landing ?? null,
        tickets: e.tickets ?? [],
        openedAt: e.at,
      });
      for (const n of run.tickets) ensure(`d${n}`, e.at);
    } else if (e.kind === "plan-approved" && e.decision_authority) {
      run.authority = e.decision_authority;
    } else if (e.kind === "run-closed") {
      run.closed = { at: e.at, outcome: e.outcome };
    }
    const d = e.delegation ? ensure(e.delegation, e.at) : null;
    if (d) d.events.push(e);

    if (e.kind === "delegation-started") {
      d.issue = e.issue ?? d.issue;
      d.facts = {
        kind: e.delegation_kind,
        executor: e.executor,
        model: e.model,
        route: e.start_route,
        startedAt: e.at,
      };
      track(d, "running", e.at);
    } else if (e.kind === "send-back") {
      track(d, "sent back", e.at);
      d.before = "sent back";
    } else if (e.kind === "delegation-landed") {
      track(d, "landed", e.at);
    } else if (e.kind === "delegation-ended") {
      const next = ENDED[e.outcome];
      if (next) track(d, next, e.at);
    } else if (e.kind === "qa-result" && e.result !== "waiting") {
      track(d, e.result === "pass" ? "passed" : "failed", e.at);
    } else if (e.kind === "wait-opened") {
      const wait = {
        id: e.wait_id,
        delegation: e.delegation ?? null,
        stepKind: e.step_kind,
        cause: e.cause,
        how: e.how,
        card: e.card ?? null,
        issue: e.issue ?? null,
        blocker: e.blocker ?? null,
        blockerLogin: e.blocker_login ?? null,
        openedAt: e.at,
        closedAt: null,
        covers: [],
      };
      waits.set(wait.id, wait);
      if (d) {
        d.waits.push(wait);
        // A Delegation that is working and stops on a wait is `waiting`; one not yet started stays `planned`.
        // A wait on a teammate's ticket waits on nobody here: it parks the Delegation instead.
        // A teammate wait on a Delegation not started yet leaves it `planned`; its card still shows it.
        // A parked Delegation that then waits on the human is `waiting`; it returns to `parked` after.
        const parks = onTeammate(wait);
        if (d.state === "running" || d.state === "sent back") {
          d.before = d.state;
          track(d, parks ? "parked" : "waiting", e.at);
        } else if (d.state === "parked" && !parks) track(d, "waiting", e.at);
      }
    } else if (e.kind === "wait-closed") {
      const wait = waits.get(e.wait_id);
      if (wait) {
        wait.closedAt = e.at;
        wait.covers = e.covers ?? [];
        const owner = wait.delegation ? delegations.get(wait.delegation) : null;
        const still = owner ? owner.waits.filter((w) => !w.closedAt) : [];
        if (
          owner &&
          (owner.state === "waiting" || owner.state === "parked") &&
          !still.some((w) => !onTeammate(w))
        )
          track(owner, still.length ? "parked" : owner.before, e.at);
      }
    } else if (e.kind === "ruling-made") {
      rulingEvents.set(e.ruling, {
        id: e.ruling,
        delegation: e.delegation,
        madeAt: e.at,
        history: [],
      });
    } else if (e.kind === "ruling-verdict") {
      const r = rulingEvents.get(e.ruling) ?? {
        id: e.ruling,
        delegation: null,
        madeAt: null,
        history: [],
      };
      r.history.push({ at: e.at, verdict: e.verdict });
      rulingEvents.set(e.ruling, r);
    }
  }
  if (run.closed?.outcome === "merged")
    for (const d of delegations.values())
      if (d.state === "landed") track(d, "merged", run.closed.at);

  // Rulings exist in autonomous runs only. The Ledger gives the prose; the events give the history.
  const rulings = [];
  if (run.authority === "autonomous") {
    const known = new Map((ledger ?? []).map((r) => [r.id, r]));
    const ids = [...new Set([...known.keys(), ...rulingEvents.keys()])];
    for (const id of ids) {
      const l = known.get(id);
      const ev = rulingEvents.get(id);
      const last = ev?.history.at(-1)?.verdict;
      rulings.push({
        id,
        delegation: l?.delegation || ev?.delegation || null,
        question: l?.question ?? null,
        options: l?.options ?? [],
        choice: l?.choice ?? null,
        evidence: l?.evidence ?? null,
        cites: l?.cites ?? [],
        verdict: l?.verdict ?? (last ? last : "unreviewed"),
        verdictLine: l?.verdictLine ?? null,
        madeAt: ev?.madeAt ?? null,
        history: ev?.history ?? [],
      });
    }
  }
  const unreviewed = rulings.filter(
    (r) => r.verdict === "unreviewed" || r.verdict === "needs re-review",
  );

  // The board's own State column, where it has the row, is the exact state; the events give the rest.
  for (const d of delegations.values()) {
    const given = states[d.id]?.toLowerCase();
    if (given && given !== d.state)
      track(d, given, d.events.at(-1)?.at ?? run.openedAt ?? events[0]?.at);
    d.sinceAt = d.states.at(-1).at;
    // Only a wait on the human is in Needs you; a wait on a teammate's ticket stays on its card.
    d.open = d.waits.filter((w) => !w.closedAt && !onTeammate(w));
    d.parkedOn = d.waits.filter((w) => !w.closedAt && onTeammate(w));
    d.column = d.open.length ? "Needs you" : (COLUMN_OF[d.state] ?? "Running");
    d.rulings = rulings.filter((r) => r.delegation === d.id);
  }

  // What waits on the human, from the one source the Needs you column is drawn from: each open wait
  // on the human, and each card board.md puts in Needs you (`stalled`, `crashed`) with no wait open.
  // The banner, the tab title, the favicon and the notifications all count this list.
  const open = [
    ...[...waits.values()].filter((w) => !w.closedAt && !onTeammate(w)),
    ...[...delegations.values()]
      .filter((d) => d.column === "Needs you" && !d.open.length)
      .map((d) => ({
        id: `state:${d.id}`,
        delegation: d.id,
        state: d.state,
        stepKind: null,
        cause: null,
        how: null,
        openedAt: d.sinceAt,
        closedAt: null,
      })),
  ];
  const last = events.at(-1)?.at ?? null;
  const staleAfterMs =
    heartbeatMinutes && !run.closed ? heartbeatMinutes * STALE_INTERVALS * 60_000 : null;
  const stale = staleAfterMs !== null && last !== null && now - ms(last) > staleAfterMs;

  return {
    run,
    now,
    delegations: [...delegations.values()],
    waits: [...waits.values()],
    open,
    rulings,
    unreviewed: unreviewed.length,
    feed: events
      .filter((e) => e.kind !== "heartbeat")
      .slice(-FEED_SIZE)
      .reverse(),
    lastEventAt: last,
    heartbeatMinutes,
    staleAfterMs,
    stale,
    events,
  };
}

/** A wait on a teammate's ticket: by design, and on nobody in this session. */
const onTeammate = (w) => w.cause === "teammate-blocker";

// --- Text.

/** Where the human answers a wait, in words. */
function howText(w) {
  if (w.state) return "Look at it in the Chief of Staff chat";
  if (onTeammate(w))
    return `Waits for ${w.blocker ? `#${w.blocker}` : "a teammate's ticket"} to merge${w.blockerLogin ? ` (@${w.blockerLogin}'s ticket)` : ""}: nothing to answer`;
  if (w.how === "card")
    return `Click the New task card${w.card ? ` ${w.card}` : ""} in the Chief of Staff session`;
  if (w.how === "github") return "Answer on GitHub";
  return "Answer in the Chief of Staff chat";
}

const waitTitle = (w) =>
  w.state
    ? `${w.delegation} is ${w.state}`
    : w.cause === "teammate-blocker" && w.blocker
      ? `Parked on #${w.blocker}${w.blockerLogin ? ` (@${w.blockerLogin})` : ""}`
      : stepName(w.stepKind);

/** One Run Event as a line, from its safe fields only. */
export function eventText(e) {
  const who = e.delegation ? `${e.delegation}: ` : "";
  switch (e.kind) {
    case "run-opened":
      return `Run opened (${e.run_kind}${e.spec ? ` over spec #${e.spec}` : ""}, ${e.decision_authority})`;
    case "plan-approved":
      return "Plan approved";
    case "delegation-started":
      return `${who}started (${e.delegation_kind}, ${e.start_route === "card" ? "from a card" : "direct"})`;
    case "delegation-landed":
      return `${who}landed`;
    case "delegation-ended":
      return `${who}ended, ${words(e.outcome)}`;
    case "send-back":
      return `${who}sent back`;
    case "decision-request":
      return `${who}Decision Request ${e.id}`;
    case "ruling-made":
      return `${e.ruling} made for ${e.delegation}`;
    case "ruling-verdict":
      return `${e.ruling} ${e.verdict}`;
    case "wait-opened":
      if (onTeammate(e))
        return `${who}parked on ${e.blocker ? `#${e.blocker}` : "a teammate's ticket"}${e.blocker_login ? ` (@${e.blocker_login})` : ""}`;
      return `${who}waiting on you: ${stepName(e.step_kind)} (${words(e.cause)}), ${e.how}`;
    case "wait-closed":
      return `wait ${e.wait_id} closed`;
    case "human-step":
      return `${who}you: ${stepName(e.step_kind)}`;
    case "write":
      return `${who}write: ${words(e.write_kind)}${e.as_human ? " as you" : ""}`;
    case "review":
      return `review round ${e.round} on #${e.pr}: ${e.findings} found, ${e.fixed} fixed`;
    case "ci":
      return `CI on #${e.pr}: ${e.result}`;
    case "qa-result":
      return `${who}QA ${e.result}`;
    case "pull-request":
      return `pull request #${e.pr} opened`;
    case "run-closed":
      return `Run closed, ${words(e.outcome)}`;
    default:
      return e.kind;
  }
}

// --- Markup.

const stamp = (iso) =>
  `<time class="nowrap" datetime="${esc(iso)}">${esc(iso.slice(11, 19))}Z</time>`;
const since = (iso, now) =>
  `<span class="age" data-since="${esc(iso)}">${esc(duration((now - ms(iso)) / 1000))}</span>`;
const stateTag = (text) => `<span class="state">${esc(text)}</span>`;

function waitLine(w, now) {
  return `<span class="wait-how">${esc(howText(w))}</span> · <span class="muted">waiting ${since(w.openedAt, now)}</span>`;
}

function rulingBadge(r) {
  return `<a class="state ruling" href="#open=r:${esc(r.id)}">${esc(r.id)} ${esc(r.verdict)}</a>`;
}

function card(d, now) {
  const waits = d.open
    .map(
      (w) =>
        `<div class="wait">${chip(w.cause)} <b>${esc(waitTitle(w))}</b><br>${waitLine(w, now)}</div>`,
    )
    .join("");
  const parked = d.parkedOn
    .map(
      (w) =>
        `<div class="wait parked-on" data-wait="${esc(w.id)}">${chip(w.cause)} <b>${esc(waitTitle(w))}</b><br><span class="muted">parked ${since(w.openedAt, now)}</span></div>`,
    )
    .join("");
  const badges = d.rulings.map(rulingBadge).join(" ");
  return `<div class="card" data-delegation="${esc(d.id)}" data-state="${esc(d.state)}">
  <a class="card-head" href="#open=d:${esc(d.id)}"><b>${esc(d.id)}</b>${d.issue ? ` <span class="muted">#${d.issue}</span>` : ""}</a>
  <div>${stateTag(d.state)} <span class="muted small">for ${since(d.sinceAt, now)}</span></div>
  ${waits}${parked}${badges ? `<div class="badges">${badges}</div>` : ""}
</div>`;
}

function runWaitCard(w, now) {
  return `<div class="card run-wait" data-wait="${esc(w.id)}">
  <a class="card-head" href="#open=run"><b>Run</b> <span class="muted">${esc(waitTitle(w))}</span></a>
  <div>${chip(w.cause)}</div>
  <div>${waitLine(w, now)}</div>
</div>`;
}

function banner(model) {
  const { open, now } = model;
  if (!open.length) return `<div class="needs none" id="needs">Nothing waits on you.</div>`;
  const rows = open
    .map(
      (w) =>
        `<li data-wait="${esc(w.id)}">${w.cause ? chip(w.cause) : stateTag(w.state)} <b>${esc(waitTitle(w))}</b>${w.delegation ? ` <a href="#open=d:${esc(w.delegation)}">${esc(w.delegation)}</a>` : ` <span class="muted">(the run)</span>`} · ${waitLine(w, now)}</li>`,
    )
    .join("");
  return `<div class="needs" id="needs"><b>${open.length} ${open.length === 1 ? "thing waits" : "things wait"} on you</b><ul>${rows}</ul></div>`;
}

function drawerFor(id, title, html) {
  return `<aside class="drawer" data-open="${esc(id)}" aria-label="${esc(title)}">
  <a class="close" href="#/" aria-label="Close">×</a>
  <h2>${esc(title)}</h2>
${html}
</aside>`;
}

function eventList(list) {
  if (!list.length) return `<p class="muted">No Run Events yet.</p>`;
  return `<ul class="events">${list.map((e) => `<li>${stamp(e.at)} ${esc(eventText(e))}</li>`).join("")}</ul>`;
}

function logBlock(text) {
  if (!text) return `<p class="muted">No Activity Log on this machine.</p>`;
  return `<pre class="log">${esc(text)}</pre>`;
}

function delegationDrawer(d, model, logs) {
  const { now } = model;
  const f = d.facts;
  const facts = [
    ["Issue", d.issue ? `#${d.issue}` : "none"],
    ["Kind", f.kind ?? "not started"],
    ["Executor", f.executor ?? "not started"],
    ["Model", f.model ?? "not started"],
    [
      "Started from",
      f.route
        ? f.route === "card"
          ? "a card you clicked"
          : "the Chief of Staff, directly"
        : "not started",
    ],
    ["Started", f.startedAt ?? "not yet"],
  ];
  const states = d.states
    .map((s, n) => {
      const end = d.states[n + 1]?.at ?? new Date(now).toISOString();
      return `<tr><td>${stateTag(s.state)}</td><td class="nowrap">${esc(s.at)}</td><td>${esc(duration((ms(end) - ms(s.at)) / 1000))}${n === d.states.length - 1 ? " so far" : ""}</td></tr>`;
    })
    .join("");
  const waits = d.waits.length
    ? d.waits
        .map(
          (w) =>
            `<li>${chip(w.cause)} <b>${esc(waitTitle(w))}</b> · ${esc(howText(w))}<br><span class="muted">${esc(w.openedAt)} ${w.closedAt ? `to ${esc(w.closedAt)} (${esc(duration((ms(w.closedAt) - ms(w.openedAt)) / 1000))})` : `still open, ${since(w.openedAt, now)}`}</span></li>`,
        )
        .join("")
    : "";
  return drawerFor(
    `d:${d.id}`,
    `${d.id}${d.issue ? ` · #${d.issue}` : ""}`,
    `<h3>Facts</h3><dl class="dl">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
<h3>States</h3><table><thead><tr><th>State</th><th>Since</th><th>For</th></tr></thead><tbody>${states}</tbody></table>
<h3>Waits</h3>${waits ? `<ul class="waits">${waits}</ul>` : `<p class="muted">No waits.</p>`}
<h3>Rulings</h3>${d.rulings.length ? `<p>${d.rulings.map(rulingBadge).join(" ")}</p>` : `<p class="muted">${model.run.authority === "autonomous" ? "None." : "Not an autonomous run."}</p>`}
<h3>Run Events</h3>${eventList(d.events)}
<h3>Activity Log</h3>${logBlock(logs[d.id])}`,
  );
}

function rulingDrawer(r) {
  const options = r.options.length
    ? `<ol>${r.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>`
    : `<p class="muted">Not in the Ruling Ledger on this machine.</p>`;
  const history = r.history.length
    ? `<ul class="events">${r.history.map((h) => `<li>${stamp(h.at)} ${esc(h.verdict)}</li>`).join("")}</ul>`
    : `<p class="muted">No verdicts yet.</p>`;
  return drawerFor(
    `r:${r.id}`,
    `${r.id}${r.question ? `: ${r.question}` : ""}`,
    `<p>${stateTag(r.verdict)}${r.delegation ? ` for <a href="#open=d:${esc(r.delegation)}">${esc(r.delegation)}</a>` : ""}${r.verdictLine ? ` <span class="muted">${esc(r.verdictLine)}</span>` : ""}</p>
<h3>Question</h3><p>${esc(r.question ?? "not in the Ledger")}</p>
<h3>Options</h3>${options}
<h3>Choice</h3><p>${esc(r.choice ?? "not in the Ledger")}</p>
<h3>Evidence</h3><p>${esc(r.evidence ?? "not in the Ledger")}</p>
<h3>Cites</h3><p>${r.cites.length ? r.cites.map((c) => `<a href="#open=r:${esc(c)}">${esc(c)}</a>`).join(", ") : "none"}</p>
<h3>Verdict history</h3>${history}
<p class="muted small">The board is read-only: uphold or overturn a Ruling in the Chief of Staff chat.</p>`,
  );
}

function runDrawer(model, logs) {
  const own = model.events.filter((e) => !e.delegation);
  return drawerFor(
    "run",
    `Run ${model.run.id}`,
    `<h3>Run Events</h3>${eventList(own)}<h3>Activity Log</h3>${logBlock(logs.run)}`,
  );
}

function links(model, { dashboardHref, sharedBoardHref }) {
  const out = [];
  if (model.run.team && sharedBoardHref)
    out.push(
      `<a href="${esc(sharedBoardHref)}">Shared Board</a> <span class="muted">(spec #${model.run.spec}, the teammates' live state: one source, not copied here; or run <code>--status --spec ${model.run.spec}</code>)</span>`,
    );
  if (model.run.closed && dashboardHref)
    out.push(
      `<a href="${esc(dashboardHref)}">This run's page in the dashboard</a> <span class="muted">(closed: review it there)</span>`,
    );
  return out.length ? `<p class="links">${out.join(" · ")}</p>` : "";
}

const FAVICON = (count) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${count ? "#b4410a" : "#3b5bdb"}"/><text x="16" y="23" font-size="20" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#fff">${count || "✓"}</text></svg>`,
  )}`;

const staleText = (model, ago) =>
  `Stale: the last heartbeat or Run Event was ${ago} ago, and the heartbeat is every ${model.heartbeatMinutes} min. The Chief of Staff may have stopped.`;

/** The data the page's own script reads. Nothing here is prose. */
const dataOf = (model) => ({
  lastEventAt: model.lastEventAt,
  staleAfterMs: model.staleAfterMs,
  heartbeatMinutes: model.heartbeatMinutes,
  closed: Boolean(model.run.closed),
  open: model.open.length,
  builtAtMs: model.now,
  reloadSeconds: RELOAD_SECONDS,
  waits: model.open.map((w) => ({ id: w.id, title: waitTitle(w), how: howText(w) })),
});

const BOARD_SCRIPT = `
(() => {
  const data = JSON.parse(document.getElementById("board-data").textContent);
  const drawers = [...document.querySelectorAll(".drawer")];
  const show = () => {
    const wanted = /^open=(.+)$/.exec((() => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ""; } })())?.[1];
    drawers.forEach((d) => d.classList.toggle("on", d.dataset.open === wanted));
    document.body.classList.toggle("drawer-open", drawers.some((d) => d.classList.contains("on")));
  };
  addEventListener("hashchange", show);
  show();
  addEventListener("keydown", (e) => { if (e.key === "Escape" && location.hash.startsWith("#open=")) location.hash = "#/"; });
  const fmt = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? h + "h " + m + "m" : m ? m + "m " + (s % 60) + "s" : s + "s"; };
  const tick = () => {
    document.querySelectorAll("[data-since]").forEach((el) => { el.textContent = fmt((Date.now() - Date.parse(el.dataset.since)) / 1000); });
    const old = document.querySelector(".stale-warning");
    const stale = data.staleAfterMs && !data.closed && data.lastEventAt && Date.now() - Date.parse(data.lastEventAt) > data.staleAfterMs;
    if (stale && !old) {
      const el = document.createElement("div");
      el.className = "banner stale-warning";
      el.setAttribute("role", "alert");
      el.textContent = document.querySelector("main").dataset.lateText.replace("{ago}", fmt((Date.now() - Date.parse(data.lastEventAt)) / 1000));
      document.querySelector("main").prepend(el);
    } else if (!stale && old) old.remove();
  };
  tick();
  setInterval(tick, 30000);
  try {
    const saved = JSON.parse(sessionStorage.getItem("orchestrate-board-scroll") || "null");
    if (saved) { window.scrollTo(0, saved.page); drawers.forEach((d) => { d.scrollTop = saved.drawer; }); sessionStorage.removeItem("orchestrate-board-scroll"); }
  } catch {}
  const reload = () => {
    try { sessionStorage.setItem("orchestrate-board-scroll", JSON.stringify({ page: scrollY, drawer: document.querySelector(".drawer.on")?.scrollTop ?? 0 })); } catch {}
    location.reload();
  };
__TAIL__})();
`;

/** The file's own way to stay fresh. */
const FILE_TAIL = `  setTimeout(reload, data.reloadSeconds * 1000);
`;

/**
 * The served page's way: it reloads on a pushed Run Event, and every 15 seconds for what no event
 * carries (`board.md`, the Activity Logs), but only once the server answers, so a stopped server
 * never leaves the browser on an error page. A wait not seen before raises a notification.
 */
const LIVE_TAIL = `  const live = JSON.parse(document.getElementById("board-live").textContent);
  const button = document.getElementById("notify");
  const can = "Notification" in window;
  let asking = false;
  if (can && Notification.permission === "default") {
    button.hidden = false;
    button.addEventListener("click", () => {
      asking = true;
      Notification.requestPermission().finally(() => { asking = false; button.hidden = Notification.permission !== "default"; });
    });
  }
  try {
    const key = "orchestrate-board-waits " + live.file;
    const seen = JSON.parse(sessionStorage.getItem(key) || "null");
    sessionStorage.setItem(key, JSON.stringify([...new Set([...(seen ?? []), ...data.waits.map((w) => w.id)])]));
    if (seen && can && Notification.permission === "granted")
      data.waits.filter((w) => !seen.includes(w.id)).forEach((w) => new Notification("Waiting on you: " + w.title, { body: w.how, tag: w.id }));
  } catch {}
  const stopped = document.querySelector(".server-stopped");
  const trouble = document.querySelector(".server-trouble");
  let due = null;
  const refresh = () => {
    due ??= setTimeout(async () => {
      due = null;
      // A reload would take the browser's permission prompt away: the next refresh comes soon enough.
      if (asking) return;
      try {
        if ((await fetch("/", { method: "HEAD", cache: "no-store" })).ok) reload();
        else trouble.hidden = false;
      } catch {}
    }, 200);
  };
  const source = new EventSource("/events?session=" + encodeURIComponent(live.session) + "&after=" + live.seq);
  source.addEventListener("run-event", refresh);
  source.addEventListener("reload", refresh);
  source.addEventListener("open", () => { stopped.hidden = true; });
  source.addEventListener("error", () => { stopped.hidden = false; });
  setInterval(refresh, data.reloadSeconds * 1000);
`;

const script = (live) => BOARD_SCRIPT.replace("__TAIL__", () => (live ? LIVE_TAIL : FILE_TAIL));

/** What only the served page holds: the notify button, and what to say once the server stops. */
const liveParts = (
  live,
) => `<p><button type="button" id="notify" hidden>Notify me of new waits</button></p>
<div class="banner server-stopped" role="alert" hidden>The server stopped, so this page no longer updates. The file board keeps working: open <code id="file-board">${esc(live.file)}</code> <button type="button" data-copy="file-board">Copy</button> (a browser does not let a served page open a file).</div>
<div class="banner server-trouble" role="alert" hidden>The server cannot build the board from the run folder, so this page is out of date. Reload it to see why.</div>
<script type="application/json" id="board-live">${JSON.stringify(live).replaceAll("<", "\\u003c")}</script>
`;

/**
 * The board, whole.
 * @param {ReturnType<typeof boardModel>} model
 * @param {{builtAt: string, rebuild: string, logs?: Record<string, string>, dashboardHref?: string | null, sharedBoardHref?: string | null, banner?: string | null, live?: {session: string, seq: number, file: string} | null}} options
 *   `logs` is the Activity Logs by Delegation id (`run` for the Chief of Staff's), already redacted.
 *   `live` is set by the server alone: its session, the events it has pushed, and `board.html`'s address.
 */
export function renderBoard(
  model,
  {
    builtAt,
    rebuild,
    logs = {},
    dashboardHref = null,
    sharedBoardHref = null,
    banner: top = null,
    live = null,
  },
) {
  const { run, now } = model;
  const columns = COLUMNS.map((name) => {
    const cards = model.delegations.filter((d) => d.column === name).map((d) => card(d, now));
    const runWaits =
      name === "Needs you"
        ? model.open.filter((w) => !w.delegation).map((w) => runWaitCard(w, now))
        : [];
    // Needs you counts what waits on the human, as the banner and the tab title do: one card may hold two waits.
    const count = name === "Needs you" ? model.open.length : cards.length;
    return `<section class="col" data-column="${esc(name)}"><h2>${esc(name)} <span class="n">${count}</span></h2>${[...runWaits, ...cards].join("\n") || `<p class="muted small">Nothing here.</p>`}</section>`;
  }).join("\n");

  const rulings =
    run.authority === "autonomous"
      ? `<section class="panel rulings" id="rulings"><h2>Rulings <span class="n">${model.unreviewed} unreviewed</span></h2>${
          model.rulings.length
            ? `<ul>${model.rulings.map((r) => `<li>${rulingBadge(r)} ${esc(r.question ?? "")}${r.delegation ? ` <span class="muted">for ${esc(r.delegation)}</span>` : ""}</li>`).join("")}</ul>`
            : `<p class="muted">No Ruling made yet.</p>`
        }<p class="muted small">Read-only: verdicts stay in the Chief of Staff chat.</p></section>`
      : "";

  const feed = `<section class="panel feed"><h2>Recent Run Events</h2>${eventList(model.feed)}</section>`;

  const count = model.open.length;
  const title = `${count ? `(${count}) ` : ""}Run ${run.id ?? ""}`.trim();
  const stale = model.stale
    ? `<div class="banner stale-warning" role="alert">${esc(staleText(model, duration((model.now - ms(model.lastEventAt)) / 1000)))}</div>`
    : "";
  const body = `${stale}${live ? liveParts(live) : ""}${banner(model)}
${links(model, { dashboardHref, sharedBoardHref })}
<div class="board-layout"><div class="kanban">${columns}</div>
<div class="side">${feed}${rulings}</div></div>
${model.delegations.map((d) => delegationDrawer(d, model, logs)).join("\n")}
${model.rulings.map(rulingDrawer).join("\n")}
${runDrawer(model, logs)}
<script type="application/json" id="board-data">${JSON.stringify(dataOf(model)).replaceAll("<", "\\u003c")}</script>`;
  return shell({
    title,
    brand: title,
    builtAt,
    rebuild: `<code>${esc(rebuild)}</code>`,
    banner: top,
    nav: [],
    home: "/",
    head: `<link rel="icon" href="${esc(FAVICON(count))}">`,
    mainAttributes: `data-late-text="${esc(staleText(model, "{ago}"))}"`,
    script: script(Boolean(live)),
    pages: [{ id: "/", html: `<section class="page" id="/">\n${body}\n</section>` }],
  });
}
