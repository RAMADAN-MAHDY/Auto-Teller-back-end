import { Service } from 'typedi';
import Container from 'typedi';
import { ChatMessageRepository } from './chat-message.repository';
import { ConversationRepository } from '../conversations/conversation.repository';
import { MessageDirection, ChatMessageStatus, ChatMessageType } from '../../common/constants';
import { IChatMessage } from './chat-message.model';
import { logger } from '../../logger';
import { CampaignWebSocketService } from '../../websocket/campaign-websocket.service';

@Service()
export class ChatMessageService {
  private readonly chatMessageRepository = Container.get(ChatMessageRepository);
  private readonly conversationRepository = Container.get(ConversationRepository);
  private readonly campaignWebSocketService = Container.get(CampaignWebSocketService);

  async saveInbound(
    conversationId: string,
    customerId: string,
    whatsappMessageId: string,
    phoneNumber: string,
    text: string,
    type: ChatMessageType = ChatMessageType.TEXT,
  ): Promise<IChatMessage | null> {
    const existing = await this.chatMessageRepository.findByWhatsAppId(whatsappMessageId);
    if (existing) {
      logger.info(`Inbound chat message with WhatsApp ID ${whatsappMessageId} already stored, skipping duplicate.`);
      return existing;
    }

    const created = await this.chatMessageRepository.create({
      conversationId,
      customerId,
      whatsappMessageId,
      direction: MessageDirection.INBOUND,
      type,
      text,
      status: ChatMessageStatus.SENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await this.conversationRepository.updateById(conversationId, {
      lastMessage: text,
      lastMessageAt: new Date(),
      lastInboundAt: new Date(),
      unreadCount: 1,
    });

    this.campaignWebSocketService.sendChatMessage({
      conversationId,
      chatMessageId: created.id,
      direction: MessageDirection.INBOUND,
      text,
      whatsappMessageId,
      status: ChatMessageStatus.SENT,
      createdAt: new Date(),
    });

    this.campaignWebSocketService.sendConversationUpdated({
      conversationId,
      unreadCount: 1,
      lastMessage: text,
      lastMessageAt: new Date(),
      status: 'OPEN',
      updatedAt: new Date(),
    });

    return created;
  }

  async saveOutbound(
    conversationId: string,
    customerId: string,
    whatsappMessageId: string,
    text: string,
  ): Promise<IChatMessage | null> {
    const existing = await this.chatMessageRepository.findByWhatsAppId(whatsappMessageId);
    if (existing) {
      logger.info(`Outbound chat message with WhatsApp ID ${whatsappMessageId} already stored, skipping duplicate.`);
      return existing;
    }

    const created = await this.chatMessageRepository.create({
      conversationId,
      customerId,
      whatsappMessageId,
      direction: MessageDirection.OUTBOUND,
      type: ChatMessageType.TEXT,
      text,
      status: ChatMessageStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await this.conversationRepository.updateById(conversationId, {
      lastMessage: text,
      lastMessageAt: new Date(),
      lastOutboundAt: new Date(),
    });

    this.campaignWebSocketService.sendChatMessage({
      conversationId,
      chatMessageId: created.id,
      direction: MessageDirection.OUTBOUND,
      text,
      whatsappMessageId,
      status: ChatMessageStatus.PENDING,
      createdAt: new Date(),
    });

    this.campaignWebSocketService.sendConversationUpdated({
      conversationId,
      lastMessage: text,
      lastMessageAt: new Date(),
      status: 'OPEN',
      updatedAt: new Date(),
    });

    return created;
  }
}
