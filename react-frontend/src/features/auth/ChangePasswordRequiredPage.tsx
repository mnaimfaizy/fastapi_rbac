import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { ApiErrorAlert } from '@/components/auth/ApiErrorAlert';
import { Button } from '@/components/ui/button';
import { passwordPolicySchema } from '@/lib/passwordPolicySchema';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  changePassword,
  clearError,
  logoutUser,
  resetPasswordChangeSuccess,
} from '@/store/slices/authSlice';
import { AuthHeading } from './components/AuthHeading';
import { PasswordChecklist } from './components/PasswordChecklist';
import { PasswordField } from './components/PasswordField';

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Temporary password is required'),
    newPassword: passwordPolicySchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

/**
 * `/change-password-required`: the only page for someone holding a temporary
 * password (ADR 0014). The same form is shown for every role.
 */
const ChangePasswordRequiredPage = () => {
  const { isAuthenticated, user, isLoading, error } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    return () => {
      dispatch(resetPasswordChangeSuccess());
    };
  }, [dispatch]);

  if (isLoading && !user) {
    return null;
  }
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.needs_to_change_password) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: PasswordChangeFormData) => {
    if (submitting) return;
    dispatch(clearError());
    setSubmitting(true);
    try {
      await dispatch(
        changePassword({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        })
      ).unwrap();
      navigate('/dashboard', { replace: true });
    } catch {
      // The slice stores the refusal, including each failed policy rule.
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  const passwordError = errors.newPassword?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <AuthHeading
        title="Set a new password"
        description="You signed in with a temporary password. Choose your own before you continue."
      />

      {error ? (
        <ApiErrorAlert
          error={error}
          fallbackMessage="Failed to change password. Please try again."
        />
      ) : null}

      <PasswordField
        id="temporary-password"
        label="Temporary password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />

      <PasswordField
        id="new-password"
        label="New password"
        autoComplete="new-password"
        error={typeof passwordError === 'string' ? passwordError : undefined}
        {...register('newPassword')}
      />
      <PasswordChecklist value={watch('newPassword') ?? ''} />

      <PasswordField
        id="confirm-new-password"
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button type="submit" className="h-10 w-full" disabled={submitting}>
        Save and continue
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full"
        onClick={handleLogout}
      >
        Sign out
      </Button>
    </form>
  );
};

export default ChangePasswordRequiredPage;
