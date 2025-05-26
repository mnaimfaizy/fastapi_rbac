import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import { Provider, useSelector } from 'react-redux';
import { store, RootState } from './store';
import { useEffect, useState } from 'react';
import { getStoredRefreshToken } from './lib/tokenStorage';
import { refreshAccessToken, getCurrentUser } from './store/slices/authSlice';
import { useAppDispatch } from './store/hooks';
import { AppWrapper } from './components/common/AppWrapper';
import { LoadingScreen } from './components/common/LoadingScreen';

// Layouts
import MainLayout from './components/layout/MainLayout';

// Pages & Components
import { VerifyEmailPage } from './features/auth/components/VerifyEmailPage';
import { ResendVerificationEmailForm } from './features/auth/components/ResendVerificationEmailForm';
import AuthLayout from './components/layout/AuthLayout';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import { RegistrationSuccessPage } from './features/auth/RegistrationSuccessPage';
import PasswordResetRequestPage from './features/auth/PasswordResetRequestPage';
import PasswordResetPage from './features/auth/PasswordResetPage';
import PasswordResetConfirmPage from './features/auth/PasswordResetConfirmPage';
import SignupPage from './features/auth/SignupPage';
import DashboardOverview from './features/dashboard/DashboardOverview';
import ProfileContent from './components/dashboard/ProfileContent';
import ChangePasswordContent from './components/dashboard/ChangePasswordContent';
import UsersList from './features/users/UsersList';
import UserEditPage from './features/users/UserEditPage';
import UserDetailContent from './features/users/UserDetailContent';
import PermissionsContent from './features/permissions/PermissionsContent';
import PermissionFormContent from './features/permissions/PermissionFormContent';
import PermissionDetail from './features/permissions/PermissionDetail';
import PermissionGroupsContent from './features/permission-groups/PermissionGroupsContent';
import PermissionGroupFormContent from './features/permission-groups/PermissionGroupFormContent';
import PermissionGroupDetail from './features/permission-groups/PermissionGroupDetail';
import RolesContent from './features/roles/RolesContent';
import RoleFormContent from './features/roles/RoleFormContent';
import RoleDetail from './features/roles/RoleDetail';
import RoleGroupContent from './features/role-groups/RoleGroupContent';
import RoleGroupFormContent from './features/role-groups/RoleGroupFormContent';
import RoleGroupDetail from './features/role-groups/RoleGroupDetail';
import UnauthorizedPage from './pages/UnauthorizedPage';

import ProtectedRoute from './components/auth/ProtectedRoute';

// Example PublicOnlyRoute component (redirects if authenticated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PublicOnlyRoute = ({ children }: { children: any }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />; // Redirect to dashboard if logged in
};

// Component to initialize auth state if refresh token exists
const InitAuth = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      dispatch(refreshAccessToken(refreshToken))
        .unwrap()
        .then(() => {
          // If refresh token worked, also get the current user data
          dispatch(getCurrentUser());
        })
        .catch((error) => {
          console.error('Failed to refresh token on application start:', error);
          // The refreshAccessToken action already handles logout if it fails
        });
    }
  }, [dispatch]);

  return null;
};

