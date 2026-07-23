# Graph Report - .  (2026-07-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3201 nodes · 7827 edges · 275 communities (178 shown, 97 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 494 edges (avg confidence: 0.61)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5a6f9362`
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
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
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
- Community 238
- Community 239
- Community 241
- Community 242
- Community 258

## God Nodes (most connected - your core abstractions)
1. `User` - 130 edges
2. `cn()` - 130 edges
3. `UUID` - 119 edges
4. `random_lower_string()` - 103 edges
5. `Role` - 83 edges
6. `create_response()` - 63 edges
7. `Permission` - 58 edges
8. `get_csrf_token()` - 54 edges
9. `AsyncUserFactory` - 49 edges
10. `random_email()` - 49 edges

## Surprising Connections (you probably didn't know these)
- `Meta` --uses--> `AuditLog`  [INFERRED]
  backend/test/factories/audit_factory.py → backend/app/models/audit_log_model.py
- `login()` --indirect_call--> `User`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/models/user_model.py
- `register()` --indirect_call--> `ModeEnum`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/core/config.py
- `verify_email()` --indirect_call--> `User`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/models/user_model.py
- `resend_verification_email()` --indirect_call--> `User`  [INFERRED]
  backend/app/api/v1/endpoints/auth.py → backend/app/models/user_model.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (275 total, 97 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (83): DataTableProps, DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel() (+75 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (79): PasswordValidator, Password validation helper class., get_active_users_count(), get_recent_logins(), get_system_users_summary(), User, Return the count of users where is_active=True., BaseUUIDModel (+71 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (60): InitAuth(), LoginForm(), LoginFormData, loginSchema, SignupForm(), LoadingScreen(), LoadingScreenProps, ChangePasswordContent() (+52 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (49): AsyncUserFactory, Any, Permission, PermissionGroup, Role, RoleGroup, User, Create an admin user with a compliant password by default, or return existing if (+41 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (68): AsyncRedis, get_input_sanitizer(), get_permissive_sanitizer(), get_strict_sanitizer(), Get input sanitizer instance for dependency injection.      Args:         strict, Get strict input sanitizer for sensitive operations.      Returns:         Input, Get permissive input sanitizer for content that may contain HTML.      Returns:, change_password() (+60 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (44): AsyncClient, AsyncSession, Permission management integration tests.  Tests the complete permission manageme, Test complete CRUD operations for permission groups., Test operations on permission groups that contain permissions., Integration tests for permission management flows., Test permission listing and pagination., Test handling of duplicate permission names. (+36 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (44): ProtectedRoute(), ProtectedRouteProps, SignupFormData, signupSchema, OverviewChartData, OverviewChartProps, StatsCardProps, Alert() (+36 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (38): get_db(), AsyncSession, Get database session for dependency injection.     Uses AsyncSession to ensure a, app(), client(), AsyncClient, AsyncSession, FastAPI (+30 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (34): Hash a password with bcrypt with enhanced security.          - Uses a high work, CRUDUser, Any, AsyncSession, EmailStr, User, Create a user. Requires db_session to be provided explicitly., Update a user. Requires db_session to be provided explicitly. (+26 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (42): This module contains the dependency injection utilities used across the FastAPI, get_permission_by_id(), Gets a permission by its ID, get_permission_by_id(), get_permission_by_name(), AsyncSession, description, Path (+34 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (46): Verify a password against its hash., IUserCreate, Comprehensive authentication API endpoint tests - FIXED VERSION.  This module te, AsyncSession, Test updating a user's password, Test creating a user through CRUD operations, Test user authentication, Test retrieving multiple users with pagination (+38 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (41): r"""UUID draft version objects (universally unique identifiers). This module pro, r"""UUID version 7 features a time-ordered value field derived from the     wide, _subsec_encode(), uuid7(), AsyncClient, AsyncSession, FastAPI, Example: How to mock dependencies for user creation in FastAPI tests.  This exam (+33 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (31): AsyncClient, AsyncSession, Test login endpoint structure when registration fails., Test the password reset functionality, ensuring users can securely         reset, Test security features of authentication., Helper to register a user with CSRF token., Test that a user's account is locked after multiple failed login attempts, Test rate limiting on login attempts. (+23 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (42): assign_roles_to_user(), bulk_update_users(), create_user(), get_my_data(), get_user_by_id(), get_user_list_order_by_created_at(), Any, AsyncSession (+34 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (33): react, react, FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem() (+25 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (26): CRUDRole, Any, AsyncSession, Page, Params, Permission, Redis, Role (+18 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (11): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (39): IRoleCreate, IRoleUpdate, Exception raised when a resource is not found, ResourceNotFoundException, AsyncSession, Test retrieving multiple roles with pagination, Test retrieving all roles without pagination, Test adding a role to a user (+31 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (22): SQLAlchemyModelFactory, Factory for creating User model instances., Start sequence from a random point to avoid conflicts., UserFactory, AsyncSession, Test successful user update., Test partial user update., Test successful user deletion. (+14 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (35): DashboardOverview(), NestedPermissionGroupProps, PermissionGroupDetail(), PermissionGroupForm(), PermissionGroupRowProps, PermissionGroupsDataTable(), PermissionDetail(), PermissionForm() (+27 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (35): assign_permissions_to_role(), create_role(), delete_role(), get_all_roles_list(), get_role_by_id(), get_roles(), AsyncSession, BackgroundTasks (+27 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (23): CRUDRoleGroup, Any, AsyncSession, RoleGroup, User, Create multiple role groups in a single transaction, Delete multiple role groups in a single transaction, Synchronize roles with their role groups based on the role_group_id field. (+15 more)

### Community 22 - "Community 22"
Cohesion: 0.09
Nodes (31): create_permission(), delete_permission(), get_permissions(), AsyncSession, Params, Permission, User, Deletes a permission by its id      Required roles:     - admin     - manager (+23 more)

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (35): IPermissionGroupCreate, IPermissionCreate, IPermissionUpdate, AsyncSession, Test retrieving a permission by ID with relationships loaded, Test updating a permission, Test updating a permission's name, Test retrieving multiple permissions with pagination (+27 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (36): IRoleGroupCreate, AsyncSession, User, Test retrieving all role groups without pagination, Test creating and retrieving hierarchical role groups, Test adding roles to a role group, Create a test user for tests that require a user, Test removing roles from a role group (+28 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (32): add_roles_to_group(), bulk_create_role_groups(), bulk_delete_role_groups(), clone_role_group(), create_role_group(), delete_role_group(), get_role_group_by_id(), get_role_groups() (+24 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (22): close_redis_pool(), get_redis_client(), Redis, Enhanced Redis connection management with SSL support for production.  This modu, Create a connection pool for Redis.          Args:             db: Redis databas, Get or create a singleton connection pool.          Args:             db: Redis, Get a Redis client using the connection pool.          Args:             db: Red, Perform a health check on Redis connection.          Args:             client: O (+14 more)

### Community 27 - "Community 27"
Cohesion: 0.07
Nodes (18): Any, Build Redis connection parameters based on environment.          Args:, Create and configure SSL context for Redis connections.          Args:, Test connection pool creation., Test that connection pool is a singleton., Create a mock Redis connection pool., Test getting a Redis client from the pool., Test successful health check. (+10 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (17): RegisterForm(), ResendVerificationEmailForm(), VerifyEmailPage(), LoginCredentials, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, Token (+9 more)

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (18): Any, AsyncSession, ModelType, Page, Params, CRUD object with default methods to Create, Read, Update, Delete (CRUD)., Get multiple records by their IDs., Get multiple records with pagination. (+10 more)

### Community 30 - "Community 30"
Cohesion: 0.06
Nodes (30): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+22 more)

### Community 31 - "Community 31"
Cohesion: 0.09
Nodes (25): DBType, Any, Enum, str, Test configuration settings for managing the test environment. This allows for e, Test TestConfig.get_db_uri for SQLite, Test TestConfig.get_db_uri for PostgreSQL, Test TestConfig.get_connection_args method (+17 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (26): add_token_claims(), create_access_token(), create_refresh_token(), create_reset_token(), create_verification_token(), get_data_encrypt(), map_jwt_http_error_to_event(), Any (+18 more)

### Community 33 - "Community 33"
Cohesion: 0.10
Nodes (23): Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+15 more)

### Community 34 - "Community 34"
Cohesion: 0.13
Nodes (22): BaseFactory, Meta, PermissionFactory, PermissionGroupFactory, Any, Permission, PermissionGroup, Role (+14 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (24): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), Comprehensive test runner for the refactored test suite.  This script provides e, Run all tests (unit + integration) in Docker Compose for correct environment and (+16 more)

### Community 36 - "Community 36"
Cohesion: 0.17
Nodes (21): Any, Override model_dump to customize role serialization, UserBase, INewPassword, IUserLoginSchema, IUserOutput, IUserOutputPaginated, IUserOutputPaginatedSchema (+13 more)

### Community 37 - "Community 37"
Cohesion: 0.14
Nodes (21): Any, Input sanitization utilities for XSS prevention and data cleaning.  This module, Sanitize email address input.      Args:         email: The email address to san, Sanitize search query input to prevent injection attacks.      Args:         que, Recursively sanitize string values in a dictionary/JSON object.      Args:, Sanitize URL input to prevent XSS and injection attacks.      Args:         url:, Sanitize input value based on field type.          Args:             value: The, Sanitize all string values in a dictionary.          Args:             data: Dic (+13 more)

### Community 38 - "Community 38"
Cohesion: 0.15
Nodes (13): CRUDPermission, AsyncSession, Permission, Check if a permission with the given name already exists.          Args:, Create multiple permissions in a single database transaction.          Args:, Get a permission by its name.          Args:             name: The name of the p, Assign multiple permissions to a role in a batch operation         for improved, Remove multiple permissions from a role in a batch operation.          Args: (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.12
Nodes (12): AppWrapper(), AppWrapperProps, Meta(), MetaProps, PageMeta(), SplashScreenProps, AuthLayout(), Toaster() (+4 more)

### Community 40 - "Community 40"
Cohesion: 0.17
Nodes (14): Permission, ApiResponse, PaginatedItems, Role, User, ApiError, UserCreatePayload, UserService (+6 more)

### Community 41 - "Community 41"
Cohesion: 0.14
Nodes (19): Skeleton(), RoleGroupDetail(), RoleGroupFormContent(), RoleGroupList(), RoleFormData, RoleFormContent(), addRolesToGroup, createRoleGroup (+11 more)

### Community 42 - "Community 42"
Cohesion: 0.17
Nodes (17): NestedRoleGroupProps, RoleGroupFormProps, RoleGroupRowProps, RoleFormProps, RoleGroup, RoleGroupCreate, RoleGroupResponse, RoleGroupUpdate (+9 more)

### Community 43 - "Community 43"
Cohesion: 0.21
Nodes (19): get_current_user(), Any, User, TokenType, add_token_to_redis(), delete_tokens(), get_valid_tokens(), Redis (+11 more)

### Community 44 - "Community 44"
Cohesion: 0.15
Nodes (9): get_settings_dependency(), Any, Build Redis URL for Celery broker and backend, Validate that critical settings are properly set in production mode, Return a dictionary of settings that vary by environment, Settings, BaseSettings, PydanticBaseSettingsSource (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.19
Nodes (15): get_permission_group_by_id(), Gets a permission group by its ID, CRUDBase, PermissionGroupData, PermissionGroupBase, IPermissionGroupBase, IPermissionGroupRead, IPermissionGroupReadWithPermissions (+7 more)

### Community 46 - "Community 46"
Cohesion: 0.14
Nodes (20): AsyncSession, Test deleting a permission group, Test adding permissions to a permission group, Test creating a permission group through CRUD operations, Test permission groups with subgroups relationship, Test counting permissions by group, Test retrieving a permission group by ID, Test updating a permission group (+12 more)

### Community 47 - "Community 47"
Cohesion: 0.13
Nodes (18): AbstractParams, custom_exception_handler(), CustomException, Handle validation errors with standardized format for frontend consumption, Handle custom exceptions with standardized format for frontend consumption, Handle attempts by users to delete their own account., user_self_delete_exception_handler(), validation_exception_handler() (+10 more)

### Community 48 - "Community 48"
Cohesion: 0.21
Nodes (18): get_dashboard_data(), get_dashboard_stats(), Session, User, Retrieve dashboard stats (alias for /dashboard or /dashboard/stats)., Retrieve dashboard data.     Data returned will vary based on the user's role., get_active_sessions_count(), get_total_permissions_count() (+10 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (11): Any, Get email configuration based on environment, Environment-specific service settings for Celery,     Redis, and other external, Get database URL based on environment, Get the Redis URL based on current environment.          For production, uses re, Get the Celery broker URL based on current environment, Get the Celery result backend URL based on current environment, Determine whether to use Celery based on environment (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.13
Nodes (15): Any, timedelta, Generate an expired token for testing expiration handling.          Args:, Factory for generating JWT tokens for testing., Generate a test access token.          Args:             user_id: User ID to inc, Generate a test refresh token.          Args:             user_id: User ID to in, Generate authentication headers for testing.          Args:             access_t, TokenFactory (+7 more)

### Community 51 - "Community 51"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 52 - "Community 52"
Cohesion: 0.13
Nodes (15): decode_token(), get_content(), HTTPException, Decode and validate a JWT token with enhanced security checks., Verify required token claims and values., Decrypt data using Fernet., validate_token_claims(), custom_swagger_ui_html() (+7 more)

### Community 53 - "Community 53"
Cohesion: 0.15
Nodes (18): database_exception_handler(), general_exception_handler(), Exception, JSONResponse, Request, Response, rate_limit_exception_handler(), rate_limit_handler() (+10 more)

### Community 54 - "Community 54"
Cohesion: 0.11
Nodes (10): AsyncClient, Test that 404 errors are handled properly., Test that invalid JSON is handled properly., Test that method not allowed errors are handled., Test that health endpoint is working., Test that API responds with correct version prefix., Test that CORS headers are present., Test that public endpoints are accessible without authentication. (+2 more)

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (14): PaginatedDataResponse, PaginatedResponse, PaginationParams, Role, RoleCreate, RolePermissionAssign, RolePermissionUnassign, RoleResponse (+6 more)

### Community 56 - "Community 56"
Cohesion: 0.16
Nodes (14): createTestStoreForRoleList(), ExtendedRenderOptions, renderRoleListWithMockedDispatch(), AppStore, createTestStore(), ExtendedRenderOptions, mockPermissions, mockRoleGroups (+6 more)

### Community 57 - "Community 57"
Cohesion: 0.11
Nodes (16): health_check(), Any, BackgroundTasks, Redis, Perform a health check of all critical system components, including:     - API S, cleanup_tokens_task(), log_security_event_task(), process_account_lockout_task() (+8 more)

### Community 58 - "Community 58"
Cohesion: 0.13
Nodes (15): get_async_session(), get_redis_client(), Any, AsyncSession, Redis, Create and get async database session.     This function yields an AsyncSession, Get Redis client instance as an async generator.     Yields a Redis client confi, create_init_data() (+7 more)

### Community 59 - "Community 59"
Cohesion: 0.11
Nodes (17): background_tasks_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), http_client_mock(), patched_external_services(), Enhanced mock fixtures for comprehensive testing.  This module provides pytest f, Patch all external services with mocks. (+9 more)

### Community 60 - "Community 60"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 61 - "Community 61"
Cohesion: 0.14
Nodes (9): oauth_provider_mock(), Provide a mock OAuth provider for testing OAuth flows., MockOAuthProvider, Any, Mock user info retrieval., Set user info for a token., Add authorization code., Mock OAuth provider for testing OAuth flows. (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.19
Nodes (16): make_admin_user(), make_audit_log(), make_permission(), make_permission_group(), make_role(), make_role_group(), make_role_with_permissions(), make_user() (+8 more)

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (8): MockCeleryResult, Any, Mock task.delay() method., Mock task.apply_async() method., Mock Celery AsyncResult for testing., Mock successful() method., Mock failed() method., Mock send_task method.

### Community 64 - "Community 64"
Cohesion: 0.16
Nodes (9): MockEmailService, Any, Email service mocks for testing., Mock implementation of email service for testing., Mock verification email sending., Mock password reset email sending., Clear the sent emails list., Get the last sent email. (+1 more)

### Community 65 - "Community 65"
Cohesion: 0.13
Nodes (17): @eslint/js, eslint-plugin-react-hooks, jsdom, devDependencies, @eslint/js, eslint-plugin-react-hooks, jsdom, @testing-library/dom (+9 more)

### Community 66 - "Community 66"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 67 - "Community 67"
Cohesion: 0.23
Nodes (12): Any, Send an email using the emails library,     which supports both development and, Render a Jinja template from the email templates directory with the given contex, Render a template and send it as an email., render_template(), send_email(), send_email_with_template(), Send a password reset email to a user.      Args:         email: The recipient's (+4 more)

### Community 68 - "Community 68"
Cohesion: 0.15
Nodes (9): MockHTTPClient, MockHTTPResponse, External API mocks for testing., Mock HTTP response for testing., Raise exception for bad status codes., Mock HTTP client for testing external API calls., Set a specific response for method and URL., Clear request history. (+1 more)

### Community 69 - "Community 69"
Cohesion: 0.22
Nodes (11): AuditLog, AuditLogBase, Model for storing security audit logs, Audit log and related model factories for testing., AsyncSession, Test creating an audit log entry in the database, Test retrieving audit log entries for a specific actor, Test filtering audit logs by action type (+3 more)

### Community 70 - "Community 70"
Cohesion: 0.22
Nodes (8): CircularDependencyException, ContentNoChangeException, NameExistException, Any, Exception, HTTPException, ModelType, Exception raised when a circular dependency is detected

### Community 71 - "Community 71"
Cohesion: 0.22
Nodes (11): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, dashboardSlice, DashboardState (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 73 - "Community 73"
Cohesion: 0.23
Nodes (7): Globals, Any, Get the value of a variable., Clear all variables and free memory., Set a default value for a variable., Get the default value for a variable., Ensure a ContextVar exists for a variable.

### Community 74 - "Community 74"
Cohesion: 0.25
Nodes (13): get_test_data(), main(), Any, Session, Test endpoint with valid CSRF token and session with cookie., Get appropriate test data for each endpoint., Test CSRF token generation endpoint., Test endpoint without CSRF token (should fail). (+5 more)

### Community 75 - "Community 75"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 76 - "Community 76"
Cohesion: 0.19
Nodes (8): Any, Role, User, Add roles to the user if provided., Create a superuser/admin., Create a locked user., Create a user that needs to change password., Create an unverified user with verification code.

### Community 77 - "Community 77"
Cohesion: 0.19
Nodes (10): DataTable(), DataTableColumn, OverviewChart(), ProfileContent(), StatsCard(), Avatar(), AvatarFallback(), AvatarImage() (+2 more)

### Community 78 - "Community 78"
Cohesion: 0.23
Nodes (12): create_permission_group(), delete_permission_group(), get_permission_groups(), AsyncSession, Params, PermissionGroup, User, Creates a new role group      Required roles:     - admin     - manager (+4 more)

### Community 79 - "Community 79"
Cohesion: 0.35
Nodes (6): CRUDPermissionGroup, Any, AsyncSession, Params, PermissionGroup, Get a permission group by name.

### Community 80 - "Community 80"
Cohesion: 0.17
Nodes (10): celery_mock(), comprehensive_mocks(), Provide comprehensive mocks for integration testing., Provide a mock Celery application for testing., Provide all service mocks in a single fixture., service_mocks(), MockCeleryApp, Clear all task call history. (+2 more)

### Community 81 - "Community 81"
Cohesion: 0.23
Nodes (12): AsyncSession, Permission, PermissionGroup, User, Fixture to create a test permission group, Fixture to create a test permission, Test creating a permission in the database, Test relationships of the permission (+4 more)

### Community 82 - "Community 82"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 83 - "Community 83"
Cohesion: 0.20
Nodes (9): ASGIApp, globals_middleware_dispatch(), GlobalsMiddleware, BaseHTTPMiddleware, Request, Response, This allows to use global variables inside the FastAPI application using async m, Dispatch the request in a new context to allow globals to be used. (+1 more)

### Community 84 - "Community 84"
Cohesion: 0.22
Nodes (8): Centralized Celery configuration for the FastAPI RBAC system. This module contai, Scheduled tasks configuration for Celery Beat. This module defines recurring tas, get_cached_celery_config(), get_celery_config(), Any, Celery configuration module for the FastAPI RBAC project. This module provides c, Get cached Celery configuration.      Uses lru_cache to cache the configuration, Get Celery configuration dictionary with all necessary settings.      Returns:

### Community 85 - "Community 85"
Cohesion: 0.24
Nodes (9): DatabaseTypeEnum, get_project_root(), get_settings(), ModeEnum, Enum, str, Get the project root path based on environment, Retrieve and cache application settings. (+1 more)

### Community 86 - "Community 86"
Cohesion: 0.20
Nodes (8): AuditLogFactory, Meta, Any, SQLAlchemyModelFactory, Factory for creating AuditLog model instances., Generate a JSON-compatible details dictionary., Create an audit log entry for a specific user., Create an audit log entry for a specific action type.

### Community 87 - "Community 87"
Cohesion: 0.29
Nodes (7): build_docker_images(), confirm_main_branch(), create_git_tag(), create-release.sh script, show_help(), test_git_available(), update_release_notes()

### Community 88 - "Community 88"
Cohesion: 0.27
Nodes (7): BaseHTTPMiddleware, Middleware to add security headers to all responses.     Implements defense-in-d, SecurityHeadersMiddleware, Any, HTTPException, UserNotFoundException, UserSelfDeleteException

### Community 89 - "Community 89"
Cohesion: 0.20
Nodes (6): celery_task_mock(), Provide a mock Celery task for testing., MockCeleryTask, Celery service mocks for testing., Mock Celery task for testing., Clear the task call history.

### Community 90 - "Community 90"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 92 - "Community 92"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 93 - "Community 93"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 94 - "Community 94"
Cohesion: 0.22
Nodes (9): autoprefixer, axios, @hookform/resolvers, @radix-ui/react-select, dependencies, autoprefixer, axios, @hookform/resolvers (+1 more)

### Community 95 - "Community 95"
Cohesion: 0.36
Nodes (8): AsyncSession, Test creating an entity with BaseUUIDModel as base class, Test updating an entity with BaseUUIDModel as base class, Test that UUIDs are unique for each instance, SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update(), test_uuid_generation()

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (9): AsyncSession, PermissionGroup, User, Fixture to create a test permission group, Test creating a permission group in the database, Test relationships of the permission group, test_create_permission_group(), test_permission_group() (+1 more)

### Community 98 - "Community 98"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 99 - "Community 99"
Cohesion: 0.25
Nodes (8): AsyncEngine, db(), db_engine(), initialize_db(), AsyncSession, Initialize the database for the test session., Create test database tables and return engine., Provide a database session for tests.

### Community 100 - "Community 100"
Cohesion: 0.25
Nodes (8): get_csrf_protect(), CsrfProtect, Request, Set the global CSRF protect instance.     Called from main.py during application, Get the CSRF protection instance for dependency injection.      Returns:, Validate CSRF token for state-changing operations.      Args:         request: T, set_csrf_protect_instance(), validate_csrf_token()

### Community 102 - "Community 102"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 103 - "Community 103"
Cohesion: 0.25
Nodes (7): initialRoleGroupState, mockAuthState, MockedFunction, mockRoleGroups, mockUser, mockUsers, rootReducer

### Community 104 - "Community 104"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 106 - "Community 106"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 107 - "Community 107"
Cohesion: 0.40
Nodes (5): do_run_migrations(), Run migrations in 'offline' mode.     This configures the context with just a UR, Run migrations in 'online' mode.     In this scenario we need to create an Engin, run_migrations_offline(), run_migrations_online()

### Community 108 - "Community 108"
Cohesion: 0.60
Nodes (5): downgrade(), get_uuid_type(), has_column(), Check if a column exists in a table, upgrade()

### Community 109 - "Community 109"
Cohesion: 0.40
Nodes (5): downgrade(), get_uuid_type(), This migration fixes the case conflict between 'rolegroupmap' and 'RoleGroupMap', For downgrade, we would remove any columns we added,     but this is rarely need, upgrade()

### Community 110 - "Community 110"
Cohesion: 0.47
Nodes (5): main(), Check if the database is ready for connections., Check if Redis is ready for connections., wait_for_database(), wait_for_redis()

### Community 111 - "Community 111"
Cohesion: 0.40
Nodes (5): estimate_password_strength(), load_common_passwords(), Tools for loading and validating common passwords., Load common passwords from files in the project's password lists directory., Estimate password strength using zxcvbn.      Returns:         dict: Password st

### Community 112 - "Community 112"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 114 - "Community 114"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 115 - "Community 115"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 116 - "Community 116"
Cohesion: 0.60
Nodes (4): downgrade(), has_column(), Check if a column exists in a table, upgrade()

### Community 117 - "Community 117"
Cohesion: 0.60
Nodes (4): downgrade(), Check if a table exists, table_exists(), upgrade()

### Community 118 - "Community 118"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 119 - "Community 119"
Cohesion: 0.40
Nodes (3): AsyncSession, Test that database connection is working., Test that core database tables exist.

### Community 121 - "Community 121"
Cohesion: 0.40
Nodes (4): MockedFunction, mockPermissions, mockRoleGroups, mockRoles

### Community 122 - "Community 122"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 128 - "Community 128"
Cohesion: 0.50
Nodes (4): get_csrf_token(), CsrfProtect, Response, Get CSRF token for frontend to use in state-changing operations.     This endpoi

### Community 129 - "Community 129"
Cohesion: 0.67
Nodes (4): get_or_create_superuser(), init_db(), AsyncSession, UserModel

### Community 130 - "Community 130"
Cohesion: 0.67
Nodes (4): after_insert_role(), after_update_role(), Connection, Mapper

### Community 131 - "Community 131"
Cohesion: 0.50
Nodes (3): debug_cors(), Add this to the top of your main.py file after imports to debug CORS configurati, Add this function to your main.py file and call it before adding CORS middleware

### Community 133 - "Community 133"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 135 - "Community 135"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

### Community 153 - "Community 153"
Cohesion: 0.67
Nodes (3): get_fernet_key(), Generate a valid Fernet key from an input string.     Uses SHA-256 to derive a p, Fernet

## Knowledge Gaps
- **305 isolated node(s):** `PageBase`, `generate-certs.sh script`, `01-init-user.sh script`, `02-init-db.sh script`, `01-init-user.sh script` (+300 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **97 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 1` to `Community 3`, `Community 4`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 20`, `Community 21`, `Community 24`, `Community 25`, `Community 163`, `Community 36`, `Community 43`, `Community 45`, `Community 48`, `Community 69`, `Community 76`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `UUID` connect `Community 15` to `Community 1`, `Community 3`, `Community 4`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 13`, `Community 17`, `Community 18`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 29`, `Community 34`, `Community 38`, `Community 43`, `Community 45`, `Community 46`, `Community 69`, `Community 70`, `Community 79`, `Community 86`, `Community 95`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `ModeEnum` connect `Community 85` to `Community 26`, `Community 4`, `Community 44`, `Community 110`, `Community 47`, `Community 49`, `Community 84`, `Community 52`, `Community 88`, `Community 58`, `Community 27`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 69 inferred relationships involving `User` (e.g. with `confirm_password_reset()` and `login()`) actually correct?**
  _`User` has 69 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `UUID` (e.g. with `get_new_access_token()` and `test_create_audit_log()`) actually correct?**
  _`UUID` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 51 inferred relationships involving `Role` (e.g. with `create_role()` and `get_roles()`) actually correct?**
  _`Role` has 51 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PageBase`, `generate-certs.sh script`, `01-init-user.sh script` to the rest of the system?**
  _305 weakly-connected nodes found - possible documentation gaps or missing edges._