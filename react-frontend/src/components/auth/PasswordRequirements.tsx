import { Check, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PASSWORD_RULES } from '@/lib/passwordPolicy';

interface PasswordRequirementsProps {
  /** The current field value. Pass '' before the person has typed. */
  value: string;
  className?: string;
  id?: string;
}

/**
 * The password rules, ticked off live as someone types (#194).
 *
 * Before this, a person choosing a password was told "at least 8 characters"
 * and then refused by an API that wanted twelve plus four character classes and
 * no sequential run. The rules come from `passwordPolicy.ts`, which mirrors the
 * backend settings, so this list cannot drift from the field validation beside
 * it.
 *
 * An empty field renders every rule as outstanding, including the ones an empty
 * string trivially satisfies (it is under 128 characters, contains no repeated
 * run). Ticking those before the first keystroke reads as progress already
 * made.
 */
export function PasswordRequirements({
  value,
  className,
  id,
}: PasswordRequirementsProps) {
  const touched = value.length > 0;

  return (
    <div className={cn('text-xs', className)} id={id}>
      <p className="mb-1 font-medium text-muted-foreground">
        Your password must have:
      </p>
      <ul className="grid gap-0.5" aria-live="polite">
        {PASSWORD_RULES.map((rule) => {
          const met = touched && rule.test(value);
          return (
            <li
              key={rule.id}
              className={cn(
                'flex items-start gap-1.5',
                met
                  ? 'text-green-700 dark:text-green-500'
                  : 'text-muted-foreground'
              )}
            >
              {met ? (
                <Check className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              )}
              <span>
                {rule.label}
                <span className="sr-only">
                  {met ? ' — met' : ' — not yet met'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PasswordRequirements;
