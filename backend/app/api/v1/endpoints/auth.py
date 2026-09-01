import logging
import traceback
from datetime import datetime, timedelta, timezone
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
from app.core import security  # security module contains token functions
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import (  # For password complexity / JWT audit mapping
    PasswordValidator,
    decode_token,
    map_jwt_http_error_to_event,
)
from app.crud.user_crud import PasswordReuseError
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.schemas.response_schema import IPostResponseBase, create_response
from app.schemas.token_schema import PasswordResetConfirm, RefreshToken, Token, TokenRead
from app.schemas.user_schema import PasswordResetRequest  # Used for resend-verification
from app.schemas.user_schema import (
    IUserRead,
    IUserUpdate,
    UserRegister,
    VerifyEmail,
)
from app.utils.account_email_dispatch import (
    ACCOUNT_EMAIL_UNIFORM_MESSAGE,
    dispatch_account_email,
)
from app.utils.account_token_responses import (
    PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE,
    reject_password_reset,
    reject_verification,
)
from app.utils.auth_cookies import clear_refresh_token_cookie, set_refresh_token_cookie
from app.utils.background_tasks import (
    log_security_event,
    process_account_lockout,
    send_password_reset_email,
)
from app.utils.password_policy import enforce_password_complexity
from app.utils.response_timing import response_time_floor
from app.utils.token import (
    add_derived_access_token_to_redis,
    add_session_tokens_to_redis,
    add_token_to_redis,
    get_valid_tokens,
    revoke_all_user_tokens,
    revoke_user_tokens,
    token_is_allowlisted,
)
from app.utils.user_utils import serialize_user

logger = logging.getLogger("fastapi_rbac")

