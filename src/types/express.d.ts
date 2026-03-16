/**
 * Augment Express Request and Response types with custom properties
 * @module types
 * @description This file extends the Express `Request` and `Response` interfaces to include custom
 * properties used across the application such as `req.user` for authenticated user info.
 */

declare namespace Express {
    export interface Request {
        /**
         * The authenticated user's information, if available.
         * This is typically set by the authentication middleware after validating a JWT or session.
         */
        user?: {
            id: string;
            email: string;
            roles: string[];
        };
    }
}
