import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Settings,
  Lock,
  ShieldCheck,
  UserCheck,
  LogOut,
  User,
  KeyRound,
  Folder,
  FolderHeart,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { logoutUser } from '../../store/slices/authSlice';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean;
}

export function Sidebar({ className, isCollapsed = false }: SidebarProps) {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Use the updated logoutUser thunk that calls the backend API
    await dispatch(logoutUser());
    // Navigate will happen automatically after logout due to auth state change
    // but we keep it here as a fallback
    navigate('/login');
  };

  // Check if current path is active, considering nested routes
  const isActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') {
      return true;
    }
    if (path !== '/dashboard' && location.pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  return (
    <div className={cn('pb-12', className)}>
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <h2
            className={cn(
              'text-lg font-semibold tracking-tight',
              isCollapsed && 'text-center'
            )}
          >
            {!isCollapsed && 'Dashboard'}
          </h2>

          <div className={cn('space-y-1 pt-2')}>
            <Button
              variant={isActive('/dashboard') ? 'secondary' : 'ghost'}
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard">
                <LayoutDashboard
                  className={cn('h-5 w-5', !isCollapsed && 'mr-2')}
                />
                {!isCollapsed && 'Overview'}
              </Link>
            </Button>

            <Button
              variant={isActive('/dashboard/users') ? 'secondary' : 'ghost'}
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/users">
                <Users className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
                {!isCollapsed && 'Users'}
              </Link>
            </Button>

            <Button
              variant={isActive('/dashboard/roles') ? 'secondary' : 'ghost'}
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/roles">
                <UserCheck className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
                {!isCollapsed && 'Roles'}
              </Link>
            </Button>

            <Button
              variant={
                isActive('/dashboard/role-groups') ? 'secondary' : 'ghost'
              }
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/role-groups">
                <FolderHeart
                  className={cn('h-5 w-5', !isCollapsed && 'mr-2')}
                />
                {!isCollapsed && 'Role Groups'}
              </Link>
            </Button>

            <Button
              variant={
                isActive('/dashboard/permissions') ? 'secondary' : 'ghost'
              }
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/permissions">
                <ShieldCheck
                  className={cn('h-5 w-5', !isCollapsed && 'mr-2')}
                />
                {!isCollapsed && 'Permissions'}
              </Link>
            </Button>

            <Button
              variant={
                isActive('/dashboard/permission-groups') ? 'secondary' : 'ghost'
              }
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/permission-groups">
                <Folder className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
                {!isCollapsed && 'Permission Groups'}
              </Link>
            </Button>
          </div>
        </div>

        <div className="px-4 py-2">
          <h2
            className={cn(
              'text-lg font-semibold tracking-tight',
              isCollapsed && 'text-center'
            )}
          >
            {!isCollapsed && 'Account'}
          </h2>
          <div className="space-y-1 pt-2">
            <Button
              variant={isActive('/dashboard/profile') ? 'secondary' : 'ghost'}
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/profile">
                <User className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
                {!isCollapsed && 'Profile'}
              </Link>
            </Button>

            <Button
              variant={
                isActive('/dashboard/change-password') ? 'secondary' : 'ghost'
              }
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/change-password">
                <KeyRound className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
                {!isCollapsed && 'Change Password'}
              </Link>
            </Button>
          </div>
        </div>

        <div className="px-4 py-2">
          <h2
            className={cn(
              'text-lg font-semibold tracking-tight',
              isCollapsed && 'text-center'
            )}
          >
            {!isCollapsed && 'Settings'}
          </h2>
          <div className="space-y-1 pt-2">
            <Button
              variant={isActive('/dashboard/settings') ? 'secondary' : 'ghost'}
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/settings">
                <Settings className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
                {!isCollapsed && 'General'}
              </Link>
            </Button>

            <Button
              variant={isActive('/dashboard/security') ? 'secondary' : 'ghost'}
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center'
              )}
              asChild
            >
              <Link to="/dashboard/security">
                <Lock className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
                {!isCollapsed && 'Security'}
              </Link>
            </Button>

            <Button
              variant="ghost"
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-100/20',
                isCollapsed && 'justify-center'
              )}
              onClick={handleLogout}
            >
              <LogOut className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
              {!isCollapsed && 'Logout'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
