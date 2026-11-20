import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import { AuthHeading } from './components/AuthHeading';

export function RegistrationSuccessPage() {
  return (
    <div className="flex flex-col gap-5">
      {/*
        This copy must hold for all four outcomes of a registration -- new
        address, one awaiting verification, one already registered, and a
        disabled account -- without revealing which occurred (#113).
      */}
      <AuthHeading
        title="Check your email"
        description="If this address can be registered or verified, we have sent it a message. Follow the link inside to continue."
      />
      <p className="text-foreground-secondary text-sm">
        If nothing arrives within a few minutes, check your spam folder.
      </p>
      <Button asChild variant="outline" className="h-10 w-full">
        <Link to="/resend-verification-email">Resend verification email</Link>
      </Button>
      <Link to="/login" className="text-primary text-sm hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
