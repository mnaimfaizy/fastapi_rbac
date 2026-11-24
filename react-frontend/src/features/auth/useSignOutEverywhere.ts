import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks';
import { logoutAllUser } from '@/store/slices/authSlice';
import { SIGNED_OUT_EVERYWHERE_NOTICE } from './notices';

/**
 * Sign out everywhere, then go to sign in. Sign in shows "You’ve been signed
 * out everywhere." only when the server revoked every session; a failed call
 * still signs this device out and lands on plain `/login`. The account menu
 * and User home both use this, so the rule lives in one place.
 */
export function useSignOutEverywhere(): () => Promise<void> {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return useCallback(async () => {
    const revoked = await dispatch(logoutAllUser()).unwrap();
    navigate(
      revoked ? `/login?notice=${SIGNED_OUT_EVERYWHERE_NOTICE}` : '/login',
      { replace: true }
    );
  }, [dispatch, navigate]);
}
