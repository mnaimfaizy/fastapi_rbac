import { createContext, useContext, useEffect } from 'react';

/** One breadcrumb step, or a blank one (a name still loading) to leave out. */
type CrumbLabel = string | null | undefined;

/**
 * Lets a page name the last steps of the header breadcrumb, after its nav
 * item: `Access › Roles › Manager` on a role's detail page, or
 * `Access › Roles › Manager › Edit` on its edit page. The shell
 * (`MainLayout`) provides the setter and also puts the steps in the browser
 * tab title; outside the shell it is a no-op.
 */
export const PageCrumbContext = createContext<
  ((crumbs: string[]) => void) | null
>(null);

/** Joins steps into a stable effect key; no label holds this character. */
const SEPARATOR = '\u0000';

/**
 * Shows `crumbs` as the last breadcrumb steps while the page is on screen.
 * Pass one label (`usePageCrumb(role.name)`) or a trail
 * (`usePageCrumb([role.name, 'Edit'])`); blank labels are left out, so a
 * page can pass a name before it has loaded.
 */
export function usePageCrumb(crumbs: CrumbLabel | readonly CrumbLabel[]): void {
  const setCrumbs = useContext(PageCrumbContext);
  const list: readonly CrumbLabel[] = Array.isArray(crumbs)
    ? crumbs
    : [crumbs as CrumbLabel];
  const key = list
    .filter((label): label is string => Boolean(label?.trim()))
    .join(SEPARATOR);
  useEffect(() => {
    if (!setCrumbs) return;
    setCrumbs(key ? key.split(SEPARATOR) : []);
    return () => setCrumbs([]);
  }, [setCrumbs, key]);
}
