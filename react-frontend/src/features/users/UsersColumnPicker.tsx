import type { VisibilityState } from '@tanstack/react-table';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OPTIONAL_USER_COLUMNS } from './user-table-columns';

export interface UsersColumnPickerProps {
  visibility: VisibilityState;
  onChange: (visibility: VisibilityState) => void;
}

/** "Columns" menu that adds or removes the optional users-table columns. */
export function UsersColumnPicker({
  visibility,
  onChange,
}: UsersColumnPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Columns3 aria-hidden="true" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONAL_USER_COLUMNS.map(({ id, label }) => (
          <DropdownMenuCheckboxItem
            key={id}
            checked={visibility[id] !== false}
            // Keep the menu open so several columns can be ticked in a row.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange({ ...visibility, [id]: checked === true })
            }
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
