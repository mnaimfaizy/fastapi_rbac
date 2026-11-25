import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const PAGE_SIZES = [10, 20, 50] as const;

export interface UsersPaginationProps {
  /** Users after search and filters. */
  total: number;
  /** Zero-based. */
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** The mobile form: "1–7 of 75" and the arrows only. */
  compact?: boolean;
}

/** "Showing 1–10 of 75 users", rows per page, previous and next. */
export function UsersPagination({
  total,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  compact = false,
}: UsersPaginationProps) {
  const sizeId = useId();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min(total, (pageIndex + 1) * pageSize);
  const range = `${first}–${last} of ${total}`;
  const arrowSize = compact ? 'size-11' : 'size-9';

  return (
    <div
      className={cn(
        'text-foreground-secondary flex items-center justify-between gap-4 text-[13px]',
        !compact && 'border-t px-4 py-3'
      )}
    >
      <span>{compact ? range : `Showing ${range} users`}</span>
      <div className="flex items-center gap-4">
        {!compact && onPageSizeChange ? (
          <span className="flex items-center gap-2">
            <label htmlFor={sizeId}>Rows per page</label>
            <select
              id={sizeId}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="border-input bg-background text-foreground focus-visible:ring-ring h-10 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </span>
        ) : null}
        <span className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={arrowSize}
            aria-label="Previous page"
            disabled={pageIndex <= 0}
            onClick={() => onPageChange(pageIndex - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={arrowSize}
            aria-label="Next page"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => onPageChange(pageIndex + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </span>
      </div>
    </div>
  );
}
