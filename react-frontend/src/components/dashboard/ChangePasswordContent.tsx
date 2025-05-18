import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  changePassword,
  clearError,
  resetPasswordChangeSuccess,
} from '../../store/slices/authSlice';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle } from 'lucide-react';

// Define validation schema with Zod
const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
      ),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

const ChangePasswordContent = () => {
  const { isLoading, error, passwordChangeSuccess } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Reset form and success state when unmounting
  useEffect(() => {
    return () => {
      dispatch(resetPasswordChangeSuccess());
    };
  }, [dispatch]);

  // Reset form after successful password change
  useEffect(() => {
    if (passwordChangeSuccess) {
      reset();
    }
  }, [passwordChangeSuccess, reset]);

  const onSubmit = async (data: PasswordChangeFormData) => {
    if (isLoading) return;

    // Clear any previous errors
    dispatch(clearError());

    try {
      // Dispatch password change action
      await dispatch(
        changePassword({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        })
      ).unwrap();
    } catch (error) {
      // Error is handled by the auth slice
      console.error('Error changing password:', error);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight mb-6">
        Change Password
      </h2>

      <div className="max-w-xl bg-white rounded-lg shadow-md p-6">
        {passwordChangeSuccess && (
          <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            <AlertDescription>Password successfully changed!</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200 text-red-800">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              {...register('currentPassword')}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              {...register('newPassword')}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordContent;
