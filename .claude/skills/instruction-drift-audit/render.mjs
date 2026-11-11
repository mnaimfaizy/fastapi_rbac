/**
 * Renders a normalized Upstream Brief report as the Markdown brief.
 *
 * One direction only: normalized report in, Markdown out. Nothing here
 * validates, and nothing here decides — `report.mjs` already dropped every
 * entry the contract refused, so a section that renders empty renders
 * `_None._` rather than disappearing. A section that vanishes when it has
 * nothing in it reads as a section nobody ran; `_None._` is DESIGN.md §8's
 * "zero is allowed and says what was considered", applied to every section.
 *
 * Imports nothing, for the reason written at the top of `report.mjs` beyond
 * the vocabularies it must share with the contract.
 *
 * SECTION ORDER IS THE CONTRACT. `BRIEF_SECTIONS` is the order, in one place,
 * and `render.test.mjs` asserts the rendered headings against it in sequence.
 * Early free-Markdown briefs invented a "checked and clear" section the
 * template lacked (DESIGN.md, Lessons), which is what a fixed order is for.
 */

import { ENTRY_LIST_FIELDS, UPSTREAM_URGENCIES, URGENCY_TITLES } from "./report.mjs";

/**
 * Every section the brief emits, in the only order it emits them.
 *
 * `Upstream Findings` carries the `plan`-disposed findings and `Follow-on`
 * carries the `follow-on`-disposed ones — a finding appears in exactly one of
 * the two, never both. That split is DESIGN.md §9 (the proposed plan may
 * touch instructions, Skills, hygiene scripts, and the adapter, and nothing
 * else) read as a rendering rule: the plan section is the plan.
 */
export const BRIEF_SECTIONS = /** @type {const} */ ([
  "Delta",
  "Upstream Findings",
  "Checked and clear",
  "Upstream Opportunities",
  "Incidental Observations",
  "Follow-on",
  "Unverified",
  "Failed hops",
  "Scanned",
]);

/** What a section says when it has nothing in it. */
export const EMPTY_SECTION = "_None._";

/**
 * Inline code that survives its own content.
 *
 * A local citation quotes a line verbatim, and the lines this repo's
 * instruction files are made of are full of backticks — "Always `await
 * cookies()` in a Server Component." wrapped in single backticks renders as
 * three broken spans. CommonMark's rule is that a span is delimited by a run
 * of backticks longer than any run inside it, and that one leading and one
 * trailing space are stripped, so the fence is sized to the content and
 * padded when the content would otherwise touch the fence.
 */
