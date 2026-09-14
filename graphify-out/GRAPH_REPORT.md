# Graph Report - fastapi_rbac  (2026-09-14)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4632 nodes · 12232 edges · 238 communities (150 shown, 42 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 888 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `59e1c9d3`
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
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
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
- Community 211
- Community 212
- Community 226

## God Nodes (most connected - your core abstractions)
1. `User` - 218 edges
2. `cn()` - 134 edges
3. `MockRedisClient` - 125 edges
4. `random_lower_string()` - 107 edges
5. `TokenType` - 91 edges
6. `Role` - 78 edges
7. `get_csrf_token()` - 78 edges
8. `react` - 74 edges
9. `create_response()` - 64 edges
10. `random_email()` - 63 edges

## Surprising Connections (you probably didn't know these)
- `Token` --uses--> `IUserRead`  [INFERRED]
  backend/app/schemas/token_schema.py → backend/app/schemas/user_schema.py
- `_app()` --uses--> `ProxyHeadersMiddleware`  [INFERRED]
  backend/test/unit/test_client_address.py → backend/app/utils/client_address.py
- `auth_headers()` --uses--> `TokenFactory`  [INFERRED]
  backend/test/fixtures/fixtures_factories.py → backend/test/factories/auth_factory.py
- `token_factory()` --uses--> `TokenFactory`  [INFERRED]
  backend/test/fixtures/fixtures_factories.py → backend/test/factories/auth_factory.py
