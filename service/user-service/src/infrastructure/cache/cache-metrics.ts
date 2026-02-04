import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

export const CACHE_HIT_COUNTER = 'cache_hits_total';
export const CACHE_MISS_COUNTER = 'cache_misses_total';

export const cacheMetricsProviders = [
    makeCounterProvider({
        name: CACHE_HIT_COUNTER,
        help: 'Total number of cache hits',
        labelNames: ['tier', 'type'], // tier: L1, L2; type: session, profile, permissions, roles
    }),
    makeCounterProvider({
        name: CACHE_MISS_COUNTER,
        help: 'Total number of cache misses',
        labelNames: ['type'],
    }),
];
