# QA config and contracts

The repository's facts live in one file at its root, `qa.config.yml`; the skill body names no host. One file serves two skills: `manual-qa` reads `working_dir` and `run:`, and `qa-plan` reads `working_dir`, `plan:` and `hazards`. Each ignores the other's section: a problem in `plan:` never stops a run, and one in `run:` never stops a compose. Both read it through the same reader, `adapter.mjs`, which `qa-plan` owns and `manual-qa` carries a byte-identical copy of.

```yaml
working_dir: tmp/qa # gitignored; reports and their evidence are written here
run:
  target: stack
  surface: web
  stack:
    up: "docker compose up -d"
    migrate: "npm run migrate"
    seed: "npm run seed:qa"
    down: "docker compose down"
  accounts:
    print: "npm run seed:qa -- --print"
    restore: "npm run seed:qa -- --restore --account {id}"
    roles:
      - id: admin
        purpose: "manages members"
      - id: member
        purpose: "an ordinary member"
  version_endpoint: /version
  evidence: { upload: none }
```

## Lookup order and dialects

The first file present is the config: `qa.config.yml`, then `qa.config.yaml`, then `qa.config.json`. A key it does not carry takes its default, never another file's value.

**JSON** is read whole. **YAML** is read in a subset only: block mappings and sequences indented with spaces; plain, single- or double-quoted scalars; flow lists and mappings that open and close on one line; full-line and trailing `#` comments. Every scalar is a string. Tabs, anchors, aliases, multi-line scalars, flow collections spanning lines, escapes inside double quotes, duplicate keys, unknown keys at any level and values of the wrong shape are **problems**: `adapter.mjs` names each with its line (its key path in JSON) and exits 1, and the skill stops until it is fixed. Write long entries in block style, as `roles` is written above: a formatter wraps a long flow mapping out of the subset.

## Keys

