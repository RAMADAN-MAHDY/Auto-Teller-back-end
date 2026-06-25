import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../common/interfaces';
import { UnauthorizedException } from '../common/exceptions';
import { verifyAccessToken } from '../common/utils';

/**
 * JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded payload to req.user.
 */
export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token is required');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      next(error);
      return;
    }

    // JWT verification errors (invalid/expired token)
    next(new UnauthorizedException('Invalid or expired access token'));
  }
}
