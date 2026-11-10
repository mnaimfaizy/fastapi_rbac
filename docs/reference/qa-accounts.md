# QA Accounts

QA Accounts are fixture users, one per role, for manual QA by an agent or a remote QA team. They let someone sign in as each role without registering by hand, and without credentials coming from environment files. Agent-kit's `qa-plan` and `manual-qa` skills read them through [`qa.config.yml`](https://github.com/mnaimfaizy/fastapi_rbac/blob/main/qa.config.yml). Introduced by [#318](https://github.com/mnaimfaizy/fastapi_rbac/issues/318).

!!! warning "Public values: local and test environments only"
    Every QA Account's email and password are **public fixtures**, not secrets. Anyone with the repository can compute them, which is the point. They are for local and test environments only. The seeder refuses to write anywhere else, and no flag or setting lifts that refusal.

## Commands

Run them from `backend/`, or inside the dev container with `docker exec fastapi_rbac_dev …`:

| Command | What it does |
| --- | --- |
| `python -m app.qa_accounts print` | Prints each account's id, role, email and password. Needs no database. |
| `python -m app.qa_accounts seed` | Creates each account as a verified, active user that holds its role. Run again, it changes nothing and only puts back what drifted. |
| `python -m app.qa_accounts seed --restore --account <id>` | Returns one account to its default state, and says what it deleted. |
| `--account <id>` | On any command, limits it to that account. |

`seed` needs the roles that `app/initial_data.py` creates, so run that first. The dev container runs it on start.

## The accounts

| id | Role | Purpose |
| --- | --- | --- |
| `admin` | Admin | holds every permission: manages users, roles, permissions and their groups |
| `manager` | Manager | creates, reads and updates users and content; can read roles and permissions only |
| `user` | User | an ordinary user who manages only their own profile |

The list lives in one tracked file, `backend/app/qa_accounts/accounts.py`. The email is `<id>@fastapi-rbac.example`. The password is derived from the id by a SHA-256 in that file, so it is never committed as a literal and never read from `.env`.

The issue asked for `*.test` addresses. The app's email validation (email-validator) refuses `.test` as a special-use name, which would block both seeding and sign-in. So the accounts use `.example`, which RFC 2606 also reserves: it can never resolve or reach a real mailbox.

## Where `seed` refuses to run

`seed` checks the database URL before it opens a connection. It refuses, and exits 1, when:

- `MODE` is `production`, even on a local database; or
- the database host is not local.

Local means `localhost`, `127.0.0.1`, `::1`, a `*.localhost` name, a SQLite file, or one of the database container names from this repository's compose files: `fastapi_rbac_db_dev` and `fastapi_rbac_db_test`. A bare service name such as `db` is not accepted, because a production database on a private network is often called that.

A hosted test environment gets its QA Accounts the same way: its owner runs `seed` inside it, against its own database, where that database is local to the seeder.

## Drift that `seed` repairs

Run on an existing account, `seed` puts back only what stops the account signing in as its role:

- the password
- verified and active state
- the account lock and failed sign-in count
- the temporary-password flag
- superuser
- role membership, which becomes exactly the account's role

It leaves profile edits alone. `--restore` also resets the name, contact phone and verification code, and deletes the account's password history. It reports each thing it changed or deleted.
