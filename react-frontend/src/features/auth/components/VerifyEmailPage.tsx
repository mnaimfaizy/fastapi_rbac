import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import AuthService from '../../../services/auth.service';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { AxiosError } from 'axios';

type VerificationStatus = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        if (cancelled) {
          return;
        }
        setError('Verification token is missing.');
        setStatus('error');
        return;
      }

      setStatus('loading');
      setError(null);

      try {
        await AuthService.verifyEmail({ token });
        if (cancelled) {
          return;
        }
        setError(null);
        setStatus('success');
      } catch (err) {
        if (cancelled) {
          return;
        }
        const axiosError = err as AxiosError<{ message?: string }>;
        const errorMessage =
          axiosError.response?.data?.message ||
          'Email verification failed. The link might be invalid or expired.';
        setError(errorMessage);
        setStatus('error');
        console.error('Verification error:', err);
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && <p>Verifying your email...</p>}

          {status === 'error' && error && (
            <Alert variant="destructive">
              <AlertTitle>Verification Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status === 'success' && (
            <Alert variant="default" className="w-full">
              <AlertTitle>Verification Successful</AlertTitle>
              <AlertDescription>
                Your email has been verified successfully. You can now log in.
                <Button
                  onClick={() => navigate('/login')}
                  variant="default"
                  className="mt-4 w-full"
                >
                  Go to Login
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <div className="text-center text-sm">
              Need a new verification link?{' '}
              <Link to="/resend-verification-email" className="underline">
                Resend Email
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
