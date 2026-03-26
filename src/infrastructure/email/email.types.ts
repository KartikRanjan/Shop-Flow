import { z } from 'zod';
import type { DeadLetterJob } from '@infrastructure/queue/queue.types';
import { EMAIL_TEMPLATE } from './email.constants';

export const verifyEmailPayloadSchema = z.object({
    name: z.string().trim().min(1).max(255),
    verificationUrl: z.url(),
});

export const emailJobDataSchema = z.discriminatedUnion('template', [
    z.object({
        to: z.email(),
        template: z.literal(EMAIL_TEMPLATE.VERIFY_EMAIL),
        payload: verifyEmailPayloadSchema,
    }),
]);

export type VerifyEmailPayload = z.infer<typeof verifyEmailPayloadSchema>;
export type EmailJobData = z.infer<typeof emailJobDataSchema>;

export interface EnqueueEmailOptions {
    jobId?: string;
    priority?: number;
}

export type DeadLetterEmailJobData = DeadLetterJob<EmailJobData>;

export const parseEmailJobData = (data: unknown): EmailJobData => emailJobDataSchema.parse(data);
