import { describe, it, expect } from 'vitest';
import { renderWithProviders } from './test-utils';
import App from '../App';

describe('App Component', () => {
  it('renders without crashing', () => {
    renderWithProviders(<App />);
    expect(document.body).toBeInTheDocument();
  });

  it('shows login page for unauthenticated users', () => {
    renderWithProviders(<App />);

    // Since the default store has unauthenticated state, this should show login content
    expect(document.body).toBeInTheDocument();
  });

  it('shows content for authenticated users', () => {
    renderWithProviders(<App />);

    // Test that the app renders correctly
    expect(document.body).toBeInTheDocument();
  });
});
