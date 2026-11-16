#!/usr/bin/env node
// The response-file check: is a `review-response.json` what RESPONSE.md says?
//
// The schema is read from RESPONSE.md's Schema section at run time, so the
// page and the check cannot disagree. The validator below implements only the
// JSON Schema keywords that schema uses, and throws on any other, so a schema
// change that needs a new keyword fails loudly instead of being ignored.
//
// Usage: node response.mjs check <file>
//   Prints the round's summary and exits 0, or prints each problem with its
//   place in the file (`$.findings[2].commit`) and exits 1. Exit 2 is a usage
//   error or an unreadable file.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The schema: the first ```json block under RESPONSE.md's `## Schema`. */
export function loadSchema() {
  const text = readFileSync(join(HERE, "RESPONSE.md"), "utf8").replace(/\r\n/g, "\n");
  const section = text.split("\n## Schema\n")[1]?.split("\n## ")[0];
  const block = section && /```json\n([\s\S]*?)```/.exec(section)?.[1];
  if (!block) throw new Error("RESPONSE.md has no ```json block under `## Schema`");
  return JSON.parse(block);
}

const ANNOTATIONS = new Set(["$schema", "title", "description"]);
const TYPES = {
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  array: Array.isArray,
  string: (v) => typeof v === "string",
};
const ARTICLE = { object: "an object", array: "an array", string: "a string" };

/**
 * Validate `value` against the JSON Schema subset RESPONSE.md uses.
 *
 * @param {Record<string, any>} schema
 * @param {unknown} value
 * @param {string} [path]
 * @returns {string[]} one `path: problem` per failure, empty when it passes
 */
export function validate(schema, value, path = "$") {
  for (const keyword of Object.keys(schema))
    if (!ANNOTATIONS.has(keyword) && !KEYWORDS.has(keyword))
      throw new Error(`unsupported schema keyword \`${keyword}\` at ${path}`);

  if (schema.type && !TYPES[schema.type](value))
    return [`${path}: expected ${ARTICLE[schema.type]}`];

  const problems = [];
  if ("const" in schema && value !== schema.const)
    problems.push(`${path}: must be ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value))
    problems.push(`${path}: must be one of ${schema.enum.join(", ")}`);
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern, "u").test(value))
    problems.push(
      schema.pattern === "\\S"
        ? `${path}: must not be empty`
        : `${path}: must match ${schema.pattern}`,
    );

  if (TYPES.object(value)) {
    const object = /** @type {Record<string, unknown>} */ (value);
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(object, key)) problems.push(`${path}: \`${key}\` is required`);
    for (const [key, child] of Object.entries(schema.properties ?? {}))
      if (Object.hasOwn(object, key))
        problems.push(...validate(child, object[key], `${path}.${key}`));
    if (schema.additionalProperties === false)
      for (const key of Object.keys(object))
        if (!Object.hasOwn(schema.properties ?? {}, key))
          problems.push(`${path}.${key}: not allowed`);
  }
  if (Array.isArray(value) && schema.items)
    value.forEach((item, index) =>
      problems.push(...validate(schema.items, item, `${path}[${index}]`)),
    );

  if (schema.if) {
    const branch = validate(schema.if, value, path).length === 0 ? schema.then : schema.else;
    if (branch) problems.push(...validate(branch, value, path));
  }
  if (schema.not && validate(schema.not, value, path).length === 0) {
    const named = schema.not.required?.map((key) => `\`${key}\``).join(", ");
    problems.push(named ? `${path}: ${named} is not allowed here` : `${path}: must not match`);
  }
  return problems;
}

const KEYWORDS = new Set([
  "type",
  "const",
  "enum",
  "pattern",
  "required",
  "properties",
  "additionalProperties",
  "items",
  "if",
  "then",
  "else",
  "not",
]);

/**
 * Check one response file's text: the schema, then the rule it cannot say
 * (one entry per thread).
 *
 * @param {string} text
 * @returns {{response: any, problems: string[]}}
 */
export function checkResponse(text) {
  let response;
  try {
    response = JSON.parse(text);
  } catch (error) {
    return {
      response: undefined,
      problems: [`$: not valid JSON: ${error instanceof Error ? error.message : error}`],
    };
  }
  const problems = validate(loadSchema(), response);
  if (Array.isArray(response?.findings)) {
    const seen = new Set();
    response.findings.forEach((entry, index) => {
      const id = entry?.thread_id;
      if (typeof id !== "string") return;
      if (seen.has(id))
        problems.push(`$.findings[${index}].thread_id: \`${id}\` already has an entry`);
      seen.add(id);
    });
  }
  return { response, problems };
}

/**
 * The round's summary: one line per entry, then the counts.
 *
 * @param {{findings: {thread_id: string, verdict: string, commit?: string}[]}} response
 */
export function summarize(response) {
  const { findings } = response;
  const width = Math.max(0, ...findings.map((entry) => entry.thread_id.length)) + 2;
  const lines = findings.map((entry) =>
    `${entry.verdict.padEnd(11)}${entry.thread_id.padEnd(width)}${(entry.commit ?? "").slice(0, 12)}`.trimEnd(),
  );
  const count = (verdict) => findings.filter((entry) => entry.verdict === verdict).length;
  const noun = findings.length === 1 ? "finding" : "findings";
  lines.push(
    `${findings.length} ${noun}: ${count("fixed")} fixed, ${count("addressed")} addressed, ` +
      `${count("declined")} declined`,
  );
  return lines.join("\n");
}

function main(argv) {
  const [command, file, ...rest] = argv;
  if (command !== "check" || !file || rest.length) {
    process.stderr.write("usage: response.mjs check <file>\n");
    return 2;
  }
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    process.stderr.write(
      `cannot read ${file}: ${error instanceof Error ? error.message : error}\n`,
    );
    return 2;
  }
  const { response, problems } = checkResponse(text);
  if (problems.length) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    return 1;
  }
  process.stdout.write(`${summarize(response)}\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  process.exitCode = main(process.argv.slice(2));
