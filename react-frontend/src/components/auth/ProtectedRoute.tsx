import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import UnauthorizedPage from '../../pages/UnauthorizedPage';

interface ProtectedRouteProps {
  requiredRoles?: string[];
  requiredPermissions?: string[];
  requireAllPermissions?: boolean; // If true, requires ALL permissions; if false, requires ANY
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRoles = [],
  requiredPermissions = [],
  requireAllPermissions = true,
  children,
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const { hasRole, hasPermission } = usePermissions();

  // Show loading state while authentication is being determined
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div
          data-testid="loading-spinner"
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"
        ></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // A temporary password restricts the account to one page until it is
  // replaced (ADR 0014). The API refuses the other routes anyway.
  if (user.needs_to_change_password) {
    return <Navigate to="/change-password-required" replace />;
  }

  // A refusal stays inside the shell and names what is missing.
  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((roleName) => hasRole(roleName));
    if (!hasRequiredRole) {
      return <UnauthorizedPage />;
    }
  }

  if (requiredPermissions.length > 0) {
    const missing = requiredPermissions.filter(
      (permission) => !hasPermission(permission)
    );
    const refused = requireAllPermissions
      ? missing.length > 0
      : missing.length === requiredPermissions.length;

    if (refused) {
      // One missing permission is the answer in all-mode; in any-mode every
      // listed permission would have been enough.
      return (
        <UnauthorizedPage
          permission={missing[0]}
          anyOf={requireAllPermissions ? undefined : missing}
        />
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
