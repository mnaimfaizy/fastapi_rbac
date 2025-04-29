from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jwt import DecodeError, ExpiredSignatureError, MissingRequiredClaimError
from pydantic import EmailStr
from redis.asyncio import Redis

from app import crud
from app.api import deps
from app.api.deps import get_redis_client
from app.core import security
from app.core.config import settings
from app.core.security import decode_token, verify_password
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.schemas.response_schema import IPostResponseBase, create_response
from app.schemas.token_schema import RefreshToken, Token, TokenRead
from app.schemas.user_schema import (
    IUserCreate,  # Added IUserCreate import
    PasswordResetConfirm,
    PasswordResetRequest,
    UserRegister,
    VerifyEmail,
)
from app.utils.background_tasks import (
    cleanup_expired_tokens,
    log_security_event,
    process_account_lockout,
    send_password_reset_email,
    send_verification_email,
)
from app.utils.token import add_token_to_redis, get_valid_tokens

router = APIRouter()


@router.post("/login")
async def login(
    email: EmailStr = Body(...),
    password: str = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase[Token]:
    """
    Login for all users
    """
    # Check if user exists and get their current status
    user_record = await crud.user.get_by_email(email=email)

    if not user_record:
        # User doesn't exist, but don't reveal that information
        # Log failed login attempt for non-existent user
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="failed_login",
            details={"email": email, "reason": "user_not_found"},
        )

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "field_name": "username",
                "message": "Username or password is incorrect",
            },
        )

    # Check for locked account before attempting authentication
    if user_record.is_locked and user_record.locked_until and user_record.locked_until > datetime.utcnow():
        # Calculate remaining lock time
        remaining_time = user_record.locked_until - datetime.utcnow()
        remaining_hours = remaining_time.total_seconds() // 3600
        remaining_minutes = (remaining_time.total_seconds() % 3600) // 60

        # Log locked account login attempt
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="locked_account_attempt",
            user_id=user_record.id,
            details={
                "email": email,
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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "field_name": "username",
                "message": lock_message,
            },
        )

    # Check if we need to show warning for last attempt (2 failed attempts already)
    warning_message = None
    attempts_count = (
        0 if user_record.number_of_failed_attempts is None else user_record.number_of_failed_attempts
    )

    print(f"Current failed attempts for user {user_record.email}: {attempts_count}")

    if attempts_count == 2:
        warning_message = (
            "Warning: This is your last attempt. If you enter "
            "an incorrect password again, your account will be locked for 24 hours."
        )

    # Now attempt to authenticate
    user = await crud.user.authenticate(email=email, password=password)

    if not user:
        # Failed authentication attempt
        # Pull the user data again to get the latest status after
        # increment_failed_attempts was called
        updated_user = await crud.user.get_by_email(email=email)

        # Log failed login attempt
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="failed_login",
            user_id=updated_user.id,
            details={
                "email": email,
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
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field_name": "username",
                    "message": lock_message,
                },
            )
        else:
            # Just a regular authentication failure
            attempts_left = 3 - (
                0
                if updated_user.number_of_failed_attempts is None
                else updated_user.number_of_failed_attempts
            )
            message = "Username or password is incorrect"
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
                    "field_name": "username",
                    "message": message,
                },
            )

    # Authentication succeeded
    if not crud.user.has_verified(user):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field_name": "username", "message": "Email is not verified."},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field_name": "username", "message": "Inactive user"},
        )

    # Generate tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(user.id, user.email, expires_delta=access_token_expires)
    refresh_token = security.create_refresh_token(user.id, expires_delta=refresh_token_expires)
    data = Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
        user=user,
    )

    # Handle token storage in Redis
    valid_access_tokens = await get_valid_tokens(redis_client, user.id, TokenType.ACCESS)
    if valid_access_tokens:
        await add_token_to_redis(
            redis_client,
            user,
            access_token,
            TokenType.ACCESS,
            settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        )
    valid_refresh_tokens = await get_valid_tokens(redis_client, user.id, TokenType.REFRESH)
    if valid_refresh_tokens:
        await add_token_to_redis(
            redis_client,
            user,
            refresh_token,
            TokenType.REFRESH,
            settings.REFRESH_TOKEN_EXPIRE_MINUTES,
        )

    # Log successful login as a background task
    background_tasks.add_task(
        log_security_event,
        background_tasks=background_tasks,
        event_type="successful_login",
        user_id=user.id,
        details={"email": user.email},
    )

    # Create response with optional warning message
    message = "Login correctly"
    if warning_message:
        message = warning_message

    return create_response(data=data, message=message)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserRegister,
    background_tasks: BackgroundTasks,
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase[Token]:
    """
    Register a new user.
    """
    user = await crud.user.get_by_email(email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        )

    # Create user with verified=False and generate verification token
    verification_token = security.create_verification_token(user_in.email)
    user_create = IUserCreate(
        **user_in.model_dump(),
        verified=False,
        verification_code=verification_token,  # Store token temporarily
    )
    user = await crud.user.create(obj_in=user_create)

    # Send verification email
    await send_verification_email(
        background_tasks=background_tasks,
        user_email=user.email,
        verification_token=verification_token,
        verification_url=settings.EMAIL_VERIFICATION_URL,
    )

    # Log registration event
    background_tasks.add_task(
        log_security_event,
        background_tasks=background_tasks,
        event_type="user_registered",
        user_id=user.id,
        details={"email": user.email},
    )

    # Optionally log the user in immediately after registration
    # Generate tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(user.id, user.email, expires_delta=access_token_expires)
    refresh_token = security.create_refresh_token(user.id, expires_delta=refresh_token_expires)
    data = Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
        user=user,  # Include user details in response
    )

    # Add tokens to Redis
    await add_token_to_redis(
        redis_client,
        user,
        access_token,
        TokenType.ACCESS,
        settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    await add_token_to_redis(
        redis_client,
        user,
        refresh_token,
        TokenType.REFRESH,
        settings.REFRESH_TOKEN_EXPIRE_MINUTES,
    )

    return create_response(
        data=data,
        message="User registered successfully. Please check your email to verify your account.",
    )


@router.post("/verify-email")
async def verify_email(
    body: VerifyEmail,
    background_tasks: BackgroundTasks,
) -> IPostResponseBase:
    """
    Verify user's email address using the provided token.
    """
    try:
        payload = security.decode_token(body.token, token_type="verification")
        email = payload.get("sub")  # Email is stored in 'sub' for verification token
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload")

    except (ExpiredSignatureError, DecodeError, MissingRequiredClaimError):
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="email_verification_invalid_token",
            details={"token_error": "Invalid or expired token"},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    user = await crud.user.get_by_email(email=email)

    if not user:
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="email_verification_user_not_found",
            details={"email": email},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.verified:
        return create_response(data={}, message="Email is already verified.")

    # Check if the token matches the stored verification code (optional, depends on flow)
    # if user.verification_code != body.token:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Invalid verification token.",
    #     )

    # Mark user as verified and clear verification code
    user.verified = True
    user.verification_code = None
    await crud.user.update(obj_current=user, obj_new={})  # Save changes

    background_tasks.add_task(
        log_security_event,
        background_tasks=background_tasks,
        event_type="email_verified",
        user_id=user.id,
        details={"email": user.email},
    )

    return create_response(data={}, message="Email verified successfully.")


@router.post("/resend-verification-email")
async def resend_verification_email(
    email_in: EmailStr = Body(..., embed=True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> IPostResponseBase:
    """
    Resend the verification email for a given email address.
    """
    user = await crud.user.get_by_email(email=email_in)

    resend_message = (
        "If an account with that email exists and is not verified, " "a new verification email has been sent."
    )

    if not user:
        # Don't reveal if the user exists or not for security reasons
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="resend_verification_email_user_not_found",
            details={"email": email_in},
        )
        return create_response(data={}, message=resend_message)

    if user.verified:
        return create_response(data={}, message="This email address is already verified.")

    # Generate a new verification token
    verification_token = security.create_verification_token(user.email)
    user.verification_code = verification_token  # Update the stored code
    await crud.user.update(obj_current=user, obj_new={})  # Save changes

    # Send the new verification email
    await send_verification_email(
        background_tasks=background_tasks,
        user_email=user.email,
        verification_token=verification_token,
        verification_url=settings.EMAIL_VERIFICATION_URL,
    )

    background_tasks.add_task(
        log_security_event,
        background_tasks=background_tasks,
        event_type="verification_email_resent",
        user_id=user.id,
        details={"email": user.email},
    )

    return create_response(data={}, message=resend_message)


@router.post("/change_password")
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(deps.get_current_user()),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase[Token]:
    """
    Change password
    """
    if not verify_password(current_password, current_user.password):
        # Log failed password change attempt as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_change_invalid_current_password",
            user_id=current_user.id,
            details={"email": current_user.email},
        )
        raise HTTPException(status_code=400, detail="Invalid Current Password")

    try:
        # This will check history, update password,
        # and update last_changed_password_date
        await crud.user.update_password(user=current_user, new_password=new_password)
    except ValueError as e:
        # Log password history violation as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_change_history_violation",
            user_id=current_user.id,
            details={"email": current_user.email, "error": str(e)},
        )
        raise HTTPException(status_code=400, detail=str(e))

    # Generate new tokens after password change
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        current_user.id, current_user.email, expires_delta=access_token_expires
    )
    refresh_token = security.create_refresh_token(current_user.id, expires_delta=refresh_token_expires)
    data = Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
        user=current_user,
    )

    # Invalidate old tokens as background tasks
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

    # Add new tokens
    await add_token_to_redis(
        redis_client,
        current_user,
        access_token,
        TokenType.ACCESS,
        settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    await add_token_to_redis(
        redis_client,
        current_user,
        refresh_token,
        TokenType.REFRESH,
        settings.REFRESH_TOKEN_EXPIRE_MINUTES,
    )

    # Log successful password change as a background task
    background_tasks.add_task(
        log_security_event,
        background_tasks=background_tasks,
        event_type="password_change_successful",
        user_id=current_user.id,
        details={"email": current_user.email},
    )

    return create_response(data=data, message="Password changed successfully")


@router.post("/new_access_token", status_code=201)
async def get_new_access_token(
    body: RefreshToken = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase[TokenRead]:
    """
    Gets a new access token using the refresh token for future requests
    """
    try:
        payload = decode_token(body.refresh_token, token_type="refresh")
    except ExpiredSignatureError:
        # Log token expiration as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="refresh_token_expired",
            details={"token_error": "Token expired"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "status": False,
                "message": "Your token has expired. Please log in again.",
            },
        )
    except DecodeError:
        # Log token decode error as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="refresh_token_decode_error",
            details={"token_error": "Invalid token format"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "status": False,
                "message": "Error when decoding the token. Please check your request.",
            },
        )
    except MissingRequiredClaimError:
        # Log missing claim error as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="refresh_token_missing_claim",
            details={"token_error": "Missing required claim"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "status": False,
                "message": "There is no required field in your token. " "Please contact the administrator.",
            },
        )

    if payload["type"] == "refresh":
        user_id = payload["sub"]
        valid_refresh_tokens = await get_valid_tokens(redis_client, user_id, TokenType.REFRESH)
        if valid_refresh_tokens and body.refresh_token not in valid_refresh_tokens:
            # Log invalid refresh token as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_invalid",
                details={"user_id": user_id},
            )
            raise HTTPException(
                status_code=403,
                detail={"status": False, "message": "Refresh token invalid"},
            )

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        try:
            # Convert string user_id to UUID
            user_uuid = UUID(user_id)
            user = await crud.user.get(id=user_uuid)
        except ValueError:
            # Log UUID conversion error as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_invalid_uuid",
                details={"user_id": user_id},
            )
            raise HTTPException(
                status_code=403,
                detail={"status": False, "message": "Invalid user identifier"},
            )

        if user and user.is_active:
            access_token = security.create_access_token(
                payload["sub"], user.email, expires_delta=access_token_expires
            )
            valid_access_tokens = await get_valid_tokens(redis_client, user.id, TokenType.ACCESS)
            if valid_access_tokens:
                await add_token_to_redis(
                    redis_client,
                    user,
                    access_token,
                    TokenType.ACCESS,
                    settings.ACCESS_TOKEN_EXPIRE_MINUTES,
                )

            # Log successful token refresh as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_success",
                user_id=user.id,
                details={"email": user.email},
            )

            return create_response(
                data=TokenRead(access_token=access_token, token_type="bearer"),
                message="Access token generated correctly",
            )
        else:
            # Log inactive user token refresh attempt as a background task
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_inactive_user",
                user_id=user_id if user else None,
                details={"email": user.email if user else None},
            )
            raise HTTPException(status_code=404, detail={"status": False, "message": "User inactive"})
    else:
        # Log incorrect token type as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="refresh_token_wrong_type",
            details={"token_type": payload.get("type")},
        )
        raise HTTPException(status_code=404, detail={"status": False, "message": "Incorrect token"})


