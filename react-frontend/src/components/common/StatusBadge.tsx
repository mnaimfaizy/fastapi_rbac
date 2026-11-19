import type { ComponentType, SVGProps } from 'react';
import { CircleDashed, Clock, Lock } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Account states a badge can show. Labels follow the CONTEXT.md glossary:
 * Pending (not "Unverified") and Disabled (not "Inactive").
 */
export type UserStatus =
  'active' | 'verified' | 'locked' | 'expiring' | 'pending' | 'disabled';

type Tone = 'neutral' | 'danger' | 'warning' | 'outline';

const STATUS: Record<
  UserStatus,
  {
    label: string;
    tone: Tone;
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
  }
> = {
  active: { label: 'Active', tone: 'neutral' },
  verified: { label: 'Verified', tone: 'neutral' },
  locked: { label: 'Locked', tone: 'danger', icon: Lock },
  expiring: { label: 'Expiring', tone: 'warning', icon: Clock },
  pending: { label: 'Pending', tone: 'outline', icon: CircleDashed },
  disabled: { label: 'Disabled', tone: 'outline', icon: CircleDashed },
};

const statusBadgeVariants = cva(
  'inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-sm border px-2 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral:
          'border-transparent bg-status-neutral text-status-neutral-foreground',
        danger:
          'border-transparent bg-status-danger text-status-danger-foreground',
        warning:
          'border-transparent bg-status-warning text-status-warning-foreground',
        outline: 'border-input bg-transparent text-foreground-secondary',
      },
    },
  }
);

export interface StatusBadgeProps {
  status: UserStatus;
  /** Longer text shown on hover, such as "Locked until 14:05". */
  description?: string;
  className?: string;
}

/**
 * One badge for every account state. Healthy states are neutral with a
 * dot; exceptions carry color and an icon so color is never the only cue.
 */
export function StatusBadge({
  status,
  description,
  className,
}: StatusBadgeProps) {
  const { label, tone, icon: Icon } = STATUS[status];
  return (
    <span
      data-status={status}
      title={description}
      className={cn(statusBadgeVariants({ tone }), className)}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="size-3 shrink-0" />
      ) : (
        <span
          aria-hidden="true"
          className="bg-muted-foreground size-1.5 rounded-full"
        />
      )}
      {label}
    </span>
  );
}
