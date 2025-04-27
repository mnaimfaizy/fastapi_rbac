import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import {
  fetchRoleGroupById,
  createRoleGroup,
  updateRoleGroup,
  clearCurrentRoleGroup,
  clearRoleGroupErrors,
} from "../../store/slices/roleGroupSlice";
import { RoleGroupCreate, RoleGroupUpdate } from "../../models/roleGroup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RoleGroupForm from "./RoleGroupForm";

const RoleGroupFormContent: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const isEditMode = Boolean(groupId);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { currentRoleGroup, loading, error } = useSelector(
    (state: RootState) => state.roleGroup
  );

  useEffect(() => {
    // If editing, load the role group data
    if (isEditMode && groupId) {
      dispatch(fetchRoleGroupById(groupId));
    }

    // Cleanup when component unmounts
    return () => {
      dispatch(clearCurrentRoleGroup());
      dispatch(clearRoleGroupErrors());
    };
  }, [dispatch, isEditMode, groupId]);

  const handleSubmit = async (data: RoleGroupCreate | RoleGroupUpdate) => {
    try {
      if (isEditMode && groupId) {
        // Update existing role group
        await dispatch(
          updateRoleGroup({
            groupId,
            roleGroupData: data as RoleGroupUpdate,
          })
        ).unwrap();
      } else {
        // Create new role group
        await dispatch(createRoleGroup(data as RoleGroupCreate)).unwrap();
      }
      navigate("/dashboard/role-groups");
    } catch (err) {
      // Error handling is managed by the slice
      console.error("Failed to save role group:", err);
    }
  };

  if (isEditMode && loading && !currentRoleGroup) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? "Edit Role Group" : "Create Role Group"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RoleGroupForm
          initialData={isEditMode ? currentRoleGroup : null}
          isLoading={loading}
          error={error}
          onSubmit={handleSubmit}
        />
      </CardContent>
    </Card>
  );
};

export default RoleGroupFormContent;
