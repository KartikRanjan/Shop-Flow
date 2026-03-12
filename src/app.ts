import 'dotenv/config';
import express, { Express }from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';

const createApp = () => {
    const app: Express = express();
    app.use(helmet());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(cors({
        origin: env.CLIENT_URL,
        credentials: true,
    }));

    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

    app.get('/health', (req, res) => {
        res.json({ status: 'OK' });
    });

    app.use((req, res, next) => {
        res.status(404).json({ message: 'Not Found' });
    });

    return app;
}

export default createApp;