import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import userService from '../../services/user.service';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchAllRoles } from '../../store/slices/roleSlice';
import { updateUser, createUser } from '../../store/slices/userSlice';
import { toast } from 'sonner';

// Import ShadCN UI Components
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define props interface
interface UserEditFormProps {
  userId?: string;
  onSuccess?: () => void;
}

// Define validation schema with Zod
const userEditSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  is_active: z.boolean().optional(),
  is_superuser: z.boolean().optional(),
  contact_phone: z.string().optional(), // Changed from nullable to optional
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .optional()
    .or(z.literal('')),
  role_id: z.array(z.string()).optional(), // Add role_id field
});

type UserEditFormData = z.infer<typeof userEditSchema>;

// Define form field names type
type FormFields = keyof UserEditFormData;

// Define error types
interface ValidationError {
  loc: string[];
  msg: string;
  type: string;
}

interface ApiError {
  field?: string;
  message: string;
}

interface ApiResponse {
  detail?: ValidationError[] | string;
  errors?: ApiError[];
  message?: string;
}

interface UserWithRoles {
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  contact_phone: string | null;
  roles?: { id: string }[];
}

/**
 * User Edit Form Component
 * Allows editing existing user or creating a new user
 */
const UserEditForm = ({ userId, onSuccess }: UserEditFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Get all roles from Redux store
  const {
    allRoles,
    loading: rolesLoading,
    error: rolesError,
  } = useSelector((state: RootState) => state.role);

  // Initialize React Hook Form with Zod validation
  const form = useForm<UserEditFormData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      is_active: true,
      is_superuser: false,
      contact_phone: '', // Change to empty string instead of null
      password: '',
      role_id: [], // Initialize role_id as empty array
    },
  });

  // Watch role_id value with useEffect to avoid hook dependency issues
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    // Subscribe to role_id field changes
    const subscription = form.watch((value, { name }) => {
      if (name === 'role_id') {
        const roleIds = value.role_id as string[] | undefined;
        setSelectedRoleIds(
          roleIds?.filter((id): id is string => id !== undefined) || []
        );
      }
    });

    // Set initial value
    const initialRoles = form.getValues('role_id');
    setSelectedRoleIds(
      initialRoles?.filter((id): id is string => id !== undefined) || []
    );

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [form]);

  // Filter allRoles to get the selected roles objects
  const selectedRoles = useMemo(
    () => allRoles.filter((role) => selectedRoleIds.includes(role.id)),
    [allRoles, selectedRoleIds]
  );

  // Filter available roles to exclude already selected roles
  const availableRoles = useMemo(
    () => allRoles.filter((role) => !selectedRoleIds.includes(role.id)),
    [allRoles, selectedRoleIds]
  );

  // Fetch all roles when the component mounts
  useEffect(() => {
    dispatch(fetchAllRoles());
  }, [dispatch]);

  // Load user data if editing an existing user
  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;

      setIsLoading(true);
      setError(null);

      try {
        const userData = (await userService.getUserById(
          userId
        )) as UserWithRoles;
        form.reset({
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          is_active: userData.is_active,
          is_superuser: userData.is_superuser,
          contact_phone: userData.contact_phone || '', // Convert null to empty string
          password: '', // Don't pre-fill the password field
          role_id: userData.roles?.map((role) => role.id) || [], // Pre-fill role IDs
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to load user data';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId, form]);

  const onSubmit = async (data: UserEditFormData) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Prepare the role IDs for the backend
      const payload = {
        ...data,
        role_id: data.role_id || [], // Ensure role_id is always an array
      };

      // Remove empty password from data if provided
      if (payload.password === '') {
        delete payload.password;
      }

      if (userId) {
        // Update existing user using Redux action
        const resultAction = await dispatch(
          updateUser({ userId, userData: payload })
        );

        if (updateUser.fulfilled.match(resultAction)) {
          setSuccess(true);
          toast.success('User updated successfully');
          // Navigate after a short delay to show the success message
          setTimeout(() => {
            if (onSuccess) {
              onSuccess();
            } else {
              navigate('/dashboard/users');
            }
          }, 1500);
        } else if (updateUser.rejected.match(resultAction)) {
          handleApiError(resultAction.payload);
        }
      } else {
        // Create new user
        if (!payload.password) {
          form.setError('password', {
            message: 'Password is required for new users',
          });
          toast.error('Password is required for new users');
          setIsLoading(false);
          return;
        }

        const resultAction = await dispatch(createUser(payload));
        if (createUser.fulfilled.match(resultAction)) {
          setSuccess(true);
          toast.success('User created successfully');
          // Navigate after a short delay to show the success message
          setTimeout(() => {
            if (onSuccess) {
              onSuccess();
            } else {
              navigate('/dashboard/users');
            }
          }, 1500);
        } else if (createUser.rejected.match(resultAction)) {
          handleApiError(resultAction.payload);
        }
      }

      // Call onSuccess callback if the update was successful
      if (userId && onSuccess && success) {
        onSuccess();
      }
    } catch (error: unknown) {
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiError = (error: unknown) => {
    let errorMessage = 'An unexpected error occurred';

    if (typeof error === 'string') {
      errorMessage = error;
    } else if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response
    ) {
      const responseData = error.response as { data?: ApiResponse };

      if (responseData.data?.detail) {
        if (Array.isArray(responseData.data.detail)) {
          // Handle multiple validation errors - set form errors directly
          responseData.data.detail.forEach((err: ValidationError) => {
            const field = err.loc[err.loc.length - 1];
            // Only set error if the field exists in our form
            if (Object.keys(userEditSchema.shape).includes(field)) {
              form.setError(field as FormFields, { message: err.msg });
            }
          });
          errorMessage = 'Please fix the validation errors';
        } else {
          errorMessage = responseData.data.detail;
        }
      }
      // Handle custom error format
      else if (responseData.data?.errors) {
        responseData.data.errors.forEach((err: ApiError) => {
          if (
            err.field &&
            Object.keys(userEditSchema.shape).includes(err.field)
          ) {
            form.setError(err.field as FormFields, { message: err.message });
          }
        });
        errorMessage = responseData.data.message || 'Failed to save user';
      }
      // Handle generic error messages
      else if (responseData.data?.message) {
        errorMessage = responseData.data.message;
      }
    }

    setError(errorMessage);
    toast.error(errorMessage);

    // Scroll to the error message
    const errorAlert = document.querySelector('[role="alert"]');
    if (errorAlert) {
      errorAlert.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // --- Role Selection UI ---
  return (
    <Card>
      <CardHeader>
        <CardTitle>{userId ? 'Edit User' : 'Create User'}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6" role="alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>User updated successfully</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="First Name"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Last Name"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Email Address"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Password {userId && '(leave blank to keep current)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder={
                        userId
                          ? 'Leave blank to keep current password'
                          : 'Password'
                      }
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Contact Phone"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-6">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Active User</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_superuser"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Superuser</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            {/* Role Selection */}
            <div className="mt-6 border-t pt-6">
              <FormField
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Roles</FormLabel>
                    {rolesLoading && <p>Loading roles...</p>}
                    {rolesError && (
                      <p className="text-sm text-destructive">
                        Error loading roles: {rolesError}
                      </p>
                    )}
                    {!rolesLoading && !rolesError && (
                      <>
                        <Popover
                          open={popoverOpen}
                          onOpenChange={setPopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={popoverOpen}
                                className="w-full justify-between"
                                disabled={isLoading}
                              >
                                <span className="truncate">
                                  {selectedRoles.length > 0
                                    ? selectedRoles
                                        .map((role) => role.name)
                                        .join(', ')
                                    : 'Select roles...'}
                                </span>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="ml-2 h-5 w-5 shrink-0 opacity-50"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.24a.75.75 0 011.06 0L10 14.148l2.7-2.908a.75.75 0 111.06 1.06l-3.25 3.5a.75.75 0 01-1.06 0l-3.25-3.5a.75.75 0 010-1.06z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Search roles..." />
                              <CommandList>
                                <CommandEmpty>No roles found.</CommandEmpty>
                                <CommandGroup>
                                  {availableRoles.map((role) => (
                                    <CommandItem
                                      key={role.id}
                                      value={role.name}
                                      onSelect={() => {
                                        const currentValues = field.value || [];
                                        field.onChange([
                                          ...currentValues,
                                          role.id,
                                        ]);
                                        setPopoverOpen(false); // Close popover after selection
                                      }}
                                    >
                                      <Checkbox
                                        checked={false}
                                        onCheckedChange={() => {
                                          const currentValues =
                                            field.value || [];
                                          field.onChange([
                                            ...currentValues,
                                            role.id,
                                          ]);
                                          setPopoverOpen(false); // Close popover after selection
                                        }}
                                        className="mr-2"
                                      />
                                      {role.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {selectedRoles.map((role) => (
                            <Badge
                              key={role.id}
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() => {
                                const currentValues = field.value || [];
                                field.onChange(
                                  currentValues.filter((id) => id !== role.id)
                                );
                              }}
                            >
                              {role.name} ×
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                onClick={() => navigate(-1)}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? userId
                    ? 'Updating...'
                    : 'Creating...'
                  : userId
                    ? 'Update User'
                    : 'Create User'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default UserEditForm;
