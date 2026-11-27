import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A zone east of UTC, set before any module loads, so a naive API timestamp
// read as local time shows a different instant than the real one. Vitest runs
// each test file in its own process, so this stays in this file.
vi.hoisted(() => {
  process.env.TZ = 'Australia/Sydney';
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { renderWithProviders } from './test-utils';
import UserDetailContent from '../features/users/UserDetailContent';
import userService from '../services/user.service';
import authService from '../services/auth.service';
import { roleService } from '../services/role.service';
import roleGroupService from '../services/roleGroup.service';
import type { User } from '../models/user';
import {
  HANNAH,
  NORA,
  ROLE_CATALOG,
  ROLE_GROUPS_RESPONSE,
  at,
  makeUser,
  viewerState,
} from './user-pages-test-utils';

vi.mock('../services/user.service');
vi.mock('../services/auth.service', () => ({
  default: { resendVerificationEmail: vi.fn() },
}));
vi.mock('../services/role.service', () => ({
  roleService: { getAllRoles: vi.fn() },
}));
vi.mock('../services/roleGroup.service', () => ({
  default: { getRoleGroups: vi.fn() },
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockUserService = vi.mocked(userService);
const mockAuthService = vi.mocked(authService);

/** What `GET /users/{id}` sends today: no created_at or updated_at. */
function singleRead(user: User): User {
  const rest: Partial<User> = { ...user };
  delete rest.created_at;
  delete rest.updated_at;
  return rest as User;
}

function listPage(items: User[], page: number, pages: number) {
  return {
    items,
    total: items.length,
    page,
    size: 100,
    pages,
    previous_page: null,
    next_page: null,
  };
}

async function renderDetail(sent: User) {
  mockUserService.getUserById.mockResolvedValue(sent);
  renderWithProviders(
    at(
      `/dashboard/users/${sent.id}`,
      <Routes>
        <Route
          path="/dashboard/users/:userId"
          element={<UserDetailContent />}
        />
      </Routes>
    ),
    { preloadedState: viewerState('admin') }
  );
  await screen.findByRole('heading', {
    level: 1,
    name: `${sent.first_name} ${sent.last_name}`,
  });
}

function fact(panel: string, label: string) {
  const region = screen.getByRole('region', { name: panel });
  const term = within(region).getByText(label, { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
}

describe('User detail, QA findings on #462', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(roleService).getAllRoles.mockResolvedValue({
      data: ROLE_CATALOG,
      message: 'ok',
      meta: {},
    });
    vi.mocked(roleGroupService).getRoleGroups.mockResolvedValue(
      ROLE_GROUPS_RESPONSE as never
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.pushState({}, '', '/');
  });

  describe('timestamps without a zone, in a UTC+11 browser', () => {
    it('shows the lock time as the UTC instant it is', async () => {
      await renderDetail(
        makeUser({
          id: 'u-locked',
          first_name: 'Grace',
          last_name: 'Mensah',
          is_locked: true,
          locked_until: '2026-11-27T00:48:13.867974',
          number_of_failed_attempts: 3,
        })
      );

      expect(
        screen.getByText('Locked until 27 Nov 2026, 00:48 UTC')
      ).toBeInTheDocument();
    });

    it('counts password age from the real instant', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-27T00:50:00Z'));
      await renderDetail({
        ...NORA,
        last_changed_password_date: '2026-11-27T00:30:00.000000',
      });

      expect(fact('Password and security', 'Password age')).toHaveTextContent(
        '0 days'
      );
      expect(fact('Password and security', 'Last changed')).toHaveTextContent(
        'Nov 27, 2026'
      );
    });
  });

  describe('Created and Last updated', () => {
    const listed: User = {
      ...NORA,
      // 20:00 UTC is the next morning in Sydney.
      created_at: '2026-03-03T20:00:00.000000',
      updated_at: '2026-11-14T20:00:00.000000',
    };

    it('come from the users list when the single-user read omits them', async () => {
      mockUserService.getUsers.mockImplementation(async (page) =>
        page === 1 ? listPage([HANNAH], 1, 2) : listPage([listed], 2, 2)
      );
      await renderDetail(singleRead(listed));

      await waitFor(() =>
        expect(fact('Basic information', 'Created')).toHaveTextContent(
          'Mar 4, 2026'
        )
      );
      expect(fact('Basic information', 'Last updated')).toHaveTextContent(
        'Nov 15, 2026'
      );
      expect(mockUserService.getUsers).toHaveBeenCalledTimes(2);
    });

    it('need no list read when the single-user read has them', async () => {
      await renderDetail(listed);

      expect(fact('Basic information', 'Created')).toHaveTextContent(
        'Mar 4, 2026'
      );
      expect(mockUserService.getUsers).not.toHaveBeenCalled();
    });

    it('stay a dash when the list read fails', async () => {
      mockUserService.getUsers.mockRejectedValue(new Error('Network Error'));
      await renderDetail(singleRead(listed));

      await waitFor(() => expect(mockUserService.getUsers).toHaveBeenCalled());
      expect(fact('Basic information', 'Created')).toHaveTextContent('—');
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  it('confirms a resend with a neutral info toast at the bottom right', async () => {
    mockAuthService.resendVerificationEmail.mockResolvedValue(undefined);
    await renderDetail(HANNAH);

    await user.click(
      screen.getByRole('button', { name: 'Resend verification email' })
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        'If this account still needs verifying, an email is on its way.',
        expect.objectContaining({
          position: 'bottom-right',
          icon: expect.anything(),
        })
      )
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('draws the trash icon in the delete dialog', async () => {
    await renderDetail(NORA);

    await user.click(
      screen.getByRole('button', { name: 'More actions for Nora Free' })
    );
    await user.click(screen.getByRole('menuitem', { name: 'Delete user' }));

    expect(
      screen.getByRole('alertdialog').querySelector('svg.lucide-trash')
    ).toBeInTheDocument();
  });
});
