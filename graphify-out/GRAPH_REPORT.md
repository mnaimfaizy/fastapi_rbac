# Graph Report - fastapi_rbac  (2026-08-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3417 nodes · 8352 edges · 273 communities (179 shown, 94 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 623 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `79b199d8`
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
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 180
- Community 181
- Community 182
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
- Community 199
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
- Community 238
- Community 239
- Community 240
- Community 242
- Community 243
- Community 259

## God Nodes (most connected - your core abstractions)
1. `User` - 147 edges
2. `cn()` - 130 edges
3. `random_lower_string()` - 103 edges
4. `create_response()` - 63 edges
5. `get_csrf_token()` - 60 edges
6. `Role` - 57 edges
7. `random_email()` - 51 edges
8. `AsyncUserFactory` - 44 edges
9. `IUserCreate` - 41 edges
10. `Permission` - 41 edges

## Surprising Connections (you probably didn't know these)
- `get_current_user()` --uses--> `User`  [INFERRED]
  backend/app/api/deps.py → backend/app/models/user_model.py
- `change_password()` --uses--> `User`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/models/user_model.py
- `confirm_password_reset()` --uses--> `User`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/models/user_model.py
- `get_new_access_token()` --uses--> `User`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/models/user_model.py
- `login()` --uses--> `User`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/models/user_model.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (273 total, 94 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (58): FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue (+50 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (55): ProfileContent(), AlertDialogOverlay(), Avatar(), AvatarFallback(), AvatarImage(), CardAction(), Command(), CommandEmpty() (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (45): InitAuth(), LoginForm(), AppWrapper(), AppWrapperProps, LoadingScreen(), LoadingScreenProps, Meta(), MetaProps (+37 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (47): DataTableProps, DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps, Badge(), BadgeProps, badgeVariants (+39 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (41): assign_roles_to_user(), bulk_update_users(), create_user(), get_my_data(), get_user_by_id(), get_user_list_order_by_created_at(), Any, AsyncSession (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (38): LoginFormData, loginSchema, SignupForm(), SignupFormData, signupSchema, PasswordChangeFormData, passwordChangeSchema, OverviewChartData (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (63): AsyncRedis, get_strict_sanitizer(), Get strict input sanitizer for sensitive operations. Returns: InputSanitizer:…, change_password(), confirm_password_reset(), ensure_utc(), get_csrf_token(), get_new_access_token() (+55 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (51): BaseFactory, Meta, PermissionFactory, PermissionGroupFactory, Any, lazy_attribute, Permission, PermissionGroup (+43 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (35): Hash a password with bcrypt with enhanced security. - Uses a high work factor…, CRUDUser, Any, AsyncSession, EmailStr, User, Create a user. Requires db_session to be provided explicitly., Update a user. Requires db_session to be provided explicitly. (+27 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (32): Meta, Any, SQLAlchemyModelFactory, User, Factory for creating User model instances., Start sequence from a random point to avoid conflicts., Create a superuser/admin., Create a locked user. (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (76): create_permission(), delete_permission(), get_permission_by_id(), get_permissions(), AsyncSession, delete, get, Params (+68 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (49): Verify a password against its hash., IUserCreate, normal_user_token_headers(), AsyncClient, AsyncSession, fixture, Authentication-related test fixtures., Return authentication headers for a superuser. (+41 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (29): get_db(), AsyncSession, Get database session for dependency injection. Uses AsyncSession to ensure all…, app(), client(), AsyncClient, AsyncSession, FastAPI (+21 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (28): BaseUUIDModel, datetime, field_validator, SQLModel, PermissionGroup, PermissionGroupBase, PermissionGroup model for the application., Permission (+20 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (27): CRUDRole, Any, AsyncSession, Page, Params, Permission, Redis, Role (+19 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (29): AsyncClient, asyncio, AsyncSession, patch, Test login endpoint structure when registration fails., Test the password reset functionality, ensuring users can securely reset their…, Helper to register a user with CSRF token., Test security features of authentication. (+21 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (34): cmd_config(), cmd_down(), cmd_env(), cmd_exec(), cmd_health(), cmd_logs(), cmd_pull(), cmd_restart() (+26 more)

### Community 17 - "Community 17"
Cohesion: 0.06
Nodes (55): get_csrf_protect(), get_input_sanitizer(), get_permissive_sanitizer(), CsrfProtect, Request, This module contains the dependency injection utilities used across the FastAPI…, Get input sanitizer instance for dependency injection. Args: strict_mode:…, Get permissive input sanitizer for content that may contain HTML. Returns:… (+47 more)

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (42): IRoleCreate, IRoleOutput, IRoleUpdate, BaseModel, RoleOutput, RoleSchemaBase, asyncio, AsyncSession (+34 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (33): ProtectedRoute(), ProtectedRouteProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter() (+25 more)

### Community 20 - "Community 20"
Cohesion: 0.20
Nodes (20): get_current_user(), Any, User, TokenType, cleanup_expired_tokens(), _cleanup_tokens_task(), Redis, Add token cleanup task to background tasks. Args: background_tasks:… (+12 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (11): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (38): Create multiple permissions in a single database transaction. Args:…, IPermissionGroupCreate, IPermissionCreate, IPermissionUpdate, asyncio, AsyncSession, Test retrieving a permission by ID with relationships loaded, Test updating a permission (+30 more)

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (35): Skeleton(), NestedRoleGroupProps, RoleGroupDetail(), RoleGroupForm(), RoleGroupFormContent(), RoleGroupList(), RoleForm(), RoleFormData (+27 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (37): add_roles_to_group(), bulk_create_role_groups(), bulk_delete_role_groups(), clone_role_group(), create_role_group(), delete_role_group(), get_role_group_by_id(), get_role_groups() (+29 more)

### Community 25 - "Community 25"
Cohesion: 0.08
Nodes (37): add_token_claims(), create_access_token(), create_refresh_token(), create_reset_token(), create_verification_token(), decode_token(), get_content(), get_data_encrypt() (+29 more)

### Community 26 - "Community 26"
Cohesion: 0.07
Nodes (29): r"""UUID draft version objects (universally unique identifiers). This module…, r"""UUID version 7 features a time-ordered value field derived from the widely…, r"""UUID version 6 is a field-compatible version of UUIDv1, reordered for…, _subsec_decode(), _subsec_encode(), uuid6(), uuid7(), AsyncClient (+21 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (12): _log_security_event_task(), process_account_lockout(), _process_account_lockout_task(), AsyncSession, BackgroundTasks, User, Background tasks module for FastAPI RBAC system. This module provides utility…, The actual task that logs a security event to the audit log. (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (35): IRoleGroupCreate, asyncio, AsyncSession, fixture, User, Test retrieving all role groups without pagination, Test creating and retrieving hierarchical role groups, Test adding roles to a role group (+27 more)

### Community 29 - "Community 29"
Cohesion: 0.11
Nodes (19): CRUDRoleGroup, Any, AsyncSession, RoleGroup, User, Create multiple role groups in a single transaction, Delete multiple role groups in a single transaction, Synchronize roles with their role groups based on the role_group_id field. This… (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (19): CRUDBase, Any, AsyncSession, ModelType, Page, Params, CRUD object with default methods to Create, Read, Update, Delete (CRUD).…, Get multiple records by their IDs. (+11 more)

### Community 31 - "Community 31"
Cohesion: 0.09
Nodes (25): AuditLog, AuditLogBase, Model for storing security audit logs, create_audit_log(), Any, AsyncSession, Create an audit log entry for security-related actions, AuditLogFactory (+17 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (21): AsyncUserFactory, Async factory for creating User model instances., Generate a fake name., AsyncClient, asyncio, AsyncSession, Test dashboard role analytics endpoints., Test dashboard activity metrics endpoints. (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.11
Nodes (18): do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, Run migrations in 'online' mode. In this scenario we need to create an Engine…, run_migrations_offline(), run_migrations_online(), get_settings_dependency(), get_settings(), Any (+10 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (19): AsyncClient, asyncio, AsyncSession, Test error handling functionality., Test that 404 errors are handled properly., Test that invalid JSON is handled properly., Test that method not allowed errors are handled., Test basic system functionality. (+11 more)

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (27): get_dashboard_data(), get_dashboard_stats(), get, Session, User, Retrieve dashboard stats (alias for /dashboard or /dashboard/stats)., Retrieve dashboard data. Data returned will vary based on the user's role., get_active_sessions_count() (+19 more)

### Community 36 - "Community 36"
Cohesion: 0.10
Nodes (18): Create and configure SSL context for Redis connections. Retained for…, fixture, patch, Test connection parameters for production mode with SSL., Test connection pool creation without TLS uses Connection., TLS pools must use SSLConnection (not Connection + ssl=True)., Test that connection pool is a singleton., Celery asyncio.run per task must not reuse a pool from a closed loop. (+10 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (29): token_is_allowlisted(), AsyncClient, asyncio, Integration tests for Redis JWT allowlist enforcement (#73) and HttpOnly…, After logout, a previously issued refresh token must be rejected., Refresh via HttpOnly cookie + CSRF must return a new access token., JSON login must always write both access and refresh tokens into Redis., A cryptographically valid refresh JWT must fail when Redis set is empty. (+21 more)

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (25): DBType, Any, Enum, str, Test configuration settings for managing the test environment. This allows for…, Test TestConfig.get_db_uri for SQLite, Test TestConfig.get_db_uri for PostgreSQL, Test TestConfig.get_connection_args method (+17 more)

### Community 39 - "Community 39"
Cohesion: 0.07
Nodes (29): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+21 more)

### Community 40 - "Community 40"
Cohesion: 0.11
Nodes (16): Any, Permission, Role, RoleGroup, User, Create an admin user with a compliant password by default, or return existing…, Create a locked user., Create an unverified user. (+8 more)

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (27): AsyncTestDataBuilder, Helper class to build complex test data scenarios., admin_user(), basic_rbac_setup(), locked_user(), permission_factory(), permission_group_factory(), Any (+19 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (25): PermissionGroupData, IPermissionGroupUpdate, asyncio, AsyncSession, Test deleting a permission group, Test adding permissions to a permission group, Test creating a permission group through CRUD operations, Test permission groups with subgroups relationship (+17 more)

### Community 43 - "Community 43"
Cohesion: 0.11
Nodes (18): close_redis_pool(), Enhanced Redis connection management with SSL support for production. This…, Create a connection pool for Redis. Args: db: Redis database number…, Drop the cached pool without awaiting disconnect. Used when the owning asyncio…, Get or create a singleton connection pool. Args: db: Redis database number…, Close the connection pool and cleanup resources., Close the Redis connection pool., Factory class for creating and managing Redis connections with SSL support.… (+10 more)

### Community 44 - "Community 44"
Cohesion: 0.10
Nodes (20): Many-to-many relationship between Users and Roles with a composite primary key., UserRole, post_generation, Role, User-related model factories for testing., Add roles to the user if provided., Comprehensive authentication API endpoint tests - FIXED VERSION. This module…, Test assigning roles to a user (+12 more)

### Community 45 - "Community 45"
Cohesion: 0.19
Nodes (18): generate_strong_password(), login_user(), promote_user_to_admin(), Any, AsyncClient, asyncio, User management integration tests. Tests the complete user management flow…, Generate a strong password that avoids sequential characters and meets… (+10 more)

### Community 46 - "Community 46"
Cohesion: 0.11
Nodes (24): background_tasks_mock(), celery_mock(), celery_task_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), http_client_mock(), oauth_provider_mock() (+16 more)

### Community 47 - "Community 47"
Cohesion: 0.10
Nodes (12): MockCeleryResult, MockCeleryTask, Any, Celery service mocks for testing., Mock Celery task for testing., Mock task.delay() method., Mock task.apply_async() method., Clear the task call history. (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.14
Nodes (24): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), Comprehensive test runner for the refactored test suite. This script provides…, Run all tests (unit + integration) in Docker Compose for correct environment… (+16 more)

### Community 49 - "Community 49"
Cohesion: 0.16
Nodes (11): RegisterForm(), LoginCredentials, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, Token, TokenRead, UserRegister (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.14
Nodes (22): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), Exception, JSONResponse, Request, Response (+14 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (21): Any, Input sanitization utilities for XSS prevention and data cleaning. This module…, Sanitize email address input. Args: email: The email address to sanitize…, Sanitize search query input to prevent injection attacks. Args: query: The…, Recursively sanitize string values in a dictionary/JSON object. Args: data:…, Sanitize URL input to prevent XSS and injection attacks. Args: url: The URL to…, Sanitize input value based on field type. Args: value: The value to sanitize…, Sanitize all string values in a dictionary. Args: data: Dictionary to sanitize… (+13 more)

### Community 52 - "Community 52"
Cohesion: 0.14
Nodes (13): AsyncFactoryBase, AsyncPermissionFactory, AsyncPermissionGroupFactory, AsyncRoleGroupFactory, AsyncSession, PermissionGroup, Async factory for creating Permission model instances., Generate a unique fake permission name. (+5 more)

### Community 53 - "Community 53"
Cohesion: 0.12
Nodes (20): create_mock_user(), dependency_overrider(), DependencyOverrider, mock_current_user_factory(), mock_dependency(), Any, FastAPI, fixture (+12 more)

### Community 54 - "Community 54"
Cohesion: 0.12
Nodes (16): App(), createTestStoreForRoleList(), ExtendedRenderOptions, renderRoleListWithMockedDispatch(), AppStore, createTestStore(), ExtendedRenderOptions, mockPermissions (+8 more)

### Community 55 - "Community 55"
Cohesion: 0.13
Nodes (20): DataTable(), DataTableColumn, OverviewChart(), StatsCard(), chartData, DashboardOverview(), userTableColumns, PermissionDetail() (+12 more)

### Community 56 - "Community 56"
Cohesion: 0.10
Nodes (12): Any, Service configuration for environment-specific settings. Manages Redis, Celery,…, Get email configuration based on environment, Environment-specific service settings for Celery, Redis, and other external…, Get database URL based on environment, Get the Redis URL based on current environment. For production, uses rediss://…, Get the Celery broker URL based on current environment, Get the Celery result backend URL based on current environment (+4 more)

### Community 57 - "Community 57"
Cohesion: 0.16
Nodes (20): clear_refresh_token_cookie(), Any, Response, HttpOnly refresh-token cookie helpers for first-party SPA auth., Path-scope refresh cookies to auth routes only., Secure cookies in production; allow plain HTTP on localhost/dev/test., Set the HttpOnly refresh token cookie. Never log the token value., Clear the refresh token cookie using the same attributes used when setting it. (+12 more)

### Community 58 - "Community 58"
Cohesion: 0.20
Nodes (13): AsyncClient, asyncio, AsyncSession, Permission management integration tests. Tests the complete permission…, Test complete CRUD operations for permission groups., Test operations on permission groups that contain permissions., Integration tests for permission management flows., Test permission listing and pagination. (+5 more)

### Community 59 - "Community 59"
Cohesion: 0.16
Nodes (12): CRUDPermission, AsyncSession, Permission, Check if a permission with the given name already exists. Args: name: The name…, Get a permission by its name. Args: name: The name of the permission to…, Assign multiple permissions to a role in a batch operation for improved…, Remove multiple permissions from a role in a batch operation. Args: role_id:…, Check if a permission is currently assigned to any role. Args: permission_id:… (+4 more)

### Community 60 - "Community 60"
Cohesion: 0.15
Nodes (14): clearAuthSessionHint(), clearAuthTokens(), clearLegacyRefreshTokenStorage(), getStoredAccessToken(), removeStoredAccessToken(), setAuthSessionHint(), setStoredAccessToken(), api (+6 more)

### Community 61 - "Community 61"
Cohesion: 0.17
Nodes (13): AuthState, Permission, ApiResponse, PaginatedItems, Role, User, ApiError, UserCreatePayload (+5 more)

### Community 62 - "Community 62"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 63 - "Community 63"
Cohesion: 0.18
Nodes (18): INewPassword, IUserLoginSchema, IUserOutput, IUserOutputPaginated, IUserOutputPaginatedSchema, IUserPasswordReset, IUserRoleAssign, IUserStatus (+10 more)

### Community 64 - "Community 64"
Cohesion: 0.37
Nodes (11): login_user(), promote_user_to_admin(), Any, AsyncClient, asyncio, Role management integration tests. Tests the complete role management flow…, Integration tests for role management flows (API-driven)., Assign the admin role to a user using the seeded admin account, with retry for… (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.17
Nodes (18): PaginatedDataResponse, PaginatedResponse, PaginationParams, Role, RoleCreate, RolePermissionAssign, RolePermissionUnassign, RoleResponse (+10 more)

### Community 66 - "Community 66"
Cohesion: 0.15
Nodes (18): create_permission_group(), delete_permission_group(), get_permission_group_by_id(), get_permission_groups(), AsyncSession, delete, get, Params (+10 more)

### Community 67 - "Community 67"
Cohesion: 0.12
Nodes (18): @eslint/js, eslint-plugin-react-hooks, devDependencies, @eslint/js, eslint-plugin-react-hooks, @testing-library/dom, @testing-library/jest-dom, @testing-library/user-event (+10 more)

### Community 68 - "Community 68"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 69 - "Community 69"
Cohesion: 0.15
Nodes (15): create_limiter(), _is_testing(), Shared slowapi HTTP rate limiter for the FastAPI app. HTTP rate limits use this…, Memory in testing; Redis (service_settings.redis_url) otherwise., _storage_uri(), AsyncClient, asyncio, HTTP rate limit wiring seams (slowapi consolidation — issue #64). (+7 more)

### Community 70 - "Community 70"
Cohesion: 0.13
Nodes (15): custom_swagger_ui_html(), get_csrf_config(), lifespan(), BaseHTTPMiddleware, FastAPI, get, An example "Hello world" FastAPI route., Serve Swagger UI with CSRF support for state-changing requests. (+7 more)

### Community 71 - "Community 71"
Cohesion: 0.15
Nodes (11): get_redis_client(), Redis, retry, Get a Redis client using the connection pool. Args: db: Redis database number…, Perform a health check on Redis connection. Args: client: Optional Redis client…, Get a Redis client instance. Args: db: Redis database number (default: 0)…, asyncio, Test getting a Redis client from the pool. (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (9): MockEmailService, Any, Email service mocks for testing., Mock implementation of email service for testing., Mock verification email sending., Mock password reset email sending., Clear the sent emails list., Get the last sent email. (+1 more)

### Community 73 - "Community 73"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 74 - "Community 74"
Cohesion: 0.24
Nodes (13): assert_main_clean(), build_docker_images(), clear_changelog_artifact(), create_git_tag(), generate_changelog(), invoke_direct_tag_mode(), invoke_release_pr_mode(), create-release.sh script (+5 more)

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (3): Any, field_validator, Override model_dump to customize role serialization

### Community 76 - "Community 76"
Cohesion: 0.19
Nodes (12): IPermissionGroupBase, IPermissionGroupRead, IPermissionGroupReadWithPermissions, IPermissionGroupWithPermissions, Any, BaseModel, model_validator, Prevent infinite recursion in parent/child relationships (+4 more)

### Community 77 - "Community 77"
Cohesion: 0.11
Nodes (24): Any, Send an email using the emails library, which supports both development and…, Render a Jinja template from the email templates directory with the given…, Render a template and send it as an email., render_template(), send_email(), send_email_with_template(), Send a password reset email to a user. Args: email: The recipient's email… (+16 more)

### Community 78 - "Community 78"
Cohesion: 0.15
Nodes (8): MockOAuthProvider, Any, Mock user info retrieval., Set user info for a token., Add authorization code., Get requests, optionally filtered by method or URL., Mock OAuth provider for testing OAuth flows., Generate mock authorization URL.

### Community 79 - "Community 79"
Cohesion: 0.19
Nodes (16): asyncio, AsyncSession, fixture, Permission, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group (+8 more)

### Community 80 - "Community 80"
Cohesion: 0.16
Nodes (8): MockHTTPClient, MockHTTPResponse, External API mocks for testing., Mock HTTP response for testing., Raise exception for bad status codes., Mock HTTP client for testing external API calls., Set a specific response for method and URL., Clear request history.

### Community 81 - "Community 81"
Cohesion: 0.24
Nodes (10): Assert-MainClean(), Build-DockerImages(), Get-ReleaseNotesEntry(), Invoke-DirectTagMode(), Invoke-ReleasePrMode(), New-Changelog(), New-GitTag(), Confirm-Continue() (+2 more)

### Community 82 - "Community 82"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 83 - "Community 83"
Cohesion: 0.16
Nodes (13): AbstractParams, rate_limit_handler(), Handle rate limit exceeded exceptions, create_error_response(), ErrorDetail, IErrorResponse, Any, BaseModel (+5 more)

### Community 84 - "Community 84"
Cohesion: 0.21
Nodes (12): get_cached_celery_config(), get_celery_config(), Any, Celery configuration module for the FastAPI RBAC project. This module provides…, Get cached Celery configuration. Uses lru_cache to cache the configuration and…, Get Celery configuration dictionary with all necessary settings. Returns:…, DatabaseTypeEnum, get_project_root() (+4 more)

### Community 85 - "Community 85"
Cohesion: 0.20
Nodes (12): get_or_create_superuser(), init_db(), AsyncSession, create_init_data(), main(), Create initial database data if it doesn't exist., Main function to run the initialization., create_init_data() (+4 more)

### Community 86 - "Community 86"
Cohesion: 0.22
Nodes (7): Globals, Any, Get the value of a variable., Clear all variables and free memory., Set a default value for a variable., Get the default value for a variable., Ensure a ContextVar exists for a variable.

### Community 87 - "Community 87"
Cohesion: 0.24
Nodes (13): get_test_data(), main(), Any, Session, Test endpoint with valid CSRF token and session with cookie., Get appropriate test data for each endpoint., Test CSRF token generation endpoint., Test endpoint without CSRF token (should fail). (+5 more)

### Community 88 - "Community 88"
Cohesion: 0.24
Nodes (10): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, dashboardSlice, DashboardState (+2 more)

### Community 89 - "Community 89"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 90 - "Community 90"
Cohesion: 0.24
Nodes (13): asyncio, AsyncSession, fixture, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group, Test creating a permission group in the database (+5 more)

### Community 91 - "Community 91"
Cohesion: 0.35
Nodes (6): CRUDPermissionGroup, Any, AsyncSession, Params, PermissionGroup, Get a permission group by name.

### Community 92 - "Community 92"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 93 - "Community 93"
Cohesion: 0.20
Nodes (9): ASGIApp, globals_middleware_dispatch(), GlobalsMiddleware, BaseHTTPMiddleware, Request, Response, This allows to use global variables inside the FastAPI application using async…, Dispatch the request in a new context to allow globals to be used. (+1 more)

### Community 94 - "Community 94"
Cohesion: 0.20
Nodes (6): Any, Build Redis connection parameters based on environment. Args: db: Redis…, Return whether Redis TLS should be used for the given mode., Resolve the directory that holds Redis TLS materials., Build kwargs for redis.asyncio.SSLConnection. redis-py asyncio does not accept…, Test connection parameters for development mode.

### Community 95 - "Community 95"
Cohesion: 0.20
Nodes (7): Centralized Celery configuration for the FastAPI RBAC system. This module…, Scheduled tasks configuration for Celery Beat. This module defines recurring…, Ensure Celery workers register task modules from app.worker., conf.imports keeps task registration for celery -A app.celery_app., Worker boot via app.celery_app must register security/email tasks., test_celery_app_imports_worker_tasks(), test_celery_config_lists_worker_imports()

### Community 96 - "Community 96"
Cohesion: 0.20
Nodes (8): comprehensive_mocks(), Provide comprehensive mocks for integration testing., Provide all service mocks in a single fixture., service_mocks(), MockCeleryApp, Clear all task call history., Mock Celery application for testing., Get task calls, optionally filtered by task name.

### Community 97 - "Community 97"
Cohesion: 0.36
Nodes (9): asyncio, AsyncSession, Test creating an entity with BaseUUIDModel as base class, Test updating an entity with BaseUUIDModel as base class, Test that UUIDs are unique for each instance, SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update() (+1 more)

### Community 98 - "Community 98"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 99 - "Community 99"
Cohesion: 0.38
Nodes (7): RoleGroupCreate, RoleGroupResponse, RoleGroupUpdate, RoleGroupWithRolesResponse, UserBasic, roleGroupService, mockedApi

### Community 101 - "Community 101"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 102 - "Community 102"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 103 - "Community 103"
Cohesion: 0.28
Nodes (9): AsyncEngine, db(), db_engine(), initialize_db(), AsyncSession, fixture, Initialize the database for the test session., Create test database tables and return engine. (+1 more)

### Community 104 - "Community 104"
Cohesion: 0.22
Nodes (9): autoprefixer, clsx, dependencies, autoprefixer, clsx, @reduxjs/toolkit, tailwindcss, @reduxjs/toolkit (+1 more)

### Community 105 - "Community 105"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 106 - "Community 106"
Cohesion: 0.29
Nodes (7): get_async_session(), get_redis_client(), Any, AsyncSession, Redis, Create and get async database session. This function yields an AsyncSession for…, Get Redis client instance as an async generator. Yields a Redis client…

### Community 108 - "Community 108"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 109 - "Community 109"
Cohesion: 0.43
Nodes (6): main(), retry, Check if the database is ready for connections., Check if Redis is ready for connections., wait_for_database(), wait_for_redis()

### Community 110 - "Community 110"
Cohesion: 0.43
Nodes (4): Any, HTTPException, UserNotFoundException, UserSelfDeleteException

### Community 111 - "Community 111"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 113 - "Community 113"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 114 - "Community 114"
Cohesion: 0.60
Nodes (5): downgrade(), get_uuid_type(), has_column(), Check if a column exists in a table, upgrade()

### Community 115 - "Community 115"
Cohesion: 0.40
Nodes (5): downgrade(), get_uuid_type(), This migration fixes the case conflict between 'rolegroupmap' and…, For downgrade, we would remove any columns we added, but this is rarely needed…, upgrade()

### Community 116 - "Community 116"
Cohesion: 0.33
Nodes (6): health_check(), Any, BackgroundTasks, get, Redis, Perform a health check of all critical system components, including: - API…

### Community 117 - "Community 117"
Cohesion: 0.40
Nodes (5): estimate_password_strength(), load_common_passwords(), Tools for loading and validating common passwords., Load common passwords from files in the project's password lists directory., Estimate password strength using zxcvbn. Returns: dict: Password strength…

### Community 118 - "Community 118"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 119 - "Community 119"
Cohesion: 0.33
Nodes (4): AsyncRoleFactory, Async factory for creating Role model instances., Generate a unique fake role name., Dashboard integration tests. Tests the dashboard API endpoints including: -…

### Community 120 - "Community 120"
Cohesion: 0.33
Nodes (4): Test input validation for authentication endpoints., Test validation errors during registration., Test validation errors during login., TestAuthenticationValidation

### Community 122 - "Community 122"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 123 - "Community 123"
Cohesion: 0.60
Nodes (4): downgrade(), has_column(), Check if a column exists in a table, upgrade()

### Community 124 - "Community 124"
Cohesion: 0.60
Nodes (4): downgrade(), Check if a table exists, table_exists(), upgrade()

### Community 125 - "Community 125"
Cohesion: 0.60
Nodes (5): after_insert_role(), after_update_role(), Connection, listens_for, Mapper

### Community 126 - "Community 126"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 129 - "Community 129"
Cohesion: 0.40
Nodes (4): compilerOptions, paths, files, references

### Community 130 - "Community 130"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 136 - "Community 136"
Cohesion: 0.50
Nodes (3): debug_cors(), Add this to the top of your main.py file after imports to debug CORS…, Add this function to your main.py file and call it before adding CORS middleware

### Community 140 - "Community 140"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

## Knowledge Gaps
- **307 isolated node(s):** `FormFieldContextValue`, `FormItemContextValue`, `FormValues`, `PermissionGroupFormProps`, `FormValues` (+302 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **94 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 10` to `Community 4`, `Community 6`, `Community 8`, `Community 9`, `Community 11`, `Community 13`, `Community 14`, `Community 17`, `Community 18`, `Community 20`, `Community 24`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 31`, `Community 32`, `Community 35`, `Community 41`, `Community 44`, `Community 53`, `Community 63`, `Community 66`, `Community 75`, `Community 79`, `Community 90`, `Community 119`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `UUID` connect `Community 17` to `Community 4`, `Community 6`, `Community 7`, `Community 8`, `Community 10`, `Community 13`, `Community 14`, `Community 20`, `Community 22`, `Community 24`, `Community 26`, `Community 27`, `Community 29`, `Community 30`, `Community 31`, `Community 42`, `Community 52`, `Community 59`, `Community 66`, `Community 91`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `get_csrf_token()` connect `Community 37` to `Community 64`, `Community 32`, `Community 44`, `Community 45`, `Community 15`, `Community 120`, `Community 58`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 98 inferred relationships involving `User` (e.g. with `get_current_user()` and `change_password()`) actually correct?**
  _`User` has 98 INFERRED edges - model-reasoned connections that need verification._
- **What connects `FormFieldContextValue`, `FormItemContextValue`, `FormValues` to the rest of the system?**
  _307 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.060641627543035995 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04774083546462063 - nodes in this community are weakly interconnected._