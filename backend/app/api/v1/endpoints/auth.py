import logging
import traceback
from datetime import datetime, timezone
from typing import cast  # Keep cast
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_csrf_protect import CsrfProtect
from pydantic import EmailStr
from redis.asyncio import Redis as AsyncRedis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api import deps
from app.api.deps import get_redis_client, get_strict_sanitizer
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import PasswordValidator
from app.models.user_model import User
from app.schemas.response_schema import IPostResponseBase, create_response
from app.schemas.token_schema import PasswordResetConfirm, RefreshToken, Token, TokenRead
from app.schemas.user_schema import PasswordResetRequest  # Used for resend-verification
from app.schemas.user_schema import (
    IUserRead,
    UserRegister,
    VerifyEmail,
)
from app.utils import emailed_links, password_policy, sessions
from app.utils.account_email_dispatch import (
    ACCOUNT_EMAIL_UNIFORM_MESSAGE,
    dispatch_account_email,
)
from app.utils.account_token_responses import PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE
from app.utils.auth_cookies import clear_refresh_token_cookie, write_session_cookie
from app.utils.background_tasks import (
    log_security_event,
    send_password_reset_email,
)
from app.utils.client_address import get_client_ip
from app.utils.emailed_links import LinkKind
from app.utils.password_policy import (
    InitialPasswordReason,
    PasswordChangeReason,
    PasswordRefused,
    accept_initial_password,
)
from app.utils.response_timing import response_time_floor
from app.utils.user_utils import serialize_user

logger = logging.getLogger("fastapi_rbac")

router = APIRouter()

