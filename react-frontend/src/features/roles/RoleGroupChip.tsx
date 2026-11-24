import { cn } from '@/lib/utils';

const CHIP =
  'inline-flex h-[22px] items-center rounded-md bg-muted px-2 text-xs font-medium whitespace-nowrap text-foreground';

/**
 * A role's group as the Web v1 artboards draw it: a grey chip. With
 * `onOpen` it is a button that opens the group; otherwise plain text.
 */
export function RoleGroupChip({
  name,
  onOpen,
  className,
}: {
  name: string;
  onOpen?: () => void;
  className?: string;
}) {
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          CHIP,
          'outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      >
        {name}
      </button>
    );
  }
  return <span className={cn(CHIP, className)}>{name}</span>;
}
