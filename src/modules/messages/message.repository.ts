import { Service } from 'typedi';
import { BaseRepository } from '../../database/base.repository';
import { MessageModel, IMessage } from './message.model';
import { MessageStatus } from '../../common/constants';
import { IPaginatedResult, IPaginationQuery } from '../../common/interfaces';
import { FilterQuery } from 'mongoose';

@Service()
export class MessageRepository extends BaseRepository<IMessage> {
  constructor() {
    super(MessageModel);
  }

  /**
   * Find messages by campaign with pagination.
   */
  async findByCampaign(
    campaignId: string,
    pagination: IPaginationQuery,
    statusFilter?: MessageStatus,
  ): Promise<IPaginatedResult<IMessage>> {
    const filter: FilterQuery<IMessage> = { campaignId };
    if (statusFilter) {
      filter.status = statusFilter;
    }
    return this.findPaginated(filter, pagination);
  }

  /**
   * Update message status by WhatsApp message ID.
   */
  async updateStatusByWhatsAppId(
    whatsappMessageId: string,
    status: MessageStatus,
    additionalData: Partial<IMessage> = {},
  ): Promise<IMessage | null> {
    return this.model
      .findOneAndUpdate(
        { whatsappMessageId },
        { status, ...additionalData },
        { new: true },
      )
      .exec();
  }

  /**
   * Get aggregated stats for a campaign.
   */
  async getCampaignStats(
    campaignId: string,
  ): Promise<Record<MessageStatus, number>> {
    const results = await this.model
      .aggregate([
        { $match: { campaignId: new (require('mongoose').Types.ObjectId)(campaignId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    const stats: Record<string, number> = {
      [MessageStatus.PENDING]: 0,
      [MessageStatus.SENT]: 0,
      [MessageStatus.DELIVERED]: 0,
      [MessageStatus.READ]: 0,
      [MessageStatus.FAILED]: 0,
    };

    for (const result of results) {
      stats[result._id] = result.count;
    }

    return stats as Record<MessageStatus, number>;
  }

  /**
   * Bulk create message logs for a campaign.
   */
  async bulkCreate(messages: Partial<IMessage>[]): Promise<IMessage[]> {
    return this.model.insertMany(messages) as unknown as IMessage[];
  }

  /**
   * Find message by WhatsApp message ID.
   */
  async findByWhatsAppId(whatsappMessageId: string): Promise<IMessage | null> {
    return this.model.findOne({ whatsappMessageId }).exec();
  }
}