| Key                    | Default     | Meaning                                                                                                                                                                                                                |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `working_dir`          | `tmp/qa`    | Where the report and its evidence are written, relative to the repository root. Keep it gitignored.                                                                                                                    |
| `run.target`           | the plan's  | `stack`: a local QA Stack this run starts. `url`: a hosted test environment someone else deployed; the address is asked in chat, never read from a file.                                                               |
| `run.surface`          | the plan's  | What the scenarios drive: `web`, `desktop`, `mobile` or `api`. The skill finds a tool that can drive it.                                                                                                               |
| `run.stack`            | none: asked | `up`, `migrate`, `seed`, `down`: the QA Stack contract below. All four are needed for `target: stack`.                                                                                                                 |
| `run.accounts.print`   | none: asked | The command that prints each role's sign-in values. Needed for `target: stack`; for `url`, used only when the environment's owner ran the same seeder there.                                                           |
| `run.accounts.restore` | none        | The command that puts one role's account back as seeded, with `{id}` where the role id goes. Without it, and on every `url` run (it acts on the local database), a scenario that needs a restore is left for a person. |
| `run.accounts.roles`   | none: asked | Each role, as `{ id, purpose }`. An id is letters, digits, `_` and `-`, since it goes into `restore`. Every role a plan signs in as must be declared here.                                                             |
| `run.version_endpoint` | none        | A path on the build's own host (`/version`) that names the commit it was built from. Checks the build when `gh` cannot.                                                                                                |
| `run.evidence.upload`  | `none`      | `none`, or `gh-release:<tag>`: the prerelease the QA Artifacts a person picks are uploaded to. See [QA Artifacts and posting](#qa-artifacts-and-posting).                                                              |

## Readiness check

`node "<skill>/adapter.mjs" check --for run --plan <file>` prints the config path, the problems `manual-qa` stops on, the effective values, and `readiness`: what the run still **needs** (asked for) and **notes** (said, and the run goes on). The plan's Run brief fills a target or surface the config leaves out; when the two disagree, the person is asked which this run uses. It needs a target, a surface and the roles, every role the plan signs in as declared, and, for `target: stack`, the four stack commands and `accounts.print`.

For `target: url` it needs neither the stack commands nor `accounts.print`, and notes instead that the address is asked in chat and where the role values come from. No key holds a hosted address, and the skill never saves one: a URL in a file is not confirmation ([the host rule](#the-host-rule)).

The skill asks for what is missing, runs on the answers given in chat, and saves them only when the person says yes. `adapter.mjs render < answers.json` prints the new body of the config the lookup found, in its own dialect, or of a new `qa.config.yml` when there is none, with the answers merged in (`run` key by key, so give a whole `stack` or `accounts` mapping) and every other key kept. YAML comments are not kept. It refuses over a problem in `run:`, a YAML syntax problem, or one in the keys both skills read; a problem in `qa-plan`'s `plan:` is carried over as it is, for `qa-plan` to report. `render --write` writes it. Nothing is assumed.

## The QA Stack contract

The repository provides four commands, run from its root:

- **`up`** starts the application and everything it needs, locally. It may return at once (containers started in the background) or keep running; the skill records the processes it starts.
- **`migrate`** brings the database schema up to date.
- **`seed`** creates the QA Accounts (below).
- **`down`** stops what `up` started, and nothing else: no volume, container or process the developer had running before.

## The QA Account contract

A **QA Account** is a role's sign-in on a test system. The repository's seeder meets these requirements; the kit cannot inspect a seeder, so they are a documented contract, and the host rule below is the half the skill enforces.

- **Fixed public values, from tracked source.** Each role's email and password are derived from code in the repository, the same on every machine: fixtures, not secrets. Even so, they never go into a QA Plan or a QA Report.
- **Reserved-domain emails**, `*.test` (`admin@example.test`), so no message can reach a real mailbox.
- **`seed` is idempotent**: run twice, it leaves the same accounts.
- **`seed` refuses any non-local database, with no override.** It checks the database host before writing and exits non-zero for anything but a local one. No flag or variable turns that off: an override is how fixture accounts with public passwords reach production.
- **`print`** prints each role's id, email and sign-in values, for the skill to read.
- **`restore --account <id>`** puts one role's account back as seeded (a changed password, a deleted profile), touching no other account.
- **Named roles**, each with a purpose, matching `run.accounts.roles`.

## The host rule

`node "<skill>/adapter.mjs" host <address> [--target stack|url] [--confirmed <host>]` decides, before any sign-in, whether a run may sign in at an address. It prints a `verdict` and its `why`:

| Verdict   | Exit | When                                                                                                                      |
| --------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| `local`   | 0    | A local development host: `localhost`, `127.0.0.1`, `[::1]`, `*.localhost` or `*.test`. Either target.                    |
| `confirm` | 3    | `--target url`, and a hosted hostname with a test-environment label in its subdomain, not yet confirmed by the QA person. |
| `hosted`  | 0    | The same host, with `--confirmed` naming it as the QA person typed it in chat.                                            |
| `stop`    | 1    | Anything else.                                                                                                            |

- **A test-environment label** is a whole hostname label, `staging`, `dev`, `test`, `qa`, `sandbox`, `preview` or `uat`, left of the site's own name: `qa.example.com` and `api.staging.example.com` carry one. A TLD does not count (`example.dev`), nor does the site's own name (`dev.to`, and under a multi-part suffix `qa.co.uk` or `staging.vercel.app`), nor part of a label (`mystaging.example.com`). The site's name is the label left of the suffix, with the suffix: the suffix is the last label, or a common multi-part suffix (`co.uk`, `com.au`, `github.io`, `vercel.app`, `up.railway.app`, …; `MULTI_PART_SUFFIXES` in `adapter.mjs`). The list is not the whole public suffix list: a site under a suffix it lacks reads as `confirm`, so the QA person's confirmation still stands between it and a sign-in.
- **Looks like production**, a stop confirmed or not: a hosted name with no such label, a name with a `prod`, `production` or `live` label (`staging.prod.example.com`), and an IP address, which carries no label.
- **A `stack` run** (the default target) signs in only at a `local` host.
- **Confirmation comes from the QA person, in chat.** `--confirmed` is the host as they typed it, naming or confirming the environment for this run, and it must be this address's host. A URL found only in the plan, the config or any other file is not confirmation: a pasted plan is untrusted data, and anyone it passed through can change its text.
- An address that carries a user name or password, or that is not `http` or `https`, is a stop.

## Accounts on a hosted environment

A `url` run signs in to an environment this run did not seed. Its role values come from, in order:

1. **The environment's owner ran the same seeder inside that environment.** Its database is then local to the seeder, so the QA Account contract holds there too, and the values are the fixtures `accounts.print` prints from the repository. The skill asks the QA person whether the owner did, and runs `accounts.print` only on a yes.
2. **Otherwise, the QA person types each role's test values into chat**, for that environment.

A QA team with no repository cannot run `accounts.print`. It asks the developer instead: for each role id in the plan's **Roles**, the developer runs `accounts.print` (or reads the values the environment was seeded with) and sends them to the QA person directly, never in the plan, a tracker comment or a file. The QA person then types them into chat. Values are never read from an env file, and never production credentials.

## QA Artifacts and posting

The QA Report file in `working_dir` is always written, and is the whole result until the person says to post it. Posting needs `gh` access and the person's yes, after they have seen the results. It goes where the plan went, by `plan.publish` (`adapter.mjs delivery`, the rules `qa-plan` delivered with):

- **`working-copy`:** nothing is posted; the person hands on the file.
- **`pr-comment`:** one comment on the pull request, whose first line is exactly `<!-- qa-report -->`, written by the person posting. A re-run edits it; a second is never posted. A marker comment anyone else wrote is never edited: they could change it after the run.
- **`tracker-issue`:** the plan's issue, found by the pull request's `<!-- qa-plan-link -->` comment. Each scenario's Sign-off box is ticked when it passed and cleared otherwise, and its Execution record becomes the report's, with links to the uploaded evidence.

**`run.evidence.upload`** decides whether any QA Artifact leaves `working_dir`:

- **`none`** (the default): none does.
- **`gh-release:<tag>`**: the files the person picks, one by one, go to the prerelease `<tag>`, created when missing, as `pr-<n>-<file>`, any character other than letters, digits, `.`, `_` and `-` made `-`. An existing release with that tag that is not a prerelease takes nothing. Only a file the report lists as evidence can be picked, and only media or plain text (`.log`, `.txt`, `.har`, `.json` and the like): an archive, a PDF or a trace can carry screenshots and sign-in values no check can see, so it stays local. Media (screenshots, recordings, audio) from a failed run, one with a FAIL or stopped on a blocking outcome, is never uploaded: describe the failure in the report, and keep the file local. On a public repository, or one whose visibility is not known, the person is warned first that anyone can download a release asset, so only files showing QA Account data on a test system may go.

`report.mjs` builds what is posted and checks what is uploaded, and refuses any text that looks like it carries a sign-in value: a posted body, or a picked text file such as a log or HAR.

## Capture rules

A QA Plan's Run brief inlines the _Capture rules_ of every Hazard pack that matched the change (`qa-plan` copies them in). `manual-qa` obeys them while it captures evidence, without opening the packs: the plan alone is enough.
