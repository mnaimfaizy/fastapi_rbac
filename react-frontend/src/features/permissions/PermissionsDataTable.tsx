import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchPermissions,
  deletePermission,
  setPage,
  setPageSize,
} from '../../store/slices/permissionSlice';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoreHorizontal, ChevronDown, Eye, Pencil, Trash2 } from 'lucide-react';
import { Permission } from '../../models/permission';
import { RootState } from '../../store';
import { toast } from 'sonner';

interface SortState {
  column: string | null;
  direction: 'asc' | 'desc';
}

export default function PermissionsDataTable() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { permissions, isLoading, totalItems, page, pageSize } = useAppSelector(
    (state: RootState) => state.permission
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<SortState>({
    column: null,
    direction: 'asc',
  });
  // Add state for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchPermissions({ page, pageSize }));
  }, [dispatch, page, pageSize]);

  const handleSort = (column: string) => {
    setSort((prev) => ({
      column,
      direction:
        prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage));
  };

  const handlePageSizeChange = (newSize: number) => {
    dispatch(setPageSize(newSize));
    dispatch(setPage(1)); // Reset to first page when changing page size
  };

  const handleEdit = (id: string) => {
    navigate(`/dashboard/permissions/edit/${id}`);
  };

  const handleView = (id: string) => {
    navigate(`/dashboard/permissions/${id}`);
  };

  const openDeleteDialog = (id: string) => {
    setDeleteItemId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItemId) return;

    try {
      await dispatch(deletePermission(deleteItemId)).unwrap();
      toast.success('Permission deleted successfully');
      dispatch(fetchPermissions({ page, pageSize }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        (error instanceof Error
          ? error.message
          : 'Failed to delete permission');
      toast.error(errorMessage);
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteItemId(null);
    }
  };

  // Filter permissions based on search term (including group name)
  const filteredPermissions = permissions.filter(
    (permission: Permission) =>
      permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (permission.description &&
        permission.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      (permission.group &&
        permission.group.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort permissions
  const sortedPermissions = [...filteredPermissions].sort((a, b) => {
    if (!sort.column) return 0;

    // Use more specific types for sorting values
    let aValue: string | undefined | null;
    let bValue: string | undefined | null;

    // Handle sorting by group name
    if (sort.column === 'group') {
      aValue = a.group?.name?.toLowerCase();
      bValue = b.group?.name?.toLowerCase();
    } else {
      // Access properties safely, default to null if not string
      const key = sort.column as keyof Permission;
      const rawA = a[key];
      const rawB = b[key];
      aValue = typeof rawA === 'string' ? rawA.toLowerCase() : null;
      bValue = typeof rawB === 'string' ? rawB.toLowerCase() : null;
    }

    // Comparison logic (handles null/undefined)
    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined)
      return sort.direction === 'asc' ? 1 : -1;
    if (bValue === null || bValue === undefined)
      return sort.direction === 'asc' ? -1 : 1;

    // String comparison
    return sort.direction === 'asc'
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  // Calculate pagination values
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 p-0 hover:bg-transparent"
                >
                  Name
                  {sort.column === 'name' && (
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        sort.direction === 'desc' ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[350px]">Description</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('group')}
                  className="flex items-center gap-1 p-0 hover:bg-transparent"
                >
                  Group Name
                  {sort.column === 'group' && (
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        sort.direction === 'desc' ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Loading permissions...
                </TableCell>
              </TableRow>
            ) : sortedPermissions.length > 0 ? (
              sortedPermissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">
                    {permission.name}
                  </TableCell>
                  <TableCell>{permission.description}</TableCell>
                  <TableCell>{permission.group?.name ?? 'N/A'}</TableCell>
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleEdit(permission.id)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleView(permission.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(permission.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No permissions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this permission? This action
              cannot be undone. Any roles using this permission will lose this
              capability.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Showing {totalItems > 0 ? startItem : 0} to {endItem} of {totalItems}{' '}
          permissions
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
            className="border p-1 rounded text-sm"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => Math.abs(p - page) < 3 || p === 1 || p === totalPages
              )
              .map((p) => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </Button>
              ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
