export interface PaginationParams {
  page?: number;
  size?: number;
}

export interface PaginatedResponse<T> {
  items: Array<T>;
  total: number;
  page: number;
  size: number;
  pages: number;
  next_page: number | null;
  previous_page: number | null;
}

// For API responses that return paginated data
export interface PaginatedDataResponse<T> {
  data: PaginatedResponse<T>;
  message: string;
  meta: Record<string, unknown>;
}
