import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { Provider, useSelector } from "react-redux";
import { store, RootState } from "./store"; // Adjust path if needed
import { useEffect } from "react";
import { getStoredRefreshToken } from "./lib/tokenStorage";
import { refreshAccessToken } from "./store/slices/authSlice";
import { Toaster } from "@/components/ui/sonner";

// Layouts
import MainLayout from "./components/layout/MainLayout";

// Pages & Components
import { VerifyEmailPage } from "./features/auth/components/VerifyEmailPage";
import { ResendVerificationEmailForm } from "./features/auth/components/ResendVerificationEmailForm";
import AuthLayout from "./components/layout/AuthLayout";
import LoginPage from "./features/auth/LoginPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import { RegistrationSuccessPage } from "./features/auth/RegistrationSuccessPage";
import PasswordResetRequestPage from "./features/auth/PasswordResetRequestPage";
import PasswordResetPage from "./features/auth/PasswordResetPage";
import PasswordResetConfirmPage from "./features/auth/PasswordResetConfirmPage";
import SignupPage from "./features/auth/SignupPage";
import DashboardOverview from "./features/dashboard/DashboardOverview";
import ProfileContent from "./components/dashboard/ProfileContent";
import ChangePasswordContent from "./components/dashboard/ChangePasswordContent";
import UsersList from "./features/users/UsersList";
import UserEditPage from "./features/users/UserEditPage";
import UserDetailContent from "./components/dashboard/UserDetailContent";
import PermissionsContent from "./features/permissions/PermissionsContent";
import PermissionFormContent from "./features/permissions/PermissionFormContent";
import PermissionDetail from "./features/permissions/PermissionDetail";
import PermissionGroupsContent from "./features/permission-groups/PermissionGroupsContent";
import PermissionGroupFormContent from "./features/permission-groups/PermissionGroupFormContent";
import PermissionGroupDetail from "./features/permission-groups/PermissionGroupDetail";
import RolesContent from "./features/roles/RolesContent";
import RoleFormContent from "./features/roles/RoleFormContent";
import RoleGroupContent from "./features/role-groups/RoleGroupContent";
import RoleGroupFormContent from "./features/role-groups/RoleGroupFormContent";
import RoleGroupDetail from "./features/role-groups/RoleGroupDetail";

// Example ProtectedRoute component (implement based on your auth state)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ProtectedRoute = ({ children }: { children: any }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Example PublicOnlyRoute component (redirects if authenticated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PublicOnlyRoute = ({ children }: { children: any }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />; // Redirect to dashboard if logged in
};

// Component to initialize auth state if refresh token exists
const InitAuth = () => {
  useEffect(() => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      store.dispatch(refreshAccessToken(refreshToken));
    }
  }, []);

  return null;
};

function App() {
  return (
    <Provider store={store}>
      <Router>
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
            <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
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
              path="/reset-password/:token"
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
            <Route index element={<Navigate to="/dashboard" replace />} />{" "}
            {/* Redirect / to /dashboard */}
            <Route path="dashboard" element={<DashboardPage />}>
              {/* Nested Dashboard Routes - Rendered inside Dashboard's Outlet */}
              <Route index element={<DashboardOverview />} />{" "}
              <Route path="/dashboard/profile" element={<ProfileContent />} />
              <Route
                path="/dashboard/change-password"
                element={<ChangePasswordContent />}
              />
              {/* User management routes - updated with new components */}
              <Route path="/dashboard/users" element={<UsersList />} />
              <Route path="/dashboard/users/new" element={<UserEditPage />} />
              <Route
                path="/dashboard/users/:userId"
                element={<UserDetailContent />}
              />
              <Route
                path="/dashboard/users/edit/:userId"
                element={<UserEditPage />}
              />
              {/* Permission management routes */}
              <Route
                path="/dashboard/permissions"
                element={<PermissionsContent />}
              />
              <Route
                path="/dashboard/permissions/new"
                element={<PermissionFormContent />}
              />
              <Route
                path="/dashboard/permissions/:id"
                element={<PermissionDetail />}
              />
              <Route
                path="/dashboard/permissions/edit/:id"
                element={<PermissionFormContent />}
              />
              {/* Permission Group routes */}
              <Route
                path="/dashboard/permission-groups"
                element={<PermissionGroupsContent />}
              />
              <Route
                path="/dashboard/permission-groups/new"
                element={<PermissionGroupFormContent />}
              />
              <Route
                path="/dashboard/permission-groups/:groupId"
                element={<PermissionGroupDetail />}
              />
              <Route
                path="/dashboard/permission-groups/edit/:groupId"
                element={<PermissionGroupFormContent />}
              />
              {/* Role management routes */}
              <Route path="/dashboard/roles" element={<RolesContent />} />
              <Route
                path="/dashboard//roles/new"
                element={<RoleFormContent />}
              />
              <Route
                path="/dashboard/roles/edit/:roleId"
                element={<RoleFormContent />}
              />
              {/* Role Groups routes */}
              <Route
                path="/dashboard/role-groups"
                element={<RoleGroupContent />}
              />
              <Route
                path="/dashboard/role-groups/new"
                element={<RoleGroupFormContent />}
              />
              <Route
                path="/dashboard/role-groups/:groupId"
                element={<RoleGroupDetail />}
              />
              <Route
                path="/dashboard/role-groups/edit/:groupId"
                element={<RoleGroupFormContent />}
              />
              {/* Add other dashboard-nested routes here */}
              {/* e.g., <Route path="settings" element={<SettingsPage />} /> */}
            </Route>
            {/* Add other top-level protected routes here if needed */}
          </Route>

          {/* Not Found Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </Router>{" "}
      {/* Ensure Router is closed correctly */}
    </Provider>
  );
}

export default App;
