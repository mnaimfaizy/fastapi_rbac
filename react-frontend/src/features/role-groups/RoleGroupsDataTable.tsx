import {
  fetchRoleGroups,
  deleteRoleGroup,
} from "../../store/slices/roleGroupSlice";
import { AppDispatch } from "../../store";
import { toast } from "sonner";

interface RoleGroupsDataTableProps {
  page: number;
  size: number; // Changed from pageSize to size to match PaginationParams type
  dispatch: AppDispatch;
}

export const RoleGroupsDataTable: React.FC<RoleGroupsDataTableProps> = ({
  page,
  size,
  dispatch,
}) => {
  const handleDelete = async (id: string): Promise<void> => {
    if (window.confirm("Are you sure you want to delete this role group?")) {
      try {
        await dispatch(deleteRoleGroup(id)).unwrap();
        dispatch(fetchRoleGroups({ page, size }));
        toast.success("Role group deleted successfully");
      } catch (error: any) {
        // Extract the most specific error message from the error response
        const errorMessage =
          error.response?.data?.detail ||
          (error instanceof Error
            ? error.message
            : "Failed to delete role group");

        // Use longer duration for conflict errors as they contain important instructions
        const duration =
          errorMessage.includes("has child groups") ||
          errorMessage.includes("has assigned roles")
            ? 8000
            : 5000;

        toast.error(errorMessage, {
          duration: duration,
        });
      }
    }
  };

  // You should replace this with your table JSX
  // Make sure to use the handleDelete function in your table row actions
  return null;
};
