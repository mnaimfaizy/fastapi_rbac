'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowsPerPageChange?: (value: number) => void;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  searchColumn?: string;
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowsPerPageChange,
  onSearch,
  searchPlaceholder = 'Filter...',
  searchColumn,
  pagination,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(pagination
        ? {
            pagination: {
              pageIndex: pagination.pageIndex - 1, // Convert from 1-based to 0-based for TanStack Table
              pageSize: pagination.pageSize,
            },
          }
        : {}),
    },
    manualPagination: !!pagination,
    pageCount: pagination?.pageCount || -1,
  });

  // Handle search input changes
  const handleSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (searchColumn && !pagination) {
        // Local filtering
        table.getColumn(searchColumn)?.setFilterValue(value);
      } else if (onSearch) {
        // Server-side search
        onSearch(value);
      }
    },
    [table, searchColumn, onSearch, pagination]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(searchColumn || onSearch) && (
            <Input
              placeholder={searchPlaceholder}
              onChange={handleSearchChange}
              className="max-w-sm"
            />
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id === 'name'
                      ? 'Name'
                      : column.id === 'is_active'
                        ? 'Status'
                        : column.id === 'is_superuser'
                          ? 'Admin'
                          : column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">
            {pagination
              ? `Page ${pagination.pageIndex} of ${pagination.pageCount}`
              : `Page ${
                  table.getState().pagination.pageIndex + 1
                } of ${table.getPageCount()}`}
          </p>
          {onRowsPerPageChange && (
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                onRowsPerPageChange(Number(e.target.value));
              }}
              className="h-8 rounded border border-input bg-background px-2 text-xs"
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  Show {pageSize}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() =>
              pagination ? pagination.onPageChange(1) : table.setPageIndex(0)
            }
            disabled={
              pagination
                ? pagination.pageIndex <= 1
                : !table.getCanPreviousPage()
            }
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() =>
              pagination
                ? pagination.onPageChange(pagination.pageIndex - 1)
                : table.previousPage()
            }
            disabled={
              pagination
                ? pagination.pageIndex <= 1
                : !table.getCanPreviousPage()
            }
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() =>
              pagination
                ? pagination.onPageChange(pagination.pageIndex + 1)
                : table.nextPage()
            }
            disabled={
              pagination
                ? pagination.pageIndex >= pagination.pageCount
                : !table.getCanNextPage()
            }
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() =>
              pagination
                ? pagination.onPageChange(pagination.pageCount)
                : table.setPageIndex(table.getPageCount() - 1)
            }
            disabled={
              pagination
                ? pagination.pageIndex >= pagination.pageCount
                : !table.getCanNextPage()
            }
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
