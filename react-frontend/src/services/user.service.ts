import api from "./api";
import { User, ApiResponse, PaginatedItems } from "../models/user";

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
  async createUser(userData: Partial<User>): Promise<User> {
    const response = await api.post<ApiResponse<User>>("/user", userData);
    return response.data.data;
  }

  /**
   * Update an existing user
   */
  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    const response = await api.put<ApiResponse<User>>(
      `/user/${userId}`,
      userData
    );
    return response.data.data;
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/user/${userId}`);
  }
}

export default new UserService();
