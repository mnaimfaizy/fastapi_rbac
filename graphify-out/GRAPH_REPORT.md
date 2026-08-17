# Graph Report - fastapi_rbac  (2026-08-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3391 nodes · 8282 edges · 272 communities (178 shown, 94 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 695 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `990b9d1f`
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
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
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
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
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
- Community 179
- Community 180
- Community 181
- Community 182
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
- Community 218
- Community 219
- Community 220
- Community 221
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
- Community 241
- Community 242
- Community 243
- Community 244
- Community 246
- Community 247
- Community 263

## God Nodes (most connected - your core abstractions)
1. `User` - 147 edges
2. `cn()` - 130 edges
3. `random_lower_string()` - 103 edges
4. `create_response()` - 63 edges
5. `Role` - 57 edges
6. `get_csrf_token()` - 54 edges
7. `random_email()` - 51 edges
8. `AsyncUserFactory` - 44 edges
9. `Permission` - 41 edges
10. `IUserCreate` - 41 edges

## Surprising Connections (you probably didn't know these)
- `get_settings_dependency()` --uses--> `Settings`  [INFERRED]
  backend/app/api/deps.py → backend/app/core/config.py
- `celery_mock()` --uses--> `MockCeleryApp`  [INFERRED]
  backend/test/fixtures/enhanced_service_mocks.py → backend/test/mocks/celery_mock.py
- `comprehensive_mocks()` --uses--> `MockCeleryApp`  [INFERRED]
  backend/test/fixtures/enhanced_service_mocks.py → backend/test/mocks/celery_mock.py
- `TestAuthenticationEdgeCases` --uses--> `AsyncUserFactory`  [INFERRED]
  backend/test/integration/test_api_auth_comprehensive.py → backend/test/factories/async_factories.py