@router.post("/access-token")
async def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: Redis = Depends(get_redis_client),
) -> TokenRead:
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
            status_code=400,
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
                status_code=400,
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

    token_read = TokenRead(access_token=access_token, token_type="bearer")

    # If there was a warning, we need to add it to the response
    # Since TokenRead doesn't have a message field,
    # we'll add it to the token type field as a workaround
    # The client can parse this to extract both the token type and the warning message
    if warning_message:
        token_read.token_type = f"bearer|{warning_message}"

    return token_read


@router.post("/logout")
async def logout(
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(deps.get_current_user()),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase:
    """
    Logout endpoint that invalidates the current user's tokens
    """
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
        details={"email": current_user.email},
    )

    return create_response(data={}, message="Successfully logged out")


@router.post("/password-reset/request")
async def request_password_reset(
    reset_request: PasswordResetRequest = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase:
    """
    Request a password reset for a given email address.
    Sends a token that can be used to reset the password.
    """
    user = await crud.user.get_by_email(email=reset_request.email)
    if not user:
        # Don't reveal that the email doesn't exist,
        # but log the attempt as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_reset_request_invalid_email",
            details={"email": reset_request.email},
        )
        return create_response(data={}, message="If the email exists, a password reset link has been sent")

    if not user.is_active:
        # Don't reveal that the user is inactive,
        # but log the attempt as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_reset_request_inactive_user",
            user_id=user.id,
            details={"email": reset_request.email},
        )
        return create_response(data={}, message="If the email exists, a password reset link has been sent")

    # Generate a password reset token
    reset_token_expires = timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    reset_token = security.create_reset_token(user.id, expires_delta=reset_token_expires)

    # Store the reset token in Redis
    await add_token_to_redis(
        redis_client,
        user,
        reset_token,
        TokenType.RESET,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )

    # Construct reset password URL
    reset_url = settings.PASSWORD_RESET_URL

    # Use background tasks to send the password reset email
    await send_password_reset_email(
        background_tasks=background_tasks,
        user_email=user.email,
        reset_token=reset_token,
        reset_url=reset_url,
    )

    # Log the password reset request as a background task
    background_tasks.add_task(
        log_security_event,
        background_tasks=background_tasks,
        event_type="password_reset_requested",
        user_id=user.id,
        details={"email": user.email},
    )

    # In development mode, return the token for testing purposes
    # In production, only return a success message
    if settings.MODE == "development":
        return create_response(
            data={
                "reset_url": f"{reset_url}?token={reset_token}",
                "reset_token": reset_token,
            },
            message="Password reset email sent. " "Check the MailHog interface at http://localhost:8025",
        )
    else:
        return create_response(
            data={},
            message="If the email exists, a password reset link has been sent",
        )


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    reset_confirm: PasswordResetConfirm = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase:
    """
    Reset a user's password using a valid reset token
    """
    try:
        payload = decode_token(reset_confirm.token, token_type="reset")
    except (ExpiredSignatureError, DecodeError, MissingRequiredClaimError):
        # Log invalid token attempt as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_reset_invalid_token",
            details={"token_error": "Invalid or expired token"},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token",
        )

    user_id = payload["sub"]
    user = await crud.user.get(id=user_id)

    if not user or not user.is_active:
        # Log invalid user attempt as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_reset_invalid_user",
            details={
                "user_id": user_id,
                "exists": bool(user),
                "active": bool(user and user.is_active),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token",
        )

    # Verify token in Redis
    valid_reset_tokens = await get_valid_tokens(redis_client, user_id, TokenType.RESET)
    if not valid_reset_tokens or reset_confirm.token not in valid_reset_tokens:
        # Log invalid token in Redis as a background task
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="password_reset_token_not_in_redis",
            user_id=user.id,
            details={"token_in_redis": bool(valid_reset_tokens)},
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
            details={"error": str(e)},
        )
        raise HTTPException(status_code=400, detail=str(e))

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
        details={"email": user.email},
    )

    return create_response(data={}, message="Password has been reset successfully")
