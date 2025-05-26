import { Navigate } from 'react-router-dom';
import { RootState } from '../../store';
import PropTypes from 'prop-types';
import { useAppSelector } from '@/store/hooks';
import { Role } from '@/models/user';

interface ProtectedRouteProps {
  requiredRoles?: string[];
  requiredPermissions?: string[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRoles = [],
  requiredPermissions = [],
  children,
}) => {
  const { user } = useAppSelector((state: RootState) => state.auth);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User's permissions are directly available in user.permissions as a list of strings.
  const userPermissions: string[] = Array.isArray(user?.permissions)
    ? user.permissions
    : [];

  // Check for required roles if specified
  if (requiredRoles.length > 0) {
    const userRoleNames =
      user?.roles?.map((role: Role) => String(role.name).toLowerCase()) || []; // Use any for role temporarily
    const hasRequiredRole = requiredRoles.some((roleName) =>
      userRoleNames.includes(roleName.toLowerCase())
    );

    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check for required permissions if specified
  if (requiredPermissions.length > 0) {
    const hasRequiredPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

ProtectedRoute.propTypes = {
  requiredRoles: PropTypes.arrayOf(PropTypes.string),
  requiredPermissions: PropTypes.arrayOf(PropTypes.string),
  children: PropTypes.node.isRequired,
};

export default ProtectedRoute;
