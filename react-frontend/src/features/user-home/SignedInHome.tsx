import DashboardOverview from '@/features/dashboard/DashboardOverview';
import { usePermissions } from '@/hooks/usePermissions';
import { hasAccessManagement } from './access';
import UserHome from './UserHome';

/**
 * Where a signed-in person lands. Admin and manager keep the dashboard.
 * A user with no access-management permission sees User home.
 */
export default function SignedInHome() {
  const { hasPermission } = usePermissions();
  if (!hasAccessManagement(hasPermission)) {
    return <UserHome />;
  }
  return <DashboardOverview />;
}
