import { cn } from '@/lib/utils';

/** Product name, shown next to the logo and used as its accessible name. */
export const PRODUCT_NAME = 'FastAPI RBAC';

/**
 * The FastAPI RBAC shield-and-key mark. It draws in `currentColor`, so the
 * caller sets its color with a text token (`text-primary` on the sidebar,
 * `text-primary-foreground` on a filled tile).
 */
export function BrandMark({
  className,
  decorative = false,
}: {
  className?: string;
  /** Hide it from assistive tech when the name is already next to it. */
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-7 shrink-0', className)}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': PRODUCT_NAME })}
    >
      <path d="M12 2.5 19.5 5.5V11c0 4.9-3.2 8.6-7.5 10.2C7.7 19.6 4.5 15.9 4.5 11V5.5Z" />
      <circle cx="12" cy="9.5" r="2.4" />
      <path d="M12 11.9V17" />
      <path d="M12 14.6h2" />
      <path d="M12 17h1.4" />
    </svg>
  );
}

/**
 * Logo and product name, as the sidebar and the mobile header show them.
 * The visible name labels the lockup, so the mark is hidden from assistive
 * tech to avoid announcing the name twice.
 */
export function BrandLockup({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark decorative className="text-primary" />
      <span
        className={cn(
          'font-semibold tracking-tight text-foreground',
          size === 'sm' ? 'text-[15px]' : 'text-base'
        )}
      >
        {PRODUCT_NAME}
      </span>
    </div>
  );
}
