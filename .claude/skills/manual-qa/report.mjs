// Posting a QA Report, and choosing which QA Artifacts to upload (SKILL.md
// steps 8 to 11, DESIGN.md "Posting is a second step").
//
// WHAT IT DOES
//   Builds the text the skill posts and checks what it may upload. It runs no
//   `gh` command itself: SKILL.md runs each one, after the person has seen the
//   results and said yes, and hands this file what `gh` printed.
//
//   1. `read`: reads a QA Report file (SKILL.md "The QA Report") into its
//      headline, its anchors, its optional **Run deviations:** header line,
//      and one result per scenario, each one of the five (`RESULTS`) with its
//      Before cell, and says whether the run failed (a FAIL of either kind,
//      or a run stopped on a blocking outcome). It checks that the headline
//      is the one the rows imply, that `Not proven` rests on a Before that
//      showed the expected result, that `FAIL: pre-existing` names its
//      merge-base evidence, and that a `url` run ran no Before. A row that
//      ran links its evidence in backticks, its own Storyboard first when it has
//      one and its own MP4 right after it, never a raw `web.mjs` recording, or
//      says `none: <reason>`; a row left for a person may say a bare
//      `none`. With `--plan`, it also checks the report against the plan it
//      ran: the same anchors, one row per scenario, a Before cell (and
//      `Not proven`) only on a fix scenario, one that has **Expected
//      before:**, and each fix scenario's Before filled;
//      each scenario that signs in as a Scenario account left for a person
//      when the scenario creating it did not pass; and each `Review:` box the
//      plan leaves open listed under Follow-ups, with the box's text.
//   2. `find`: from a pull request's comments, the one QA Report comment to
//      update (its body's first line is exactly `<!-- qa-report -->`, and the
//      person posting wrote it), so a re-run edits it and never posts a second; and the tracker issue the
//      plan's `<!-- qa-plan-link -->` comment names. With `--head`, the
//      plan's head, it says whether that comment is for an older head.
//   3. `comment`: the PR comment body: the marker, then the report, with each
//      uploaded evidence path linked, an uploaded Storyboard shown as an image.
//   4. `stale`: a report comment's body with a **Stale:** line after the
//      marker, for `qa-plan` to edit in on the person's yes after a revision.
//      The next `comment` replaces the whole body, Stale line included.
//   5. `tracker`: the tracker issue's new body: the plan as delivered, with
//      each PASS scenario's Sign-off box ticked (every other box of a
//      scenario cleared) and its Execution record replaced by the report's.
//   6. `evidence`: which picked files may go to the `gh-release:<tag>`
//      prerelease, and under what asset names. Nothing goes with
//      `evidence.upload: none`; a file the report does not list as evidence
//      is refused, as is one neither media nor plain text (an archive, a
//      PDF, a trace); media from a failed run is refused; of the media, only
//      a Storyboard, an MP4 and the stills of a row with no Storyboard go,
//      never a Before still, a still behind a Storyboard or a raw recording,
//      each refusal naming its rule; a public repository gets a warning.
//
//   Every body it builds, and every picked text file (a log, a HAR), is
//   checked for sign-in values with the plan's own credential scan, and
//   refused when one looks present.
//
// CLI (run from the repository root; `--repo <dir>` points elsewhere)
//   node report.mjs read <report> [--plan <plan>]
//   node report.mjs find --login <login> [--head <sha>] < comments.jsonl
//   node report.mjs stale --head <sha> < comment-body.md
//   node report.mjs comment <report> [--link <path>=<url>]…
//   node report.mjs tracker <report> --issue-body <file> [--link <path>=<url>]…
//   node report.mjs evidence <report> [--pick <path>]… [--visibility <v>]
//                            [--release missing|prerelease|release] [--github <owner/name>]
//
//   Exit 0: done, or nothing refused. Exit 1: a problem or a refusal, named
//   in the output. Exit 2: usage.

import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { credentialProblems, effectiveConfig, readQaConfig, validatePlan } from "./adapter.mjs";

/** The first line of the one PR comment that carries a QA Report. */
export const REPORT_MARKER = "<!-- qa-report -->";
/** The start of the line `qa-plan` adds after the marker of a report comment for an older head. */
const STALE_START = "**Stale:** the plan was revised for head ";
const staleLine = (head, old) => `${STALE_START}${head}; this report is for ${old}.`;
/** A full head, as a plan's anchor carries it (SHA-1 or SHA-256). */
const HEAD_HEX = "[0-9a-f]{40}(?:[0-9a-f]{24})?";
const FULL_HEAD = new RegExp(`^${HEAD_HEX}$`);

/**
 * The head a report comment's **Stale:** line says the plan was revised for,
 * or `null` when it carries no such line: the first line after the marker.
 *
 * @param {string} body
 * @returns {string | null}
 */
function staleFor(body) {
  const line = lf(body ?? "")
    .split("\n")
    .slice(1)
    .find((text) => text.trim() !== "");
  const named = line?.trim().startsWith(STALE_START)
    ? line.trim().slice(STALE_START.length).split(";")[0]
    : null;
  return named && FULL_HEAD.test(named) ? named : null;
}
/** The optional QA Report header line listing where the run departed from the plan or the rules. */
const DEVIATIONS_LABEL = "- **Run deviations:**";
/** A Follow-ups line for an open `Review:` box (SKILL.md, The QA Report), its text captured. */
const REVIEW_FOLLOW_UP = /^\s*[-*]\s+Review, for a person:\s*(\S.*?)\s*$/;
/** The first line of the PR comment `qa-plan` posts naming its tracker issue. */
export const PLAN_LINK_MARKER = "<!-- qa-plan-link -->";
/** The five results a row may carry (SKILL.md step 6, DESIGN.md "Five results"). */
export const RESULTS = /** @type {const} */ ([
  "PASS",
  "FAIL: regression",
  "FAIL: pre-existing",
  "Not proven",
  "left for a person",
]);
/** The results of a scenario that ran, so it owes its evidence or `none: <reason>`. */
const RAN = RESULTS.filter((result) => result !== "left for a person");
const RESULT_WORDS = `${RESULTS.slice(0, -1).join(", ")} or ${RESULTS.at(-1)}`;
/** The three headlines, one of which a QA Report opens with, as written and as `read` names them. */
export const HEADLINES = /** @type {const} */ ({
  "**QA failed**": "QA failed",
  "**QA passed, with items listed:**": "QA passed, with items listed",
  "**QA passed**": "QA passed",
});
const HEADLINE_WORDS = Object.keys(HEADLINES)
  .map((line) => `\`${line}\``)
  .join(", ");
