"""The proof that a first password passed the policy (#272).

``crud.user.create`` and ``crud.user.create_with_role`` accept only an
:class:`AcceptedPassword`, never a plaintext password, and take the hash from
it. The only way to get one is
:func:`app.utils.password_policy.accept_initial_password`, so a new
user-creation path that skips the policy is a type error rather than something
review has to catch.

This is a leaf module on purpose: ``password_policy`` imports ``crud``, and
``crud.user_crud`` needs this type, so the class cannot live in
``password_policy`` without an import cycle.

It is not a security boundary. Python cannot stop code from importing
``_issue`` or the mint sentinel; what it does is make skipping the policy a
deliberate, greppable private import instead of an easy mistake.
"""

from typing import final

from app.core.security import PasswordValidator

# Identity sentinel. A constructor call without it is refused, so the only
# supported way to build an AcceptedPassword is _issue(), which only
# password_policy calls.
_MINT = object()


@final
class AcceptedPassword:
    """A first password that passed the policy, held only as its hash.

    Bound to the email it was accepted for, so one accepted password cannot be
    reused to create a different account.
    """

    __slots__ = ("_hash", "_email")

    def __init__(self, *, _mint: object, password_hash: str, email: str) -> None:
        if _mint is not _MINT:
            raise TypeError("AcceptedPassword is issued only by password_policy.accept_initial_password")
        self._hash = password_hash
        self._email = email

    @property
    def hash(self) -> str:
        return self._hash

    @property
    def email(self) -> str:
        return self._email

    def is_for(self, email: str) -> bool:
        """Whether this password was accepted for ``email`` (case-insensitive)."""
        return self._email.casefold() == str(email).casefold()

    def __repr__(self) -> str:
        # Keeps the hash out of logs, tracebacks and assertion messages.
        return "AcceptedPassword(<redacted>)"


def _issue(password: str, *, email: str) -> AcceptedPassword:
    """Hash ``password`` and wrap it. Only ``password_policy`` may call this."""
    return AcceptedPassword(
        _mint=_MINT,
        password_hash=PasswordValidator.get_password_hash(password),
        email=str(email),
    )


def require_accepted_password(password: object, *, email: str) -> AcceptedPassword:
    """Runtime half of the CRUD contract: refuse anything but a matching AcceptedPassword.

    mypy catches a plaintext argument; this catches callers that are not type
    checked, and an accepted password reused for another address.
    """
    if not isinstance(password, AcceptedPassword):
        raise TypeError(
            "User creation takes an AcceptedPassword from "
            "password_policy.accept_initial_password, not " + type(password).__name__
        )
    if not password.is_for(email):
        raise ValueError("This AcceptedPassword was accepted for a different email address")
    return password
