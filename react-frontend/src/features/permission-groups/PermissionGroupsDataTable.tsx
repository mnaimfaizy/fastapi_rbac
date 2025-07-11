import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchPermissionGroups,
  deletePermissionGroup,
  setPage,
  setPageSize,
} from '../../store/slices/permissionGroupSlice';
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
import {
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  List,
  Users,
  Pencil,
  Eye,
  Trash2,
} from 'lucide-react';
import { PermissionGroup } from '../../models/permission';
import { RootState } from '../../store';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGroupRowProps {
  group: PermissionGroup;
  level?: number;
  allGroups: PermissionGroup[];
  expandAllState: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
}

const PermissionGroupRow: React.FC<PermissionGroupRowProps> = ({
  group,
  level = 0,
  allGroups,
  expandAllState,
  onDelete,
  onEdit,
  onView,
}: PermissionGroupRowProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { hasPermission } = usePermissions();

  const canEditGroup = hasPermission('permission_group.update');
  const canViewGroup = hasPermission('permission_group.read');
  const canDeleteGroup = hasPermission('permission_group.delete');

  // Sync with expandAllState from parent when it changes
  useEffect(() => {
    setIsExpanded(expandAllState);
  }, [expandAllState]);

  // Find direct children of this group
  const childGroups = allGroups.filter(
    (g) => g.permission_group_id === group.id
  );
  const hasChildren = childGroups.length > 0;
  const hasPermissions = group.permissions && group.permissions.length > 0;
  const isExpandable = hasChildren || hasPermissions;

  // Generate vertical line styles based on nesting level
  const verticalLineClass = level > 0 ? 'relative' : '';

  return (
    <>
      <TableRow className={cn(level > 0 && 'hover:bg-accent/30')}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center"
              style={{ marginLeft: `${level * 1.5}rem` }}
            >
              {/* Show expand/collapse control only if there are children */}
              {isExpandable ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 hover:bg-accent rounded-sm mr-1 focus:outline-none focus:ring-1 focus:ring-primary"
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded ? 'Collapse group' : 'Expand group'
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isExpanded ? 'Collapse' : 'Expand'} group
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                // Add empty space for alignment when no expand button
                <div className="w-6"></div>
              )}

              {/* Row content with connecting lines */}
              <div className={verticalLineClass}>
                {level > 0 && (
                  <div className="absolute left-[-1rem] top-1/2 w-[0.75rem] h-px bg-border"></div>
                )}
                {canViewGroup ? (
                  <button
                    onClick={() => onView(group.id)}
                    className="font-medium hover:underline focus:outline-none focus:text-primary"
                  >
                    {group.name}
                  </button>
                ) : (
                  <span className="font-medium">{group.name}</span>
                )}
              </div>
            </div>

            {/* Show badges for child groups and permissions count if any */}
            <div className="inline-flex ml-2 gap-1 items-center">
              {hasChildren && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1 text-xs"
                      >
                        <List className="h-3 w-3" />
                        {childGroups.length}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {childGroups.length} child{' '}
                      {childGroups.length === 1 ? 'group' : 'groups'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {hasPermissions && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1 text-xs"
                      >
                        <Users className="h-3 w-3" />
                        {group.permissions?.length}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {group.permissions?.length} assigned{' '}
                      {group.permissions?.length === 1
                        ? 'permission'
                        : 'permissions'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </TableCell>

        <TableCell>
          {group.permission_group_id
            ? allGroups.find((g) => g.id === group.permission_group_id)?.name ||
              'Unknown'
            : 'Root Level'}
        </TableCell>

        <TableCell>{group.permissions?.length || 0}</TableCell>

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
              {canEditGroup && (
                <DropdownMenuItem onClick={() => onEdit(group.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  <span>Edit</span>
                </DropdownMenuItem>
              )}
              {canViewGroup && (
                <DropdownMenuItem onClick={() => onView(group.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  <span>View details</span>
                </DropdownMenuItem>
              )}
              {canDeleteGroup && (
                <DropdownMenuItem
                  onClick={() => onDelete(group.id)}
                  className="text-red-600 focus:text-red-600 focus:bg-red-100"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {isExpanded &&
        childGroups.map((child) => (
          <PermissionGroupRow
            key={child.id}
            group={child}
            level={level + 1}
            allGroups={allGroups}
            expandAllState={expandAllState}
            onDelete={onDelete}
            onEdit={onEdit}
            onView={onView}
          />
        ))}
    </>
  );
};

export default function PermissionGroupsDataTable() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { permissionGroups, isLoading, totalItems, page, pageSize } =
    useAppSelector((state: RootState) => state.permissionGroup);
  // const { hasPermission } = usePermissions(); // Kept for future use if needed e.g. for an "Add" button

  const [searchTerm, setSearchTerm] = useState('');
  const [expandAll, setExpandAll] = useState(true);
  const [sort, setSort] = useState<{
    column: string | null;
    direction: 'asc' | 'desc';
  }>({
    column: null,
    direction: 'asc',
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchPermissionGroups({ page, pageSize }));
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
    dispatch(setPage(1));
  };

  const handleEdit = (id: string) => {
    navigate(`/dashboard/permission-groups/edit/${id}`);
  };

  const handleView = (id: string) => {
    navigate(`/dashboard/permission-groups/${id}`);
  };

  const openDeleteDialog = (id: string) => {
    setDeleteGroupId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteGroupId) return;

    try {
      await dispatch(deletePermissionGroup(deleteGroupId)).unwrap();
      dispatch(fetchPermissionGroups({ page, pageSize }));
      toast.success('Permission group deleted successfully');
    } catch (error: unknown) {
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteGroupId(null);
    }
  };

  const filterGroupsRecursively = (
    groups: PermissionGroup[]
  ): PermissionGroup[] => {
    return groups
      .filter((group) => {
        const matchesSearch = group.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const hasMatchingChildren = group.groups?.some((child) =>
          child.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesSearch || hasMatchingChildren;
      })
      .map((group) => ({
        ...group,
        groups: group.groups ? filterGroupsRecursively(group.groups) : [],
      }));
  };

  const filteredGroups = searchTerm
    ? filterGroupsRecursively(permissionGroups)
    : permissionGroups;

  const sortedGroups = [...filteredGroups].sort((a, b) => {
    if (!sort.column) return 0;

    const aValue = a[sort.column as keyof PermissionGroup];
    const bValue = b[sort.column as keyof PermissionGroup];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sort.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (aValue === bValue) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    return sort.direction === 'asc'
      ? aValue < bValue
        ? -1
        : 1
      : aValue > bValue
        ? -1
        : 1;
  });

  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search permission groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setExpandAll(!expandAll)}
            className="flex items-center gap-1"
          >
            {expandAll ? (
              <>
                <ChevronDown className="h-4 w-4" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                Expand All
              </>
            )}
          </Button>
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
              <TableHead>Parent Group</TableHead>
              <TableHead>Permissions Count</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Loading permission groups...
                </TableCell>
              </TableRow>
            ) : sortedGroups.length > 0 ? (
              sortedGroups
                .filter((group) => !group.permission_group_id)
                .map((group) => (
                  <PermissionGroupRow
                    key={group.id}
                    group={group}
                    allGroups={sortedGroups}
                    expandAllState={expandAll}
                    onDelete={openDeleteDialog}
                    onEdit={handleEdit}
                    onView={handleView}
                  />
                ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No permission groups found.
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
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this permission group? This action
              cannot be undone. Any contained permissions will need to be
              reassigned.
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
          permission groups
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