const code = (value) => {
  const text = String(value);
  const longest = [...text.matchAll(/`+/g)].reduce(
    (max, match) => Math.max(max, match[0].length),
    0,
  );
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
};

/** `file:line` plus the literal text the report says is there. */
const citationLine = (c) => `  - ${code(`${c.file}:${c.line}`)} — ${code(c.text)}`;

const localBlock = (entry, label = "Local evidence") =>
  entry.local?.length
    ? [`  - **${label}:**`, ...entry.local.map((c) => `  ${citationLine(c)}`)]
    : [];

const sourceLine = (source, quote) =>
  `  - **Source:** <${source.url}> (page version ${code(source.pageVersion)}) — ` + `“${quote}”`;

/**
 * A section body, or `_None._`. Callers pass the lines they would emit; this
 * is the single place the empty case is decided, so no section can grow its
 * own idea of what empty looks like.
 */
const section = (title, lines) => [
  `## ${title}`,
  "",
  ...(lines.length ? lines : [EMPTY_SECTION]),
  "",
];

/** Group entries by their Ecosystem's lead, preserving report order. */
function byEcosystem(ecosystems, pick) {
  const groups = [];
  for (const eco of ecosystems) {
    const entries = pick(eco);
    if (entries.length) groups.push({ lead: eco.lead, entries });
  }
  return groups;
}

const groupedLines = (groups, renderEntry) =>
  groups.flatMap(({ lead, entries }) => [`### ${lead}`, "", ...entries.flatMap(renderEntry), ""]);

// ── Entry renderers ─────────────────────────────────────────────────────────

const findingLines = (finding, lead) => [
  `- **${finding.type}** — ${finding.claim}`,
  `  - **Ecosystem:** ${code(lead)}`,
  sourceLine(finding.source, finding.source.quote),
  `  - **Evidence:** ${code(finding.evidence)}`,
  ...(finding.executed
    ? [`  - **Executed:** ${code(finding.executed.command)} → exit ${finding.executed.exitCode}`]
    : []),
  // DESIGN.md §5: a downgrade is recorded, not just applied silently —
  // a reader comparing this to the claim's own wording should see why its
  // urgency is not the one the worker originally gave it.
  ...(finding.downgradedFrom
    ? [`  - **Downgraded from:** ${code(finding.downgradedFrom)} — ${finding.downgradeReason}`]
    : []),
  ...localBlock(finding),
];

const checkedAndClearLines = (entry) => [
  `- ${entry.claim}`,
  `  - **Holds for:** ${code(entry.holdsFor)}`,
  sourceLine(entry.source, entry.source.quote),
  ...localBlock(entry),
];

const opportunityLines = (entry) => [
  `- **${entry.technique}**`,
  `  - **Benefit (upstream's words):** “${entry.benefitQuote}”`,
  `  - **Source:** <${entry.source.url}> (page version ${code(entry.source.pageVersion)})`,
  ...(entry.minVersion ? [`  - **Adoptable from:** ${code(entry.minVersion)}`] : []),
  ...localBlock(entry, "Local sites"),
];

const incidentalLines = (entry) => [
  `- ${entry.summary}`,
  `  - **Owner:** ${code(entry.owner)}`,
  ...localBlock(entry),
];

/**
 * Every finding of one disposition, grouped under an urgency heading, most
 * urgent first.
 *
 * Both the plan section and the Follow-on section are this shape, and the only
 * thing that differs is which disposition they take — so it is written once.
 * Urgency is the outer grouping rather than the Ecosystem because urgency
 * orders the plan (DESIGN.md §5); the Ecosystem is recorded on each finding
 * instead.
 */
const findingsByUrgency = (report, disposition) =>
  UPSTREAM_URGENCIES.flatMap((urgency) => {
    const atUrgency = report.ecosystems.flatMap((eco) =>
      eco[ENTRY_LIST_FIELDS.upstreamFinding]
        .filter((f) => f.urgency === urgency && f.disposition === disposition)
        .map((f) => ({ f, lead: eco.lead })),
    );
    if (!atUrgency.length) return [];
    return [
      `### ${URGENCY_TITLES[urgency]}`,
      "",
      ...atUrgency.flatMap(({ f, lead }) => findingLines(f, lead)),
      "",
    ];
  });

// ── The brief ───────────────────────────────────────────────────────────────

/**
 * @param {object} report a normalized report from `normalizeUpstreamReport`
 * @returns {string} the Markdown brief, newline-terminated
 */
export function renderUpstreamBrief(report) {
  const leads = report.ecosystems.map((e) => e.lead);
  const lines = [
    `# Upstream Brief: ${leads.join(", ")}`,
    "",
    `- **Date:** ${report.date}`,
    `- **Commit:** ${code(report.commit)} — every local citation below was ` +
      "checked against the tree at this commit",
    "- **Ecosystems:**",
  ];

  for (const eco of report.ecosystems) {
    lines.push(
      `  - ${code(eco.lead)} — Baseline ${code(eco.baseline)}, ` +
        (eco.horizon ? `Horizon ${code(eco.horizon)}` : "no Horizon") +
        `; members ${eco.members.map(code).join(", ")}`,
    );
    for (const note of eco.driftNotes) lines.push(`    - drift: ${note}`);
  }
  lines.push("");

  // 1. Delta (DESIGN.md §11). Absent on the first run per Ecosystem, which
  //    has no ledger to carry forward and so starts a fresh delta.
  const delta = report.delta;
  lines.push(
    ...section("Delta", [
      ...(delta?.newFindings ?? []).map((d) => `- **New:** ${d}`),
      ...(delta?.resolved ?? []).map((d) => `- **Resolved:** ${d}`),
      ...(delta?.stillPresent ?? []).map((d) => `- **Still present:** ${d}`),
    ]),
  );

  // 2. Upstream Findings — the plan.
  lines.push(...section("Upstream Findings", findingsByUrgency(report, "plan")));

  // 3. Checked and clear — the other half of the two-directional audit
  //    (DESIGN.md §6). An Instruction Claim that held is a result.
  lines.push(
    ...section(
      "Checked and clear",
      groupedLines(
        byEcosystem(report.ecosystems, (eco) => eco[ENTRY_LIST_FIELDS.checkedAndClear]),
        checkedAndClearLines,
      ),
    ),
  );

  // 4. Upstream Opportunities (DESIGN.md §8).
  lines.push(
    ...section(
      "Upstream Opportunities",
      groupedLines(
        byEcosystem(report.ecosystems, (eco) => eco[ENTRY_LIST_FIELDS.upstreamOpportunity]),
        opportunityLines,
      ),
    ),
  );

  // 5. Incidental Observations — real defects no upstream statement grounds
  //    (DESIGN.md §7). Routed to an owner, never counted, never in the plan.
  lines.push(
    ...section(
      "Incidental Observations",
      groupedLines(
        byEcosystem(report.ecosystems, (eco) => eco[ENTRY_LIST_FIELDS.incidentalObservation]),
        incidentalLines,
      ),
    ),
  );

  // 6. Follow-on — upstream-grounded findings the plan may not touch.
  lines.push(...section("Follow-on", findingsByUrgency(report, "follow-on")));

  // 7. Unverified — what the validator refused, and why. The reason is the
  //    point: an Ecosystem's good findings stand, and the dropped one is
  //    named rather than silently absent (DESIGN.md §3).
  lines.push(
    ...section(
      "Unverified",
      report.unverified.map(
        (u) =>
          `- ${code(u.ecosystem)} ${code(u.where)} (${u.kind}) — ` +
          `**${u.reason}**: ${u.detail}. Claim: ${u.label}`,
      ),
    ),
  );

  // 8. Failed hops — a failed hop still yields a partial brief (DESIGN.md, Boundary,
  //    retained), so it is recorded rather than allowed to sink the run.
  lines.push(
    ...section(
      "Failed hops",
      report.failedHops.map((h) => `- ${code(h.ecosystem)} — ${h.reason}`),
    ),
  );

  // 9. Scanned — what the run actually read. "None in scanned files" named no
  //    scanned files in every early brief (DESIGN.md §6); this is the fix.
  lines.push(
    ...section(
      "Scanned",
      report.scanned.map((s) => `- ${code(s)}`),
    ),
  );

  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}
