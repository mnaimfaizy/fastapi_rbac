import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, CircleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { AppDispatch, RootState } from '../../store';
import { fetchAllRoles } from '../../store/slices/roleSlice';
import {
  clearUserErrors,
  createUser,
  updateUser,
} from '../../store/slices/userSlice';
import type { User } from '@/models/user';
import { usePermissions } from '@/hooks/usePermissions';
import { passwordPolicySchema } from '@/lib/passwordPolicySchema';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordChecklist } from '@/features/auth/components/PasswordChecklist';
import { PasswordField } from '@/features/auth/components/PasswordField';
import { cn } from '@/lib/utils';
import { FormSwitch } from './FormSwitch';
import {
  grantableRoles,
  permissionCodes,
  permissionCount,
  roleIdsToSave,
} from './user-form-model';

const identity = {
  first_name: z.string().trim().min(1, 'Enter a first name'),
  last_name: z.string().trim().min(1, 'Enter a last name'),
  email: z.string().trim().email('Enter a valid email address'),
  contact_phone: z.string().trim(),
  role_ids: z.array(z.string()),
  is_superuser: z.boolean(),
  is_active: z.boolean(),
};

const editSchema = z.object({
  ...identity,
  password: z.string(),
  confirm_password: z.string(),
});

const createSchema = z
  .object({
    ...identity,
    password: passwordPolicySchema,
    confirm_password: z.string().min(1, 'Confirm the password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'The passwords don’t match',
    path: ['confirm_password'],
  });

type FormValues = z.infer<typeof editSchema>;

export const ROLES_HELPER = 'You can assign roles whose permissions you hold.';

/** One titled group of the form: title and description left, fields right. */
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="bg-card grid gap-5 rounded-xl border p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-8"
    >
      <div>
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-foreground-secondary mt-1 text-[13px]">
          {description}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

function TextField({
  id,
  label,
  optional,
  error,
  ...props
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
} & React.ComponentProps<'input'>) {
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {optional ? ' ' : null}
        {optional ? (
          <span className="text-foreground-secondary font-normal">
            (optional)
          </span>
        ) : null}
      </Label>
      <Input
        id={id}
        className="h-10"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-danger-text text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface UserEditFormProps {
  /** The user to edit; leave out to create one. */
  user?: User;
}

/**
 * Create and edit user, from the `users-create`, `users-create-manager` and
 * `users-edit` artboards: Identity, Password (create only), Access and
 * Status, with a sticky Cancel / Save footer.
 */
const UserEditForm = ({ user }: UserEditFormProps) => {
  const editing = user !== undefined;
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission } = usePermissions();
  const viewer = useSelector((state: RootState) => state.auth.user);
  const {
    allRoles,
    loading: rolesLoading,
    error: rolesError,
  } = useSelector((state: RootState) => state.role);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [catalogRequested, setCatalogRequested] = useState(false);

  const isSuperuser = viewer?.is_superuser === true;
  const canReadRoles = hasPermission('role.read');
  // The API never lets a non-superuser change their own roles.
  const ownRoles = editing && !isSuperuser && viewer?.id === user.id;
  // The API refuses to let anyone, a superuser included, disable themselves.
  const ownAccount = editing && viewer?.id === user.id;

  useEffect(() => {
    if (canReadRoles) {
      dispatch(fetchAllRoles());
      setCatalogRequested(true);
    }
  }, [dispatch, canReadRoles]);

  const catalogReady =
    canReadRoles && catalogRequested && !rolesLoading && !rolesError;
  const viewerCodes = useMemo(
    () => permissionCodes(viewer?.permissions),
    [viewer?.permissions]
  );
  const grantable = useMemo(
    () => grantableRoles(allRoles, viewerCodes, isSuperuser),
    [allRoles, viewerCodes, isSuperuser]
  );
  const grantableIds = useMemo(
    () => new Set(grantable.map((role) => role.id)),
    [grantable]
  );
  const heldIds = useMemo(
    () => (user?.roles ?? []).map((role) => role.id),
    [user?.roles]
  );
  const showRoles = catalogReady && !ownRoles;

  const form = useForm<FormValues>({
    resolver: zodResolver(editing ? editSchema : createSchema) as never,
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      contact_phone: user?.contact_phone ?? '',
      password: '',
      confirm_password: '',
      role_ids: heldIds,
      is_superuser: user?.is_superuser ?? false,
      is_active: user?.is_active ?? true,
    },
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const leave = () =>
    navigate(editing ? `/dashboard/users/${user.id}` : '/dashboard/users');

  const onSubmit = async (values: FormValues) => {
    setSaveError(null);
    const common = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      email: values.email.trim(),
      contact_phone: values.contact_phone.trim() || null,
      // On your own account the switch isn't offered; leave the flag alone.
      ...(ownAccount ? {} : { is_active: values.is_active }),
      // Only a superuser may set the flag; anyone else leaves it out.
      ...(isSuperuser ? { is_superuser: values.is_superuser } : {}),
    };
    // Without the roles catalog the field isn't shown, so an edit leaves
    // the user's roles alone rather than sending an empty list.
    const roleIds = showRoles
      ? roleIdsToSave(values.role_ids, heldIds, grantableIds)
      : undefined;
    try {
      if (editing) {
        await dispatch(
          updateUser({
            userId: user.id,
            userData: {
              ...common,
              ...(roleIds !== undefined ? { role_id: roleIds } : {}),
            },
          })
        ).unwrap();
        toast.success('User updated');
        navigate(`/dashboard/users/${user.id}`);
      } else {
        const created = await dispatch(
          createUser({
            ...common,
            password: values.password,
            role_id: roleIds ?? [],
          })
        ).unwrap();
        toast.success('User created');
        navigate(
          created?.id ? `/dashboard/users/${created.id}` : '/dashboard/users'
        );
      }
    } catch (failure: unknown) {
      const message =
        typeof failure === 'string' && failure
          ? failure
          : editing
            ? 'Couldn’t save the changes. Try again.'
            : 'Couldn’t create the user. Try again.';
      setSaveError(message);
      toast.error(message);
      // The banner and toast report it; the list's error is for load failures.
      dispatch(clearUserErrors());
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
      aria-label={editing ? 'Edit user' : 'Add user'}
    >
      {saveError ? (
        <div
          role="alert"
          className="border-destructive bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {saveError}
        </div>
      ) : null}

      <FormSection
        title="Identity"
        description="Name and contact details. The email is also the sign-in."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="user-first-name"
            label="First name"
            autoComplete="off"
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <TextField
            id="user-last-name"
            label="Last name"
            autoComplete="off"
            error={errors.last_name?.message}
            {...register('last_name')}
          />
          <TextField
            id="user-email"
            label="Email"
            type="email"
            autoComplete="off"
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            id="user-phone"
            label="Phone"
            optional
            type="tel"
            placeholder="+61 400 000 000"
            autoComplete="off"
            error={errors.contact_phone?.message}
            {...register('contact_phone')}
          />
        </div>
      </FormSection>

      {editing ? null : (
        <FormSection
          title="Password"
          description="Share the temporary password through a separate channel. They’ll choose a new one at first sign-in."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              id="user-password"
              label="Temporary password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordField
              id="user-confirm-password"
              label="Confirm password"
              autoComplete="new-password"
              error={errors.confirm_password?.message}
              {...register('confirm_password')}
            />
          </div>
          <PasswordChecklist value={watch('password') ?? ''} />
        </FormSection>
      )}

      {showRoles || ownRoles || isSuperuser ? (
        <FormSection
          title="Access"
          description="Roles decide what this person can see and change."
        >
          {ownRoles ? (
            <p className="text-foreground-secondary text-sm">
              You can’t change your own roles. Ask another administrator.
            </p>
          ) : null}
          {showRoles ? (
            <Controller
              control={control}
              name="role_ids"
              render={({ field }) => (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-foreground text-sm font-medium">
                    Roles
                  </legend>
                  <p className="text-foreground-secondary -mt-1 text-[13px]">
                    {ROLES_HELPER}
                  </p>
                  {grantable.length === 0 ? (
                    <p className="text-foreground-secondary text-sm">
                      There are no roles you can assign.
                    </p>
                  ) : (
                    grantable.map((role) => {
                      const checked = field.value.includes(role.id);
                      const id = `user-role-${role.id}`;
                      return (
                        <div
                          key={role.id}
                          className={cn(
                            'flex items-start gap-3 rounded-lg border px-3.5 py-3',
                            checked && 'border-primary'
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={checked}
                            aria-describedby={`${id}-detail`}
                            onCheckedChange={(next) =>
                              field.onChange(
                                next === true
                                  ? [...field.value, role.id]
                                  : field.value.filter(
                                      (value) => value !== role.id
                                    )
                              )
                            }
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <Label htmlFor={id}>{role.name}</Label>
                              <span className="text-foreground-secondary shrink-0 text-xs">
                                {permissionCount(role)}
                              </span>
                            </div>
                            <p
                              id={`${id}-detail`}
                              className="text-foreground-secondary mt-0.5 text-[13px]"
                            >
                              {role.description}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </fieldset>
              )}
            />
          ) : null}
          {isSuperuser ? (
            <div className={cn(showRoles && 'border-t pt-4')}>
              <Controller
                control={control}
                name="is_superuser"
                render={({ field }) => (
                  <FormSwitch
                    label="Superuser"
                    description="Bypasses every permission check."
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  >
                    <p className="bg-status-warning text-status-warning-foreground mt-2 flex gap-2 rounded-lg px-3 py-2.5 text-[13px]">
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      Superusers can change anything, including other
                      superusers. Give this only to people who maintain the
                      system.
                    </p>
                  </FormSwitch>
                )}
              />
            </div>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection
        title="Status"
        description="Inactive users can’t sign in. Their data stays."
      >
        {ownAccount ? (
          <p className="text-foreground-secondary text-sm">
            You can’t disable your own account.
          </p>
        ) : (
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <FormSwitch
                label="Active"
                description="This person can sign in."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        )}
      </FormSection>

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 border-t px-1 py-4 backdrop-blur">
        <div className="text-foreground-secondary text-sm" aria-live="polite">
          {editing && isDirty ? (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="bg-primary size-1.5 rounded-full"
              />
              Unsaved changes
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={leave}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting || undefined}
          >
            {editing ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default UserEditForm;
