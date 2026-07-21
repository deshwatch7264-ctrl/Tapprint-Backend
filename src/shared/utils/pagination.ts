export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Normalizes raw query params into safe pagination values.
 */
export function resolvePagination(
  rawPage?: unknown,
  rawLimit?: unknown,
  maxLimit = 100,
): PaginationParams {
  const page = Math.max(1, Number.parseInt(String(rawPage ?? '1'), 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.parseInt(String(rawLimit ?? '20'), 10) || 20),
  );
  return { page, limit, skip: (page - 1) * limit };
}
