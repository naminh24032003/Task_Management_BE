export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface CursorPaginationInput {
  cursor?: string;
  limit: number;
}

export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

/**
 * Ensures the limit is within valid bounds
 */
export function normalizeLimit(limit: number): number {
  if (limit <= 0) return DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) return MAX_LIMIT;
  return limit;
}
