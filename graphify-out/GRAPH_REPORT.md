# Graph Report - fastapi_rbac  (2026-10-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4841 nodes · 14116 edges · 247 communities (135 shown, 112 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 1009 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c6dcd5bc`
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
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 173
- Community 174
- Community 175
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 194
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
- Community 210
- Community 211
- Community 212
- Community 213
- Community 214
- Community 218
- Community 219
- Community 220
- Community 222
- Community 223
- Community 235

## God Nodes (most connected - your core abstractions)
1. `User` - 233 edges
2. `cn()` - 134 edges
3. `MockRedisClient` - 130 edges
4. `random_lower_string()` - 108 edges
5. `TokenType` - 96 edges
6. `get_csrf_token()` - 84 edges
7. `Button()` - 79 edges
8. `Role` - 78 edges
9. `react` - 74 edges
10. `create_response()` - 64 edges

## Surprising Connections (you probably didn't know these)
- `get_settings_dependency()` --uses--> `Settings`  [INFERRED]
  backend/app/api/deps.py → backend/app/core/config.py
- `create_user()` --uses--> `IUserCreate`  [INFERRED]
  backend/app/api/v1/endpoints/user.py → backend/app/schemas/user_schema.py
- `CRUDUser` --uses--> `IUserCreate`  [INFERRED]
  backend/app/crud/user_crud.py → backend/app/schemas/user_schema.py
- `user_exists()` --uses--> `IUserCreate`  [INFERRED]
  backend/app/deps/user_deps.py → backend/app/schemas/user_schema.py
