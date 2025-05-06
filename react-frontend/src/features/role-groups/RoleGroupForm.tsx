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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define form schema with Zod
const roleGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  parent_id: z.string().optional(),
});

// Define form value types
type RoleGroupFormValues = z.infer<typeof roleGroupSchema>;

interface RoleGroupFormProps {
  initialData?: RoleGroup | null;
  isLoading: boolean;
  error: string | null;
  onSubmit: (data: RoleGroupFormValues) => void;
  availableParents?: RoleGroup[];
}

const RoleGroupForm: React.FC<RoleGroupFormProps> = ({
  initialData,
  isLoading,
  error,
  onSubmit,
  availableParents = [],
}) => {
  // Create form with validation
  const form = useForm<RoleGroupFormValues>({
    resolver: zodResolver(roleGroupSchema),
    defaultValues: {
      name: initialData?.name || "",
      parent_id: initialData?.parent_id || undefined,
    },
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        parent_id: initialData.parent_id,
      });
    }
  }, [initialData, form]);

  // Filter out the current group and its descendants from available parents
  const filteredParents = initialData
    ? availableParents.filter((parent) => parent.id !== initialData.id)
    : availableParents;

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

          <FormField
            control={form.control}
            name="parent_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Group (Optional)</FormLabel>
                <Select
                  onValueChange={(value) =>
                    field.onChange(value === "root" ? undefined : value)
                  }
                  defaultValue={field.value || "root"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a parent group" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="root">None</SelectItem>
                    {filteredParents.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
