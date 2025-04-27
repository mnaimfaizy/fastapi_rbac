import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import { fetchRoles, deleteRole } from "../../store/slices/roleSlice"; // Import deleteRole
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
} from "@/components/ui/alert-dialog"; // Import AlertDialog components
import { toast } from "sonner";

const RoleList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { roles, pagination, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // Or get from config/state

  useEffect(() => {
    dispatch(fetchRoles({ page: currentPage, size: pageSize }));
  }, [dispatch, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleEdit = (roleId: string) => {
    navigate(`/dashboard/roles/edit/${roleId}`); // Navigate to edit page
  };

  const handleDelete = async (roleId: string) => {
    try {
      await dispatch(deleteRole(roleId)).unwrap();
      toast("Role deleted successfully.");
      // Optional: Refetch roles if pagination/total count needs precise update
      // dispatch(fetchRoles({ page: currentPage, size: pageSize }));
    } catch (err: any) {
      toast("Failed to delete role.");
      console.error("Failed to delete role:", err);
    }
  };

  if (loading && !roles.length) {
    return <div>Loading roles...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading roles: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.length > 0 ? (
            roles.map((role: Role) => (
              <TableRow key={role.id}>
                <TableCell>{role.name}</TableCell>
                <TableCell>{role.description || "-"}</TableCell>
                <TableCell>
                  {new Date(role.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(role.id)}
                  >
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Delete
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
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                No roles found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pagination && pagination.pages > 1 && (
        <div>
          {/* Basic Pagination Example - Replace with actual ShadCN/UI component */}
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <Button
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
