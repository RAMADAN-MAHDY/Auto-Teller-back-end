import { z } from 'zod';

export const importCustomerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(150),
  phoneNumber: z
    .string()
    .regex(/^\+?\d{10,15}$/, 'Invalid phone number format'),
  guarantorName: z.string().max(150).optional().or(z.literal('')),
  guarantorPhone: z.string().regex(/^\+?\d{10,15}$/, 'Invalid guarantor phone number format').optional().or(z.literal('')),
  dueDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid date format' }),
  // Kept for backward compatibility; the backend currently calculates overdueDays from dueDate.
  importedOverdueDays: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
  tags: z.string().optional().or(z.literal('')), // Tags will be comma-separated string from Excel
});

export type ImportCustomerDto = z.infer<typeof importCustomerSchema>;
