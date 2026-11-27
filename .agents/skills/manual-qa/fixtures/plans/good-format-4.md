<!-- qa-plan format=4 subject=#42 pr=#57 -->

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
  - `admin`: manages members (admin@example.test)
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
- **Capture:** `screenshot`, of the list after the invite is sent
- **Steps:**
  1. Open **Members**.
  2. Click **Invite member**, type `new@example.test` into **Email**, and click **Send invite**.
- **Expected result:** the list shows `new@example.test` with the badge **Invited**.
- **Expected before:** the dialog closes, and the list does not show `new@example.test`.
- **A failure means:** the dialog does not save an invitation.
- **If this fails, first rule out:**
  - `docs/agents/qa-hazards/auth.md`: a session cookie left over from an earlier run.

### S2: A signed-out visitor cannot open the members page

- **Why only a human can prove it:** the redirect is in the browser router, which no suite renders.
- **Signs in as:** nobody
- **Capture:** `video`
- **Story:**
  1. A signed-out visitor opens the members page and is sent to sign in.
- **Steps:**
  1. Open `/members` while signed out.
- **Expected result:** the sign-in page, with the heading **Sign in to continue**.
- **A failure means:** the members page is reachable without signing in.

### S3: The invite endpoint refuses a member

- **Why only a human can prove it:** the role check sits in the deployed gateway, which no suite starts.
- **Signs in as:** `member`
- **Surface:** `api`
- **Observes:** status, body
- **Capture:** transcript
- **Steps:**
  1. Send **POST** `/api/invites` with the body `{"email": "other@example.test"}`.
- **Expected result:** the response status is `403`, and its body names the missing permission **members.invite**.
- **A failure means:** a member can invite people.

### S4: Removing a member ends their session

- **Why only a human can prove it:** the session store is the deployed Redis, which no suite starts.
- **Sessions:** A = `member`, B = `admin`
- **Capture:** `video`, of both sessions
- **Story:**
  1. The member signs in and opens **Members**.
  2. The admin signs in, removes the member, and sees the list without them.
  3. The member reloads **Members** and lands on the sign-in page.
- **Steps:**
  1. In session A, open **Members**.
  2. In session B, open **Members**, click **Remove** beside the member, and click **Confirm**.
  3. In session B, see the list without the member.
  4. In session A, reload **Members**.
  5. In session A, see the page it lands on.
- **Expected result:** session A shows **Sign in to continue**; session B shows the list without the member.
- **A failure means:** a removed member keeps using the app until their session expires.

## Sign-off checklist

- [ ] S1: An admin invites a new member
- [ ] S2: A signed-out visitor cannot open the members page
- [ ] S3: The invite endpoint refuses a member
- [ ] S4: Removing a member ends their session
- [ ] Setup 1: the `admin` account was restored

## Stop and do not merge if

- A member can reach the invite dialog.

## Execution record

_Not run yet._
