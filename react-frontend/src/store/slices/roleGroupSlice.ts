import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  RoleGroup,
  RoleGroupCreate,
  RoleGroupUpdate,
  RoleGroupWithRoles,
} from "../../models/roleGroup";
import roleGroupService from "../../services/roleGroup.service";
import {
  PaginationParams,
  PaginatedDataResponse,
} from "../../models/pagination";

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

// Async thunks for API operations
export const fetchRoleGroups = createAsyncThunk(
  "roleGroups/fetchRoleGroups",
  async (
    params: PaginationParams = { page: 1, size: 10 },
    { rejectWithValue }
  ) => {
    try {
      return await roleGroupService.getRoleGroups(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch role groups"
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
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch role group"
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
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create role group"
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
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update role group"
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
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete role group"
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
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to add roles to group"
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
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to remove roles from group"
      );
    }
  }
);

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
      .addCase(
        fetchRoleGroups.fulfilled,
        (state, action: PayloadAction<PaginatedDataResponse<RoleGroup>>) => {
          state.loading = false;
          state.roleGroups = action.payload.data.items;
          state.pagination = {
            total: action.payload.data.total,
            page: action.payload.data.page,
            size: action.payload.data.size,
            pages: action.payload.data.pages,
            previousPage: action.payload.data.previous_page,
            nextPage: action.payload.data.next_page,
          };
        }
      )
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
          state.currentRoleGroup = action.payload;
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
      .addCase(
        createRoleGroup.fulfilled,
        (state, action: PayloadAction<RoleGroup>) => {
          state.loading = false;
          state.roleGroups.push(action.payload);
        }
      )
      .addCase(createRoleGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Update role group
      .addCase(updateRoleGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        updateRoleGroup.fulfilled,
        (state, action: PayloadAction<RoleGroup>) => {
          state.loading = false;
          const updatedRoleGroup = action.payload;
          state.roleGroups = state.roleGroups.map((group) =>
            group.id === updatedRoleGroup.id ? updatedRoleGroup : group
          );
          if (state.currentRoleGroup?.id === updatedRoleGroup.id) {
            state.currentRoleGroup = {
              ...state.currentRoleGroup,
              ...updatedRoleGroup,
            };
          }
        }
      )
      .addCase(updateRoleGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Delete role group
      .addCase(deleteRoleGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        deleteRoleGroup.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.loading = false;
          state.roleGroups = state.roleGroups.filter(
            (group) => group.id !== action.payload
          );
          if (state.currentRoleGroup?.id === action.payload) {
            state.currentRoleGroup = null;
          }
        }
      )
      .addCase(deleteRoleGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Add roles to group
      .addCase(addRolesToGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        addRolesToGroup.fulfilled,
        (state, action: PayloadAction<RoleGroupWithRoles>) => {
          state.loading = false;
          if (state.currentRoleGroup?.id === action.payload.id) {
            state.currentRoleGroup = action.payload;
          }
        }
      )
      .addCase(addRolesToGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Remove roles from group
      .addCase(removeRolesFromGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        removeRolesFromGroup.fulfilled,
        (state, action: PayloadAction<RoleGroupWithRoles>) => {
          state.loading = false;
          if (state.currentRoleGroup?.id === action.payload.id) {
            state.currentRoleGroup = action.payload;
          }
        }
      )
      .addCase(removeRolesFromGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentRoleGroup, clearRoleGroupErrors } =
  roleGroupSlice.actions;
export default roleGroupSlice.reducer;