- `create_permission()` --uses--> `IPermissionRead`  [INFERRED]
  backend/app/api/v1/endpoints/permission.py → backend/app/schemas/permission_schema.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (238 total, 42 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (77): LogoutEverywhereControlProps, DataTable(), DataTableColumn, DataTableProps, DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps (+69 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (92): get_strict_sanitizer(), Get strict input sanitizer for sensitive operations. Returns: InputSanitizer:…, change_password(), confirm_password_reset(), ensure_utc(), get_csrf_token(), get_new_access_token(), login() (+84 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (77): FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue (+69 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (60): InitAuth(), LoginForm(), LogoutEverywhereControl(), ProtectedRoute(), ProtectedRouteProps, AppWrapper(), AppWrapperProps, LoadingScreen() (+52 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (76): get_content(), PasswordValidator, HTTPException, Verify required token claims and values., Password validation helper class., Validate password complexity according to settings. Returns a tuple of…, Check if password contains sequential characters., Check if password has too many repeated characters. (+68 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (61): AsyncFactoryBase, AsyncPermissionFactory, AsyncPermissionGroupFactory, AsyncRoleFactory, AsyncRoleGroupFactory, AsyncTestDataBuilder, AsyncUserFactory, AsyncSession (+53 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (65): get_total_permissions_count(), get_total_roles_count(), CRUDPermissionGroup, PermissionGroupData, Any, AsyncSession, Params, Get a permission group by name. (+57 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (55): Skeleton(), NestedRoleGroupProps, RoleGroupForm(), RoleGroupFormProps, RoleGroupFormContent(), RoleGroupRowProps, RoleForm(), RoleFormData (+47 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (57): get_csrf_protect(), get_input_sanitizer(), get_permissive_sanitizer(), CsrfProtect, Request, This module contains the dependency injection utilities used across the FastAPI…, Get input sanitizer instance for dependency injection. Args: strict_mode:…, Get permissive input sanitizer for content that may contain HTML. Returns:… (+49 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (48): ApiErrorAlert(), ApiErrorAlertProps, LoginFormData, loginSchema, PasswordRequirements(), PasswordRequirementsProps, SignupFormData, signupSchema (+40 more)

### Community 10 - "Community 10"
Cohesion: 0.04
Nodes (61): AlertDialogOverlay(), Avatar(), AvatarFallback(), AvatarImage(), CardAction(), Command(), CommandEmpty(), CommandGroup() (+53 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (63): AbstractParams, assign_permissions_to_role(), create_role(), delete_role(), get_all_roles_list(), get_role_by_id(), get_roles(), AsyncSession (+55 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (64): delete_permission(), get_permission_by_id(), get_permissions(), create_permission_group(), get_permission_group_by_id(), get_permission_groups(), AsyncSession, get (+56 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (61): add_token_claims(), create_refresh_token(), create_reset_token(), create_verification_token(), get_data_encrypt(), get_fernet_key(), Any, timedelta (+53 more)

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (28): fixture, Redis-related test fixtures., Provide a stateful Redis mock so JWT allowlist sets work in tests (#73)., redis_mock(), enhanced_redis_mock(), mock_send_email(), fixture, Service mocks for testing. This module provides mock implementations of service… (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (54): assign_roles_to_user(), bulk_update_users(), create_user(), get_my_data(), get_user_by_id(), get_user_list_order_by_created_at(), Any, AsyncRedis (+46 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (54): AccountState, classify(), Enum, str, What an email address currently corresponds to. ``DISABLED`` is checked before…, Map a user row (or its absence) onto the four states., auth_url(), csrf_headers() (+46 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (32): CRUDUser, PasswordReuseError, Any, AsyncSession, EmailStr, User, ValueError, Retrieve an active user by ID. Requires db_session to be provided explicitly. (+24 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (33): SignupForm(), ResendVerificationEmailForm(), VerifyEmailPage(), UserDetailContent(), UsersList(), AuthState, ErrorResponse, ErrorResponseWithErrors (+25 more)

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (43): AuditLog, AuditLogBase, Model for storing security audit logs, BaseUUIDModel, datetime, field_validator, SQLModel, Track password changes for compliance and security. This helps prevent password… (+35 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (36): Mapping table between roles and role groups. This model handles the many-to-…, RoleGroupMap, RoleGroup, Role, RoleBase, RolePermission, BaseFactory, Meta (+28 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (34): Test CSRF token generation endpoint., AsyncClient, asyncio, AsyncSession, patch, Response, A second POST with the same JWT answers 200 after Redis is consumed (#239)., A signed JWT that does not match Redis is the uniform 400 while unverified. (+26 more)

### Community 22 - "Community 22"
Cohesion: 0.04
Nodes (49): engines, node, name, private, type, version, autoprefixer, clsx (+41 more)

### Community 23 - "Community 23"
Cohesion: 0.07
Nodes (46): client_address_key(), create_limiter(), _is_testing(), Request, rate_limit_key(), Shared slowapi HTTP rate limiter for the FastAPI app. HTTP rate limits use this…, Key a rate limit on the real client address. Deliberately not slowapi's…, Record an already-established user so the limiter can key on them. (+38 more)

### Community 24 - "Community 24"
Cohesion: 0.06
Nodes (49): html_to_plain_text(), Best-effort plain-text rendering of an HTML email body., Render a Jinja template from the email templates directory with the given…, render_template(), parametrize, Every outgoing email carries a readable plain-text part. Messages were sent as…, The whole point: a reader can see and copy the URL., A labelled link shows both the label and where it goes. (+41 more)

### Community 25 - "Community 25"
Cohesion: 0.05
Nodes (40): log_security_event_task(), Any, Unused: security events are written in-process by log_security_event (#243).…, Ensure Celery workers register task modules from app.worker., Worker boot via app.celery_app must register security/email tasks., Leftover queue messages must not write a second AuditLog row (#243)., conf.imports keeps task registration for celery -A app.celery_app., The sweep that replaced the in-process sleep must be a real task (#136). (+32 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (48): The client address a session was established from, or None if unrecorded.…, Whether this refresh comes from a different network than the session's. Gated…, refresh_origin_is_anomalous(), session_origin_ip(), _db_user(), _establish_session(), _origin_check_enabled(), asyncio (+40 more)

### Community 27 - "Community 27"
Cohesion: 0.07
Nodes (36): after_insert_role(), after_update_role(), Connection, downgrade(), populated_user_table(), Connection, fixture, Path (+28 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (44): header_text(), _mail_settings(), mock_send_email(), fixture, LogCaptureFixture, MonkeyPatch, parametrize, ``send_email`` against the real ``emails`` API, stubbed only at the socket. The… (+36 more)

### Community 29 - "Community 29"
Cohesion: 0.08
Nodes (42): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), get_csrf_config(), lifespan(), BaseHTTPMiddleware, Exception (+34 more)

### Community 30 - "Community 30"
Cohesion: 0.07
Nodes (32): close_redis_pool(), get_redis_client(), Redis, retry, Enhanced Redis connection management with SSL support for production. This…, Create a connection pool for Redis. Args: db: Redis database number…, Drop the cached pool without awaiting disconnect. Used when the owning asyncio…, Get or create a singleton connection pool. Args: db: Redis database number… (+24 more)

### Community 31 - "Community 31"
Cohesion: 0.07
Nodes (12): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.11
Nodes (38): cmd_config(), cmd_down(), cmd_env(), cmd_exec(), cmd_health(), cmd_logs(), cmd_pull(), cmd_restart() (+30 more)

### Community 33 - "Community 33"
Cohesion: 0.19
Nodes (41): UserRegister, _login(), _no_response_floor(), _oauth2(), Any, asyncio, fixture, MonkeyPatch (+33 more)

### Community 34 - "Community 34"
Cohesion: 0.08
Nodes (39): account_email_budget_key(), consume_account_email_budget(), _create_pending_user(), dispatch_account_email(), DispatchResult, issue_verification(), AsyncSession, BackgroundTasks (+31 more)

### Community 35 - "Community 35"
Cohesion: 0.07
Nodes (29): App(), mockAuthService, authWithComplexityError, RULES, createTestStoreForRoleList(), ExtendedRenderOptions, renderRoleListWithMockedDispatch(), initialRoleGroupState (+21 more)

### Community 36 - "Community 36"
Cohesion: 0.15
Nodes (40): PermissionBase, IPermissionGroupCreate, IPermissionCreate, IPermissionUpdate, asyncio, AsyncSession, Test retrieving a permission by ID with relationships loaded, Test updating a permission (+32 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (38): IUserCreate, normal_user_token_headers(), AsyncClient, AsyncSession, fixture, Authentication-related test fixtures., Return authentication headers for a superuser., superuser_token_headers() (+30 more)

### Community 38 - "Community 38"
Cohesion: 0.13
Nodes (37): clear_user_delete_references(), Clear rows that must not block or outlive a user deletion as orphans (#238).…, delete_if_still_pending(), _pending_past_window(), Any, AsyncSession, datetime, Redis (+29 more)

### Community 39 - "Community 39"
Cohesion: 0.11
Nodes (37): RoleGroupBase, IRoleGroupBase, IRoleGroupCreate, IRoleGroupUpdate, asyncio, AsyncSession, fixture, Test retrieving all role groups without pagination (+29 more)

### Community 40 - "Community 40"
Cohesion: 0.09
Nodes (22): CRUDRoleGroup, Any, AsyncSession, RoleGroup, Create multiple role groups in a single transaction, Delete multiple role groups in a single transaction, Synchronize roles with their role groups based on the role_group_id field. This…, CRUD operations for RoleGroup model (+14 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (37): IRoleCreate, asyncio, AsyncSession, Test retrieving multiple roles with pagination, Test retrieving all roles without pagination, Test adding a role to a user, Test creating a role through CRUD operations, Test adding a non-existent role to a user raises ValueError (+29 more)

### Community 42 - "Community 42"
Cohesion: 0.08
Nodes (24): _CRLFMessageProxy, _CRLFSMTPBackend, Any, Wraps a built MIME message so ``as_bytes()`` returns CRLF line endings. SMTP…, Delegates to a pooled emails SMTP backend, forcing CRLF on the way out.…, built_message(), Any, parametrize (+16 more)

### Community 43 - "Community 43"
Cohesion: 0.07
Nodes (26): r"""UUID draft version objects (universally unique identifiers). This module…, r"""UUID version 7 features a time-ordered value field derived from the widely…, r"""UUID version 6 is a field-compatible version of UUIDv1, reordered for…, _subsec_decode(), _subsec_encode(), uuid6(), uuid7(), AsyncClient (+18 more)

### Community 44 - "Community 44"
Cohesion: 0.16
Nodes (34): add_session_tokens_to_redis(), get_valid_tokens(), Record one session: a refresh token and the access token derived from it.…, Clock, _login_once(), asyncio, fixture, MonkeyPatch (+26 more)

### Community 45 - "Community 45"
Cohesion: 0.05
Nodes (37): dependencies, autoprefixer, axios, class-variance-authority, clsx, cmdk, date-fns, @hookform/resolvers (+29 more)

### Community 46 - "Community 46"
Cohesion: 0.10
Nodes (20): asyncio, AsyncSession, Test user retrieval with non-existent email., Test successful user update., Test partial user update., Test successful user deletion., Test deletion of non-existent user., Test user listing with pagination. (+12 more)

### Community 47 - "Community 47"
Cohesion: 0.13
Nodes (32): allowlist_key(), auth_url(), login(), post_change_password(), Any, AsyncClient, fixture, Response (+24 more)

### Community 48 - "Community 48"
Cohesion: 0.09
Nodes (20): CRUDRole, Any, AsyncSession, Page, Params, Redis, Role, Check if any user is assigned to the role. (+12 more)

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (31): IGenderEnum, IOrderEnum, IUserMessage, BaseModel, Enum, str, TokenType, add_token_to_redis() (+23 more)

### Community 50 - "Community 50"
Cohesion: 0.27
Nodes (31): auth_url(), csrf_headers(), events_named(), matching(), post_login(), Any, AsyncClient, AsyncSession (+23 more)

### Community 51 - "Community 51"
Cohesion: 0.10
Nodes (31): Factory for creating RoleGroup model instances., RoleGroupFactory, auth_headers(), db_factories(), HeadersCallable, make_audit_log(), _make_audit_log(), make_permission() (+23 more)

### Community 52 - "Community 52"
Cohesion: 0.08
Nodes (18): Provide all service mocks in a single fixture., service_mocks(), MockHTTPClient, MockHTTPResponse, MockOAuthProvider, Any, External API mocks for testing., Mock HTTP response for testing. (+10 more)

### Community 53 - "Community 53"
Cohesion: 0.09
Nodes (18): Create and configure SSL context for Redis connections. Retained for…, fixture, patch, Test connection parameters for production mode with SSL., Test connection pool creation without TLS uses Connection., TLS pools must use SSLConnection (not Connection + ssl=True)., Test that connection pool is a singleton., Celery asyncio.run per task must not reuse a pool from a closed loop. (+10 more)

### Community 54 - "Community 54"
Cohesion: 0.09
Nodes (15): Any, Create an admin user with a compliant password by default, or return existing…, Create an unverified user., Create a role with the given parameters., Create an admin role., Create a basic user role., Generate a unique fake permission name., Create a permission with the given parameters. (+7 more)

### Community 55 - "Community 55"
Cohesion: 0.09
Nodes (24): get_db(), AsyncSession, Get database session for dependency injection. Uses AsyncSession to ensure all…, app(), client(), mock_get_current_user(), AsyncClient, AsyncSession (+16 more)

### Community 56 - "Community 56"
Cohesion: 0.11
Nodes (25): Many-to-many relationship between Users and Roles with a composite primary key., UserRole, Test assigning roles to a user, test_user_with_roles(), _create_user(), _fk_ondelete(), asyncio, AsyncSession (+17 more)

### Community 57 - "Community 57"
Cohesion: 0.11
Nodes (29): The address to attribute a request to. ``peer`` is the socket's own view of who…, resolve_client_address(), _app(), who(), _ask(), FastAPI, Unit tests for real-client-address resolution behind a reverse proxy (#203).…, A request with no peer (ASGI allows it) has no address to invent. (+21 more)

### Community 58 - "Community 58"
Cohesion: 0.09
Nodes (25): DBType, Any, Enum, str, Test configuration settings for managing the test environment. This allows for…, Test TestConfig.get_db_uri for SQLite, Test TestConfig.get_db_uri for PostgreSQL, Test TestConfig.get_connection_args method (+17 more)

### Community 59 - "Community 59"
Cohesion: 0.16
Nodes (28): get_current_user(), current_user(), Any, token_is_allowlisted(), _admin(), login(), put_user_password(), Any (+20 more)

### Community 60 - "Community 60"
Cohesion: 0.12
Nodes (15): get_settings_dependency(), Any, field_validator, model_validator, Accept both env forms: a JSON list, and a bare comma-separated list. The field…, Fail at startup on a wildcard or a typo rather than per request. Parsing lives…, Build Redis URL for Celery broker and backend, Point the emailed links at wherever the frontend actually is.… (+7 more)

### Community 61 - "Community 61"
Cohesion: 0.16
Nodes (27): compare_files(), executable_line_mismatch(), hit_miss_disagreements(), main(), normalize_filename(), parse_cobertura(), TextIO, Compare two Cobertura XMLs for the same executable line set. Unit and… (+19 more)

### Community 62 - "Community 62"
Cohesion: 0.07
Nodes (29): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+21 more)

### Community 63 - "Community 63"
Cohesion: 0.19
Nodes (27): add_derived_access_token_to_redis(), Stable id for one session (a refresh token and the access tokens derived from…, Allowlist an access token as belonging to the session of ``refresh_token``., session_id_for(), _allowlist_counts(), _establish_session(), _logout(), _no_session_limit() (+19 more)

### Community 64 - "Community 64"
Cohesion: 0.15
Nodes (27): auth_url(), fetch_csrf_token(), is_csrf_rejection(), AsyncClient, parametrize, CSRF protection on state-changing auth endpoints (#164). These replace…, A matching cookie and header pass CSRF validation. The request may still fail…, The cookie alone is not sufficient; the header must accompany it. This is the… (+19 more)

### Community 65 - "Community 65"
Cohesion: 0.10
Nodes (24): background_tasks_mock(), celery_mock(), celery_task_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), http_client_mock(), oauth_provider_mock() (+16 more)

### Community 66 - "Community 66"
Cohesion: 0.11
Nodes (22): main(), retry, Check if the database is ready for connections., Check if Redis is ready for connections., wait_for_database(), wait_for_redis(), Centralized Celery configuration for the FastAPI RBAC system. This module…, Scheduled tasks configuration for Celery Beat. This module defines recurring… (+14 more)

### Community 67 - "Community 67"
Cohesion: 0.10
Nodes (16): Globals, globals_middleware_dispatch(), GlobalsMiddleware, Any, ASGIApp, BaseHTTPMiddleware, Request, Response (+8 more)

### Community 68 - "Community 68"
Cohesion: 0.19
Nodes (18): Assign the admin role to a user using the seeded admin account, with retry for…, generate_strong_password(), login_user(), promote_user_to_admin(), Any, AsyncClient, asyncio, User management integration tests. Tests the complete user management flow… (+10 more)

### Community 69 - "Community 69"
Cohesion: 0.10
Nodes (13): decorator(), MockCeleryResult, MockCeleryTask, Any, Celery service mocks for testing., Mock Celery task for testing., Mock task.delay() method., Mock task.apply_async() method. (+5 more)

### Community 70 - "Community 70"
Cohesion: 0.16
Nodes (13): CRUDBase, Any, AsyncSession, ModelType, Page, Params, CRUD object with default methods to Create, Read, Update, Delete (CRUD).…, Get multiple records by their IDs. (+5 more)

### Community 71 - "Community 71"
Cohesion: 0.10
Nodes (21): create_mock_user(), dependency_overrider(), DependencyOverrider, mock_current_user_factory(), async_mock_current_user(), mock_current_user(), mock_dependency(), Any (+13 more)

### Community 72 - "Community 72"
Cohesion: 0.14
Nodes (24): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), Comprehensive test runner for the refactored test suite. This script provides…, Run integration tests using backend/docker-compose.test.minimal.yml and… (+16 more)

### Community 73 - "Community 73"
Cohesion: 0.17
Nodes (22): get_dashboard_data(), get_dashboard_stats(), get, Session, Retrieve dashboard stats (alias for /dashboard or /dashboard/stats)., Retrieve dashboard data. Data returned will vary based on the user's role., get_active_sessions_count(), get_active_users_count() (+14 more)

### Community 74 - "Community 74"
Cohesion: 0.13
Nodes (21): Any, Input sanitization utilities for XSS prevention and data cleaning. This module…, Sanitize email address input. Args: email: The email address to sanitize…, Sanitize search query input to prevent injection attacks. Args: query: The…, Recursively sanitize string values in a dictionary/JSON object. Args: data:…, Sanitize URL input to prevent XSS and injection attacks. Args: url: The URL to…, Sanitize input value based on field type. Args: value: The value to sanitize…, Sanitize all string values in a dictionary. Args: data: Dictionary to sanitize… (+13 more)

### Community 75 - "Community 75"
Cohesion: 0.15
Nodes (22): context_from_background_sender(), context_from_standalone_sender(), Any, asyncio, fixture, MonkeyPatch, parametrize, timedelta (+14 more)

### Community 76 - "Community 76"
Cohesion: 0.11
Nodes (17): Meta, Any, post_generation, SQLAlchemyModelFactory, Factory for creating User model instances., Start sequence from a random point to avoid conflicts., Add roles to the user if provided., Create a superuser/admin. (+9 more)

### Community 77 - "Community 77"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 78 - "Community 78"
Cohesion: 0.13
Nodes (12): CRUDPermission, AsyncSession, Check if a permission with the given name already exists. Args: name: The name…, Create multiple permissions in a single database transaction. Args:…, Get a permission by its name. Args: name: The name of the permission to…, Assign multiple permissions to a role in a batch operation for improved…, Remove multiple permissions from a role in a batch operation. Args: role_id:…, Check if a permission is currently assigned to any role. Args: permission_id:… (+4 more)

### Community 79 - "Community 79"
Cohesion: 0.16
Nodes (20): clear_refresh_token_cookie(), Any, Response, HttpOnly refresh-token cookie helpers for first-party SPA auth., Path-scope refresh cookies to auth routes only., Secure cookies in production; allow plain HTTP on localhost/dev/test., Set the HttpOnly refresh token cookie. Never log the token value., Clear the refresh token cookie using the same attributes used when setting it. (+12 more)

### Community 80 - "Community 80"
Cohesion: 0.11
Nodes (21): parse_trusted_proxies(), ASGIApp, ValueError, The trusted-proxy configuration cannot be used as written. Raised at settings…, Parse the configured trusted-proxy set. Accepts a comma-separated string or a…, TrustedProxyError, MonkeyPatch, parametrize (+13 more)

### Community 81 - "Community 81"
Cohesion: 0.16
Nodes (20): is_different_network(), origin_network(), parse_client_address(), Compare where a session was established against where it is being used.…, Parse a client address, or return None when ``raw`` is not one. Input is…, The network ``raw`` belongs to, or None when it is not an address. >>>…, Whether ``presented`` comes from a different network than ``recorded``. False…, parametrize (+12 more)

### Community 82 - "Community 82"
Cohesion: 0.14
Nodes (17): Any, field_validator, Override model_dump to customize role serialization, UserBase, IUserLoginSchema, IUserOutput, IUserOutputPaginated, IUserOutputPaginatedSchema (+9 more)

### Community 83 - "Community 83"
Cohesion: 0.13
Nodes (14): IBaseSchema, BaseModel, Base schema class providing common attributes and configuration, IUserBasic, IRoleOutput, IRoleUpdate, BaseModel, Enum (+6 more)

### Community 84 - "Community 84"
Cohesion: 0.16
Nodes (19): admin_created_users_get_a_verification_email(), admin_creates_user(), emailed_token(), AsyncClient, asyncio, AsyncSession, BackgroundTasks, fixture (+11 more)

### Community 85 - "Community 85"
Cohesion: 0.19
Nodes (19): AsyncClient, asyncio, Redis, Integration tests for Redis JWT allowlist enforcement (#73) and HttpOnly…, After logout, a previously issued refresh token must be rejected., Refresh via HttpOnly cookie + CSRF must return a new access token., JSON login must always write both access and refresh tokens into Redis., A cryptographically valid refresh JWT must fail when Redis set is empty. (+11 more)

### Community 86 - "Community 86"
Cohesion: 0.24
Nodes (12): AsyncClient, asyncio, AsyncSession, Test complete CRUD operations for permission groups., Test operations on permission groups that contain permissions., Integration tests for permission management flows., Test permission listing and pagination., Test handling of duplicate permission names. (+4 more)

### Community 87 - "Community 87"
Cohesion: 0.14
Nodes (18): parametrize, Emailed links must follow FRONTEND_URL. PASSWORD_RESET_URL and…, Build Settings with the derived fields blank unless a test sets them., The whole point: one setting decides where mail points., The regression itself: an override that did not propagate., A derived link must not retain the class default's host., Deriving is a default, not a policy. A deployment that serves a link from a…, FRONTEND_URL with a trailing slash must not produce a // in the path. (+10 more)

### Community 88 - "Community 88"
Cohesion: 0.11
Nodes (10): Any, Service configuration for environment-specific settings. Manages Redis, Celery,…, Get database URL based on environment, Environment-specific service settings for Celery, Redis, and other external…, Get the Redis URL based on current environment. For production, uses rediss://…, Get the Celery broker URL based on current environment, Get the Celery result backend URL based on current environment, Determine whether to use Celery based on environment (+2 more)

### Community 89 - "Community 89"
Cohesion: 0.41
Nodes (10): login_user(), promote_user_to_admin(), Any, AsyncClient, asyncio, Role management integration tests. Tests the complete role management flow…, Integration tests for role management flows (API-driven)., register_and_verify_user() (+2 more)

### Community 90 - "Community 90"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 91 - "Community 91"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 92 - "Community 92"
Cohesion: 0.14
Nodes (16): get_async_session(), get_redis_client(), Any, AsyncSession, Redis, Create and get async database session. This function yields an AsyncSession for…, Get Redis client instance as an async generator. Yields a Redis client…, cleanup_unverified_users_task() (+8 more)

### Community 93 - "Community 93"
Cohesion: 0.16
Nodes (9): MockEmailService, Any, Email service mocks for testing., Mock implementation of email service for testing., Mock verification email sending., Mock password reset email sending., Clear the sent emails list., Get the last sent email. (+1 more)

### Community 94 - "Community 94"
Cohesion: 0.19
Nodes (9): FakeDistribution, Stand-in for ``importlib.metadata.PathDistribution``. ``metadata``/``version``…, ``~``-prefixed dist-info dirs are pip's aborted-upgrade debris. Their…, ``foo-1.0-py3.10.egg-info`` splits naively as name ``foo-1.0``. That would hide…, Canary for the private ``_path`` attribute this module reads. If a stdlib…, TestInstalledVersions, installed_versions(), Any (+1 more)

### Community 95 - "Community 95"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 96 - "Community 96"
Cohesion: 0.26
Nodes (15): assert_main_clean(), build_docker_images(), build_release_notes_entry(), clear_changelog_artifact(), create_git_tag(), generate_changelog(), get_latest_git_tag(), invoke_direct_tag_mode() (+7 more)

### Community 97 - "Community 97"
Cohesion: 0.21
Nodes (10): Send an email using the emails library, which supports both development and…, Render a template and send it as an email., send_email(), send_email_with_template(), Send a password reset email to a user. Args: email: The recipient's email…, send_reset_password_email(), check_send_reset_password_email(), Manual mail-delivery check against a real SMTP server. Sends one password-reset… (+2 more)

### Community 98 - "Community 98"
Cohesion: 0.16
Nodes (13): AsyncEngine, db(), db_engine(), initialize_db(), AsyncSession, fixture, Initialize the database for the test session., Create test database tables and return engine. (+5 more)

### Community 99 - "Community 99"
Cohesion: 0.24
Nodes (10): Assert-MainClean(), Build-DockerImages(), Get-ReleaseNotesEntry(), Invoke-DirectTagMode(), Invoke-ReleasePrMode(), New-Changelog(), New-GitTag(), Confirm-Continue() (+2 more)

### Community 100 - "Community 100"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 101 - "Community 101"
Cohesion: 0.21
Nodes (12): get_or_create_superuser(), init_db(), AsyncSession, create_init_data(), main(), Create initial database data if it doesn't exist., create_init_data(), main() (+4 more)

### Community 102 - "Community 102"
Cohesion: 0.24
Nodes (13): check_csrf_token_generation(), check_endpoint_with_csrf(), check_endpoint_with_invalid_csrf(), check_endpoint_without_csrf(), get_test_data(), main(), Any, Session (+5 more)

### Community 103 - "Community 103"
Cohesion: 0.18
Nodes (10): COMMON_PASSWORDS, isPasswordPolicyCompliant(), PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_RULES, PASSWORD_SPECIAL_CHARS, passwordPolicyIssues(), PasswordRule (+2 more)

### Community 104 - "Community 104"
Cohesion: 0.24
Nodes (10): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, dashboardSlice, DashboardState (+2 more)

### Community 105 - "Community 105"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 106 - "Community 106"
Cohesion: 0.17
Nodes (11): _decode(), is_trusted_proxy(), ProxyHeadersMiddleware, Resolve the address a request actually came from, behind a reverse proxy. nginx…, Whether ``address`` is one of the configured reverse proxies., Correct ``scope["client"]`` once, before anything downstream reads it. Pure…, The non-empty entries of a comma-separated string or a sequence. Shared by the…, split_entries() (+3 more)

### Community 107 - "Community 107"
Cohesion: 0.22
Nodes (9): Any, timedelta, Generate an expired token for testing expiration handling. Args: user_id: User…, Factory for generating JWT tokens for testing., Generate a test access token. Args: user_id: User ID to include in the token…, Generate a test refresh token. Args: user_id: User ID to include in the token…, Generate authentication headers for testing. Args: access_token: Optional pre-…, TokenFactory (+1 more)

### Community 108 - "Community 108"
Cohesion: 0.18
Nodes (10): Test input validation for authentication endpoints., Test validation errors during registration., Test validation errors during login., TestAuthenticationValidation, Permission management integration tests. Tests the complete permission…, get_csrf_token(), AsyncClient, Get CSRF token and return both the token and the headers needed for requests.… (+2 more)

### Community 109 - "Community 109"
Cohesion: 0.15
Nodes (8): Any, Stands in for the socket and nothing above it. ``SMTPBackend.sendmail`` still…, One message as it would have been handed to the socket., Decoded body of the first part with this content type., RecordingSMTPClient, SentMessage, get_client(), MIMEMessage

### Community 110 - "Community 110"
Cohesion: 0.32
Nodes (5): TestFormatReport, Drift, format_report(), Render the drift report: the count, the worst offenders, and the fix., One pinned package whose installed version does not match the pin.

### Community 111 - "Community 111"
Cohesion: 0.18
Nodes (9): AuditLogFactory, Meta, Any, lazy_attribute, SQLAlchemyModelFactory, Factory for creating AuditLog model instances., Generate a JSON-compatible details dictionary., Create an audit log entry for a specific user. (+1 more)

### Community 112 - "Community 112"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 113 - "Community 113"
Cohesion: 0.29
Nodes (5): CircularDependencyException, Any, Exception, ModelType, Exception raised when a circular dependency is detected

### Community 114 - "Community 114"
Cohesion: 0.20
Nodes (6): Any, Build Redis connection parameters based on environment. Args: db: Redis…, Return whether Redis TLS should be used for the given mode., Resolve the directory that holds Redis TLS materials., Build kwargs for redis.asyncio.SSLConnection. redis-py asyncio does not accept…, Test connection parameters for development mode.

### Community 115 - "Community 115"
Cohesion: 0.18
Nodes (10): MonkeyPatch, Four settings advertised session controls nothing implemented. ADR 0011…, Gone from the public Settings surface, so they cannot be read as active., An operator's leftover .env must not fail the next boot. extra='ignore' is…, A name nothing reads must not be reintroduced as a later 'security' field., A stale .example that still lists a deleted setting is the original bug., test_example_env_files_do_not_advertise_the_four_settings(), test_settings_have_none_of_the_four_unimplemented_session_controls() (+2 more)

### Community 116 - "Community 116"
Cohesion: 0.25
Nodes (7): MonkeyPatch, Tests for the virtualenv drift guard that runs at test-session start. See…, The guard is only credible if it passes on a correctly built venv., TestFailOnDrift, fail_on_drift(), TextIO, Abort the test session when the virtualenv has drifted from the pins. The root…

### Community 117 - "Community 117"
Cohesion: 0.33
Nodes (5): Path, TestCheckForDrift, check_for_drift(), Path, Return a drift report, or ``None`` when the environment is fine or opted out.

### Community 118 - "Community 118"
Cohesion: 0.29
Nodes (4): parametrize, TestParsePins, parse_pins(), Map canonical package name -> exactly pinned version. Only ``name==version``…

### Community 119 - "Community 119"
Cohesion: 0.33
Nodes (8): downgrade(), get_uuid_type(), has_column(), upgrade(), downgrade(), has_column(), Check if a column exists in a table, upgrade()

### Community 120 - "Community 120"
Cohesion: 0.36
Nodes (9): asyncio, AsyncSession, Test creating an entity with BaseUUIDModel as base class, Test updating an entity with BaseUUIDModel as base class, Test that UUIDs are unique for each instance, SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update() (+1 more)

### Community 121 - "Community 121"
Cohesion: 0.33
Nodes (3): TestFindDrift, find_drift(), Return the pinned packages the environment does not satisfy, worst first.…

### Community 122 - "Community 122"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 124 - "Community 124"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 125 - "Community 125"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 126 - "Community 126"
Cohesion: 0.22
Nodes (7): Root conftest.py to help pytest discover the app module. This file adds the…, _is_version(), _matches(), Detect a backend virtualenv that has drifted from ``requirements.txt``. Nothing…, Is this the version half of a dist dir name, or did the split go wrong? Legacy…, Rank drift worst-first: missing, then the earliest diverging component., _severity()

### Community 127 - "Community 127"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 128 - "Community 128"
Cohesion: 0.25
Nodes (6): comprehensive_mocks(), Provide comprehensive mocks for integration testing., MockCeleryApp, Clear all task call history., Mock Celery application for testing., Get task calls, optionally filtered by task name.

### Community 129 - "Community 129"
Cohesion: 0.32
Nodes (8): asyncio, AsyncSession, Test updating user information, Test creating a user in the database, Test that users must have unique emails, test_create_user(), test_user_unique_email_constraint(), test_user_update()

### Community 130 - "Community 130"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 131 - "Community 131"
Cohesion: 0.46
Nodes (6): asRecord(), nonEmptyString(), normalizeApiError(), NormalizedApiError, readDetails(), RULES

### Community 132 - "Community 132"
Cohesion: 0.29
Nodes (3): _PlainTextExtractor, Render an HTML email body as readable plain text. Derived from the rendered…, HTMLParser

### Community 133 - "Community 133"
Cohesion: 0.43
Nodes (4): Any, HTTPException, UserNotFoundException, UserSelfDeleteException

### Community 134 - "Community 134"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 137 - "Community 137"
Cohesion: 0.40
Nodes (5): do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, Run migrations in 'online' mode. In this scenario we need to create an Engine…, run_migrations_offline(), run_migrations_online()

### Community 138 - "Community 138"
Cohesion: 0.40
Nodes (5): downgrade(), get_uuid_type(), This migration fixes the case conflict between 'rolegroupmap' and…, For downgrade, we would remove any columns we added, but this is rarely needed…, upgrade()

### Community 139 - "Community 139"
Cohesion: 0.73
Nodes (5): downgrade(), _fk_names(), Any, _recreate_fk(), upgrade()

### Community 140 - "Community 140"
Cohesion: 0.33
Nodes (6): health_check(), Any, BackgroundTasks, get, Redis, Perform a health check of all critical system components, including: - API…

### Community 141 - "Community 141"
Cohesion: 0.33
Nodes (6): custom_swagger_ui_html(), get, An example "Hello world" FastAPI route., Serve Swagger UI with CSRF support for state-changing requests., root(), HTMLResponse

### Community 142 - "Community 142"
Cohesion: 0.40
Nodes (5): IPermissionGroupBase, IPermissionGroupWithPermissions, Any, model_validator, Prevent infinite recursion in parent/child relationships

### Community 143 - "Community 143"
Cohesion: 0.40
Nodes (5): estimate_password_strength(), load_common_passwords(), Tools for loading and validating common passwords., Load common passwords from files in the project's password lists directory., Estimate password strength using zxcvbn. Returns: dict: Password strength…

### Community 144 - "Community 144"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 145 - "Community 145"
Cohesion: 0.40
Nodes (6): asyncio, AsyncSession, Test retrieving all users with a specific role, Test creating a user-role mapping in the database, test_create_user_role(), test_retrieve_users_with_role()

### Community 146 - "Community 146"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 147 - "Community 147"
Cohesion: 0.60
Nodes (4): downgrade(), Check if a table exists, table_exists(), upgrade()

### Community 148 - "Community 148"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 150 - "Community 150"
Cohesion: 0.40
Nodes (4): compilerOptions, paths, files, references

### Community 151 - "Community 151"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 157 - "Community 157"
Cohesion: 0.50
Nodes (3): debug_cors(), Add this to the top of your main.py file after imports to debug CORS…, Add this function to your main.py file and call it before adding CORS middleware

### Community 161 - "Community 161"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

## Knowledge Gaps
- **343 isolated node(s):** `LogoutEverywhereControlProps`, `DataTableProps`, `DataTableColumnHeaderProps`, `DataTableProps`, `BadgeProps` (+338 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1778 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 17` to `Community 1`, `Community 129`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 11`, `Community 12`, `Community 15`, `Community 16`, `Community 145`, `Community 19`, `Community 20`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 34`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 43`, `Community 44`, `Community 46`, `Community 48`, `Community 49`, `Community 54`, `Community 56`, `Community 59`, `Community 63`, `Community 71`, `Community 73`, `Community 76`, `Community 82`, `Community 84`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Why does `Settings` connect `Community 60` to `Community 66`, `Community 8`, `Community 137`, `Community 80`, `Community 115`, `Community 87`, `Community 57`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `ModeEnum` connect `Community 66` to `Community 33`, `Community 92`, `Community 79`, `Community 114`, `Community 53`, `Community 23`, `Community 88`, `Community 25`, `Community 60`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 115 inferred relationships involving `User` (e.g. with `get_current_user()` and `change_password()`) actually correct?**
  _`User` has 115 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `MockRedisClient` (e.g. with `admin_creates_user()` and `test_the_emailed_link_verifies_the_account()`) actually correct?**
  _`MockRedisClient` has 34 INFERRED edges - model-reasoned connections that need verification._
- **What connects `LogoutEverywhereControlProps`, `DataTableProps`, `DataTableColumnHeaderProps` to the rest of the system?**
  _343 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0817347789824854 - nodes in this community are weakly interconnected._