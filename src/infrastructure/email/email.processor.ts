import type { Job } from 'bullmq';
import { logger } from '@infrastructure/logger';
import { createWorker } from '@infrastructure/queue/queue.factory';
import {
    EMAIL_QUEUE_ATTEMPTS,
    EMAIL_QUEUE_NAME,
    EMAIL_JOB_NAME,
    EMAIL_RATE_LIMIT_DURATION_MS,
    EMAIL_RATE_LIMIT_MAX,
    EMAIL_WORKER_CONCURRENCY,
} from './email.constants';
import { addDeadLetterEmailJob } from './email.queue';
import { renderEmailFromJob, preloadEmailTemplates } from './template.engine';
import { sendEmail } from './transporter';
import type { EmailJobData } from './email.types';

export const initEmailProcessor = () => {
    preloadEmailTemplates();

    const worker = createWorker<EmailJobData>(
        EMAIL_QUEUE_NAME,
        async (job: Job<EmailJobData>) => {
            const { to } = job.data;
            const email = renderEmailFromJob(job.data);

            logger.debug({ jobId: job.id, to, template: job.data.template }, 'Processing email job');

            await sendEmail({
                to,
                ...email,
            });
        },
        {
            concurrency: EMAIL_WORKER_CONCURRENCY,
            limiter: {
                max: EMAIL_RATE_LIMIT_MAX,
                duration: EMAIL_RATE_LIMIT_DURATION_MS,
            },
        },
    );

    worker.on('completed', (job) => {
        logger.info({ jobId: job.id }, 'Email job completed successfully');
    });

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err }, 'Email job failed');

        if (!job) {
            return;
        }

        const maxAttempts = job.opts.attempts ?? EMAIL_QUEUE_ATTEMPTS;

        if (job.attemptsMade >= maxAttempts) {
            void addDeadLetterEmailJob({
                originalJobId: String(job.id),
                queueName: EMAIL_QUEUE_NAME,
                jobName: EMAIL_JOB_NAME,
                payload: job.data,
                failedReason: err.message,
                attemptsMade: job.attemptsMade,
                failedAt: new Date().toISOString(),
            }).catch((deadLetterError: unknown) => {
                logger.error(
                    { error: deadLetterError, jobId: job.id },
                    'Failed to move email job to dead-letter queue',
                );
            });
        }
    });

    return worker;
};
