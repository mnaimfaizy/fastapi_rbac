import React from "react";
import { useNavigate } from "react-router-dom";
import RoleList from "./RoleList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Renamed from RolesPage
const RolesContent: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateRole = () => {
    navigate("/dashboard/roles/new"); // Updated navigation path
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Roles</CardTitle>
        <Button onClick={handleCreateRole}>Create Role</Button>
      </CardHeader>
      <CardContent>
        <RoleList />
      </CardContent>
    </Card>
  );
};

export default RolesContent;
