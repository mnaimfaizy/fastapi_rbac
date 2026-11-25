import { Permission } from '@/models/permission';

export const CRUD_VERBS = ['create', 'read', 'update', 'delete'] as const;
export type Verb = (typeof CRUD_VERBS)[number];

const GROUP_ORDER = [
  'User',
  'Role',
  'Permission',
  'Role Group',
  'Permission Group',
  'Self',
  'Content',
];

export interface MatrixRow {
  group: string;
  cells: Record<Verb, Permission | null>;
  other: Permission[];
}

function actionOf(name: string): string {
  const dot = name.indexOf('.');
  return dot === -1 ? name : name.slice(dot + 1);
}

function verbOf(action: string): Verb | null {
  if ((CRUD_VERBS as readonly string[]).includes(action)) {
    return action as Verb;
  }
  const head = action.split('_')[0];
  if (
    (CRUD_VERBS as readonly string[]).includes(head) &&
    action.startsWith(`${head}_`)
  ) {
    return head as Verb;
  }
  return null;
}

function groupRank(name: string): number {
  if (name === 'No group') return GROUP_ORDER.length + 1;
  const index = GROUP_ORDER.indexOf(name);
  return index === -1 ? GROUP_ORDER.length : index;
}

/** Groups permissions for the editor and the read-only role detail matrix. */
export function buildPermissionMatrix(catalog: Permission[]): MatrixRow[] {
  const byGroup = new Map<string, Permission[]>();
  for (const permission of catalog) {
    const group = permission.group?.name || 'No group';
    const list = byGroup.get(group) ?? [];
    list.push(permission);
    byGroup.set(group, list);
  }

  const rows: MatrixRow[] = [];
  for (const [group, permissions] of byGroup) {
    const verbs = permissions.map((permission) =>
      verbOf(actionOf(permission.name))
    );
    const counts = new Map<string, number>();
    for (const verb of verbs) {
      if (verb) counts.set(verb, (counts.get(verb) ?? 0) + 1);
    }
    const clean = verbs.every(
      (verb) => verb !== null && counts.get(verb) === 1
    );
    const cells: Record<Verb, Permission | null> = {
      create: null,
      read: null,
      update: null,
      delete: null,
    };
    const other: Permission[] = [];
    for (const permission of permissions) {
      const action = actionOf(permission.name);
      const verb = verbOf(action);
      if (clean && verb) {
        cells[verb] = permission;
      } else if ((CRUD_VERBS as readonly string[]).includes(action)) {
        cells[action as Verb] = permission;
      } else {
        other.push(permission);
      }
    }
    rows.push({ group, cells, other });
  }

  rows.sort((a, b) => {
    const rank = groupRank(a.group) - groupRank(b.group);
    if (rank !== 0) return rank;
    return a.group.localeCompare(b.group);
  });
  return rows;
}

export function permissionDiff(
  saved: readonly string[],
  selected: readonly string[]
): { added: string[]; removed: string[] } {
  const savedSet = new Set(saved);
  const selectedSet = new Set(selected);
  return {
    added: selected.filter((id) => !savedSet.has(id)),
    removed: saved.filter((id) => !selectedSet.has(id)),
  };
}

export function idsInRow(row: MatrixRow): string[] {
  const ids: string[] = [];
  for (const verb of CRUD_VERBS) {
    const permission = row.cells[verb];
    if (permission) ids.push(permission.id);
  }
  for (const permission of row.other) ids.push(permission.id);
  return ids;
}

export function idsInColumn(
  rows: readonly MatrixRow[],
  column: Verb | 'other'
): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (column === 'other') {
      for (const permission of row.other) ids.push(permission.id);
    } else {
      const permission = row.cells[column];
      if (permission) ids.push(permission.id);
    }
  }
  return ids;
}
