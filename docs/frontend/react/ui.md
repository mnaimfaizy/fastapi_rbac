# React UI components

The SPA uses **ShadCN UI** (New York style) on **Tailwind CSS**, with Radix primitives and Lucide icons.

Related: [Architecture](./architecture.md), [Setup](./setup.md).

## Configuration

`react-frontend/components.json` configures ShadCN:

- Style: `new-york`
- TSX: enabled
- CSS variables: enabled (`src/index.css`)
- Aliases: `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`

## Where components live

| Path | Role |
| --- | --- |
| `src/components/ui/` | Generated / shared ShadCN primitives (button, dialog, table, …) |
| `src/components/common/` | Shared building blocks composed from `ui/`: status badge, page header, row "…" menu, confirm dialog, empty state, skeletons, and the theme provider |
| `src/components/layout/` | The app shell (`MainLayout`, `AppSidebar`, `UserMenu`, `BrandLogo`), `AuthLayout` and route protection |
| `src/components/auth/` | Shared auth UI pieces |
| `src/features/*/…` | Feature-specific screens and forms |

Prefer composing feature UI from `ui/` primitives. Promote to `components/` only when reused across features.

## Adding a ShadCN component

From `react-frontend/`, use the project’s ShadCN workflow (CLI / copy pattern consistent with existing `components/ui` files). Keep naming lowercase with hyphens to match the current library.

## Forms and validation

Typical stack in this repo:

- `react-hook-form` for form state
- `zod` resolvers for schema validation
- ShadCN form / input primitives for presentation

Align client validation with backend Pydantic rules where practical; backend remains authoritative.

## Styling

- Utility classes via Tailwind
- Shared helpers such as `cn()` in `src/lib/utils.ts`
- Prefer existing design tokens / CSS variables over one-off colors

## Design tokens and theme

- **Tokens.** `src/index.css` maps the Web v1 palette onto the shadcn CSS variables, with one block for light (`:root`) and one for dark (`.dark`). It also adds a few tokens beside the stock set: status pairs for badges, danger text, the dialog overlay, the auth panel and secondary text. The values come from the "01 · Foundations" artboard in `react-frontend/design/web-v1/`. Components use these tokens through Tailwind classes such as `bg-primary` or `text-status-danger-foreground`, never literal colors. To rebrand a fork, change the token values.
- **Theme.** `ThemeProvider` (`src/components/common/ThemeProvider.tsx`, built on `next-themes`) is mounted in `src/main.tsx`. It toggles the `.dark` class, follows the system setting by default and remembers the choice per browser. To read or change the theme, use `useThemePreference()` from `src/lib/theme.ts`. `react-frontend/public/theme-init.js`, loaded from `index.html` ahead of the app bundle, applies the theme before the first paint. It hard-codes the same storage key (`fastapi-rbac-theme`) and default (`system`) as `ThemeProvider`, so change both together. `src/test/themeInit.test.ts` checks that the keys match.
- **Fonts.** Inter (interface) and JetBrains Mono (codes and IDs, via `font-mono`) come from packaged `@fontsource-variable` fonts imported once in `src/main.tsx`. The nginx CSP allows only self-hosted fonts.

## App shell

Every signed-in page renders inside `MainLayout` (`src/components/layout/`), the Web v1 shell from the "03 · Shell" artboards:

