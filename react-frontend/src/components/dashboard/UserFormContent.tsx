"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import {
  fetchUserById,
  createUser,
  updateUser,
  clearSelectedUser,
} from "../../store/slices/userSlice";
import { User, Role } from "../../models/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Define form schema with Zod
const userFormSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    is_active: z.boolean().default(true),
    is_superuser: z.boolean().default(false),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional(),
    confirm_password: z.string().optional(),
    role_ids: z.array(z.string()).default([]),
  })
  .refine((data) => !data.password || data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type UserFormValues = z.infer<typeof userFormSchema>;

const UserFormContent = () => {
  const { userId } = useParams<{ userId: string }>();
  const isEditMode = Boolean(userId);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { selectedUser, loading, error } = useSelector(
    (state: RootState) => state.user
  );

  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // Initialize the form with Shadcn UI Form
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      is_active: true,
      is_superuser: false,
      password: "",
      confirm_password: "",
      role_ids: [],
    },
  });

  // Fetch user data if in edit mode
  useEffect(() => {
    if (isEditMode && userId) {
      dispatch(fetchUserById(userId));
    }

    // Cleanup on component unmount
    return () => {
      dispatch(clearSelectedUser());
    };
  }, [dispatch, isEditMode, userId]);

  // Fetch available roles
  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoadingRoles(true);
      try {
        // This would be replaced with a call to a role service
        // For now, we'll mock the available roles
        setAvailableRoles([
          { id: "1", name: "admin" },
          { id: "2", name: "manager" },
          { id: "3", name: "user" },
        ]);
      } catch (error) {
        console.error("Failed to fetch roles:", error);
      } finally {
        setIsLoadingRoles(false);
      }
    };

    fetchRoles();
  }, []);

  // Populate form when selectedUser changes (for edit mode)
  useEffect(() => {
    if (isEditMode && selectedUser) {
      form.reset({
        email: selectedUser.email,
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        is_active: selectedUser.is_active,
        is_superuser: selectedUser.is_superuser,
        // Password fields are empty in edit mode
        password: "",
        confirm_password: "",
        // Set selected roles if available
        role_ids: selectedUser.roles?.map((role) => role.id) || [],
      });
    }
  }, [isEditMode, selectedUser, form]);

  const onSubmit = async (data: UserFormValues) => {
    try {
      if (isEditMode && userId) {
        // Remove password fields if empty (don't update password)
        const updateData = { ...data };
        if (!updateData.password) {
          delete updateData.password;
          delete updateData.confirm_password;
        }

        await dispatch(updateUser({ userId, userData: updateData })).unwrap();
      } else {
        // Create mode requires password
        await dispatch(createUser(data)).unwrap();
      }

      // Navigate back to the users list on success
      navigate("/dashboard/users");
    } catch (err) {
      console.error("Failed to save user:", err);
    }
  };

  if (isEditMode && loading && !selectedUser) {
    return (
      <div className="p-4 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {isEditMode ? "Edit User" : "Create New User"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEditMode
            ? "Update user information and permissions"
            : "Add a new user to the system"}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isEditMode ? "User Information" : "New User Details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="user@example.com"
                            type="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
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
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col space-y-3">
                    <FormField
                      control={form.control}
                      name="is_active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Active</FormLabel>
                            <FormDescription>
                              User can log in and access the system
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="is_superuser"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Administrator</FormLabel>
                            <FormDescription>
                              Grant full administrative privileges
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {isEditMode ? "New Password" : "Password"}
                          {!isEditMode && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={
                              isEditMode
                                ? "Leave blank to keep current password"
                                : "Enter password"
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirm_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirm password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role_ids"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel>Assigned Roles</FormLabel>
                          <FormDescription>
                            Select roles to assign to this user
                          </FormDescription>
                        </div>

                        {isLoadingRoles ? (
                          <p className="text-sm text-muted-foreground">
                            Loading roles...
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {availableRoles.map((role) => (
                              <FormField
                                key={role.id}
                                control={form.control}
                                name="role_ids"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={role.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(
                                            role.id
                                          )}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([
                                                  ...field.value,
                                                  role.id,
                                                ])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== role.id
                                                  )
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal mt-0">
                                        {role.name}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/users")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Saving...
                    </>
                  ) : (
                    `${isEditMode ? "Update" : "Create"} User`
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserFormContent;
