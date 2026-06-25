import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Generic Zod validation middleware factory.
 * Validates request body, query, or params against a Zod schema.
 *
 * @example
 * router.post('/', validate(createUserSchema, 'body'), controller.create);
 * router.get('/', validate(paginationSchema, 'query'), controller.list);
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      // Pass the ZodError to the error handler middleware
      next(result.error);
      return;
    }

    // Replace the target with parsed & coerced values
    req[target] = result.data;
    next();
  };
}
