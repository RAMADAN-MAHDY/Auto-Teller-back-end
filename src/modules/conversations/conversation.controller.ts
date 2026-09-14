import { Response } from 'express';
import Container, { Service } from 'typedi';
import { ConversationService } from './conversation.service';
import { sendSuccess, sendCreated } from '../../common/utils';
import { ConversationQueryDto } from './conversation.dto';
import { AuthenticatedRequest } from '../../common/interfaces';

@Service()
export class ConversationController {
  private readonly conversationService = Container.get(ConversationService);

  private normalizeConversationId(req: AuthenticatedRequest): string {
    const raw = req.params.id;
    if (typeof raw === 'string') {
      return raw;
    }
    if (Array.isArray(raw)) {
      return raw[0] ?? '';
    }
    return '';
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const query = req.query as unknown as ConversationQueryDto;
    const result = await this.conversationService.findAll(query);
    sendSuccess(res, result.data, 'Conversations retrieved successfully', 200, result.meta);
  }

  async findById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const conversationId = this.normalizeConversationId(req);
    const conversation = await this.conversationService.findById(conversationId);
    sendSuccess(res, conversation, 'Conversation retrieved successfully');
  }

  async findMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    const conversationId = this.normalizeConversationId(req);
    const result = await this.conversationService.findMessages(conversationId, req.query as any);
    sendSuccess(res, result.data, 'Chat messages retrieved successfully', 200, result.meta);
  }

  async timeline(req: AuthenticatedRequest, res: Response): Promise<void> {
    const conversationId = this.normalizeConversationId(req);
    const timeline = await this.conversationService.getTimeline(conversationId);
    sendSuccess(res, timeline, 'Conversation timeline retrieved successfully');
  }

  async reply(req: AuthenticatedRequest, res: Response): Promise<void> {
    const conversationId = this.normalizeConversationId(req);
    const reply = await this.conversationService.reply(conversationId, req.body.body, req.user?.userId || 'system');
    sendCreated(res, reply, 'Outbound reply created successfully');
  }

  async markRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const conversationId = this.normalizeConversationId(req);
    const conversation = await this.conversationService.markAsRead(conversationId);
    sendSuccess(res, conversation, 'Conversation marked as read');
  }

  async close(req: AuthenticatedRequest, res: Response): Promise<void> {
    const conversationId = this.normalizeConversationId(req);
    const conversation = await this.conversationService.close(conversationId);
    sendSuccess(res, conversation, 'Conversation closed');
  }
}
