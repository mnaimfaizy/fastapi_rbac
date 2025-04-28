import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  RoleGroup,
  RoleGroupCreate,
  RoleGroupUpdate,
  RoleGroupWithRoles,
} from "../../models/roleGroup";
import roleGroupService from "../../services/roleGroup.service";
import { PaginationParams } from "../../models/pagination";
import { RootState } from "..";

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface RoleGroupState {
  roleGroups: RoleGroup[];
  currentRoleGroup: RoleGroupWithRoles | null;
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    size: number;
    pages: number;
    previousPage: number | null;
    nextPage: number | null;
  };
}

const initialState: RoleGroupState = {
  roleGroups: [],
  currentRoleGroup: null,
  loading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    size: 10,
    pages: 0,
    previousPage: null,
    nextPage: null,
  },
};

/**
 * Transform a flat list of role groups into a hierarchical structure
 * @param flatGroups Flat array of role groups from API
 * @returns Array of role groups with proper children hierarchy
 */
function buildRoleGroupHierarchy(flatGroups: RoleGroup[]): RoleGroup[] {
  // Create a map of role groups by ID for quick lookups
  const groupMap = new Map<string, RoleGroup>();
  flatGroups.forEach((group) => {
    // Clone the group and initialize children array if not present
    groupMap.set(group.id, { ...group, children: group.children || [] });
  });

  // Build the tree structure
  const rootGroups: RoleGroup[] = [];
  flatGroups.forEach((group) => {
    const currentGroup = groupMap.get(group.id);
    if (!currentGroup) return;

    if (group.parent_id) {
      // This is a child group, add it to its parent's children array
      const parentGroup = groupMap.get(group.parent_id);
      if (parentGroup) {
        if (!parentGroup.children) {
          parentGroup.children = [];
        }
        parentGroup.children.push(currentGroup);
      } else {
        // Parent not found in our map, treat as root
        rootGroups.push(currentGroup);
      }
    } else {
      // This is a root group
      rootGroups.push(currentGroup);
    }
  });

  return rootGroups;
}

// Async thunks for API operations
export const fetchRoleGroups = createAsyncThunk(
  "roleGroups/fetchRoleGroups",
  async (
    params: PaginationParams & { search_query?: string } = {
      page: 1,
      size: 10,
    },
    { rejectWithValue }
  ) => {
    try {
      const { search_query, ...paginationParams } = params;
      return await roleGroupService.getRoleGroups({
        ...paginationParams,
        ...(search_query && { filters: { name: search_query } }),
      });
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(
        apiError.response?.data?.message || "Failed to fetch role groups"
      );
    }
  }
);

export const fetchRoleGroupById = createAsyncThunk(
  "roleGroups/fetchRoleGroupById",
  async (groupId: string, { rejectWithValue }) => {
    try {
      const response = await roleGroupService.getRoleGroupById(groupId);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(
        apiError.response?.data?.message || "Failed to fetch role group"
      );
    }
  }
);

export const createRoleGroup = createAsyncThunk(
  "roleGroups/createRoleGroup",
  async (roleGroupData: RoleGroupCreate, { rejectWithValue }) => {
    try {
      const response = await roleGroupService.createRoleGroup(roleGroupData);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(
        apiError.response?.data?.message || "Failed to create role group"
      );
    }
  }
);

export const updateRoleGroup = createAsyncThunk(
  "roleGroups/updateRoleGroup",
  async (
    {
      groupId,
      roleGroupData,
    }: { groupId: string; roleGroupData: RoleGroupUpdate },
    { rejectWithValue }
  ) => {
    try {
      const response = await roleGroupService.updateRoleGroup(
        groupId,
        roleGroupData
      );
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(
        apiError.response?.data?.message || "Failed to update role group"
      );
    }
  }
);

export const deleteRoleGroup = createAsyncThunk(
  "roleGroups/deleteRoleGroup",
  async (groupId: string, { rejectWithValue }) => {
    try {
      await roleGroupService.deleteRoleGroup(groupId);
      return groupId;
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(
        apiError.response?.data?.message || "Failed to delete role group"
      );
    }
  }
);

