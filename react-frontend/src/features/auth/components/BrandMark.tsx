import { cn } from '@/lib/utils';

/** Shield-and-key mark from the Web v1 auth artboards. Stroke follows currentColor. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="FastAPI RBAC"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-8 shrink-0', className)}
    >
      <path d="M12 2.5 19.5 5.5V11c0 4.9-3.2 8.6-7.5 10.2C7.7 19.6 4.5 15.9 4.5 11V5.5Z" />
      <circle cx="12" cy="9.5" r="2.4" />
      <path d="M12 11.9V17" />
      <path d="M12 14.6h2" />
      <path d="M12 17h1.4" />
    </svg>
  );
}
