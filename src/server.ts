import { logger } from '@infrastructure/logger';
import createApp from './app';
import { env } from './config/env';

function main(): void {
    try {
        const app = createApp();
        const port = env.PORT;
        app.listen(port, () => {
            logger.info(`Server is running on port ${port}`);
        });
    } catch (error) {
        logger.error({ error }, 'Error starting server:');
    }
}

main();
