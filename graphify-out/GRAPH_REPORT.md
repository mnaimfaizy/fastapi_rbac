# Graph Report - fastapi_rbac  (2026-08-31)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3988 nodes · 9791 edges · 293 communities (150 shown, 93 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 718 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7ddf5bde`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205
- Community 206
- Community 207
- Community 208
- Community 209
- Community 210
- Community 211
- Community 212
- Community 213
- Community 214
- Community 215
- Community 216
- Community 217
- Community 218
- Community 219
- Community 220
- Community 221
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 228
- Community 229
- Community 230
- Community 231
- Community 232
- Community 233
- Community 234
- Community 235
- Community 236
- Community 237
- Community 239
- Community 240
- Community 241
- Community 242
- Community 243
- Community 244
- Community 245
- Community 246
- Community 247
- Community 248
- Community 249
- Community 250
- Community 251
- Community 252
- Community 253
- Community 254
- Community 255
- Community 256
- Community 257
- Community 258
- Community 259
- Community 260
- Community 262
- Community 263
- Community 277

## God Nodes (most connected - your core abstractions)
1. `User` - 162 edges
2. `cn()` - 134 edges
3. `random_lower_string()` - 103 edges
4. `get_csrf_token()` - 70 edges
5. `create_response()` - 63 edges
6. `Role` - 59 edges
7. `AsyncUserFactory` - 55 edges
8. `random_email()` - 51 edges
9. `TokenType` - 42 edges
10. `Permission` - 41 edges

## Surprising Connections (you probably didn't know these)
- `get_permission_groups()` --uses--> `IPermissionGroupReadWithPermissions`  [INFERRED]
  backend/app/api/v1/endpoints/permission_group.py → backend/app/schemas/permission_group_schema.py
- `update_permission_group()` --uses--> `IPutResponseBase`  [INFERRED]
  backend/app/api/v1/endpoints/permission_group.py → backend/app/schemas/response_schema.py
- `update_role_group()` --uses--> `IPutResponseBase`  [INFERRED]
  backend/app/api/v1/endpoints/role_group.py → backend/app/schemas/response_schema.py
- `IRoleGroupWithRoles` --uses--> `IRoleRead`  [INFERRED]
  backend/app/schemas/role_group_schema.py → backend/app/schemas/role_schema.py
