import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionsMenu } from '@/components/common/RowActionsMenu';

function renderInRow(onRowClick = vi.fn()) {
  const onView = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <table>
      <tbody>
        <tr onClick={onRowClick}>
          <td>Marcus Webb</td>
          <td>
            <RowActionsMenu
              label="Actions for Marcus Webb"
              actions={[
                { label: 'View user', onSelect: onView },
                { label: 'Edit user', onSelect: onEdit },
                { label: 'Delete user', onSelect: onDelete, destructive: true },
              ]}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
  return { onView, onEdit, onDelete, onRowClick };
}

describe('RowActionsMenu', () => {
  it('names its trigger after the row', () => {
    renderInRow();

    expect(
      screen.getByRole('button', { name: 'Actions for Marcus Webb' })
    ).toBeInTheDocument();
  });

  it('lists the actions, with the destructive one last', async () => {
    const user = userEvent.setup();
    renderInRow();

    await user.click(
      screen.getByRole('button', { name: 'Actions for Marcus Webb' })
    );

    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'View user',
      'Edit user',
      'Delete user',
    ]);
  });

  it('runs the chosen action without opening the row', async () => {
    const user = userEvent.setup();
    const { onEdit, onDelete, onRowClick } = renderInRow();

    await user.click(
      screen.getByRole('button', { name: 'Actions for Marcus Webb' })
    );
    await user.click(
      await screen.findByRole('menuitem', { name: 'Edit user' })
    );

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('renders nothing when the viewer has no actions', () => {
    render(<RowActionsMenu label="Actions for Marcus Webb" actions={[]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps keys and presses inside the menu from reaching the row', async () => {
    const onRowKeyDown = vi.fn();
    const onRowPointerDown = vi.fn();
    const onRowMouseDown = vi.fn();
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <table>
        <tbody>
          <tr
            tabIndex={0}
            onKeyDown={onRowKeyDown}
            onPointerDown={onRowPointerDown}
            onMouseDown={onRowMouseDown}
          >
            <td>Marcus Webb</td>
            <td>
              <RowActionsMenu
                label="Actions for Marcus Webb"
                actions={[{ label: 'Edit user', onSelect: onEdit }]}
              />
            </td>
          </tr>
        </tbody>
      </table>
    );

    screen.getByRole('button', { name: 'Actions for Marcus Webb' }).focus();
    await user.keyboard('{Enter}');
    const item = await screen.findByRole('menuitem', { name: 'Edit user' });
    await waitFor(() => expect(item).toHaveFocus());
    onRowPointerDown.mockClear();
    onRowMouseDown.mockClear();

    await user.keyboard('{Enter}');

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRowKeyDown).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Actions for Marcus Webb' })
    );
    onRowPointerDown.mockClear();
    onRowMouseDown.mockClear();
    await user.click(
      await screen.findByRole('menuitem', { name: 'Edit user' })
    );

    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(onRowPointerDown).not.toHaveBeenCalled();
    expect(onRowMouseDown).not.toHaveBeenCalled();
  });
});
