import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { MessageService } from './message.service';
import { MessageQueryDto } from './message.dto';
import { sendSuccess } from '../../common/utils';

@Service()
export class MessageController {
  private readonly messageService = Container.get(MessageService);

  findByCampaign = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as MessageQueryDto;
    const campaignId = req.params.campaignId as string;
    const result = await this.messageService.findByCampaign(campaignId, query);
    sendSuccess(res, result.data, 'Messages retrieved successfully', 200, result.meta);
  };

  findById = async (req: Request, res: Response): Promise<void> => {
    const message = await this.messageService.findById(req.params.id as string);
    sendSuccess(res, message, 'Message retrieved successfully');
  };
}
