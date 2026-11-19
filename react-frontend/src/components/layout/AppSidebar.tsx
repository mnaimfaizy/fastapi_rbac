import { Link, useLocation } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  findActiveNavItem,
  type NavGroup,
  type NavItem,
} from '@/lib/navigation';
import { BrandLockup, BrandMark } from './BrandLogo';

interface AppSidebarProps {
  groups: NavGroup[];
  /** Icons only, each with a tooltip. Desktop only. */
  collapsed?: boolean;
  /** Runs when a link is chosen, so the mobile drawer can close. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * The grouped, permission-filtered sidebar: Overview, Access and You.
 * The caller builds `groups` for the viewer (see `buildNavGroups`).
 */
export function AppSidebar({
  groups,
  collapsed = false,
  onNavigate,
  className,
}: AppSidebarProps) {
  const { pathname } = useLocation();
  const active = findActiveNavItem(groups, pathname)?.item;

  return (
    <nav
      aria-label="Main"
      className={cn(
        'flex flex-col bg-sidebar text-sidebar-foreground',
        collapsed ? 'items-center gap-[18px] py-3.5' : 'gap-5 px-3 py-4',
        className
      )}
    >
      {collapsed ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BrandMark className="size-5" />
        </div>
      ) : (
        <div className="flex h-8 items-center px-2">
          <BrandLockup />
        </div>
      )}

      {groups.map((group) => (
        <div
          key={group.label}
          role="group"
          aria-label={group.label}
          className={cn(
            'flex flex-col',
            collapsed
              ? 'w-10 items-center gap-1 border-t border-sidebar-border pt-1.5'
              : 'gap-0.5'
          )}
        >
          {!collapsed && (
            <div
              aria-hidden="true"
              className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground"
            >
              {group.label}
            </div>
          )}
          {group.items.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              current={item === active}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarLink({
  item,
  current,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  current: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        collapsed ? 'size-10 justify-center' : 'h-9 gap-2.5 px-2.5',
        current
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-foreground-secondary hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon
        aria-hidden="true"
        className="size-[18px] shrink-0"
        strokeWidth={1.75}
      />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  if (!collapsed) {
    return link;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}
