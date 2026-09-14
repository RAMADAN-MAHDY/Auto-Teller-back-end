import { Service } from 'typedi';
import Container from 'typedi';
import { ConversationRepository } from './conversation.repository';
import { CustomerRepository } from '../customers/customer.repository';
import { ConversationStatus, ChatMessageStatus, MessageDirection } from '../../common/constants';
import { IConversation } from './conversation.model';
import { logger } from '../../logger';
import { WhatsAppProvider } from '../../providers/whatsapp.provider';
import { ChatMessageRepository } from '../chat-messages/chat-message.repository';
import { MessageRepository } from '../messages/message.repository';
import { NotFoundException, BadRequestException } from '../../common/exceptions';
import { IPaginatedResult, IPaginationQuery } from '../../common/interfaces';
import { FilterQuery } from 'mongoose';

@Service()
export class ConversationService {
  private readonly conversationRepository: ConversationRepository;
  private readonly customerRepository: CustomerRepository;
  private readonly chatMessageRepository: ChatMessageRepository;
  private readonly messageRepository: MessageRepository;
  private readonly whatsAppProvider: WhatsAppProvider;

  constructor(
    conversationRepository?: ConversationRepository,
    customerRepository?: CustomerRepository,
    chatMessageRepository?: ChatMessageRepository,
    messageRepository?: MessageRepository,
    whatsAppProvider?: WhatsAppProvider,
  ) {
    this.conversationRepository = conversationRepository ?? this.safeGet(ConversationRepository, new ConversationRepository());
    this.customerRepository = customerRepository ?? this.safeGet(CustomerRepository, new CustomerRepository());
    this.chatMessageRepository = chatMessageRepository ?? this.safeGet(ChatMessageRepository, new ChatMessageRepository());
    this.messageRepository = messageRepository ?? this.safeGet(MessageRepository, new MessageRepository());
    this.whatsAppProvider = whatsAppProvider ?? this.safeGet(WhatsAppProvider, new WhatsAppProvider());
  }

  private safeGet<T>(token: new () => T, fallback: T): T {
    try {
      return Container.get(token);
    } catch {
      return fallback;
    }
  }

  async findOrCreateByPhone(
    phoneNumber: string,
    whatsappPhoneNumberId: string,
  ): Promise<IConversation | null> {
    const normalizedPhone = phoneNumber.trim();
    const existing = await this.conversationRepository.findByPhoneNumber(normalizedPhone);
    if (existing) {
      existing.whatsappPhoneNumberId = whatsappPhoneNumberId;
      existing.lastMessageAt ??= new Date();
      await existing.save();
      return existing;
    }

    const customer = await this.customerRepository.findByPhoneNumber(normalizedPhone)
      ?? await this.customerRepository.findByGuarantorPhoneNumber(normalizedPhone);

    if (!customer) {
      logger.warn(`Conversation cannot be created because no local customer found for phone ${normalizedPhone}.`);
      return null;
    }

    const created = await this.conversationRepository.create({
      customerId: customer.id,
      phoneNumber: normalizedPhone,
      whatsappPhoneNumberId,
      status: ConversationStatus.OPEN,
      unreadCount: 0,
      lastMessage: '',
      lastMessageAt: new Date(),
      lastInboundAt: new Date(),
    } as any);

    return created;
  }

  async updateInboundMeta(conversation: IConversation, lastMessage: string, lastInboundAt: Date): Promise<IConversation | null> {
    conversation.lastMessage = lastMessage;
    conversation.lastMessageAt = lastInboundAt;
    conversation.lastInboundAt = lastInboundAt;
    conversation.unreadCount = Math.max((conversation.unreadCount || 0) + 1, 1);
    conversation.status = ConversationStatus.OPEN;
    return this.conversationRepository.updateById(conversation.id, {
      lastMessage,
      lastMessageAt: lastInboundAt,
      lastInboundAt,
      unreadCount: conversation.unreadCount,
      status: ConversationStatus.OPEN,
    });
  }

