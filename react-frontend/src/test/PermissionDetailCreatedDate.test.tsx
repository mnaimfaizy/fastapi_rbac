import { describe, it, expect, vi, beforeEach } from 'vitest';

// A zone east of UTC, set before any module loads. Reading a naive timestamp
// as local time here moves 08:08 UTC on 16 Nov back to 15 Nov. Vitest runs
// each test file in its own process, so this stays in this file.
vi.hoisted(() => {
  process.env.TZ = 'Australia/Sydney';
});

import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import PermissionDetail from '@/features/permissions/PermissionDetail';
import permissionService from '@/services/permission.service';
import { renderWithProviders } from './test-utils';
import { signedInAs } from './shell-test-utils';

vi.mock('@/services/permission.service');

const mockPermissionService = vi.mocked(permissionService);

function renderWithCreated(createdAt: string) {
  mockPermissionService.getPermissionById.mockResolvedValue({
    data: {
      id: 'perm-1',
      name: 'user.read',
      description: 'Read users',
      group: {
        id: 'g-user',
        name: 'User',
        created_at: createdAt,
        updated_at: createdAt,
      },
      created_at: createdAt,
      updated_at: createdAt,
      roles: [],
    },
    message: '',
    meta: {},
  });
  window.history.pushState({}, '', '/dashboard/permissions/perm-1');
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard/permissions/:id" element={<PermissionDetail />} />
    </Routes>,
    { preloadedState: signedInAs('admin') }
  );
}

describe('Permission detail Created date in a zone east of UTC', () => {
  beforeEach(() => {
    mockPermissionService.getPermissionById.mockReset();
  });

  it('reads a timestamp without an offset as UTC', async () => {
    renderWithCreated('2026-11-16T08:08:06.258136');

    expect(
      await screen.findByRole('heading', { name: 'user.read' })
    ).toBeInTheDocument();
    expect(screen.getByText('16 Nov 2026')).toBeInTheDocument();
  });

  it('keeps a timestamp that already has an offset', async () => {
    renderWithCreated('2026-11-16T08:08:06Z');

    expect(
      await screen.findByRole('heading', { name: 'user.read' })
    ).toBeInTheDocument();
    expect(screen.getByText('16 Nov 2026')).toBeInTheDocument();
  });
});