/** What a fix scenario's Before cell starts with: what the merge-base showed, or why it shows nothing. */
export const BEFORE_STATES = /** @type {const} */ ([
  "matched",
  "did not match",
  "showed the expected result",
  "not observed",
  "not run",
]);
const BEFORE_WORDS = BEFORE_STATES.map((state) => `\`${state}: …\``).join(", ");
/** The note a `FAIL: pre-existing` carries, naming the merge-base evidence it rests on. */
const MERGE_BASE_EVIDENCE = /(?<![A-Za-z])merge-base evidence:\s*\S/i;

/**
 * The headline a report's rows imply: a regression, or a run stopped on a
 * blocking outcome, fails it; any other result but PASS is an item a person
 * must see; only every row a PASS passes it. Results `None.` (no rows) is not
 * a pass: nothing ran, and its review boxes are the items.
 *
 * @param {{result: string}[]} results
 * @param {boolean} stopped
 * @returns {"QA failed" | "QA passed, with items listed" | "QA passed"}
 */
export function impliedHeadline(results, stopped) {
  if (stopped || results.some((row) => row.result === "FAIL: regression")) return "QA failed";
  if (!results.length || results.some((row) => row.result !== "PASS"))
    return "QA passed, with items listed";
  return "QA passed";
}
/** GitHub refuses a comment or issue body longer than this. */
export const BODY_LIMIT = 65536;
/** Still images: the only media, besides a Storyboard and an MP4, that may be uploaded. */
const STILL_TYPES = "png|jpe?g|webp|bmp|tiff?|avif|heic|svg";
/** Recordings and audio: never uploaded but as a scenario's MP4. */
const RECORDING_TYPES = "gif|mp4|m4v|mov|webm|mkv|avi|wmv|mp3|wav|ogg|m4a";
const STILL = new RegExp(`\\.(?:${STILL_TYPES})$`, "i");
/** Screenshots, recordings and audio: what a failed run never uploads. */
export const MEDIA = new RegExp(`\\.(?:${STILL_TYPES}|${RECORDING_TYPES})$`, "i");
/** Plain-text evidence: the only kind whose contents are scanned for sign-in values. */
export const TEXT = /\.(?:log|txt|har|json|jsonl|ndjson|md|csv|tsv|xml|html?|ya?ml)$/i;
/** The Evidence cell of a PASS or FAIL row that links no QA Artifact: `none: <reason>`. */
export const NO_EVIDENCE = /^none:\s*\S/;
/** A scenario's Storyboard, `s<n>-storyboard.png`: its number is the scenario's. */
const STORYBOARD = /(?:^|\/)s(\d+)-storyboard\.png$/;
/** A scenario's annotated MP4, `s<n>.mp4`: its number is the scenario's. */
const MP4 = /(?:^|\/)s(\d+)\.mp4$/;
/** A raw recording `web.mjs --video` keeps in its folder: never a row's evidence. */
const RAW_RECORDING = /(?:^|\/)s\d+(?:-before)?-web\/video-[a-z]\.webm$/;
/** Before evidence, `s<n>-before…`, a file or a folder: never uploaded on its own. */
const BEFORE = /(?:^|\/)s\d+-before(?:[-./]|$)/;

const NO_UPLOAD_FROM_FAILED =
  "media from a failed run is never uploaded: its screen is the one most likely to show " +
  "what it must not; describe the failure in the report, and keep the file local";
const RAW_UPLOAD =
  "a raw recording is never uploaded: only a scenario's MP4 (`s<n>.mp4`), which passed the " +
  "caption privacy check, goes; keep the recording local";
const BEFORE_UPLOAD =
  "a lone Before still is never uploaded: the Storyboard shows Before beside After; " +
  "keep it local";
const behindBoard = (board) =>
  `a still behind a Storyboard is never uploaded: a row with a Storyboard uploads ` +
  `\`${board}\`, its main evidence, which shows its steps captioned; keep the still local`;
const NOT_CHECKABLE =
  "only media and plain-text evidence is uploaded: an archive, a PDF or a trace can carry " +
  "screenshots and sign-in values no check here can see; keep it local";
const PUBLIC_WARNING =
  "this repository is public, so anyone can download a release asset: upload only files " +
  "that show QA Account data on a test system, and nothing of a real person or account";

const lf = (text) => String(text).replace(/^﻿/, "").replace(/\r\n/g, "\n");

/**
 * Which lines sit inside a fenced code block, fences included: the rule
 * `adapter.mjs` reads a plan by, so a `## ` line in a fence is no heading.
 *
 * @param {string[]} lines
 * @returns {boolean[]}
 */
function fencedLines(lines) {
  const fenced = [];
  let fence = null;
  for (const line of lines) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && marker) {
      fence = marker;
      fenced.push(true);
    } else if (fence !== null) {
      fenced.push(true);
      if (
        marker &&
        marker[0] === fence[0] &&
        marker.length >= fence.length &&
        line.trim() === marker
      )
        fence = null;
    } else fenced.push(false);
  }
  return fenced;
}

/** A `## <name>` heading, its closing `#`s dropped. */
const HEADING = /^## (.+?)\s*#*\s*$/;

/**
 * `## <name>` section bodies, keyed by name, each with its line range,
 * headings read as `validatePlan` reads them: outside fences, closing `#`s
 * dropped.
 */
function sections(lines) {
  const found = {};
  const fenced = fencedLines(lines);
  let current = null;
  lines.forEach((line, n) => {
    const heading = !fenced[n] && HEADING.exec(line);
    if (heading) {
      if (current) current.end = n;
      current = { start: n, end: lines.length };
      found[heading[1].trim()] = current;
    }
  });
  return found;
}

/** A table row's cells: `\|` is a pipe in a cell's text, as GitHub reads it, never a column break. */
const cells = (row) =>
  row
    .trim()
    .replace(/^\||(?<!\\)\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());

