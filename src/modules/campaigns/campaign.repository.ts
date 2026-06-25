import { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { BaseRepository } from '../../database/base.repository';
import { CampaignModel, ICampaign } from './campaign.model';
import { CampaignStatus } from '../../common/constants';

@Service()
export class CampaignRepository extends BaseRepository<ICampaign> {
  constructor() {
    super(CampaignModel);
  }

  /**
   * Find campaigns by status.
   */
  async findByStatus(status: CampaignStatus): Promise<ICampaign[]> {
    return this.model.find({ status }).exec();
  }

  /**
   * Find campaigns that are scheduled and due for execution.
   */
  async findScheduledCampaigns(): Promise<ICampaign[]> {
    return this.model
      .find({
        status: CampaignStatus.SCHEDULED,
        scheduledAt: { $lte: new Date() },
      })
      .exec();
  }

  /**
   * Update campaign status.
   */
  async updateStatus(
    id: string,
    status: CampaignStatus,
    additionalUpdates: Partial<ICampaign> = {},
  ): Promise<ICampaign | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        { status, ...additionalUpdates },
        { new: true, runValidators: true },
      )
      .exec();
  }

  /**
   * Increment campaign stats atomically.
   */
  async incrementStat(
    id: string,
    field: 'sent' | 'delivered' | 'read' | 'failed',
  ): Promise<void> {
    await this.model
      .findByIdAndUpdate(id, {
        $inc: { [`stats.${field}`]: 1 },
      })
      .exec();
  }

  /**
   * Find campaign with populated references.
   */
  async findByIdPopulated(id: string): Promise<ICampaign | null> {
    return this.model
      .findById(id)
      .populate('templateId', 'name body variables')
      .populate('createdBy', 'name email')
      .exec();
  }

  /**
   * Find all campaigns with populated references, paginated.
   */
  async findAllPopulated(
    filter: FilterQuery<ICampaign> = {},
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: ICampaign[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('templateId', 'name')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { data, total };
  }
}
