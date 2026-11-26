import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** One titled card on an Account settings tab. */
export function SettingsSection({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = `settings-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'bg-card text-card-foreground flex min-w-0 flex-col gap-5 rounded-xl border p-5 sm:p-7',
        className
      )}
    >
      <div className="min-w-0">
        <h2
          id={headingId}
          className="text-foreground text-base leading-snug font-semibold"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
