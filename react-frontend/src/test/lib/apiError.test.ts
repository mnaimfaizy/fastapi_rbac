import { describe, it, expect } from 'vitest';

import { normalizeApiError } from '../../lib/apiError';

const COMPLEXITY_MESSAGE = 'Password does not meet complexity requirements.';
const RULES = [
  'Password must be at least 12 characters long',
  'Password must contain at least one digit',
];

describe('normalizeApiError', () => {
  it('reads the shape the axios interceptor produces', () => {
    expect(
      normalizeApiError({
        response: {
          data: {
            status: 'error',
            message: COMPLEXITY_MESSAGE,
            errors: RULES.map((message) => ({ message })),
          },
        },
      })
    ).toEqual({ message: COMPLEXITY_MESSAGE, details: RULES });
  });

  it('reads a raw FastAPI detail envelope that bypassed the interceptor', () => {
    expect(
      normalizeApiError({
        response: {
          data: { detail: { message: COMPLEXITY_MESSAGE, errors: RULES } },
        },
      })
    ).toEqual({ message: COMPLEXITY_MESSAGE, details: RULES });
  });

  it('reads what the auth thunks store in Redux', () => {
    expect(
      normalizeApiError({ message: COMPLEXITY_MESSAGE, errors: RULES })
    ).toEqual({ message: COMPLEXITY_MESSAGE, details: RULES });
  });

  it('passes a plain string through', () => {
    expect(normalizeApiError('Invalid Current Password')).toEqual({
      message: 'Invalid Current Password',
      details: [],
    });
  });

  it('does not repeat a lone detail string as its own bullet', () => {
    expect(
      normalizeApiError({
        response: {
          data: {
            status: 'error',
            message: 'Password too long',
            errors: [{ message: 'Password too long' }],
          },
        },
      })
    ).toEqual({ message: 'Password too long', details: [] });
  });

  it('falls back when the error carries no message', () => {
    expect(normalizeApiError({}, 'Registration failed.')).toEqual({
      message: 'Registration failed.',
      details: [],
    });
  });
});
