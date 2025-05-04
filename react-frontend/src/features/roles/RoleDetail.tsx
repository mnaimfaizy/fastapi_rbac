import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import {
  fetchRoleById,
  deleteRole,
  assignPermissionsToRole,
  removePermissionsFromRole,
} from "../../store/slices/roleSlice";
import { fetchPermissions } from "../../store/slices/permissionSlice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Edit, Plus, Trash2, Users, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Permission } from "@/models/permission";
import { Input } from "@/components/ui/input";

const RoleDetail: React.FC = () => {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { currentRole, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const { permissions } = useSelector((state: RootState) => state.permission);

  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredPermissions, setFilteredPermissions] = useState<Permission[]>(
    []
  );

  useEffect(() => {
    if (roleId) {
      dispatch(fetchRoleById(roleId));
      dispatch(fetchPermissions({ page: 1, pageSize: 100 })); // Get all permissions (up to 100)
    }
  }, [dispatch, roleId]);

  // Filter permissions when search term changes or permissions/currentRole update
  useEffect(() => {
    if (permissions.length) {
      // Get current permission IDs
      const currentPermissionIds =
        currentRole?.permissions?.map((p) => p.id) || [];

      // Filter out already assigned permissions and apply search filter
      const availablePerms = permissions.filter(
        (permission) =>
          !currentPermissionIds.includes(permission.id) &&
          (searchTerm === "" ||
            permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (permission.description &&
              permission.description
                .toLowerCase()
                .includes(searchTerm.toLowerCase())))
      );

      setFilteredPermissions(availablePerms);
    }
  }, [permissions, currentRole, searchTerm]);

  const handleDelete = async () => {
    if (roleId) {
      try {
        await dispatch(deleteRole(roleId)).unwrap();
        toast.success("Role deleted successfully");
        navigate("/dashboard/roles");
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.detail ||
          (error instanceof Error ? error.message : "Failed to delete role");

        toast.error(errorMessage, {
          duration: 5000,
        });
      }
    }
  };

  const handleRemovePermission = async (permissionId: string) => {
    if (roleId) {
      try {
        await dispatch(
          removePermissionsFromRole({ roleId, permissionIds: [permissionId] })
        ).unwrap();
        dispatch(fetchRoleById(roleId)); // Refresh role data
        toast.success("Permission removed from role");
      } catch (error) {
        console.error("Failed to remove permission:", error);
        toast.error("Failed to remove permission");
      }
    }
  };

  const togglePermissionSelection = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleAddPermissions = async () => {
    if (roleId && selectedPermissions.length > 0) {
      try {
        // Debug logs to verify what's being sent
        console.log("Selected permissions to assign:", selectedPermissions);
        console.log("Role ID:", roleId);

        if (selectedPermissions.length === 0) {
          toast.error("No valid permissions selected");
          return;
        }

        // Dispatch the action with the valid permission IDs
        await dispatch(
          assignPermissionsToRole({
            roleId,
            permissionIds: selectedPermissions,
          })
        ).unwrap();

        setIsPermissionDialogOpen(false);
        setSelectedPermissions([]);
        dispatch(fetchRoleById(roleId)); // Refresh role data
        toast.success("Permissions assigned to role");
      } catch (error) {
        console.error("Failed to assign permissions:", error);
        toast.error("Failed to assign permissions");
      }
    } else {
      // Show an error message if attempting to add with no selections
      if (roleId && selectedPermissions.length === 0) {
        toast.error("Please select at least one permission to assign");
      }
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  if (loading && !currentRole) {
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

  if (!currentRole) {
    return <div className="p-4 text-center">Role not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/dashboard/roles"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to roles
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {currentRole.name}
          </h2>
          <p className="text-sm text-muted-foreground space-y-1">
            <span className="block">
              Description: {currentRole.description || "No description"}
            </span>
            <span className="block">
              Created: {formatDate(currentRole.created_at)}
            </span>
            <span className="block">
              Updated: {formatDate(currentRole.updated_at)}
            </span>
            {currentRole.created_by && (
              <span className="block">
                Created by: {currentRole.created_by.email}
              </span>
            )}
            {currentRole.role_group_id && (
              <span className="block">
                <Link
                  to={`/dashboard/role-groups/${currentRole.role_group_id}`}
                  className="hover:underline focus:outline-none focus:text-primary"
                >
                  Role Group: {currentRole.role_group_id}
                </Link>
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/roles/edit/${roleId}`)}
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
                  this role from the system.
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

      {/* Assigned Permissions Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Assigned Permissions</CardTitle>
            <CardDescription>Permissions granted to this role</CardDescription>
          </div>
          <Dialog
            open={isPermissionDialogOpen}
            onOpenChange={setIsPermissionDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Permissions
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Assign Permissions to Role</DialogTitle>
                <DialogDescription>
                  Select permissions to assign to this role.
                </DialogDescription>
              </DialogHeader>

              {/* Search input */}
              <div className="flex items-center border rounded-md px-3 my-2">
                <Search className="h-4 w-4 text-muted-foreground mr-2" />
                <Input
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="border-0 focus-visible:ring-0"
                />
              </div>

              <div className="py-4 max-h-80 overflow-y-auto">
                {filteredPermissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {permissions.length === 0
                      ? "No permissions available in the system"
                      : "No available permissions to assign"}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {filteredPermissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.includes(permission.id)}
                          onCheckedChange={() =>
                            togglePermissionSelection(permission.id)
                          }
                        />
                        <label
                          htmlFor={permission.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {permission.name}
                          {permission.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {permission.description}
                            </p>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <div className="w-full flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {selectedPermissions.length} permission(s) selected
                  </span>
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => setIsPermissionDialogOpen(false)}
                      className="mr-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddPermissions}
                      disabled={selectedPermissions.length === 0}
                    >
                      Assign Selected Permissions
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {currentRole.permissions && currentRole.permissions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRole.permissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-medium">
                        {permission.name}
                      </TableCell>
                      <TableCell>{permission.description || "N/A"}</TableCell>
                      <TableCell>
                        {permission.group?.name || "No group"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemovePermission(permission.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove permission</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto opacity-20 mb-2" />
              <p>No permissions assigned to this role</p>
              <p className="text-sm mt-1">
                Click "Add Permissions" to assign permissions to this role.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleDetail;
