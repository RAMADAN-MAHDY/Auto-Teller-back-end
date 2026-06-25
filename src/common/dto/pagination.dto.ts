import { z } from 'zod';
import { API_DEFAULTS } from '../constants';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(API_DEFAULTS.PAGE),
  limit: z.coerce.number().int().min(1).max(API_DEFAULTS.MAX_LIMIT).default(API_DEFAULTS.LIMIT),
  sort: z.string().optional().default(API_DEFAULTS.SORT_FIELD),
  order: z.enum(['asc', 'desc']).optional().default(API_DEFAULTS.SORT_ORDER),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;
