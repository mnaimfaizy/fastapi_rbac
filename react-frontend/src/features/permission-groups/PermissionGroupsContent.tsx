import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch } from "../../hooks/redux";
import { fetchPermissionGroups } from "../../store/slices/permissionGroupSlice";
import PermissionGroupsDataTable from "./PermissionGroupsDataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PermissionGroupsContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  // Refetch permission groups data whenever we navigate to this component
  useEffect(() => {
    dispatch(fetchPermissionGroups({}));
  }, [dispatch, location.pathname]);

  const handleCreatePermissionGroup = () => {
    navigate("/dashboard/permission-groups/new");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Permission Groups</CardTitle>
        <Button onClick={handleCreatePermissionGroup}>
          Create Permission Group
        </Button>
      </CardHeader>
      <CardContent>
        <PermissionGroupsDataTable />
      </CardContent>
    </Card>
  );
};

export default PermissionGroupsContent;
