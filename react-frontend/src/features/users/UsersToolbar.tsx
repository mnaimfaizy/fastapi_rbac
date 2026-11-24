import type { ReactNode } from 'react';
import { ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { STATUS_FILTERS, type StatusFilter } from './users-list-model';

const ALL = 'all';

interface FilterMenuProps {
  /** Accessible name, such as "Filter by role". */
  label: string;
  /** Visible prefix, such as "Role:". */
  prefix: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
  className?: string;
}

function FilterMenu({
  label,
  prefix,
  value,
  options,
  onChange,
  className,
}: FilterMenuProps) {
  const current =
    options.find((option) => option.value === value)?.label ?? 'All';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={label}
          className={cn(
            'h-10 justify-between gap-2 pr-2.5 pl-3 font-normal',
            className
          )}
        >
          <span className="flex gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{prefix}</span>
            <span>{current}</span>
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className="text-muted-foreground"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={value ?? ALL}
          onValueChange={(next) => onChange(next === ALL ? null : next)}
        >
          <DropdownMenuRadioItem value={ALL}>All</DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface UsersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  roles: string[];
  role: string | null;
  onRoleChange: (role: string | null) => void;
  status: StatusFilter | null;
  onStatusChange: (status: StatusFilter | null) => void;
  /** The column picker; left out on mobile. */
  columnPicker?: ReactNode;
  /** The mobile form: full-width search, filters side by side. */
  compact?: boolean;
}

/** Search by name or email, the role and status filters, and the picker. */
export function UsersToolbar({
  search,
  onSearchChange,
  roles,
  role,
  onRoleChange,
  status,
  onStatusChange,
  columnPicker,
  compact = false,
}: UsersToolbarProps) {
  const searchField = (
    <div className={cn('relative', compact ? 'w-full' : 'w-full sm:w-[300px]')}>
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        type="search"
        aria-label="Search users"
        placeholder="Search by name or email"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className={cn('pl-9', compact ? 'h-11' : 'h-10')}
      />
    </div>
  );

  const filters = (
    <>
      <FilterMenu
        label="Filter by role"
        prefix="Role:"
        value={role}
        options={roles.map((name) => ({ value: name, label: name }))}
        onChange={onRoleChange}
        className={compact ? 'flex-1' : 'w-[150px]'}
      />
      <FilterMenu
        label="Filter by status"
        prefix="Status:"
        value={status}
        options={STATUS_FILTERS.map((name) => ({ value: name, label: name }))}
        onChange={(next) => onStatusChange(next as StatusFilter | null)}
        className={compact ? 'flex-1' : 'w-[170px]'}
      />
    </>
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-4">
        {searchField}
        <div className="flex gap-2">{filters}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {searchField}
      {filters}
      <span className="flex-1" />
      {columnPicker}
    </div>
  );
}
