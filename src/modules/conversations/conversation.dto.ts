import { z } from 'zod';

export const conversationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().optional(),
  sort: z.string().optional().default('lastMessageAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ConversationQueryDto = z.infer<typeof conversationQuerySchema>;

export const postConversationMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required').max(5000, 'Message body is too long'),
});

export type PostConversationMessageDto = z.infer<typeof postConversationMessageSchema>;
