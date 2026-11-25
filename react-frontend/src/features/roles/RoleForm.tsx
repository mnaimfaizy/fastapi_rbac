import React, { useEffect, useRef, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Role } from '@/models/role';
import { RoleGroup } from '@/models/roleGroup';
import { Permission } from '@/models/permission';
import permissionService from '@/services/permission.service';
import { normalizeApiError } from '@/lib/apiError';
import { PermissionMatrixEditor } from './PermissionMatrixEditor';
import { permissionDiff } from './permissionMatrix';

const roleSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Role name is required' })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        'Role name can only contain letters, numbers, underscores, and hyphens',
    }),
  description: z.string().optional(),
  role_group_id: z.string().optional(),
});

type RoleFields = z.infer<typeof roleSchema>;

export interface RoleEditorSubmit {
  name: string;
  description?: string;
  role_group_id?: string;
  addedPermissionIds: string[];
  removedPermissionIds: string[];
  selectedPermissionIds: string[];
}

interface RoleFormProps {
  mode: 'create' | 'edit';
  onSubmit: (data: RoleEditorSubmit) => Promise<Role | void> | void;
  onCancel?: () => void;
  initialData?: Role | null;
  isLoading?: boolean;
  roleGroups: RoleGroup[];
}

function permissionIds(role: Role | null | undefined): string[] {
  return role?.permissions?.map((permission) => permission.id) ?? [];
}

function baselineFrom(role: Role | null | undefined) {
  return {
    name: role?.name || '',
    description: role?.description || '',
    roleGroupId: role?.role_group_id || '',
    permissionIds: permissionIds(role),
  };
}

function mergeCatalog(
  fetched: Permission[],
  rolePermissions: Permission[] | undefined
): Permission[] {
  const byId = new Map<string, Permission>();
  for (const permission of fetched) byId.set(permission.id, permission);
  for (const permission of rolePermissions ?? []) {
    if (!byId.has(permission.id)) byId.set(permission.id, permission);
  }
  return [...byId.values()];
}

function withIds(
  current: readonly string[],
  ids: readonly string[],
  on: boolean
) {
  if (on) {
    const have = new Set(current);
    const next = [...current];
    for (const id of ids) {
      if (!have.has(id)) next.push(id);
    }
    return next;
  }
  const drop = new Set(ids);
  return current.filter((id) => !drop.has(id));
}

const RoleForm: React.FC<RoleFormProps> = ({
  mode,
  onSubmit,
  onCancel,
  initialData,
  isLoading,
  roleGroups,
}) => {
  const [baseline, setBaseline] = useState(() => baselineFrom(initialData));
  const [selectedIds, setSelectedIds] = useState<string[]>(
    baseline.permissionIds
  );
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [catalogIncomplete, setCatalogIncomplete] = useState(false);

  const form = useForm<RoleFields>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: baseline.name,
      description: baseline.description,
      role_group_id: baseline.roleGroupId || undefined,
    },
  });

  const rolePermissionsRef = useRef(initialData?.permissions);
  rolePermissionsRef.current = initialData?.permissions;

  // The catalog is fetched once per role. A save replaces the role object, and
  // depending on that object refetches and flashes "Loading permissions...".
  useEffect(() => {
    let cancelled = false;
    const loadPermissions = async () => {
      setPermissionsLoading(true);
      try {
        const response = await permissionService.getPermissions(1, 100);
        if (cancelled) return;
        const items = response.data.items || [];
        const total = response.data.total ?? items.length;
        setCatalog(mergeCatalog(items, rolePermissionsRef.current));
        setCatalogIncomplete(total > items.length);
        setPermissionsError(null);
      } catch (error: unknown) {
        if (cancelled) return;
        setCatalog(mergeCatalog([], rolePermissionsRef.current));
        setCatalogIncomplete(false);
        setPermissionsError(
          normalizeApiError(error, 'Failed to load permissions').message
        );
      } finally {
        if (!cancelled) setPermissionsLoading(false);
      }
    };
    void loadPermissions();
    return () => {
      cancelled = true;
    };
  }, [initialData?.id]);

  const missingPermissionIds = (initialData?.permissions ?? [])
    .map((permission) => permission.id)
    .filter((id) => !catalog.some((item) => item.id === id))
    .join('\n');

  useEffect(() => {
    if (!missingPermissionIds) return;
    setCatalog((current) => mergeCatalog(current, rolePermissionsRef.current));
  }, [missingPermissionIds]);

  const watchedName = form.watch('name');
  const watchedDescription = form.watch('description') ?? '';
  const watchedGroup = form.watch('role_group_id') ?? '';
  const metadataDirty =
    watchedName !== baseline.name ||
    watchedDescription !== baseline.description ||
    watchedGroup !== baseline.roleGroupId;
  const { added, removed } = permissionDiff(
    baseline.permissionIds,
    selectedIds
  );
  const changeCount = added.length + removed.length;
  const dirty = metadataDirty || changeCount > 0;
  const selectedCount = selectedIds.length;

  const applyBaseline = (next: ReturnType<typeof baselineFrom>) => {
    setBaseline(next);
    setSelectedIds(next.permissionIds);
    form.reset({
      name: next.name,
      description: next.description,
      role_group_id: next.roleGroupId || undefined,
    });
  };

  const handleDiscard = () => {
    applyBaseline(baseline);
  };

  const handleFormSubmit: SubmitHandler<RoleFields> = async (data) => {
    const diff = permissionDiff(baseline.permissionIds, selectedIds);
    const description = data.description?.trim();
    const saved = await onSubmit({
      name: data.name,
      description: description ? description : undefined,
      role_group_id: data.role_group_id || undefined,
      addedPermissionIds: diff.added,
      removedPermissionIds: diff.removed,
      selectedPermissionIds: selectedIds,
    });
    if (saved) {
      applyBaseline(baselineFrom(saved));
    }
  };

  const changeLabel = `${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-8"
      >
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role_group_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role group</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {field.value &&
                      !roleGroups.some((group) => group.id === field.value) ? (
                        <SelectItem value={field.value}>
                          {field.value}
                        </SelectItem>
                      ) : null}
                      {roleGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Description{' '}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <PermissionMatrixEditor
          catalog={catalog}
          selectedIds={selectedIds}
          savedIds={baseline.permissionIds}
          trackChanges={mode === 'edit'}
          loading={permissionsLoading}
          loadError={permissionsError}
          incomplete={catalogIncomplete}
          onToggle={(id) =>
            setSelectedIds((current) =>
              current.includes(id)
                ? current.filter((entry) => entry !== id)
                : [...current, id]
            )
          }
          onSetMany={(ids, on) =>
            setSelectedIds((current) => withIds(current, ids, on))
          }
        />

        <div className="bg-card sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 border-t py-3">
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            {mode === 'edit' && changeCount > 0 ? (
              <span className="bg-primary/15 text-primary inline-flex items-center gap-2 rounded-md px-2.5 py-1 font-medium">
                <span
                  aria-hidden
                  className="bg-primary size-1.5 rounded-full"
                />
                <span role="status">{changeLabel}</span>
              </span>
            ) : null}
            <span>
              {selectedCount} of {catalog.length} permissions selected
            </span>
          </div>
          <div className="flex gap-2">
            {mode === 'edit' ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscard}
                disabled={!dirty || isLoading}
              >
                Discard
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || (mode === 'edit' && !dirty)}
            >
              {isLoading
                ? 'Saving...'
                : mode === 'edit'
                  ? 'Save changes'
                  : 'Create role'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default RoleForm;
