import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { ReportService } from './report.service';
import { sendSuccess } from '../../common/utils';

@Service()
export class ReportController {
  private readonly reportService = Container.get(ReportService);

  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    const stats = await this.reportService.getDashboardStats();
    sendSuccess(res, stats, 'Dashboard stats retrieved successfully');
  };

  getCampaignPerformance = async (req: Request, res: Response): Promise<void> => {
    const report = await this.reportService.getCampaignPerformance();
    sendSuccess(res, report, 'Campaign performance report retrieved successfully');
  };
}