- `TestAuthenticationSecurity` --uses--> `AsyncUserFactory`  [INFERRED]
  backend/test/integration/test_api_auth_comprehensive.py → backend/test/factories/async_factories.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (272 total, 94 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (47): InitAuth(), LoginForm(), ProtectedRoute(), ProtectedRouteProps, SignupForm(), AppWrapper(), AppWrapperProps, LoadingScreen() (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (55): DataTableProps, DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel() (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (53): AuditLog, AuditLogBase, Model for storing security audit logs, BaseUUIDModel, datetime, field_validator, SQLModel, Track password changes for compliance and security. This helps prevent password… (+45 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (59): PasswordValidator, Password validation helper class., Hash a password with bcrypt with enhanced security. - Uses a high work factor…, Verify a password against its hash., CRUDUser, Any, AsyncSession, EmailStr (+51 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (47): AsyncClient, asyncio, AsyncSession, Permission management integration tests. Tests the complete permission…, Test complete CRUD operations for permission groups., Test operations on permission groups that contain permissions., Integration tests for permission management flows., Test permission listing and pagination. (+39 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (56): AsyncRedis, get_strict_sanitizer(), Get strict input sanitizer for sensitive operations. Returns: InputSanitizer:…, change_password(), confirm_password_reset(), ensure_utc(), get_new_access_token(), login() (+48 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (59): AuditLogFactory, Meta, Any, lazy_attribute, SQLAlchemyModelFactory, Factory for creating AuditLog model instances., Generate a JSON-compatible details dictionary., Create an audit log entry for a specific user. (+51 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (49): AsyncTestDataBuilder, AsyncUserFactory, Helper class to build complex test data scenarios., Async factory for creating User model instances., Generate a unique fake email., Generate a fake name., admin_user(), basic_rbac_setup() (+41 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (52): Mapping table between roles and role groups. This model handles the many-to-…, RoleGroupMap, RoleGroup, IRoleGroupCreate, asyncio, AsyncSession, fixture, User (+44 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (35): Meta, Any, post_generation, Role, SQLAlchemyModelFactory, User, Factory for creating User model instances., Start sequence from a random point to avoid conflicts. (+27 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (35): LoginFormData, loginSchema, SignupFormData, signupSchema, PasswordChangeFormData, passwordChangeSchema, OverviewChartData, OverviewChartProps (+27 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (34): AsyncClient, asyncio, AsyncSession, patch, Comprehensive authentication API endpoint tests - FIXED VERSION. This module…, Test login endpoint structure when registration fails., Test the password reset functionality, ensuring users can securely reset their…, Test security features of authentication. (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (65): AbstractParams, create_permission(), delete_permission(), get_permission_by_id(), get_permissions(), AsyncSession, delete, get (+57 more)

### Community 13 - "Community 13"
Cohesion: 0.05
Nodes (54): MainLayout(), CardAction(), Checkbox(), Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem() (+46 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (28): get_db(), AsyncSession, Get database session for dependency injection. Uses AsyncSession to ensure all…, app(), client(), AsyncClient, AsyncSession, FastAPI (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (34): cmd_config(), cmd_down(), cmd_env(), cmd_exec(), cmd_health(), cmd_logs(), cmd_pull(), cmd_restart() (+26 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (26): PermissionGroupRow(), PermissionDetail(), PermissionForm(), PermissionFormContent(), PermissionsContent(), PermissionsDataTable(), SortState, RoleGroupContent() (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (39): add_roles_to_group(), bulk_create_role_groups(), bulk_delete_role_groups(), clone_role_group(), create_role_group(), delete_role_group(), get_role_group_by_id(), get_role_groups() (+31 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (41): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), get_csrf_config(), lifespan(), BaseHTTPMiddleware, Exception (+33 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (11): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (48): FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue (+40 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (34): NestedRoleGroup(), RoleGroupDetail(), RoleGroupForm(), RoleGroupFormContent(), RoleGroupList(), RoleDetail(), RoleForm(), RoleFormData (+26 more)

### Community 22 - "Community 22"
Cohesion: 0.09
Nodes (41): assign_permissions_to_role(), create_role(), delete_role(), get_all_roles_list(), get_role_by_id(), get_roles(), AsyncSession, BackgroundTasks (+33 more)

### Community 23 - "Community 23"
Cohesion: 0.06
Nodes (42): get_csrf_protect(), get_input_sanitizer(), get_permissive_sanitizer(), get_settings_dependency(), CsrfProtect, Request, This module contains the dependency injection utilities used across the FastAPI…, Get input sanitizer instance for dependency injection. Args: strict_mode:… (+34 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (38): IRoleCreate, asyncio, AsyncSession, Test retrieving multiple roles with pagination, Test retrieving all roles without pagination, Test adding a role to a user, Test creating a role through CRUD operations, Test adding a non-existent role to a user raises ValueError (+30 more)

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (36): get_current_user(), Any, User, TokenType, _cleanup_tokens_task(), Clean up tokens for a user. Must use the same Redis key as ``app.utils.token``…, add_token_to_redis(), delete_tokens() (+28 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (19): CRUDRoleGroup, Any, AsyncSession, RoleGroup, User, Create multiple role groups in a single transaction, Delete multiple role groups in a single transaction, Synchronize roles with their role groups based on the role_group_id field. This… (+11 more)

### Community 27 - "Community 27"
Cohesion: 0.09
Nodes (35): add_token_claims(), create_access_token(), create_refresh_token(), create_reset_token(), create_verification_token(), decode_token(), get_content(), get_data_encrypt() (+27 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (36): IPermissionGroupCreate, IPermissionCreate, asyncio, AsyncSession, Test retrieving a permission by ID with relationships loaded, Test updating a permission, Test updating a permission's name, Test retrieving multiple permissions with pagination (+28 more)

### Community 29 - "Community 29"
Cohesion: 0.07
Nodes (32): CRUDRole, Any, AsyncSession, Page, Params, Permission, Redis, Role (+24 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (19): CRUDBase, Any, AsyncSession, ModelType, Page, Params, CRUD object with default methods to Create, Read, Update, Delete (CRUD).…, Get multiple records by their IDs. (+11 more)

### Community 31 - "Community 31"
Cohesion: 0.07
Nodes (32): get_redis_client(), Redis, Get Redis client instance as an async generator. Yields a Redis client…, close_redis_pool(), get_redis_client(), Redis, retry, Enhanced Redis connection management with SSL support for production. This… (+24 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (17): Create and configure SSL context for Redis connections. Retained for…, fixture, patch, Test connection parameters for production mode with SSL., Test connection pool creation without TLS uses Connection., TLS pools must use SSLConnection (not Connection + ssl=True)., Test that connection pool is a singleton., Celery asyncio.run per task must not reuse a pool from a closed loop. (+9 more)

### Community 33 - "Community 33"
Cohesion: 0.11
Nodes (19): AsyncClient, asyncio, AsyncSession, Test error handling functionality., Test that 404 errors are handled properly., Test that invalid JSON is handled properly., Test that method not allowed errors are handled., Test basic system functionality. (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.06
Nodes (30): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+22 more)

### Community 35 - "Community 35"
Cohesion: 0.11
Nodes (17): do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, Run migrations in 'online' mode. In this scenario we need to create an Engine…, run_migrations_offline(), run_migrations_online(), get_settings(), Any, field_validator (+9 more)

### Community 36 - "Community 36"
Cohesion: 0.09
Nodes (25): DBType, Any, Enum, str, Test configuration settings for managing the test environment. This allows for…, Test TestConfig.get_db_uri for SQLite, Test TestConfig.get_db_uri for PostgreSQL, Test TestConfig.get_connection_args method (+17 more)

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (16): PaginatedData, PaginatedPermissionGroupResponse, PaginatedPermissionResponse, Permission, PermissionCreate, PermissionGroupCreate, PermissionGroupResponse, PermissionGroupUpdate (+8 more)

### Community 38 - "Community 38"
Cohesion: 0.17
Nodes (24): get_dashboard_data(), get_dashboard_stats(), get, Session, User, Retrieve dashboard stats (alias for /dashboard or /dashboard/stats)., Retrieve dashboard data. Data returned will vary based on the user's role., get_active_sessions_count() (+16 more)

### Community 39 - "Community 39"
Cohesion: 0.11
Nodes (26): background_tasks_mock(), celery_mock(), celery_task_mock(), comprehensive_mocks(), database_transaction_mock(), email_failure_mock(), email_mock(), http_client_mock() (+18 more)

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (7): Globals, Any, Get the value of a variable., Clear all variables and free memory., Set a default value for a variable., Get the default value for a variable., Ensure a ContextVar exists for a variable.

### Community 41 - "Community 41"
Cohesion: 0.10
Nodes (12): MockCeleryResult, MockCeleryTask, Any, Celery service mocks for testing., Mock Celery task for testing., Mock task.delay() method., Mock task.apply_async() method., Clear the task call history. (+4 more)

### Community 42 - "Community 42"
Cohesion: 0.14
Nodes (24): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), Comprehensive test runner for the refactored test suite. This script provides…, Run all tests (unit + integration) in Docker Compose for correct environment… (+16 more)

### Community 43 - "Community 43"
Cohesion: 0.19
Nodes (12): AuthState, ApiResponse, PaginatedItems, User, ApiError, UserCreatePayload, UserService, UserUpdatePayload (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.16
Nodes (22): asyncio, AsyncSession, Test deleting a permission group, Test adding permissions to a permission group, Test creating a permission group through CRUD operations, Test permission groups with subgroups relationship, Test counting permissions by group, Test retrieving a permission group by ID (+14 more)

### Community 45 - "Community 45"
Cohesion: 0.13
Nodes (21): Any, Input sanitization utilities for XSS prevention and data cleaning. This module…, Sanitize email address input. Args: email: The email address to sanitize…, Sanitize search query input to prevent injection attacks. Args: query: The…, Recursively sanitize string values in a dictionary/JSON object. Args: data:…, Sanitize URL input to prevent XSS and injection attacks. Args: url: The URL to…, Sanitize input value based on field type. Args: value: The value to sanitize…, Sanitize all string values in a dictionary. Args: data: Dictionary to sanitize… (+13 more)

### Community 46 - "Community 46"
Cohesion: 0.12
Nodes (16): App(), createTestStoreForRoleList(), ExtendedRenderOptions, renderRoleListWithMockedDispatch(), AppStore, createTestStore(), ExtendedRenderOptions, mockPermissions (+8 more)

### Community 47 - "Community 47"
Cohesion: 0.17
Nodes (18): PaginatedDataResponse, PaginatedResponse, PaginationParams, Role, RoleCreate, RolePermissionAssign, RolePermissionUnassign, RoleResponse (+10 more)

### Community 48 - "Community 48"
Cohesion: 0.11
Nodes (21): AsyncEngine, get_or_create_superuser(), init_db(), AsyncSession, create_init_data(), main(), Create initial database data if it doesn't exist., Main function to run the initialization. (+13 more)

### Community 49 - "Community 49"
Cohesion: 0.13
Nodes (14): CRUDPermission, AsyncSession, Permission, Check if a permission with the given name already exists. Args: name: The name…, Create multiple permissions in a single database transaction. Args:…, Get a permission by its name. Args: name: The name of the permission to…, Assign multiple permissions to a role in a batch operation for improved…, Remove multiple permissions from a role in a batch operation. Args: role_id:… (+6 more)

### Community 50 - "Community 50"
Cohesion: 0.08
Nodes (33): get_async_session(), Any, AsyncSession, Create and get async database session. This function yields an AsyncSession for…, cleanup_unverified_account(), _log_security_event_task(), process_account_lockout(), _process_account_lockout_task() (+25 more)

### Community 51 - "Community 51"
Cohesion: 0.17
Nodes (11): RegisterForm(), LoginCredentials, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, Token, TokenRead, UserRegister (+3 more)

### Community 52 - "Community 52"
Cohesion: 0.10
Nodes (12): Any, Service configuration for environment-specific settings. Manages Redis, Celery,…, Get email configuration based on environment, Environment-specific service settings for Celery, Redis, and other external…, Get database URL based on environment, Get the Redis URL based on current environment. For production, uses rediss://…, Get the Celery broker URL based on current environment, Get the Celery result backend URL based on current environment (+4 more)

### Community 53 - "Community 53"
Cohesion: 0.11
Nodes (19): create_mock_user(), dependency_overrider(), DependencyOverrider, mock_current_user_factory(), mock_dependency(), Any, FastAPI, fixture (+11 more)

### Community 54 - "Community 54"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 55 - "Community 55"
Cohesion: 0.18
Nodes (18): INewPassword, IUserLoginSchema, IUserOutput, IUserOutputPaginated, IUserOutputPaginatedSchema, IUserPasswordReset, IUserRoleAssign, IUserStatus (+10 more)

### Community 56 - "Community 56"
Cohesion: 0.20
Nodes (9): ASGIApp, globals_middleware_dispatch(), GlobalsMiddleware, BaseHTTPMiddleware, Request, Response, This allows to use global variables inside the FastAPI application using async…, Dispatch the request in a new context to allow globals to be used. (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.15
Nodes (18): create_permission_group(), delete_permission_group(), get_permission_group_by_id(), get_permission_groups(), AsyncSession, delete, get, Params (+10 more)

### Community 58 - "Community 58"
Cohesion: 0.16
Nodes (14): Centralized Celery configuration for the FastAPI RBAC system. This module…, Scheduled tasks configuration for Celery Beat. This module defines recurring…, get_cached_celery_config(), get_celery_config(), Any, Celery configuration module for the FastAPI RBAC project. This module provides…, Get cached Celery configuration. Uses lru_cache to cache the configuration and…, Get Celery configuration dictionary with all necessary settings. Returns:… (+6 more)

### Community 59 - "Community 59"
Cohesion: 0.12
Nodes (21): IPermissionGroupBase, IPermissionGroupRead, IPermissionGroupReadWithPermissions, IPermissionGroupUpdate, IPermissionGroupWithPermissions, Any, BaseModel, model_validator (+13 more)

### Community 60 - "Community 60"
Cohesion: 0.12
Nodes (18): @eslint/js, eslint-plugin-react-hooks, devDependencies, @eslint/js, eslint-plugin-react-hooks, @testing-library/dom, @testing-library/jest-dom, @testing-library/user-event (+10 more)

### Community 61 - "Community 61"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 62 - "Community 62"
Cohesion: 0.15
Nodes (15): create_limiter(), _is_testing(), Shared slowapi HTTP rate limiter for the FastAPI app. HTTP rate limits use this…, Memory in testing; Redis (service_settings.redis_url) otherwise., _storage_uri(), AsyncClient, asyncio, HTTP rate limit wiring seams (slowapi consolidation — issue #64). (+7 more)

### Community 63 - "Community 63"
Cohesion: 0.18
Nodes (12): r"""UUID version 7 features a time-ordered value field derived from the widely…, _subsec_encode(), uuid7(), Any, timedelta, Authentication-related factories for testing. This module provides factories…, Generate an expired token for testing expiration handling. Args: user_id: User…, Factory for generating JWT tokens for testing. (+4 more)

### Community 64 - "Community 64"
Cohesion: 0.16
Nodes (9): MockEmailService, Any, Email service mocks for testing., Mock implementation of email service for testing., Mock verification email sending., Mock password reset email sending., Clear the sent emails list., Get the last sent email. (+1 more)

### Community 65 - "Community 65"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 66 - "Community 66"
Cohesion: 0.24
Nodes (13): assert_main_clean(), build_docker_images(), clear_changelog_artifact(), create_git_tag(), generate_changelog(), invoke_direct_tag_mode(), invoke_release_pr_mode(), create-release.sh script (+5 more)

### Community 67 - "Community 67"
Cohesion: 0.23
Nodes (12): Any, Send an email using the emails library, which supports both development and…, Render a Jinja template from the email templates directory with the given…, Render a template and send it as an email., render_template(), send_email(), send_email_with_template(), Send a password reset email to a user. Args: email: The recipient's email… (+4 more)

### Community 68 - "Community 68"
Cohesion: 0.15
Nodes (8): MockOAuthProvider, Any, Mock user info retrieval., Set user info for a token., Add authorization code., Get requests, optionally filtered by method or URL., Mock OAuth provider for testing OAuth flows., Generate mock authorization URL.

### Community 69 - "Community 69"
Cohesion: 0.19
Nodes (16): asyncio, AsyncSession, fixture, Permission, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group (+8 more)

### Community 70 - "Community 70"
Cohesion: 0.22
Nodes (11): clearAuthTokens(), getStoredAccessToken(), removeStoredAccessToken(), removeStoredRefreshToken(), setStoredAccessToken(), setStoredRefreshToken(), api, ErrorResponseData (+3 more)

### Community 71 - "Community 71"
Cohesion: 0.32
Nodes (8): asyncio, AsyncSession, Test creating an audit log entry in the database, Test retrieving audit log entries for a specific actor, Test filtering audit logs by action type, test_create_audit_log(), test_filter_audit_logs_by_action(), test_retrieve_audit_logs()

### Community 72 - "Community 72"
Cohesion: 0.13
Nodes (16): get_permission_group_by_id(), get_permission_group_by_name(), AsyncSession, description, Path, PermissionGroup, Query, CircularDependencyException (+8 more)

### Community 73 - "Community 73"
Cohesion: 0.25
Nodes (8): AsyncFactoryBase, AsyncPermissionFactory, AsyncPermissionGroupFactory, AsyncRoleGroupFactory, AsyncSession, Async factory for creating Permission model instances., Base class for async-compatible factories., Async factory for creating RoleGroup model instances.

### Community 74 - "Community 74"
Cohesion: 0.16
Nodes (8): MockHTTPClient, MockHTTPResponse, External API mocks for testing., Mock HTTP response for testing., Raise exception for bad status codes., Mock HTTP client for testing external API calls., Set a specific response for method and URL., Clear request history.

### Community 75 - "Community 75"
Cohesion: 0.24
Nodes (10): Assert-MainClean(), Build-DockerImages(), Get-ReleaseNotesEntry(), Invoke-DirectTagMode(), Invoke-ReleasePrMode(), New-Changelog(), New-GitTag(), Confirm-Continue() (+2 more)

### Community 76 - "Community 76"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 77 - "Community 77"
Cohesion: 0.24
Nodes (13): get_test_data(), main(), Any, Session, Test endpoint with valid CSRF token and session with cookie., Get appropriate test data for each endpoint., Test CSRF token generation endpoint., Test endpoint without CSRF token (should fail). (+5 more)

### Community 78 - "Community 78"
Cohesion: 0.24
Nodes (10): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, dashboardSlice, DashboardState (+2 more)

### Community 79 - "Community 79"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 80 - "Community 80"
Cohesion: 0.67
Nodes (3): get_superuser_token_headers(), Get a superuser token for testing. This is a synchronous version for tests that…, TestClient

### Community 81 - "Community 81"
Cohesion: 0.24
Nodes (13): asyncio, AsyncSession, fixture, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group, Test creating a permission group in the database (+5 more)

### Community 82 - "Community 82"
Cohesion: 0.17
Nodes (12): DataTable(), DataTableColumn, OverviewChart(), ProfileContent(), StatsCard(), Avatar(), AvatarFallback(), AvatarImage() (+4 more)

### Community 83 - "Community 83"
Cohesion: 0.35
Nodes (6): CRUDPermissionGroup, Any, AsyncSession, Params, PermissionGroup, Get a permission group by name.

### Community 84 - "Community 84"
Cohesion: 0.23
Nodes (7): Permission, Role, RoleGroup, Create an admin role., Create a basic user role., Create basic user permissions., Create admin permissions.

### Community 85 - "Community 85"
Cohesion: 0.21
Nodes (7): Any, User, Create an admin user with a compliant password by default, or return existing…, Create a locked user., Create an unverified user., Create a basic RBAC setup with users, roles, and permissions., Create a user with the given parameters.

### Community 86 - "Community 86"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 87 - "Community 87"
Cohesion: 0.20
Nodes (6): Any, Build Redis connection parameters based on environment. Args: db: Redis…, Return whether Redis TLS should be used for the given mode., Resolve the directory that holds Redis TLS materials., Build kwargs for redis.asyncio.SSLConnection. redis-py asyncio does not accept…, Test connection parameters for development mode.

### Community 89 - "Community 89"
Cohesion: 0.36
Nodes (9): asyncio, AsyncSession, Test creating an entity with BaseUUIDModel as base class, Test updating an entity with BaseUUIDModel as base class, Test that UUIDs are unique for each instance, SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update() (+1 more)

### Community 90 - "Community 90"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 91 - "Community 91"
Cohesion: 0.20
Nodes (14): NestedRoleGroupProps, RoleGroupFormProps, RoleGroupRowProps, RoleFormProps, RoleGroup, RoleGroupCreate, RoleGroupResponse, RoleGroupUpdate (+6 more)

### Community 92 - "Community 92"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 93 - "Community 93"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 94 - "Community 94"
Cohesion: 0.22
Nodes (9): autoprefixer, clsx, dependencies, autoprefixer, clsx, @reduxjs/toolkit, tailwindcss, @reduxjs/toolkit (+1 more)

### Community 95 - "Community 95"
Cohesion: 0.22
Nodes (6): health_check(), Any, BackgroundTasks, get, Redis, Perform a health check of all critical system components, including: - API…

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (6): custom_swagger_ui_html(), get, An example "Hello world" FastAPI route., Serve Swagger UI with CSRF support for state-changing requests., root(), HTMLResponse

### Community 97 - "Community 97"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 100 - "Community 100"
Cohesion: 0.29
Nodes (7): AsyncClient, asyncio, AsyncSession, FastAPI, Example: How to mock dependencies for user creation in FastAPI tests. This…, Example test: user creation with comprehensive mocking., test_example_user_creation_with_mock()

### Community 101 - "Community 101"
Cohesion: 0.29
Nodes (4): Create a role with the given parameters., Generate a unique fake permission name., Create a permission with the given parameters., Create a model instance and save it to the database.

### Community 102 - "Community 102"
Cohesion: 0.25
Nodes (6): Provide all service mocks in a single fixture., service_mocks(), MockCeleryApp, Clear all task call history., Mock Celery application for testing., Get task calls, optionally filtered by task name.

### Community 103 - "Community 103"
Cohesion: 0.39
Nodes (7): normal_user_token_headers(), AsyncClient, AsyncSession, fixture, Authentication-related test fixtures., Return authentication headers for a superuser., superuser_token_headers()

### Community 104 - "Community 104"
Cohesion: 0.32
Nodes (8): asyncio, AsyncSession, Test updating user information, Test creating a user in the database, Test that users must have unique emails, test_create_user(), test_user_unique_email_constraint(), test_user_update()

### Community 105 - "Community 105"
Cohesion: 0.32
Nodes (8): asyncio, AsyncSession, Test creating a password history entry in the database, Test retrieving password history entries for a specific user, Test functionality to check for password reuse, test_check_password_reuse(), test_create_password_history(), test_retrieve_user_password_history()

### Community 106 - "Community 106"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 107 - "Community 107"
Cohesion: 0.43
Nodes (6): main(), retry, Check if the database is ready for connections., Check if Redis is ready for connections., wait_for_database(), wait_for_redis()

### Community 112 - "Community 112"
Cohesion: 0.43
Nodes (4): Any, HTTPException, UserNotFoundException, UserSelfDeleteException

### Community 113 - "Community 113"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 115 - "Community 115"
Cohesion: 0.33
Nodes (6): auth_headers(), fixture, Fixture for token generation in tests. This fixture creates proper tokens that…, Factory fixture to create tokens for testing., Factory fixture to create authentication headers for testing., token_factory()

### Community 116 - "Community 116"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 117 - "Community 117"
Cohesion: 0.60
Nodes (5): downgrade(), get_uuid_type(), has_column(), Check if a column exists in a table, upgrade()

### Community 118 - "Community 118"
Cohesion: 0.40
Nodes (5): downgrade(), get_uuid_type(), This migration fixes the case conflict between 'rolegroupmap' and…, For downgrade, we would remove any columns we added, but this is rarely needed…, upgrade()

### Community 119 - "Community 119"
Cohesion: 0.40
Nodes (5): estimate_password_strength(), load_common_passwords(), Tools for loading and validating common passwords., Load common passwords from files in the project's password lists directory., Estimate password strength using zxcvbn. Returns: dict: Password strength…

### Community 120 - "Community 120"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 121 - "Community 121"
Cohesion: 0.33
Nodes (5): Ensure Celery workers register task modules from app.worker., conf.imports keeps task registration for celery -A app.celery_app., Worker boot via app.celery_app must register security/email tasks., test_celery_app_imports_worker_tasks(), test_celery_config_lists_worker_imports()

### Community 123 - "Community 123"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 124 - "Community 124"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 125 - "Community 125"
Cohesion: 0.60
Nodes (4): downgrade(), has_column(), Check if a column exists in a table, upgrade()

### Community 126 - "Community 126"
Cohesion: 0.60
Nodes (4): downgrade(), Check if a table exists, table_exists(), upgrade()

### Community 127 - "Community 127"
Cohesion: 0.40
Nodes (5): get_csrf_token(), CsrfProtect, get, Response, Get CSRF token for frontend to use in state-changing operations. This endpoint…

### Community 128 - "Community 128"
Cohesion: 0.60
Nodes (5): after_insert_role(), after_update_role(), Connection, listens_for, Mapper

### Community 129 - "Community 129"
Cohesion: 0.40
Nodes (3): Any, field_validator, Override model_dump to customize role serialization

### Community 130 - "Community 130"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 132 - "Community 132"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 138 - "Community 138"
Cohesion: 0.50
Nodes (3): debug_cors(), Add this to the top of your main.py file after imports to debug CORS…, Add this function to your main.py file and call it before adding CORS middleware

### Community 140 - "Community 140"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 143 - "Community 143"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

## Knowledge Gaps
- **308 isolated node(s):** `ProtectedRouteProps`, `AppWrapperProps`, `LoadingScreenProps`, `MetaProps`, `SplashScreenProps` (+303 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **94 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 2` to `Community 129`, `Community 3`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 12`, `Community 17`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 29`, `Community 38`, `Community 50`, `Community 53`, `Community 55`, `Community 57`, `Community 69`, `Community 71`, `Community 81`, `Community 100`, `Community 104`, `Community 105`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `ModeEnum` connect `Community 58` to `Community 32`, `Community 35`, `Community 5`, `Community 107`, `Community 18`, `Community 52`, `Community 87`, `Community 62`, `Community 31`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `UUID` connect `Community 29` to `Community 2`, `Community 3`, `Community 5`, `Community 101`, `Community 6`, `Community 72`, `Community 12`, `Community 17`, `Community 49`, `Community 83`, `Community 50`, `Community 25`, `Community 22`, `Community 23`, `Community 57`, `Community 26`, `Community 30`, `Community 63`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 100 inferred relationships involving `User` (e.g. with `get_current_user()` and `change_password()`) actually correct?**
  _`User` has 100 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ProtectedRouteProps`, `AppWrapperProps`, `LoadingScreenProps` to the rest of the system?**
  _308 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06376811594202898 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08736842105263158 - nodes in this community are weakly interconnected._