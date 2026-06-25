import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../common/interfaces';
import { ForbiddenException, UnauthorizedException } from '../common/exceptions';
import { UserRole } from '../common/constants';

/**
 * Role-based access control middleware factory.
 * Usage: authorize(UserRole.ADMIN, UserRole.EMPLOYEE)
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedException('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      next(
        new ForbiddenException(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        ),
      );
      return;
    }

    next();
  };
}
