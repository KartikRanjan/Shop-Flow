/**
 * Database Schemas
 * @module infrastructure/database
 * @description This file serves as a central point for exporting all database schemas used in the application.
 * It allows for easy import of schemas across different modules without needing to specify individual paths.
 * By consolidating schema exports here, we can maintain a cleaner and more organized codebase.
 *
 * Each schema should be defined in its respective module (e.g., user.model.ts for user-related schemas) and then exported from this file.
 * This approach promotes modularity and separation of concerns, making it easier to manage and scale the application as it grows.
 *
 * Example usage:
 * import { users } from './database/schema';
 *
 * This will allow you to access the 'users' schema defined in the user.model.ts file without needing to specify the full path.
 *
 * Note: Ensure that all schemas are properly defined and exported in their respective files for this central export to work effectively.
 */

export * from '@modules/users/models/user.model';
export * from '@modules/auth/models/auth.model';

// --- Cross-module Relations ---
// Defined here to avoid circular imports between module schema files

import { relations } from 'drizzle-orm';
import { usersTable } from '@modules/users/models/user.model';
import { refreshSessions } from '@modules/auth/models/auth.model';

export const usersRelations = relations(usersTable, ({ many }) => ({
    refreshSessions: many(refreshSessions),
}));

export const refreshSessionsRelations = relations(refreshSessions, ({ one }) => ({
    user: one(usersTable, {
        fields: [refreshSessions.userId],
        references: [usersTable.id],
    }),
}));
