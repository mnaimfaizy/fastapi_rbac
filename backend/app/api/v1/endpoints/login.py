from datetime import timedelta, datetime

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jwt import DecodeError, ExpiredSignatureError, MissingRequiredClaimError
from pydantic import EmailStr
from redis.asyncio import Redis

from app import crud
from app.api import deps
from app.api.deps import get_redis_client
from app.core import security
from app.core.config import settings
from app.core.security import decode_token, get_password_hash, verify_password
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.schemas.response_schema import IPostResponseBase, create_response
from app.schemas.token_schema import RefreshToken, Token, TokenRead
from app.schemas.user_schema import PasswordResetRequest, PasswordResetConfirm
from app.utils.token import add_token_to_redis, delete_tokens, get_valid_tokens

router = APIRouter()


@router.post("")
async def login(
    email: EmailStr = Body(...),
    password: str = Body(...),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase[Token]:
    """
    Login for all users
    """
    # Check if user exists and get their current status
    user_record = await crud.user.get_by_email(email=email)

    if not user_record:
        # User doesn't exist, but don't reveal that information
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "field_name": "username",
                "message": "Username or password is incorrect",
            },
        )

    # Check for locked account before attempting authentication
    if (
        user_record.is_locked
        and user_record.locked_until
        and user_record.locked_until > datetime.utcnow()
    ):
        # Calculate remaining lock time
        remaining_time = user_record.locked_until - datetime.utcnow()
        remaining_hours = remaining_time.total_seconds() // 3600
        remaining_minutes = (remaining_time.total_seconds() % 3600) // 60

        lock_message = f"Account is locked due to multiple failed login attempts. "
        if remaining_hours > 0:
            lock_message += f"Try again in {int(remaining_hours)} hours and {int(remaining_minutes)} minutes."
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
        0
        if user_record.number_of_failed_attempts is None
        else user_record.number_of_failed_attempts
    )

    print(f"Current failed attempts for user {user_record.email}: {attempts_count}")

    if attempts_count == 2:
        warning_message = "Warning: This is your last attempt. If you enter an incorrect password again, your account will be locked for 24 hours."

    # Now attempt to authenticate
    user = await crud.user.authenticate(email=email, password=password)

    if not user:
        # Failed authentication attempt
        # Instead of just returning error, check if the account is now locked after this attempt
        # Pull the user data again to get the latest status after increment_failed_attempts was called
        updated_user = await crud.user.get_by_email(email=email)

        if updated_user.is_locked and updated_user.locked_until:
            # Account was just locked
            remaining_time = updated_user.locked_until - datetime.utcnow()
            remaining_hours = remaining_time.total_seconds() // 3600
            remaining_minutes = (remaining_time.total_seconds() % 3600) // 60

            lock_message = (
                f"Your account has been locked due to too many failed login attempts. "
            )
            if remaining_hours > 0:
                lock_message += f"Try again in {int(remaining_hours)} hours and {int(remaining_minutes)} minutes."
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
                message = f"{message}. Warning: This is your last attempt. Account will be locked after the next failed attempt."
            elif attempts_left > 0:
                message = f"{message}. {attempts_left} attempts remaining before account lockout."

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
    access_token = security.create_access_token(
        user.id, user.email, expires_delta=access_token_expires
    )
    refresh_token = security.create_refresh_token(
        user.id, expires_delta=refresh_token_expires
    )
    data = Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
        user=user,
    )

    # Handle token storage in Redis
    valid_access_tokens = await get_valid_tokens(
        redis_client, user.id, TokenType.ACCESS
    )
    if valid_access_tokens:
        await add_token_to_redis(
            redis_client,
            user,
            access_token,
            TokenType.ACCESS,
            settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        )
    valid_refresh_tokens = await get_valid_tokens(
        redis_client, user.id, TokenType.REFRESH
    )
    if valid_refresh_tokens:
        await add_token_to_redis(
            redis_client,
            user,
            refresh_token,
            TokenType.REFRESH,
            settings.REFRESH_TOKEN_EXPIRE_MINUTES,
        )

    # Create response with optional warning message
    message = "Login correctly"
    if warning_message:
        message = warning_message

    return create_response(data=data, message=message)


