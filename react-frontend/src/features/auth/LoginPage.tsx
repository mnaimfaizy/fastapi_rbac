import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearError, loginUser } from '@/store/slices/authSlice';

import { AuthHeading } from './components/AuthHeading';
import { AuthNotice } from './components/AuthNotice';
import { PasswordField } from './components/PasswordField';
import { SIGNED_OUT_EVERYWHERE_NOTICE } from './notices';

/**
 * The one refusal for a wrong password, an unknown address, and a lock
 * (ADR 0015). The API does not say which, and it does not send a retry time,
 * so sign-in shows this artboard copy for all three. "Email is not verified."
 * and "Inactive user" stay as the API worded them: only a correct password
 * reaches those.
 */
const UNIFORM_LOGIN_FAILURE =
  'Email or password is incorrect, or the account is temporarily locked. Try again later or reset your password.';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password cannot be empty'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function failureCopy(message: string): { title: string; detail?: string } {
  if (message === UNIFORM_LOGIN_FAILURE) {
    return {
      title: 'Email or password is wrong',
      detail: 'Check both and try again, or reset your password.',
    };
  }
  return { title: message };
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, error } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname || '/dashboard';

  const stateNotice =
    location.state &&
    typeof location.state === 'object' &&
    'notice' in location.state
      ? String((location.state as { notice?: string }).notice ?? '')
      : '';
  const signedOutEverywhere =
    searchParams.get('notice') === SIGNED_OUT_EVERYWHERE_NOTICE ||
    stateNotice === SIGNED_OUT_EVERYWHERE_NOTICE;

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const message = typeof error === 'string' ? error : error?.message;
  const failure = message ? failureCopy(message) : null;

  const onSubmit = async (data: LoginFormData) => {
    if (isLoading) return;
    dispatch(clearError());
    try {
      await dispatch(
        loginUser({ email: data.email, password: data.password })
      ).unwrap();
      navigate(from, { replace: true });
    } catch {
      // The slice stores the refusal. The alert above reads it.
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <AuthHeading
        title="Sign in"
        description="Use your work email to sign in to FastAPI RBAC."
      />

      {signedOutEverywhere ? (
        <AuthNotice
          tone="info"
          title="You’ve been signed out everywhere."
          detail="Sign in again on any device you still use."
        />
      ) : null}

      {failure ? (
        <AuthNotice
          tone="danger"
          title={failure.title}
          detail={failure.detail}
        />
      ) : null}

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

      <PasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="flex justify-end">
        <Link
          to="/request-password-reset"
          className="text-primary text-sm hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="h-10 w-full" disabled={isLoading}>
        Sign in
      </Button>

      <p className="text-foreground-secondary text-sm">
        New here?{' '}
        <Link to="/register" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
