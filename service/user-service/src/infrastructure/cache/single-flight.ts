import { Logger } from '@nestjs/common';

interface InFlightRequest<T> {
    promise: Promise<T>;
    timestamp: number;
}

/**
 * SingleFlight - Prevents duplicate concurrent requests for the same key
 * When multiple callers request the same key simultaneously,
 * only one actual request is made and the result is shared
 */
export class SingleFlight {
    private readonly logger = new Logger(SingleFlight.name);
    private readonly inFlight = new Map<string, InFlightRequest<unknown>>();
    private readonly maxAge = 30000; // 30s max for stuck requests

    async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const existing = this.inFlight.get(key) as InFlightRequest<T> | undefined;

        if (existing && Date.now() - existing.timestamp < this.maxAge) {
            this.logger.debug(`SingleFlight: sharing request for key ${key}`);
            return existing.promise;
        }

        const promise = fn().finally(() => {
            // Only delete if this entry is still ours (not replaced by a newer request)
            const current = this.inFlight.get(key);
            if (current && current.promise === promise) {
                this.inFlight.delete(key);
            }
        });

        this.inFlight.set(key, {
            promise,
            timestamp: Date.now(),
        });

        return promise;
    }   

    clear(): void {
        this.inFlight.clear();
    }

    size(): number {
        return this.inFlight.size;
    }
}
