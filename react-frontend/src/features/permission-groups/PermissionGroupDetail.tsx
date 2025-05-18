import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchPermissionGroupById,
  deletePermissionGroup,
  fetchPermissionGroups,
} from '../../store/slices/permissionGroupSlice';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Pencil,
  Trash2,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  List,
  Users,
  Plus,
  Eye,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { RootState } from '../../store';
import { PermissionGroup } from '../../models/permission';
import { toast } from 'sonner';

interface NestedPermissionGroupProps {
  group: PermissionGroup;
  level?: number;
  allGroups: PermissionGroup[];
  expandAllState: boolean;
  onViewGroup?: (groupId: string) => void;
}

const NestedPermissionGroup: React.FC<NestedPermissionGroupProps> = ({
  group,
  level = 0,
  allGroups,
  expandAllState,
  onViewGroup,
}: NestedPermissionGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

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
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-6">
          {/* Permissions Section */}
          {hasPermissions && (
            <div
              className="space-y-2 border-l-2 border-l-muted pl-6"
              style={{ marginLeft: `${level * 1.5 + 0.5}rem` }}
            >
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Assigned Permissions:
              </h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.permissions?.map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell className="font-medium">
                          {permission.name}
                        </TableCell>
                        <TableCell>{permission.description || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Child Groups Section */}
          {hasChildren && (
            <div
              className="space-y-4 border-l-2 border-l-muted"
              style={{ marginLeft: `${level * 1.5 + 0.5}rem` }}
            >
              {level === 0 && (
                <h4 className="text-sm font-medium text-muted-foreground pl-6 flex items-center gap-2">
                  <List className="h-4 w-4" /> Child Groups:
                </h4>
              )}
              {childGroups.map((child) => (
                <NestedPermissionGroup
                  key={child.id}
                  group={child}
                  level={level + 1}
                  allGroups={allGroups}
                  expandAllState={expandAllState}
                  onViewGroup={onViewGroup}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function PermissionGroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [expandAll, setExpandAll] = useState(true);

  const { currentPermissionGroup, permissionGroups, isLoading } =
    useAppSelector((state: RootState) => state.permissionGroup);

  // Get parent group name for display
  const parentGroupName = currentPermissionGroup?.permission_group_id
    ? permissionGroups.find(
        (group: PermissionGroup) =>
          group.id === currentPermissionGroup.permission_group_id
      )?.name
    : null;

  useEffect(() => {
    console.log('ID: ', groupId);
  }, [groupId]); // Debugging line to check the value of id

  useEffect(() => {
    if (groupId) {
      dispatch(fetchPermissionGroupById(groupId));
      // Fetch all permission groups to build the complete tree
      dispatch(fetchPermissionGroups({ page: 1, pageSize: 100 }));
    }
  }, [dispatch, groupId]);

  const handleEdit = () => {
    navigate(`/dashboard/permission-groups/edit/${groupId}`);
  };

  const handleDelete = async () => {
    if (!groupId) return;

    try {
      await dispatch(deletePermissionGroup(groupId)).unwrap();
      toast.success('Permission group deleted successfully');
      navigate('/dashboard/permission-groups');
    } catch (error: unknown) {
      // The error message is now properly propagated from the service through the Redux slice
      let errorMessage = 'An error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast.error(errorMessage, {
        duration: 5000,
      });
    }
  };

  const handleBack = () => {
    navigate('/dashboard/permission-groups');
  };

  const handleViewGroup = (groupId: string) => {
    navigate(`/dashboard/permission-groups/${groupId}`);
  };

  if (isLoading) {
    return (
      <div className="text-center p-4">Loading permission group details...</div>
    );
  }

  if (!currentPermissionGroup) {
    return (
      <div className="text-center p-4">
        <h2 className="text-lg font-semibold">Permission group not found</h2>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Permission Groups
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-8"
          onClick={handleBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to permission groups
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {currentPermissionGroup.name}
          </h2>
          <p className="text-sm text-muted-foreground space-y-1">
            <span className="block">
              Created:{' '}
              {new Date(currentPermissionGroup.created_at).toLocaleString()}
            </span>
            <span className="block">
              Updated:{' '}
              {new Date(currentPermissionGroup.updated_at).toLocaleString()}
            </span>
            {parentGroupName && (
              <span className="block">
                <button
                  onClick={() =>
                    navigate(
                      `/dashboard/permission-groups/${currentPermissionGroup.permission_group_id}`
                    )
                  }
                  className="hover:underline focus:outline-none focus:text-primary"
                >
                  Parent Group: {parentGroupName}
                </button>
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleEdit}
            className="flex items-center"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="flex items-center"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Separator />

      {/* Child Groups Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Permission Group Hierarchy</CardTitle>
            <CardDescription>
              This permission group and its children
            </CardDescription>
          </div>

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
        </CardHeader>
        <CardContent>
          <NestedPermissionGroup
            group={currentPermissionGroup}
            allGroups={permissionGroups}
            expandAllState={expandAll}
            onViewGroup={handleViewGroup}
          />
        </CardContent>
      </Card>

      {/* Add button to create a new child permission group */}
      <div className="flex justify-start">
        <Button
          onClick={() =>
            navigate('/dashboard/permission-groups/new', {
              state: { defaultParentId: groupId },
            })
          }
          className="flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Child Permission Group
        </Button>
      </div>
    </div>
  );
}