- `test_user()` --uses--> `IUserCreate`  [INFERRED]
  backend/test/unit/test_crud_role_group.py → backend/app/schemas/user_schema.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (247 total, 112 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (31): get_content(), get_data_encrypt(), get_async_session(), get_redis_client(), IUserCreate, send_verification_email(), create_audit_log(), cleanup_unverified_users_task() (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (22): _subsec_encode(), uuid7(), AsyncFactoryBase, AsyncPermissionFactory, AsyncPermissionGroupFactory, AsyncRoleFactory, AsyncRoleGroupFactory, AsyncTestDataBuilder (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (51): PermissionBase, IPermissionGroupCreate, IPermissionCreate, IPermissionUpdate, IRoleCreate, test_add_permissions_to_group(), test_create_permission_group(), test_delete_permission_group() (+43 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (45): create_permission_group(), assign_permissions_to_role(), create_role(), delete_role(), get_all_roles_list(), get_role_by_id(), get_roles(), add_roles_to_group() (+37 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (82): LogoutEverywhereControl(), LogoutEverywhereControlProps, DataTable(), DataTableProps, DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps (+74 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (26): get_csrf_protect(), get_settings_dependency(), set_csrf_protect_instance(), validate_csrf_token(), get_permissions(), delete_permission_group(), get_permission_group_by_id(), get_permission_groups() (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (22): clear_user_delete_references(), AuditLog, AuditLogBase, BaseUUIDModel, SQLModel, UserPasswordHistory, UserPasswordHistoryBase, RoleGroupMap (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (67): Checkbox(), CommandEmpty(), FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem() (+59 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (56): App(), PublicOnlyRoute(), ApiErrorAlert(), PasswordRequirements(), ChangePasswordContent(), DataTableColumn, OverviewChart(), OverviewChartData (+48 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (36): add_token_claims(), create_access_token(), create_refresh_token(), create_reset_token(), create_verification_token(), get_fernet_key(), auth_url(), emitted_events() (+28 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (28): header_text(), _mail_settings(), mock_send_email(), RecordingSMTPClient, send(), SentMessage, smtp(), get_client() (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (17): create_permission(), delete_permission(), get_permission_by_id(), CRUDPermission, Permission, User, IPermissionRead, create_mock_user() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (22): update_permission_group(), CRUDPermissionGroup, PermissionGroupData, PermissionGroup, PermissionGroupBase, IPermissionGroupBase, IPermissionGroupRead, IPermissionGroupReadWithPermissions (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (42): InitAuth(), LoginForm(), LoginFormData, loginSchema, ProtectedRoute(), ProtectedRouteProps, SignupForm(), Sidebar() (+34 more)

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (47): deletePermission, initialState, permissionSlice, RULES, authWithComplexityError, RULES, mockAuthState, mockDispatch (+39 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (30): accept_initial_password(), _apply_account_changes(), _audit_details(), change_password(), _check_rules(), _discard_staged_change(), InitialPasswordReason, PasswordChangeReason (+22 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (26): assign_roles_to_user(), bulk_update_users(), create_user(), get_my_data(), get_user_by_id(), get_user_list_order_by_created_at(), read_users(), read_users_list() (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.06
Nodes (18): send_password_reset_email(), send_registration_notice_email(), humanize_minutes(), _plural(), render_template(), send_email(), send_email_with_template(), send_reset_password_email() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (28): account_email_budget_key(), AccountState, classify(), auth_url(), csrf_headers(), observable(), post_register(), post_resend() (+20 more)

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (4): CRUDBase, CRUDRoleGroup, check_role_chain(), IOrderEnum

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (5): CRUDUser, password_reuse_window(), PasswordReuseError, test_two_hashes_of_one_password_are_never_equal(), test_password_hashing()

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (5): register_user_with_csrf(), _response_message(), TestAuthenticationEdgeCases, TestAuthenticationSecurity, TestComprehensiveAuth

### Community 22 - "Community 22"
Cohesion: 0.06
Nodes (12): get_db(), main(), wait_for_database(), wait_for_redis(), get_project_root(), app(), client(), mock_get_current_user() (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.07
Nodes (38): ProfileContent(), Avatar(), AvatarFallback(), AvatarImage(), CardAction(), Command(), CommandDialog(), CommandGroup() (+30 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (19): change_password(), confirm_password_reset(), ensure_utc(), get_csrf_token(), get_new_access_token(), login(), login_access_token(), logout() (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (29): refresh_origin_is_anomalous(), session_origin_ip(), _db_user(), _establish_session(), _origin_check_enabled(), recorded_security_events(), _refresh(), refreshing_user() (+21 more)

### Community 26 - "Community 26"
Cohesion: 0.06
Nodes (4): redis_mock(), enhanced_redis_mock(), mock_send_email(), MockRedisClient

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (27): get_current_user(), current_user(), add_session_tokens_to_redis(), get_valid_tokens(), token_is_allowlisted(), Clock, _login_once(), _seed_refresh_token() (+19 more)

### Community 28 - "Community 28"
Cohesion: 0.07
Nodes (12): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.05
Nodes (44): name, private, type, version, autoprefixer, clsx, cmdk, date-fns (+36 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (38): cmd_config(), cmd_down(), cmd_env(), cmd_exec(), cmd_health(), cmd_logs(), cmd_pull(), cmd_restart() (+30 more)

### Community 31 - "Community 31"
Cohesion: 0.08
Nodes (34): Skeleton(), NestedRoleGroupProps, RoleGroupFormProps, RoleGroupFormContent(), RoleGroupRowProps, RoleFormData, RoleFormProps, RoleFormContent() (+26 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (18): PasswordValidator, _app_package(), auth_url(), issue_reset_token(), post_register(), rules_refusal(), test_change_password_rules_refused(), test_registration_rules_refused() (+10 more)

### Community 33 - "Community 33"
Cohesion: 0.10
Nodes (19): get_or_create_superuser(), init_db(), IRoleGroupCreate, format_permission_name(), test_add_roles_to_group(), test_bulk_create_role_groups(), test_bulk_delete_role_groups(), test_bulk_delete_with_roles_conflict() (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (34): _login(), _no_response_floor(), _oauth2(), recorded(), _request(), _reset_request(), _sanitizer(), test_dispatch_absent_resend_emits_no_mail_event() (+26 more)

### Community 35 - "Community 35"
Cohesion: 0.08
Nodes (10): _CRLFMessageProxy, _CRLFSMTPBackend, built_message(), test_backend_wraps_the_message_it_forwards(), test_headers_are_crlf_terminated(), test_proxy_delegates_everything_else(), test_proxy_is_idempotent(), test_proxy_normalises_lone_cr() (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.14
Nodes (18): delete_if_still_pending(), _pending_past_window(), select_pending_user_ids(), sweep_unverified_users(), unverified_cutoff(), _exists(), _make_user(), _naive_utc_now() (+10 more)

### Community 37 - "Community 37"
Cohesion: 0.05
Nodes (37): dependencies, autoprefixer, axios, class-variance-authority, clsx, cmdk, date-fns, @hookform/resolvers (+29 more)

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (6): get_settings(), Settings, test_settings_accept_a_proxy_network(), test_settings_default_to_loopback_only(), test_settings_have_none_of_the_four_unimplemented_session_controls(), test_stale_environment_keys_do_not_prevent_settings_from_loading()

### Community 40 - "Community 40"
Cohesion: 0.09
Nodes (24): ApiErrorAlertProps, PasswordRequirementsProps, SignupFormData, signupSchema, PasswordChangeFormData, passwordChangeSchema, asRecord(), nonEmptyString() (+16 more)

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (21): IGenderEnum, IUserMessage, TokenType, add_token_to_redis(), _allowlist_key(), _allowlist_meta_key(), _as_text(), end_caller_session() (+13 more)

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (19): _app_package(), auth_url(), _calls_named(), predicate(), issue_reset_token(), login_headers(), _modules_matching(), post_change_password() (+11 more)

### Community 43 - "Community 43"
Cohesion: 0.07
Nodes (12): test_example_env_files_do_not_advertise_the_four_settings(), test_the_four_names_appear_nowhere_in_the_app_package(), env_setting(), issue_and_observe(), Issued, restore_configured_lifetime(), stated_lifetime(), test_email_promises_exactly_the_redis_ttl() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.12
Nodes (16): allowlist_key(), auth_url(), login(), post_change_password(), redis_ops(), recording(), test_change_password_leaves_the_new_tokens_allowlisted(), test_change_password_revokes_a_pending_reset_link() (+8 more)

### Community 45 - "Community 45"
Cohesion: 0.27
Nodes (24): auth_url(), csrf_headers(), events_named(), matching(), post_login(), test_account_email_budget_exhaustion_writes_an_audit_row(), test_failed_audit_write_does_not_change_failed_login_status(), test_failed_login_writes_an_audit_row() (+16 more)

### Community 46 - "Community 46"
Cohesion: 0.11
Nodes (21): client_address_key(), resolve_client_address(), _app(), who(), _ask(), _request(), test_absent_peer_stays_absent(), test_empty_trust_configuration_ignores_every_forwarded_header() (+13 more)

### Community 47 - "Community 47"
Cohesion: 0.11
Nodes (16): rate_limit_key(), remember_authenticated_identity(), _limited_client(), establish_identity(), _request(), test_a_bearer_token_without_established_identity_is_keyed_by_address(), test_anonymous_burst_from_one_address_is_rate_limited(), test_anonymous_request_is_keyed_by_client_address() (+8 more)

### Community 48 - "Community 48"
Cohesion: 0.07
Nodes (9): get_cached_celery_config(), get_celery_config(), log_security_event_task(), test_beat_schedule_only_names_registered_tasks(), test_beat_schedules_the_unverified_cleanup_sweep(), test_celery_app_imports_worker_tasks(), test_celery_app_registers_unverified_cleanup_task(), test_celery_config_lists_worker_imports() (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.11
Nodes (10): log_security_event(), _create_user(), _events(), test_anonymous_security_event_persists_with_null_actor_id(), test_audit_log_actor_id_is_nullable_and_has_no_user_fk(), test_failed_audit_write_does_not_raise(), test_failed_rollback_after_audit_write_is_logged(), test_log_security_event_does_not_dispatch_celery() (+2 more)

### Community 51 - "Community 51"
Cohesion: 0.08
Nodes (9): DBType, test_db_type_enum(), test_db_type_from_str(), test_test_config_defaults(), test_test_config_get_connection_args(), test_test_config_get_db_uri_postgres(), test_test_config_get_db_uri_sqlite(), test_test_config_get_pool_class() (+1 more)

### Community 52 - "Community 52"
Cohesion: 0.09
Nodes (4): celery_task_mock(), decorator(), MockCeleryResult, MockCeleryTask

### Community 53 - "Community 53"
Cohesion: 0.18
Nodes (19): add_derived_access_token_to_redis(), session_id_for(), _allowlist_counts(), _establish_session(), _logout(), _no_session_limit(), _request(), test_empty_session_id_revokes_nothing() (+11 more)

### Community 54 - "Community 54"
Cohesion: 0.09
Nodes (3): MockHTTPClient, MockHTTPResponse, MockOAuthProvider

### Community 55 - "Community 55"
Cohesion: 0.07
Nodes (29): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+21 more)

### Community 56 - "Community 56"
Cohesion: 0.16
Nodes (16): get_dashboard_data(), get_dashboard_stats(), get_active_sessions_count(), get_active_users_count(), get_recent_logins(), get_system_users_summary(), get_total_permissions_count(), get_total_roles_count() (+8 more)

### Community 57 - "Community 57"
Cohesion: 0.15
Nodes (12): auth_url(), fetch_csrf_token(), is_csrf_rejection(), test_csrf_rejected_when_header_does_not_match_cookie(), test_csrf_rejected_when_header_missing_but_cookie_present(), test_csrf_token_endpoint_issues_token_and_cookie(), test_endpoint_accepts_valid_csrf_token(), test_endpoint_rejected_with_invalid_csrf_token() (+4 more)

### Community 58 - "Community 58"
Cohesion: 0.17
Nodes (5): generate_strong_password(), login_user(), promote_user_to_admin(), register_and_verify_user(), TestUserManagementFlow

### Community 59 - "Community 59"
Cohesion: 0.13
Nodes (12): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), run_all_tests(), run_command() (+4 more)

### Community 60 - "Community 60"
Cohesion: 0.12
Nodes (14): RoleFactory, Meta, RoleGroupFactory, Meta, db_factories(), make_audit_log(), _make_audit_log(), make_role() (+6 more)

### Community 61 - "Community 61"
Cohesion: 0.11
Nodes (11): downgrade(), upgrade(), downgrade(), upgrade(), upgrade(), upgrade(), upgrade(), upgrade() (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.14
Nodes (12): DatabaseTypeEnum, ModeEnum, clear_refresh_token_cookie(), _refresh_cookie_attrs(), refresh_cookie_path(), refresh_cookie_samesite(), refresh_cookie_secure(), set_refresh_token_cookie() (+4 more)

### Community 63 - "Community 63"
Cohesion: 0.13
Nodes (9): sanitize_email(), sanitize_filename(), sanitize_form_data(), sanitize_html(), sanitize_input(), sanitize_json_values(), sanitize_search_query(), sanitize_text() (+1 more)

### Community 64 - "Community 64"
Cohesion: 0.10
Nodes (10): BaseFactory, Meta, PermissionFactory, Meta, PermissionGroupFactory, Meta, make_permission(), make_permission_group() (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.14
Nodes (14): AuthState, ErrorResponse, ErrorResponseWithErrors, LoginCredentials, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, Token (+6 more)

### Community 67 - "Community 67"
Cohesion: 0.10
Nodes (11): verify_email(), decode_token(), map_jwt_http_error_to_event(), validate_token_claims(), VerifyEmail, test_decode_token_non_jwt_string_is_400(), test_map_jwt_http_error_to_event(), _no_response_floor() (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.14
Nodes (15): AppWrapper(), AppWrapperProps, LoadingScreen(), LoadingScreenProps, Meta(), MetaProps, PageMeta(), SplashScreen() (+7 more)

### Community 69 - "Community 69"
Cohesion: 0.14
Nodes (8): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), password_refused_handler(), sqlalchemy_exception_handler(), unhandled_exception_handler(), validation_exception_handler()

### Community 70 - "Community 70"
Cohesion: 0.10
Nodes (10): is_trusted_proxy(), parse_trusted_proxies(), TrustedProxyError, test_parse_trusted_proxies_accepts_a_comma_separated_string(), test_parse_trusted_proxies_accepts_addresses_and_networks(), test_parse_trusted_proxies_refuses_a_wildcard(), test_parse_trusted_proxies_refuses_unparseable_entries(), test_parse_trusted_proxies_treats_empty_configuration_as_no_proxies() (+2 more)

### Community 71 - "Community 71"
Cohesion: 0.11
Nodes (9): background_tasks_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), http_client_mock(), oauth_provider_mock(), patched_external_services(), redis_connection_failure_mock() (+1 more)

### Community 72 - "Community 72"
Cohesion: 0.29
Nodes (7): login_user(), promote_user_to_admin(), register_and_verify_user(), TestRoleManagementFlow, unique_email(), get_csrf_token(), register_user_with_csrf()

### Community 73 - "Community 73"
Cohesion: 0.12
Nodes (8): check_for_drift(), Drift, fail_on_drift(), find_drift(), format_report(), _matches(), parse_pins(), _severity()

### Community 74 - "Community 74"
Cohesion: 0.15
Nodes (10): is_different_network(), origin_network(), parse_client_address(), test_absent_is_not_mismatched(), test_different_network_is_a_mismatch(), test_origin_network_is_none_for_unusable_input(), test_origin_network_uses_slash_24_and_slash_64(), test_parse_client_address_normalises_usable_addresses() (+2 more)

### Community 75 - "Community 75"
Cohesion: 0.11
Nodes (6): UserFactory, Meta, make_admin_user(), _make_admin_user(), make_user(), _make_user()

### Community 76 - "Community 76"
Cohesion: 0.17
Nodes (14): Permission, ApiResponse, PaginatedItems, Role, User, ApiError, UserCreatePayload, UserService (+6 more)

### Community 77 - "Community 77"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 78 - "Community 78"
Cohesion: 0.11
Nodes (8): create_limiter(), _is_testing(), _storage_uri(), _decode(), ProxyHeadersMiddleware, split_entries(), test_shared_limiter_disabled_in_testing_by_default(), test_shared_limiter_uses_the_user_or_address_key_function()

### Community 79 - "Community 79"
Cohesion: 0.26
Nodes (13): admin_headers(), post_user(), put_password(), rules_refusal(), test_admin_create_rules_refused(), test_admin_create_succeeded(), test_admin_update_reuse_refused(), test_admin_update_rules_refused() (+5 more)

### Community 80 - "Community 80"
Cohesion: 0.12
Nodes (10): make_page(), paginated_result_names(), paginated_row_schemas(), reachable_models(), walk(), test_nothing_touches_items_on_a_paginated_result(), test_paginated_response_has_no_top_level_items(), test_paginated_response_nests_rows_under_data() (+2 more)

### Community 81 - "Community 81"
Cohesion: 0.14
Nodes (10): PaginatedData, PaginatedPermissionGroupResponse, PaginatedPermissionResponse, PermissionCreate, PermissionGroupCreate, PermissionGroupResponse, PermissionGroupUpdate, PermissionResponse (+2 more)

### Community 82 - "Community 82"
Cohesion: 0.16
Nodes (10): html_to_plain_text(), test_every_template_yields_text_containing_its_links(), test_plain_text_collapses_blank_runs(), test_plain_text_does_not_repeat_a_bare_url(), test_plain_text_drops_css_and_scripts(), test_plain_text_exposes_the_link(), test_plain_text_has_no_markup_left(), test_plain_text_is_not_empty_for_a_realistic_email() (+2 more)

### Community 83 - "Community 83"
Cohesion: 0.26
Nodes (11): _admin(), login(), put_user_password(), test_admin_session_survives_setting_another_users_password(), test_admin_set_password_invalidates_the_target_token(), test_admin_update_revokes_tokens_the_target_already_held(), test_non_password_update_revokes_nothing(), test_rejected_complexity_revokes_nothing() (+3 more)

### Community 84 - "Community 84"
Cohesion: 0.19
Nodes (8): test_cookie_refresh_issues_new_access_token(), test_json_login_writes_access_and_refresh_allowlist(), test_login_sets_httponly_refresh_cookie(), test_logout_rejects_subsequent_refresh(), test_oauth2_first_login_writes_allowlist_and_logout_rejects(), test_refresh_rejected_when_allowlist_empty(), test_refresh_requires_csrf(), _user_id_from_access_token()

### Community 86 - "Community 86"
Cohesion: 0.12
Nodes (3): get_csrf_config(), lifespan(), test_docs_include_csrf_request_interceptor()

### Community 87 - "Community 87"
Cohesion: 0.14
Nodes (4): TokenFactory, auth_headers(), _make_headers(), HeadersCallable

### Community 88 - "Community 88"
Cohesion: 0.14
Nodes (8): settings_with(), test_an_explicit_value_still_wins(), test_both_links_follow_frontend_url(), test_changing_frontend_url_moves_both_links(), test_committed_env_files_do_not_pin_the_derived_links(), test_login_link_in_notice_email_uses_the_same_base(), test_no_link_ever_points_at_the_default_when_frontend_url_is_set(), test_trailing_slash_does_not_double_up()

### Community 89 - "Community 89"
Cohesion: 0.17
Nodes (6): downgrade(), populated_user_table(), test_downgrade_restores_the_column_with_its_default(), test_upgrade_drops_the_column_and_keeps_the_rows(), upgrade(), user_columns()

### Community 90 - "Community 90"
Cohesion: 0.13
Nodes (3): dependency_overrider(), DependencyOverrider, mock_dependency()

### Community 91 - "Community 91"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 92 - "Community 92"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 93 - "Community 93"
Cohesion: 0.19
Nodes (6): compare_files(), executable_line_mismatch(), hit_miss_disagreements(), main(), normalize_filename(), parse_cobertura()

### Community 95 - "Community 95"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 96 - "Community 96"
Cohesion: 0.23
Nodes (12): PaginatedDataResponse, PaginatedResponse, PaginationParams, RoleCreate, RolePermissionAssign, RolePermissionUnassign, RoleResponse, RoleUpdate (+4 more)

### Community 97 - "Community 97"
Cohesion: 0.26
Nodes (15): assert_main_clean(), build_docker_images(), build_release_notes_entry(), clear_changelog_artifact(), create_git_tag(), generate_changelog(), get_latest_git_tag(), invoke_direct_tag_mode() (+7 more)

### Community 98 - "Community 98"
Cohesion: 0.15
Nodes (5): rate_limit_handler(), user_self_delete_exception_handler(), create_error_response(), ErrorDetail, IErrorResponse

### Community 101 - "Community 101"
Cohesion: 0.23
Nodes (6): check_csrf_token_generation(), check_endpoint_with_csrf(), check_endpoint_with_invalid_csrf(), check_endpoint_without_csrf(), get_test_data(), main()

### Community 102 - "Community 102"
Cohesion: 0.25
Nodes (10): _report(), test_cli_accepts_matching_executable_lines_even_when_hits_differ(), test_cli_defaults_to_auth_py(), test_cli_exits_2_when_an_input_path_does_not_exist(), test_cli_rejects_reports_that_do_not_share_an_executable_line_set(), test_cli_rejects_when_the_file_is_missing_from_one_report(), test_executable_line_mismatch_when_reports_list_different_lines(), test_executable_line_sets_may_disagree_on_hits_but_not_on_which_lines_exist() (+2 more)

### Community 103 - "Community 103"
Cohesion: 0.16
Nodes (6): db(), db_engine(), initialize_db(), update_first_name(), update_last_name(), __aenter__()

### Community 104 - "Community 104"
Cohesion: 0.18
Nodes (4): celery_mock(), comprehensive_mocks(), service_mocks(), MockCeleryApp

### Community 106 - "Community 106"
Cohesion: 0.18
Nodes (6): calls_named(), handlers_in(), test_every_password_path_revokes_prior_sessions(), test_password_version_appears_nowhere_in_the_app_package(), test_the_policy_module_revokes_prior_sessions(), test_user_model_has_no_password_version()

### Community 108 - "Community 108"
Cohesion: 0.18
Nodes (8): api, ErrorDetail, ErrorResponseData, PasswordComplexityDetail, roleGroupService, mockedApi, mockedApi, axios

### Community 109 - "Community 109"
Cohesion: 0.24
Nodes (10): Assert-MainClean(), Build-DockerImages(), Get-ReleaseNotesEntry(), Invoke-DirectTagMode(), Invoke-ReleasePrMode(), New-Changelog(), New-GitTag(), Confirm-Continue() (+2 more)

### Community 110 - "Community 110"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 111 - "Community 111"
Cohesion: 0.21
Nodes (6): register(), UserRegister, consume_account_email_budget(), _create_pending_user(), dispatch_account_email(), DispatchResult

### Community 113 - "Community 113"
Cohesion: 0.24
Nodes (10): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, dashboardSlice, DashboardState (+2 more)

### Community 114 - "Community 114"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 116 - "Community 116"
Cohesion: 0.23
Nodes (5): admin_creates_user(), emailed_token(), _reload(), test_the_emailed_link_verifies_the_account(), test_the_emailed_token_is_the_one_redis_holds()

### Community 117 - "Community 117"
Cohesion: 0.20
Nodes (7): downgrade(), get_uuid_type(), upgrade(), get_uuid_type(), upgrade(), downgrade(), upgrade()

### Community 121 - "Community 121"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 123 - "Community 123"
Cohesion: 0.22
Nodes (5): get_uuid_type(), upgrade(), downgrade(), get_uuid_type(), upgrade()

### Community 126 - "Community 126"
Cohesion: 0.31
Nodes (5): _create_user(), test_remove_user_keeps_audit_logs_and_actor_id(), test_remove_user_nulls_created_by_on_surviving_artifacts(), test_remove_user_with_password_history_succeeds_and_leaves_no_history(), test_remove_user_with_roles_raises_conflict()

### Community 127 - "Community 127"
Cohesion: 0.20
Nodes (4): get_input_sanitizer(), get_permissive_sanitizer(), get_strict_sanitizer(), InputSanitizer

### Community 129 - "Community 129"
Cohesion: 0.36
Nodes (4): SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update(), test_uuid_generation()

### Community 130 - "Community 130"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 131 - "Community 131"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 132 - "Community 132"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 133 - "Community 133"
Cohesion: 0.28
Nodes (4): get_uuid_type(), upgrade(), get_uuid_type(), upgrade()

### Community 136 - "Community 136"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 138 - "Community 138"
Cohesion: 0.29
Nodes (3): do_run_migrations(), run_migrations_offline(), run_migrations_online()

### Community 139 - "Community 139"
Cohesion: 0.46
Nodes (3): _reject(), reject_password_reset(), reject_verification()

### Community 140 - "Community 140"
Cohesion: 0.32
Nodes (3): test_create_audit_log(), test_filter_audit_logs_by_action(), test_retrieve_audit_logs()

### Community 141 - "Community 141"
Cohesion: 0.32
Nodes (3): test_check_password_reuse(), test_create_password_history(), test_retrieve_user_password_history()

### Community 144 - "Community 144"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 148 - "Community 148"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 150 - "Community 150"
Cohesion: 0.29
Nodes (3): auth_headers(), _create_headers(), token_factory()

### Community 153 - "Community 153"
Cohesion: 0.60
Nodes (4): downgrade(), get_uuid_type(), has_column(), upgrade()

### Community 154 - "Community 154"
Cohesion: 0.73
Nodes (4): downgrade(), _fk_names(), _recreate_fk(), upgrade()

### Community 157 - "Community 157"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 159 - "Community 159"
Cohesion: 0.40
Nodes (3): @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 160 - "Community 160"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 161 - "Community 161"
Cohesion: 0.60
Nodes (3): downgrade(), has_column(), upgrade()

### Community 162 - "Community 162"
Cohesion: 0.60
Nodes (3): downgrade(), table_exists(), upgrade()

### Community 165 - "Community 165"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 168 - "Community 168"
Cohesion: 0.40
Nodes (4): compilerOptions, paths, files, references

### Community 169 - "Community 169"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 175 - "Community 175"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

## Knowledge Gaps
- **27 isolated node(s):** `FASTAPI_ENV`, `PYTHONPATH`, `TESTING`, `APP_MODULE`, `HOST` (+22 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1885 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **112 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 11` to `Community 0`, `Community 128`, `Community 1`, `Community 3`, `Community 2`, `Community 5`, `Community 6`, `Community 12`, `Community 140`, `Community 141`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 24`, `Community 25`, `Community 27`, `Community 32`, `Community 33`, `Community 163`, `Community 164`, `Community 36`, `Community 39`, `Community 41`, `Community 42`, `Community 43`, `Community 47`, `Community 49`, `Community 50`, `Community 53`, `Community 56`, `Community 67`, `Community 75`, `Community 79`, `Community 83`, `Community 89`, `Community 106`, `Community 111`, `Community 116`, `Community 126`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Are the 126 inferred relationships involving `User` (e.g. with `get_current_user()` and `change_password()`) actually correct?**
  _`User` has 126 INFERRED edges - model-reasoned connections that need verification._
- **What connects `FASTAPI_ENV`, `PYTHONPATH`, `TESTING` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03571428571428571 - nodes in this community are weakly interconnected._
- **Why does `UUID` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 6`, `Community 11`, `Community 12`, `Community 139`, `Community 16`, `Community 19`, `Community 20`, `Community 25`, `Community 27`, `Community 36`, `Community 41`, `Community 44`, `Community 47`, `Community 49`, `Community 50`, `Community 53`, `Community 64`, `Community 78`, `Community 120`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 84 inferred relationships involving `MockRedisClient` (e.g. with `admin_creates_user()` and `test_the_emailed_link_verifies_the_account()`) actually correct?**
  _`MockRedisClient` has 84 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.041647597254004576 - nodes in this community are weakly interconnected._