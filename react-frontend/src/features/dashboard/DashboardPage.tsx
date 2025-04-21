import { Route, Routes } from "react-router-dom";
import DashboardOverview from "./DashboardOverview";
import ProfileContent from "../../components/dashboard/ProfileContent";
import ChangePasswordContent from "../../components/dashboard/ChangePasswordContent";
import UserListContent from "../../components/dashboard/UserListContent";
import UserDetailContent from "../../components/dashboard/UserDetailContent";
import UserFormContent from "../../components/dashboard/UserFormContent";
import { Dashboard } from "../../components/dashboard/dashboard";

const DashboardPage = () => {
  return (
    <Dashboard>
      <Routes>
        <Route path="/" element={<DashboardOverview />} />
        <Route path="/profile" element={<ProfileContent />} />
        <Route path="/change-password" element={<ChangePasswordContent />} />

        {/* User management routes */}
        <Route path="/users" element={<UserListContent />} />
        <Route path="/users/:userId" element={<UserDetailContent />} />
        <Route path="/users/create" element={<UserFormContent />} />
        <Route path="/users/edit/:userId" element={<UserFormContent />} />

        {/* Add more routes for other dashboard features as needed */}
      </Routes>
    </Dashboard>
  );
};

export default DashboardPage;
