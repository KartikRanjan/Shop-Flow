import type { SQL, SQLWrapper } from 'drizzle-orm';
import { isNull, and, eq } from 'drizzle-orm';

/**
 * Interface for tables that support soft-delete.
 */
export interface SoftDeletableTable {
    deletedAt: SQLWrapper;
}

/**
 * Filter for records that are not soft-deleted.
 * @param table The table or columns object to apply the filter on.
 * @returns SQL expression for `deletedAt IS NULL`.
 */
export const notDeleted = (table: SoftDeletableTable): SQL => {
    return isNull(table.deletedAt);
};

/**
 * Combines multiple conditions with AND, filtering out null/undefined.
 * @param conditions Array of conditions.
 * @returns Combined SQL condition or undefined if no conditions.
 */
export const andExists = (...conditions: (SQL | undefined | null)[]): SQL | undefined => {
    const filtered = conditions.filter((c): c is SQL => !!c);
    if (filtered.length === 0) return undefined;
    if (filtered.length === 1) return filtered[0];
    return and(...filtered);
};

/**
 * Helper to build a standard 'where' clause for a unique field lookup with soft-delete check.
 * @param table The table to query.
 * @param column The column to match.
 * @param value The value to match.
 * @returns Combined SQL condition.
 */
export const findUniqueNotDeleted = (table: SoftDeletableTable, column: SQLWrapper, value: unknown): SQL => {
    const condition = and(eq(column, value), notDeleted(table));
    if (!condition) {
        throw new Error('Failed to create condition for findUniqueNotDeleted');
    }
    return condition;
};
