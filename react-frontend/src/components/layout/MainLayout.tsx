import { useState } from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { Sidebar } from '../dashboard/sidebar';
import { Button } from '@/components/ui/button';
import { Menu, User } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

const MainLayout = () => {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar for desktop */}
      {isDesktop ? (
        <div
          className={cn(
            'border-r bg-background',
            isCollapsed ? 'w-[80px]' : 'w-[250px]'
          )}
        >
          <div className="flex h-16 items-center justify-between border-b px-4">
            {!isCollapsed && (
              <h2 className="text-lg font-semibold">RBAC Admin</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn('ml-auto', !isCollapsed && 'rotate-180')}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <Sidebar isCollapsed={isCollapsed} />
        </div>
      ) : (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-4 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[250px] p-0">
            <div className="flex h-16 items-center border-b px-4">
              <h2 className="text-lg font-semibold">RBAC Admin</h2>
            </div>
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <header className="bg-background border-b px-4 h-16 flex items-center justify-end">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Button
                variant="ghost"
                onClick={toggleUserMenu}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                {user?.first_name} {user?.last_name}
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isUserMenuOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </Button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 py-1 bg-white rounded-md shadow-lg z-10">
                  <Link
                    to="/dashboard/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Your Profile
                  </Link>
                  <Link
                    to="/dashboard/change-password"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Change Password
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
            <Button>Download Report</Button>
          </div>
        </header>

        <main className="flex-1 p-8 pt-6 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
