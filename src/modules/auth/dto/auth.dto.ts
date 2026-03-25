/**
 * Auth DTOs
 * @module auth/dto
 * @description Data Transfer Objects for the auth module. Strips sensitive fields before sending to clients.
 */

import type { User, RefreshToken } from '../types';
import type { LoginBodyInput, RegisterBodyInput } from '../validations';

export type RegisterDto = RegisterBodyInput;
export type LoginDto = LoginBodyInput;

export interface AuthUserDto {
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

export const toAuthUserDto = (user: User): AuthUserDto => ({
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

export interface SessionDto {
    device: string | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
}

export const toSessionDto = (session: RefreshToken): SessionDto => ({
    device: session.device,
    ip: session.ip,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
});
