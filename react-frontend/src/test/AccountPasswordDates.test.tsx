import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A zone east of UTC, set before any module loads, so the old parse (naive
// timestamp read as local time) shows a different date than the real one.
// Vitest runs each test file in its own process, so this stays in this file.
vi.hoisted(() => {
  process.env.TZ = 'Asia/Tokyo';
});

import { screen, within } from '@testing-library/react';

import authService from '../services/auth.service';
import { parseApiTimestamp } from '../features/account/parseApiTimestamp';
import { renderAccountAt, resetBrowser } from './account-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/user.service');
vi.mock('../services/dashboard.service');
const mockAuthService = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
  resetBrowser();
  mockAuthService.logout.mockResolvedValue(undefined);
  mockAuthService.logoutAll.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseApiTimestamp', () => {
  it('reads a timestamp without an offset as UTC, as the API sends it', () => {
    expect(parseApiTimestamp('2026-11-24T00:12:03.123456')?.toISOString()).toBe(
      '2026-11-24T00:12:03.123Z'
    );
  });

  it.each([
    ['2026-11-24T00:12:03Z', '2026-11-24T00:12:03.000Z'],
    ['2026-11-24T09:12:03+09:00', '2026-11-24T00:12:03.000Z'],
    ['2026-11-23T19:12:03-0500', '2026-11-24T00:12:03.000Z'],
    ['2026-11-24', '2026-11-24T00:00:00.000Z'],
  ])('keeps the offset %s already carries', (value, iso) => {
    expect(parseApiTimestamp(value)?.toISOString()).toBe(iso);
  });

  it.each([null, undefined, '', 'not a date'])(
    'returns null for %s',
    (value) => {
      expect(parseApiTimestamp(value)).toBeNull();
    }
  );
});

describe('Security tab password status in a zone east of UTC', () => {
  it('shows the date and age of the change in the viewer’s own time', async () => {
    // 20:00 UTC on 9 Oct is 05:00 on 10 Oct in Tokyo.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T21:00:00Z'));
    renderAccountAt('/dashboard/account/security', 'user', {
      last_changed_password_date: '2026-10-09T20:00:00',
    });

    const status = await screen.findByRole('region', {
      name: 'Password status',
    });
    expect(within(status).getByText('10 Oct 2026')).toBeInTheDocument();
    expect(within(status).getByText('1 day')).toBeInTheDocument();
    expect(within(status).getByText('8 Jan 2027')).toBeInTheDocument();
  });
});
