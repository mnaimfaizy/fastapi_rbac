import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import userService from '../../services/user.service';
import type { User } from '@/models/user';
import { usePageCrumb } from '@/components/layout/pageCrumb';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { DetailSkeleton } from '@/components/common/Skeletons';
import { fullName } from './users-list-model';
import UserEditForm from './UserEditForm';

type Load =
  | { state: 'loading' }
  | { state: 'failed'; message: string }
  | { state: 'ready'; user: User };

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-foreground-secondary hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px] font-medium"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Add user (`/dashboard/users/new`) and Edit user (`…/:userId/edit`). */
const UserEditPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    if (!userId) return;
    let current = true;
    setLoad({ state: 'loading' });
    userService
      .getUserById(userId)
      .then((user) => {
        if (current) setLoad({ state: 'ready', user });
      })
      .catch((error: unknown) => {
        if (current) {
          setLoad({
            state: 'failed',
            message:
              error instanceof Error && error.message
                ? error.message
                : 'Try again in a moment.',
          });
        }
      });
    return () => {
      current = false;
    };
  }, [userId]);

  const editedName =
    userId && load.state === 'ready' ? fullName(load.user) : null;
  usePageCrumb(userId ? editedName : 'Add user');

  if (!userId) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <BackLink to="/dashboard/users" label="Users" />
          <PageHeader
            title="Add user"
            description="They sign in with this email and the temporary password you set."
          />
        </div>
        <UserEditForm />
      </div>
    );
  }

  if (load.state === 'loading') {
    return <DetailSkeleton label="Loading user" sections={3} />;
  }

  if (load.state === 'failed') {
    return (
      <div className="rounded-xl border">
        <EmptyState
          icon={CircleAlert}
          title="This user didn’t load"
          description={load.message}
          action={{ label: 'Back to users', href: '/dashboard/users' }}
        />
      </div>
    );
  }

  const { user } = load;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink to={`/dashboard/users/${user.id}`} label={fullName(user)} />
        <PageHeader title="Edit user" description={user.email} />
      </div>
      <UserEditForm key={user.id} user={user} />
    </div>
  );
};

export default UserEditPage;
