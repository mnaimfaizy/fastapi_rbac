import { Fragment, useMemo, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderTree, Search } from 'lucide-react';
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
import {
  filterGroupTree,
  flattenTree,
  formatCreated,
  memberSummary,
  type GroupMember,
  type GroupNode,
  type MemberNoun,
} from './treeModel';

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export interface GroupTreeProps {
  /** The tree from `buildGroupTree`. */
  groups: GroupNode[];
  /** Plural name of the groups, such as "role groups". */
  groupsLabel: string;
  memberNoun: MemberNoun;
  memberIcon: Icon;
  /** Show member names in a monospace face, as for permission codes. */
  monoMembers?: boolean;
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

const INDENT_REM = 1.5;

/**
 * Role groups or permission groups as an expandable tree: each group with
 * its child groups, then its members, a count chip and the "…" menu.
 */
export function GroupTree({
  groups,
  groupsLabel,
  memberNoun,
  memberIcon: MemberIcon,
  monoMembers = false,
  actionsFor,
  emptyState,
  memberCounts = 'ready',
}: GroupTreeProps) {
  const [query, setQuery] = useState('');
  // Until the viewer toggles something, the top-level groups start open.
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  const searching = query.trim().length > 0;
  const visible = useMemo(
    () => filterGroupTree(groups, query),
    [groups, query]
  );
  const expandable = useMemo(
    () => flattenTree(groups).filter(hasRows),
    [groups]
  );

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border">
        <EmptyState icon={FolderTree} {...emptyState} />
      </div>
    );
  }

  const open =
    expanded ?? new Set(groups.filter(hasRows).map((group) => group.id));
  // A search opens every group on the way to a match.
  const isOpen = (id: string) => searching || open.has(id);
  const allOpen = expandable.every((group) => open.has(group.id));

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
      allOpen ? new Set() : new Set(expandable.map((group) => group.id))
    );
  };

  const indent = (depth: number) => ({
    paddingLeft: `${depth * INDENT_REM}rem`,
  });

  const renderMember = (member: GroupMember, depth: number) => (
    <TableRow key={`member-${member.id}`} className="bg-muted/40">
      <TableCell colSpan={5}>
        <div className="flex items-center gap-2" style={indent(depth)}>
          <span className="w-7 shrink-0" />
          <MemberIcon
            aria-hidden={true}
            className="text-muted-foreground size-4 shrink-0"
          />
          {member.href ? (
            <Link
              to={member.href}
              className={monoMembers ? 'font-mono text-sm' : 'text-sm'}
            >
              {member.name}
            </Link>
          ) : (
            <span className={monoMembers ? 'font-mono text-sm' : 'text-sm'}>
              {member.name}
            </span>
          )}
          {member.detail ? (
            <span className="text-foreground-secondary text-xs">
              {member.detail}
            </span>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );

  const renderGroup = (node: GroupNode, depth: number) => {
    const canExpand = hasRows(node);
    const nodeOpen = canExpand && isOpen(node.id);
    return (
      <Fragment key={node.id}>
        <TableRow>
          <TableCell>
            <div className="flex items-center gap-2" style={indent(depth)}>
              {canExpand ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
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
              ) : (
                <span className="w-7 shrink-0" />
              )}
              <FolderTree
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />
              <Link to={node.href} className="font-medium">
                {node.name}
              </Link>
            </div>
          </TableCell>
          <TableCell className="text-foreground-secondary">
            {node.parentName ?? '—'}
          </TableCell>
          <TableCell>
            {memberCounts === 'loading' ? (
              <Skeleton
                role="status"
                aria-label={`Loading ${memberNoun.other}`}
                className="h-5 w-20"
              />
            ) : memberCounts === 'unavailable' ? (
              <span className="text-foreground-secondary">—</span>
            ) : (
              <Badge variant="secondary" className="font-medium">
                {memberSummary(node, memberNoun)}
              </Badge>
            )}
          </TableCell>
          <TableCell className="text-foreground-secondary">
            {formatCreated(node.createdAt)}
          </TableCell>
          <TableCell className="text-right">
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
        {expandable.length > 0 && !searching ? (
          <Button type="button" variant="ghost" onClick={toggleAll}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border">
          <EmptyState
            icon={Search}
            title={`No ${groupsLabel} match “${query.trim()}”`}
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
          >
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead>Name</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12">
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
