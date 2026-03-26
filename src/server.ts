/**
 * Server Entry Point
 * @module server
 * @description Bootstraps and starts the Express application server.
 */
import { logger } from '@infrastructure/logger';
import createApp from './app';
import { env } from '@config/env';
import { initEmailProcessor } from '@infrastructure/email/email.processor';

function main(): void {
    try {
        const emailWorker = initEmailProcessor();
        logger.info('Email processor initialized');

        const app = createApp();
        const port = env.PORT;
        const server = app.listen(port, () => {
            logger.info(`Server is running on port ${port}`);
            logger.info(`Documentation is available at http://localhost:${port}/api-docs`);
        });

        const shutdown = () => {
            logger.info('Shutting down server...');

            const closeAll = async () => {
                try {
                    await emailWorker.close();
                    logger.info('Email worker closed');

                    server.close(() => {
                        logger.info('Server closed');
                        process.exit(0);
                    });
                } catch (error) {
                    logger.error({ error }, 'Error during shutdown');
                    process.exit(1);
                }
            };

            void closeAll();
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (error: unknown) {
        logger.error({ error }, 'Error starting server:');
    }
}

main();
