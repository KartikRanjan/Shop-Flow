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
    isActive: boolean;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    createdAt: Date;
    updatedAt: Date | null;
}

export const toUserDetailsDto = (user: User): UserDetailsDto => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    roles: user.roles,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
