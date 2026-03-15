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
});

// Full request schemas for middleware validation
export const registerRequestSchema = z.object({ body: registerBodySchema });
export const loginRequestSchema = z.object({ body: loginBodySchema });

// Types inferred from the schemas
export type RegisterBodyInput = z.infer<typeof registerBodySchema>;
export type LoginBodyInput = z.infer<typeof loginBodySchema>;

export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
