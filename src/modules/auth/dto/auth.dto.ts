/**
 * Auth DTOs
 * @module auth/dto
 * @description Data Transfer Objects for the auth module. Strips sensitive fields before sending to clients.
 */

import type { User } from '../types';
import type { LoginBodyInput, RegisterBodyInput } from '../validations';

export type RegisterDto = RegisterBodyInput;
export type LoginDto = LoginBodyInput;

export type AuthUserDto = Omit<User, 'passwordHash'>;

export const toAuthUserDto = ({ passwordHash: _passwordHash, ...user }: User): AuthUserDto => user;
