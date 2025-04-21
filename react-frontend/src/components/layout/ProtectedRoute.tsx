import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { getStoredRefreshToken } from "../../lib/tokenStorage";
import { refreshAccessToken } from "../../store/slices/authSlice";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, accessToken } = useAppSelector(
    (state) => state.auth
  );
  const location = useLocation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    // If not authenticated but has refresh token, try to refresh
    if (!isAuthenticated && !accessToken) {
      const refreshToken = getStoredRefreshToken();
      if (refreshToken) {
        dispatch(refreshAccessToken(refreshToken));
      }
    }
  }, [isAuthenticated, accessToken, dispatch]);

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Otherwise, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
