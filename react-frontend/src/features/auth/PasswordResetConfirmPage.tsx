import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  confirmPasswordReset,
  clearError,
  resetPasswordResetSuccess,
} from "../../store/slices/authSlice";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// shadcn UI components
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";

// Define validation schema with Zod
const resetConfirmSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetConfirmFormData = z.infer<typeof resetConfirmSchema>;

const PasswordResetConfirmPage = () => {
  const { isLoading, error, passwordResetSuccess } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ResetConfirmFormData>({
    resolver: zodResolver(resetConfirmSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // If no token is provided, show an error
  useEffect(() => {
    if (!token) {
      setError("root", {
        type: "manual",
        message: "Invalid or missing reset token",
      });
    }
  }, [token, setError]);

  // If password reset was successful, redirect to login after a delay
  useEffect(() => {
    if (passwordResetSuccess) {
      const timer = setTimeout(() => {
        dispatch(resetPasswordResetSuccess());
        navigate("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [passwordResetSuccess, dispatch, navigate]);

  const onSubmit = async (data: ResetConfirmFormData) => {
    if (isLoading || !token) return;

    // Clear any previous errors
    dispatch(clearError());

    try {
      // Dispatch password reset confirmation action
      await dispatch(
        confirmPasswordReset({ token, newPassword: data.password })
      ).unwrap();
    } catch (_) {
      // Error is handled by the auth slice
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
              ? "Your password has been reset successfully."
              : "Enter your new password below."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {passwordResetSuccess ? (
            <div className="space-y-6">
              <Alert className="border-green-500 bg-green-50 text-green-700">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Password has been reset successfully. Redirecting to login...
                </AlertDescription>
              </Alert>

              <Button asChild className="w-full">
                <Link to="/login">Back to Login</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {errors.root && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="New password"
                    autoComplete="new-password"
                    disabled={!token}
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-sm text-red-600">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    disabled={!token}
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !token}
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>

              <div className="flex items-center justify-center">
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
