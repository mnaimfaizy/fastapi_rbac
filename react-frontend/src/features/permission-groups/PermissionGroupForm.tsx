import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import {
  fetchPermissionGroupById,
  createPermissionGroup,
  updatePermissionGroup,
  fetchPermissionGroups,
  clearCurrentPermissionGroup,
  clearPermissionGroupErrors,
} from "../../store/slices/permissionGroupSlice";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { RootState } from "../../store";
import { PermissionGroup } from "../../models/permission";
import { toast } from "sonner";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  permission_group_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PermissionGroupFormProps {
  id?: string;
  isEdit: boolean;
}

export default function PermissionGroupForm({
  id,
  isEdit,
}: PermissionGroupFormProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentPermissionGroup, permissionGroups, isLoading, error } =
    useAppSelector((state: RootState) => state.permissionGroup);

  // Filter out the current group if editing (can't be its own parent)
  const parentGroupOptions = permissionGroups.filter(
    (group: PermissionGroup) => !isEdit || group.id !== id
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      permission_group_id: "",
    },
  });

  // Load permission group data for editing and parent groups for dropdown
  useEffect(() => {
    dispatch(fetchPermissionGroups({})); // Fetch all groups for parent dropdown

    if (isEdit && id) {
      dispatch(fetchPermissionGroupById(id));
    }

    // Cleanup when component unmounts
    return () => {
      dispatch(clearCurrentPermissionGroup());
      dispatch(clearPermissionGroupErrors());
    };
  }, [dispatch, isEdit, id]);

  // Fill form with current permission group data when editing
  useEffect(() => {
    if (isEdit && currentPermissionGroup) {
      form.reset({
        name: currentPermissionGroup.name,
        permission_group_id: currentPermissionGroup.permission_group_id || "",
      });
    }
  }, [currentPermissionGroup, form, isEdit]);

  const onSubmit = async (data: FormValues) => {
    try {
      // If permission_group_id is "none", set it to null for the API
      const submissionData = {
        ...data,
        permission_group_id:
          data.permission_group_id === "none"
            ? null
            : data.permission_group_id || null,
      };

      if (isEdit && id) {
        await dispatch(
          updatePermissionGroup({
            id,
            groupData: submissionData,
          })
        ).unwrap();
        toast.success("Permission group updated successfully");
      } else {
        await dispatch(createPermissionGroup(submissionData)).unwrap();
        toast.success("Permission group created successfully");
      }
      navigate("/dashboard/permission-groups");
    } catch (error: any) {
      console.error("Error saving permission group:", error);
      toast.error(error?.message || "Failed to save permission group");
    }
  };

  const handleCancel = () => {
    navigate("/dashboard/permission-groups");
  };

  if (isEdit && isLoading && !currentPermissionGroup) {
    return (
      <div className="text-center p-4">Loading permission group data...</div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <Button
          variant="ghost"
          className="mb-2 p-0 h-8 w-8"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CardTitle>
          {isEdit ? "Edit Permission Group" : "Create Permission Group"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 mb-4 bg-destructive/10 border border-destructive text-destructive rounded">
            {error}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter permission group name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permission_group_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Group (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value || "none"}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a parent group (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">
                        None (Top-level group)
                      </SelectItem>
                      {isLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading groups...
                        </SelectItem>
                      ) : parentGroupOptions.length > 0 ? (
                        parentGroupOptions.map((group: PermissionGroup) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no_groups" disabled>
                          No other groups available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button variant="outline" type="button" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isEdit ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
