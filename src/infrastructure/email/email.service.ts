/**
 * Email Service
 * @module infrastructure/email
 * @description Queue-facing email orchestration: validates payloads, enqueues jobs,
 * and exposes failed-job recovery helpers for operational use.
 */

import { logger } from '@infrastructure/logger';
import { EMAIL_TEMPLATE } from './email.constants';
import { addEmailJob, getDeadLetterJob, listDeadLetterJobs } from './email.queue';
import type {
    DeadLetterEmailJobData,
    DeadLetterEmailJobResponse,
    EmailJobData,
    EnqueueEmailOptions,
    VerifyEmailPayload,
} from './email.types';
import { parseEmailJobData } from './email.types';

export interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html: string;
}

export class EmailService {
    async enqueue(data: EmailJobData, options?: EnqueueEmailOptions): Promise<string> {
        const payload = parseEmailJobData(data);
        const job = await addEmailJob(payload, options);
        return String(job.id);
    }

    async enqueueVerificationEmail(params: { to: string } & VerifyEmailPayload): Promise<string> {
        return this.enqueue({
            to: params.to,
            template: EMAIL_TEMPLATE.VERIFY_EMAIL,
            payload: {
                name: params.name,
                verificationUrl: params.verificationUrl,
            },
        });
    }

    async listDeadLetters(): Promise<DeadLetterEmailJobResponse[]> {
        const jobs = await listDeadLetterJobs();

        return jobs
            .filter((job): job is typeof job & { data: DeadLetterEmailJobData } => job.data !== undefined)
            .map((job) => ({
                id: String(job.id),
                data: job.data,
            }));
    }

    async retryDeadLetter(jobId: string): Promise<string> {
        const job = await getDeadLetterJob(jobId);

        if (!job?.data) {
            throw new Error(`Dead-letter email job not found: ${jobId}`);
        }

        // A deterministic jobId is derived solely from the payload, so re-enqueueing
        // the same payload would collide with the still-retained failed job (kept for
        // EMAIL_FAILED_JOB_RETENTION days). BullMQ silently ignores duplicate jobIds
        // and returns a Job object that looks valid but was never queued. To guarantee
        // a fresh job is created, we use the original job id as a trace anchor and
        // append the timestamp to bust the collision. Use '-' not ':' as separator —
        // BullMQ forbids ':' in custom jobIds (it is a Redis key namespace separator).
        const retryJobId = `${job.data.originalJobId}-retry-${Date.now()}`;
        const newJobId = await this.enqueue(job.data.payload, { jobId: retryJobId });
        await job.remove();

        logger.info({ deadLetterJobId: jobId, newJobId }, 'Dead-letter email job requeued');
        return newJobId;
    }
}

export const emailService = new EmailService();
