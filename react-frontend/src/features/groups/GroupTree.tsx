import {
  Fragment,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
} from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  EmptyState,
  type EmptyStateProps,
} from '@/components/common/EmptyState';
import {
  RowActionsMenu,
  type RowAction,
} from '@/components/common/RowActionsMenu';
import { cn } from '@/lib/utils';
import {
  filterGroupTree,
  flattenTree,
  formatCreated,
  memberSummary,
  type GroupMember,
  type GroupNode,
  type MemberNoun,
} from './treeModel';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface GroupTreeProps {
  /** The tree from `buildGroupTree`. */
  groups: GroupNode[];
  /** Plural name of the groups, such as "role groups". */
  groupsLabel: string;
  /** The icon in front of each group's name. */
  groupIcon: Icon;
  memberNoun: MemberNoun;
  /** The icon in front of each member's name. */
  memberIcon: Icon;
  /** Show member names in a monospace face, as for permission codes. */
  monoMembers?: boolean;
  /** The Members column's width in pixels, from the artboard. */
  membersWidth?: number;
  /** Only the actions the viewer can use. */
  actionsFor: (group: GroupNode) => RowAction[];
  /** What an empty tree shows. */
  emptyState: EmptyStateProps;
  /**
   * Whether the members behind the count chips are known. `loading` shows
   * a placeholder and `unavailable` a dash, so a chip never shows a count
   * the members have not arrived for.
   */
  memberCounts?: 'ready' | 'loading' | 'unavailable';
}

function hasRows(node: GroupNode) {
  return node.children.length > 0 || (node.members?.length ?? 0) > 0;
}

/**
 * The groups open before anyone toggles anything: the first top-level group,
 * and every top-level group that holds child groups. Child groups start
 * closed, as the Web v1 artboards draw them.
 */
function initiallyOpen(groups: GroupNode[]) {
  return new Set(
    groups
      .filter(
        (group, index) =>
          hasRows(group) && (index === 0 || group.children.length > 0)
      )
      .map((group) => group.id)
  );
}

// Offsets from the Web v1 artboards: a child group steps in by one
// chevron button plus its gap, and a member sits one chevron further in.
const STEP_PX = 34;
// The Parent, Created and Actions columns, and the narrowest Name column
// that still fits a nested group's chevron, icon and name.
const FIXED_COLUMNS_PX = 160 + 150 + 64;
const NAME_MIN_PX = 240;
const MEMBER_INDENT_PX = 62;
const GUIDE_LEFT_PX = 27;

/** The elbow that joins a row to the open group above it. */
function Guide({ depth }: { depth: number }) {
  return (
    <span
      aria-hidden="true"
      className="border-input absolute top-[-22px] bottom-1/2 w-3 rounded-bl-[6px] border-b border-l"
      style={{ left: GUIDE_LEFT_PX + STEP_PX * (depth - 1) }}
    />
  );
}

/**
 * Role groups or permission groups as an expandable tree: each group with
 * its child groups, then its members, a count chip and the "…" menu.
 */
