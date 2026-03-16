/**
 * Utils  Types
 * @module util.types
 * This file contains utility types that are used across the application. These types are not specific to any module and can be imported wherever needed.
 */

export type AccessTokenPayload = {
    sub: string;
    email: string;
    roles: string[];
    sid: string; // Session ID to link access token with refresh token
};

export type RefreshTokenPayload = {
    sub: string;
    jti: string;
};
