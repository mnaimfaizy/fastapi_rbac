import { useState, type ComponentProps } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ParentOption {
  id: string;
  name: string;
}

export interface ParentGroupSelectProps extends Omit<
  ComponentProps<typeof Button>,
  'value' | 'onChange'
> {
  value: string | null;
  onChange: (value: string | null) => void;
  /** The groups this group may sit under. */
  options: ParentOption[];
}

const NO_PARENT = 'No parent';

/**
 * A combobox for a group's parent: "No parent" or one of the groups,
 * searchable by name. Extra props (the form field's id and ARIA wiring)
 * go to the trigger.
 */
export function ParentGroupSelect({
  value,
  onChange,
  options,
  className,
  ...triggerProps
}: ParentGroupSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? options.filter((option) => option.name.toLowerCase().includes(needle))
    : options;
  const selected = options.find((option) => option.id === value);

  const choose = (next: string | null) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
          {...triggerProps}
        >
          <span className="truncate">{selected?.name ?? NO_PARENT}</span>
          <ChevronsUpDown aria-hidden="true" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search groups"
            aria-label="Search groups"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => choose(null)}>
                {NO_PARENT}
                <Check
                  aria-hidden="true"
                  className={cn(
                    'ml-auto',
                    value === null ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </CommandItem>
              {matches.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => choose(option.id)}
                >
                  {option.name}
                  <Check
                    aria-hidden="true"
                    className={cn(
                      'ml-auto',
                      value === option.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {needle ? (
            <p
              className="text-foreground-secondary border-t px-3 py-2 text-xs"
              aria-live="polite"
            >
              {matches.length} of {options.length}{' '}
              {options.length === 1 ? 'group' : 'groups'} match
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
