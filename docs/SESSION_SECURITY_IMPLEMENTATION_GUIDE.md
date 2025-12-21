# Session Security Implementation Guide

**Last Updated:** 2025-12-21  
**Version:** 1.0  
**Related Document:** [Session Management Security Analysis](SESSION_MANAGEMENT_SECURITY_ANALYSIS.md)

---

## Overview

This guide provides step-by-step instructions for implementing the high-priority security recommendations from the Session Management Security Analysis. Each recommendation includes:

- Detailed implementation steps
- Code examples
- Testing strategies
- Rollback procedures
- Security considerations

---

## Table of Contents

1. [Refresh Token Rotation](#1-refresh-token-rotation)
2. [HTTP-Only Cookies for Refresh Tokens](#2-http-only-cookies-for-refresh-tokens)
3. [Token Refresh Queue](#3-token-refresh-queue)
4. [Session Management Dashboard](#4-session-management-dashboard)
5. [Testing Guidelines](#testing-guidelines)
6. [Deployment Checklist](#deployment-checklist)

---

## 1. Refresh Token Rotation

### Overview

Refresh token rotation ensures that each time a refresh token is used to obtain a new access token, a new refresh token is also issued, and the old refresh token is invalidated.

**Security Benefits:**
- Limits the lifetime of any single refresh token
- Detects token theft (old token reuse)
- Reduces risk window if a refresh token is compromised

### Implementation Steps

#### Step 1: Update Backend Token Response Schema

**File:** `backend/app/schemas/token_schema.py`

```python
from pydantic import BaseModel
from app.schemas.user_schema import IUserRead

class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str | None = None  # ADD: Include refresh token in response
    
    model_config = {"from_attributes": True}

class Token(TokenRead):
    user: IUserRead
```

#### Step 2: Modify Refresh Token Endpoint

**File:** `backend/app/api/v1/endpoints/auth.py`

Find the `get_new_access_token` function and replace it with:

```python
@router.post("/new_access_token", status_code=201)
async def get_new_access_token(
    request: Request,
    body: RefreshToken = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
) -> IPostResponseBase[Token]:  # CHANGED: Return Token instead of TokenRead
    """
    Gets a new access token AND refresh token using the refresh token.
    Implements refresh token rotation for enhanced security.
    
    How it works:
    1. Validates the provided refresh token
    2. Checks if token is in the valid token set (not reused)
    3. If token was already used -> SECURITY BREACH -> invalidate all tokens
    4. Generates new access and refresh tokens
    5. Invalidates old refresh token
    6. Returns both new tokens
    """
    ip_address = request.client.host if request.client else "Unknown"
    payload = None
    
    try:
        # Decode and validate refresh token
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
        
        # Verify token type
        if payload["type"] != "refresh":
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
        
        user_id_from_token = payload["sub"]
        
        # SECURITY CHECK: Verify token is in valid set (not already used)
        valid_refresh_tokens = await get_valid_tokens(
            redis_client, user_id_from_token, TokenType.REFRESH
        )
        
        # Convert bytes to strings for comparison
        valid_tokens_str = {token.decode('utf-8') if isinstance(token, bytes) else token 
                           for token in valid_refresh_tokens} if valid_refresh_tokens else set()
        
        if valid_refresh_tokens and body.refresh_token not in valid_tokens_str:
            # SECURITY BREACH: Token reuse detected!
            # This could mean the token was stolen and already used
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="refresh_token_reuse_detected",
                details={
                    "user_id": user_id_from_token,
                    "ip_address": ip_address,
                    "severity": "HIGH",
                },
            )
            
            # Invalidate ALL tokens for this user (compromise assumed)
            try:
                user_uuid = UUID(user_id_from_token)
                await delete_tokens(redis_client, 
                                   User(id=user_uuid), 
                                   TokenType.ACCESS)
                await delete_tokens(redis_client, 
                                   User(id=user_uuid), 
                                   TokenType.REFRESH)
            except Exception as e:
                logger.error(f"Error invalidating tokens on reuse: {e}")
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "status": False,
                    "message": "Token reuse detected. All sessions have been invalidated. Please log in again.",
                },
            )
        
        # Get user from database
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
                detail={"status": False, "message": "Invalid user identifier in token"},
            )
        
        if not user or not user.is_active:
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
        
        # ROTATION: Generate NEW access and refresh tokens
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        
        new_access_token = security.create_access_token(
            str(user.id), user.email, expires_delta=access_token_expires
        )
        new_refresh_token = security.create_refresh_token(
            str(user.id), expires_delta=refresh_token_expires
        )
        
        # ROTATION: Invalidate old refresh token
        await delete_tokens(redis_client, user, TokenType.REFRESH)
        
        # Store new tokens in Redis
        await add_token_to_redis(
            redis_client,
            user,
            new_access_token,
            TokenType.ACCESS,
            settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        )
        await add_token_to_redis(
            redis_client,
            user,
            new_refresh_token,
            TokenType.REFRESH,
            settings.REFRESH_TOKEN_EXPIRE_MINUTES,
        )
        
        # Log successful token rotation
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="refresh_token_rotation_success",
            user_id=user.id,
            details={"email": user.email, "ip_address": ip_address},
        )
        
        # Serialize user data
        user_data = serialize_user(user)
        user_read = IUserRead(**user_data)
        
        # CHANGED: Return both access and refresh tokens
        return create_response(
            data=Token(
                access_token=new_access_token,
                token_type="bearer",
                refresh_token=new_refresh_token,  # NEW: Include rotated refresh token
                user=user_read,
            ),
            message="Tokens refreshed successfully",
        )
        
    except HTTPException:
        raise
    except Exception as e:
        error_type = type(e).__name__
        logger.error(
            f"Unexpected error in get_new_access_token from IP {ip_address}: {str(e)}",
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
```

#### Step 3: Update Frontend Token Refresh Handler

**File:** `react-frontend/src/services/api.ts`

Update the response interceptor to handle the new refresh token:

```typescript
// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponseData>) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };

    // ... existing error transformation code ...

    // Handle 401 (Unauthorized) - Token refresh flow
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (originalRequest) {
        originalRequest._retry = true;

        try {
          const refreshToken = getStoredRefreshToken();
          if (!refreshToken) {
            store.dispatch(logout());
            return Promise.reject(error);
          }

          const response = await store
            .dispatch(refreshAccessToken(refreshToken))
            .unwrap();
          
          if (response && response.access_token) {
            // Store new access token
            setStoredAccessToken(response.access_token);
            
            // NEW: Store rotated refresh token
            if (response.refresh_token) {
              setStoredRefreshToken(response.refresh_token);
            }
            
            if (originalRequest?.headers) {
              originalRequest.headers.Authorization = `Bearer ${response.access_token}`;
              return api(originalRequest);
            }
          }

          store.dispatch(logout());
          return Promise.reject(error);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          store.dispatch(logout());
          return Promise.reject(error);
        }
      }
    }

    // ... rest of error handling ...
  }
);
```

#### Step 4: Update Redux Auth Slice

**File:** `react-frontend/src/store/slices/authSlice.ts`

Update the `refreshAccessToken` fulfilled case:

```typescript
// Handle token refresh
.addCase(refreshAccessToken.fulfilled, (state, action) => {
  state.isLoading = false;
  state.isAuthenticated = true;
  state.accessToken = action.payload.access_token;
  
  // NEW: Update refresh token if rotated
  if (action.payload.refresh_token) {
    state.refreshToken = action.payload.refresh_token;
  }

  try {
    setStoredAccessToken(action.payload.access_token);
    
    // NEW: Store rotated refresh token
    if (action.payload.refresh_token) {
      setStoredRefreshToken(action.payload.refresh_token);
    }
    
    // Setup token expiry timer with new access token
    authTokenManager.setupTokenExpiryTimer(action.payload.access_token);
  } catch (error) {
    console.error('Error storing refreshed tokens:', error);
  }
})
```

#### Step 5: Add Configuration Settings

**File:** `backend/app/core/config.py`

Add the following settings:

```python
# Refresh Token Rotation Settings
ENABLE_REFRESH_TOKEN_ROTATION: bool = True
REFRESH_TOKEN_REUSE_GRACE_PERIOD: int = 5  # seconds - allows for network delays

# Token Blacklist Settings
TOKEN_BLACKLIST_ON_LOGOUT: bool = True
TOKEN_BLACKLIST_EXPIRY: int = 86400  # 24 hours
```

### Testing

#### Unit Tests

**File:** `backend/test/unit/test_token_rotation.py`

```python
import pytest
from datetime import timedelta
from app.core import security
from app.schemas.common_schema import TokenType

@pytest.mark.asyncio
async def test_refresh_token_rotation_success(client, test_user, redis_client):
    """Test successful token rotation"""
    # Login to get initial tokens
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "ValidPassword123!"}
    )
    assert login_response.status_code == 200
    initial_refresh = login_response.json()["data"]["refresh_token"]
    
    # Use refresh token
    refresh_response = await client.post(
        "/api/v1/auth/new_access_token",
        json={"refresh_token": initial_refresh}
    )
    assert refresh_response.status_code == 201
    data = refresh_response.json()["data"]
    
    # Verify new tokens are different
    assert data["refresh_token"] != initial_refresh
    assert data["access_token"] is not None
    
    # Verify old refresh token is invalidated
    old_token_response = await client.post(
        "/api/v1/auth/new_access_token",
        json={"refresh_token": initial_refresh}
    )
    assert old_token_response.status_code == 403
    assert "reuse" in old_token_response.json()["detail"]["message"].lower()

@pytest.mark.asyncio
async def test_refresh_token_reuse_detection(client, test_user, redis_client):
    """Test that token reuse is detected and all tokens invalidated"""
    # Login and get tokens
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "ValidPassword123!"}
    )
    initial_refresh = login_response.json()["data"]["refresh_token"]
    
    # Use token once (succeeds)
    first_refresh = await client.post(
        "/api/v1/auth/new_access_token",
        json={"refresh_token": initial_refresh}
    )
    assert first_refresh.status_code == 201
    
    # Try to use old token again (should fail and invalidate all)
    reuse_attempt = await client.post(
        "/api/v1/auth/new_access_token",
        json={"refresh_token": initial_refresh}
    )
    assert reuse_attempt.status_code == 403
    
    # Verify even the new refresh token is now invalid (all tokens revoked)
    new_refresh = first_refresh.json()["data"]["refresh_token"]
    third_attempt = await client.post(
        "/api/v1/auth/new_access_token",
        json={"refresh_token": new_refresh}
    )
    assert third_attempt.status_code == 403
```

#### Integration Tests

Test the full flow:
1. Login
2. Wait for access token to expire
3. Frontend automatically refreshes
4. Verify new tokens received
5. Verify old refresh token cannot be used

### Rollback Plan

If issues occur after deployment:

1. **Quick Rollback:**
   ```python
   # In app/core/config.py
   ENABLE_REFRESH_TOKEN_ROTATION: bool = False
   ```

2. **Full Rollback:**
   - Revert `auth.py` endpoint changes
   - Revert frontend `api.ts` changes
   - Restart services

### Security Considerations

1. **Grace Period:** Consider adding a small grace period (5 seconds) to handle network delays and clock skew.
2. **Token Reuse Detection:** When token reuse is detected, invalidate ALL user tokens (assume breach).
3. **Logging:** Log all token rotation events for audit trail.
4. **Monitoring:** Set up alerts for:
   - High rate of token reuse detection
   - Failed token refreshes
   - Token rotation errors

---

## 2. HTTP-Only Cookies for Refresh Tokens

### Overview

Move refresh tokens from localStorage to HTTP-only cookies for enhanced XSS protection.

**Security Benefits:**
- Immune to XSS attacks (JavaScript cannot access HTTP-only cookies)
- Automatic CSRF protection with SameSite attribute
- Industry best practice (OWASP recommended)

**Trade-offs:**
- Requires careful CORS configuration
- Slightly more complex for mobile apps
- Cookie size limitations (usually not an issue)

### Implementation Steps

#### Step 1: Update Backend Login Endpoint

**File:** `backend/app/api/v1/endpoints/auth.py`

Modify the `login` function:

```python
from fastapi import Response

@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,  # ADD: Response parameter
    email: EmailStr = Body(...),
    password: str = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    sanitizer: deps.InputSanitizer = Depends(get_strict_sanitizer),
    db_session: AsyncSession = Depends(deps.get_db),
    _: None = Depends(deps.validate_csrf_token),
) -> IPostResponseBase[Token]:
    # ... existing authentication logic ...
    
    # After generating tokens:
    access_token = security.create_access_token(
        authenticated_user.id,
        authenticated_user.email,
        expires_delta=access_token_expires,
    )
    refresh_token = security.create_refresh_token(
        authenticated_user.id, expires_delta=refresh_token_expires
    )
    
    # Store access token in Redis (as before)
    await add_token_to_redis(
        redis_client,
        authenticated_user,
        access_token,
        TokenType.ACCESS,
        settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    
    # NEW: Set refresh token in HTTP-only cookie instead of Redis
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,  # Cannot be accessed by JavaScript
        secure=settings.MODE == ModeEnum.production,  # HTTPS only in production
        samesite="lax",  # CSRF protection
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        path="/api/v1/auth",  # Restrict to auth endpoints only
        domain=settings.COOKIE_DOMAIN if hasattr(settings, 'COOKIE_DOMAIN') else None,
    )
    
    # Prepare user data
    user_data = serialize_user(authenticated_user)
    user_read = IUserRead(**user_data)
    
    # Return data WITHOUT refresh_token (it's in the cookie)
    data = Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=None,  # CHANGED: Don't return in response body
        user=user_read,
    )
    
    # ... rest of function ...
```

#### Step 2: Update Refresh Token Endpoint

**File:** `backend/app/api/v1/endpoints/auth.py`

Modify `get_new_access_token`:

```python
@router.post("/new_access_token", status_code=201)
async def get_new_access_token(
    request: Request,
    response: Response,  # ADD: Response parameter
    background_tasks: BackgroundTasks = BackgroundTasks(),
    redis_client: AsyncRedis = Depends(get_redis_client),
    db_session: AsyncSession = Depends(deps.get_db),
) -> IPostResponseBase[Token]:
    """
    Gets a new access token using the refresh token from HTTP-only cookie.
    Also rotates the refresh token for enhanced security.
    """
    ip_address = request.client.host if request.client else "Unknown"
    
    # NEW: Get refresh token from cookie instead of request body
    refresh_token = request.cookies.get("refresh_token")
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
    
    # ... existing validation logic ...
    
    # Generate new tokens
    new_access_token = security.create_access_token(
        str(user.id), user.email, expires_delta=access_token_expires
    )
    new_refresh_token = security.create_refresh_token(
        str(user.id), expires_delta=refresh_token_expires
    )
    
    # Store new access token
    await add_token_to_redis(
        redis_client,
        user,
        new_access_token,
        TokenType.ACCESS,
        settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    
    # NEW: Set new refresh token in cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.MODE == ModeEnum.production,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        path="/api/v1/auth",
    )
    
    # Return only access token (refresh token in cookie)
    user_data = serialize_user(user)
    user_read = IUserRead(**user_data)
    
    return create_response(
        data=Token(
            access_token=new_access_token,
            token_type="bearer",
            refresh_token=None,  # Not in response body
            user=user_read,
        ),
        message="Tokens refreshed successfully",
    )
```

#### Step 3: Update Logout Endpoint

**File:** `backend/app/api/v1/endpoints/auth.py`

```python
@router.post("/logout")
async def logout(
    request: Request,
    response: Response,  # ADD: Response parameter
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(deps.get_current_user()),
    redis_client: AsyncRedis = Depends(get_redis_client),
) -> IPostResponseBase:
    """
    Logout endpoint that invalidates tokens and clears cookie
    """
    ip_address = request.client.host if request.client else "Unknown"
    
    try:
        # Invalidate tokens in Redis
        await cleanup_expired_tokens(...)
        
        # NEW: Clear refresh token cookie
        response.delete_cookie(
            key="refresh_token",
            path="/api/v1/auth",
        )
        
        # Log logout event
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="user_logout",
            user_id=current_user.id,
            details={"email": current_user.email, "ip_address": ip_address},
        )
        
        return create_response(data={}, message="Successfully logged out")
        
    except Exception as e:
        # ... error handling ...
```

#### Step 4: Update Configuration

**File:** `backend/app/core/config.py`

```python
# Cookie Settings
COOKIE_DOMAIN: Optional[str] = None  # Set for production (e.g., ".yourdomain.com")
COOKIE_SECURE: bool = Field(default=True)  # HTTPS only
COOKIE_SAMESITE: str = "lax"  # "strict", "lax", or "none"
```

#### Step 5: Update Frontend

**File:** `react-frontend/src/lib/tokenStorage.ts`

```typescript
// Remove refresh token storage functions (no longer needed)
// Keep only access token functions

/**
 * Stores access token in memory (not in localStorage for security)
 */
export const setStoredAccessToken = (token: string): void => {
  try {
    inMemoryToken = token;
  } catch (error) {
    console.error('Failed to store access token:', error);
    inMemoryToken = null;
  }
};

export const getStoredAccessToken = (): string | null => {
  return inMemoryToken;
};

export const removeStoredAccessToken = (): void => {
  inMemoryToken = null;
};

// REMOVED: setStoredRefreshToken, getStoredRefreshToken, removeStoredRefreshToken
// Refresh tokens now in HTTP-only cookies

/**
 * Clear all authentication tokens
 */
export const clearAuthTokens = (): void => {
  removeStoredAccessToken();
  // Refresh token cleared by backend via cookie deletion
};
```

**File:** `react-frontend/src/services/api.ts`

```typescript
// Update to not send refresh token in body
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponseData>) => {
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (originalRequest) {
        originalRequest._retry = true;

        try {
          // Refresh token sent automatically via cookie - no need to get from storage
          const response = await store
            .dispatch(refreshAccessToken())  // No refresh token parameter needed
            .unwrap();
          
          if (response && response.access_token) {
            setStoredAccessToken(response.access_token);
            
            if (originalRequest?.headers) {
              originalRequest.headers.Authorization = `Bearer ${response.access_token}`;
              return api(originalRequest);
            }
          }

          store.dispatch(logout());
          return Promise.reject(error);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          store.dispatch(logout());
          return Promise.reject(error);
        }
      }
    }
    
    // ... rest of error handling ...
  }
);
```

**File:** `react-frontend/src/store/slices/authSlice.ts`

```typescript
// Update refreshAccessToken thunk
export const refreshAccessToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue, dispatch }) => {  // No refreshToken parameter needed
    try {
      // Refresh token sent automatically via HTTP-only cookie
      const response = await authService.refreshToken();
      return response;
    } catch (error) {
      dispatch(logout());
      // ... error handling ...
    }
  }
);

// Update loginUser fulfilled case
.addCase(loginUser.fulfilled, (state, action) => {
  state.isLoading = false;
  state.isAuthenticated = true;
  state.user = action.payload.user;
  state.accessToken = action.payload.access_token;
  // REMOVED: state.refreshToken (now in HTTP-only cookie)

  try {
    // Store only access token
    setStoredAccessToken(action.payload.access_token);
    // Refresh token stored in HTTP-only cookie by backend
    
    authTokenManager.setupTokenExpiryTimer(action.payload.access_token);
  } catch (error) {
    console.error('Error storing auth tokens:', error);
  }
})
```

### Testing

1. **Cookie Verification:**
   - Verify refresh token appears in browser cookies (HttpOnly flag set)
   - Verify cookie is not accessible via JavaScript

2. **Refresh Flow:**
   - Verify token refresh works without sending refresh token in body
   - Verify cookie is automatically sent with requests

3. **Cross-Origin:**
   - Test with frontend on different port/domain
   - Verify CORS settings allow credentials

4. **Security:**
   - Verify XSS cannot access refresh token
   - Verify CSRF protection via SameSite attribute

### Rollback Plan

1. Keep old localStorage implementation as fallback
2. Feature flag: `USE_COOKIE_REFRESH_TOKENS = False`
3. Graceful degradation if cookies fail

---

## 3. Token Refresh Queue

### Overview

Prevent race conditions when multiple simultaneous requests trigger token refresh.

**Implementation:**

**File:** `react-frontend/src/services/authTokenManager.ts`

```typescript
class AuthTokenManager {
  private tokenExpiryTimer: number | null = null;
  private refreshPromise: Promise<any> | null = null;  // NEW

  /**
   * Refresh access token with queue management
   */
  async refreshAccessToken(): Promise<string> {
    // If refresh already in progress, return existing promise
    if (this.refreshPromise) {
      console.log('Token refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    console.log('Starting new token refresh');
    
    // Start new refresh
    this.refreshPromise = store
      .dispatch(refreshAccessToken())
      .unwrap()
      .then((response) => {
        console.log('Token refresh successful');
        return response.access_token;
      })
      .catch((error) => {
        console.error('Token refresh failed:', error);
        throw error;
      })
      .finally(() => {
        console.log('Clearing refresh promise');
        this.refreshPromise = null;  // Reset after completion
      });

    return this.refreshPromise;
  }

  // ... rest of class ...
}
```

---

## Testing Guidelines

### Security Testing

1. **Token Rotation:**
   - ✅ Verify new refresh token issued on every refresh
   - ✅ Verify old refresh token cannot be reused
   - ✅ Verify token reuse detection invalidates all tokens
   - ✅ Verify proper logging of security events

2. **HTTP-Only Cookies:**
   - ✅ Verify refresh token not accessible via JavaScript
   - ✅ Verify cookie has HttpOnly, Secure, SameSite flags
   - ✅ Verify cookie automatically sent with requests
   - ✅ Verify XSS cannot steal refresh token

3. **Token Refresh Queue:**
   - ✅ Verify multiple simultaneous 401s trigger only one refresh
   - ✅ Verify all waiting requests succeed with new token
   - ✅ Verify no race conditions

### Performance Testing

1. Measure token refresh latency
2. Test concurrent refresh handling
3. Verify no excessive token generation

### Integration Testing

Test complete authentication flows:
1. Login → Use API → Access expires → Auto-refresh → Continue
2. Login → Logout → Verify cookies cleared
3. Login → Manual refresh → Verify rotation

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (unit, integration, security)
- [ ] Code review completed
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

### Configuration

- [ ] `ENABLE_REFRESH_TOKEN_ROTATION` set correctly
- [ ] Cookie domain configured for production
- [ ] CORS settings allow credentials
- [ ] Token expiry times configured appropriately

### Deployment Steps

1. **Deploy backend first** (backward compatible)
2. **Monitor for errors** (token refresh failures)
3. **Deploy frontend** (new token handling)
4. **Monitor authentication metrics**
5. **Verify no user complaints**

### Post-Deployment

- [ ] Monitor error rates (should not increase)
- [ ] Monitor security events (token reuse detection)
- [ ] Verify proper logging
- [ ] Check performance metrics
- [ ] User acceptance testing

### Rollback Triggers

Rollback if:
- Error rate > 5% for token operations
- User complaints > normal baseline
- Security events spike unexpectedly
- Performance degradation > 20%

---

## Conclusion

These implementations significantly enhance the security posture of the session management system while maintaining good user experience. Follow the steps carefully, test thoroughly, and monitor closely after deployment.

**Estimated Implementation Time:**
- Refresh Token Rotation: 4-6 hours
- HTTP-Only Cookies: 6-8 hours
- Token Refresh Queue: 2-3 hours
- Testing: 4-6 hours per feature
- **Total: 20-30 hours**

For questions or issues during implementation, refer to the [Session Management Security Analysis](SESSION_MANAGEMENT_SECURITY_ANALYSIS.md) document or consult with the security team.
