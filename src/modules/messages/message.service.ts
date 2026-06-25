import Container, { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { MessageRepository } from './message.repository';
import { MessageQueryDto, MessageResponseDto } from './message.dto';
import { NotFoundException } from '../../common/exceptions';
import { IPaginatedResult } from '../../common/interfaces';
import { IMessage } from './message.model';

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
    }, { path: 'customerId', select: 'fullName' });

    return {
      data: result.data.map(this.toResponseDto),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<MessageResponseDto> {
    const message = await this.messageRepository.findById(id);
    if (!message) {
      throw new NotFoundException('Message log not found');
    }
    await message.populate('customerId', 'fullName');
    return this.toResponseDto(message);
  }

  private toResponseDto(message: IMessage): MessageResponseDto {
    const customer = message.customerId as any;
    return {
      id: message.id,
      campaignId: message.campaignId.toString(),
      customer: {
        id: customer?.id || customer?._id?.toString() || '',
        fullName: customer?.fullName || 'Unknown Customer',
      },
      whatsappMessageId: message.whatsappMessageId,
      phoneNumber: message.phoneNumber,
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
