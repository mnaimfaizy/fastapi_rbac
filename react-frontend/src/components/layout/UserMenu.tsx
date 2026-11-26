import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import {
  ChevronDown,
  CircleUser,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Smartphone,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useThemePreference, type ThemePreference } from '@/lib/theme';
import { ACCOUNT_SETTINGS_PATH } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { User } from '@/models/user';
import { useSignOutEverywhere } from '@/features/auth/useSignOutEverywhere';
import { useAppDispatch } from '../../store/hooks';
import { logoutUser } from '../../store/slices/authSlice';
import { displayName, initials, roleLabel } from './viewer';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
  { value: 'system', label: 'System theme', icon: Monitor },
];

export function UserAvatar({
  user,
  size = 'md',
}: {
  user: User;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-sidebar-accent font-semibold leading-none tracking-wide text-sidebar-accent-foreground',
        size === 'lg' ? 'size-9 text-sm' : 'size-8 text-xs'
      )}
    >
      {initials(user)}
    </span>
  );
}

export function RoleChip({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const label = roleLabel(user);
  if (!label) {
    return null;
  }
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center whitespace-nowrap rounded-md border px-2 text-xs font-medium text-foreground-secondary',
        className
      )}
    >
      {label}
    </span>
  );
}

/**
 * The Sign out everywhere confirmation, shared by the user menu, User home
 * and the Security tab of Account settings, as the
 * `account-security-signout` artboard draws it. Confirming ends every
 * session, this one included, and lands on Sign in.
 */
export function SignOutEverywhereDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The redirect rule lives in useSignOutEverywhere.
  const signOutEverywhere = useSignOutEverywhere();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sign out everywhere?"
      icon={<Smartphone />}
      description={
        <>
          <span className="block">
            This ends your sessions on every device and browser where you’re
            signed in.
          </span>
          <span className="mt-3 block">
            You’ll be signed out on this device too, and you’ll need to sign in
            again.
          </span>
        </>
      }
      confirmLabel="Sign out everywhere"
      onConfirm={signOutEverywhere}
    />
  );
}

/**
 * The header user menu: who is signed in, Account settings, a quick theme
 * switch, Sign out, and Sign out everywhere behind a confirmation.
 *
 * Built on the Radix dropdown, so it opens on click, closes on Escape or
 * an outside click, supports arrow keys, and returns focus to its trigger.
 */
export function UserMenu({ user }: { user: User }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { preference, setPreference } = useThemePreference();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = displayName(user);

  async function signOut() {
    await dispatch(logoutUser());
    navigate('/login');
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account menu for ${name}`}
          className="flex h-11 shrink-0 items-center gap-2.5 rounded-[10px] px-1.5 text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent sm:pr-2"
        >
          <UserAvatar user={user} />
          <span className="hidden text-sm font-medium sm:inline">{name}</span>
          <RoleChip user={user} className="hidden sm:inline-flex" />
          <ChevronDown
            aria-hidden="true"
            className="hidden size-4 text-muted-foreground sm:block"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[300px] rounded-[10px] p-1"
        >
          <div className="flex items-center gap-2.5 px-2.5 pt-2.5 pb-3">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{name}</div>
              <div className="truncate text-[13px] text-muted-foreground">
                {user.email}
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            asChild
            className="min-h-9 gap-2.5 px-2.5 font-medium"
          >
            <Link to={ACCOUNT_SETTINGS_PATH}>
              <CircleUser aria-hidden="true" />
              Account settings
            </Link>
          </DropdownMenuItem>
          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <Palette
                aria-hidden="true"
                className="size-4 text-foreground-secondary"
              />
              Appearance
            </span>
            <DropdownMenuPrimitive.RadioGroup
              aria-label="Theme"
              value={preference}
              onValueChange={(value) => setPreference(value as ThemePreference)}
              className="flex w-28 gap-0.5 rounded-lg bg-muted p-0.5"
            >
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <DropdownMenuPrimitive.RadioItem
                  key={value}
                  value={value}
                  aria-label={label}
                  // Keep the menu open so the person sees the change.
                  onSelect={(event) => event.preventDefault()}
                  className="flex h-8 flex-1 cursor-default items-center justify-center rounded-md text-muted-foreground outline-none data-[highlighted]:ring-2 data-[highlighted]:ring-ring data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm"
                >
                  <Icon aria-hidden="true" className="size-4" />
                </DropdownMenuPrimitive.RadioItem>
              ))}
            </DropdownMenuPrimitive.RadioGroup>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-9 gap-2.5 px-2.5 font-medium"
            onSelect={() => void signOut()}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-9 items-start gap-2.5 px-2.5 font-medium"
            onSelect={() => setConfirmOpen(true)}
          >
            <Smartphone aria-hidden="true" className="mt-px" />
            <span>
              Sign out everywhere
              <span className="mt-0.5 block text-xs leading-snug font-normal text-muted-foreground">
                Ends your sessions on every device, including this one.
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutEverywhereDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      />
    </>
  );
}
