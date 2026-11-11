// The adapter reader: one place that turns the host's config file into an
// object, for every command in this skill (ADAPTER.md).
//
// WHY A PARSER, AND WHY THIS SMALL
//   The skill imports only Node built-ins (DESIGN.md, Boundary), and Node ships
//   no YAML parser. Three hand-written line matchers used to read the adapter,
//   one per key, and each silently ignored any line it did not expect: a valid
//   YAML spelling such as `declined_opportunities: []` followed by entries was
//   read by nobody, and nothing said so. This reader takes JSON whole, and
//   takes YAML only in the subset ADAPTER.md documents. Anything outside that
//   subset is a **problem**, reported with its line number, never a silent
//   default.
//
// THE YAML SUBSET
//   - block mappings and block sequences, indented with spaces;
//   - a sequence may sit at its key's own indent (`key:` then `- item`);
//   - scalars, single- or double-quoted scalars, and flow lists of scalars
//     (`[a, 'b']`, `[]`);
//   - full-line `#` comments anywhere, and a trailing ` # comment` after a
//     value — except inside `declined_opportunities`, where a value runs to
//     the end of its line so a URL fragment or a `#` in prose survives.
//   Every value is a string. Anchors, aliases, multi-line scalars, tabs, and
//   flow mappings are outside the subset; JSON is the dialect for anything
//   the subset cannot say.

/** Lookup order: the first file present is the adapter (ADAPTER.md). */
export const ADAPTER_FILES = /** @type {const} */ ([
  "instruction-drift-audit.config.yml",
  "instruction-drift-audit.config.yaml",
  "instruction-drift-audit.config.json",
  // The skill's first name. Still read, after the current names, so a host
  // that adopted it as `upstream-brief` keeps working (ADAPTER.md).
  "upstream-brief.config.yml",
  "upstream-brief.config.yaml",
  "upstream-brief.config.json",
]);

/** The keys ADAPTER.md documents. Any other top-level key is a problem. */
export const ADAPTER_KEYS = /** @type {const} */ ([
  "version_record",
  "ecosystems",
  "declined_opportunities",
  "instruction_globs",
  "source_globs",
  "script_globs",
  "brief_dir",
  "incidental_owners",
  "issue",
]);

/** ADAPTER.md's default for `brief_dir`. */
export const DEFAULT_BRIEF_DIR = "docs/research";

/** Keys whose values run to the end of the line, `#` and all. */
const RAW_VALUE_KEYS = new Set(["declined_opportunities"]);

const KEY_LINE = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*?)|[ \t]*)$/;
const SEQUENCE_LINE = /^-(?:[ \t]|$)/;

const indentOf = (line) => line.text.length - line.text.trimStart().length;

/**
 * One scalar or flow list.
 *
 * @param {string} raw the text after `key:` or `- `
 * @param {boolean} rawValue the value runs to the end of the line
 * @param {(message: string) => void} problem
 * @returns {string | string[]}
 */
