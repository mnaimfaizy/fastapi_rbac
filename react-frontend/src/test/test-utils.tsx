import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from '../store';

// Get the type of the root state and store
export type RootState = ReturnType<typeof store.getState>;
export type AppStore = typeof store;

// Mock data for testing
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  is_active: true,
  is_superuser: false,
  is_locked: false,
  locked_until: null,
  needs_to_change_password: false,
  verified: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  expiry_date: null,
  last_changed_password_date: null,
  contact_phone: null,
  number_of_failed_attempts: 0,
  verification_code: null,
  last_updated_by: null,
  roles: [
    {
      id: '1',
      name: 'user',
      description: 'Regular user role',
    },
  ],
  permissions: ['user.read'],
  role_id: ['1'],
};

export const mockToken = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  refresh_token: 'mock-refresh-token',
  user: mockUser,
};

// Custom render function with providers
interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  testStore?: AppStore;
}

export function renderWithProviders(
  ui: ReactElement,
  options: ExtendedRenderOptions = {}
) {
  const { testStore = store, ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={testStore}>
        <BrowserRouter>{children}</BrowserRouter>
      </Provider>
    );
  }

  return {
    store: testStore,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Helper functions for testing
export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};
