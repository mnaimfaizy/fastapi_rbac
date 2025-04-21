import { Route, Routes } from "react-router-dom";
import DashboardOverview from "./DashboardOverview";
import ProfileContent from "../../components/dashboard/ProfileContent";
import ChangePasswordContent from "../../components/dashboard/ChangePasswordContent";
import UserListContent from "../../components/dashboard/UserListContent";
import UserDetailContent from "../../components/dashboard/UserDetailContent";
import UserFormContent from "../../components/dashboard/UserFormContent";
import { Dashboard } from "../../components/dashboard/dashboard";

// Import Permission Components
import PermissionsContent from "../../components/dashboard/permissions/PermissionsContent";
import PermissionDetailContent from "../../components/dashboard/permissions/PermissionDetailContent";
import PermissionFormContent from "../../components/dashboard/permissions/PermissionFormContent";

// Import Permission Group Components
import PermissionGroupsContent from "../../components/dashboard/permission-groups/PermissionGroupsContent";
import PermissionGroupDetailContent from "../../components/dashboard/permission-groups/PermissionGroupDetailContent";
import PermissionGroupFormContent from "../../components/dashboard/permission-groups/PermissionGroupFormContent";

const DashboardPage = () => {
  return (
    <Dashboard>
      <Routes>
        <Route path="/" element={<DashboardOverview />} />
        <Route path="/profile" element={<ProfileContent />} />
        <Route path="/change-password" element={<ChangePasswordContent />} />

        {/* User management routes */}
        <Route path="/users" element={<UserListContent />} />
        <Route path="/users/create" element={<UserFormContent />} />
        <Route path="/users/edit/:userId" element={<UserFormContent />} />
        <Route path="/users/:userId" element={<UserDetailContent />} />

        {/* Permission management routes - specific routes first, then dynamic routes */}
        <Route path="/permissions" element={<PermissionsContent />} />
        <Route path="/permissions/new" element={<PermissionFormContent />} />
        <Route
          path="/permissions/edit/:id"
          element={<PermissionFormContent />}
        />
        <Route path="/permissions/:id" element={<PermissionDetailContent />} />

        {/* Permission Group management routes - specific routes first, then dynamic routes */}
        <Route
          path="/permission-groups"
          element={<PermissionGroupsContent />}
        />
        <Route
          path="/permission-groups/new"
          element={<PermissionGroupFormContent />}
        />
        <Route
          path="/permission-groups/edit/:id"
          element={<PermissionGroupFormContent />}
        />
        <Route
          path="/permission-groups/:id"
          element={<PermissionGroupDetailContent />}
        />

        {/* Add more routes for other dashboard features as needed */}
      </Routes>
    </Dashboard>
  );
};

export default DashboardPage;
