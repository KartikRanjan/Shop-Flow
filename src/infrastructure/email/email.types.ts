import { z } from 'zod';
import type { DeadLetterJob } from '@infrastructure/queue/queue.types';
import { EMAIL_TEMPLATE } from './email.constants';

export const verifyEmailPayloadSchema = z.object({
    name: z.string().trim().min(1).max(255),
    verificationUrl: z.url(),
});

export const resetPasswordPayloadSchema = z.object({
    name: z.string().trim().min(1).max(255),
    resetUrl: z.url(),
});

export const emailJobDataSchema = z.discriminatedUnion('template', [
    z.object({
        to: z.email(),
        template: z.literal(EMAIL_TEMPLATE.VERIFY_EMAIL),
        payload: verifyEmailPayloadSchema,
    }),
    z.object({
        to: z.email(),
        template: z.literal(EMAIL_TEMPLATE.RESET_PASSWORD),
        payload: resetPasswordPayloadSchema,
    }),
]);

export type VerifyEmailPayload = z.infer<typeof verifyEmailPayloadSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordPayloadSchema>;
export type EmailJobData = z.infer<typeof emailJobDataSchema>;

export interface EnqueueEmailOptions {
    jobId?: string;
    priority?: number;
}

export type DeadLetterEmailJobData = DeadLetterJob<EmailJobData>;

export interface DeadLetterEmailJobResponse {
    id: string;
    data: DeadLetterEmailJobData;
}

export const parseEmailJobData = (data: unknown): EmailJobData => emailJobDataSchema.parse(data);
