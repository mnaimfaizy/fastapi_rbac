// Posting a QA Report, and choosing which QA Artifacts to upload (SKILL.md
// steps 8 to 11, DESIGN.md "Posting is a second step").
//
// WHAT IT DOES
//   Builds the text the skill posts and checks what it may upload. It runs no
//   `gh` command itself: SKILL.md runs each one, after the person has seen the
//   results and said yes, and hands this file what `gh` printed.
//
//   1. `read`: reads a QA Report file (SKILL.md "The QA Report") into its
//      anchors and one result per scenario, and says whether the run failed
//      (a FAIL, or a run stopped on a blocking outcome). A PASS or FAIL row
//      links its evidence in backticks, or says `none: <reason>`; a row left
//      for a person may say a bare `none`. With `--plan`, it
//      also checks the report against the plan it ran: the same anchors, one
//      row per scenario, and each scenario that signs in as a Scenario
//      account left for a person when the scenario creating it did not pass.
//   2. `find`: from a pull request's comments, the one QA Report comment to
//      update (its body's first line is exactly `<!-- qa-report -->`, and the
//      person posting wrote it), so a re-run edits it and never posts a second; and the tracker issue the
//      plan's `<!-- qa-plan-link -->` comment names.
//   3. `comment`: the PR comment body: the marker, then the report, with each
//      uploaded evidence path linked.
//   4. `tracker`: the tracker issue's new body: the plan as delivered, with
//      each PASS scenario's Sign-off box ticked (every other box of a
//      scenario cleared) and its Execution record replaced by the report's.
//   5. `evidence`: which picked files may go to the `gh-release:<tag>`
//      prerelease, and under what asset names. Nothing goes with
//      `evidence.upload: none`; a file the report does not list as evidence
//      is refused, as is one neither media nor plain text (an archive, a
//      PDF, a trace); media from a failed run is refused; a public
//      repository gets a warning.
//
//   Every body it builds, and every picked text file (a log, a HAR), is
//   checked for sign-in values with the plan's own credential scan, and
//   refused when one looks present.
//
// CLI (run from the repository root; `--repo <dir>` points elsewhere)
//   node report.mjs read <report> [--plan <plan>]
//   node report.mjs find --login <login> < comments.jsonl
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
/** The first line of the PR comment `qa-plan` posts naming its tracker issue. */
export const PLAN_LINK_MARKER = "<!-- qa-plan-link -->";
export const RESULTS = /** @type {const} */ (["PASS", "FAIL", "left for a person"]);
/** GitHub refuses a comment or issue body longer than this. */
export const BODY_LIMIT = 65536;
/** Screenshots, recordings and audio: what a failed run never uploads. */
export const MEDIA =
  /\.(?:png|jpe?g|gif|webp|bmp|tiff?|avif|heic|svg|mp4|m4v|mov|webm|mkv|avi|wmv|mp3|wav|ogg|m4a)$/i;
/** Plain-text evidence: the only kind whose contents are scanned for sign-in values. */
export const TEXT = /\.(?:log|txt|har|json|jsonl|ndjson|md|csv|tsv|xml|html?|ya?ml)$/i;
/** The Evidence cell of a PASS or FAIL row that links no QA Artifact: `none: <reason>`. */
export const NO_EVIDENCE = /^none:\s*\S/;

const NO_UPLOAD_FROM_FAILED =
  "media from a failed run is never uploaded: its screen is the one most likely to show " +
  "what it must not; describe the failure in the report, and keep the file local";
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
    const heading = !fenced[n] && /^## (.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      if (current) current.end = n;
      current = { start: n, end: lines.length };
      found[heading[1].trim()] = current;
    }
  });
  return found;
}

const cells = (row) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

/**
 * Read a QA Report file into what posting needs.
 *
 * @param {string} text
 * @returns {{report: {title: string | null, subject: number | null, pr: number | null,
 *   head: string | null, results: {id: string, scenario: string, result: string,
 *   evidence: string[], notes: string}[], failed: boolean, stopped: boolean,
 *   record: string | null}, problems: string[]}}
 */
