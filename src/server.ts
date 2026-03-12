import createApp from './app';
import { env } from './config/env';


async function main(): Promise<void> {
    try {
        const app = createApp();
        const port = env.PORT;
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
    }
}

main();