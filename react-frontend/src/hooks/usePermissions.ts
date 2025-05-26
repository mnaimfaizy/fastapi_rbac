import { useAppSelector } from '@/store/hooks';

export function usePermissions() {
  const user = useAppSelector((state) => state.auth.user);

  const hasPermission = (requiredPermission: string): boolean => {
    if (!user?.permissions) {
      return false;
    }
    return user.permissions.includes(requiredPermission);
  };

  const hasPermissions = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.every((permission) => hasPermission(permission));
  };

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.some((permission) => hasPermission(permission));
  };

  return {
    hasPermission,
    hasPermissions,
    hasAnyPermission,
  };
}
