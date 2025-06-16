import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Role } from '@/models/role';
import { RoleGroup } from '@/models/roleGroup';
import { Permission } from '@/models/permission';
import permissionService from '@/services/permission.service';

// Zod schema for validation
const roleSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Role name is required' })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        'Role name can only contain letters, numbers, underscores, and hyphens',
    }),
  description: z.string().optional(),
  role_group_id: z.string().optional(),
  permission_ids: z.array(z.string()).optional(),
});

export type RoleFormData = z.infer<typeof roleSchema>;

interface RoleFormProps {
  onSubmit: SubmitHandler<RoleFormData>;
  onCancel?: () => void;
  initialData?: Role | null;
  isLoading?: boolean;
  roleGroups: RoleGroup[];
}

const RoleForm: React.FC<RoleFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isLoading,
  roleGroups,
}) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      role_group_id: initialData?.role_group_id || undefined,
      permission_ids: initialData?.permissions?.map((p) => p.id) || [],
    },
  });

  // Load permissions on component mount
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const response = await permissionService.getPermissions(1, 100);
        setPermissions(response.data.items || []);
      } catch (error) {
        console.error('Failed to load permissions:', error);
      }
    };
    loadPermissions();
  }, []);

  // Update selected permissions when initialData changes
  useEffect(() => {
    if (initialData?.permissions) {
      setSelectedPermissions(initialData.permissions.map((p) => p.id));
    }
  }, [initialData]);

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    const updatedPermissions = checked
      ? [...selectedPermissions, permissionId]
      : selectedPermissions.filter((id) => id !== permissionId);

    setSelectedPermissions(updatedPermissions);
    form.setValue('permission_ids', updatedPermissions);
  };

  const handleFormSubmit = (data: RoleFormData) => {
    onSubmit({
      ...data,
      permission_ids: selectedPermissions,
    });
  };

  // Update default values if initialData changes (e.g., after fetch)
  React.useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        description: initialData.description || '',
        role_group_id: initialData.role_group_id,
      });
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Admin, Editor" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role_group_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role Group</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role group" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="root">None</SelectItem>
                  {roleGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the role's purpose"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Permissions Selection */}
        <div>
          <FormLabel className="text-base font-medium">Permissions</FormLabel>
          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border rounded-md p-4">
            {permissions.map((permission) => (
              <div key={permission.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`permission-${permission.id}`}
                  data-testid={`permission-${permission.name}-checkbox`}
                  checked={selectedPermissions.includes(permission.id)}
                  onCheckedChange={(checked) =>
                    handlePermissionChange(permission.id, checked as boolean)
                  }
                  aria-label={permission.name}
                />
                <label
                  htmlFor={`permission-${permission.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {permission.name}
                </label>
                <span className="text-xs text-muted-foreground">
                  {permission.description}
                </span>
              </div>
            ))}
            {permissions.length === 0 && (
              <p
                className="text-sm text-muted-foreground"
                data-testid="loading-permissions"
              >
                Loading permissions...
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? 'Saving...'
              : initialData
                ? 'Save Changes'
                : 'Create Role'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default RoleForm;
