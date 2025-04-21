import { Route, Routes } from "react-router-dom";
import DashboardOverview from "./DashboardOverview";
import ProfileContent from "../../components/dashboard/ProfileContent";
import ChangePasswordContent from "../../components/dashboard/ChangePasswordContent";
import { Dashboard } from "../../components/dashboard/dashboard";

const DashboardPage = () => {
  return (
    <Dashboard>
      <Routes>
        <Route path="/" element={<DashboardOverview />} />
        <Route path="/profile" element={<ProfileContent />} />
        <Route path="/change-password" element={<ChangePasswordContent />} />
        {/* Add more routes for other dashboard features as needed */}
      </Routes>
    </Dashboard>
  );
};

export default DashboardPage;
