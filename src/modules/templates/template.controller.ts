import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { TemplateService } from './template.service';
import { CreateTemplateDto, UpdateTemplateDto, TemplateQueryDto } from './template.dto';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils';
import { AuthenticatedRequest } from '../../common/interfaces';

@Service()
export class TemplateController {
  private readonly templateService = Container.get(TemplateService);

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const dto = req.body as CreateTemplateDto;
    const userId = req.user!.userId;
    const template = await this.templateService.create(dto, userId);
    sendCreated(res, template, 'Template created successfully');
  };

  findAll = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as TemplateQueryDto;
    const result = await this.templateService.findAll(query);
    sendSuccess(res, result.data, 'Templates retrieved successfully', 200, result.meta);
  };

  findById = async (req: Request, res: Response): Promise<void> => {
    const template = await this.templateService.findById(req.params.id as string);
    sendSuccess(res, template, 'Template retrieved successfully');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as UpdateTemplateDto;
    const template = await this.templateService.update(req.params.id as string, dto);
    sendSuccess(res, template, 'Template updated successfully');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.templateService.delete(req.params.id as string);
    sendNoContent(res);
  };

  getMetaTemplates = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const result = await this.templateService.syncMetaTemplates(userId);
    sendSuccess(res, result, 'Meta templates retrieved and synced successfully');
  };

  // POST /templates/meta/sync – fetch from Meta and sync to DB
  syncMeta = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const result = await this.templateService.syncMetaTemplates(userId);
    sendSuccess(res, result, 'Meta templates synced successfully');
  };
}
