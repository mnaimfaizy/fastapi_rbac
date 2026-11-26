import { Navigate } from 'react-router-dom';
import AuthLayout from '@/components/layout/AuthLayout';
import MainLayout from '@/components/layout/MainLayout';
import { useAppSelector } from '@/store/hooks';

/**
 * The layout around a page every visitor can reach, such as the 404: the
 * app shell for a signed-in user, so they are never stranded, and the
 * auth layout for a signed-out visitor.
 */
const SystemStateLayout = () => {
  const { isAuthenticated, isLoading, user } = useAppSelector(
    (state) => state.auth
  );

  // Wait for a session restore before choosing, as the route guard does.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          data-testid="loading-spinner"
          className="border-primary size-8 animate-spin rounded-full border-b-2"
        />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthLayout />;
  }

  // A temporary password restricts the account to one page (ADR 0014).
  if (user.needs_to_change_password) {
    return <Navigate to="/change-password-required" replace />;
  }

  return <MainLayout />;
};

export default SystemStateLayout;
