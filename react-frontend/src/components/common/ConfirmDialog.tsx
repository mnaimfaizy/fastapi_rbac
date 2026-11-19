import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the action and its target, such as "Delete user ‘Marcus Webb’?". */
  title: string;
  /** What the action affects, and whether it can be undone. */
  description: ReactNode;
  /** Verb for the confirm button, such as "Delete user". */
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * Runs on confirm. While a returned promise is pending the dialog stays
   * open and both buttons are disabled; it closes when the promise resolves
   * and stays open if it rejects, so the caller can show the error.
   */
  onConfirm: () => unknown;
  /** Danger styling for the confirm button. On by default. */
  destructive?: boolean;
  /**
   * When set, the person must type this exact text, such as a role's name,
   * before the confirm button turns on.
   */
  confirmText?: string;
}

/** One confirmation for every destructive or far-reaching action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = true,
  confirmText,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const fieldId = useId();

  useEffect(() => {
    if (open) {
      setTyped('');
    }
  }, [open]);

  const matches = confirmText === undefined || typed === confirmText;

  async function handleConfirm() {
    if (!matches || pending) {
      return;
    }
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the failure; keep the dialog open for a retry.
    } finally {
      setPending(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-foreground-secondary">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText !== undefined ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            <Label htmlFor={fieldId} className="font-normal">
              Type <code className="font-mono font-medium">{confirmText}</code>{' '}
              to confirm
            </Label>
            <Input
              id={fieldId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
            />
          </form>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={!matches || pending}
            aria-busy={pending || undefined}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