@router.post("/change_password")
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    current_user: User = Depends(deps.get_current_user()),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase[Token]:
    """
    Change password
    """
    if not verify_password(current_password, current_user.password):
        raise HTTPException(status_code=400, detail="Invalid Current Password")

    try:
        # This will check history, update password, and update last_changed_password_date
        await crud.user.update_password(user=current_user, new_password=new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate new tokens after password change
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        current_user.id, expires_delta=access_token_expires
    )
    refresh_token = security.create_refresh_token(
        current_user.id, expires_delta=refresh_token_expires
    )
    data = Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
        user=current_user,
    )

    # Invalidate old tokens
    await delete_tokens(redis_client, current_user, TokenType.ACCESS)
    await delete_tokens(redis_client, current_user, TokenType.REFRESH)

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

    return create_response(data=data, message="Password changed successfully")


@router.post("/new_access_token", status_code=201)
async def get_new_access_token(
    body: RefreshToken = Body(...),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase[TokenRead]:
    """
    Gets a new access token using the refresh token for future requests
    """
    try:
        payload = decode_token(body.refresh_token, token_type="refresh")
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "status": False,
                "message": "Your token has expired. Please log in again.",
            },
        )
    except DecodeError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "status": False,
                "message": "Error when decoding the token. Please check your request.",
            },
        )
    except MissingRequiredClaimError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "status": False,
                "message": "There is no required field in your token. Please contact the administrator.",
            },
        )

    if payload["type"] == "refresh":
        user_id = payload["sub"]
        valid_refresh_tokens = await get_valid_tokens(
            redis_client, user_id, TokenType.REFRESH
        )
        if valid_refresh_tokens and body.refresh_token not in valid_refresh_tokens:
            raise HTTPException(
                status_code=403,
                detail={"status": False, "message": "Refresh token invalid"},
            )

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        user = await crud.user.get(id=user_id)
        if user.is_active:
            access_token = security.create_access_token(
                payload["sub"], user.email, expires_delta=access_token_expires
            )
            valid_access_get_valid_tokens = await get_valid_tokens(
                redis_client, user.id, TokenType.ACCESS
            )
            if valid_access_get_valid_tokens:
                await add_token_to_redis(
                    redis_client,
                    user,
                    access_token,
                    TokenType.ACCESS,
                    settings.ACCESS_TOKEN_EXPIRE_MINUTES,
                )
            return create_response(
                data=TokenRead(access_token=access_token, token_type="bearer"),
                message="Access token generated correctly",
            )
        else:
            raise HTTPException(
                status_code=404, detail={"status": False, "message": "User inactive"}
            )
    else:
        raise HTTPException(
            status_code=404, detail={"status": False, "message": "Incorrect token"}
        )


