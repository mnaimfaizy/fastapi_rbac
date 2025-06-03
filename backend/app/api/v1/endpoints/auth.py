import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import cast  # Keep cast
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jwt import DecodeError, ExpiredSignatureError, MissingRequiredClaimError
from pydantic import EmailStr
from redis.asyncio import Redis as AsyncRedis
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api import deps
from app.api.deps import get_redis_client
from app.core import security  # security module contains token functions
from app.core.config import settings
from app.core.security import PasswordValidator, decode_token  # For password complexity
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.schemas.response_schema import IPostResponseBase, create_response
from app.schemas.token_schema import PasswordResetConfirm, RefreshToken, Token, TokenRead
from app.schemas.user_schema import PasswordResetRequest  # Used for resend-verification
from app.schemas.user_schema import (  # PasswordResetConfirm, # Not used in this snippet
    IUserCreate,
    IUserRead,
    IUserUpdate,
    UserRegister,
    VerifyEmail,
)
from app.utils.background_tasks import (
    cleanup_expired_tokens,
    cleanup_unverified_account,
    log_security_event,
    process_account_lockout,
    send_password_reset_email,
    send_verification_email,
)
from app.utils.token import add_token_to_redis, get_valid_tokens
from app.utils.user_utils import serialize_user

logger = logging.getLogger("fastapi_rbac")

