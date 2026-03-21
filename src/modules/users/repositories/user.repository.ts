import type { Database } from '@infrastructure/database';
import { BaseRepository } from '@infrastructure/database/repositories/base.repository';
import type { IUserRepository, User } from '../types';
import { users } from '@infrastructure/database/schema';
import { count } from 'drizzle-orm';
import type { PaginatedResult, PaginationOptions } from '@types';
import { findUniqueNotDeleted, notDeleted } from '@infrastructure/database/utils/query-helpers.util';

export default class UserRepository extends BaseRepository implements IUserRepository {
    constructor(private readonly db: Database) {
        super();
    }

    async findById(id: string): Promise<User | null> {
        return this.execute({
            context: 'UserRepository.findById',
            operation: async () => {
                const user = await this.db.query.users.findFirst({
                    where: (t) => findUniqueNotDeleted(t, t.id, id),
                });
                return user ?? null;
            },
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.execute({
            context: 'UserRepository.findByEmail',
            operation: async () => {
                const user = await this.db.query.users.findFirst({
                    where: (t) => findUniqueNotDeleted(t, t.email, email),
                });
                return user ?? null;
            },
        });
    }

    async updateById(id: string, data: Partial<User>): Promise<User | null> {
        return this.execute({
            context: 'UserRepository.updateById',
            operation: async () => {
                const [updatedUser] = await this.db
                    .update(users)
                    .set(data)
                    .where(findUniqueNotDeleted(users, users.id, id))
                    .returning();

                return updatedUser ?? null;
            },
        });
    }

    /** Performs a soft delete by setting deletedAt timestamp */
    async deleteById(id: string): Promise<User | null> {
        return this.execute({
            context: 'UserRepository.deleteById',
            operation: async () => {
                const [deletedUser] = await this.db
                    .update(users)
                    .set(this.softDeletePayload())
                    .where(findUniqueNotDeleted(users, users.id, id))
                    .returning();

                return deletedUser ?? null;
            },
        });
    }

    async findMany({ page, limit }: PaginationOptions): Promise<PaginatedResult<User>> {
        return this.paginatedQuery({
            context: 'UserRepository.findMany',
            page,
            limit,
            queryFn: async (options) =>
                this.db.query.users.findMany({
                    where: (t) => notDeleted(t),
                    ...options,
                }),
            countFn: async () => {
                const [result] = await this.db.select({ total: count() }).from(users).where(notDeleted(users));
                return result?.total ?? 0;
            },
        });
    }
}
