/**
 * The Baseline resolver (DESIGN.md §1 and §2).
 *
 * Turns one Ecosystem declaration — a lead package name, plus companions an
 * adapter explicitly adds or removes — into what an Upstream Brief anchors
 * to: the lead's installed version (the Baseline), the full member list, and
 * drift notes for whoever keeps a version record honest (the dep-sync Skill).
 *
 * THREE VERSIONS, ONE OF WHICH THIS FILE TRUSTS
 *   A package can disagree with itself in three places: the *declared range*
 *   a manifest's `dependencies` field states (`^22.0.0`), the *version
 *   record* a repo keeps for humans (a tech-stack table), and the *installed*
 *   version an installed package's own manifest states. Only the installed
 *   version is the Baseline (DESIGN.md §1) — a declared range is a
 *   promise, not a fact, and a version record is a document that drifts (the
 *   ADR's own example: recorded 22.3.3, installed 22.7.7). The other two are
 *   compared against, never read from: disagreement becomes a drift note,
 *   never a different Baseline.
 *
 * WHY THIS FILE IMPORTS NOTHING
 *   The skill is portable (DESIGN.md, Boundary), like `report.mjs`
 *   beside it. Every version lookup and every membership discovery is
 *   injected as a function, so this module never touches a filesystem, and a
 *   caller supplies node_modules, a lockfile, or a fixture map identically.
 *   `report.test.mjs` asserts every module in
 *   this directory stays import-free of anything but Node built-ins and its
 *   own siblings, and that assertion already covers this file.
 *
 * MEMBERSHIP DISCOVERY
 *   A member is discovered by the lead's own npm scope convention: `nx` names
 *   companions under `@nx/*`; a lead already scoped (`@remix-run/react`)
 *   names companions under its own scope (`@remix-run/*`). An adapter
 *   Ecosystem declaration may `add` a companion the convention misses (an
 *   unscoped package, such as `eslint-config-next` beside `next`) or `remove`
 *   one that is installed but is not actually a companion.
 *
 * FAIL-CLOSED
 *   An Ecosystem whose lead is not installed has no installed version to
 *   anchor to, so it resolves to `{lead, ok: false, reason}` instead of
 *   guessing. That failure is scoped to its own Ecosystem — the rest still
 *   resolve.
 */

/** A run of digits.digits.digits, optionally with a pre-release/build tag. */
const SEMVER_ISH = /\d+\.\d+\.\d+(?:[-+][\w.]+)?/;

/**
 * The npm scope a lead's companions are conventionally published under.
 * `nx` -> `@nx/`. A lead already scoped keeps its own scope: `@remix-run/react`
 * -> `@remix-run/`.
 *
 * @param {string} lead
 * @returns {string} a scope prefix ending in `/`
 */
export function scopePrefixFor(lead) {
  if (lead.startsWith("@")) {
    const slash = lead.indexOf("/");
    return slash === -1 ? `${lead}/` : lead.slice(0, slash + 1);
  }
  return `@${lead}/`;
}

/**
 * The first semver-looking token on a line that names `pkgName` as a whole
 * token — bounded by anything that is not a word character, `@`, `/`, `.`, or
 * `-`, so `nx` does not match inside `@nx/eslint-plugin`. This is the
 * narrowest rule that reads both a JSON manifest's `"nx": "22.7.7"` and a
 * Markdown table's `` | `@nx/eslint-plugin` | 22.7.7 | `` without knowing
 * either format, which is what lets a version record stay a comparison
 * target rather than something this resolver must parse by name.
 *
 * @param {string} text
 * @param {string} pkgName
 * @returns {string|null} the version, or null when no line names the package
 */
export function findVersionInText(text, pkgName) {
  const escaped = pkgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const namesIt = new RegExp(`(?:^|[^\\w@/.-])${escaped}(?:[^\\w@/.-]|$)`);
  for (const line of String(text).split(/\r?\n/)) {
    if (!namesIt.test(line)) continue;
    const match = line.match(SEMVER_ISH);
    if (match) return match[0];
  }
  return null;
}

/**
 * Resolve one Ecosystem declaration against installed packages.
 *
 * @param {{lead: string, addMembers?: string[], removeMembers?: string[]}} eco
 * @param {object} io
 * @param {(name: string) => string|null} io.installedVersion the version an
 *   installed package's own manifest states, or null when it is not installed
 * @param {(prefix: string) => string[]} io.discoverScopeMembers package names
 *   installed under a scope prefix; the lead itself may or may not be among
 *   them — this function de-duplicates and does not care either way
 * @param {(name: string) => string|null} io.recordedVersion the version a
 *   version record states for a package, or null when the record does not
 *   mention it
 * @param {string} recordSourceLabel named in a drift note
 */
function resolveOneEcosystem(eco, io, recordSourceLabel) {
  const leadVersion = io.installedVersion(eco.lead);
  if (leadVersion == null)
    return {
      lead: eco.lead,
      ok: false,
      reason: `"${eco.lead}" is not installed — its Ecosystem has no Baseline to resolve`,
    };

  const discovered = io
    .discoverScopeMembers(scopePrefixFor(eco.lead))
    .filter((name) => name !== eco.lead);
  const added = eco.addMembers ?? [];
  const removed = new Set(eco.removeMembers ?? []);
  const members = Array.from(new Set([eco.lead, ...discovered, ...added]))
    .filter((name) => !removed.has(name))
    .sort();

  const driftNotes = [];
  for (const member of members) {
    const installed = member === eco.lead ? leadVersion : io.installedVersion(member);
    // An added member that turns out not to be installed has nothing to
    // compare — a different problem than a version disagreement.
    if (installed == null) continue;
    const recorded = io.recordedVersion(member);
    // Absent from the record resolves normally: nothing to disagree with.
    if (recorded == null || recorded === installed) continue;
    driftNotes.push(
      `${member}: ${recordSourceLabel} records ${recorded}, installed is ` +
        `${installed} — a preflight note for the dependency-sync owner, not a plan item`,
    );
  }

  return {
    lead: eco.lead,
    ok: true,
    members,
    baseline: leadVersion,
    driftNotes,
  };
}

/**
 * Resolve every declared Ecosystem. One lead failing closed does not stop the
 * rest — the failure is scoped to the Ecosystem it names.
 *
 * @param {Array<{lead: string, addMembers?: string[], removeMembers?: string[]}>} ecosystems
 * @param {object} io see {@link resolveOneEcosystem}
 * @param {{recordSourceLabel?: string}} [options]
 * @returns {Array<{lead: string, ok: true, members: string[], baseline: string, driftNotes: string[]} | {lead: string, ok: false, reason: string}>}
 */
export function resolveEcosystemBaselines(
  ecosystems,
  io,
  { recordSourceLabel = "the version record" } = {},
) {
  return ecosystems.map((eco) => resolveOneEcosystem(eco, io, recordSourceLabel));
}