# Status and message for each reason the Session module refuses a refresh. An
# origin-network mismatch is NOT_ACCEPTED too, so it reads as an invalid token.
_REFRESH_REFUSALS = {
    sessions.RejectReason.NOT_ACCEPTED: (status.HTTP_403_FORBIDDEN, "Refresh token invalid"),
    sessions.RejectReason.INVALID_SUBJECT: (status.HTTP_403_FORBIDDEN, "Invalid user identifier in token"),
    sessions.RejectReason.USER_UNAVAILABLE: (status.HTTP_404_NOT_FOUND, "User not found or inactive"),
}


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    email: EmailStr = Body(...),
    password: str = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    sanitizer: deps.InputSanitizer = Depends(get_strict_sanitizer),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase[Token]:
    ip_address = get_client_ip(request) or "Unknown"  # Sanitize inputs for security
    try:
        sanitized_email = sanitizer.sanitize(str(email), "email")
        # Password should not be sanitized as it needs to remain exactly as entered
        # but we can validate its length to prevent DoS attacks
        if len(password) > sanitizer.max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password length exceeds maximum allowed size",
            )
    except ValueError as e:
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="login_input_sanitization_failed",
            details={
                "error": str(e),
                "email": (str(email)[:50] + "..." if len(str(email)) > 50 else str(email)),
                "ip_address": ip_address,
            },
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid input format")

    try:
        user_record = await crud.user.get_by_email(db_session=db_session, email=sanitized_email)
        if not user_record:
            # User doesn't exist, but don't reveal that information
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="failed_login",
                details={
                    "email": email,
                    "reason": "user_not_found",
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field_name": "email",
                    "message": "Email or password is incorrect",
                },
            )
        user_record = cast(User, user_record)
        locked_until_utc = ensure_utc(user_record.locked_until)
        is_locked = (
            user_record.is_locked
            and locked_until_utc is not None
            and locked_until_utc > datetime.now(timezone.utc)
        )
        if is_locked and locked_until_utc is not None:
            remaining_time = locked_until_utc - datetime.now(timezone.utc)
            remaining_hours = remaining_time.total_seconds() // 3600
            remaining_minutes = (remaining_time.total_seconds() % 3600) // 60
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="locked_account_attempt",
                user_id=user_record.id,
                details={
                    "email": email,
                    "locked_until": user_record.locked_until.isoformat(),
                    "ip_address": ip_address,
                },
            )
            lock_message = "Account is locked due to multiple failed login attempts. "
            if remaining_hours > 0:
                lock_message += (
                    f"Try again in {int(remaining_hours)} hours and " f"{int(remaining_minutes)} minutes."
                )
            else:
                lock_message += f"Try again in {int(remaining_minutes)} minutes."
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field_name": "email",
                    "message": lock_message,
                },
            )
        warning_message = None
        attempts_count = user_record.number_of_failed_attempts or 0
        max_login_attempts = settings.MAX_LOGIN_ATTEMPTS
        # Show warning one attempt before lockout
        if max_login_attempts > 1 and attempts_count == max_login_attempts - 1:
            warning_message = "Warning: This is your last attempt before account lockout."
        try:
            authenticated_user = await crud.user.authenticate(
                db_session=db_session, email=email, password=password
            )
        except Exception as e:
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="authentication_error",
                user_id=user_record.id,
                details={"error": str(e), "email": email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while processing your request.",
            )
        if not authenticated_user:
            try:
                updated_user = await crud.user.get_by_email(db_session=db_session, email=email)
                if not updated_user:
                    await log_security_event(
                        background_tasks=background_tasks,
                        db_session=db_session,
                        event_type="failed_login_user_disappeared",
                        details={
                            "email": email,
                            "reason": "User not found after failed auth attempt",
                            "ip_address": ip_address,
                        },
                    )
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="An unexpected error occurred. Please try again.",
                    )
                # Log failed login attempt as a background task
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="oauth2_failed_login",
                    user_id=updated_user.id,
                    details={
                        "email": email,
                        "attempt_number": updated_user.number_of_failed_attempts,
                    },
                )
                locked_until_utc = ensure_utc(updated_user.locked_until)
                if updated_user.is_locked and locked_until_utc is not None:
                    # increment_failed_attempts set and stored the lock window.
                    remaining_time = locked_until_utc - datetime.now(timezone.utc)
                    remaining_hours = remaining_time.total_seconds() // 3600
                    remaining_minutes = (remaining_time.total_seconds() % 3600) // 60
                    lock_message = "Account locked due to too many failed attempts. "
                    if remaining_hours > 0:
                        lock_message += (
                            f"Try again in {int(remaining_hours)} hours and "
                            f"{int(remaining_minutes)} minutes."
                        )
                    else:
                        lock_message += f"Try again in {int(remaining_minutes)} minutes."
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "field_name": "email",
                            "message": lock_message,
                        },
                    )
                else:
                    failed_attempts = updated_user.number_of_failed_attempts or 0
                    max_login_attempts = (
                        settings.MAX_LOGIN_ATTEMPTS if hasattr(settings, "MAX_LOGIN_ATTEMPTS") else 3
                    )
                    attempts_left = max_login_attempts - failed_attempts
                    message = "Email or password is incorrect"
                    if attempts_left == 1:
                        message = (
                            f"{message}. Warning: This is your last attempt. "
                            "Account will be locked after the next failed attempt."
                        )
                    elif attempts_left > 0:
                        message = f"{message}. {attempts_left} attempts remaining before " "account lockout."
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "field_name": "email",
                            "message": message,
                        },
                    )
            except HTTPException:
                raise
            except Exception as e:
                user_id_for_log = user_record.id if user_record else None
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="failed_login_error",
                    user_id=user_id_for_log,
                    details={"error": str(e), "email": email, "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="An error occurred while processing your request.",
                )
        authenticated_user = cast(User, authenticated_user)
        if not crud.user.has_verified(authenticated_user):
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="unverified_login_attempt",
                user_id=authenticated_user.id,
                details={"email": email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"field_name": "email", "message": "Email is not verified."},
            )
        if not authenticated_user.is_active:
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="inactive_user_login_attempt",
                user_id=authenticated_user.id,
                details={"email": email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,  # Changed from 422 to 403
                detail={"field_name": "email", "message": "Inactive user"},
            )
        try:
            issued = await sessions.open(
                authenticated_user, get_client_ip(request), redis_client=redis_client
            )
            write_session_cookie(response, issued)
        except Exception as e:
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="token_generation_error",
                user_id=authenticated_user.id,
                details={"error": str(e), "email": email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while processing your request.",
            )
        user_data = serialize_user(authenticated_user)
        user_read = IUserRead(**user_data)
        data = Token(
            access_token=issued.access_token,
            token_type="bearer",
            refresh_token=None,  # HttpOnly cookie; not exposed to JS
            user=user_read,
        )
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="successful_login",
            user_id=authenticated_user.id,
            details={"email": authenticated_user.email, "ip_address": ip_address},
        )
        message = "Login successful"
        if warning_message:
            message = warning_message
        return create_response(data=data, message=message)
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="login_unexpected_error",
            details={"error": str(e), "ip_address": ip_address},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing your request.",
        )


