import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  requestPasswordReset,
  clearError,
  resetPasswordResetRequested,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";

// Define validation schema with Zod
const resetRequestSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ResetRequestFormData = z.infer<typeof resetRequestSchema>;

const PasswordResetRequestPage = () => {
  const { isLoading, error, passwordResetRequested } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetRequestFormData>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: {
      email: "",
    },
  });

  // Reset the passwordResetRequested state when component unmounts
  useEffect(() => {
    return () => {
      dispatch(resetPasswordResetRequested());
    };
  }, [dispatch]);

  const onSubmit = async (data: ResetRequestFormData) => {
    if (isLoading) return;

    // Clear any previous errors
    dispatch(clearError());

    try {
      // Dispatch password reset request action
      await dispatch(requestPasswordReset(data.email)).unwrap();
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
            {passwordResetRequested
              ? "Check your email for password reset instructions"
              : "Enter your email to receive password reset instructions"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {passwordResetRequested ? (
            <div className="space-y-6">
              <Alert className="border-green-500 bg-green-50 text-green-700">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  If the email exists in our system, we have sent a password
                  reset link to that address. Please check your inbox.
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

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email address"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
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

export default PasswordResetRequestPage;
