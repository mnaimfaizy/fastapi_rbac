import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { getStoredRefreshToken } from '../lib/tokenStorage';
import {
  refreshAccessToken,
  getCurrentUser,
  loginUser,
  logoutUser,
} from '../store/slices/authSlice';

/**
 * Custom hook for authentication management
 * Provides easy access to auth state and functions
 */
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, accessToken, isLoading, error } =
    useAppSelector((state) => state.auth);

  // Initialize authentication on mount if refresh token exists
  useEffect(() => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken && !isAuthenticated && !isLoading) {
      dispatch(refreshAccessToken(refreshToken))
        .unwrap()
        .then(() => {
          dispatch(getCurrentUser());
        })
        .catch(() => {
          // Token refresh failed, handled in the slice
        });
    }
  }, [dispatch, isAuthenticated, isLoading]);

  const login = async (credentials: { email: string; password: string }) => {
    return dispatch(loginUser(credentials));
  };

  const logout = () => {
    dispatch(logoutUser());
  };

  return {
    user,
    isAuthenticated,
    accessToken,
    loading: isLoading,
    error,
    login,
    logout,
  };
};

export default useAuth;
