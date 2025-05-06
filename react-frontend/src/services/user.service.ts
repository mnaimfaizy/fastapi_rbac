import api from "./api";
import { User, ApiResponse, PaginatedItems } from "../models/user";

// Define specific types for create and update payloads
// to ensure role_id is included correctly
export interface UserCreatePayload
  extends Partial<Omit<User, "id" | "roles" | "created_at" | "updated_at">> {
  email: string;
  password?: string; // Password required on create
  role_id?: string[]; // Use role_id as expected by backend
}

export interface UserUpdatePayload
  extends Partial<Omit<User, "id" | "roles" | "created_at" | "updated_at">> {
  password?: string; // Add optional password field for updates
  role_id?: string[]; // Use role_id as expected by backend
}

export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

class UserService {
  /**
   * Get paginated list of users
   */
  async getUsers(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedItems<User>> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("size", limit.toString());
    if (search) {
      params.append("search", search);
    }

    const response = await api.get<ApiResponse<PaginatedItems<User>>>(
      `/user/list?${params.toString()}`
    );
    return response.data.data;
  }

  /**
   * Get a specific user by ID
   */
  async getUserById(userId: string): Promise<User> {
    const response = await api.get<ApiResponse<User>>(`/user/${userId}`);
    return response.data.data;
  }

  /**
   * Create a new user
   */
  async createUser(userData: UserCreatePayload): Promise<User> {
    try {
      // Ensure role_id is sent if present, even if empty array
      const payload = { ...userData };
      if (!payload.role_id) {
        payload.role_id = []; // Send empty array if not provided, adjust if backend prefers null/omission
      }
      const response = await api.post<ApiResponse<User>>("/user", payload);
      return response.data.data;
    } catch (error: any) {
      const apiError = error.response?.data as ApiError;
      throw new Error(
        apiError?.detail ||
          apiError?.message ||
          "Failed to create user. Please check the form and try again."
      );
    }
  }

  /**
   * Update an existing user
   */
  async updateUser(userId: string, userData: UserUpdatePayload): Promise<User> {
    try {
      // Ensure role_id is sent if present, even if empty array
      const payload = { ...userData };
      if (payload.password === "") {
        // Handle empty password string case
        delete payload.password;
      }
      // If role_id is part of the update, ensure it's included
      // If role_id is NOT part of the update payload, it won't be sent (correct for partial updates)
      const response = await api.put<ApiResponse<User>>(
        `/user/${userId}`,
        payload
      );
      return response.data.data;
    } catch (error: any) {
      const apiError = error.response?.data as ApiError;
      throw new Error(
        apiError?.detail ||
          apiError?.message ||
          "Failed to update user. Please check the form and try again."
      );
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await api.delete(`/user/${userId}`);
    } catch (error: any) {
      const apiError = error.response?.data as ApiError;
      throw new Error(
        apiError?.detail || apiError?.message || "Failed to delete user."
      );
    }
  }
}

export default new UserService();
