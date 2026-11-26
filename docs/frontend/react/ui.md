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

- **Sidebar.** `AppSidebar` shows the FastAPI RBAC logo and the nav grouped into Overview, Access and You. The items, their routes and the permission each needs are defined in [`react-frontend/src/lib/navigation.ts`](../../../react-frontend/src/lib/navigation.ts), the source of truth. `buildNavGroups` shows an item only when the viewer holds the read permission its route guard checks, hides the rest rather than disabling them, and drops any group left empty. A viewer with no Access items is a plain user, whose Overview item is Home instead of Dashboard (see [Landing page](#landing-page-dashboard-or-user-home)). The page on screen is highlighted (`aria-current="page"`) and named in the header breadcrumb. A detail page can add its own name as the last step with `usePageCrumb` from [`pageCrumb.ts`](../../../react-frontend/src/components/layout/pageCrumb.ts): role detail shows `Access › Roles › Manager`, and Roles becomes a link back to the list.
- **Collapse and drawer.** On desktop the header button collapses the sidebar to icons with tooltips; the choice is remembered in this browser. Below the `lg` breakpoint the sidebar is a drawer, opened by the header's **Open menu** button, that sits on the sidebar surface and shows who is signed in at its foot.
- **User menu.** `UserMenu` is the header's Radix dropdown: initials avatar, name and role chip on the trigger; name and email, Account settings, a light/dark/system theme switch, Sign out, and Sign out everywhere inside. It closes on Escape or an outside click and returns focus to its trigger. Sign out everywhere asks first with the shared `ConfirmDialog` ("You’ll be signed out on this device too."), then lands on Sign in, which shows "You’ve been signed out everywhere." only when the server revoked every session. The menu and User home share that rule through `useSignOutEverywhere()` (`src/features/auth/useSignOutEverywhere.ts`). Sign-out actions are never in the sidebar.
- **Links.** Every sidebar and menu link must target a route in `App.tsx`. `src/test/AppShell.test.tsx` checks this against the exported `appRoutes`, so add the route before the nav item.

## Landing page: Dashboard or User home

`/dashboard` renders `SignedInHome` (`src/features/user-home/SignedInHome.tsx`), which picks the page by the same rule as the sidebar. `hasAccessManagement()` (`src/features/user-home/access.ts`) is true when `buildNavGroups` gives the viewer an Access group, that is, when they hold the read permission for at least one Access item:

- **Access group present** (admin, manager): the Dashboard overview.
- **No Access group** (plain user): **User home** (`src/features/user-home/UserHome.tsx`), drawn from the `home-user` and `home-user-mobile` artboards in `react-frontend/design/web-v1/`. It has four panels:
  - **Profile**: initials, name, email and an **Edit profile** link to Account settings.
  - **Quick actions**: **Change password**, and **Sign out everywhere**, which asks with the same `ConfirmDialog` as the user menu.
  - **Security status**: password age, the expiry date once the API sends `password_expires_at`, email verification and the last password change.
  - **Your roles and permissions**: role chips, and the viewer's permission codes grouped by permission group in seed order.

On desktop (`lg` and up) the panels sit in two columns, Profile and Quick actions on the left, Security status and Roles on the right. Below `lg` they stack as Security status, Quick actions, Profile, Roles. The page renders the panels in the DOM in the order shown at each width, so keyboard and screen-reader order match what is on screen (WCAG 2.4.3). Do not reorder them with CSS `order`.

## Lists

The users list (`src/features/users/UsersList.tsx`, from the "05 · Users · List" artboards) is the first list on the Web v1 pattern:

- **Table.** `DataTable` (`src/components/dashboard/users/data-table.tsx`) draws the table only: header, rows, an optional row click and a footer slot. The page passes in the rows to show and the column visibility, and owns search, filters, the column picker and pagination. A row click opens the row's detail page; clicks on links, buttons and the row's "…" menu keep their own behavior.
- **Row menu.** `RowActionsMenu` gets only the actions the viewer can use, and destructive ones are confirmed with `ConfirmDialog`. The API deletes only a user who holds no role, so for a role holder the delete dialog says the roles must be removed first and offers Edit user; a viewer without `user.update` gets no Delete for a role holder.
- **Status.** The status column shows `StatusBadge` for exceptions only, so a healthy row has an empty cell.
- **Empty and no-match states.** Both use `EmptyState`: "No users match ‘xyz’" with Clear search, and a create action on an empty list only for viewers who can create.
- **Status filter in the URL.** The users list reads and writes `?status=`, so other pages can link to a filtered list. The accepted values are `STATUS_FILTERS` in `src/features/users/users-list-model.ts`, matched in any case by `parseStatusFilter`; any other value shows everyone.
- **Mobile.** Below the `md` breakpoint the list renders as stacked rows instead of the table.

`GET /users/list` takes only `page` and `size`, so the users list loads one page of `USERS_FETCH_LIMIT` users (`src/features/users/UsersList.tsx`, the API's largest page size) and searches, filters and pages it in the browser. When the API reports more, the page says search covers the loaded users only. Sorting is not offered: the Web v1 artboards have none, and the list keeps the API's order.

## Group trees

Role groups and permission groups share one module, `src/features/groups/`, built to the "07 · Groups" artboards:

- **Tree.** `GroupTree` renders groups as an expandable table: Name, Parent, Members, Created and the shared "…" `RowActionsMenu`. An open group lists its child groups first, then its members (roles with their user counts, or permission codes with their descriptions). Each group has a count chip such as "1 role · 1 group", and guide lines join each child group and member to the group above it. Columns have fixed widths from the artboards (Parent 160px, Members 140px for role groups and 181px for permission groups, Created 150px, Actions 64px) so they do not shift as rows open, and a count too long for its column wraps. Every group has a chevron, an empty one too. The first top-level group and every top-level group that holds child groups start open; child groups start closed, as the artboards draw them. Groups keep the order the page gives them: role groups as the API returns them (by name), permission groups oldest first, which is the seed's order. Role groups use the sidebar's folder-tree icon with a shield-check for each role. Permission groups use the layers icon with the permission key. The toolbar has search, which keeps the path to each match, and Expand all / Collapse all. An empty tree shows the shared `EmptyState`, and a search with no match shows it with the term in single quotes, as the Users list does. Each page passes only the menu actions the viewer holds the permission for.
- **Data.** Each page maps its service response into flat records joined by parent id (`treeModel.ts`). Role groups come nested from `GET /role-groups`, and their roles come from `GET /roles` by `role_group_id`, read page by page so every role is counted. Until the roles arrive, each group's count chip is a loading placeholder, never a count without them. If only the roles fail to load, the tree stays, the chips show a dash, and a separate notice offers **Try again** for the roles. Permission groups come flat from `GET /permission-groups`, with their permissions. `buildGroupTree` nests them, keeps the order of the flat list for roots and siblings, and makes a group whose parent is missing or on a cycle a root. Both pages request one page of 100 groups, the API's page maximum. If the groups fail to load, the page shows the error with **Try again** instead of the first-run empty state. The count chip always shows the whole group, even while a search trims its rows.
- **Form.** `GroupForm` is the create and edit form for both kinds: Name, and `ParentGroupSelect`, a searchable combobox of "No parent" and the other groups, with a bordered search field. On edit it leaves out the group itself and its descendants. A parent missing from the list shows as "Unknown group", and the form doesn't open if the group list fails to load. Moving a group to another parent is done here. The form is laid out as `groups-form.dc.html` draws it: left-aligned, with a 640px card and Cancel and Save in a footer bar that spans the page and sticks to the bottom of the window.

## Accessibility

Use Radix-backed ShadCN controls for focus management and keyboard behavior. Keep labels associated with inputs; do not remove accessible attributes when wrapping primitives.
