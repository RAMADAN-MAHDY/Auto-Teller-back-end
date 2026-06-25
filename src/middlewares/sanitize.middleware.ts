import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import { RequestHandler } from 'express';

/**
 * NoSQL injection prevention.
 * Strips $ and . characters from req.body, req.query, and req.params.
 */
export const mongoSanitizer: RequestHandler = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SANITIZE] Sanitized ${key} in request from ${req.ip}`);
  },
});

/**
 * HTTP Parameter Pollution protection.
 * Prevents duplicate query parameters from causing unexpected behavior.
 */
export const parameterPollutionProtection: RequestHandler = hpp({
  whitelist: ['tags', 'status'], // Allow arrays for these fields
});
