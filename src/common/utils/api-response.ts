import { Response } from 'express';
import { IPaginationMeta } from '../interfaces';
import { ApiSuccessResponse } from '../dto';

/**
 * Send a standardized success response.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: IPaginationMeta,
): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    message,
    data,
    ...(meta && { meta }),
  };

  res.status(statusCode).json(response);
}

/**
 * Send a created (201) response.
 */
export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): void {
  sendSuccess(res, data, message, 201);
}

/**
 * Send a no-content (204) response.
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}