# Create limiter instance for this module
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    email: EmailStr = Body(...),
    password: str = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
) -> IPostResponseBase[Token]:
    """
    Login for all users
    """
    ip_address = request.client.host if request.client else "Unknown"
    try:
        # Get user record
        try:
            user_record = await crud.user.get_by_email(email=email)
        except Exception as e:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="login_db_error",
                details={"error": str(e), "email": email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while processing your request.",
            )

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
                    "field_name": "username",
                    "message": "Username or password is incorrect",
                },
            )

        user_record = cast(User, user_record)

        is_locked = (
            user_record.is_locked
            and user_record.locked_until
            and user_record.locked_until > datetime.utcnow()
        )

        if is_locked and user_record.locked_until:
            remaining_time = user_record.locked_until - datetime.utcnow()
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
                    "field_name": "username",
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
            authenticated_user = await crud.user.authenticate(email=email, password=password)
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
                updated_user = await crud.user.get_by_email(email=email)

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

                updated_user = cast(User, updated_user)

                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="failed_login",
                    user_id=updated_user.id,
                    details={
                        "email": email,
                        "attempt_number": updated_user.number_of_failed_attempts,
                        "ip_address": ip_address,
                    },
                )

                if updated_user.is_locked and updated_user.locked_until:
                    # settings.ACCOUNT_LOCKOUT_MINUTES is in minutes, convert to hours
                    lockout_duration_in_hours = settings.ACCOUNT_LOCKOUT_MINUTES / 60

                    await process_account_lockout(
                        background_tasks=background_tasks,
                        user=updated_user,
                        lock_duration_hours=int(lockout_duration_in_hours),  # Cast to int
                    )
                    if updated_user.locked_until:  # Re-check after process_account_lockout
                        remaining_time = updated_user.locked_until - datetime.utcnow()
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
                    else:  # Should have locked_until if is_locked
                        lock_message = (
                            "Account locked due to too many failed attempts. " "Please contact support."
                        )
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "field_name": "username",
                            "message": lock_message,
                        },
                    )
                else:
                    failed_attempts = updated_user.number_of_failed_attempts or 0
                    max_login_attempts = (
                        settings.MAX_LOGIN_ATTEMPTS if hasattr(settings, "MAX_LOGIN_ATTEMPTS") else 3
                    )
                    attempts_left = max_login_attempts - failed_attempts
                    message = "Username or password is incorrect"

                    if attempts_left == 1:
                        message = (
                            f"{message}. Warning: This is your last attempt. "
                            "Account will be locked after the next failed attempt."
                        )
                    elif attempts_left > 0:
                        message = f"{message}. {attempts_left} attempts remaining before " "account lockout."
                    # If attempts_left is 0 or less, it means account should be locked.
                    # This is handled by the is_locked check above after process_account_lockout
                    # or if MAX_LOGIN_ATTEMPTS is reached and crud.user.authenticate handles locking.

                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "field_name": "username",
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
                detail={"field_name": "username", "message": "Email is not verified."},
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
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"field_name": "username", "message": "Inactive user"},
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

            await add_token_to_redis(
                redis_client,
                authenticated_user,
                access_token,
                TokenType.ACCESS,
                settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            )
            await add_token_to_redis(
                redis_client,
                authenticated_user,
                refresh_token,
                TokenType.REFRESH,
                settings.REFRESH_TOKEN_EXPIRE_MINUTES,
            )

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
            refresh_token=refresh_token,
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


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def register(
    request: Request,
    user_in: UserRegister,
    background_tasks: BackgroundTasks,
    redis_client: AsyncRedis = Depends(get_redis_client),
) -> IPostResponseBase[IUserRead]:
    """
    Register a new user with security measures.
    """
    ip_address = request.client.host if request.client else "Unknown"

    try:
        # Use specific settings for registration rate limits if they exist
        max_ip_attempts = (
            settings.MAX_REGISTRATION_ATTEMPTS_PER_HOUR  # Corrected attribute
            if hasattr(settings, "MAX_REGISTRATION_ATTEMPTS_PER_HOUR")
            else 5
        )
        max_email_attempts = (
            settings.MAX_REGISTRATION_ATTEMPTS_PER_EMAIL  # Corrected attribute
            if hasattr(settings, "MAX_REGISTRATION_ATTEMPTS_PER_EMAIL")
            else 3
        )
        rate_limit_period = (
            settings.RATE_LIMIT_PERIOD_SECONDS  # Corrected attribute
            if hasattr(settings, "RATE_LIMIT_PERIOD_SECONDS")
            else 3600
        )

        ip_rate_limit_key = f"registration_rate_limit:ip:{ip_address}"
        email_rate_limit_key = f"registration_rate_limit:email:{user_in.email}"

        ip_attempts_raw = await redis_client.get(ip_rate_limit_key)
        email_attempts_raw = await redis_client.get(email_rate_limit_key)
        ip_attempts = int(ip_attempts_raw) if ip_attempts_raw else 0
        email_attempts = int(email_attempts_raw) if email_attempts_raw else 0

        if ip_attempts >= max_ip_attempts or email_attempts >= max_email_attempts:
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

        if not PasswordValidator.validate_complexity(user_in.password):
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="registration_password_complexity_failed",
                details={"email": user_in.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password does not meet complexity requirements.",
            )

        # Check if the user already exists
        user = await crud.user.get_by_email(email=user_in.email)
        if user:
            await asyncio.sleep(0.2)
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="registration_duplicate_email",
                details={"email": user_in.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to process registration request.",
            )

        verification_token = security.create_verification_token(user_in.email)
        user_create = IUserCreate(
            **user_in.model_dump(),
            verified=False,
            verification_code=verification_token,  # For sending email
            roles=[],  # Default roles can be assigned here or later
            last_changed_password_date=datetime.now(timezone.utc),
        )

        # Create user with retry on conflict
        try:
            new_user = await crud.user.create(obj_in=user_create)  # Renamed to new_user for clarity
        except Exception as e:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="registration_creation_error",
                details={"error": str(e), "email": user_in.email},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred during registration.",
            )

        # Add check for user object and user.id
        if not new_user or not hasattr(new_user, "id") or not new_user.id:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="registration_creation_failed_post_create",
                details={
                    "email": user_in.email,
                    "reason": "User object or user.id is None/missing after creation",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred during registration (user finalization step).",
            )

        redis_token_key = f"verification_token:{new_user.id}"
        await redis_client.setex(
            redis_token_key,
            settings.VERIFICATION_TOKEN_EXPIRE_MINUTES * 60,
            verification_token,
        )

        # Send verification email
        try:
            await send_verification_email(
                background_tasks=background_tasks,
                user_email=new_user.email,
                verification_token=verification_token,
                verification_url=settings.EMAIL_VERIFICATION_URL,
            )
        except Exception as e:
            # Cleanup on email failure
            await crud.user.remove(id=new_user.id)
            await redis_client.delete(redis_token_key)

            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="registration_email_failed",
                details={"error": str(e), "email": user_in.email},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to complete registration. Please try again later.",
            )

        # Implement rate limiting
        await redis_client.incr(ip_rate_limit_key)
        await redis_client.expire(ip_rate_limit_key, rate_limit_period)  # Use the defined variable
        await redis_client.incr(email_rate_limit_key)
        await redis_client.expire(email_rate_limit_key, rate_limit_period)  # Use the defined variable

        # Schedule cleanup of unverified accounts
        background_tasks.add_task(
            cleanup_unverified_account,
            background_tasks=background_tasks,
            user_id=new_user.id,
            redis_client=redis_client,
            delay_hours=settings.UNVERIFIED_ACCOUNT_CLEANUP_HOURS,
        )

        # Log successful registration
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="user_registered",
            user_id=new_user.id,
            details={"email": new_user.email},
        )

        user_data = serialize_user(new_user)
        user_read = IUserRead(**user_data)

        return create_response(
            data=user_read,  # Return IUserRead object
            message="Registration successful. Please check your email to verify your account.",
        )

    except HTTPException:
        raise
    except Exception as e:
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="registration_unexpected_error",
            details={"error": str(e), "ip_address": ip_address},  # Log email if available from user_in
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
) -> IPostResponseBase[IUserRead]:
    """
    Verify user's email address using the provided token.
    """
    ip_address = request.client.host if request.client else "Unknown"
    email_from_token_str: str | None = None

    try:
        # First validate the token structure and signature
        try:
            payload = security.decode_token(body.token, token_type="verification")
            email_from_token_str = payload.get("sub")
            if not email_from_token_str:  # Should be validated by decode_token
                raise MissingRequiredClaimError("sub")
        except (
            ExpiredSignatureError,
            DecodeError,
            MissingRequiredClaimError,
            ValueError,  # For other potential decode issues
        ) as e:
            error_type = type(e).__name__
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type=f"verify_email_token_invalid_{error_type.lower()}",
                details={
                    "error": str(e),
                    "token_used": body.token,
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token.",
            )

        # Ensure email_from_token_str is not None before creating EmailStr
        if not email_from_token_str:
            # This case should ideally be caught by MissingRequiredClaimError
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="verify_email_token_missing_sub",
                details={"token_used": body.token, "ip_address": ip_address},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload.")

        user = await crud.user.get_by_email(email=str(email_from_token_str))

        if not user:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="verify_email_user_not_found",
                details={
                    "email_from_token": email_from_token_str,
                    "token_used": body.token,
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token or user not found.",
            )

        user = cast(User, user)

        # This block checking "verification_token:{user.id}" seems incorrect for password reset tokens
        # and is likely causing the "Invalid token" error.
        # Reset tokens are managed by add_token_to_redis and get_valid_tokens using sets.
        # The check below using get_valid_tokens is the correct one.
        redis_token_key = f"verification_token:{user.id}"
        stored_token_value = await redis_client.get(redis_token_key)

        stored_token_str: str | None = None
        if isinstance(stored_token_value, bytes):
            stored_token_str = stored_token_value.decode("utf-8")
        elif isinstance(stored_token_value, str):
            stored_token_str = stored_token_value

        if not stored_token_str or stored_token_str != body.token:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="verify_email_token_mismatch_or_expired_redis",
                user_id=user.id,
                details={
                    "email": user.email,
                    "token_used": body.token,
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token is invalid, expired, or has already been used.",
            )

        if not user.is_active:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="verify_email_inactive_account",
                user_id=user.id,
                details={"email": user.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is inactive. Cannot verify email.",
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
            return create_response(data=user_read, message="Email is already verified.")

        # Prepare update data for CRUDBase.update
        # Assuming CRUDBase.update takes the current DB object and a Pydantic schema/dict for updates
        user_update = {"verified": True, "verification_code": None}

        # Verify the signature of your crud.user.update method.
        # Common patterns: update(db_obj: Model, obj_in: UpdateSchema | dict)
        # or update(id: Any, obj_in: UpdateSchema | dict)
        # For this example, assuming: update(obj_current: Model, obj_new: UpdateSchema)
        updated_user = await crud.user.update(obj_current=user, obj_new=user_update)

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
        return create_response(data=user_read, message="Email verified successfully.")

    except HTTPException:
        raise
    except Exception as e:
        error_type = type(e).__name__
        # Add more detailed logging for the exception itself
        logger.error(
            (
                "Unexpected error in verify_email for IP %s, Token Sub: %s"
                % (
                    ip_address,
                    email_from_token_str if "email_from_token_str" in locals() else "N/A",
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
                "token_subject": email_from_token_str if "email_from_token_str" in locals() else "N/A",
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
) -> IPostResponseBase:  # No data returned, just a message
    """
    Resend verification email if the user exists, is not verified, and is active.
    Includes rate limiting.
    """
    ip_address = request.client.host if request.client else "Unknown"
    email_to_verify = body.email

    try:
        # Use specific settings for resend rate limits if they exist
        max_attempts = (
            settings.MAX_RESEND_VERIFICATION_ATTEMPTS_PER_HOUR
            if hasattr(settings, "MAX_RESEND_VERIFICATION_ATTEMPTS_PER_HOUR")
            else 3
        )
        rate_limit_period = (
            settings.RATE_LIMIT_PERIOD_RESEND_VERIFICATION_SECONDS
            if hasattr(settings, "RATE_LIMIT_PERIOD_RESEND_VERIFICATION_SECONDS")
            else 3600
        )

        rate_limit_key = f"resend_verification_rate_limit:{email_to_verify}:{ip_address}"
        attempts_raw = await redis_client.get(rate_limit_key)
        attempts = int(attempts_raw) if attempts_raw else 0

        if attempts >= max_attempts:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="resend_verification_rate_limit_exceeded",
                details={"email": email_to_verify, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts to resend verification email. Try again later.",
            )

        user = await crud.user.get_by_email(email=email_to_verify)

        if not user:
            await asyncio.sleep(0.2)  # Mitigate timing attacks
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="resend_verification_user_not_found_pretended_success",
                details={"email": email_to_verify, "ip_address": ip_address},
            )
            await redis_client.incr(rate_limit_key)  # Still count attempt
            await redis_client.expire(rate_limit_key, rate_limit_period)
            return create_response(
                data=None,  # No data for this response
                message=(
                    "If an account with this email exists and is not verified, "
                    "a new verification email has been sent."
                ),
            )

        user = cast(User, user)

        if not user.is_active:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="resend_verification_inactive_account",
                user_id=user.id,
                details={"email": email_to_verify, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is inactive. Cannot resend verification email.",
            )

        if user.verified:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="resend_verification_already_verified",
                user_id=user.id,
                details={"email": email_to_verify, "ip_address": ip_address},
            )
            return create_response(data=None, message="This email is already verified.")

        new_verification_token = security.create_verification_token(user.email)
        redis_token_key = f"verification_token:{user.id}"
        await redis_client.setex(
            redis_token_key,
            settings.VERIFICATION_TOKEN_EXPIRE_MINUTES * 60,
            new_verification_token,
        )

        try:
            await send_verification_email(
                background_tasks=background_tasks,
                user_email=user.email,
                verification_token=new_verification_token,
                verification_url=settings.EMAIL_VERIFICATION_URL,
            )
        except Exception as e:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="resend_verification_email_send_failed",
                user_id=user.id,
                details={"error": str(e), "email": user.email, "ip_address": ip_address},
            )
            # Fall through to generic success to prevent info leak

        await redis_client.incr(rate_limit_key)
        await redis_client.expire(rate_limit_key, rate_limit_period)

        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="resend_verification_email_sent",
            user_id=user.id,
            details={"email": user.email, "ip_address": ip_address},
        )

        return create_response(
            data=None,
            message=(
                "If an account with this email exists and is not verified, "
                "a new verification email has been sent."
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        error_type = type(e).__name__
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type=f"resend_verification_unexpected_error_{error_type.lower()}",
            details={"error": str(e), "email": email_to_verify, "ip_address": ip_address},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


@router.post("/change_password")
async def change_password(
    request: Request,
    current_password: str = Body(...),
    new_password: str = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
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
        is_valid, errors = PasswordValidator.validate_complexity(new_password)
        if not is_valid:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_change_complexity_failed",
                user_id=current_user.id,
                details={"email": current_user.email, "errors": errors, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "New password does not meet complexity requirements.", "errors": errors},
            )

        if settings.PREVENT_PASSWORD_REUSE > 0:
            is_reused = await crud.user.is_password_reused(
                db_session=db_session,
                user_id=current_user.id,
                new_password_hash=PasswordValidator.get_password_hash(new_password),
            )
            if is_reused:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="password_change_reused_password",
                    user_id=current_user.id,
                    details={"email": current_user.email, "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="New password cannot be the same as recent previous passwords.",
                )

        # Hashed password generation and adding current password to history
        hashed_password = PasswordValidator.get_password_hash(new_password)

        if settings.PASSWORD_HISTORY_SIZE > 0 and current_user.password is not None:
            await crud.user.add_password_to_history(
                db_session=db_session,  # Ensure db_session is passed if required by the CRUD method
                user_id=current_user.id,
                hashed_password=current_user.password,
            )

        user_update_data = IUserUpdate(  # type: ignore
            password=hashed_password,
            last_changed_password_date=datetime.now(timezone.utc),
            number_of_failed_attempts=0,
            is_locked=False,
            locked_until=None,
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
            refresh_token=refresh_token,
            user=user_read_for_token,  # Pass the IUserRead instance
        )

        # Clean up old tokens and add new ones to Redis
        # (Ensuring current_user is the updated User model instance for add_token_to_redis)
        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=current_user.id,
            token_type=TokenType.ACCESS,
        )
        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=current_user.id,
            token_type=TokenType.REFRESH,
        )

        await add_token_to_redis(
            redis_client,
            current_user,  # Pass the User model instance
            access_token,
            TokenType.ACCESS,
            settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        )
        await add_token_to_redis(
            redis_client,
            current_user,  # Pass the User model instance
            refresh_token,
            TokenType.REFRESH,
            int(refresh_token_expires.total_seconds() / 60),
        )

        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_change_successful",
            user_id=current_user.id,
            details={"email": current_user.email, "ip_address": ip_address},
        )

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
                "email": current_user.email if current_user else "N/A",  # Add a check for current_user
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
    request: Request,  # Added request parameter
    body: RefreshToken = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
) -> IPostResponseBase[TokenRead]:
    """
    Gets a new access token using the refresh token for future requests
    """
    ip_address = request.client.host if request.client else "Unknown"  # Get IP address
    payload = None  # Initialize payload for broader scope in exception handling

    try:
        try:
            payload = decode_token(body.refresh_token, token_type="refresh")
        except ExpiredSignatureError:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_expired",
                details={"token_error": "Token expired", "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "status": False,
                    "message": "Your token has expired. Please log in again.",
                },
            )
        except DecodeError:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_decode_error",
                details={"token_error": "Invalid token format", "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "status": False,
                    "message": "Error when decoding the token. Please check your request.",
                },
            )
        except MissingRequiredClaimError:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_missing_claim",
                details={"token_error": "Missing required claim", "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "status": False,
                    "message": "There is no required field in your token. Please contact the administrator.",
                },
            )

        if payload["type"] == "refresh":
            user_id_from_token = payload["sub"]
            valid_refresh_tokens = await get_valid_tokens(redis_client, user_id_from_token, TokenType.REFRESH)
            if valid_refresh_tokens and body.refresh_token not in valid_refresh_tokens:
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
                user = await crud.user.get(id=user_uuid)
            except ValueError:
                background_tasks.add_task(
                    log_security_event,
                    background_tasks=background_tasks,
                    event_type="refresh_token_invalid_uuid",
                    details={"user_id": user_id_from_token, "ip_address": ip_address},
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"status": False, "message": "Invalid user identifier in token"},
                )

            if user and user.is_active:
                access_token = security.create_access_token(
                    str(user.id), user.email, expires_delta=access_token_expires  # Use user.id from DB object
                )
                # It's debatable whether to add the new access token to redis
                # if only refresh tokens are strictly managed this way.
                # The existing code had this logic, so keeping it.
                valid_access_tokens = await get_valid_tokens(redis_client, user.id, TokenType.ACCESS)
                if valid_access_tokens is not None:  # Check if Redis list exists (even if empty)
                    await add_token_to_redis(
                        redis_client,
                        user,
                        access_token,
                        TokenType.ACCESS,
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
            detail={"status": False, "message": "An unexpected error occurred while refreshing the token."},
        )


