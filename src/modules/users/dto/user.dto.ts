/**
 * User DTOs
 * @module user/dto
 * @description Data Transfer Objects for the auth module. Strips sensitive fields before sending to clients.
 */

import type { User } from '../types';

export type UserDetailsDto = Omit<User, 'passwordHash'>;

export const toUserDetailsDto = ({ passwordHash: _passwordHash, ...user }: User): UserDetailsDto => user;
