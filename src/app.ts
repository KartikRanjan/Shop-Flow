/**
 * Express Application Configuration
 * @module app
 * @description App.ts - Main application setup for the Express server.
 * This file initializes the Express app, sets up middleware, and defines routes.
 * It also includes a health check endpoint and a catch-all route for 404 errors.
 */

import type { Express } from 'express';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from '@config/env';
import { errorHandler, notFound } from '@middlewares';
import apiRoutes from '@routes';
import { successResponse } from '@utils';
import { HTTP_STATUS } from '@constants';

const createApp = () => {
    const app: Express = express();
    app.use(helmet());

    app.use(
        cors({
            origin: env.CLIENT_URL,
            credentials: true,
        }),
    );

    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    app.get('/health', (req, res) => {
        res.status(HTTP_STATUS.OK).json(successResponse(null, 'Server is healthy'));
    });

    app.use('/api/v1', apiRoutes);

    app.use('*splat', notFound);
    app.use(errorHandler);

    return app;
};

export default createApp;
