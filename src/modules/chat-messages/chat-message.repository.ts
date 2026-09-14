import { Service } from 'typedi';
import { BaseRepository } from '../../database/base.repository';
import { ChatMessageModel, IChatMessage } from './chat-message.model';
import { FilterQuery } from 'mongoose';

@Service()
export class ChatMessageRepository extends BaseRepository<IChatMessage> {
  constructor() {
    super(ChatMessageModel);
  }

  async findByConversationId(conversationId: string): Promise<IChatMessage[]> {
    return this.model.find({ conversationId }).sort({ createdAt: 1 }).exec();
  }

  async findByWhatsAppId(whatsappMessageId: string): Promise<IChatMessage | null> {
    return this.model.findOne({ whatsappMessageId }).exec();
  }

  async findByConversationWithFilter(
    conversationId: string,
    filter: FilterQuery<IChatMessage> = {},
  ): Promise<IChatMessage[]> {
    return this.model.find({ conversationId, ...filter }).sort({ createdAt: 1 }).exec();
  }
}
