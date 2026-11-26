import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ConfirmDialog,
  type ConfirmDialogProps,
} from '@/components/common/ConfirmDialog';

function Harness(
  props: Partial<ConfirmDialogProps> & { onConfirm: () => unknown }
) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>{open ? 'Dialog open' : 'Dialog closed'}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete role ‘Manager’?"
        description="8 users hold this role. They’ll lose its 15 permissions."
        confirmLabel="Delete role"
        {...props}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('names the action and says what it affects', () => {
    render(<Harness onConfirm={vi.fn()} />);

    const dialog = screen.getByRole('alertdialog', {
      name: 'Delete role ‘Manager’?',
    });
    expect(dialog).toHaveAccessibleDescription(
      '8 users hold this role. They’ll lose its 15 permissions.'
    );
  });

  it('runs the action and closes when confirmed', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Delete role' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText('Dialog closed')).toBeInTheDocument()
    );
  });

  it('closes without running the action on Cancel', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Dialog closed')).toBeInTheDocument();
  });

  it('keeps the confirm button off until the name is typed exactly', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} confirmText="Manager" />);

    const confirm = screen.getByRole('button', { name: 'Delete role' });
    const field = screen.getByRole('textbox', {
      name: 'Type Manager to confirm',
    });
    expect(confirm).toBeDisabled();

    await user.type(field, 'manager');
    expect(confirm).toBeDisabled();

    await user.clear(field);
    await user.type(field, 'Manager');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('stays open and busy while an async action runs', async () => {
    let finish: () => void = () => {};
    const onConfirm = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve))
    );
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Delete role' }));

    expect(screen.getByText('Dialog open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete role' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    finish();
    await waitFor(() =>
      expect(screen.getByText('Dialog closed')).toBeInTheDocument()
    );
  });

  it('stays open when the action fails, so the person can retry', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Delete role' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete role' })).toBeEnabled()
    );
    expect(screen.getByText('Dialog open')).toBeInTheDocument();
  });

  it('ignores Escape while an async action is running', async () => {
    let finish: () => void = () => {};
    const onConfirm = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve))
    );
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Delete role' }));
    await user.keyboard('{Escape}');

    expect(screen.getByText('Dialog open')).toBeInTheDocument();
    expect(
      screen.getByRole('alertdialog', { name: 'Delete role ‘Manager’?' })
    ).toBeInTheDocument();

    finish();
    await waitFor(() =>
      expect(screen.getByText('Dialog closed')).toBeInTheDocument()
    );
  });

  it('closes on Escape when nothing is running', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    await user.keyboard('{Escape}');

    expect(screen.getByText('Dialog closed')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with Enter in the field only once the text matches', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} confirmText="Manager" />);

    const field = screen.getByRole('textbox', {
      name: 'Type Manager to confirm',
    });

    await user.type(field, 'Manag{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Dialog open')).toBeInTheDocument();

    await user.type(field, 'er{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText('Dialog closed')).toBeInTheDocument()
    );
  });

  it('shows an icon beside the title when one is given', () => {
    render(
      <Harness onConfirm={vi.fn()} icon={<svg data-testid="dialog-icon" />} />
    );

    const dialog = screen.getByRole('alertdialog', {
      name: 'Delete role ‘Manager’?',
    });
    expect(screen.getByTestId('dialog-icon')).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(
      '8 users hold this role. They’ll lose its 15 permissions.'
    );
  });

  it('shows no icon unless one is given', () => {
    render(<Harness onConfirm={vi.fn()} />);

    expect(screen.queryByTestId('dialog-icon')).not.toBeInTheDocument();
    expect(
      screen.getByRole('alertdialog', { name: 'Delete role ‘Manager’?' })
    ).toBeInTheDocument();
  });
});
