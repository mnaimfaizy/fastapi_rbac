import { Link, Navigate, useParams } from 'react-router-dom';

import { PageHeader } from '@/components/common/PageHeader';
import { usePageCrumb } from '@/components/layout/pageCrumb';
import { ACCOUNT_SETTINGS_PATH } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { AppearanceTab } from './AppearanceTab';
import { ProfileTab } from './ProfileTab';
import { SecurityTab } from './SecurityTab';

const TABS = [
  { id: 'profile', label: 'Profile', Panel: ProfileTab },
  { id: 'security', label: 'Security', Panel: SecurityTab },
  { id: 'appearance', label: 'Appearance', Panel: AppearanceTab },
] as const;

type AccountTab = (typeof TABS)[number]['id'];

/** The URL of one Account settings tab. */
function accountTabPath(tab: AccountTab) {
  return `${ACCOUNT_SETTINGS_PATH}/${tab}`;
}

/**
 * `/dashboard/account/:tab`: Profile, Security and Appearance on one page.
 * Each tab has its own URL, so the old Profile and Change password routes
 * can redirect straight to theirs; the bare page and any unknown tab open
 * Profile.
 */
const AccountSettingsPage = () => {
  const { tab } = useParams();
  const active = TABS.find((candidate) => candidate.id === tab);
  // The header breadcrumb ends with the tab: You › Account settings › Profile.
  usePageCrumb(active?.label);

  if (!active) {
    return <Navigate to={accountTabPath('profile')} replace />;
  }

  const { Panel } = active;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <PageHeader
        title="Account settings"
        description="Your profile, password and appearance."
      />
      <nav
        aria-label="Account settings sections"
        className="flex gap-1 border-b"
      >
        {TABS.map(({ id, label }) => {
          const selected = id === active.id;
          return (
            <Link
              key={id}
              to={accountTabPath(id)}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                '-mb-px inline-flex h-10 shrink-0 items-center border-b-2 px-3.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary text-foreground'
                  : 'text-foreground-secondary hover:text-foreground border-transparent'
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <Panel />
    </div>
  );
};

export default AccountSettingsPage;
