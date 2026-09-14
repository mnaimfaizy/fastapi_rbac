import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  confirmPasswordReset,
  clearError,
  resetPasswordResetSuccess,
} from '../../store/slices/authSlice';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// shadcn UI components
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { CheckCircle } from 'lucide-react';
import { ApiErrorAlert } from '@/components/auth/ApiErrorAlert';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { passwordPolicySchema } from '@/lib/passwordPolicySchema';

// Define validation schema with Zod
const resetPasswordSchema = z
  .object({
    password: passwordPolicySchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

const PasswordResetConfirmPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null);

  const { isLoading, error, passwordResetSuccess } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();

  // Extract token from URL query parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tokenFromQuery = queryParams.get('token');

    if (tokenFromQuery) {
      setToken(tokenFromQuery);
    } else {
      // Redirect if no token is provided
      navigate('/password-reset', { replace: true });
    }
  }, [location.search, navigate]);

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Reset the passwordResetSuccess state when component unmounts
  useEffect(() => {
    return () => {
      dispatch(resetPasswordResetSuccess());
    };
  }, [dispatch]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (isLoading || !token) return;

    // Clear any previous errors
    dispatch(clearError());

    try {
      // Dispatch password reset action with token and new password
      await dispatch(
        confirmPasswordReset({
          token,
          newPassword: data.password,
        })
      ).unwrap();
    } catch (error) {
      // Error is handled by the auth slice
      console.log('Error during password reset:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold">
            Reset Your Password
          </CardTitle>
          <CardDescription>
            {passwordResetSuccess
              ? 'Your password has been reset successfully'
              : 'Enter your new password below'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {passwordResetSuccess ? (
            <div className="space-y-6">
              <Alert className="border-green-500 bg-green-50 text-green-700">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Your password has been reset successfully. You can now log in
                  with your new password.
                </AlertDescription>
              </Alert>

              <Button asChild className="w-full">
                <Link to="/login">Go to Login</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {error && (
                <ApiErrorAlert
                  error={error}
                  fallbackMessage="Password reset failed. Please try again."
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter new password"
                  {...register('password')}
                />
                <PasswordRequirements value={watch('password') ?? ''} />
                {errors.password && (
                  <p className="text-sm text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-600">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !token}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordResetConfirmPage;