export const addRolesToGroup = createAsyncThunk(
  "roleGroups/addRolesToGroup",
  async (
    { groupId, roleIds }: { groupId: string; roleIds: string[] },
    { rejectWithValue }
  ) => {
    try {
      const response = await roleGroupService.addRolesToGroup(groupId, roleIds);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(
        apiError.response?.data?.message || "Failed to add roles to group"
      );
    }
  }
);

export const removeRolesFromGroup = createAsyncThunk(
  "roleGroups/removeRolesFromGroup",
  async (
    { groupId, roleIds }: { groupId: string; roleIds: string[] },
    { rejectWithValue }
  ) => {
    try {
      const response = await roleGroupService.removeRolesFromGroup(
        groupId,
        roleIds
      );
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(
        apiError.response?.data?.message || "Failed to remove roles from group"
      );
    }
  }
);

export const moveToParent = createAsyncThunk(
  "roleGroups/moveToParent",
  async (
    { groupId, parentId }: { groupId: string; parentId: string | null },
    { rejectWithValue }
  ) => {
    try {
      const response = await roleGroupService.moveToParent(groupId, parentId);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(
        apiError.response?.data?.message || "Failed to move role group"
      );
    }
  }
);

// Selector to join role groups with user data
export const selectRoleGroupsWithUsers = (state: RootState) => {
  const { roleGroups } = state.roleGroup;
  const { users } = state.user;

  // Helper function to add user data to role groups recursively
  const addUserDataToGroups = (
    groups: RoleGroup[]
  ): (RoleGroup & { created_by?: { id: string; name: string } })[] => {
    return groups.map((group) => {
      // Find the creator user
      const creatorUser = users.find((user) => user.id === group.created_by_id);

      // Create new group object with creator info
      const enrichedGroup = {
        ...group,
        created_by: creatorUser
          ? {
              id: creatorUser.id,
              name: `${creatorUser.first_name} ${creatorUser.last_name}`,
            }
          : undefined,
        children: group.children ? addUserDataToGroups(group.children) : [],
      };

      return enrichedGroup;
    });
  };

  return addUserDataToGroups(roleGroups);
};

// Selector for the current role group with user data
export const selectCurrentRoleGroupWithUsers = (state: RootState) => {
  const { currentRoleGroup } = state.roleGroup;
  const { users } = state.user;

  if (!currentRoleGroup) return null;

  // Find the creator user
  const creatorUser = users.find(
    (user) => user.id === currentRoleGroup.created_by_id
  );

  // Helper function to add user data to role groups recursively
  const addUserDataToGroups = (
    group: RoleGroupWithRoles
  ): RoleGroupWithRoles & { created_by?: { id: string; name: string } } => {
    // Create new group object with creator info
    const enrichedGroup = {
      ...group,
      created_by: creatorUser
        ? {
            id: creatorUser.id,
            name: `${creatorUser.first_name} ${creatorUser.last_name}`,
          }
        : undefined,
      children: group.children
        ? group.children.map((child) => addUserDataToGroups(child))
        : [],
    };

    return enrichedGroup;
  };

  return addUserDataToGroups(currentRoleGroup);
};

