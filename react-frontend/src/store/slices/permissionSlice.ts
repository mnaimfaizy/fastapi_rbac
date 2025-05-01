import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  Permission,
  PermissionCreate,
  PermissionUpdate,
  PaginatedPermissionResponse, // Use the correct response type from the model
} from "../../models/permission";
import permissionService from "../../services/permission.service";

// Remove unused import: import { PaginatedDataResponse } from "../../models/pagination";

interface PermissionState {
  permissions: Permission[];
  currentPermission: Permission | null;
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  page: number;
  pageSize: number;
}

const initialState: PermissionState = {
  permissions: [],
  currentPermission: null,
  isLoading: false,
  error: null,
  totalItems: 0,
  page: 1,
  pageSize: 10,
};

// Async thunks
// Adjust return type to match the actual service response (PaginatedPermissionResponse)
export const fetchPermissions = createAsyncThunk<
  PaginatedPermissionResponse, // Return type on success
  { page?: number; pageSize?: number }, // Argument type
  { rejectValue: string } // Type for rejectWithValue
>(
  "permission/fetchPermissions",
  async ({ page = 1, pageSize = 10 }, { rejectWithValue }) => {
    try {
      // Assuming permissionService.getPermissions returns PaginatedPermissionResponse
      const response = await permissionService.getPermissions(page, pageSize);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch permissions";
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchPermissionById = createAsyncThunk(
  "permission/fetchPermissionById",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await permissionService.getPermissionById(id);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch permission";
      return rejectWithValue(errorMessage);
    }
  }
);

export const createPermission = createAsyncThunk(
  "permission/createPermission",
  async (permissionData: PermissionCreate, { rejectWithValue }) => {
    try {
      const response = await permissionService.createPermission(permissionData);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create permission";
      return rejectWithValue(errorMessage);
    }
  }
);

export const updatePermission = createAsyncThunk(
  "permission/updatePermission",
  async (
    { id, permissionData }: { id: string; permissionData: PermissionUpdate },
    { rejectWithValue }
  ) => {
    try {
      const response = await permissionService.updatePermission(
        id,
        permissionData
      );
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update permission";
      return rejectWithValue(errorMessage);
    }
  }
);

export const deletePermission = createAsyncThunk(
  "permission/deletePermission",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await permissionService.deletePermission(id);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete permission";
      return rejectWithValue(errorMessage);
    }
  }
);

const permissionSlice = createSlice({
  name: "permission",
  initialState,
  reducers: {
    clearCurrentPermission: (state) => {
      state.currentPermission = null;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch permissions
      .addCase(fetchPermissions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      // Action type is now correctly inferred as PaginatedPermissionResponse
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.isLoading = false;
        // Access data correctly based on PaginatedPermissionResponse type
        if (action.payload?.data) {
          state.permissions = action.payload.data.items || [];
          state.totalItems = action.payload.data.total || 0;
          state.page = action.payload.data.page || 1;
        }
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string; // Cast payload to string
      })

      // Fetch permission by id
      .addCase(fetchPermissionById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPermissionById.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.data) {
          state.currentPermission = action.payload.data;
        }
      })
      .addCase(fetchPermissionById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Create permission
      .addCase(createPermission.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPermission.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(createPermission.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Update permission
      .addCase(updatePermission.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePermission.fulfilled, (state, action) => {
        state.isLoading = false;
        if (
          state.currentPermission &&
          action.payload?.data?.id === state.currentPermission.id
        ) {
          state.currentPermission = action.payload.data;
        }
      })
      .addCase(updatePermission.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Delete permission
      .addCase(deletePermission.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deletePermission.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(deletePermission.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentPermission, setPage, setPageSize } =
  permissionSlice.actions;
export default permissionSlice.reducer;
