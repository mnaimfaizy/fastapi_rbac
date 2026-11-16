// Issues are fetched on the host with gh; the sandbox never gets GitHub access.
import { execFileSync } from "node:child_process";

export const REPO = "mnaimfaizy/fastapi_rbac";
// Only issues written by these logins are turned into prompts.
export const TRUSTED_AUTHORS = ["mnaimfaizy"];

export interface Issue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly author: { readonly login: string };
  readonly labels: readonly { readonly name: string }[];
}

export function fetchIssue(n: number): Issue {
  return JSON.parse(
    execFileSync("gh", ["issue", "view", String(n), "--repo", REPO, "--json", "number,title,body,author,labels"], {
      encoding: "utf8",
    }),
  ) as Issue;
}

export function assertTrusted(issue: Issue): void {
  if (!TRUSTED_AUTHORS.includes(issue.author.login)) {
    throw new Error(`Issue #${issue.number} is by ${issue.author.login}, not a trusted author`);
  }
}

/** Same label → prefix rule as the Agent-kit pipeline Caller. */
export function branchPrefix(labels: readonly string[]): "fix" | "docs" | "chore" | "feat" {
  if (labels.includes("bug")) return "fix";
  if (labels.includes("documentation")) return "docs";
  if (labels.some((l) => ["cleanup", "maintenance", "dependencies"].includes(l))) return "chore";
  return "feat";
}

/** `<prefix>/<number>-<slug>` per docs/agents/branch-names.md, slug at most 40 characters. */
export function branchFor(issue: Issue): string {
  let slug = issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > 40) slug = slug.slice(0, 40).replace(/-[^-]*$/, "") || slug.slice(0, 40);
  slug = slug.replace(/-+$/g, "") || "issue";
  return `${branchPrefix(issue.labels.map((l) => l.name))}/${issue.number}-${slug}`;
}