/**
 * Read a QA Report file into what posting needs. Its Results is a table of one
 * row per scenario, or `None.` for a plan with no scenarios.
 *
 * @param {string} text
 * @returns {{report: {title: string | null, headline: string | null, items: string[],
 *   subject: number | null, pr: number | null, head: string | null,
 *   target: "stack" | "url" | null, results: {id: string, scenario: string, result: string,
 *   before: string, evidence: string[], notes: string}[], failed: boolean, stopped: boolean,
 *   record: string | null, deviations: string | null, reviews: string[]},
 *   problems: string[]}}
 */
export function readReport(text) {
  const lines = lf(text).split("\n");
  const problems = [];
  const report = {
    title: null,
    // The headline the report opens with, by its name (`HEADLINES`), and the scenario
    // each `- S<n>…` line under it lists.
    headline: null,
    items: [],
    subject: null,
    pr: null,
    head: null,
    // The **Run:** line's target: a `url` run never runs Before.
    target: null,
    results: [],
    failed: false,
    stopped: false,
    record: null,
    // The **Run deviations:** line's text, or `null`: the line is left out when there were none.
    deviations: null,
    // The text of each `- Review, for a person: <text>` line under Follow-ups, outside fences.
    reviews: [],
  };
  const titleAt = lines.findIndex((line) => /^# QA Report: \S/.test(line));
  if (titleAt === -1) problems.push("no `# QA Report: <title>` line");
  else report.title = lines[titleAt].slice("# QA Report: ".length).trim();
  // The headline is the first line after the title that is not blank; its items are the
  // `- S<n>` lines after it, up to the first header line (`- **…`) or heading.
  let headlineAt = -1;
  if (titleAt !== -1) {
    headlineAt = lines.findIndex((line, n) => n > titleAt && line.trim() !== "");
    // Own keys only: a line such as `constructor` names no headline.
    const line = lines[headlineAt]?.trim() ?? "";
    if (Object.hasOwn(HEADLINES, line)) {
      report.headline = HEADLINES[/** @type {keyof typeof HEADLINES} */ (line)];
      for (const line of lines.slice(headlineAt + 1)) {
        if (/^\s*[-*]\s+\*\*/.test(line) || /^#/.test(line)) break;
        const item = /^\s*[-*]\s+(S\d+)\b/.exec(line)?.[1];
        if (item) report.items.push(item);
      }
    } else
      problems.push(
        `the report opens with no headline: the first line after its title is one of ${HEADLINE_WORDS}`,
      );
  }

  const planLine = lines.find((line) => /^- \*\*Plan:\*\*/.test(line));
  if (!planLine) problems.push("no `- **Plan:**` line");
  else {
    report.subject = Number(/subject #(\d+)/.exec(planLine)?.[1]) || null;
    report.pr = Number(/pull request #(\d+)/.exec(planLine)?.[1]) || null;
    // The full head, as the plan's anchor carries it (SHA-1 or SHA-256).
    report.head = new RegExp(`head \`(${HEAD_HEX})\``).exec(planLine)?.[1] ?? null;
    if (!report.subject) problems.push("the **Plan:** line names no `subject #<n>`");
    if (!report.pr) problems.push("the **Plan:** line names no `pull request #<n>`");
    if (!report.head) problems.push("the **Plan:** line names no full head `<sha>`");
  }
  const runLine = lines.find((line) => /^- \*\*Run:\*\*/.test(line));
  report.target = /** @type {"stack" | "url" | null} */ (
    /^- \*\*Run:\*\*\s*`(stack|url)`/.exec(runLine ?? "")?.[1] ?? null
  );

  const found = sections(lines);
  // A header line: one under a later section (Follow-ups, say) is that section's
  // prose. The header ends at the first heading read as `sections` reads one:
  // outside fences, so a `## ` line in a fenced block does not end it. Scanned
  // here, not taken from `found`, which keeps only the last of a repeated name.
  const fenced = fencedLines(lines);
  const firstHeading = lines.findIndex((line, n) => !fenced[n] && HEADING.test(line));
  const headerEnd = firstHeading === -1 ? lines.length : firstHeading;
  const deviationsLines = lines
    .slice(0, headerEnd)
    .filter((line, n) => !fenced[n] && line.startsWith(DEVIATIONS_LABEL));
  if (deviationsLines.length > 1)
    problems.push(
      `the header has ${deviationsLines.length} **Run deviations:** lines: put every departure ` +
        "on one line, separated by semicolons",
    );
  if (deviationsLines.length) {
    report.deviations = deviationsLines[0].slice(DEVIATIONS_LABEL.length).trim();
    if (!report.deviations)
      problems.push(
        "the **Run deviations:** line is empty: list each departure and what was done about it, " +
          "or leave the line out",
      );
    // The template's placeholder, copied as it stands, says the run departed when it may not have.
    else if (report.deviations.startsWith("<") || report.deviations.includes("←"))
      problems.push(
        "the **Run deviations:** line still carries the template's placeholder: write each " +
          "departure and what was done about it, or leave the line out",
      );
  }

  const followUps = found["Follow-ups"];
  if (followUps)
    report.reviews = lines
      .slice(followUps.start + 1, followUps.end)
      .filter((line, i) => !fenced[followUps.start + 1 + i])
      .map((line) => REVIEW_FOLLOW_UP.exec(line)?.[1])
      .filter((text) => text !== undefined);

  // The headline is judged from the rows, so only a problem in the rows themselves holds it back.
  const beforeRows = problems.length;
  const results = found.Results;
  if (!results) problems.push("no `## Results` section");
  else {
    const rows = lines
      .slice(results.start + 1, results.end)
      .map((line, i) => ({ line, n: results.start + 1 + i }))
      .filter(({ line }) => /^\s*\|.*\|\s*$/.test(line));
    // The first row is the header, the second its separator. A `Before` column, when
    // there is one, comes right after Result; a table without it reads every Before empty.
    const beforeAt = rows.length ? cells(rows[0].line).indexOf("Before") : -1;
    if (beforeAt !== -1 && beforeAt !== 2)
      problems.push(
        `line ${rows[0].n + 1}: the Results columns are Scenario, Result, Before, Evidence and Notes, in that order`,
      );
    for (const { line, n } of rows.slice(2)) {
      const row = cells(line);
      const [scenario = "", result = ""] = row;
      const before = beforeAt === 2 ? (row[2] ?? "") : "";
      const [evidence = "", ...notes] = row.slice(beforeAt === 2 ? 3 : 2);
      const id = /^S(\d+)\b/.exec(scenario)?.[0];
      if (!id) {
        problems.push(`line ${n + 1}: a result row names no scenario \`S<n>\``);
        continue;
      }
      const note = notes.join("|").trim();
      const at = `line ${n + 1}: ${id}`;
      if (result === "FAIL")
        // A report written before the five results: its FAIL could be either kind.
        problems.push(
          `${at}'s result is \`FAIL\`, a word QA Reports no longer use: write \`FAIL: regression\`, ` +
            "or `FAIL: pre-existing` with its merge-base evidence; the five results are " +
            RESULT_WORDS,
        );
      else if (!RESULTS.includes(/** @type {any} */ (result)))
        problems.push(`${at}'s result is \`${result}\`; expected ${RESULT_WORDS}`);
      // A fix scenario's Before: what the merge-base showed, or why it shows nothing.
      const state = BEFORE_STATES.find((word) =>
        new RegExp(`^${word}:\\s*\\S`).test(before.replace(/^_(.*)_$/, "$1")),
      );
      if (before && !state)
        problems.push(
          `${at}'s Before is \`${before}\`: it starts with one of ${BEFORE_WORDS}, or the cell is empty`,
        );
      if (result === "Not proven" && state !== "showed the expected result")
        problems.push(
          `${at} is Not proven, which is only for a fix scenario whose Before showed the expected ` +
            "result: its Before cell starts `showed the expected result: …`",
        );
      if (result === "PASS" && state === "showed the expected result")
        problems.push(
          `${at}'s Before already showed the expected result, so the run does not show the fix ` +
            "doing anything: its result is Not proven",
        );
      if (result === "FAIL: pre-existing" && before)
        problems.push(
          `${at} is a FAIL: pre-existing with a Before cell: a fix scenario whose After fails is a ` +
            "FAIL: regression",
        );
      if (result === "FAIL: pre-existing" && !MERGE_BASE_EVIDENCE.test(note))
        problems.push(
          `${at} is a FAIL: pre-existing with no merge-base evidence: its note says ` +
            "`merge-base evidence: <where>` (What automation already proves, or the two-point run), " +
            "or it is a FAIL: regression",
        );
      if (report.target === "url" && state && state !== "not run")
        problems.push(
          `${at}'s Before says \`${state}\` on a \`url\` run: Before runs only on a \`stack\` target, ` +
            "so it is `not run: the target is hosted`",
        );
      // `none: <reason>`, bare or wrapped whole in backticks, links no file, even
      // when its reason quotes an endpoint or a role in backticks.
      const reason = NO_EVIDENCE.test(evidence.replace(/^`([^`]*)`$/, "$1"));
      const paths = reason ? [] : [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      // A scenario that ran is captured by default: no path needs a stated reason.
      if (RAN.includes(result) && !paths.length && !reason)
        problems.push(
          `line ${n + 1}: ${id} is ${result}, with no evidence path: link its QA Artifact ` +
            "in backticks, or write `none: <reason>`",
        );
      // A Storyboard (`s<n>-storyboard.png`) is its row's main evidence: its own, and first.
      // Its MP4 (`s<n>.mp4`) is its own too, and comes right after it.
      const hasBoard = paths.some((path) => STORYBOARD.test(path));
      paths.forEach((path, i) => {
        if (RAW_RECORDING.test(path))
          problems.push(
            `${at} links \`${path}\`, a raw recording of web.mjs: it is never evidence; ` +
              "link the scenario's MP4 or its stills",
          );
        const video = MP4.exec(path);
        if (video && `S${video[1]}` !== id)
          problems.push(`${at} links \`${path}\`, another scenario's MP4`);
        else if (video && hasBoard && !(i === 1 && STORYBOARD.test(paths[0])))
          problems.push(
            `${at}'s MP4 sits beside its Storyboard: link it right after the Storyboard`,
          );
        const board = STORYBOARD.exec(path);
        if (!board) return;
        if (`S${board[1]}` !== id)
          problems.push(`${at} links \`${path}\`, another scenario's Storyboard`);
        else if (i > 0)
          problems.push(
            `${at}'s Storyboard is its main evidence: link it first in the Evidence cell`,
          );
      });
      report.results.push({
        id,
        scenario,
        result,
        before,
        evidence: paths,
        notes: note,
      });
    }
    // `None.` in place of the table: a plan whose Residue is only `Review:` boxes has no
    // scenarios to run (#205). Against its plan, one row per scenario still decides.
    const saysNone =
      lines
        .slice(results.start + 1, results.end)
        .filter((line) => line.trim() !== "")
        .join("\n")
        .trim() === "None.";
    if (report.results.length === 0 && !saysNone)
      problems.push(
        "the Results table has no scenario rows: write `None.` in its place only when the plan has no scenarios",
      );
    // A plan with no scenarios has a review box, which Follow-ups lists: without one, `None.`
    // could stand for a plan's scenarios in a command that reads no plan (`comment`).
    else if (report.results.length === 0 && report.reviews.length === 0)
      problems.push(
        "Results is `None.` but **Follow-ups** has no `- Review, for a person: …` line: " +
          "`None.` is only for a plan with no scenarios, whose review boxes Follow-ups lists",
      );
  }
  report.stopped = report.results.some((row) =>
    /(?<![A-Za-z])the run stopped at S\d+/i.test(row.notes),
  );
  // Any FAIL, of either kind, fails the run for uploads, whatever the headline.
  report.failed = report.stopped || report.results.some((row) => row.result.startsWith("FAIL"));
  if (report.headline && results && problems.length === beforeRows) {
    const implied = impliedHeadline(report.results, report.stopped);
    if (report.headline !== implied)
      problems.push(
        `the headline is _${report.headline}_, but the rows make it _${implied}_: a FAIL: ` +
          "regression or a stopped run fails it; any other result but PASS lists it as an item; " +
          "only every row a PASS passes it",
      );
    else if (implied === "QA passed, with items listed")
      for (const row of report.results.filter((row) => row.result !== "PASS"))
        if (!report.items.includes(row.id))
          problems.push(
            `${row.id} is ${row.result} but is not listed under the headline: add \`- ${row.id}: ` +
              `${row.result}, <why>\``,
          );
  }

  const record = found["Execution record"];
  if (!record) problems.push("no `## Execution record` section");
  else {
    report.record = lines
      .slice(record.start + 1, record.end)
      .join("\n")
      .trim();
    if (!report.record) problems.push("the Execution record section is empty");
  }
  return { report, problems };
}

/**
 * What a QA Report owes the plan it ran (SKILL.md step 8): it is that plan's
 * report, with one row per scenario, in order; and each scenario with a session
 * that signs in as a Scenario account is left for a person, saying why, when the
 * scenario that creates the account did not pass. A dependent left for a person did not
 * pass either, so the rule carries down a chain. A run stopped on a blocking
 * outcome before a dependent may give it its stop note instead. Its Follow-ups
 * lists each `Review:` box the plan leaves open, with the box's text (#222).
 *
 * @param {ReturnType<typeof readReport>["report"]} report
 * @param {string} planText
 * @returns {string[]}
 */
export function reportPlanProblems(report, planText) {
  const planned = validatePlan(planText);
  if (planned.problems.length)
    return [
      "the plan does not read cleanly: check it with `adapter.mjs plan`",
      ...planned.problems,
    ];
  const { plan } = planned;
  if (plan.subject !== report.subject || plan.pr !== report.pr || plan.anchors.head !== report.head)
    return [
      `the plan is for subject #${plan.subject}, pull request #${plan.pr}, head ${plan.anchors.head}; ` +
        `the report is for subject #${report.subject}, pull request #${report.pr}, head ${report.head}`,
    ];
  // An open box is a person's to read: one the report drops is never read. Boxes are
  // matched by text, so two open boxes with the same text are one read and need one line.
  const listed = new Set(report.reviews);
  const openBoxes = new Set(plan.reviews.filter(({ ticked }) => !ticked).map(({ text }) => text));
  const problems = [...openBoxes]
    .filter((text) => !listed.has(text))
    .map(
      (text) =>
        `the plan's open \`Review:\` box _${text}_ is not under **Follow-ups**, which must list it ` +
        "as `- Review, for a person: <its text>`, its text as the plan gives it",
    );
  const want = plan.scenarios.map((scenario) => scenario.id).join(" ");
  const got = report.results.map((row) => row.id).join(" ");
  if (want !== got)
    return [
      `the plan's scenarios are ${want}; the report's results are ${got || "none"}: ` +
        "the report needs exactly one row per scenario, in order",
      ...problems,
    ];
  const creatorOf = new Map(
    plan.scenarios.flatMap((scenario) => scenario.creates.map((id) => [id, scenario.id])),
  );
  const results = new Map(report.results.map((row) => [row.id, row]));
  // Before runs only for a fix scenario: the plan, not the report, says which one is.
  for (const { id, expectedBefore } of plan.scenarios) {
    const row = results.get(id);
    if (expectedBefore === null) {
      if (row.result === "Not proven")
        problems.push(
          `${id} is Not proven, but the plan gives it no **Expected before:**: Not proven is only ` +
            "for a fix scenario whose Before showed the expected result",
        );
      else if (row.before)
        problems.push(
          `${id} has a Before cell, but the plan gives it no **Expected before:**: only a fix ` +
            "scenario runs at the merge-base, so its Before cell is empty",
        );
    } else {
      if (!row.before)
        problems.push(
          `${id} is a fix scenario (the plan gives it **Expected before:**), but its Before cell is ` +
            "empty: say what the merge-base showed, or `not observed: <why>`, or `not run: <why>`",
        );
      if (row.result === "FAIL: pre-existing")
        problems.push(
          `${id} is a fix scenario, so a failure at the head is a FAIL: regression: ` +
            "FAIL: pre-existing is only for a scenario with no **Expected before:**",
        );
    }
  }
  for (const { id, sessions } of plan.scenarios) {
    // Every session whose Scenario account's creator did not pass: a note naming any one is the reason.
    const blocked = sessions.filter((session) => {
      const creator = creatorOf.get(session.id);
      return creator !== undefined && results.get(creator).result !== "PASS";
    });
    if (!blocked.length) continue;
    const row = results.get(id);
    const said = blocked.some(({ id: account }) =>
      new RegExp(`signs in as \`?${account}\`?, which ${creatorOf.get(account)} creates`, "i").test(
        row.notes,
      ),
    );
    // The reason asked for, when the note gives none: the first blocked session's.
    const [{ name, id: account }] = blocked;
    const creator = creatorOf.get(account);
    const who = name === null ? "" : `session ${name} `;
    const reason = `${who}signs in as \`${account}\`, which ${creator} creates, and ${creator} did not pass`;
    // A stop note counts only on a scenario after the stop, which the run never reached.
    const stop = /(?<![A-Za-z])the run stopped at S(\d+)/i.exec(row.notes);
    const stoppedBefore = stop !== null && Number(stop[1]) < Number(id.slice(1));
    if (row.result !== "left for a person" || !(said || stoppedBefore))
      problems.push(
        `${id} ${reason}: its result is _left for a person_, with the note _${reason}_`,
      );
  }
  return problems;
}

/**
 * Comments as `gh` prints them: a JSON array, the array of arrays
 * `--paginate --slurp` prints, or one JSON object per line (`--jq '.[] | …'`).
 *
 * @param {string} text
 * @returns {{id: number | string, body: string}[]}
 */
export function parseComments(text) {
  const trimmed = String(text).trim();
  if (trimmed === "") return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed).flat();
  return trimmed.split(/\r?\n/).flatMap((line) => (line.trim() ? [JSON.parse(line)] : []));
}

