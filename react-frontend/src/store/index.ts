import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import permissionReducer from './slices/permissionSlice';
import permissionGroupReducer from './slices/permissionGroupSlice';
import roleReducer from './slices/roleSlice';
import roleGroupReducer from './slices/roleGroupSlice'; // Import the new role group reducer
import dashboardReducer from './slices/dashboardSlice'; // Import the new dashboard reducer

// Configure the Redux store
export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    permission: permissionReducer,
    permissionGroup: permissionGroupReducer,
    role: roleReducer,
    roleGroup: roleGroupReducer, // Add the role group reducer
    dashboard: dashboardReducer, // Add the dashboard reducer
    // Add other reducers here as needed
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization checks
        ignoredActions: ['auth/login/fulfilled', 'auth/refreshToken/fulfilled'],
        // Ignore these field paths in state for serialization checks
        ignoredPaths: ['auth.user'],
      },
    }),
});

// Define RootState and AppDispatch types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
