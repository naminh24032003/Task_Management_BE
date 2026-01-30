/**
 * Repository Types
 * Interfaces for repository query filters and pagination
 */

export interface UserFilter {
  userId?: string;
  email?: string;
  status?: string;
  isEmailVerified?: boolean;
  deletedAt?: Date | null;
}

export interface UserPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
