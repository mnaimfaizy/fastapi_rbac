import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EmptyStateAction = {
  label: string;
  /**
   * `primary` for a create action ("Create role"), `secondary` for a way
   * out ("Clear search", "Go to users"). Primary by default.
   */
  variant?: 'primary' | 'secondary';
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never });

export interface EmptyStateProps {
  /** Outline icon for the space, such as a lucide icon. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Headline naming the space, such as "Create your first role". */
  title: string;
  /** One sentence on what belongs here. */
  description?: string;
  /**
   * One verb button. Leave it out when the viewer cannot act, such as a
   * manager looking at an empty list only admins can fill.
   */
  action?: EmptyStateAction;
  className?: string;
}

function buttonVariant(action: EmptyStateAction) {
  return action.variant === 'secondary' ? 'outline' : 'default';
}

/** What an empty list or search shows instead of a dead end. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {Icon ? (
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <Icon aria-hidden="true" className="size-6" />
        </div>
      ) : null}
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-foreground text-lg leading-[26px] font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="text-foreground-secondary text-sm">{description}</p>
        ) : null}
      </div>
      {action ? (
        action.href !== undefined ? (
          <Button asChild variant={buttonVariant(action)}>
            <Link to={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant={buttonVariant(action)}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
