import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { ApiErrorAlert } from '@/components/auth/ApiErrorAlert';
import { Button } from '@/components/ui/button';
import { passwordPolicySchema } from '@/lib/passwordPolicySchema';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearError,
  confirmPasswordReset,
  resetPasswordResetSuccess,
} from '@/store/slices/authSlice';

import { AuthHeading } from './components/AuthHeading';
import { PasswordChecklist } from './components/PasswordChecklist';
import { PasswordField } from './components/PasswordField';
import { emailFromLinkToken } from './emailFromLinkToken';

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
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = emailFromLinkToken(token);

  const { isLoading, error, passwordResetSuccess } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!token) {
      navigate('/request-password-reset', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    return () => {
      dispatch(resetPasswordResetSuccess());
    };
  }, [dispatch]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (isLoading || !token) return;
    dispatch(clearError());
    try {
      await dispatch(
        confirmPasswordReset({ token, newPassword: data.password })
      ).unwrap();
    } catch {
      // The slice stores the complexity errors.
    }
  };

  if (passwordResetSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeading
          title="Password saved"
          description="You can sign in with your new password."
        />
        <Button asChild className="h-10 w-full">
          <Link to="/login">Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  const passwordError = errors.password?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <AuthHeading
        title="Choose a new password"
        description={email ? `For ${email}` : undefined}
      />

      {error ? (
        <ApiErrorAlert
          error={error}
          fallbackMessage="Password reset failed. Please try again."
        />
      ) : null}

      <PasswordField
        id="password"
        label="New password"
        autoComplete="new-password"
        error={typeof passwordError === 'string' ? passwordError : undefined}
        {...register('password')}
      />
      <PasswordChecklist value={watch('password') ?? ''} />

      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button
        type="submit"
        className="h-10 w-full"
        disabled={isLoading || !token}
      >
        Save new password
      </Button>
    </form>
  );
};

export default PasswordResetConfirmPage;
