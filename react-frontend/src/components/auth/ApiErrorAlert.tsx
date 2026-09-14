import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { normalizeApiError } from '@/lib/apiError';

interface ApiErrorAlertProps {
  /** Anything an API call rejected with: a string, a response body, an axios error. */
  error: unknown;
  /** Shown when the error carries no message of its own. */
  fallbackMessage?: string;
  className?: string;
}

/**
 * The one way this app shows an API failure (#192).
 *
 * A password-complexity rejection carries the summary plus the rules that
 * failed, and the rules are the part someone can act on — so they render as a
 * list under the summary rather than being dropped.
 */
export function ApiErrorAlert({
  error,
  fallbackMessage,
  className,
}: ApiErrorAlertProps) {
  if (!error) return null;

  const { message, details } = normalizeApiError(error, fallbackMessage);

  return (
    <Alert variant="destructive" className={cn(className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <span>{message}</span>
        {details.length > 0 && (
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

export default ApiErrorAlert;
