import { describe, it, expect } from 'vitest';
import { emailFromLinkToken } from '../features/auth/emailFromLinkToken';

function token(payload: unknown) {
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `e30.${body}.sig`;
}

describe('emailFromLinkToken', () => {
  it('returns the email in a well-formed link token', () => {
    expect(emailFromLinkToken(token({ sub: 'ada@example.com' }))).toBe(
      'ada@example.com'
    );
  });

  it('returns null for a missing token, a token with no payload, and a malformed payload', () => {
    expect(emailFromLinkToken(null)).toBeNull();
    expect(emailFromLinkToken('')).toBeNull();
    expect(emailFromLinkToken('not-a-jwt')).toBeNull();
    expect(emailFromLinkToken('e30..sig')).toBeNull();
    expect(emailFromLinkToken('e30.!!!.sig')).toBeNull();
    expect(emailFromLinkToken(`e30.${btoa('not-json')}.sig`)).toBeNull();
  });

  it('returns null when the subject is missing or is not an email', () => {
    expect(emailFromLinkToken(token({}))).toBeNull();
    expect(emailFromLinkToken(token({ sub: 42 }))).toBeNull();
    expect(emailFromLinkToken(token({ sub: 'not-an-email' }))).toBeNull();
    expect(emailFromLinkToken(token({ sub: null }))).toBeNull();
  });
});