@router.post("/access-token")
@limiter.limit("5/minute")
async def login_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
) -> IPostResponseBase[TokenRead]:  # Changed return type
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    # Check if user exists and get their current status
    user_record = await crud.user.get_by_email(email=form_data.username)

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
            detail={"field_name": "username", "message": "Incorrect email or password"},
        )

    # Check for locked account before attempting authentication
    if user_record.is_locked and user_record.locked_until and user_record.locked_until > datetime.utcnow():
        # Calculate remaining lock time
        remaining_time = user_record.locked_until - datetime.utcnow()
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
            detail={"field_name": "username", "message": lock_message},
        )

    # Check if this is the user's last attempt before locking
    warning_message = None
    attempts_count = (
        0 if user_record.number_of_failed_attempts is None else user_record.number_of_failed_attempts
    )

    print(f"Current OAuth2 failed attempts for user {user_record.email}: {attempts_count}")

    if attempts_count == 2:
        warning_message = (
            "Warning: This is your last attempt. "
            "If you enter an incorrect password again, "
            "your account will be locked for 24 hours."
        )

    # Now attempt to authenticate
    user = await crud.user.authenticate(email=form_data.username, password=form_data.password)

    if not user:
        # Failed authentication attempt
        # Pull the user data again to get the latest
        # status after increment_failed_attempts was called
        updated_user = await crud.user.get_by_email(email=form_data.username)

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
            )

            # Calculate message for user
            remaining_time = updated_user.locked_until - datetime.utcnow()
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
                detail={"field_name": "username", "message": lock_message},
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
                detail={"field_name": "username", "message": message},
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
            detail={"field_name": "username", "message": "Inactive user"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(user.id, user.email, expires_delta=access_token_expires)
    valid_access_tokens = await get_valid_tokens(redis_client, user.id, TokenType.ACCESS)
    if valid_access_tokens:
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
    request: Request,  # Added request parameter
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(deps.get_current_user()),
    redis_client: AsyncRedis = Depends(get_redis_client),
) -> IPostResponseBase:
    """
    Logout endpoint that invalidates the current user's tokens
    """
    ip_address = request.client.host if request.client else "Unknown"

    try:
        # Invalidate tokens as background tasks instead of waiting for completion
        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=current_user.id,
            token_type=TokenType.ACCESS,
        )

        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=current_user.id,
            token_type=TokenType.REFRESH,
        )

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
) -> IPostResponseBase:
    """
    Request a password reset for a given email address.
    Sends a token that can be used to reset the password.
    """
    ip_address = request.client.host if request.client else "Unknown"
    email_for_reset = reset_request.email
    user: User | None = None  # Define user here for broader scope

    try:
        user = await crud.user.get_by_email(email=email_for_reset)
        if not user:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_request_invalid_email",
                details={"email": email_for_reset, "ip_address": ip_address},
            )
            return create_response(
                data={},
                message="If the email exists and the account is active, a password reset link has been sent.",
            )

        if not user.is_active:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_request_inactive_user",
                user_id=user.id,
                details={"email": email_for_reset, "ip_address": ip_address},
            )
            return create_response(
                data={},
                message="If the email exists and the account is active, a password reset link has been sent.",
            )

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
            return create_response(
                data={},
                message="If the email exists and the account is active, a password reset link has been sent",
            )

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
) -> IPostResponseBase:  # No data returned, just a message
    """
    Reset password.
    """
    ip_address = request.client.host if request.client else "Unknown"
    email_from_token_str: str | None = None

    try:
        # Validate new password complexity before anything else
        is_valid, errors = PasswordValidator.validate_complexity(reset_confirm.new_password)
        if not is_valid:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_complexity_failed",
                details={"errors": errors, "ip_address": ip_address, "token_used": reset_confirm.token},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "New password does not meet complexity requirements.", "errors": errors},
            )

        try:
            payload = security.decode_token(reset_confirm.token, token_type="reset")
            email_from_token_str = payload.get("sub")
            if not email_from_token_str:  # Should be validated by decode_token
                raise MissingRequiredClaimError("sub")
        except (
            ExpiredSignatureError,
            DecodeError,
            MissingRequiredClaimError,
            ValueError,  # For other potential decode issues
        ) as e:
            error_type = type(e).__name__
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type=f"password_reset_token_invalid_{error_type.lower()}",
                details={
                    "error": str(e),
                    "token_used": reset_confirm.token,
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired token",
            )

        # Ensure email_from_token_str is not None before creating EmailStr
        if not email_from_token_str:
            # This case should ideally be caught by MissingRequiredClaimError
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_token_missing_sub",
                details={"token_used": reset_confirm.token, "ip_address": ip_address},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload.")

        user = await crud.user.get_by_email(email=str(email_from_token_str))

        if not user:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_user_not_found",
                details={
                    "email_from_token": email_from_token_str,
                    "token_used": reset_confirm.token,
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token or user not found.",
            )

        user = cast(User, user)

        if not user.is_active:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_inactive_account",
                user_id=user.id,
                details={"email": user.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is inactive. Cannot reset password.",
            )

        # Verify token in Redis
        valid_reset_tokens = await get_valid_tokens(redis_client, user.id, TokenType.RESET)
        if not valid_reset_tokens or reset_confirm.token not in valid_reset_tokens:
            # Log invalid token in Redis as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_token_not_in_redis",
                user_id=user.id,  # user is guaranteed to be not None here
                details={"token_in_redis": bool(valid_reset_tokens), "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token",
            )

        try:
            # This will check history, update password,
            # and update last_changed_password_date
            await crud.user.update_password(user=user, new_password=reset_confirm.new_password)
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

        # Clean up tokens in Redis as background tasks
        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=user.id,
            token_type=TokenType.RESET,
        )

        # Invalidate all existing tokens for security
        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=user.id,
            token_type=TokenType.ACCESS,
        )

        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=user.id,
            token_type=TokenType.REFRESH,
        )

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
            f"Unexpected error in confirm_password_reset for user {email_for_log} (ID: {user_id_for_log}) "
            f"from IP {ip_address}: {str(e)}",
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
) -> IPostResponseBase:  # No data returned, just a message
    """
    Reset password.
    """
    ip_address = request.client.host if request.client else "Unknown"
    email_from_token_str: str | None = None

    try:
        # Validate new password complexity before anything else
        is_valid, errors = PasswordValidator.validate_complexity(body_in.new_password)
        if not is_valid:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_complexity_failed",
                details={"errors": errors, "ip_address": ip_address, "token_used": body_in.token},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "New password does not meet complexity requirements.", "errors": errors},
            )

        try:
            payload = security.decode_token(body_in.token, token_type="reset")
            email_from_token_str = payload.get("sub")
            if not email_from_token_str:  # Should be validated by decode_token
                raise MissingRequiredClaimError("sub")
        except (
            ExpiredSignatureError,
            DecodeError,
            MissingRequiredClaimError,
            ValueError,  # For other potential decode issues
        ) as e:
            error_type = type(e).__name__
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type=f"password_reset_token_invalid_{error_type.lower()}",
                details={
                    "error": str(e),
                    "token_used": body_in.token,
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired token",
            )

        # Ensure email_from_token_str is not None before creating EmailStr
        if not email_from_token_str:
            # This case should ideally be caught by MissingRequiredClaimError
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_token_missing_sub",
                details={"token_used": body_in.token, "ip_address": ip_address},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload.")

        user = await crud.user.get_by_email(email=str(email_from_token_str))

        if not user:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_user_not_found",
                details={
                    "email_from_token": email_from_token_str,
                    "token_used": body_in.token,
                    "ip_address": ip_address,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token or user not found.",
            )

        user = cast(User, user)

        if not user.is_active:
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_inactive_account",
                user_id=user.id,
                details={"email": user.email, "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is inactive. Cannot reset password.",
            )

        # Verify token in Redis
        valid_reset_tokens = await get_valid_tokens(redis_client, user.id, TokenType.RESET)
        if not valid_reset_tokens or body_in.token not in valid_reset_tokens:
            # Log invalid token in Redis as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="password_reset_token_not_in_redis",
                user_id=user.id,  # user is guaranteed to be not None here
                details={"token_in_redis": bool(valid_reset_tokens), "ip_address": ip_address},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token",
            )

        try:
            # This will check history, update password,
            # and update last_changed_password_date
            await crud.user.update_password(user=user, new_password=body_in.new_password)
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

        # Clean up tokens in Redis as background tasks
        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=user.id,
            token_type=TokenType.RESET,
        )

        # Invalidate all existing tokens for security
        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=user.id,
            token_type=TokenType.ACCESS,
        )

        await cleanup_expired_tokens(
            background_tasks=background_tasks,
            redis_client=redis_client,
            user_id=user.id,
            token_type=TokenType.REFRESH,
        )

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
            f"Unexpected error in confirm_password_reset for user {email_for_log} (ID: {user_id_for_log}) "
            f"from IP {ip_address}: {str(e)}",
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
