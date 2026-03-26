/**
 * Email Service
 * @module infrastructure/email
 * @description Queue-facing email orchestration: validates payloads, enqueues jobs,
 * and exposes failed-job recovery helpers for operational use.
 */

import { logger } from '@infrastructure/logger';
import { EMAIL_TEMPLATE } from './email.constants';
import { addEmailJob, getDeadLetterJob, listDeadLetterJobs } from './email.queue';
import type { DeadLetterEmailJobData, EmailJobData, EnqueueEmailOptions, VerifyEmailPayload } from './email.types';
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

    async listDeadLetters(): Promise<DeadLetterEmailJobData[]> {
        const jobs = await listDeadLetterJobs();

        return jobs.map((job) => job.data).filter((data): data is DeadLetterEmailJobData => data !== undefined);
    }

    async retryDeadLetter(jobId: string): Promise<string> {
        const job = await getDeadLetterJob(jobId);

        if (!job?.data) {
            throw new Error(`Dead-letter email job not found: ${jobId}`);
        }

        const newJobId = await this.enqueue(job.data.payload);
        await job.remove();

        logger.info({ deadLetterJobId: jobId, newJobId }, 'Dead-letter email job requeued');
        return newJobId;
    }
}

export const emailService = new EmailService();