@router.post("/register")
@limiter.limit("3/hour")
async def register(
    request: Request,
    user_in: UserRegister,
    background_tasks: BackgroundTasks,
    redis_client: AsyncRedis = Depends(get_redis_client),
    sanitizer: deps.InputSanitizer = Depends(get_strict_sanitizer),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:
    """
    Register a new user.

    Returns an identical status, body and message for every address, whether it
    is new, awaiting verification, already established, or disabled (#113). What
    differs is only which email the address owner receives, which is decided by
    :func:`dispatch_account_email`. Rejections that describe the *submission*
    rather than the account -- malformed input, a weak password, a blocked
    domain, too many requests from this IP -- are still reported, since they
    reveal nothing about whether an account exists.
    """
    ip_address = get_client_ip(request) or "Unknown"

    async with response_time_floor():
        try:
            sanitized_email = sanitizer.sanitize(str(user_in.email), "email")
            if len(user_in.password) > 1000:
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="registration_password_too_long",
                    details={"ip_address": ip_address, "password_length": len(user_in.password)},
                )
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password too long")
            user_in.email = sanitized_email
            user_in.first_name = sanitizer.sanitize(user_in.first_name, "text")
            user_in.last_name = sanitizer.sanitize(user_in.last_name, "text")
        except HTTPException:
            raise
        except Exception as e:
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="registration_input_sanitization_failed",
                details={"error": str(e), "ip_address": ip_address},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid input data")

        try:
            # The IP-scoped budget stays separate from the per-address budget the
            # dispatcher charges: this one tracks the requester rather than the
            # target, so it cannot be used to probe whether an address exists.
            max_ip_attempts = settings.MAX_REGISTRATION_ATTEMPTS_PER_HOUR
            rate_limit_period = settings.RATE_LIMIT_PERIOD_SECONDS
            ip_rate_limit_key = f"registration_rate_limit:ip:{ip_address}"
            ip_attempts_raw = await redis_client.get(ip_rate_limit_key)
            ip_attempts = int(ip_attempts_raw) if ip_attempts_raw else 0
            if getattr(settings, "MODE", None) == "testing":
                ip_attempts = 0
            if ip_attempts >= max_ip_attempts:
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="registration_rate_limit_exceeded",
                    details={"email": user_in.email, "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many registration attempts. Please try again later.",
                )

            email_domain = user_in.email.split("@")[1].lower()
            if settings.EMAIL_DOMAIN_BLACKLIST and email_domain in settings.EMAIL_DOMAIN_BLACKLIST:
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="registration_blocked_domain",
                    details={
                        "email": user_in.email,
                        "domain": email_domain,
                        "ip_address": ip_address,
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email domain is not allowed for registration.",
                )
            if settings.EMAIL_DOMAIN_ALLOWLIST and email_domain not in settings.EMAIL_DOMAIN_ALLOWLIST:
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="registration_domain_not_allowed",
                    details={
                        "email": user_in.email,
                        "domain": email_domain,
                        "ip_address": ip_address,
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email domain is not allowed for registration.",
                )
            accepted_password = await accept_initial_password(
                user_in.password,
                reason=InitialPasswordReason.REGISTRATION,
                email=user_in.email,
                actor=None,
                client_address=ip_address,
                db_session=db_session,
            )

            result = await dispatch_account_email(
                email=user_in.email,
                db_session=db_session,
                redis_client=redis_client,
                background_tasks=background_tasks,
                ip_address=ip_address,
                may_create=True,
                registration=user_in,
                accepted_password=accepted_password,
            )

            await redis_client.incr(ip_rate_limit_key)
            await redis_client.expire(ip_rate_limit_key, rate_limit_period)

            # Registration schedules no cleanup of its own. It used to hand the
            # new user to a background task that slept for
            # UNVERIFIED_ACCOUNT_CLEANUP_HOURS, which lost every pending row on
            # the next restart (#136). Celery Beat now sweeps them from the
            # database instead: app.worker.cleanup_unverified_users_task.

            # Test mode only: integration tests drive the verification flow from
            # this value rather than reading mail. It is absent in every other
            # mode, so the payload is null for all four states in production.
            response_data = None
            if getattr(settings, "MODE", None) == "testing" and result.verification_token:
                response_data = {"verification_code": result.verification_token}

            return create_response(data=response_data, message=ACCOUNT_EMAIL_UNIFORM_MESSAGE)
        except (HTTPException, PasswordRefused):
            raise
        except Exception as e:
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="registration_unexpected_error",
                details={"error": str(e), "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred during registration.",
            )


