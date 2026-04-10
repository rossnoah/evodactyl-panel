/**
 * Pagination metadata for JSON:API responses.
 * Matches the format produced by League Fractal's IlluminatePaginatorAdapter.
 */

export interface PaginationMeta {
  pagination: {
    total: number;
    count: number;
    per_page: number;
    current_page: number;
    total_pages: number;
    links: Record<string, string | undefined>;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

/**
 * Build pagination metadata from a paginated result.
 */
export function buildPaginationMeta(
  total: number,
  count: number,
  perPage: number,
  currentPage: number,
  baseUrl?: string
): PaginationMeta {
  const totalPages = Math.ceil(total / perPage);
  const links: Record<string, string | undefined> = {};

  if (baseUrl) {
    if (currentPage > 1) {
      links.previous = `${baseUrl}?page=${currentPage - 1}`;
    }
    if (currentPage < totalPages) {
      links.next = `${baseUrl}?page=${currentPage + 1}`;
    }
  }

  return {
    pagination: {
      total,
      count,
      per_page: perPage,
      current_page: currentPage,
      total_pages: totalPages,
      links,
    },
  };
}
