import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  Permission,
  PermissionCreate,
  PaginatedPermissionResponse,
} from '../../models/permission';
import permissionService from '../../services/permission.service';

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

export const fetchPermissions = createAsyncThunk<
  PaginatedPermissionResponse,
  { page?: number; pageSize?: number },
  { rejectValue: string }
>(
  'permission/fetchPermissions',
  async ({ page = 1, pageSize = 10 }, { rejectWithValue }) => {
    try {
      const response = await permissionService.getPermissions(page, pageSize);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch permissions';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchPermissionById = createAsyncThunk(
  'permission/fetchPermissionById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await permissionService.getPermissionById(id);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch permission';
      return rejectWithValue(errorMessage);
    }
  }
);

export const createPermission = createAsyncThunk(
  'permission/createPermission',
  async (permissionData: PermissionCreate, { rejectWithValue }) => {
    try {
      const response = await permissionService.createPermission(permissionData);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create permission';
      return rejectWithValue(errorMessage);
    }
  }
);

export const deletePermission = createAsyncThunk(
  'permission/deletePermission',
  async (id: string, { rejectWithValue }) => {
    try {
      return await permissionService.deletePermission(id);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete permission';
      return rejectWithValue(errorMessage);
    }
  }
);

const permissionSlice = createSlice({
  name: 'permission',
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
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.data) {
          state.permissions = action.payload.data.items || [];
          state.totalItems = action.payload.data.total || 0;
          state.page = action.payload.data.page || 1;
          state.pageSize = action.payload.data.size || 10;
        }
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
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
