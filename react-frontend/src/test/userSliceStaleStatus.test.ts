import { describe, it, expect } from 'vitest';
import reducer, { fetchUsers } from '../store/slices/userSlice';
import { mockUsers } from './test-utils';

const page = (items: typeof mockUsers) => ({
  items,
  total: items.length,
  page: 1,
  size: 100,
  pages: 1,
  previous_page: null,
  next_page: null,
});

const pending = (status?: 'locked' | 'pending' | 'disabled') =>
  fetchUsers.pending('r', { status });
const fulfilled = (
  items: typeof mockUsers,
  status?: 'locked' | 'pending' | 'disabled'
) => fetchUsers.fulfilled(page(items), 'r', { status });

describe('userSlice fetchUsers status handling', () => {
  it('ignores a response for a status that is no longer the latest asked', () => {
    let state = reducer(undefined, pending('locked'));
    state = reducer(state, pending('disabled'));
    state = reducer(state, fulfilled([mockUsers[0]], 'locked'));

    expect(state.users).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state.loadedStatus).toBeUndefined();

    state = reducer(state, fulfilled([mockUsers[1]], 'disabled'));
    expect(state.users).toHaveLength(1);
    expect(state.users[0].id).toBe(mockUsers[1].id);
    expect(state.loading).toBe(false);
    expect(state.loadedStatus).toBe('disabled');
  });

  it('records the status the rows were loaded for', () => {
    let state = reducer(undefined, pending('locked'));
    state = reducer(state, fulfilled(mockUsers, 'locked'));
    expect(state.loadedStatus).toBe('locked');
    expect(state.users).toHaveLength(mockUsers.length);
  });
});