function scalar(raw, rawValue, problem) {
  const text = raw.trim();
  if (rawValue) return text.replace(/^(['"])(.*)\1$/, "$2");

  const quote = text[0];
  if (quote === "'" || quote === '"') {
    const close = text.indexOf(quote, 1);
    if (close === -1) {
      problem(`unterminated ${quote} quote`);
      return text.slice(1);
    }
    const rest = text.slice(close + 1);
    if (rest.trim() !== "" && !/^\s+#/.test(rest))
      problem(`unexpected text after the closing quote: ${rest.trim()}`);
    return text.slice(1, close);
  }

  const value = text.replace(/\s+#.*$/, "").trim();
  if (value.startsWith("[")) {
    if (!value.endsWith("]")) {
      problem("a flow list must close on the same line with `]`");
      return [];
    }
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^(['"])(.*)\1$/, "$2"))
      .filter(Boolean);
  }
  if (value.startsWith("{") || value.startsWith("&") || value.startsWith("*"))
    problem(
      `\`${value[0]}\` (flow mapping, anchor, or alias) is outside the YAML ` +
        "subset ADAPTER.md documents — write this adapter as JSON instead",
    );
  if (value === "|" || value === ">" || /^[|>][+-]?$/.test(value))
    problem("multi-line scalars are outside the YAML subset ADAPTER.md documents");
  return value;
}

/**
 * Parse the documented YAML subset.
 *
 * @param {string} text
 * @returns {{config: Record<string, unknown>, problems: string[]}}
 */
export function parseAdapterYaml(text) {
  const problems = [];
  const lines = [];
  String(text)
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const no = index + 1;
      if (raw.trim() === "" || /^\s*#/.test(raw)) return;
      if (/^\s*\t/.test(raw)) {
        problems.push(`line ${no}: indented with a tab; use spaces`);
        return;
      }
      lines.push({ text: raw.replace(/\s+$/, ""), no });
    });

  let pos = 0;
  const at = (line, message) => problems.push(`line ${line.no}: ${message}`);

  function parseBlock(indent, rawValue) {
    const first = lines[pos];
    return SEQUENCE_LINE.test(first.text.trimStart())
      ? parseSequence(indent, rawValue)
      : parseMapping(indent, rawValue, {});
  }

  /**
   * The value of `key:` — inline on its line, or the block below it.
   * `childRaw` governs the block below; the inline value is read with
   * `rawValue`, so `declined_opportunities: []` is still an empty list.
   */
  function valueFor(line, rest, indent, rawValue, childRaw = rawValue) {
    if (rest !== undefined && rest !== "" && !(!rawValue && /^#/.test(rest)))
      return scalar(rest, rawValue, (message) => at(line, message));
    const next = lines[pos];
    if (!next) return null;
    const nextIndent = indentOf(next);
    if (nextIndent > indent) return parseBlock(nextIndent, childRaw);
    if (nextIndent === indent && SEQUENCE_LINE.test(next.text.trimStart()))
      return parseSequence(indent, childRaw);
    return null;
  }

  function parseMapping(indent, rawValue, map) {
    while (pos < lines.length) {
      const line = lines[pos];
      const lineIndent = indentOf(line);
      if (lineIndent < indent) break;
      if (lineIndent > indent) {
        at(line, "unexpected indentation");
        pos += 1;
        continue;
      }
      const body = line.text.slice(lineIndent);
      if (SEQUENCE_LINE.test(body)) break; // a sequence at the parent's indent
      const match = body.match(KEY_LINE);
      pos += 1;
      if (!match) {
        at(line, `expected \`key: value\`, found \`${body}\``);
        continue;
      }
      const [, key, rest] = match;
      const childRaw = rawValue || (indent === 0 && RAW_VALUE_KEYS.has(key));
      if (Object.hasOwn(map, key)) at(line, `duplicate key \`${key}\``);
      map[key] = valueFor(line, rest, indent, rawValue, childRaw);
    }
    return map;
  }

  function parseSequence(indent, rawValue) {
    const items = [];
    while (pos < lines.length) {
      const line = lines[pos];
      const lineIndent = indentOf(line);
      const body = line.text.slice(lineIndent);
      if (lineIndent < indent) break;
      if (lineIndent > indent) {
        at(line, "unexpected indentation");
        pos += 1;
        continue;
      }
      if (!SEQUENCE_LINE.test(body)) break;
      pos += 1;
      const content = body.replace(/^-[ \t]*/, "");
      if (content === "") {
        const next = lines[pos];
        items.push(next && indentOf(next) > indent ? parseBlock(indentOf(next), rawValue) : null);
        continue;
      }
      const match = content.match(KEY_LINE);
      if (match) {
        // `- key: value` opens a mapping whose keys sit where `key` sits.
        const keyIndent = lineIndent + (body.length - content.length);
        const map = {};
        map[match[1]] = valueFor(line, match[2], keyIndent, rawValue);
        items.push(parseMapping(keyIndent, rawValue, map));
        continue;
      }
      items.push(scalar(content, rawValue, (message) => at(line, message)));
    }
    return items;
  }

  let config = {};
  if (lines.length) {
    if (indentOf(lines[0]) !== 0) at(lines[0], "the first key must start at column 1");
    config = parseMapping(0, false, {});
    while (pos < lines.length) {
      at(lines[pos], "unexpected indentation");
      pos += 1;
    }
  }
  return { config, problems: [...problems, ...shapeProblems(config)] };
}

/**
 * Parse a JSON adapter.
 *
 * @param {string} text
 * @returns {{config: Record<string, unknown>, problems: string[]}}
 */
export function parseAdapterJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      config: {},
      problems: [`not valid JSON: ${error instanceof Error ? error.message : error}`],
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    return { config: {}, problems: ["the adapter must be a JSON object"] };
  return { config: parsed, problems: shapeProblems(parsed) };
}

const isStringList = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const isMapping = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isMappingList = (value) => Array.isArray(value) && value.every(isMapping);

/** One check per documented key: the shape each reader below relies on. */
const SHAPES = {
  version_record: (v) =>
    isMapping(v) && (v.path === undefined || typeof v.path === "string")
      ? null
      : "expected a mapping with a string `path`",
  ecosystems: (v) =>
    isMappingList(v) && v.every((eco) => typeof eco.lead === "string")
      ? null
      : "expected a list of mappings, each with a string `lead`",
  declined_opportunities: (v) => (isMappingList(v) ? null : "expected a list of mappings"),
  instruction_globs: (v) => (isStringList(v) ? null : "expected a list of strings"),
  source_globs: (v) => (isStringList(v) ? null : "expected a list of strings"),
  script_globs: (v) => (isStringList(v) ? null : "expected a list of strings"),
  brief_dir: (v) => (typeof v === "string" ? null : "expected a string"),
  incidental_owners: (v) =>
    isStringList(v) && v.length > 0 ? null : "expected a non-empty list of strings",
  issue: (v) => (isMapping(v) ? null : "expected a mapping"),
};

/** A bare key with nothing under it means "empty", which is legal for every key. */
function shapeProblems(config) {
  const problems = [];
  for (const [key, value] of Object.entries(config)) {
    if (!ADAPTER_KEYS.includes(/** @type {any} */ (key))) {
      problems.push(`unknown key \`${key}\` (ADAPTER.md documents: ${ADAPTER_KEYS.join(", ")})`);
      continue;
    }
    if (value === null || value === undefined) continue;
    const problem = SHAPES[key](value);
    if (problem) problems.push(`\`${key}\`: ${problem}`);
  }
  return problems;
}

/**
 * `incidental_owners`, or undefined so the validator's default applies.
 * Here rather than beside the ledger's readers because the validator needs it
 * and reads nothing else from the adapter.
 *
 * @param {(path: string) => string | null | undefined} read
 * @returns {string[] | undefined}
 */
export function readIncidentalOwners(read) {
  const owners = readAdapter(read).config.incidental_owners;
  return Array.isArray(owners) && owners.length ? owners : undefined;
}

/**
 * Find and parse the adapter.
 *
 * @param {(path: string) => string | null | undefined} read a repo file, or
 *   null when it is not there
 * @returns {{path: string | null, config: Record<string, any>, problems: string[]}}
 *   `path` is null when the repo has no adapter — not an error, every key
 *   takes its default. `config` drops a key whose value is empty (`key:` with
 *   nothing under it), so a reader sees "absent" and applies the default.
 */
export function readAdapter(read) {
  for (const path of ADAPTER_FILES) {
    const text = read(path);
    if (text === null || text === undefined) continue;
    const { config, problems } = path.endsWith(".json")
      ? parseAdapterJson(text)
      : parseAdapterYaml(text);
    const present = Object.fromEntries(
      Object.entries(config).filter(([, value]) => value !== null),
    );
    return { path, config: present, problems };
  }
  return { path: null, config: {}, problems: [] };
}
