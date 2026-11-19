# Web v1 redesign artboards

Exported from the Design canvas "FastAPI RBAC — UI redesign" (Revision 1, 2026-11-19). Each artboard is one self-contained HTML file with every style inline, so colors, spacing and type values can be read straight from the markup. `canvas.json` is the canvas index: frame positions, titles and the designer notes.

These files are a reference for implementation. Don't edit them by hand; re-export from the canvas instead. Prettier ignores this folder (`react-frontend/.prettierignore`).

**Engineer tags.** Dashed amber tags are notes for engineers, not UI. "needs API" marks data that needs a backend endpoint that doesn't exist yet. "visible to superusers only" marks a control only superusers see.

| Artboard | File | Size |
|---|---|---|
| 01 · Foundations · Foundations · Desktop 1440 · Light | [Main.dc.html](Main.dc.html) | 1440×5400 |
| 02 · Auth · Login · Desktop 1440 · Light | [auth-login.dc.html](auth-login.dc.html) | 1440×900 |
| 02 · Auth · Login – error · Desktop 1440 · Light | [auth-login-error.dc.html](auth-login-error.dc.html) | 1440×900 |
| 02 · Auth · Login – locked · Desktop 1440 · Light | [auth-login-locked.dc.html](auth-login-locked.dc.html) | 1440×900 |
| 02 · Auth · Register · Desktop 1440 · Light | [auth-register.dc.html](auth-register.dc.html) | 1440×1000 |
| 02 · Auth · Reset request · Desktop 1440 · Light | [auth-reset-request.dc.html](auth-reset-request.dc.html) | 1440×900 |
| 02 · Auth · Reset confirm · Desktop 1440 · Light | [auth-reset-confirm.dc.html](auth-reset-confirm.dc.html) | 1440×900 |
| 02 · Auth · Verify email – success · Desktop 1440 · Light | [auth-verify-success.dc.html](auth-verify-success.dc.html) | 1440×900 |
| 02 · Auth · Verify email – expired · Desktop 1440 · Light | [auth-verify-expired.dc.html](auth-verify-expired.dc.html) | 1440×900 |
| 02 · Auth · Change password required · Desktop 1440 · Light | [auth-change-required.dc.html](auth-change-required.dc.html) | 1440×960 |
| 02 · Auth · Login · Desktop 1440 · Dark | [auth-login-dark.dc.html](auth-login-dark.dc.html) | 1440×900 |
| 02 · Auth · Login · Mobile 390 · Light | [auth-login-mobile.dc.html](auth-login-mobile.dc.html) | 390×844 |
| 02 · Auth · Login – signed out everywhere · Desktop 1440 · Light | [auth-login-signed-out.dc.html](auth-login-signed-out.dc.html) | 1440×900 |
| 03 · Shell · Sidebar expanded · Desktop 1440 · Light | [shell-sidebar-expanded.dc.html](shell-sidebar-expanded.dc.html) | 1440×900 |
| 03 · Shell · Sidebar collapsed · Desktop 1440 · Light | [shell-sidebar-collapsed.dc.html](shell-sidebar-collapsed.dc.html) | 1440×1200 |
| 03 · Shell · User menu open · Desktop 1440 · Light | [shell-user-menu.dc.html](shell-user-menu.dc.html) | 1440×1200 |
| 03 · Shell · Mobile drawer · Mobile 390 · Light | [shell-drawer-mobile.dc.html](shell-drawer-mobile.dc.html) | 390×1080 |
| 04 · Home · Admin dashboard · Desktop 1440 · Light | [home-admin.dc.html](home-admin.dc.html) | 1440×1200 |
| 04 · Home · Admin dashboard · Desktop 1440 · Dark | [home-admin-dark.dc.html](home-admin-dark.dc.html) | 1440×1200 |
| 04 · Home · Manager dashboard · Desktop 1440 · Light | [home-manager.dc.html](home-manager.dc.html) | 1440×1060 |
| 04 · Home · User home · Desktop 1440 · Light | [home-user.dc.html](home-user.dc.html) | 1440×820 |
| 04 · Home · User home · Mobile 390 · Light | [home-user-mobile.dc.html](home-user-mobile.dc.html) | 390×1400 |
| 05 · Users · List · Desktop 1440 · Light | [users-list.dc.html](users-list.dc.html) | 1440×1100 |
| 05 · Users · List · Desktop 1440 · Dark | [users-list-dark.dc.html](users-list-dark.dc.html) | 1440×1100 |
| 05 · Users · List · Mobile 390 · Light | [users-list-mobile.dc.html](users-list-mobile.dc.html) | 390×1080 |
| 05 · Users · Detail · Desktop 1440 · Light | [users-detail.dc.html](users-detail.dc.html) | 1440×1000 |
| 05 · Users · Create form · Desktop 1440 · Light | [users-create.dc.html](users-create.dc.html) | 1440×1500 |
| 05 · Users · Edit form · Desktop 1440 · Light | [users-edit.dc.html](users-edit.dc.html) | 1440×1180 |
| 05 · Users · Delete dialog · Desktop 1440 · Light | [users-delete.dc.html](users-delete.dc.html) | 1440×1100 |
| 05 · Users · Create form – manager · Desktop 1440 · Light | [users-create-manager.dc.html](users-create-manager.dc.html) | 1440×1300 |
| 05 · Users · Detail – unverified, email resent · Desktop 1440 · Light | [users-detail-unverified.dc.html](users-detail-unverified.dc.html) | 1440×1000 |
| 06 · Roles · List · Desktop 1440 · Light | [roles-list.dc.html](roles-list.dc.html) | 1440×760 |
| 06 · Roles · List – manager, read only · Desktop 1440 · Light | [roles-list-manager.dc.html](roles-list-manager.dc.html) | 1440×760 |
| 06 · Roles · Detail · Desktop 1440 · Light | [roles-detail.dc.html](roles-detail.dc.html) | 1440×920 |
| 06 · Roles · Permission matrix editor · Desktop 1440 · Light | [roles-matrix.dc.html](roles-matrix.dc.html) | 1440×1220 |
| 06 · Roles · Permission matrix editor · Desktop 1440 · Dark | [roles-matrix-dark.dc.html](roles-matrix-dark.dc.html) | 1440×1220 |
| 06 · Roles · Create role · Desktop 1440 · Light | [roles-create.dc.html](roles-create.dc.html) | 1440×1220 |
| 06 · Roles · Delete – type to confirm · Desktop 1440 · Light | [roles-delete.dc.html](roles-delete.dc.html) | 1440×760 |
| 07 · Groups · Role groups tree · Desktop 1440 · Light | [groups-role-tree.dc.html](groups-role-tree.dc.html) | 1440×760 |
| 07 · Groups · Permission groups tree · Desktop 1440 · Light | [groups-permission-tree.dc.html](groups-permission-tree.dc.html) | 1440×1180 |
| 07 · Groups · Group create / edit form · Desktop 1440 · Light | [groups-form.dc.html](groups-form.dc.html) | 1440×900 |
| 08 · Permissions · List · Desktop 1440 · Light | [permissions-list.dc.html](permissions-list.dc.html) | 1440×1000 |
| 08 · Permissions · Detail · Desktop 1440 · Light | [permissions-detail.dc.html](permissions-detail.dc.html) | 1440×760 |
| 09 · Account settings · Profile · Desktop 1440 · Light | [account-profile.dc.html](account-profile.dc.html) | 1440×860 |
| 09 · Account settings · Security · Desktop 1440 · Light | [account-security.dc.html](account-security.dc.html) | 1440×960 |
| 09 · Account settings · Appearance · Desktop 1440 · Light | [account-appearance.dc.html](account-appearance.dc.html) | 1440×760 |
| 09 · Account settings · Security – sign out everywhere dialog · Desktop 1440 · Light | [account-security-signout.dc.html](account-security-signout.dc.html) | 1440×960 |
| 10 · System · In-app 404 · Desktop 1440 · Light | [sys-404.dc.html](sys-404.dc.html) | 1440×760 |
| 10 · System · In-app Unauthorized · Desktop 1440 · Light | [sys-unauthorized.dc.html](sys-unauthorized.dc.html) | 1440×760 |
| 10 · System · 404 – signed out · Desktop 1440 · Light | [sys-404-signed-out.dc.html](sys-404-signed-out.dc.html) | 1440×860 |
| 10 · System · Empty-state sheet · Desktop 1440 · Light | [sys-empty-states.dc.html](sys-empty-states.dc.html) | 1440×1000 |
| 10 · System · Skeleton sheet · Desktop 1440 · Light | [sys-skeletons.dc.html](sys-skeletons.dc.html) | 1440×1300 |
| 10 · System · Toasts · Desktop 1440 · Light | [sys-toasts.dc.html](sys-toasts.dc.html) | 1440×1100 |

## Revision 1 notes

1. Manager shows its seeded 15 permissions everywhere. The matrix editor (light and dark) has 3 pending changes: user.delete and role.update added, content.delete_article removed.
2. Password expiry stays at 90 days. “needs API” tags on the expiring card and on the users list Status column. Security adds “Passwords expire every 90 days.”
3. Account expiry: no screen showed it, so nothing was removed. Only password expiry appears.
4. User forms list only roles the viewer can grant, with a helper line. The superuser switch is tagged “visible to superusers only”. New: create form as a manager.
5. New: Sign out everywhere confirmation (“You’ll be signed out on this device too.”) and Sign in with “You’ve been signed out everywhere.”
6. Role distribution footnote added.
7. Recent sign-ins shows the last 10, newest first, with relative times and the full date on hover.
8. Trees show a child group: Support under Operational, Articles under Content.
9. New: unverified user detail with “Resend verification email” and its toast.
10. Removed “Unauthorized – signed out”.
11. Avatars stay initials only. There were no upload controls to remove.
