import { Fragment, type ReactNode, type SyntheticEvent } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** Shown in danger color, after a separator, at the end of the menu. */
  destructive?: boolean;
}

export interface RowActionsMenuProps {
  /** Accessible name for the trigger, such as "Actions for Marcus Webb". */
  label: string;
  /** Only the actions the viewer can use; hidden ones are left out. */
  actions: RowAction[];
}

// A row click opens the detail page, so clicks on the menu stay here.
function stop(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * The "…" menu at the end of a list row. Destructive items go last, after
 * a separator; the caller confirms them with ConfirmDialog.
 */
export function RowActionsMenu({ label, actions }: RowActionsMenuProps) {
  if (actions.length === 0) {
    return null;
  }

  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={stop} onKeyDown={stop}>
        <Button variant="ghost" size="icon" aria-label={label}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        {regular.map((action) => (
          <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
        {destructive.map((action, index) => (
          <Fragment key={action.label}>
            {index === 0 && regular.length > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            <DropdownMenuItem variant="destructive" onSelect={action.onSelect}>
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
