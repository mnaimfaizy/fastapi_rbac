import { Check } from 'lucide-react';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_REPEATS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  PASSWORD_SPECIAL_CHARS,
} from '@/lib/passwordPolicy';
import { cn } from '@/lib/utils';

/**
 * Artboard wording for each policy rule. Length, the repeat count, and the
 * accepted special characters come from the shared policy constants. The
 * pass/fail test stays `PASSWORD_RULES`, so the list cannot enforce something
 * the API does not. An id the artboard does not name falls back to `rule.label`.
 */
const CHECKLIST_LABELS: Record<string, string> = {
  length: `At least ${PASSWORD_MIN_LENGTH} characters`,
  maxLength: `At most ${PASSWORD_MAX_LENGTH} characters`,
  uppercase: 'An uppercase letter',
  lowercase: 'A lowercase letter',
  digit: 'A number',
  special: `A special character (${PASSWORD_SPECIAL_CHARS})`,
  notCommon: 'Not a common password',
  noSequential: 'No runs like abc or 123',
  noRepeats: `No character repeated ${PASSWORD_MAX_REPEATS + 1} or more times in a row`,
};

export function PasswordChecklist({ value }: { value: string }) {
  const touched = value.length > 0;

  return (
    <ul
      aria-label="Password rules"
      className="border-border bg-sidebar grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border px-3.5 py-3"
    >
      {PASSWORD_RULES.map((rule) => {
        const met = touched && rule.test(value);
        const label = CHECKLIST_LABELS[rule.id] ?? rule.label;
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2 text-[13px] leading-4 last:col-span-2',
              met
                ? 'text-status-success-foreground'
                : 'text-foreground-secondary'
            )}
          >
            {met ? (
              <span className="bg-status-success flex size-4 shrink-0 items-center justify-center rounded-full">
                <Check
                  className="size-2.5"
                  strokeWidth={3}
                  aria-hidden="true"
                />
              </span>
            ) : (
              <span
                className="border-muted-foreground size-4 shrink-0 rounded-full border-[1.5px]"
                aria-hidden="true"
              />
            )}
            <span>
              <span className="sr-only">{met ? 'Met: ' : 'Not yet met: '}</span>
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
