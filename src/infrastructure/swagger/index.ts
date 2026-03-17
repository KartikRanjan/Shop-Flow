/**
 * Swagger Registry for OpenAPI Documentation
 * @module swagger
 * @description This module provides utilities for registering API routes and schemas
 * with the Swagger registry for automatic OpenAPI specification generation.
 */

import { createOpenApiRegistry } from 'xpress-toolkit/swagger';
import type { RouteDoc } from 'xpress-toolkit/swagger';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

/**
 * Swagger Registry for OpenAPI documentation
 * @description This registry is used to collect all API route definitions and schemas
 * for automatic OpenAPI specification generation.
 */
export const swaggerRegistry = createOpenApiRegistry({
    title: 'ShopFlow API',
    version: '1.0.0',
});

/**
 * Register a schema with the swagger registry
 */
export const registerSchema = (name: string, schema: ZodType) => {
    swaggerRegistry.registerSchema(name, schema);
};

/**
 * Register a route with the swagger registry
 */
export const registerRoute = (route: RouteDoc) => {
    swaggerRegistry.registerRoute(route);
};

// Register health check
registerRoute({
    method: 'get',
    path: '/health',
    summary: 'Health check',
    description: 'Check if the server is healthy.',
    responses: {
        200: {
            description: 'Server is healthy',
        },
    },
});
