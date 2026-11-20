import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearError,
  requestPasswordReset,
  resetPasswordResetRequested,
} from '@/store/slices/authSlice';

import { AuthHeading } from './components/AuthHeading';
import { AuthNotice } from './components/AuthNotice';

const resetRequestSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type ResetRequestFormData = z.infer<typeof resetRequestSchema>;

/**
 * The artboard says the link works for 1 hour. The shipped lifetime is 30
 * minutes (`PASSWORD_RESET_TOKEN_EXPIRE_MINUTES`), which is what the reset
 * email tells the reader.
 */
const PasswordResetRequestPage = () => {
  const { isLoading, error, passwordResetRequested } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetRequestFormData>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    return () => {
      dispatch(resetPasswordResetRequested());
    };
  }, [dispatch]);

  const onSubmit = async (data: ResetRequestFormData) => {
    if (isLoading) return;
    dispatch(clearError());
    try {
      await dispatch(requestPasswordReset(data.email)).unwrap();
    } catch {
      // The slice stores the error.
    }
  };

  const message = typeof error === 'string' ? error : error?.message;

  if (passwordResetRequested) {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeading
          title="Check your email"
          description="If an account can be reset for that address, we have sent a link. It works for 30 minutes."
        />
        <Button asChild className="h-10 w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <AuthHeading
        title="Reset your password"
        description="Enter your email and we’ll send a link to choose a new password. The link works for 30 minutes."
      />

      {message ? <AuthNotice tone="danger" title={message} /> : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@company.com"
          autoComplete="email"
          className="h-10"
          aria-invalid={errors.email ? true : undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p className="text-danger-text text-sm">{errors.email.message}</p>
        ) : null}
      </div>

      <Button type="submit" className="h-10 w-full" disabled={isLoading}>
        Send reset link
      </Button>

      <Link to="/login" className="text-primary text-sm hover:underline">
        Back to sign in
      </Link>
    </form>
  );
};

export default PasswordResetRequestPage;
