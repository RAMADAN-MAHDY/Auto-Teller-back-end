import IORedis, { Redis } from 'ioredis';
import { env } from './env.config';
import { logger } from '../logger';

function createRedisConnection(name: string, maxRetriesPerRequest: number | null): Redis {
  // const connection = new IORedis({
  //   host: env.REDIS_HOST,
  //   port: env.REDIS_PORT,
  //   password: env.REDIS_PASSWORD || undefined,
  //   maxRetriesPerRequest,
  //   enableReadyCheck: true,
  //   retryStrategy(times: number) {
  //     const delay = Math.min(times * 200, 5000);
  //     logger.warn(`🔄 Redis [${name}] retry attempt ${times}, next in ${delay}ms`);
  //     return delay;
  //   },
  // });

  const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    logger.warn(
      `🔄 Redis [${name}] retry attempt ${times}, next in ${delay}ms`
    );
    return delay;
  },
});

  connection.on('connect', () => {
    logger.info(`🔴 Redis [${name}] connected`);
  });

  connection.on('error', (error) => {
    logger.error(`❌ Redis [${name}] error:`, error);
  });

  connection.on('close', () => {
    logger.warn(`⚠️ Redis [${name}] connection closed`);
  });

  return connection;
}

/**
 * Producer connection: used by Express API to add jobs.
 * maxRetriesPerRequest = 1 so API fails fast if Redis is down.
 */
export function createProducerConnection(): Redis {
  return createRedisConnection('producer', 1);
}

/**
 * Worker connection: used by BullMQ workers to process jobs.
 * maxRetriesPerRequest = null so workers patiently retry during Redis blips.
 */
export function createWorkerConnection(): Redis {
  return createRedisConnection('worker', null);
}

let _defaultConnection: Redis | null = null;

export function getDefaultRedisConnection(): Redis {
  if (!_defaultConnection) {
    _defaultConnection = createProducerConnection();
  }
  return _defaultConnection;
}

export async function disconnectRedis(): Promise<void> {
  if (_defaultConnection) {
    await _defaultConnection.quit();
    _defaultConnection = null;
    logger.info('🔴 Redis disconnected gracefully');
  }
}
