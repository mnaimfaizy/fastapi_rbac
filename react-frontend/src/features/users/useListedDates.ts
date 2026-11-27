import { useEffect, useState } from 'react';
import userService from '@/services/user.service';
import type { User } from '@/models/user';

/** The users API's largest page. */
const PAGE_SIZE = 100;

type Dates = Pick<User, 'id' | 'created_at' | 'updated_at'>;

/**
 * A user's Created and Last updated dates when the single-user read omits
 * them. `GET /users/{id}` leaves both out of its response model, while
 * `GET /users/list` sends them, so the user's row is looked up there, page
 * by page until found. Nothing is read when `user` already has its dates, so
 * this goes quiet once the API sends them. A failed lookup leaves the dates
 * unknown: the rest of the page doesn't depend on them.
 */
export function useListedDates(user: User | null): Dates | null {
  const [found, setFound] = useState<Dates | null>(null);
  const wantedId = user && !user.created_at ? user.id : null;

  useEffect(() => {
    if (!wantedId) return;
    let current = true;
    const find = async () => {
      try {
        for (let page = 1; current; page += 1) {
          const result = await userService.getUsers(page, PAGE_SIZE);
          const row = result.items.find((item) => item.id === wantedId);
          if (row) {
            if (current) setFound(row);
            return;
          }
          if (page >= result.pages) return;
        }
      } catch {
        // The dates stay unknown.
      }
    };
    void find();
    return () => {
      current = false;
    };
  }, [wantedId]);

  return found && found.id === user?.id ? found : null;
}