@router.post("/verify-email")
async def verify_email(
    request: Request,
    body: VerifyEmail,
    background_tasks: BackgroundTasks,
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase[IUserRead]:
    """
    Verify user's email address using the provided token.

    Redeeming the link, and the uniform rejection of every failure that needed
    an account looked up (#137, ADR 0010), belong to
    :func:`app.utils.emailed_links.verify_email`. A repeat visit with a valid
    link for an active, already-verified user is a 200 "Email is already
    verified." (#239).
    """
    ip_address = get_client_ip(request) or "Unknown"
    try:
        outcome = await emailed_links.verify_email(
            body.token, client_address=ip_address, db_session=db_session, redis=redis_client
        )
    except emailed_links.LinkRedemptionError as e:
        error_type = type(e.cause).__name__
        logger.error(
            "Unexpected error in verify_email for IP %s, Token Sub: %s",
            ip_address,
            e.subject or "N/A",
            exc_info=e.cause,
        )
        # A database error aborts this transaction. Roll it back before the
        # audit insert, or that insert is lost with the request (#278).
        try:
            await db_session.rollback()
        except Exception:
            logger.exception("Failed to roll back the session before recording the verify-email error")
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type=f"verify_email_unexpected_error_{error_type.lower()}",
            details={
                "error": str(e.cause),
                "ip_address": ip_address,
                "token_subject": e.subject or "N/A",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during email verification.",
        )
    response_data = IUserRead(**serialize_user(outcome.user)).model_dump()
    if isinstance(outcome, emailed_links.AlreadyVerified):
        return create_response(data=response_data, message="Email is already verified.")
    return create_response(data=response_data, message="Email verified successfully.")


@router.post("/resend-verification-email")
async def resend_verification_email(
    request: Request,
    body: PasswordResetRequest,  # Contains email
    background_tasks: BackgroundTasks,
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:
    """
    Resend a verification email.

    Returns an identical response for all four account states (#113). It
    previously answered "This email is already verified." for established users
    and "Account is inactive." for disabled ones, either of which confirmed an
    address in a single request -- which is what made registration's vague 400
    pointless. Both endpoints now share :func:`dispatch_account_email`, so the
    policy cannot drift between them again.

    An address with no account is sent nothing. Mailing it would turn this into
    an open mailer for unsolicited signup mail; the response-time floor covers
    that branch instead.
    """
    ip_address = get_client_ip(request) or "Unknown"

    async with response_time_floor():
        try:
            await dispatch_account_email(
                email=body.email,
                db_session=db_session,
                redis_client=redis_client,
                background_tasks=background_tasks,
                ip_address=ip_address,
                may_create=False,
            )
            return create_response(data=None, message=ACCOUNT_EMAIL_UNIFORM_MESSAGE)
        except HTTPException:
            raise
        except Exception as e:
            error_type = type(e).__name__
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type=f"resend_verification_unexpected_error_{error_type.lower()}",
                details={"error": str(e), "email": body.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred. Please try again later.",
            )


@router.post("/change_password")
async def change_password(
    request: Request,
    response: Response,
    current_password: str = Body(...),
    new_password: str = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    _: None = Depends(deps.validate_csrf_token),
    current_user: User = Depends(deps.get_current_user(allow_pending_password_change=True)),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
) -> IPostResponseBase[Token]:
    """
    Change password
    """
    # Ensure ip_address is defined at the top of the function scope
    ip_address = get_client_ip(request) or "Unknown"
    try:
        # Ensure current_user.password is not None before verification
        if current_user.password is None:
            # This case should ideally not happen if password is a required field
            # and properly managed. Logging it as a server-side issue.
            logger.error(f"User {current_user.email} (ID: {current_user.id}) has no password set.")
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="password_change_error_no_password_set",
                user_id=current_user.id,
                details={"email": current_user.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An internal error occurred. Please try again later.",
            )
        if not PasswordValidator.verify_password(current_password, current_user.password):
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="password_change_invalid_current_password",
                user_id=current_user.id,
                details={"email": current_user.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Current Password",
            )
        # Rules, reuse, ending every session (a pending reset link included:
        # knowing the current password supersedes it), commit and audit all
        # happen in the policy module (#271). This path used to reimplement
        # them and got the reuse check wrong (#193).
        await password_policy.change_password(
            current_user,
            new_password,
            reason=PasswordChangeReason.SELF,
            actor=current_user,
            client_address=ip_address,
            db_session=db_session,
            redis_client=redis_client,
        )
        # Serialize the updated user to IUserRead for the Token response
        user_payload_for_token = serialize_user(current_user)
        user_read_for_token = IUserRead(**user_payload_for_token)
        # Issuing the fresh session stays here: it belongs to this caller, not
        # to the policy. The old sessions were ended above, before this one is
        # opened. The order is the fix for #206: revocation used to be queued
        # and ran after the response, deleting the very tokens this response
        # hands back. Opened last, so a failure above leaves no session behind.
        issued = await sessions.open(current_user, get_client_ip(request), redis_client=redis_client)
        data = Token(
            access_token=issued.access_token,
            token_type="bearer",
            refresh_token=None,  # HttpOnly cookie; not exposed to JS
            user=user_read_for_token,  # Pass the IUserRead instance
        )
        write_session_cookie(response, issued)
        # Expire all objects in the session to ensure latest data is visible in subsequent requests
        db_session.expire_all()
        return create_response(data=data, message="Password changed successfully")
    except (HTTPException, PasswordRefused):
        raise
    except Exception as e:
        # ip_address is guaranteed to be defined here
        logger.error(
            f"Unexpected error in change_password for user {current_user.email} "
            f"from IP {ip_address}: {str(e)}",
            exc_info=True,
        )
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="password_change_unexpected_error",
            user_id=current_user.id,  # Ensure current_user is valid
            details={
                "email": (current_user.email if current_user else "N/A"),  # Add a check for current_user
                "error": str(e),
                "ip_address": ip_address,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while changing the password.",
        )


@router.post("/new_access_token", status_code=201)
async def get_new_access_token(
    request: Request,
    body: RefreshToken | None = Body(default=None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase[TokenRead]:
    """
    Gets a new access token using the refresh token.

    Prefer the HttpOnly refresh cookie (first-party SPA). An optional JSON body
    ``refresh_token`` remains as a documented fallback for non-browser API clients.
    Redis allowlist validation is unchanged (no rotation in this change).
    """
    client_host = get_client_ip(request)
    ip_address = client_host or "Unknown"  # The audit-log rendering of the same address
    refresh_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if not refresh_token and body and body.refresh_token:
        refresh_token = body.refresh_token
    if not refresh_token:
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="refresh_token_missing",
            details={"ip_address": ip_address},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "status": False,
                "message": "No refresh token provided. Please log in again.",
            },
        )
    try:
        # Origin-network anomaly detection (#69, ADR 0011 decision 5) happens
        # inside: a mismatch ends that session and answers as an invalid
        # refresh token, deliberately not a distinct error -- a caller must not
        # learn that the address is what gave it away.
        refreshed = await sessions.refresh(
            refresh_token, client_host, db_session=db_session, redis_client=redis_client
        )
    except sessions.SessionRejected as rejected:
        status_code, message = _REFRESH_REFUSALS[rejected.reason]
        raise HTTPException(status_code=status_code, detail={"status": False, "message": message})
    except sessions.SessionError as e:
        subject = e.subject
        error_type = type(e.cause).__name__
        logger.error(
            f"Unexpected error in get_new_access_token from IP {ip_address} for "
            f"token sub {subject or 'N/A'}: {str(e.cause)}",
            exc_info=e.cause,
        )
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type=f"new_access_token_unexpected_error_{error_type.lower()}",
            user_id=subject,
            details={
                "error": str(e.cause),
                "ip_address": ip_address,
                "token_subject": subject or "N/A",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": False,
                "message": "An unexpected error occurred while refreshing the token.",
            },
        )
    await log_security_event(
        background_tasks=background_tasks,
        db_session=db_session,
        event_type="refresh_token_success",
        user_id=refreshed.user.id,
        details={"email": refreshed.user.email, "ip_address": ip_address},
    )
    return create_response(
        data=TokenRead(access_token=refreshed.access_token, token_type="bearer"),
        message="Access token generated correctly",
    )


@router.post("/access-token")
@limiter.limit("5/minute")
async def login_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
) -> IPostResponseBase[TokenRead]:  # Changed return type
    """
    OAuth2 compatible token login, get an access token for future requests

    No ``validate_csrf_token`` dependency, unlike ``/login``: this is the form
    Swagger's Authorize button posts, and it cannot send the CSRF header. Kept
    that way until the owner decides otherwise (#279).
    """
    # Check if user exists and get their current status
    user_record = await crud.user.get_by_email(email=form_data.username, db_session=db_session)
    if not user_record:
        # User doesn't exist, but don't reveal that information
        # Log failed login attempt for non-existent user as a background task
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="oauth2_failed_login",
            details={"email": form_data.username, "reason": "user_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field_name": "email", "message": "Incorrect email or password"},
        )  # Check for locked account before attempting authentication
    locked_until_utc = ensure_utc(user_record.locked_until)
    if (
        user_record.is_locked
        and user_record.locked_until
        and locked_until_utc is not None
        and locked_until_utc > datetime.now(timezone.utc)
    ):
        # Calculate remaining lock time
        remaining_time = locked_until_utc - datetime.now(timezone.utc)
        remaining_hours = remaining_time.total_seconds() // 3600
        remaining_minutes = (remaining_time.total_seconds() % 3600) // 60
        # Log locked account login attempt as a background task
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="oauth2_locked_account_attempt",
            user_id=user_record.id,
            details={
                "email": form_data.username,
                "locked_until": user_record.locked_until.isoformat(),
            },
        )
        lock_message = "Account is locked due to multiple failed login attempts. "
        if remaining_hours > 0:
            lock_message += (
                f"Try again in {int(remaining_hours)} hours and " f"{int(remaining_minutes)} minutes."
            )
        else:
            lock_message += f"Try again in {int(remaining_minutes)} minutes."
        raise HTTPException(
            status_code=400,
            detail={"field_name": "email", "message": lock_message},
        )
    # Check if this is the user's last attempt before locking
    warning_message = None
    attempts_count = (
        0 if user_record.number_of_failed_attempts is None else user_record.number_of_failed_attempts
    )
    if attempts_count == 2:
        warning_message = (
            "Warning: This is your last attempt. "
            "If you enter an incorrect password again, "
            "your account will be locked for 24 hours."
        )
    # Now attempt to authenticate
    user = await crud.user.authenticate(
        email=form_data.username, password=form_data.password, db_session=db_session
    )
    if not user:
        # Failed authentication attempt
        # Pull the user data again to get the latest
        # status after increment_failed_attempts was called
        updated_user = await crud.user.get_by_email(email=form_data.username, db_session=db_session)
        if not updated_user:
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="oauth2_failed_login_user_disappeared",
                details={"email": form_data.username, "reason": "User not found after failed auth attempt"},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred. Please try again.",
            )
        # Log failed login attempt as a background task
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="oauth2_failed_login",
            user_id=updated_user.id,
            details={
                "email": form_data.username,
                "attempt_number": updated_user.number_of_failed_attempts,
            },
        )
        failed_locked_until = ensure_utc(updated_user.locked_until)
        if updated_user.is_locked and failed_locked_until is not None:
            # increment_failed_attempts set and stored the lock window.
            remaining_time = failed_locked_until - datetime.now(timezone.utc)
            remaining_hours = remaining_time.total_seconds() // 3600
            remaining_minutes = (remaining_time.total_seconds() % 3600) // 60
            lock_message = "Your account has been locked due to too many failed login attempts. "
            if remaining_hours > 0:
                lock_message += (
                    f"Try again in {int(remaining_hours)} hours and " f"{int(remaining_minutes)} minutes."
                )
            else:
                lock_message += f"Try again in {int(remaining_minutes)} minutes."
            raise HTTPException(
                status_code=400,
                detail={"field_name": "email", "message": lock_message},
            )
        else:
            # Just a regular authentication failure
            attempts_left = 3 - (
                0
                if updated_user.number_of_failed_attempts is None
                else updated_user.number_of_failed_attempts
            )
            message = "Incorrect email or password"
            if attempts_left == 1:
                message = (
                    f"{message}. Warning: This is your last attempt."
                    "Account will be locked after the next failed attempt."
                )
            elif attempts_left > 0:
                message = f"{message}. {attempts_left} attempts remaining before " "account lockout."
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"field_name": "email", "message": message},
            )
    if not crud.user.has_verified(user):
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="unverified_login_attempt",
            user_id=user.id,
            details={"email": form_data.username},
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field_name": "email", "message": "Email is not verified."},
        )
    if not user.is_active:
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="inactive_user_login_attempt",
            user_id=user.id,
            details={"email": form_data.username},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"field_name": "email", "message": "Inactive user"},
        )
    # Form login issues no refresh cookie, so the access token is the session.
    access_token = await sessions.open_access_only(user, get_client_ip(request), redis_client=redis_client)
    # Log successful OAuth2 login
    await log_security_event(
        background_tasks=background_tasks,
        db_session=db_session,
        event_type="oauth2_successful_login",
        user_id=user.id,
        details={"email": user.email},
    )
    token_data = TokenRead(access_token=access_token, token_type="bearer")
    response_message = "Login successful."
    if warning_message:
        response_message = warning_message
    return create_response(data=token_data, message=response_message)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(deps.get_current_user(allow_pending_password_change=True)),
    redis_client: AsyncRedis = Depends(get_redis_client),
    access_token: str = Depends(deps.reusable_oauth2),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:
    """End the calling session and clear the refresh cookie.

    Other sessions on the account stay usable. To revoke every session, use
    ``POST /logout/all``. Session identity comes from the refresh cookie when
    present, otherwise from the access token's allowlist metadata.
    """
    ip_address = get_client_ip(request) or "Unknown"
    try:
        refresh_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME) or None
        try:
            await sessions.end(
                current_user.id,
                refresh_token=refresh_token,
                access_token=access_token,
                redis_client=redis_client,
            )
        except sessions.SessionRejected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to identify the current session.",
            )
        clear_refresh_token_cookie(response)
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="user_logout",
            user_id=current_user.id,
            details={"email": current_user.email, "ip_address": ip_address},
        )
        return create_response(data={}, message="Successfully logged out")
    except HTTPException:
        raise
    except Exception as e:
        error_type = type(e).__name__
        logger.error(
            f"Unexpected error in logout for user {current_user.email} " f"from IP {ip_address}: {str(e)}",
            exc_info=True,
        )
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type=f"logout_unexpected_error_{error_type.lower()}",
            user_id=current_user.id,
            details={
                "email": current_user.email,
                "error": str(e),
                "ip_address": ip_address,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during logout.",
        )


