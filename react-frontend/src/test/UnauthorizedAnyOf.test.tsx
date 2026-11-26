import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { signedInAs } from './shell-test-utils';
import ProtectedRoute from '../components/auth/ProtectedRoute';

vi.mock('../services/auth.service');

function renderGuard(requiredPermissions: string[], requireAll: boolean) {
  window.history.pushState({}, '', '/dashboard/roles/edit/7');
  return renderWithProviders(
    <ProtectedRoute
      requiredPermissions={requiredPermissions}
      requireAllPermissions={requireAll}
    >
      <p>Refused page</p>
    </ProtectedRoute>,
    { preloadedState: signedInAs('manager') }
  );
}

describe('Unauthorized for a route that needs any one of several permissions', () => {
  it('names every permission that would have been enough', () => {
    renderGuard(['role.update', 'role.delete'], false);

    expect(
      screen.getByRole('heading', { name: 'You can’t edit roles' })
    ).toBeInTheDocument();
    const sentence = screen.getByText(/^You need/);
    expect(sentence).toHaveTextContent(
      'You need one of role.update or role.delete to edit roles. Ask an admin to add one to one of your roles.'
    );
    expect(
      within(sentence)
        .getAllByText(/^role\./)
        .map((code) => code.tagName)
    ).toEqual(['CODE', 'CODE']);
    expect(screen.queryByText('Refused page')).not.toBeInTheDocument();
  });

  it('opens the page when the viewer holds one of them', () => {
    renderGuard(['role.update', 'role.read'], false);

    expect(screen.getByText('Refused page')).toBeInTheDocument();
  });

  it('names only the first missing permission when all are required', () => {
    renderGuard(['role.read', 'role.update', 'role.delete'], true);

    expect(screen.getByText(/^You need/)).toHaveTextContent(
      'You need role.update to edit roles. Ask an admin to add it to one of your roles.'
    );
  });
});
