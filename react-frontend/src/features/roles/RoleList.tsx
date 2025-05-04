import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import { fetchRoles, deleteRole } from "../../store/slices/roleSlice";
import { fetchRoleGroups } from "../../store/slices/roleGroupSlice";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Role } from "@/models/role";
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
import { toast } from "sonner";
import { Eye, Edit, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert imports

const RoleList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { roles, pagination, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const { roleGroups } = useSelector((state: RootState) => state.roleGroup);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // Or get from config/state

  useEffect(() => {
    dispatch(fetchRoles({ page: currentPage, size: pageSize }));
    // Fetch all role groups to display group names
    dispatch(fetchRoleGroups({ page: 1, size: 100 }));
  }, [dispatch, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleView = (roleId: string) => {
    navigate(`/dashboard/roles/${roleId}`);
  };

  const handleEdit = (roleId: string) => {
    navigate(`/dashboard/roles/edit/${roleId}`); // Navigate to edit page
  };

  const handleDelete = async (roleId: string) => {
    try {
      await dispatch(deleteRole(roleId)).unwrap();
      toast.success("Role deleted successfully");
      dispatch(fetchRoles({ page: currentPage, size: pageSize }));
    } catch (error: unknown) {
      toast.error("Failed to delete role");
      console.error("Failed to delete role:", error);
    }
  };

  const navigateToRoleGroup = (roleGroupId: string) => {
    navigate(`/dashboard/role-groups/${roleGroupId}`);
  };

  const getRoleGroupName = (groupId: string | undefined) => {
    if (!groupId) return null;
    const group = roleGroups.find((g) => g.id === groupId);
    return group?.name;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return !isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
  };

  return (
    <div className="space-y-4">
      {/* Display error message using Alert component if error exists */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Error loading roles: {error}</AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Role Group</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Show loading indicator within the table body */}
          {loading && (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                Loading roles...
              </TableCell>
            </TableRow>
          )}
          {/* Show roles if not loading and roles exist */}
          {!loading && roles.length > 0
            ? roles.map((role: Role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description || "-"}</TableCell>
                  <TableCell>
                    {role.role_group_id ? (
                      <button
                        onClick={() => navigateToRoleGroup(role.role_group_id!)}
                        className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
                      >
                        {getRoleGroupName(role.role_group_id) || "View Group"}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">No group</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(role.created_at)}</TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(role.id)}
                      className="mr-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(role.id)}
                      className="mr-1"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Are you absolutely sure?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the role "{role.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(role.id)}
                          >
                            Continue
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            : // Show "No roles found" only if not loading and roles array is empty
              !loading &&
              roles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No roles found.
                  </TableCell>
                </TableRow>
              )}
        </TableBody>
      </Table>

      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default RoleList;
