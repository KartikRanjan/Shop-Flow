/**
 * Common Repository Types
 * @module infrastructure/database/repositories
 */

/**
 * Interface for repositories that support generic transactions.
 * T should be the interface of the repository itself.
 */
export interface ITransactionalRepository<T> {
    transaction<R>(callback: (txRepo: T) => Promise<R>): Promise<R>;
}
