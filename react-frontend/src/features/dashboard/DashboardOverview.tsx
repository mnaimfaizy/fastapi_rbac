import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';
import { StatsCard } from '../../components/dashboard/stats-card';
import { OverviewChart } from '../../components/dashboard/overview-chart';
import {
  DataTable,
  DataTableColumn,
} from '../../components/dashboard/data-table';
import {
  Users,
  ShieldCheck,
  UserCheck,
  BarChart,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserSummaryForTable } from '@/models/dashboard';
import { RootState } from '@/store';

// Sample data for chart (can also come from API if needed, or be dynamic based on role)
const chartData = [
  { name: 'Jan', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Feb', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Mar', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Apr', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'May', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Jun', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Jul', total: Math.floor(Math.random() * 5000) + 1000 },
];

const userTableColumns: DataTableColumn<UserSummaryForTable>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'role',
    header: 'Role',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant={row.status === 'active' ? 'default' : 'outline'}
        className={cn(
          row.status === 'active' &&
            'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100',
          row.status !== 'active' &&
            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
        )}
      >
        {row.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'lastActive',
    header: 'Last Active',
  },
];

const DashboardOverview = () => {
  const dispatch = useAppDispatch();
  const {
    data: dashboardData,
    loading,
    error,
  } = useAppSelector((state: RootState) => state.dashboard);
  const currentUser = useAppSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  const hasRole = (roleName: string) =>
    !!currentUser?.roles?.some(
      (role) => role.name.toLowerCase() === roleName.toLowerCase()
    );
  const isAdmin = hasRole('admin');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-4 my-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800"
        role="alert"
      >
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="font-medium">Error:</span> {error}
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg">No dashboard data available.</p>
      </div>
    );
  }

  const { stats, recent_logins, system_users_summary } = dashboardData;

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight mb-6">
        Dashboard Overview
      </h2>

      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.total_users && stats.total_users > 0 && (
            <StatsCard
              title="Total Users"
              value={stats.total_users.toLocaleString()}
              description={isAdmin ? 'System wide' : 'Platform users'}
              icon={Users}
            />
          )}
          {isAdmin && stats.total_roles && stats.total_roles > 0 && (
            <StatsCard
              title="Total Roles"
              value={stats.total_roles.toLocaleString()}
              description="System wide"
              icon={UserCheck}
            />
          )}
          {isAdmin &&
            stats.total_permissions &&
            stats.total_permissions > 0 && (
              <StatsCard
                title="Total Permissions"
                value={stats.total_permissions.toLocaleString()}
                description="System wide"
                icon={ShieldCheck}
              />
            )}
          {stats.active_sessions && (
            <StatsCard
              title="Active Sessions"
              value={stats.active_sessions.toLocaleString()}
              description="Currently active"
              icon={BarChart}
            />
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-12">
          <div className="col-span-full lg:col-span-8">
            <OverviewChart
              title="User Activity Trends"
              description="Illustrative data"
              data={chartData}
            />
          </div>
          {isAdmin && recent_logins && recent_logins.length > 0 && (
            <Card className="col-span-full lg:col-span-4">
              <CardHeader>
                <CardTitle>Recent User Logins</CardTitle>
                <CardDescription>Last few users who logged in.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recent_logins.slice(0, 5).map((user) => (
                    <div key={user.id} className="flex items-center gap-4">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {user.name
                            ?.split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .toUpperCase() || 'N/A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <div className="ml-auto font-medium">
                        <Badge variant="outline">{user.lastActive}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {isAdmin && system_users_summary && system_users_summary.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold tracking-tight mb-4">
              System Users Overview
            </h3>
            <DataTable columns={userTableColumns} data={system_users_summary} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
