import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { differenceInSeconds, format, formatDistance } from 'date-fns';
import { AlertCircle, Lock, ShieldCheck, UserCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchDashboardData } from '@/store/slices/dashboardSlice';
import { StatsCard } from '@/components/dashboard/stats-card';
import { EmptyState } from '@/components/common/EmptyState';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { RecentSignIn, RoleCount } from '@/models/dashboard';

const LOCKED_USERS_HREF = '/dashboard/users?status=Locked';
const ALL_USERS_HREF = '/dashboard/users';
const ROLE_DISTRIBUTION_FOOTNOTE =
  'Users with several roles are counted in each.';

function greeting(firstName?: string | null, lastName?: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(' ');
  const who = name ? `, ${name}` : '';
  return `Welcome back${who}. Here's the state of access today.`;
}

function groupLine(count: number, noun: string): string {
  const plural = count === 1 ? noun : `${noun}s`;
  return `In ${count.toLocaleString()} ${plural}`;
}

/** Relative sign-in time. The full date is the hover title, not this string. */
export function signInLabel(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const seconds = differenceInSeconds(now, then);
  if (seconds < 60) return 'Just now';
  if (seconds >= 86_400 && seconds < 172_800) return 'Yesterday';
  return formatDistance(then, now, { addSuffix: true });
}

export function signInTitle(iso: string): string {
  return format(new Date(iso), 'd MMM yyyy, HH:mm');
}

function initials(name: string): string {
  const letters = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return letters.slice(0, 2) || 'NA';
}

function percentOf(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  value: number | null | undefined;
  description?: string;
  icon?: LucideIcon;
  action?: { href: string; label: string };
}) {
  if (value == null) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            className="px-2 py-6"
            title="No data yet"
            description="This metric isn't available."
          />
        </CardContent>
      </Card>
    );
  }

  if (action) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {Icon ? <Icon className="text-muted-foreground h-4 w-4" /> : null}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <Link
            to={action.href}
            className="text-primary mt-1 inline-block text-xs underline-offset-4 hover:underline"
          >
            {action.label}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <StatsCard
      title={title}
      value={value.toLocaleString()}
      description={description}
      icon={Icon}
    />
  );
}

function RoleDistribution({ rows }: { rows: RoleCount[] | null | undefined }) {
  const shares = rows ?? [];
  const total = shares.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card className="col-span-full lg:col-span-8">
      <CardHeader>
        <CardTitle>Role distribution</CardTitle>
        <CardDescription>Users per role</CardDescription>
      </CardHeader>
      <CardContent>
        {rows == null || shares.length === 0 ? (
          <EmptyState
            title="No role distribution"
            description="Counts appear when people hold roles."
          />
        ) : (
          <div className="space-y-4">
            <ul className="space-y-3">
              {shares.map((row) => {
                const percent = percentOf(row.count, total);
                return (
                  <li key={row.name} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-muted-foreground">
                        {row.count.toLocaleString()} {percent}%
                      </span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground text-xs">
              {ROLE_DISTRIBUTION_FOOTNOTE}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentSignIns({ rows }: { rows: RecentSignIn[] | null | undefined }) {
  return (
    <Card className="col-span-full lg:col-span-4">
      <CardHeader>
        <CardTitle>Recent sign-ins</CardTitle>
        <CardDescription>Last 10, newest first</CardDescription>
      </CardHeader>
      <CardContent>
        {rows == null || rows.length === 0 ? (
          <EmptyState
            title="No recent sign-ins"
            description="Successful sign-ins show up here."
          />
        ) : (
          <div className="space-y-4">
            <ul className="space-y-4">
              {rows.map((signIn) => (
                <li
                  key={`${signIn.id}-${signIn.signed_in_at}`}
                  className="flex items-center gap-4"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials(signIn.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm leading-none font-medium">
                      {signIn.name}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {signIn.email}
                    </p>
                  </div>
                  <time
                    className="text-muted-foreground text-xs whitespace-nowrap"
                    dateTime={signIn.signed_in_at}
                    title={signInTitle(signIn.signed_in_at)}
                  >
                    {signInLabel(signIn.signed_in_at)}
                  </time>
                </li>
              ))}
            </ul>
            <Link
              to={ALL_USERS_HREF}
              className="text-primary text-sm underline-offset-4 hover:underline"
            >
              View all users
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DashboardOverview = () => {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.dashboard);
  const currentUser = useAppSelector((state) => state.auth.user);
  const { hasRole } = usePermissions();
  const isAdmin = hasRole('admin') || !!currentUser?.is_superuser;

  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-lg">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="my-4 rounded-lg bg-red-100 p-4 text-sm text-red-700 dark:bg-red-200 dark:text-red-800"
        role="alert"
      >
        <div className="flex items-center">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span className="font-medium">Error:</span> {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-lg">No dashboard data available.</p>
      </div>
    );
  }

  const { stats, role_distribution, recent_sign_ins } = data;
  const inactive =
    stats.total_users != null && stats.active_users != null
      ? stats.total_users - stats.active_users
      : null;

  return (
    <div className="space-y-6">
      <p className="text-lg">
        {greeting(currentUser?.first_name, currentUser?.last_name)}
      </p>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Total users"
          value={stats.total_users}
          description={
            inactive == null
              ? undefined
              : `${inactive.toLocaleString()} inactive`
          }
          icon={Users}
        />
        <MetricCard
          title="Active users"
          value={stats.active_users}
          description={
            stats.total_users == null
              ? undefined
              : `Of ${stats.total_users.toLocaleString()} total`
          }
          icon={UserCheck}
        />
        {isAdmin ? (
          <MetricCard
            title="Roles"
            value={stats.total_roles}
            description={
              stats.total_role_groups == null
                ? undefined
                : groupLine(stats.total_role_groups, 'role group')
            }
            icon={ShieldCheck}
          />
        ) : null}
        {isAdmin ? (
          <MetricCard
            title="Permissions"
            value={stats.total_permissions}
            description={
              stats.total_permission_groups == null
                ? undefined
                : groupLine(stats.total_permission_groups, 'permission group')
            }
            icon={Lock}
          />
        ) : null}
        <MetricCard
          title="Locked accounts"
          value={stats.locked_users}
          icon={Lock}
          action={{ href: LOCKED_USERS_HREF, label: 'View locked users' }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <RoleDistribution rows={role_distribution} />
        <RecentSignIns rows={recent_sign_ins} />
      </div>
    </div>
  );
};

export default DashboardOverview;