export function readReport(text) {
  const lines = lf(text).split("\n");
  const problems = [];
  const report = {
    title: null,
    subject: null,
    pr: null,
    head: null,
    results: [],
    failed: false,
    stopped: false,
    record: null,
  };
  const titleAt = lines.findIndex((line) => /^# QA Report: \S/.test(line));
  if (titleAt === -1) problems.push("no `# QA Report: <title>` line");
  else report.title = lines[titleAt].slice("# QA Report: ".length).trim();

  const planLine = lines.find((line) => /^- \*\*Plan:\*\*/.test(line));
  if (!planLine) problems.push("no `- **Plan:**` line");
  else {
    report.subject = Number(/subject #(\d+)/.exec(planLine)?.[1]) || null;
    report.pr = Number(/pull request #(\d+)/.exec(planLine)?.[1]) || null;
    // The full head, as the plan's anchor carries it (SHA-1 or SHA-256).
    report.head = /head `([0-9a-f]{40}(?:[0-9a-f]{24})?)`/.exec(planLine)?.[1] ?? null;
    if (!report.subject) problems.push("the **Plan:** line names no `subject #<n>`");
    if (!report.pr) problems.push("the **Plan:** line names no `pull request #<n>`");
    if (!report.head) problems.push("the **Plan:** line names no full head `<sha>`");
  }

  const found = sections(lines);
  const results = found.Results;
  if (!results) problems.push("no `## Results` section");
  else {
    const rows = lines
      .slice(results.start + 1, results.end)
      .map((line, i) => ({ line, n: results.start + 1 + i }))
      .filter(({ line }) => /^\s*\|.*\|\s*$/.test(line));
    // The first row is the header, the second its separator.
    for (const { line, n } of rows.slice(2)) {
      const [scenario = "", result = "", evidence = "", ...notes] = cells(line);
      const id = /^S(\d+)\b/.exec(scenario)?.[0];
      if (!id) {
        problems.push(`line ${n + 1}: a result row names no scenario \`S<n>\``);
        continue;
      }
      if (!RESULTS.includes(/** @type {any} */ (result)))
        problems.push(
          `line ${n + 1}: ${id}'s result is \`${result}\`; expected PASS, FAIL or left for a person`,
        );
      // `none: <reason>`, bare or wrapped whole in backticks, links no file, even
      // when its reason quotes an endpoint or a role in backticks.
      const reason = NO_EVIDENCE.test(evidence.replace(/^`([^`]*)`$/, "$1"));
      const paths = reason ? [] : [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      // A scenario that ran is captured by default: no path needs a stated reason.
      if ((result === "PASS" || result === "FAIL") && !paths.length && !reason)
        problems.push(
          `line ${n + 1}: ${id} is a ${result} with no evidence path: link its QA Artifact ` +
            "in backticks, or write `none: <reason>`",
        );
      report.results.push({
        id,
        scenario,
        result,
        evidence: paths,
        notes: notes.join("|").trim(),
      });
    }
    if (report.results.length === 0) problems.push("the Results table has no scenario rows");
  }
  report.stopped = report.results.some((row) =>
    /(?<![A-Za-z])the run stopped at S\d+/i.test(row.notes),
  );
  report.failed = report.stopped || report.results.some((row) => row.result === "FAIL");

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
 * outcome before a dependent may give it its stop note instead.
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
  const want = plan.scenarios.map((scenario) => scenario.id).join(" ");
  const got = report.results.map((row) => row.id).join(" ");
  if (want !== got)
    return [
      `the plan's scenarios are ${want}; the report's results are ${got || "none"}: ` +
        "the report needs exactly one row per scenario, in order",
    ];
  const problems = [];
  const creatorOf = new Map(
    plan.scenarios.flatMap((scenario) => scenario.creates.map((id) => [id, scenario.id])),
  );
  const results = new Map(report.results.map((row) => [row.id, row]));
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
 * @param {{id: number | string, body: string, user?: string | {login?: string}}[]} comments
 *   oldest first, as GitHub lists them
 * @param {string} login who posts: `gh api user --jq .login`
 * @returns {{report: {action: "update", id: number | string, duplicates: (number | string)[]} |
 *   {action: "create"}, others: (number | string)[], planIssue: number | null}}
 */
export function findComments(comments, login) {
  const author = (c) => (typeof c.user === "string" ? c.user : c.user?.login);
  const marked = comments.filter((c) => firstLine(c.body) === REPORT_MARKER);
  const own = marked.filter((c) => login && author(c) === login);
  const link = comments.find((c) => firstLine(c.body) === PLAN_LINK_MARKER);
  const planIssue = link ? Number(/QA Plan: #(\d+)/.exec(link.body)?.[1]) || null : null;
  return {
    report: own.length
      ? { action: "update", id: own[0].id, duplicates: own.slice(1).map((c) => c.id) }
      : { action: "create" },
    others: marked.filter((c) => !own.includes(c)).map((c) => c.id),
    planIssue,
  };
}

/** Link each uploaded evidence path where the text quotes it in backticks. */
function linkEvidence(text, links) {
  let out = text;
  for (const [path, url] of Object.entries(links))
    out = out.split(`\`${path}\``).join(`[\`${path}\`](${url})`);
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
 * (a Setup step) are a person's to tick, and are left as they are.
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
  let leak;
  for (const file of picks) {
    const refuse = (why) => out.refused.push({ file, why });
    const normal = posix.normalize(file.replace(/\\/g, "/"));
    const media = MEDIA.test(normal);
    if (!listed.has(file)) refuse("the report lists no such evidence: pick a path from its table");
    else if (!folder || !normal.startsWith(folder) || normal.includes(".."))
      refuse(`evidence is uploaded only from \`${folder}\` in \`working_dir\``);
    else if (!media && !TEXT.test(normal)) refuse(NOT_CHECKABLE);
    else if (report.failed && media) refuse(NO_UPLOAD_FROM_FAILED);
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
      "usage: node report.mjs read <report> [--plan <plan>] | find --login <login> < comments | " +
      "comment <report> [--link p=url]… | " +
      "tracker <report> --issue-body <file> [--link p=url]… | evidence <report> [--pick <path>]… " +
      "[--visibility <v>] [--release missing|prerelease|release] [--github <owner/name>]   [--repo <dir>]\n",
  };

  if (command === "find") {
    const login = option(argv, "--login")[0];
    if (login === undefined || login.startsWith("--")) return usage;
    return { code: 0, out: json(findComments(parseComments(stdin()), login)) };
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
