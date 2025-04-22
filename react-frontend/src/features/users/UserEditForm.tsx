import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import userService from "../../services/user.service";
import { User, Role } from "../../models/user";
import { useNavigate } from "react-router-dom";

// Define props interface
interface UserEditFormProps {
  userId?: string;
  onSuccess?: () => void;
}

// Define validation schema with Zod
const userEditSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  is_active: z.boolean().optional(),
  is_superuser: z.boolean().optional(),
  contact_phone: z.string().nullable().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("")),
});

type UserEditFormData = z.infer<typeof userEditSchema>;

/**
 * User Edit Form Component
 * Allows editing existing user or creating a new user
 */
const UserEditForm = ({ userId, onSuccess }: UserEditFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserEditFormData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      is_active: true,
      is_superuser: false,
      contact_phone: null,
      password: "",
    },
  });

  // Load user data if editing an existing user
  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;

      setIsLoading(true);
      setError(null);

      try {
        const userData = await userService.getUserById(userId);
        setUser(userData);
        reset({
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          is_active: userData.is_active,
          is_superuser: userData.is_superuser,
          contact_phone: userData.contact_phone,
          password: "", // Don't pre-fill the password field
        });
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load user data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId, reset]);

  const onSubmit = async (data: UserEditFormData) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Remove empty password from data if provided
      if (data.password === "") {
        delete data.password;
      }

      if (userId) {
        // Update existing user
        await userService.updateUser(userId, data);
        setSuccess(true);
        setUser((prevUser) => (prevUser ? { ...prevUser, ...data } : null));
      } else {
        // Create new user (not implemented in this component)
        setError("Creating new users is not implemented in this component");
        return;
      }

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-6">
        {userId ? "Edit User" : "Create User"}
      </h2>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                User updated successfully
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Name */}
          <div>
            <label
              htmlFor="first_name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              First Name
            </label>
            <input
              id="first_name"
              {...register("first_name")}
              type="text"
              className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="First Name"
              disabled={isLoading}
            />
            {errors.first_name && (
              <p className="mt-1 text-sm text-red-600">
                {errors.first_name.message}
              </p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label
              htmlFor="last_name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Last Name
            </label>
            <input
              id="last_name"
              {...register("last_name")}
              type="text"
              className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Last Name"
              disabled={isLoading}
            />
            {errors.last_name && (
              <p className="mt-1 text-sm text-red-600">
                {errors.last_name.message}
              </p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email Address
          </label>
          <input
            id="email"
            {...register("email")}
            type="email"
            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Email Address"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password (only for updates) */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password {userId && "(leave blank to keep current)"}
          </label>
          <input
            id="password"
            {...register("password")}
            type="password"
            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder={
              userId ? "Leave blank to keep current password" : "Password"
            }
            disabled={isLoading}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Contact Phone */}
        <div>
          <label
            htmlFor="contact_phone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Contact Phone (optional)
          </label>
          <input
            id="contact_phone"
            {...register("contact_phone")}
            type="tel"
            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Contact Phone"
            disabled={isLoading}
          />
        </div>

        {/* Checkboxes row */}
        <div className="flex space-x-6">
          {/* Active Status */}
          <div className="flex items-center">
            <input
              id="is_active"
              {...register("is_active")}
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              disabled={isLoading}
            />
            <label
              htmlFor="is_active"
              className="ml-2 block text-sm text-gray-900"
            >
              Active User
            </label>
          </div>

          {/* Superuser Status */}
          <div className="flex items-center">
            <input
              id="is_superuser"
              {...register("is_superuser")}
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              disabled={isLoading}
            />
            <label
              htmlFor="is_superuser"
              className="ml-2 block text-sm text-gray-900"
            >
              Superuser
            </label>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
            disabled={isLoading}
          >
            {isLoading
              ? userId
                ? "Updating..."
                : "Creating..."
              : userId
              ? "Update User"
              : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserEditForm;
