import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderTree, ShieldCheck } from 'lucide-react';
import { renderWithProviders } from './test-utils';
import { GroupTree } from '../features/groups/GroupTree';
import { buildGroupTree, type FlatGroup } from '../features/groups/treeModel';

// In the order the Web v1 artboard draws them.
const flat: FlatGroup[] = [
  {
    id: 'admin',
    name: 'Administrative',
    parentId: null,
    createdAt: '2026-01-12T10:00:00Z',
    href: '/dashboard/role-groups/admin',
    members: [{ id: 'r-admin', name: 'Admin', detail: '3 users' }],
  },
  {
    id: 'ops',
    name: 'Operational',
    parentId: null,
    createdAt: '2026-01-12T10:00:00Z',
    href: '/dashboard/role-groups/ops',
    members: [{ id: 'r-manager', name: 'Manager', detail: '8 users' }],
  },
  {
    id: 'support',
    name: 'Support',
    parentId: 'ops',
    createdAt: '2026-11-19T10:00:00Z',
    href: '/dashboard/role-groups/support',
    members: [],
  },
  {
    id: 'standard',
    name: 'StandardUser',
    parentId: null,
    createdAt: '2026-01-12T10:00:00Z',
    href: '/dashboard/role-groups/standard',
    members: [{ id: 'r-user', name: 'User', detail: '2 users' }],
  },
];

function renderTree(groups: FlatGroup[] = flat) {
  const onEdit = vi.fn();
  renderWithProviders(
    <GroupTree
      groups={buildGroupTree(groups)}
      groupsLabel="role groups"
      memberNoun={{ one: 'role', other: 'roles' }}
      groupIcon={FolderTree}
      memberIcon={ShieldCheck}
      actionsFor={(group) => [
        { label: 'Edit', onSelect: () => onEdit(group.id) },
      ]}
      emptyState={{
        title: 'Create your first role group',
        description: 'Groups keep related roles together as the list grows.',
        action: { label: 'Create role group', onClick: vi.fn() },
      }}
    />
  );
  return { onEdit };
}

function rowFor(name: string) {
  const link = screen.getByRole('link', { name });
  return link.closest('tr') as HTMLElement;
}

function rowTexts() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent ?? '');
}

describe('GroupTree', () => {
  it('nests a child group under its parent and names the parent', () => {
    renderTree();

    const texts = rowTexts();
    const parentIndex = texts.findIndex((t) => t.startsWith('Operational'));
    expect(texts[parentIndex + 1]).toMatch(/^Support/);
    expect(within(rowFor('Support')).getByText('Operational')).toBeVisible();
    expect(within(rowFor('Operational')).getByText('—')).toBeVisible();
  });

  it('lists child groups, then members, under an open group', () => {
    renderTree();

    const texts = rowTexts();
    expect(texts).toEqual([
      expect.stringMatching(/^Administrative/),
      expect.stringMatching(/^Admin3 users$/),
      expect.stringMatching(/^Operational/),
      expect.stringMatching(/^Support/),
      expect.stringMatching(/^Manager8 users$/),
      expect.stringMatching(/^StandardUser/),
    ]);
  });

  it('shows a count chip of members and child groups', () => {
    renderTree();

    expect(
      within(rowFor('Operational')).getByText('1 role · 1 group')
    ).toBeVisible();
    expect(within(rowFor('Support')).getByText('0 roles')).toBeVisible();
    expect(within(rowFor('Administrative')).getByText('1 role')).toBeVisible();
  });

  it('collapses and expands a group', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(
      screen.getByRole('button', { name: 'Collapse Operational' })
    );
    expect(
      screen.queryByRole('link', { name: 'Support' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Manager')).not.toBeInTheDocument();

    const expand = screen.getByRole('button', { name: 'Expand Operational' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await user.click(expand);
    expect(screen.getByRole('link', { name: 'Support' })).toBeVisible();
    expect(screen.getByText('Manager')).toBeVisible();
  });

  it('expands and collapses every group at once', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('2 users')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(
      screen.queryByRole('link', { name: 'Support' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByRole('link', { name: 'Support' })).toBeVisible();
    expect(screen.getByText('Admin')).toBeVisible();
  });

  it('gives each group a "…" menu with its actions', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderTree();

    await user.click(
      screen.getByRole('button', { name: 'Actions for Support' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith('support');
  });

  it('keeps the path to a search match and offers to clear a miss', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.type(
      screen.getByRole('searchbox', { name: 'Search role groups' }),
      'supp'
    );
    expect(screen.getByRole('link', { name: 'Operational' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Support' })).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Administrative' })
    ).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(
      screen.getByRole('heading', { name: 'No role groups match ‘suppzzz’' })
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('link', { name: 'Administrative' })).toBeVisible();
  });

  it('uses the shared empty state when there are no groups', () => {
    renderTree([]);

    expect(
      screen.getByRole('heading', { name: 'Create your first role group' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Create role group' })
    ).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('makes a group whose parent is missing a root', () => {
    renderTree([
      {
        id: 'orphan',
        name: 'Orphan',
        parentId: 'gone',
        href: '/x',
        members: [],
      },
    ]);
    const parentCell = within(rowFor('Orphan')).getAllByRole('cell')[1];
    expect(parentCell).toHaveTextContent(/^—$/);
  });

  it('keeps each group’s whole counts while a search trims its rows', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.type(
      screen.getByRole('searchbox', { name: 'Search role groups' }),
      'Manager'
    );
    // Only Manager matches, but Operational still has 1 role and 1 group.
    expect(
      screen.queryByRole('link', { name: 'Support' })
    ).not.toBeInTheDocument();
    expect(
      within(rowFor('Operational')).getByText('1 role · 1 group')
    ).toBeVisible();
  });

  it('opens the first group and groups with child groups, and closes the rest', async () => {
    const user = userEvent.setup();
    renderTree();

    // Administrative is first, Operational holds a child group; StandardUser
    // is neither, so it starts closed.
    expect(
      screen.getByRole('button', { name: 'Collapse Administrative' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Collapse Operational' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Expand StandardUser' })
    ).toBeVisible();
    expect(screen.queryByText('2 users')).not.toBeInTheDocument();
    // Not every group is open, so the toolbar offers to expand them all.
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('2 users')).toBeVisible();
  });

  it('keeps the order the page gives its groups', () => {
    renderTree([flat[3], flat[1], flat[0], flat[2]]);

    const names = screen
      .getAllByRole('link')
      .map((link) => link.textContent)
      .filter((name) =>
        ['StandardUser', 'Operational', 'Administrative'].includes(name ?? '')
      );
    expect(names).toEqual(['StandardUser', 'Operational', 'Administrative']);
  });

  it('draws the group and member icons it is given', () => {
    renderTree();

    expect(
      within(rowFor('Operational')).getByText('Operational')
        .previousElementSibling
    ).toHaveClass('lucide-folder-tree');
    expect(screen.getByText('Manager').previousElementSibling).toHaveClass(
      'lucide-shield-check'
    );
  });
});