@router.post("/logout/all")
async def logout_all(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(deps.get_current_user(allow_pending_password_change=True)),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:
    """End every session and any pending reset link for the user, and clear the refresh cookie.

    Change-password ends sessions through ``password_policy.change_password``
    rather than going through this route.
    """
    ip_address = get_client_ip(request) or "Unknown"
    try:
        await sessions.end_all(current_user.id, redis_client=redis_client)
        await emailed_links.revoke(LinkKind.PASSWORD_RESET, current_user.id, redis=redis_client)
        clear_refresh_token_cookie(response)
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type="user_logout_all",
            user_id=current_user.id,
            details={"email": current_user.email, "ip_address": ip_address},
        )
        return create_response(data={}, message="Successfully logged out from all sessions")
    except Exception as e:
        error_type = type(e).__name__
        logger.error(
            f"Unexpected error in logout/all for user {current_user.email} "
            f"from IP {ip_address}: {str(e)}",
            exc_info=True,
        )
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type=f"logout_all_unexpected_error_{error_type.lower()}",
            user_id=current_user.id,
            details={
                "email": current_user.email,
                "error": str(e),
                "ip_address": ip_address,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during logout.",
        )


@router.post("/password-reset/request")
@limiter.limit("3/hour")
async def request_password_reset(
    request: Request,  # Added request parameter
    reset_request: PasswordResetRequest = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    sanitizer: deps.InputSanitizer = Depends(get_strict_sanitizer),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:
    """
    Request a password reset for a given email address.
    Sends a token that can be used to reset the password.

    Absent, disabled and active addresses all get
    :data:`~app.utils.account_token_responses.PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE`.
    The three branches already intended to say the same thing, but the active
    one dropped the closing full
    stop the other two carried, so a single request still separated an active
    account from every other state (#137). Only the development-mode branch
    differs, and it hands back the token itself for MailHog.
    """
    ip_address = get_client_ip(request) or "Unknown"
    user: User | None = None  # Define user here for broader scope

    async with response_time_floor():
        try:
            # Sanitize email input
            try:
                email_for_reset = sanitizer.sanitize(str(reset_request.email), "email")
            except Exception as e:
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="password_reset_request_sanitization_failed",
                    details={"error": str(e), "ip_address": ip_address},
                )
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email format")
            user = await crud.user.get_by_email(email=email_for_reset, db_session=db_session)
            if not user:
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="password_reset_request_invalid_email",
                    details={"email": email_for_reset, "ip_address": ip_address},
                )
                return create_response(data={}, message=PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE)
            if not user.is_active:
                await log_security_event(
                    background_tasks=background_tasks,
                    db_session=db_session,
                    event_type="password_reset_request_inactive_user",
                    user_id=user.id,
                    details={"email": email_for_reset, "ip_address": ip_address},
                )
                return create_response(data={}, message=PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE)
            # Replaces any earlier reset link: only the latest email works.
            reset_token = await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_client)
            reset_url = settings.PASSWORD_RESET_URL
            await send_password_reset_email(
                background_tasks=background_tasks,
                user_email=user.email,
                reset_token=reset_token,
                reset_url=reset_url,
            )
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type="password_reset_requested",
                user_id=user.id,
                details={"email": user.email, "ip_address": ip_address},
            )
            if settings.MODE == "development":
                return create_response(
                    data={
                        "reset_url": f"{reset_url}?token={reset_token}",
                        "reset_token": reset_token,
                    },
                    message="Password reset email sent. Check the MailHog interface at http://localhost:8025",
                )
            else:
                return create_response(data={}, message=PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE)
        except HTTPException:
            raise
        except Exception as e:
            error_type = type(e).__name__
            user_id_for_log = user.id if user else None
            logger.error(
                f"Unexpected error in request_password_reset for email {email_for_reset} "
                f"from IP {ip_address}: {str(e)}",
                exc_info=True,
            )
            await log_security_event(
                background_tasks=background_tasks,
                db_session=db_session,
                event_type=f"password_reset_request_unexpected_error_{error_type.lower()}",
                user_id=user_id_for_log,
                details={
                    "email": email_for_reset,
                    "error": str(e),
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred. Please try again later.",
            )


async def _reset_password_with_link(
    *,
    token: str,
    new_password: str,
    request: Request,
    background_tasks: BackgroundTasks,
    redis_client: AsyncRedis,
    db_session: AsyncSession,
    unexpected_error_event: str,
) -> IPostResponseBase:
    """The one body of both reset-confirm routes.

    Redeeming the link, and the uniform rejection of every failure that needed
    an account looked up (#137, ADR 0010), belong to
    :func:`app.utils.emailed_links.redeem_password_reset`. The password change
    runs as its action, after the link is known to be live (#271), so a rules
    or reuse refusal is reachable only by the holder of that link, and leaves
    the link usable.
    """
    ip_address = get_client_ip(request) or "Unknown"
    # Read in the except path below, which must not touch an ORM instance a
    # rollback has expired.
    redeemed_id: UUID | None = None
    redeemed_email: str | None = None

    async def change_password(user: User) -> None:
        nonlocal redeemed_id, redeemed_email
        redeemed_id, redeemed_email = user.id, user.email
        await password_policy.change_password(
            user,
            new_password,
            reason=PasswordChangeReason.RESET,
            actor=None,
            client_address=ip_address,
            db_session=db_session,
            redis_client=redis_client,
        )

    try:
        await emailed_links.redeem_password_reset(
            token, change_password, client_address=ip_address, db_session=db_session, redis=redis_client
        )
        return create_response(data={}, message="Password has been reset successfully")
    except (HTTPException, PasswordRefused):
        raise
    except Exception as e:
        if isinstance(e, emailed_links.LinkRedemptionError):
            cause: Exception = e.cause
            user_id, email, subject = e.user_id, e.email, e.subject
        else:
            cause = e
            user_id, email, subject = redeemed_id, redeemed_email, redeemed_email
        error_type = type(cause).__name__
        logger.error(
            f"Unexpected error resetting a password ({unexpected_error_event}) for user "
            f"{email or 'N/A'} (ID: {user_id}) from IP {ip_address}: {str(cause)}",
            exc_info=cause,
        )
        # A database error aborts this transaction. Roll it back before the
        # audit insert, or that insert is lost with the request (#278).
        # A rollback that itself fails must not replace the 500.
        try:
            await db_session.rollback()
        except Exception:
            logger.exception("Failed to roll back the session before recording the password reset error")
        await log_security_event(
            background_tasks=background_tasks,
            db_session=db_session,
            event_type=f"{unexpected_error_event}_{error_type.lower()}",
            user_id=user_id,
            details={
                "email": email or "N/A",
                "error": str(cause),
                "ip_address": ip_address,
                "token_subject": subject or "N/A",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    request: Request,
    reset_confirm: PasswordResetConfirm = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:  # No data returned, just a message
    """Reset a password against a link mailed to the address.

    Every failure that required looking an account up answers with
    :data:`~app.utils.account_token_responses.INVALID_PASSWORD_RESET_TOKEN_MESSAGE`
    (#137). Only the most recent reset link works.
    """
    return await _reset_password_with_link(
        token=reset_confirm.token,
        new_password=reset_confirm.new_password,
        request=request,
        background_tasks=background_tasks,
        redis_client=redis_client,
        db_session=db_session,
        unexpected_error_event="password_reset_confirm_unexpected_error",
    )


@router.post("/reset_password", deprecated=True)
async def reset_password(
    request: Request,
    body_in: PasswordResetConfirm,
    background_tasks: BackgroundTasks,
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:  # No data returned, just a message
    """Deprecated: use ``POST /password-reset/confirm``, which this shares its body with.

    Removal is tracked in #284.
    """
    return await _reset_password_with_link(
        token=body_in.token,
        new_password=body_in.new_password,
        request=request,
        background_tasks=background_tasks,
        redis_client=redis_client,
        db_session=db_session,
        unexpected_error_event="reset_password_unexpected_error",
    )


@router.get("/csrf-token")
async def get_csrf_token(
    request: Request, response: Response, csrf_protect: CsrfProtect = Depends(deps.get_csrf_protect)
) -> IPostResponseBase[dict]:
    """
    Get CSRF token for frontend to use in state-changing operations.
    This endpoint also sets the required CSRF cookie.

    Returns:
        dict: Contains the CSRF token
    """
    try:
        # Generate CSRF tokens - returns tuple (unsigned_token, signed_token)
        csrf_token, signed_token = csrf_protect.generate_csrf_tokens()
        response_data = {"csrf_token": csrf_token}  # Send unsigned token to frontend
        # Set the SIGNED token in cookie (this is what the library expects for validation)
        response.set_cookie(
            key="fastapi-csrf-token",
            value=signed_token,  # Use signed token for cookie
            httponly=True,  # Prevent XSS attacks
            secure=False,  # Set to True in production with HTTPS
            samesite="lax",  # CSRF protection
            max_age=3600,  # 1 hour expiration
        )
        return create_response(message="CSRF token generated successfully", data=response_data)
    except Exception as e:
        logger.error(f"Error generating CSRF token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate CSRF token",
        )


def ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
