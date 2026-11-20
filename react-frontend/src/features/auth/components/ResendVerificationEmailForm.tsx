import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { AxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthService from '@/services/auth.service';

import { AuthHeading } from './AuthHeading';
import { AuthNotice } from './AuthNotice';

const resendSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type ResendFormData = z.infer<typeof resendSchema>;

export function ResendVerificationEmailForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
    setSent(false);
    try {
      await AuthService.resendVerificationEmail(data.email);
      setSent(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(
        axiosError.response?.data?.message ||
          'Could not resend the verification email. Try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <AuthHeading
        title="Resend verification email"
        description="Enter your email and we’ll send a fresh link if this address can receive one."
      />

      {error ? <AuthNotice tone="danger" title={error} /> : null}
      {sent ? (
        <AuthNotice
          tone="info"
          title="Check your email"
          detail="If this address can receive mail, a fresh link is on its way."
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

      <Button type="submit" className="h-10 w-full" disabled={isLoading}>
        Resend email
      </Button>
      <Link to="/login" className="text-primary text-sm hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
