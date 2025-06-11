import { useAppSelector } from '@/store/hooks';

export function usePermissions() {
  const user = useAppSelector((state) => state.auth.user);

  const hasPermission = (requiredPermission: string): boolean => {
    if (!user?.permissions) {
      return false;
    }

    // Handle both string array and permission object array
    if (Array.isArray(user.permissions)) {
      if (typeof user.permissions[0] === 'string') {
        return (user.permissions as string[]).includes(requiredPermission);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (user.permissions as any[]).some(
          (permission) => permission.name === requiredPermission
        );
      }
    }

    return false;
  };

  const hasPermissions = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.every((permission) => hasPermission(permission));
  };

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.some((permission) => hasPermission(permission));
  };

  const hasRole = (requiredRole: string): boolean => {
    if (!user?.roles) {
      return false;
    }
    return user.roles.some(
      (role) => role.name.toLowerCase() === requiredRole.toLowerCase()
    );
  };

  const hasAnyRole = (requiredRoles: string[]): boolean => {
    return requiredRoles.some((role) => hasRole(role));
  };

  return {
    hasPermission,
    hasPermissions,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
  };
}
