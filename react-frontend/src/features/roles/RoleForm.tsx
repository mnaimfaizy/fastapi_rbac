import React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

// Zod schema for validation
const roleSchema = z.object({
  name: z.string().min(1, { message: 'Role name is required' }),
  description: z.string().optional(),
  role_group_id: z.string().optional(),
});

export type RoleFormData = z.infer<typeof roleSchema>;

interface RoleFormProps {
  onSubmit: SubmitHandler<RoleFormData>;
  initialData?: Role | null;
  isLoading?: boolean;
  roleGroups: RoleGroup[];
}

const RoleForm: React.FC<RoleFormProps> = ({
  onSubmit,
  initialData,
  isLoading,
  roleGroups,
}) => {
  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      role_group_id: initialData?.role_group_id || undefined,
    },
  });

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? 'Saving...'
            : initialData
              ? 'Update Role'
              : 'Create Role'}
        </Button>
      </form>
    </Form>
  );
};

export default RoleForm;
