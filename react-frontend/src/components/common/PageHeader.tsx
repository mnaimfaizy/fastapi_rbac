import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /**
   * The page's single primary action, such as "Add user". One element by
   * design: secondary actions belong in the page body or a "…" menu.
   * Leave it out when the viewer cannot use it, rather than disabling it.
   */
  action?: ReactNode;
  className?: string;
}

/** Title, one-line description and at most one primary action. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-foreground text-2xl leading-8 font-semibold">
          {title}
        </h1>
        {description ? (
          <div className="text-foreground-secondary text-sm">{description}</div>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center">{action}</div>
      ) : null}
    </header>
  );
}
