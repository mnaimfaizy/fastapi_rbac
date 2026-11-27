import { z } from 'zod';

import { PASSWORD_RULES } from './passwordPolicy';

/**
 * The one Zod schema every password field uses (#194).
 *
 * Each form used to spell its own rule out — `min(8)` in five places, plus a
 * charset regex in one of them — which is how the client came to disagree with
 * the API and with itself. Forms import this instead; the rules live in
 * `passwordPolicy.ts`, which mirrors the backend settings.
 *
 * Reports every failed rule rather than stopping at the first, so the field
 * error and the checklist under it agree.
 */
export const passwordPolicySchema = z.string().superRefine((value, ctx) => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(value)) {
      ctx.addIssue({ code: 'custom', message: rule.message });
    }
  }
});
