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

- **Sidebar.** `AppSidebar` shows the FastAPI RBAC logo and three groups: **Overview** (Dashboard, or Home for a plain user), **Access** (Users, Roles, Role groups, Permissions, Permission groups) and **You** (Account settings). The nav model is `src/lib/navigation.ts`: each item names the read permission the route guard in `App.tsx` checks, and `buildNavGroups` drops the items the viewer lacks and any group left empty. Items are hidden, never disabled. The page on screen is highlighted (`aria-current="page"`) and named in the header breadcrumb.
- **Collapse and drawer.** On desktop the header button collapses the sidebar to icons with tooltips; the choice is remembered in this browser. Below the `lg` breakpoint the sidebar is a drawer, opened by the header's **Open menu** button, that sits on the sidebar surface and shows who is signed in at its foot.
- **User menu.** `UserMenu` is the header's Radix dropdown: initials avatar, name and role chip on the trigger; name and email, Account settings, a light/dark/system theme switch, Sign out, and Sign out everywhere inside. It closes on Escape or an outside click and returns focus to its trigger. Sign out everywhere asks first with the shared `ConfirmDialog` ("You’ll be signed out on this device too."), then lands on Sign in, which shows "You’ve been signed out everywhere." Sign-out actions live only here, never in the sidebar.
- **Links.** Every sidebar and menu link must target a route in `App.tsx`. `src/test/AppShell.test.tsx` checks this against the exported `appRoutes`, so add the route before the nav item.

## Accessibility

Use Radix-backed ShadCN controls for focus management and keyboard behavior. Keep labels associated with inputs; do not remove accessible attributes when wrapping primitives.
