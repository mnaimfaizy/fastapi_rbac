import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import {
  fetchPermissionById,
  createPermission,
  updatePermission,
} from "../../store/slices/permissionSlice";
import { fetchPermissionGroups } from "../../store/slices/permissionGroupSlice";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { RootState } from "../../store";
import { PermissionGroup } from "../../models/permission";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  group_id: z.string().min(1, "Permission Group is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function PermissionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isEdit = !!id;

  const { currentPermission, isLoading: permissionLoading } = useAppSelector(
    (state: RootState) => state.permission
  );
  const { permissionGroups, isLoading: groupsLoading } = useAppSelector(
    (state: RootState) => state.permissionGroup
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      group_id: "",
    },
  });

  // Load permission data for editing
  useEffect(() => {
    if (isEdit && id) {
      dispatch(fetchPermissionById(id));
    }
    // Always fetch permission groups for the dropdown
    dispatch(fetchPermissionGroups({}));
  }, [dispatch, isEdit, id]);

  // Fill form with current permission data when editing
  useEffect(() => {
    if (isEdit && currentPermission) {
      form.reset({
        name: currentPermission.name,
        description: currentPermission.description || "",
        group_id: currentPermission.group_id,
      });
    }
  }, [currentPermission, form, isEdit]);

  const onSubmit = async (data: FormValues) => {
    try {
      if (isEdit && id) {
        await dispatch(
          updatePermission({
            id,
            permissionData: data,
          })
        ).unwrap();
      } else {
        await dispatch(createPermission(data)).unwrap();
      }
      navigate("/dashboard/permissions");
    } catch (error) {
      console.error("Error saving permission:", error);
    }
  };

  const handleCancel = () => {
    navigate("/dashboard/permissions");
  };

  const isLoading = permissionLoading || (isEdit && !currentPermission);
  const isLoadingGroups = groupsLoading;

  if (isEdit && isLoading) {
    return <div className="text-center p-4">Loading permission data...</div>;
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
          {isEdit ? "Edit Permission" : "Create Permission"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter permission name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description (optional)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="group_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permission Group</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a permission group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingGroups ? (
                        <SelectItem value="loading_groups" disabled>
                          Loading groups...
                        </SelectItem>
                      ) : permissionGroups.length > 0 ? (
                        permissionGroups.map((group: PermissionGroup) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no_groups_available" disabled>
                          No groups available
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
