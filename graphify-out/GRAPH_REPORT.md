# Graph Report - fastapi_rbac  (2026-10-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4836 nodes · 14061 edges · 254 communities (139 shown, 115 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 955 edges (avg confidence: 0.94)
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
- Community 183
- Community 184
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
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
- Community 218
- Community 219
- Community 220
- Community 221
- Community 222
- Community 226
- Community 227
- Community 229
- Community 230
- Community 242

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
- `events_named()` --uses--> `AuditLog`  [INFERRED]
  backend/test/api/test_security_event_persistence.py → backend/app/models/audit_log_model.py
- `matching()` --uses--> `AuditLog`  [INFERRED]
  backend/test/api/test_security_event_persistence.py → backend/app/models/audit_log_model.py
- `AuditLogFactory` --uses--> `AuditLog`  [INFERRED]
  backend/test/factories/audit_factory.py → backend/app/models/audit_log_model.py
- `test_create_audit_log()` --uses--> `AuditLog`  [INFERRED]
  backend/test/unit/test_audit_log_model.py → backend/app/models/audit_log_model.py

## Import Cycles
- 3-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionGroupSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/dashboardSlice.ts -> react-frontend/src/services/dashboard.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/userSlice.ts -> react-frontend/src/services/user.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/permissionSlice.ts -> react-frontend/src/services/permission.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/authSlice.ts -> react-frontend/src/services/auth.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleSlice.ts -> react-frontend/src/services/role.service.ts -> react-frontend/src/services/api.ts`
- 4-file cycle: `react-frontend/src/services/api.ts -> react-frontend/src/store/index.ts -> react-frontend/src/store/slices/roleGroupSlice.ts -> react-frontend/src/services/roleGroup.service.ts -> react-frontend/src/services/api.ts`

## Communities (254 total, 115 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (29): PermissionGroupData, clear_user_delete_references(), AuditLog, AuditLogBase, BaseUUIDModel, SQLModel, UserPasswordHistory, UserPasswordHistoryBase (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (82): LogoutEverywhereControl(), LogoutEverywhereControlProps, DataTable(), DataTableProps, DataTableColumnHeader(), DataTableColumnHeaderProps, DataTable(), DataTableProps (+74 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (20): AsyncFactoryBase, AsyncPermissionFactory, AsyncPermissionGroupFactory, AsyncRoleFactory, AsyncRoleGroupFactory, AsyncTestDataBuilder, AsyncUserFactory, admin_user() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (59): get_input_sanitizer(), get_permissive_sanitizer(), change_password(), confirm_password_reset(), ensure_utc(), get_new_access_token(), login(), login_access_token() (+51 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (45): IRoleCreate, IUserCreate, IUserUpdate, test_add_role_to_user(), test_add_role_to_user_not_found(), test_assign_permissions(), test_assign_permissions_not_found(), test_create_role() (+37 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (34): CRUDPermission, get_or_create_superuser(), init_db(), PermissionBase, IPermissionGroupCreate, IPermissionGroupUpdate, IPermissionCreate, IPermissionUpdate (+26 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (65): NestedPermissionGroupProps, PermissionGroupRowProps, PermissionFormContent(), PaginatedData, PaginatedPermissionGroupResponse, PaginatedPermissionResponse, PermissionCreate, PermissionGroup (+57 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (54): ApiErrorAlert(), ApiErrorAlertProps, LoginForm(), LoginFormData, loginSchema, PasswordRequirements(), PasswordRequirementsProps, SignupForm() (+46 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (53): App(), PublicOnlyRoute(), ProtectedRoute(), ProtectedRouteProps, DataTableColumn, OverviewChart(), OverviewChartData, OverviewChartProps (+45 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (29): html_to_plain_text(), render_template(), test_every_template_yields_text_containing_its_links(), test_plain_text_collapses_blank_runs(), test_plain_text_does_not_repeat_a_bare_url(), test_plain_text_drops_css_and_scripts(), test_plain_text_exposes_the_link(), test_plain_text_has_no_markup_left() (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (16): get_cached_celery_config(), get_celery_config(), DatabaseTypeEnum, ModeEnum, clear_refresh_token_cookie(), _refresh_cookie_attrs(), refresh_cookie_path(), refresh_cookie_samesite() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (48): InitAuth(), AppWrapper(), AppWrapperProps, LoadingScreen(), LoadingScreenProps, Meta(), MetaProps, PageMeta() (+40 more)

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (15): _subsec_encode(), uuid7(), test_docs_include_csrf_request_interceptor(), test_example_user_creation_with_mock(), mock_get_current_user_factory(), normal_user_token_headers(), superuser_token_headers(), create_mock_user() (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (19): get_settings_dependency(), get_strict_sanitizer(), create_role(), get_roles(), get_permission_by_id(), get_permission_by_name(), get_permission_group_by_id(), get_permission_group_by_name() (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (55): buttonVariants, CardAction(), Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem() (+47 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (28): header_text(), _mail_settings(), mock_send_email(), RecordingSMTPClient, send(), SentMessage, smtp(), get_client() (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (30): RoleGroupBase, IBaseSchema, IRoleGroupBase, IRoleGroupCreate, IRoleGroupUpdate, IUserBasic, IRoleOutput, IRolePermissionAssign (+22 more)

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (20): get_async_session(), get_redis_client(), _persist_security_event(), process_account_lockout(), _process_account_lockout_task(), send_password_reset_email(), send_registration_notice_email(), send_verification_email() (+12 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (28): account_email_budget_key(), AccountState, classify(), auth_url(), csrf_headers(), observable(), post_register(), post_resend() (+20 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (19): assign_roles_to_user(), bulk_update_users(), create_user(), get_my_data(), get_user_by_id(), get_user_list_order_by_created_at(), read_users(), read_users_list() (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (39): Checkbox(), FormControl(), FormDescription(), FormField(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+31 more)

### Community 21 - "Community 21"
Cohesion: 0.08
Nodes (9): CRUDRoleGroup, check_role_chain(), RoleGroupMap, RoleGroup, create_audit_log(), test_create_role_group_map(), test_retrieve_groups_for_role(), test_retrieve_roles_in_group() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (21): create_permission(), delete_permission(), get_permission_by_id(), get_permissions(), update_role_group(), IPermissionGroupRead, IPermissionGroupReadWithPermissions, IPermissionRead (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (29): refresh_origin_is_anomalous(), session_origin_ip(), _db_user(), _establish_session(), _origin_check_enabled(), recorded_security_events(), _refresh(), refreshing_user() (+21 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (28): get_current_user(), current_user(), add_session_tokens_to_redis(), get_valid_tokens(), token_is_allowlisted(), Clock, _login_once(), _seed_refresh_token() (+20 more)

### Community 25 - "Community 25"
Cohesion: 0.05
Nodes (46): name, private, type, version, autoprefixer, clsx, cmdk, date-fns (+38 more)

### Community 26 - "Community 26"
Cohesion: 0.07
Nodes (12): apiEndpoints, routes, testPermissions, testRoles, testUsers, timeouts, ApiMockHelper, AuthHelper (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (38): cmd_config(), cmd_down(), cmd_env(), cmd_exec(), cmd_health(), cmd_logs(), cmd_pull(), cmd_restart() (+30 more)

### Community 28 - "Community 28"
Cohesion: 0.07
Nodes (16): get_csrf_token(), add_roles_to_group(), bulk_create_role_groups(), bulk_delete_role_groups(), clone_role_group(), create_role_group(), delete_role_group(), get_role_group_by_id() (+8 more)

### Community 29 - "Community 29"
Cohesion: 0.07
Nodes (3): CRUDUser, password_reuse_window(), PasswordReuseError

### Community 30 - "Community 30"
Cohesion: 0.09
Nodes (3): _response_message(), TestAuthenticationEdgeCases, TestAuthenticationSecurity

### Community 31 - "Community 31"
Cohesion: 0.08
Nodes (10): _CRLFMessageProxy, _CRLFSMTPBackend, built_message(), test_backend_wraps_the_message_it_forwards(), test_headers_are_crlf_terminated(), test_proxy_delegates_everything_else(), test_proxy_is_idempotent(), test_proxy_normalises_lone_cr() (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (22): IGenderEnum, IUserMessage, TokenType, add_derived_access_token_to_redis(), add_token_to_redis(), _allowlist_key(), _allowlist_meta_key(), _as_text() (+14 more)

### Community 34 - "Community 34"
Cohesion: 0.10
Nodes (3): CRUDBase, CRUDPermissionGroup, IOrderEnum

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (18): delete_if_still_pending(), _pending_past_window(), select_pending_user_ids(), sweep_unverified_users(), unverified_cutoff(), _exists(), _make_user(), _naive_utc_now() (+10 more)

### Community 36 - "Community 36"
Cohesion: 0.05
Nodes (37): dependencies, autoprefixer, axios, class-variance-authority, clsx, cmdk, date-fns, @hookform/resolvers (+29 more)

### Community 37 - "Community 37"
Cohesion: 0.10
Nodes (17): client_address_key(), rate_limit_key(), remember_authenticated_identity(), _limited_client(), establish_identity(), _request(), test_a_bearer_token_without_established_identity_is_keyed_by_address(), test_anonymous_burst_from_one_address_is_rate_limited() (+9 more)

### Community 38 - "Community 38"
Cohesion: 0.17
Nodes (20): PasswordChangeReason, _actor_for(), _admin(), _assert_nothing_changed(), _audit_actions(), _change(), _FailingRedis, _history() (+12 more)

### Community 40 - "Community 40"
Cohesion: 0.09
Nodes (5): get_settings(), Settings, test_settings_default_to_loopback_only(), test_settings_have_none_of_the_four_unimplemented_session_controls(), test_stale_environment_keys_do_not_prevent_settings_from_loading()

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (19): _app_package(), auth_url(), _calls_named(), predicate(), issue_reset_token(), login_headers(), _modules_matching(), post_change_password() (+11 more)

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (16): allowlist_key(), auth_url(), login(), post_change_password(), redis_ops(), recording(), test_change_password_leaves_the_new_tokens_allowlisted(), test_change_password_revokes_a_pending_reset_link() (+8 more)

### Community 43 - "Community 43"
Cohesion: 0.27
Nodes (24): auth_url(), csrf_headers(), events_named(), matching(), post_login(), test_account_email_budget_exhaustion_writes_an_audit_row(), test_failed_audit_write_does_not_change_failed_login_status(), test_failed_login_writes_an_audit_row() (+16 more)

### Community 44 - "Community 44"
Cohesion: 0.09
Nodes (8): get_project_root(), app(), client(), mock_get_current_user(), _in_integration_suite(), pytest_collection_modifyitems(), pytest_terminal_summary(), stack_is_active()

### Community 46 - "Community 46"
Cohesion: 0.10
Nodes (8): is_valid_user(), is_valid_user_id(), _reject(), reject_password_reset(), reject_verification(), _subsec_decode(), UUID, uuid6()

### Community 48 - "Community 48"
Cohesion: 0.08
Nodes (9): DBType, test_db_type_enum(), test_db_type_from_str(), test_test_config_defaults(), test_test_config_get_connection_args(), test_test_config_get_db_uri_postgres(), test_test_config_get_db_uri_sqlite(), test_test_config_get_pool_class() (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (21): resolve_client_address(), _app(), who(), _ask(), _request(), test_absent_peer_stays_absent(), test_empty_trust_configuration_ignores_every_forwarded_header(), test_forwarded_chain_is_read_from_the_right_past_trusted_proxies() (+13 more)

### Community 50 - "Community 50"
Cohesion: 0.12
Nodes (12): add_token_claims(), create_access_token(), create_refresh_token(), create_reset_token(), decode_token(), validate_token_claims(), test_access_token_generation(), test_decode_token() (+4 more)

### Community 51 - "Community 51"
Cohesion: 0.12
Nodes (7): BaseFactory, Meta, PermissionFactory, PermissionGroupFactory, RoleFactory, RoleGroupFactory, db_factories()

### Community 52 - "Community 52"
Cohesion: 0.07
Nodes (29): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+21 more)

### Community 53 - "Community 53"
Cohesion: 0.16
Nodes (16): get_dashboard_data(), get_dashboard_stats(), get_active_sessions_count(), get_active_users_count(), get_recent_logins(), get_system_users_summary(), get_total_permissions_count(), get_total_roles_count() (+8 more)

### Community 54 - "Community 54"
Cohesion: 0.21
Nodes (15): auth_url(), post_reset_confirm(), post_reset_request(), seed_users(), test_no_token_flow_branch_returns_faster_than_the_floor(), test_reset_confirm_checks_the_token_before_the_password_rules(), test_reset_confirm_disabled_matches_a_bad_token(), test_reset_confirm_disabled_matches_an_unknown_address() (+7 more)

### Community 55 - "Community 55"
Cohesion: 0.15
Nodes (12): auth_url(), fetch_csrf_token(), is_csrf_rejection(), test_csrf_rejected_when_header_does_not_match_cookie(), test_csrf_rejected_when_header_missing_but_cookie_present(), test_csrf_token_endpoint_issues_token_and_cookie(), test_endpoint_accepts_valid_csrf_token(), test_endpoint_rejected_with_invalid_csrf_token() (+4 more)

### Community 56 - "Community 56"
Cohesion: 0.10
Nodes (11): background_tasks_mock(), celery_mock(), celery_task_mock(), database_transaction_mock(), email_failure_mock(), email_mock(), http_client_mock(), oauth_provider_mock() (+3 more)

### Community 57 - "Community 57"
Cohesion: 0.17
Nodes (5): generate_strong_password(), login_user(), promote_user_to_admin(), register_and_verify_user(), TestUserManagementFlow

### Community 58 - "Community 58"
Cohesion: 0.14
Nodes (10): accept_initial_password(), _apply_account_changes(), _audit_details(), change_password(), _check_rules(), _discard_staged_change(), InitialPasswordReason, PasswordRefusalKind (+2 more)

### Community 59 - "Community 59"
Cohesion: 0.13
Nodes (12): clean_cache(), cleanup_coverage_files(), format_code(), is_running_in_docker(), lint_code(), main(), run_all_tests(), run_command() (+4 more)

### Community 60 - "Community 60"
Cohesion: 0.11
Nodes (11): downgrade(), upgrade(), downgrade(), upgrade(), upgrade(), upgrade(), upgrade(), upgrade() (+3 more)

### Community 61 - "Community 61"
Cohesion: 0.09
Nodes (11): is_trusted_proxy(), parse_trusted_proxies(), split_entries(), TrustedProxyError, test_parse_trusted_proxies_accepts_a_comma_separated_string(), test_parse_trusted_proxies_accepts_addresses_and_networks(), test_parse_trusted_proxies_refuses_a_wildcard(), test_parse_trusted_proxies_refuses_unparseable_entries() (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.13
Nodes (9): sanitize_email(), sanitize_filename(), sanitize_form_data(), sanitize_html(), sanitize_input(), sanitize_json_values(), sanitize_search_query(), sanitize_text() (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.10
Nodes (3): decorator(), MockCeleryResult, MockCeleryTask

### Community 64 - "Community 64"
Cohesion: 0.12
Nodes (8): assign_permissions_to_role(), delete_role(), get_all_roles_list(), get_role_by_id(), remove_permission_from_role_by_id(), remove_permissions_from_role(), update_role(), serialize_role()

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (13): ErrorResponse, ErrorResponseWithErrors, LoginCredentials, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, Token, TokenRead (+5 more)

### Community 66 - "Community 66"
Cohesion: 0.09
Nodes (8): create_permission_group(), delete_permission_group(), get_permission_group_by_id(), get_permission_groups(), update_permission_group(), IPermissionGroupBase, IPermissionGroupWithPermissions, UserBasic

### Community 67 - "Community 67"
Cohesion: 0.24
Nodes (17): _allowlist_counts(), _establish_session(), _logout(), _no_session_limit(), _request(), test_empty_session_id_revokes_nothing(), test_end_caller_session_returns_false_without_tokens(), test_logout_all_returns_500_when_revocation_fails() (+9 more)

### Community 68 - "Community 68"
Cohesion: 0.12
Nodes (8): check_for_drift(), Drift, fail_on_drift(), find_drift(), format_report(), _matches(), parse_pins(), _severity()

### Community 69 - "Community 69"
Cohesion: 0.15
Nodes (8): custom_exception_handler(), CustomException, database_exception_handler(), general_exception_handler(), password_refused_handler(), sqlalchemy_exception_handler(), unhandled_exception_handler(), user_self_delete_exception_handler()

### Community 70 - "Community 70"
Cohesion: 0.11
Nodes (6): Meta, UserFactory, make_admin_user(), _make_admin_user(), make_user(), _make_user()

### Community 71 - "Community 71"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (10): is_different_network(), origin_network(), parse_client_address(), test_absent_is_not_mismatched(), test_different_network_is_a_mismatch(), test_origin_network_is_none_for_unusable_input(), test_origin_network_uses_slash_24_and_slash_64(), test_parse_client_address_normalises_usable_addresses() (+2 more)

### Community 73 - "Community 73"
Cohesion: 0.26
Nodes (13): admin_headers(), post_user(), put_password(), rules_refusal(), test_admin_create_rules_refused(), test_admin_create_succeeded(), test_admin_update_reuse_refused(), test_admin_update_rules_refused() (+5 more)

### Community 74 - "Community 74"
Cohesion: 0.19
Nodes (12): _app_package(), auth_url(), issue_reset_token(), post_register(), rules_refusal(), test_change_password_rules_refused(), test_registration_rules_refused(), test_registration_still_answers_uniformly_for_an_existing_account() (+4 more)

### Community 75 - "Community 75"
Cohesion: 0.11
Nodes (6): dependency_overrider(), DependencyOverrider, mock_current_user_factory(), async_mock_current_user(), mock_current_user(), mock_dependency()

### Community 77 - "Community 77"
Cohesion: 0.13
Nodes (5): TokenFactory, auth_headers(), _make_headers(), HeadersCallable, token_factory()

### Community 79 - "Community 79"
Cohesion: 0.17
Nodes (13): AuthState, Permission, ApiResponse, PaginatedItems, Role, User, ApiError, UserCreatePayload (+5 more)

### Community 80 - "Community 80"
Cohesion: 0.11
Nodes (8): log_security_event_task(), test_beat_entrypoint_alone_carries_the_schedule(), test_beat_schedule_only_names_registered_tasks(), test_beat_schedules_the_unverified_cleanup_sweep(), test_celery_app_imports_worker_tasks(), test_celery_app_registers_unverified_cleanup_task(), test_celery_config_lists_worker_imports(), test_log_security_event_task_is_a_registered_noop()

### Community 81 - "Community 81"
Cohesion: 0.26
Nodes (11): _admin(), login(), put_user_password(), test_admin_session_survives_setting_another_users_password(), test_admin_set_password_invalidates_the_target_token(), test_admin_update_revokes_tokens_the_target_already_held(), test_non_password_update_revokes_nothing(), test_rejected_complexity_revokes_nothing() (+3 more)

### Community 82 - "Community 82"
Cohesion: 0.19
Nodes (8): test_cookie_refresh_issues_new_access_token(), test_json_login_writes_access_and_refresh_allowlist(), test_login_sets_httponly_refresh_cookie(), test_logout_rejects_subsequent_refresh(), test_oauth2_first_login_writes_allowlist_and_logout_rejects(), test_refresh_rejected_when_allowlist_empty(), test_refresh_requires_csrf(), _user_id_from_access_token()

### Community 84 - "Community 84"
Cohesion: 0.13
Nodes (6): create_limiter(), _is_testing(), _storage_uri(), _decode(), ProxyHeadersMiddleware, test_shared_limiter_uses_the_user_or_address_key_function()

### Community 85 - "Community 85"
Cohesion: 0.13
Nodes (7): get_content(), get_data_encrypt(), VerifyEmail, _no_response_floor(), _request(), _sanitizer(), test_unverified_redis_mismatch_takes_the_uniform_reject()

### Community 86 - "Community 86"
Cohesion: 0.17
Nodes (10): create_verification_token(), observable(), post_verify_email(), test_verify_email_disabled_matches_an_unknown_address(), test_verify_email_disabled_still_emits_its_own_event(), test_verify_email_disabled_verified_matches_an_unknown_address(), test_verify_email_second_visit_says_already_verified(), test_verify_email_still_verifies_an_active_user() (+2 more)

### Community 87 - "Community 87"
Cohesion: 0.16
Nodes (6): admin_created_users_get_a_verification_email(), admin_creates_user(), emailed_token(), _reload(), test_the_emailed_link_verifies_the_account(), test_the_emailed_token_is_the_one_redis_holds()

### Community 88 - "Community 88"
Cohesion: 0.37
Nodes (5): login_user(), promote_user_to_admin(), register_and_verify_user(), TestRoleManagementFlow, unique_email()

### Community 89 - "Community 89"
Cohesion: 0.14
Nodes (8): settings_with(), test_an_explicit_value_still_wins(), test_both_links_follow_frontend_url(), test_changing_frontend_url_moves_both_links(), test_committed_env_files_do_not_pin_the_derived_links(), test_login_link_in_notice_email_uses_the_same_base(), test_no_link_ever_points_at_the_default_when_frontend_url_is_set(), test_trailing_slash_does_not_double_up()

### Community 90 - "Community 90"
Cohesion: 0.25
Nodes (14): PaginatedDataResponse, PaginatedResponse, PaginationParams, Role, RoleCreate, RolePermissionAssign, RolePermissionUnassign, RoleResponse (+6 more)

### Community 91 - "Community 91"
Cohesion: 0.16
Nodes (5): PasswordValidator, test_sample_password_is_accepted_by_the_policy(), test_sample_passwords_are_rejected_by_the_policy(), test_two_hashes_of_one_password_are_never_equal(), test_password_hashing()

### Community 93 - "Community 93"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 94 - "Community 94"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 95 - "Community 95"
Cohesion: 0.19
Nodes (6): compare_files(), executable_line_mismatch(), hit_miss_disagreements(), main(), normalize_filename(), parse_cobertura()

### Community 97 - "Community 97"
Cohesion: 0.17
Nodes (4): register_user_with_csrf(), TestComprehensiveAuth, get_csrf_token(), register_user_with_csrf()

### Community 99 - "Community 99"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, lint, preview, test, test:coverage (+9 more)

### Community 100 - "Community 100"
Cohesion: 0.26
Nodes (15): assert_main_clean(), build_docker_images(), build_release_notes_entry(), clear_changelog_artifact(), create_git_tag(), generate_changelog(), get_latest_git_tag(), invoke_direct_tag_mode() (+7 more)

### Community 104 - "Community 104"
Cohesion: 0.23
Nodes (6): check_csrf_token_generation(), check_endpoint_with_csrf(), check_endpoint_with_invalid_csrf(), check_endpoint_without_csrf(), get_test_data(), main()

### Community 105 - "Community 105"
Cohesion: 0.14
Nodes (4): AuditLogFactory, Meta, make_audit_log(), _make_audit_log()

### Community 106 - "Community 106"
Cohesion: 0.17
Nodes (10): make_permission(), make_permission_group(), _make_permission_group(), _make_permission(), make_role(), make_role_group(), _make_role_group(), _make_role() (+2 more)

### Community 107 - "Community 107"
Cohesion: 0.25
Nodes (10): _report(), test_cli_accepts_matching_executable_lines_even_when_hits_differ(), test_cli_defaults_to_auth_py(), test_cli_exits_2_when_an_input_path_does_not_exist(), test_cli_rejects_reports_that_do_not_share_an_executable_line_set(), test_cli_rejects_when_the_file_is_missing_from_one_report(), test_executable_line_mismatch_when_reports_list_different_lines(), test_executable_line_sets_may_disagree_on_hits_but_not_on_which_lines_exist() (+2 more)

### Community 108 - "Community 108"
Cohesion: 0.16
Nodes (6): db(), db_engine(), initialize_db(), update_first_name(), update_last_name(), __aenter__()

### Community 110 - "Community 110"
Cohesion: 0.18
Nodes (6): calls_named(), handlers_in(), test_every_password_path_revokes_prior_sessions(), test_password_version_appears_nowhere_in_the_app_package(), test_the_policy_module_revokes_prior_sessions(), test_user_model_has_no_password_version()

### Community 112 - "Community 112"
Cohesion: 0.24
Nodes (10): Assert-MainClean(), Build-DockerImages(), Get-ReleaseNotesEntry(), Invoke-DirectTagMode(), Invoke-ReleasePrMode(), New-Changelog(), New-GitTag(), Confirm-Continue() (+2 more)

### Community 113 - "Community 113"
Cohesion: 0.44
Nodes (14): Invoke-ComprehensiveTest(), Invoke-ConnectivityTest(), Invoke-ValidationTest(), Show-TestSummary(), Test-Authentication(), Test-ContainerHealth(), Test-CORS(), Test-DatabaseConnection() (+6 more)

### Community 114 - "Community 114"
Cohesion: 0.23
Nodes (5): downgrade(), test_downgrade_restores_the_column_with_its_default(), test_upgrade_drops_the_column_and_keeps_the_rows(), upgrade(), user_columns()

### Community 116 - "Community 116"
Cohesion: 0.19
Nodes (13): NestedRoleGroupProps, RoleGroupFormProps, RoleGroupRowProps, RoleFormProps, RoleGroup, RoleGroupWithRoles, addRolesToGroup, ApiError (+5 more)

### Community 117 - "Community 117"
Cohesion: 0.33
Nodes (13): Get-EnvironmentContainers(), Get-EnvironmentImages(), Get-EnvironmentNetworks(), Get-EnvironmentVolumes(), Invoke-EnvironmentCleanup(), Remove-EnvironmentContainers(), Remove-EnvironmentImages(), Remove-EnvironmentNetworks() (+5 more)

### Community 118 - "Community 118"
Cohesion: 0.19
Nodes (5): rate_limit_handler(), validation_exception_handler(), create_error_response(), ErrorDetail, IErrorResponse

### Community 119 - "Community 119"
Cohesion: 0.26
Nodes (5): _events(), test_anonymous_security_event_persists_with_null_actor_id(), test_log_security_event_does_not_dispatch_celery(), test_log_security_event_opens_a_session_when_none_is_passed(), test_log_security_event_writes_an_audit_row_for_a_known_user()

### Community 120 - "Community 120"
Cohesion: 0.21
Nodes (6): api, ErrorDetail, ErrorResponseData, PasswordComplexityDetail, mockedApi, axios

### Community 121 - "Community 121"
Cohesion: 0.20
Nodes (7): downgrade(), get_uuid_type(), upgrade(), get_uuid_type(), upgrade(), downgrade(), upgrade()

### Community 123 - "Community 123"
Cohesion: 0.35
Nodes (11): Clean-DevelopmentEnvironment(), Install-Dependencies(), Show-Help(), Show-ServiceStatus(), Start-CeleryServices(), Start-PostgresService(), Start-RedisService(), Stop-DevelopmentServices() (+3 more)

### Community 125 - "Community 125"
Cohesion: 0.22
Nodes (4): _reset_limiter_storage(), test_access_token_http_rate_limit_returns_429_when_enabled(), test_main_does_not_import_fastapi_limiter(), test_shared_limiter_disabled_in_testing_by_default()

### Community 126 - "Community 126"
Cohesion: 0.22
Nodes (5): get_uuid_type(), upgrade(), downgrade(), get_uuid_type(), upgrade()

### Community 128 - "Community 128"
Cohesion: 0.25
Nodes (4): consume_account_email_budget(), _create_pending_user(), dispatch_account_email(), DispatchResult

### Community 130 - "Community 130"
Cohesion: 0.22
Nodes (4): test_create_permission_group(), test_permission_group(), test_permission_group_relationships(), test_user()

### Community 131 - "Community 131"
Cohesion: 0.31
Nodes (5): _create_user(), test_remove_user_keeps_audit_logs_and_actor_id(), test_remove_user_nulls_created_by_on_surviving_artifacts(), test_remove_user_with_password_history_succeeds_and_leaves_no_history(), test_remove_user_with_roles_raises_conflict()

### Community 132 - "Community 132"
Cohesion: 0.27
Nodes (8): DashboardData, DashboardStats, RecentLoginUser, UserSummaryForTable, DashboardApiResponse, dashboardService, DashboardState, mockedApi

### Community 133 - "Community 133"
Cohesion: 0.20
Nodes (9): arrowParens, bracketSpacing, jsxBracketSameLine, printWidth, semi, singleQuote, tabWidth, trailingComma (+1 more)

### Community 134 - "Community 134"
Cohesion: 0.38
Nodes (7): RoleGroupCreate, RoleGroupResponse, RoleGroupUpdate, RoleGroupWithRolesResponse, UserBasic, roleGroupService, mockedApi

### Community 136 - "Community 136"
Cohesion: 0.53
Nodes (9): fix_backend_imports(), fix_frontend_imports(), format_backend(), format_frontend(), lint_backend(), lint_frontend(), print_color(), manage-code-quality.sh script (+1 more)

### Community 137 - "Community 137"
Cohesion: 0.44
Nodes (9): Clean-BuildArtifacts(), Clean-CacheFiles(), Clean-DockerArtifacts(), Clean-LogFiles(), Invoke-SecurityScan(), Remove-ItemSafely(), Show-Help(), Update-Dependencies() (+1 more)

### Community 138 - "Community 138"
Cohesion: 0.28
Nodes (4): get_uuid_type(), upgrade(), get_uuid_type(), upgrade()

### Community 140 - "Community 140"
Cohesion: 0.33
Nodes (4): SampleModel, test_base_uuid_model_create(), test_base_uuid_model_update(), test_uuid_generation()

### Community 142 - "Community 142"
Cohesion: 0.42
Nodes (8): Invoke-BackendFixImports(), Invoke-BackendFormat(), Invoke-BackendLint(), Invoke-FrontendFixImports(), Invoke-FrontendFormat(), Invoke-FrontendLint(), Show-Help(), Write-ColorOutput()

### Community 144 - "Community 144"
Cohesion: 0.29
Nodes (3): do_run_migrations(), run_migrations_offline(), run_migrations_online()

### Community 145 - "Community 145"
Cohesion: 0.25
Nodes (3): get_csrf_protect(), set_csrf_protect_instance(), validate_csrf_token()

### Community 147 - "Community 147"
Cohesion: 0.32
Nodes (3): test_create_audit_log(), test_filter_audit_logs_by_action(), test_retrieve_audit_logs()

### Community 148 - "Community 148"
Cohesion: 0.32
Nodes (3): test_check_password_reuse(), test_create_password_history(), test_retrieve_user_password_history()

### Community 151 - "Community 151"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 154 - "Community 154"
Cohesion: 0.38
Nodes (6): FASTAPI_ENV, postgres_ready(), PYTHONPATH, redis_ready(), entrypoint-test.sh script, TESTING

### Community 158 - "Community 158"
Cohesion: 0.60
Nodes (4): downgrade(), get_uuid_type(), has_column(), upgrade()

### Community 159 - "Community 159"
Cohesion: 0.73
Nodes (4): downgrade(), _fk_names(), _recreate_fk(), upgrade()

### Community 161 - "Community 161"
Cohesion: 0.40
Nodes (3): main(), wait_for_database(), wait_for_redis()

### Community 164 - "Community 164"
Cohesion: 0.60
Nodes (5): setup-dev.sh script, start_redis(), stop_redis(), start_celery_worker(), usage()

### Community 167 - "Community 167"
Cohesion: 0.40
Nodes (3): @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 168 - "Community 168"
Cohesion: 0.73
Nodes (5): Build-DockerImage(), Build-EnvironmentImages(), Get-ImageConfiguration(), Remove-ExistingImages(), Write-ColorOutput()

### Community 169 - "Community 169"
Cohesion: 0.60
Nodes (3): downgrade(), has_column(), upgrade()

### Community 170 - "Community 170"
Cohesion: 0.60
Nodes (3): downgrade(), table_exists(), upgrade()

### Community 172 - "Community 172"
Cohesion: 0.40
Nodes (4): IUserLoginSchema, IUserOutputPaginatedSchema, IUserRoleAssign, IVerifyEmail

### Community 173 - "Community 173"
Cohesion: 0.40
Nodes (4): APP_MODULE, HOST, PORT, start-api.sh script

### Community 176 - "Community 176"
Cohesion: 0.40
Nodes (4): compilerOptions, paths, files, references

### Community 177 - "Community 177"
Cohesion: 0.70
Nodes (4): Ensure-Network(), Invoke-DockerCompose(), Show-PortInfo(), Write-ColorOutput()

### Community 184 - "Community 184"
Cohesion: 1.00
Nodes (3): color_echo(), remove_dir(), cleanup-artifacts.sh script

## Knowledge Gaps
- **340 isolated node(s):** `LogoutEverywhereControlProps`, `DataTableProps`, `DataTableColumnHeaderProps`, `DataTableProps`, `BadgeProps` (+335 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1880 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **115 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Community 0` to `Community 128`, `Community 2`, `Community 3`, `Community 4`, `Community 130`, `Community 131`, `Community 9`, `Community 12`, `Community 13`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 147`, `Community 21`, `Community 22`, `Community 148`, `Community 24`, `Community 23`, `Community 28`, `Community 29`, `Community 32`, `Community 35`, `Community 37`, `Community 38`, `Community 39`, `Community 41`, `Community 171`, `Community 45`, `Community 46`, `Community 53`, `Community 58`, `Community 64`, `Community 66`, `Community 70`, `Community 73`, `Community 74`, `Community 75`, `Community 81`, `Community 87`, `Community 110`, `Community 114`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Are the 126 inferred relationships involving `User` (e.g. with `get_current_user()` and `change_password()`) actually correct?**
  _`User` has 126 INFERRED edges - model-reasoned connections that need verification._
- **What connects `LogoutEverywhereControlProps`, `DataTableProps`, `DataTableColumnHeaderProps` to the rest of the system?**
  _340 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06204481792717087 - nodes in this community are weakly interconnected._
- **Why does `get_csrf_token()` connect `Community 97` to `Community 2`, `Community 165`, `Community 73`, `Community 74`, `Community 41`, `Community 43`, `Community 42`, `Community 12`, `Community 81`, `Community 82`, `Community 83`, `Community 54`, `Community 87`, `Community 86`, `Community 57`, `Community 88`, `Community 30`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 84 inferred relationships involving `MockRedisClient` (e.g. with `admin_creates_user()` and `test_the_emailed_link_verifies_the_account()`) actually correct?**
  _`MockRedisClient` has 84 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10778050778050778 - nodes in this community are weakly interconnected._