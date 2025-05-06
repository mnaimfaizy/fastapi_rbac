import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AuthService from "../../../services/auth.service";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { AxiosError } from "axios";

export function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError("Verification token is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setSuccess(false);

      try {
        await AuthService.verifyEmail({ token });
        setSuccess(true);
      } catch (err) {
        const axiosError = err as AxiosError<{ message?: string }>;
        const errorMessage =
          axiosError.response?.data?.message ||
          "Email verification failed. The link might be invalid or expired.";
        setError(errorMessage);
        console.error("Verification error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p>Verifying your email...</p>}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Verification Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert variant="default">
              {" "}
              {/* Changed variant to default */}
              <AlertTitle>Verification Successful</AlertTitle>
              <AlertDescription>
                Your email has been verified successfully. You can now log in.
              </AlertDescription>
              <Button onClick={() => navigate("/login")} className="mt-4">
                Go to Login
              </Button>
            </Alert>
          )}

          {!isLoading && error && (
            <div className="text-center text-sm">
              Need a new verification link?{" "}
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
