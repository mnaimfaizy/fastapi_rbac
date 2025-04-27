import { Route, Routes } from "react-router-dom";
import DashboardOverview from "./DashboardOverview";
import ProfileContent from "../../components/dashboard/ProfileContent";
import ChangePasswordContent from "../../components/dashboard/ChangePasswordContent";
import UsersList from "../users/UsersList";
import UserEditPage from "../users/UserEditPage";
import UserDetailContent from "../../components/dashboard/UserDetailContent";

// Import Permission Components
import PermissionsContent from "../../components/dashboard/permissions/PermissionsContent";
import PermissionDetailContent from "../../components/dashboard/permissions/PermissionDetailContent";
import PermissionFormContent from "../../components/dashboard/permissions/PermissionFormContent";

// Import Permission Group Components
import PermissionGroupsContent from "../../components/dashboard/permission-groups/PermissionGroupsContent";
import PermissionGroupDetailContent from "../../components/dashboard/permission-groups/PermissionGroupDetailContent";
import PermissionGroupFormContent from "../../components/dashboard/permission-groups/PermissionGroupFormContent";

// Import Role Components
import RolesContent from "../roles/RolesContent";
import RoleFormContent from "../roles/RoleFormContent";

// Import Role Group Components
import RoleGroupContent from "../role-groups/RoleGroupContent";
import RoleGroupDetail from "../role-groups/RoleGroupDetail";
import RoleGroupFormContent from "../role-groups/RoleGroupFormContent";

import { Dashboard } from "../../components/dashboard/dashboard";

const DashboardPage = () => {
  return (
    <Dashboard>
      <Routes>
        <Route path="/" element={<DashboardOverview />} />
        <Route path="/profile" element={<ProfileContent />} />
        <Route path="/change-password" element={<ChangePasswordContent />} />

        {/* User management routes - updated with new components */}
        <Route path="/users" element={<UsersList />} />
        <Route path="/users/new" element={<UserEditPage />} />
        <Route path="/users/:userId" element={<UserDetailContent />} />
        <Route path="/users/edit/:userId" element={<UserEditPage />} />

        {/* Permission management routes */}
        <Route path="/permissions" element={<PermissionsContent />} />
        <Route path="/permissions/new" element={<PermissionFormContent />} />
        <Route path="/permissions/:id" element={<PermissionDetailContent />} />
        <Route
          path="/permissions/edit/:id"
          element={<PermissionFormContent />}
        />

        {/* Permission Group routes */}
        <Route
          path="/permission-groups"
          element={<PermissionGroupsContent />}
        />
        <Route
          path="/permission-groups/new"
          element={<PermissionGroupFormContent />}
        />
        <Route
          path="/permission-groups/:groupId"
          element={<PermissionGroupDetailContent />}
        />
        <Route
          path="/permission-groups/edit/:groupId"
          element={<PermissionGroupFormContent />}
        />

        {/* Role management routes */}
        <Route path="/roles" element={<RolesContent />} />
        <Route path="/roles/new" element={<RoleFormContent />} />
        <Route path="/roles/edit/:roleId" element={<RoleFormContent />} />

        {/* Role Groups routes */}
        <Route path="/role-groups" element={<RoleGroupContent />} />
        <Route path="/role-groups/new" element={<RoleGroupFormContent />} />
        <Route path="/role-groups/:groupId" element={<RoleGroupDetail />} />
        <Route
          path="/role-groups/edit/:groupId"
          element={<RoleGroupFormContent />}
        />
      </Routes>
    </Dashboard>
  );
};

export default DashboardPage;
