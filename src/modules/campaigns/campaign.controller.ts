import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, UpdateCampaignDto, CampaignQueryDto } from './campaign.dto';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils';
import { AuthenticatedRequest } from '../../common/interfaces';

@Service()
export class CampaignController {
  private readonly campaignService = Container.get(CampaignService);

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const dto = req.body as CreateCampaignDto;
    const userId = req.user!.userId;
    const campaign = await this.campaignService.create(dto, userId);
    sendCreated(res, campaign, 'Campaign created successfully');
  };

  findAll = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as CampaignQueryDto;
    const result = await this.campaignService.findAll(query);
    sendSuccess(res, result.data, 'Campaigns retrieved successfully', 200, result.meta);
  };

  findById = async (req: Request, res: Response): Promise<void> => {
    const campaign = await this.campaignService.findById(req.params.id as string);
    sendSuccess(res, campaign, 'Campaign retrieved successfully');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as UpdateCampaignDto;
    const campaign = await this.campaignService.update(req.params.id as string, dto);
    sendSuccess(res, campaign, 'Campaign updated successfully');
  };

  trigger = async (req: Request, res: Response): Promise<void> => {
    const campaign = await this.campaignService.trigger(req.params.id as string);
    sendSuccess(res, campaign, 'Campaign execution started successfully');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.campaignService.delete(req.params.id as string);
    sendNoContent(res);
  };
}
