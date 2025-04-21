import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";

// Configure the Redux store
export const store = configureStore({
  reducer: {
    auth: authReducer,
    // Add other reducers here as needed
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization checks
        ignoredActions: ["auth/login/fulfilled", "auth/refreshToken/fulfilled"],
        // Ignore these field paths in state for serialization checks
        ignoredPaths: ["auth.user"],
      },
    }),
});

// Define RootState and AppDispatch types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
