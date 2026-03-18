import type { Database } from '@infrastructure/database';
import { BaseRepository } from '@infrastructure/database/repositories/base.repository';
import type { IUserRepository, User } from '../types';
import { users } from '@infrastructure/database/schema';
import { and, eq, isNull, count } from 'drizzle-orm';
import type { PaginatedResult, PaginationOptions } from '@types';

export default class UserRepository extends BaseRepository implements IUserRepository {
    constructor(private readonly db: Database) {
        super();
    }

    async findById(id: string): Promise<User | null> {
        const user = await this.db.query.users.findFirst({
            where: (users, { eq, and, isNull }) => and(eq(users.id, id), isNull(users.deletedAt)),
        });
        return user ?? null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const user = await this.db.query.users.findFirst({
            where: (users, { eq, and, isNull }) => and(eq(users.email, email), isNull(users.deletedAt)),
        });
        return user ?? null;
    }

    async updateById(id: string, data: Partial<User>): Promise<User> {
        const updatedUser = await this.db
            .update(users)
            .set(data)
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .returning();

        return updatedUser[0] ?? null;
    }

    /** Performs a soft delete by setting deletedAt timestamp */
    async deleteById(id: string): Promise<void> {
        await this.db
            .update(users)
            .set(this.softDeletePayload())
            .where(and(eq(users.id, id), isNull(users.deletedAt)));
    }

    async findMany({ page, limit }: PaginationOptions): Promise<PaginatedResult<User>> {
        const { limit: safeLimit, offset } = this.buildPagination(page, limit);

        const [data, [{ total }]] = await Promise.all([
            this.db.query.users.findMany({
                where: (users, { isNull }) => isNull(users.deletedAt),
                limit: safeLimit,
                offset,
            }),
            this.db.select({ total: count() }).from(users).where(isNull(users.deletedAt)),
        ]);

        return this.buildPaginatedResponse(data, total, page, limit);
    }
}
