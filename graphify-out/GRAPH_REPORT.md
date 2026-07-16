# Graph Report - .  (2026-07-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3186 nodes · 7036 edges · 290 communities (201 shown, 89 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 989 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4a2b8a95`
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
- Community 150
- Community 151
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
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
- Community 222
- Community 223
- Community 224
- Community 225
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
- Community 245
- Community 246
- Community 247
- Community 248
- Community 249
- Community 250
- Community 251
- Community 253
- Community 289

## God Nodes (most connected - your core abstractions)
1. `cn()` - 130 edges
2. `UUID` - 124 edges
3. `random_lower_string()` - 92 edges
4. `User` - 90 edges
5. `Role` - 61 edges
6. `create_response()` - 57 edges
7. `AsyncUserFactory` - 46 edges
8. `get_csrf_token()` - 43 edges
9. `Permission` - 41 edges
10. `Button()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `Meta` --uses--> `AuditLog`  [INFERRED]
  backend/test/factories/audit_factory.py → backend/app/models/audit_log_model.py
- `login()` --indirect_call--> `User`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/models/user_model.py
- `login()` --calls--> `create_response()`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/schemas/response_schema.py
- `login()` --calls--> `process_account_lockout()`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/utils/background_tasks.py
- `login()` --calls--> `add_token_to_redis()`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/utils/token.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`

## Communities (290 total, 89 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (61): InitAuth(), LoginForm(), LoginFormData, loginSchema, ProtectedRoute(), ProtectedRouteProps, SignupForm(), AppWrapper() (+53 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (64): DataTableProps, DataTableColumnHeaderProps, DataTable(), DataTableProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent() (+56 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (58): DataTable(), DataTableColumn, OverviewChart(), StatsCard(), DataTableColumnHeader(), AlertDialogOverlay(), Avatar(), AvatarFallback() (+50 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (49): react, react, FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem() (+41 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (35): PasswordValidator, Password validation helper class., AsyncFactoryBase, AsyncPermissionFactory, AsyncPermissionGroupFactory, AsyncRoleFactory, AsyncRoleGroupFactory, AsyncTestDataBuilder (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (44): AsyncRedis, change_password(), confirm_password_reset(), ensure_utc(), get_new_access_token(), login(), login_access_token(), logout() (+36 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (31): SignupFormData, signupSchema, PasswordChangeFormData, passwordChangeSchema, OverviewChartData, OverviewChartProps, StatsCardProps, Alert() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (33): CRUDRoleGroup, Any, AsyncSession, RoleGroup, User, Create multiple role groups in a single transaction, Delete multiple role groups in a single transaction, Synchronize roles with their role groups based on the role_group_id field. (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (32): get_csrf_protect(), get_current_user(), get_db(), get_input_sanitizer(), get_permissive_sanitizer(), get_settings_dependency(), get_strict_sanitizer(), Any (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (24): Hash a password with bcrypt with enhanced security.          - Uses a high wor, CRUDUser, Any, AsyncSession, EmailStr, User, Create a user. Requires db_session to be provided explicitly., Update a user. Requires db_session to be provided explicitly. (+16 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (24): SQLAlchemyModelFactory, User-related model factories for testing., Factory for creating User model instances., Start sequence from a random point to avoid conflicts., UserFactory, AsyncSession, Enhanced unit tests for user CRUD operations.  This module demonstrates best p, Test successful user update. (+16 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (36): Updates a group by its id      Required roles:     - admin     - manager, update_permission_group(), add_roles_to_group(), bulk_create_role_groups(), bulk_delete_role_groups(), clone_role_group(), create_role_group(), delete_role_group() (+28 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (26): AsyncClient, AsyncSession, Comprehensive authentication API endpoint tests - FIXED VERSION.  This module, Test login endpoint structure when registration fails., Test the password reset functionality, ensuring users can securely         rese, Helper to register a user with CSRF token., Test security features of authentication., Test that a user's account is locked after multiple failed login attempts (+18 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (11): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (34): create_permission(), create_permission_group(), Creates a new role group      Required roles:     - admin     - manager, Creates a new role permission      Required roles:     - admin     - manager, PermissionGroup, PermissionGroup model for the application., Permission, PermissionBase (+26 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (36): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), lifespan(), Exception, FastAPI, JSONResponse (+28 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (38): IRoleCreate, Exception raised when a resource is not found, ResourceNotFoundException, AsyncSession, Test retrieving multiple roles with pagination, Test retrieving all roles without pagination, Test adding a role to a user, Test creating a role through CRUD operations (+30 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (21): enhanced_redis_mock(), mock_send_email(), MockRedisClient, Any, Service mocks for testing.  This module provides mock implementations of servi, Get all members of a set., Check if value is a member of a set., Get a field from a hash. (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (35): Verify a password against its hash., IUserCreate, normal_user_token_headers(), AsyncClient, AsyncSession, Authentication-related test fixtures., Return authentication headers for a superuser., superuser_token_headers() (+27 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (33): Skeleton(), PermissionGroupsContent(), PermissionGroupRow(), PermissionFormContent(), PermissionsContent(), RoleGroupContent(), RoleGroupDetail(), RoleGroupList() (+25 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (35): IPermissionGroupCreate, IPermissionCreate, IPermissionUpdate, AsyncSession, Test retrieving a permission by ID with relationships loaded, Test updating a permission, Test updating a permission's name, Test retrieving multiple permissions with pagination (+27 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (21): Any, Permission, PermissionGroup, Role, RoleGroup, User, Create an admin user with a compliant password by default, or return existing if, Create a locked user. (+13 more)

