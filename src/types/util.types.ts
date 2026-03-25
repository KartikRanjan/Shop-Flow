/**
 * Utils  Types
 * @module util.types
 * This file contains utility types that are used across the application. These types are not specific to any module and can be imported wherever needed.
 */

export type AccessTokenPayload = {
    sub: string;
    sid: string; // Session ID to link access token with refresh token
    type: 'access'; // Token type discriminator — injected by generateAccessToken; prevents refresh token misuse
    email: string; // Metadata only — NOT used for authorization
    roles: string[]; // Metadata only — NOT used for authorization
};

/** Input type for generateAccessToken — callers must not set `type`; the util injects it */
export type AccessTokenInput = Omit<AccessTokenPayload, 'type'>;

export type RefreshTokenPayload = {
    sub: string;
    jti: string;
    type: 'refresh'; // Token type discriminator — injected by generateRefreshToken; prevents access token misuse
};

/** Input type for generateRefreshToken — callers must not set `type`; the util injects it */
export type RefreshTokenInput = Omit<RefreshTokenPayload, 'type'>;
