import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { AxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { passwordPolicySchema } from '@/lib/passwordPolicySchema';
import { ErrorDetail } from '@/services/api';
import AuthService from '@/services/auth.service';
import { useAppSelector } from '@/store/hooks';

import { AuthHeading } from './components/AuthHeading';
import { AuthNotice } from './components/AuthNotice';
import { PasswordChecklist } from './components/PasswordChecklist';
import { PasswordField } from './components/PasswordField';

const signupSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Enter a valid email address'),
    password: passwordPolicySchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: SignupFormData) => {
    if (isLoading) return;
    setIsLoading(true);
    setApiError(null);
    setFieldErrors({});

    const nameParts = data.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');

    try {
      // Resolves for every address. Branching here would recreate the
      // registration oracle the API closed.
      await AuthService.register({
        email: data.email,
        password: data.password,
        first_name: firstName,
        last_name: lastName,
        full_name: data.fullName,
      });
      navigate('/registration-success');
    } catch (err) {
      const axiosError = err as AxiosError<{
        message?: string;
        errors?: ErrorDetail[];
      }>;
      const backendFieldErrors: Record<string, string> = {};
      for (const entry of axiosError.response?.data?.errors ?? []) {
        if (!entry.field) continue;
        const fieldName =
          entry.field === 'full_name' ? 'fullName' : entry.field;
        backendFieldErrors[fieldName] = entry.message;
      }
      setFieldErrors(backendFieldErrors);
      // The general notice is only for a rejection that names no field.
      if (Object.keys(backendFieldErrors).length === 0) {
        setApiError(
          axiosError.response?.data?.message ||
            'Could not create the account. Try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const passwordError = errors.password?.message;
  const passwordFieldError =
    typeof passwordError === 'string' ? passwordError : fieldErrors.password;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <AuthHeading
        title="Create an account"
        description="You’ll get an email to verify your address."
      />

      {apiError ? <AuthNotice tone="danger" title={apiError} /> : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full-name">Full name</Label>
        <Input
          id="full-name"
          type="text"
          autoComplete="name"
          className="h-10"
          aria-invalid={
            errors.fullName || fieldErrors.fullName ? true : undefined
          }
          {...register('fullName')}
        />
        {errors.fullName ? (
          <p className="text-danger-text text-sm">{errors.fullName.message}</p>
        ) : null}
        {fieldErrors.fullName ? (
          <p className="text-danger-text text-sm">{fieldErrors.fullName}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-10"
          aria-invalid={errors.email || fieldErrors.email ? true : undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p className="text-danger-text text-sm">{errors.email.message}</p>
        ) : null}
        {fieldErrors.email ? (
          <p className="text-danger-text text-sm">{fieldErrors.email}</p>
        ) : null}
      </div>

      <PasswordField
        id="password"
        label="Password"
        autoComplete="new-password"
        error={passwordFieldError}
        {...register('password')}
      />
      <PasswordChecklist value={watch('password') ?? ''} />

      <PasswordField
        id="confirm-password"
        label="Confirm password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message ?? fieldErrors.confirmPassword}
        {...register('confirmPassword')}
      />

      <Button type="submit" className="h-10 w-full" disabled={isLoading}>
        Create account
      </Button>

      <p className="text-foreground-secondary text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
