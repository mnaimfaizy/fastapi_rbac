import { Navigate, Link } from 'react-router-dom';
import { GalleryVerticalEnd } from 'lucide-react'; // Assuming lucide-react is installed

import { useAppSelector } from '../../store/hooks';
import { SignupForm } from '../../components/auth/SignupForm'; // Adjusted path

export default function SignupPage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  // If user is already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // This component now only renders the content for the left panel of AuthLayout
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <div className="flex w-full max-w-sm justify-center gap-2 md:justify-start">
        <Link to="/" className="flex items-center gap-2 font-medium">
          {' '}
          {/* Link to home/login */}
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          Your App Name {/* TODO: Replace with actual app name/logo */}
        </Link>
      </div>
      <div className="w-full max-w-sm">
        {' '}
        {/* Slightly wider for potentially more fields */}
        <SignupForm />
      </div>
    </div>
  );
}
