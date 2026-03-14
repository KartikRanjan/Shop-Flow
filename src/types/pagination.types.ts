/**
 * Shared Pagination Types
 * @module types/pagination.types
 * @description Cross-cutting pagination shapes used by any repository or service
 * that returns paginated results. Kept in src/types/ because they are not
 * owned by any single module.
 */

export interface PaginationOptions {
    page: number;
    limit: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}
