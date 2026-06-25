import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  body: z.string().min(1, 'Template body cannot be empty').max(4096),
});

export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  body: z.string().min(1).max(4096).optional(),
});

export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;

export const templateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
});

export type TemplateQueryDto = z.infer<typeof templateQuerySchema>;

export interface TemplateResponseDto {
  id: string;
  name: string;
  body: string;
  variables: string[];
  createdBy: {
    id: string;
    fullName: string;
  } | string;
  createdAt: Date;
  updatedAt: Date;
}