### Community 22 - "Community 22"
Cohesion: 0.08
Nodes (40): AbstractParams, assign_roles_to_user(), bulk_update_users(), create_user(), get_my_data(), get_user_by_id(), get_user_list_order_by_created_at(), Any (+32 more)

### Community 23 - "Community 23"
Cohesion: 0.09
Nodes (23): CRUDRole, Any, AsyncSession, Page, Permission, Redis, Role, User (+15 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (34): IRoleGroupCreate, AsyncSession, User, Test retrieving all role groups without pagination, Test creating and retrieving hierarchical role groups, Test adding roles to a role group, Create a test user for tests that require a user, Test removing roles from a role group (+26 more)

### Community 25 - "Community 25"
Cohesion: 0.07
Nodes (28): health_check(), Any, BackgroundTasks, Redis, Perform a health check of all critical system components, including:     - API, Any, Send an email using the emails library,     which supports both development and, Render a Jinja template from the email templates directory with the given contex (+20 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (20): Any, Build Redis connection parameters based on environment.          Args:, Create a connection pool for Redis.          Args:             db: Redis data, Get or create a singleton connection pool.          Args:             db: Red, Factory class for creating and managing Redis connections with SSL support., Create and configure SSL context for Redis connections.          Args:, RedisConnectionFactory, Test connection pool creation. (+12 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (29): assign_permissions_to_role(), create_role(), delete_role(), get_all_roles_list(), get_role_by_id(), get_roles(), AsyncSession, BackgroundTasks (+21 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (25): Any, User model for the application., Get list of role names for serialization, Override model_dump to customize role serialization, User, UserBase, INewPassword, IUserLoginSchema (+17 more)

### Community 29 - "Community 29"
Cohesion: 0.06
Nodes (30): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+22 more)

### Community 30 - "Community 30"
Cohesion: 0.09
Nodes (25): DBType, Any, Enum, str, Test configuration settings for managing the test environment. This allows for, Test TestConfig.get_db_uri for SQLite, Test TestConfig.get_db_uri for PostgreSQL, Test TestConfig.get_connection_args method (+17 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (17): NestedPermissionGroupProps, PermissionGroupRowProps, PaginatedData, PaginatedPermissionGroupResponse, PaginatedPermissionResponse, PermissionCreate, PermissionGroup, PermissionGroupCreate (+9 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (15): AuditLog, AuditLogBase, Model for storing security audit logs, BaseUUIDModel, datetime, SQLModel, Track password changes for compliance and security.      This helps prevent pa, UserPasswordHistory (+7 more)

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (21): NestedRoleGroupProps, RoleGroupFormProps, RoleGroupFormContent(), RoleGroupRowProps, RoleFormProps, RoleGroup, RoleGroupCreate, RoleGroupResponse (+13 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (16): getStoredAccessToken(), DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, api, ErrorDetail, ErrorResponseData (+8 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (17): UserEditForm(), AuthState, ApiResponse, PaginatedItems, Role, User, ApiError, UserCreatePayload (+9 more)

### Community 36 - "Community 36"
Cohesion: 0.11
Nodes (16): ASGIApp, Globals, globals_middleware_dispatch(), GlobalsMiddleware, Any, BaseHTTPMiddleware, Request, Response (+8 more)

### Community 37 - "Community 37"
Cohesion: 0.16
Nodes (13): CRUDBase, Any, AsyncSession, ModelType, Page, Params, CRUD object with default methods to Create, Read, Update, Delete (CRUD)., Get multiple records by their IDs. (+5 more)

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (17): generate_strong_password(), login_user(), promote_user_to_admin(), Any, AsyncClient, User management integration tests.  Tests the complete user management flow in, Generate a strong password that avoids sequential characters and meets complexit, Integration tests for user management flows (API-driven). (+9 more)

### Community 39 - "Community 39"
Cohesion: 0.14
Nodes (24): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), Comprehensive test runner for the refactored test suite.  This script provides, Run all tests (unit + integration) in Docker Compose for correct environment and (+16 more)

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (21): Any, Input sanitization utilities for XSS prevention and data cleaning.  This modul, Sanitize email address input.      Args:         email: The email address to, Sanitize search query input to prevent injection attacks.      Args:, Recursively sanitize string values in a dictionary/JSON object.      Args:, Sanitize URL input to prevent XSS and injection attacks.      Args:         u, Sanitize input value based on field type.          Args:             value: T, Sanitize all string values in a dictionary.          Args:             data: (+13 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (23): admin_user(), basic_rbac_setup(), locked_user(), permission_factory(), permission_group_factory(), Any, AsyncSession, User (+15 more)

### Community 42 - "Community 42"
Cohesion: 0.16
Nodes (12): RegisterForm(), LoginCredentials, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, Token, TokenRead, UserRegister (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.17
Nodes (18): PaginatedDataResponse, PaginatedResponse, PaginationParams, Role, RoleCreate, RolePermissionAssign, RolePermissionUnassign, RoleResponse (+10 more)

### Community 44 - "Community 44"
Cohesion: 0.15
Nodes (13): CRUDPermission, AsyncSession, Permission, Check if a permission with the given name already exists.          Args:, Create multiple permissions in a single database transaction.          Args:, Get a permission by its name.          Args:             name: The name of th, Assign multiple permissions to a role in a batch operation         for improved, Remove multiple permissions from a role in a batch operation.          Args: (+5 more)

### Community 45 - "Community 45"
Cohesion: 0.12
Nodes (19): create_mock_user(), dependency_overrider(), DependencyOverrider, mock_current_user_factory(), mock_dependency(), Any, FastAPI, T (+11 more)

### Community 46 - "Community 46"
Cohesion: 0.13
Nodes (21): auth_headers(), make_admin_user(), make_audit_log(), make_permission(), make_permission_group(), make_role(), make_role_group(), make_role_with_permissions() (+13 more)

### Community 47 - "Community 47"
Cohesion: 0.10
Nodes (12): Any, Service configuration for environment-specific settings. Manages Redis, Celery,, Get email configuration based on environment, Environment-specific service settings for Celery,     Redis, and other external, Get database URL based on environment, Get the Redis URL based on current environment.          For production, uses, Get the Celery broker URL based on current environment, Get the Celery result backend URL based on current environment (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.14
Nodes (21): IPermissionGroupUpdate, AsyncSession, Test deleting a permission group, Test adding permissions to a permission group, Test creating a permission group through CRUD operations, Test permission groups with subgroups relationship, Test counting permissions by group, Test retrieving a permission group by ID (+13 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (12): Redis, User, Enhanced token management utilities for secure session handling., Invalidate a specific token., Invalidate all tokens for a user (e.g., on password change)., Store token metadata in Redis for tracking., Check if a token is blacklisted., Count active sessions for a user. (+4 more)

### Community 50 - "Community 50"
Cohesion: 0.12
Nodes (13): AsyncClient, AsyncSession, Test basic system functionality., Test that database connection is working., Test that health endpoint is working., Test that API responds with correct version prefix., Test that CORS headers are present., Test that public endpoints are accessible without authentication. (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.16
Nodes (20): add_token_claims(), create_access_token(), create_refresh_token(), create_reset_token(), create_verification_token(), decode_token(), get_content(), get_data_encrypt() (+12 more)

### Community 52 - "Community 52"
Cohesion: 0.19
Nodes (12): AsyncClient, AsyncSession, Permission management integration tests.  Tests the complete permission manage, Test complete CRUD operations for permission groups., Test operations on permission groups that contain permissions., Integration tests for permission management flows., Test permission listing and pagination., Test handling of duplicate permission names. (+4 more)

### Community 53 - "Community 53"
Cohesion: 0.10
Nodes (19): background_tasks_mock(), celery_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), patched_external_services(), Enhanced mock fixtures for comprehensive testing.  This module provides pytest, Patch all external services with mocks. (+11 more)

### Community 54 - "Community 54"
Cohesion: 0.11
Nodes (12): celery_task_mock(), Provide a mock Celery task for testing., MockCeleryResult, MockCeleryTask, Celery service mocks for testing., Mock Celery task for testing., Mock task.delay() method., Mock task.apply_async() method. (+4 more)

### Community 55 - "Community 55"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 56 - "Community 56"
Cohesion: 0.14
Nodes (19): _cleanup_tokens_task(), cleanup_unverified_account(), _log_security_event_task(), process_account_lockout(), _process_account_lockout_task(), AsyncSession, BackgroundTasks, Redis (+11 more)

### Community 57 - "Community 57"
Cohesion: 0.16
Nodes (14): createTestStoreForRoleList(), ExtendedRenderOptions, renderRoleListWithMockedDispatch(), AppStore, createTestStore(), ExtendedRenderOptions, mockPermissions, mockRoleGroups (+6 more)

### Community 58 - "Community 58"
Cohesion: 0.14
Nodes (14): get_or_create_superuser(), init_db(), AsyncSession, create_init_data(), main(), Create initial database data if it doesn't exist., Main function to run the initialization., format_permission_name() (+6 more)

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (16): IBaseSchema, BaseModel, Base schema class providing common attributes and configuration, IPermissionRead, IRoleEnum, IRoleOutput, IRolePermissionAssign, IRolePermissionUnassign (+8 more)

### Community 60 - "Community 60"
Cohesion: 0.12
Nodes (12): close_redis_pool(), Enhanced Redis connection management with SSL support for production.  This mo, Close the connection pool and cleanup resources., Close the Redis connection pool., Test Redis connection factory for SSL/TLS connections.  These tests verify tha, Test closing the connection pool., Integration tests for Redis connection (requires Redis running)., Test actual connection to Redis (requires running Redis). (+4 more)

### Community 61 - "Community 61"
Cohesion: 0.13
Nodes (11): http_client_mock(), Provide a mock HTTP client for testing external API calls., MockHTTPClient, MockHTTPResponse, External API mocks for testing., Mock HTTP response for testing., Raise exception for bad status codes., Mock HTTP client for testing external API calls. (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.36
Nodes (10): login_user(), promote_user_to_admin(), Any, AsyncClient, Role management integration tests.  Tests the complete role management flow in, Integration tests for role management flows (API-driven)., Assign the admin role to a user using the seeded admin account, with retry for D, register_and_verify_user() (+2 more)

### Community 63 - "Community 63"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 64 - "Community 64"
Cohesion: 0.14
Nodes (9): oauth_provider_mock(), Provide a mock OAuth provider for testing OAuth flows., MockOAuthProvider, Any, Mock user info retrieval., Set user info for a token., Add authorization code., Mock OAuth provider for testing OAuth flows. (+1 more)

### Community 65 - "Community 65"
Cohesion: 0.16
Nodes (9): MockEmailService, Any, Email service mocks for testing., Mock implementation of email service for testing., Mock verification email sending., Mock password reset email sending., Clear the sent emails list., Get the last sent email. (+1 more)

### Community 66 - "Community 66"
Cohesion: 0.12
Nodes (17): eslint-config-prettier, eslint-plugin-prettier, eslint-plugin-react, devDependencies, eslint-config-prettier, eslint-plugin-prettier, eslint-plugin-react, @testing-library/user-event (+9 more)

### Community 67 - "Community 67"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 68 - "Community 68"
Cohesion: 0.25
Nodes (10): delete_permission(), get_permission_by_id(), get_permissions(), AsyncSession, Params, Permission, User, Deletes a permission by its id      Required roles:     - admin     - manage (+2 more)

### Community 69 - "Community 69"
Cohesion: 0.26
Nodes (13): get_dashboard_data(), get_dashboard_stats(), Session, User, Retrieve dashboard stats (alias for /dashboard or /dashboard/stats)., Retrieve dashboard data.     Data returned will vary based on the user's role., DashboardData, DashboardStats (+5 more)

### Community 70 - "Community 70"
Cohesion: 0.17
Nodes (5): PermissionGroupData, r"""UUID draft version objects, UUID, SafeUUID, TypedDict

### Community 71 - "Community 71"
Cohesion: 0.22
Nodes (8): CircularDependencyException, ContentNoChangeException, NameNotFoundException, Any, Exception, HTTPException, ModelType, Exception raised when a circular dependency is detected

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (8): comprehensive_mocks(), Provide comprehensive mocks for integration testing., MockCeleryApp, Any, Clear all task call history., Mock Celery application for testing., Mock send_task method., Get task calls, optionally filtered by task name.

### Community 73 - "Community 73"
Cohesion: 0.22
Nodes (14): AsyncSession, Permission, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group, Fixture to create a test permission, Test creating a permission in the database (+6 more)

### Community 74 - "Community 74"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 75 - "Community 75"
Cohesion: 0.24
Nodes (13): Role, Many-to-many relationship between Users and Roles with a composite primary key., UserRole, Meta, Test assigning roles to a user, test_user_with_roles(), AsyncSession, Test retrieving all users with a specific role (+5 more)

### Community 76 - "Community 76"
Cohesion: 0.26
Nodes (12): IGenderEnum, IOrderEnum, IUserMessage, BaseModel, Enum, str, TokenType, add_token_to_redis() (+4 more)

### Community 77 - "Community 77"
Cohesion: 0.20
Nodes (9): Any, timedelta, Authentication-related factories for testing.  This module provides factories, Generate an expired token for testing expiration handling.          Args:, Factory for generating JWT tokens for testing., Generate a test access token.          Args:             user_id: User ID to, Generate a test refresh token.          Args:             user_id: User ID to, Generate authentication headers for testing.          Args:             acces (+1 more)

### Community 78 - "Community 78"
Cohesion: 0.25
Nodes (13): get_test_data(), main(), Any, Session, Test endpoint with valid CSRF token and session with cookie., Get appropriate test data for each endpoint., Test CSRF token generation endpoint., Test endpoint without CSRF token (should fail). (+5 more)

### Community 79 - "Community 79"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 80 - "Community 80"
Cohesion: 0.18
Nodes (8): get_redis_client(), Redis, Get a Redis client using the connection pool.          Args:             db:, Perform a health check on Redis connection.          Args:             client, Get a Redis client instance.      Args:         db: Redis database number (de, Test getting a Redis client from the pool., Test successful health check., Test health check failure.

### Community 81 - "Community 81"
Cohesion: 0.17
Nodes (9): AuditLogFactory, Meta, Any, SQLAlchemyModelFactory, Audit log and related model factories for testing., Factory for creating AuditLog model instances., Generate a JSON-compatible details dictionary., Create an audit log entry for a specific user. (+1 more)

### Community 82 - "Community 82"
Cohesion: 0.19
Nodes (8): Any, Role, User, Add roles to the user if provided., Create a superuser/admin., Create a locked user., Create a user that needs to change password., Create an unverified user with verification code.

### Community 83 - "Community 83"
Cohesion: 0.35
Nodes (6): CRUDPermissionGroup, Any, AsyncSession, Params, PermissionGroup, Get a permission group by name.

### Community 84 - "Community 84"
Cohesion: 0.17
Nodes (8): Integration test: Basic system functionality for FastAPI RBAC backend.  This m, Test error handling functionality., Test that 404 errors are handled properly., Test that invalid JSON is handled properly., Test that method not allowed errors are handled., Test that all required imports are working., test_imports_working(), TestErrorHandling

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (11): AsyncSession, PermissionGroup, User, Fixture to create a test user, Fixture to create a test permission group, Test creating a permission group in the database, Test relationships of the permission group, test_create_permission_group() (+3 more)

### Community 86 - "Community 86"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 87 - "Community 87"
Cohesion: 0.25
Nodes (10): delete_permission_group(), get_permission_group_by_id(), get_permission_groups(), AsyncSession, Params, PermissionGroup, User, Deletes a permission group by its id      Required roles:     - admin     - (+2 more)

### Community 88 - "Community 88"
Cohesion: 0.31
Nodes (10): get_active_sessions_count(), get_active_users_count(), get_recent_logins(), get_system_users_summary(), get_total_permissions_count(), get_total_roles_count(), get_total_users_count(), AsyncSession (+2 more)

### Community 89 - "Community 89"
Cohesion: 0.35
Nodes (9): PermissionGroupBase, IPermissionGroupBase, IPermissionGroupRead, IPermissionGroupReadWithPermissions, IPermissionGroupWithPermissions, Any, BaseModel, Prevent infinite recursion in parent/child relationships (+1 more)

### Community 90 - "Community 90"
Cohesion: 0.22
Nodes (9): Test input validation for authentication endpoints., Test validation errors during registration., Test validation errors during login., TestAuthenticationValidation, get_csrf_token(), AsyncClient, Get CSRF token and return both the token and the headers needed for requests., Register a user with proper CSRF token handling.      Args:         client: A (+1 more)

### Community 91 - "Community 91"
Cohesion: 0.18
Nodes (10): Test token decoding function, Test password hashing and verification, Test JWT access token generation, Test JWT refresh token generation, Test that tokens expire correctly, test_access_token_generation(), test_decode_token(), test_password_hashing() (+2 more)

### Community 92 - "Community 92"
Cohesion: 0.29
Nodes (7): build_docker_images(), confirm_main_branch(), create_git_tag(), create-release.sh script, show_help(), test_git_available(), update_release_notes()

### Community 93 - "Community 93"
Cohesion: 0.24
Nodes (9): AsyncEngine, db(), db_engine(), initialize_db(), AsyncSession, Database-related test fixtures., Initialize the database for the test session., Create test database tables and return engine. (+1 more)

### Community 94 - "Community 94"
Cohesion: 0.27
Nodes (7): BaseHTTPMiddleware, Middleware to add security headers to all responses.     Implements defense-in-, SecurityHeadersMiddleware, Any, HTTPException, UserNotFoundException, UserSelfDeleteException

### Community 95 - "Community 95"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 96 - "Community 96"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 97 - "Community 97"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 98 - "Community 98"
Cohesion: 0.22
Nodes (9): axios, cmdk, @hookform/resolvers, @radix-ui/react-select, dependencies, axios, cmdk, @hookform/resolvers (+1 more)

### Community 99 - "Community 99"
Cohesion: 0.25
Nodes (7): r"""UUID draft version objects (universally unique identifiers). This module pr, r"""UUID version 7 features a time-ordered value field derived from the     wid, r"""UUID version 6 is a field-compatible version of UUIDv1, reordered for     i, _subsec_decode(), _subsec_encode(), uuid6(), uuid7()

### Community 100 - "Community 100"
Cohesion: 0.28
Nodes (8): app(), client(), AsyncClient, AsyncSession, FastAPI, FastAPI app test fixtures., Return a FastAPI app instance with test dependencies., Return a test client for the FastAPI app.

### Community 101 - "Community 101"
Cohesion: 0.36
Nodes (8): AsyncSession, Test creating an entity with BaseUUIDModel as base class, Test updating an entity with BaseUUIDModel as base class, Test that UUIDs are unique for each instance, SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update(), test_uuid_generation()

### Community 103 - "Community 103"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 104 - "Community 104"
Cohesion: 0.29
Nodes (7): get_async_session(), get_redis_client(), Any, AsyncSession, Redis, Create and get async database session.     This function yields an AsyncSession, Get Redis client instance as an async generator.     Yields a Redis client conf

### Community 105 - "Community 105"
Cohesion: 0.32
Nodes (7): get_permission_by_id(), get_permission_by_name(), AsyncSession, description, Path, Permission, Query

### Community 106 - "Community 106"
Cohesion: 0.32
Nodes (7): get_permission_group_by_id(), get_permission_group_by_name(), AsyncSession, description, Path, PermissionGroup, Query

### Community 107 - "Community 107"
Cohesion: 0.32
Nodes (7): get_user_role_by_id(), get_user_role_by_name(), AsyncSession, Path, Query, Role, title

### Community 108 - "Community 108"
Cohesion: 0.32
Nodes (7): get_group_by_id(), get_group_by_name(), AsyncSession, description, Path, Query, RoleGroup

### Community 109 - "Community 109"
Cohesion: 0.46
Nodes (7): is_valid_user(), is_valid_user_id(), AsyncSession, Path, title, user_exists(), IdNotFoundException

### Community 110 - "Community 110"
Cohesion: 0.57
Nodes (7): PasswordResetConfirm, PasswordResetRequest, BaseModel, RefreshToken, Token, TokenRead, IUserRead

### Community 111 - "Community 111"
Cohesion: 0.32
Nodes (7): AsyncSession, Test creating an audit log entry in the database, Test retrieving audit log entries for a specific actor, Test filtering audit logs by action type, test_create_audit_log(), test_filter_audit_logs_by_action(), test_retrieve_audit_logs()

### Community 112 - "Community 112"
Cohesion: 0.32
Nodes (7): AsyncSession, Test updating user information, Test creating a user in the database, Test that users must have unique emails, test_create_user(), test_user_unique_email_constraint(), test_user_update()

### Community 113 - "Community 113"
Cohesion: 0.32
Nodes (7): AsyncSession, Test creating a password history entry in the database, Test retrieving password history entries for a specific user, Test functionality to check for password reuse, test_check_password_reuse(), test_create_password_history(), test_retrieve_user_password_history()

### Community 114 - "Community 114"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 115 - "Community 115"
Cohesion: 0.25
Nodes (7): initialRoleGroupState, mockAuthState, MockedFunction, mockRoleGroups, mockUser, mockUsers, rootReducer

### Community 116 - "Community 116"
Cohesion: 0.38
Nodes (6): get_cached_celery_config(), get_celery_config(), Any, Celery configuration module for the FastAPI RBAC project. This module provides, Get cached Celery configuration.      Uses lru_cache to cache the configuratio, Get Celery configuration dictionary with all necessary settings.      Returns:

### Community 117 - "Community 117"
Cohesion: 0.43
Nodes (6): DatabaseTypeEnum, get_project_root(), ModeEnum, Enum, str, Get the project root path based on environment

### Community 118 - "Community 118"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 120 - "Community 120"
Cohesion: 0.33
Nodes (6): AsyncClient, AsyncSession, FastAPI, Example: How to mock dependencies for user creation in FastAPI tests.  This ex, Example test: user creation with comprehensive mocking., test_example_user_creation_with_mock()

### Community 121 - "Community 121"
Cohesion: 0.40
Nodes (5): do_run_migrations(), Run migrations in 'offline' mode.     This configures the context with just a U, Run migrations in 'online' mode.     In this scenario we need to create an Engi, run_migrations_offline(), run_migrations_online()

### Community 122 - "Community 122"
Cohesion: 0.60
Nodes (5): downgrade(), get_uuid_type(), has_column(), Check if a column exists in a table, upgrade()

### Community 123 - "Community 123"
Cohesion: 0.40
Nodes (5): downgrade(), get_uuid_type(), This migration fixes the case conflict between 'rolegroupmap' and 'RoleGroupMap', For downgrade, we would remove any columns we added,     but this is rarely nee, upgrade()

### Community 124 - "Community 124"
Cohesion: 0.47
Nodes (5): main(), Check if the database is ready for connections., Check if Redis is ready for connections., wait_for_database(), wait_for_redis()

### Community 125 - "Community 125"
Cohesion: 0.27
Nodes (4): Centralized Celery configuration for the FastAPI RBAC system. This module conta, Scheduled tasks configuration for Celery Beat. This module defines recurring ta, An example "Hello world" FastAPI route., root()

### Community 126 - "Community 126"
Cohesion: 0.40
Nodes (5): estimate_password_strength(), load_common_passwords(), Tools for loading and validating common passwords., Load common passwords from files in the project's password lists directory., Estimate password strength using zxcvbn.      Returns:         dict: Password

### Community 127 - "Community 127"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 128 - "Community 128"
Cohesion: 0.33
Nodes (5): auth_headers(), Fixture for token generation in tests.  This fixture creates proper tokens tha, Factory fixture to create tokens for testing., Factory fixture to create authentication headers for testing., token_factory()

### Community 129 - "Community 129"
Cohesion: 0.33
Nodes (5): get_superuser_token_headers(), random_uuid_str(), Generate a random UUID string format., Get a superuser token for testing.     This is a synchronous version for tests, TestClient

### Community 131 - "Community 131"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 132 - "Community 132"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 133 - "Community 133"
Cohesion: 0.60
Nodes (4): downgrade(), has_column(), Check if a column exists in a table, upgrade()

### Community 134 - "Community 134"
Cohesion: 0.60
Nodes (4): downgrade(), Check if a table exists, table_exists(), upgrade()

### Community 135 - "Community 135"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 136 - "Community 136"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 137 - "Community 137"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 143 - "Community 143"
Cohesion: 0.50
Nodes (3): optional(), A decorator that create a partial model.      Args:         model (Type[BaseM, Model

### Community 144 - "Community 144"
Cohesion: 0.50
Nodes (3): debug_cors(), Add this to the top of your main.py file after imports to debug CORS configurati, Add this function to your main.py file and call it before adding CORS middleware

### Community 146 - "Community 146"
Cohesion: 0.50
Nodes (3): Redis-related test fixtures., Provide a Redis mock for tests., redis_mock()

### Community 147 - "Community 147"
Cohesion: 0.50
Nodes (3): Unit test: Import checks for FastAPI RBAC backend models and schemas.  This mo, Test that all required imports are working., test_imports_working()

### Community 148 - "Community 148"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 151 - "Community 151"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

### Community 169 - "Community 169"
Cohesion: 0.67
Nodes (3): get_fernet_key(), Generate a valid Fernet key from an input string.     Uses SHA-256 to derive a, Fernet

### Community 202 - "Community 202"
Cohesion: 0.50
Nodes (4): get_csrf_token(), CsrfProtect, Response, Get CSRF token for frontend to use in state-changing operations.     This endpo

## Knowledge Gaps
- **304 isolated node(s):** `PageBase`, `generate-certs.sh script`, `01-init-user.sh script`, `02-init-db.sh script`, `01-init-user.sh script` (+299 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **89 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UUID` connect `Community 70` to `Community 4`, `Community 5`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 14`, `Community 16`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 27`, `Community 37`, `Community 44`, `Community 48`, `Community 49`, `Community 56`, `Community 68`, `Community 71`, `Community 75`, `Community 76`, `Community 81`, `Community 83`, `Community 87`, `Community 99`, `Community 101`, `Community 105`, `Community 106`, `Community 107`, `Community 108`, `Community 109`, `Community 111`, `Community 112`, `Community 113`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `User` connect `Community 28` to `Community 4`, `Community 5`, `Community 7`, `Community 9`, `Community 10`, `Community 14`, `Community 16`, `Community 18`, `Community 21`, `Community 23`, `Community 32`, `Community 45`, `Community 49`, `Community 50`, `Community 75`, `Community 82`, `Community 84`, `Community 88`, `Community 89`, `Community 109`, `Community 110`, `Community 111`, `Community 112`, `Community 113`, `Community 120`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `ModeEnum` connect `Community 117` to `Community 5`, `Community 8`, `Community 15`, `Community 47`, `Community 26`, `Community 60`, `Community 94`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `UUID` (e.g. with `get_new_access_token()` and `test_create_audit_log()`) actually correct?**
  _`UUID` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 88 inferred relationships involving `random_lower_string()` (e.g. with `normal_user_token_headers()` and `test_create_audit_log()`) actually correct?**
  _`random_lower_string()` has 88 INFERRED edges - model-reasoned connections that need verification._
- **Are the 83 inferred relationships involving `User` (e.g. with `confirm_password_reset()` and `login()`) actually correct?**
  _`User` has 83 INFERRED edges - model-reasoned connections that need verification._
- **Are the 58 inferred relationships involving `Role` (e.g. with `create_role()` and `get_roles()`) actually correct?**
  _`Role` has 58 INFERRED edges - model-reasoned connections that need verification._
