export const EMAIL_TEMPLATE = {
    VERIFY_EMAIL: 'verify-email',
    VERIFICATION_RESULT: 'verification-result',
} as const;

export const EMAIL_QUEUE_NAME = 'email-queue';
export const EMAIL_DEAD_LETTER_QUEUE_NAME = 'email-dead-letter-queue';
export const EMAIL_JOB_NAME = 'send-email';
export const EMAIL_DEAD_LETTER_JOB_NAME = 'dead-letter-email';

export const EMAIL_QUEUE_ATTEMPTS = 3;
export const EMAIL_QUEUE_BACKOFF_DELAY_MS = 5_000;
export const EMAIL_QUEUE_PRIORITY = 2;
export const EMAIL_RATE_LIMIT_MAX = 10;
export const EMAIL_RATE_LIMIT_DURATION_MS = 1_000;
export const EMAIL_WORKER_CONCURRENCY = 5;

export const EMAIL_FAILED_JOB_RETENTION = {
    age: 7 * 24 * 60 * 60,
} as const;

export const EMAIL_TEMPLATE_FILE_NAMES = {
    [EMAIL_TEMPLATE.VERIFY_EMAIL]: 'verify-email.hbs',
    [EMAIL_TEMPLATE.VERIFICATION_RESULT]: 'verification-result.hbs',
} as const;

export const EMAIL_TEMPLATE_SUBJECTS: Record<string, string | null> = {
    [EMAIL_TEMPLATE.VERIFY_EMAIL]: 'Verify your email - ShopFlow',
    [EMAIL_TEMPLATE.VERIFICATION_RESULT]: null,
} as const;
