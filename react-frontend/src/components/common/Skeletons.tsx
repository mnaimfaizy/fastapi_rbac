import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingRegionProps {
  /** Accessible name, such as "Loading users". Not shown on screen. */
  label: string;
  className?: string;
  children: ReactNode;
}

// Placeholders are decoration: assistive technology hears the label once.
function LoadingRegion({ label, className, children }: LoadingRegionProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={className}
    >
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

export interface TableSkeletonProps {
  label: string;
  rows?: number;
  columns?: number;
  className?: string;
}

/** A table shape: muted header, then rows with a two-line first cell. */
export function TableSkeleton({
  label,
  rows = 5,
  columns = 4,
  className,
}: TableSkeletonProps) {
  return (
    <LoadingRegion
      label={label}
      className={cn('overflow-hidden rounded-lg border', className)}
    >
      <div className="bg-muted flex h-10 items-center gap-6 border-b px-4">
        {range(columns).map((column) => (
          <Skeleton key={column} className="bg-border h-3 flex-1" />
        ))}
      </div>
      {range(rows).map((row) => (
        <div
          key={row}
          className="flex h-14 items-center gap-6 border-b px-4 last:border-b-0"
        >
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
          {range(Math.max(columns - 1, 0)).map((column) => (
            <Skeleton key={column} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </LoadingRegion>
  );
}

export interface StatCardsSkeletonProps {
  label: string;
  cards?: number;
  className?: string;
}

/** A row of dashboard stat cards. */
export function StatCardsSkeleton({
  label,
  cards = 4,
  className,
}: StatCardsSkeletonProps) {
  return (
    <LoadingRegion
      label={label}
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}
    >
      {range(cards).map((card) => (
        <div
          key={card}
          className="bg-card flex flex-col gap-3 rounded-lg border p-5"
        >
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export interface DetailSkeletonProps {
  label: string;
  sections?: number;
  className?: string;
}

/** A detail page: title block, then cards of label and value pairs. */
export function DetailSkeleton({
  label,
  sections = 2,
  className,
}: DetailSkeletonProps) {
  return (
    <LoadingRegion
      label={label}
      className={cn('flex flex-col gap-6', className)}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      {range(sections).map((section) => (
        <div
          key={section}
          className="bg-card flex flex-col gap-4 rounded-lg border p-5"
        >
          <Skeleton className="h-4 w-40" />
          {range(3).map((pair) => (
            <div key={pair} className="flex gap-6">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ))}
    </LoadingRegion>
  );
}
