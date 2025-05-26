import React from 'react';
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
import { ShieldAlert } from 'lucide-react'; // Icon for unauthorized

const UnauthorizedPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-3xl font-bold text-destructive">
            403 - Access Denied
          </CardTitle>
          <CardDescription className="text-md text-muted-foreground pt-1">
            You do not have the necessary permissions to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            If you believe this is an error, please contact an administrator or
            ensure you are logged in with an account that has the required
            privileges.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild size="lg" variant="default">
            <Link to="/">Go to Homepage</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UnauthorizedPage;