const firstLine = (body) =>
  lf(body ?? "")
    .split("\n")[0]
    .trim();

/**
 * The QA Report comment to update, and the tracker issue the plan's link
 * comment names. Only a report comment `login` wrote counts: one anyone else
 * wrote, marker or not, could be edited after the run to say something else,
 * so it is named in `others` and never updated. A re-run updates the oldest of
 * the person's own; any more are named as duplicates for a person to remove,
 * never deleted here. The link comment is the developer's, so any author's
 * counts: `trackerBody` checks the issue it names against the report.
 *
 * The comment to update carries the head its report's **Plan:** line names,
 * read by `readReport`, a **Stale:** line or not. Given the plan's full `head`,
 * it also says whether that head is another one: `qa-plan` warns only then.
 * A comment whose **Stale:** line already names the plan's head was marked
 * for it, so it is not stale again. `stale` is `null` when either head is not
 * a full SHA: the comment's **Plan:** line, or the `head` given.
 *
 * @param {{id: number | string, body: string, user?: string | {login?: string}}[]} comments
 *   oldest first, as GitHub lists them
 * @param {string} login who posts: `gh api user --jq .login`
 * @param {{head?: string | null}} [options] the plan's head
 * @returns {{report: {action: "update", id: number | string, duplicates: (number | string)[],
 *   head: string | null, stale?: boolean | null} | {action: "create"},
 *   others: (number | string)[], planIssue: number | null}}
 */
