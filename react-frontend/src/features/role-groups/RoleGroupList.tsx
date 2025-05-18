import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import {
  fetchRoleGroups,
  deleteRoleGroup,
  moveToParent,
  selectRoleGroupsWithUsers,
} from '../../store/slices/roleGroupSlice';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  List,
  Info,
  MoreHorizontal,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RoleGroup } from '@/models/roleGroup';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RoleGroupRowProps {
  group: RoleGroup;
  level?: number;
  onMove: (groupId: string, parentId: string | null) => void;
  onEdit: (groupId: string) => void;
  onView: (groupId: string) => void;
  onDelete: (groupId: string) => void;
  allGroups: RoleGroup[];
}

const RoleGroupRow: React.FC<
  RoleGroupRowProps & { expandAllState: boolean }
> = ({
  group,
  level = 0,
  onMove,
  onEdit,
  onView,
  onDelete,
  allGroups,
  expandAllState,
}) => {
  // Update isExpanded to use expandAllState from parent component
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync with expandAllState from parent when it changes
  useEffect(() => {
    setIsExpanded(expandAllState);
  }, [expandAllState]);

  // Filter out the current group and its children from possible parents
  const availableParents = allGroups.filter(
    (g) =>
      g.id !== group.id && !group.children?.some((child) => child.id === g.id)
  );

  // Check if this group has children or roles to display expand/collapse control
  const hasChildren = group.children && group.children.length > 0;
  // In RoleGroup model, we might not have direct access to roles, only in RoleGroupWithRoles
  const isExpandable = hasChildren; // Only expand if there are children

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
                    <TooltipContent side="top">
                      {isExpanded ? 'Collapse' : 'Expand'} child groups
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
                <button
                  onClick={() => onView(group.id)}
                  className="font-medium hover:underline focus:outline-none focus:text-primary"
                >
                  {group.name}
                </button>

                {/* Show badges for child groups count if any */}
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
                            {group.children?.length}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {group.children?.length} child{' '}
                          {group.children?.length === 1 ? 'group' : 'groups'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          {group.created_at ? formatDate(group.created_at) : 'N/A'}
        </TableCell>
        <TableCell>
          {group.updated_at ? formatDate(group.updated_at) : 'N/A'}
        </TableCell>
        <TableCell>
          {group.creator ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    {group.creator.first_name && group.creator.last_name
                      ? `${group.creator.first_name} ${group.creator.last_name}`
                      : group.creator.first_name ||
                        group.creator.last_name ||
                        group.creator.email}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {group.creator.email}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            'N/A'
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => onView(group.id)}>
                  <Info className="h-4 w-4 mr-2" />
                  View details
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onEdit(group.id)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onMove(group.id, null)}>
                  Root Level
                </DropdownMenuItem>

                {availableParents.length > 0 ? (
                  availableParents
                    .slice(0, 5) // Show only first 5 parents to avoid very large menus
                    .map((parent) => (
                      <DropdownMenuItem
                        key={parent.id}
                        onClick={() => onMove(group.id, parent.id)}
                      >
                        {parent.name}
                      </DropdownMenuItem>
                    ))
                ) : (
                  <DropdownMenuItem disabled>
                    No available parents
                  </DropdownMenuItem>
                )}

                {availableParents.length > 5 && (
                  <DropdownMenuItem asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start p-2"
                      onClick={() => onView(group.id)}
                    >
                      View more options...
                    </Button>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(group.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  id={`delete-dialog-${group.id}`}
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hidden"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete role group</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this role group and all its
                    children? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onDelete(group.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TableCell>
      </TableRow>

      {/* Only render children if expanded */}
      {isExpanded &&
        group.children?.map((child) => (
          <RoleGroupRow
            key={child.id}
            group={child}
            level={level + 1}
            onMove={onMove}
            onEdit={onEdit}
            onView={onView}
            onDelete={onDelete}
            allGroups={allGroups}
            expandAllState={expandAllState}
          />
        ))}
    </>
  );
};

const RoleGroupList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const roleGroupsWithUsers = useSelector(selectRoleGroupsWithUsers);
  const { pagination, loading, error } = useSelector(
    (state: RootState) => state.roleGroup
  );
  const [search, setSearch] = useState('');
  const [expandAll, setExpandAll] = useState(true);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchRoleGroups({ page: 1, size: 10 }));
  }, [dispatch]);

  const handlePageChange = (page: number) => {
    dispatch(fetchRoleGroups({ page, size: pagination.size }));
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch(
      fetchRoleGroups({
        page: 1,
        size: pagination.size,
        search_query: search,
      })
    );
  };

  const handleMoveGroup = async (
    groupId: string,
    newParentId: string | null
  ) => {
    try {
      await dispatch(moveToParent({ groupId, parentId: newParentId })).unwrap();
      toast.success('Role group moved successfully');
      dispatch(
        fetchRoleGroups({ page: pagination.page, size: pagination.size })
      );
    } catch (error) {
      console.error('Failed to move role group:', error);
      toast.error('Failed to move role group');
    }
  };

  const handleEditRoleGroup = (groupId: string) => {
    navigate(`/dashboard/role-groups/edit/${groupId}`);
  };

  const handleViewRoleGroup = (groupId: string) => {
    navigate(`/dashboard/role-groups/${groupId}`);
  };

  const openDeleteDialog = (groupId: string) => {
    setDeleteGroupId(groupId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteGroupId) return;

    try {
      await dispatch(deleteRoleGroup(deleteGroupId)).unwrap();
      toast.success('Role group deleted successfully');
      // Refresh the list after deletion
      dispatch(
        fetchRoleGroups({ page: pagination.page, size: pagination.size })
      );
    } catch (error: any) {
      // Extract the most specific error message from the error response
      const errorMessage =
        error.response?.data?.detail ||
        (error instanceof Error
          ? error.message
          : 'Failed to delete role group');

      // Use longer duration for conflict errors as they contain important instructions
      const duration =
        errorMessage.includes('has child groups') ||
        errorMessage.includes('has assigned roles')
          ? 8000
          : 5000;

      toast.error(errorMessage, {
        duration: duration,
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteGroupId(null);
    }
  };

  if (loading && !roleGroupsWithUsers.length) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center gap-4">
        <form onSubmit={handleSearch} className="w-full max-w-sm">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search role groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="absolute right-0 top-0 h-full px-3"
            >
              Search
            </Button>
          </div>
        </form>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpandAll(!expandAll)}
          >
            {expandAll ? (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronRight className="mr-2 h-4 w-4" />
                Expand All
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Name</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Updated At</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleGroupsWithUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-gray-500"
                >
                  No role groups found
                </TableCell>
              </TableRow>
            ) : (
              roleGroupsWithUsers
                .filter((group) => !group.parent_id)
                .map((group) => (
                  <RoleGroupRow
                    key={group.id}
                    group={group}
                    onMove={handleMoveGroup}
                    onEdit={handleEditRoleGroup}
                    onView={handleViewRoleGroup}
                    onDelete={openDeleteDialog}
                    allGroups={roleGroupsWithUsers}
                    expandAllState={expandAll}
                  />
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role group? This action
              cannot be undone. Any child groups will need to be deleted or
              reassigned first.
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
      {!loading && pagination.pages > 1 && (
        <Pagination>
          <PaginationContent>
            {pagination.page > 1 && (
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(pagination.page - 1)}
                />
              </PaginationItem>
            )}

            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
              (pageNumber) => {
                if (
                  pageNumber === 1 ||
                  pageNumber === pagination.pages ||
                  pageNumber === pagination.page ||
                  pageNumber === pagination.page - 1 ||
                  pageNumber === pagination.page + 1
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        isActive={pageNumber === pagination.page}
                        onClick={() => handlePageChange(pageNumber)}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (
                  (pageNumber === pagination.page - 2 && pagination.page > 3) ||
                  (pageNumber === pagination.page + 2 &&
                    pagination.page < pagination.pages - 2)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              }
            )}

            {pagination.page < pagination.pages && (
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(pagination.page + 1)}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default RoleGroupList;
