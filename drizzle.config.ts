/**
 * Drizzle ORM configuration
 * @description Configuration for Drizzle ORM, specifying the schema location, output directory, database dialect, and credentials.
 * This file is used by Drizzle to generate the necessary database files based on the defined schema.
 */


import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default {
  schema: './src/infrastructure/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