export function GroupTree({
  groups,
  groupsLabel,
  groupIcon: GroupIcon,
  memberNoun,
  memberIcon: MemberIcon,
  monoMembers = false,
  membersWidth = 140,
  actionsFor,
  emptyState,
  memberCounts = 'ready',
}: GroupTreeProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  const searching = query.trim().length > 0;
  const visible = useMemo(
    () => filterGroupTree(groups, query),
    [groups, query]
  );
  // Every group has a chevron, empty ones too, as the artboards draw them.
  const allGroups = useMemo(() => flattenTree(groups), [groups]);

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border">
        <EmptyState icon={GroupIcon} {...emptyState} />
      </div>
    );
  }

  const open = expanded ?? initiallyOpen(groups);
  // A search opens every group on the way to a match.
  const isOpen = (id: string) => searching || open.has(id);
  const allOpen = allGroups.every((group) => open.has(group.id));

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded(next);
  };

  const toggleAll = () => {
    setExpanded(
      allOpen ? new Set() : new Set(allGroups.map((group) => group.id))
    );
  };

  const renderMember = (member: GroupMember, depth: number) => (
    <TableRow key={`member-${member.id}`} className="bg-muted/40">
      <TableCell colSpan={4} className="h-11 px-4 py-0">
        <div
          className="relative flex items-center gap-2.5"
          style={{ paddingLeft: MEMBER_INDENT_PX + STEP_PX * (depth - 1) }}
        >
          <Guide depth={depth} />
          <MemberIcon
            aria-hidden={true}
            className="text-muted-foreground size-3.5 shrink-0"
          />
          {member.href ? (
            <Link
              to={member.href}
              className={monoMembers ? 'font-mono text-[13px]' : 'text-sm'}
            >
              {member.name}
            </Link>
          ) : (
            <span className={monoMembers ? 'font-mono text-[13px]' : 'text-sm'}>
              {member.name}
            </span>
          )}
          {member.detail ? (
            <span className="text-foreground-secondary text-[13px]">
              {member.detail}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="h-11 px-4 py-0" />
    </TableRow>
  );

  const renderGroup = (node: GroupNode, depth: number) => {
    const nodeOpen = isOpen(node.id);
    return (
      <Fragment key={node.id}>
        <TableRow className={cn(depth > 0 && 'bg-muted/40')}>
          <TableCell className="h-[52px] px-4 py-0">
            <div
              className="relative flex items-center gap-1.5"
              style={{ paddingLeft: depth * STEP_PX }}
            >
              {depth > 0 ? <Guide depth={depth} /> : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-foreground-secondary size-7"
                aria-expanded={nodeOpen}
                aria-label={`${nodeOpen ? 'Collapse' : 'Expand'} ${node.name}`}
                onClick={() => toggle(node.id)}
                disabled={searching}
              >
                {nodeOpen ? (
                  <ChevronDown aria-hidden="true" />
                ) : (
                  <ChevronRight aria-hidden="true" />
                )}
              </Button>
              <GroupIcon
                aria-hidden={true}
                className="text-muted-foreground size-4 shrink-0"
              />
              <Link to={node.href} className="font-medium">
                {node.name}
              </Link>
            </div>
          </TableCell>
          <TableCell className="text-foreground-secondary h-[52px] px-4 py-0">
            {node.parentName ?? '—'}
          </TableCell>
          <TableCell className="h-[52px] px-4 py-0">
            {memberCounts === 'loading' ? (
              <Skeleton
                role="status"
                aria-label={`Loading ${memberNoun.other}`}
                className="h-5 w-20"
              />
            ) : memberCounts === 'unavailable' ? (
              <span className="text-foreground-secondary">—</span>
            ) : (
              // A count too long for the column wraps rather than spill over.
              <Badge
                variant="secondary"
                className="font-medium whitespace-normal"
              >
                {memberSummary(node, memberNoun)}
              </Badge>
            )}
          </TableCell>
          <TableCell className="text-foreground-secondary h-[52px] px-4 py-0">
            {formatCreated(node.createdAt)}
          </TableCell>
          <TableCell className="h-[52px] px-4 py-0 text-right">
            <RowActionsMenu
              label={`Actions for ${node.name}`}
              actions={actionsFor(node)}
            />
          </TableCell>
        </TableRow>
        {nodeOpen
          ? [
              ...node.children.map((child) => renderGroup(child, depth + 1)),
              ...(node.members ?? []).map((member) =>
                renderMember(member, depth + 1)
              ),
            ]
          : null}
      </Fragment>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label={`Search ${groupsLabel}`}
            placeholder={`Search ${groupsLabel}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        {!searching ? (
          <Button type="button" variant="ghost" onClick={toggleAll}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border">
          <EmptyState
            icon={Search}
            title={`No ${groupsLabel} match ‘${query.trim()}’`}
            description="Check the spelling, or search for a member’s name."
            action={{
              label: 'Clear search',
              variant: 'secondary',
              onClick: () => setQuery(''),
            }}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table
            aria-label={groupsLabel[0].toUpperCase() + groupsLabel.slice(1)}
            className="table-fixed"
            // Narrower windows scroll sideways instead of squeezing Name.
            style={{
              minWidth: NAME_MIN_PX + FIXED_COLUMNS_PX + membersWidth,
            }}
          >
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="h-11 px-4">Name</TableHead>
                <TableHead className="h-11 w-[160px] px-4">Parent</TableHead>
                <TableHead
                  className="h-11 px-4"
                  style={{ width: membersWidth }}
                >
                  Members
                </TableHead>
                <TableHead className="h-11 w-[150px] px-4">Created</TableHead>
                <TableHead className="h-11 w-16 px-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{visible.map((node) => renderGroup(node, 0))}</TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
