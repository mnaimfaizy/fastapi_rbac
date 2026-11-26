import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/common/Meta';
import { usePageCrumb } from '@/components/layout/pageCrumb';
import { usePermissions } from '@/hooks/usePermissions';
import { allNavItems, buildNavGroups, HOME_PATH } from '@/lib/navigation';
import { SystemStateCard } from './SystemStateCard';
import { primaryAction } from './systemStateActions';

/** How each permission verb reads in "You can't <verb> roles". */
const VERB_PHRASES: Record<string, string> = {
  create: 'create',
  read: 'view',
  update: 'edit',
  delete: 'delete',
};

/** The breadcrumb's last step for a refused form, after its list. */
const VERB_CRUMBS: Record<string, string> = {
  create: 'New',
  update: 'Edit',
};

function PermissionCode({ children }: { children: ReactNode }) {
  return (
    <code className="text-foreground font-mono text-[13px]">{children}</code>
  );
}

interface UnauthorizedPageProps {
  /**
   * The permission the viewer lacks, such as `role.update`. Without one
   * the page says only that the viewer can't open it.
   */
  permission?: string;
  /**
   * More than one permission would have been enough, so the page says
   * "one of" and lists them. `permission` is the first of them.
   */
  anyOf?: string[];
}

/**
 * What a signed-in viewer sees, inside the shell, on a page their roles
 * don't allow: the permission they lack and a way back. `ProtectedRoute`
 * renders it in place of the refused page.
 */
const UnauthorizedPage = ({ permission, anyOf }: UnauthorizedPageProps) => {
  const { hasPermission } = usePermissions();
  const [resource, verb] = permission?.split('.') ?? [];
  // The sidebar item for the resource's list, such as Roles for role.*.
  const list = allNavItems().find(
    (item) => item.permission === `${resource}.read`
  );
  const phrase = verb ? VERB_PHRASES[verb] : undefined;
  const action =
    phrase && list ? `${phrase} ${list.label.toLowerCase()}` : undefined;

  usePageCrumb(list && verb ? VERB_CRUMBS[verb] : null);

  const home = buildNavGroups(hasPermission)[0].items[0];
  const backToList =
    list && verb !== 'read' && hasPermission(list.permission as string);

  return (
    <>
      <Meta title="Unauthorized" />
      <SystemStateCard
        icon={ShieldAlert}
        title={action ? `You can’t ${action}` : 'You can’t open this page'}
        actions={
          backToList ? (
            <Button asChild className={primaryAction}>
              <Link to={list.to}>
                <ArrowLeft aria-hidden="true" />
                Back to {list.label.toLowerCase()}
              </Link>
            </Button>
          ) : (
            <Button asChild className={primaryAction}>
              <Link to={HOME_PATH}>Go to {home.label.toLowerCase()}</Link>
            </Button>
          )
        }
      >
        {permission ? (
          <>
            You need{' '}
            {anyOf && anyOf.length > 1 ? (
              <>
                one of{' '}
                {anyOf.map((code, index) => (
                  <Fragment key={code}>
                    {index > 0 && (index === anyOf.length - 1 ? ' or ' : ', ')}
                    <PermissionCode>{code}</PermissionCode>
                  </Fragment>
                ))}
              </>
            ) : (
              <PermissionCode>{permission}</PermissionCode>
            )}{' '}
            to {action ?? 'open this page'}. Ask an admin to add{' '}
            {anyOf && anyOf.length > 1 ? 'one' : 'it'} to one of your roles.
          </>
        ) : (
          <>
            Your roles don’t include access to this page. Ask an admin if you
            need it.
          </>
        )}
      </SystemStateCard>
    </>
  );
};

export default UnauthorizedPage;
