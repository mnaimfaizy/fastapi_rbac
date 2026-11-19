import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChevronRight, Menu, PanelLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Meta } from '@/components/common/Meta';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePermissions } from '@/hooks/usePermissions';
import { buildNavGroups, findActiveNavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { User } from '@/models/user';
import { useAppSelector } from '../../store/hooks';
import { AppSidebar } from './AppSidebar';
import { BrandLockup } from './BrandLogo';
import { RoleChip, UserAvatar, UserMenu } from './UserMenu';
import { displayName } from './viewer';

/** localStorage key that remembers a collapsed sidebar in this browser. */
export const SIDEBAR_COLLAPSED_KEY = 'fastapi-rbac-sidebar-collapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Storage can be blocked; the sidebar still works, it just forgets.
  }
}

const DRAWER_TITLE_ID = 'app-shell-drawer-title';

/**
 * The Web v1 app shell around every signed-in page: the grouped sidebar
 * (collapsible on desktop, a drawer on mobile), the header with its
 * breadcrumb and user menu, and the page in `<main>`.
 */
const MainLayout = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { hasPermission } = usePermissions();
  const { pathname } = useLocation();
  const metaInfo = usePageMeta();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Rebuild when the viewer changes; `hasPermission` reads the same user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => buildNavGroups(hasPermission), [user]);
  const active = findActiveNavItem(groups, pathname);

  function toggleCollapsed() {
    setCollapsed((current) => {
      writeCollapsed(!current);
      return !current;
    });
  }

  return (
    <>
      <Meta
        title={metaInfo.title}
        description={metaInfo.description}
        keywords={metaInfo.keywords}
      />
      <div className="flex min-h-screen bg-background text-foreground">
        <AppSidebar
          groups={groups}
          collapsed={collapsed}
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-sidebar-border lg:flex',
            collapsed ? 'w-[68px]' : 'w-64'
          )}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background pr-2 pl-1 lg:h-16 lg:pr-6 lg:pl-4">
            <div className="flex min-w-0 items-center gap-1 lg:gap-3">
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger
                  aria-label="Open menu"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                >
                  <Menu aria-hidden="true" className="size-5" />
                </SheetTrigger>
                <SheetContent
                  side="left"
                  aria-labelledby={DRAWER_TITLE_ID}
                  aria-describedby={undefined}
                  className="w-[300px] max-w-[85vw] gap-0 border-r-0 p-0 sm:max-w-[300px]"
                >
                  <h2 id={DRAWER_TITLE_ID} className="sr-only">
                    Main menu
                  </h2>
                  <AppSidebar
                    groups={groups}
                    onNavigate={() => setDrawerOpen(false)}
                    className="flex-1 overflow-y-auto"
                  />
                  {user && <DrawerAccount user={user} />}
                </SheetContent>
              </Sheet>

              <BrandLockup size="sm" className="lg:hidden" />

              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-foreground-secondary outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
              >
                <PanelLeft aria-hidden="true" className="size-4" />
              </button>
              <span
                aria-hidden="true"
                className="hidden h-5 w-px bg-border lg:block"
              />
              <Breadcrumb active={active} />
            </div>

            {user && <UserMenu user={user} />}
          </header>

          <main className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

function Breadcrumb({
  active,
}: {
  active: ReturnType<typeof findActiveNavItem>;
}) {
  if (!active) {
    return null;
  }
  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden items-center gap-1.5 text-sm whitespace-nowrap lg:flex"
    >
      {!active.item.standalone && (
        <>
          <span className="text-muted-foreground">{active.group.label}</span>
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
          />
        </>
      )}
      <span aria-current="page" className="font-medium text-foreground">
        {active.item.label}
      </span>
    </nav>
  );
}

/** Who is signed in, at the foot of the mobile drawer. */
function DrawerAccount({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-sidebar-border p-3">
      <UserAvatar user={user} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {displayName(user)}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {user.email}
        </div>
      </div>
      <RoleChip user={user} />
    </div>
  );
}

export default MainLayout;
