import { logger } from '../../logger';
import type { PaginatedResult } from '../../../types/pagination.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../constants';

/**
 * Base Repository Class
 * @description Base repository class that provides common database operations.
 * All repositories should extend this class to ensure consistent behavior.
 */

export class BaseRepository {
    protected logger = logger;

    protected now(): Date {
        return new Date();
    }

    protected sanitize<T extends object>(data: T): Partial<T> {
        return Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined),
        ) as Partial<T>;
    }

    protected buildPagination(
        page: number = DEFAULT_PAGE,
        limit: number = DEFAULT_PAGE_SIZE,
    ): { limit: number; offset: number } {
        const safePage = Math.max(1, page);
        const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, limit));

        return {
            limit: safeLimit,
            offset: (safePage - 1) * safeLimit,
        };
    }

    protected softDeletePayload(): { deletedAt: Date } {
        return { deletedAt: this.now() };
    }

    protected buildPaginatedResponse<T>(
        data: T[],
        total: number,
        page: number,
        limit: number,
    ): PaginatedResult<T> {
        const safeLimit = Math.max(1, limit);

        return {
            data,
            total,
            page: Math.max(1, page),
            totalPages: safeLimit > 0 ? Math.ceil(total / safeLimit) : 0,
        };
    }
}
