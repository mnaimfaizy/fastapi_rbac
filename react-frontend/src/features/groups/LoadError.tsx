import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface LoadErrorProps {
  /** Names what failed, such as "Couldn’t load role groups". */
  title: string;
  message: string;
  onRetry: () => void;
}

/** A failed load, with a way to try again. */
export function LoadError({ title, message, onRetry }: LoadErrorProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        {message}
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
