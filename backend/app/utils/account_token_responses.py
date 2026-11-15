"""Single owner of "this token-bearing request failed, and why is nobody's business" (#137).

Verify-email and the two password-reset confirm endpoints each answered
"Account is inactive. Cannot ..." for a disabled user. That confirmed an
account exists at the submitted address in one request -- the same oracle #113
closed for registration and resend-verification, narrowed to disabled users.
The neighbouring failure branches were no better: they answered "Invalid token
or user not found." in one place and "Invalid token" in another, so the set of
distinguishable outcomes grew every time someone added a branch.

Every failure in these flows now leaves through the one refusal per flow in
:mod:`app.utils.emailed_links`, which records the security event that says what
actually happened and answers with the message here that says nothing. Putting
the policy behind the module is the point: a branch added later cannot
accidentally invent its own wording, because there is no wording at the call
site to invent (#283).

What is deliberately *not* uniform:

- JWT decode failures, which ``decode_token`` answers with 401 before any
  account is consulted. They describe the token the caller supplied and are
  decidable without a database.
- Password complexity and history failures, which describe the submitted
  password. Both are checked only once the reset link is known to be live
  (#271), so they are reachable only by the mailbox owner, to whom the
  account's existence is not a secret.
"""

# The one answer verify-email gives to every failure that requires looking an
# account up: unknown address, disabled account, wrong token, expired token,
# or an unused token whose Redis key is gone. A repeat visit with a still-valid
# JWT for an active already-verified user is a 200 instead (#239); disabled
# accounts stay on this message so that success is not an oracle (#137).
# It must stay true of all of those failures without indicating which
# occurred, and it must point the caller at the one action that can help.
INVALID_VERIFICATION_TOKEN_MESSAGE = (
    "This verification link is invalid or has expired. "
    "Please request a new verification email and try again."
)

# The same, for both password-reset confirm endpoints.
INVALID_PASSWORD_RESET_TOKEN_MESSAGE = (
    "This password reset link is invalid or has expired. "
    "Please request a new password reset and try again."
)

# The one answer /password-reset/request gives for every address. The condition
# is stated in the message precisely so the message can be returned when the
# condition does not hold. The success branch used to drop the closing full
# stop the other two branches carried, which distinguished an active account
# from every other state on a single request.
PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE = (
    "If the email exists and the account is active, a password reset link has been sent."
)
