import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { RoleGroupWithRoles } from '@/models/roleGroup';
import { Role } from '@/models/role';
import { usePermissions } from '@/hooks/usePermissions'; // Added import
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Added import
import { AlertCircle } from 'lucide-react'; // Added import

import {
  fetchRoleGroupById,
  deleteRoleGroup,
  addRolesToGroup,
  removeRolesFromGroup,
  moveToParent,
  fetchRoleGroups,
  selectCurrentRoleGroupWithUsers,
} from '../../store/slices/roleGroupSlice';
import { fetchRoles } from '../../store/slices/roleSlice';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Edit,
  Plus,
  Trash2,
  MoveVertical,
  ChevronDown,
  ChevronRight,
  List,
  Users,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NestedRoleGroupProps {
  group: RoleGroupWithRoles;
  level?: number;
  onRemoveRole: (roleId: string) => void;
  onViewGroup?: (groupId: string) => void; // Optional handler to view a group
  expandAllState: boolean; // Add this prop to sync with parent component
  canRemoveRoles: boolean; // Added permission prop
}

const NestedRoleGroup: React.FC<NestedRoleGroupProps> = ({
  group,
  level = 0,
  onRemoveRole,
  onViewGroup,
  expandAllState,
  canRemoveRoles, // Destructure prop
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync with expandAllState from parent when it changes
  useEffect(() => {
    setIsExpanded(expandAllState);
  }, [expandAllState]);

  // Check if this group has children or roles to display expand/collapse control
  const hasChildren = group.children && group.children.length > 0;
  const hasRoles = group.roles && group.roles.length > 0;
  const isExpandable = hasChildren || hasRoles;

  return (
    <div className="space-y-4">
      {/* Group Header with Expand/Collapse Control */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center"
          style={{ marginLeft: `${level * 1.5}rem` }}
        >
          {/* Expandable control */}
          {isExpandable ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 hover:bg-accent rounded-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-primary" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isExpanded ? 'Collapse' : 'Expand'} section
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="w-6"></div>
          )}

          {/* Group name */}
          <div className={cn('relative', level > 0 && 'border-l-0')}>
            {level > 0 && (
              <div className="absolute left-[-1rem] top-1/2 w-[0.75rem] h-px bg-border"></div>
            )}
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{group.name}</h3>

              {/* Add view button if it's a child group and we have onViewGroup handler */}
              {level > 0 && onViewGroup && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewGroup(group.id);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="sr-only">View group details</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      View group details
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Badges for child counts */}
          <div className="inline-flex ml-1 gap-1 items-center">
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

            {hasRoles && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1 text-xs"
                    >
                      <Users className="h-3 w-3" />
                      {group.roles?.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {group.roles?.length} assigned{' '}
                    {group.roles?.length === 1 ? 'role' : 'roles'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-6">
          {/* Roles Section */}
          {group.roles && group.roles.length > 0 && (
            <div
              className="space-y-2 border-l-2 border-l-muted pl-6"
              style={{ marginLeft: `${level * 1.5 + 0.5}rem` }}
            >
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Assigned Roles:
              </h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">
                          {role.name}
                        </TableCell>
                        <TableCell>{role.description || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {/* Conditionally render based on canRemoveRoles */}
                                {canRemoveRoles && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRemoveRole(role.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Remove role</span>
                                  </Button>
                                )}
                              </TooltipTrigger>
                              {canRemoveRoles && (
                                <TooltipContent side="left">
                                  Remove role from group
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Child Groups Section */}
          {group.children && group.children.length > 0 && (
            <div
              className="space-y-4 border-l-2 border-l-muted"
              style={{ marginLeft: `${level * 1.5 + 0.5}rem` }}
            >
              {level === 0 && (
                <h4 className="text-sm font-medium text-muted-foreground pl-6 flex items-center gap-2">
                  <List className="h-4 w-4" /> Child Groups:
                </h4>
              )}
              {group.children.map((child) => (
                <NestedRoleGroup
                  key={child.id}
                  group={child}
                  level={level + 1}
                  onRemoveRole={onRemoveRole}
                  onViewGroup={onViewGroup}
                  expandAllState={expandAllState}
                  canRemoveRoles={canRemoveRoles} // Pass down
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Rest of the component remains the same
const RoleGroupDetail: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions(); // Initialize hook

  // Define permissions
  const canReadRoleGroup = hasPermission('role_group.read');
  const canUpdateRoleGroup = hasPermission('role_group.update');
  const canDeleteRoleGroup = hasPermission('role_group.delete');
  const canManageRolesInGroup = hasPermission('role_group.manage_roles'); // e.g., add/remove roles
  const canCreateChildGroup = hasPermission('role_group.create'); // For adding a new child group

  const currentRoleGroupWithUsers = useSelector(
    selectCurrentRoleGroupWithUsers
  );
  const { loading, error, roleGroups } = useSelector(
    (state: RootState) => state.roleGroup
  );
  const { roles } = useSelector((state: RootState) => state.role);

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [expandAll, setExpandAll] = useState(true);

  useEffect(() => {
    if (groupId && canReadRoleGroup) {
      // Check read permission
      dispatch(fetchRoleGroupById(groupId));
      dispatch(fetchRoles({ page: 1, size: 100 }));
      dispatch(fetchRoleGroups({ page: 1, size: 100 })); // Fetch all groups for parent selection
    }
  }, [dispatch, groupId, canReadRoleGroup]);

  useEffect(() => {
    if (roles.length > 0 && currentRoleGroupWithUsers) {
      const currentRoleIds =
        currentRoleGroupWithUsers.roles?.map((role) => role.id) || [];
      setAvailableRoles(
        roles.filter((role) => !currentRoleIds?.includes(role.id))
      );
    }
  }, [roles, currentRoleGroupWithUsers]);

  const handleDelete = async () => {
    if (!canDeleteRoleGroup) {
      toast.error('You do not have permission to delete this role group.');
      return;
    }
    if (groupId) {
      try {
        await dispatch(deleteRoleGroup(groupId)).unwrap();
        toast.success('Role group deleted successfully');
        navigate('/dashboard/role-groups');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      }
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!canManageRolesInGroup) {
      toast.error(
        'You do not have permission to remove roles from this group.'
      );
      return;
    }
    if (groupId) {
      try {
        await dispatch(
          removeRolesFromGroup({ groupId, roleIds: [roleId] })
        ).unwrap();
        dispatch(fetchRoleGroupById(groupId));
        toast.success('Role removed from group');
      } catch (error) {
        console.error('Failed to remove role:', error);
        toast.error('Failed to remove role');
      }
    }
  };

  const handleViewGroup = (childGroupId: string) => {
    navigate(`/dashboard/role-groups/${childGroupId}`);
  };

  const handleAddRoles = async () => {
    if (!canManageRolesInGroup) {
      toast.error('You do not have permission to add roles to this group.');
      return;
    }
    if (groupId && selectedRoles.length > 0) {
      try {
        await dispatch(
          addRolesToGroup({ groupId, roleIds: selectedRoles })
        ).unwrap();
        setIsRoleDialogOpen(false);
        setSelectedRoles([]);
        dispatch(fetchRoleGroupById(groupId));
        toast.success('Roles added to group');
      } catch (error) {
        console.error('Failed to add roles:', error);
        toast.error('Failed to add roles');
      }
    }
  };

  const handleMoveToParent = async (newParentId: string | null) => {
    if (!canUpdateRoleGroup) {
      // Moving can be considered an update
      toast.error('You do not have permission to move this role group.');
      return;
    }
    if (groupId) {
      try {
        await dispatch(
          moveToParent({
            groupId,
            parentId: newParentId === 'root' ? null : newParentId,
          })
        ).unwrap();
        setIsMoveDialogOpen(false);
        dispatch(fetchRoleGroupById(groupId));
        toast.success('Role group moved successfully');
      } catch (error) {
        console.error('Failed to move role group:', error);
        toast.error('Failed to move role group');
      }
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  // Filter out current group and its descendants from possible parents
  const availableParents = roleGroups.filter(
    (group) =>
      group.id !== groupId &&
      !(currentRoleGroupWithUsers?.children || []).some(
        (child) => child.id === group.id
      )
  );

  // Global read permission check for the page
  if (!canReadRoleGroup) {
    return (
      <div className="p-4 text-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view this role group.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading && !currentRoleGroupWithUsers) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded">
        {error}
      </div>
    );
  }

  if (!currentRoleGroupWithUsers) {
    return <div className="p-4 text-center">Role group not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/dashboard/role-groups"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to role groups
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {currentRoleGroupWithUsers.name}
          </h2>
          <p className="text-sm text-muted-foreground space-y-1">
            <span className="block">
              Created: {formatDate(currentRoleGroupWithUsers.created_at || '')}
            </span>
            <span className="block">
              Updated: {formatDate(currentRoleGroupWithUsers.updated_at || '')}
            </span>
            <span className="block">
              Created by:{' '}
              {currentRoleGroupWithUsers.creator
                ? currentRoleGroupWithUsers.creator.first_name &&
                  currentRoleGroupWithUsers.creator.last_name
                  ? `${currentRoleGroupWithUsers.creator.first_name} ${currentRoleGroupWithUsers.creator.last_name}`
                  : currentRoleGroupWithUsers.creator.email
                : 'Unknown'}
            </span>
            {currentRoleGroupWithUsers.parent && (
              <span className="block">
                <button
                  onClick={() =>
                    navigate(
                      `/dashboard/role-groups/${
                        currentRoleGroupWithUsers.parent!.id
                      }`
                    )
                  }
                  className="hover:underline focus:outline-none focus:text-primary"
                >
                  Parent Group: {currentRoleGroupWithUsers.parent.name}
                </button>
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          {canUpdateRoleGroup && ( // Permission for Move button
            <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <MoveVertical className="mr-2 h-4 w-4" />
                  Move
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Move Role Group</DialogTitle>
                  <DialogDescription>
                    Select a new parent for this role group
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Select
                    onValueChange={(value) => handleMoveToParent(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a parent group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">Root Level</SelectItem>
                      {availableParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {canUpdateRoleGroup && ( // Permission for Edit button
            <Button
              variant="outline"
              onClick={() => {
                if (!canUpdateRoleGroup) {
                  toast.error(
                    'You do not have permission to edit this role group.'
                  );
                  return;
                }
                navigate(`/dashboard/role-groups/edit/${groupId}`);
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}

          {canDeleteRoleGroup && ( // Permission for Delete button
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    this role group and all its child groups from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground"
                    disabled={!canDeleteRoleGroup} // Also disable action if no permission
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Separator />

      {/* Child Groups Section */}
      {currentRoleGroupWithUsers.children &&
        currentRoleGroupWithUsers.children.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Child Groups</CardTitle>
                <CardDescription>
                  Groups that inherit from this group
                </CardDescription>
              </div>
              {canCreateChildGroup && ( // Permission for Add Child Group button
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!canCreateChildGroup) {
                      toast.error(
                        'You do not have permission to create child groups.'
                      );
                      return;
                    }
                    navigate('/dashboard/role-groups/new', {
                      state: { defaultParentId: groupId },
                    });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Child Group
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRoleGroupWithUsers.children.map((child) => (
                    <TableRow key={child.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() =>
                            navigate(`/dashboard/role-groups/${child.id}`)
                          }
                          className="hover:underline focus:outline-none focus:text-primary"
                        >
                          {child.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        {formatDate(child.created_at || '')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/dashboard/role-groups/${child.id}`)
                          }
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

      {/* Assigned Roles Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Assigned Roles</CardTitle>
            <CardDescription>Roles included in this group</CardDescription>
          </div>

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

            {canManageRolesInGroup && ( // Permission for Add Roles button
              <Dialog
                open={isRoleDialogOpen}
                onOpenChange={setIsRoleDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Roles
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Roles to Group</DialogTitle>
                    <DialogDescription>
                      Select roles to add to this role group.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 max-h-80 overflow-auto">
                    {availableRoles.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No available roles to add
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {availableRoles.map((role) => (
                          <div
                            key={role.id}
                            className="flex items-center justify-between p-2 border rounded-md hover:bg-accent"
                          >
                            <div>
                              <p className="font-medium">{role.name}</p>
                              {role.description && (
                                <p className="text-sm text-muted-foreground">
                                  {role.description}
                                </p>
                              )}
                            </div>
                            <Checkbox
                              id={`role-${role.id}`}
                              checked={selectedRoles.includes(role.id)}
                              onCheckedChange={() =>
                                toggleRoleSelection(role.id)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsRoleDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddRoles}
                      disabled={
                        selectedRoles.length === 0 || !canManageRolesInGroup
                      }
                    >
                      Add Selected Roles
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <NestedRoleGroup
            group={currentRoleGroupWithUsers}
            onRemoveRole={handleRemoveRole}
            onViewGroup={handleViewGroup}
            expandAllState={expandAll}
            canRemoveRoles={canManageRolesInGroup} // Pass permission to NestedRoleGroup
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleGroupDetail;
