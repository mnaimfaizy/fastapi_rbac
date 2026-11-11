<!-- qa-plan format=1 subject=#42 pr=#57 -->

# QA Plan: Members can be invited by email

## Anchors

- **Subject issue:** #42, Members can be invited by email; child issues #43, #44
- **Pull request:** #57, https://github.com/example/app/pull/57
- **Merge-base:** 1111111111111111111111111111111111111111 on `origin/main`
- **Head:** 2222222222222222222222222222222222222222

## What automation already proves

- The invite endpoint rejects a malformed email, by the `backend` suite `[observed]`.
- The invitation email template renders, by the `mail` check
  in CI `[reconstructed]`.

## Expected red herrings

- `test_flaky_clock` fails at the merge-base too; ignore it `[observed]`.

## Run brief

- **Target:** `stack`
- **Surface:** `web`
- **Build:** 2222222222222222222222222222222222222222, version endpoint `/version`
- **Roles:**
  - `admin`: manages members, password: `Adm1n-QA!`
  - `member`: an ordinary member
- **Credentials:** with the repository, the config's `accounts.print` command; without it, ask the developer and paste them into chat.
- **Capture rules:**
  - `docs/agents/qa-hazards/auth.md`: never capture the password field.

## Setup

1. Restore the `admin` account with `accounts.restore`.

## Scenarios

### S1: An admin invites a new member

- **Why only a human can prove it:** no suite drives the invite dialog end to end.
- **Signs in as:** `admin`
- **Steps:**
  1. Open **Members**.
  2. Click **Invite member**, type `new@example.test` into **Email**, and click **Send invite**.
- **Expected result:** the list shows `new@example.test` with the badge **Invited**.
- **A failure means:** the dialog does not save an invitation.
- **If this fails, first rule out:**
  - `docs/agents/qa-hazards/auth.md`: a session cookie left over from an earlier run.

### S2: A signed-out visitor cannot open the members page

- **Why only a human can prove it:** the redirect is in the browser router, which no suite renders.
- **Signs in as:** nobody
- **Steps:**
  1. Open `/members` while signed out.
- **Expected result:** the sign-in page, with the heading **Sign in to continue**.
- **A failure means:** the members page is reachable without signing in.

## Sign-off checklist

- [ ] S1: An admin invites a new member
- [ ] S2: A signed-out visitor cannot open the members page
- [ ] Setup 1: the `admin` account was restored

## Stop and do not merge if

- A member can reach the invite dialog.

## Execution record

_Not run yet._
