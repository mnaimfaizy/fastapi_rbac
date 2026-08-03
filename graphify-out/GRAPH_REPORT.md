# Graph Report - .  (2026-08-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3377 nodes · 8304 edges · 290 communities (194 shown, 96 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 353 edges (avg confidence: 0.53)
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
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
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
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 228
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
- Community 256
- Community 257
- Community 273

## God Nodes (most connected - your core abstractions)
1. `cn()` - 130 edges
2. `User` - 106 edges
3. `random_lower_string()` - 103 edges
4. `Role` - 64 edges
5. `create_response()` - 63 edges
6. `get_csrf_token()` - 54 edges
7. `random_email()` - 51 edges
8. `AsyncUserFactory` - 49 edges
9. `Permission` - 45 edges
10. `IUserCreate` - 42 edges

## Surprising Connections (you probably didn't know these)
- `ServiceSettings` --uses--> `ModeEnum`  [INFERRED]
  backend/app/core/service_config.py → backend/app/core/config.py
- `CustomException` --uses--> `ModeEnum`  [INFERRED]
  backend/app/main.py → backend/app/core/config.py
- `SecurityHeadersMiddleware` --uses--> `ModeEnum`  [INFERRED]
  backend/app/main.py → backend/app/core/config.py
- `RedisConnectionFactory` --uses--> `ModeEnum`  [INFERRED]
  backend/app/utils/redis_connection.py → backend/app/core/config.py
