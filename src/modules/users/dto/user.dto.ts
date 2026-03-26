/**
 * User DTOs
 * @module user/dto
 * @description Data Transfer Objects for the auth module. Strips sensitive fields before sending to clients.
 */

import type { User } from '../types';

export interface UserDetailsDto {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    roles: string[];
    accountStatus: User['accountStatus'];
    statusUpdatedAt: Date;
    statusReason: string | null;
    emailVerifiedAt: Date | null;
    phoneVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date | null;
}

export const toUserDetailsDto = (user: User): UserDetailsDto => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    roles: user.roles,
    accountStatus: user.accountStatus,
    statusUpdatedAt: user.statusUpdatedAt,
    statusReason: user.statusReason,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
