import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { HttpException } from '../common/exceptions';
import { ApiErrorResponse } from '../common/dto';
import { logger } from '../logger';
import { env } from '../configs/env.config';

/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log the error
  logger.error(`${err.message}`, {
    name: err.name,
    stack: err.stack,
    ...(err instanceof HttpException && { statusCode: err.statusCode }),
  });

  // --- Zod Validation Errors ---
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    const response: ApiErrorResponse = {
      success: false,
      message: 'Validation failed',
      errors,
    };

    res.status(400).json(response);
    return;
  }

  // --- Custom HTTP Exceptions ---
  if (err instanceof HttpException) {
    const response: ApiErrorResponse = {
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // --- Mongoose Validation Errors ---
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));

    const response: ApiErrorResponse = {
      success: false,
      message: 'Validation failed',
      errors,
    };

    res.status(400).json(response);
    return;
  }

  // --- Mongoose Cast Errors (invalid ObjectId) ---
  if (err instanceof mongoose.Error.CastError) {
    const response: ApiErrorResponse = {
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    };

    res.status(400).json(response);
    return;
  }

  // --- MongoDB Duplicate Key Error ---
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    const keyValue = (err as any).keyValue;
    const field = Object.keys(keyValue)[0];

    const response: ApiErrorResponse = {
      success: false,
      message: `Duplicate value for field: ${field}`,
    };

    res.status(409).json(response);
    return;
  }

  // --- JWT Errors ---
  if (err.name === 'JsonWebTokenError') {
    const response: ApiErrorResponse = {
      success: false,
      message: 'Invalid token',
    };

    res.status(401).json(response);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    const response: ApiErrorResponse = {
      success: false,
      message: 'Token has expired',
    };

    res.status(401).json(response);
    return;
  }

  // --- Unknown / Unhandled Errors ---
  const response: ApiErrorResponse = {
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(500).json(response);
}
