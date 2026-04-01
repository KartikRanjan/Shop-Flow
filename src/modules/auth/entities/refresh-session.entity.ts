/**
 * RefreshSessionEntity
 * @module auth/entities
 * @description Domain entity for the RefreshSession aggregate.
 */

import type { InferSelectModel } from 'drizzle-orm';
import type { refreshSessions } from '@infrastructure/database/schema';

/** Raw database row type — used only for constructing an entity from persistence. */
export type RefreshSessionRow = InferSelectModel<typeof refreshSessions>;

export class RefreshSessionEntity {
    readonly id: string;
    readonly userId: string;
    readonly expiresAt: Date;
    readonly revokedAt: Date | null;
    readonly device: string | null;
    readonly ip: string | null;
    readonly userAgent: string | null;
    readonly createdAt: Date;

    private constructor(row: RefreshSessionRow) {
        this.id = row.id;
        this.userId = row.userId;
        this.expiresAt = row.expiresAt;
        this.revokedAt = row.revokedAt;
        this.device = row.device;
        this.ip = row.ip;
        this.userAgent = row.userAgent;
        this.createdAt = row.createdAt;
    }

    // ── Factory ────────────────────────────────────────────────────────────────

    /** Creates a RefreshSessionEntity from a raw database row returned by Drizzle. */
    static fromPersistence(row: RefreshSessionRow): RefreshSessionEntity {
        return new RefreshSessionEntity(row);
    }

    // ── Domain Logic ──────────────────────────────────────────────────────────

    /** Returns true when the session has expired or has been manually revoked. */
    isInvalid(): boolean {
        return this.isExpired() || this.isRevoked();
    }

    /** Returns true when the session has passed its expiration date. */
    isExpired(): boolean {
        return this.expiresAt <= new Date();
    }

    /** Returns true when the session has a revocation timestamp. */
    isRevoked(): boolean {
        return this.revokedAt !== null;
    }

    /** Returns true when the session belongs to the specified user. */
    belongsTo(userId: string): boolean {
        return this.userId === userId;
    }

    // ── Serialisation ──────────────────────────────────────────────────────────

    /** Returns the plain row representation — useful when passing to infrastructure layers. */
    toPersistence(): RefreshSessionRow {
        return {
            id: this.id,
            userId: this.userId,
            expiresAt: this.expiresAt,
            revokedAt: this.revokedAt,
            device: this.device,
            ip: this.ip,
            userAgent: this.userAgent,
            createdAt: this.createdAt,
        };
    }
}
