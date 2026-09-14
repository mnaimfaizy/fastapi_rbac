import { describe, it, expect } from 'vitest';

import {
  PASSWORD_RULES,
  isPasswordPolicyCompliant,
  passwordPolicyIssues,
} from '../../lib/passwordPolicy';
import {
  optionalPasswordPolicySchema,
  passwordPolicySchema,
} from '../../lib/passwordPolicySchema';

/**
 * The client policy must agree with the server policy (#194).
 *
 * #192 was one policy with two implementations that disagreed, so a test that
 * only checked this module against itself would miss the thing that actually
 * breaks. Every vector below was run through the backend's
 * `PasswordValidator.validate_complexity` on the pinned dependency set, and the
 * expected rule text is what the API actually returned — not what this module
 * says it should return. If the backend policy moves, these fail.
 */
const BACKEND_VERDICTS: ReadonlyArray<{
  password: string;
  valid: boolean;
  errors: string[];
}> = [
  {
    password: 'password',
    valid: false,
    errors: [
      'Password must be at least 12 characters long',
      'Password must contain at least one uppercase letter',
      'Password must contain at least one digit',
      'Password must contain at least one special character from: !@#$%^&*()_+-=[]{}|;:,.<>?',
      'This password is too common. Please choose a stronger password',
    ],
  },
  {
    password: 'NewPassword123!',
    valid: false,
    errors: [
      'Password contains sequential characters (e.g., 123, abc). Please use a more random combination',
    ],
  },
  {
    password: 'Short1!',
    valid: false,
    errors: ['Password must be at least 12 characters long'],
  },
  {
    password: 'nouppercase9!x',
    valid: false,
    errors: ['Password must contain at least one uppercase letter'],
  },
  {
    password: 'NOLOWERCASE9!X',
    valid: false,
    errors: ['Password must contain at least one lowercase letter'],
  },
  {
    password: 'NoDigitsHere!xy',
    valid: false,
    errors: ['Password must contain at least one digit'],
  },
  {
    password: 'NoSpecialChar9x',
    valid: false,
    errors: [
      'Password must contain at least one special character from: !@#$%^&*()_+-=[]{}|;:,.<>?',
    ],
  },
  {
    password: 'Passwooooord9!x',
    valid: false,
    errors: ['Password contains too many repeated characters'],
  },
  {
    password: '',
    valid: false,
    errors: [
      'Password must be at least 12 characters long',
      'Password must contain at least one uppercase letter',
      'Password must contain at least one lowercase letter',
      'Password must contain at least one digit',
      'Password must contain at least one special character from: !@#$%^&*()_+-=[]{}|;:,.<>?',
    ],
  },
  { password: 'Qa!7bXmKpLwZ', valid: true, errors: [] },
  { password: 'QaRegisterPass!47', valid: true, errors: [] },
];

describe('password policy agrees with the backend', () => {
  it.each(BACKEND_VERDICTS)(
    'reports the same rules for $password',
    ({ password, valid, errors }) => {
      expect(isPasswordPolicyCompliant(password)).toBe(valid);
      expect(passwordPolicyIssues(password)).toEqual(errors);
    }
  );

  it('rejects a password over the 128-character ceiling', () => {
    const issues = passwordPolicyIssues('Aa9!'.repeat(40)); // 160 chars
    expect(issues).toContain('Password must not exceed 128 characters');
  });

  it('catches reversed sequential runs, as the backend does', () => {
    const sequential =
      'Password contains sequential characters (e.g., 123, abc). Please use a more random combination';

    expect(passwordPolicyIssues('QacbaPassword!7')).toContain(sequential);
    expect(passwordPolicyIssues('QaZYXpassword!7')).toContain(sequential);

    // Case-sensitive, per alphabet: 'Cba' spans the upper and lower alphabets
    // and matches a run in neither. The backend accepts this one, so we must.
    expect(passwordPolicyIssues('QaCbaPassword!7')).toEqual([]);
  });
});

describe('passwordPolicySchema', () => {
  it('accepts a compliant password', () => {
    expect(passwordPolicySchema.safeParse('QaRegisterPass!47').success).toBe(
      true
    );
  });

  it('reports every failed rule, not just the first', () => {
    const result = passwordPolicySchema.safeParse('password');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toEqual(
      passwordPolicyIssues('password')
    );
  });

  it('never enforces a rule the checklist does not show', () => {
    // The checklist and the field validation read the same list. If they ever
    // diverge, someone is told the password is fine and then refused.
    const result = passwordPolicySchema.safeParse('Short1!');
    if (result.success) throw new Error('expected failure');
    const shown = PASSWORD_RULES.map((rule) => rule.message);
    for (const issue of result.error.issues) {
      expect(shown).toContain(issue.message);
    }
  });
});

describe('optionalPasswordPolicySchema', () => {
  /**
   * The admin user-edit form leaves the password field blank to mean "keep the
   * current one" (`UserEditForm` deletes an empty password from the payload
   * before it is sent). Blank must therefore pass, without the policy being
   * weakened for a password someone actually typed.
   */
  it('accepts a blank field, which means "leave the password alone"', () => {
    expect(optionalPasswordPolicySchema.safeParse('').success).toBe(true);
    expect(optionalPasswordPolicySchema.safeParse(undefined).success).toBe(
      true
    );
  });

  it('applies the full policy to a password that was typed', () => {
    expect(optionalPasswordPolicySchema.safeParse('Qa!7bXmKpLwZ').success).toBe(
      true
    );
    expect(optionalPasswordPolicySchema.safeParse('Password1').success).toBe(
      false
    );
  });

  it('rejects the 8-character password the form used to accept', () => {
    // The rule this form spelled out before #194 was `min(8)`, so a password
    // of exactly eight characters is the regression worth pinning.
    expect(optionalPasswordPolicySchema.safeParse('Abcd123!').success).toBe(
      false
    );
  });

  it('reports the same rules as the required schema, not a union error', () => {
    // Composed with a `''` branch, so a failing value must not collapse into
    // zod's generic "invalid union" message — the person needs the real rules.
    const result = optionalPasswordPolicySchema.safeParse('short');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toEqual(
      passwordPolicyIssues('short')
    );
  });
});
