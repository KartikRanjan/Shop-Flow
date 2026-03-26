import type { Job } from 'bullmq';
import { logger } from '@infrastructure/logger';
import { addJob, createQueue } from '@infrastructure/queue/queue.factory';
import { createDeterministicJobId } from '@infrastructure/queue/queue.utils';
import {
    EMAIL_DEAD_LETTER_JOB_NAME,
    EMAIL_DEAD_LETTER_QUEUE_NAME,
    EMAIL_FAILED_JOB_RETENTION,
    EMAIL_JOB_NAME,
    EMAIL_QUEUE_ATTEMPTS,
    EMAIL_QUEUE_BACKOFF_DELAY_MS,
    EMAIL_QUEUE_NAME,
    EMAIL_QUEUE_PRIORITY,
} from './email.constants';
import type { DeadLetterEmailJobData, EmailJobData, EnqueueEmailOptions } from './email.types';

export const emailQueue = createQueue<EmailJobData>(EMAIL_QUEUE_NAME, {
    defaultJobOptions: {
        attempts: EMAIL_QUEUE_ATTEMPTS,
        backoff: {
            type: 'exponential',
            delay: EMAIL_QUEUE_BACKOFF_DELAY_MS,
        },
        removeOnComplete: true,
        removeOnFail: EMAIL_FAILED_JOB_RETENTION,
    },
});

export const emailDeadLetterQueue = createQueue<DeadLetterEmailJobData>(EMAIL_DEAD_LETTER_QUEUE_NAME, {
    defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
    },
});

export const buildEmailJobId = (payload: EmailJobData): string => createDeterministicJobId(payload);

export const addEmailJob = async (
    payload: EmailJobData,
    options: EnqueueEmailOptions = {},
): Promise<Job<EmailJobData>> => {
    const job = await addJob(emailQueue, EMAIL_JOB_NAME, payload, {
        priority: options.priority ?? EMAIL_QUEUE_PRIORITY,
        jobId: options.jobId ?? buildEmailJobId(payload),
    });

    logger.info({ jobId: job.id, template: payload.template, to: payload.to }, 'Email queued');
    return job;
};

export const addDeadLetterEmailJob = async (payload: DeadLetterEmailJobData): Promise<Job<DeadLetterEmailJobData>> => {
    const job = await addJob(emailDeadLetterQueue, EMAIL_DEAD_LETTER_JOB_NAME, payload, {
        jobId: `${payload.originalJobId}:${payload.failedAt}`,
    });

    logger.error(
        {
            jobId: payload.originalJobId,
            deadLetterJobId: job.id,
            template: payload.payload.template,
            to: payload.payload.to,
        },
        'Email job moved to dead-letter queue',
    );

    return job;
};

export const listDeadLetterJobs = async (): Promise<Job<DeadLetterEmailJobData>[]> =>
    emailDeadLetterQueue.getJobs(['waiting', 'delayed', 'failed', 'prioritized']);

export const getDeadLetterJob = async (jobId: string): Promise<Job<DeadLetterEmailJobData> | undefined> =>
    emailDeadLetterQueue.getJob(jobId);
