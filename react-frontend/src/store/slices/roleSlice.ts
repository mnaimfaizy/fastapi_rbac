import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { roleService } from '../../services/role.service';
import { Role, RoleCreate, RoleUpdate } from '../../models/role';
import { PaginatedResponse, PaginationParams } from '../../models/pagination';

interface RoleState {
  roles: Role[];
  allRoles: Role[]; // New state property for all roles
  currentRole: Role | null;
  pagination: {
    total: number;
    page: number;
    size: number;
    pages: number;
  } | null;
  loading: boolean; // Consider separate loading states if needed (e.g., loadingList, loadingAll)
  error: string | null;
}

const initialState: RoleState = {
  roles: [],
  allRoles: [], // Initialize empty
  currentRole: null,
  pagination: null,
  loading: false,
  error: null,
};

// Async Thunks
export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (
    params: PaginationParams = { page: 1, size: 10 },
    { rejectWithValue }
  ) => {
    try {
      const response = await roleService.getRoles(params);
      return response.data; // Assuming response.data is PaginatedResponse<Role>
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const fetchRoleById = createAsyncThunk(
  'roles/fetchRoleById',
  async (roleId: string, { rejectWithValue }) => {
    try {
      const response = await roleService.getRoleById(roleId);
      return response.data; // Assuming response.data is Role
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const createRole = createAsyncThunk(
  'roles/createRole',
  async (roleData: RoleCreate, { rejectWithValue }) => {
    try {
      const response = await roleService.createRole(roleData);
      return response.data; // Assuming response.data is Role
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async (
    { roleId, roleData }: { roleId: string; roleData: RoleUpdate },
    { rejectWithValue }
  ) => {
    try {
      const response = await roleService.updateRole(roleId, roleData);
      return response.data; // Assuming response.data is Role
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const deleteRole = createAsyncThunk(
  'roles/deleteRole',
  async (roleId: string, { rejectWithValue }) => {
    try {
      await roleService.deleteRole(roleId);
      return roleId; // Return the ID of the deleted role for reducer
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// New thunks for permission management
export const assignPermissionsToRole = createAsyncThunk(
  'roles/assignPermissions',
  async (
    { roleId, permissionIds }: { roleId: string; permissionIds: string[] },
    { rejectWithValue }
  ) => {
    try {
      const response = await roleService.assignPermissionsToRole(
        roleId,
        permissionIds
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const removePermissionsFromRole = createAsyncThunk(
  'roles/removePermissions',
  async (
    { roleId, permissionIds }: { roleId: string; permissionIds: string[] },
    { rejectWithValue }
  ) => {
    try {
      const response = await roleService.removePermissionsFromRole(
        roleId,
        permissionIds
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// New Thunk to fetch all roles
export const fetchAllRoles = createAsyncThunk(
  'roles/fetchAllRoles',
  async (_, { rejectWithValue }) => {
    try {
      const response = await roleService.getAllRoles();
      // Assuming the API returns { message: string, data: Role[] }
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// Slice Definition
const roleSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    clearRoleError: (state) => {
      state.error = null;
    },
    setCurrentRole: (state, action: PayloadAction<Role | null>) => {
      state.currentRole = action.payload;
    },
    // Add other synchronous reducers if needed
  },
  extraReducers: (builder) => {
    builder
      // fetchRoles
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchRoles.fulfilled,
        (state, action: PayloadAction<PaginatedResponse<Role>>) => {
          state.loading = false;
          state.roles = action.payload.items;
          state.pagination = {
            total: action.payload.total,
            page: action.payload.page,
            size: action.payload.size,
            pages: action.payload.pages,
          };
        }
      )
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchRoleById
      .addCase(fetchRoleById.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.currentRole = null; // Clear previous role while fetching
      })
      .addCase(
        fetchRoleById.fulfilled,
        (state, action: PayloadAction<Role>) => {
          state.loading = false;
          state.currentRole = action.payload;
        }
      )
      .addCase(fetchRoleById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createRole
      .addCase(createRole.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createRole.fulfilled, (state, action: PayloadAction<Role>) => {
        state.loading = false;
        // Optionally add to the list or refetch
        state.roles.push(action.payload); // Simple add, might need adjustment based on pagination/sorting
        state.currentRole = action.payload; // Set newly created role as current
      })
      .addCase(createRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // updateRole
      .addCase(updateRole.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateRole.fulfilled, (state, action: PayloadAction<Role>) => {
        state.loading = false;
        state.currentRole = action.payload;
        // Update the role in the list
        const index = state.roles.findIndex(
          (role) => role.id === action.payload.id
        );
        if (index !== -1) {
          state.roles[index] = action.payload;
        }
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // deleteRole
      .addCase(deleteRole.pending, (state) => {
        state.loading = true; // Indicate loading state for delete
        state.error = null;
      })
      .addCase(deleteRole.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        // Remove the deleted role from the list
        state.roles = state.roles.filter((role) => role.id !== action.payload);
        // Optionally clear currentRole if it was the one deleted
        if (state.currentRole?.id === action.payload) {
          state.currentRole = null;
        }
        // Adjust pagination total if necessary (or refetch)
        if (state.pagination) {
          state.pagination.total -= 1;
          // Note: This simple decrement might not be accurate if deletion
          // affects multiple pages. Refetching might be more robust.
        }
      })
      .addCase(deleteRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // assignPermissionsToRole
      .addCase(assignPermissionsToRole.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        assignPermissionsToRole.fulfilled,
        (state, action: PayloadAction<Role>) => {
          state.loading = false;
          // Update the current role with new permissions
          if (state.currentRole?.id === action.payload.id) {
            state.currentRole = action.payload;
          }
          // Also update the role in the roles list if it's there
          const index = state.roles.findIndex(
            (role) => role.id === action.payload.id
          );
          if (index !== -1) {
            state.roles[index] = action.payload;
          }
        }
      )
      .addCase(assignPermissionsToRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // removePermissionsFromRole
      .addCase(removePermissionsFromRole.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        removePermissionsFromRole.fulfilled,
        (state, action: PayloadAction<Role>) => {
          state.loading = false;
          // Update the current role with the new permissions list
          if (state.currentRole?.id === action.payload.id) {
            state.currentRole = action.payload;
          }
          // Also update the role in the roles list if it's there
          const index = state.roles.findIndex(
            (role) => role.id === action.payload.id
          );
          if (index !== -1) {
            state.roles[index] = action.payload;
          }
        }
      )
      .addCase(removePermissionsFromRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchAllRoles
      .addCase(fetchAllRoles.pending, (state) => {
        state.loading = true; // Or a specific loading state like state.loadingAll = true;
        state.error = null;
      })
      .addCase(
        fetchAllRoles.fulfilled,
        (state, action: PayloadAction<Role[]>) => {
          // Payload is directly the array of roles
          state.loading = false;
          state.allRoles = action.payload;
        }
      )
      .addCase(fetchAllRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.allRoles = []; // Clear or keep stale data on error? Clearing for now.
      });
  },
});

export const { clearRoleError, setCurrentRole } = roleSlice.actions;
export default roleSlice.reducer;
