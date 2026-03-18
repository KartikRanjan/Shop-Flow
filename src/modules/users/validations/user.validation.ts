/**
 * User Validation Schemas
 * @module users/validations
 * @description Zod schemas for validating user-related request data.
 */

import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@constants';

export const baseRequestSchema = z.object({});

const userBodySchema = z.object({
    name: z.string().optional(),
    phoneNumber: z.string().optional(),
    email: z.email().optional(),
});

export const updateMeRequestSchema = z
    .object({
        body: userBodySchema,
    })
    .refine((data) => Object.keys(data.body).length > 0, {
        message: 'At least one field must be provided to update',
        path: ['body'],
    });

// Generic schema for routes that only need user ID validation
export const userIdParamsSchema = z.object({
    params: z.object({
        id: z.uuid('Invalid user ID format'),
    }),
});

export const updateUserRequestSchema = z
    .object({
        body: userBodySchema,
        params: userIdParamsSchema.shape.params,
    })
    .refine((data) => Object.keys(data.body).length > 0, {
        message: 'At least one field must be provided to update',
        path: ['body'],
    });

export const getUsersRequestSchema = z.object({
    query: z.object({
        page: z.coerce.number().min(1).optional().default(DEFAULT_PAGE),
        limit: z.coerce.number().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
    }),
});
