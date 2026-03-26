import type { JobsOptions, WorkerOptions } from 'bullmq';

export interface DeadLetterJob<TPayload> {
    originalJobId: string;
    queueName: string;
    jobName: string;
    payload: TPayload;
    failedReason: string;
    attemptsMade: number;
    failedAt: string;
}

export interface CreateQueueOptions {
    defaultJobOptions?: JobsOptions;
}

export type CreateWorkerOptions = Omit<WorkerOptions, 'connection' | 'prefix'>;
