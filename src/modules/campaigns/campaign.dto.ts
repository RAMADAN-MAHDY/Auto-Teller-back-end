import { z } from 'zod';
import { CampaignStatus, CustomerGroup } from '../../common/constants';

export const createCampaignSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  templateId: z.string().min(1, 'Template ID is required'),
  targetCustomerGroup: z.nativeEnum(CustomerGroup, { message: 'Invalid customer group' }),
  scheduledAt: z
    .string()
    .datetime({ message: 'Must be a valid ISO datetime string' })
    .optional()
    .nullable(),
});

export type CreateCampaignDto = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  templateId: z.string().optional(),
  targetCustomerGroup: z.nativeEnum(CustomerGroup, { message: 'Invalid customer group' }).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export type UpdateCampaignDto = z.infer<typeof updateCampaignSchema>;

export const campaignQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(CampaignStatus).optional(),
  search: z.string().optional(),
  targetCustomerGroup: z.nativeEnum(CustomerGroup).optional(),
});

export type CampaignQueryDto = z.infer<typeof campaignQuerySchema>;

export interface CampaignResponseDto {
  id: string;
  title: string;
  template: {
    id: string;
    name: string;
  };
  targetCustomerGroup: CustomerGroup;
  status: CampaignStatus;
  scheduledAt?: Date;
  completedAt?: Date;
  createdBy: {
    id: string;
    fullName: string;
  };
  stats: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