- `TestRedisConnectionFactory` --uses--> `ModeEnum`  [INFERRED]
  backend/test/unit/test_redis_connection.py → backend/app/core/config.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (290 total, 96 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (60): DataTableProps, DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel() (+52 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (60): BaseUUIDModel, datetime, field_validator, SQLModel, PermissionGroup, PermissionGroup model for the application., Permission, PermissionBase (+52 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (56): This module contains the dependency injection utilities used across the FastAPI…, get_permission_group_by_id(), Gets a permission group by its ID, assign_roles_to_user(), bulk_update_users(), create_user(), get_my_data(), get_user_by_id() (+48 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (47): AsyncClient, asyncio, AsyncSession, Permission management integration tests. Tests the complete permission…, Test complete CRUD operations for permission groups., Test operations on permission groups that contain permissions., Integration tests for permission management flows., Test permission listing and pagination. (+39 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (48): LoginForm(), LoginFormData, loginSchema, SignupForm(), SignupFormData, signupSchema, ChangePasswordContent(), PasswordChangeFormData (+40 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (49): AsyncRoleFactory, AsyncUserFactory, Generate a unique fake role name., Async factory for creating User model instances., Generate a unique fake email., Generate a fake name., admin_user(), basic_rbac_setup() (+41 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (51): react, react, FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem() (+43 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (45): Sidebar(), SidebarProps, MainLayout(), AlertDialogOverlay(), buttonVariants, CardAction(), Command(), CommandGroup() (+37 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (32): Any, post_generation, Role, SQLAlchemyModelFactory, User, Factory for creating User model instances., Start sequence from a random point to avoid conflicts., Add roles to the user if provided. (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (34): AsyncClient, asyncio, AsyncSession, patch, Comprehensive authentication API endpoint tests - FIXED VERSION. This module…, Test login endpoint structure when registration fails., Test the password reset functionality, ensuring users can securely reset their…, Test security features of authentication. (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (34): InitAuth(), ProtectedRoute(), ProtectedRouteProps, AppWrapper(), AppWrapperProps, LoadingScreen(), LoadingScreenProps, Meta() (+26 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (32): CRUDRole, Any, AsyncSession, Page, Params, Permission, Redis, Role (+24 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (39): r"""UUID draft version objects (universally unique identifiers). This module…, r"""UUID version 7 features a time-ordered value field derived from the widely…, _subsec_encode(), uuid7(), AsyncClient, asyncio, AsyncSession, FastAPI (+31 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (24): AsyncPermissionFactory, AsyncPermissionGroupFactory, Any, AsyncSession, Permission, PermissionGroup, Role, RoleGroup (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (42): AsyncRedis, change_password(), confirm_password_reset(), get_new_access_token(), login(), login_access_token(), logout(), AsyncSession (+34 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (11): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (38): CRUDPermission, Create multiple permissions in a single database transaction. Args:…, IPermissionGroupCreate, IPermissionCreate, IPermissionUpdate, asyncio, AsyncSession, Test retrieving a permission by ID with relationships loaded (+30 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (36): assign_permissions_to_role(), create_role(), delete_role(), get_all_roles_list(), get_role_by_id(), get_roles(), AsyncSession, BackgroundTasks (+28 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (37): IRoleCreate, asyncio, AsyncSession, Test retrieving multiple roles with pagination, Test retrieving all roles without pagination, Test adding a role to a user, Test creating a role through CRUD operations, Test adding a non-existent role to a user raises ValueError (+29 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (20): CRUDUser, AsyncSession, EmailStr, User, Create a user. Requires db_session to be provided explicitly., Retrieve a user by email. Requires db_session to be provided explicitly., Update is_active for a list of users. Requires db_session to be provided…, Authenticate a user by email and password. Requires db_session to be provided… (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.08
Nodes (17): fixture, Redis-related test fixtures., Provide a stateful Redis mock so JWT allowlist sets work in tests (#73)., redis_mock(), enhanced_redis_mock(), mock_send_email(), fixture, Service mocks for testing. This module provides mock implementations of service… (+9 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (33): create_permission(), delete_permission(), get_permission_by_id(), get_permissions(), AsyncSession, delete, get, Params (+25 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (35): add_roles_to_group(), bulk_create_role_groups(), bulk_delete_role_groups(), clone_role_group(), create_role_group(), delete_role_group(), get_role_group_by_id(), get_role_groups() (+27 more)

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (34): IRoleGroupCreate, asyncio, AsyncSession, fixture, User, Test retrieving all role groups without pagination, Test creating and retrieving hierarchical role groups, Test adding roles to a role group (+26 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (19): CRUDRoleGroup, Any, AsyncSession, RoleGroup, User, Create multiple role groups in a single transaction, Delete multiple role groups in a single transaction, Synchronize roles with their role groups based on the role_group_id field. This… (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (31): Verify a password against its hash., IUserCreate, IUserUpdate, asyncio, AsyncSession, Test updating a user's password, Test creating a user through CRUD operations, Test user authentication (+23 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (29): add_token_claims(), create_access_token(), create_refresh_token(), create_reset_token(), create_verification_token(), decode_token(), get_content(), get_data_encrypt() (+21 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (28): IGenderEnum, IUserMessage, BaseModel, Enum, str, TokenType, cleanup_expired_tokens(), _cleanup_tokens_task() (+20 more)

### Community 28 - "Community 28"
Cohesion: 0.06
Nodes (30): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+22 more)

### Community 29 - "Community 29"
Cohesion: 0.16
Nodes (25): Any, field_validator, User model for the application., Get list of role names for serialization, Override model_dump to customize role serialization, User, UserBase, INewPassword (+17 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (26): Authentication-related test fixtures., asyncio, AsyncSession, Test updating user information, Test creating a user in the database, Test assigning roles to a user, Test that users must have unique emails, test_create_user() (+18 more)

### Community 31 - "Community 31"
Cohesion: 0.09
Nodes (25): DBType, Any, Enum, str, Test configuration settings for managing the test environment. This allows for…, Test TestConfig.get_db_uri for SQLite, Test TestConfig.get_db_uri for PostgreSQL, Test TestConfig.get_connection_args method (+17 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (24): PermissionGroupRow(), PermissionDetail(), PermissionForm(), PermissionFormContent(), PermissionsContent(), PermissionsDataTable(), RoleGroupContent(), RoleGroupList() (+16 more)

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (16): CRUDBase, Any, AsyncSession, ModelType, Page, Params, CRUD object with default methods to Create, Read, Update, Delete (CRUD).…, Get multiple records by their IDs. (+8 more)

### Community 34 - "Community 34"
Cohesion: 0.10
Nodes (16): Create and configure SSL context for Redis connections. Retained for…, patch, Test connection parameters for production mode with SSL., Test connection pool creation without TLS uses Connection., TLS pools must use SSLConnection (not Connection + ssl=True)., Test that connection pool is a singleton., Celery asyncio.run per task must not reuse a pool from a closed loop., Test getting a Redis client from the pool. (+8 more)

### Community 35 - "Community 35"
Cohesion: 0.17
Nodes (22): cmd_config(), cmd_down(), cmd_env(), cmd_exec(), cmd_health(), cmd_logs(), cmd_pull(), cmd_restart() (+14 more)

### Community 36 - "Community 36"
Cohesion: 0.17
Nodes (24): get_dashboard_data(), get_dashboard_stats(), get, Session, User, Retrieve dashboard stats (alias for /dashboard or /dashboard/stats)., Retrieve dashboard data. Data returned will vary based on the user's role., get_active_sessions_count() (+16 more)

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (21): AuditLog, AuditLogBase, Model for storing security audit logs, AuditLogFactory, Meta, Any, lazy_attribute, SQLAlchemyModelFactory (+13 more)

### Community 38 - "Community 38"
Cohesion: 0.10
Nodes (15): AsyncClient, asyncio, AsyncSession, Test that 404 errors are handled properly., Test that invalid JSON is handled properly., Test that method not allowed errors are handled., Test that database connection is working., Test that health endpoint is working. (+7 more)

### Community 39 - "Community 39"
Cohesion: 0.10
Nodes (18): close_redis_pool(), get_redis_client(), Redis, retry, Get a Redis client using the connection pool. Args: db: Redis database number…, Perform a health check on Redis connection. Args: client: Optional Redis client…, Close the connection pool and cleanup resources., Get a Redis client instance. Args: db: Redis database number (default: 0)… (+10 more)

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (24): auth_headers(), db_factories(), make_admin_user(), make_audit_log(), make_permission(), make_permission_group(), make_role(), make_role_group() (+16 more)

### Community 41 - "Community 41"
Cohesion: 0.11
Nodes (24): background_tasks_mock(), celery_mock(), celery_task_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), http_client_mock(), oauth_provider_mock() (+16 more)

### Community 42 - "Community 42"
Cohesion: 0.10
Nodes (12): MockCeleryResult, MockCeleryTask, Any, Celery service mocks for testing., Mock Celery task for testing., Mock task.delay() method., Mock task.apply_async() method., Clear the task call history. (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.14
Nodes (24): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), Comprehensive test runner for the refactored test suite. This script provides…, Run all tests (unit + integration) in Docker Compose for correct environment… (+16 more)

### Community 44 - "Community 44"
Cohesion: 0.14
Nodes (21): Any, Input sanitization utilities for XSS prevention and data cleaning. This module…, Sanitize email address input. Args: email: The email address to sanitize…, Sanitize search query input to prevent injection attacks. Args: query: The…, Recursively sanitize string values in a dictionary/JSON object. Args: data:…, Sanitize URL input to prevent XSS and injection attacks. Args: url: The URL to…, Sanitize input value based on field type. Args: value: The value to sanitize…, Sanitize all string values in a dictionary. Args: data: Dictionary to sanitize… (+13 more)

### Community 45 - "Community 45"
Cohesion: 0.16
Nodes (11): RegisterForm(), LoginCredentials, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, Token, TokenRead, UserRegister (+3 more)

### Community 46 - "Community 46"
Cohesion: 0.16
Nodes (15): AuthState, Permission, ApiResponse, PaginatedItems, Role, User, ApiError, UserCreatePayload (+7 more)

### Community 47 - "Community 47"
Cohesion: 0.11
Nodes (21): AsyncEngine, get_or_create_superuser(), init_db(), AsyncSession, create_init_data(), main(), Create initial database data if it doesn't exist., Main function to run the initialization. (+13 more)

### Community 48 - "Community 48"
Cohesion: 0.16
Nodes (11): get_settings_dependency(), Any, field_validator, model_validator, Build Redis URL for Celery broker and backend, Validate that critical settings are properly set in production mode, Return a dictionary of settings that vary by environment, Settings (+3 more)

### Community 49 - "Community 49"
Cohesion: 0.15
Nodes (17): PermissionGroupBase, IPermissionGroupBase, IPermissionGroupRead, IPermissionGroupReadWithPermissions, IPermissionGroupWithPermissions, Any, BaseModel, model_validator (+9 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (22): IPermissionGroupUpdate, asyncio, AsyncSession, Test deleting a permission group, Test adding permissions to a permission group, Test creating a permission group through CRUD operations, Test permission groups with subgroups relationship, Test counting permissions by group (+14 more)

### Community 51 - "Community 51"
Cohesion: 0.12
Nodes (18): Checkbox(), CommandEmpty(), Popover(), PopoverContent(), PopoverTrigger(), ApiError, ApiResponse, FormFields (+10 more)

### Community 52 - "Community 52"
Cohesion: 0.10
Nodes (12): Any, Service configuration for environment-specific settings. Manages Redis, Celery,…, Get email configuration based on environment, Environment-specific service settings for Celery, Redis, and other external…, Get database URL based on environment, Get the Redis URL based on current environment. For production, uses rediss://…, Get the Celery broker URL based on current environment, Get the Celery result backend URL based on current environment (+4 more)

### Community 53 - "Community 53"
Cohesion: 0.15
Nodes (20): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), Exception, JSONResponse, Request, Response (+12 more)

### Community 54 - "Community 54"
Cohesion: 0.13
Nodes (16): App(), createTestStoreForRoleList(), ExtendedRenderOptions, renderRoleListWithMockedDispatch(), AppStore, createTestStore(), ExtendedRenderOptions, mockPermissions (+8 more)

### Community 55 - "Community 55"
Cohesion: 0.17
Nodes (17): NestedRoleGroupProps, RoleGroupFormProps, RoleGroupRowProps, RoleFormProps, RoleGroup, RoleGroupCreate, RoleGroupResponse, RoleGroupUpdate (+9 more)

### Community 56 - "Community 56"
Cohesion: 0.14
Nodes (10): PaginatedData, PaginatedPermissionGroupResponse, PaginatedPermissionResponse, PermissionCreate, PermissionGroupCreate, PermissionGroupResponse, PermissionGroupUpdate, PermissionResponse (+2 more)

### Community 57 - "Community 57"
Cohesion: 0.14
Nodes (12): Any, Build Redis connection parameters based on environment. Args: db: Redis…, Create a connection pool for Redis. Args: db: Redis database number…, Drop the cached pool without awaiting disconnect. Used when the owning asyncio…, Get or create a singleton connection pool. Args: db: Redis database number…, Factory class for creating and managing Redis connections with SSL support.…, Return whether Redis TLS should be used for the given mode., Resolve the directory that holds Redis TLS materials. (+4 more)

### Community 58 - "Community 58"
Cohesion: 0.17
Nodes (16): PaginatedDataResponse, PaginatedResponse, PaginationParams, Role, RoleCreate, RolePermissionAssign, RolePermissionUnassign, RoleResponse (+8 more)

### Community 59 - "Community 59"
Cohesion: 0.13
Nodes (11): AsyncSession, Permission, Check if a permission with the given name already exists. Args: name: The name…, Get a permission by its name. Args: name: The name of the permission to…, Assign multiple permissions to a role in a batch operation for improved…, Remove multiple permissions from a role in a batch operation. Args: role_id:…, Check if a permission is currently assigned to any role. Args: permission_id:…, Alias for get_permission_by_name. (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 61 - "Community 61"
Cohesion: 0.15
Nodes (16): Centralized Celery configuration for the FastAPI RBAC system. This module…, _log_security_event_task(), Background tasks module for FastAPI RBAC system. This module provides utility…, The actual task that logs a security event to the audit log., cleanup_tokens_task(), log_security_event_task(), process_account_lockout_task(), Any (+8 more)

### Community 62 - "Community 62"
Cohesion: 0.16
Nodes (16): get_strict_sanitizer(), Get strict input sanitizer for sensitive operations. Returns: InputSanitizer:…, ensure_utc(), get_csrf_token(), CsrfProtect, datetime, Response, Get CSRF token for frontend to use in state-changing operations. This endpoint… (+8 more)

### Community 63 - "Community 63"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 64 - "Community 64"
Cohesion: 0.15
Nodes (15): create_limiter(), _is_testing(), Shared slowapi HTTP rate limiter for the FastAPI app. HTTP rate limits use this…, Memory in testing; Redis (service_settings.redis_url) otherwise., _storage_uri(), AsyncClient, asyncio, HTTP rate limit wiring seams (slowapi consolidation — issue #64). (+7 more)

### Community 65 - "Community 65"
Cohesion: 0.19
Nodes (14): PasswordValidator, Password validation helper class., Track password changes for compliance and security. This helps prevent password…, UserPasswordHistory, UserPasswordHistoryBase, Meta, asyncio, AsyncSession (+6 more)

### Community 66 - "Community 66"
Cohesion: 0.16
Nodes (9): MockEmailService, Any, Email service mocks for testing., Mock implementation of email service for testing., Mock verification email sending., Mock password reset email sending., Clear the sent emails list., Get the last sent email. (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.21
Nodes (12): prepare_env(), bootstrap-api.sh script, prepare_env(), bootstrap-worker.sh script, ensure_env_file(), fill_secrets_and_tokens(), require_docker(), require_host_ca_bundle() (+4 more)

### Community 68 - "Community 68"
Cohesion: 0.13
Nodes (17): @eslint/js, eslint-plugin-react-hooks, jsdom, devDependencies, @eslint/js, eslint-plugin-react-hooks, jsdom, @testing-library/dom (+9 more)

### Community 69 - "Community 69"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 70 - "Community 70"
Cohesion: 0.24
Nodes (13): assert_main_clean(), build_docker_images(), clear_changelog_artifact(), create_git_tag(), generate_changelog(), invoke_direct_tag_mode(), invoke_release_pr_mode(), create-release.sh script (+5 more)

### Community 71 - "Community 71"
Cohesion: 0.15
Nodes (15): AbstractParams, rate_limit_handler(), Handle attempts by users to delete their own account., Handle rate limit exceeded exceptions, user_self_delete_exception_handler(), create_error_response(), ErrorDetail, IErrorResponse (+7 more)

### Community 72 - "Community 72"
Cohesion: 0.15
Nodes (15): get_current_user(), get_db(), Any, AsyncSession, User, Get database session for dependency injection. Uses AsyncSession to ensure all…, app(), client() (+7 more)

### Community 73 - "Community 73"
Cohesion: 0.16
Nodes (16): create_permission_group(), delete_permission_group(), get_permission_groups(), AsyncSession, delete, get, Params, PermissionGroup (+8 more)

### Community 74 - "Community 74"
Cohesion: 0.14
Nodes (13): Scheduled tasks configuration for Celery Beat. This module defines recurring…, custom_swagger_ui_html(), get_csrf_config(), lifespan(), FastAPI, get, An example "Hello world" FastAPI route., Serve Swagger UI with CSRF support for state-changing requests. (+5 more)

### Community 75 - "Community 75"
Cohesion: 0.23
Nodes (12): Any, Send an email using the emails library, which supports both development and…, Render a Jinja template from the email templates directory with the given…, Render a template and send it as an email., render_template(), send_email(), send_email_with_template(), Send a password reset email to a user. Args: email: The recipient's email… (+4 more)

### Community 76 - "Community 76"
Cohesion: 0.15
Nodes (8): MockOAuthProvider, Any, Mock user info retrieval., Set user info for a token., Add authorization code., Get requests, optionally filtered by method or URL., Mock OAuth provider for testing OAuth flows., Generate mock authorization URL.

### Community 77 - "Community 77"
Cohesion: 0.19
Nodes (16): asyncio, AsyncSession, fixture, Permission, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group (+8 more)

### Community 78 - "Community 78"
Cohesion: 0.16
Nodes (8): MockHTTPClient, MockHTTPResponse, External API mocks for testing., Mock HTTP response for testing., Raise exception for bad status codes., Mock HTTP client for testing external API calls., Set a specific response for method and URL., Clear request history.

### Community 79 - "Community 79"
Cohesion: 0.17
Nodes (12): DataTable(), DataTableColumn, OverviewChart(), ProfileContent(), StatsCard(), Avatar(), AvatarFallback(), AvatarImage() (+4 more)

### Community 80 - "Community 80"
Cohesion: 0.24
Nodes (10): Assert-MainClean(), Build-DockerImages(), Get-ReleaseNotesEntry(), Invoke-DirectTagMode(), Invoke-ReleasePrMode(), New-Changelog(), New-GitTag(), Confirm-Continue() (+2 more)

### Community 81 - "Community 81"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 82 - "Community 82"
Cohesion: 0.23
Nodes (7): Globals, Any, Get the value of a variable., Clear all variables and free memory., Set a default value for a variable., Get the default value for a variable., Ensure a ContextVar exists for a variable.

### Community 83 - "Community 83"
Cohesion: 0.18
Nodes (10): Any, Permission, PermissionGroup, post_generation, Role, Session, Add permissions to the role if provided., Create role with specific permissions. (+2 more)

### Community 84 - "Community 84"
Cohesion: 0.25
Nodes (13): get_test_data(), main(), Any, Session, Test endpoint with valid CSRF token and session with cookie., Get appropriate test data for each endpoint., Test CSRF token generation endpoint., Test endpoint without CSRF token (should fail). (+5 more)

### Community 85 - "Community 85"
Cohesion: 0.24
Nodes (11): Skeleton(), RoleDetail(), RoleFormData, RoleFormContent(), assignPermissionsToRole, createRole, fetchRoleById, initialState (+3 more)

### Community 86 - "Community 86"
Cohesion: 0.23
Nodes (10): clearAuthTokens(), getStoredAccessToken(), removeStoredAccessToken(), removeStoredRefreshToken(), setStoredAccessToken(), setStoredRefreshToken(), api, ErrorResponseData (+2 more)

### Community 87 - "Community 87"
Cohesion: 0.24
Nodes (10): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, dashboardSlice, DashboardState (+2 more)

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 89 - "Community 89"
Cohesion: 0.21
Nodes (10): DatabaseTypeEnum, get_project_root(), get_settings(), ModeEnum, Enum, str, Get the project root path based on environment, Retrieve and cache application settings. (+2 more)

### Community 90 - "Community 90"
Cohesion: 0.27
Nodes (12): AsyncClient, asyncio, Integration tests for Redis JWT allowlist enforcement (#73). Seam: auth HTTP…, JSON login must always write both access and refresh tokens into Redis., A cryptographically valid refresh JWT must fail when Redis set is empty., First OAuth2 login must allowlist the access token; logout must revoke it., After logout, a previously issued refresh token must be rejected., test_json_login_writes_access_and_refresh_allowlist() (+4 more)

### Community 91 - "Community 91"
Cohesion: 0.24
Nodes (13): asyncio, AsyncSession, fixture, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group, Test creating a permission group in the database (+5 more)

### Community 92 - "Community 92"
Cohesion: 0.35
Nodes (6): CRUDPermissionGroup, Any, AsyncSession, Params, PermissionGroup, Get a permission group by name.

### Community 93 - "Community 93"
Cohesion: 0.24
Nodes (8): Any, timedelta, Generate an expired token for testing expiration handling. Args: user_id: User…, Factory for generating JWT tokens for testing., Generate a test access token. Args: user_id: User ID to include in the token…, Generate a test refresh token. Args: user_id: User ID to include in the token…, Generate authentication headers for testing. Args: access_token: Optional pre-…, TokenFactory

### Community 94 - "Community 94"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 95 - "Community 95"
Cohesion: 0.20
Nodes (9): ASGIApp, globals_middleware_dispatch(), GlobalsMiddleware, BaseHTTPMiddleware, Request, Response, This allows to use global variables inside the FastAPI application using async…, Dispatch the request in a new context to allow globals to be used. (+1 more)

### Community 96 - "Community 96"
Cohesion: 0.22
Nodes (11): process_account_lockout(), _process_account_lockout_task(), AsyncSession, BackgroundTasks, User, Process account lockout in the background. Args: background_tasks:…, The actual task that processes an account lockout., Send a password reset email as a background task. Args: background_tasks: The… (+3 more)

### Community 97 - "Community 97"
Cohesion: 0.29
Nodes (5): CircularDependencyException, Any, Exception, ModelType, Exception raised when a circular dependency is detected

### Community 98 - "Community 98"
Cohesion: 0.27
Nodes (7): BaseHTTPMiddleware, Middleware to add security headers to all responses. Implements defense-in-…, SecurityHeadersMiddleware, Any, HTTPException, UserNotFoundException, UserSelfDeleteException

### Community 99 - "Community 99"
Cohesion: 0.20
Nodes (8): comprehensive_mocks(), Provide comprehensive mocks for integration testing., Provide all service mocks in a single fixture., service_mocks(), MockCeleryApp, Clear all task call history., Mock Celery application for testing., Get task calls, optionally filtered by task name.

### Community 100 - "Community 100"
Cohesion: 0.36
Nodes (9): asyncio, AsyncSession, Test creating an entity with BaseUUIDModel as base class, Test updating an entity with BaseUUIDModel as base class, Test that UUIDs are unique for each instance, SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update() (+1 more)

### Community 101 - "Community 101"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 102 - "Community 102"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 103 - "Community 103"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 104 - "Community 104"
Cohesion: 0.22
Nodes (9): autoprefixer, axios, @hookform/resolvers, @radix-ui/react-select, dependencies, autoprefixer, axios, @hookform/resolvers (+1 more)

### Community 105 - "Community 105"
Cohesion: 0.22
Nodes (6): Hash a password with bcrypt with enhanced security. - Uses a high work factor…, Any, Update a user. Requires db_session to be provided explicitly., Create a user with roles. Requires db_session to be provided explicitly., Test password hashing and verification, test_password_hashing()

### Community 106 - "Community 106"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 107 - "Community 107"
Cohesion: 0.25
Nodes (8): get_csrf_protect(), CsrfProtect, Request, Set the global CSRF protect instance. Called from main.py during application…, Get the CSRF protection instance for dependency injection. Returns:…, Validate CSRF token for state-changing operations. Args: request: The FastAPI…, set_csrf_protect_instance(), validate_csrf_token()

### Community 108 - "Community 108"
Cohesion: 0.29
Nodes (7): get_async_session(), get_redis_client(), Any, AsyncSession, Redis, Create and get async database session. This function yields an AsyncSession for…, Get Redis client instance as an async generator. Yields a Redis client…

### Community 109 - "Community 109"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 110 - "Community 110"
Cohesion: 0.25
Nodes (7): initialRoleGroupState, mockAuthState, MockedFunction, mockRoleGroups, mockUser, mockUsers, rootReducer

### Community 111 - "Community 111"
Cohesion: 0.43
Nodes (6): main(), retry, Check if the database is ready for connections., Check if Redis is ready for connections., wait_for_database(), wait_for_redis()

### Community 112 - "Community 112"
Cohesion: 0.38
Nodes (6): get_cached_celery_config(), get_celery_config(), Any, Celery configuration module for the FastAPI RBAC project. This module provides…, Get cached Celery configuration. Uses lru_cache to cache the configuration and…, Get Celery configuration dictionary with all necessary settings. Returns:…

### Community 113 - "Community 113"
Cohesion: 0.33
Nodes (7): get_permission_by_id(), get_permission_by_name(), AsyncSession, description, Path, Permission, Query

### Community 114 - "Community 114"
Cohesion: 0.33
Nodes (7): get_permission_group_by_id(), get_permission_group_by_name(), AsyncSession, description, Path, PermissionGroup, Query

### Community 115 - "Community 115"
Cohesion: 0.33
Nodes (7): get_user_role_by_id(), get_user_role_by_name(), AsyncSession, Path, Query, Role, title

### Community 116 - "Community 116"
Cohesion: 0.33
Nodes (7): get_group_by_id(), get_group_by_name(), AsyncSession, description, Path, Query, RoleGroup

### Community 117 - "Community 117"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 119 - "Community 119"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 120 - "Community 120"
Cohesion: 0.40
Nodes (5): do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, Run migrations in 'online' mode. In this scenario we need to create an Engine…, run_migrations_offline(), run_migrations_online()

### Community 121 - "Community 121"
Cohesion: 0.60
Nodes (5): downgrade(), get_uuid_type(), has_column(), Check if a column exists in a table, upgrade()

### Community 122 - "Community 122"
Cohesion: 0.40
Nodes (5): downgrade(), get_uuid_type(), This migration fixes the case conflict between 'rolegroupmap' and…, For downgrade, we would remove any columns we added, but this is rarely needed…, upgrade()

### Community 123 - "Community 123"
Cohesion: 0.33
Nodes (6): health_check(), Any, BackgroundTasks, get, Redis, Perform a health check of all critical system components, including: - API…

### Community 124 - "Community 124"
Cohesion: 0.40
Nodes (5): estimate_password_strength(), load_common_passwords(), Tools for loading and validating common passwords., Load common passwords from files in the project's password lists directory., Estimate password strength using zxcvbn. Returns: dict: Password strength…

### Community 125 - "Community 125"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 126 - "Community 126"
Cohesion: 0.53
Nodes (6): normal_user_token_headers(), AsyncClient, AsyncSession, fixture, Return authentication headers for a superuser., superuser_token_headers()

### Community 127 - "Community 127"
Cohesion: 0.33
Nodes (5): Ensure Celery workers register task modules from app.worker., conf.imports keeps task registration for celery -A app.celery_app., Worker boot via app.celery_app must register security/email tasks., test_celery_app_imports_worker_tasks(), test_celery_config_lists_worker_imports()

### Community 128 - "Community 128"
Cohesion: 0.53
Nodes (5): RoleGroupForm(), RoleGroupFormContent(), createRoleGroup, fetchRoleGroupById, updateRoleGroup

### Community 130 - "Community 130"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 131 - "Community 131"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 132 - "Community 132"
Cohesion: 0.60
Nodes (4): downgrade(), has_column(), Check if a column exists in a table, upgrade()

### Community 133 - "Community 133"
Cohesion: 0.60
Nodes (4): downgrade(), Check if a table exists, table_exists(), upgrade()

### Community 134 - "Community 134"
Cohesion: 0.60
Nodes (5): after_insert_role(), after_update_role(), Connection, listens_for, Mapper

### Community 135 - "Community 135"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 136 - "Community 136"
Cohesion: 0.40
Nodes (4): fixture, Create a mock Redis connection pool., Reset RedisConnectionFactory singleton state between tests., _reset_factory()

### Community 138 - "Community 138"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 144 - "Community 144"
Cohesion: 0.50
Nodes (3): debug_cors(), Add this to the top of your main.py file after imports to debug CORS…, Add this function to your main.py file and call it before adding CORS middleware

### Community 146 - "Community 146"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 149 - "Community 149"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

### Community 167 - "Community 167"
Cohesion: 0.67
Nodes (3): get_fernet_key(), Generate a valid Fernet key from an input string. Uses SHA-256 to derive a…, Fernet

### Community 174 - "Community 174"
Cohesion: 0.67
Nodes (3): Map decode_token HTTPException details to typed security audit event names., test_map_jwt_http_error_to_event(), parametrize

## Knowledge Gaps
- **309 isolated node(s):** `PageBase`, `generate-certs.sh script`, `01-init-user.sh script`, `02-init-db.sh script`, `01-init-user.sh script` (+304 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **96 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 29` to `Community 1`, `Community 2`, `Community 5`, `Community 8`, `Community 11`, `Community 12`, `Community 13`, `Community 17`, `Community 18`, `Community 19`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 27`, `Community 30`, `Community 36`, `Community 37`, `Community 49`, `Community 61`, `Community 62`, `Community 65`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `ModeEnum` connect `Community 89` to `Community 64`, `Community 98`, `Community 34`, `Community 39`, `Community 74`, `Community 108`, `Community 111`, `Community 112`, `Community 48`, `Community 52`, `Community 53`, `Community 57`, `Community 61`, `Community 62`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `UUID` connect `Community 11` to `Community 1`, `Community 2`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 19`, `Community 21`, `Community 22`, `Community 24`, `Community 27`, `Community 33`, `Community 37`, `Community 59`, `Community 61`, `Community 65`, `Community 92`, `Community 97`, `Community 113`, `Community 114`, `Community 115`, `Community 116`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 44 inferred relationships involving `User` (e.g. with `CRUDRole` and `CRUDRoleGroup`) actually correct?**
  _`User` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `Role` (e.g. with `CRUDRole` and `CRUDRoleGroup`) actually correct?**
  _`Role` has 30 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PageBase`, `generate-certs.sh script`, `01-init-user.sh script` to the rest of the system?**
  _309 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0999732691793638 - nodes in this community are weakly interconnected._