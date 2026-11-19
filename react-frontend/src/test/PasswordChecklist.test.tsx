import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordChecklist } from '../features/auth/components/PasswordChecklist';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_REPEATS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  PASSWORD_SPECIAL_CHARS,
} from '../lib/passwordPolicy';

vi.mock('@/lib/passwordPolicy', async () => {
  const actual = await vi.importActual<typeof import('@/lib/passwordPolicy')>(
    '@/lib/passwordPolicy'
  );
  return {
    ...actual,
    PASSWORD_RULES: [
      ...actual.PASSWORD_RULES,
      {
        id: 'unlisted',
        label: 'Policy fallback label',
        message: 'Policy fallback message',
        test: () => false,
      },
    ],
  };
});

describe('PasswordChecklist', () => {
  it('builds the numbered labels and the special-character list from the shared policy', () => {
    render(<PasswordChecklist value="" />);

    const rules = screen.getByRole('list', { name: 'Password rules' });
    expect(rules).toHaveTextContent(
      `At least ${PASSWORD_MIN_LENGTH} characters`
    );
    expect(rules).toHaveTextContent(
      `At most ${PASSWORD_MAX_LENGTH} characters`
    );
    expect(rules).toHaveTextContent(
      `No character repeated ${PASSWORD_MAX_REPEATS + 1} or more times in a row`
    );
    expect(rules).toHaveTextContent(PASSWORD_SPECIAL_CHARS);
    expect(PASSWORD_RULES.map((rule) => rule.id)).toContain('special');
  });

  it('falls back to the policy label when the artboard has no wording for a rule', () => {
    render(<PasswordChecklist value="a" />);

    const rules = screen.getByRole('list', { name: 'Password rules' });
    expect(rules).toHaveTextContent('Not yet met: Policy fallback label');
  });
});
