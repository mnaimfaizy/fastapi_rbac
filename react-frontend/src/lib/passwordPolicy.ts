/**
 * Mirror of the backend password policy (#192, #194).
 *
 * The backend is authoritative. `PasswordValidator.validate_complexity` in
 * `backend/app/core/security.py` reads the `PASSWORD_*` / `PREVENT_*` settings,
 * and every endpoint that sets a password applies it through one call to
 * `enforce_password_complexity` (`backend/app/utils/password_policy.py`).
 *
 * This module exists so a form can tell someone the rules *before* they submit
 * and hand back a real password, not so the browser can decide anything: a
 * password that slips past these checks is still refused by the API. #192 was
 * caused by exactly one policy having two implementations that drifted, so
 * treat this file as a copy that must be re-synced whenever a `PASSWORD_*`
 * setting changes, and keep the thresholds in one place here rather than
 * inlining them into forms.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/** Mirrors `settings.COMMON_PASSWORDS`; compared against the whole password, lowercased. */
const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  'qwerty',
  'abc123',
  'letmein',
  'admin',
  'welcome',
  'monkey',
  'password1',
  '123456789',
  'football',
  '000000',
  'qwerty123',
  '1234567',
  '123123',
  '12345678',
  'dragon',
  'baseball',
  'shadow',
  'master',
  '666666',
  'qwertyuiop',
  '123321',
  'mustang',
  'michael',
  'superman',
  'princess',
  '123qwe',
  'password123',
]);

const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '0123456789',
];

const SEQUENCE_LENGTH = 3;
const MAX_REPEATS = 3;

/** True when the password contains a run like `abc`, `XYZ`, `123` — or its reverse. */
export const hasSequentialChars = (password: string): boolean =>
  SEQUENCES.some((sequence) => {
    for (let i = 0; i <= sequence.length - SEQUENCE_LENGTH; i++) {
      const run = sequence.slice(i, i + SEQUENCE_LENGTH);
      if (password.includes(run)) return true;
      if (password.includes([...run].reverse().join(''))) return true;
    }
    return false;
  });

/** True when any character repeats more than three times in a row. */
export const hasRepeatedChars = (password: string): boolean => {
  let count = 1;
  let previous: string | null = null;

  for (const char of password) {
    if (char === previous) {
      count += 1;
      if (count > MAX_REPEATS) return true;
    } else {
      count = 1;
    }
    previous = char;
  }
  return false;
};

export interface PasswordRule {
  id: string;
  /** Short form, for the checklist under the field. */
  label: string;
  /** Full sentence, for form validation — worded as the API words it. */
  message: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'maxLength',
    label: `No more than ${PASSWORD_MAX_LENGTH} characters`,
    message: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
    test: (p) => p.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'An uppercase letter',
    message: 'Password must contain at least one uppercase letter',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lowercase',
    label: 'A lowercase letter',
    message: 'Password must contain at least one lowercase letter',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'digit',
    label: 'A number',
    message: 'Password must contain at least one digit',
    test: (p) => /\d/.test(p),
  },
  {
    id: 'special',
    label: `A special character (${PASSWORD_SPECIAL_CHARS})`,
    message: `Password must contain at least one special character from: ${PASSWORD_SPECIAL_CHARS}`,
    test: (p) => [...p].some((char) => PASSWORD_SPECIAL_CHARS.includes(char)),
  },
  {
    id: 'notCommon',
    label: 'Not a commonly used password',
    message: 'This password is too common. Please choose a stronger password',
    test: (p) => !COMMON_PASSWORDS.has(p.toLowerCase()),
  },
  {
    id: 'noSequential',
    label: 'No runs like abc or 123',
    message:
      'Password contains sequential characters (e.g., 123, abc). Please use a more random combination',
    test: (p) => !hasSequentialChars(p),
  },
  {
    id: 'noRepeats',
    label: 'No character repeated 4+ times in a row',
    message: 'Password contains too many repeated characters',
    test: (p) => !hasRepeatedChars(p),
  },
];

/**
 * The rules a password currently fails, in the order the API reports them.
 * Empty means the API should accept it.
 */
export const passwordPolicyIssues = (password: string): string[] =>
  PASSWORD_RULES.filter((rule) => !rule.test(password)).map(
    (rule) => rule.message
  );

export const isPasswordPolicyCompliant = (password: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.test(password));
