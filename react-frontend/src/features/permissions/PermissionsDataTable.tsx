import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { RowActionsMenu } from '@/components/common/RowActionsMenu';
import { TableSkeleton } from '@/components/common/Skeletons';
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/models/permission';
import permissionService from '@/services/permission.service';

const PAGE_CHUNK = 100;

async function loadPermissions(): Promise<Permission[]> {
  const collected: Permission[] = [];
  let page = 1;
  let total = 0;
  do {
    const response = await permissionService.getPermissions(page, PAGE_CHUNK);
    const batch = response.data?.items ?? [];
    total = response.data?.total ?? batch.length;
    collected.push(...batch);
    if (batch.length === 0) {
      break;
    }
    page += 1;
  } while (collected.length < total && page <= 50);
  return collected;
}

export default function PermissionsDataTable() {
  const { hasPermission } = usePermissions();
  const canDelete = hasPermission('permission.delete');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<Permission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPermissions(await loadPermissions());
    } catch (err) {
      setPermissions([]);
      setError(
        err instanceof Error ? err.message : 'Could not load permissions.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groupNames = useMemo(() => {
    const names = new Set<string>();
    for (const permission of permissions) {
      if (permission.group?.name) {
        names.add(permission.group.name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [permissions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (group && permission.group?.name !== group) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        permission.name.toLowerCase().includes(query) ||
        (permission.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [permissions, group, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const rows = filtered.slice(startIndex, startIndex + pageSize);
  const startItem = filtered.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, filtered.length);

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    try {
      await permissionService.deletePermission(deleteTarget.id);
      toast.success('Permission deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete permission'
      );
      throw err;
    }
  }

  if (loading) {
    return <TableSkeleton label="Loading permissions" columns={4} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Search permissions"
          placeholder="Search codes or descriptions"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <div className="text-foreground-secondary flex items-center gap-2 text-sm">
          <span>Group</span>
          <select
            aria-label="Filter by group"
            value={group}
            onChange={(event) => {
              setGroup(event.target.value);
              setPage(1);
            }}
            className="border-input bg-card text-foreground h-9 rounded-md border px-3 text-sm"
          >
            <option value="">All</option>
            {groupNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={
            search.trim()
              ? `No permissions match '${search.trim()}'`
              : group
                ? 'No permissions match this group'
                : 'No permissions yet'
          }
          action={
            search.trim()
              ? {
                  label: 'Clear search',
                  variant: 'secondary',
                  onClick: () => {
                    setSearch('');
                    setPage(1);
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Group</TableHead>
                {canDelete ? (
                  <TableHead className="w-12">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell>
                    <Link
                      to={`/dashboard/permissions/${permission.id}`}
                      className="text-foreground font-mono"
                    >
                      {permission.name}
                    </Link>
                  </TableCell>
                  <TableCell>{permission.description}</TableCell>
                  <TableCell>{permission.group?.name ?? 'No group'}</TableCell>
                  {canDelete ? (
                    <TableCell>
                      <RowActionsMenu
                        label={`Actions for ${permission.name}`}
                        actions={[
                          {
                            label: 'Delete',
                            destructive: true,
                            icon: <Trash2 aria-hidden="true" />,
                            onSelect: () => setDeleteTarget(permission),
                          },
                        ]}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-foreground-secondary text-sm">
          Showing {startItem}–{endItem} of {filtered.length} permissions
        </p>
        <div className="flex items-center gap-2">
          <div className="text-foreground-secondary flex items-center gap-2 text-sm">
            <span>Rows per page</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="border-input bg-card text-foreground h-9 rounded-md border px-2 text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Previous page"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Next page"
            disabled={safePage >= pageCount || filtered.length === 0}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={
          deleteTarget
            ? `Delete permission ‘${deleteTarget.name}’?`
            : 'Delete permission?'
        }
        description="Roles that grant it will lose this action. This cannot be undone."
        confirmLabel="Delete permission"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
