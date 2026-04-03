/**
 * Auth Validation Schemas
 * @module auth/validations
 * @description Zod schemas for validating authentication-related request data.
 * Follows the "Schema-First Validation" design principle.
 */

import { z } from 'zod';

/**
 * Schema for the body of a user registration request.
 */
export const registerBodySchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(255),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long').max(255),
});

/**
 * Schema for the body of a user login request.
 */
export const loginBodySchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(1, 'Password is required').max(255),
    device: z.string().optional(),
});

/**
 * Schema for resending a verification email.
 */
export const resendVerificationEmailBodySchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
});

/**
 * Schema for requesting a password reset email.
 */
export const forgotPasswordBodySchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
});

/**
 * Schema for resetting a password using a token.
 */
export const resetPasswordBodySchema = z
    .object({
        token: z.string().min(1, 'Token is required'),
        password: z.string().min(8, 'Password must be at least 8 characters long').max(255),
        confirmPassword: z.string().min(1, 'Confirm password is required'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    });

/**
 * Schema for the query of a verify-email request.
 */
export const verifyEmailQuerySchema = z.object({
    token: z.string().min(1, 'Token is required'),
});

/**
 * Schema for the query of a verify-reset-token request.
 */
export const verifyResetTokenQuerySchema = z.object({
    token: z.string().min(1, 'Token is required'),
});

// Full request schemas for middleware validation
export const registerRequestSchema = z.object({ body: registerBodySchema });
export const loginRequestSchema = z.object({ body: loginBodySchema });
export const resendVerificationEmailRequestSchema = z.object({ body: resendVerificationEmailBodySchema });
export const forgotPasswordRequestSchema = z.object({ body: forgotPasswordBodySchema });
export const resetPasswordRequestSchema = z.object({ body: resetPasswordBodySchema });
export const verifyEmailRequestSchema = z.object({ query: verifyEmailQuerySchema });
export const verifyResetTokenRequestSchema = z.object({ query: verifyResetTokenQuerySchema });

// Types inferred from the schemas
export type RegisterBodyInput = z.infer<typeof registerBodySchema>;
export type LoginBodyInput = z.infer<typeof loginBodySchema>;
export type ResendVerificationEmailBodyInput = z.infer<typeof resendVerificationEmailBodySchema>;
export type ForgotPasswordBodyInput = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBodyInput = z.infer<typeof resetPasswordBodySchema>;
export type VerifyEmailQueryInput = z.infer<typeof verifyEmailQuerySchema>;
export type VerifyResetTokenQueryInput = z.infer<typeof verifyResetTokenQuerySchema>;

export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
export type ResendVerificationEmailRequestInput = z.infer<typeof resendVerificationEmailRequestSchema>;
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type VerifyEmailRequestInput = z.infer<typeof verifyEmailRequestSchema>;
export type VerifyResetTokenRequestInput = z.infer<typeof verifyResetTokenRequestSchema>;
