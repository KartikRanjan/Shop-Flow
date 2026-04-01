/**
 * UserEntity
 * @module users/entities
 * @description Domain entity for the User aggregate. Encapsulates identity, state, and
 * business behavior so the service layer works with rich objects instead of plain data bags.
 *
 * The entity is constructed from a raw database row (InferSelectModel) via the static
 * `fromPersistence` factory. Repositories are responsible for mapping rows → entities;
 * the service layer never touches raw DB types directly.
 */

import type { InferSelectModel } from 'drizzle-orm';
import type { users } from '@infrastructure/database/schema';
import { ACCOUNT_STATUS } from '@constants';

/** Raw database row type — used only for constructing an entity from persistence. */
export type UserRow = InferSelectModel<typeof users>;

export class UserEntity {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly phoneNumber: string | null;
    readonly passwordHash: string;
    readonly roles: UserRow['roles'];
    readonly accountStatus: UserRow['accountStatus'];
    readonly statusUpdatedAt: Date;
    readonly statusReason: string | null;
    readonly emailVerifiedAt: Date | null;
    readonly emailVerificationToken: string | null;
    readonly emailVerificationTokenExpiresAt: Date | null;
    readonly passwordResetToken: string | null;
    readonly passwordResetTokenExpiresAt: Date | null;
    readonly phoneVerifiedAt: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date | null;
    readonly deletedAt: Date | null;

    private constructor(row: UserRow) {
        this.id = row.id;
        this.name = row.name;
        this.email = row.email;
        this.phoneNumber = row.phoneNumber;
        this.passwordHash = row.passwordHash;
        this.roles = row.roles;
        this.accountStatus = row.accountStatus;
        this.statusUpdatedAt = row.statusUpdatedAt;
        this.statusReason = row.statusReason;
        this.emailVerifiedAt = row.emailVerifiedAt;
        this.emailVerificationToken = row.emailVerificationToken;
        this.emailVerificationTokenExpiresAt = row.emailVerificationTokenExpiresAt;
        this.passwordResetToken = row.passwordResetToken;
        this.passwordResetTokenExpiresAt = row.passwordResetTokenExpiresAt;
        this.phoneVerifiedAt = row.phoneVerifiedAt;
        this.createdAt = row.createdAt;
        this.updatedAt = row.updatedAt;
        this.deletedAt = row.deletedAt;
    }

    // ── Factory ────────────────────────────────────────────────────────────────

    /** Creates a UserEntity from a raw database row returned by Drizzle. */
    static fromPersistence(row: UserRow): UserEntity {
        return new UserEntity(row);
    }

    // ── Identity & Status Predicates ───────────────────────────────────────────

    /** Returns true when the account is active and can perform authenticated actions. */
    isActive(): boolean {
        return this.accountStatus === ACCOUNT_STATUS.ACTIVE;
    }

    /** Returns true when the account is awaiting email verification. */
    isPendingVerification(): boolean {
        return this.accountStatus === ACCOUNT_STATUS.PENDING_VERIFICATION;
    }

    /** Returns true when the account has been suspended by an admin. */
    isSuspended(): boolean {
        return this.accountStatus === ACCOUNT_STATUS.SUSPENDED;
    }

    /** Returns true when the account has been permanently banned. */
    isBanned(): boolean {
        return this.accountStatus === ACCOUNT_STATUS.BANNED;
    }

    /** Returns true when the user has confirmed their email address. */
    isEmailVerified(): boolean {
        return this.emailVerifiedAt !== null;
    }

    /** Returns true when the user has confirmed their phone number. */
    isPhoneVerified(): boolean {
        return this.phoneVerifiedAt !== null;
    }

    // ── Email Verification Token Logic ─────────────────────────────────────────

    /**
     * Returns the existing verification token if it is still valid (not expired),
     * or null if a new token needs to be generated and persisted.
     */
    getReusableVerificationToken(): { token: string; expiresAt: Date } | null {
        if (!this.emailVerificationToken || !this.emailVerificationTokenExpiresAt) {
            return null;
        }

        if (this.emailVerificationTokenExpiresAt <= new Date()) {
            return null;
        }

        return {
            token: this.emailVerificationToken,
            expiresAt: this.emailVerificationTokenExpiresAt,
        };
    }

    // ── Password Reset Token Logic ─────────────────────────────────────────────

    /**
     * Returns the existing reset token if it is still valid (not expired),
     * or null if a new token needs to be generated and persisted.
     */
    getReusableResetToken(): { token: string; expiresAt: Date } | null {
        if (!this.passwordResetToken || !this.passwordResetTokenExpiresAt) {
            return null;
        }

        if (this.passwordResetTokenExpiresAt <= new Date()) {
            return null;
        }

        return {
            token: this.passwordResetToken,
            expiresAt: this.passwordResetTokenExpiresAt,
        };
    }

    // ── Serialisation ──────────────────────────────────────────────────────────

    /** Returns the plain row representation — useful when passing to infrastructure layers. */
    toPersistence(): UserRow {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            phoneNumber: this.phoneNumber,
            passwordHash: this.passwordHash,
            roles: this.roles,
            accountStatus: this.accountStatus,
            statusUpdatedAt: this.statusUpdatedAt,
            statusReason: this.statusReason,
            emailVerifiedAt: this.emailVerifiedAt,
            emailVerificationToken: this.emailVerificationToken,
            emailVerificationTokenExpiresAt: this.emailVerificationTokenExpiresAt,
            passwordResetToken: this.passwordResetToken,
            passwordResetTokenExpiresAt: this.passwordResetTokenExpiresAt,
            phoneVerifiedAt: this.phoneVerifiedAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            deletedAt: this.deletedAt,
        };
    }
}
