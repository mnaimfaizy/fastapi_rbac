import type { MouseEvent, ReactNode } from 'react';
import {
  type ColumnDef,
  type RowData,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Name shown in a column picker, for columns the viewer can hide. */
    label?: string;
    /** Classes for this column's header and body cells, such as a width. */
    className?: string;
  }
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  /** The rows to show, already searched, filtered and paged by the caller. */
  data: TData[];
  getRowId?: (row: TData) => string;
  /** Which columns show. Columns left out of the map show. */
  columnVisibility?: VisibilityState;
  /**
   * Opens the row, usually its detail page. Clicks on links, buttons and
   * menus inside the row keep their own behavior.
   */
  onRowClick?: (row: TData) => void;
  /** Shown below the rows, inside the table's border (pagination). */
  footer?: ReactNode;
  /**
   * Narrowest the table may get before it scrolls sideways. Columns keep
   * their set widths and the flexible one takes the rest.
   */
  minWidth?: number;
}

function isInteractive(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('a, button, input, [role="menuitem"]') !== null
  );
}

/**
 * The Web v1 list table: muted header, 64px rows, a row click that opens
 * the row. Search, filters, the column picker and pagination belong to the
 * page, which passes the visible rows and the column visibility in.
 */
export function DataTable<TData>({
  columns,
  data,
  getRowId,
  columnVisibility = {},
  onRowClick,
  footer,
  minWidth,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
  });

  const handleRowClick = (row: TData) => (event: MouseEvent) => {
    if (!onRowClick || isInteractive(event.target)) return;
    onRowClick(row);
  };

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table className="table-fixed" style={{ minWidth }}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'text-foreground-secondary h-11 px-4 text-[13px]',
                    header.column.columnDef.meta?.className
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={onRowClick ? handleRowClick(row.original) : undefined}
              className={cn(onRowClick && 'cursor-pointer')}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    'h-16 px-4',
                    cell.column.columnDef.meta?.className
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {footer}
    </div>
  );
}
