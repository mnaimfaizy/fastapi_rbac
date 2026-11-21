import { buildNavGroups } from '@/lib/navigation';

/**
 * True when this viewer can open any Access item. Everyone else is a plain
 * user and lands on User home. The check is the shell's own nav rule.
 */
export function hasAccessManagement(
  hasPermission: (permission: string) => boolean
): boolean {
  return buildNavGroups(hasPermission).some(
    (group) => group.label === 'Access'
  );
}
