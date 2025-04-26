import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { AppDispatch, RootState } from "../../store";
import {
  createRole,
  fetchRoleById,
  updateRole,
  clearRoleError,
  setCurrentRole,
} from "../../store/slices/roleSlice";
import RoleForm, { RoleFormData } from "./RoleForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Combined component for Create and Edit
const RoleFormContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { roleId } = useParams<{ roleId?: string }>(); // roleId is optional
  const { currentRole, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const isEditMode = Boolean(roleId);

  useEffect(() => {
    if (isEditMode && roleId) {
      dispatch(fetchRoleById(roleId));
    } else {
      // Clear any existing role data if in create mode
      dispatch(setCurrentRole(null));
    }

    // Cleanup on unmount or when switching between create/edit
    return () => {
      dispatch(clearRoleError());
      // Don't clear currentRole here if navigating away from edit,
      // but maybe clear if navigating *between* create/edit?
      // Let's clear it for simplicity for now.
      dispatch(setCurrentRole(null));
    };
  }, [dispatch, roleId, isEditMode]);

  const handleSubmit = async (data: RoleFormData) => {
    try {
      if (isEditMode && roleId) {
        // Update existing role
        await dispatch(updateRole({ roleId, roleData: data })).unwrap();
        toast("Role updated successfully.");
      } else {
        // Create new role
        await dispatch(createRole(data)).unwrap();
        toast("Role created successfully.");
      }
      navigate("/dashboard/roles"); // Navigate back to the list
    } catch (err: any) {
      const actionType = isEditMode ? "update" : "create";
      toast(err || `Failed to ${actionType} role.`);
      console.error(`Failed to ${actionType} role:`, err);
    }
  };

  // Loading state specifically for fetching in edit mode
  if (isEditMode && loading && !currentRole) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-1/4" />
        </CardContent>
      </Card>
    );
  }

  // Error state specifically for fetching in edit mode
  if (isEditMode && error && !currentRole) {
    return <div className="text-red-500">Error loading role: {error}</div>;
  }

  // If in edit mode but role not found after loading/error checks
  if (isEditMode && !currentRole) {
    return <div>Role not found.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? `Edit Role: ${currentRole?.name}` : "Create New Role"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RoleForm
          onSubmit={handleSubmit}
          initialData={isEditMode ? currentRole : null}
          isLoading={loading} // Use general loading state for form submission
        />
        {/* Display general error (e.g., from submission) */}
        {error && <p className="text-red-500 mt-4">Error: {error}</p>}
      </CardContent>
    </Card>
  );
};

export default RoleFormContent;
