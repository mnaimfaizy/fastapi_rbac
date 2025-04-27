import React from "react";
import { useNavigate } from "react-router-dom";
import RoleGroupList from "./RoleGroupList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

const RoleGroupContent: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateRoleGroup = () => {
    navigate("/dashboard/role-groups/new");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Role Groups</CardTitle>
        <Button onClick={handleCreateRoleGroup}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role Group
        </Button>
      </CardHeader>
      <CardContent>
        <RoleGroupList />
      </CardContent>
    </Card>
  );
};

export default RoleGroupContent;
