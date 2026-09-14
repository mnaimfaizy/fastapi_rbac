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

/**
 * The same policy for a field where blank means "leave the password alone".
 *
 * The admin user-edit form is one field serving two jobs: on an existing user a
 * blank password keeps the current one (`UserEditForm` drops an empty password
 * from the payload), while on a new user it is required and checked at submit.
 * Only blank is exempt — anything typed faces the full policy.
 *
 * Lives here rather than in the form so that "every password field uses the one
 * schema" survives the optional case, which is where the last `min(8)` hid.
 */
export const optionalPasswordPolicySchema = passwordPolicySchema
  .optional()
  .or(z.literal(''));
