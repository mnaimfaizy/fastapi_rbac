import { Permission } from '@/models/permission';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  CRUD_VERBS,
  MatrixRow,
  Verb,
  buildPermissionMatrix,
  idsInColumn,
  idsInRow,
} from './permissionMatrix';

interface PermissionMatrixEditorProps {
  catalog: Permission[];
  selectedIds: readonly string[];
  savedIds: readonly string[];
  trackChanges: boolean;
  loading?: boolean;
  loadError?: string | null;
  incomplete?: boolean;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], selected: boolean) => void;
}

function selectionState(
  ids: readonly string[],
  selected: Set<string>
): boolean | 'indeterminate' {
  if (ids.length === 0) return false;
  const count = ids.filter((id) => selected.has(id)).length;
  if (count === 0) return false;
  if (count === ids.length) return true;
  return 'indeterminate';
}

const COLUMNS: { id: Verb | 'other'; label: string }[] = [
  { id: 'create', label: 'Create' },
  { id: 'read', label: 'Read' },
  { id: 'update', label: 'Update' },
  { id: 'delete', label: 'Delete' },
  { id: 'other', label: 'Other' },
];

function ChangedDot() {
  return (
    <span
      aria-hidden
      className="bg-primary absolute -top-1 -right-1.5 size-1.5 rounded-full"
    />
  );
}

function MatrixCheckbox({
  permission,
  selected,
  changed,
  onToggle,
}: {
  permission: Permission;
  selected: boolean;
  changed: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative inline-flex">
          <Checkbox
            aria-label={permission.name}
            checked={selected}
            onCheckedChange={() => onToggle(permission.id)}
            className={cn(
              changed &&
                'ring-primary ring-offset-background ring-2 ring-offset-2'
            )}
          />
          {changed ? <ChangedDot /> : null}
        </span>
      </TooltipTrigger>
      <TooltipContent className="font-mono">{permission.name}</TooltipContent>
    </Tooltip>
  );
}

function OtherChip({
  permission,
  selected,
  changed,
  onToggle,
}: {
  permission: Permission;
  selected: boolean;
  changed: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={permission.name}
      onClick={() => onToggle(permission.id)}
      className={cn(
        'relative inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs',
        selected
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground border',
        changed && 'ring-primary ring-2'
      )}
    >
      {permission.name}
      {changed ? <ChangedDot /> : null}
    </button>
  );
}

function SelectAll({
  label,
  ids,
  selected,
  onSetMany,
}: {
  label: string;
  ids: string[];
  selected: Set<string>;
  onSetMany: (ids: string[], selected: boolean) => void;
}) {
  const state = selectionState(ids, selected);
  return (
    <Checkbox
      aria-label={label}
      checked={state}
      disabled={ids.length === 0}
      onCheckedChange={() => onSetMany(ids, state !== true)}
    />
  );
}

export function PermissionMatrixEditor({
  catalog,
  selectedIds,
  savedIds,
  trackChanges,
  loading = false,
  loadError = null,
  incomplete = false,
  onToggle,
  onSetMany,
}: PermissionMatrixEditorProps) {
  const rows = buildPermissionMatrix(catalog);
  const selected = new Set(selectedIds);
  const saved = new Set(savedIds);

  const isChanged = (id: string) =>
    trackChanges && selected.has(id) !== saved.has(id);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Permissions</h2>
          <p className="text-muted-foreground text-sm">
            Rows are permission groups, columns are actions. Actions outside
            create, read, update and delete sit under Other.
          </p>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-[13px]">
          <span>Hover a box to see its code.</span>
          {trackChanges ? (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="bg-primary size-1.5 rounded-full" />
              Changed, not saved
            </span>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <p role="alert" className="text-destructive text-sm">
          {loadError}
        </p>
      ) : null}
      {incomplete ? (
        <p className="text-muted-foreground text-sm">
          Partial list: the full catalog is not available.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission group</TableHead>
              {COLUMNS.map((column) => (
                <TableHead
                  key={column.id}
                  className={column.id === 'other' ? undefined : 'text-center'}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-2',
                      column.id === 'other' ? undefined : 'justify-center'
                    )}
                  >
                    <SelectAll
                      label={`Select all ${column.label}`}
                      ids={idsInColumn(rows, column.id)}
                      selected={selected}
                      onSetMany={onSetMany}
                    />
                    {column.label}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center"
                >
                  Loading permissions...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center"
                >
                  No permissions to assign
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <MatrixDataRow
                  key={row.group}
                  row={row}
                  selected={selected}
                  isChanged={isChanged}
                  onToggle={onToggle}
                  onSetMany={onSetMany}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function MatrixDataRow({
  row,
  selected,
  isChanged,
  onToggle,
  onSetMany,
}: {
  row: MatrixRow;
  selected: Set<string>;
  isChanged: (id: string) => boolean;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], selected: boolean) => void;
}) {
  const rowIds = idsInRow(row);
  const granted = rowIds.filter((id) => selected.has(id)).length;

  return (
    <TableRow>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <SelectAll
            label={`Select all ${row.group} permissions`}
            ids={rowIds}
            selected={selected}
            onSetMany={onSetMany}
          />
          <span className="font-medium">{row.group}</span>
          <span className="text-muted-foreground text-xs">
            {granted}/{rowIds.length}
          </span>
        </span>
      </TableCell>
      {CRUD_VERBS.map((verb) => {
        const permission = row.cells[verb];
        if (!permission) {
          return (
            <TableCell key={verb} className="text-muted-foreground text-center">
              <span aria-label="Not available">—</span>
            </TableCell>
          );
        }
        return (
          <TableCell key={verb} className="text-center">
            <MatrixCheckbox
              permission={permission}
              selected={selected.has(permission.id)}
              changed={isChanged(permission.id)}
              onToggle={onToggle}
            />
          </TableCell>
        );
      })}
      <TableCell>
        {row.other.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {row.other.map((permission) => (
              <OtherChip
                key={permission.id}
                permission={permission}
                selected={selected.has(permission.id)}
                changed={isChanged(permission.id)}
                onToggle={onToggle}
              />
            ))}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}