@router.post("/access-token")
async def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    redis_client: Redis = Depends(get_redis_client),
) -> TokenRead:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    # Check if user exists and get their current status
    user_record = await crud.user.get_by_email(email=form_data.username)

    if not user_record:
        # User doesn't exist, but don't reveal that information
        raise HTTPException(
            status_code=400,
            detail={"field_name": "username", "message": "Incorrect email or password"},
        )

    # Check for locked account before attempting authentication
    if (
        user_record.is_locked
        and user_record.locked_until
        and user_record.locked_until > datetime.utcnow()
    ):
        # Calculate remaining lock time
        remaining_time = user_record.locked_until - datetime.utcnow()
        remaining_hours = remaining_time.total_seconds() // 3600
        remaining_minutes = (remaining_time.total_seconds() % 3600) // 60

        lock_message = f"Account is locked due to multiple failed login attempts. "
        if remaining_hours > 0:
            lock_message += f"Try again in {int(remaining_hours)} hours and {int(remaining_minutes)} minutes."
        else:
            lock_message += f"Try again in {int(remaining_minutes)} minutes."

        raise HTTPException(
            status_code=400,
            detail={"field_name": "username", "message": lock_message},
        )

    # Check if this is the user's last attempt before locking
    warning_message = None
    attempts_count = (
        0
        if user_record.number_of_failed_attempts is None
        else user_record.number_of_failed_attempts
    )

    print(
        f"Current OAuth2 failed attempts for user {user_record.email}: {attempts_count}"
    )

    if attempts_count == 2:
        warning_message = "Warning: This is your last attempt. If you enter an incorrect password again, your account will be locked for 24 hours."

    # Now attempt to authenticate
    user = await crud.user.authenticate(
        email=form_data.username, password=form_data.password
    )

    if not user:
        # Failed authentication attempt
        # Pull the user data again to get the latest status after increment_failed_attempts was called
        updated_user = await crud.user.get_by_email(email=form_data.username)

        if updated_user.is_locked and updated_user.locked_until:
            # Account was just locked
            remaining_time = updated_user.locked_until - datetime.utcnow()
            remaining_hours = remaining_time.total_seconds() // 3600
            remaining_minutes = (remaining_time.total_seconds() % 3600) // 60

            lock_message = (
                f"Your account has been locked due to too many failed login attempts. "
            )
            if remaining_hours > 0:
                lock_message += f"Try again in {int(remaining_hours)} hours and {int(remaining_minutes)} minutes."
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
                message = f"{message}. Warning: This is your last attempt. Account will be locked after the next failed attempt."
            elif attempts_left > 0:
                message = f"{message}. {attempts_left} attempts remaining before account lockout."

            raise HTTPException(
                status_code=400,
                detail={"field_name": "username", "message": message},
            )

    if not user.is_active:
        raise HTTPException(
            status_code=400,
            detail={"field_name": "username", "message": "Inactive user"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, user.email, expires_delta=access_token_expires
    )
    valid_access_tokens = await get_valid_tokens(
        redis_client, user.id, TokenType.ACCESS
    )
    if valid_access_tokens:
        await add_token_to_redis(
            redis_client,
            user,
            access_token,
            TokenType.ACCESS,
            settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        )

    token_read = TokenRead(access_token=access_token, token_type="bearer")

    # If there was a warning, we need to add it to the response
    # Since TokenRead doesn't have a message field, we'll add it to the token type field as a workaround
    # The client can parse this to extract both the token type and the warning message
    if warning_message:
        token_read.token_type = f"bearer|{warning_message}"

    return token_read


@router.post("/logout")
async def logout(
    current_user: User = Depends(deps.get_current_user()),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase:
    """
    Logout endpoint that invalidates the current user's tokens
    """
    # Invalidate both access and refresh tokens for the user
    await delete_tokens(redis_client, current_user, TokenType.ACCESS)
    await delete_tokens(redis_client, current_user, TokenType.REFRESH)

    return create_response(data={}, message="Successfully logged out")


@router.post("/password-reset/request")
async def request_password_reset(
    reset_request: PasswordResetRequest = Body(...),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase:
    """
    Request a password reset for a given email address.
    Sends a token that can be used to reset the password.
    """
    user = await crud.user.get_by_email(email=reset_request.email)
    if not user:
        # Don't reveal that the email doesn't exist, just return a success message
        return create_response(
            data={}, message="If the email exists, a password reset link has been sent"
        )

    if not user.is_active:
        # Don't reveal that the user is inactive
        return create_response(
            data={}, message="If the email exists, a password reset link has been sent"
        )

    # Generate a password reset token
    reset_token_expires = timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )
    reset_token = security.create_reset_token(
        user.id, expires_delta=reset_token_expires
    )

    # Store the reset token in Redis
    await add_token_to_redis(
        redis_client,
        user,
        reset_token,
        TokenType.RESET,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )

    # Construct reset password URL
    reset_url = f"{settings.PASSWORD_RESET_URL}?token={reset_token}"

    # Send the password reset email
    from app.utils.email.reset_password import send_reset_password_email

    await send_reset_password_email(
        email=user.email, token=reset_token, reset_url=reset_url
    )

    # In development mode, return the token for testing purposes
    # In production, only return a success message
    if settings.MODE == "development":
        return create_response(
            data={"reset_url": reset_url, "reset_token": reset_token},
            message="Password reset email sent. Check the MailHog interface at http://localhost:8025",
        )
    else:
        return create_response(
            data={},
            message="If the email exists, a password reset link has been sent",
        )


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    reset_confirm: PasswordResetConfirm = Body(...),
    redis_client: Redis = Depends(get_redis_client),
) -> IPostResponseBase:
    """
    Reset a user's password using a valid reset token
    """
    try:
        payload = decode_token(reset_confirm.token, token_type="reset")
    except (ExpiredSignatureError, DecodeError, MissingRequiredClaimError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token",
        )

    user_id = payload["sub"]
    user = await crud.user.get(id=user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token",
        )

    # Verify token in Redis
    valid_reset_tokens = await get_valid_tokens(redis_client, user_id, TokenType.RESET)
    if not valid_reset_tokens or reset_confirm.token not in valid_reset_tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token",
        )

    try:
        # This will check history, update password, and update last_changed_password_date
        await crud.user.update_password(
            user=user, new_password=reset_confirm.new_password
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Delete the used reset token
    await delete_tokens(redis_client, user, TokenType.RESET)

    # Invalidate all existing tokens for security
    await delete_tokens(redis_client, user, TokenType.ACCESS)
    await delete_tokens(redis_client, user, TokenType.REFRESH)

    return create_response(data={}, message="Password has been reset successfully")