  isWithin24HourWindow(lastInboundAt?: Date): boolean {
    if (!lastInboundAt) {
      return false;
    }

    const diffHours = (Date.now() - new Date(lastInboundAt).getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  }

  async findAll(query: any): Promise<IPaginatedResult<IConversation>> {
    const filter: FilterQuery<IConversation> = {};
    if (query.unreadOnly) {
      filter.unreadCount = { $gt: 0 };
    }

    const pagination = {
      page: Number(query.page || 1),
      limit: Number(query.limit || 20),
      sort: query.sort || 'lastMessageAt',
      order: query.order || 'desc',
    } as IPaginationQuery;

    return this.conversationRepository.findPaginated(filter, pagination);
  }

  async findById(id: string): Promise<IConversation | null> {
    const conversation = await this.conversationRepository.findById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async findMessages(id: string, query: any): Promise<IPaginatedResult<any>> {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const filter: FilterQuery<any> = { conversationId: conversation.id };
    const pagination = {
      page: Number(query.page || 1),
      limit: Number(query.limit || 20),
      sort: query.sort || 'createdAt',
      order: query.order || 'asc',
    } as IPaginationQuery;

    const result = await this.chatMessageRepository.findPaginated(filter, pagination);
    return result;
  }

  mergeTimelineEntries(
    campaignEntries: Array<{ createdAt: Date; [key: string]: any }>,
    chatEntries: Array<{ createdAt: Date; [key: string]: any }>,
  ): Array<{ source: 'campaign' | 'chat'; createdAt: Date; [key: string]: any }> {
    const entries = [
      ...campaignEntries.map((entry) => ({ ...entry, source: 'campaign' as const })),
      ...chatEntries.map((entry) => ({ ...entry, source: 'chat' as const })),
    ];

    return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getTimeline(id: string): Promise<any[]> {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const customerId = conversation.customerId?.toString();
    const [campaignMessages, chatMessages] = await Promise.all([
      this.messageRepository.findByCustomerId(customerId),
      this.chatMessageRepository.findByConversationId(conversation.id),
    ]);

    const campaignEntries = campaignMessages.map((message) => ({
      id: message.id,
      createdAt: message.createdAt,
      source: 'campaign',
      payload: message,
    }));

    const chatEntries = chatMessages.map((message) => ({
      id: message.id,
      createdAt: message.createdAt,
      source: 'chat',
      payload: message,
    }));

    return this.mergeTimelineEntries(campaignEntries, chatEntries);
  }

  async reply(id: string, body: string, userId: string): Promise<any> {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!this.isWithin24HourWindow(conversation.lastInboundAt)) {
      throw new BadRequestException('24-hour WhatsApp window is closed. Please send a template instead.');
    }

    const response = await this.whatsAppProvider.sendTextMessage(conversation.phoneNumber, body);
    if (response.status === 'failed' || !response.whatsappMessageId) {
      throw new BadRequestException(response.error || 'Unable to send outbound WhatsApp message.');
    }

    const outbound = await this.chatMessageRepository.create({
      conversationId: conversation.id,
      customerId: conversation.customerId,
      whatsappMessageId: response.whatsappMessageId,
      direction: MessageDirection.OUTBOUND,
      type: 'text',
      text: body,
      status: ChatMessageStatus.PENDING,
    } as any);

    await this.conversationRepository.updateById(id, {
      lastMessage: body,
      lastMessageAt: new Date(),
      lastOutboundAt: new Date(),
      unreadCount: 0,
    });

    return {
      id: outbound.id,
      conversationId: conversation.id,
      whatsappMessageId: response.whatsappMessageId,
      status: ChatMessageStatus.PENDING,
      direction: MessageDirection.OUTBOUND,
      text: body,
      createdAt: outbound.createdAt,
    };
  }

  async markAsRead(id: string): Promise<IConversation | null> {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.unreadCount = 0;
    return this.conversationRepository.updateById(id, {
      unreadCount: 0,
      status: ConversationStatus.OPEN,
    });
  }

  async close(id: string): Promise<IConversation | null> {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.conversationRepository.updateById(id, {
      status: ConversationStatus.CLOSED,
      unreadCount: 0,
    });
  }
}
