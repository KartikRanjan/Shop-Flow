/**
 * TypedRequest Utility
 * @module types
 * @description Provides a `TypedRequest` generic that automatically infers `req.body`,
 * `req.query`, and `req.params` types directly from a Zod request schema.
 *
 * The schema must follow the convention:
 *   z.object({ body?: ZodType, query?: ZodType, params?: ZodType })
 *
 * Example:
 *   const registerRequestSchema = z.object({ body: registerBodySchema });
 *   type Req = TypedRequest<typeof registerRequestSchema>;
 *   → req.body is fully typed as { name: string; email: string; password: string }
 */

import type { Request } from 'express';
import type { z } from 'zod';

/**
 * Extract the shape of a ZodObject schema.
 * Given `z.object({ body: z.object({...}), query: ... })`,
 * this returns `{ body: ZodObject<...>, query: ..., params: ... }`.
 */
type SchemaShape<S extends z.ZodObject<z.ZodRawShape>> = S['shape'];

/**
 * Infer the TypeScript type from a Zod schema if the key exists in the shape,
 * otherwise fall back to the default type `D`.
 */
type InferKey<Shape extends z.ZodRawShape, Key extends string, D> = Key extends keyof Shape
    ? Shape[Key] extends z.ZodTypeAny
        ? z.infer<Shape[Key]>
        : D
    : D;

/**
 * A typed Express Request inferred from a Zod request schema.
 *
 * The schema is expected to be a `ZodObject` with optional keys:
 * `body`, `query`, `params` — each being a `ZodType`.
 *
 * Usage:
 * ```ts
 * import type { TypedRequest } from '../../../types/typed-request.types';
 * import { registerRequestSchema } from '../validations';
 *
 * const register = async (req: TypedRequest<typeof registerRequestSchema>, res: Response) => {
 *   const { name, email, password } = req.body; // fully typed, no casting
 * };
 * ```
 */
export type TypedRequest<S extends z.ZodObject<z.ZodRawShape>> = Request<
    InferKey<SchemaShape<S>, 'params', Record<string, string>>,
    unknown,
    InferKey<SchemaShape<S>, 'body', Record<string, unknown>>,
    InferKey<SchemaShape<S>, 'query', Record<string, string>>
>;