export function findComments(comments, login, { head = null } = {}) {
  const author = (c) => (typeof c.user === "string" ? c.user : c.user?.login);
  const marked = comments.filter((c) => firstLine(c.body) === REPORT_MARKER);
  const own = marked.filter((c) => login && author(c) === login);
  const link = comments.find((c) => firstLine(c.body) === PLAN_LINK_MARKER);
  const planIssue = link ? Number(/QA Plan: #(\d+)/.exec(link.body)?.[1]) || null : null;
  const reportHead = own.length ? readReport(own[0].body ?? "").report.head : null;
  return {
    report: own.length
      ? {
          action: "update",
          id: own[0].id,
          duplicates: own.slice(1).map((c) => c.id),
          head: reportHead,
          // Heads compare exactly, as `staleComment` compares them: both are full lowercase SHAs.
          // A head that is not one is unknown, never "same".
          ...(head
            ? {
                stale:
                  reportHead === null || !FULL_HEAD.test(head)
                    ? null
                    : reportHead !== head && staleFor(own[0].body) !== head,
              }
            : {}),
        }
      : { action: "create" },
    others: marked.filter((c) => !own.includes(c)).map((c) => c.id),
    planIssue,
  };
}

/**
 * A report comment's body marked stale after the plan was revised for `head`:
 * the marker, then the **Stale:** line, then the report. An earlier Stale line
 * is replaced, so a second revision leaves one line, naming the newest head.
 *
 * @param {string} body the comment's current body
 * @param {string} head the revised plan's full head
 * @returns {{body: string | null, problems: string[]}}
 */
export function staleComment(body, head) {
  if (!FULL_HEAD.test(String(head ?? "")))
    return { body: null, problems: [`\`${head}\` is not a full head SHA`] };
  const lines = lf(body ?? "").split("\n");
  if (lines[0].trim() !== REPORT_MARKER)
    return {
      body: null,
      problems: [`its first line is not \`${REPORT_MARKER}\`: no report comment`],
    };
  const old = readReport(body).report.head;
  if (!old) return { body: null, problems: ["its report's **Plan:** line names no full head"] };
  if (old === head)
    return { body: null, problems: [`its report is for the same head, ${head}: it is not stale`] };
  // The report, without the marker, any Stale line, and the blank lines around them.
  const rest = lines.slice(1);
  while (rest.length && (rest[0].trim() === "" || rest[0].trim().startsWith(STALE_START)))
    rest.shift();
  const marked = `${REPORT_MARKER}\n\n${staleLine(head, old)}\n\n${rest.join("\n").trim()}\n`;
  const problems = [];
  checkBody(marked, problems);
  return { body: problems.length ? null : marked, problems };
}

/**
 * Link each uploaded evidence path where the text quotes it in backticks. A
 * Storyboard shows inline, as an image that links to its asset (on a private
 * repository the image may not load, and the link still opens it); every other
 * file, an MP4 included, is a link.
 */
function linkEvidence(text, links) {
  let out = text;
  for (const [path, url] of Object.entries(links))
    out = out
      .split(`\`${path}\``)
      .join(
        STORYBOARD.test(path.replace(/\\/g, "/"))
          ? `[![${path}](${url})](${url})`
          : `[\`${path}\`](${url})`,
      );
  return out;
}

function checkBody(body, problems) {
  for (const problem of credentialProblems(body.split("\n")))
    problems.push(problem.replace(/; a plan carries.*/, "; remove it before posting"));
  if (body.length > BODY_LIMIT)
    problems.push(`the body is ${body.length} characters; GitHub takes at most ${BODY_LIMIT}`);
}

/**
 * The PR comment body: the marker on its first line, then the report.
 *
 * @param {string} reportText
 * @param {{links?: Record<string, string>}} [options] uploaded evidence path → URL
 * @returns {{body: string | null, problems: string[]}}
 */
export function reportComment(reportText, { links = {} } = {}) {
  const { problems } = readReport(reportText);
  if (problems.length) return { body: null, problems };
  const body = `${REPORT_MARKER}\n\n${linkEvidence(lf(reportText).trim(), links)}\n`;
  checkBody(body, problems);
  return { body: problems.length ? null : body, problems };
}

/**
 * The tracker issue's new body: the plan it carries, with each scenario's
 * Sign-off box ticked for PASS and cleared otherwise, and its Execution record
 * replaced by the report's, evidence linked. Boxes that are not a scenario's
 * (a Setup step, a `Review:` box) are a person's to tick, and are left as they are.
 *
 * @param {string} issueBody the issue's current body
 * @param {string} reportText
 * @param {{links?: Record<string, string>}} [options]
 * @returns {{body: string | null, problems: string[]}}
 */
export function trackerBody(issueBody, reportText, { links = {} } = {}) {
  const { report, problems } = readReport(reportText);
  if (problems.length) return { body: null, problems };
  const planned = validatePlan(issueBody);
  if (planned.problems.length)
    return {
      body: null,
      problems: [
        "the issue body is not a QA Plan that reads cleanly; post nothing to it",
        ...planned.problems,
      ],
    };
  const { plan } = planned;
  if (plan.subject !== report.subject || plan.pr !== report.pr)
    problems.push(
      `the issue carries the plan for subject #${plan.subject}, pull request #${plan.pr}; ` +
        `the report is for subject #${report.subject}, pull request #${report.pr}`,
    );
  else if (plan.anchors.head !== report.head)
    problems.push(
      `the issue's plan is for head ${plan.anchors.head}, the report's for ${report.head}: ` +
        "the plan was revised since this run; post the report as a file instead",
    );
  else {
    // One result per plan scenario, or a stale tick would outlive the run.
    const want = plan.scenarios.map((scenario) => scenario.id).join(" ");
    const got = report.results.map((row) => row.id).join(" ");
    if (want !== got)
      problems.push(
        `the plan's scenarios are ${want}; the report's results are ${got || "none"}: ` +
          "the report needs exactly one row per scenario, in order",
      );
  }
  if (problems.length) return { body: null, problems };

  const lines = lf(issueBody).split("\n");
  const found = sections(lines);
  const results = new Map(report.results.map((row) => [row.id, row.result]));
  const checklist = found["Sign-off checklist"];
  for (let n = checklist.start + 1; n < checklist.end; n++) {
    // The box shape `validatePlan` accepts, so no scenario's box is skipped.
    const box = /^(\s*[-*]\s+)\[[ xX]\](\s+(S\d+)\b.*)$/.exec(lines[n]);
    if (box && results.has(box[3]))
      lines[n] = `${box[1]}[${results.get(box[3]) === "PASS" ? "x" : " "}]${box[2]}`;
  }
  const record = sections(lines)["Execution record"];
  const recordText = linkEvidence(/** @type {string} */ (report.record), links);
  const body = [...lines.slice(0, record.start + 1), "", recordText, ...lines.slice(record.end)]
    .join("\n")
    .replace(/\n*$/, "\n");
  checkBody(body, problems);
  return { body: problems.length ? null : body, problems };
}

/**
 * Which picked files may be uploaded, and as what. Each pick is checked on
 * its own; nothing here uploads.
 *
 * @param {object} input
 * @param {string} input.upload `run.evidence.upload`: `none` or `gh-release:<tag>`
 * @param {ReturnType<typeof readReport>["report"]} input.report
 * @param {string[]} input.picks evidence paths, as the report writes them
 * @param {(path: string) => boolean} input.exists whether a path under `working_dir` is a file
 * @param {(path: string) => string} input.read a text file under `working_dir`; may throw
 * @param {string | null} [input.visibility] `gh repo view --json visibility`: PUBLIC, PRIVATE, INTERNAL
 * @param {"missing" | "prerelease" | "release" | null} [input.release] what `gh release view <tag>` found
 * @param {string | null} [input.github] `owner/name`, for the download URLs
 * @returns {{tag: string | null, release: "create" | "use" | null,
 *   accepted: {file: string, asset: string, url: string | null}[],
 *   refused: {file: string, why: string}[], warnings: string[]}}
 */
export function evidenceUpload({
  upload,
  report,
  picks,
  exists,
  read,
  visibility = null,
  release = null,
  github = null,
}) {
  const out = {
    tag: null,
    release: /** @type {"create" | "use" | null} */ (null),
    accepted: [],
    refused: [],
    warnings: [],
  };
  const refuseAll = (why) => {
    out.refused = picks.map((file) => ({ file, why }));
    return out;
  };
  if (!upload || upload === "none")
    return refuseAll("`run.evidence.upload` is `none`: QA Artifacts stay in `working_dir`");
  const tag = /^gh-release:(.+)$/.exec(upload)?.[1];
  if (!tag) return refuseAll(`\`run.evidence.upload\` is \`${upload}\`, not \`gh-release:<tag>\``);
  out.tag = tag;
  if (release === "release")
    return refuseAll(
      `release \`${tag}\` exists and is not a prerelease: QA Artifacts go only on a prerelease`,
    );
  out.release = release === "prerelease" ? "use" : "create";
  // Anything not known to be private is warned about as public.
  const seen = String(visibility ?? "").toUpperCase();
  if (seen === "INTERNAL")
    out.warnings.push(
      "this repository is internal, so everyone in the organization can download a release " +
        "asset: upload only files that show QA Account data on a test system",
    );
  else if (seen !== "PRIVATE")
    out.warnings.push(
      seen === "PUBLIC"
        ? PUBLIC_WARNING
        : `visibility not known, so treated as public: ${PUBLIC_WARNING}`,
    );

  const listed = new Map(report.results.flatMap((row) => row.evidence.map((p) => [p, row])));
  const folder = report.pr ? `qa-report-pr-${report.pr}/` : null;
  const assets = new Set();
  // A text file is read only to scan it, and a read that fails (too large,
  // not readable) refuses that pick instead of stopping the check.
  const leakIn = (path) => {
    try {
      const leak = credentialProblems(lf(read(path)).split("\n"))[0];
      return leak
        ? `${leak.replace(/; a plan carries.*/, "")}: a sign-in value is never uploaded`
        : null;
    } catch (error) {
      return `could not be read to check it (${error?.code ?? error}); keep it local`;
    }
  };
  // Of the media, only a finished file goes: a Storyboard or MP4, or the plain
  // stills of a row with no Storyboard. A Before still, a still the Storyboard
  // was built from, and a raw recording never do.
  // `read` has already refused another scenario's Storyboard or MP4 in a row.
  const unfinishedWhy = (path, row) => {
    const own = STORYBOARD.exec(path) ?? MP4.exec(path);
    if (own && `S${own[1]}` === row.id) return null;
    if (!STILL.test(path)) return RAW_UPLOAD;
    if (BEFORE.test(path)) return BEFORE_UPLOAD;
    const board = row.evidence.find((p) => STORYBOARD.test(p.replace(/\\/g, "/")));
    return board ? behindBoard(board) : null;
  };
  let leak;
  let unfinished;
  for (const file of picks) {
    const refuse = (why) => out.refused.push({ file, why });
    const normal = posix.normalize(file.replace(/\\/g, "/"));
    const media = MEDIA.test(normal);
    if (!listed.has(file)) refuse("the report lists no such evidence: pick a path from its table");
    else if (!folder || !normal.startsWith(folder) || normal.includes(".."))
      refuse(`evidence is uploaded only from \`${folder}\` in \`working_dir\``);
    else if (!media && !TEXT.test(normal)) refuse(NOT_CHECKABLE);
    else if (report.failed && media) refuse(NO_UPLOAD_FROM_FAILED);
    else if (media && (unfinished = unfinishedWhy(normal, listed.get(file)))) refuse(unfinished);
    else if (!exists(normal)) refuse("no such file in `working_dir`");
    else if (!media && (leak = leakIn(normal))) refuse(leak);
    else {
      // GitHub renames an asset with other characters, and the link would 404.
      const asset = `pr-${report.pr}-${normal.slice(folder.length)}`.replace(
        /[^A-Za-z0-9._-]/g,
        "-",
      );
      if (assets.has(asset)) refuse(`picked twice (asset \`${asset}\`)`);
      else {
        assets.add(asset);
        const url = github
          ? `https://github.com/${github}/releases/download/${tag
              .split("/")
              .map(encodeURIComponent)
              .join("/")}/${encodeURIComponent(asset)}`
          : null;
        out.accepted.push({ file, asset, url });
      }
    }
  }
  return out;
}

function option(argv, name) {
  const values = [];
  argv.forEach((arg, i) => {
    if (arg === name && argv[i + 1] !== undefined) values.push(argv[i + 1]);
  });
  return values;
}

function parseLinks(argv) {
  const links = {};
  for (const pair of option(argv, "--link")) {
    const at = pair.indexOf("=");
    if (at > 0) links[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return links;
}

/**
 * @param {string[]} argv the arguments after the script
 * @param {{readFile?: (path: string) => string | null, stdin?: () => string,
 *   read?: (path: string) => string | null, exists?: (path: string) => boolean,
 *   readEvidence?: (path: string) => string}} [io]
 * @returns {{code: number, out: string}}
 */
export function main(argv, io = {}) {
  const [command, target] = argv;
  const repo = option(argv, "--repo")[0] ?? process.cwd();
  const readFile =
    io.readFile ??
    ((path) => {
      try {
        return readFileSync(resolve(path), "utf8");
      } catch {
        return null;
      }
    });
  const stdin = io.stdin ?? (() => readFileSync(0, "utf8"));
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const usage = {
    code: 2,
    out:
      "usage: node report.mjs read <report> [--plan <plan>] | " +
      "find --login <login> [--head <sha>] < comments | stale --head <sha> < body | " +
      "comment <report> [--link p=url]… | " +
      "tracker <report> --issue-body <file> [--link p=url]… | evidence <report> [--pick <path>]… " +
      "[--visibility <v>] [--release missing|prerelease|release] [--github <owner/name>]   [--repo <dir>]\n",
  };

  if (command === "find") {
    const login = option(argv, "--login")[0];
    if (login === undefined || login.startsWith("--")) return usage;
    const head = option(argv, "--head")[0];
    if (argv.includes("--head") && (head === undefined || head.startsWith("--"))) return usage;
    if (head !== undefined && !FULL_HEAD.test(head))
      return { code: 1, out: json({ problems: [`\`${head}\` is not a full head SHA`] }) };
    return { code: 0, out: json(findComments(parseComments(stdin()), login, { head })) };
  }
  if (command === "stale") {
    const head = option(argv, "--head")[0];
    if (head === undefined || head.startsWith("--")) return usage;
    const result = staleComment(stdin(), head);
    return result.body === null
      ? { code: 1, out: json({ problems: result.problems }) }
      : { code: 0, out: result.body };
  }
  if (!["read", "comment", "tracker", "evidence"].includes(command)) return usage;
  if (target === undefined || target.startsWith("--")) return usage;
  const text = readFile(target);
  if (text === null) return { code: 1, out: json({ problems: [`${target}: no such file`] }) };

  if (command === "read") {
    const result = readReport(text);
    const planPath = option(argv, "--plan")[0];
    if (argv.includes("--plan") && (planPath === undefined || planPath.startsWith("--")))
      return usage;
    if (planPath !== undefined && !result.problems.length) {
      const planText = readFile(planPath);
      result.problems.push(
        ...(planText === null
          ? [`${planPath}: no such file`]
          : reportPlanProblems(result.report, planText)),
      );
    }
    return { code: result.problems.length ? 1 : 0, out: json(result) };
  }
  if (command === "comment" || command === "tracker") {
    let result;
    if (command === "comment") result = reportComment(text, { links: parseLinks(argv) });
    else {
      const issuePath = option(argv, "--issue-body")[0];
      if (issuePath === undefined) return usage;
      const issueBody = readFile(issuePath);
      if (issueBody === null)
        return { code: 1, out: json({ problems: [`${issuePath}: no such file`] }) };
      result = trackerBody(issueBody, text, { links: parseLinks(argv) });
    }
    return result.body === null
      ? { code: 1, out: json({ problems: result.problems }) }
      : { code: 0, out: result.body };
  }

  // evidence
  const { report, problems } = readReport(text);
  if (problems.length) return { code: 1, out: json({ problems }) };
  const loaded = readQaConfig(
    io.read ??
      ((path) => {
        try {
          return readFileSync(join(repo, path), "utf8");
        } catch {
          return null;
        }
      }),
  );
  if (loaded.runProblems.length)
    return { code: 1, out: json({ path: loaded.path, problems: loaded.runProblems }) };
  const { working_dir: workingDir, run } = effectiveConfig(loaded.config);
  const exists =
    io.exists ??
    ((path) => {
      try {
        return statSync(join(repo, workingDir, path)).isFile();
      } catch {
        return false;
      }
    });
  const readEvidence =
    io.readEvidence ?? ((path) => readFileSync(join(repo, workingDir, path), "utf8"));
  const release = option(argv, "--release")[0] ?? null;
  if (release !== null && !["missing", "prerelease", "release"].includes(release)) return usage;
  const result = evidenceUpload({
    upload: run?.evidence?.upload ?? "none",
    report,
    picks: option(argv, "--pick"),
    exists,
    read: readEvidence,
    visibility: option(argv, "--visibility")[0] ?? null,
    release: /** @type {any} */ (release),
    github: option(argv, "--github")[0] ?? null,
  });
  return {
    code: result.refused.length ? 1 : 0,
    out: json({ working_dir: workingDir, ...result }),
  };
}

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

// Compared as real paths: `file://${argv[1]}` never matches on Windows, and a
// symlinked skills directory must still count as running this file.
if (process.argv[1] && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) {
  const { code, out } = main(process.argv.slice(2));
  process.stdout.write(out);
  process.exitCode = code;
}