- `IRoleRead` --uses--> `IPermissionRead`  [INFERRED]
  backend/app/schemas/role_schema.py → backend/app/schemas/permission_schema.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (293 total, 93 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (99): This module contains the dependency injection utilities used across the FastAPI…, assign_permissions_to_role(), create_role(), delete_role(), get_all_roles_list(), get_role_by_id(), get_roles(), AsyncSession (+91 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (75): get_active_sessions_count(), get_active_users_count(), get_recent_logins(), get_system_users_summary(), get_total_permissions_count(), get_total_roles_count(), get_total_users_count(), AsyncSession (+67 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (96): get_current_user(), Any, User, IGenderEnum, IOrderEnum, IUserMessage, BaseModel, Enum (+88 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (94): PermissionGroupData, IPermissionGroupCreate, IPermissionGroupUpdate, IPermissionCreate, IRoleCreate, asyncio, AsyncSession, Test deleting a permission group (+86 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (63): DataTableProps, DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel() (+55 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (52): CRUDRole, Any, AsyncSession, Page, Params, Permission, Redis, Role (+44 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (56): InitAuth(), LoginForm(), SignupForm(), AppWrapper(), AppWrapperProps, LoadingScreen(), LoadingScreenProps, Meta() (+48 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (64): AsyncRedis, get_input_sanitizer(), get_strict_sanitizer(), Get input sanitizer instance for dependency injection. Args: strict_mode:…, Get strict input sanitizer for sensitive operations. Returns: InputSanitizer:…, change_password(), confirm_password_reset(), ensure_utc() (+56 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (39): ApiErrorAlert(), ApiErrorAlertProps, LoginFormData, loginSchema, PasswordRequirements(), PasswordRequirementsProps, SignupFormData, signupSchema (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (43): r"""UUID draft version objects (universally unique identifiers). This module…, r"""UUID version 7 features a time-ordered value field derived from the widely…, r"""UUID version 6 is a field-compatible version of UUIDv1, reordered for…, _subsec_decode(), _subsec_encode(), uuid6(), uuid7(), AsyncClient (+35 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (59): AST, create_limiter(), _is_testing(), Shared slowapi HTTP rate limiter for the FastAPI app. HTTP rate limits use this…, Memory in testing; Redis (service_settings.redis_url) otherwise., _storage_uri(), password_reuse_window(), How many stored passwords the reuse policy refuses. ``PASSWORD_HISTORY_SIZE``… (+51 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (46): AlertDialogOverlay(), CardAction(), Checkbox(), Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem() (+38 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (31): get_db(), AsyncSession, Get database session for dependency injection. Uses AsyncSession to ensure all…, app(), client(), AsyncClient, AsyncSession, FastAPI (+23 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (54): account_email_budget_key(), AccountState, classify(), Enum, str, What an email address currently corresponds to. ``DISABLED`` is checked before…, Map a user row (or its absence) onto the four states., Redis key for the shared per-address mail budget. (+46 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (48): Mapping table between roles and role groups. This model handles the many-to-…, RoleGroupMap, RoleGroup, IRoleGroupCreate, asyncio, AsyncSession, fixture, User (+40 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (36): do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, Run migrations in 'online' mode. In this scenario we need to create an Engine…, run_migrations_offline(), run_migrations_online(), get_settings_dependency(), get_settings(), Any (+28 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (45): assign_roles_to_user(), bulk_update_users(), create_user(), get_my_data(), get_user_by_id(), get_user_list_order_by_created_at(), Any, AsyncSession (+37 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (38): FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue (+30 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (29): AsyncClient, asyncio, AsyncSession, patch, Test login endpoint structure when registration fails., Test the password reset functionality, ensuring users can securely reset their…, Test security features of authentication., Helper to register a user with CSRF token. (+21 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (40): ProtectedRoute(), ProtectedRouteProps, DataTable(), DataTableColumn, OverviewChart(), StatsCard(), Avatar(), AvatarFallback() (+32 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (25): CRUDUser, Any, AsyncSession, EmailStr, User, Create a user. Requires db_session to be provided explicitly., Update a user. Requires db_session to be provided explicitly., Update is_active for a list of users. Requires db_session to be provided… (+17 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (38): cmd_config(), cmd_down(), cmd_env(), cmd_exec(), cmd_health(), cmd_logs(), cmd_pull(), cmd_restart() (+30 more)

### Community 22 - "Community 22"
Cohesion: 0.09
Nodes (26): Meta, SQLAlchemyModelFactory, Factory for creating User model instances., Start sequence from a random point to avoid conflicts., UserFactory, asyncio, AsyncSession, Test user retrieval with non-existent email. (+18 more)

### Community 23 - "Community 23"
Cohesion: 0.07
Nodes (11): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (37): add_roles_to_group(), bulk_create_role_groups(), bulk_delete_role_groups(), clone_role_group(), create_role_group(), delete_role_group(), get_role_group_by_id(), get_role_groups() (+29 more)

### Community 25 - "Community 25"
Cohesion: 0.09
Nodes (37): add_token_claims(), create_access_token(), create_refresh_token(), create_reset_token(), create_verification_token(), decode_token(), get_content(), get_data_encrypt() (+29 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (38): IUserCreate, IUserUpdate, Test adding a role to a user, Test adding a non-existent role to a user raises ValueError, Test checking if users exist in a role, Test invalidating user permission caches in Redis, test_add_role_to_user(), test_add_role_to_user_not_found() (+30 more)

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (38): header_text(), MonkeyPatch, parametrize, ``send_email`` against the real ``emails`` API, stubbed only at the socket. The…, Cut the wire at ``get_client``, the last step before a connection., Call the real ``send_email`` with a plausible verification message., Guards the override above. If the suite-wide patch leaked back in, nothing…, ``JinjaTemplate`` really substitutes. A subject arriving as the literal ``{{… (+30 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (34): Skeleton(), NestedRoleGroupProps, RoleGroupDetail(), RoleGroupFormContent(), RoleGroupList(), RoleForm(), RoleFormData, RoleFormContent() (+26 more)

### Community 29 - "Community 29"
Cohesion: 0.09
Nodes (24): NestedPermissionGroupProps, PermissionGroupRowProps, PaginatedData, PaginatedPermissionGroupResponse, PaginatedPermissionResponse, Permission, PermissionCreate, PermissionGroup (+16 more)

### Community 30 - "Community 30"
Cohesion: 0.09
Nodes (24): after_insert_role(), after_update_role(), AsyncClient, asyncio, AsyncSession, Test error handling functionality., Test that 404 errors are handled properly., Test that invalid JSON is handled properly. (+16 more)

### Community 31 - "Community 31"
Cohesion: 0.09
Nodes (24): _CRLFMessageProxy, _CRLFSMTPBackend, Any, Wraps a built MIME message so ``as_bytes()`` returns CRLF line endings. SMTP…, Delegates to a pooled emails SMTP backend, forcing CRLF on the way out.…, built_message(), Any, parametrize (+16 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (19): Create and configure SSL context for Redis connections. Retained for…, fixture, patch, Test connection parameters for production mode with SSL., Test connection pool creation without TLS uses Connection., TLS pools must use SSLConnection (not Connection + ssl=True)., Test that connection pool is a singleton., Celery asyncio.run per task must not reuse a pool from a closed loop. (+11 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (27): PasswordValidator, Password validation helper class., Validate password complexity according to settings. Returns a tuple of…, Check if password contains sequential characters., Check if password has too many repeated characters., _app_package(), auth_url(), csrf_headers() (+19 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (29): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), Exception, JSONResponse, Request, Response (+21 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (28): Redis, Delete pending users past the verification window. Safe to run concurrently…, sweep_unverified_users(), AsyncUserFactory, Async factory for creating User model instances., Generate a unique fake email., Generate a fake name., _exists() (+20 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (29): Factory for creating Role model instances., RoleFactory, auth_headers(), db_factories(), HeadersCallable, make_admin_user(), make_audit_log(), make_permission() (+21 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (28): AsyncTestDataBuilder, Helper class to build complex test data scenarios., Create a basic RBAC setup with users, roles, and permissions., admin_user(), basic_rbac_setup(), locked_user(), permission_factory(), permission_group_factory() (+20 more)

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (25): DBType, Any, Enum, str, Test configuration settings for managing the test environment. This allows for…, Test TestConfig.get_db_uri for SQLite, Test TestConfig.get_db_uri for PostgreSQL, Test TestConfig.get_connection_args method (+17 more)

### Community 39 - "Community 39"
Cohesion: 0.07
Nodes (29): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+21 more)

### Community 40 - "Community 40"
Cohesion: 0.17
Nodes (18): AsyncClient, asyncio, AsyncSession, Test dashboard role analytics endpoints., Test dashboard activity metrics endpoints., Test dashboard system health endpoints., Integration tests for dashboard endpoints., Test dashboard recent activities endpoint. (+10 more)

### Community 41 - "Community 41"
Cohesion: 0.10
Nodes (24): _log_security_event_task(), process_account_lockout(), _process_account_lockout_task(), AsyncSession, User, Background tasks module for FastAPI RBAC system. This module provides utility…, The actual task that logs a security event to the audit log., Process account lockout in the background. Args: background_tasks:… (+16 more)

### Community 42 - "Community 42"
Cohesion: 0.11
Nodes (18): close_redis_pool(), Enhanced Redis connection management with SSL support for production. This…, Create a connection pool for Redis. Args: db: Redis database number…, Drop the cached pool without awaiting disconnect. Used when the owning asyncio…, Get or create a singleton connection pool. Args: db: Redis database number…, Close the connection pool and cleanup resources., Close the Redis connection pool., Factory class for creating and managing Redis connections with SSL support.… (+10 more)

### Community 43 - "Community 43"
Cohesion: 0.11
Nodes (21): BaseFactory, Meta, PermissionFactory, PermissionGroupFactory, Any, lazy_attribute, Permission, PermissionGroup (+13 more)

### Community 44 - "Community 44"
Cohesion: 0.19
Nodes (18): generate_strong_password(), login_user(), promote_user_to_admin(), Any, AsyncClient, asyncio, User management integration tests. Tests the complete user management flow…, Generate a strong password that avoids sequential characters and meets… (+10 more)

### Community 45 - "Community 45"
Cohesion: 0.16
Nodes (25): auth_url(), fetch_csrf_token(), is_csrf_rejection(), AsyncClient, parametrize, Unit tests for CSRF protection on state-changing auth endpoints (#164). These…, A matching cookie and header pass CSRF validation. The request may still fail…, The cookie alone is not sufficient; the header must accompany it. This is the… (+17 more)

### Community 46 - "Community 46"
Cohesion: 0.16
Nodes (13): CRUDBase, Any, AsyncSession, ModelType, Page, Params, CRUD object with default methods to Create, Read, Update, Delete (CRUD).…, Get multiple records by their IDs. (+5 more)

### Community 47 - "Community 47"
Cohesion: 0.11
Nodes (24): background_tasks_mock(), celery_mock(), celery_task_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), http_client_mock(), oauth_provider_mock() (+16 more)

### Community 48 - "Community 48"
Cohesion: 0.10
Nodes (12): MockCeleryResult, MockCeleryTask, Any, Celery service mocks for testing., Mock Celery task for testing., Mock task.delay() method., Mock task.apply_async() method., Clear the task call history. (+4 more)

### Community 49 - "Community 49"
Cohesion: 0.14
Nodes (24): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), Comprehensive test runner for the refactored test suite. This script provides…, Run all tests (unit + integration) in Docker Compose for correct environment… (+16 more)

### Community 50 - "Community 50"
Cohesion: 0.15
Nodes (14): AuthState, ErrorResponse, ErrorResponseWithErrors, LoginCredentials, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, Token (+6 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (23): html_to_plain_text(), Best-effort plain-text rendering of an HTML email body., Render a Jinja template from the email templates directory with the given…, render_template(), parametrize, Every outgoing email carries a readable plain-text part. Messages were sent as…, The whole point: a reader can see and copy the URL., A labelled link shows both the label and where it goes. (+15 more)

### Community 52 - "Community 52"
Cohesion: 0.13
Nodes (21): Any, Input sanitization utilities for XSS prevention and data cleaning. This module…, Sanitize email address input. Args: email: The email address to sanitize…, Sanitize search query input to prevent injection attacks. Args: query: The…, Recursively sanitize string values in a dictionary/JSON object. Args: data:…, Sanitize URL input to prevent XSS and injection attacks. Args: url: The URL to…, Sanitize input value based on field type. Args: value: The value to sanitize…, Sanitize all string values in a dictionary. Args: data: Dictionary to sanitize… (+13 more)

### Community 53 - "Community 53"
Cohesion: 0.17
Nodes (23): AsyncClient, asyncio, Integration tests for Redis JWT allowlist enforcement (#73) and HttpOnly…, After logout, a previously issued refresh token must be rejected., Refresh via HttpOnly cookie + CSRF must return a new access token., JSON login must always write both access and refresh tokens into Redis., A cryptographically valid refresh JWT must fail when Redis set is empty., Cookie-authenticated refresh must reject requests without CSRF. (+15 more)

### Community 54 - "Community 54"
Cohesion: 0.12
Nodes (16): App(), createTestStoreForRoleList(), ExtendedRenderOptions, renderRoleListWithMockedDispatch(), AppStore, createTestStore(), ExtendedRenderOptions, mockPermissions (+8 more)

### Community 55 - "Community 55"
Cohesion: 0.16
Nodes (15): UserEditForm(), ApiResponse, PaginatedItems, User, ApiError, UserCreatePayload, UserService, UserUpdatePayload (+7 more)

### Community 56 - "Community 56"
Cohesion: 0.17
Nodes (18): PaginatedDataResponse, PaginatedResponse, PaginationParams, Role, RoleCreate, RolePermissionAssign, RolePermissionUnassign, RoleResponse (+10 more)

### Community 57 - "Community 57"
Cohesion: 0.15
Nodes (21): consume_account_email_budget(), _create_pending_user(), dispatch_account_email(), DispatchResult, _issue_verification(), AsyncSession, BackgroundTasks, Redis (+13 more)

### Community 58 - "Community 58"
Cohesion: 0.16
Nodes (20): clear_refresh_token_cookie(), Any, Response, HttpOnly refresh-token cookie helpers for first-party SPA auth., Path-scope refresh cookies to auth routes only., Secure cookies in production; allow plain HTTP on localhost/dev/test., Set the HttpOnly refresh token cookie. Never log the token value., Clear the refresh token cookie using the same attributes used when setting it. (+12 more)

### Community 59 - "Community 59"
Cohesion: 0.20
Nodes (13): AsyncClient, asyncio, AsyncSession, Permission management integration tests. Tests the complete permission…, Test complete CRUD operations for permission groups., Test operations on permission groups that contain permissions., Integration tests for permission management flows., Test permission listing and pagination. (+5 more)

### Community 60 - "Community 60"
Cohesion: 0.11
Nodes (17): Centralized Celery configuration for the FastAPI RBAC system. This module…, Scheduled tasks configuration for Celery Beat. This module defines recurring…, custom_swagger_ui_html(), get_csrf_config(), lifespan(), BaseHTTPMiddleware, FastAPI, get (+9 more)

### Community 61 - "Community 61"
Cohesion: 0.17
Nodes (12): AsyncFactoryBase, AsyncPermissionFactory, AsyncPermissionGroupFactory, AsyncRoleFactory, AsyncRoleGroupFactory, AsyncSession, Async factory for creating Role model instances., Generate a unique fake role name. (+4 more)

### Community 62 - "Community 62"
Cohesion: 0.16
Nodes (12): RoleGroupCreate, RoleGroupResponse, RoleGroupUpdate, RoleGroupWithRolesResponse, UserBasic, api, ErrorResponseData, PasswordComplexityDetail (+4 more)

### Community 63 - "Community 63"
Cohesion: 0.13
Nodes (11): AsyncSession, Permission, Check if a permission with the given name already exists. Args: name: The name…, Create multiple permissions in a single database transaction. Args:…, Get a permission by its name. Args: name: The name of the permission to…, Remove multiple permissions from a role in a batch operation. Args: role_id:…, Check if a permission is currently assigned to any role. Args: permission_id:…, Alias for get_permission_by_name. (+3 more)

### Community 64 - "Community 64"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 65 - "Community 65"
Cohesion: 0.16
Nodes (16): AsyncEngine, get_or_create_superuser(), init_db(), AsyncSession, format_permission_name(), Formats a permission name by combining the permission group name and permission…, db(), db_engine() (+8 more)

### Community 66 - "Community 66"
Cohesion: 0.23
Nodes (17): get_dashboard_data(), get_dashboard_stats(), get, Session, User, Retrieve dashboard stats (alias for /dashboard or /dashboard/stats)., Retrieve dashboard data. Data returned will vary based on the user's role., DashboardData (+9 more)

### Community 67 - "Community 67"
Cohesion: 0.37
Nodes (11): login_user(), promote_user_to_admin(), Any, AsyncClient, asyncio, Role management integration tests. Tests the complete role management flow…, Integration tests for role management flows (API-driven)., Assign the admin role to a user using the seeded admin account, with retry for… (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.15
Nodes (18): create_permission_group(), delete_permission_group(), get_permission_group_by_id(), get_permission_groups(), AsyncSession, delete, get, Params (+10 more)

### Community 69 - "Community 69"
Cohesion: 0.11
Nodes (10): Any, Service configuration for environment-specific settings. Manages Redis, Celery,…, Get database URL based on environment, Environment-specific service settings for Celery, Redis, and other external…, Get the Redis URL based on current environment. For production, uses rediss://…, Get the Celery broker URL based on current environment, Get the Celery result backend URL based on current environment, Determine whether to use Celery based on environment (+2 more)

### Community 70 - "Community 70"
Cohesion: 0.13
Nodes (15): get_async_session(), get_redis_client(), Any, AsyncSession, Redis, Create and get async database session. This function yields an AsyncSession for…, Get Redis client instance as an async generator. Yields a Redis client…, create_init_data() (+7 more)

### Community 71 - "Community 71"
Cohesion: 0.12
Nodes (18): @eslint/js, eslint-plugin-react-hooks, devDependencies, @eslint/js, eslint-plugin-react-hooks, @testing-library/dom, @testing-library/jest-dom, @testing-library/user-event (+10 more)

### Community 72 - "Community 72"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 73 - "Community 73"
Cohesion: 0.14
Nodes (14): dependency_overrider(), DependencyOverrider, mock_dependency(), Any, FastAPI, fixture, T, Create a dependency that returns mock data. Usage: ```… (+6 more)

### Community 74 - "Community 74"
Cohesion: 0.16
Nodes (9): MockEmailService, Any, Email service mocks for testing., Mock implementation of email service for testing., Mock verification email sending., Mock password reset email sending., Clear the sent emails list., Get the last sent email. (+1 more)

### Community 75 - "Community 75"
Cohesion: 0.19
Nodes (9): FakeDistribution, Stand-in for ``importlib.metadata.PathDistribution``. ``metadata``/``version``…, ``~``-prefixed dist-info dirs are pip's aborted-upgrade debris. Their…, ``foo-1.0-py3.10.egg-info`` splits naively as name ``foo-1.0``. That would hide…, Canary for the private ``_path`` attribute this module reads. If a stdlib…, TestInstalledVersions, installed_versions(), Any (+1 more)

### Community 76 - "Community 76"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 77 - "Community 77"
Cohesion: 0.26
Nodes (15): assert_main_clean(), build_docker_images(), build_release_notes_entry(), clear_changelog_artifact(), create_git_tag(), generate_changelog(), get_latest_git_tag(), invoke_direct_tag_mode() (+7 more)

### Community 78 - "Community 78"
Cohesion: 0.15
Nodes (8): MockOAuthProvider, Any, Mock user info retrieval., Set user info for a token., Add authorization code., Get requests, optionally filtered by method or URL., Mock OAuth provider for testing OAuth flows., Generate mock authorization URL.

### Community 79 - "Community 79"
Cohesion: 0.19
Nodes (16): asyncio, AsyncSession, fixture, Permission, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group (+8 more)

### Community 80 - "Community 80"
Cohesion: 0.17
Nodes (15): create_permission(), delete_permission(), get_permission_by_id(), get_permissions(), AsyncSession, delete, get, Params (+7 more)

### Community 81 - "Community 81"
Cohesion: 0.22
Nodes (14): IUserLoginSchema, IUserOutput, IUserOutputPaginated, IUserOutputPaginatedSchema, IUserRoleAssign, IUserStatus, IVerifyEmail, PasswordResetRequest (+6 more)

### Community 82 - "Community 82"
Cohesion: 0.23
Nodes (9): Send an email using the emails library, which supports both development and…, Render a template and send it as an email., send_email(), send_email_with_template(), Send a password reset email to a user. Args: email: The recipient's email…, send_reset_password_email(), check_send_reset_password_email(), Send one password-reset email and report whether the call went through. (+1 more)

### Community 83 - "Community 83"
Cohesion: 0.16
Nodes (10): get_redis_client(), Redis, retry, Get a Redis client using the connection pool. Args: db: Redis database number…, Perform a health check on Redis connection. Args: client: Optional Redis client…, Get a Redis client instance. Args: db: Redis database number (default: 0)…, asyncio, Test successful health check. (+2 more)

### Community 84 - "Community 84"
Cohesion: 0.16
Nodes (8): MockHTTPClient, MockHTTPResponse, External API mocks for testing., Mock HTTP response for testing., Raise exception for bad status codes., Mock HTTP client for testing external API calls., Set a specific response for method and URL., Clear request history.

### Community 85 - "Community 85"
Cohesion: 0.13
Nodes (8): Any, Stands in for the socket and nothing above it. ``SMTPBackend.sendmail`` still…, One message as it would have been handed to the socket., Decoded body of the first part with this content type., RecordingSMTPClient, SentMessage, MIMEMessage, SMTPBackend

### Community 86 - "Community 86"
Cohesion: 0.24
Nodes (10): Assert-MainClean(), Build-DockerImages(), Get-ReleaseNotesEntry(), Invoke-DirectTagMode(), Invoke-ReleasePrMode(), New-Changelog(), New-GitTag(), Confirm-Continue() (+2 more)

### Community 87 - "Community 87"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 88 - "Community 88"
Cohesion: 0.21
Nodes (12): get_cached_celery_config(), get_celery_config(), Any, Celery configuration module for the FastAPI RBAC project. This module provides…, Get cached Celery configuration. Uses lru_cache to cache the configuration and…, Get Celery configuration dictionary with all necessary settings. Returns:…, DatabaseTypeEnum, get_project_root() (+4 more)

### Community 89 - "Community 89"
Cohesion: 0.25
Nodes (11): AuditLog, AuditLogBase, Model for storing security audit logs, asyncio, AsyncSession, Test creating an audit log entry in the database, Test retrieving audit log entries for a specific actor, Test filtering audit logs by action type (+3 more)

### Community 90 - "Community 90"
Cohesion: 0.22
Nodes (7): Globals, Any, Get the value of a variable., Clear all variables and free memory., Set a default value for a variable., Get the default value for a variable., Ensure a ContextVar exists for a variable.

### Community 91 - "Community 91"
Cohesion: 0.24
Nodes (13): check_csrf_token_generation(), check_endpoint_with_csrf(), check_endpoint_with_invalid_csrf(), check_endpoint_without_csrf(), get_test_data(), main(), Any, Session (+5 more)

### Community 92 - "Community 92"
Cohesion: 0.18
Nodes (9): Any, post_generation, Role, User, Add roles to the user if provided., Create a superuser/admin., Create a locked user., Create a user that needs to change password. (+1 more)

### Community 93 - "Community 93"
Cohesion: 0.14
Nodes (13): Ensure Celery workers register task modules from app.worker., Worker boot via app.celery_app must register security/email tasks., conf.imports keeps task registration for celery -A app.celery_app., The sweep that replaced the in-process sleep must be a real task (#136)., Beat drives the sweep; without an entry, pending users accumulate forever., Every scheduled name must resolve to a task some worker can run. Beat does not…, `celery -A app.celery_app beat` must see the schedule on a cold import.…, test_beat_entrypoint_alone_carries_the_schedule() (+5 more)

### Community 94 - "Community 94"
Cohesion: 0.16
Nodes (10): COMMON_PASSWORDS, isPasswordPolicyCompliant(), PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_SPECIAL_CHARS, passwordPolicyIssues(), PasswordRule, SEQUENCES (+2 more)

### Community 95 - "Community 95"
Cohesion: 0.24
Nodes (10): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, dashboardSlice, DashboardState (+2 more)

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 97 - "Community 97"
Cohesion: 0.24
Nodes (12): delete_if_still_pending(), _pending_past_window(), Any, AsyncSession, datetime, Restart-safe cleanup of pending user accounts (#136). Registration used to…, The one definition of "pending, and past the verification window". Both the…, The ``created_at`` before which a pending user is due for deletion. Returned… (+4 more)

### Community 98 - "Community 98"
Cohesion: 0.24
Nodes (13): asyncio, AsyncSession, fixture, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group, Test creating a permission group in the database (+5 more)

### Community 99 - "Community 99"
Cohesion: 0.32
Nodes (5): TestFormatReport, Drift, format_report(), Render the drift report: the count, the worst offenders, and the fix., One pinned package whose installed version does not match the pin.

### Community 100 - "Community 100"
Cohesion: 0.35
Nodes (6): CRUDPermissionGroup, Any, AsyncSession, Params, PermissionGroup, Get a permission group by name.

### Community 101 - "Community 101"
Cohesion: 0.18
Nodes (9): AuditLogFactory, Meta, Any, lazy_attribute, SQLAlchemyModelFactory, Factory for creating AuditLog model instances., Generate a JSON-compatible details dictionary., Create an audit log entry for a specific user. (+1 more)

### Community 102 - "Community 102"
Cohesion: 0.24
Nodes (8): Any, timedelta, Generate an expired token for testing expiration handling. Args: user_id: User…, Factory for generating JWT tokens for testing., Generate a test access token. Args: user_id: User ID to include in the token…, Generate a test refresh token. Args: user_id: User ID to include in the token…, Generate authentication headers for testing. Args: access_token: Optional pre-…, TokenFactory

### Community 103 - "Community 103"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 104 - "Community 104"
Cohesion: 0.20
Nodes (9): ASGIApp, globals_middleware_dispatch(), GlobalsMiddleware, BaseHTTPMiddleware, Request, Response, This allows to use global variables inside the FastAPI application using async…, Dispatch the request in a new context to allow globals to be used. (+1 more)

### Community 105 - "Community 105"
Cohesion: 0.20
Nodes (6): Any, Build Redis connection parameters based on environment. Args: db: Redis…, Return whether Redis TLS should be used for the given mode., Resolve the directory that holds Redis TLS materials., Build kwargs for redis.asyncio.SSLConnection. redis-py asyncio does not accept…, Test connection parameters for development mode.

### Community 106 - "Community 106"
Cohesion: 0.25
Nodes (7): MonkeyPatch, Tests for the virtualenv drift guard that runs at test-session start. See…, The guard is only credible if it passes on a correctly built venv., TestFailOnDrift, fail_on_drift(), Abort the test session when the virtualenv has drifted from the pins. The root…, TextIO

### Community 107 - "Community 107"
Cohesion: 0.33
Nodes (5): Path, TestCheckForDrift, check_for_drift(), Path, Return a drift report, or ``None`` when the environment is fine or opted out.

### Community 108 - "Community 108"
Cohesion: 0.29
Nodes (4): parametrize, TestParsePins, parse_pins(), Map canonical package name -> exactly pinned version. Only ``name==version``…

### Community 109 - "Community 109"
Cohesion: 0.20
Nodes (9): AbstractParams, Any, T, make_page(), Build a page exactly as paginate() does, via the same classmethod., The rows are at .data.items; this is the contract endpoints must use., Reading .items raises -- the exact failure seen in the running app., test_paginated_response_has_no_top_level_items() (+1 more)

### Community 110 - "Community 110"
Cohesion: 0.20
Nodes (8): comprehensive_mocks(), Provide comprehensive mocks for integration testing., Provide all service mocks in a single fixture., service_mocks(), MockCeleryApp, Clear all task call history., Mock Celery application for testing., Get task calls, optionally filtered by task name.

### Community 111 - "Community 111"
Cohesion: 0.36
Nodes (9): asyncio, AsyncSession, Test creating an entity with BaseUUIDModel as base class, Test updating an entity with BaseUUIDModel as base class, Test that UUIDs are unique for each instance, SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update() (+1 more)

### Community 112 - "Community 112"
Cohesion: 0.33
Nodes (3): TestFindDrift, find_drift(), Return the pinned packages the environment does not satisfy, worst first.…

### Community 113 - "Community 113"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 114 - "Community 114"
Cohesion: 0.31
Nodes (8): clearAuthSessionHint(), clearAuthTokens(), clearLegacyRefreshTokenStorage(), getStoredAccessToken(), removeStoredAccessToken(), setAuthSessionHint(), setStoredAccessToken(), authSlice

### Community 115 - "Community 115"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 116 - "Community 116"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 117 - "Community 117"
Cohesion: 0.22
Nodes (9): autoprefixer, clsx, dependencies, autoprefixer, clsx, @reduxjs/toolkit, tailwindcss, @reduxjs/toolkit (+1 more)

### Community 118 - "Community 118"
Cohesion: 0.39
Nodes (8): BackgroundTasks, Single owner of "this token-bearing request failed, and why is nobody's…, Record why the reset failed, then answer as if nothing was learned., Record why verification failed, then answer as if nothing was learned., _reject(), reject_password_reset(), reject_verification(), NoReturn

### Community 119 - "Community 119"
Cohesion: 0.22
Nodes (7): Root conftest.py to help pytest discover the app module. This file adds the…, _is_version(), _matches(), Detect a backend virtualenv that has drifted from ``requirements.txt``. Nothing…, Is this the version half of a dist dir name, or did the split go wrong? Legacy…, Rank drift worst-first: missing, then the earliest diverging component., _severity()

### Community 120 - "Community 120"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 121 - "Community 121"
Cohesion: 0.25
Nodes (8): get_csrf_protect(), CsrfProtect, Request, Set the global CSRF protect instance. Called from main.py during application…, Get the CSRF protection instance for dependency injection. Returns:…, Validate CSRF token for state-changing operations. Args: request: The FastAPI…, set_csrf_protect_instance(), validate_csrf_token()

### Community 122 - "Community 122"
Cohesion: 0.29
Nodes (6): Hash a password with bcrypt with enhanced security. - Uses a high work factor…, Verify a password against its hash., The anchor for defect 2: bcrypt salts each hash, so `in` never matched., test_two_hashes_of_one_password_are_never_equal(), Test password hashing and verification, test_password_hashing()

### Community 123 - "Community 123"
Cohesion: 0.29
Nodes (7): IPermissionGroupBase, IPermissionGroupWithPermissions, Any, BaseModel, model_validator, Prevent infinite recursion in parent/child relationships, UserBasic

### Community 124 - "Community 124"
Cohesion: 0.39
Nodes (7): normal_user_token_headers(), AsyncClient, AsyncSession, fixture, Authentication-related test fixtures., Return authentication headers for a superuser., superuser_token_headers()

### Community 125 - "Community 125"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 126 - "Community 126"
Cohesion: 0.43
Nodes (6): main(), retry, Check if the database is ready for connections., Check if Redis is ready for connections., wait_for_database(), wait_for_redis()

### Community 127 - "Community 127"
Cohesion: 0.29
Nodes (3): _PlainTextExtractor, Render an HTML email body as readable plain text. Derived from the rendered…, HTMLParser

### Community 128 - "Community 128"
Cohesion: 0.43
Nodes (4): Any, HTTPException, UserNotFoundException, UserSelfDeleteException

### Community 129 - "Community 129"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 131 - "Community 131"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 132 - "Community 132"
Cohesion: 0.60
Nodes (5): downgrade(), get_uuid_type(), has_column(), Check if a column exists in a table, upgrade()

### Community 133 - "Community 133"
Cohesion: 0.40
Nodes (5): downgrade(), get_uuid_type(), This migration fixes the case conflict between 'rolegroupmap' and…, For downgrade, we would remove any columns we added, but this is rarely needed…, upgrade()

### Community 134 - "Community 134"
Cohesion: 0.33
Nodes (6): health_check(), Any, BackgroundTasks, get, Redis, Perform a health check of all critical system components, including: - API…

### Community 135 - "Community 135"
Cohesion: 0.40
Nodes (5): estimate_password_strength(), load_common_passwords(), Tools for loading and validating common passwords., Load common passwords from files in the project's password lists directory., Estimate password strength using zxcvbn. Returns: dict: Password strength…

### Community 136 - "Community 136"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 137 - "Community 137"
Cohesion: 0.33
Nodes (4): Test input validation for authentication endpoints., Test validation errors during registration., Test validation errors during login., TestAuthenticationValidation

### Community 139 - "Community 139"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 140 - "Community 140"
Cohesion: 0.60
Nodes (4): downgrade(), has_column(), Check if a column exists in a table, upgrade()

### Community 141 - "Community 141"
Cohesion: 0.60
Nodes (4): downgrade(), Check if a table exists, table_exists(), upgrade()

### Community 142 - "Community 142"
Cohesion: 0.40
Nodes (3): Any, field_validator, Override model_dump to customize role serialization

### Community 143 - "Community 143"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 144 - "Community 144"
Cohesion: 0.40
Nodes (5): auth_headers(), fixture, Factory fixture to create tokens for testing., Factory fixture to create authentication headers for testing., token_factory()

### Community 145 - "Community 145"
Cohesion: 0.40
Nodes (5): _mail_settings(), mock_send_email(), fixture, A known mail configuration, so assertions are about code, not .env., Shadow the suite-wide patch so this module runs the real function. Defined at…

### Community 147 - "Community 147"
Cohesion: 0.40
Nodes (4): compilerOptions, paths, files, references

### Community 148 - "Community 148"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 154 - "Community 154"
Cohesion: 0.50
Nodes (3): debug_cors(), Add this to the top of your main.py file after imports to debug CORS…, Add this function to your main.py file and call it before adding CORS middleware

### Community 158 - "Community 158"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

### Community 176 - "Community 176"
Cohesion: 0.67
Nodes (3): IErrorResponse, BaseModel, Standardized error response schema for frontend consumption

### Community 183 - "Community 183"
Cohesion: 0.67
Nodes (3): get_superuser_token_headers(), Get a superuser token for testing. This is a synchronous version for tests that…, TestClient

## Knowledge Gaps
- **319 isolated node(s):** `Meta`, `PaginationLinkProps`, `ApiError`, `ApiResponse`, `FormFields` (+314 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1543 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **93 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 5`, `Community 7`, `Community 9`, `Community 10`, `Community 13`, `Community 14`, `Community 142`, `Community 16`, `Community 20`, `Community 22`, `Community 24`, `Community 35`, `Community 37`, `Community 40`, `Community 41`, `Community 57`, `Community 61`, `Community 65`, `Community 66`, `Community 68`, `Community 79`, `Community 80`, `Community 81`, `Community 89`, `Community 97`, `Community 98`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `UUID` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 7`, `Community 9`, `Community 14`, `Community 16`, `Community 20`, `Community 24`, `Community 35`, `Community 41`, `Community 43`, `Community 46`, `Community 63`, `Community 68`, `Community 80`, `Community 89`, `Community 97`, `Community 100`, `Community 101`, `Community 118`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `get_csrf_token()` connect `Community 53` to `Community 0`, `Community 1`, `Community 2`, `Community 67`, `Community 40`, `Community 137`, `Community 10`, `Community 44`, `Community 18`, `Community 59`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 108 inferred relationships involving `User` (e.g. with `get_current_user()` and `change_password()`) actually correct?**
  _`User` has 108 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Meta`, `PaginationLinkProps`, `ApiError` to the rest of the system?**
  _319 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03484848484848485 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05763239875389408 - nodes in this community are weakly interconnected._