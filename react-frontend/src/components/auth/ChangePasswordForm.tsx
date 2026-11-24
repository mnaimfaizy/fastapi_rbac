import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck } from 'lucide-react';

import { ApiErrorAlert } from '@/components/auth/ApiErrorAlert';
import { Button } from '@/components/ui/button';
import { PasswordChecklist } from '@/features/auth/components/PasswordChecklist';
import { PasswordField } from '@/features/auth/components/PasswordField';
import { passwordPolicySchema } from '@/lib/passwordPolicySchema';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  changePassword,
  clearError,
  resetPasswordChangeSuccess,
} from '../../store/slices/authSlice';

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordPolicySchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

interface ChangePasswordFormProps {
  /** Called after the API accepted the new password and the store holds the new session. */
  onSuccess?: () => void;
}

/**
 * The self-service change-password form on the Security tab of Account
 * settings. The new password is checked against the password policy as it
 * is typed (the live checklist) and again on submit; a refusal from the API
 * lists each failed rule. The session stays signed in on this device.
 *
 * The change-password-required page a temporary password leads to has its
 * own form (ADR 0014).
 */
export const ChangePasswordForm = ({ onSuccess }: ChangePasswordFormProps) => {
  const { error, passwordChangeSuccess } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Clear the shared success flag and any refusal when leaving the form.
  useEffect(() => {
    dispatch(clearError());
    return () => {
      dispatch(resetPasswordChangeSuccess());
      dispatch(clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (passwordChangeSuccess) {
      reset();
    }
  }, [passwordChangeSuccess, reset]);

  const onSubmit = async (data: PasswordChangeFormData) => {
    dispatch(clearError());
    try {
      await dispatch(
        changePassword({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        })
      ).unwrap();
    } catch {
      // The slice stores the refusal, including each failed policy rule.
      return;
    }
    onSuccess?.();
  };

  const newPasswordError = errors.newPassword?.message;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-[18px]"
    >
      {passwordChangeSuccess ? (
        <p
          role="status"
          className="bg-status-success text-status-success-foreground flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
        >
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          Password updated.
        </p>
      ) : null}

      {error ? (
        <ApiErrorAlert
          error={error}
          fallbackMessage="Your password wasn’t changed. Try again."
        />
      ) : null}

      <PasswordField
        id="current-password"
        label="Current password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />

      <div className="flex flex-col gap-2.5">
        <PasswordField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          error={
            typeof newPasswordError === 'string' ? newPasswordError : undefined
          }
          {...register('newPassword')}
        />
        <PasswordChecklist value={watch('newPassword') ?? ''} />
      </div>

      <PasswordField
        id="confirm-new-password"
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </form>
  );
};

export default ChangePasswordForm;
