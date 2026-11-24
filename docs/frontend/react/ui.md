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
- **User menu.** `UserMenu` is the header's Radix dropdown: initials avatar, name and role chip on the trigger; name and email, Account settings, a light/dark/system theme switch, Sign out, and Sign out everywhere inside. It closes on Escape or an outside click and returns focus to its trigger. Sign out everywhere asks first with `SignOutEverywhereDialog` (exported from `UserMenu.tsx`): the shared `ConfirmDialog` with a phone icon, saying the sessions end on every device and browser and "You’ll be signed out on this device too, and you’ll need to sign in again." It then lands on Sign in, which shows "You’ve been signed out everywhere." only when the server revoked every session; that rule lives in `useSignOutEverywhere()` (`src/features/auth/useSignOutEverywhere.ts`). The menu, User home and the Security tab of Account settings all open the same dialog. Sign-out actions live here, on User home and on the Security tab of Account settings, never in the sidebar.
- **Account settings.** One page, `src/features/account/`, from the "09 · Account settings" artboards, with a URL per tab: `/dashboard/account/profile`, `/dashboard/account/security` and `/dashboard/account/appearance` (`/dashboard/account` opens Profile). The old `/dashboard/profile` and `/dashboard/change-password` redirect to the Profile and Security tabs. Profile edits first name, last name and phone through `PUT /users/me`, shows the email read-only, and updates the header name on save. Security holds the change-password form (`ChangePasswordForm`, with the live password checklist), the password status ("Passwords expire every 90 days.") and Sign out everywhere, which opens the same `SignOutEverywhereDialog` as the user menu. Appearance picks Light, Dark or System from preview cards through `useThemePreference()`.
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

## Accessibility

Use Radix-backed ShadCN controls for focus management and keyboard behavior. Keep labels associated with inputs; do not remove accessible attributes when wrapping primitives.
