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
import { CheckCircle } from 'lucide-react'; // Example icon

export function RegistrationSuccessPage() {
  return (
    <div>
      <Card className="w-full max-w-md text-center mx-auto mt-10">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle>Registration Successful!</CardTitle>
          <CardDescription>
            Your account has been created. Please check your email to verify
            your account before logging in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            If you haven't received the verification email within a few minutes,
            please check your spam folder.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-gray-600">Didn't receive the email?</p>
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
