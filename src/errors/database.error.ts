/****
 * Database Error Class
 * @module errors
 * @description Database error for wrapping repository layer exceptions.
 */

export default class DatabaseError extends Error {
    // `cause` is handled by native Error in modern Node.js

    constructor(message: string, cause?: unknown) {
        super(message, { cause });
        this.name = 'DatabaseError';

        // Restore prototype chain when extending built-in types
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}
