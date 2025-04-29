import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "../../lib/utils";
import AuthService from "../../services/auth.service"; // Import AuthService
import { AxiosError } from "axios"; // Import AxiosError
import { ErrorDetail } from "../../services/api"; // Import ErrorDetail

// shadcn UI components
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertTriangle } from "lucide-react"; // Assuming lucide-react is installed

// Define validation schema with Zod for Signup
const signupSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"), // Example field
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"], // path of error
  });

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // Add fieldErrors state

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setFieldErrors({}); // Clear previous field errors

    try {
      // Call register service
      await AuthService.register({
        email: data.email,
        password: data.password,
        full_name: data.fullName, // Map fullName to full_name
      });

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
            // Map backend field names to form field names if necessary
            const fieldName = e.field === "full_name" ? "fullName" : e.field;
            backendFieldErrors[fieldName] = e.message;
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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Enter your details below to create your account
        </p>
      </div>

      {error &&
        !Object.keys(fieldErrors).length && ( // Only show general error if no field errors
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="John Doe"
            required
            {...register("fullName")}
            aria-invalid={
              errors.fullName || fieldErrors.fullName ? "true" : "false"
            }
          />
          {errors.fullName && (
            <p className="text-sm text-red-600">{errors.fullName.message}</p>
          )}
          {fieldErrors.fullName && ( // Display field-specific error
            <p className="text-sm text-red-600">{fieldErrors.fullName}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
            {...register("email")}
            aria-invalid={errors.email || fieldErrors.email ? "true" : "false"}
          />
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
          {fieldErrors.email && ( // Display field-specific error
            <p className="text-sm text-red-600">{fieldErrors.email}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="********"
            autoComplete="new-password"
            required
            {...register("password")}
            aria-invalid={
              errors.password || fieldErrors.password ? "true" : "false"
            }
          />
          {errors.password && (
            <p className="text-sm text-red-600">{errors.password.message}</p>
          )}
          {fieldErrors.password && ( // Display field-specific error
            <p className="text-sm text-red-600">{fieldErrors.password}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="********"
            autoComplete="new-password"
            required
            {...register("confirmPassword")}
            aria-invalid={errors.confirmPassword ? "true" : "false"}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-red-600">
              {errors.confirmPassword.message}
            </p>
          )}
          {/* No specific backend field error expected for confirmPassword, handled by frontend validation */}
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </div>
      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link to="/login" className="underline underline-offset-4">
          {" "}
          {/* Link to login page */}
          Login
        </Link>
      </div>
    </form>
  );
}
