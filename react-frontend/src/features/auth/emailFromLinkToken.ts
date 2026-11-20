/**
 * The address a verification or reset link was mailed to.
 *
 * Both tokens are JWTs whose `sub` is the email (`create_verification_token`,
 * `create_reset_token`). This only reads the payload so the page can name the
 * address. It does not check the signature; the API still decides whether the
 * link is valid.
 */
export function emailFromLinkToken(token: string | null): string | null {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(
      padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '=')
    );
    const subject = (JSON.parse(json) as { sub?: unknown }).sub;
    if (typeof subject === 'string' && subject.includes('@')) {
      return subject;
    }
  } catch {
    return null;
  }
  return null;
}
