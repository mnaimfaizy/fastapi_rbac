import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import {
  fetchRoleGroupById,
  deleteRoleGroup,
  addRolesToGroup,
  removeRolesFromGroup,
} from "../../store/slices/roleGroupSlice";
import { fetchRoles } from "../../store/slices/roleSlice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Edit, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Role } from "@/models/role";

const RoleGroupDetail: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { currentRoleGroup, loading, error } = useSelector(
    (state: RootState) => state.roleGroup
  );

  const { roles } = useSelector((state: RootState) => state.role);

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

  useEffect(() => {
    if (groupId) {
      dispatch(fetchRoleGroupById(groupId));
      dispatch(fetchRoles());
    }
  }, [dispatch, groupId]);

  useEffect(() => {
    // Filter out roles that are already assigned to the role group
    if (roles.length > 0 && currentRoleGroup) {
      const currentRoleIds = currentRoleGroup.roles.map((role) => role.id);
      setAvailableRoles(
        roles.filter((role) => !currentRoleIds.includes(role.id))
      );
    }
  }, [roles, currentRoleGroup]);

  const handleDelete = async () => {
    if (groupId) {
      await dispatch(deleteRoleGroup(groupId));
      navigate("/dashboard/role-groups");
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (groupId) {
      await dispatch(removeRolesFromGroup({ groupId, roleIds: [roleId] }));
      // Refresh role group data
      dispatch(fetchRoleGroupById(groupId));
    }
  };

  const handleAddRoles = async () => {
    if (groupId && selectedRoles.length > 0) {
      await dispatch(addRolesToGroup({ groupId, roleIds: selectedRoles }));
      setIsRoleDialogOpen(false);
      setSelectedRoles([]);
      // Refresh role group data
      dispatch(fetchRoleGroupById(groupId));
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  if (loading && !currentRoleGroup) {
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

  if (!currentRoleGroup) {
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
            {currentRoleGroup.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Created:{" "}
            {currentRoleGroup.created_at
              ? formatDate(currentRoleGroup.created_at)
              : "N/A"}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/role-groups/edit/${groupId}`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
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
                  this role group from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Separator />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Assigned Roles</CardTitle>
            <CardDescription>Roles included in this group</CardDescription>
          </div>
          <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
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
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={role.id}
                          checked={selectedRoles.includes(role.id)}
                          onCheckedChange={() => toggleRoleSelection(role.id)}
                        />
                        <label
                          htmlFor={role.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {role.name}
                          {role.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {role.description}
                            </p>
                          )}
                        </label>
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
                  disabled={selectedRoles.length === 0}
                >
                  Add Selected Roles
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {currentRoleGroup.roles && currentRoleGroup.roles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRoleGroup.roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRole(role.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove role</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No roles assigned to this group
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleGroupDetail;
