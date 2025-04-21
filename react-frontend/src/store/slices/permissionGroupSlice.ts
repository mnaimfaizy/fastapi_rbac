import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  PermissionGroup,
  PermissionGroupCreate,
  PermissionGroupUpdate,
} from "../../models/permission";
import permissionService from "../../services/permission.service";

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
export const fetchPermissionGroups = createAsyncThunk(
  "permissionGroup/fetchPermissionGroups",
  async (
    { page = 1, pageSize = 10 }: { page?: number; pageSize?: number },
    { rejectWithValue }
  ) => {
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
          : "Failed to fetch permission groups";
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchPermissionGroupById = createAsyncThunk(
  "permissionGroup/fetchPermissionGroupById",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await permissionService.getPermissionGroupById(id);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to fetch permission group";
      return rejectWithValue(errorMessage);
    }
  }
);

export const createPermissionGroup = createAsyncThunk(
  "permissionGroup/createPermissionGroup",
  async (groupData: PermissionGroupCreate, { rejectWithValue }) => {
    try {
      const response = await permissionService.createPermissionGroup(groupData);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create permission group";
      return rejectWithValue(errorMessage);
    }
  }
);

export const updatePermissionGroup = createAsyncThunk(
  "permissionGroup/updatePermissionGroup",
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
          : "Failed to update permission group";
      return rejectWithValue(errorMessage);
    }
  }
);

export const deletePermissionGroup = createAsyncThunk(
  "permissionGroup/deletePermissionGroup",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await permissionService.deletePermissionGroup(id);
      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to delete permission group";
      return rejectWithValue(errorMessage);
    }
  }
);

const permissionGroupSlice = createSlice({
  name: "permissionGroup",
  initialState,
  reducers: {
    clearCurrentPermissionGroup: (state) => {
      state.currentPermissionGroup = null;
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
        // Fix property access with optional chaining and fallbacks
        if (action.payload?.data?.data) {
          state.permissionGroups = action.payload.data.data.items || [];
          state.totalItems = action.payload.data.data.total || 0;
          state.page = action.payload.data.data.page || 1;
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
        if (action.payload?.data) {
          state.currentPermissionGroup = action.payload.data;
        }
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
      .addCase(createPermissionGroup.fulfilled, (state) => {
        state.isLoading = false;
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
      })
      .addCase(deletePermissionGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentPermissionGroup, setPage, setPageSize } =
  permissionGroupSlice.actions;
export default permissionGroupSlice.reducer;
