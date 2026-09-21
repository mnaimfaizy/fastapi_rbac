# Graph Report - fastapi_rbac  (2026-09-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4774 nodes · 13194 edges · 233 communities (170 shown, 63 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 915 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `79101d40`
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
- Community 208
- Community 209
- Community 221

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
- `__aenter__()` --indirect_call--> `db()`  [INFERRED]
  backend/test/unit/test_log_security_event.py → backend/test/fixtures/fixtures_db.py
- `AuditLogFactory` --uses--> `AuditLog`  [INFERRED]
  backend/test/factories/audit_factory.py → backend/app/models/audit_log_model.py
- `comprehensive_mocks()` --uses--> `MockEmailService`  [INFERRED]
  backend/test/fixtures/enhanced_service_mocks.py → backend/test/mocks/email_mock.py
- `email_failure_mock()` --uses--> `MockEmailService`  [INFERRED]
  backend/test/fixtures/enhanced_service_mocks.py → backend/test/mocks/email_mock.py
- `email_mock()` --uses--> `MockEmailService`  [INFERRED]
  backend/test/fixtures/enhanced_service_mocks.py → backend/test/mocks/email_mock.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (233 total, 63 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (92): LogoutEverywhereControlProps, DataTableProps, ProfileContent(), DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps, AlertDialog() (+84 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (48): alembic, get_uuid_type(), upgrade(), get_uuid_type(), upgrade(), downgrade(), Check if a table exists, table_exists() (+40 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (89): app_core_config, app_core_security, PasswordValidator, Password validation helper class., Validate password complexity according to settings. Returns a tuple of…, Check if password contains sequential characters., Check if password has too many repeated characters., Verify a password against its hash. (+81 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (78): InitAuth(), ApiErrorAlert(), ApiErrorAlertProps, LoginForm(), LoginFormData, loginSchema, PasswordRequirements(), PasswordRequirementsProps (+70 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (72): app_schemas_role_group_schema, clear_user_delete_references(), Clear rows that must not block or outlive a user deletion as orphans (#238).…, AuditLog, AuditLogBase, Model for storing security audit logs, BaseUUIDModel, datetime (+64 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (94): app_schemas_token_schema, get_input_sanitizer(), get_permissive_sanitizer(), get_strict_sanitizer(), Get input sanitizer instance for dependency injection. Args: strict_mode:…, Get strict input sanitizer for sensitive operations. Returns: InputSanitizer:…, Get permissive input sanitizer for content that may contain HTML. Returns:…, change_password() (+86 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (63): app_deps, app_schemas_dashboard_schema, app_schemas_response_schema, app_schemas_user_schema, app_utils_exceptions_common_exception, This module contains the dependency injection utilities used across the FastAPI…, create_permission(), delete_permission() (+55 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (61): delete_permission_group(), delete, Deletes a permission group by its id Required roles: - admin - manager, Hash a password with bcrypt with enhanced security. - Uses a high work factor…, CRUDUser, PasswordReuseError, Any, AsyncSession (+53 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (61): assign_permissions_to_role(), create_role(), delete_role(), get_all_roles_list(), get_role_by_id(), get_roles(), AsyncSession, BackgroundTasks (+53 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (73): add_token_claims(), create_refresh_token(), create_reset_token(), create_verification_token(), get_content(), get_data_encrypt(), get_fernet_key(), Any (+65 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (61): DataTable(), DataTableColumn, OverviewChart(), StatsCard(), chartData, DashboardOverview(), userTableColumns, NestedPermissionGroupProps (+53 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (50): AsyncFactoryBase, AsyncPermissionFactory, AsyncPermissionGroupFactory, AsyncRoleFactory, AsyncRoleGroupFactory, AsyncTestDataBuilder, Any, AsyncSession (+42 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (44): react_frontend_src_assets_images_login_signup_bg_image, ProtectedRoute(), ProtectedRouteProps, AppWrapper(), AppWrapperProps, LoadingScreen(), LoadingScreenProps, Meta() (+36 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (59): NestedRoleGroupProps, RoleGroupDetail(), RoleGroupForm(), RoleGroupFormProps, RoleGroupFormContent(), RoleGroupList(), RoleGroupRowProps, RoleDetail() (+51 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (35): CRUDBase, Any, AsyncSession, ModelType, Page, Params, CRUD object with default methods to Create, Read, Update, Delete (CRUD).…, Get multiple records by their IDs. (+27 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (54): PermissionBase, UserBase, IBaseSchema, BaseModel, Base schema class providing common attributes and configuration, IPermissionGroupRead, IPermissionGroupReadWithPermissions, IPermissionRead (+46 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (52): Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), react_frontend_src_components_ui_form_form, FormControl() (+44 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (42): AsyncClient, asyncio, AsyncSession, patch, Response, A second POST with the same JWT answers 200 after Redis is consumed (#239)., A signed JWT that does not match Redis is the uniform 400 while unverified., Test login endpoint structure when registration fails. (+34 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (35): ResendVerificationEmailForm(), VerifyEmailPage(), AuthState, ErrorResponse, ErrorResponseWithErrors, LoginCredentials, PasswordResetConfirm, PasswordResetRequest (+27 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (56): account_email_budget_key(), AccountState, classify(), Enum, str, What an email address currently corresponds to. ``DISABLED`` is checked before…, Map a user row (or its absence) onto the four states., Redis key for the shared per-address mail budget. (+48 more)

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (55): PasswordResetRequest, Schema for requesting a password reset, UserRegister, consume_account_email_budget(), _create_pending_user(), dispatch_account_email(), DispatchResult, issue_verification() (+47 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (53): app_core, app_schemas_common_schema, allowlist_key(), auth_url(), login(), post_change_password(), Any, AsyncClient (+45 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (50): TokenType, add_derived_access_token_to_redis(), add_token_to_redis(), _allowlist_key(), _allowlist_meta_key(), _as_text(), end_caller_session(), _enforce_concurrent_session_limit() (+42 more)

### Community 23 - "Community 23"
Cohesion: 0.05
Nodes (48): engines, node, name, private, type, version, autoprefixer, class-variance-authority (+40 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (48): get_current_user(), current_user(), Any, add_session_tokens_to_redis(), get_valid_tokens(), Record one session: a refresh token and the access token derived from it.…, token_is_allowlisted(), asyncio (+40 more)

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (48): The client address a session was established from, or None if unrecorded.…, Whether this refresh comes from a different network than the session's. Gated…, refresh_origin_is_anomalous(), session_origin_ip(), _db_user(), _establish_session(), _origin_check_enabled(), asyncio (+40 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (46): header_text(), _mail_settings(), mock_send_email(), fixture, LogCaptureFixture, MonkeyPatch, parametrize, ``send_email`` against the real ``emails`` API, stubbed only at the socket. The… (+38 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (33): App(), react_frontend_src_index, createTestStoreForRoleList(), ExtendedRenderOptions, renderRoleListWithMockedDispatch(), initialRoleGroupState, mockAuthState, MockedFunction (+25 more)

### Community 28 - "Community 28"
Cohesion: 0.07
Nodes (12): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.08
Nodes (41): app_core_rate_limit, app_core_service_config, client_address_key(), create_limiter(), _is_testing(), Request, rate_limit_key(), Shared slowapi HTTP rate limiter for the FastAPI app. HTTP rate limits use this… (+33 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (38): cmd_config(), cmd_down(), cmd_env(), cmd_exec(), cmd_health(), cmd_logs(), cmd_pull(), cmd_restart() (+30 more)

### Community 31 - "Community 31"
Cohesion: 0.07
Nodes (28): _CRLFMessageProxy, _CRLFSMTPBackend, Any, Wraps a built MIME message so ``as_bytes()`` returns CRLF line endings. SMTP…, Delegates to a pooled emails SMTP backend, forcing CRLF on the way out.…, built_message(), Any, parametrize (+20 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (38): password_reuse_window(), How many stored passwords the reuse policy refuses. ``PASSWORD_HISTORY_SIZE``…, _app_package(), auth_url(), detail_of(), history_hashes(), issue_reset_token(), login_headers() (+30 more)

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (39): IRoleCreate, asyncio, AsyncSession, Test retrieving multiple roles with pagination, Test retrieving all roles without pagination, Test adding a role to a user, Test creating a role through CRUD operations, Test adding a non-existent role to a user raises ValueError (+31 more)

### Community 34 - "Community 34"
Cohesion: 0.10
Nodes (36): app_schemas_base_schema, add_roles_to_group(), bulk_create_role_groups(), bulk_delete_role_groups(), clone_role_group(), create_role_group(), delete_role_group(), get_role_group_by_id() (+28 more)

### Community 35 - "Community 35"
Cohesion: 0.08
Nodes (11): fixture, Provide a stateful Redis mock so JWT allowlist sets work in tests (#73)., redis_mock(), MockRedisClient, Any, Set expiration for a key (accepts seconds or timedelta-like values)., Initialize with storage dictionaries to simulate Redis state., SETEX takes (key, ttl, value); note the argument order differs from SET. (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (36): app_schemas_role_schema, get_or_create_superuser(), init_db(), AsyncSession, IRoleGroupCreate, asyncio, AsyncSession, Test retrieving all role groups without pagination (+28 more)

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (36): IPermissionGroupCreate, IPermissionCreate, asyncio, AsyncSession, Test retrieving a permission by ID with relationships loaded, Test updating a permission, Test updating a permission's name, Test retrieving multiple permissions with pagination (+28 more)

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (35): _decode(), ProxyHeadersMiddleware, The address to attribute a request to. ``peer`` is the socket's own view of who…, Correct ``scope["client"]`` once, before anything downstream reads it. Pure…, resolve_client_address(), _app(), who(), _ask() (+27 more)

### Community 39 - "Community 39"
Cohesion: 0.05
Nodes (37): dependencies, autoprefixer, axios, class-variance-authority, clsx, cmdk, date-fns, @hookform/resolvers (+29 more)

### Community 40 - "Community 40"
Cohesion: 0.10
Nodes (20): asyncio, AsyncSession, Test user retrieval with non-existent email., Test successful user update., Test partial user update., Test successful user deletion., Test deletion of non-existent user., Test user listing with pagination. (+12 more)

### Community 41 - "Community 41"
Cohesion: 0.11
Nodes (32): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), Exception, JSONResponse, Request, Response (+24 more)

### Community 42 - "Community 42"
Cohesion: 0.27
Nodes (31): auth_url(), csrf_headers(), events_named(), matching(), post_login(), Any, AsyncClient, AsyncSession (+23 more)

### Community 43 - "Community 43"
Cohesion: 0.08
Nodes (26): background_tasks_mock(), celery_mock(), celery_task_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), oauth_provider_mock(), patched_external_services() (+18 more)

### Community 44 - "Community 44"
Cohesion: 0.08
Nodes (26): DBType, Any, Enum, str, Test configuration settings for managing the test environment. This allows for…, Test TestConfig.get_db_uri for SQLite, Test TestConfig.get_db_uri for PostgreSQL, Test TestConfig.get_connection_args method (+18 more)

### Community 45 - "Community 45"
Cohesion: 0.09
Nodes (23): LogoutEverywhereControl(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle() (+15 more)

### Community 46 - "Community 46"
Cohesion: 0.09
Nodes (23): asyncio, humanize_minutes(), _plural(), Render a configured lifetime as the phrase that goes into an email. Email copy…, Describe ``minutes`` in the largest unit that divides it exactly. >>>…, Send an email using the emails library, which supports both development and…, Render a Jinja template from the email templates directory with the given…, Render a template and send it as an email. (+15 more)

### Community 47 - "Community 47"
Cohesion: 0.12
Nodes (30): assign_roles_to_user(), bulk_update_users(), get_my_data(), get_user_by_id(), get_user_list_order_by_created_at(), Any, AsyncSession, delete (+22 more)

### Community 48 - "Community 48"
Cohesion: 0.15
Nodes (28): compare_files(), executable_line_mismatch(), hit_miss_disagreements(), main(), normalize_filename(), parse_cobertura(), TextIO, Compare two Cobertura XMLs for the same executable line set. Unit and… (+20 more)

### Community 49 - "Community 49"
Cohesion: 0.12
Nodes (15): get_settings_dependency(), Any, field_validator, model_validator, Accept both env forms: a JSON list, and a bare comma-separated list. The field…, Fail at startup on a wildcard or a typo rather than per request. Parsing lives…, Build Redis URL for Celery broker and backend, Point the emailed links at wherever the frontend actually is.… (+7 more)

### Community 50 - "Community 50"
Cohesion: 0.09
Nodes (25): BaseFactory, Meta, Any, post_generation, Session, SQLAlchemyModelFactory, Add permissions to the role if provided., Create role with specific permissions. (+17 more)

### Community 51 - "Community 51"
Cohesion: 0.07
Nodes (29): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+21 more)

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (27): argparse, clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), Comprehensive test runner for the refactored test suite. This script provides… (+19 more)

### Community 53 - "Community 53"
Cohesion: 0.12
Nodes (25): is_trusted_proxy(), Resolve the address a request actually came from, behind a reverse proxy. nginx…, Whether ``address`` is one of the configured reverse proxies., is_different_network(), origin_network(), parse_client_address(), Compare where a session was established against where it is being used.…, Parse a client address, or return None when ``raw`` is not one. Input is… (+17 more)

### Community 54 - "Community 54"
Cohesion: 0.10
Nodes (19): close_redis_pool(), get_redis_client(), Redis, retry, Get a Redis client using the connection pool. Args: db: Redis database number…, Perform a health check on Redis connection. Args: client: Optional Redis client…, Close the connection pool and cleanup resources., Get a Redis client instance. Args: db: Redis database number (default: 0)… (+11 more)

### Community 55 - "Community 55"
Cohesion: 0.10
Nodes (17): Any, Build Redis connection parameters based on environment. Args: db: Redis…, Create a connection pool for Redis. Args: db: Redis database number…, Drop the cached pool without awaiting disconnect. Used when the owning asyncio…, Get or create a singleton connection pool. Args: db: Redis database number…, Factory class for creating and managing Redis connections with SSL support.…, Return whether Redis TLS should be used for the given mode., Resolve the directory that holds Redis TLS materials. (+9 more)

### Community 56 - "Community 56"
Cohesion: 0.15
Nodes (27): auth_url(), fetch_csrf_token(), is_csrf_rejection(), AsyncClient, parametrize, CSRF protection on state-changing auth endpoints (#164). These replace…, A matching cookie and header pass CSRF validation. The request may still fail…, The cookie alone is not sufficient; the header must accompany it. This is the… (+19 more)

### Community 57 - "Community 57"
Cohesion: 0.17
Nodes (18): AsyncClient, asyncio, AsyncSession, Test dashboard role analytics endpoints., Test dashboard activity metrics endpoints., Test dashboard system health endpoints., Integration tests for dashboard endpoints., Test dashboard recent activities endpoint. (+10 more)

### Community 58 - "Community 58"
Cohesion: 0.15
Nodes (25): get_dashboard_data(), get_dashboard_stats(), get, Session, Retrieve dashboard stats (alias for /dashboard or /dashboard/stats)., Retrieve dashboard data. Data returned will vary based on the user's role., get_active_sessions_count(), get_active_users_count() (+17 more)

### Community 59 - "Community 59"
Cohesion: 0.11
Nodes (24): Any, Input sanitization utilities for XSS prevention and data cleaning. This module…, Sanitize email address input. Args: email: The email address to sanitize…, Sanitize search query input to prevent injection attacks. Args: query: The…, Recursively sanitize string values in a dictionary/JSON object. Args: data:…, Sanitize URL input to prevent XSS and injection attacks. Args: url: The URL to…, Sanitize input value based on field type. Args: value: The value to sanitize…, Sanitize all string values in a dictionary. Args: data: Dictionary to sanitize… (+16 more)

### Community 60 - "Community 60"
Cohesion: 0.18
Nodes (19): generate_strong_password(), login_user(), promote_user_to_admin(), Any, AsyncClient, asyncio, User management integration tests. Tests the complete user management flow…, Generate a strong password that avoids sequential characters and meets… (+11 more)

### Community 61 - "Community 61"
Cohesion: 0.14
Nodes (24): app_schemas_permission_group_schema, app_schemas_permission_schema, asyncio, AsyncSession, Test deleting a permission group, Test adding permissions to a permission group, Test creating a permission group through CRUD operations, Test permission groups with subgroups relationship (+16 more)

### Community 62 - "Community 62"
Cohesion: 0.11
Nodes (19): Root conftest.py to help pytest discover the app module. This file adds the…, MonkeyPatch, Tests for the virtualenv drift guard that runs at test-session start. See…, The guard is only credible if it passes on a correctly built venv., TestFailOnDrift, fail_on_drift(), _is_version(), _matches() (+11 more)

### Community 63 - "Community 63"
Cohesion: 0.23
Nodes (23): AsyncUserFactory, Async factory for creating User model instances., Generate a unique fake email., _exists(), _make_user(), _naive_utc_now(), asyncio, AsyncSession (+15 more)

### Community 64 - "Community 64"
Cohesion: 0.10
Nodes (13): decorator(), MockCeleryResult, MockCeleryTask, Any, Mock Celery task for testing., Mock task.delay() method., Mock task.apply_async() method., Clear the task call history. (+5 more)

### Community 65 - "Community 65"
Cohesion: 0.10
Nodes (23): parse_trusted_proxies(), ASGIApp, ValueError, The trusted-proxy configuration cannot be used as written. Raised at settings…, The non-empty entries of a comma-separated string or a sequence. Shared by the…, Parse the configured trusted-proxy set. Accepts a comma-separated string or a…, split_entries(), TrustedProxyError (+15 more)

### Community 66 - "Community 66"
Cohesion: 0.12
Nodes (14): Create and configure SSL context for Redis connections. Retained for…, patch, Test connection parameters for production mode with SSL., Test connection pool creation without TLS uses Connection., TLS pools must use SSLConnection (not Connection + ssl=True)., Test that connection pool is a singleton., Celery asyncio.run per task must not reuse a pool from a closed loop., Test suite for RedisConnectionFactory. (+6 more)

### Community 67 - "Community 67"
Cohesion: 0.14
Nodes (21): PermissionFactory, PermissionGroupFactory, lazy_attribute, Factory for creating PermissionGroup model instances., Generate a group ID, creating a new group if necessary., auth_headers(), db_factories(), HeadersCallable (+13 more)

### Community 68 - "Community 68"
Cohesion: 0.13
Nodes (22): create_permission_group(), get_permission_group_by_id(), get_permission_groups(), AsyncSession, get, Params, post, put (+14 more)

### Community 69 - "Community 69"
Cohesion: 0.23
Nodes (22): create_user(), AsyncRedis, BackgroundTasks, Creates a new user Required roles: - admin Note: Admin-created users behavior…, Updates a user by id Required roles: - admin A new password is subject to the…, update_user(), _admin(), _complexity_detail() (+14 more)

### Community 70 - "Community 70"
Cohesion: 0.14
Nodes (14): AsyncClient, asyncio, AsyncSession, Test basic system functionality., Test that database connection is working., Test that health endpoint is working., Test that API responds with correct version prefix., Test that CORS headers are present. (+6 more)

### Community 71 - "Community 71"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 72 - "Community 72"
Cohesion: 0.13
Nodes (12): CRUDPermission, AsyncSession, Check if a permission with the given name already exists. Args: name: The name…, Create multiple permissions in a single database transaction. Args:…, Get a permission by its name. Args: name: The name of the permission to…, Assign multiple permissions to a role in a batch operation for improved…, Remove multiple permissions from a role in a batch operation. Args: role_id:…, Check if a permission is currently assigned to any role. Args: permission_id:… (+4 more)

### Community 73 - "Community 73"
Cohesion: 0.16
Nodes (20): clear_refresh_token_cookie(), Any, Response, HttpOnly refresh-token cookie helpers for first-party SPA auth., Path-scope refresh cookies to auth routes only., Secure cookies in production; allow plain HTTP on localhost/dev/test., Set the HttpOnly refresh token cookie. Never log the token value., Clear the refresh token cookie using the same attributes used when setting it. (+12 more)

### Community 74 - "Community 74"
Cohesion: 0.18
Nodes (21): _app_package(), auth_url(), csrf_headers(), post_register(), Any, AsyncClient, MonkeyPatch, parametrize (+13 more)

### Community 75 - "Community 75"
Cohesion: 0.11
Nodes (18): dependency_overrider(), DependencyOverrider, mock_current_user_factory(), async_mock_current_user(), mock_current_user(), mock_dependency(), Any, FastAPI (+10 more)

### Community 76 - "Community 76"
Cohesion: 0.13
Nodes (19): get_cached_celery_config(), get_celery_config(), Any, Celery configuration module for the FastAPI RBAC project. This module provides…, Get cached Celery configuration. Uses lru_cache to cache the configuration and…, Get Celery configuration dictionary with all necessary settings. Returns:…, DatabaseTypeEnum, get_project_root() (+11 more)

### Community 77 - "Community 77"
Cohesion: 0.15
Nodes (19): VerifyEmail, AsyncSession, BackgroundTasks, Single owner of "this token-bearing request failed, and why is nobody's…, Record why the reset failed, then answer as if nothing was learned., Record why verification failed, then answer as if nothing was learned., _reject(), reject_password_reset() (+11 more)

### Community 78 - "Community 78"
Cohesion: 0.12
Nodes (10): MockHTTPResponse, MockOAuthProvider, Any, Mock HTTP response for testing., Mock user info retrieval., Set user info for a token., Add authorization code., Raise exception for bad status codes. (+2 more)

### Community 79 - "Community 79"
Cohesion: 0.15
Nodes (16): main(), retry, Check if the database is ready for connections., Check if Redis is ready for connections., wait_for_database(), wait_for_redis(), Enhanced Redis connection management with SSL support for production. This…, Global pytest configuration for the FastAPI RBAC project. This module sets up… (+8 more)

### Community 80 - "Community 80"
Cohesion: 0.16
Nodes (19): html_to_plain_text(), Best-effort plain-text rendering of an HTML email body., parametrize, Every outgoing email carries a readable plain-text part. Messages were sent as…, The whole point: a reader can see and copy the URL., A labelled link shows both the label and where it goes., An anchor whose text already is the URL emits it once, not twice., Style and script contents are markup, never prose. (+11 more)

### Community 81 - "Community 81"
Cohesion: 0.26
Nodes (19): _admin(), login(), put_user_password(), Any, AsyncClient, AsyncSession, Response, An admin-set password revokes the target user's allowlisted sessions (#240).… (+11 more)

### Community 82 - "Community 82"
Cohesion: 0.13
Nodes (15): Meta, Any, SQLAlchemyModelFactory, Factory for creating User model instances., Start sequence from a random point to avoid conflicts., Create a superuser/admin., Create a locked user., Create a user that needs to change password. (+7 more)

### Community 83 - "Community 83"
Cohesion: 0.24
Nodes (12): AsyncClient, asyncio, AsyncSession, Test complete CRUD operations for permission groups., Test operations on permission groups that contain permissions., Integration tests for permission management flows., Test permission listing and pagination., Test handling of duplicate permission names. (+4 more)

### Community 84 - "Community 84"
Cohesion: 0.12
Nodes (19): get_async_session(), get_redis_client(), Any, AsyncSession, Redis, Create and get async database session. This function yields an AsyncSession for…, Get Redis client instance as an async generator. Yields a Redis client…, cleanup_unverified_users_task() (+11 more)

### Community 85 - "Community 85"
Cohesion: 0.37
Nodes (11): login_user(), promote_user_to_admin(), Any, AsyncClient, asyncio, Role management integration tests. Tests the complete role management flow…, Integration tests for role management flows (API-driven)., Assign the admin role to a user using the seeded admin account, with retry for… (+3 more)

### Community 86 - "Community 86"
Cohesion: 0.14
Nodes (18): parametrize, Emailed links must follow FRONTEND_URL. PASSWORD_RESET_URL and…, Build Settings with the derived fields blank unless a test sets them., The whole point: one setting decides where mail points., The regression itself: an override that did not propagate., A derived link must not retain the class default's host., Deriving is a default, not a policy. A deployment that serves a link from a…, FRONTEND_URL with a trailing slash must not produce a // in the path. (+10 more)

### Community 87 - "Community 87"
Cohesion: 0.12
Nodes (17): app_utils_exceptions_user_exceptions, get_csrf_config(), lifespan(), BaseHTTPMiddleware, FastAPI, Middleware to add security headers to all responses. Implements defense-in-…, SecurityHeadersMiddleware, fastapi_async_sqlalchemy (+9 more)

### Community 88 - "Community 88"
Cohesion: 0.11
Nodes (17): Ensure Celery workers register task modules from app.worker., Worker boot via app.celery_app must register security/email tasks., Leftover queue messages must not write a second AuditLog row (#243)., conf.imports keeps task registration for celery -A app.celery_app., The sweep that replaced the in-process sleep must be a real task (#136)., Beat drives the sweep; without an entry, pending users accumulate forever., Every scheduled name must resolve to a task some worker can run. Beat does not…, `celery -A app.celery_app beat` must see the schedule on a cold import.… (+9 more)

### Community 89 - "Community 89"
Cohesion: 0.18
Nodes (9): FakeDistribution, Stand-in for ``importlib.metadata.PathDistribution``. ``metadata``/``version``…, ``~``-prefixed dist-info dirs are pip's aborted-upgrade debris. Their…, ``foo-1.0-py3.10.egg-info`` splits naively as name ``foo-1.0``. That would hide…, Canary for the private ``_path`` attribute this module reads. If a stdlib…, TestInstalledVersions, installed_versions(), Any (+1 more)

### Community 90 - "Community 90"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 91 - "Community 91"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 92 - "Community 92"
Cohesion: 0.14
Nodes (13): get_db(), AsyncSession, Get database session for dependency injection. Uses AsyncSession to ensure all…, app(), client(), mock_get_current_user(), AsyncClient, AsyncSession (+5 more)

### Community 93 - "Community 93"
Cohesion: 0.18
Nodes (15): check_csrf_token_generation(), check_endpoint_with_csrf(), check_endpoint_with_invalid_csrf(), check_endpoint_without_csrf(), get_test_data(), main(), Any, Session (+7 more)

### Community 94 - "Community 94"
Cohesion: 0.15
Nodes (15): _in_integration_suite(), fixture, Redis, pytest_collection_modifyitems(), pytest_terminal_summary(), Confine the integration suite to the Docker/Postgres test stack. Outside that…, Return True for items collected from this package.…, Redis the application container writes its allowlist to. The runner and the… (+7 more)

### Community 95 - "Community 95"
Cohesion: 0.17
Nodes (16): context_from_standalone_sender(), Any, asyncio, MonkeyPatch, parametrize, timedelta, The sender the reset endpoint actually uses., The second copy of the same sender, which carried the same defect. (+8 more)

### Community 96 - "Community 96"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 97 - "Community 97"
Cohesion: 0.26
Nodes (15): assert_main_clean(), build_docker_images(), build_release_notes_entry(), clear_changelog_artifact(), create_git_tag(), generate_changelog(), get_latest_git_tag(), invoke_direct_tag_mode() (+7 more)

### Community 98 - "Community 98"
Cohesion: 0.12
Nodes (9): Any, Get database URL based on environment, Environment-specific service settings for Celery, Redis, and other external…, Get the Redis URL based on current environment. For production, uses rediss://…, Get the Celery broker URL based on current environment, Get the Celery result backend URL based on current environment, Determine whether to use Celery based on environment, Get email configuration based on environment (+1 more)

### Community 99 - "Community 99"
Cohesion: 0.13
Nodes (13): globals_middleware_dispatch(), GlobalsMiddleware, ASGIApp, BaseHTTPMiddleware, Request, Response, This allows to use global variables inside the FastAPI application using async…, Dispatch the request in a new context to allow globals to be used. (+5 more)

### Community 100 - "Community 100"
Cohesion: 0.12
Nodes (9): Any, Stands in for the socket and nothing above it. ``SMTPBackend.sendmail`` still…, One message as it would have been handed to the socket., Decoded body of the first part with this content type., RecordingSMTPClient, SentMessage, get_client(), MIMEMessage (+1 more)

### Community 101 - "Community 101"
Cohesion: 0.15
Nodes (12): AuditLogFactory, Meta, Any, lazy_attribute, SQLAlchemyModelFactory, Factory for creating AuditLog model instances., Generate a JSON-compatible details dictionary., Create an audit log entry for a specific user. (+4 more)

### Community 102 - "Community 102"
Cohesion: 0.19
Nodes (8): MockEmailService, Any, Mock implementation of email service for testing., Mock verification email sending., Mock password reset email sending., Clear the sent emails list., Get the last sent email., Get all emails sent to a specific recipient.

### Community 103 - "Community 103"
Cohesion: 0.22
Nodes (14): _create_user(), _events(), asyncio, AsyncSession, MonkeyPatch, Production used to delay() an empty Celery task; there is one in-process writer., Callers that cannot thread the request session still persist a row., A success-shaped event is retrievable as an AuditLog row, not a queued task. (+6 more)

### Community 104 - "Community 104"
Cohesion: 0.24
Nodes (10): Assert-MainClean(), Build-DockerImages(), Get-ReleaseNotesEntry(), Invoke-DirectTagMode(), Invoke-ReleasePrMode(), New-Changelog(), New-GitTag(), Confirm-Continue() (+2 more)

### Community 105 - "Community 105"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 106 - "Community 106"
Cohesion: 0.23
Nodes (13): alembic_migration, alembic_operations, downgrade(), Connection, The migration that drops `User.password_version` (#68), in both directions. The…, Reversible in shape, not in value -- the per-user counters are not recoverable., test_downgrade_restores_the_column_with_its_default(), test_upgrade_drops_the_column_and_keeps_the_rows() (+5 more)

### Community 107 - "Community 107"
Cohesion: 0.18
Nodes (12): AsyncEngine, db(), db_engine(), initialize_db(), AsyncSession, fixture, Initialize the database for the test session., Create test database tables and return engine. (+4 more)

### Community 108 - "Community 108"
Cohesion: 0.22
Nodes (7): Globals, Any, Get the value of a variable., Clear all variables and free memory., Set a default value for a variable., Get the default value for a variable., Ensure a ContextVar exists for a variable.

### Community 109 - "Community 109"
Cohesion: 0.22
Nodes (14): delete_if_still_pending(), _pending_past_window(), Any, AsyncSession, datetime, Redis, Delete pending users past the verification window. Safe to run concurrently…, The one definition of "pending, and past the verification window". Both the… (+6 more)

### Community 110 - "Community 110"
Cohesion: 0.16
Nodes (14): issue_and_observe(), Issued, asyncio, parametrize, timedelta, One issued verification, as its three independent observers see it., Read the promise out of the email the way a recipient does. The copy carries…, Run the real dispatch path and collect everything it committed to. (+6 more)

### Community 111 - "Community 111"
Cohesion: 0.24
Nodes (10): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, dashboardSlice, DashboardState (+2 more)

### Community 112 - "Community 112"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 113 - "Community 113"
Cohesion: 0.23
Nodes (13): admin_creates_user(), emailed_token(), AsyncClient, asyncio, AsyncSession, BackgroundTasks, Redis is what /verify-email checks, so the mail must carry that token., The token as the recipient receives it, out of the queued mail. (+5 more)

### Community 114 - "Community 114"
Cohesion: 0.22
Nodes (9): Any, timedelta, Generate an expired token for testing expiration handling. Args: user_id: User…, Factory for generating JWT tokens for testing., Generate a test access token. Args: user_id: User ID to include in the token…, Generate a test refresh token. Args: user_id: User ID to include in the token…, Generate authentication headers for testing. Args: access_token: Optional pre-…, TokenFactory (+1 more)

### Community 115 - "Community 115"
Cohesion: 0.29
Nodes (5): TestFormatReport, Drift, format_report(), Render the drift report: the count, the worst offenders, and the fix., One pinned package whose installed version does not match the pin.

### Community 116 - "Community 116"
Cohesion: 0.21
Nodes (11): calls_named(), handlers_in(), AST, parametrize, `password_version` is retired; the allowlist is the sole revocation mechanism.…, Gone from the Pydantic field set and from the mapped table alike., A name nothing reads must not be reintroduced by a later password path., Retiring the field must not touch the mechanism that made it redundant. Four… (+3 more)

### Community 117 - "Community 117"
Cohesion: 0.26
Nodes (5): TestFindDrift, find_drift(), Rank drift worst-first: missing, then the earliest diverging component., Return the pinned packages the environment does not satisfy, worst first.…, _severity()

### Community 118 - "Community 118"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 119 - "Community 119"
Cohesion: 0.20
Nodes (10): ast, AsyncClient, asyncio, HTTP rate limit wiring seams (slowapi consolidation — issue #64)., App wiring must not depend on fastapi-limiter (init-only scaffold removed)., Burst past access-token's 5/minute HTTP rate limit → 429 with standardized JSON., _reset_limiter_storage(), test_access_token_http_rate_limit_returns_429_when_enabled() (+2 more)

### Community 120 - "Community 120"
Cohesion: 0.22
Nodes (8): get_uuid_type(), upgrade(), downgrade(), get_uuid_type(), This migration fixes the case conflict between 'rolegroupmap' and…, For downgrade, we would remove any columns we added, but this is rarely needed…, upgrade(), sqlalchemy_engine

### Community 121 - "Community 121"
Cohesion: 0.31
Nodes (5): CRUDPermissionGroup, Any, AsyncSession, Params, Get a permission group by name.

### Community 122 - "Community 122"
Cohesion: 0.29
Nodes (5): CircularDependencyException, Any, Exception, ModelType, Exception raised when a circular dependency is detected

### Community 123 - "Community 123"
Cohesion: 0.18
Nodes (5): LogCaptureFixture, An AuditLog outage must not turn the original 400 into a 500., A broken session must not turn the original request into a 500., test_failed_audit_write_does_not_raise(), test_failed_rollback_after_audit_write_is_logged()

### Community 124 - "Community 124"
Cohesion: 0.18
Nodes (10): MonkeyPatch, Four settings advertised session controls nothing implemented. ADR 0011…, Gone from the public Settings surface, so they cannot be read as active., An operator's leftover .env must not fail the next boot. extra='ignore' is…, A name nothing reads must not be reintroduced as a later 'security' field., A stale .example that still lists a deleted setting is the original bug., test_example_env_files_do_not_advertise_the_four_settings(), test_settings_have_none_of_the_four_unimplemented_session_controls() (+2 more)

### Community 125 - "Community 125"
Cohesion: 0.31
Nodes (11): _create_user(), asyncio, AsyncSession, Assigned roles are an explicit refusal, not a database error., A user who has changed their password is still deletable; history goes with…, Permissions, groups, and roles outlive their creator; created_by_id becomes…, Audit rows outlive the actor; the recorded actor_id is not rewritten or dropped., test_remove_user_keeps_audit_logs_and_actor_id() (+3 more)

### Community 126 - "Community 126"
Cohesion: 0.29
Nodes (4): parametrize, TestParsePins, parse_pins(), Map canonical package name -> exactly pinned version. Only ``name==version``…

### Community 127 - "Community 127"
Cohesion: 0.20
Nodes (9): AbstractParams, Any, T, make_page(), Build a page exactly as paginate() does, via the same classmethod., The rows are at .data.items; this is the contract endpoints must use., Reading .items raises -- the exact failure seen in the running app., test_paginated_response_has_no_top_level_items() (+1 more)

### Community 128 - "Community 128"
Cohesion: 0.33
Nodes (8): downgrade(), get_uuid_type(), has_column(), upgrade(), downgrade(), has_column(), Check if a column exists in a table, upgrade()

### Community 129 - "Community 129"
Cohesion: 0.27
Nodes (9): after_insert_role(), after_update_role(), Connection, populated_user_table(), fixture, Path, A pre-migration `User` table: today's schema plus the dropped column, with a…, listens_for (+1 more)

### Community 130 - "Community 130"
Cohesion: 0.20
Nodes (7): AsyncClient, asyncio, AsyncSession, FastAPI, Example test: user creation with comprehensive mocking., test_example_user_creation_with_mock(), mock_get_current_user_factory()

### Community 131 - "Community 131"
Cohesion: 0.20
Nodes (8): comprehensive_mocks(), Provide comprehensive mocks for integration testing., Provide all service mocks in a single fixture., service_mocks(), MockCeleryApp, Clear all task call history., Mock Celery application for testing., Get task calls, optionally filtered by task name.

### Community 132 - "Community 132"
Cohesion: 0.20
Nodes (7): http_client_mock(), Provide a mock HTTP client for testing external API calls., MockHTTPClient, Mock HTTP client for testing external API calls., Set a specific response for method and URL., Clear request history., Get requests, optionally filtered by method or URL.

### Community 133 - "Community 133"
Cohesion: 0.36
Nodes (9): asyncio, AsyncSession, Test creating an entity with BaseUUIDModel as base class, Test updating an entity with BaseUUIDModel as base class, Test that UUIDs are unique for each instance, SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update() (+1 more)

### Community 134 - "Community 134"
Cohesion: 0.38
Nodes (5): Path, TestCheckForDrift, check_for_drift(), Path, Return a drift report, or ``None`` when the environment is fine or opted out.

### Community 135 - "Community 135"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 137 - "Community 137"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 138 - "Community 138"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 139 - "Community 139"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 140 - "Community 140"
Cohesion: 0.25
Nodes (8): get_csrf_protect(), CsrfProtect, Request, Set the global CSRF protect instance. Called from main.py during application…, Get the CSRF protection instance for dependency injection. Returns:…, Validate CSRF token for state-changing operations. Args: request: The FastAPI…, set_csrf_protect_instance(), validate_csrf_token()

### Community 141 - "Community 141"
Cohesion: 0.29
Nodes (7): create_init_data(), main(), Create initial database data if it doesn't exist., create_init_data(), main(), Create initial database data., Main function to run the initialization.

### Community 142 - "Community 142"
Cohesion: 0.29
Nodes (7): IPermissionGroupBase, IPermissionGroupWithPermissions, Any, BaseModel, model_validator, Prevent infinite recursion in parent/child relationships, UserBasic

### Community 143 - "Community 143"
Cohesion: 0.25
Nodes (5): Test error handling functionality., Test that 404 errors are handled properly., Test that invalid JSON is handled properly., Test that method not allowed errors are handled., TestErrorHandling

### Community 144 - "Community 144"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 145 - "Community 145"
Cohesion: 0.33
Nodes (6): do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, Run migrations in 'online' mode. In this scenario we need to create an Engine…, run_migrations_offline(), run_migrations_online(), logging_config

### Community 146 - "Community 146"
Cohesion: 0.29
Nodes (3): _PlainTextExtractor, Render an HTML email body as readable plain text. Derived from the rendered…, HTMLParser

### Community 147 - "Community 147"
Cohesion: 0.43
Nodes (4): Any, HTTPException, UserNotFoundException, UserSelfDeleteException

### Community 148 - "Community 148"
Cohesion: 0.33
Nodes (6): estimate_password_strength(), load_common_passwords(), Tools for loading and validating common passwords., Load common passwords from files in the project's password lists directory., Estimate password strength using zxcvbn. Returns: dict: Password strength…, zxcvbn

### Community 149 - "Community 149"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 151 - "Community 151"
Cohesion: 0.29
Nodes (6): auth_headers(), _create_headers(), fixture, Factory fixture to create tokens for testing., Factory fixture to create authentication headers for testing., token_factory()

### Community 153 - "Community 153"
Cohesion: 0.33
Nodes (4): app_core_celery_config, Centralized Celery configuration for the FastAPI RBAC system. This module…, Scheduled tasks configuration for Celery Beat. This module defines recurring…, celery

### Community 154 - "Community 154"
Cohesion: 0.73
Nodes (5): downgrade(), _fk_names(), Any, _recreate_fk(), upgrade()

### Community 155 - "Community 155"
Cohesion: 0.33
Nodes (6): health_check(), Any, BackgroundTasks, get, Redis, Perform a health check of all critical system components, including: - API…

### Community 156 - "Community 156"
Cohesion: 0.40
Nodes (6): get_group_by_id(), get_group_by_name(), AsyncSession, description, Path, Query

### Community 157 - "Community 157"
Cohesion: 0.33
Nodes (6): custom_swagger_ui_html(), get, An example "Hello world" FastAPI route., Serve Swagger UI with CSRF support for state-changing requests., root(), HTMLResponse

### Community 158 - "Community 158"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 159 - "Community 159"
Cohesion: 0.53
Nodes (6): normal_user_token_headers(), AsyncClient, AsyncSession, fixture, Return authentication headers for a superuser., superuser_token_headers()

### Community 160 - "Community 160"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 161 - "Community 161"
Cohesion: 0.40
Nodes (3): Any, field_validator, Override model_dump to customize role serialization

### Community 162 - "Community 162"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 163 - "Community 163"
Cohesion: 0.40
Nodes (5): enhanced_redis_mock(), mock_send_email(), fixture, Provide an enhanced Redis mock with state tracking for tests., Automatically mock the send_email function in all tests to prevent real email…

### Community 165 - "Community 165"
Cohesion: 0.40
Nodes (4): compilerOptions, paths, files, references

### Community 166 - "Community 166"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 167 - "Community 167"
Cohesion: 0.50
Nodes (3): debug_cors(), Add this to the top of your main.py file after imports to debug CORS…, Add this function to your main.py file and call it before adding CORS middleware

### Community 168 - "Community 168"
Cohesion: 0.50
Nodes (4): admin_created_users_get_a_verification_email(), fixture, MonkeyPatch, The configuration under which the mail is sent at all.

### Community 172 - "Community 172"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

### Community 180 - "Community 180"
Cohesion: 0.67
Nodes (3): load_migration(), Import the migration by path -- its filename is not a module name., ModuleType

### Community 181 - "Community 181"
Cohesion: 0.67
Nodes (3): fixture, Tests rewrite the lifetime; none of it may leak out of a test., restore_configured_lifetime()

### Community 182 - "Community 182"
Cohesion: 0.67
Nodes (3): fixture, ``issue_and_observe`` rewrites the lifetime; none of it may leak out of a test., restore_configured_lifetime()

### Community 183 - "Community 183"
Cohesion: 0.67
Nodes (3): get_superuser_token_headers(), TestClient, Get a superuser token for testing. This is a synchronous version for tests that…

## Knowledge Gaps
- **340 isolated node(s):** `LogoutEverywhereControlProps`, `DataTableProps`, `DataTableColumnHeaderProps`, `DataTableProps`, `BadgeProps` (+335 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1838 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **63 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 7` to `Community 1`, `Community 2`, `Community 130`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 11`, `Community 14`, `Community 15`, `Community 19`, `Community 20`, `Community 22`, `Community 24`, `Community 25`, `Community 29`, `Community 32`, `Community 161`, `Community 34`, `Community 33`, `Community 36`, `Community 40`, `Community 47`, `Community 57`, `Community 58`, `Community 63`, `Community 68`, `Community 69`, `Community 75`, `Community 81`, `Community 82`, `Community 103`, `Community 106`, `Community 109`, `Community 110`, `Community 113`, `Community 116`, `Community 125`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `MockRedisClient` connect `Community 35` to `Community 1`, `Community 2`, `Community 163`, `Community 69`, `Community 6`, `Community 77`, `Community 110`, `Community 113`, `Community 20`, `Community 22`, `Community 24`, `Community 25`, `Community 92`, `Community 29`, `Community 63`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `Settings` connect `Community 49` to `Community 65`, `Community 38`, `Community 6`, `Community 76`, `Community 145`, `Community 86`, `Community 124`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 115 inferred relationships involving `User` (e.g. with `get_current_user()` and `change_password()`) actually correct?**
  _`User` has 115 INFERRED edges - model-reasoned connections that need verification._
- **Are the 80 inferred relationships involving `MockRedisClient` (e.g. with `admin_creates_user()` and `test_the_emailed_link_verifies_the_account()`) actually correct?**
  _`MockRedisClient` has 80 INFERRED edges - model-reasoned connections that need verification._
- **What connects `LogoutEverywhereControlProps`, `DataTableProps`, `DataTableColumnHeaderProps` to the rest of the system?**
  _340 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06582185039370078 - nodes in this community are weakly interconnected._