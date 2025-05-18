import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom'; // Import Link
import AuthService from '../../../services/auth.service';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../components/ui/alert';
import { AxiosError } from 'axios';

const resendSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});

type ResendFormData = z.infer<typeof resendSchema>;

export function ResendVerificationEmailForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendFormData>({
    resolver: zodResolver(resendSchema),
  });

  const onSubmit = async (data: ResendFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await AuthService.resendVerificationEmail(data.email);
      setSuccessMessage(
        'If an account exists for this email, a new verification link has been sent.'
      );
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      // Avoid revealing if email exists unless backend specifically tells us
      const errorMessage =
        axiosError.response?.data?.message ||
        'Failed to resend verification email. Please try again later.';
      setError(errorMessage);
      console.error('Resend verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Resend Verification Email</CardTitle>
        <CardDescription>
          Enter your email address to receive a new verification link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert variant="default">
              {' '}
              {/* Changed variant to default */}
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              {...register('email')}
              aria-invalid={errors.email ? 'true' : 'false'}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Resend Verification Email'}
          </Button>
          <div className="text-center">
            <Button variant="link" asChild>
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
