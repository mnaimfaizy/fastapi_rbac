/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ChevronDown, ArrowUpDown } from 'lucide-react';

// Define and export DataTableColumn
export interface DataTableColumn<TData extends Record<string, any>> {
  accessorKey: keyof TData | (string & {}); // Allow string for dot-notation access, though direct keyof is simpler
  header: string | (() => ReactNode);
  cell?: (props: { row: TData; value: any }) => ReactNode;
  enableSorting?: boolean;
  enableFiltering?: boolean; // Future use for column-specific filtering
}

interface DataTableProps<TData extends Record<string, any>> {
  data: TData[];
  columns: DataTableColumn<TData>[];
  // Add other props like onRowClick, etc. if needed
}

export function DataTable<TData extends Record<string, any>>({
  data,
  columns,
}: DataTableProps<TData>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TData | (string & {});
    direction: 'asc' | 'desc';
  } | null>(null);

  const handleSort = (key: keyof TData | (string & {})) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredData = data.filter((item) => {
    if (!searchTerm) return true;
    return columns.some((column) => {
      // Basic filtering: check if stringified value of any column contains search term
      // This can be made more sophisticated (e.g. per-column filter functions)
      const value = item[column.accessorKey as keyof TData]; // Adjust if accessorKey can be a deep path
      return String(value).toLowerCase().includes(searchTerm.toLowerCase());
    });
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;

    const valA = a[sortConfig.key as keyof TData];
    const valB = b[sortConfig.key as keyof TData];

    // Basic comparison, can be enhanced for different data types
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (valA < valB) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (valA > valB) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="max-w-sm"
        />
        {/* Add other controls like column visibility toggles here if needed */}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.accessorKey)}
                  onClick={() =>
                    column.enableSorting !== false &&
                    handleSort(column.accessorKey)
                  }
                  className={
                    column.enableSorting !== false ? 'cursor-pointer' : ''
                  }
                >
                  {typeof column.header === 'function'
                    ? column.header()
                    : column.header}
                  {sortConfig && sortConfig.key === column.accessorKey && (
                    <span className="ml-2">
                      {sortConfig.direction === 'asc' ? (
                        <ChevronDown className="inline h-4 w-4" /> // Should be ArrowUp
                      ) : (
                        <ArrowUpDown className="inline h-4 w-4" /> // Should be ArrowDown, or use a single icon that flips
                      )}
                    </span>
                  )}
                </TableHead>
              ))}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length > 0 ? (
              sortedData.map((rowItem, rowIndex) => (
                <TableRow
                  key={(rowItem as any).id || rowIndex} // Prefer a unique ID if available
                >
                  {columns.map((column) => {
                    // Basic value access. For nested paths (e.g., 'user.name'), a helper function would be needed.
                    const value = (rowItem as any)[column.accessorKey];
                    return (
                      <TableCell key={String(column.accessorKey)}>
                        {column.cell
                          ? column.cell({ row: rowItem, value })
                          : value !== null && value !== undefined
                            ? String(value)
                            : ''}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            console.log('View details:', (rowItem as any).id)
                          }
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            console.log('Edit item:', (rowItem as any).id)
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() =>
                            console.log('Delete item:', (rowItem as any).id)
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {/* Add pagination controls here if needed */}
    </div>
  );
}
