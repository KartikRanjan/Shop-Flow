import type { Database } from '@infrastructure/database';
import { BaseRepository } from '@infrastructure/database/repositories/base.repository';
import type { IUserRepository, UserRow } from '../types';
import { UserEntity } from '../entities';
import { users } from '@infrastructure/database/schema';
import { count } from 'drizzle-orm';
import type { PaginatedResult, PaginationOptions } from '@types';
import { findUniqueNotDeleted, notDeleted } from '@infrastructure/database/utils/query-helpers.util';

export default class UserRepository extends BaseRepository implements IUserRepository {
    constructor(db: Database) {
        super(db);
    }

    protected createInstance(db: Database): this {
        return new UserRepository(db) as this;
    }

    async findById(id: string): Promise<UserEntity | null> {
        return this.execute({
            context: 'UserRepository.findById',
            operation: async () => {
                const row = await this.db.query.users.findFirst({
                    where: (t) => findUniqueNotDeleted(t, t.id, id),
                });
                return row ? UserEntity.fromPersistence(row) : null;
            },
        });
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.execute({
            context: 'UserRepository.findByEmail',
            operation: async () => {
                const row = await this.db.query.users.findFirst({
                    where: (t) => findUniqueNotDeleted(t, t.email, email),
                });
                return row ? UserEntity.fromPersistence(row) : null;
            },
        });
    }

    async updateById(id: string, data: Partial<UserRow>): Promise<UserEntity | null> {
        return this.execute({
            context: 'UserRepository.updateById',
            operation: async () => {
                const [row] = await this.db
                    .update(users)
                    .set(data)
                    .where(findUniqueNotDeleted(users, users.id, id))
                    .returning();

                return row ? UserEntity.fromPersistence(row) : null;
            },
        });
    }

    /** Performs a soft delete by setting deletedAt timestamp */
    async deleteById(id: string): Promise<UserEntity | null> {
        return this.execute({
            context: 'UserRepository.deleteById',
            operation: async () => {
                const [row] = await this.db
                    .update(users)
                    .set(this.softDeletePayload())
                    .where(findUniqueNotDeleted(users, users.id, id))
                    .returning();

                return row ? UserEntity.fromPersistence(row) : null;
            },
        });
    }

    async findMany({ page, limit }: PaginationOptions): Promise<PaginatedResult<UserEntity>> {
        return this.paginatedQuery({
            context: 'UserRepository.findMany',
            page,
            limit,
            queryFn: async (options) => {
                const rows = await this.db.query.users.findMany({
                    where: (t) => notDeleted(t),
                    ...options,
                });
                return rows.map((row) => UserEntity.fromPersistence(row));
            },
            countFn: async () => {
                const [result] = await this.db.select({ total: count() }).from(users).where(notDeleted(users));
                return result?.total ?? 0;
            },
        });
    }
}
