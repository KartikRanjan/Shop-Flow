import crypto from 'node:crypto';

export const stableStringify = (value: unknown): string => {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
            .join(',')}}`;
    }

    return JSON.stringify(value);
};

export const createDeterministicJobId = (payload: unknown): string =>
    crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
