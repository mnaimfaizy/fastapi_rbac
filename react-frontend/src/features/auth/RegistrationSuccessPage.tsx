import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MailCheck } from 'lucide-react';

export function RegistrationSuccessPage() {
  return (
    <div>
      <Card className="w-full max-w-md text-center mx-auto mt-10">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <MailCheck className="w-16 h-16 text-blue-500" />
          </div>
          {/*
            This copy must hold for all four outcomes of a registration -- new
            address, one awaiting verification, one already registered, and a
            disabled account -- without revealing which occurred (#113). It
            previously asserted "Your account has been created", which is false
            for three of them and told the submitter the address was new.
          */}
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If this address can be registered or verified, we have sent it a
            message. Follow the link inside to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            If nothing arrives within a few minutes, please check your spam
            folder.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-gray-600">
            Didn&apos;t receive the email?
          </p>
          <Button variant="link" asChild className="p-0 h-auto">
            <Link to="/resend-verification-email">
              Resend Verification Email
            </Link>
          </Button>
          <Button variant="outline" asChild className="mt-4">
            <Link to="/login">Go to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