router = APIRouter()


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
    ip_address = request.client.host if request.client else "Unknown"  # Sanitize inputs for security
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
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
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
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
                    background_tasks.add_task(
                        log_security_event,
                        background_tasks=background_tasks,
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
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="oauth2_failed_login",
                    user_id=updated_user.id,
                    details={
                        "email": email,
                        "attempt_number": updated_user.number_of_failed_attempts,
                    },
                )
                if updated_user.is_locked and updated_user.locked_until:
                    # settings.ACCOUNT_LOCKOUT_MINUTES is in minutes, convert to hours
                    lockout_duration_in_hours = settings.ACCOUNT_LOCKOUT_MINUTES / 60
                    await process_account_lockout(
                        background_tasks=background_tasks,
                        user=updated_user,
                        lock_duration_hours=int(lockout_duration_in_hours),
                    )
                    if updated_user.locked_until:
                        remaining_time = updated_user.locked_until - datetime.now(timezone.utc)
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
                    else:
                        lock_message = (
                            "Account locked due to too many failed attempts. " "Please contact support."
                        )
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
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
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
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="unverified_login_attempt",
                user_id=authenticated_user.id,
                details={"email": email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"field_name": "email", "message": "Email is not verified."},
            )
        if not authenticated_user.is_active:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="inactive_user_login_attempt",
                user_id=authenticated_user.id,
                details={"email": email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,  # Changed from 422 to 403
                detail={"field_name": "email", "message": "Inactive user"},
            )
        try:
            access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
            access_token = security.create_access_token(
                authenticated_user.id,
                authenticated_user.email,
                expires_delta=access_token_expires,
            )
            refresh_token = security.create_refresh_token(
                authenticated_user.id, expires_delta=refresh_token_expires
            )
            await add_session_tokens_to_redis(
                redis_client,
                authenticated_user,
                access_token=access_token,
                refresh_token=refresh_token,
                access_expire_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
                refresh_expire_minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES,
            )
            set_refresh_token_cookie(response, refresh_token)
        except Exception as e:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
            access_token=access_token,
            token_type="bearer",
            refresh_token=None,  # HttpOnly cookie; not exposed to JS
            user=user_read,
        )
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
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
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
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
    ip_address = request.client.host if request.client else "Unknown"

    async with response_time_floor():
        try:
            sanitized_email = sanitizer.sanitize(str(user_in.email), "email")
            if len(user_in.password) > 1000:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
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
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="registration_rate_limit_exceeded",
                    details={"email": user_in.email, "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many registration attempts. Please try again later.",
                )

            email_domain = user_in.email.split("@")[1].lower()
            if settings.EMAIL_DOMAIN_BLACKLIST and email_domain in settings.EMAIL_DOMAIN_BLACKLIST:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
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
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
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
            await enforce_password_complexity(
                user_in.password,
                background_tasks=background_tasks,
                event_type="registration_password_complexity_failed",
                details={"email": user_in.email, "ip_address": ip_address},
            )

            result = await dispatch_account_email(
                email=user_in.email,
                db_session=db_session,
                redis_client=redis_client,
                background_tasks=background_tasks,
                ip_address=ip_address,
                may_create=True,
                registration=user_in,
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
        except HTTPException:
            raise
        except Exception as e:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
    sanitizer: deps.InputSanitizer = Depends(get_strict_sanitizer),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase[IUserRead]:
    """
    Verify user's email address using the provided token.

    Every failure that required looking an account up -- unknown address,
    disabled account, wrong or expired or already-used token -- leaves through
    :func:`~app.utils.account_token_responses.reject_verification` with one
    message (#137). It previously answered "Account is inactive. Cannot verify
    email." for a disabled user, which
    confirmed an address in a single request.

    The floor covers the branches the uniform message alone does not: an
    unknown address returns before the Redis lookup a disabled account pays
    for, and a rejection returns before the write a success pays for.
    """
    ip_address = request.client.host if request.client else "Unknown"
    email_from_token_str: str | None = None
    async with response_time_floor():
        # Input sanitization for email verification data
        try:
            # Sanitize token (it should contain only alphanumeric and safe chars)
            sanitized_token = sanitizer.sanitize(body.token, "text")
            body.token = sanitized_token
        except Exception as e:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="verify_email_input_sanitization_failed",
                details={"error": str(e), "ip_address": ip_address},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid input data")
        try:
            try:
                payload = security.decode_token(body.token, token_type="verification")
            except HTTPException as exc:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type=map_jwt_http_error_to_event(exc, flow="verify_email"),
                    details={
                        "error": (exc.detail if isinstance(exc.detail, str) else str(exc.detail)),
                        "ip_address": ip_address,
                    },
                )
                raise
            email_from_token_str = payload.get("sub")
            if not email_from_token_str:
                await reject_verification(
                    background_tasks=background_tasks,
                    event_type="verify_email_token_missing_sub",
                    details={"token_used": body.token, "ip_address": ip_address},
                )
            user = await crud.user.get_by_email(db_session=db_session, email=str(email_from_token_str))
            if not user:
                await reject_verification(
                    background_tasks=background_tasks,
                    event_type="verify_email_user_not_found",
                    details={
                        "email_from_token": email_from_token_str,
                        "token_used": body.token,
                        "ip_address": ip_address,
                    },
                )
            user = cast(User, user)
            redis_token_key = f"verification_token:{user.id}"
            stored_token_value = await redis_client.get(redis_token_key)
            stored_token_str: str | None = None
            if isinstance(stored_token_value, bytes):
                stored_token_str = stored_token_value.decode("utf-8")
            elif isinstance(stored_token_value, str):
                stored_token_str = stored_token_value
            if not stored_token_str or stored_token_str != body.token:
                await reject_verification(
                    background_tasks=background_tasks,
                    event_type="verify_email_token_mismatch_or_expired_redis",
                    user_id=user.id,
                    details={
                        "email": user.email,
                        "token_used": body.token,
                        "ip_address": ip_address,
                    },
                )
            if not user.is_active:
                # Answers exactly as a bad token does (#137). A disabled account is
                # still an account, and saying so here confirmed an address.
                await reject_verification(
                    background_tasks=background_tasks,
                    event_type="verify_email_inactive_account",
                    user_id=user.id,
                    details={"email": user.email, "ip_address": ip_address},
                )
            if user.verified:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="verify_email_already_verified",
                    user_id=user.id,
                    details={"email": user.email, "ip_address": ip_address},
                )
                user_data = serialize_user(user)  # Return current user state
                user_read = IUserRead(**user_data)
                response_data = user_read.model_dump()
                if getattr(settings, "MODE", None) == "testing":
                    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
                    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
                    access_token = security.create_access_token(
                        user.id,
                        user.email,
                        expires_delta=access_token_expires,
                    )
                    refresh_token = security.create_refresh_token(
                        user.id, expires_delta=refresh_token_expires
                    )
                    response_data["access_token"] = access_token
                    response_data["refresh_token"] = refresh_token
                return create_response(data=response_data, message="Email is already verified.")
            user_update = {"verified": True, "verification_code": None}
            updated_user = await crud.user.update(
                db_session=db_session, obj_current=user, obj_new=user_update
            )
            if not updated_user:  # Should not happen if user existed and update is valid
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="verify_email_update_failed",
                    user_id=user.id,
                    details={"email": user.email, "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update user verification status.",
                )
            await redis_client.delete(redis_token_key)  # Token successfully used
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="email_verified_successfully",
                user_id=updated_user.id,
                details={"email": updated_user.email, "ip_address": ip_address},
            )
            user_data = serialize_user(updated_user)
            user_read = IUserRead(**user_data)
            response_data = user_read.model_dump()
            if getattr(settings, "MODE", None) == "testing":
                access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
                refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
                access_token = security.create_access_token(
                    updated_user.id,
                    updated_user.email,
                    expires_delta=access_token_expires,
                )
                refresh_token = security.create_refresh_token(
                    updated_user.id, expires_delta=refresh_token_expires
                )
                response_data["access_token"] = access_token
                response_data["refresh_token"] = refresh_token
            return create_response(data=response_data, message="Email verified successfully.")
        except HTTPException:
            raise
        except Exception as e:
            error_type = type(e).__name__
            logger.error(
                (
                    "Unexpected error in verify_email for IP %s, Token Sub: %s"
                    % (
                        ip_address,
                        (email_from_token_str if "email_from_token_str" in locals() else "N/A"),
                    )
                ),
                exc_info=True,
            )
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type=f"verify_email_unexpected_error_{error_type.lower()}",
                details={
                    "error": str(e),
                    "ip_address": ip_address,
                    "token_subject": (email_from_token_str if "email_from_token_str" in locals() else "N/A"),
                },  # Log token if available
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred during email verification.",
            )


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
    ip_address = request.client.host if request.client else "Unknown"

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
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
    current_user: User = Depends(deps.get_current_user()),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
) -> IPostResponseBase[Token]:
    """
    Change password
    """
    # Ensure ip_address is defined at the top of the function scope
    ip_address = request.client.host if request.client else "Unknown"
    try:
        # Ensure current_user.password is not None before verification
        if current_user.password is None:
            # This case should ideally not happen if password is a required field
            # and properly managed. Logging it as a server-side issue.
            logger.error(f"User {current_user.email} (ID: {current_user.id}) has no password set.")
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_change_error_no_password_set",
                user_id=current_user.id,
                details={"email": current_user.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An internal error occurred. Please try again later.",
            )
        if not PasswordValidator.verify_password(current_password, current_user.password):
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_change_invalid_current_password",
                user_id=current_user.id,
                details={"email": current_user.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Current Password",
            )
        # Validate new password complexity
        await enforce_password_complexity(
            new_password,
            background_tasks=background_tasks,
            event_type="password_change_complexity_failed",
            user_id=current_user.id,
            details={"email": current_user.email, "ip_address": ip_address},
        )
        # The reuse policy, the history append and the password_version bump all
        # live in update_password. This path used to reimplement them and got the
        # reuse check wrong -- it compared a freshly salted bcrypt digest against
        # stored digests, which can never match (#193).
        try:
            await crud.user.update_password(
                user=current_user,
                new_password=new_password,
                db_session=db_session,
                created_by_ip=ip_address,
            )
        except PasswordReuseError as e:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_change_reused_password",
                user_id=current_user.id,
                details={
                    "email": current_user.email,
                    "ip_address": ip_address,
                    "error": str(e),
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
        # Clearing the lockout state is this endpoint's own concern, not the
        # password policy's, so it stays here.
        user_update_data = IUserUpdate(  # type: ignore
            number_of_failed_attempts=0,
            is_locked=False,
            locked_until=None,
            needs_to_change_password=False,  # <-- Ensure this is set to False after password change
        )
        updated_user = await crud.user.update(
            db_session=db_session,  # Ensure db_session is passed
            obj_current=current_user,
            obj_new=user_update_data,
        )
        if not updated_user:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_change_failed_post_update",
                user_id=current_user.id,
                details={"email": current_user.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update password. Please try again.",
            )
        # current_user is updated in-place by crud.user.update and is the same as updated_user.
        # Create tokens using the updated user's information.
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        access_token = security.create_access_token(
            current_user.id, current_user.email, expires_delta=access_token_expires
        )
        refresh_token = security.create_refresh_token(current_user.id, expires_delta=refresh_token_expires)
        # Serialize the updated user to IUserRead for the Token response
        user_payload_for_token = serialize_user(current_user)
        user_read_for_token = IUserRead(**user_payload_for_token)
        data = Token(
            access_token=access_token,
            token_type="bearer",
            refresh_token=None,  # HttpOnly cookie; not exposed to JS
            user=user_read_for_token,  # Pass the IUserRead instance
        )
        # Revoke everything first, then allowlist the new tokens. The order is
        # the fix for #206: revocation used to be queued and ran after the
        # response, deleting the very tokens this response hands back. Any
        # pending reset link goes too -- knowing the current password
        # supersedes it.
        await revoke_all_user_tokens(redis_client, current_user.id)
        await add_session_tokens_to_redis(
            redis_client,
            current_user,
            access_token=access_token,
            refresh_token=refresh_token,
            access_expire_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            refresh_expire_minutes=int(refresh_token_expires.total_seconds() / 60),
        )
        set_refresh_token_cookie(
            response,
            refresh_token,
            max_age=int(refresh_token_expires.total_seconds()),
        )
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_change_successful",
            user_id=current_user.id,
            details={"email": current_user.email, "ip_address": ip_address},
        )
        # Expire all objects in the session to ensure latest data is visible in subsequent requests
        db_session.expire_all()
        return create_response(data=data, message="Password changed successfully")
    except HTTPException:
        raise
    except Exception as e:
        # ip_address is guaranteed to be defined here
        logger.error(
            f"Unexpected error in change_password for user {current_user.email} "
            f"from IP {ip_address}: {str(e)}",
            exc_info=True,
        )
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
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
    ip_address = request.client.host if request.client else "Unknown"  # Get IP address
    payload = None  # Initialize payload for broader scope in exception handling
    refresh_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if not refresh_token and body and body.refresh_token:
        refresh_token = body.refresh_token
    if not refresh_token:
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
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
        try:
            payload = decode_token(refresh_token, token_type="refresh")
        except HTTPException as exc:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type=map_jwt_http_error_to_event(exc, flow="refresh"),
                details={
                    "token_error": (exc.detail if isinstance(exc.detail, str) else str(exc.detail)),
                    "ip_address": ip_address,
                },
            )
            raise
        if payload["type"] == "refresh":
            user_id_from_token = payload["sub"]
            valid_refresh_tokens = await get_valid_tokens(redis_client, user_id_from_token, TokenType.REFRESH)
            if not token_is_allowlisted(valid_refresh_tokens, refresh_token):
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="refresh_token_invalid",
                    details={"user_id": user_id_from_token, "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"status": False, "message": "Refresh token invalid"},
                )
            access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            user: User | None = None
            try:
                user_uuid = UUID(user_id_from_token)
                user = await crud.user.get(id=user_uuid, db_session=db_session)
            except ValueError:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="refresh_token_invalid_uuid",
                    details={"user_id": user_id_from_token, "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "status": False,
                        "message": "Invalid user identifier in token",
                    },
                )
            if user and user.is_active:
                access_token = security.create_access_token(
                    str(user.id),
                    user.email,
                    expires_delta=access_token_expires,  # Use user.id from DB object
                )
                # It's debatable whether to add the new access token to redis
                # if only refresh tokens are strictly managed this way.
                # The existing code had this logic, so keeping it.
                valid_access_tokens = await get_valid_tokens(redis_client, user.id, TokenType.ACCESS)
                if valid_access_tokens is not None:  # Check if Redis list exists (even if empty)
                    await add_derived_access_token_to_redis(
                        redis_client,
                        user,
                        access_token,
                        refresh_token,
                        settings.ACCESS_TOKEN_EXPIRE_MINUTES,
                    )
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="refresh_token_success",
                    user_id=user.id,
                    details={"email": user.email, "ip_address": ip_address},
                )
                return create_response(
                    data=TokenRead(access_token=access_token, token_type="bearer"),
                    message="Access token generated correctly",
                )
            else:
                # This covers user not found (user is None) or user is inactive
                event_user_id = user.id if user else user_id_from_token
                event_email = user.email if user else "N/A"
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="refresh_token_user_not_found_or_inactive",
                    user_id=event_user_id,
                    details={
                        "email": event_email,
                        "token_subject": user_id_from_token,
                        "ip_address": ip_address,
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"status": False, "message": "User not found or inactive"},
                )
        else:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_wrong_type",
                details={"token_type": payload.get("type"), "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"status": False, "message": "Incorrect token type provided"},
            )
    except HTTPException:
        raise  # Re-raise HTTPException directly to maintain original status code and detail
    except Exception as e:
        error_type = type(e).__name__
        logger.error(
            f"Unexpected error in get_new_access_token from IP {ip_address} for "
            f"token sub {payload.get('sub') if payload else 'N/A'}: {str(e)}",
            exc_info=True,
        )
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type=f"new_access_token_unexpected_error_{error_type.lower()}",
            user_id=payload.get("sub") if payload else None,
            details={
                "error": str(e),
                "ip_address": ip_address,
                "token_subject": payload.get("sub") if payload else "N/A",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": False,
                "message": "An unexpected error occurred while refreshing the token.",
            },
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
    """
    # Check if user exists and get their current status
    user_record = await crud.user.get_by_email(email=form_data.username, db_session=db_session)
    if not user_record:
        # User doesn't exist, but don't reveal that information
        # Log failed login attempt for non-existent user as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="oauth2_failed_login",
            details={"email": form_data.username, "reason": "user_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field_name": "email", "message": "Incorrect email or password"},
        )  # Check for locked account before attempting authentication
    if (
        user_record.is_locked
        and user_record.locked_until
        and user_record.locked_until > datetime.now(timezone.utc)
    ):
        # Calculate remaining lock time
        locked_until_utc = ensure_utc(user_record.locked_until)
        if locked_until_utc is not None:
            remaining_time = locked_until_utc - datetime.now(timezone.utc)
            remaining_hours = remaining_time.total_seconds() // 3600
            remaining_minutes = (remaining_time.total_seconds() % 3600) // 60
            # Log locked account login attempt as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="oauth2_failed_login_user_disappeared",
                details={"email": form_data.username, "reason": "User not found after failed auth attempt"},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred. Please try again.",
            )
        # Log failed login attempt as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="oauth2_failed_login",
            user_id=updated_user.id,
            details={
                "email": form_data.username,
                "attempt_number": updated_user.number_of_failed_attempts,
            },
        )
        if updated_user.is_locked and updated_user.locked_until:
            # Account was just locked - process the lockout as a background task
            await process_account_lockout(
                background_tasks=background_tasks,
                user=updated_user,
                lock_duration_hours=24,
            )  # Calculate message for user
            remaining_time = updated_user.locked_until - datetime.now(timezone.utc)
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
    if not user.is_active:
        # Log inactive user login attempt
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="oauth2_inactive_user_attempt",
            user_id=user.id,
            details={"email": form_data.username},
        )
        raise HTTPException(
            status_code=400,
            detail={"field_name": "email", "message": "Inactive user"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(user.id, user.email, expires_delta=access_token_expires)
    await add_token_to_redis(
        redis_client,
        user,
        access_token,
        TokenType.ACCESS,
        settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    # Log successful OAuth2 login
    background_tasks.add_task(
        log_security_event,
        background_tasks=background_tasks,
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
    current_user: User = Depends(deps.get_current_user()),
    redis_client: AsyncRedis = Depends(get_redis_client),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:
    """
    Logout endpoint that invalidates the current user's tokens and clears the refresh cookie.
    """
    ip_address = request.client.host if request.client else "Unknown"
    try:
        # Revoke every token for this user before the response is written.
        await revoke_user_tokens(
            redis_client=redis_client,
            user_id=current_user.id,
            token_type=TokenType.ACCESS,
        )
        await revoke_user_tokens(
            redis_client=redis_client,
            user_id=current_user.id,
            token_type=TokenType.REFRESH,
        )
        clear_refresh_token_cookie(response)
        # Log the logout event as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
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
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
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
    ip_address = request.client.host if request.client else "Unknown"
    user: User | None = None  # Define user here for broader scope

    async with response_time_floor():
        try:
            # Sanitize email input
            try:
                email_for_reset = sanitizer.sanitize(str(reset_request.email), "email")
            except Exception as e:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="password_reset_request_sanitization_failed",
                    details={"error": str(e), "ip_address": ip_address},
                )
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email format")
            user = await crud.user.get_by_email(email=email_for_reset, db_session=db_session)
            if not user:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="password_reset_request_invalid_email",
                    details={"email": email_for_reset, "ip_address": ip_address},
                )
                return create_response(data={}, message=PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE)
            if not user.is_active:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="password_reset_request_inactive_user",
                    user_id=user.id,
                    details={"email": email_for_reset, "ip_address": ip_address},
                )
                return create_response(data={}, message=PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE)
            reset_token_expires = timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
            reset_token = security.create_reset_token(user.email, expires_delta=reset_token_expires)
            await add_token_to_redis(
                redis_client,
                user,
                reset_token,
                TokenType.RESET,
                settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
            )
            reset_url = settings.PASSWORD_RESET_URL
            await send_password_reset_email(
                background_tasks=background_tasks,
                user_email=user.email,
                reset_token=reset_token,
                reset_url=reset_url,
            )
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
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


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    request: Request,
    reset_confirm: PasswordResetConfirm = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),  # <-- Add this line
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:  # No data returned, just a message
    """
    Reset a password against a token mailed to the address.

    Every failure that required looking an account up answers with
    :data:`~app.utils.account_token_responses.INVALID_PASSWORD_RESET_TOKEN_MESSAGE`
    (#137). It previously answered "Account is inactive. Cannot reset
    password." for a disabled user, which
    confirmed an address in a single request. The is_active check also moved
    behind the allow-list check, so the disabled branch is now reachable only
    by a caller already holding a live token.

    Password complexity and history failures stay distinct: they describe the
    submitted password, not the account.
    """
    ip_address = request.client.host if request.client else "Unknown"
    email_from_token_str: str | None = None

    async with response_time_floor():
        try:
            # Validate new password complexity before anything else
            await enforce_password_complexity(
                reset_confirm.new_password,
                background_tasks=background_tasks,
                event_type="password_reset_complexity_failed",
                details={"ip_address": ip_address, "token_used": reset_confirm.token},
            )
            payload = security.decode_token(reset_confirm.token, token_type="reset")
            email_from_token_str = payload.get("sub")
            if not email_from_token_str:
                await reject_password_reset(
                    background_tasks=background_tasks,
                    event_type="password_reset_token_missing_sub",
                    details={"token_used": reset_confirm.token, "ip_address": ip_address},
                )
            user = await crud.user.get_by_email(db_session=db_session, email=str(email_from_token_str))
            if not user:
                await reject_password_reset(
                    background_tasks=background_tasks,
                    event_type="password_reset_user_not_found",
                    details={
                        "email_from_token": email_from_token_str,
                        "token_used": reset_confirm.token,
                        "ip_address": ip_address,
                    },
                )
            user = cast(User, user)
            # Verify token in Redis. This runs before the is_active check so
            # that the disabled branch is reachable only by a caller who already
            # holds a live reset token -- the mailbox owner, to whom the account
            # is no secret. Everyone else is turned away here instead (#137).
            valid_reset_tokens = await get_valid_tokens(redis_client, user.id, TokenType.RESET)
            if not token_is_allowlisted(valid_reset_tokens, reset_confirm.token):
                await reject_password_reset(
                    background_tasks=background_tasks,
                    event_type="password_reset_token_not_in_redis",
                    user_id=user.id,  # user is guaranteed to be not None here
                    details={
                        "token_in_redis": bool(valid_reset_tokens),
                        "ip_address": ip_address,
                    },
                )
            if not user.is_active:
                await reject_password_reset(
                    background_tasks=background_tasks,
                    event_type="password_reset_inactive_account",
                    user_id=user.id,
                    details={"email": user.email, "ip_address": ip_address},
                )
            try:
                # This will check history, update password,
                # and update last_changed_password_date
                await crud.user.update_password(
                    user=user, new_password=reset_confirm.new_password, db_session=db_session
                )
            except ValueError as e:
                # Log password history violation as a background task
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="password_reset_history_violation",
                    user_id=user.id,
                    details={"error": str(e), "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unable to set new password. Please ensure it meets all security requirements.",
                )
            # Revoke the reset link so it cannot be replayed, and every
            # session with it: the password just changed hands.
            await revoke_all_user_tokens(redis_client, user.id)
            # Log successful password reset as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_successful",
                user_id=user.id,
                details={"email": user.email, "ip_address": ip_address},
            )
            return create_response(data={}, message="Password has been reset successfully")
        except HTTPException:
            raise  # Re-raise HTTPException directly
        except Exception as e:
            error_type = type(e).__name__
            user_id_for_log = user.id if user else (payload["sub"] if payload else None)
            email_for_log = user.email if user else "N/A"
            logger.error(
                f"Unexpected error in confirm_password_reset for user {email_for_log} "
                f"(ID: {user_id_for_log}) from IP {ip_address}: {str(e)}",
                exc_info=True,
            )
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type=f"password_reset_confirm_unexpected_error_{error_type.lower()}",
                user_id=user_id_for_log,
                details={
                    "email": email_for_log,
                    "error": str(e),
                    "ip_address": ip_address,
                    "token_subject": payload["sub"] if payload else "N/A",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred. Please try again later.",
            )


@router.post("/reset_password")
async def reset_password(
    request: Request,
    body_in: PasswordResetConfirm,  # Changed from body to body_in
    background_tasks: BackgroundTasks,
    redis_client: AsyncRedis = Depends(get_redis_client),
    sanitizer: deps.InputSanitizer = Depends(get_strict_sanitizer),
    db_session: AsyncSession = Depends(deps.get_db),  # <-- Add this line
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase:  # No data returned, just a message
    """
    Reset a password against a token mailed to the address.

    A near-duplicate of :func:`confirm_password_reset`, differing only in route
    and input sanitisation; see it for why every account-dependent failure here
    answers with one message. ADR 0010 records why the two were not merged.
    """
    ip_address = request.client.host if request.client else "Unknown"
    email_from_token_str: str | None = None
    async with response_time_floor():
        # Input sanitization for password reset data
        try:
            # Sanitize token (it should contain only alphanumeric and safe chars)
            sanitized_token = sanitizer.sanitize(body_in.token, "text")
            body_in.token = sanitized_token
            # Validate password length to prevent DoS attacks
            if len(body_in.new_password) > 1000:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="password_reset_password_too_long",
                    details={
                        "ip_address": ip_address,
                        "password_length": len(body_in.new_password),
                    },
                )
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password too long")
        except Exception as e:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_input_sanitization_failed",
                details={"error": str(e), "ip_address": ip_address},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid input data")
        try:
            # Validate new password complexity before anything else
            await enforce_password_complexity(
                body_in.new_password,
                background_tasks=background_tasks,
                event_type="password_reset_complexity_failed",
                details={"ip_address": ip_address, "token_used": body_in.token},
            )
            payload = security.decode_token(body_in.token, token_type="reset")
            email_from_token_str = payload.get("sub")
            if not email_from_token_str:
                await reject_password_reset(
                    background_tasks=background_tasks,
                    event_type="password_reset_token_missing_sub",
                    details={"token_used": body_in.token, "ip_address": ip_address},
                )
            user = await crud.user.get_by_email(db_session=db_session, email=str(email_from_token_str))
            if not user:
                await reject_password_reset(
                    background_tasks=background_tasks,
                    event_type="password_reset_user_not_found",
                    details={
                        "email_from_token": email_from_token_str,
                        "token_used": body_in.token,
                        "ip_address": ip_address,
                    },
                )
            user = cast(User, user)
            # Verify token in Redis. This runs before the is_active check so
            # that the disabled branch is reachable only by a caller who already
            # holds a live reset token -- the mailbox owner, to whom the account
            # is no secret. Everyone else is turned away here instead (#137).
            valid_reset_tokens = await get_valid_tokens(redis_client, user.id, TokenType.RESET)
            if not token_is_allowlisted(valid_reset_tokens, body_in.token):
                await reject_password_reset(
                    background_tasks=background_tasks,
                    event_type="password_reset_token_not_in_redis",
                    user_id=user.id,  # user is guaranteed to be not None here
                    details={
                        "token_in_redis": bool(valid_reset_tokens),
                        "ip_address": ip_address,
                    },
                )
            if not user.is_active:
                await reject_password_reset(
                    background_tasks=background_tasks,
                    event_type="password_reset_inactive_account",
                    user_id=user.id,
                    details={"email": user.email, "ip_address": ip_address},
                )
            try:
                # This will check history, update password,
                # and update last_changed_password_date
                await crud.user.update_password(
                    user=user, new_password=body_in.new_password, db_session=db_session
                )
            except ValueError as e:
                # Log password history violation as a background task
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="password_reset_history_violation",
                    user_id=user.id,
                    details={"error": str(e), "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unable to set new password. Please ensure it meets all security requirements.",
                )
            # Revoke the reset link so it cannot be replayed, and every
            # session with it: the password just changed hands.
            await revoke_all_user_tokens(redis_client, user.id)
            # Log successful password reset as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_successful",
                user_id=user.id,
                details={"email": user.email, "ip_address": ip_address},
            )
            return create_response(data={}, message="Password has been reset successfully")
        except HTTPException:
            raise  # Re-raise HTTPException directly
        except Exception as e:
            error_type = type(e).__name__
            user_id_for_log = user.id if user else (payload["sub"] if payload else None)
            email_for_log = user.email if user else "N/A"
            logger.error(
                f"Unexpected error in reset_password for user {email_for_log} "
                f"(ID: {user_id_for_log}) from IP {ip_address}: {str(e)}",
                exc_info=True,
            )
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type=f"password_reset_confirm_unexpected_error_{error_type.lower()}",
                user_id=user_id_for_log,
                details={
                    "email": email_for_log,
                    "error": str(e),
                    "ip_address": ip_address,
                    "token_subject": payload["sub"] if payload else "N/A",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred. Please try again later.",
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
