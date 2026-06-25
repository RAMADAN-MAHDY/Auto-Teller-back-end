import { z } from 'zod';
import { CustomerGroup } from '../../common/constants';

export const createCustomerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(150),
  phoneNumber: z
    .string()
    .regex(/^\+?\d{10,15}$/, 'Invalid phone number format'),
  guarantorName: z.string().max(150).optional(),
  guarantorPhone: z.string().regex(/^\+?\d{10,15}$/, 'Invalid guarantor phone number format').optional(),
  dueDate: z.string().datetime({ message: 'Must be a valid ISO datetime string' }),
  importedOverdueDays: z.number().int().min(0),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([]),
});

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  phoneNumber: z.string().regex(/^\+?\d{10,15}$/).optional(),
  guarantorName: z.string().max(150).optional(),
  guarantorPhone: z.string().regex(/^\+?\d{10,15}$/, 'Invalid guarantor phone number format').optional(),
  dueDate: z.string().datetime({ message: 'Must be a valid ISO datetime string' }).optional(),
  importedOverdueDays: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

export const customerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
  customerGroup: z.nativeEnum(CustomerGroup).optional(),
  tag: z.string().optional(),
});

export type CustomerQueryDto = z.infer<typeof customerQuerySchema>;

export interface CustomerResponseDto {
  id: string;
  fullName: string;
  phoneNumber: string;
  guarantorName?: string;
  guarantorPhone?: string;
  dueDate: Date;
  importedOverdueDays: number;
  overdueDays: number;
  customerGroup: CustomerGroup;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
