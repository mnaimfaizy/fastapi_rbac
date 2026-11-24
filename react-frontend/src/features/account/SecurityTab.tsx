import { useState } from 'react';
import { Smartphone } from 'lucide-react';

import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SignOutEverywhereDialog } from '@/components/layout/UserMenu';
import { Button } from '@/components/ui/button';
import type { User } from '@/models/user';
import { useAppSelector } from '@/store/hooks';
import { SettingsSection } from './SettingsSection';

/**
 * How long a password lasts. It matches the API's default
 * `REQUIRE_PASSWORD_CHANGE_DAYS` and the copy the design fixes ("Passwords
 * expire every 90 days."); the user read model has no expiry date of its
 * own yet.
 */
const PASSWORD_LIFETIME_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * The Security tab: change the password, see how old it is and when it
 * expires, and sign out everywhere behind the shell's confirmation.
 */
export function SecurityTab() {
  const user = useAppSelector((state) => state.auth.user);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <SettingsSection
        title="Change password"
        description="You’ll stay signed in on this device."
      >
        <ChangePasswordForm />
      </SettingsSection>

      <div className="flex min-w-0 flex-col gap-5">
        {user ? <PasswordStatus user={user} /> : null}

        <SettingsSection title="Sign out everywhere" className="gap-4">
          <p className="text-foreground-secondary text-sm leading-relaxed">
            Ends every session on every device, including this one. Use it if
            you’ve lost a device or think someone else has your password. You’ll
            need to sign in again.
          </p>
          <div>
            <Button
              type="button"
              variant="destructive-outline"
              onClick={() => setConfirmOpen(true)}
            >
              <Smartphone aria-hidden="true" />
              Sign out everywhere
            </Button>
          </div>
        </SettingsSection>
      </div>

      <SignOutEverywhereDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      />
    </div>
  );
}

function PasswordStatus({ user }: { user: User }) {
  const changed = user.last_changed_password_date
    ? new Date(user.last_changed_password_date)
    : null;
  const valid = changed && !Number.isNaN(changed.getTime()) ? changed : null;
  const ageDays = valid
    ? Math.max(0, Math.floor((Date.now() - valid.getTime()) / DAY_MS))
    : null;
  const expires = valid
    ? new Date(valid.getTime() + PASSWORD_LIFETIME_DAYS * DAY_MS)
    : null;
  const notRecorded = 'Not recorded';

  return (
    <SettingsSection
      title="Password status"
      description={`Passwords expire every ${PASSWORD_LIFETIME_DAYS} days.`}
      className="gap-4"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <StatusItem label="Password age">
          {ageDays === null
            ? notRecorded
            : `${ageDays} ${ageDays === 1 ? 'day' : 'days'}`}
        </StatusItem>
        <StatusItem label="Expires">
          {expires ? dateFormat.format(expires) : notRecorded}
        </StatusItem>
        <StatusItem label="Email">
          <StatusBadge status={user.verified ? 'verified' : 'pending'} />
        </StatusItem>
        <StatusItem label="Last changed">
          {valid ? dateFormat.format(valid) : notRecorded}
        </StatusItem>
      </dl>
    </SettingsSection>
  );
}

function StatusItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-[13px]">{label}</dt>
      <dd className="text-foreground flex flex-wrap items-center gap-1.5 text-sm">
        {children}
      </dd>
    </div>
  );
}
