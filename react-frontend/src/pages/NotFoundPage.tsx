import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/common/Meta';
import { usePermissions } from '@/hooks/usePermissions';
import { buildNavGroups, HOME_PATH } from '@/lib/navigation';
import { useAppSelector } from '@/store/hooks';
import { SystemStateCard } from './SystemStateCard';
import { primaryAction, secondaryAction } from './systemStateActions';

/**
 * What an unknown URL shows. `SystemStateLayout` puts it in the shell for
 * a signed-in user and in the auth layout for a signed-out visitor; this
 * page picks the matching copy.
 */
const NotFoundPage = () => {
  // The same test SystemStateLayout uses to pick the shell.
  const signedIn = useAppSelector(
    (state) => state.auth.isAuthenticated && state.auth.user !== null
  );

  return (
    <>
      <Meta
        title="Page not found"
        description="The page you're looking for doesn't exist."
      />
      {signedIn ? <InAppNotFound /> : <SignedOutNotFound />}
    </>
  );
};

/** Inside the shell: names the missing path and offers a way home or back. */
function InAppNotFound() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  // The home link reads like the viewer's own sidebar: Dashboard, or Home
  // for a plain user.
  const home = buildNavGroups(hasPermission)[0].items[0];
  // React Router numbers its own history entries; at 0 this page was opened
  // directly, and going back would leave the app, so Go back goes home.
  const canGoBack = (window.history.state?.idx ?? 0) > 0;

  return (
    <SystemStateCard
      icon={SearchX}
      title="Page not found"
      actions={
        <>
          <Button asChild className={primaryAction}>
            <Link to={HOME_PATH}>Go to {home.label.toLowerCase()}</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className={secondaryAction}
            onClick={() => (canGoBack ? navigate(-1) : navigate(HOME_PATH))}
          >
            Go back
          </Button>
        </>
      }
    >
      We couldn’t find {pathname}. It may have moved, or the link is out of
      date.
    </SystemStateCard>
  );
}

/** In the auth layout: the visitor's way in is Sign in. */
function SignedOutNotFound() {
  return (
    <div className="flex flex-col items-start gap-5">
      <span className="bg-muted text-foreground-secondary flex size-12 items-center justify-center rounded-[12px]">
        <SearchX aria-hidden="true" className="size-6" />
      </span>
      <div>
        <h1 className="text-foreground text-[26px] leading-tight font-semibold tracking-[-0.015em]">
          Page not found
        </h1>
        <p className="text-foreground-secondary mt-1.5 text-sm leading-[1.55]">
          This link doesn’t go anywhere. Check the address, or sign in to find
          what you need.
        </p>
      </div>
      <Button asChild size="lg" className="w-full shadow-none">
        <Link to="/login">Go to sign in</Link>
      </Button>
    </div>
  );
}

export default NotFoundPage;
