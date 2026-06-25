import { z } from 'zod';
import { MessageStatus } from '../../common/constants';

export const messageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(MessageStatus).optional(),
});

export type MessageQueryDto = z.infer<typeof messageQuerySchema>;

export interface MessageResponseDto {
  id: string;
  campaignId: string;
  customer: {
    id: string;
    fullName: string;
  };
  whatsappMessageId?: string;
  phoneNumber: string;
  status: MessageStatus;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
