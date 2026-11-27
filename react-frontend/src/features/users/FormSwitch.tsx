import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * An on/off setting as the user form artboards draw it: label and
 * description on the left, a switch on the right. `components/ui` has no
 * switch, so this one lives with the users forms.
 */
export function FormSwitch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Shown under the description, such as a warning. */
  children?: ReactNode;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-foreground text-sm font-medium">
          {label}
        </span>
        {description ? (
          <span
            id={descriptionId}
            className="text-foreground-secondary text-[13px]"
          >
            {description}
          </span>
        ) : null}
        {children}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'focus-visible:ring-ring inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-muted-foreground/60'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'bg-background size-5 rounded-full shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}
