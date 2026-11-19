import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from '../features/auth/components/PasswordField';

describe('PasswordField', () => {
  it('toggles between hidden and visible', async () => {
    const user = userEvent.setup();
    render(<PasswordField id="password" label="Password" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide password' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows an error and marks the field invalid', () => {
    render(
      <PasswordField id="new-password" label="New password" error="Too short" />
    );

    expect(screen.getByText('Too short')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('omits the error when the field is valid', () => {
    render(<PasswordField id="password" label="Password" />);
    expect(screen.getByLabelText('Password')).not.toHaveAttribute(
      'aria-invalid'
    );
    expect(screen.queryByText('Too short')).not.toBeInTheDocument();
  });
});