function App() {
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Provider store={store}>
      {isLoading ? (
        <LoadingScreen hideAfterMs={1500} />
      ) : (
        <Router>
          <AppWrapper>
            <InitAuth />
            <Routes>
              {/* Authentication Routes */}
              <Route element={<AuthLayout />}>
                <Route
                  path="/login"
                  element={
                    <PublicOnlyRoute>
                      <LoginPage />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicOnlyRoute>
                      <SignupPage />
                    </PublicOnlyRoute>
                  }
                />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route
                  path="/resend-verification-email"
                  element={
                    <PublicOnlyRoute>
                      <ResendVerificationEmailForm />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/registration-success"
                  element={<RegistrationSuccessPage />}
                />
                {/* Add routes for password reset if needed */}
                <Route
                  path="/request-password-reset"
                  element={
                    <PublicOnlyRoute>
                      <PasswordResetRequestPage />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/reset-password"
                  element={
                    <PublicOnlyRoute>
                      <PasswordResetPage />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/reset-password-confirm"
                  element={
                    <PublicOnlyRoute>
                      <PasswordResetConfirmPage />
                    </PublicOnlyRoute>
                  }
                />
              </Route>

              {/* Protected Application Routes */}
              <Route
                path="/" // Parent route for protected area
                element={
                  <ProtectedRoute>
                    <MainLayout /> {/* MainLayout now renders Outlet */}
                  </ProtectedRoute>
                }
              >
                {/* Child routes rendered inside MainLayout's Outlet */}
                <Route index element={<Navigate to="/dashboard" replace />} />
                {/* Redirect / to /dashboard */}
                <Route path="dashboard" element={<DashboardPage />}>
                  {/* Nested Dashboard Routes - Rendered inside Dashboard's Outlet */}
                  <Route index element={<DashboardOverview />} />
                  <Route
                    path="/dashboard/profile"
                    element={<ProfileContent />}
                  />
                  <Route
                    path="/dashboard/change-password"
                    element={<ChangePasswordContent />}
                  />
                  {/* User management routes - updated with new components */}
                  <Route
                    path="/dashboard/users"
                    element={
                      <ProtectedRoute requiredPermissions={['users.read']}>
                        <UsersList />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/users/new"
                    element={
                      <ProtectedRoute requiredPermissions={['users.create']}>
                        <UserEditPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/users/:userId"
                    element={
                      <ProtectedRoute requiredPermissions={['users.read']}>
                        <UserDetailContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/users/:userId/edit" // Corrected path
                    element={
                      <ProtectedRoute requiredPermissions={['users.update']}>
                        <UserEditPage />
                      </ProtectedRoute>
                    }
                  />
                  {/* Permission management routes */}
                  <Route
                    path="/dashboard/permissions"
                    element={
                      <ProtectedRoute requiredPermissions={['permission.read']}>
                        <PermissionsContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/permissions/new"
                    element={
                      <ProtectedRoute
                        requiredPermissions={['permission.create']}
                      >
                        <PermissionFormContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/permissions/:id"
                    element={
                      <ProtectedRoute requiredPermissions={['permission.read']}>
                        <PermissionDetail />
                      </ProtectedRoute>
                    }
                  />
                  {/* Permission Group routes */}
                  <Route
                    path="/dashboard/permission-groups"
                    element={
                      <ProtectedRoute
                        requiredPermissions={['permission_group.read']}
                      >
                        <PermissionGroupsContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/permission-groups/new"
                    element={
                      <ProtectedRoute
                        requiredPermissions={['permission_group.create']}
                      >
                        <PermissionGroupFormContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/permission-groups/edit/:groupId"
                    element={
                      <ProtectedRoute
                        requiredPermissions={['permission_group.update']}
                      >
                        <PermissionGroupFormContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/permission-groups/:groupId"
                    element={
                      <ProtectedRoute
                        requiredPermissions={['permission_group.read']}
                      >
                        <PermissionGroupDetail />
                      </ProtectedRoute>
                    }
                  />
                  {/* Role management routes */}
                  <Route
                    path="/dashboard/roles"
                    element={
                      <ProtectedRoute requiredPermissions={['role.read']}>
                        <RolesContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/roles/new"
                    element={
                      <ProtectedRoute requiredPermissions={['role.create']}>
                        <RoleFormContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/roles/:roleId"
                    element={
                      <ProtectedRoute requiredPermissions={['role.read']}>
                        <RoleDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/roles/edit/:roleId"
                    element={
                      <ProtectedRoute requiredPermissions={['role.update']}>
                        <RoleFormContent />
                      </ProtectedRoute>
                    }
                  />
                  {/* Role Groups routes */}
                  <Route
                    path="/dashboard/role-groups"
                    element={
                      <ProtectedRoute requiredPermissions={['role_group.read']}>
                        <RoleGroupContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/role-groups/new"
                    element={
                      <ProtectedRoute
                        requiredPermissions={['role_group.create']}
                      >
                        <RoleGroupFormContent />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/role-groups/:groupId"
                    element={
                      <ProtectedRoute requiredPermissions={['role_group.read']}>
                        <RoleGroupDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/role-groups/edit/:groupId"
                    element={
                      <ProtectedRoute
                        requiredPermissions={['role_group.update']}
                      >
                        <RoleGroupFormContent />
                      </ProtectedRoute>
                    }
                  />
                </Route>
              </Route>

              {/* Unauthorized Page Route */}
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Not Found Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppWrapper>
        </Router>
      )}
    </Provider>
  );
}

export default App;
