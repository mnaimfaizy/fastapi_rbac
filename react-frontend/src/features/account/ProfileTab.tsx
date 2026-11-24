import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { displayName, initials } from '@/components/layout/viewer';
import type { User } from '@/models/user';
import userService from '@/services/user.service';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { getCurrentUser } from '@/store/slices/authSlice';
import { SettingsSection } from './SettingsSection';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  phone: z.string().trim(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

/**
 * The Profile tab: first name, last name and phone, with the email shown
 * read-only. Saving goes to `PUT /users/me` (the caller's own record, behind
 * `self.update_profile`), and the response becomes the signed-in user, so
 * the header shows the new name at once.
 */
export function ProfileTab() {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) {
    return null;
  }
  return <ProfileForm user={user} />;
}

function ProfileForm({ user }: { user: User }) {
  const dispatch = useAppDispatch();
  const [saveError, setSaveError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      phone: user.contact_phone ?? '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setSaveError(null);
    try {
      const saved = await userService.updateUser('me', {
        first_name: data.firstName,
        last_name: data.lastName,
        contact_phone: data.phone || null,
      });
      // The response is the caller's own record, the same shape as
      // `GET /users/me`. Storing it through `getCurrentUser.fulfilled`
      // skips the pending state, which would swap the page for a spinner.
      dispatch(getCurrentUser.fulfilled(saved, 'profile-save'));
      reset({
        firstName: saved.first_name ?? '',
        lastName: saved.last_name ?? '',
        phone: saved.contact_phone ?? '',
      });
      toast.success('Profile saved.');
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : 'Your profile wasn’t saved. Try again.'
      );
    }
  };

  return (
    <SettingsSection
      title="Profile"
      description="How you appear to other admins."
      className="max-w-[760px]"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="bg-sidebar-accent text-sidebar-accent-foreground inline-flex size-16 shrink-0 items-center justify-center rounded-full text-2xl leading-none font-semibold tracking-wide"
        >
          {initials(user)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">
            {displayName(user)}
          </div>
          <div className="text-muted-foreground text-[13px]">
            Your initials come from your first and last name.
          </div>
        </div>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {saveError ? (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="profile-first-name"
            label="First name"
            error={errors.firstName?.message}
          >
            <Input
              id="profile-first-name"
              autoComplete="given-name"
              aria-invalid={errors.firstName ? true : undefined}
              className="h-10"
              {...register('firstName')}
            />
          </Field>
          <Field
            id="profile-last-name"
            label="Last name"
            error={errors.lastName?.message}
          >
            <Input
              id="profile-last-name"
              autoComplete="family-name"
              aria-invalid={errors.lastName ? true : undefined}
              className="h-10"
              {...register('lastName')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="profile-phone"
            label={
              <>
                Phone{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </>
            }
          >
            <Input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              className="h-10"
              {...register('phone')}
            />
          </Field>
          <Field
            id="profile-email"
            label="Email"
            hint="You can’t change your email here. Ask another admin to update it."
          >
            <Input
              id="profile-email"
              type="email"
              readOnly
              value={user.email}
              aria-describedby="profile-email-hint"
              className="bg-muted h-10"
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="gap-1">
        {label}
      </Label>
      {children}
      {hint ? (
        <p
          id={`${id}-hint`}
          className="text-muted-foreground text-[13px] leading-snug"
        >
          {hint}
        </p>
      ) : null}
      {error ? <p className="text-danger-text text-sm">{error}</p> : null}
    </div>
  );
}
