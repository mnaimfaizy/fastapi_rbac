import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  PaginatedPermissionGroupResponse,
  PermissionGroup,
  PermissionGroupCreate,
  PermissionGroupUpdate,
} from '../../models/permission';
import permissionService from '../../services/permission.service';

interface PermissionGroupState {
  permissionGroups: PermissionGroup[];
  currentPermissionGroup: PermissionGroup | null;
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  page: number;
  pageSize: number;
}

const initialState: PermissionGroupState = {
  permissionGroups: [],
  currentPermissionGroup: null,
  isLoading: false,
  error: null,
  totalItems: 0,
  page: 1,
  pageSize: 10,
};

// Async thunks
export const fetchPermissionGroups = createAsyncThunk<
  PaginatedPermissionGroupResponse, // Return type on success
  { page?: number; pageSize?: number }, // Argument type
  { rejectValue: string } // Type for rejectWithValue
>(
  'permissionGroup/fetchPermissionGroups',
  async ({ page = 1, pageSize = 10 }, { rejectWithValue }) => {
    try {
      const response = await permissionService.getPermissionGroups(
        page,
        pageSize
      );
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch permission groups';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchPermissionGroupById = createAsyncThunk(
  'permissionGroup/fetchPermissionGroupById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await permissionService.getPermissionGroupById(id);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch permission group';
      return rejectWithValue(errorMessage);
    }
  }
);

export const createPermissionGroup = createAsyncThunk(
  'permissionGroup/createPermissionGroup',
  async (groupData: PermissionGroupCreate, { rejectWithValue }) => {
    try {
      const response = await permissionService.createPermissionGroup(groupData);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to create permission group';
      return rejectWithValue(errorMessage);
    }
  }
);

export const updatePermissionGroup = createAsyncThunk(
  'permissionGroup/updatePermissionGroup',
  async (
    { id, groupData }: { id: string; groupData: PermissionGroupUpdate },
    { rejectWithValue }
  ) => {
    try {
      const response = await permissionService.updatePermissionGroup(
        id,
        groupData
      );
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update permission group';
      return rejectWithValue(errorMessage);
    }
  }
);

export const deletePermissionGroup = createAsyncThunk(
  'permissionGroup/deletePermissionGroup',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await permissionService.deletePermissionGroup(id);
      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to delete permission group');
    }
  }
);

const permissionGroupSlice = createSlice({
  name: 'permissionGroup',
  initialState,
  reducers: {
    clearCurrentPermissionGroup: (state) => {
      state.currentPermissionGroup = null;
    },
    clearPermissionGroupErrors: (state) => {
      state.error = null;
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
      // Fetch permission groups
      .addCase(fetchPermissionGroups.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPermissionGroups.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.data) {
          state.permissionGroups = action.payload.data.items;
          state.totalItems = action.payload.data.total || 0;
          state.page = action.payload.data.page || 1;
          state.pageSize = action.payload.data.size || 10;
        }
      })
      .addCase(fetchPermissionGroups.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Fetch permission group by id
      .addCase(fetchPermissionGroupById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPermissionGroupById.fulfilled, (state, action) => {
        state.isLoading = false;
        // Handle both direct response and nested data structure
        state.currentPermissionGroup = action.payload?.data || action.payload;
      })
      .addCase(fetchPermissionGroupById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Create permission group
      .addCase(createPermissionGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPermissionGroup.fulfilled, (state, action) => {
        state.isLoading = false;
        // Add the newly created permission group to the state
        if (action.payload?.data) {
          // Add the new group to the existing array
          state.permissionGroups = [
            ...state.permissionGroups,
            action.payload.data,
          ];
          // Update the total count
          state.totalItems = state.totalItems + 1;
          // Set as current group
          state.currentPermissionGroup = action.payload.data;
        }
      })
      .addCase(createPermissionGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Update permission group
      .addCase(updatePermissionGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePermissionGroup.fulfilled, (state, action) => {
        state.isLoading = false;
        if (
          state.currentPermissionGroup &&
          action.payload?.data?.id === state.currentPermissionGroup.id
        ) {
          state.currentPermissionGroup = action.payload.data;
        }
      })
      .addCase(updatePermissionGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Delete permission group
      .addCase(deletePermissionGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deletePermissionGroup.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(deletePermissionGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearCurrentPermissionGroup,
  clearPermissionGroupErrors,
  setPage,
  setPageSize,
} = permissionGroupSlice.actions;
export default permissionGroupSlice.reducer;
