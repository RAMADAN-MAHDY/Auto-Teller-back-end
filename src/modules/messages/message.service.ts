import Container, { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { MessageRepository } from './message.repository';
import { MessageQueryDto, MessageResponseDto } from './message.dto';
import { NotFoundException } from '../../common/exceptions';
import { IPaginatedResult } from '../../common/interfaces';
import { IMessage } from './message.model';
import { decrypt } from '../../common/utils/encryption';

@Service()
export class MessageService {
  private readonly messageRepository = Container.get(MessageRepository);

  async findByCampaign(
    campaignId: string,
    query: MessageQueryDto,
  ): Promise<IPaginatedResult<MessageResponseDto>> {
    const filter: FilterQuery<IMessage> = { campaignId };
    if (query.status) {
      filter.status = query.status;
    }

    const result = await this.messageRepository.findPaginated(filter, {
      page: query.page,
      limit: query.limit,
      sort: 'createdAt',
      order: 'desc',
    }, { path: 'customerId', select: 'fullNameEncrypted' });

    return {
      data: result.data.map((message) => this.toResponseDto(message)),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<MessageResponseDto> {
    const message = await this.messageRepository.findById(id);
    if (!message) {
      throw new NotFoundException('Message log not found');
    }
    await message.populate('customerId', 'fullNameEncrypted');
    return this.toResponseDto(message);
  }

  private toResponseDto(message: IMessage): MessageResponseDto {
    const customer = message.customerId as any;
    // customer.fullNameEncrypted is only populated when the customer still
    // exists; decrypt it here for the response, falling back gracefully
    // otherwise (deleted customer, or population not requested).
    const fullName = customer?.fullNameEncrypted ? decrypt(customer.fullNameEncrypted) : undefined;
    return {
      id: message.id,
      campaignId: message.campaignId.toString(),
      customer: {
        id: customer?.id || customer?._id?.toString() || '',
        fullName: fullName || 'Unknown Customer',
      },
      whatsappMessageId: message.whatsappMessageId,
      phoneNumber: message.phoneNumber,
      recipientType: message.recipientType || 'customer',
      status: message.status,
      error: message.error,
      sentAt: message.sentAt,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
}