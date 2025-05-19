import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { createPermission } from '../../store/slices/permissionSlice';
import { fetchPermissionGroups } from '../../store/slices/permissionGroupSlice';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  group_id: z.string().min(1, 'Permission Group is required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function PermissionForm() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { permissionGroups, isLoading: groupsLoading } = useAppSelector(
    (state) => state.permissionGroup
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      group_id: '',
    },
  });

  // Always fetch permission groups for the dropdown
  useEffect(() => {
    dispatch(fetchPermissionGroups({}));
  }, [dispatch]);

  const onSubmit = async (data: FormValues) => {
    try {
      await dispatch(createPermission(data)).unwrap();
      navigate('/dashboard/permissions');
    } catch (error) {
      console.error('Error saving permission:', error);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard/permissions');
  };

  const isLoading = false;
  const isLoadingGroups = groupsLoading;

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
        <CardTitle>Create Permission</CardTitle>
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
                      placeholder="Enter permission description"
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
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a permission group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {permissionGroups.map((group) => (
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

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isLoadingGroups}>
                Create Permission
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
