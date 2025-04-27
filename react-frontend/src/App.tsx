import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import LoginPage from "./features/auth/LoginPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import { useEffect } from "react";
import { getStoredRefreshToken } from "./lib/tokenStorage";
import { refreshAccessToken } from "./store/slices/authSlice";
import PasswordResetRequestPage from "./features/auth/PasswordResetRequestPage";
import PasswordResetConfirmPage from "./features/auth/PasswordResetConfirmPage";
import RolesPage from "./features/roles/RolesPage"; // Import RolesPage
import { Toaster } from "@/components/ui/sonner";

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
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/password-reset"
            element={<PasswordResetRequestPage />}
          />
          <Route
            path="/password-reset/confirm"
            element={<PasswordResetConfirmPage />}
          />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </Router>
    </Provider>
  );
}

export default App;
