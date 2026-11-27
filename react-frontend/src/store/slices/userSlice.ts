import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../../models/user';
import userService, {
  UserCreatePayload,
  UserUpdatePayload,
} from '../../services/user.service';

export type UserStatusFilter = 'locked' | 'pending' | 'disabled';

// Define the initial state interface
interface UserState {
  users: User[];
  selectedUser: User | null;
  loading: boolean;
  error: string | null;
  // Status of the latest fetchUsers request, and of the request the rows came from.
  requestedStatus: UserStatusFilter | undefined;
  loadedStatus: UserStatusFilter | undefined;
  pagination: {
    total: number;
    page: number;
    size: number;
    pages: number;
    previousPage: number | null;
    nextPage: number | null;
  };
}

// Initial state
const initialState: UserState = {
  users: [],
  selectedUser: null,
  loading: false,
  error: null,
  requestedStatus: undefined,
  loadedStatus: undefined,
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
export const fetchUsers = createAsyncThunk(
  'user/fetchUsers',
  async (
    {
      page = 1,
      limit = 10,
      search,
      status,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      status?: UserStatusFilter;
    },
    { rejectWithValue }
  ) => {
    try {
      return await userService.getUsers(page, limit, search, status);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'user/fetchUserById',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await userService.getUserById(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createUser = createAsyncThunk(
  'user/createUser',
  async (userData: UserCreatePayload, { rejectWithValue }) => {
    try {
      const newUser = await userService.createUser(userData);
      return newUser;
    } catch (error: unknown) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue(
        'An unexpected error occurred while creating the user'
      );
    }
  }
);

export const updateUser = createAsyncThunk(
  'user/updateUser',
  async (
    { userId, userData }: { userId: string; userData: UserUpdatePayload },
    { rejectWithValue }
  ) => {
    try {
      const updatedUser = await userService.updateUser(userId, userData);
      return updatedUser;
    } catch (error: unknown) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue(
        'An unexpected error occurred while updating the user'
      );
    }
  }
);

export const deleteUser = createAsyncThunk(
  'user/deleteUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      await userService.deleteUser(userId);
      return userId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Create the user slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearSelectedUser: (state) => {
      state.selectedUser = null;
    },
    clearUserErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch users
      .addCase(fetchUsers.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.requestedStatus = action.meta.arg.status;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        // A newer request for another status is in flight: this answer is stale.
        if (action.meta.arg.status !== state.requestedStatus) return;
        state.loading = false;
        state.loadedStatus = action.meta.arg.status;
        // Handle undefined or null payload
        if (!action.payload || !action.payload.items) {
          state.users = [];
          state.pagination = {
            total: 0,
            page: 1,
            size: 10,
            pages: 0,
            previousPage: null,
            nextPage: null,
          };
          return;
        }

        // Ensure dates are properly formatted and handle nulls
        state.users = action.payload.items.map((user) => ({
          ...user,
          created_at: user.created_at ? String(user.created_at) : null,
          updated_at: user.updated_at ? String(user.updated_at) : null,
          last_changed_password_date: user.last_changed_password_date
            ? String(user.last_changed_password_date)
            : null,
          locked_until: user.locked_until ? String(user.locked_until) : null,
        })) as unknown as User[];
        state.pagination = {
          total: action.payload.total || 0,
          page: action.payload.page || 1,
          size: action.payload.size || 10,
          pages: action.payload.pages || 0,
          previousPage: action.payload.previous_page,
          nextPage: action.payload.next_page,
        };
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        if (action.meta.arg.status !== state.requestedStatus) return;
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch user by ID
      .addCase(fetchUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchUserById.fulfilled,
        (state, action: PayloadAction<User>) => {
          state.loading = false;
          state.selectedUser = action.payload;
        }
      )
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Create user
      .addCase(createUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.users.push(action.payload);
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Update user
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        const updatedUser = action.payload;
        state.users = state.users.map((user) =>
          user.id === updatedUser.id ? updatedUser : user
        );
        if (state.selectedUser?.id === updatedUser.id) {
          state.selectedUser = updatedUser;
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Delete user
      .addCase(deleteUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.users = state.users.filter((user) => user.id !== action.payload);
        if (state.selectedUser?.id === action.payload) {
          state.selectedUser = null;
        }
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearSelectedUser, clearUserErrors } = userSlice.actions;
export default userSlice.reducer;
