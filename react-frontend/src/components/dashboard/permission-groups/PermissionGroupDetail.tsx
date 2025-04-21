import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../hooks/redux";
import {
  fetchPermissionGroupById,
  deletePermissionGroup,
} from "../../../store/slices/permissionGroupSlice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pencil, Trash2, ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RootState } from "../../../store";
import { PermissionGroup, Permission } from "../../../models/permission";

export default function PermissionGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

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
    if (id) {
      dispatch(fetchPermissionGroupById(id));
    }
  }, [dispatch, id]);

  const handleEdit = () => {
    navigate(`/dashboard/permission-groups/edit/${id}`);
  };

  const handleDelete = async () => {
    if (!id) return;

    if (
      window.confirm("Are you sure you want to delete this permission group?")
    ) {
      try {
        await dispatch(deletePermissionGroup(id)).unwrap();
        navigate("/dashboard/permission-groups");
      } catch (error) {
        console.error("Error deleting permission group:", error);
      }
    }
  };

  const handleBack = () => {
    navigate("/dashboard/permission-groups");
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
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <Button
          variant="ghost"
          className="mb-2 p-0 h-8 w-8"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CardTitle className="text-2xl">
          {currentPermissionGroup.name}
          {currentPermissionGroup.permission_group_id && (
            <Badge variant="outline" className="ml-2">
              Child Group
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium text-sm text-gray-500">Group ID</h3>
            <p className="truncate">{currentPermissionGroup.id}</p>
          </div>
          {parentGroupName && (
            <div>
              <h3 className="font-medium text-sm text-gray-500">
                Parent Group
              </h3>
              <p>{parentGroupName}</p>
            </div>
          )}
          <div>
            <h3 className="font-medium text-sm text-gray-500">Created At</h3>
            <p>
              {new Date(currentPermissionGroup.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <h3 className="font-medium text-sm text-gray-500">Updated At</h3>
            <p>
              {new Date(currentPermissionGroup.updated_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Child Groups Section */}
        {currentPermissionGroup.groups &&
          currentPermissionGroup.groups.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Child Groups</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPermissionGroup.groups.map(
                      (group: PermissionGroup) => (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">
                            {group.name}
                          </TableCell>
                          <TableCell>
                            {new Date(group.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

        {/* Permissions Section */}
        {currentPermissionGroup.permissions &&
          currentPermissionGroup.permissions.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Permissions</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPermissionGroup.permissions.map(
                      (permission: Permission) => (
                        <TableRow key={permission.id}>
                          <TableCell className="font-medium">
                            {permission.name}
                          </TableCell>
                          <TableCell>{permission.description}</TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 border-t p-4">
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
      </CardFooter>
    </Card>
  );
}
