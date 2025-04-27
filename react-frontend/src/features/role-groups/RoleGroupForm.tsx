import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { RoleGroup } from "@/models/roleGroup";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Define form schema with Zod
const roleGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

// Define form value types
type RoleGroupFormValues = z.infer<typeof roleGroupSchema>;

interface RoleGroupFormProps {
  initialData?: RoleGroup | null;
  isLoading: boolean;
  error: string | null;
  onSubmit: (data: RoleGroupFormValues) => void;
}

const RoleGroupForm: React.FC<RoleGroupFormProps> = ({
  initialData,
  isLoading,
  error,
  onSubmit,
}) => {
  // Create form with validation
  const form = useForm<RoleGroupFormValues>({
    resolver: zodResolver(roleGroupSchema),
    defaultValues: {
      name: initialData?.name || "",
    },
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
      });
    }
  }, [initialData, form]);

  // Handle form submission
  const handleSubmit = (data: RoleGroupFormValues) => {
    onSubmit(data);
  };

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

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded">
          {error}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter role group name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-3">
            <Link to="/dashboard/role-groups">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Saving..."
                : initialData
                ? "Update Role Group"
                : "Create Role Group"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default RoleGroupForm;