- **Sidebar.** `AppSidebar` shows the FastAPI RBAC logo and the nav grouped into Overview, Access and You. The items, their routes and the permission each needs are defined in [`react-frontend/src/lib/navigation.ts`](../../../react-frontend/src/lib/navigation.ts), the source of truth. `buildNavGroups` shows an item only when the viewer holds the read permission its route guard checks, hides the rest rather than disabling them, and drops any group left empty. A viewer with no Access items is a plain user, whose Overview item is Home instead of Dashboard (see [Landing page](#landing-page-dashboard-or-user-home)). The page on screen is highlighted (`aria-current="page"`) and named in the header breadcrumb. A page can add its own steps after the nav item with `usePageCrumb` from [`pageCrumb.ts`](../../../react-frontend/src/components/layout/pageCrumb.ts), as one label or a trail: role detail calls `usePageCrumb(role.name)` and shows `Access › Roles › Manager`, Account settings names its tab (`You › Account settings › Profile`), and an edit page passes `[name, 'Edit']` for `Access › Roles › Manager › Edit`. The nav item then becomes a link back to its list, and blank labels (a name still loading) are left out. A page no nav item matches, such as the in-app 404, shows only its own steps: `usePageCrumb('Not found')` draws the single `Not found` step of `sys-404.dc.html`, and the shell shows no breadcrumb when such a page names none. The browser tab title follows the same steps, most specific first, then the nav item: `Manager · Roles | FastAPI RBAC`. A fixed sub-page that names no steps (`/dashboard/roles/new`) takes its name from `SUB_PAGE_TITLES` in [`usePageMeta.ts`](../../../react-frontend/src/hooks/usePageMeta.ts) (`Create role · Roles`), the landing page is titled with its nav label, Dashboard or Home, a page the viewer's route guard refuses is titled `Unauthorized` rather than named (the nav hides what the viewer cannot use, so the title must not name it), and a page outside the nav is titled by its own steps (`Not found | FastAPI RBAC`). Each `SUB_PAGE_TITLES` entry carries the permission its route guard in `App.tsx` asks for; keep the two in step. Such a sub-page is judged by that permission alone, so a viewer with `user.create` but not `user.read` still reads `Add user · Users`.
- **Collapse and drawer.** On desktop the header button collapses the sidebar to icons with tooltips; the choice is remembered in this browser. Below the `lg` breakpoint the sidebar is a drawer, opened by the header's **Open menu** button, that sits on the sidebar surface and shows who is signed in at its foot.
- **User menu.** `UserMenu` is the header's Radix dropdown: initials avatar, name and role chip on the trigger; name and email, Account settings, a light/dark/system theme switch, Sign out, and Sign out everywhere inside. It closes on Escape or an outside click and returns focus to its trigger. Sign out everywhere asks first with `SignOutEverywhereDialog` (exported from `UserMenu.tsx`): the shared `ConfirmDialog` with a phone icon, saying the sessions end on every device and browser and "You’ll be signed out on this device too, and you’ll need to sign in again." It then lands on Sign in, which shows "You’ve been signed out everywhere." only when the server revoked every session; that rule lives in `useSignOutEverywhere()` (`src/features/auth/useSignOutEverywhere.ts`). The menu, User home and the Security tab of Account settings all open the same dialog. Sign-out actions live here, on User home and on the Security tab of Account settings, never in the sidebar.
- **Account settings.** One page, `src/features/account/`, from the "09 · Account settings" artboards, with a URL per tab: `/dashboard/account/profile`, `/dashboard/account/security` and `/dashboard/account/appearance` (`/dashboard/account` opens Profile). The old `/dashboard/profile` and `/dashboard/change-password` redirect to the Profile and Security tabs. Profile edits first name, last name and phone through `PUT /users/me`, shows the email read-only, and updates the header name on save. Security holds the change-password form (`ChangePasswordForm`, with the live password checklist), the password status ("Passwords expire every 90 days.") and Sign out everywhere, which opens the same `SignOutEverywhereDialog` as the user menu. Appearance picks Light, Dark or System from preview cards through `useThemePreference()`.
- **404 and Unauthorized.** Neither strands a signed-in user outside the shell (`src/pages/`, from the "10 · System" artboards). An unknown URL renders `NotFoundPage` through `SystemStateLayout`, which wraps the `*` route in the shell for a signed-in user and in `AuthLayout` for a signed-out visitor. In the shell it names the missing path and offers **Go to dashboard** (**Go to home** for a plain user, matching their sidebar) and **Go back**, which goes home instead when the page was opened directly. Signed out it offers **Go to sign in**. When a permission-guarded route refuses the viewer, `ProtectedRoute` renders `UnauthorizedPage` in the refused page's place, with the first permission the viewer lacks (for a route that needs only one of several permissions, every alternative: "You need one of `a` or `b`…"); the copy comes from the permission code and the sidebar item for its resource: "You can’t edit roles", "You need `role.update` to edit roles.", and **Back to roles** when the viewer can read the list, otherwise a link home. `/unauthorized` is a protected route: generic copy in the shell, and Sign in for a signed-out visitor.
- **Links.** Every sidebar and menu link must target a route in `App.tsx`. `src/test/AppShell.test.tsx` checks this against the exported `appRoutes`, so add the route before the nav item.

## Landing page: Dashboard or User home

`/dashboard` renders `SignedInHome` (`src/features/user-home/SignedInHome.tsx`), which picks the page by the same rule as the sidebar. `hasAccessManagement()` (`src/features/user-home/access.ts`) is true when `buildNavGroups` gives the viewer an Access group, that is, when they hold the read permission for at least one Access item:

- **Access group present** (admin, manager): the Dashboard overview.
- **No Access group** (plain user): **User home** (`src/features/user-home/UserHome.tsx`), drawn from the `home-user` and `home-user-mobile` artboards in `react-frontend/design/web-v1/`. It has four panels:
  - **Profile**: initials, name, email and an **Edit profile** link to Account settings.
  - **Quick actions**: **Change password**, and **Sign out everywhere**, which opens the same `SignOutEverywhereDialog` as the user menu.
  - **Security status**: password age, the expiry date once the API sends `password_expires_at`, email verification and the last password change.
  - **Your roles and permissions**: role chips, and the viewer's permission codes grouped by permission group in seed order.

On desktop (`lg` and up) the panels sit in two columns, Profile and Quick actions on the left, Security status and Roles on the right. Below `lg` they stack as Security status, Quick actions, Profile, Roles. The page renders the panels in the DOM in the order shown at each width, so keyboard and screen-reader order match what is on screen (WCAG 2.4.3). Do not reorder them with CSS `order`.

## Lists

The users list (`src/features/users/UsersList.tsx`, from the "05 · Users · List" artboards) is the first list on the Web v1 pattern:

- **Table.** `DataTable` (`src/components/dashboard/users/data-table.tsx`) draws the table only: header, rows, an optional row click and a footer slot. The page passes in the rows to show and the column visibility, and owns search, filters, the column picker and pagination. A row click opens the row's detail page; clicks on links, buttons and the row's "…" menu keep their own behavior.
- **Row menu.** `RowActionsMenu` gets only the actions the viewer can use, and destructive ones are confirmed with `ConfirmDialog`. The API deletes only a user who holds no role, so for a role holder the delete dialog says the roles must be removed first and offers Edit user; Delete is offered for a role holder only to a viewer with `user.update` and `role.read` (who can remove the roles on the edit page), and never on the viewer's own row. Detail follows the same rule; see "User detail and forms".
- **Status.** The status column shows `StatusBadge` for exceptions only, so a healthy row has an empty cell.
- **Empty and no-match states.** Both use `EmptyState`: "No users match ‘xyz’" with Clear search, and a create action on an empty list only for viewers who can create.
- **Status filter in the URL.** The users list reads and writes `?status=`, so other pages can link to a filtered list. The accepted values are `STATUS_FILTERS` in `src/features/users/users-list-model.ts`, matched in any case by `parseStatusFilter`; any other value shows everyone.
- **Mobile.** Below the `md` breakpoint the list renders as stacked rows instead of the table.

`GET /users/list` takes only `page` and `size`, so the users list loads one page of `USERS_FETCH_LIMIT` users (`src/features/users/UsersList.tsx`, the API's largest page size) and searches, filters and pages it in the browser. When the API reports more, the page says search covers the loaded users only. Sorting is not offered: the Web v1 artboards have none, and the list keeps the API's order.

## User detail and forms

User detail (`src/features/users/UserDetailContent.tsx`) and the create and edit forms (`UserEditPage.tsx`, `UserEditForm.tsx`) follow the "05 · Users" detail, create, edit and delete artboards:

- **Detail.** Basic information, Password and security, Account status and Roles panels. The user read model names roles without their permissions, so each held role's permissions come from `GET /roles/list` (shown only to viewers with `role.read`), grouped by permission group; the role group's name needs `role_group.read`. **Edit user** is the secondary action and **Delete user** sits in the "…" menu. A Pending user's Account status has **Resend verification email**, which calls the public resend endpoint and always shows the same neutral toast, so it never reveals the account's state. There is no Unlock account control: the API has no way to unlock.
- **Delete.** List and detail share the dialog copy in `src/features/users/user-delete.tsx`. A user who holds no role gets "Delete user ‘Name’?" with what deleting does; a role holder gets "Remove Name’s roles first" and an **Edit user** button, because the API refuses to delete them. Detail offers that path only to a viewer with `user.update` and `role.read`, who can remove the roles there, and never on the viewer's own page.
- **Forms.** Identity, Password (create only, with `PasswordChecklist`), Access and Status, each a titled section, then a sticky footer with Cancel and Create user or Save changes (and "Unsaved changes" on edit). The Roles field lists only the roles the viewer may grant: every role for a superuser, otherwise roles whose permissions the viewer all holds (`grantableRoles` in `user-form-model.ts`, mirroring the backend's role-grant ceiling). Held roles the viewer can't grant are sent back unchanged on save. The superuser switch renders only for a superuser viewer, and the flag is never sent otherwise. On your own account the Active switch is replaced by a note and `is_active` is left out of the save, because the API refuses to let anyone disable themselves. `components/ui` has no switch, so the forms use `FormSwitch.tsx`.

## Group trees

Role groups and permission groups share one module, `src/features/groups/`, built to the "07 · Groups" artboards:

- **Tree.** `GroupTree` renders groups as an expandable table: Name, Parent, Members, Created and the shared "…" `RowActionsMenu`. An open group lists its child groups first, then its members (roles with their user counts, or permission codes with their descriptions). Each group has a count chip such as "1 role · 1 group", and guide lines join each child group and member to the group above it. Columns have fixed widths from the artboards (Parent 160px, Members 140px for role groups and 181px for permission groups, Created 150px, Actions 64px) so they do not shift as rows open, and a count too long for its column wraps. On a narrow window the table scrolls sideways rather than squeeze the Name column. Every group has a chevron, an empty one too. The first top-level group and every top-level group that holds child groups start open; child groups start closed, as the artboards draw them. Groups keep the order the page gives them: role groups as the API returns them (by name), permission groups oldest first, which is the seed's order. Role groups use the sidebar's folder-tree icon with a shield-check for each role. Permission groups use the layers icon with the permission key. The toolbar has search, which keeps the path to each match, and Expand all / Collapse all. An empty tree shows the shared `EmptyState`, and a search with no match shows it with the term in single quotes, as the Users list does. Each page passes only the menu actions the viewer holds the permission for.
- **Data.** Each page maps its service response into flat records joined by parent id (`treeModel.ts`). Role groups come nested from `GET /role-groups`, and their roles come from `GET /roles` by `role_group_id`, read page by page so every role is counted. Until the roles arrive, each group's count chip is a loading placeholder, never a count without them. If only the roles fail to load, the tree stays, the chips show a dash, and a separate notice offers **Try again** for the roles. Permission groups come flat from `GET /permission-groups`, with their permissions. `buildGroupTree` nests them, keeps the order of the flat list for roots and siblings, and makes a group whose parent is missing or on a cycle a root. Both pages request one page of 100 groups, the API's page maximum. If the groups fail to load, the page shows the error with **Try again** instead of the first-run empty state. The count chip always shows the whole group, even while a search trims its rows.
- **Form.** `GroupForm` is the create and edit form for both kinds: Name, and `ParentGroupSelect`, a searchable combobox of "No parent" and the other groups, with a bordered search field. On edit it leaves out the group itself and its descendants. A parent missing from the list shows as "Unknown group", and the form doesn't open if the group list fails to load. Moving a group to another parent is done here. The form is laid out as `groups-form.dc.html` draws it: left-aligned, with a 640px card and Cancel and Save in a footer bar that spans the page and sticks to the bottom of the window.

## Accessibility

Use Radix-backed ShadCN controls for focus management and keyboard behavior. Keep labels associated with inputs; do not remove accessible attributes when wrapping primitives.
