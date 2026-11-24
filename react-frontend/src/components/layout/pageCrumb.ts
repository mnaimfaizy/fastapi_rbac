import { createContext, useContext, useEffect } from 'react';

/**
 * Lets a page name itself as the last step of the header breadcrumb, after
 * its nav item: `Access › Roles › Manager` on a role's detail page. The shell
 * (`MainLayout`) provides the setter; outside the shell it is a no-op.
 */
export const PageCrumbContext = createContext<
  ((label: string | null) => void) | null
>(null);

/** Shows `label` as the last breadcrumb step while the page is on screen. */
export function usePageCrumb(label: string | null | undefined): void {
  const setCrumb = useContext(PageCrumbContext);
  const value = label?.trim() ? label : null;
  useEffect(() => {
    if (!setCrumb) return;
    setCrumb(value);
    return () => setCrumb(null);
  }, [setCrumb, value]);
}
