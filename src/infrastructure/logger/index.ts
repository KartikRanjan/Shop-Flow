/**
 * Logger instance for the application.
 * @module infrastructure/logger
 * @description Centralized logger configuration using Pino.
 * Provides a single logger instance that can be imported and used across all modules.
 * Configures log level based on environment (debug for development, info for production).
 * In development, logs are pretty-printed with colors for better readability.
 */

import { env } from '@config/env';
import pino from 'pino';

export const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
        env.NODE_ENV === 'production'
            ? undefined
            : {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                  },
              },
});
