/**
 * User DTOs
 * @module user/dto
 * @description Data Transfer Objects for the users module. Provides two shapes:
 *
 * - `UserProfileDto`  – safe for any authenticated user (self-service endpoints).
 *                       Excludes internal moderation fields such as `statusReason`
 *                       and `statusUpdatedAt`.
 *
 * - `UserDetailsDto`  – full admin view that includes all moderation metadata.
 *                       Only returned on admin-only routes.
 */

import type { UserEntity } from '../entities';

// ── Self-service profile shape ─────────────────────────────────────────────────

export interface UserProfileDto {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    roles: string[];
    accountStatus: UserEntity['accountStatus'];
    emailVerifiedAt: Date | null;
    phoneVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date | null;
}

export const toUserProfileDto = (user: UserEntity): UserProfileDto => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    roles: user.roles,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

// ── Admin details shape ────────────────────────────────────────────────────────

export interface UserDetailsDto extends UserProfileDto {
    statusUpdatedAt: Date;
    statusReason: string | null;
}

export const toUserDetailsDto = (user: UserEntity): UserDetailsDto => ({
    ...toUserProfileDto(user),
    statusUpdatedAt: user.statusUpdatedAt,
    statusReason: user.statusReason,
});
