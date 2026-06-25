import { Service } from 'typedi';
import { UserModel } from '../users/user.model';
import { CustomerModel } from '../customers/customer.model';
import { TemplateModel } from '../templates/template.model';
import { CampaignModel } from '../campaigns/campaign.model';
import { MessageModel } from '../messages/message.model';
import { CampaignStatus, MessageStatus, CustomerGroup } from '../../common/constants';
import { DashboardStatsDto, CampaignPerformanceDto } from './report.dto';

@Service()
export class ReportService {
  /**
   * Fetch aggregate counts and stats for the main dashboard.
   */
  async getDashboardStats(): Promise<DashboardStatsDto> {
    const [
      totalUsers,
      totalCustomers,
      totalGroups,
      totalTemplates,
      campaignCounts,
      messageCounts,
    ] = await Promise.all([
      UserModel.countDocuments().exec(),
      CustomerModel.countDocuments().exec(),
      Promise.resolve(Object.keys(CustomerGroup).length),
      TemplateModel.countDocuments().exec(),
      this.getCampaignStatusCounts(),
      this.getMessageStatusCounts(),
    ]);

    return {
      totalUsers,
      totalCustomers,
      totalGroups,
      totalTemplates,
      totalCampaigns: campaignCounts,
      messageStats: messageCounts,
    };
  }

  /**
   * Fetch performance reports for completed or running campaigns.
   */
  async getCampaignPerformance(): Promise<CampaignPerformanceDto[]> {
    const campaigns = await CampaignModel.find({
      status: { $in: [CampaignStatus.RUNNING, CampaignStatus.COMPLETED] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    return campaigns.map((campaign) => {
      const stats = campaign.stats;
      const total = stats.total || 0;

      // Successful: sent, delivered, or read
      const successfulCount = stats.sent + stats.delivered + stats.read;

      const successRate = total > 0 ? (successfulCount / total) * 100 : 0;
      const deliveryRate = total > 0 ? (stats.delivered / total) * 100 : 0;
      const readRate = total > 0 ? (stats.read / total) * 100 : 0;

      return {
        campaignId: campaign.id,
        title: campaign.title,
        totalMessages: total,
        successRate: parseFloat(successRate.toFixed(2)),
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
        readRate: parseFloat(readRate.toFixed(2)),
      };
    });
  }

  private async getCampaignStatusCounts() {
    const counts = await CampaignModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();

    const stats = {
      total: 0,
      [CampaignStatus.DRAFT]: 0,
      [CampaignStatus.SCHEDULED]: 0,
      [CampaignStatus.RUNNING]: 0,
      [CampaignStatus.COMPLETED]: 0,
      [CampaignStatus.FAILED]: 0,
    };

    for (const item of counts) {
      if (item._id in stats) {
        (stats as any)[item._id] = item.count;
      }
      stats.total += item.count;
    }

    return stats;
  }

  private async getMessageStatusCounts() {
    const counts = await MessageModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();

    const stats = {
      total: 0,
      [MessageStatus.PENDING]: 0,
      [MessageStatus.SENT]: 0,
      [MessageStatus.DELIVERED]: 0,
      [MessageStatus.READ]: 0,
      [MessageStatus.FAILED]: 0,
    };

    for (const item of counts) {
      if (item._id in stats) {
        (stats as any)[item._id] = item.count;
      }
      stats.total += item.count;
    }

    return stats;
  }
}
