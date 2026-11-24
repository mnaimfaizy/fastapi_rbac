/**
 * Shared model for the role group and permission group trees.
 *
 * Each page maps what its service returns into flat `FlatGroup` records
 * joined by parent id; `buildGroupTree` turns them into the nested tree the
 * `GroupTree` component renders.
 */

/** A role or permission listed under its group. */
export interface GroupMember {
  id: string;
  name: string;
  /** Muted text after the name, such as "3 users" or a description. */
  detail?: string;
  href?: string;
}

export interface FlatGroup {
  id: string;
  name: string;
  parentId: string | null;
  createdAt?: string;
  /** The group's detail page. */
  href: string;
  /**
   * The group's members. Leave it out when the viewer cannot read them, so
   * the tree shows only child groups rather than a wrong "0".
   */
  members?: GroupMember[];
}

export interface GroupNode extends FlatGroup {
  parentName: string | null;
  children: GroupNode[];
  /**
   * The group's own counts, kept when a search trims `members` and
   * `children`, so the count chip always shows the whole group.
   */
  memberCount: number | null;
  childCount: number;
}

export interface MemberNoun {
  one: string;
  other: string;
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name);
}

/**
 * Join a flat list of groups by parent id. A group whose parent is not in
 * the list, or that sits on a parent cycle, becomes a root. Siblings are
 * sorted by name.
 */
export function buildGroupTree(flat: FlatGroup[]): GroupNode[] {
  const nodes = new Map<string, GroupNode>();
  for (const group of flat) {
    if (!nodes.has(group.id)) {
      nodes.set(group.id, {
        ...group,
        parentName: null,
        children: [],
        memberCount: group.members ? group.members.length : null,
        childCount: 0,
      });
    }
  }

  // Walk each group's ancestor chain; a chain that comes back to the group
  // is a cycle, and that group is cut loose as a root.
  const onCycle = (id: string) => {
    const seen = new Set<string>([id]);
    let parentId = nodes.get(id)?.parentId ?? null;
    while (parentId && nodes.has(parentId)) {
      if (seen.has(parentId)) {
        return parentId === id;
      }
      seen.add(parentId);
      parentId = nodes.get(parentId)?.parentId ?? null;
    }
    return false;
  };

  const roots: GroupNode[] = [];
  const cut = new Set<string>();
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id && !cut.has(node.id)) {
      if (onCycle(node.id)) {
        cut.add(node.id);
        roots.push(node);
        continue;
      }
      node.parentName = parent.name;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortDeep = (list: GroupNode[]) => {
    list.sort(byName);
    for (const node of list) {
      node.childCount = node.children.length;
      sortDeep(node.children);
    }
    return list;
  };
  return sortDeep(roots);
}

/**
 * The groups matching `query` by group or member name, with the ancestors
 * that lead to them. A matching group keeps its whole subtree.
 */
export function filterGroupTree(
  nodes: GroupNode[],
  query: string
): GroupNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return nodes;
  }
  const matches = (name: string) => name.toLowerCase().includes(needle);

  const result: GroupNode[] = [];
  for (const node of nodes) {
    if (matches(node.name)) {
      result.push(node);
      continue;
    }
    const children = filterGroupTree(node.children, query);
    const members = node.members?.filter((member) => matches(member.name));
    if (children.length > 0 || (members && members.length > 0)) {
      result.push({ ...node, children, members });
    }
  }
  return result;
}

/** Every group in the tree, depth first. */
export function flattenTree(nodes: GroupNode[]): GroupNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** The id of the group and of every group below it. */
export function subtreeIds(flat: FlatGroup[], id: string): Set<string> {
  const ids = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const group of flat) {
      if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
        ids.add(group.id);
        grew = true;
      }
    }
  }
  return ids;
}

function count(n: number, noun: MemberNoun) {
  return `${n} ${n === 1 ? noun.one : noun.other}`;
}

/** The count chip's text, such as "1 role · 1 group". */
export function memberSummary(node: GroupNode, noun: MemberNoun): string {
  const parts: string[] = [];
  if (node.memberCount !== null) {
    parts.push(count(node.memberCount, noun));
  }
  if (node.childCount > 0 || node.memberCount === null) {
    parts.push(count(node.childCount, { one: 'group', other: 'groups' }));
  }
  return parts.join(' · ');
}

/** "12 Jan 2026", as the artboards show creation dates. */
export function formatCreated(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
