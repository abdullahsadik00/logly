import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Separate connection for pub/sub (Redis requires separate connections for subscribe)
export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => console.error('[Redis] Error:', err));
redisSub.on('error', (err) => console.error('[RedisSub] Error:', err));
