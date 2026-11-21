import { useId, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Smartphone, createLucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SIGNED_OUT_EVERYWHERE_NOTICE } from '@/features/auth/notices';
import { ACCOUNT_SETTINGS_PATH } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { User } from '@/models/user';
import { displayName, initials } from '@/components/layout/viewer';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutAllUser } from '@/store/slices/authSlice';
import {
  accountSummary,
  expiryStatus,
  formatUtcDate,
  greeting,
  groupPermissions,
  passwordAge,
  roleNames,
} from './summary';

const PasswordKey = createLucideIcon('password-key', [
  ['circle', { cx: '7.5', cy: '15.5', r: '5.5', key: 'ring' }],
  ['path', { d: 'm21 2-9.6 9.6', key: 'shaft' }],
  ['path', { d: 'm15.5 7.5 3 3L22 7l-3-3', key: 'teeth' }],
]);

function permissionCodes(user: User): string[] {
  const raw = (user.permissions ?? []) as readonly (
    string | { name?: string }
  )[];
  const codes = raw.map((entry) =>
    typeof entry === 'string' ? entry : (entry.name ?? '')
  );
  return [...new Set(codes.filter(Boolean))];
}

function Panel({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-card p-6',
        className
      )}
    >
      <div>
        <h2 id={titleId} className="text-base leading-snug font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** The plain user's home: their account, not the admin dashboard. */
export default function UserHome() {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!user) {
    return null;
  }

  const now = new Date();
  const codes = permissionCodes(user);
  const names = roleNames(user.roles);
  const expiry = expiryStatus(user.password_expires_at, now);
  const age = passwordAge(user.last_changed_password_date, now);
  const groups = groupPermissions(codes);

  async function signOutEverywhere() {
    const revoked = await dispatch(logoutAllUser()).unwrap();
    navigate(
      revoked ? `/login?notice=${SIGNED_OUT_EVERYWHERE_NOTICE}` : '/login',
      { replace: true }
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 lg:gap-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight lg:text-[26px]">
          {greeting(user.first_name ?? '', now)}
        </h1>
        <p className="mt-1.5 text-sm leading-normal text-foreground-secondary">
          {accountSummary(names, codes.length, expiry?.sentence ?? null)}
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start lg:gap-5">
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <Panel title="Profile" className="order-3 lg:order-none">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[21px] font-semibold tracking-wide text-sidebar-accent-foreground"
              >
                {initials(user)}
              </span>
              <div className="min-w-0">
                <div className="text-base font-semibold">
                  {displayName(user)}
                </div>
                <div className="text-sm break-all text-foreground-secondary">
                  {user.email}
                </div>
              </div>
            </div>
            <Link
              to={ACCOUNT_SETTINGS_PATH}
              className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Edit profile
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </Panel>

          <Panel title="Quick actions" className="order-2 lg:order-none">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap">
              <Button
                asChild
                className="h-10 w-full justify-center lg:h-9 lg:w-auto"
              >
                <Link to="/dashboard/change-password">
                  <PasswordKey aria-hidden="true" />
                  Change password
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-center lg:h-9 lg:w-auto"
                onClick={() => setConfirmOpen(true)}
              >
                <Smartphone aria-hidden="true" />
                Sign out everywhere
              </Button>
            </div>
            <p className="text-[13px] leading-snug text-muted-foreground">
              Signing out everywhere ends your sessions on every device,
              including this one.
            </p>
          </Panel>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <Panel title="Security status" className="order-1 lg:order-none">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
              {age ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[13px] text-muted-foreground">
                    Password age
                  </dt>
                  <dd className="text-sm">{age}</dd>
                </div>
              ) : null}
              {expiry ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[13px] text-muted-foreground">Expires</dt>
                  <dd className="flex flex-wrap items-center gap-1.5 text-sm">
                    {expiry.date}
                    <span
                      className={cn(
                        'inline-flex h-[22px] items-center rounded-md px-2 text-xs font-medium',
                        expiry.warn
                          ? 'bg-status-warning text-status-warning-foreground'
                          : 'text-foreground-secondary'
                      )}
                    >
                      {expiry.label}
                    </span>
                  </dd>
                </div>
              ) : null}
              <div className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-muted-foreground">Email</dt>
                <dd>
                  <StatusBadge
                    status={user.verified ? 'verified' : 'pending'}
                  />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-muted-foreground">
                  Last password change
                </dt>
                <dd className="text-sm">
                  {user.last_changed_password_date
                    ? formatUtcDate(user.last_changed_password_date)
                    : 'Not recorded'}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Your roles and permissions"
            description="What you can do in FastAPI RBAC"
            className="order-4 lg:order-none"
          >
            {names.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {names.map((name) => (
                  <span
                    key={name}
                    className="inline-flex h-[22px] items-center rounded-md bg-sidebar-accent px-2 text-xs font-medium text-sidebar-accent-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : null}
            <div>
              {groups.map((group) => (
                <div
                  key={group.name}
                  role="group"
                  aria-label={group.name}
                  className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="text-[13px] text-foreground-secondary"
                  >
                    {group.name}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.codes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex h-[22px] items-center rounded-md border px-2 font-mono text-xs font-medium text-foreground-secondary"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign out everywhere?"
        description="You’ll be signed out on this device too."
        confirmLabel="Sign out everywhere"
        onConfirm={signOutEverywhere}
      />
    </div>
  );
}
