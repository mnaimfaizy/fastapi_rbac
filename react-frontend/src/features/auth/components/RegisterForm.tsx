import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import AuthService from "../../../services/auth.service";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { AxiosError } from "axios";
import { ErrorDetail } from "../../../services/api"; // Import ErrorDetail

const registerSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  full_name: z.string().optional().nullable(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // For field-specific errors
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);
    setFieldErrors({}); // Clear previous field errors

    try {
      // Call register service, but don't store tokens yet
      await AuthService.register(data);

      // Redirect to a page indicating registration success and need for verification
      navigate("/registration-success"); // Navigate to success/verification page
    } catch (err) {
      const axiosError = err as AxiosError<{
        message?: string;
        errors?: ErrorDetail[];
      }>;
      const errorMessage =
        axiosError.response?.data?.message ||
        "Registration failed. Please try again.";
      setError(errorMessage);

      // Handle field-specific errors from backend
      if (axiosError.response?.data?.errors) {
        const backendFieldErrors: Record<string, string> = {};
        axiosError.response.data.errors.forEach((e) => {
          if (e.field) {
            backendFieldErrors[e.field] = e.message;
          }
        });
        setFieldErrors(backendFieldErrors);
      }

      console.error("Registration error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>Create your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              {...register("email")}
              aria-invalid={
                errors.email || fieldErrors.email ? "true" : "false"
              }
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
            {fieldErrors.email && (
              <p className="text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              aria-invalid={
                errors.password || fieldErrors.password ? "true" : "false"
              }
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
            {fieldErrors.password && (
              <p className="text-sm text-red-600">{fieldErrors.password}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name (Optional)</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="John Doe"
              {...register("full_name")}
              aria-invalid={errors.full_name ? "true" : "false"}
            />
            {errors.full_name && (
              <p className="text-sm text-red-600">{errors.full_name.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Registering..." : "Register"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-center text-sm">
        Already have an account?{" "}
        <Button
          variant="link"
          onClick={() => navigate("/login")}
          className="p-0 h-auto"
        >
          Login
        </Button>
      </CardFooter>
    </Card>
  );
}
