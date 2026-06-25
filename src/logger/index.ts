import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for development (human-readable)
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${timestamp} [${level}]: ${message}${stackStr}${metaStr}`;
});

// Determine log level from env (avoid importing env.config to prevent circular deps)
const logLevel = process.env.LOG_LEVEL || 'debug';
const isProduction = process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [
  // Console transport: colorized in dev, JSON in prod
  new winston.transports.Console({
    format: isProduction
      ? combine(timestamp(), errors({ stack: true }), json())
      : combine(
          colorize({ all: true }),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          errors({ stack: true }),
          devFormat,
        ),
  }),
];

// File transports for production
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    }),
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'bankreach' },
  transports,
  // Do not exit on unhandled exceptions; let the error handler manage them
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging integration
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
