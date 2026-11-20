import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleCheck, Clock } from 'lucide-react';
import { AxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AuthService from '@/services/auth.service';

import { emailFromLinkToken } from '../emailFromLinkToken';
import { AuthHeading } from './AuthHeading';
import { AuthNotice } from './AuthNotice';

type VerificationStatus =
  'loading' | 'success' | 'expired' | 'missing' | 'network' | 'error';

/**
 * "This link has expired" is only the 400 `emailed_links.verify_email` raises
 * when it rejects the link. A response with any other status, including a
 * 5xx, is a generic error. A network failure is an axios-shaped error with
 * no response. A missing token is handled before this runs.
 */
function classifyVerifyError(err: unknown): 'expired' | 'network' | 'error' {
  if (typeof err !== 'object' || err === null) return 'error';
  const record = err as {
    response?: { status?: unknown };
    request?: unknown;
    code?: unknown;
    isAxiosError?: unknown;
  };
  if (record.response) {
    return record.response.status === 400 ? 'expired' : 'error';
  }
  if (
    record.isAxiosError === true ||
    record.request != null ||
    record.code === 'ERR_NETWORK'
  ) {
    return 'network';
  }
  return 'error';
}

function StatusIcon({ tone }: { tone: 'success' | 'warning' }) {
  const Icon = tone === 'success' ? CircleCheck : Clock;
  return (
    <span
      className={cn(
        'flex size-12 items-center justify-center rounded-xl',
        tone === 'success'
          ? 'bg-status-success text-status-success-foreground'
          : 'bg-status-warning text-status-warning-foreground'
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
    </span>
  );
}

function failureCopy(
  status: 'expired' | 'missing' | 'network' | 'error',
  email: string | null
): { title: string; description: string } {
  if (status === 'expired') {
    return {
      title: 'This link has expired',
      description: email
        ? `Verification links work for 24 hours. We’ll send a fresh one to ${email}.`
        : 'Verification links work for 24 hours. We’ll send a fresh one.',
    };
  }
  if (status === 'missing') {
    return {
      title: 'This link is missing',
      description:
        'Open the verification link from your email, or request a new one.',
    };
  }
  if (status === 'network') {
    return {
      title: 'Could not reach the server',
      description: 'Check your connection and try again.',
    };
  }
  return {
    title: 'Could not verify this link',
    description: 'Something went wrong. Try again.',
  };
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = emailFromLinkToken(token);
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        if (!cancelled) setStatus('missing');
        return;
      }

      setStatus('loading');
      try {
        await AuthService.verifyEmail({ token });
        if (!cancelled) setStatus('success');
      } catch (err) {
        if (!cancelled) setStatus(classifyVerifyError(err));
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const resend = async () => {
    if (!email || sending) return;
    setSending(true);
    setResendError(null);
    try {
      await AuthService.resendVerificationEmail(email);
      setSent(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setSent(false);
      setResendError(
        axiosError.response?.data?.message ||
          'Could not resend the verification email. Try again.'
      );
    } finally {
      setSending(false);
    }
  };

  if (status === 'loading') {
    return (
      <p className="text-foreground-secondary text-sm">Verifying your email…</p>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-start gap-5">
        <StatusIcon tone="success" />
        <AuthHeading
          title="Email verified"
          description={
            email
              ? `${email} is confirmed. You can sign in now.`
              : 'Your email is confirmed. You can sign in now.'
          }
        />
        <Button
          type="button"
          className="h-10 w-full"
          onClick={() => navigate('/login')}
        >
          Continue to sign in
        </Button>
      </div>
    );
  }

  const copy = failureCopy(status, email);

  return (
    <div className="flex flex-col items-start gap-5">
      <StatusIcon tone="warning" />
      <AuthHeading
        title={copy.title}
        description={
          sent
            ? 'If this address can receive mail, a fresh link is on its way.'
            : copy.description
        }
      />
      {resendError ? <AuthNotice tone="danger" title={resendError} /> : null}
      {email ? (
        <Button
          type="button"
          className="h-10 w-full"
          onClick={resend}
          disabled={sending}
        >
          Resend email
        </Button>
      ) : (
        <Button asChild className="h-10 w-full">
          <Link to="/resend-verification-email">Resend email</Link>
        </Button>
      )}
      <Link to="/login" className="text-primary text-sm hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
