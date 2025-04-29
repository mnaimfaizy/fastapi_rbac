// Remove unused AxiosResponse
import axios, { AxiosError } from "axios";
import {
  getStoredRefreshToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from "../lib/tokenStorage";
import { store } from "../store";
import { refreshAccessToken, logout } from "../store/slices/authSlice";

// Define error response interface to match backend format
// Export ErrorDetail
export interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

// Define the structure for the data part of an error response
// Use unknown for potentially unstructured data
interface ErrorResponseData {
  status?: string;
  message?: string;
  errors?: ErrorDetail[];
  detail?: unknown; // Handle legacy detail field
  [key: string]: unknown; // Allow other properties
}

// Add SuccessResponse interface and export it
export interface SuccessResponse<T> {
  status: string; // e.g., "success"
  message: string;
  data: T;
  // Replace any with unknown
  meta?: Record<string, unknown>;
}

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token refresh and error normalization
api.interceptors.response.use(
  (response) => response,
  // Explicitly type the error as AxiosError with potentially our custom data structure
  async (error: AxiosError<ErrorResponseData>) => {
    // Use optional chaining and type assertion for config
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };

    // Transform error response to our standardized format
    // Check if response and data exist
    if (error.response?.data) {
      // Type assertion for error.response.data
      const responseData = error.response.data as ErrorResponseData;

      // Check if it already follows our standardized format
      if (responseData.status === "error" && responseData.message) {
        // Keep the error as is
      }
      // Handle legacy error format (check if detail exists)
      else if (responseData.detail) {
        const detail = responseData.detail;
        // Use const for message
        const message =
          typeof detail === "string" ? detail : "An error occurred";
        // Use const for errorDetails
        const errorDetails: ErrorDetail[] = [];

        // Handle detailed field error format (check if detail is object)
        if (
          typeof detail === "object" &&
          detail !== null &&
          "field_name" in detail &&
          "message" in detail
        ) {
          errorDetails.push({
            // Assert types for field_name and message if necessary, or handle potential non-string types
            field: String(detail.field_name),
            message: String(detail.message),
          });
        }

        // Overwrite responseData structure
        error.response.data = {
          status: "error",
          message,
          errors: errorDetails,
        };
      } else {
        // If it's not in a known format, wrap it
        error.response.data = {
          status: "error",
          message: "An unexpected error occurred.",
          errors: [],
          detail: responseData, // Keep original data under detail
        };
      }
    }

    // If the error is 401 and we haven't attempted to refresh the token yet
    // Use optional chaining for originalRequest
    if (error.response?.status === 401 && !originalRequest?._retry) {
      // Ensure originalRequest exists before modifying
      if (originalRequest) {
        originalRequest._retry = true;
      }

      try {
        const refreshToken = getStoredRefreshToken();

        if (!refreshToken) {
          store.dispatch(logout());
          return Promise.reject(error);
        }

        // Attempt to refresh the token
        // Assuming refreshAccessToken returns { access_token: string }
        const response = await store
          .dispatch(refreshAccessToken(refreshToken))
          .unwrap();
        setStoredAccessToken(response.access_token);

        // Retry the original request with the new token
        // Ensure originalRequest and headers exist
        if (originalRequest?.headers) {
          originalRequest.headers.Authorization = `Bearer ${response.access_token}`;
          return api(originalRequest);
        } else {
          // Cannot retry if original request or headers are missing
          store.dispatch(logout());
          return Promise.reject(error);
        }
      } catch (refreshError) {
        // Log or handle the refreshError
        console.error("Token refresh failed:", refreshError);
        store.dispatch(logout());
        // Reject with the original error after logout
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
