import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleCheck, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AuthService from '@/services/auth.service';

import { emailFromLinkToken } from '../emailFromLinkToken';
import { AuthHeading } from './AuthHeading';

type VerificationStatus = 'loading' | 'success' | 'error';

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

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = emailFromLinkToken(token);
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        if (!cancelled) setStatus('error');
        return;
      }

      setStatus('loading');
      try {
        await AuthService.verifyEmail({ token });
        if (!cancelled) setStatus('success');
      } catch {
        if (!cancelled) setStatus('error');
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
    try {
      await AuthService.resendVerificationEmail(email);
      setSent(true);
    } catch {
      setSent(false);
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

  const expiredDetail = email
    ? `Verification links work for 24 hours. We’ll send a fresh one to ${email}.`
    : 'Verification links work for 24 hours. We’ll send a fresh one.';

  return (
    <div className="flex flex-col items-start gap-5">
      <StatusIcon tone="warning" />
      <AuthHeading
        title="This link has expired"
        description={
          sent
            ? 'If this address can receive mail, a fresh link is on its way.'
            : expiredDetail
        }
      />
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
