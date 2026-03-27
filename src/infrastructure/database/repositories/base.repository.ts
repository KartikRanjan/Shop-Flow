/**
 * BaseRepository
 * @module infrastructure/database/repositories
 * @description Abstract base class providing common database helpers — pagination, soft-delete, sanitization.
 * All feature repositories should extend this class.
 */

import { logger } from '@infrastructure/logger';
import type { PaginatedResult } from '@types';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@constants';
import { DatabaseError } from '@errors';
import type { Database } from '../index';

export abstract class BaseRepository {
    protected logger = logger;

    constructor(protected readonly db: Database) {}

    /**
     * Creates a new instance of the repository with a specific database/transaction client.
     * Must be implemented by child classes to support the generic transaction method.
     */
    protected abstract createInstance(db: Database): this;

    /**
     * Executes a callback within a database transaction, wrapping the transaction
     * in a new repository instance to maintain type safety and interface consistency.
     */
    async transaction<T>(callback: (txRepo: this) => Promise<T>): Promise<T> {
        return this.db.transaction(async (tx) => {
            const txRepo = this.createInstance(tx as unknown as Database);
            return callback(txRepo);
        });
    }

    protected async execute<T>(params: { operation: () => Promise<T>; context?: string }): Promise<T> {
        const { operation, context } = params;
        try {
            return await operation();
        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }

            this.logger.error({ err: error, context }, 'Database operation failed');
            const message = error instanceof Error ? error.message : 'Unknown database error';
            throw new DatabaseError(context ? `[${context}] ${message}` : message, error);
        }
    }

    protected now(): Date {
        return new Date();
    }

    protected sanitize<T extends object>(data: T): Partial<T> {
        return Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined)) as Partial<T>;
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

    protected buildPaginatedResponse<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
        const safeLimit = Math.max(1, limit);

        return {
            data,
            total,
            page: Math.max(1, page),
            totalPages: safeLimit > 0 ? Math.ceil(total / safeLimit) : 0,
        };
    }

    /**
     * Executes a paginated database query.
     */
    protected async paginatedQuery<T>(params: {
        context: string;
        page?: number;
        limit?: number;
        queryFn: (options: { limit: number; offset: number }) => Promise<T[]>;
        countFn: () => Promise<number>;
    }): Promise<PaginatedResult<T>> {
        const { context, page = DEFAULT_PAGE, limit = DEFAULT_PAGE_SIZE, queryFn, countFn } = params;

        return this.execute({
            context,
            operation: async () => {
                const { limit: safeLimit, offset } = this.buildPagination(page, limit);
                const [data, total] = await Promise.all([queryFn({ limit: safeLimit, offset }), countFn()]);
                return this.buildPaginatedResponse(data, total, page, limit);
            },
        });
    }
}