// Create the roleGroup slice
const roleGroupSlice = createSlice({
  name: "roleGroup",
  initialState,
  reducers: {
    clearCurrentRoleGroup: (state) => {
      state.currentRoleGroup = null;
    },
    clearRoleGroupErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch role groups
      .addCase(fetchRoleGroups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoleGroups.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.data) {
          // Transform flat list into hierarchical structure
          const flatGroups = action.payload.data.items;
          state.roleGroups = buildRoleGroupHierarchy(flatGroups);

          state.pagination = {
            total: action.payload.data.total,
            page: action.payload.data.page,
            size: action.payload.data.size,
            pages: action.payload.data.pages,
            previousPage:
              action.payload.data.page > 1
                ? action.payload.data.page - 1
                : null,
            nextPage:
              action.payload.data.page < action.payload.data.pages
                ? action.payload.data.page + 1
                : null,
          };
        }
      })
      .addCase(fetchRoleGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch role group by ID
      .addCase(fetchRoleGroupById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchRoleGroupById.fulfilled,
        (state, action: PayloadAction<RoleGroupWithRoles>) => {
          state.loading = false;

          // Make sure the children array is properly initialized
          const roleGroup = action.payload;
          if (!roleGroup.children) {
            roleGroup.children = [];
          }

          // Make sure roles array is properly initialized
          if (!roleGroup.roles) {
            roleGroup.roles = [];
          }

          // Set the current role group
          state.currentRoleGroup = roleGroup;
        }
      )
      .addCase(fetchRoleGroupById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Create role group
      .addCase(createRoleGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createRoleGroup.fulfilled, (state, action) => {
        state.loading = false;
        // Update the list if it's a root-level group
        if (!action.payload.parent_id) {
          state.roleGroups.push(action.payload);
        }
      })
      .addCase(createRoleGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Update role group
      .addCase(updateRoleGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateRoleGroup.fulfilled, (state, action) => {
        state.loading = false;
        const updatedRoleGroup = action.payload;
        state.roleGroups = state.roleGroups.map((group) =>
          group.id === updatedRoleGroup.id ? updatedRoleGroup : group
        );
        if (state.currentRoleGroup?.id === updatedRoleGroup.id) {
          state.currentRoleGroup = {
            ...state.currentRoleGroup,
            ...updatedRoleGroup,
            roles: state.currentRoleGroup?.roles ?? [],
            children: state.currentRoleGroup?.children ?? [],
          };
        }
      })

      // Delete role group
      .addCase(deleteRoleGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteRoleGroup.fulfilled, (state, action) => {
        state.loading = false;
        // Remove the deleted group and its children
        const removeGroup = (groups: RoleGroup[], groupId: string) => {
          return groups.filter((group) => {
            if (group.children) {
              group.children = removeGroup(group.children, groupId);
            }
            return group.id !== groupId;
          });
        };
        state.roleGroups = removeGroup(state.roleGroups, action.payload);
        if (state.currentRoleGroup?.id === action.payload) {
          state.currentRoleGroup = null;
        }
      })
      .addCase(deleteRoleGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Add roles to group
      .addCase(addRolesToGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addRolesToGroup.fulfilled, (state, action) => {
        state.loading = false;
        if (state.currentRoleGroup?.id === action.payload.id) {
          state.currentRoleGroup = action.payload;
        }
      })
      .addCase(addRolesToGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Remove roles from group
      .addCase(removeRolesFromGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeRolesFromGroup.fulfilled, (state, action) => {
        state.loading = false;
        if (state.currentRoleGroup?.id === action.payload.id) {
          state.currentRoleGroup = action.payload;
        }
      })
      .addCase(removeRolesFromGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Move role group to new parent
      .addCase(moveToParent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(moveToParent.fulfilled, (state, action) => {
        state.loading = false;
        const movedGroup = action.payload;
        // Update the group in the list, including its new parent relationship
        const updateGroupHierarchy = (
          groups: RoleGroup[]
        ): RoleGroupWithRoles[] => {
          return groups.map((group) => {
            if (group.id === movedGroup.id) {
              return movedGroup as RoleGroupWithRoles;
            }
            if (group.children) {
              return {
                ...group,
                roles: [], // Add empty roles array for type compatibility
                children: updateGroupHierarchy(group.children),
              };
            }
            return {
              ...group,
              roles: [], // Add empty roles array for type compatibility
              children: [],
            };
          });
        };
        state.roleGroups = updateGroupHierarchy(state.roleGroups);
      })
      .addCase(moveToParent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentRoleGroup, clearRoleGroupErrors } =
  roleGroupSlice.actions;
export default roleGroupSlice.reducer;
