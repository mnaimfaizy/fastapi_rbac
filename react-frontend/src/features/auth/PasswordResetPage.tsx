import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { ErrorResponse, ErrorResponseWithErrors } from '@/models/auth';

// Define validation schema with Zod
const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    // .regex(
    //   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    //   'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    // ),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

const PasswordResetPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { isLoading, error, passwordResetSuccess } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();

  // Redirect if no token is provided
  useEffect(() => {
    if (!token) {
      navigate('/password-reset-request', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    console.log('Error:', error);
  }, [error]);

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
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
          // Corrected action name
          token,
          newPassword: data.password,
        })
      ).unwrap();
    } catch {
      // Error is handled by the auth slice
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <Card className="w-full max-w-s flex items-center justify-center">
        <CardHeader className="text-center w-full">
          <CardTitle className="text-3xl font-extrabold">
            Reset Your Password
          </CardTitle>
          <CardDescription>
            {passwordResetSuccess
              ? 'Your password has been reset successfully'
              : 'Enter your new password below'}
          </CardDescription>
        </CardHeader>

        <CardContent className="w-full">
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
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {typeof error === 'object' &&
                    Object.keys(error).includes('detail') ? (
                      <>
                        <span>
                          {(error as ErrorResponseWithErrors)?.detail?.message}
                        </span>
                        <ul>
                          {(
                            (error as ErrorResponseWithErrors)?.detail
                              ?.errors ?? []
                          ).map((err: string, index) => (
                            <li
                              key={err + index}
                              className="text-xs text-red-600 pl-2"
                            >
                              {`-> ${err}`}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : typeof error === 'object' ? (
                      <span>{(error as ErrorResponse)?.message}</span>
                    ) : (
                      <span>{error as string}</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter new password"
                  {...register('password')}
                />
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

export default PasswordResetPage;
