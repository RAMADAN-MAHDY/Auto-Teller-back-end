import morgan from 'morgan';
import { morganStream } from '../logger';
import { env } from '../configs/env.config';

/**
 * HTTP request logging middleware powered by Morgan + Winston.
 * Uses 'dev' format in development and 'combined' format in production.
 */
export const requestLogger = morgan(
  env.NODE_ENV === 'production' ? 'combined' : 'dev',
  { stream: morganStream },
);
