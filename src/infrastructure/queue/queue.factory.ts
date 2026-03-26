import { Queue, Worker, type JobsOptions, type Processor } from 'bullmq';
import { bullMqConnection, bullMqPrefix } from './queue.config';
import type { CreateQueueOptions, CreateWorkerOptions } from './queue.types';

export const createQueue = <TData>(name: string, options: CreateQueueOptions = {}): Queue<TData> =>
    new Queue<TData>(name, {
        connection: bullMqConnection,
        prefix: bullMqPrefix,
        defaultJobOptions: options.defaultJobOptions,
    });

export const createWorker = <TData>(
    name: string,
    processor: Processor<TData>,
    options: CreateWorkerOptions = {},
): Worker<TData> =>
    new Worker<TData>(name, processor, {
        connection: bullMqConnection,
        prefix: bullMqPrefix,
        ...options,
    });

export const addJob = <TData>(queue: Queue<TData>, jobName: string, payload: TData, options?: JobsOptions) =>
    queue.add(jobName as never, payload as never, options);
